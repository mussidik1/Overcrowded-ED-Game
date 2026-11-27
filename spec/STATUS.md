# Pipeline status

- **Project:** Emergency Department: Code Black. **Mode:** adopted mid-project at v0.31.0 (owner's choice, Nov 25, 2026): the
  ship stages now, the full spec (Stages 0–7, traceability) before the next feature work.
- **Pipeline addendum (Nov 26, 2026):** `spec/PIPELINE-ADDENDUM.md` applies and wins where it conflicts with the older pipeline. The builder never signs off on its own work. `spec/QA-RUBRIC.md` thresholds approved by the owner (Nov 26). `spec/00-INTAKE.md` and `spec/02-SPEC.md` retrofitted from the README and CLAUDE.md (owner's choice) so Stage 15a has REQs. Stage 15a round 1 on v0.32.0 as released (owner's choice): **FAIL** (Functionality 7/8, Visual design 5/7, Clinical safety 8/10; no Critical or High bug; 8 Medium, 14 Low: F-048 to F-069). `spec/QA-REPORT.md`. Round 2 (Nov 27, v0.33.0 candidate): **FAIL** (Functionality 7/8, Visual design 6/7, Clinical safety 9/10; 1 High: QA2-1; F-070 to F-081). Round 3 (Nov 27, v0.33.0 candidate): **FAIL** (Functionality 7/8, Clinical safety 9/10; Visual design now passes at 7; no Critical or High; F-082 to F-094). Third failed round: stopped for the owner, per the addendum. Round 4 (owner's choice; Nov 27): **FAIL** on Clinical safety only (9/10); the other five pass (Functionality 8/8, Visual design 7/7); no Critical or High; F-095 to F-108. Round 5 (owner's choice): **FAIL** (Functionality 7/8, Clinical safety 9/10; no Critical or High; F-109 to F-121). Round 6: **FAIL** (2 High: QA6-1, QA6-2; Functionality 7/8, Product depth 6/7; Clinical safety 10/10 passes; F-122 to F-133). Round 7: **FAIL** (1 High: QA7-1; Product depth 6/7, Visual design 6/7; Functionality 8, Clinical safety 10 pass; F-134 to F-144). Stopped for the owner.
- **Current stage:** v0.32.0 released (Nov 26, 2026): `main` at `78916ef`, Deploy run 4 green. v0.31.0 history below; v0.32.0 in `spec/RELEASE.md`.

| Stage | Result | Notes |
|---|---|---|
| 0–7 Define, design | Not run (retrofit after release) | `CLAUDE.md`, `README.md`, `docs/PRO_AUDIT.md`, `supabase/README.md` stand in for intake, spec and architecture. |
| 10 Automated gates | PASS at 405f4bc; pending at 04a1c0b | CI on `3d`: build matches source, `npm test` (720), stress (188 shifts), database rules on PostgreSQL 17, Chrome UI tests. |
| 11–14 Reviews | PASS | Audit rounds 6–11, six hostile reviewers each, serious findings independently re-run; `spec/FINDINGS.md`. |
| 15 QA | Skipped by the owner (Nov 25, 2026) | The owner chose to release without the phone check; testers only, behind the gate. |
| 16 Drift check | PASS after fixes | Fresh agent found 9 mismatches (0 Critical, 1 High in docs, 3 Medium, 5 Low): all fixed in text or code, none needed a migration. F-039 to F-047. |
| 17 CTO review | GO WITH CONDITIONS (testers); NO-GO (students) | Memo below. |
| 18 Publish | Done (Nov 26, 2026) | Live behind the gate: `main` at `0c999de`, Deploy run 3 green (live database checks, publish, live-site checks). |

## CTO memo (Stage 17, Nov 25, 2026, at 04a1c0b)

- **Behind the gate, to testers: GO WITH CONDITIONS.** **With real students: NO-GO** until a licensed clinician reviews the
  clinical content (F-034). Keep the gate on.
- Evidence: npm test, stress and db:test re-run green; a clean rebuild matches the committed build byte for byte; migration
  hashes match; 0 Critical; every High fixed and checked in code.
- **Conditions before the merge into `main`:**
  1. Tests green on `3d` at the exact commit merged (owner checks).
  2. `docs/SMOKE.md` in full on a phone, at least one iPhone in Safari, the Class code section on two devices, and the 3D floor.
  3. The owner's written sign-off on F-034, F-035 and F-036 by ID. For F-036: run the WebKit job by hand on `3d` first, or accept
     that its last result (v0.30.0) is red.
  4. A short targeted re-review (R5 and R6) of the post-review scoring changes F-042 and F-044 and the key lifetime F-041, or the
     owner records that he counts them as bug fixes.
- Top risks after release: the iPhone engine (F-036; WebKit report on merge, testers; roll back by revert); scoring that misleads
  a debrief (open Lows; fix forward); the database (daily watch, the deploy's fingerprint check; fix by a new migration).

**Open findings:** none Critical/High open. Accepted risks pending the owner's sign-off: F-034, F-035, F-036.

**Next action:** v0.32.0 is released (Tests run 71 green on `3d` at `f3a40f3`; Deploy run 4 green). Next: Phase 4 small items, Phase 6 quick wins, Phase 7 Lows.
