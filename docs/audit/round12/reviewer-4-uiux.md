# Round 12, Reviewer 4 (UI/UX): v0.32.0

Diff reviewed: `git diff 0c999de..a219993 -- src test docs/clinical-sources.md README.md CLAUDE.md`. Built `index.html` at HEAD, unmodified (it contains the v0.32.0 code). Scratch scripts and screenshots: `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round12/r4/` (`shots/`).

## 1. Verdict

**Do not ship v0.32.0, even behind the gate, until R4.12-01 to 03 are fixed.** This release changed the answer key and left the scripted teaching on the old one. A student who follows the attending Orientation's DKA chapter, or the "Trouble breathing" lesson, does exactly what the preceptor says and finishes with "Missed:" on the patient. Every stroke that correctly does not get the thrombolytic is still charged a missed "Door to needle" goal. The Orientation's HEART step can show a 58-year-old woman with "age 65 or more (2)" and a score of 7, then tell the player to pick Observation. None of the three fixes is large.

## 2. Score

**4 / 10.** The card lines themselves render cleanly at all three sizes, with no horizontal scroll. The rule changes were not carried into Orientation, the lessons, the goals or the review wording.

## 3. Findings (worst first)

### R4.12-01 · High · Orientation (attending) DKA and the "Trouble breathing" lesson teach the old regimen; following the preceptor now ends in "Missed"
- **Where:** `src/ui.js:1835` (a3: "Order a BMP …, fluids, and an insulin drip"; ordStep `[['t','lab'],['r','fluids'],['r','insulin']]`), `src/ui.js:1836` (a4: "Potassium 4.8: safe for insulin"). `src/ui.js:1972` (lesson `breath` b5: neb plus BiPAP only) and its b8 summary ("Wheezing: nebulizer. BiPAP if tiring."). The cause is `src/engine.js:695` (`dka` tr adds `meds`, RXOK `dka: { meds: ['kcl'] }`) and `src/engine.js:675` (`copd` tr is now `nebs, meds, abx, bipap`). `ORD_WHY.copd` (`engine.js:1696`) still says "A steroid is reasonable", while the review lists the steroid as missed. `ORD_WHY.dka` never mentions giving potassium.
- **Reproduction:** `CHROME_PATH=/usr/bin/google-chrome MODE=md VIEW=list python3 test/train_test.py`, with a probe at steps a4 to b1 (scratch `tt.py`). Aisha at a5: `tr: ['fluids','insulin'], txGap: ['meds'], ordLog.miss: ['Medications (potassium)']`. She is admitted with the gap still open. `MODE=md LESSON=breath`: at the final step Earl has `txGap: ['meds','abx'], miss: ['Medications (methylprednisolone)','Antibiotics']`, and the review "why" line says the steroid is "reasonable". `train_test.py` still reports "No errors", because it never checks for a treatment gap.
- **Why it matters:** these scripts are the only teaching for DKA and COPD. They now teach a regimen that the game itself, the README ("DKA needs potassium", "COPD on BiPAP needs a steroid and an antibiotic") and the clinician's answers all call incomplete. CLAUDE.md says to teach in Orientation and the Lessons.
- **Fix:**
  - a3: add **Potassium chloride**, with one line: "insulin drives potassium into cells; at 4.8 add it to the fluids". Add `['r','meds']` to its ordStep.
  - b5: add the steroid and the antibiotic. Fix b8 and `ORD_WHY.copd`/`ORD_WHY.dka`.
  - Add an assertion to `train_test.py` that the lesson patient ends with no `txGap`.
- **Effort:** S (about 1 hour).

