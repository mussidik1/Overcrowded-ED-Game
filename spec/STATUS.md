# Pipeline status

- **Project:** Emergency Department: Code Black. **Mode:** adopted mid-project at v0.31.0 (owner's choice, Nov 25, 2026): the
  ship stages now, the full spec (Stages 0–7, traceability) before the next feature work.
- **Current stage:** 15–17 for v0.31.0 (QA, drift check, CTO review).

| Stage | Result | Notes |
|---|---|---|
| 0–7 Define, design | Not run (retrofit after release) | `CLAUDE.md`, `README.md`, `docs/PRO_AUDIT.md`, `supabase/README.md` stand in for intake, spec and architecture. |
| 10 Automated gates | PASS at 405f4bc; pending at 04a1c0b | CI on `3d`: build matches source, `npm test` (720), stress (188 shifts), database rules on PostgreSQL 17, Chrome UI tests. |
| 11–14 Reviews | PASS | Audit rounds 6–11, six hostile reviewers each, serious findings independently re-run; `spec/FINDINGS.md`. |
| 15 QA | Skipped by the owner (Nov 25, 2026) | The owner chose to release without the phone check; testers only, behind the gate. |
| 16 Drift check | PASS after fixes | Fresh agent found 9 mismatches (0 Critical, 1 High in docs, 3 Medium, 5 Low): all fixed in text or code, none needed a migration. F-039 to F-047. |
| 17 CTO review | GO WITH CONDITIONS (testers); NO-GO (students) | Memo below. |
| 18 Publish | In progress | Merged into `main` (`aa308d1`); the first deploy stopped at the forged-header probe (Cloudflare refuses forged headers: a check fix, `85a3d0d` on `3d`). Nothing published yet. |

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

**Next action:** the owner: conditions 1–4 above, then "release". The owner has said he is not ready to release.
