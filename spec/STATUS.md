# Pipeline status

- **Project:** Emergency Department: Code Black. **Mode:** adopted mid-project at v0.31.0 (owner's choice, Nov 25, 2026): the
  ship stages now, the full spec (Stages 0–7, traceability) before the next feature work.
- **Current stage:** 15–17 for v0.31.0 (QA, drift check, CTO review).

| Stage | Result | Notes |
|---|---|---|
| 0–7 Define, design | Not run (retrofit after release) | `CLAUDE.md`, `README.md`, `docs/PRO_AUDIT.md`, `supabase/README.md` stand in for intake, spec and architecture. |
| 10 Automated gates | PASS | CI on `3d`: build matches source, `npm test` (720), stress (188 shifts), database rules on PostgreSQL 17, Chrome UI tests. |
| 11–14 Reviews | PASS | Audit rounds 6–11, six hostile reviewers each, serious findings independently re-run; `spec/FINDINGS.md`. |
| 15 QA | Pending | The owner's phone check, `docs/SMOKE.md`. |
| 16 Drift check | PASS after fixes | Fresh agent found 9 mismatches (0 Critical, 1 High in docs, 3 Medium, 5 Low): all fixed in text or code, none needed a migration. F-039 to F-047. |
| 17 CTO review | Running | Fresh agent: GO or NO-GO memo. |
| 18 Publish | Waiting | Needs the owner's "release". |

**Open findings:** none Critical/High open. Accepted risks pending the owner's sign-off: F-034, F-035, F-036.

**Next action:** drift check and CTO memo; then the owner's phone check, sign-off on F-034–F-036, and "release".
