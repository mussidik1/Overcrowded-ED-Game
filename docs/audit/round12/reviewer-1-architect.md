# Round 12, Reviewer 1 (architecture): v0.32.0

Diff: `git diff 0c999de..a219993 -- src test docs/clinical-sources.md README.md CLAUDE.md`. Scratch scripts: `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round12/r1/` (p1.js to p14.js, ui1.py, old_engine.js = `git show 0c999de:src/engine.js`).

## 1. Verdict

**Do not ship v0.32.0, even behind the gate, until R1.12-01 to R1.12-04 are fixed.** The stroke rework turns 38% of strokes into non-candidates, but the rest of the engine still treats every stroke as a lytic case. The goal clock, the blood-pressure key and the teaching text were never changed to match. Every non-candidate stroke now costs a missed goal and an M&M entry that blames staff for a drug the patient must not get. A new ALSO entry also makes IV fluids impossible to order in anaphylactic shock. That is a regression from v0.31.0. `npm test` and `npm run stress` pass. That only shows the tests check the new paths in isolation, not how they work with the rest of the engine.

## 2. Score: 3 / 10

## 3. Findings

### R1.12-01 Critical: every non-candidate stroke fails the door-to-needle goal, in both roles
- **Location:** `src/engine.js` `strokeSetup` (1180-1198) and `goalMissTick` (3146). `ALERTS.stroke.goals = ['ct25','dtn60']` (619) is set for every stroke in `makePatient` (1162). Nothing removes `dtn60` when `strokeKind !== 'in'`.
- **What happens:** for a late, wake-up or apixaban stroke, tenecteplase is no longer in the key, and ordering it counts as harm. `dtn60` stays `null` until 60 minutes pass. Then `goalMissTick` applies care −20, `goals.miss++`, a "Missed: Door to needle under 60 min" toast, and an M&M line "Door to needle went past 60 min". `goalWhy` explains it as "The thrombolytic waited on CT, neurology, or pharmacy" or "The pressure was over 185/110 and was never brought down". So the player is penalised for correct care, and the debrief teaches the opposite of the harm rule.
- **Reproduction:** `node scratchpad/round12/r1/p2.js` prints `goals {"ct25":false,"dtn60":false}` for the `wake`, `late` and `thin` kinds, where `right.tr` is `[]`. In charge-nurse mode, `node .../p13.js` (8 hard shifts, autopilot at accuracy 0.8) prints `{"in":[10,3],"late":[0,3],"wake":[0,4],"thin":[0,2]}`: every non-candidate stroke missed dtn60.
- **Fix:** in `strokeSetup`, `if (kind !== 'in') delete p.goals.dtn60;`, and add the goal back when a scripted stroke is set up again as `in`. Guard `goalMissTick` for old saves (`STROKE_CASES.includes(p.ck) && !p.right?.tr.includes('tnk')`). Add a rules14 check that a late stroke left without tenecteplase has no missed goal. **Effort:** S.

### R1.12-02 High: ALSO is checked before "need", so a drug on an ALSO list can never fill a treatment the patient needs (fluids can't be ordered in anaphylactic shock)
- **Location:** `signOrders`, `src/engine.js` 1908 (`if ((ALSO[p.ck] || []).includes(k)) { drugOk.push(D.n); continue; }` runs before the `need` line 1909). Line 460 now gives `ALSO.anaph` `ns` and `lr`.
- **What happens:** `CRASH.anaph` adds `fluids` (and `o2`) to the key. Normal saline and LR both hit ALSO first. Each is reported as "Also reasonable", but `fluids` never fills. The order menu (`ORDER_MENUS` 510) offers only `ns`, `lr`, `blood` and `mtp` for fluids, so the player has no way to fill it. The patient stays with `txGap ['fluids']`, untreated. In v0.31.0, normal saline filled it. A v0.31.0 save resumed on v0.32.0 hits the same bug (non-code saves resume across versions, `readSave` ui.js 2954): an anaphylaxis patient whose key still holds `meds` shows "Missed: Medications (diphenhydramine)" after diphenhydramine was ordered.
- **Reproduction:** `node .../p7.js .../old_engine.js` gives `p.tr [epi,o2,fluids]`. `node .../p7.js src/engine.js` gives `p.tr [epi,o2] txGap ['fluids'] untreated 1`. Old-save shape: `node .../p12.js` prints `miss [ 'Medications (diphenhydramine)' ]`.
- **Fix:** move the ALSO check below the `need` check, or skip ALSO when some `t` in `D.tx` is in `R.tr`, not yet given, and `rxOk`. Add a test: crash an anaphylaxis patient, order normal saline, expect `fluids` filled. **Effort:** S.

