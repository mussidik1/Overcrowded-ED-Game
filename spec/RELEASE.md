# Release v0.34.0: the 12-lead ECG, drawn and signed

- **Version:** 0.34.0 (class codes from v0.33.0 read as stale; save format unchanged).
- **Replaces:** v0.33.0 on `main` (`1ae8ab0`).
- **Database:** no change.
- **Release notes:** the v0.34.0 paragraph in `README.md`: every ECG drawn by a heart-vector model (15 readings, measured in
  `test/rules16.js`); on a regular attending shift each ECG needs the attending's signature (STEMI, No STEMI, Repeat ECG on Arrival).
- **Review:** skipped by the owner (Nov 28, 2026: "Skip the review, merge v0.34.0 behind the gate"). No drift check or CTO memo was
  run. The phone check and F-136 to F-144 stay held. No licensed clinician has read the drawn ECGs.

---

# Release v0.33.0: fair grading, no giveaways, safer saves (audit Phases 4 and 6)

- **Version:** 0.33.0 (class codes from v0.32.0 read as stale, by design; save format unchanged).
- **Commit to release:** the head of `3d` once the Tests workflow is green at that exact commit (candidate `1f79199`).
- **Replaces:** v0.32.0 on `main` (`78916ef`).
- **Database:** no change (no new file in `supabase/migrations/`).

## Release notes

The v0.33.0 paragraph in `README.md`. In short: the attending is graded on their own calls, with stars capped by patients seen
(30/24/18 a shift, 5/4/3 in the Rush; the owner, Nov 28); no answers given away on regular shifts; patients the charge nurse puts on
the attending's list wait, worsen and move on; Rush pace cap for the charge nurse; career rank; crash guard and safe saves; initials
only for class results; larger text and controls on menus and cards.

## Review

QA (Stage 15a) rounds 1 to 7: all FAIL; the owner stopped the loop after round 7 (`spec/QA-REPORT.md`). Round 13, six reviewers on
the whole release diff; every Critical and High re-checked by a second agent and fixed (`docs/audit/round13/STATUS.md`,
`verification.md`). Drift check: 17 mismatches, none Critical, all fixed (`docs/audit/round13/drift-check.md`).

## CTO memo (Nov 28, 2026, at 1f79199)

Full text: `docs/audit/round13/cto-memo.md`.

- **Behind the gate, to testers: GO WITH CONDITIONS.** **With real students: NO-GO** (no clinician review, F-034; the round-7 QA
  FAIL not re-graded; F-136 to F-144 not signed off). The gate stays on.
- Evidence (checked by the CTO agent): npm test 800 ok, lint clean, a clean rebuild byte-identical, stress 188 shifts in range, no
  database change, the merge into `main` clean; idle and radio-only attendings 0 stars in 40 of 40 new-seed shifts.
- **Conditions before the merge into `main`:**
  1. Tests green on `3d` at the exact commit merged.
  2. `docs/SMOKE.md` on a phone: an iPhone in Safari, Class code on two devices, the 3D floor, the sideways list board.
  3. The owner's written sign-off on F-136 to F-144 by ID (F-136, rude initials, needs an explicit decision).
  4. The owner's call on drift #1: an incoming alert still shows its type ("SEPSIS", "STEMI") to the attending.
  5. Paperwork (done: this file, `spec/STATUS.md`, `spec/FINDINGS.md`).
  6. Optional: a short R5/R6 recheck of the fixes made after the reviewed commit, or the owner counts them as bug fixes.
- Top risks: grading feels harsh or misleads a debrief (testers, class results; fix forward); Safari and sideways layouts (WebKit
  job, testers; roll back by revert); rude initials in class results (instructor deletes; a server rule needs a migration).

---

# Release v0.32.0: the high-priority clinical content (audit Phase 3)

- **Version:** 0.32.0 (new content, no change to saves; class codes from v0.31.0 read as stale, by design).
- **Commit to release:** the head of `3d` once the Tests workflow is green at that exact commit.
- **Replaces:** v0.31.0 on `main` (`0c999de`).
- **Database:** no change. The live fingerprint stays `412d46546a658d71b239631b3f119ba7`.

## Release notes

- First orders get room for the complaint (chest pain, shortness of breath, belly pain, headache, weakness): the standard workup
  is never counted as extra on the first sheet, but isn't a clean set, and no opioid on a pressure under 90.
- Strokes vary: in the window, late, woke up with it, or on a blood thinner. Only an eligible stroke has a door-to-needle goal;
  an ineligible one's pressure is left under 220/120 unless it is a large-vessel stroke going for clot removal.
- HEART, CURB-65 and ABCD2 add up from the patient's own parts, listed on the card.
- Drug keys: asthma steroid, anaphylaxis IM epinephrine, TXA, COPD steroid and antibiotic, admitted pneumonia combination,
  septic shock two antibiotics (cefepime accepted) and norepinephrine, DKA potassium, low-risk TIA home or observation.
- Orientation, lessons and explanations teach the new keys. `docs/clinical-sources.md` lists the guidelines.

## Review

Round 12, six reviewers on the whole release diff (owner's rule, Nov 26, 2026); every Critical and High re-checked and fixed
(`docs/audit/round12/STATUS.md`). Drift check: README, CLAUDE.md and the brief match the code after the round-12 edits.

## CTO memo (Nov 26, 2026)

- **Behind the gate, to testers: GO.** **With real students: NO-GO** until a licensed clinician reviews the content as a whole
  (F-034, now Partly: three questions answered). The gate stays on.
- Evidence: npm test (all ok), stress (188 shifts, vitals in range), Orientation in both roles, the changed lessons, ui, md_ui,
  class and events tests green; build matches source; no database change, so the deploy's live check is unchanged.
- Conditions: Tests green on `3d` at the merged commit. The phone check (`docs/SMOKE.md`) is the owner's call; he released
  v0.31.0 without it.
- Top risks: scoring that misleads a debrief on a stroke or a gray-zone call (fix forward); rollback by revert.

## Rollback

`git revert -m 1 <merge commit>` on `main` and push: the deploy republishes v0.31.0. No database step.
