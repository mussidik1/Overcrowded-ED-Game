# Round 12, Reviewer 6: clinical accuracy (v0.32.0 release review)

Reviewer: board-certified emergency physician and paramedic educator, hostile brief.
Diff: `git diff 0c999de..a219993 -- src test docs/clinical-sources.md README.md CLAUDE.md`, branch `claude/sleepy-rubin-jot35n`, HEAD a219993.
Method: every rule below was run against `src/engine.js` in Node. Scratch scripts: `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round12/r6/{a..g}.js`.

## 1. Verdict

**Do not ship v0.32.0, not even behind the gate.** The drug keys changed. The teaching text, the Orientation, the lessons and the alert goals did not change with them. A student who follows the MD Orientation exactly gets DKA marked incomplete. Every ineligible stroke still gets a "Missed: Door to needle" penalty, and its order review still says "Then the clot-busting drug." Half of the new non-lytic strokes require blood pressure lowering that the AHA/ASA guideline calls no benefit. The R6-02, R6-13 and R6-15 fixes are therefore incomplete, and R6-16 is only half fixed.

## 2. Score

**3 / 10.** The individual drug keys (asthma, anaphylaxis, CAP, COPD antibiotics, push-dose epinephrine, TIA) are mostly correct. Everything around them now contradicts them.

## 3. Findings (worst first)

### R6.12-01 Critical: strokes that can't get the lytic still require lowering the BP to 185/110
- **Location:** `src/engine.js` `strokeSetup`, lines 1182 and 1195-1196. `over` is drawn and `'bp'` is unshifted into `p.tr` whatever `kind` is.
- **Claim:** A late (5-10 h), wake-up or apixaban stroke with BP 192-212 / 100-114 has "Blood pressure control" in its answer key. Without it, the order review lists it as missed. AHA/ASA 2019 §3.3 (and the 2026 guideline) says the 185/110 target applies to IV thrombolysis and thrombectomy. For a patient who gets neither, lowering BP that is under 220/120 in the first 48-72 h has no benefit (Class III). The engine itself calls an unneeded BP drop harm (line 1843: "dropped their blood pressure on a drug they didn't need"). About half of the non-lytic `strokew`/`stroke` patients are affected (scratch `a.js`: 35 of about 70).
- **Reproduce:** `node scratchpad/round12/r6/c.js`. Output: `late over right.tr [ 'bp' ] [ 192, 100 ] … miss ["Blood pressure control"]`, and the same for `wake` and `thin`.
- **Fix:** In `strokeSetup`, add `'bp'` only when `kind === 'in'`, or when the case is `lvo` (BP ≤185/110 before thrombectomy is reasonable). Add a rules14 check.
- **Effort:** S.

### R6.12-02 Critical: every ineligible stroke is charged "Missed: Door to needle under 60 min"
- **Location:** `src/engine.js` line 1162 (alert goals set before `strokeSetup`), `goalMissTick` lines 3146-3155, `ALERTS.stroke.goals` line 619.
- **Claim:** `dtn60` is set for every stroke alert. A late, wake-up or anticoagulated stroke can never be needled, so at 60 minutes the player loses 20 care points, gets an M&M entry and sees the toast "Missed: Door to needle". The game penalises the correct decision to withhold tenecteplase, which the game itself scores as harm. The M&M text implies a lytic was owed.
- **Reproduce:** `node scratchpad/round12/r6/g.js` (seed 4242, bot). Output: `found lvo wake … goals {"ct25":null,"dtn60":null}`, then `{"ct25":true,"dtn60":false}`, `[ { key: 'dtn60', ok: false … } ]` and `'Missed: Door to needle under 60 min · Resus 1'`.
- **Fix:** In `strokeSetup`, `delete p.goals.dtn60` when `kind !== 'in'`. Add a test.
- **Effort:** S.