### R1.12-03 High: non-candidate strokes over 185/110 still require blood-pressure control
- **Location:** `strokeSetup` 1196-1197: `if (over) p.tr.unshift('bp')` runs whatever the kind is. `goalWhy` 3164 also blames the unlowered pressure.
- **What happens:** 185/110 is the limit before a thrombolytic. For a stroke that gets no lytic (late, wake-up or on apixaban), AHA/ASA 2019 says not to lower a pressure under 220/120 in the first 48 to 72 hours (permissive hypertension). The engine still requires labetalol and marks the patient "untreated" without it. A large-vessel stroke going for thrombectomy is the exception (185/110 still applies before thrombectomy), but `strokew` and `stroke` aren't large-vessel cases.
- **Reproduction:** `node .../p1.js` prints `late stroke over BP [200,105] tr ['bp']`. After the CT and BMP: `miss ['Blood pressure control']`, `untreated 1`, `txGap ['bp']`.
- **Fix:** `if (over && (kind === 'in' || p.ck === 'lvo')) p.tr.unshift('bp')`. For the others, add `bp` to the key only over 220/120. R6 should confirm. **Effort:** S.

### R1.12-04 High: the teaching text contradicts the new answer keys
- **Location:** `ORD_WHY` (`src/engine.js` 1680-1730), `RX` (1828-1830), the ui.js Onset row (945-948).
  - `ORD_WHY.strokew` and `ORD_WHY.stroke`: "…Then the clot-busting drug." It shows for every stroke: in "The workup" on the Your call panel (`whyOf`, ui.js 1142) and as the explanation in Orders to review (ui.js 3151). For an apixaban stroke given tenecteplase, the same row reads "Can hurt them: Tenecteplase (they take apixaban…)" and then "Then the clot-busting drug."
  - `ORD_WHY.copd`: "A steroid is reasonable." The key now requires a steroid and an antibiotic (R6-13).
  - `ORD_WHY.dka`: "Insulin once the potassium is known." Potassium is now required (R6-15), and rules14 asserts that insulin on the same sheet as the BMP is fine.
  - `RX.anaph` "an antihistamine and a steroid" and `RXOK.anaph.meds` are dead now that `anaph.tr` is `['epi']`.
  - The stroke card shows "the thrombolytic has to be in by 10:06" directly above "Takes apixaban (a blood thinner)". For a late stroke it shows "has to be in by 05:14" at 07:01: a deadline that has already passed, worded as an instruction.
- **Reproduction:** `CHROME_PATH=/usr/bin/google-chrome python3 .../ui1.py` prints the card text for two `thin` patients and one `late` patient, as quoted above. `OC.whyOf(p)` on any non-candidate stroke returns the clot-buster sentence.
- **Fix:** give each stroke kind its own `whyOf` text ("outside the window / on a blood thinner: no clot buster; neurology, admit"). Update the copd and dka text. Show the Onset deadline only when `strokeKind === 'in'` and it is still ahead, otherwise "outside the 4.5-hour window". **Effort:** S.

