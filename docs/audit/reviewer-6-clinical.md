# Reviewer 6: clinical accuracy and medical education

Reviewer role: board-certified emergency physician and paramedic educator. Branch `claude/sleepy-rubin-jot35n`, v0.29.1 working tree, reviewed 2026-11-23.

## 1. Verdict

**No.** Not for CE credit, and not for unsupervised student use. The scoring engine is the curriculum, and in several places it grades textbook-correct care as wrong or harmful. It rewards some care that is contraindicated.

I confirmed every one of these by running the engine:

- Tenecteplase given 6.7 hours after last known well scores a "clean" order set.
- Epinephrine 1 mg IV in a VF arrest is counted as an unneeded order and produces a "harm" event in about a third of runs.
- Metoclopramide is scored as a correct drug for a small bowel obstruction.
- Nitroglycerin, metoprolol and morphine are "wrong drugs" in ACS. Aspirin is the "wrong drug" for chest pain while ketorolac is "right".
- An unstable A-fib that crashes is "fixed" with fluids. Synchronized cardioversion doesn't exist as an order.

None of the clinical content cites a source. The game has no learning objectives, no physician-reviewer attestation and no post-test. A CAPCE or program-director review would reject it on structure alone, before reaching the errors.

## 2. Score

**3 / 10.** The data model is better organized than most hobby projects, and many case vignettes and radio-call doses are right. But a dozen scoring rules that teach the wrong answer make it unfit for its stated purpose.

## 3. Drug, dose and route inventory

All in `src/engine.js`.

- Only **three** of the 93 formulary drugs carry a dose: `epiim`, `epiarr` and `insreg`.
- Routes appear only in some descriptions (`p:`).
- "Used in" lists the cases where the drug counts as right ("ok"), is required ("req"), is accepted as an add-on ("fine") or is contraindicated ("CONTRA"). I built this list by walking RXOK, RXREQ, ALSO and CONTRA in Node (scratch script `use.js`).

### 3a. Order-sheet formulary (DRUGS)