### R6.12-03 Critical: the order review tells the student to give the clot buster to strokes where it is harm
- **Location:** `src/engine.js` `ORD_WHY` lines 1720-1722. It is shown in the end-of-shift "Orders to review" (`ui.js` 3151, `ol-w`) and in the case lessons (`ui.js` 2025).
- **Claim:** `strokew`/`stroke`: "Then the clot-busting drug." `lvo`: "Clot drug, then transfer." This text is static for every stroke, including the 38% that are now late, wake-up or on apixaban. The same review line also prints "Can hurt them: Tenecteplase (they take apixaban…)". The stroke lesson's summary (`ui.js` LESSONS.stroke k9: "Order: CT, labs, thrombolytic") never teaches the new exclusions either.
- **Reproduce:** Make any `thin`, `late` or `wake` stroke (scratch `c.js`), sign orders, then read `p.ordLog.why`.
- **Fix:** Make the explanation depend on `p.strokeKind` (outside the window or unknown onset: "No lytic: outside 4.5 h / onset unknown"; on a DOAC: "No lytic: on apixaban"; LVO: "thrombectomy transfer anyway"). Add one line to the stroke lesson's summary.
- **Effort:** S.

### R6.12-04 Critical: the MD Orientation teaches DKA without potassium, then the game marks it incomplete
- **Location:** `src/ui.js` Orientation step `a3` (around line 1835; ordStep has `lab`, `fluids`, `insulin`, no `meds`) and step `a4` text. `src/engine.js` `ORD_WHY.dka` line 1716.
- **Claim:** v0.32.0 makes potassium required at K 4.8 (R6-15, clinician's answer). The Orientation every attending plays still orders BMP, VBG, hCG, NS and the insulin drip, says "Potassium 4.8: safe for insulin", and never orders KCl. Following it exactly gives "Missed: Medications (potassium)" and `txGap ['meds']` (not improving). The explanation text still says "Insulin once the potassium is known", which contradicts the clinician's answer that insulin on the same sheet as the BMP is fine, and it never mentions replacing potassium. The tutorial teaches the exact omission the new rule flags.
- **Reproduce:** `node scratchpad/round12/r6/f.js`. First lines: `miss [ 'Medications (potassium)' ]`, `txGap [ 'meds' ]`, then the old `why` text.
- **Fix:** Add `['r','meds']` (Potassium) to `a3` and its text ("K 3.5 to 5.0: add potassium to the fluids"). Rewrite `ORD_WHY.dka`. Add a train_test check that a scripted Orientation patient finishes with nothing missed.
- **Effort:** S.

### R6.12-05 Critical: the COPD lesson and explanation still teach that steroids are optional and leave out the antibiotic
- **Location:** `src/ui.js` LESSONS.breathing `b5` (orders: X-ray, VBG, DuoNeb, BiPAP only) and `b8`. `src/engine.js` `ORD_WHY.copd` line 1696: "A steroid is reasonable."
- **Claim:** R6-13 was exactly "steroids only 'reasonable', antibiotics scored as extras." The answer key is fixed (`tr: nebs, meds, abx, bipap`), but the lesson walks the student through BiPAP without a steroid or an antibiotic. The end-of-shift review then prints "Missed: steroid, antibiotic" right next to "A steroid is reasonable." GOLD: a systemic steroid, plus antibiotics when ventilatory support is needed.
- **Reproduce:** `node scratchpad/round12/r6/f.js`, line `copd lesson msg: … miss [ 'Medications (methylprednisolone)', 'Antibiotics' ] … A steroid is reasonable.` and `txGap [ 'meds', 'abx' ]`.
- **Fix:** Add the steroid and the antibiotic to `b5` and `b8`. Rewrite `ORD_WHY.copd`.
- **Effort:** S.

### R6.12-06 High: septic shock scores cefepime + vancomycin as a wrong drug and an extra
- **Location:** `src/engine.js` `RXREQ.shock` line 451 (`[['piptazo','ctx'],['vanc']]`), `RXOK.shock` line 416.
- **Claim:** Cefepime is a standard anti-pseudomonal beta-lactam for septic shock of unknown source (SSC 2021). The game uses it as equal to piperacillin-tazobactam elsewhere (necrotizing fasciitis line 4880, meningitis 4802, epidural abscess 4886). In `shock`, cefepime + vanc gives `wrong 1, extra 1` and leaves "Antibiotics (piperacillin-tazobactam)" missing. An attending would reject this.
- **Reproduce:** `node scratchpad/round12/r6/b.js`, line `shock cefepime+vanc {"miss":["Antibiotics (piperacillin-tazobactam)"],"extra":1,"wrong":1}`.
- **Fix:** `shock: { abx: [['piptazo','cefepime','ctx'],['vanc']] }`. Consider the same for `sepsisw`.
- **Effort:** S.

### R6.12-07 High: the HEART score's risk-factor part still contradicts the patient's exam (R6-16 half fixed)
- **Location:** `src/engine.js` `grayScore`, chest branch (`r = mod ? randi(1, 2) : …`). Exam line 1652.
- **Claim:** The `cpmod` exam says "Has diabetes and high blood pressure": two risk factors. In HEART, 1-2 risk factors score 1. Two points needs 3 or more, or known atherosclerotic disease. The code gives `risk factors (2)` half the time. Every `cpmod` scored 7 ("high", right answer admit) comes only from that contradiction. The diagnosis still reads "Chest pain, moderate risk". This is exactly the R6-16 complaint: a score that contradicts the patient's own findings. rules14 checks only the age part, so it passes.
- **Reproduce:** `node scratchpad/round12/r6/d.js`, 200 `cpmod` cases: `cpmod:7:high:admit` 15 times. Each one has `risk factors (2)`, while `examOf` lists two risk factors.
- **Fix:** For `cpmod`, fix `r = 1` (matching the exam), or add a third risk factor or known CAD to the exam when `r = 2`. Assert in rules14 that the risk-factor points match the exam.
- **Effort:** S.

### R6.12-08 Medium: the CURB-65 gray zone is now always "low, go home"
- **Location:** `grayScore` pna branch. `pnalow` age is `[25, 64]` (line 673).
- **Claim:** The age part can never score, so the score is 0 or 1, always low, always home. Before, 30% scored 2 (observation). The disposition decision is now trivial, and the age line on the card can never appear.
- **Reproduce:** `d.js`: only `pnalow:0:low:home` and `pnalow:1:low:home` out of 200.
- **Fix:** Widen the `pnalow` age range to include 65 and over, or add a second dice part (BUN plus age).
- **Effort:** S.

### R6.12-09 Medium: the TIA explanation says "Observe" while the game grades home as right
- **Location:** `ORD_WHY.tia` line 1708: "Observe: stroke risk is highest in the first two days."
- **Claim:** For ABCD2 0-3, the key is `right: 'home'` (observation also accepted). The order review contradicts the clinician-confirmed answer.
- **Fix:** "Low ABCD2 with normal tests: home with rapid follow-up, or observation for imaging."
- **Effort:** S.

### R6.12-10 Medium: the sepsis lesson text names only piperacillin-tazobactam; vancomycin is now required
- **Location:** `src/ui.js` LESSONS.sepsis `p5`.
- **Claim:** `ordList` now rings vancomycin (`drugsFor` returns both drugs), but the text lists only "Piperacillin-tazobactam". A student who reads the text instead of following the ring leaves "Antibiotics (vancomycin)" missing (`f.js`, last line). The lesson never explains why two antibiotics are needed.
- **Fix:** Add "**Vancomycin**" and a one-line reason (MRSA plus gram-negative cover).
- **Effort:** S.

### R6.12-11 Medium: the stroke lesson doesn't teach the three new exclusions
- **Location:** `src/ui.js` LESSONS.stroke `k0` to `k9`.
- **Claim:** The new content (late arrival, wake-up, DOAC) appears on shifts only. No lesson or Orientation step explains it, which breaks the design rule "teach in Orientation and the Lessons." A lay student meets the first harm toast with no prior teaching.
- **Fix:** Add one step: "Not everyone gets the lytic: more than 4.5 h, unknown onset, on a blood thinner. LVO still goes for thrombectomy."
- **Effort:** S.

### R6.12-12 Medium: clinical-sources.md cites the superseded stroke guideline, and the engine knows it
- **Location:** `docs/clinical-sources.md` stroke row ("AHA/ASA … 2019"). `src/engine.js` `strokeSetup` comment ("the 2026 update's imaging-selected late window isn't modeled").
- **Claim:** The source table names the 2019 update as the source while the code comment cites the 2026 AHA/ASA guideline. One of them is wrong. A reviewer can't tell which guideline the rules were checked against.
- **Fix:** Cite the 2026 guideline, and say that the wake-up and late imaging-selected pathways are not modeled.
- **Effort:** S.

### R6.12-13 Medium: rules14 passes while the defects above ship
- **Location:** `test/rules14.js`.
- **Claim:** The tests have these gaps:
  - R6-02 never checks BP for non-lytic strokes or the `dtn60` goal.
  - R6-16 checks only the age part, not the risk-factor part against the exam, and not CURB-65 variety.
  - R6-12 only checks that TXA is not an extra; there is no timing check.
  - R6-18 prints the harm list but never asserts that aspirin in dissection is harm.
  - No test plays the Orientation or the lessons against the new keys (R6.12-04, 05, 10).
- **Fix:** Add those assertions, plus one "every scripted Orientation and lesson patient ends with `missNow` empty" check.
- **Effort:** M.

### R6.12-14 Low: TXA has no 3-hour limit, though the comment and README say "within 3 hours"
- **Location:** `ALSO.mvc` / `ALSO.moto` (line 460, comment "within 3 hours (CRASH-2)").
- **Claim:** TXA ordered at any time is "fine". CRASH-2 (2011 timing analysis) showed harm after 3 h. In play most orders come early, so the effect is small, but the code doesn't implement what the comment claims.
- **Fix:** Add `CONTRA_IF` `txa: p => G.t - p.tArrive > 180` (plus pre-hospital time), with a `CONTRA_WHY`.
- **Effort:** S.

### R6.12-15 Low: an anaphylaxis crash still adds only oxygen and fluids, with no repeat epinephrine
- **Location:** `CRASH.anaph` line 3528 (`add: ['o2','fluids']`).
- **Claim:** R6-11 asked for repeat epinephrine. The verifier found the crash unreachable in normal play (crashes are ESI 2 only, line 3654), so this is dead data. It is still reachable through `crashNow` and still teaches the wrong thing if the crash rule ever widens.
- **Fix:** `add: ['o2','fluids','epi']`.
- **Effort:** S.

### R6.12-16 Low: the stroke "Onset" line gives a lytic deadline to patients who can't have the lytic
- **Location:** `src/ui.js` ptSheet line 938.
- **Claim:** A late stroke shows "the thrombolytic has to be in by" a time already past. An apixaban stroke inside the window shows a deadline for a drug that is harm for them.
- **Fix:** Hide the deadline when `p.anticoag`, or when `G.t > p.lkwT + LYTIC_WINDOW`.
- **Effort:** S.

### R6.12-17 Low: the Canadian Syncope Risk Score author is misspelled
- **Location:** `docs/clinical-sources.md`: "Thiruganesan et al., 2016".
- **Claim:** The author is Thiruganasambandamoorthy V, CMAJ 2016.
- **Fix:** Correct the name and add the journal.
- **Effort:** S.

### R6.12-18 Low: the arrest row cites the superseded AHA 2020 guidelines
- **Location:** `docs/clinical-sources.md` arrest row ("2020, with the 2023 focused updates").
- **Claim:** The AHA 2025 Guidelines for CPR and ECC were published in October 2025.
- **Fix:** Re-check the code cards against 2025 and cite it.
- **Effort:** M.

### R6.12-19 Low: the first-sheet belly workup accepts opioids in a hypotensive ruptured ectopic
- **Location:** `WORKUP.belly.rx` (morph, fent). Ectopic vitals: BP 86/52.
- **Claim:** The game counts opioids under SBP 90 as harm for chest cases (R6.2-02), but here they are accepted without comment. This is inconsistent teaching on the same physiology.
- **Fix:** Add a CONTRA_IF for opioids under SBP 90 to the hemorrhagic belly cases, or apply that rule generally.
- **Effort:** S.

### R6.12-20 Low: a physician-level order set is marked "Confirmed: yes" by a non-physician
- **Location:** `docs/clinical-sources.md` WORKUP row (Level "Physician", Confirmed "yes"). The engine comment says it was checked by the owner, an EMS educator.
- **Claim:** The only "confirmed" row was not checked at the level it claims. The licensed clinician's review isn't recorded against this row.
- **Fix:** Name the reviewer's role in the column, or leave it blank until the clinician signs.
- **Effort:** S.

### R6.12-21 Low: the cpmod explanation and diagnosis disagree with a HEART of 7
- **Location:** `ORD_WHY.cpmod` ("…a second troponin in observation") and the dx "Chest pain, moderate risk".
- **Claim:** When the score is 7, the right answer is admit, but the text says observation and moderate. This disappears if R6.12-07 is fixed.
- **Effort:** S.

### R6.12-22 Nitpick: the ABCD2 "high" branch can't be reached
- The maximum score is 4 (age + BP + 0 + 1 + diabetes), so the `s >= 6` branch is dead code.

### R6.12-23 Nitpick: `copd` still has `ok: ['meds']`, which is redundant now that meds are required.

### R6.12-24 Nitpick: ESI v5 is credited to "AHRQ / ENA"
- Version 5 is published by ENA; AHRQ published version 4.

### R6.12-25 Nitpick: older editions cited
- GINA 2024 and GOLD 2024 are cited where the 2025 editions exist.
- CRASH-2's 3-hour finding is the 2011 Lancet paper, not 2010.

### R6.12-26 Nitpick: the HEART parts for `cwp` leave out the zero-point history and ECG items
- The "parts" list therefore doesn't show all five HEART elements.

### R6.12-27 Nitpick: stale `RX.anaph` text
- `RX.anaph` ('an antihistamine and a steroid') is dead now that anaphylaxis has no `meds` treatment.
- `ORD_WHY.anaph` still reads as if the antihistamine and steroid are required steps.

## Checked and correct (no finding)

- **Asthma:** a systemic steroid is required, and magnesium is an add-on.
- **Anaphylaxis:** IM epinephrine alone fills the order, and the add-ons are neutral.
- **CAP inpatient:** ceftriaxone plus azithromycin or doxycycline. The game has no respiratory fluoroquinolone, so nothing valid is marked wrong.
- **COPD antibiotics:** azithromycin, doxycycline, amoxicillin-clavulanate and ceftriaxone are accepted.
- **Septic shock pressors:** push-dose epinephrine is neutral, and norepinephrine is required.
- **DKA:** potassium is required at K 4.8, with insulin allowed on the same sheet (matches the clinician's answer).
- **TIA:** low ABCD2 gives home or observation. The ABCD2 parts match the exam (numbness only = 0, 20 minutes = 1) and the vitals (BP about 175/95).
- **Tenecteplase:** harm when late, wake-up or on apixaban, with reasons that don't name the diagnosis.
- **LVO:** late, wake-up and DOAC cases still transfer.
- **Aspirin:** no aspirin in the weakness workup. Aspirin in dissection is flagged as harm on the first sheet (`e.js`).
- **Citations:** the ACS 2025, HEART (Six 2008, Backus 2013), ABCD2 (Johnston 2007), aSAH 2023, IDSA meningitis 2004, SSC 2021, ATS/IDSA 2019, CURB-65 (Lim 2003), WAO 2020, AAAAI/ACAAI 2023, ADA 2024, AF 2023, ESC PE 2019 and aortic disease 2022 entries are correct.

## 4. Coverage

- **Read:** the BRIEF (Round 12), the PRO_AUDIT R6 rows, verification.md "Clinician's answers", the whole diff, test/rules14.js, and the changed rules3/4/9 tests.
- **Engine:** `strokeSetup`, `grayScore`, `signOrders`, `WORKUP`, ORD_WHY, RX, CRASH, the goal logic, and LESSONS (Orientation DKA, stroke, sepsis, breathing).
- **Run in Node:** every Phase 3 rule, every WORKUP group, 300 strokes by kind, 800 gray-zone scores, and the scripted Orientation DKA, COPD lesson and sepsis lesson order sets. Also one bot shift until a natural ineligible stroke arrived.
- **Not done:** the UI in a browser (Playwright), class sync, and the README beyond its clinical claims.
