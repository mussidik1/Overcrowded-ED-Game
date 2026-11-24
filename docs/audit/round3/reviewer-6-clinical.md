# Reviewer 6, round 3: clinical accuracy and medical education

Role: board-certified emergency physician and paramedic educator. Branch `claude/sleepy-rubin-jot35n`, v0.30.0, HEAD 8357568. Reviewed 2026-11-24.

Scope: the round-2 fixes (`git diff 49aea94..HEAD -- src test README.md CLAUDE.md`), checked line by line, plus every path the new code reaches. Items that `docs/audit/round2/STATUS.md` defers or waives are not re-reported:

- R6-02, R6-09, R6-11 to R6-20
- R6.2-18 to R6.2-23
- the clinician sign-off

**How I checked.** I reproduced every claim below against `src/engine.js` in Node. I drove the real paths: `trainPatient`, `crashNow`, `toArrest`, the real card loop through `chooseCard`, and `signOrders`. The scripts are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round3/r6/`:

| Script | What it checks |
|---|---|
| `h.js`, `h2.js` | Harness. `rekey` gives each test patient a fresh id, so the rhythms and causes derived from the id vary. |
| `p2.js` | Cause and rhythm for all 76 cases, at both ends of each age range. |
| `p3.js` | PALS cards and doses at 7 months, 18 months, 5, 8 and 12 years. |
| `p4.js` | The unshocked-VF odds. |
| `p5.js` | ACS scoring (48 order sets). |
| `p6.js`, `p6b.js` | Stroke: aspirin and the time window. |
| `p7.js`, `p8.js`, `p11.js` | A-fib: cardioversion and sedation. |
| `p9.js` | Every contraindication reason a student can see. |
| `p10.js` | Full codes for DKA, chest pain (moderate risk), NSTEMI, sepsis, car crash, motorcycle crash, GI bleed and PE. |

`node test/rules12.js` passes all 56 checks. Several of my findings pass it, because it doesn't test them.

## 0. Round-2 status (Critical, High and Medium)

| ID | R2 sev. | Status | Evidence |
|---|---|---|---|
| R6.2-01 AAA and ectopic run as traumatic arrests | Critical | **Fixed** | `hemorrhageTick` sets `traumatic` only for `TRAUMA_CASES` or a trauma alert. In `p10.js` and rules12, AAA, ectopic and GI bleed get hemorrhagic PEA, then the "Hemoglobin 5 … {source}" card, with massive transfusion and surgery or IR as the right call. No decompression. |
| R6.2-02 Metoprolol and morphine "fine" in cardiogenic shock | Critical | **Fixed** | `lowFlow` (engine.js:439) makes metoprolol harm after a crash, with SBP under 100 or HR over 110. Opioids and nitroglycerin are harm under SBP 90. A crashed NSTEMI plus metoprolol scores harm 1 (rules12). Remaining gap in the thresholds: R6.3-13. |
| R6.2-03 Infants get adult ACLS doses | Critical | **Fixed** | `p3.js`, doses correct for weight: <br>• 7 mo, 8 kg: 16 J, then 32 J; epinephrine 0.08 mg; amiodarone 40 mg <br>• 5 y, 20 kg: epinephrine 0.2 mg; amiodarone 100 mg <br>• 12 y, 48 kg: epinephrine 0.48 mg; amiodarone 240 mg; 96 J, then 192 J <br>The card header shows age and weight. Side effect in the odds model: R6.3-04. |
| R6.2-04 Feedback names the harmful drug | High | **Partly fixed** | `rxName` now skips contraindicated drugs, and `ordLog.why` knows about the crash. But the disposition card reads `E.whyOf(p)` (ui.js:1101), and `whyOf` returns `ORD_WHY.afib` ("…Diltiazem slows the rate…") for the crashed patient. Amiodarone in crashed A-fib is logged as extra "Meds", not by name. See R6.3-09. |
| R6.2-05 Cause card ignores the diagnosis | High | **Partly fixed** | The PE clot, tension pneumothorax, low sugar, bleed source, sepsis volume and opioid cards now follow the case. Still wrong: <br>• DKA gets "potassium 7.9" while its own lab says 4.8 (R6.3-05). <br>• Moderate-risk chest pain gets "the ECG showed a heart attack" (R6.3-06). |
| R6.2-06 ACS scoring inconsistent | High | **Fixed** | `p5.js`: <br>• NSAIDs are harm in moderate-risk chest pain, NSTEMI and STEMI. <br>• Fentanyl and hydromorphone are neutral, the same as morphine. <br>• Nitroglycerin is fine in low-risk chest pain. <br>• Acetaminophen alone leaves "Medications (aspirin)" missing. |
| R6.2-07 README claims a physician review | High | **Fixed at line 57; see R6.3-08** | Line 57 now says the reviewers were AI and that no licensed clinician has reviewed the content. README:110 still says "three clinicians (an emergency physician, an EMS physician, an ED charge nurse) reviewed v0.15". |
| R6.2-08 Harm message names the hidden diagnosis | Medium | **Partly fixed** | `contraWhy` gives a reason without the diagnosis in most cases (`p9.js`). But nine contraindications fall back to a generic line, one reason is misleading, and bleed cases get a hint. See R6.3-11. |
| R6.2-09 Traumatic-arrest sequence | Medium | **Partly fixed** | Question 1 is now "all at once". Question 2 now writes in tamponade for every traumatic arrest, including bleed-outs. `moto` (an open femur fracture) is still in `TRAUMA_CASES`. See R6.3-07. |
| R6.2-10 ROSC odds | Medium | **Partly fixed** | Fixed: separate bases for arrests in the ED and arrests that arrive by EMS; RT is now a relative boost (×1.1); unshocked VF is penalized ×0.1. Still open: the unshocked check misses shocks the student actually gave (R6.3-04). The odds are still unsourced ("roughly in line … not exact", engine.js:2215). With perfect care, the ceilings for PEA (0.45) and asystole (0.25) are still low for arrests in hospital. |
| R6.2-11 ACLS and A-fib not taught | Medium | **Fixed** | New glossary entries: CPR, VF, pulseless VT, PEA, asystole, defibrillation, ROSC, H's and T's, tension pneumothorax, tamponade, A-fib, synchronized cardioversion, PALS, ACLS. New lessons `arrest` and `tachy`. Remaining gaps are in the content (R6.3-01, 03, 15). |
| R6.2-12 Stroke window wording | Medium | **Partly fixed** | It now says "later needs advanced imaging". But it adds "this ED doesn't have", and the order menu offers "MRI brain" (R6.3-12). |
| R6.2-13 Stable A-fib cardioversion punished | Medium | **Partly fixed** | `afOnset` now models onset. Cardioversion under 48 h is neutral; otherwise it carries a 15% stroke risk. Still wrong: <br>• Cardioversion is never accepted instead of rate control (R6.3-02). <br>• Sedation is scored as a wrong drug or an intubation (R6.3-01). <br>• The stroke message blames "no blood thinner" even when heparin was given (R6.3-03). |
| R6.2-14 Tests encode the bugs | Medium | **Partly fixed** | rules12 drives real crashes, bleeds and codes. But it asserts `p.ordLog.why`, not the `whyOf` text the student sees. It has no test for aspirin and the lytic on the same sheet, none for sedation, and none for rhythm control alone. The child VF checks and several rhythm loops still use hand-built objects. |

**Counts (R6.2-01 to R6.2-14):** Fixed 5 (01, 02, 03, 06, 11). Partly fixed 9 (04, 05, 07, 08, 09, 10, 12, 13, 14). Still open 0. Worse 0.

**Lows that STATUS marks fixed:**

- Fixed: 15 (hyperkalemia wording), 24, 25, 26.
- **R6.2-16, partly:** anticoagulation is now in `ALSO.afib`, but sedation is penalized (R6.3-01).
- **R6.2-17, partly:** aspirin after tenecteplase is harm only when signed afterwards; on the same sheet it is extra "Meds" (R6.3-10).

## 1. Verdict

**Only after major work.** Better than round 2's "No".

- The three round-2 Criticals are fixed. The pediatric doses are correct for the stated weight, and the ACS drug rules are now right.
- But the new A-fib content contradicts itself:
  - The lesson says to sedate before the shock. The scoring calls midazolam and ketamine wrong drugs, and propofol or etomidate turns into an unplanned intubation that causes harm 20% of the time.
  - The lesson says stable A-fib under 48 h can be shocked back. The scoring still demands diltiazem as well.
- Several code cards state facts about the patient that the patient's own chart contradicts.
- Ten round-1 Highs are deferred, not fixed, and no clinician has reviewed anything.

## 2. Score

**4 / 10.** Up from 3.

- The arrest system is now mostly right: PALS by weight, cause-specific cards, no decompression for medical bleeds.
- The ACS rules are right.
- The new A-fib, trauma and odds content still has a core-path High and eight Mediums.
- The deferred Highs still teach wrong answers in asthma, anaphylaxis, COPD, sepsis, DKA, trauma (TXA) and TIA.

## 3. New findings, worst first

### High

**R6.3-01 · High · Sedation for cardioversion is scored as wrong. Propofol and etomidate become an intubation, with harm**

- **Location:**
  - `DRUGS.etomidate` and `DRUGS.propofol` have `tx: ['intub']` only (engine.js:385–386).
  - `midaz` and `ketamine` are `tx: ['meds']` and appear in neither `RXOK.afib` nor `ALSO.afib`.
  - Lesson ta2 (ui.js:1876): "synchronized cardioversion … with sedation if there's time".
- **What's wrong (verified):**
  - `p8.js`, stable A-fib under 48 h, with diltiazem and cardioversion:
    - adding midazolam gives "Midazolam (wrong drug)"; ketamine and fentanyl, the same
    - adding propofol or etomidate gives extra "Intubation"
  - Crashed A-fib, with cardioversion plus midazolam or ketamine: extra "Meds".
  - `p11.js`: stable A-fib plus propofol, run 90 minutes:
    - **40 of 40 patients were intubated**
    - **8 of 40 got the harm "had a complication from an intubation they didn't need"**
  - So the only clean path to cardioversion of a stable, conscious patient is shocking them awake. That is also the path the README now advertises.
- **Standard:**
  - AHA ACLS tachycardia algorithm: sedate before synchronized cardioversion whenever possible.
  - Elective cardioversion of a conscious patient is always done under procedural sedation (ACEP clinical policy on procedural sedation).
- **Fix:**
  - When `synccv` or `cardiovert` is on the same sheet, or already ordered, treat `midaz`, `ketamine`, `propofol`, `etomidate` and `fent` as procedural sedation. That means `ALSO`, with no `intub` treatment queued.
  - Give propofol and etomidate a sedation `tx` alongside `intub`, and choose by context.
  - Add a rules12 check: A-fib with cardioversion plus each sedative gives no extra, no wrong drug and no intubation.
- **Effort:** S

### Medium

**R6.3-02 · Medium · Rhythm control is never accepted instead of rate control**

- **Location:**
  - `RXOK.afib = { meds: ['dilt','metop'] }`, `right.tr` includes `meds`.
  - `signOrders` (engine.js ~1893) only moves cardioversion to "fine". It never fills `meds`.
- **What's wrong (verified, `p7.js`):**
  - Onset 20 h, cardioversion alone: miss "Medications (diltiazem)", fine "Synchronized cardioversion". The "still needed: diltiazem" hint follows.
  - The `tachy` lesson (ta3) and the README say stable A-fib under 48 h "can be shocked back".
  - After a successful cardioversion to sinus, rate control isn't required.
- **Standard:** 2023 ACC/AHA/ACCP/HRS AF guideline. Rhythm control by cardioversion is an alternative to rate control, not an add-on.
- **Fix:** When `cardiovertOk(p)` and cardioversion are signed, count the `meds` slot as met. For example, add a `RXREQ`-style alternative, or drop `meds` from `right.tr` as `crashSetup` does.
- **Effort:** S

**R6.3-03 · Medium · The A-fib onset teaching and the stroke message misstate what makes cardioversion safe**

- **Location:**
  - Lesson ta3 (ui.js:1877): "Longer, or not sure when it started? … a **blood thinner** or a heart **ultrasound** first."
  - `harmCheck` (engine.js:1942): "had a stroke after cardioversion: the A-fib had gone on too long to shock without a blood thinner first".
  - `afOnset` (1165); the onset row in ui.js:909.
- **What's wrong:**
  - **The guideline's conditions.** For 48 h or more, the 2023 guideline requires three weeks of uninterrupted therapeutic anticoagulation, or imaging that excludes thrombus in the heart (TEE or CT). Not "a blood thinner first".
  - **The wrong ultrasound.** The game's "Bedside heart ultrasound" (`IMGS.echo`) is a transthoracic study and can't exclude a clot in the atrial appendage. The lesson's "a heart ultrasound" points students at it.
  - **Contradictory feedback.** `harmCheck` ignores heparin. Long-onset A-fib with heparin plus cardioversion still risks the 15% stroke, with the message "without a blood thinner first" (`p7.js`: heparin plus cardioversion scored as extra, and the stroke roll still runs).
  - **Stroke risk ignored.** Under 48 h, cardioversion is "fair" whatever the stroke risk. The A-fib patients are 55 to 90, so most have CHA2DS2-VASc ≥2. The 2023 guideline gives pre-cardioversion imaging a 2b recommendation for raised risk, and anticoagulation before cardioversion continued ≥4 weeks.
  - **Onset never ages.** `afOnset` is fixed for the whole stay, so "41 hours" is still 41 hours after an 8-hour boarding.
  - I confirmed the 2023 recommendations through guideline-table excerpts in search results, not the full text.
- **Fix:**
  - ta3: "Longer, or not sure? A clot may be waiting. Before a shock it needs **three weeks of a blood thinner**, or a **TEE** (an ultrasound from the esophagus) to look for clot. Neither happens in the ED: slow the rate and start a blood thinner."
  - Message: "…had gone on too long to shock without weeks of a blood thinner or a TEE."
  - Age the onset by `G.t`.
- **Effort:** S

**R6.3-04 · Medium · The unshocked-VF penalty ignores shocks the student gave**

- **Location:** engine.js:2202 sets `shocked` only when the right answer's key matches `/^shock/`; the penalty is at 2226.
- **What's wrong (verified, `p4.js`, 300 VF arrests each):**
  - **Adult, shock on card 3.** The student picks "Epinephrine 1 mg first, then shock" and "Amiodarone instead of a second shock", then the right card 3, "**Shock**, then amiodarone 300 mg IV" (key `amio`). `shocked` stays false: **ROSC 11/300 (3.7%)**. The same score, 1 of 3, with the shock on card 1 gives **101/300 (34%)**.
  - **Child, three shocks at the wrong doses.** The student picks the adult-dose options, all of which say "Shock…": "Shock at 200 J", "Shock, then epinephrine 1 mg IV", "Shock, then amiodarone 300 mg IV". **7/300 (2.3%)**, with `shocked` false in all 300.
  - The model kills patients as "never shocked" after three shocks. The M&M line ("0 of 3 rhythm checks right") hides why.
- **Standard:** Internal consistency. Wrong drug doses are a separate error from never defibrillating.
- **Fix:**
  - Tag each choice with a `shock: 1` flag in the data, not a regex on the key. Set `shocked` for `amio`, `amioKid`, `shockKid`, `epiAdult`, `amioAdult` and `epiFirst`.
  - Penalize the wrong dose separately.
  - Add a rules12 check for both sequences.
- **Effort:** S

**R6.3-05 · Medium · A DKA arrest card says "potassium 7.9". The same patient's chart says potassium 4.8**

- **Location:** `CAUSE_OF.dka = 'k'` (engine.js:2141), `CODE_CAUSE.k` (2127), and the DKA case `find.lab` "Glucose 540, anion gap 26, potassium 4.8" (684).
- **What's wrong (verified, `p10.js`):**
  - DKA is ESI 2 and can crash in the waiting room and arrest.
  - Its PEA card 3 says "The blood gas is back: **potassium 7.9**". The right call is "Calcium chloride and sodium bicarbonate".
  - The crash (`CRASH.dka`: HR 136, BP 84/48, "deep fast breathing") is volume loss and acidosis.
  - The card teaches "DKA arrest = hyperkalemia" against the patient's own lab.
- **Standard:**
  - AHA ALS: routine calcium in arrest is not recommended without a specific indication.
  - The reversible causes in DKA are hypovolemia and acidosis (hydrogen ions), with hypo- or hyperkalemia only when measured.
- **Fix:**
  - Map `dka` to `vol`, or add an acid card: "pH 6.85, potassium 4.8: fluids wide open; bicarbonate is reasonable at this pH."
  - Or make the potassium card read the patient's measured potassium.
- **Effort:** S

**R6.3-06 · Medium · The coronary cause card contradicts the chart and the game's own disposition**

- **Location:**
  - `CAUSE_OF.cpmod/nstemi/stemi = 'coronary'`.
  - `CODE_CAUSE.coronary` (engine.js:2134): "The ECG before the arrest showed **a heart attack**" → "if the pulse comes back, straight to the cath lab".
  - `codeOutcome` (2229) sets `con = 'icu'` and `dispo = 'icu'`.
  - `mdDecide`: "After a cardiac arrest the patient goes to the ICU … Call Critical Care."
- **What's wrong (verified, `p10.js`):**
  - **False stem.** A moderate-risk chest pain patient whose chart reads "ECG: Nonspecific ST changes" and "First troponin negative" gets the "ECG showed a heart attack" card.
  - **Wrong routing.** After ROSC the game routes them to Critical Care, the opposite of the card's "straight to the cath lab".
  - **The case where it fits can't arrest.** STEMI is ESI 1, and only ESI 2 patients crash. So every coronary card a student can reach is for moderate-risk chest pain or NSTEMI.
- **Standard:**
  - STEMI after ROSC: emergent angiography (AHA, Class 1).
  - Without ST elevation, shock or electrical instability: the 2023 AHA focused update gives emergent angiography Class 3: No Benefit (COACT, TOMAHAWK).
  - I confirmed the 2023 wording through a secondary summary only.
- **Fix:**
  - Map moderate-risk chest pain to `look`.
  - Change the coronary card to "If a pulse comes back: a 12-lead ECG. ST elevation or shock → the cath lab; otherwise the ICU."
  - Route a coronary arrest with ROSC to the cath lab when ST elevation is present.
- **Effort:** S

**R6.3-07 · Medium · Tamponade is written into every traumatic arrest, including bleed-outs, and moto is still treated as chest trauma**

- **Location:** `CODE_Q.trauma[1]` (engine.js:2105), `TRAUMA_CASES` (2138) and `hemorrhageTick`.
- **What's wrong (verified, `p10.js`):**
  - **Car crash (`mvc`).** "Splenic laceration, hemorrhagic shock". Its chart says "No pneumothorax, FAST positive". It arrests "after hemorrhage" because MTP was late. Card 2: "The ultrasound shows **fluid around the heart**" → "Drain it now (pericardiocentesis), or the surgeon opens the chest".
  - **Motorcycle crash (`moto`).** "Open femur fracture" (bleed `prbc`). It gets bilateral chest decompression, then the same tamponade card.
  - R6.2-09 named moto as an isolated limb injury, but only `mciyel` moved to `LIMB_CASES`.
  - The arrest mechanism the game itself wrote is an empty heart from hemorrhage. The card swaps in a different cause.
  - Card 2 leads with needle pericardiocentesis for traumatic tamponade. ERC 2021 points to resuscitative thoracotomy for it. I couldn't confirm the ERC wording on needle reliability from here.
- **Standard:** ERC 2021 traumatic cardiac arrest: treat hypovolemia, oxygenation, tension and tamponade at the same time, and use ultrasound to find the actual cause.
- **Fix:**
  - Choose card 2 by mechanism:
    - Hemorrhage: "Small, empty heart: keep the blood coming, control the source (OR, REBOA)."
    - Tamponade: only for penetrating chest trauma, worded "resuscitative thoracotomy; pericardiocentesis only if nobody can open the chest".
  - Move `moto` to `LIMB_CASES`.
- **Effort:** S

**R6.3-08 · Medium · README still claims three clinicians reviewed the game**

- **Location:** README.md:110: "Three lay players and three clinicians (an emergency physician, an EMS physician, an ED charge nurse) reviewed v0.15."
- **What's wrong:** README:57 and CLAUDE.md now say no licensed clinician has reviewed the clinical content. Line 110 says the opposite. This is the same misrepresentation as R6.2-07, in a second place. I missed it in round 2.
- **Fix:** Reword line 110 to say what the reviewers were, for example AI role-play reviewers. If they were real people, name them and their credentials in a content-review record.
- **Effort:** S

**R6.3-09 · Medium · The disposition card still teaches "Diltiazem slows the rate" for unstable A-fib (residual of R6.2-04)**

- **Location:** `whyOf: p => ORD_WHY[p.ck]` (engine.js:4831); the UI's `mdDecideBlock` (ui.js:1101) shows it as "The workup: …".
- **What's wrong (verified, `p8.js`):**
  - For crashed A-fib (BP 83/49), `OC.whyOf(p)` returns "ECG names the rhythm. Labs look for a cause. **Diltiazem slows the rate.** Cardiology."
  - The crash-aware text exists only in `p.ordLog.why`. That field is what rules12 asserts on, not what the screen shows.
  - After ROSC, the same card shows the original case's workup.
  - Amiodarone in crashed A-fib is logged as extra "Meds", not by name.
- **Fix:**
  - `whyOf`: return `CRASH[p.ck].why` when `p.crash`, and a post-ROSC line when `p.rosc`.
  - Label extras by drug.
  - Make the test read `whyOf`.
- **Effort:** S

### Low

**R6.3-10 · Low · Aspirin and tenecteplase on the same sheet is "extra", not harm (R6.2-17 partly fixed)**

- **Location:** engine.js:433: `asa: p => … (p.tr || []).includes('tnk')`.
- **What's wrong:** `p.tr` doesn't hold `tnk` yet while the same signature is being checked. `p6.js`: stroke, strokew and LVO in the window, `[tnk, asa]` together, gives extra "Meds" and harm 0. Ordering them one after the other gives harm.
- **Standard:** AHA/ASA. No antiplatelet in the first 24 h after IV thrombolysis. The 2026 guideline makes IV aspirin within 90 minutes Class 3: Harm (per search summaries).
- **Fix:** Check the `treats` being signed as well.
- **Effort:** S

**R6.3-11 · Low · Contraindication reasons: generic, misleading or hinting**

- **Location:** `contraWhy` and `CONTRA_WHY_DRUG` (engine.js:470–486). Full list in `p9.js`.
- **What's wrong:**
  - **Generic.** Nine contraindications show "it isn't safe for this patient (the case's lesson says why)":
    - hyperkalemia: succinylcholine and potassium chloride
    - tricyclic overdose: procainamide, amiodarone and ondansetron
    - hypoglycemia: both insulins
    - acetaminophen overdose: acetaminophen
  - **Misleading.** Salicylate overdose plus aspirin says "it adds to the bleeding risk". The reason is that it's more of the poison.
  - **Hinting.** Dissection, SAH, AAA and ectopic patients get "a blood thinner makes bleeding worse", which hints at a bleed before the diagnosis is made.
- **Fix:** Write per-case reasons, for example:
  - succinylcholine: "raises potassium further"
  - procainamide and amiodarone: "more sodium-channel and QT blockade"
  - aspirin in salicylate overdose: "it is more of the poison"
  - for dissection: "if this is a torn aorta, a blood thinner can make it fatal"
- **Effort:** S

**R6.3-12 · Low · "Advanced imaging this ED doesn't have", but MRI brain is on its own menu**

- **Location:**
  - the window note (engine.js:2007)
  - CONTRA_WHY.stroke.tnk
  - the glossary "Last known well" (ui.js:1322)
  - lesson k3
- **What's wrong:** `IMGS.mrib` "MRI brain" is orderable. A DWI-FLAIR mismatch on MRI is how unknown-onset stroke is selected for thrombolysis (WAKE-UP; AHA/ASA 2019, 2a). Perfusion imaging is what the 4.5–9 h window needs.
- **Fix:** "Later needs perfusion imaging and a stroke-center protocol this ED doesn't run." The engine comment already says "doesn't model".
- **Effort:** S

**R6.3-13 · Low · The beta-blocker harm threshold is looser than the guideline's shock-risk list**

- **Location:** `lowFlow` (engine.js:439).
- **What's wrong:** The rule is SBP <100, HR >110 or a crash. The 2014 NSTE-ACS guideline (Class III: Harm for IV beta-blockers, from COMMIT) lists more risk factors for shock: age >70, SBP <120, HR >110 or <60, and longer time since onset. It also lists PR >0.24 s, AV block and reactive airways as contraindications.
- **Note:** My round-2 suggestion of "about 100" was too loose; this corrects it.
- **Fix:** Add SBP <120, age >70 and HR <60 to `lowFlow`.
- **Effort:** S

**R6.3-14 · Low · An asthma arrest gets the generic airway card**

- **Location:** `CAUSE_OF.asthma = 'air'`.
- **What's wrong:** The card says "Reposition, two-person bag-mask, advanced airway".
- **Standard:** AHA special circumstances, asthma arrest:
  - Air trapping: a low rate and small breaths, and briefly disconnect the bag or vent with chest pressure to let air out.
  - Consider tension pneumothorax on both sides.
- **Fix:** Write an asthma cause card.
- **Effort:** S

**R6.3-15 · Low · The cardiac arrest lesson never teaches CPR quality, and it has no practice card**

- **Location:** LESSONS.arrest (ui.js ~1866–1871).
- **What's wrong:** It is six text slides. It never mentions rate 100–120, depth 5–6 cm, full recoil, minimal pauses or avoiding overventilation, which are the core of the AHA algorithm. The student first answers a code card in a scored shift.
- **Fix:** Add one CPR-quality slide and one practice code card using `trainPatient`.
- **Effort:** S

### Nitpicks

- **R6.3-16 · Nitpick · Grammar in the M&M line.** "died after a asystole" and "died after a arrest after bleeding" (engine.js:2240).
- **R6.3-17 · Nitpick · Card timing.** Rhythm checks are `CODE_GAP` = 4 game minutes apart, but the cards say "Two minutes of CPR". Card 3's wrong answer "Call the code: it has been 4 minutes" appears after 8 or more minutes.
- **R6.3-18 · Nitpick · Two "why" lines that don't fit.**
  - The volume card's tenecteplase "why" says "in a bleeding patient" to a septic or dehydrated patient.
  - The GI bleed card names "the surgeon or interventional radiology" and leaves out GI and endoscopy.
- **R6.3-19 · Nitpick · Cardioversion wording.**
  - The `PROC.synccv` gloss and the glossary say cardioversion is for "a crashing pressure", but the game now allows it in stable A-fib.
  - "Not sure when it started: at least a few days" contradicts itself.
- **R6.3-20 · Nitpick · Weight estimate and card title.**
  - `kgOf`'s comment says "APLS-style", but the formula is the Best Guess method (Tinning & Acworth 2007). APLS for 6 to 12 years is 3 × age + 7.
  - The card title says "(child)" for a 7-month-old.
- **R6.3-21 · Nitpick · Post-ROSC exam text.** It says "Intubated and on the ventilator" before the intubation is done (engine.js:4831).
- **R6.3-22 · Nitpick · Limb card.** It offers a tourniquet for a closed femur fracture (`mciyel`). A traction splint is the bleeding control there.
- **R6.3-23 · Nitpick · Rhythm consistency.** Children with hypoxic causes are VF 10% of the time; adults with the same causes are never VF (engine.js `codeRhythm`).

**Counts:** Critical 0 · High 1 · Medium 8 · Low 6 · Nitpick 8.

## 4. Coverage

**What I reviewed:**

- **The round-2 engine diff, every line:**
  - CONTRA, CONTRA_IF and ALSO for cpmod, nstemi, stemi, cwp, afib and the stroke cases.
  - `lowFlow`, `hrOver`, CONTRA_WHY and CONTRA_WHY_DRUG.
  - `afOnset`, `cardiovertOk` and the new `lyticWindowOk`.
  - `monthsOf` and `kgOf`.
  - `rxName`, `logOrders` and `harmCheck`.
  - `mdDecide` ROSC, and `canPlace` for arrests.
  - CODE_GAP, all of CODE_WHY, CODE_Q (vf, pea, asys, trauma, limb, kidvf, kidpea, kidasys) and CODE_CAUSE (all 11 cards).
  - TRAUMA_CASES, LIMB_CASES, BLEED_SRC, CAUSE_OF and NONSHOCK_CAUSES.
  - `codeCause`, `codeRhythm`, `codeFill`, `codeSteps`, `codeStart`, `mixHash`, `codeDue`, `codeCard`, `codePick`, CODE_BASE, CODE_AI_Q, `codeOutcome` and `arrestNoTeam`.
  - `toArrest`'s `preAlert`, `hemorrhageTick`, CRASH.afib.why, `crashSetup`'s drop and `lintCode`.
- **The UI diff:**
  - the A-fib onset row
  - the countdown
  - the Resuscitation menu
  - all 14 new glossary entries and the two changed ones
  - lessons `arrest` and `tachy`, line by line
  - the stroke k3 wording
- **Other files:** README:57 and README:110, CLAUDE.md, rules11 changes, and rules12 in full (run: 56 passing).
- **Reachability:** which cases can arrest in play.
  - Only ESI-2 patients crash; arrests also come from bleeds needing MTP or blood, and from the arrest case.
  - So the coronary card is reachable only in moderate-risk chest pain and NSTEMI.
  - The burn, fall, opioid, tricyclic and salicylate code paths are unreachable today.

**What I couldn't check, and why:**

- **Full guideline texts.** I worked from search summaries and guideline-table excerpts, named as such where I relied on them:
  - 2025 AHA ACLS, PALS and post-arrest care (the 2025 angiography wording)
  - ERC 2021 traumatic arrest (needle pericardiocentesis)
  - 2023 ACC/AHA/ACCP/HRS AF (exact classes)
  - 2026 AHA/ASA stroke
- **The browser.** I didn't take screenshots this round. The two UI claims (R6.3-09 `whyOf`, and the code card header) are read from code that I traced to the render function, plus the engine values the UI prints.
- **Deferred and unchanged content.** I didn't re-review radio packs, the deferred Phase 3 items, or the cases the diff doesn't touch.

## 5. What I'd keep

- **PALS cards.** Weight-based doses with the adult dose as the distractor, and a "why" that prints the child's computed dose and weight. The arithmetic is right across 3 to 48 kg.
- **The medical-bleed fix.** The hemorrhage arrest is split from trauma, and the "Hemoglobin 5 … {source}" card is shown only to patients who are actually bleeding.
- **Cause cards.**
  - Tenecteplase during CPR for a PE arrest, with longer CPR after it.
  - Clinical decompression for tension pneumothorax without waiting for an X-ray.
  - Dextrose for a sugar of 18.
- **ACS rules.** `lowFlow` and the SBP <90 rules, NSAIDs as harm in any ACS, and aspirin required in chest pain.
- **The result card.** It shows the right call and why, after every rhythm check.
- **ROSC is never "home",** and `lintCode()` checks the card data at load.