| Drug (key) | Dose | Route given | Used in | Line | Verdict |
|---|---|---|---|---|---|
| Acetaminophen (apap) | none | PO ("by mouth") | ok: dental, ankle, flu, appy, chole, hipfx, cwp, sah, cauda, mci*; CONTRA: apapod; NEVER_WRONG | 314 | No dose. Acceptable otherwise. |
| Ibuprofen (ibu) | none | PO | ok: dental, ankle, flu, stone, cwp, mci*; CONTRA via @bleed | 315 | No dose. Scored as right for "low-risk chest pain" on the first order sheet, before ACS is excluded (R6-08). |
| Ketorolac (ketor) | none | IV ("by vein") | ok: ankle, appy, chole, stone, migraine, cwp, cauda, torsions; CONTRA via @bleed | 316 | Also given IM. Scored right for undifferentiated chest pain: wrong (R6-08). |
| Morphine (morph) | none | IV | ok in 11 cases | 317 | "Wrong drug" in STEMI (R6-08). |
| Fentanyl (fent) | none | IV | ok in 12 cases | 318 | No dose on the order sheet. The radio call dose is correct (see 3b). |
| Hydromorphone (hydro) | none | IV | ok in 10 cases | 319 | No dose. |
| Ondansetron (ondan) | none | none | ok: gastro, appy, chole, sah, torsions, sbo; CONTRA: tcaod; NEVER_WRONG | 320 | No route or dose. Its QT risk is taught only in the TCA case. |
| Metoclopramide (reglan) | none | none | ok: gastro, migraine, **sbo** | 321 | **Critical (R6-05):** contraindicated in mechanical bowel obstruction, yet scored correct for SBO. |
| Prochlorperazine (prochlor) | none | none | ok: gastro, migraine, sbo | 322 | "First choice for migraine" overstates it; it is one of two Level B options. |
| Meclizine (mecliz) | none | PO implied | ok: vip (BPPV) | 323 | Scored as *the* right drug for BPPV, against AAO-HNS 2017 (R6-30). |
| Amoxicillin (amox) | none | PO | ok: otitis, dental, strep, pnalow | 324 | No weight-based pediatric dose for otitis in 1–9-year-olds (AAP: 80–90 mg/kg/day). |
| Amoxicillin-clavulanate (amoxclav) | none | PO | ok: otitis, dental, pnalow | 325 | No dose. |
| Penicillin VK (penvk) | none | PO | ok: dental, strep | 326 | No dose. |
| Cephalexin (cephalex) | none | PO | ok: uti, cell | 327 | Accepted for "cellulitis that failed pills, needs IV" (ORD_WHY 1609 contradicts it). |
| Nitrofurantoin (nitrof) | none | PO | ok: uti | 328 | No dose. |
| Doxycycline (doxy) | none | PO | ok: pnalow | 329 | No dose. |
| Azithromycin (azith) | none | PO | ok: pnalow, **pna (admitted)** | 330 | Monotherapy for admitted CAP scores clean (R6-14). |
| Oseltamivir (osel) | none | PO | ok: flu | 331 | An antiviral filed under "Antibiotics by mouth" (R6-39). |
| Penicillin G benzathine (bicillin) | none | **menu: "Antibiotics by vein"**; text says IM | ok: strep | 332 | **Critical (R6-07):** boxed warning against IV use (cardiorespiratory arrest and death). |
| Ceftriaxone (ctx) | none | IV | ok/req in 9 cases | 333 | "Once a day … meningitis": meningitis dosing is every 12 h (R6-43). |
| Cefazolin (cefaz) | none | IV | ok: cell, moto | 334 | No dose. |
| Piperacillin-tazobactam (piptazo) | none | IV | ok: appy, chole, sepsisw, shock; req: necfasc | 335 | No dose. |
| Vancomycin (vanc) | none | IV | ok: cell, **shock**; req: mening, necfasc, sea | 336 | Vancomycin alone fills the septic-shock antibiotic order (R6-14). |
| Metronidazole (metro) | none | IV | ok: appy, chole (abx is "ok", not required) | 337 | Accepted alone for intra-abdominal infection, with no gram-negative cover. |
| Diphenhydramine (diphen) | none | none | ok: rash, migraine, anaph | 338 | Alone, it fills the migraine treatment (R6-26). |
| Famotidine (famot) | none | none | ok: anaph | 339 | — |
| Methylprednisolone (methylpred) | none | IV | ok: rash, copd, asthma, anaph | 340 | Accepted IV for contact dermatitis. |
| Prednisone (pred) | none | PO | ok: rash, copd, asthma | 341 | — |
| Dexamethasone (dexa) | none | none | ok: asthma; req: mening | 342 | "Wrong drug" for migraine (R6-26). |
| Triamcinolone cream (tricream) | none | topical | ok: rash | 343 | — |
| Epinephrine 0.5 mg IM (epiim) | **0.5 mg** | IM, thigh | ok: anaph (ages 12–60) | 344 | Correct for an adult. A fixed 0.5 mg for a 12-year-old with no weight is wrong (0.01 mg/kg, max 0.5) (R6-24). Concentration not stated. |
| Aspirin (asa) | none | PO, chewed | ok: tia, cpmod; req: stemi, nstemi; CONTRA via @bleed | 345 | **"Wrong drug" for chest pain (cwp)** (R6-08). |
| Nitroglycerin (ntg) | none | none | ok: chf only | 346 | **"Wrong drug" in STEMI, NSTEMI and cpmod** (R6-08). No route (SL, paste or IV). |
| Furosemide (furo) | none | none | ok: chf | 347 | — |
| Metoprolol (metop) | none | none | ok: afib | 348 | "Wrong drug" in NSTEMI (R6-08). |
| Diltiazem (dilt) | none | none | ok: afib | 349 | No dose (0.25 mg/kg). |
| Labetalol (labet) | none | IV | ok: sah; req: dissect | 350 | No dose on the order sheet. |
| Nicardipine drip (nicard) | none | IV drip | ok: sah; fine: dissect | 351 | Correctly not accepted alone for dissection. |
| Heparin (heparin) | none | drip | ok/req: dvt, pe, stemi, nstemi, mesisch | 352 | No bolus or rate. |
| Enoxaparin (enox) | none | "shot" | ok: dvt, pe, nstemi, stemi | 353 | No weight-based dose. |
| Apixaban (apixa) | none | PO | ok: dvt only | 354 | "Wrong drug" for stable PE, though CHEST 2021 prefers a DOAC for most VTE (minor; not itemized). |
| Tenecteplase (tnk) | **none** | none | ok: stroke cases, mpe; CONTRA: pe (if SBP ≥90), @bleed | 355 | **No dose.** Stroke (0.25 mg/kg, max 25 mg) and PE/MI (weight-tiered, max 50 mg) doses differ two-fold, a documented error source. No time-window check (R6-01). |
| 4-factor PCC (pcc) | none | none | req: tfall | 356 | No INR- or weight-based dose. |
| Vitamin K (vitk) | none | none | req: tfall | 357 | No dose or route (IV 10 mg). |
| Tranexamic acid (txa) | none | none | **nowhere** | 358 | Ordered in hemorrhagic shock, it is scored as an extra (R6-12). |
| Albuterol neb (albut) | none | neb | ok: copd, asthma; fine: hyperk | 359 | — |
| Ipratropium-albuterol (duoneb) | none | neb | ok: copd, asthma | 360 | — |
| Magnesium sulfate (mag) | none | none | ok: asthma | 361 | **Alone, it fills the asthma "Medications" order with no steroid** (R6-09). |
| Insulin drip (insdrip) | none | IV drip | ok: dka; CONTRA: hypogly | 362 | Not held for the potassium result (R6-15). No rate (0.1 or 0.14 units/kg/h). |
| Dextrose (d50) | **none** (key implies D50) | none | ok: hypogly; req: hyperk; CONTRA: dka | 363 | No concentration or dose on the order sheet. The radio call says 25 g, correctly. |
| Potassium (kcl) | none | **none** | fine: dka, sbo, salod; CONTRA: hyperk | 364 | No route, for a drug whose IV push kills (ISMP high-alert medication). |
| Naloxone (nalox) | none | none | od (the only drug that gives the treatment) | 365 | No dose on the order sheet. Not re-required after re-sedation (R6-10). |
| N-acetylcysteine (nac) | none | none | ok: apapod | 366 | No regimen. |
| Activated charcoal (charcoal) | none | PO | fine: apapod (at 6 h), salod | 367 | Text says "early only", but it is accepted 6 h after an acetaminophen ingestion (R6-41). |
| Lorazepam (loraz) | none | none | req: status; CONTRA: od | 368 | No dose (0.1 mg/kg, max 4 mg). |
| Haloperidol (halo) | none | none | not used | 369 | — |
| Olanzapine (olanz) | none | none | not used | 370 | — |
| Ketamine (ketamine) | none | none | ok: burn, moto | 371 | No dose (analgesic and dissociative doses differ ten-fold). |
| Glucagon (glucagon) | none | none | ok: hypogly | 372 | — |
| Thiamine (thiamine) | none | none | fine: status, hypogly | 373 | "Before sugar in heavy drinkers": outdated dogma (R6-31). |
| Pantoprazole (panto) | none | IV | **nowhere** | 374 | Scored as an extra in upper GI bleed (R6-28). |
| Octreotide (octreo) | none | none | fine: hypogly | 375 | Scored as an extra in GI bleed (R6-28). |
| Acyclovir (acyclo) | none | none | fine: mening | 376 | An antiviral filed under "Antibiotics by vein" (R6-39). |
| Cefepime (cefepime) | none | none | req (alternative): mening, necfasc, sea | 377 | Accepted in place of ceftriaxone for community meningitis. IDSA names ceftriaxone or cefotaxime. |
| TMP-SMX (tmpsmx) | none | PO | **nowhere** | 378 | "Wrong drug" for cystitis (R6-25). |
| Lidocaine (lido) | none | none | **nowhere** | 379 | An extra for laceration repair; a "wrong drug" for a hip-fracture nerve block (R6-22). |
| Mannitol (mannitol) | none | none | not used | 380 | — |
| Hypertonic saline (hts) | none | none | not used | 381 | — |
| Etomidate (etomidate) | none | none | gives intubation | 382 | No dose. |
| Propofol (propofol) | none | none | gives intubation | 383 | No dose. |
| Succinylcholine (succ) | none | none | CONTRA: hyperk | 384 | Correct contraindication. No dose. |
| Rocuronium (roc) | none | none | gives intubation | 385 | No dose. |
| Procainamide (procain) | none | none | CONTRA: tcaod | 386 | Correct. |
| Home medication dose (homemed) | n/a | n/a | ok: refill | 387 | — |
| Normal saline bolus (ns) | none (no mL/kg) | IV | most fluid cases | 388 | 30 mL/kg is never taught in the order sheet. |
| Lactated Ringer's (lr) | none | IV | fluid cases | 389 | — |
| Epinephrine 1 mg IV (epiarr) | **1 mg** | IV | CONTRA: anaph | 391 | Dose correct (every 3–5 min). **Scored as an extra and as "harm" in VF arrest** (R6-03). |
| Amiodarone (amio) | none | none | CONTRA: tcaod | 392 | No dose (300 mg, then 150 mg). Scored as an extra in arrest. |
| Adenosine (adeno) | none | none | not used in any case | 393 | Taught only on the radio. |
| Atropine (atropine) | none | none | ok: chb | 394 | Dose only on the radio, where it is correct. |
| Calcium chloride (calc) | none | none | req: hyperk | 395 | No dose; no mention of a central line. |
| Sodium bicarbonate (bicarb) | none | none | req: salod, tcaod | 396 | No dose or endpoint (QRS, serum pH). |
| Norepinephrine drip (norepi) | none | drip | ok: shock | 397 | — |
| Push-dose epinephrine (pushepi) | none | IV push | ok: shock | 398 | **A bridge accepted as the definitive septic-shock vasopressor** (R6-14). |
| Esmolol drip (esmolol) | none | drip | req: dissect | 4285 | No HR or SBP target given. |
| Regular insulin 10 units IV (insreg) | **10 units** | IV | req: hyperk | 4286 | Standard. 5 units or 0.1 units/kg is often preferred in ESRD; not mentioned. |
| Levetiracetam (levet) | none | none | req: status | 4287 | No dose (60 mg/kg, max 4.5 g). |
| Clindamycin (clinda) | none | none | req: necfasc | 4288 | — |
| Ampicillin (ampi) | none | none | req: mening over 50 | 4289 | Correct (IDSA). |
| Midazolam (midaz) | none | "IM or in the nose" | req: status | 4290 | No dose on the order sheet. The radio doses are correct. |
| Fosphenytoin (fosphen) | none | none | req: status | 4291 | No dose. |
| Calcium gluconate (calcgluc) | none | none | req: hyperk | 4292 | — |
| Anti-D immune globulin (rhogam) | none | none | fine: ectopic | 4293 | — |

**Missing from the formulary entirely:**

- Tetanus toxoid or Tdap
- P2Y12 inhibitors
- Alteplase
- Nimodipine
- Tamsulosin
- Hydroxocobalamin
- Droperidol (the MIEMSS pack names it)

**Missing from the order menus:**

- Defibrillation
- Synchronized cardioversion

### 3b. Doses in the radio calls (`SCEN`, engine.js 664–711; `TRAIN_SCENS` 3492–3496)