### R4.12-02 · High · Strokes that correctly get no thrombolytic are charged a missed "Door to needle" goal
- **Where:** `src/engine.js:1180` (`strokeSetup`). It removes `tnk` from `p.tr` for `late`, `wake` and `thin` strokes, but leaves `p.goals.dtn60` (set from `ALERTS.stroke.goals`, `engine.js:619`). `goalMissTick` (`engine.js:3146`) then marks it false at 60 minutes: −20 care, a "Missed: Door to needle under 60 min" toast, and a mistake-log entry whose reason (`goalWhy`, `engine.js:3165`) reads "The thrombolytic waited on CT, neurology, or pharmacy".
- **Reproduction:** run scratch `dtn.js` (40 hard shifts on the autopilot, seeds 5001 to 5040). Tally of `strokeKind:goals.dtn60`: `late:false 10, thin:false 10, wake:false 13`. Every ineligible stroke still in the department at 60 minutes counts as a failed goal.
- **Why it matters:** the player is punished, and told the drug "waited", for the right decision. The end-of-shift goals list counts it as well. This contradicts the whole point of R6-02.
- **Fix:** in `strokeSetup`, when `kind !== 'in'`, `delete p.goals.dtn60`. When a scripted re-setup makes the stroke eligible again, restore it (`p.goals.dtn60 = null`) if it is absent. Add a rules14 check.
- **Effort:** S.

### R4.12-03 · High · The Orientation HEART step (g6) can contradict Grace's age and its own instruction
- **Where:** `src/engine.js:1160` computes `grayScore(c, age)` inside `makePatient`, using the random case age. `trainPatient` (`engine.js:4360`) overrides `p.age = 58` afterwards, so the "age" part of the score still comes from the discarded random age (cpmod draws 45 to 75). The draw also follows the main RNG, which moves with the player's pace in Orientation. `src/ui.js:1737` (g6) says "Hers is **N**. … **7+**: admit. Tap … **Observation**", whatever N is.
- **Reproduction:**
  - Scratch `grace.js`: across 400 seeds, `trainPatient('cpmod','walk',{age:58})` gives 128 of 400 cards with "age 65 or more (2)" on a 58-year-old, and 33 of 400 with a score of 7 ("high").
  - Scratch `pace.js`, on Orientation's fixed seed 20261116: stepping the clock 0, 5, 10, 90 minutes before Grace arrives gives these age parts: "45 to 64", "65 or more", "65 or more", and at 90 minutes **7 · high risk, age 65 or more (2)**. A slow player therefore sees "Grace, 58", "age 65 or more (2)" and "Hers is 7 … 7+: admit … Tap Observation".
  - On the scripted fast run (train_test.py, MODE=rn) she happened to get 4 with "45 to 64".
- **Why it matters:** R6-16 existed so that "a score never contradicts the patient". In the one place every charge nurse is taught the score, it can still contradict her age, and the preceptor can contradict itself.
- **Fix:** recompute `p.gray = grayScore(c, p.age)` in `trainPatient` after the overrides. For g6, pin the score (pass fixed parts through an option, or draw in `inStream` with a fixed sub-seed) so it is always 4 to 6. Also recompute after any other age override.
- **Effort:** S.

### R4.12-04 · Medium · Order review wording: "Also reasonable: Aspirin" printed under the final diagnosis (pulmonary embolism, pneumothorax)
- **Where:** `src/engine.js:1911` and `:1937`. First-sheet `WORKUP` orders go into `fl`/`drugOk`, and from there into `ordLog.fine`. `src/ui.js:3151` (end-of-shift "Orders to review") and `src/ui.js:1142` (the Your call hint) print them as "Also reasonable: …" next to `x.dx`.
- **Reproduction:** run scratch `wk.js`.
  - `pe` signed with aspirin: `fine: ["Aspirin","CBC","Chest X-ray"]`.
  - `ptx`: `fine: ["Aspirin", …]`.
  - `sah`: `fine: [… "Blood cultures"]`.
  - `ectopic`: `fine: ["Morphine", …, "Lipase", "Urinalysis"]`.
  - In the review these read as "Pneumothorax · Also reasonable: Aspirin".
- **Why it matters:** the review is the teaching surface. Without the qualifier it reads as an endorsement of aspirin for a collapsed lung or a PE. The intent was "fine as a first workup for chest pain".
- **Fix:** keep workup passes in a separate list (`ordLog.workup`) and print them as "Fine as a first chest-pain workup: Aspirin, CBC". Or leave them out of the review entirely.
- **Effort:** S.

