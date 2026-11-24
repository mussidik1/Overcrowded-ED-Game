# Round 2: what was fixed, what waits, what the owner waived (Nov 24, 2026)

Round 2 re-reviewed v0.30.0 after Phase 0 and Phase 1. The six reports are in this folder. The fixes are in the commits after `49aea94`
(`git log 49aea94..HEAD`): "round-2 review fixes", "round-2 player review fixes" and "stop tracking a node_modules symlink".

## Fixed in round 2
- **Clinical (R6.2):**
  - 01 to 06, 08 to 14
  - Lows 15, 16, 17, 24, 25, 26
  - 07: the README now says the reviewers were AI, and that no licensed clinician has reviewed the content.
- **Game tech (R3, R3.2):** R3-08 (a dropped class save now says why), 3.2-01, 02, 03, 04, 05, 06, 08.
- **UI (R4.2):** 01, 02, 03, 04, 05, 07, 08, 09.
- **Player (R5.2):** 01, 02, 03, 04, 05.
- **Architecture (R1.2):** 01 (in part: golden now fingerprints behaviour, and the content is checked by rules12 and lintCode), 02, 04, 05, 06, 07, 08.
- **Tooling (R2.2):** 01 and 02 (in part, as R1.2-01), 03, 06 (pages.yml now checks the live site after deploying).

## Waits for a later phase (see docs/PRO_AUDIT.md section 7)
- **Phase 2, security and privacy** (needs the owner's database approval):
  - R3-01, R3-02, R3-03 (= R1-05, R2-07), R3-13, R3-14, R3-15
  - R3.2-07, the cheat surface on `window.OC`
- **Phase 3, High clinical:**
  - R6-09, R6-11 to R6-20, R6-02 (every stroke still arrives in the window)
  - the open clinician questions
  - R6.2-18 to R6.2-23
- **Phase 4, foundation:**
  - R1-04 = R3-04 (one exception freezes the game), R1-07 (save versioning), R3-05 (WebGL context loss), R5-06 (3D keeps drawing when off)
  - R2-03 to R2-05 (CI on PRs, LICENSE, lint and types)
  - R2.2-04 (UI tests play a random shift; ui_test can fail one check by chance)
  - R1.2-03 (events can differ between players on one class code)
- **Phase 5, structure:** R1-01 to R1-03 and the Medium architecture items.
- **Phase 6, UI and design:**
  - R4-01 to R4-08, R4.2-06
  - R5-03, R5-04, R5-05, and the code's 15-minute idle and quiz feel (R5.2 Mediums)

## Waived or decided by the owner
- **Clinician sign-off before merging to main (R2.2-05, R6.2-07):** the owner said on Nov 24, 2026 that a clinician will look later. The README and CLAUDE.md say no licensed clinician has reviewed the content.
- **Hardening the password gate (R2-22, R3-07):** rejected; the gate is deleted at launch.
- **The by-hand phone smoke checklist (docs/SMOKE.md):** Claude can't run it on a real phone. The automated equivalents (Chrome UI suites, both Orientations, all 32 lessons, finger tests) pass. The owner runs the phone checklist.
- **WebKit (Safari's engine):** runs in CI only on `main` (report only), so v0.30.0 is first tested in WebKit by the merge.