| Call | Drug, dose, route | Line | Verdict |
|---|---|---|---|
| Adult status epilepticus, 80 kg | Midazolam 10 mg IM | 681 | Correct (RAMPART: >40 kg). |
| Child status epilepticus, 20 kg | Midazolam 0.2 mg/kg IN = 4 mg | 682, 3495 | Correct. Maximum dose not stated. |
| Anaphylaxis persisting after IM epinephrine | Epinephrine 0.5 mg IM, repeat every 5–15 min | 683 | Correct. Distractors fine. |
| Stable SVT | Adenosine 6 mg rapid IV push, 12 mg second dose | 684 | Matches the 2020 AHA dose. I could not open the 2025 AHA algorithm text to confirm it is unchanged (cpr.heart.org was unreachable). |
| Symptomatic bradycardia | Atropine 1 mg IV every 3–5 min, max 3 mg | 685 | Correct (AHA 2020). |
| Unstable VT with a pulse | Synchronized cardioversion | 686 | Correct. No energy given, which fits 2025 AHA's device-specific wording. |
| Hypoglycemia with IV access | Dextrose 25 g IV | 687 | Correct. |
| Opioid overdose, apneic | Naloxone 0.4–2 mg IV or IN, titrated | 688 | IV correct. A 0.4 mg IN lower bound is weak: IN products are 4 mg devices or 2 mg atomized doses (R6-42). |
| Femur fracture, 80 kg | Fentanyl 1 mcg/kg IV | 689 | Correct. |
| Tension pneumothorax | Needle decompression, right side | 690, 3496 | Correct. Site not stated (R6-50). |
| MIEMSS pack: nitroglycerin over 3 doses or 1.2 mg; labetalol 10/10/20 mg (max 80 mg) for stroke; labetalol for dissection at ≥220/120; TXA for angioedema; midazolam over 3 doses for withdrawal; second D10 dose; croup nebulized epinephrine under 1 year; fluid over 30 mL/kg | various | 693–710 | **Partly verified.** Public MIEMSS records confirm that the 2026 protocols took effect July 1, 2026, and that they add consultation-only TXA for angioedema and consultation-only labetalol for suspected aortic dissection. I could not reach the protocol text, so the section numbers (4.13-A, 3.9, 11.25, 4.17, 4.2-A, 4.15-A and others), the 220/120 thresholds and the 80 mg maximum are **unverified**. |

## 4. Findings, worst first

Every finding marked "verified" was reproduced in Node against `src/engine.js`. The scratch scripts are `probe.js` to `probe4.js` in my scratch folder.

### Critical

**R6-01 · Critical · The thrombolytic time window is never enforced**

- **Where:** `src/engine.js:1115` (`LYTIC_WINDOW = 270` is defined, exported at 4473, and used only for display at `src/ui.js:908`). The gate is at engine.js:2785; scoring is at 1823/1838.
- **What's wrong (verified):** I created a stroke with `lkw: 400` (6.7 h) and ordered CT head, BMP and tenecteplase. The result was +3 for the treatment, **+10 "clean order set" bonus**, no extra and no harm. With the drug withheld, `missNow` returned `['Thrombolytic']`: correct care was flagged as a missed treatment.
- **Standard violated:** AHA/ASA 2019 acute ischemic stroke guideline. IV thrombolysis runs from 0 to 4.5 h after last known well. Beyond that it needs imaging selection that the game doesn't model.
- **Why it matters:** The game's own UI line ("the thrombolytic has to be in by …") says one thing while the scoring says the opposite. Students learn that the window is decoration.
- **Fix:** In `signOrders` and the gate at 2785, if `G.t - p.lkwT > LYTIC_WINDOW`, treat `tnk` as contraindicated, as `CONTRA_IF` does for PE. Drop `tnk` from `p.right.tr`, score an out-of-window order as harm, and add a rules test for both directions.
- **Effort:** S

**R6-02 · Critical · Walk-in strokes never show last known well; every stroke is generated eligible**

- **Where:** `src/ui.js:908` shows LKW only `if (p.lkwT != null && p.alertOn)`. Walk-in `strokew` (engine.js:643) has `alertOn = false`. engine.js:1119 sets `p.lkw = 35 + vhash*110`, so arrival is always 35–145 min after onset.
- **What's wrong (verified):** The `strokew` card in Chrome showed no onset line, yet `tnk` is required. Players are graded for giving a lytic without knowing onset time. The generator also never produces an out-of-window stroke, a wake-up stroke, an anticoagulated stroke or a stroke mimic, so the "don't give it" decision is never practiced except for BP.
- **Standard violated:** AHA/ASA 2019 AIS guideline. Eligibility requires a known time of onset and a review of exclusion criteria.
- **Fix:**
  - Show LKW for every stroke.
  - Draw LKW over a range that crosses 4.5 h for some patients.
  - Add at least anticoagulant use and recent-surgery exclusions as case facts that make `tnk` contraindicated.
- **Effort:** M

**R6-03 · Critical · Epinephrine 1 mg IV in VF cardiac arrest is scored as an extra and triggers a "harm" event**

- **Where:** engine.js:651 (`arrest` has `tr: []`); 1746 (`p.right.tr` is empty); 1799/1827 (scored as an extra and pushed to `extraTr`); 1737 (`HARM.epi = [0.35, 20, 'went into a fast rhythm from epinephrine they didn't need']`); 1871 (`harmCheck`).
- **What's wrong (verified):** Ordering `epiarr` and `amio` for the arrest patient gave 2 extras. Ordering `epiarr` alone, across 40 seeds, produced the toast "Helen D. went into a fast rhythm from epinephrine they didn't need" **13 times out of 40**. Each one costs −20 care, +10 legal risk and an M&M entry.
- **Standard violated:** AHA 2020/2025 ACLS adult cardiac arrest algorithm. Epinephrine 1 mg IV/IO every 3–5 min, and amiodarone for shock-refractory VF/pVT.
- **Why it matters:** It punishes the core ACLS drug, in the one patient it is for, with a fictional complication. This is the single worst piece of feedback in the game.
- **Fix:** Give `arrest` a real answer key (see R6-04). At minimum put `epi` (epiarr) and `meds` (amio) in its `ok` list, and exclude `p.arrest` patients from `harmCheck`.
- **Effort:** S

**R6-04 · Critical · The cardiac-arrest case contains no resuscitation decisions; the outcome is a coin flip**

- **Where:** engine.js:651 (`vit: 'Pulseless, VF on the monitor'`, `tr: []`); ORD_WHY 1631 ("No orders. Run the code."); `codeOutcome` 1942–1960 (ROSC odds 0.30, or 0.45 if in a resus bay within 5 min, +0.05 if RT is free); `ORDER_MENUS` 453–457 has no defibrillation.
- **What's wrong:** A VF arrest where the only scored act is the charge nurse's bed placement. There is no shock, no rhythm check, no CPR quality, no reversible-cause search and no airway decision. Every ROSC is auto-intubated (1950), with no 12-lead, no MAP target and no cath decision.
- **Standard violated:** AHA ACLS; National EMS Education Standards (paramedic: cardiac arrest management).
- **Why it matters:** A game that sells itself to paramedic and EM students and models a VF arrest without defibrillation will not survive a program director's first look.
- **Fix:**
  - Add Defibrillate, Synchronized cardioversion and Rhythm check as procedures.
  - Give `arrest` an ordered answer key (shock, CPR, epinephrine after the second shock, amiodarone after the third).
  - Tie ROSC odds to time-to-first-shock.
- **Effort:** L

**R6-05 · Critical · Metoclopramide is scored as a correct drug for small bowel obstruction**

- **Where:** engine.js:4378 (`sbo` `rx: { meds: ['ondan', 'reglan', 'prochlor'] }`); `SAME_CLASS_OK` 436 also groups `reglan` with `ondan` and `prochlor`.
- **What's wrong (verified):** `sbo [ns, reglan]` gave right +2, extra 0, wrong 0. It "fills" the antiemetic order.
- **Standard violated:** FDA metoclopramide labeling lists mechanical GI obstruction as a contraindication. A prokinetic against a fixed obstruction risks perforation.
- **Fix:** Remove `reglan` from `sbo.rx`, add `contra: ['reglan']`, and split `reglan` out of the antiemetic `SAME_CLASS_OK` group, or block it when `CONTRA` lists it. Teach the reason in the SBO pitfall.
- **Effort:** S

**R6-06 · Critical · Unstable A-fib with RVR "crashes" and is fixed with fluids; no cardioversion exists**

- **Where:** engine.js:3103 (`CRASH.afib`: HR 174, BP 80/50, chest pain, `add: ['fluids']`); PROC 458 has only TCP; the chest tube is added at 4281.
- **What's wrong (verified):** After a crash, `p.tr = ['meds', 'fluids']` and the fluids are auto-added. No player decision is required and cardioversion is impossible. The engine labels the patient "A-fib with rapid rate, unstable" while treating it as hypovolemia.
- **Standard violated:** AHA ACLS tachycardia algorithm. Unstable tachyarrhythmia (hypotension, ischemic chest pain) gets immediate synchronized cardioversion.
- **Why it matters:** The radio pack (line 686) teaches synchronized cardioversion for unstable VT. The bedside contradicts it.
- **Fix:** Add a "Synchronized cardioversion" procedure (`tx: 'cardiovert'`). Make it the required treatment in `CRASH.afib`, require the player to order it, and stop auto-adding treatments on crash (3122).
- **Effort:** M