### R4.12-05 · Medium · A late stroke's Onset line gives a deadline that has already passed; an anticoagulated stroke's line promises a thrombolytic deadline
- **Where:** `src/ui.js:946`. The `p.lkwT + LYTIC_WINDOW` text is used for every stroke with a known time. A `late` stroke has `lkw` of 300 to 600 minutes, so the deadline is always in the past.
- **Reproduction:** scratch `cards.py` (screenshots `card_390x844_p1_stroke_late.png` and `card_844x390_p1_stroke_thin.png`).
  - At 07:00, a late stroke reads "Last known well 00:00 · the thrombolytic has to be in by 04:30".
  - A `thin` stroke reads "the thrombolytic has to be in by 10:40", with "Home meds: Takes apixaban (a blood thinner)" on the next row.
- **Why it matters:** a lay player reads "has to be in by" as an instruction to give it. For these patients the right answer is not to give it.
- **Fix:** if `!lyticWindowOk(p)`, print "Last known well 00:00 · **past the 4½-hour window**". Keep the deadline wording only while the window is open. For the anticoagulated stroke, say "a blood thinner: no clot buster". Whether to state the decision outright is the owner's call, given "the diagnosis stays the player's call". At minimum, do not print a past deadline as an instruction.
- **Effort:** S.

### R4.12-06 · Medium · The three new reasons not to give a thrombolytic are taught nowhere
- **Where:** stroke lesson `src/ui.js:1903` to `1915` (k3 mentions only the 4½ hours; k9 says "Order: CT, labs, thrombolytic"). Orientation s1 to s6 (`ui.js:1855` to `1862`). Words glossary: no "last known well" or "wake-up stroke" entry, and nothing on blood thinners and clot busters.
- **Reproduction:** `grep -n "woke up\|blood thinner" src/ui.js`. The only hits are the card lines themselves (947, 948) and glossary entries for reversal and coags. The first time a player meets "woke up with it" or apixaban, the lesson is a harm mark.
- **Why it matters:** CLAUDE.md says to teach in Orientation and the Lessons. About 38% of strokes are now ineligible (`strokeSetup`: in < 0.62).
- **Fix:**
  - Add a stroke-lesson card: "No clot drug if: **over 4½ hours**, **onset unknown** (woke up with it), or **on a blood thinner**."
  - Put the same three in k9.
  - Add "Last known well" and "Wake-up stroke" to Words.
- **Effort:** S.

### R4.12-07 · Medium · Sepsis lesson: the text names one antibiotic, but the spotlight rings two
- **Where:** `src/ui.js:1949` (p5: "…**Piperacillin-tazobactam** (Antibiotics by vein)…"). `ordList` expands `['r','abx']` through `E.drugsFor`, which is now `['piptazo','vanc']` (`RXREQ.shock`, `engine.js:451`). p8 still says "antibiotics" with no hint that two are needed.
- **Reproduction:** `node -e "const OC=require('./src/engine.js');OC.newGame('easy',3,{mode:'md'});const p=OC.pt(OC.trainPatient('shock','ems',{}));console.log(OC.drugsFor(p,'abx'))"` prints `['piptazo','vanc']`. In `LESSON=sepsis`, the preceptor rings **Vancomycin**, which the card never mentions.
- **Fix:** name **Vancomycin** in p5, with "two antibiotics: one for gut and urine germs, one for MRSA". Update p8.
- **Effort:** XS.

### R4.12-08 · Medium · HEART "risk factors (n)" reads as a count, and can contradict the exam
- **Where:** `src/engine.js:1226` to `1230`. For cpmod, `r = randi(1, 2)` points. The cpmod exam (`engine.js` EXAM) always says "Has diabetes and high blood pressure", which is two risk factors.
- **Reproduction:** in screenshot `card_360x640_p1_heart.png`, "risk factors (2)" sits under "Has diabetes and high blood pressure". When r is 1, the card shows "risk factors (1)" under the same two risk factors.
- **Why it matters:**
  - A lay player reads "(2)" as two risk factors.
  - A clinician knows two risk factors score 1 point in HEART; 2 points needs three or more, or known atherosclerosis.
  - Either way, the line and the exam disagree on about half of cpmod patients. That is the consistency R6-16 promised.
