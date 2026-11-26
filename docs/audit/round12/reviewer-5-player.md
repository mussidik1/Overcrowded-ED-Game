# Round 12, Reviewer 5: player, game critic and classroom user (v0.32.0)

Branch `claude/sleepy-rubin-jot35n`, HEAD a219993. Diff reviewed: `git diff 0c999de..a219993 -- src test docs/clinical-sources.md README.md CLAUDE.md`.
Scratch scripts: `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round12/r5/` (dtn.js, dtn2.js, lesson.js, cross.js, dom.js, gray.js, bun.js, pw.py).

## 1. Verdict

**Do not ship v0.32.0, not even behind the gate, until R5.12-01 to R5.12-05 are fixed.** The release adds "strokes that aren't eligible" and then punishes the player for not lysing them, twice: the door-to-needle goal is missed and logged, and a non-lytic stroke at 192-212/100-114 still needs blood pressure control. The release's own Orientation and Lessons tell students to sign exactly the orders the new keys now call incomplete. The "graded by the complaint" rule is actually keyed on the hidden diagnosis. The new drug requirements can't be learned from anything in the game, and the potassium hint points the wrong way.

## 2. Score: 3 / 10

The rule tests pass and the cards look right. But a student who plays the new stroke content correctly gets an M&M entry for it. A student who follows the preceptor word for word gets "Something they need was never ordered."

## 3. Findings (worst first)

### R5.12-01 Critical: a stroke that must not get the clot buster still gets a "Door to needle" goal, and missing it is logged as a failure (attending and charge nurse)
- **Location:** `src/engine.js` 1162 (`if (p.alert) for (const g of ALERTS[p.alert].goals) p.goals[g] = null;`, run for every stroke), `ALERTS.stroke.goals: ['ct25','dtn60']` (619), `strokeSetup` 1180-1197 (it removes `tnk` from `p.tr` for late, wake-up and blood-thinner strokes but leaves `p.goals.dtn60`), `goalMissTick` 3146-3156.
- **What happens:** about 38% of strokes are now `late`, `wake` or `thin`. None of them can get tenecteplase, and ordering it counts as harm. At 60 minutes `goalMissTick` sets `dtn60 = false`, runs `care(-20)`, toasts "Missed: Door to needle under 60 min" and writes an M&M line. `goalWhy` blames "The thrombolytic waited on CT, neurology, or pharmacy", the bed, or "The pressure was over 185/110 and was never brought down". So the game tells the student the lytic should have gone in, for a patient where the lytic is contraindicated. That is clinically wrong teaching. The charge nurse game regressed the same way: any non-eligible stroke on the board costs the charge nurse a goal.
- **Reproduction:** `node /tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round12/r5/dtn2.js`. It builds a `strokew` as `thin`, `wake` or `late`, signs `bmp, cthead` with no tnk (the correct orders) and steps 80 minutes. Each prints `goals {"dtn60":false}` and the M&M line "Door to needle went past 60 min". It also happens with no setup: `OC.newGame('easy',9,{mode:'md'})` driven by `botStep` gets a wake-up `lvo` with the toast "Missed: Door to needle under 60 min · Resus 1". The same happens with `mode:'rn'` (seed 11, a late `strokew`).
- **Fix:** in `strokeSetup`, when `kind !== 'in'`, `delete p.goals.dtn60` (keep `ct25`). Also do it in `lyticWindowClosed`. Add a rules14 check that a non-eligible stroke never has `dtn60` in `p.goals` and that `G.stats.goals.list` never holds a `dtn60` entry for one. Update golden.
- **Effort:** 15 minutes plus the golden update.

### R5.12-02 Critical: a stroke that can't be lysed still must have its blood pressure lowered at 192-212 / 100-114
- **Location:** `src/engine.js` `strokeSetup` 1194-1196: `if (over) p.tr.unshift('bp');` runs whatever `kind` is.
- **What happens:** `over` (45% of strokes) adds `bp` to the answer key even when tnk has just been removed. Permissive hypertension applies to a stroke getting no reperfusion. AHA/ASA 2019 (the source `docs/clinical-sources.md` names): below 220/120, starting antihypertensives brings no benefit. The game's highest "over" pressure is 212/114. A late, wake-up or blood-thinner stroke left at 195/105 (the correct call) gets "isn't improving. Something isn't treated." Twenty minutes later it gets "Room N is getting worse. Something they need was never ordered", and the M&M line "got worse without blood pressure control / It was never ordered" (`src/engine.js` 3669-3672).
- **Reproduction:** in the same `dtn2.js`, the `late` case gets `bp0 [193,101]` and `tr []` after signing, and its M&M list includes "Earl G. got worse without blood pressure control / It was never ordered".
- **Fix:** `if (over && kind === 'in') p.tr.unshift('bp');`. If the clinician wants BP treatment for non-lytic strokes, make it a >220/120 band. Add a test.
- **Effort:** 10 minutes plus golden.