**R6-07 · Critical · Benzathine penicillin G is filed under "Antibiotics by vein"**

- **Where:** engine.js:332 (`bicillin: { c: 'abxi' }`); `DRUG_CLASS` 309 (`['abxi', 'Antibiotics by vein']`).
- **What's wrong:** The menu a student opens to find it is labeled IV. Only the small print says "one shot in the muscle".
- **Standard violated:** FDA boxed warning for Bicillin L-A: "NOT FOR INTRAVENOUS USE … has been associated with cardiorespiratory arrest and death." ISMP has repeatedly reported inadvertent-IV Bicillin events.
- **Fix:** Add an IM/other antibiotic class (`abxm`, "Antibiotics, injection into muscle"), move `bicillin` into it, and put "IM only" in its name.
- **Effort:** S

**R6-08 · Critical · ACS pharmacology is scored backwards**

- **Where:** engine.js:409 (`cwp: { meds: ['ibu', 'apap', 'ketor'] }`, `cpmod: ['asa']`, `nstemi: ['asa', 'heparin', 'enox']`), 411 (`stemi: ['asa', 'heparin']`), 429 (`RXREQ`), 1797 (wrong-drug branch).
- **What's wrong (verified):**

  | Case | Order | Result |
  |---|---|---|
  | cwp | aspirin | "Aspirin (wrong drug)", −3 |
  | cwp | ketorolac | right +1 |
  | cpmod | nitroglycerin | "Nitroglycerin (wrong drug)" |
  | nstemi | nitroglycerin | "Nitroglycerin (wrong drug)" |
  | nstemi | metoprolol | "Metoprolol (wrong drug)" |
  | stemi | nitroglycerin | "Nitroglycerin (wrong drug)" |
  | stemi | morphine | "Morphine (wrong drug)" |

  The first order sheet is signed before the troponin exists, so in cwp the game rewards an NSAID and punishes aspirin for undifferentiated chest pain.
- **Standards violated:**
  - ACC/AHA 2014 NSTE-ACS guideline: sublingual nitroglycerin for ongoing ischemic pain (Class I); oral beta-blocker within 24 h without contraindications (Class I); NSAIDs other than aspirin not given (Class III, harm).
  - 2021 ACC/AHA chest pain guideline and the 2025 ACC/AHA/ACEP/NAEMSP/SCAI ACS guideline: aspirin early in suspected ACS. I could not fetch the 2025 text to quote its class numbers.
- **Fix:**
  - Add `ntg`, `metop` and `morph` to `ALSO` for `stemi`, `nstemi` and `cpmod`.
  - Add `asa` to `ALSO` for `cwp`.
  - Remove `ketor` and `ibu` from `cwp` until the troponin is resulted, or add them to `cwp` CONTRA for the first order sheet.
- **Effort:** S

### High

**R6-09 · High · Severe asthma: magnesium alone, with no systemic steroid, earns a clean order set**

- **Where:** engine.js:410 (`asthma: { meds: ['dexa', 'pred', 'methylpred', 'mag'] }`).
- **What's wrong (verified):** `asthma [albut, mag]` gave right +2 and `miss: []`. The case is SpO2 91% and speaking 3 words (640), and it goes home after a 60-minute watch.
- **Standard violated:** GINA 2024 and NAEPP. Systemic corticosteroids within 1 h for moderate–severe exacerbations are core therapy. IV magnesium is an adjunct for severe cases not responding to initial therapy.
- **Fix:** Use RXREQ `asthma: { meds: [['dexa', 'pred', 'methylpred']] }` and move `mag` to `ALSO`. Reconsider discharge for a severe exacerbation after 60 minutes.
- **Effort:** S

**R6-10 · High · Opioid re-sedation "crash": only oxygen is added, naloxone is not re-required, and the patient silently stays hypoxic**

- **Where:** engine.js:3110 (`CRASH.od: add ['o2']`, RR 5, SpO2 80, "won't wake"); 3122 auto-adds it.
- **What's wrong (verified):** After a crash, `p.tr = ['nalox', 'o2']`, `right.tr = ['nalox']`, `txGap` undefined. Thirty minutes later: "HR 63, BP 105/68, RR 9, SpO2 88%, blue lips, won't wake", with no prompt to the player.
- **Standard violated:** AHA 2020/2023 opioid-associated emergency guidance. Support ventilation (BVM) and repeat naloxone, or start an infusion. Supplemental oxygen alone doesn't treat hypoventilation.
- **Fix:** In `CRASH.od` require a new `nalox` treatment (clear `treat.nalox`) plus a ventilation action. Have `treatGap` fire after a crash.
- **Effort:** S

**R6-11 · High · Anaphylaxis: antihistamine plus steroid is required, fluids and bronchodilator are extras, and a crash isn't treated with repeat epinephrine**

- **Where:** engine.js:641 (`tr: ['epi', 'meds']`), 410, 1622; `CRASH.anaph` 3111 (`add: ['o2', 'fluids']`).
- **What's wrong (verified):**
  - `anaph [epiim]` leaves "Medications (an antihistamine and a steroid)" missing, and the patient "isn't improving".
  - `anaph [epiim, ns]` scores "IV fluids" as an extra in a patient at 96/60.
  - `anaph [epiim, albut]` scores the nebulizer as an extra.
  - After a crash ("stridor, swollen tongue", 72/40), only O2 and fluids are auto-added and epinephrine is not re-required.
- **Standards violated:** WAO 2020 and the AAAAI/ACAAI anaphylaxis practice parameter 2023. Epinephrine is the only first-line drug. Antihistamines and glucocorticoids are adjuncts, not required, and steroids are not shown to prevent biphasic reactions. Refractory cases get repeat IM epinephrine, then an infusion, plus fluids. The game's own radio call 683 says "with fluids".
- **Fix:**
  - Make `tr: ['epi']`.
  - Move `diphen`, `famot`, `methylpred` and `ns` to `ALSO`, and add `albut` to `ALSO`.
  - In `CRASH.anaph`, re-require `epi`.
  - Rewrite ORD_WHY 1622 to "Epinephrine first; antihistamines and steroids are optional add-ons."
- **Effort:** S

**R6-12 · High · Tranexamic acid in hemorrhagic shock is scored as an unneeded order**

- **Where:** `txa` (358) appears in no RXOK or ALSO list. The mvc/mcired/moto treatments (648, 656, 650) are scored through 1799 and 1827.
- **What's wrong (verified):**
  - `mvc [mtp, txa]`: extra +1 ("Meds").
  - `mcired`: the same.
  - `moto [cefaz, blood, txa]`: extra "Tranexamic acid".
- **Standard violated:** CRASH-2; ACS-COT ATLS 10th edition; TQIP/JTS hemorrhage guidance. TXA within 3 h of injury for significant hemorrhage is recommended or reasonable.
- **Fix:** Add `ALSO.mvc = ALSO.mcired = ALSO.moto = ['txa']`, mention it in ORD_WHY, and keep it out of `BLEED_RISK`, as it already is.
- **Effort:** S

**R6-13 · High · COPD exacerbation on BiPAP: antibiotics scored as extras, steroids only "reasonable"**

- **Where:** engine.js:407, 619 (`tr: ['nebs', 'bipap']`, `ok: ['meds']`), 1600.
- **What's wrong (verified):** `copd [duoneb, bipap, pred, azith]` scores azithromycin as an extra. `copd [duoneb, bipap, ctx]` scores "Antibiotics" as an extra.
- **Standard violated:** GOLD 2025. Systemic corticosteroids shorten recovery and reduce treatment failure. Antibiotics are indicated for patients who need mechanical ventilation, invasive or **non-invasive**. This patient is on BiPAP by design.
- **Fix:** Make the steroid required (RXREQ `copd: { meds: [['pred', 'methylpred', 'dexa']] }`) and add `abx` to `copd.ok`, with `azith`, `doxy`, `amoxclav` and `ctx` as accepted antibiotics. Teach the steroid in the "Trouble breathing" lesson (ui.js 1888, 1891), which currently omits it.
- **Effort:** S

