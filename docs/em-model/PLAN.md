# EM Model build plan (agreed Nov 20, 2026)

Source: ABEM 2022 Model of the Clinical Practice of Emergency Medicine (his upload).
Scope: critical and emergent conditions only; lower-acuity-only items are cut.
`em-model-2022-items.json` is every item parsed from the PDF (1,331). `scope-critical-emergent.json` is the cut list (638 leaf items in sections 1-18; section 1 is presentations, used as chief complaints, not cases). The acuity columns were parsed from page layout and are approximate; check each item against the PDF when building it.

Rules for every chunk:
- A diagnosis arrives as a patient: chief complaint, vitals, exam. The diagnosis is what the doctor works out.
- Every test or procedure it needs is orderable in its parent menu. Every drug sits in its class; resus drugs are their own set.
- Each condition gets a lesson under its body system in the physician Learn section.
- Tests (rules, sim, UI) pass before each merge; status doc updated; artifact republished.

| Chunk | Version | Contents | Items |
|---|---|---|---|
| 0 | v0.28 | Engine and UI: order parent menus, drug classes, resus set, procedure menu (EM Model sec 19), clinical accuracy score, harm-weighted litigation risk (25% administrator call, ~40% peer review, 50% PIP + lawyer calls, 75% fired, shift ends), radio calls asking for doses and orders (multiple choice), medical direction lesson, physician lessons grouped by body system, compact case format so new cases are data only | framework |
| 1 | v0.29 | Cardiovascular + Thoracic-respiratory | ~58 |
| 2 | v0.30 | Nervous system + Toxicology | ~75 |
| 3 | v0.31 | Trauma | ~75 |
| 4 | v0.32 | Abdominal and GI | ~83 |
| 5 | v0.33 | Endocrine/metabolic + Renal/GU + Hematology/oncology | ~70 |
| 6 | v0.34 | OB/GYN + Psychobehavioral | ~54 |
| 7 | v0.35 | Systemic infections + Immune + Cutaneous | ~73 |
| 8 | v0.36 | HEENT + Musculoskeletal + Environmental | ~74 |
| 9 | v0.37 | Pediatric pass, presentation (sec 1) check, litigation and scoring tuning, clinician review | review |

Rough cost at API rates: framework $150-300; each system chunk $80-200; total about $800-1,800.