### R5.12-03 High: the release's own Orientation and Lessons now teach the orders its answer key calls incomplete
- **Location:** `src/ui.js` 1835-1836 (Orientation, attending, DKA: "Order a BMP, a blood gas, a pregnancy test, fluids, and an insulin drip" and "Potassium 4.8: safe for insulin"; `ordStep` list has no `meds`). 1949 (Sepsis lesson p5: "**Piperacillin-tazobactam** (Antibiotics by vein)" only). 1974 and 1977 (Trouble breathing b5: neb + BiPAP only; b8 summary "**Wheezing**: nebulizer. BiPAP if tiring.").
- **What happens:** DKA now needs `kcl`, septic shock needs pip-tazo **and** vancomycin, and COPD needs a steroid **and** an antibiotic. A student who follows the text exactly sees this:
  - Orientation DKA: `txGap ["meds"]`. The game says "isn't improving. Something isn't treated", then "Room 5 is getting worse. Something they need was never ordered".
  - Breathing lesson: `txGap ["meds","abx"]`. The preceptor's next card says "His oxygen rises and his breathing slows" while the engine says he isn't improving.
  - Sepsis lesson: `ordList` puts the spotlight on Vancomycin, which the text never names. If the student signs what the text lists, "Missed: Door to antibiotics under 60 min" fires on top of the gap.
  The lesson tests still pass (`train_test.py` taps whatever is lit and never checks `txGap`), so CI can't see any of this.
- **Reproduction:** `node /tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round12/r5/lesson.js`. It signs each script's exact orders on the `train` level and prints `missNow` (Medications (potassium); Antibiotics (vancomycin); Medications (methylprednisolone), Antibiotics), then the toasts from the run that follows.
- **Fix:** rewrite a3 and a4 (potassium 4.8 means **add potassium** to the fluids; insulin can start), p5 (name vancomycin and say why: MRSA), and b5 and b8 (steroid plus antibiotic for a COPD flare that needs BiPAP). Add `['r','meds']` and `['r','abx']` to the ordStep lists. Add a train_test assertion that every lesson patient ends with no `txGap`. Re-run every lesson.
- **Effort:** 1 to 2 hours.

### R5.12-04 High: the new required drugs can't be learned in the game, and the order sheet points away from them
- **Location:** `src/engine.js` 367 (`kcl: { p: 'Low potassium' }`), 250 (DKA BMP "K 4.8"), 1716 (DKA "why": "Fluids first. Insulin once the potassium is known."; no potassium); 674 and RES (COPD X-ray "Hyperinflated, no pneumonia"); 332-333 (doxy "Lung infections, tick bites, MRSA skin", azith "Atypical pneumonia": neither mentions COPD); `DRUG_CLASS` puts every steroid under "Allergy and steroids", not "Breathing".
- **What happens:** the only hint on the potassium order says it is for *low* potassium, and this patient's potassium is 4.8. A student who reads the card correctly leaves it off and is marked "Medications (potassium)" missing. For COPD, the X-ray says "no pneumonia", nothing in the game links antibiotics to a COPD flare on BiPAP, and the breathing lesson says nebs plus BiPAP. No lesson, Plain-words gloss or "why" text explains the steroid-plus-antibiotic rule, the DKA potassium rule, or the shock two-antibiotic rule (`grep -n -i "potassium\|steroid" src/ui.js` finds only the Orientation lines quoted in R5.12-03). Nobody can learn these from the game. They feel like gotchas.
- **Reproduction:** open any DKA patient as the attending (for example `trainPatient('dka','room')`, or the Orientation chapter). Open Medications, then Sugar and electrolytes: Potassium reads "Low potassium". Sign BMP, VBG, NS and an insulin drip, and wait for the results: the gap is potassium.
- **Fix:** potassium hint "Low potassium; in DKA, added to the fluids when K is under 5.2". Azith or doxy hint "…; COPD flare on BiPAP". Update the dka, copd, pna and shock `ORD_WHY` lines. Add a sentence each to the breathing and sepsis lessons. Consider a "Plain words" gloss for the RXREQ combinations.
- **Effort:** 1 hour.

