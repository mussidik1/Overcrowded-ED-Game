# Release v0.31.0: private class results

- **Version:** 0.31.0 (semantic: new features, no breaking change to saves; class codes from v0.30.0 read as stale, by design).
- **Commit to release:** the head of `3d` once the Tests workflow is green there (now `405f4bc`).
- **Replaces:** v0.30.0 on `main` (`815e279`).

## Release notes

- **Class results are private.** Making a class code registers it with a private instructor key, kept on that device. Only that
  key opens or deletes the code's results. Students see no names. Results are unranked, carry each student's own numbers, and are
  marked not for grading.
- **Retention.** A class lasts 14 days until its first result, then 30 days from when it was made; its results are then deleted
  and its code held 30 more days for its key. A planned code's first result in that hold starts it again.
- **Sending.** First name or initials only, checked on both sides; a summary can't be sent twice or lost by a reload.
- **Attending scoring.** Required drugs in combinations must be ordered; a set with a harmful drug isn't "clean"; lost codes are
  "by the book" only when the student ran them right and in time; unrun or late arrests at the end cost points, legal risk and
  an M&M line. Patient flow and the charge nurse's game are unchanged.
- **Accessibility.** The class sheet works by keyboard and screen reader; text boxes are 16 px; tap targets 44 px.
- **Behind the scenes.** The database is in the repo with three frozen migrations, a fingerprint the deploy checks against the
  live project, per-network rate limits by a daily-salted hash, a daily watch, and tests on PostgreSQL 17 in CI.

## Database

All three migrations are applied to the live project and frozen in `supabase/migrations/applied.sha256`
(`supabase/applied/2026-11-25.md`). The live fingerprint `412d46546a658d71b239631b3f119ba7` matches `supabase/tests/fingerprint.json`.
Nothing more is applied at release.

## Release steps

1. Tests green on `3d` at the commit; the owner's phone check (`docs/SMOKE.md`); the CTO memo says GO; the owner says "release".
2. Merge `3d` into `main` with `--no-ff`; push. The deploy re-runs the build check, tests, stress, the database rules on
   PostgreSQL 17 and `class_test.py`, checks the live database (`test/db_live.js`), publishes, and checks the live site.
3. Tag `v0.31.0` on the merge commit.
4. Confirm edcodeblack.com serves v0.31.0, the gate still shows, Send and Class results work on a test code.
5. Republish the private Claude copy (`tools/pack3d.js`) and note the release in the owner's status doc.

## Rollback

- **Game:** `git revert -m 1 <merge commit>` on `main` and push; the deploy republishes v0.30.0. The live database stays as it
  is (a database ahead of the game passes the deploy's check).
- **What breaks on rollback:** v0.30.0's Send and Class results don't work against the new database (they used the old open
  table, which migration 1 removed). The gate is on and nobody uses them yet, so the impact is testers only.
- **Database:** migrations aren't rolled back. A fix goes in a new migration.
- **Supabase down during a rollback:** run the Deploy workflow by hand with `skip_db_check` and a reason.

## Known limits (accepted risks, `spec/FINDINGS.md`)

F-034 (no clinician review yet), F-035 (results-off fallback when full), F-036 (WebKit not yet run on v0.31.0), F-037, F-038.
