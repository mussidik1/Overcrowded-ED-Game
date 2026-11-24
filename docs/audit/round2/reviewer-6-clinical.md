# Reviewer 6, round 2: clinical accuracy and medical education

Reviewer role: board-certified emergency physician and paramedic educator. Branch `claude/sleepy-rubin-jot35n`, v0.30.0 (HEAD 49aea94), reviewed 2026-11-24.

Every "verified" item below was reproduced against `src/engine.js` in Node or against the built `index.html` in Chrome (Playwright, `CHROME_PATH=/usr/bin/google-chrome`). Scratch scripts and screenshots are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round2/r6/`:

- `p1.js` to `p10.js`: order probes.
- `sim2.js`: 30 simulated hard shifts.
- `ui2.py`, `ui3.py`: browser runs.
- `u1_infant_code.png`, `u2_aaa_code_1.png`, `u3_cwp_ketor.png`: screenshots.

## 0. Round-1 status

| ID | R1 severity (after Verifier) | Status | Evidence (v0.30.0) |
|---|---|---|---|
| R6-01 Lytic window not enforced | Critical | **Fixed** | Stroke `lkw:300` plus tenecteplase gives harm +1. At `lkw:250` the tenecteplase comes off the orders and the answer key when 270 min pass, and `stats.lyticLate` counts it (`p6.js`; rules11 lines 22–37). Residual problems are in R6.2-08 and R6.2-12. |
| R6-02 Every stroke eligible, no exclusions | Medium | **Still open** | `p.lkw = 35 + vhash*110` is unchanged (engine.js:1141). No anticoagulated, wake-up or out-of-window stroke exists. |
| R6-03 Epinephrine in arrest scored as harm (Rejected: unreachable) | — | **Fixed (data)** | `harmCheck` now skips `p.arrest` (engine.js:1895), and `ALSO.arrest` lists epinephrine and amiodarone (445). |
| R6-04 No resuscitation decisions | High | **Partly fixed** | Code cards exist (CODE_Q 2014). Still missing: defibrillation as an action, energy, CPR quality and post-ROSC care. The odds model and its content have new defects: R6.2-01, 03, 05, 09, 10. |
| R6-05 Metoclopramide in SBO | Critical | **Fixed** | `sbo [ns, reglan]` gives harm +1, and gastroenteritis still accepts it (`p1.js`). |
| R6-06 Unstable AF fixed with fluids | Critical | **Partly fixed** | After a crash, `right.tr = ['cardiovert']`, and diltiazem or metoprolol is harm (`p2.js`). But the teaching summary for the unstable patient still says "Diltiazem slows the rate", and the signing message names diltiazem for other drugs (R6.2-04). |
| R6-07 Bicillin under "by vein" | Critical | **Fixed** | Class `abxm` "Antibiotics by shot in the muscle (IM)". The name says "(IM only)", and the text says "Never by vein: it can stop the heart" (engine.js:335). |
| R6-08 ACS scored backwards | Critical | **Partly fixed; one sub-case worse** | Fixed: aspirin is right in cwp; nitroglycerin is neutral in cpmod, NSTEMI and STEMI, and harm under SBP 90; NSAIDs are harm in cwp before the troponin. **Worse:** metoprolol was "wrong drug" in NSTEMI and is now "fine" even in cardiogenic shock (R6.2-02). Still wrong: R6.2-06. |
| R6-09 Asthma: magnesium alone | High | **Still open** | `asthma [albut, mag]`: right +2, nothing missing. |
| R6-10 Opioid re-sedation crash (Rejected: unreachable) | — | Unchanged | `CRASH.od` still adds only O2 (3276). It is still unreachable. |
| R6-11 Anaphylaxis key | High | **Still open** | `[epiim]` still lists "antihistamine and a steroid" as missing. Fluids and nebulizer still score as extras. |
| R6-12 TXA scored as extra | High | **Still open** | `mvc [mtp, txa]` scores an extra "Meds". `moto` scores the extra "Tranexamic acid". |
| R6-13 COPD steroids and antibiotics | High | **Still open** | Azithromycin and ceftriaxone are extras. No steroid gives no gap. |
| R6-14 Monotherapy in sepsis, CAP, IAI | High | **Still open** | Vancomycin alone, push-dose epinephrine alone, azithromycin alone and metronidazole alone all still score right or fine. |
| R6-15 DKA potassium and insulin | High | **Still open** | `dka [ns, insdrip]` is clean. Orientation a3 (ui.js:1766) still orders BMP and insulin together. |
| R6-16 Random risk scores | High | **Still open** | `grayScore` is unchanged. 66 of 200 pnalow patients show CURB-65 = 2 (`p8.js`). |
| R6-17 TIA ABCD2 0–3 = home | High | **Still open** | 80 of 200 TIAs have `right: home`, with no accepted alternative. My answer is in §4. |
| R6-18 First sheet graded against the hidden diagnosis | High | **Still open** | The mechanism is unchanged. Making aspirin right in cwp treats one symptom. |
| R6-19 No doses, routes or weights | Medium | **Still open** | The only new doses are on code cards, and they are adult-only (R6.2-03). |
| R6-20 No sources, objectives or reviewer | High | **Still open, and misrepresented** | Guidelines are named only in code comments. No reviewer is on record. The README now says an "emergency physician" reviewed the game (R6.2-07). |

**Mediums and Lows I rechecked**, all **still open** unless noted:

- R6-22: lidocaine "wrong drug" in hip fracture; extra in laceration repair.
- R6-23: no Td/Tdap.
- R6-24: fixed 0.5 mg IM epinephrine.
- R6-25: TMP-SMX "wrong drug".
- R6-26: diphenhydramine alone fills migraine; dexamethasone "wrong drug".
- R6-27: fluids required in renal colic.
- R6-28: PPI and octreotide are extras.
- R6-29: chest tube mandatory.
- R6-31: thiamine "before sugar" (engine.js:376).
- R6-36: no P2Y12 inhibitor.
- R6-38: **partly fixed.** The ORD_WHY line was rewritten.
- R6-40: TIA gloss.
- R6-41: charcoal at 6 h is "fine".
- R6-42: naloxone "0.4 to 2 mg IV or IN" (707).
- R6-43: ceftriaxone "once a day … meningitis" (336).
- R6-46: heart-attack lesson names aspirin only (ui.js:1854).
- R6-48: fluids are an extra in TCA overdose.
- R6-56: duplicate LOOK keys.
- R6-57: heart-block gloss.
- R6-58: thrombolytic gloss.

**Round-1 counts (R6-01 to R6-20):**

- Fixed: 4 (R6-01, 03, 05, 07).
- Partly fixed: 3 (R6-04, 06, 08; one R6-08 sub-case is worse).
- Still open: 12.
- Rejected and unchanged: 1 (R6-10).

## 1. Verdict

**No.** Not for CE credit, and not for unsupervised students.

Phase 1 fixed four of the five Criticals it targeted, and the stroke window, SBO, Bicillin and cardioversion fixes are real. But the same release added three new Critical errors:

- A ruptured AAA or ectopic that arrests is run as a "traumatic arrest", and bilateral chest decompression is the graded right answer.
- Metoprolol is a "fine" add-on in a patient the game itself labels "NSTEMI with cardiogenic shock".
- An 8-month-old in arrest gets "epinephrine 1 mg IV" as the correct answer.

Every round-1 High is still open. No clinician has reviewed any answer key, yet the README now says an emergency physician audited the game.

## 2. Score

**3 / 10.** The adult VF/PEA card content is mostly correct. But the new arrest system misapplies its own rules to the wrong patients, and the feedback layer tells students to give the drug it just called harmful. That is not competent-hobbyist clinical QA.

## 3. New findings, worst first

"[Phase 1]" means the defect is in code added or changed by the audit's Phase 1 (`git diff 6edcc3d..HEAD`). "[pre-existing]" means it was there before and not caught in round 1.

### Critical

**R6.2-01 · Critical · [Phase 1] Ruptured AAA and ruptured ectopic arrests are run as traumatic arrests, and bilateral chest decompression is the graded right answer**

- **Location:**
  - `hemorrhageTick`, engine.js:3374: `toArrest(p, 'Traumatic arrest after hemorrhage'); p.traumatic = true;` runs for **every** `bleed: 'mtp'` patient, including `aaa` and `ectopic` (both have `bleed: 'mtp'`, engine.js:4502, 4538).
  - `codeRhythm`, engine.js:2041, tests `p.traumatic` **before** `BLEED_CASES` (2042), so the "medical bleed → hemorrhagic PEA" branch never runs for them.
  - `toArrest` (3318) also overwrites `p.alert = 'arrest'`, so the `p.alert === 'trauma'` test in `codeRhythm` is dead code.
- **What's wrong (verified):**
  - In Node (`p4.js`), a 70-year-old with a ruptured AAA in Resus 1 whose MTP isn't activated within 30 min arrests. He gets `traumatic: true`, the rhythm `trauma`, and the cards "Stop the bleeding, give blood fast, decompress the chest", then "Two units in, still no pulse. Next? → **Decompress both sides of the chest**". The ectopic case is identical.
  - In Chrome: screenshot `u2_aaa_code_1.png`. The toast also says "lost pulses: traumatic arrest".
  - In 30 simulated hard attending shifts (`sim2.js`): 2 AAA and 3 ectopic patients arrested this way.
  - The hostile-review fix "medical bleeds vs trauma" is claimed in the brief. It doesn't work in play, because `test/rules11.js:113` tests a hand-built object `{ id, ck, bleed }` without `traumatic`, the flag the real path sets.
- **Standard violated:**
  - AHA ACLS: medical hemorrhagic PEA is managed as PEA with volume replacement and definitive hemorrhage control (OR or IR).
  - ERC 2021 traumatic cardiac arrest: decompression is for suspected chest injury and blunt multisystem trauma.
  - Thoracostomy in a woman with a ruptured ectopic, or a man with a ruptured AAA, is an invasive procedure with no indication. It teaches the wrong cause.
- **Fix:**
  - In `hemorrhageTick`, set `p.traumatic` only when `TRAUMA_CASES.includes(p.ck)`. Use "arrest after hemorrhage" text for the others.
  - In `codeRhythm`, test `BLEED_CASES` before `p.traumatic`. Capture the alert before `toArrest` overwrites it.
  - Add a medical-hemorrhage cause card: "Massive transfusion and the OR/IR now. Permissive hypotension does not apply in arrest."
  - Replace rules11:113 with a test that drives `hemorrhageTick` on real `aaa`/`ectopic` patients.
- **Effort:** S

**R6.2-02 · Critical · [Phase 1] Metoprolol (and morphine) scored "fine" in NSTEMI with cardiogenic shock**

- **Location:**
  - `ALSO.nstemi/stemi/cpmod = ['ntg', 'morph', 'metop']`, engine.js:446–448, with no condition.
  - `CONTRA_IF` (435) adds only nitroglycerin under SBP 90.
  - `CRASH.nstemi` (3267) makes the patient "NSTEMI with cardiogenic shock", HR 118, BP 82/54. It is reachable: NSTEMI is ESI 2 and crashes in the waiting room.
- **What's wrong (verified, `p2.js`):** After the crash, vitals are "HR 118, BP 84/49 … cool and clammy". Ordering `metop` gives harm 0, extra 0, wrong 0, `fine: ["Metoprolol"]`. Morphine is the same. Before Phase 1, metoprolol here was at least a "wrong drug"; now it is endorsed. The code comment at 447 names the very harm ("IV beta-blockade harms patients at risk of shock") and leaves it neutral anyway.
- **Standard violated:**
  - 2025 ACC/AHA/ACEP/NAEMSP/SCAI ACS guideline (Rao et al., Circulation 2025;151:e771–e862): early oral beta-blocker only without contraindications. Low output state and risk of cardiogenic shock are listed contraindications.
  - 2014 ACC/AHA NSTE-ACS guideline: IV beta-blockers are Class III: Harm with risk factors for shock (COMMIT).
  - I confirmed the 2025 text through search summaries, not the full guideline (ahajournals.org is blocked here).
- **Fix:**
  - `addContraIf(k, { metop: p => !!p.crash || sbpUnder(p, 100) || hrOver(p, 110) })` for cpmod, NSTEMI and STEMI. Add `metop` to `CONTRA` for those keys.
  - `morph: p => sbpUnder(p, 90)`.
  - Add a rules11 check on the crashed patient.
- **Effort:** S

**R6.2-03 · Critical · [Phase 1] Children and infants get adult ACLS doses as the "right" answer**

- **Location:** CODE_Q (engine.js:2014–2032) and CODE_WHY (1983–2013). There is one adult card set: "epinephrine 1 mg IV now", "Shock, then amiodarone 300 mg IV", "Atropine 1 mg IV". `codeStart` and `codeSteps` never look at `p.age`.
- **What's wrong (verified):**
  - In Chrome (`ui2.py`), an RSV patient "Liam R., 8 mo M" in arrest gets the card "Code blue: PEA … **Keep CPR going; epinephrine 1 mg IV now**" as the right answer (screenshot `u1_infant_code.png`). For an 8 kg infant that is about a 12-fold overdose.
  - VF in a child gets "amiodarone 300 mg".
  - The card shows no age, so nothing cues the student.
  - Reachable: RSV (0–1 y), asthma (from 5 y) and testicular torsion (from 12 y) are ESI 2, can crash in the waiting room, and arrest 15 min later if not roomed. It is rare: 0 pediatric arrests in 30 simulated hard shifts. But a single exposure teaches a weight-independent adult dose.
  - Pediatric rhythm is also the adult distribution (40% VF, `p9.js`). Pediatric arrest is overwhelmingly hypoxic and nonshockable.
- **Standard violated:** AHA 2025 PALS cardiac arrest algorithm:
  - Epinephrine 0.01 mg/kg IV/IO (0.1 mg/mL), max 1 mg.
  - Amiodarone 5 mg/kg (max 300 mg) or lidocaine 1 mg/kg.
  - Defibrillation 2 J/kg, then 4 J/kg.
- **Fix:**
  - Add `CODE_Q_PEDS` for age under 13 (or by weight once patients have one), with weight-based answers and a distractor of "1 mg".
  - Give children a hypoxic-cause card and rhythm weights of about 90% PEA or asystole.
  - Show age and weight on the card header.
- **Effort:** S–M

### High

**R6.2-04 · High · [Phase 1] The feedback tells the student to give the drug the game just scored as harm**

- **Location:**
  - `rxName` (engine.js:1758) picks the first ordered drug in `RXOK[ck].meds`, contraindicated or not, and otherwise falls back to `RX[ck]`.
  - `trName` (1779) and the signing message (1880) use it.
  - `RX.afib = 'diltiazem'` (1757) and `ORD_WHY.afib` (1640) have no unstable variant.
- **What's wrong (verified):**
  - **Chest pain plus ketorolac on the first sheet:** harm toast, then the card says "Not improving. Something they need isn't ordered. **Still needed: Medications (ketorolac).**" (Chrome, `u3_cwp_ketor.png`). The end-of-shift log stores the same `miss`.
  - Following the hint leads nowhere. Re-ordering ketorolac returns "Pick at least one order". Ordering ibuprofen then reports "1 order signed for Room 7 (**ketorolac**)" (`p10.js`).
  - **Crashed A-fib** (BP 84/50): the order summary's "why" reads "ECG names the rhythm … **Diltiazem slows the rate**". Ordering amiodarone, adenosine or heparin reports "1 order signed for Room 5 (**diltiazem**)", naming the drug that is now contraindicated (`p2.js`).
- **Standard violated:** Instructional design. Corrective feedback must not prescribe the error, and a CE reviewer would fail this on sight. Clinically, ACC/AHA (NSAIDs in possible ACS) and AHA ACLS tachycardia (no calcium-channel blocker in hypotensive AF).
- **Fix:**
  - `rxName` must skip `contraOf(p)` and name the drug actually signed in this order.
  - Make `RX` and `ORD_WHY` crash-aware (`ORD_WHY_CRASH.afib = 'Unstable: synchronized cardioversion now. No diltiazem or metoprolol with a pressure this low.'`).
  - Re-ordering a drug that has become allowed should be accepted.
- **Effort:** S

**R6.2-05 · High · [Phase 1] The reversible-cause card ignores the patient's own diagnosis, and the rhythm ignores the cause**

- **Location:** `codeCause` (engine.js:2051–2056) maps only BLEED, K and AIR case lists. Every other case gets `['k', 'air', 'vol'][vhash*3]`. `codeRhythm` (2040–2046) is 40% VF, 38% PEA and 22% asystole for every non-trauma, non-bleed case. `AIR_CASES` includes `ptx` and `asthma` (2050).
- **What's wrong (verified, `p9.js`):**
  - **PE** (ESI 2, can crash and arrest): 56 of 300 IDs get "They lost a lot of blood. Hemoglobin on the gas: 5." Its wrong answer is "**Tenecteplase** → A clot buster in a bleeding patient makes it worse". No PE arrest is ever offered thrombolysis.
  - **Pneumothorax:** the case's own pitfall says "Low pressure … is tension: decompress now" (4597). Its arrest card is "The bag-mask isn't moving the chest well → Reposition, two-person bag-mask, advanced airway". No decompression answer is offered.
  - **Hypoglycemia, NSTEMI, sepsis, SAH and others** get random potassium 7.9, Hgb 5 or airway stories.
  - Hypoxic arrests (asthma, COPD, CHF, overdose, RSV, pneumothorax) are VF 41% of the time.
- **Standard violated:** AHA 2020/2025 adult ALS and special circumstances:
  - Thrombolysis is reasonable for suspected PE in cardiac arrest (2a).
  - Tension pneumothorax is a T to treat by decompression.
  - Asthma arrest: consider tension pneumothorax and air trapping.
  - Hypoxic arrests are predominantly nonshockable.
- **Fix:**
  - Add a per-case cause table:
    - pe/mpe: "clot → tenecteplase during CPR".
    - ptx, asthma, mvc: "tension → decompress".
    - hypogly: "glucose → dextrose".
    - nstemi/stemi/cpmod: "coronary clot → cath after ROSC".
    - sepsisw: "volume, acid".
    - od: "ventilation, naloxone".
  - Weight the rhythm by cause.
  - Never show "Hgb 5" to a patient with no bleeding history.
- **Effort:** M

**R6.2-06 · High · [Phase 1, partial fix of R6-08] The remaining ACS scoring is still inconsistent**

- **Location:** RXOK.cwp (engine.js:412), CONTRA (422), ALSO (446–448), SAME_CLASS_OK.
- **What's wrong (verified, `p1.js`, `p7.js`):**
  - NSAIDs are **harm** in low-risk chest pain before the troponin, but only "**wrong drug**" in confirmed STEMI and NSTEMI, and in moderate-risk chest pain whose second troponin is pending (`stemi [asa, heparin, ketor]` → "Ketorolac (wrong drug)"; `cpmod [asa, ketor]` the same). The README says "ibuprofen and ketorolac are harm until a troponin is back".
  - Fentanyl and hydromorphone are "**wrong drug**" in STEMI, NSTEMI, cpmod and cwp, while morphine is neutral.
  - Nitroglycerin is "**wrong drug**" in cwp, the undifferentiated chest pain that the game itself treats as possible ACS ("Aspirin until the troponin is back").
  - Acetaminophen alone fills the cwp medication slot (`cwp [apap]`: right +2, clean). A student who skips aspirin scores the same as one who gives it, despite "aspirin is the right first drug" in the README.
- **Standard violated:**
  - 2014 ACC/AHA NSTE-ACS: NSAIDs other than aspirin, Class III: Harm.
  - 2025 ACC/AHA/ACEP/NAEMSP/SCAI ACS guideline: nitrates and opioids for symptom relief; aspirin in suspected ACS. I read the 2025 classes only through secondary summaries.
- **Fix:**
  - `CONTRA.stemi/nstemi/cpmod += ['ibu', 'ketor']`, unconditional.
  - Add `fent` and `hydro` to the same ALSO lists as `morph`.
  - `ALSO.cwp += ['ntg']`, with the SBP-under-90 CONTRA_IF.
  - Before the troponin is back, make cwp meds require aspirin (`RXREQ.cwp = { meds: [['asa']] }` until `tropBack`), and move `apap` to ALSO.
- **Effort:** S

**R6.2-07 · High · [Phase 1 release text] The README claims a physician review that never happened**

- **Location:** README.md:57: "Six independent reviewers (architecture, tooling, security, interface, a player and **an emergency physician**) audited the game". Also "Cardiac arrest follows ACLS".
- **What's wrong:**
  - The six reviewers, me included, are AI role-play subagents. The brief says the whole project was written by AI.
  - No licensed clinician has reviewed any answer key. engine.js:447 and rules11:70 both say "pending clinician review".
  - PRO_AUDIT.md:141 made "Clinician sign-off on the changed answer keys before merge" a Phase 1 condition. It isn't met, and nothing in the repo records a sign-off.
  - "Follows ACLS" is false for children (R6.2-03) and for medical hemorrhage (R6.2-01).
- **Standard violated:** CAPCE and other CE accreditors require identified, qualified medical-director or content-expert review. Representing an AI persona as "an emergency physician" is a material misstatement to instructors and accreditors.
- **Fix:**
  - Reword it: "six AI review passes (Claude), role-playing … No licensed clinician has reviewed the clinical content yet."
  - Drop "follows ACLS" until the pediatric and medical-bleed paths are right.
  - Record a real reviewer's name, credentials and date in `docs/CLINICAL_CONTENT.md` before any merge to `main`.
- **Effort:** S (wording); L (actual review)

### Medium

**R6.2-08 · Medium · [Phase 1 exposes it] Harm feedback names the hidden diagnosis instead of the reason**

- **Location:** engine.js:1829. The toast is `${drug} can hurt ${name}: ${p.dx}`, and the M&M entry always says "A drug that can hurt this patient".
- **What's wrong (verified, `p6.js`):**
  - Out-of-window tenecteplase: "Tenecteplase can hurt Helen P.: **acute ischemic stroke**." That reads as if the drug harms strokes. The 4.5-hour reason is never shown.
  - First-sheet metoclopramide: "…: **small bowel obstruction**", before the CT. This leaks the diagnosis the student is about to be quizzed on.
  - Ketorolac in chest pain: "…: chest pain, low risk", which implies low-risk chest pain is the reason.
- **Standard violated:** Instructional design (feedback must name the reason); the game's own rule that the diagnosis stays the player's call.
- **Fix:** Add `CONTRA_WHY[case][drug]` strings, for example "outside 4.5 h of last known well", "ACS isn't excluded until the troponin is back", "pushes the gut against a blockage", "pressure under 90". Never print `p.dx` before `p.dxK`.
- **Effort:** S

**R6.2-09 · Medium · [Phase 1] The traumatic-arrest card sequence contradicts itself and HOTT**

- **Location:** CODE_Q.trauma (engine.js:2028–2031) and CODE_WHY.decomp (2012).
- **What's wrong:**
  - Q1's right answer already says "…decompress the chest". Q2 then asks "Two units in … Next?" with the right answer "Decompress both sides of the chest". The student is graded for repeating a step, and the "why" says "No pulse after blood: decompress", which makes decompression sequential.
  - Tamponade and resuscitative thoracotomy (penetrating trauma), pelvic binding and airway are absent.
  - The same two cards apply to an isolated closed femur fracture (`mciyel`, `moto`).
- **Answer to the brief's question:** bilateral decompression is a fair element of blunt traumatic arrest, but at the start and at the same time, not as a second step "after blood".
- **Standard violated:** ERC 2021 traumatic cardiac arrest (treat hypovolaemia, oxygenation, tension pneumothorax and tamponade simultaneously). Search summaries of the HOTT framework and a UK MoD guideline confirm this; I could not read the ERC text itself.
- **Fix:** Q1 becomes "all at once: hemorrhage control, blood, airway, bilateral decompression". Q2 asks about tamponade or thoracotomy (penetrating) or stopping. Skip decompression for isolated limb hemorrhage.
- **Effort:** S

**R6.2-10 · Medium · [Phase 1] ROSC odds are unsourced, conflate in- and out-of-hospital arrest, and VF never shocked still often survives**

- **Location:** CODE_BASE (engine.js:2038) and `codeOutcome` (2088–2094).
- **What's wrong:**
  - The odds are `base × (0.35 + 0.65q) × (1 − late) + 0.05 RT`. A VF patient whose attending picks "epinephrine first", "amiodarone instead of a second shock" and "adenosine" (never defibrillated) still gets 0.175, or 0.225 with RT. In reality, unshocked VF essentially doesn't convert.
  - The same ceilings (VF 0.5, PEA 0.25, asystole 0.10) apply to the EMS out-of-hospital VF case and to a witnessed waiting-room arrest. GWTG-Resuscitation in-hospital arrests reach sustained ROSC in about 72%, and about 83% of those arrests are nonshockable. So the game teaches that in-hospital PEA and asystole are almost always fatal even with perfect care.
  - RT adds a flat 0.05, which is +50% relative in asystole.
- **Standard violated:** Utstein and GWTG-R outcome data. The odds have no cited source (R6-20).
- **Fix:** Make the shock answer a gate for VF (odds near 0 without it). Use separate in-hospital and out-of-hospital bases. Cite the source in a comment and in `docs/CLINICAL_CONTENT.md`. Scale RT relatively.
- **Effort:** S

**R6.2-11 · Medium · [Phase 1] The new ACLS and unstable-AF content is never taught, and its terms aren't glossed**

- **Location:** No Orientation step or Lesson covers the code cards or synchronized cardioversion. Grep of ui.js: the only arrest text is the "Run the code" button and the "Code" gloss.
- **What's wrong:**
  - The glossary (ui.js:1290–1400) has no VF, PEA, asystole, ROSC, CPR, defibrillation, synchronized cardioversion, H's and T's, or A-fib. "ROSC in Resus 1!" appears in a toast unexplained.
  - "Epinephrine: … The treatment for a severe allergic reaction" is the only epinephrine gloss.
  - A student meets a graded ACLS quiz cold in a regular shift.
- **Standard violated:** The owner's design rules ("Teach in Orientation and the Lessons"; "explain every term"). CE instructional design: objectives, then instruction, then assessment.
- **Fix:** Add a "Cardiac arrest" lesson (VF, PEA, trauma, one card each) and an "Unstable fast heart" lesson. Add the glossary entries.
- **Effort:** M

**R6.2-12 · Medium · [Phase 1] The stroke window rule cites a superseded guideline and overstates the hard stop**

- **Location:** engine.js:427 comment ("AHA/ASA 2019"), 430, 1136–1137, 1952–1962; glossary ui.js:1305 ("can only be given within four and a half hours").
- **What's wrong:**
  - The 2026 AHA/ASA early-management guideline (Prabhakaran et al., *Stroke*, published Jan 26, 2026) replaced the 2018/2019 guideline. It makes extended-window thrombolysis (4.5–9 h, including wake-up and unknown-onset stroke selected by perfusion or advanced imaging) a 2a recommendation.
  - The game calls every lytic after 4.5 h "harm" and teaches the 4.5 h line as absolute.
  - The "unknown onset = contraindicated" rule (430) is dead code: every stroke case has `alert: 'stroke'`, so `strokeSetup` always sets `lkwT`. Unknown onset is never taught.
  - I confirmed the 2026 points from search summaries, not the full text.
- **Fix:** Reword it to "within 4.5 h; later only with advanced imaging this ED doesn't have", in the glossary, lesson k3 and the window toast. Cite the 2026 guideline. Add a wake-up-stroke variant if unknown onset is to be taught.
- **Effort:** S

**R6.2-13 · Medium · [Phase 1] Cardioversion of stable A-fib is punished with a fictional complication**

- **Location:** `HARM.cardiovert = [0.3, 15, 'was shocked without needing it']` (engine.js:1760).
- **What's wrong (verified, `p2.js`):** `afib [dilt, synccv]` in a stable patient produced harm in 23 of 60 runs. ED electrical cardioversion of stable recent-onset A-fib is an accepted rhythm-control strategy. The real hazard is thromboembolism when the onset is ≥48 h or unknown without anticoagulation, not "being shocked". The case gives no onset time.
- **Standard violated:** 2023 ACC/AHA/ACCP/HRS AF guideline; CAEP 2021 acute AF best practices.
- **Fix:** Give the A-fib case an onset time. Under 48 h (or anticoagulated): cardioversion is neutral. Otherwise: harm, with the reason "stroke risk: anticoagulate or image first".
- **Effort:** S

**R6.2-14 · Medium · [Phase 1] The new rule tests encode the bugs they should catch**

- **Location:** `test/rules11.js:113` (hemorrhage path tested on a hand-built object with no `traumatic` flag), 70 (asserts metoprolol neutral without ever testing a shocked patient), and 98–103 (the code is tested only with an adult NSTEMI).
- **What's wrong:** Three of this round's Criticals (R6.2-01, 02, 03) pass `npm test` because the tests assert on synthetic state, not the play path.
- **Fix:** Drive `hemorrhageTick` and `crash()` on real cases. Run every code path for every case key, plus age 0 and age 6. Assert per-case cause cards and pediatric doses.
- **Effort:** S

### Low

**R6.2-15 · Low · [Phase 1] The hyperkalemic-arrest card states calcium plus bicarbonate as certain, and implies insulin has no role**

- **Location:** CODE_CAUSE.k (engine.js:2034) and CODE_WHY.hyperk/slowK (2003–2004).
- **What's wrong:**
  - The AHA 2025 special-circumstances chapter (as summarized in search results) says the evidence for IV calcium or bicarbonate in hyperkalemic arrest is limited and uncertain. ILCOR 2025 found insufficient evidence.
  - "An insulin drip takes too long" reads as "no insulin". An IV regular-insulin bolus with dextrose is standard, and dialysis is the definitive treatment.
- **Fix:** "Calcium and bicarbonate are the usual first moves (evidence is thin); insulin with dextrose as a bolus, and call for dialysis."
- **Effort:** S

**R6.2-16 · Low · [Phase 1] Unstable A-fib: no procedural sedation, and anticoagulation is scored as an extra**

- **Location:** CRASH.afib (engine.js:3269). Heparin after the crash is an "extra Meds" (`p2.js`).
- **Standard violated:** 2023 ACC/AHA/ACCP/HRS: anticoagulate as soon as possible around cardioversion for AF ≥48 h or of unknown duration. AHA ACLS tachycardia: consider sedation.
- **Fix:** `ALSO.afib += ['heparin']` after a crash, and one line on sedation in the order hint.
- **Effort:** S

**R6.2-17 · Low · [pre-existing] Aspirin with tenecteplase in stroke is an "extra", not harm**

- **Location:** `stroke [tnk, asa]` → extra "Meds" (`p7.js`).
- **Standard violated:** AHA/ASA 2019 and 2026: no IV aspirin within 90 min of thrombolysis (Class 3: Harm in 2026, per search summaries). Antiplatelets are usually held for 24 h after IV thrombolysis.
- **Fix:** Add `CONTRA_IF` for `asa` in stroke cases when tenecteplase is ordered or given.
- **Effort:** S

**R6.2-18 · Low · [Phase 1] The 20-minute no-team death model is not credible for an ED**

- **Location:** ARREST_NO_TEAM (engine.js:2112–2122); hint ui.js:950 ("After 20 minutes they are gone").
- **What's wrong:**
  - In the model, nurses can't defibrillate or give epinephrine before a doctor "runs" it. ACLS-certified ED nurses do both under standing orders.
  - The patient is "pronounced" with no physician.
  - The 5%-per-minute decay (2092) starts at 3 min, which matches the in-hospital time-to-shock target. That part is reasonable.
- **Fix:** Let nursing start defibrillation and epinephrine with reduced odds. Word the outcome as "the code was called" by the next doctor.
- **Effort:** S

**R6.2-19 · Low · [Phase 1 left it] Post-ROSC care is "intubate" only**

- **Location:** `codeOutcome` (engine.js:2095–2104).
- **What's missing:** 12-lead ECG and cath activation for STEMI, a MAP ≥65 target, oxygenation targets and temperature control.
- **Standard violated:** AHA 2025 post-cardiac-arrest care.
- **Fix:** Add one post-ROSC card (12-lead, pressure, temperature) and make cath the disposition when the arrest case's cause is coronary.
- **Effort:** S

**R6.2-20 · Low · [pre-existing, now scored] The thrombolytic is gated on the consultant being physically present**

- **Location:** engine.js:2950 (`p.consult.st === 'here'`).
- **What's wrong:** Emergency physicians give IV thrombolysis, often with telestroke, without a neurologist at the bedside. With the window now enforced, a late consultant becomes the attending's "missed window" M&M.
- **Standard violated:** AHA/ASA 2026 (door-to-needle goals; telestroke).
- **Fix:** Open the gate on CT done plus BP plus the attending's order. Make the consult advisory.
- **Effort:** S

**R6.2-21 · Low · [pre-existing; SBO touched in Phase 1] SBO teaching names a stomach tube that can't be ordered**

- **Location:** sbo `why` (engine.js:4559): "a tube to drain the stomach". There is no NG order anywhere.
- **Fix:** Add "Nasogastric tube" to Procedures and accept it in SBO.
- **Effort:** S

**R6.2-22 · Low · [pre-existing] Dextrose is harm in DKA without qualification**

- **Location:** `CONTRA.dka = ['d50']` (engine.js:423); `d50` is named just "Dextrose" (366). `p7.js`: `dka [... d50]` gives harm +1.
- **Standard violated:** The ADA 2024 hyperglycemic-crises consensus adds dextrose to fluids when glucose falls below about 250 mg/dL.
- **Fix:** Rename it "Dextrose 50% push" and make it harm only while glucose is above 250. Teach "D5 with the insulin once the sugar falls".
- **Effort:** S

**R6.2-23 · Low · [pre-existing] Apixaban is "wrong drug" for stable PE**

- **Location:** `pe [apixa]` → "Apixaban (wrong drug)" (`p7.js`).
- **Standard violated:** CHEST 2021 VTE guideline (a DOAC is preferred for most VTE). It was noted in round 1 but not itemized.
- **Fix:** Treat it as same-class neutral.
- **Effort:** S

### Nitpicks

**R6.2-24 · Nitpick · [Phase 1]** The asystole path reuses the PEA "why" ("PEA usually has a cause") (engine.js:1999, 2023).

**R6.2-25 · Nitpick · [Phase 1]** "A double dose of epinephrine" (2035) is explained with the noHunt text. It should say high-dose epinephrine has no benefit.

**R6.2-26 · Nitpick · [Phase 1]** Pulseless VT is never named, although the shockable path is "VF/pVT". "VF that keeps coming back after shocks" (1992) should read "VF that persists after shocks (shock-refractory)".

**R6.2-27 · Nitpick · [Phase 1]**

- `ORD_WHY.cwp` (1638) says "then ibuprofen" after a single troponin. The assay is never stated as high-sensitivity, and one conventional troponin doesn't exclude ACS (2021 chest pain guideline).
- `ALSO.arrest` (445) lists bicarbonate and calcium as fine add-ons. That is dead data, and it contradicts CODE_WHY.bicarbAll.

**R6.2-28 · Nitpick · [Phase 1]** The code card header shows room and name but not age or weight (ui card `Code blue: …`). Combined with R6.2-03, nothing tells the student it is a child.

**Counts:**

| Severity | Count | Phase 1 code | Pre-existing |
|---|---|---|---|
| Critical | 3 | 3 | 0 |
| High | 4 | 4 | 0 |
| Medium | 7 | 7 | 0 |
| Low | 9 | 4 | 5 |
| Nitpick | 5 | 5 | 0 |

## 4. Answers to the three open clinician questions

**R6-17, TIA with ABCD2 0–3 and no CTA or MRI:**

- Discharge must **not** be the single right answer. When no vascular imaging has been done, score **observation** (or completing CTA head and neck in the ED) as right.
- Accept "home with TIA-clinic follow-up within 24–48 h" as **equally right** only when CTA (or carotid duplex plus intracranial imaging) and the ECG are done and normal, symptoms have fully resolved, and there is no A-fib or crescendo pattern.
- Never grade a TIA disposition on ABCD2 alone.
- Sources:
  - ACEP Clinical Policy on suspected TIA (Lo et al., *Ann Emerg Med* 2016;68:354–370), Level B: do not rely on risk-stratification instruments such as ABCD2 to identify patients safe for discharge.
  - AHA scientific statement on ED TIA management (Amin et al., *Stroke* 2023;54:e109–e121): vessel imaging of the head and neck regardless of ABCD2; MRI-DWI preferred; admit or transfer where rapid MRI isn't available.

**R6-08, morphine and beta-blockers in suspected ACS:**

- **Morphine** (and fentanyl, which must be scored the same as morphine) should be **neutral** for ongoing ischemic pain despite nitrates, and **harm with SBP under 90**. It should not be required.
- **Metoprolol** should be **neutral** only in a hemodynamically stable patient without heart failure, and **harm** with signs of HF, low output or risk of cardiogenic shock (SBP under about 100, HR over about 110, or after a crash). It should never be required in the ED key: oral therapy within 24 h is an inpatient Class 1 item, and IV blockade is harmful in at-risk patients (COMMIT).
- Sources:
  - 2025 ACC/AHA/ACEP/NAEMSP/SCAI ACS guideline (Rao et al., *Circulation* 2025;151:e771–e862). I read its beta-blocker and opioid wording only through search summaries; the full text was unreachable from this container.
  - 2014 ACC/AHA NSTE-ACS guideline (IV morphine IIb; IV beta-blocker Class III: Harm with shock risk).

**R6-15, DKA insulin on the same signature as the BMP:**

- It is acceptable to let the student **sign** the insulin drip with the labs, as real order sets do, **only if the game then holds the drip until the potassium result is in** and shows why.
  - Use a `gate: 'k'` on `insulin`, like the thrombolytic gate.
  - Start the drip when K ≥3.5 mmol/L.
  - When K <3.5, require potassium first.
- Orientation step a3 must say "insulin starts once the potassium is back".
- Potassium at K 4.8 should be **required**, not optional.
- Source: the 2024 ADA/EASD/JBDS/AACE/DTS hyperglycemic-crises consensus (Umpierrez et al., *Diabetes Care* 2024; co-published *Diabetologia* 2024;67:1455–1479). It delays insulin until K >3.5 (raised from 3.3 in 2009) and starts replacement once K is below 5.0, targeting 4–5. I confirmed this through secondary summaries (CCJM 2025, BMJ Best Practice), not the paper itself.

## 5. Coverage

**What I reviewed:**

- **Every line of the Phase 1 diff** (`git diff 6edcc3d..HEAD -- src/engine.js src/ui.js README.md`):
  - CONTRA, CONTRA_IF and ALSO changes.
  - STROKE_CASES, `lyticWindowOk`, `lyticWindowClosed` and the flowTick gate.
  - CODE_WHY, CODE_Q, CODE_CAUSE, CODE_BASE, `codeRhythm`, `codeCause`, `codeSteps`, `codeStart`, `codeCard`, `codePick`, `codeOutcome` and `arrestNoTeam`.
  - `toArrest`, CRASH.afib and `crashSetup`'s drop.
  - PROC.synccv, TREAT.cardiovert, HARM.cardiovert and the Bicillin class.
  - The sbo case, ORD_WHY.cwp, RX.cwp and the `harmCheck` arrest guard.
  - The ui.js "Run the code" block, the ORDER_TX cardioversion entry, the VERDICT text and the README v0.30.0 paragraph.
- **test/rules11.js** in full.
- **Round-1 order probes:** 55 combinations re-run (`p1.js`), plus 40 new ones (`p2.js`, `p7.js`).
- **Crash paths:** NSTEMI and A-fib.
- **Arrest paths:**
  - Hemorrhage (MTP and pRBC), waiting room, pediatric.
  - Cause and rhythm tables across all ESI 2 cases (`p9.js`).
  - 30 simulated hard attending shifts (`sim2.js`).
- **Gray-zone scores:** 200 seeds each (`p8.js`).
- **Chrome:** the infant code card, the AAA code cards and the chest-pain hint.
- **UI text:** the glossary, the heart-attack and stroke lessons, Orientation a3 and the About disclaimer.

**What I couldn't check, and why:**

- **Full guideline texts.** ahajournals.org is blocked from this container (WebFetch failed with ENOTFOUND). These come from search summaries only, and I name each as such where I rely on it:
  - the 2025 ACS guideline
  - the 2025 AHA ALS and special-circumstances text
  - the 2026 AHA/ASA AIS guideline
  - the ERC 2021 traumatic-arrest text
  - the 2024 DKA consensus
- **Human-play frequency.** The pediatric-arrest frequency in human play is unknown. A weak bot produced none in 30 shifts; I forced one in the browser.
- **Unchanged content.** I did not re-read the radio packs (SCEN) line by line, because the diff shows no change there; R6-42, 50 and 51 stand as written. I did not re-review the v0.29 addCase cases beyond those Phase 1 touched (sbo) or that the new code reaches (aaa, ectopic, ptx, pe, hyperk).
- **Out of scope:** `src/map.js`, `src3d/`, the imaging pictures, the full lesson sweep in the browser, and `npm test` itself (not needed: I reproduced every behavior directly).

## 6. What I'd grudgingly keep

- **`CONTRA_IF` with `addContraIf` merging:** the right model for moment-dependent contraindications. Use it for metoprolol, morphine and aspirin-after-lytic.
- **The 4.5-hour window removal (`lyticWindowClosed`):** taking the drug off the key and counting the miss is the correct scoring shape.
- **Adult VF card content:** shock first, epinephrine after the second shock, amiodarone 300 mg after the third, no synchronized shock for VF, no atropine in arrest since 2010. It is correct for adults.
- **The PEA and asystole first card:** epinephrine as soon as possible, no shock, compressions without waiting. It is correct.
- **The Bicillin IM-only menu and its boxed-warning text.**
- **Synchronized cardioversion as a required player order after an unstable crash, with diltiazem and metoprolol as harm.**
- **The SBO pitfall line explaining the metoclopramide contraindication.**
