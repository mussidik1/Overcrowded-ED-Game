# Round 12: what was fixed (Nov 26, 2026)

Round 12 was the release review of v0.32.0 (audit Phase 3), on the whole diff since v0.31.0, under the owner's new rule: six
reviewers once per release, a second agent re-checks only Critical and High findings. Every Critical and High finding
reproduced; some were lowered to High. No database change in this release.

## Fixed

- **Strokes that can't have the clot buster (R1.12-01, R1.12-03, R3.12-01, R3.12-02, R5.12-01, R5.12-02, R6.12-01, R6.12-02).**
  A stroke that arrives late, woke up with it, or takes a blood thinner has no door-to-needle goal and no blood-pressure order:
  its pressure is left alone under 220/120 (permissive hypertension). A large-vessel stroke over 185/110 keeps the pressure order,
  for clot removal. `rules6.js` and `rules14.js` check 900 strokes.
- **The order review promised the clot buster to those strokes (R6.12-03).** `ordWhy(p)` says why this patient can't have it.
- **The Onset row (R3.12-05, R5.12-11).** It shows the lytic deadline only for an eligible stroke; a late one reads "outside the
  4.5-hour window"; a blood-thinner patient reads "check the home meds".
- **IV fluids couldn't fill the fluids an anaphylactic shock needs (R1.12-02).** A needed drug now fills its need before the
  add-on list is checked.
- **Teaching text and lessons (R1.12-04, R5.12-03, R6.12-04, R6.12-05, R6.12-10).** COPD: steroid and antibiotic required, in the
  explanation and the Trouble breathing lesson. DKA: potassium in the explanation and the attending's Orientation. Septic shock:
  two antibiotics and norepinephrine, and the sepsis lesson names vancomycin. TIA (R6.12-09): home with a quick clinic visit, or
  observation.
- **Cefepime in septic shock (R6.12-06).** Accepted as the broad antibiotic, with vancomycin.
- **HEART risk factors (R6.12-07, R5.12-10, R6.12-21).** The moderate-risk chest pain patient's two risk factors score 1, as in
  HEART, so the score stays 6 or under and never reads "high" against "moderate risk".
- **Grace's score in Orientation.** Recomputed from the age she shows (58), so observation is the call.
- **The first-sheet workup (R1.12-06, R3.12-03, R5.12-06, R3.12-04).** The complaint's workup is still never counted as extra,
  but it no longer earns the clean-set bonus, and no opioid passes as workup on a pressure under 90. Complete heart block and low
  sugar join weakness; testicular torsion joins belly pain.
- **The CURB-65 card's BUN matched no lab (R5.12-08).** The BMP shows BUN 24 when the card counts it.
- **A missed door-to-antibiotics blamed pharmacy when only one antibiotic was ordered (R5.12-09).** The reason now says so.
- **Potassium's hint** reads "Replace when low, and in DKA" (R5.12-04, in part).
- **Docs (R2.12-01, R2.12-02, R2.12-03, R2.12-04, R6.12-12, R5.12-05).** The README says what the clinician did: answered three
  questions; the owner decided the rest; no full review, and the in-game notice stays. F-034 is "Partly". The README no longer
  says the charge nurse's game is unchanged, and describes the first-sheet rule as it works. Sources: GINA and GOLD 2025, the
  stroke guideline's 2026 update named as not modeled, CRASH-2's 2011 analysis, ESI v5 from ENA.
- **Tests (R6.12-13).** `rules14.js` adds a check for each fix above.

## Left, with the reason

- **CURB-65 is always low for `pnalow` (R6.12-08, R5.12-07).** Its diagnosis is "Pneumonia, low risk", and home is right for
  it; the admitted pneumonia case carries the harder call.
- **A workup drug shows as given without starting a treatment (R1.12-05).** The same as every "fine" order; left.
- **`WORKUP` is keyed by case (R1.12-06, R5.12-05).** The grouping is by complaint; the README now says what it does.
- **The stroke lesson doesn't teach the three exclusions (R6.12-11).** For Phase 4's lesson pass.
- **The live check's forged-header probe (R2.12-05).** It passes when the edge refuses the probe, then runs the plain probes; a
  stronger probe needs a fixed live row, which is a database change for the owner.
- **Dead risk-score branches (R1.12-07, R6.12-22)** and the Lows and nitpicks are in the reports, for Phase 7.
