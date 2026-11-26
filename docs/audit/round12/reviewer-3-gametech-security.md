# Round 12, Reviewer 3: game tech, security and privacy (v0.32.0)

Branch `claude/sleepy-rubin-jot35n` at `a219993`. Diff: `git diff 0c999de..a219993 -- src test docs/clinical-sources.md README.md CLAUDE.md`.
Scratch scripts: `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round12/r3/` (`dtn2.js`, `shot.js`, `var.js`, `save.js`, `ui.py`).

## 1. Verdict

**Do not ship v0.32.0 behind the gate yet.** The headline Phase 3 feature, strokes that should not get the clot buster, is half wired. About 39% of strokes are now non-candidates. Each one still carries the 60-minute door-to-needle goal. A perfect player misses that goal on every one of them. The game then docks the score and writes a review entry that blames the delay on "CT, neurology, or pharmacy". The same patients still need blood pressure control as if a lytic were coming, which is the wrong lesson. Both are small fixes in `strokeSetup`. Fix them, add tests, then ship.

No XSS, save, determinism or crash problems found in the new code.

## 2. Score

**5 / 10.** Escaping, save round trips and class-code determinism hold up. The stroke goal and BP key bugs are real teaching errors in the feature the release exists to ship. The first-sheet grace also makes "order the whole list" cost nothing in score.

## 3. Findings (worst first)

### R3.12-01 High: every non-candidate stroke fails "Door to needle" with perfect care
- **Where:** `src/engine.js` `strokeSetup` (1180-1197) removes `tnk` from `p.tr` for `late`/`wake`/`thin`. It leaves `p.goals.dtn60 = null`, which `makePatient` set from `ALERTS.stroke.goals` (619, 1163). `goalMissTick` (3146) then marks it missed at 60 minutes. `goalWhy` (3164-3165) gives the reason.
- **What happens:** `goals.miss++` and `care(-20)` for the patient. The M&M review says "Door to needle went past 60 min for <name>" and blames "The thrombolytic waited on CT, neurology, or pharmacy". When the BP was over 185, it says "The pressure was over 185/110 and was never brought down". So a student who correctly withholds tenecteplase is told the lytic was late. The same happens in charge-nurse mode, because the goal sits on the patient. The board's goal timer also counts down a needle time that should never happen.
- **Reproduction:** `node scratchpad/round12/r3/dtn2.js late` (and `thin`, `wake`). The script makes a `strokew` patient, forces the kind through `p.hk`, and signs `bmp` and `cthead` at once. It then steps 90 minutes. Output: `late tr [] ... missNow []` (a perfect order set), then `goals {"ct25":true,"dtn60":false} misses+ 1`. In a natural run (`var.js`, 150 hard shifts), 202 of 517 strokes were non-candidates.
- **Fix:** In `strokeSetup`, when `kind !== 'in'`, `delete p.goals.dtn60`. When a stroke is set up again as `in` (the scripted path), restore it to `null`. Add a check to `rules14.js`: a non-candidate stroke played perfectly has no `dtn60` in its goals and no goal miss.
- **Effort:** 15 minutes.

### R3.12-02 High: non-candidate strokes still need "Blood pressure control" below 220/120
- **Where:** `strokeSetup` (1193-1196). `over` comes from the patient id, whatever the kind. Then `if (over) p.tr.unshift('bp')`. The over range is 192-212 / 100-114.
- **What happens:** For a patient who won't get a lytic, the game requires lowering the pressure under 185/110. Leaving it out shows "Blood pressure control" as missing, adds to `ordMiss` and loses the +10 clean-set bonus. AHA/ASA 2019 (section 3.3) says the opposite: without reperfusion and under 220/120, starting antihypertensives in the first 48 to 72 hours doesn't help (permissive hypertension). The 185/110 target is a lytic and thrombectomy rule. This is wrong teaching inside the Phase 3 stroke feature. In the natural sample, 87 of 202 non-candidates were "over". R6 should confirm the clinical rule. The bug is mechanical either way: `bp` is keyed to `over` alone, not to `kind`.
- **Reproduction:** `node scratchpad/round12/r3/dtn2.js thin` gives `thin tr ["bp"] bp0 [199,105] ... missNow ['Blood pressure control'] ordMiss+ 1`. `wake` gives the same (`bp0 [201,106]`).
- **Fix:** `if (over && kind === 'in') p.tr.unshift('bp')`. Decide with R6 whether `labet` for a non-candidate is neutral or an extra. Add a rules14 check.
- **Effort:** 15 minutes, plus the clinical decision.