### R5.12-05 High: "graded against the complaint, not the hidden diagnosis" is graded by the hidden diagnosis
- **Location:** `src/engine.js` 1866-1878 (`WORKUP`, `WORKUP_OF` keyed on `p.ck`; `workupOk(p,k)` looks up `WORKUP[WORKUP_OF[p.ck]]`). README v0.32.0 paragraph; `docs/clinical-sources.md` "First order set by complaint (all cases sharing a door picture)".
- **What happens:** the group is chosen by the hidden case, so two patients with matching door complaints are graded differently. The first sheet uses the group's own standard workup:

  | Door complaint | Case | Workup used | Extras |
  |---|---|---|---|
  | "Weak and dizzy" | dehyd | weak | 0 |
  | "Dizzy, nearly passed out" | chb | weak | **3** |
  | "Sudden one-sided pelvic pain, vomiting" | ovtorsion | belly | 0 |
  | "Sudden testicle pain, vomiting" | ttorsion | belly | **5** |
  | "Confused, breathing fast" | salod | sob | 0 |
  | "Confused and sweaty, diabetic" | hypogly | sob | **6** |
  | "Passed out, short of breath, gray" | mpe | sob | 0 |
  | "Sudden back pain, then passed out" | aaa | sob | **6** |
  | "Short of breath, chest hurts on a deep breath" | pe | sob | **2** |
  | "Belly pain, vomiting" | gastro | belly | 0 |
  | "Vomiting blood" / "Vomiting, sugar very high" | gib / dka | belly | **3** / **4 + 2 wrong** |

  A class looking at results will see one student penalised and another not, for the same reasoning. The extras list also hints at which hidden group the patient is in.
- **Reproduction:** `node /tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round12/r5/cross.js` (it prints each row above).
- **Fix:** key the groups on a visible complaint tag per case (`door: 'chest'|'sob'|...`, lint-checked so every case whose `cc` names the complaint carries it), or narrow the README and clinical-sources claim to "for these 28 diagnoses". Also add `chb`, `ttorsion`, `aaa`, `gib`, `dka`, `hypogly`, `sepsisw` and `pna` where their door picture fits.
- **Effort:** 2 hours, plus clinician sign-off on the lists.

### R5.12-06 Medium: on the first sheet, ordering the whole workup is free and always the best play
- **Location:** `signOrders` 1911 and 1937 (`first && workupOk(p,k)`).
- **What happens:** in 14 of 28 WORKUP cases every needed test is inside the group list (`dom.js`). For chest, shortness of breath and weakness the extra tests are all labs, ECG or a chest X-ray, so they cost no scanner time. Ordering the whole list therefore never loses points and never misses a needed test, so test choice on the first sheet stops being a skill. Meanwhile Orientation j3 still says "Order what he needs, **nothing extra**", and every order sheet says "Order what they need and nothing extra. Extra tests cost time" (seen in the built game, `pw.py`). Nothing in the game tells the player about the first-sheet rule.
- **Reproduction:** `node /tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round12/r5/dom.js`.
- **Fix:** a design decision for the owner. At least explain it on the sheet ("First orders: the standard workup for this complaint is fine"). Better, keep a small time or experience cost for tests that don't change management, or count the extras as "fine" only up to the group's core tests.
- **Effort:** 30 minutes for the text; more for a cost model.

### R5.12-07 Medium: risk scores "built from the patient" removed two gray-zone decisions
- **Location:** `grayScore` 1219-1240; `pnalow` age [25,64] (673); `tia` (687).
- **What happens:** the CURB-65 age part can never apply to a `pnalow` patient (ages 25 to 64), so the score is 0 or 1, every one is low risk, and the right call is always home. The old version had 28% moderate (observation). TIA: ABCD2 now ranges only 2 to 4, and low risk accepts observation, so "always observation" is right or accepted in 300 of 300 seeds. Before, it was wrong in 40%. Both gray zones are now free decisions. That makes the game easier, not fairer.
- **Reproduction:** `node /tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round12/r5/gray.js` (new) against `gray_old.js` (0c999de engine). New: `pnalow {"low->home":300}`, `tia {"low->home/obs":233,"moderate->obs/admit":67}`. Old: `pnalow {"moderate->obs/admit":83,"low->home":217}`, `tia {"high->admit/obs":58,"moderate->obs/admit":123,"low->home":119}`.
- **Fix:** widen `pnalow` ages to include 65+, or add the RR, confusion or BP parts from the dice with matching vitals. For TIA, let the clinical part vary (speech, weakness) with a matching exam text, so 6 to 7 is reachable.
- **Effort:** 1 hour plus golden.

