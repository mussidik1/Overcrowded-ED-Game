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