- **Fix:**
  - Label the points explicitly: "risk factors: 2 of them (+1)", or "risk factors +1".
  - Derive r from the exam (fixed at 1 for this exam text), or vary the exam text with r.
- **Effort:** S.

### R4.12-09 · Medium · Plain words does nothing for the new risk parts; jargon goes unglossed
- **Where:** `src/ui.js:956`. The parts are printed as-is whatever `PLAIN()` says. "BUN 24 (1)", "ECG nonspecific changes (1)" and "history moderately suspicious (1)" carry no gloss. The Experience row on the same card does use `PLAIN()`.
- **Reproduction:** cards.py with `oc-plain` set to '1' and to '0': the Risk row is identical. The curb card reads "CURB-65 1 · low risk (BUN 24 (1))". BUN 24 appears nowhere else on the card (the lab finding is "WBC 13.1").
- **Fix:** under Plain words, add one `<small class="dxp">` line: "points add up; each part in brackets is its points". Gloss BUN as "kidney test". Add "BUN 24" to the pnalow lab finding when it scores, so the part can be checked.
- **Effort:** S.

### R4.12-10 · Low · The Risk row is long, nests parentheses, and lists zero parts inconsistently
- **Where:** `src/ui.js:956`, `engine.js:1219` to `1240`.
- **Reproduction:**
  - At 360x640, a HEART 7 row wraps to five lines (`card_360x640_p1_heart.png`) and ends in "troponin normal (0))".
  - cwp shows only "(troponin normal (0))" for a score of 0, hiding history 0 and ECG 0.
  - TIA lists "numbness only (0)".
  - Canadian Syncope shows no parts at all, so "each score is the sum of the parts listed" (README) is not true for syncope.
- **Fix:** put the parts on their own `<small class="dxp">` line, without the outer parentheses, and use a consistent rule (all five HEART parts, or only the nonzero ones). Add parts for CSRS, or say why it has none.
- **Effort:** S.

### R4.12-11 · Low · ABCD2 low band now offers both answers, but GRAY_GUIDE still says only "home"
- **Where:** `src/ui.js:83` ("0 to 3 is low risk (home with fast follow-up)") against `engine.js:1238` (low: right 'home', ok ['obs']). README: "a low-risk TIA can go home or to observation".
- **Fix:** "0 to 3 is low risk: home with fast follow-up, or observation."
- **Effort:** XS.

### R4.12-12 · Nitpick · "thrombolytic" in the Onset line is unglossed under Plain words
- **Where:** `src/ui.js:946`. The lesson calls it "the clot drug". The card does not.
- **Fix:** "the clot drug (thrombolytic)".

## 4. Coverage

- **Diff:** read all of `src/ui.js` and `src/engine.js`, plus the README and CLAUDE.md changes. Read rules14.js where it touched DKA, WORKUP and stroke.
- **On screen:** a custom Playwright script (`cards.py`, Chrome at /usr/bin/google-chrome, list view) at 390x844, 844x390 and 360x640, with Plain words on and off.
  - Cards for HEART (moderate, low, and a forced high), ABCD2, CURB-65, CSRS, and strokes in, late, wake and thin.
  - No horizontal page scroll anywhere, and no page errors.
- **Orientation:** played end to end as charge nurse (Grace's g6 score) and as attending (Aisha's DKA state at a4 to b1), using a probed copy of `train_test.py`.
- **Lessons:** played `sepsis` and `breath` as attending.
- **Node runs:**
  - Grace's age and score over 400 seeds, and by pace on the Orientation seed.
  - The `dtn60` outcome by stroke kind over 40 autopilot shifts.
  - First-sheet WORKUP wording for pe, ectopic, sah, hyperk and ptx.
- **Not covered:** the 3D floor, WebKit and Firefox, the charge-nurse view of the order review, and the other 26 case lessons.