**R6-14 · High · Antibiotic and vasopressor choices accepted as monotherapy where guidelines require combinations**

- **Where:** engine.js:413 (`shock: { abx: ['piptazo', 'vanc', 'ctx'], pressor: ['norepi', 'pushepi'] }`), 406 (`pna: { abx: ['ctx', 'azith'] }`), 405 (`appy`/`chole` abx `metro`).
- **What's wrong (verified):**
  - `shock [o2, ns, vanc, norepi]` scores right +4 with vancomycin alone: no gram-negative cover in septic shock.
  - `pushepi` alone fills the vasopressor order.
  - `pna [o2, azith]` is clean for an admitted 50–90-year-old.
  - `appy [metro]` is "fine".
- **Standards violated:** Surviving Sepsis Campaign 2021 (broad empiric cover; norepinephrine infusion first-line, not a push-dose bridge); ATS/IDSA 2019 CAP (inpatient non-severe: a beta-lactam plus a macrolide, or a respiratory fluoroquinolone; macrolide monotherapy not recommended); IDSA intra-abdominal infection guidance (metronidazole needs a gram-negative partner).
- **Fix:**
  - `shock`: RXREQ `abx: [['piptazo', 'cefepime', 'ctx'], ['vanc']]` (or one broad agent), with `pressor: ['norepi']` only and `pushepi` in ALSO.
  - `pna`: `abx: [['ctx'], ['azith', 'doxy']]`.
  - `appy`/`chole`: drop `metro` alone.
- **Effort:** S

**R6-15 · High · DKA: the insulin drip isn't held for the potassium result, and the tutorial teaches ordering them together**

- **Where:** `TREAT.insulin` (286) has no gate. Orientation step `a3` (ui.js 1763) orders BMP and insulin drip in one signature. `ALSO.dka = ['kcl']` (430) comments "reasonable, not required" at K 4.8.
- **What's wrong:** ORD_WHY (1620) says "Insulin once the potassium is known", but nothing enforces it and the preceptor demonstrates the opposite. Potassium replacement at K 4.8 is also guideline-indicated, not optional.
- **Standard violated:** ADA/EASD/JBDS/AACE/DTS 2024 hyperglycemic crises consensus. Hold insulin until K ≥3.3 is known. Add potassium to fluids when K is about 3.5–5.0.
- **Fix:** Add `gate: 'k'` to `insulin` for `dka`, opened when the BMP result is in. Make `kcl` required in DKA when K <5.0. Rewrite `a3` to order the labs first.
- **Effort:** M

**R6-16 · High · Gray-zone risk scores are random numbers that contradict the patient's own findings**

- **Where:** engine.js:1145 (`grayScore`: CURB-65 = `chance(0.7) ? randi(0, 1) : 2`), 1146, 1148–1151; RES `pnalow` 242 (BUN 14); EXAM 1540 (alert, full sentences); VCASE 964 (RR 20); case age 25–64.
- **What's wrong (verified):** Across 200 seeds, 66 low-risk pneumonia patients showed **CURB-65 = 2**, with the answer key set to "observation". The same chart has BUN 14, age <65, RR about 20, normal BP and no confusion, which is CURB-65 = 0. The HEART, CSRS and ABCD2 scores are also random draws, not computed from the history, ECG, age, risk factors and troponin that the game displays.
- **Standards violated:** CURB-65 (Lim 2003, BTS); HEART (Backus 2013); CSRS (Thiruganasambandamoorthy 2016); ABCD2. A score is a calculation, and the game teaches that it is a number handed to you.
- **Fix:** Compute each score from case facts: age, displayed vitals, BUN, the ECG line, troponin, and per-patient risk factors drawn from the patient's sub-stream. Show the components.
- **Effort:** M

**R6-17 · High · TIA with ABCD2 ≤3 is graded "home" as the right call**

- **Where:** engine.js:1151; ui.js:46 (`GRAY_GUIDE`: "0 to 3 is low risk (home with fast follow-up)").
- **What's wrong (verified):** 72 of 200 TIAs had "right: home".
- **Standards violated:**
  - ACEP Clinical Policy on suspected TIA (2016), Level B: do not rely on risk stratification instruments (for example ABCD2) alone to identify patients safe for discharge.
  - AHA 2023 scientific statement on TIA management: urgent brain and vascular imaging and an ECG workup before disposition.
- **Fix:** Make "home" right only when CTA or MRI and the ECG are done and normal (or an expedited TIA clinic exists). Otherwise make observation right. Rewrite `GRAY_GUIDE`.
- **Effort:** M

**R6-18 · High · Orders are graded in hindsight against a hidden final diagnosis, and the exam line gives that diagnosis away**

- **Where:** `cwp` and `nstemi` share `cc: 'Chest pain'` (634/635). `signOrders` grades the first order sheet against `p.right`, built from the case key at 1746. EXAM (1557/1558) carries the diagnostic discriminator ("worse when you press" against "pale and sweating, spreads to the left arm").
- **What's wrong:**
  - A real attending writes initial orders for a differential: aspirin, ECG and troponin for any possible ACS. The game instead scores the first sheet as if the final diagnosis were known.
  - That forces students to read the case off one exam line, then penalizes reasonable differential-driven care (R6-08).
  - The diagnosis quiz then asks them to name what the exam already told them.
- **Standard violated:** Instructional design (alignment of assessment with authentic task); ACEP and ABEM emphasis on differential-driven workup.
- **Fix:** Score the first order sheet against an answer key for the **chief complaint** (a "chest pain bundle"), and score case-specific therapy after results. Strip diagnostic discriminators from EXAM where the quiz depends on results.
- **Effort:** L

**R6-19 · High · The order sheet has no doses, routes or weights**

- **Where:** DRUGS 313–399, 4284–4294. Only `epiim` (0.5 mg IM), `epiarr` (1 mg IV) and `insreg` (10 units IV) carry a dose.
- **What's wrong:** Students can't practice the skill that hurts patients most in emergency medicine: dose and route. There are no pediatric weights in any case. TNK has indication-specific doses. Potassium and calcium chloride have route-critical administration.
- **Standards violated:** National EMS Education Standards (pharmacology: dose calculation); NREMT paramedic cognitive exam (pharmacology); ISMP high-alert medication list.
- **Fix:** Give patients a weight. Add dose and route choices for at least the resuscitation set, analgesics, antibiotics in sepsis and meningitis, tenecteplase, insulin, antiepileptics and pediatric drugs. Score them with the existing wrong-drug machinery.
- **Effort:** L

**R6-20 · High · No clinical source is cited anywhere; there are no objectives and no reviewer**

- **Where:** engine.js (all clinical tables), `docs/em-model/PLAN.md` (cites only the ABEM 2022 Model for topic selection), ui.js:2594 (a "teaching game, not clinical guidance" disclaimer).
- **What's wrong:** There are 93 drugs, 76 cases, 42 radio calls and 30 lessons, and none has a reference or a review date. No learning objectives are stated per lesson or per shift. No post-test exists. No content-expert attestation exists.
- **Standard violated:** CAPCE accreditation standards (stated objectives, medical-director content review, learner assessment, evaluation); any nursing CNE or CME accreditor.
- **Why it matters:** An instructor can't defend a single answer to a student who challenges it.
- **Fix:**
  - Add `src` (guideline and year) and `reviewed` (date, reviewer) fields to every case, radio call and lesson, and have `lintCases` refuse entries without them.
  - Write two or three measurable objectives per lesson.
  - Add a scored post-lesson check.
- **Effort:** L

### Medium

**R6-21 · Medium · Behavioral health and overdose require a urine tox screen**

- **Where:** NEED 221 (`bh: { n: ['tox'] }`, `od: { n: ['tox'] }`, `etoh: { n: ['tox', 'bmp'] }`); ORD_WHY 1606.
- **What's wrong (verified):** `od [nalox]` leaves "Tox screen and ethanol" missing, which costs workup-gap points. RES 245 also reports "Fentanyl positive" on a standard screen; most immunoassay panels don't detect fentanyl.
- **Standard violated:** ACEP Clinical Policy on the adult psychiatric patient (2017), Level C: no routine laboratory testing, including UDS, in alert, cooperative patients with normal vitals and a noncontributory exam.
- **Fix:** Move `tox` to `ok` for `bh` and `od`.
- **Effort:** S