### R1.12-05 Medium: a first-sheet workup drug is listed as given, but no treatment starts, and the drug can't be ordered again
- **Location:** `signOrders` 1911: `if (first && workupOk(p, k)) { drugOk.push(D.n); continue; }` runs after `p.drugs.push(k)` (1897), so nothing goes into `tk`.
- **What happens:** for appendicitis, a normal saline bolus shows "Also reasonable: Normal saline bolus", but `p.tr` gets no `fluids` and no nurse task is created. Albuterol for heart failure behaves the same way. Ordering the same drug again returns `Pick at least one order`, because `p.drugs` already holds it. The order review records a drug the patient never received. If the patient later needs that treatment, the drug route stays blocked.
- **Reproduction:** `node .../p5.js` gives `appy … p.tr [] | drugs ["ns"] | fine ["Normal saline bolus"] treat []`, then `again: {"ok":false,"why":"Pick at least one order"}`. `chf` with albuterol gives the same result.
- **Fix:** make the workup route add `D.tx[0]` to `tk` and score it as fine (the same branch as `OKL`), or leave the drug out of `p.drugs`. **Effort:** S to M.

### R1.12-06 Medium: first-sheet leniency still earns the "clean set" bonus, and WORKUP is an unchecked list keyed by hidden case
- **Location:** `WORKUP`, `WORKUP_OF` and `workupOk` (1870-1878), and the clean bonus at 1962.
- **What happens:** an asthma patient (`ORD_WHY`: "No tests.") with all seven shortness-of-breath tests on the first sheet scores `clean +1` and care +16. The panel says "No tests" while the score rewards a full workup. WORKUP is a hand-kept list of hidden case keys, not tied to the case's complaint (`cc`). `addCase` and `lintCases` never check it. All 31 keys are valid today (p4.js), but a case added later with a chest-pain complaint gets no leniency without any warning. `rsv`, `burn` and `mcired` already have breathing, chest or belly complaints and aren't covered.
- **Reproduction:** `node .../p14.js` gives `clean + 1 care delta 16.0 wk [xr,lab,ecg] why No tests…`. `node .../p4.js` lists the uncovered cases.
- **Fix:** don't count workup-only orders toward the clean bonus (or show them as "not needed this time, fine to send"). Lint every WORKUP key and test name in `lintCases`. Set the complaint group in the case data (`addCase({ grp: 'chest' })`). **Effort:** S.

### R1.12-07 Medium: risk-score branches that can never run, and a test that can't fail
- **Location:** `grayScore` (1219-1240) against the case ages (`pnalow` 25-64, `tia` 55-88, `cwp` 25-60).
- **What happens:** `pnalow` is never 65 or older, so the CURB-65 age part never applies. The score is at most 1, always `low → home`. In v0.31.0, 31% were moderate, with observation as the right call. The pneumonia gray-zone decision is gone, yet the moderate branch and the `age 65 or more` part stay in the code. The ABCD2 score tops out at 4, so its high band can't happen (it was 22% in v0.31.0). The rules14 check `CURB-65 && !!agePart !== (p.age >= 65)` passes only because neither side can ever be true.
- **Reproduction:** `node .../p9.js src/engine.js` gives `pnalow low->home 300/300` and TIA with no `high`. `node .../p9.js .../old_engine.js` gives `pnalow moderate->obs 93` and `tia high->admit 65`.
- **Fix:** decide on purpose. Either widen `pnalow` ages or make the BUN and other parts able to reach 2, or delete the code that can't run and record that pneumonia isn't a gray zone any more. Make the test assert that each band can be reached. **Effort:** S.

### R1.12-08 Low: the golden updates claim "arrivals unchanged", and that's false
- **Location:** the commit messages of `bcd9f58` and `ea07997`, and `test/golden.json` `shifts.*.arrivals`.
- **What happens:** arrivals changed in 10 shifts at `bcd9f58` and 4 at `ea07997` (rn/hard 134→125, md/rush 23→27, md/med/board 103→114). I checked that the walk-in streams are identical across versions (p10.js: old and new walk-in lists match). The arrival changes are play-driven: EMS diversion, return visits, and the careless md/med 777 run now fired at 540 minutes instead of 665. Class sync isn't broken, but the claim shows the golden diff wasn't read line by line. `golden.json` `version` still says `0.31.0`.
- **Fix:** correct the claim in the release notes or STATUS. Regenerate golden at the release commit so its `version` matches. **Effort:** XS.

