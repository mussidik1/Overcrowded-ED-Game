# Round 11: the release review of v0.31.0 (Nov 25, 2026)

Six reviewers read `e3fbeec`, with both migrations live. Scores: R1 6, R2 7, R3 6, R4 7, R5 7, R6 5. Verdicts: five would ship
behind the gate (two after small fixes); R6 would not ship to students until a licensed clinician reviews the clinical content,
which is unchanged since v0.30.0. Every serious finding a checker re-ran (9 of 11) reproduced.

## Needs the owner

- **Apply migration 3** (`supabase/migrations/20261125180000_codeblack_round11.sql`) once the Tests workflow is green on `3d`.
  It is ASCII with no `\u` escapes, so the Supabase tool can't change it. The deploy requires it before v0.31.0 publishes.
- **The phone check** (`docs/SMOKE.md`), then "release".
- **A licensed clinician's review** (R6's verdict): unchanged, the owner's call.

## Fixed

- **Held-code takeover (R1.11-01, R2.11-01, R3.11-01; migration 3).** Releasing the newest held codes let a flood made *before*
  a planned code free it for someone else in two calls. Now no held code is released early: past 30,000 held, a new code is
  `full`. `privacy_test.sql` floods 30,001 older codes and checks the planned code stays "taken" to another key.
- **The name rule's spaces weren't covered by the fingerprint (R1.11-02).** Migration 3 hashes function bodies exactly. The live
  `clean_name` was already checked exact after its repair (md5 `f8adf6a0…`, `supabase/applied/2026-11-25.md`), and
  `db_live.js` now sends a two-word name ("Ana Maria") that must pass the name rule.
- **A late hand-off erased an unrun arrest (R6.11-01 High).** A lost code on the attending's own patient that started 5 or more
  minutes after the arrest brings the M&M line and legal risk, whoever ran it.
- **Started in the last seconds, an old arrest escaped (R6.11-02).** An own arrest whose code started 5+ minutes late, still
  running at the end, gets an M&M line and legal risk (`codeLate`).
- **"By the book" for codes the student didn't run (R6.11-03).** Only the attending's own code, every check right, started
  within 5 minutes. Another doctor's prompt code is no one's fault and is counted apart (`handed`); the verdict says so.
- **3 minutes was a few real seconds (R5.11-01).** Prompt is now within 5 game minutes (`BOOK_WAIT`); the labels say so.
- **Focus fell to the page after a delete answered (R4.11-01).** It returns to the results heading.
- **Text (R2.10-01, R2.11-03):** the privacy lists no longer name a number the game doesn't send; the planned-code promise says
  "on this version of the game"; "nobody else can take it" is qualified. **R2.11-02:** the runbook says a migration with `\u`
  escapes must be pasted, and the round-6 repair is recorded in `supabase/applied/`.

## Left

- Lows and nitpicks in the reports. The WebKit (Safari engine) CI job hasn't run on v0.31.0: it runs on a merge into `main`,
  or by hand (macOS minutes).