**R6-22 · Medium · Local anesthetic scored as wrong**

- **Where:** `lido` (379) appears in no case.
- **What's wrong (verified):** `lac [repair, lido]` gives an extra ("Meds"). `hipfx [fent, lido]` gives "Lidocaine (wrong drug)".
- **Standard violated:** Standard laceration care; AAOS 2021 hip fracture CPG (strong recommendation for regional nerve block).
- **Fix:** Add `ALSO.lac = ['lido']` and accept `lido` for `hipfx` meds (fascia iliaca block).
- **Effort:** S

**R6-23 · Medium · No tetanus prophylaxis exists**

- **Where:** Cases `lac` (610), `burn` (654), `moto` (650), `mcigrn` (659); DRUGS has no Td or Tdap.
- **Standard violated:** CDC/ACIP tetanus wound-management recommendations.
- **Fix:** Add `tdap` and accept it (or require it with an unknown immunization history) in wound, burn and open-fracture cases.
- **Effort:** S

**R6-24 · Medium · Fixed 0.5 mg IM epinephrine for anaphylaxis patients from age 12**

- **Where:** engine.js:344 (`epiim`), 641 (`age: [12, 60]`).
- **What's wrong (verified):** A 12-year-old gets `drugFor = epiim` "Epinephrine 0.5 mg IM", with no weight.
- **Standard violated:** WAO 2020 and AAAAI/ACAAI 2023: 0.01 mg/kg of 1 mg/mL, maximum 0.5 mg (0.3 mg for most children under about 50 kg).
- **Fix:** Give the patient a weight and make the dose weight-based, or restrict the case to adults.
- **Effort:** S

**R6-25 · Medium · TMP-SMX scored as the wrong drug for uncomplicated cystitis**

- **Where:** engine.js:404 (`uti: { meds: ['nitrof', 'cephalex'] }`).
- **What's wrong (verified):** "Trimethoprim-sulfamethoxazole (wrong drug)". Meanwhile cephalexin, a second-line beta-lactam, is "right".
- **Standard violated:** IDSA/ESCMID 2010 uncomplicated cystitis guideline: nitrofurantoin, TMP-SMX (where resistance is under 20%) or fosfomycin first-line; beta-lactams are alternatives.
- **Fix:** Accept `tmpsmx` for `uti`.
- **Effort:** S

**R6-26 · Medium · Migraine is scored against the evidence**

- **Where:** engine.js:408 (`migraine: { meds: ['prochlor', 'reglan', 'ketor', 'diphen'] }`); 623 (`tr: ['fluids', 'meds']`).
- **What's wrong (verified):**
  - `migraine [ns, diphen]` is a clean order set: diphenhydramine alone counts as treatment.
  - `migraine [ns, prochlor, dexa]` gives "Dexamethasone (wrong drug)".
  - `migraine [prochlor]` leaves "IV fluids" missing.
- **Standard violated:** American Headache Society ED migraine guideline (Orr et al., Headache 2016): IV metoclopramide or prochlorperazine and SC sumatriptan should be offered; dexamethasone should be offered to prevent recurrence; diphenhydramine shouldn't be offered as monotherapy. Routine IV fluids have no supporting evidence.
- **Fix:** Remove `diphen` from the right list (move it to ALSO), add `dexa` to ALSO, and drop `fluids` from `tr`.
- **Effort:** S

**R6-27 · Medium · IV fluids required for kidney stone and alcohol intoxication; CT required for every stone; no tamsulosin**