### R1.12-09 Low: the strokeSetup API mixes two concerns
- **Location:** `strokeSetup` 1180-1198, `trainPatient` 4363.
- **What happens:** passing `o.lkw` forces `kind = 'in'`, so a scripted onset also means eligible. Orientation can't script a wake-up or apixaban teaching case without new plumbing. `trainPatient` always passes `lkw` (`o.lkw ?? 50`), so every Lesson stroke is a candidate. The engine writes `p.strokeKind` but never reads it (only rules14 does). The tenecteplase restore searches `CASES` linearly instead of using the case object. Old saves without `strokeKind` are harmless today only because nothing reads it, and R1.12-01's fix will need it.
- **Fix:** `strokeSetup(p, { kind, lkw, over })`, with `kind` explicit. Read `strokeKind`, falling back to the window for old saves. **Effort:** S.

### R1.12-10 Low: rules14 has blind spots
- **Location:** `test/rules14.js`.
- **What happens:** `okKey` and `harmOk` start as true, and only a matching patient can make them false. The apixaban harm check passed against the v0.31.0 engine (r14_old.js), because v0.31.0 had no apixaban strokes. The `harm18` line prints `ok -` whatever happens. Nothing tests the goal clock, the blood pressure of non-candidate strokes, ALSO against need, a workup drug actually being given, the old-save shape, or tenecteplase counting as harm for late and wake-up strokes. Every serious finding above passes the suite. Most new checks do fail on the old engine (21 of 28 workup sheets failed there, p11.js), so the suite does tell old from new.
- **Fix:** add the checks above. Count the apixaban patients before claiming harm is checked. **Effort:** S.

### R1.12-11 Low: the "Home meds" row appears only on anticoagulated strokes
- **Location:** ui.js 948.
- **What happens:** the row's presence alone says "don't give the lytic". No other patient ever has home medications listed.
- **Fix:** show home meds for every stroke ("none", or a list of medicines that don't matter here). **Effort:** S.

### R1.12-12 Nitpick
- The `OC` export lists `contraWhy` and `strokeSetup` twice (4955).
- CLAUDE.md still says "rules.js through rules13.js", leaves rules14 out of the layout, and its `CONTRA_IF` list omits blood thinners.
- `copd` has `meds` in both `tr` and `ok`.
- `RXREQ.pna` accepts doxycycline, which isn't in `RXOK.pna.abx`. `rxName` then returns "doxycycline" for a pneumonia patient.
- `RXOK.asthma` and `RXOK.anaph.meds` are stale relative to the new keys.

## 4. Coverage
- I read the whole engine and UI diff, rules14.js, the rules3, rules4 and rules9 edits, the golden diff by section and by commit, and the README and CLAUDE.md diffs.
- `npm test` passes (exit 0). `npm run stress` passes ("vitals stayed in range").
- I ran rules14 against the v0.31.0 engine. Its new checks mostly fail there, except the apixaban harm check, which passes trivially. It then crashes on the missing `parts`.
- Node probes: stroke kinds against the goals and the BP key, in both roles; ALSO against need in anaphylactic shock and with an old-save shape; combination keys for pneumonia, shock and COPD; the workup phantom drug and the clean bonus; WORKUP key validity and coverage; gray-score distributions old against new; walk-in stream identity old against new.
- Playwright (Chrome, phone size, list view, built `index.html`): the stroke card for apixaban and late kinds. No page errors.
- I didn't build, update golden, commit, or contact supabase.co or edcodeblack.com.