### R3.12-03 Medium: first-sheet grace makes "order the whole complaint list" free, and the clean bonus rewards it
- **Where:** `WORKUP` / `workupOk` (1866-1878) and the two `first && workupOk` branches in `signOrders` (1911, 1937). The clean bonus is at 1960.
- **What happens:** On the first sheet, every test and drug on the group's list scores "fine". `extra` stays 0, so the +10 clean bonus still applies. `shot.js` signs the whole `det` and `rx` list, plus the case's needs, for all 28 grouped cases. Result: 0 extras in all 28. For the 15 cases whose needs sit inside the list (cpmod, cwp, nstemi, stemi, ptx, copd, chf, asthma, migraine, tia, dehyd, strokew, stroke, hyperk; lvo except its CTA), shotgunning scores exactly like the textbook set. The only cost is time: results come back later, and a CT head goes in for every headache and every "weak" patient. The order review files the shotgun items under "fine", so neither the student nor the instructor's numbers can tell a targeted workup from a shotgun one. "Order the whole list every time" now dominates on score.
- **Reproduction:** `node scratchpad/round12/r3/shot.js`. Every line shows `extra+ 0`. The `fine` lists show, for example, migraine: "CT head", "Blood cultures"; dehyd: "CT head".
- **Fix (pick one):** keep the grace items out of `extra` but also out of the clean bonus (`clean` only when `fl` has no grace items). Or count a `S.lowValue` stat and show it in the review and the class results. Or limit the grace to the first N items.
- **Effort:** 30 to 60 minutes, plus golden.

### R3.12-04 Medium: the grace grades opioids "fine" in hypotensive belly patients
- **Where:** `WORKUP.belly.rx` includes `morph` and `fent`. The `workupOk` branch (1911) runs before `wrong`/`fine`. `CONTRA_IF` opioids-under-90 covers only `cpmod`/`nstemi`/`stemi` (440).
- **What happens:** In a fresh `ectopic` (vitals `BP 81/46, HR 139`), morphine or fentanyl on the first sheet is listed as fine. Before v0.32.0 the same order counted as an extra (−3). In ACS the game treats opioids under SBP 90 as harm, so the rules now contradict each other. A fine drug also starts no treatment, so the grace teaches nothing useful here. R6 should rule on the clinical side.
- **Reproduction:** `node -e` in coverage: `trainPatient('ectopic')`, then `vitalsOf(p).sbp === 81`, then `signOrders(p.id, [], ['morph'])`. `ordLog.fine` holds "Morphine" (see `shot.js`: ectopic `fine` includes "Morphine", "Fentanyl").
- **Fix:** Have `workupOk` refuse drugs with a shock-dependent caution, for example `!(sbpUnder(p,90) && OPIOIDS.includes(k))`. Or drop opioids from `belly.rx`.
- **Effort:** 15 minutes.

### R3.12-05 Medium: the Onset row tells the player to hurry the lytic for patients who must not get it
- **Where:** `src/ui.js` 945-949.
- **What happens:** For a `thin` stroke inside 4.5 hours, the card shows "Last known well 05:36 · the thrombolytic has to be in by 10:06" and right under it "Takes apixaban (a blood thinner)". For a `late` stroke (5 to 10 hours out), it shows a "has to be in by" time hours in the past. The copy baits the harm order the feature is meant to teach against. Screenshot: `scratchpad/round12/r3/stroke_sheet.png`.
- **Reproduction:** `CHROME_PATH=/usr/bin/google-chrome python3 scratchpad/round12/r3/ui.py`. The SHEET1 text shows both rows.
- **Fix:** Show the deadline only when `G.t < p.lkwT + LYTIC_WINDOW`. Otherwise show "4.5-hour window passed at HH:MM". The deadline line can stay for the anticoagulated patient, because the Home meds row is the clue. Just don't phrase it as an instruction ("window closes HH:MM").
- **Effort:** 10 minutes.

### R3.12-06 Low: grace by hidden case gives the same orders different scores on similar complaints
- **Where:** `WORKUP_OF` maps the case key, not the visible complaint. Only 28 of the ~75 cases are grouped.
- **What happens:** On a first sheet of `ecg, trop, cbc, bmp, gluc`: "Weak and dizzy" (dehyd) counts Troponin as extra. "Dizzy, nearly passed out" (chb) and "Racing heart" (afib) count Fingerstick glucose as extra. "Passed out" (syncope) counts nothing. A fingerstick in near-syncope is routine. The code comment says "graded against the presenting complaint", but it is graded per hidden case.
- **Reproduction:** the `node -e` loop in coverage. Output: `chb extra 1 ["Fingerstick glucose"]`, `dehyd extra 1 ["Troponin"]`, `afib extra 1 ["Fingerstick glucose"]`.
- **Fix:** Group the remaining complaints (syncope/chb/afib with ECG, glucose and troponin; fever with cultures and lactate), or reword the comment and the README.
- **Effort:** 30 minutes.