- **Where:** CASES 621 (`stone`, `tr: ['meds', 'fluids']`), 626 (`etoh`, `tr: ['fluids']`), NEED 220 (`stone: ['ua', 'bmp', 'ctap']`).
- **What's wrong (verified):** `stone [ketor]` leaves "IV fluids" missing.
- **Standards violated:** Cochrane 2012 and EAU urolithiasis guidelines (forced hydration doesn't help stone passage); ACEP Choosing Wisely (avoid CT in young patients with a known stone history; consider ultrasound first; STONE trial 2014). IV fluids don't speed ethanol clearance (Perez et al. 2013).
- **Fix:** Move `fluids` to `ok` in both cases. Add a renal/bladder ultrasound and accept it in place of CT for selected patients.
- **Effort:** S

**R6-28 · Medium · Upper GI bleed: PPI and octreotide scored as extras**

- **Where:** engine.js:638 (`gib`, `tr: ['fluids', 'blood']`); `panto` (374) and `octreo` (375) aren't accepted.
- **What's wrong (verified):** `gib [ns, blood, panto]` and `gib [ns, blood, octreo]` each score an extra.
- **Standard violated:** ACG 2021 UGIB guideline (pre-endoscopic PPI may be considered); AASLD 2023 portal hypertension guidance (vasoactive therapy for suspected variceal bleeding). The cause isn't specified, so both are defensible.
- **Fix:** `ALSO.gib = ['panto', 'octreo']`.
- **Effort:** S

**R6-29 · Medium · Primary spontaneous pneumothorax: chest tube mandatory**

- **Where:** engine.js:4410 (`ptx`, `tr: ['o2', 'ctube']`).
- **What's wrong (verified):** `ptx [o2]` leaves "Chest tube" missing.
- **Standard violated:** BTS 2023 pleural guideline (conservative care, needle aspiration or an ambulatory device are first-line options for symptomatic primary spontaneous pneumothorax); ERS 2015.
- **Fix:** Add a "Needle aspiration / small-bore catheter" procedure and accept it (or observation if stable). Keep the chest tube for failure or tension.
- **Effort:** M

**R6-30 · Medium · BPPV ("VIP" event): meclizine is the only right drug, and labs are required**

- **Where:** engine.js:3829 (`vip`: `wk: ['lab']`, `tr: ['meds']`, age 76–82), RXOK 414 (`vip: { meds: ['mecliz'] }`).
- **What's wrong:** An 80-year-old with "dizzy spell", no exam line, labs required, and meclizine as the answer. No Dix-Hallpike or HINTS exam, and no repositioning maneuver.
- **Standard violated:** AAO-HNS 2017 BPPV CPG (diagnose with Dix-Hallpike; treat with canalith repositioning; recommends against routine vestibular suppressants). The game's own DDX lists posterior stroke.
- **Fix:** Add an Epley/repositioning procedure as the right treatment, an exam line with a positive Dix-Hallpike, and `mecliz` as "works, not first choice".
- **Effort:** S

**R6-31 · Medium · "Thiamine before sugar in heavy drinkers"**

- **Where:** engine.js:373.
- **What's wrong:** It teaches delaying dextrose for thiamine. The game does allow giving them together (`hypogly` ALSO 4408), but the text is the old dogma.
- **Standard violated:** Current toxicology teaching; no evidence that one dextrose dose precipitates Wernicke's. Hypoglycemia is treated immediately, with thiamine given alongside.
- **Fix:** Change it to "Give with dextrose in malnourished or alcohol-dependent patients; never delay dextrose for it."
- **Effort:** S

**R6-32 · Medium · Stroke workup requires a BMP; only glucose is required before a lytic**

- **Where:** NEED 228 (`stroke`/`strokew`: `n: ['bmp', 'cthead']`, with `gluc` only "ok" via 259); lesson text ui.js:1839 ("The BMP checks sugar").
- **What's wrong:** It teaches waiting on a lab draw when a fingerstick is the guideline test.
- **Standard violated:** AHA/ASA 2019 AIS guideline: only blood glucose has to be checked before IV thrombolysis in most patients.
- **Fix:** Require `gluc` and make `bmp` "ok".
- **Effort:** S

**R6-33 · Medium · No NIHSS, no deficit severity, no thrombectomy selection**

- **Where:** No match for "NIHSS" in `src/`. The stroke cases (643, 646, 647) and stroke lesson (ui.js 1831–1844) reduce eligibility to BP and LKW.
- **Standard violated:** AHA/ASA 2019 (NIHSS for every suspected stroke; LVO screening and CTA for thrombectomy candidates); Mission: Lifeline Stroke prehospital algorithms.
- **Fix:** Add an NIHSS value to stroke exams. Teach disabling against non-disabling deficits and the LVO threshold, and make CTA required when NIHSS ≥6.
- **Effort:** M

**R6-34 · Medium · Lab values have no units**

- **Where:** RES 239–255, 4298–4427. Examples: "Acetaminophen 260 at 6 hours" (4388), "Salicylate 82" (4394), "Troponin elevated: 0.84" (246), "Hgb 6.8".
- **What's wrong:** The acetaminophen result only means "treat" in mcg/mL. In µmol/L it is far below the treatment line. Salicylate 82 means "dialysis-range" only in mg/dL. Troponin with no assay type or units can't teach high-sensitivity interpretation.
- **Standard violated:** Rumack-Matthew nomogram; EXTRIP 2015 salicylate recommendations; Fourth Universal Definition of MI.
- **Fix:** Add units to every numeric result and state whether the troponin is high-sensitivity.
- **Effort:** S

**R6-35 · Medium · Triage is never practiced; ESI is assigned automatically**

- **Where:** engine.js:2118 (the triage nurse assigns `p.esi`, with a random under-triage `esiT = esi + 1`). The orientation (ui.js 1601) only displays the ESI.
- **What's wrong:** A game marketed to nursing students never asks the player to assign an ESI level. The ESI decision points (life-saving intervention, high-risk situation, resource count, danger-zone vitals) are never exercised. Case ESIs are also inconsistent:
  - COPD on BiPAP is ESI 1 (619) while CHF on BiPAP is ESI 2 (620).
  - The OD case is ESI 1 (627) but its lesson says "Charge nurse: ESI 2" (ui.js 1901).
- **Standard violated:** ESI Implementation Handbook v4 (ENA); NCLEX/CEN triage competencies.
- **Fix:** Add a player triage step (pick an ESI from the vitals and complaint, then show the decision point) and make the case ESIs consistent.
- **Effort:** M

**R6-36 · Medium · Missing standard ACS and stroke secondary-prevention drugs**

- **Where:** DRUGS has no clopidogrel, ticagrelor or prasugrel.
- **Standards violated:** 2025 ACC/AHA ACS guideline (DAPT for ACS); AHA/ASA 2021 secondary prevention (short-course DAPT after high-risk TIA or minor stroke, per POINT and CHANCE).
- **Fix:** Add a P2Y12 inhibitor. Accept it in STEMI, NSTEMI and TIA (ABCD2 ≥4), and require it where the cardiology consult expects it.
- **Effort:** S

**R6-37 · Medium · PALS and pediatric content is too thin for the stated audience**

- **Where:** Pediatric cases are `otitis` (1–9), `asthma` (from 5), `rsv` (0–1) and `anaph` (from 12). No case has a weight. No pediatric sepsis, DKA, seizure (bedside), trauma or arrest case exists. Kid vitals are scaled from adult numbers (engine.js:988).
- **Standard violated:** AHA PALS; National EMS Education Standards (pediatrics); NREMT blueprint (pediatrics is part of every domain).
- **Fix:** Add weights and Broselow-style dosing, plus pediatric sepsis, status epilepticus and bradycardia/arrest cases.
- **Effort:** L

### Low

**R6-38 · Low · "Pain you can press on is the chest wall"**

- **Where:** ORD_WHY 1615; EXAM 1557.
- **What's wrong:** Reproducible chest-wall tenderness occurs in a meaningful minority of ACS patients. It doesn't exclude ACS.
- **Standard violated:** 2021 ACC/AHA chest pain guideline.
- **Fix:** Use "Normal ECG and troponin with reproducible pain: chest wall is likely; ACS isn't excluded by tenderness alone."
- **Effort:** S

**R6-39 · Low · Antivirals filed as antibiotics**

- **Where:** engine.js:331 (`osel`, "Antibiotics by mouth"), 376 (`acyclo`, "Antibiotics by vein").
- **What's wrong:** It reinforces the antibiotic/antiviral confusion that stewardship teaching fights.
- **Fix:** Add an "Antivirals" class.
- **Effort:** S

**R6-40 · Low · TIA defined as "a stroke that clears up on its own"**

- **Where:** ui.js:1370, engine.js:1713.
- **Standard violated:** AHA/ASA 2009 tissue-based definition: transient neurologic dysfunction *without* acute infarction. "A stroke that clears" is the old time-based concept and is wrong.
- **Fix:** "Stroke symptoms that go away, with no brain damage on imaging. A warning."
- **Effort:** S

**R6-41 · Low · Charcoal accepted 6 h after an acetaminophen ingestion**

- **Where:** engine.js:4391 (`also: ['ondan', 'charcoal']`).
- **What's wrong:** The game's own drug text says "early only" (367).
- **Standard violated:** AACT/EAPCCT position statement on single-dose activated charcoal (most benefit within 1 h; acetaminophen within about 4 h at most).
- **Fix:** Remove `charcoal` from `apapod.also`.
- **Effort:** S

**R6-42 · Low · Naloxone "0.4 to 2 mg IV or IN"**

- **Where:** engine.js:688.
- **What's wrong:** It is acceptable for IV. IN bioavailability is lower and commercial IN doses are 2–4 mg. Some protocols do list 0.4–2 mg for all routes, so this is imprecise, not clearly wrong.
- **Fix:** "0.4 mg IV, repeat and titrate, or 2–4 mg IN".
- **Effort:** S

**R6-43 · Low · Ceftriaxone "once a day … meningitis"**

- **Where:** engine.js:333.
- **Standard violated:** IDSA 2004 bacterial meningitis guideline: 2 g IV every 12 h.
- **Fix:** Delete "once a day".
- **Effort:** S

**R6-44 · Low · Severe asthma discharged after a 60-minute watch; asthma crash adds BiPAP**

- **Where:** engine.js:640 (SpO2 91%, 3 words, `dispo: 'home'`, `watch: 60`), 3107 (`add: ['bipap']`).
- **What's wrong:** Discharge of a severe exacerbation needs a sustained response, typically observed longer. NIV in asthma has weak evidence, and the crash text ("can't speak, tiring out", SpO2 84) is a pre-intubation picture.
- **Standard violated:** GINA 2024.
- **Fix:** Make the severe variant obs/admit, or give a mild variant for discharge. Require a steroid. Consider adding intubation to the crash key.
- **Effort:** S

**R6-45 · Low · No alteplase; tenecteplase used for PE without saying it is off-label**

- **Where:** engine.js:355, 4305–4312.
- **Standard violated:** FDA labeling (alteplase is labeled for massive PE). ESC 2019 and CHEST accept systemic thrombolysis generally.
- **Fix:** Add alteplase, or note off-label use in the lesson.
- **Effort:** S

**R6-46 · Low · Heart-attack lesson text names aspirin only; the preceptor also lights heparin; the summary omits anticoagulation**

- **Where:** ui.js:1851, 1854; RXREQ `stemi` 429.
- **What's wrong:** Text and spotlight disagree. The short version teaches "aspirin" as the whole drug plan.
- **Fix:** Say "aspirin and heparin" in both, plus a P2Y12 inhibitor per R6-36.
- **Effort:** S

**R6-47 · Low · SAH case has no nimodipine**

- **Where:** engine.js:4332–4337.
- **Standard violated:** AHA/ASA 2023 aSAH guideline (oral nimodipine is Class I, usually started in the ICU).
- **Fix:** Add it as ALSO with a pearl.
- **Effort:** S

**R6-48 · Low · TCA overdose: an IV fluid bolus is scored as an extra**

- **Where:** engine.js:4399 (`tr: ['meds']`).
- **What's wrong (verified):** `tcaod [bicarb, ns]` scores an extra. Isotonic fluid for TCA hypotension (SBP 96 at the door) is standard alongside bicarbonate.
- **Fix:** `ALSO.tcaod` += `ns`, `lr`.
- **Effort:** S

**R6-49 · Low · Cases locked to one sex reinforce stereotypes; the AAA pearl says "older man" while the case can be female**

- **Where:** engine.js:611 (`uti` F), 614 (`chole` F), 623 (`migraine` F), 626 (`etoh` M), 4325.
- **Fix:** Let sex vary, with a weight, and add a complicated male UTI variant.
- **Effort:** S

**R6-50 · Low · Needle decompression site and landmarks not taught**

- **Where:** engine.js:690, 3496.
- **Standard violated:** ATLS 10th edition (adults: 4th/5th intercostal space, anterior to the mid-axillary line); NAEMSP 2022 position on needle decompression.
- **Fix:** Name the site in the `why` text.
- **Effort:** S

**R6-51 · Low · MIEMSS sepsis call orders an "epinephrine infusion" while the ED engine teaches norepinephrine as first vasopressor**

- **Where:** engine.js:710 against 397.
- **What's wrong:** It may be correct for Maryland EMS formularies, but I could not verify it. Students see two "first" pressors with no explanation.
- **Fix:** Add one line in the call's `why` explaining why EMS uses epinephrine.
- **Effort:** S

### Nitpicks

**R6-52 · Nitpick · Point-of-care glucose and BMP glucose disagree in the same visit**

- **Where:** engine.js:257 against 245/249.
- **What's wrong:** `etoh` POC 72 against BMP 96; `stroke` 148 against 132; `strokew` 141 against 118.
- **Fix:** Use one source.
- **Effort:** S

**R6-53 · Nitpick · Cellulitis ORD_WHY says IV, but oral cephalexin is accepted**

- **Where:** ORD_WHY 1609 against RXOK 408.
- **Fix:** Align the text and the scoring.
- **Effort:** S

**R6-54 · Nitpick · Ottawa ankle rules reduced to "tender on the bone"**

- **Where:** ORD_WHY 1590; EXAM 1532.
- **Fix:** Name the posterior-edge/tip-of-malleolus and weight-bearing criteria.
- **Effort:** S

**R6-55 · Nitpick · Temperatures in °F only**

- **Where:** engine.js:981–984, ui.js:1290.
- **Fix:** Show °C alongside.
- **Effort:** S

**R6-56 · Nitpick · Duplicate keys in the imaging "Look for" table overwrite the better descriptions**

- **Where:** ui.js:1022–1057 (`pelvis_normal`, `ctcs_normal`, `ctap_normal`, `mris_normal` each defined twice; the later, shorter text wins).
- **Fix:** Delete the second copies.
- **Effort:** S

**R6-57 · Nitpick · "Heart block: the beat slows to 30 or 40"**

- **Where:** ui.js:1376.
- **What's wrong:** True only of third-degree block.
- **Fix:** "Complete heart block".
- **Effort:** S

**R6-58 · Nitpick · Glossary "Thrombolytic: a drug that dissolves the clot in a stroke"**

- **Where:** ui.js:1346.
- **What's wrong:** The game also uses it for PE.
- **Fix:** Generalize the definition.
- **Effort:** S

**R6-59 · Nitpick · "Prochlorperazine: first choice for migraine"**

- **Where:** engine.js:322.
- **What's wrong:** It shares Level A/B status with metoclopramide and sumatriptan.
- **Fix:** "A first choice for migraine".
- **Effort:** S

## 5. Coverage

**What I reviewed, line by line:**

- `src/engine.js` 70–725: static data, LABS/IMGS/NEED/RES/POC_RES, TREAT, DRUGS, RXOK, CONTRA, CONTRA_IF, RXREQ, ALSO, NEVER_WRONG, SAME_CLASS_OK, BLEED_RISK, REQ_AGE, DDX, MUST, litigation, ALERTS/GOALS, DIVERTS/OUTAGES, CASES, and both SCEN radio packs.
- `src/engine.js` 955–1160: vitals model, stroke setup, gray-zone scores.
- `src/engine.js` 1524–1960: EXAM, ORD_WHY, FIND_PLAIN, RADIO_PLAIN, DX_PLAIN, RX, HARM, signOrders, mdDecide, codeOutcome.
- `src/engine.js` 3020–3160 (returns, CRASH), 3492–3496 (training radio calls), 3829 (VIP case), 3920–3980 (Orientation helpers) and 4215–4486 (all 21 v0.29 cases, lintCases).
- `src/ui.js`: GRAY_GUIDE, GLOSS (the whole glossary), LOOK (imaging captions), How to play for both roles, STEPS (charge-nurse Orientation), STEPS_MD (attending Orientation), all 9 guided LESSONS, and the generator for the 21 case-card lessons.
- Played in Node: about 70 order combinations across 50 cases, stroke-window tests, crash behaviour for od, anaph and afib, arrest scoring over 40 seeds, and score distributions over 200 seeds each. Scripts are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/r6/` (`probe.js` to `probe4.js`, `use.js`).
- Played in Chrome via Playwright (`play.py`): the walk-in stroke card (no LKW shown) and the SBO lesson card.
- Screenshots reviewed: the attending order menu and the radio call.

**What I couldn't check, and why:**

- **2025 AHA ACLS and PALS text.** cpr.heart.org is blocked from this container. The adenosine, atropine and cardioversion answers match 2020 AHA. I could not confirm that the 2025 algorithm text is unchanged.
- **2026 Maryland Medical Protocols.** I couldn't reach miemss.org or history.miemss.org. Public search snippets confirm the July 1, 2026 effective date, TXA for angioedema with consultation, and labetalol for suspected aortic dissection with consultation. Every section number, threshold and dose cap in the MIEMSS pack is unverified.
- **2025 ACC/AHA ACS guideline class numbers.** I cited the 2014 NSTE-ACS guideline for nitrate, beta-blocker and NSAID recommendations, which I'm confident of, and I state the 2025 guideline only as consistent in direction.
- **Engine sections not read line by line:** nursing, staffing, transport, pharmacy and events (2007–2760, 3160–3920). I grep-checked the events for clinical text and found only operational content.
- **Not reviewed:** `src/map.js`, `src3d/`, and the imaging pictures themselves (only their captions). I did not judge image licensing or whether the radiographs match their captions beyond the captions' wording.
- **Not run:** the full lesson sweep in the browser. The case-card lessons are generated from the same data I audited, so their errors are the data's errors.

## 6. What I'd grudgingly keep

- **`CONTRA_IF` PE logic:** a contraindication that depends on live vitals is the right model; extend it to the stroke window.
- **`addCase` and `lintCases` load-time validation:** keep it, and make it require sources.
- **The BP limit at 185/110 enforced by the nurse holding the lytic:** correct and realistic.
- **The radio dose questions** (midazolam 10 mg IM, 0.2 mg/kg IN, epinephrine 0.5 mg IM repeat, adenosine 6 mg rapid push, atropine 1 mg to 3 mg, fentanyl 1 mcg/kg, dextrose 25 g): correct as written, with plausible distractors.
- **The v0.29 meningitis, necrotizing fasciitis, spinal epidural abscess, hyperkalemia, TCA and salicylate answer keys:** guideline-concordant combinations.
- **`HCG_CASES`:** requiring a pregnancy test in the right cases is a real teaching point.
- **The vitals model's VHOLD idea** (head bleeds and strokes don't go pale and tachycardic): physiologically sound.
- **The "A game, not a protocol" disclaimer** on the About screen: necessary, and not enough.

## Sources consulted online (search snippets only; full texts were unreachable)

- [MIEMSS OMD Protocol Clarifications Memo, 2026-07-20](https://www.miemss.org/home/Portals/0/Memos/OMD-Protocol_Clarifications_Memo-20260720.pdf)
- [MIEMSS Region IV Council minutes, 2026-03-17](https://www.miemss.org/home/Portals/0/Docs/Open-Meetings/RegIV-Council-Minutes-20260317.pdf)
- [MIEMSS Region II Council minutes, 2026-03-16](https://www.miemss.org/home/Portals/0/Docs/Open-Meetings/RegII-Council-Minutes-20260316.pdf)
- [Maryland EMS News, July 2026](https://history.miemss.org/documents/EMS%20News%20July%202026%20TL.pdf)
- [AHA 2025 ACLS Tachycardia algorithm](https://cpr.heart.org/-/media/CPR-Files/CPR-Guidelines-Files/2025-Algorithms/Algorithm-ACLS-Tachycardia-250514.pdf?sc_lang=en)
- [What's new in the 2025 ACLS guidelines (The Hospitalist)](https://www.the-hospitalist.org/hospitalist/article/41486/cardiology/whats-new-what-matters-implementing-the-2025-acls-guidelines/)
