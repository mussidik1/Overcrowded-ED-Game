# Clinical sources

The guideline behind each part of the game's clinical content, for instructors and reviewers (audit R6-20). The game is a teaching
tool, not clinical guidance. **Confirmed** is filled in by the project's clinical consultant; a blank means not yet checked.
The level is who makes the decision in the game: the attending (physician) for orders, diagnoses and dispositions; the charge
nurse (RN) for flow.

| Area (cases) | Source | Level | Confirmed |
|---|---|---|---|
| Cardiac arrest, adult and pediatric codes | AHA Guidelines for CPR and ECC, 2020, with the 2023 focused updates (ACLS, PALS) | Physician | |
| Chest pain, NSTEMI, STEMI (cpmod, cwp, nstemi, stemi) | ACC/AHA guidelines for acute coronary syndromes (2025 ACS guideline; earlier: 2014 NSTE-ACS, 2013 STEMI) | Physician | |
| HEART score (chest pain gray zone) | Six et al., 2008; Backus et al., 2013 | Physician | |
| Acute ischemic stroke, tenecteplase window, blood pressure limit (strokew, stroke, lvo) | AHA/ASA guideline for early management of acute ischemic stroke, 2019, as the game models it (the 2026 update adds an imaging-selected late window the game does not model) | Physician | |
| TIA, ABCD2 (tia) | Johnston et al., 2007 (ABCD2); clinician's answer of Nov 25, 2026 (home or observation for ABCD2 0 to 3) | Physician | |
| Subarachnoid hemorrhage (sah) | AHA/ASA guideline for aneurysmal subarachnoid hemorrhage, 2023 | Physician | |
| Bacterial meningitis (mening) | IDSA practice guideline for bacterial meningitis, 2004 | Physician | |
| Sepsis and septic shock (sepsisw, shock) | Surviving Sepsis Campaign international guidelines, 2021 | Physician | |
| Pneumonia, CURB-65 (pna, pnalow) | ATS/IDSA guideline for community-acquired pneumonia, 2019; Lim et al., 2003 (CURB-65) | Physician | |
| Asthma (asthma) | GINA report, 2025; NAEPP 2020 focused update | Physician | |
| COPD exacerbation (copd) | GOLD report, 2025 | Physician | |
| Anaphylaxis (anaph) | World Allergy Organization guidance, 2020; AAAAI/ACAAI anaphylaxis practice parameter, 2023 | Physician | |
| Diabetic ketoacidosis (dka) | ADA consensus report on hyperglycemic crises in adults, 2024; clinician's answer of Nov 25, 2026 | Physician | |
| Atrial fibrillation (afib) | ACC/AHA/ACCP/HRS guideline for atrial fibrillation, 2023 | Physician | |
| Pulmonary embolism (pe, mpe) | ESC guidelines for acute pulmonary embolism, 2019 | Physician | |
| Aortic dissection (dissect) | ACC/AHA guideline for aortic disease, 2022 | Physician | |
| Hemorrhagic shock, tranexamic acid (mvc, moto, mcired, a crashing mciyel) | ATLS, 10th edition, 2018; CRASH-2 trial, 2010, and its 3-hour analysis, 2011 | Physician | |
| Canadian Syncope Risk Score (syncope, synchigh) | Thiruganasambandamoorthy V, et al. CMAJ 2016;188(12):E289-E298 | Physician | |
| First order set by complaint (all cases sharing a door picture) | Clinical consultant's list, Nov 25, 2026 (`WORKUP` in `src/engine.js`) | Physician | yes |
| Triage (ESI) | Emergency Severity Index handbook, version 5 (ENA) | RN | |
| All other cases (hyperkalemia, overdoses, toxic ingestions, surgical abdomen, torsion, ectopic, cauda equina and the rest) | To confirm: each case's rule is written in `src/engine.js` with a comment | Physician | |