### R3.12-07 Low: the EMS report says nothing about a wake-up onset or a blood thinner
- **Where:** `src/engine.js` 3956. It adds "Last known well HH:MM" only when `lkwT != null`.
- **What happens:** A wake-up stroke report just leaves the onset out, and a thin stroke's report doesn't mention apixaban. Real EMS would say both. The player only finds out once the patient is seen.
- **Fix:** add `: p.strokeKind === 'wake' ? ' Woke up with it; last known well unknown.' : ''`, and a blood-thinner clause.
- **Effort:** 5 minutes.

### R3.12-08 Low: the grace makes low-value orders free
- **Where:** `WORKUP.headache.det` includes `bcx` and `cthead`; `weak.det` includes `cthead`.
- **What happens:** Blood cultures for a migraine and a CT head for dehydration or hyperkalemia score "fine". (Clinical judgement for R6. Flagged because it feeds R3.12-03.)
- **Effort:** a data change.

### R3.12-09 Low: no test covers the stroke goal or the BP key for non-candidates
- **Where:** `test/rules14.js` checks `tr` and `anticoag` but not `p.goals` or `bp`. That is why R3.12-01 and R3.12-02 passed 751 ok lines and the stress run.
- **Fix:** add the two checks named above.

### R3.12-10 Nitpick: `p.gray.score` goes into HTML unescaped
- **Where:** `src/ui.js` 554, 721, 833, 956.
- **What happens:** The engine always makes it a number. Only a hand-edited save on the player's own device could inject anything (self-XSS, same origin), and the CSP blocks inline handlers. Every other new string (`anticoag`, `parts`, `tool`, `band`) goes through `esc`. Checked live: an `anticoag` of `<img src=x onerror=...>` and a `parts` entry of `<b id=pwn>` both render as text.
- **Fix:** wrap it in `esc()` or `Number()` for consistency.

### R3.12-11 Nitpick: stale comment on the ALSO line
- **Where:** `src/engine.js` 452.
- **What happens:** The line still ends "v0.29.1: potassium in DKA (K 4.8) is reasonable, not required". `kcl` has moved from `ALSO.dka` to the required `RXOK.dka.meds`.

### R3.12-12 Nitpick: duplicate names in the `OC` export
- **Where:** `src/engine.js` 4955.
- **What happens:** `contraWhy` and `strokeSetup` are each listed twice in the same object literal (harmless, but sloppy).

## 4. Coverage

- Read the diff in full (`engine.js`, `ui.js`, `rules14.js`, the changed rules3/4/9), the Round 12 brief and the clinician's answers.
- **XSS / escaping:** the new Onset, Home meds and Risk-parts strings were checked in code and in Chrome (`ui.py`) with injected markup. Nothing executed and no element was created. No page errors and no console errors.
- **Save/load:** four hard md shifts. Each was stepped, snapshotted with `JSON.stringify(G)`, stepped on, then reloaded with `OC.load` and stepped again. The results are byte-identical, and stroke kinds and `anticoag` survive (`save.js`). Old v0.31 saves: missing `strokeKind`/`anticoag`/`gray.parts` fall back safely (`(p.gray.parts || [])`, falsy `anticoag`). `G.v` is unchanged.
- **Class-code stroke variety:** the kind comes from `vhash(pkey(p)+'lkwk')`, using the stream sub-seed key (`hk`). So every student on a code gets the same kind for the same patient, and it draws nothing from the dice. Across 150 seeds: in 315, late 89, wake 58, thin 55. The late `lkw` range is 308 to 600 and the in-window range 35 to 145. The kind is independent of BP over/under.
- **First-sheet grace:** `p.ord === 'need'` is set only once, in `awaitOrders`, so the grace can't be re-armed. The full-list shotgun was measured on all 28 grouped cases (`shot.js`). Harm still fires (dissection plus aspirin gives harm 1).
- **Performance:** `workupOk` is two object lookups and two `includes` over arrays of 7 items or fewer, once per order. Not measurable. `strokeSetup` adds one `CASES.find` per stroke arrival.
- **Crash paths:** `npm test` gives 751 ok and 0 FAIL. `npm run stress` (188 shifts) finishes with vitals in range and no stuck states. A wake-up stroke (`lkw`/`lkwT` null) was traced through `lyticWindowOk`, `contraWhy`, the `flowTick` window close (guarded by `lkwT != null`), the radio report and the UI. No null dereference.
- **Build:** rebuilt from source in scratch. `index.html` and `sw.js` are byte-identical to the committed files.
- **Not done:** WebKit and Firefox; the 3D floor; anything on supabase.co or edcodeblack.com (as instructed). No database change in this release.