### R5.12-08 Medium: the CURB-65 card says "BUN 24" while the BMP the student ordered says "BUN 14"
- **Location:** `grayScore` pna branch (`bun && 'BUN 24 (1)'`); `RES.pnalow.bmp: 'Na 139, K 4.1, BUN 14, creatinine 0.9'`.
- **What happens:** in about 30% of `pnalow` patients the score breakdown contradicts a lab result on the same card. R6-16's stated purpose was "a score never contradicts the patient". rules14 checks only that the parts add up, never that they match the results.
- **Reproduction:** `node /tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round12/r5/bun.js` prints `parts [ 'BUN 24 (1)' ]`. The case's BMP result is the fixed string with BUN 14.
- **Fix:** when `bun` is true, write the BMP result with BUN 24 (a per-patient `p.find` override), or drop the BUN part.
- **Effort:** 30 minutes.

### R5.12-09 Medium: septic shock "Door to antibiotics" is missed when pip-tazo goes in on time but vancomycin is missing, and the reason blames pharmacy
- **Location:** `RXREQ.shock` (450); abx60 goal hit only when the `abx` treatment completes; `goalWhy` "Antibiotics waited on pharmacy or a nurse".
- **What happens:** a broad-spectrum antibiotic within the hour is the Surviving Sepsis target. Pip-tazo at minute 10 should meet it. The game records a missed goal and blames staff.
- **Reproduction:** in `lesson.js`, the shock run (pip-tazo, no vanc) toasts "Missed: Door to antibiotics under 60 min · Room 5".
- **Fix:** hit `abx60` when the first antibiotic from any group is given; keep the gap for the missing group.
- **Effort:** 30 minutes.

### R5.12-10 Low: HEART 7 reads "high risk" on a patient whose diagnosis is "Chest pain, moderate risk"
- **Location:** `grayScore` chest branch (now reaches 7); case `cpmod` dx label (689).
- **Reproduction:** `gray.js`: `cpmod {"high->admit/obs":21,...}`. Those 7% show "HEART 7 · high risk" next to the diagnosis "Chest pain, moderate risk".
- **Fix:** cap cpmod at 6, or rename the diagnosis.
- **Effort:** 10 minutes.

### R5.12-11 Low: the stroke Onset line still announces a lytic deadline for patients who can't get one
- **Location:** `src/ui.js` 946.
- **What happens:** the blood-thinner patient's card reads "Last known well 05:45 · the thrombolytic has to be in by 10:15" right above "Takes apixaban (a blood thinner)" (seen in the built game, `pw.py`, `stroke_thin.png`). A late stroke shows a deadline that has already passed, as an instruction.
- **Fix:** add the deadline clause only when `lyticWindowOk(p)`; otherwise "outside the 4.5-hour window".
- **Effort:** 10 minutes.

### R5.12-12 Low: the belly workup's opioids count as "fine" for the hypotensive ruptured ectopic
- **Location:** `WORKUP.belly.rx` includes `morph`, `fent`; `ectopic` vit "BP 86/52". The opioid SBP-under-90 `CONTRA_IF` covers only the ACS cases.
- **What happens:** morphine on the first sheet at 86/52 is graded "fine". Cross-reference for R6.
- **Fix:** extend the SBP-under-90 opioid rule to the bleeding cases, or drop morphine from the belly list.
- **Effort:** 15 minutes.

### R5.12-13 Nitpick: rules14 can't catch the bugs above
- No check on goals for non-eligible strokes (R5.12-01), on the BP key for them (R5.12-02), on lesson patients ending gap-free (R5.12-03), or on score parts matching lab text (R5.12-08).

### R5.12-14 Nitpick: the "standard belly workup" has no pregnancy test
- `WORKUP.belly.det` lacks `hcg`, though every belly case needs one for a woman of 12 to 55 (it's allowed by the separate HCG rule). A "standard workup" list that teaches without hCG is a poor model.

## 4. Coverage

- Read: BRIEF Round 12, the whole engine and UI diff, rules14.js, README and clinical-sources diffs, the Orientation and Lesson scripts in `src/ui.js` (DKA, sepsis, breathing, stroke), the drug hints, `strokeSetup`, `grayScore`, goals and M&M code.
- Ran: `node test/rules14.js` (all ok), `node test/golden.js` (ok). Node scripts: stroke goals in md and rn (`dtn.js`, `dtn2.js`), lesson orders (`lesson.js`), cross-complaint grading (`cross.js`), workup dominance (`dom.js`), gray-zone distributions new vs 0c999de (`gray.js`, `gray_old.js`), BUN contradiction (`bun.js`), aspirin in non-lytic strokes (`asa.js`).
- Built game (Chromium via Playwright, `CHROME_PATH=/usr/bin/google-chrome`): stroke cards for thin, wake and late patients as the attending (`pw.py`; screenshots in scratch). `LESSON=sepsis` and `LESSON=breath` `MODE=md` train_test runs (both "No errors", which shows those tests can't see the gaps).
- Not done: a full by-hand class-code session across two browsers (seed sync is covered by golden "same clinical facts" and passes); WebKit; the 3D floor.
