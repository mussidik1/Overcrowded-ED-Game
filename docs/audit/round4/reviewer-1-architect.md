# Reviewer 1, round 4: Senior Software Architect

Review of Phase 2 (private class results) on branch `claude/sleepy-rubin-jot35n` at v0.31.0, HEAD `ce11887`, Nov 24, 2026.
- **Scope:** `git diff 101e07a..ce11887`: `supabase/`, `src/ui.js`, `src/style.css`, `test/class_test.py`, `test/db_live.js`, `test/audit_shots.py`, both workflows, and the docs.
- **Changes to the repo:** none, except this file.
- **Where the work ran:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round4/r1/`:
  - `repo/`: a clone, rebuilt there. The rebuilt `index.html` matches the committed one.
  - `pg/`: scripts for my own throwaway Postgres 16 cluster (`up.sh`, `q.sh`, `down.sh`).
  - `probe.py`, `probe2.py`, `probe3.py`: Playwright probes of the class-results client. The server is stubbed, and nothing leaves the machine.
  - `routeglob.py`: a Playwright glob check on a stand-in host.
- Nothing contacted supabase.co or edcodeblack.com.

## 0. Status of my earlier findings

| Finding | Status | Evidence |
|---|---|---|
| **R1-05** Backend contract not in version control | **Partly fixed** | **Fixed:** the schema, grants and functions are in `supabase/migrations/`. `npm run db:test` passes 119 checks in 2 s, and a CI job runs it. The resend on any HTTP 400 is gone (`ui.js:2480-2498`). **Still open:** the URL and key are still hard-coded twice, and now a regex reads them back (R1.4-11). Nothing records what is applied live (R1.4-03). The change can't be rolled back (R1.4-01). |
| R1-07 (deferred to Phase 4) Persistence has no versioning | **Worse** | Two more unversioned stored formats: `oc-ckeys`, which holds a credential, and `cid`/`sent` inside `oc-last-report` (R1.4-14). |
| R1.3-13 Growth and process | **Still open** | `c941ede` is one 20-file, 1,225-line commit that closes eight findings. `ui.js` went from 2,896 to 2,985 lines. Lines over 300 characters went from 192 to 201. |
| R1.3-10 Public surface | Unchanged | `engine.js` isn't touched by this diff. `window.OCUI.U` now also holds the instructor key in memory (`U.reg.key`, `U.cbList.key`); that is R3's area. |
| R1.3-01 to 09, 11, 12, 14 | Not touched | `engine.js` is identical at both ends of the diff. |

## 1. Verdict

The database is in the repo now, and its SQL passes its own tests. Nothing around it is managed:
- **Release order:** the client and the database go out in no written order. A single migration both adds the new API and removes the old one, and there is no staging backend.
- **Rollback:** the documented rollback leaves class results dead.
- **Drift:** nothing records what is applied live, and nothing would notice a change.
- **Contract:** no test sends the game's real request to the real functions.
- **Registration:** registering a code isn't idempotent, so a slow answer leaves a live class nobody can open, and students are told their result reached the instructor.

The team's own baseline says production Send has been broken since Nov 24. The cause is exactly what R1-05 warned about: a database change made outside the repo. Nothing added in this phase would catch the next one.

Do not merge to `main` until R1.4-01, 02, 05 and 06 are fixed.

## 2. Score

**4 / 10** (round 3: 3). This phase added a real, reproducible database test bed where there was none. It also added a release process that can't be ordered, gated or rolled back, and a client whose failure paths lie to both the student and the instructor.

## 3. New findings (worst first)

### R1.4-01 · High · The client and the database ship with no order, no compatibility window, no gate and no rollback
- **Where:**
  - `20261124120000_codeblack_private_results.sql:286-290` drops `public.cb_results` and `cb_class(text)` in the same transaction that adds the new API.
  - In `pages.yml`, `actions/deploy-pages` (`:55-56`) publishes first; `node test/db_live.js` (`:92-93`) runs after.
  - `pages.yml`'s build job runs no `db:test`.
  - `src/ui.js:2018` is the only backend: production.
  - CLAUDE.md's "Rolling back".
  - `docs/SMOKE.md`'s new class-code steps.
  - `supabase/README.md`'s "Changing the database".
- **What's wrong:**
  - **Add and remove in one step.** The migration adds the new API and removes the old one together, so whichever lands first breaks class results for the other version:
    - v0.31.0 against today's database gets HTTP 404 from `cb_class_new` and shows "Couldn't reach the server" (R1.4-10).
    - After the migration, v0.30.0 gets 404 on `cb_class` and on `POST /cb_results`. Every player's service worker keeps serving v0.30.0 for a while after a deploy.
  - **No order is written down.** CLAUDE.md's "Before a merge into main" and the four steps in `supabase/README.md` never say whether the migration or the merge goes first.
  - **No staging backend.** `CB` is the production project. SMOKE.md's new Send and Class results steps, run on a phone before the merge, can only pass after production is migrated.
  - **The live check can't stop a release.** `db_live.js` runs after the site is published, so it can turn the run red but can't prevent the deploy. The deploy doesn't run `db:test` and doesn't wait for the Tests workflow.
  - **The documented rollback is wrong after this migration.** CLAUDE.md says `git revert -m 1` "republishes the previous version". But:
    - after this migration, the previous version's endpoints are gone;
    - there's no down migration;
    - v0.30.0's `pages.yml` has no database step (`git show 101e07a:.github/workflows/pages.yml`), so the rolled-back deploy finishes green with class results dead.
  - **In fairness:** the old table has no rows, and v0.30.0's Send is already broken (R1.4-02), so this release loses little. The harm is the process every later migration will copy.
- **Fix:**
  - Split the migration in two. First, add `codeblack` and the four functions and leave the old objects in place. Later, drop the old objects once the new client has been live for a week.
  - Write the order in CLAUDE.md: apply the first migration, run `db:live`, merge, wait, apply the second.
  - Move the database check before `deploy-pages`, as a gate that checks the new client's functions answer.
  - Give each migration a rollback note or a down file.
  - Make the backend URL a build setting, so a second free project or a local PostgREST can serve smoke tests.
- **Effort:** M

### R1.4-02 · High · Production Send has been broken since Nov 24, and the only record is a SQL comment
- **Where:**
  - `20261124000000_codeblack_baseline.sql:73-77`.
  - The live client's old `cbSend` (`git show 101e07a:src/ui.js`, around line 2410) retries only on HTTP 400.
- **What's wrong:**
  - **The outage.** According to the baseline, a migration applied to the live project on Nov 24 added the `ver` column without an insert grant. The live v0.30.0 client sends `ver`. PostgREST refuses it with 401, and the client retries only on 400, so every Send on the live site fails.
  - **Round 2's assurance was false.** The round-2 BRIEF said the client "works with or without" that migration.
  - **It's R1-05's failure.** A database change made outside the repo silently broke production.
  - **It isn't surfaced.** It appears only in a SQL comment and in the commit message: not in `docs/audit/round3/STATUS.md`, the README or SMOKE.md.
  - **No hotfix was offered.** The one-line fix (`grant insert (ver) on public.cb_results to anon, authenticated;`) wasn't put to the owner separately. It waits inside a 295-line migration that needs the same approval.
  - **Not verified here:** supabase.co is blocked from this container, so this finding rests on the team's own record.
- **Fix:**
  - Offer the owner the one-line grant now, on its own.
  - Record the outage in the status doc.
  - Run `db_live.js` on a schedule (R1.4-03), so the next breakage shows up within a day.
- **Effort:** S

### R1.4-03 · Medium · Nothing records what is applied to the live project, and nothing would notice drift
- **Where:** `supabase/README.md` "Changing the database", `test/db_live.js`, and the migration file names.
- **What's wrong:**
  - **No ledger.** One documented way to apply a change is pasting it into the SQL editor, which records nothing. The other is approving the MCP `apply_migration` call, which records it under its own name and a server-made version, not the file's `20261124120000`. No query can answer "which repo migrations are on live?".
  - **CLI-style names, no CLI.** The files use the Supabase CLI's naming, but there's no `supabase/config.toml`. The live history also holds Case Room's migrations and Code Black's old ones; the baseline's header names some of them. So `supabase migration list` or `db push` can never line up, and the naming promises a tool the process can't use.
  - **The live check runs only at deploy.** Drift between deploys, like the Nov 24 change, waits for the next release.
  - **Its probes are negative only.** It never registers, sends or reads. It never calls `cb_class_new`, the first call every instructor makes.
  - **It can't see:**
    - the function bodies or the rate-limit numbers;
    - grants to `authenticated`;
    - whether the `codeblack-tidy` cron job exists, so the 30-day deletion promise on the About page rests on an unmonitored job.
  - **Its first check is vacuous** (`db_live.js:22`). It accepts 401, which the old table already returned (anon had no select grant), so it passes before and after the migration.
  - **The record leaves out the extensions the chain needs:** pgcrypto in `extensions`, and pg_cron. The private migration fails at its last line (`cron.schedule`) on a project without pg_cron.
- **Fix:**
  - Add a `codeblack.applied (id text primary key, sha256 text, at timestamptz)` table, and have each migration insert its file name and hash.
  - Expose `cb_version()` (the latest id and hash) and `cb_health()` (classes more than 2 hours past expiry, and whether the cron job exists).
  - Have `db_live.js` compare `cb_version()` with the repo's latest file, and run it daily as a scheduled workflow.
  - Drop the 401 alternative.
  - Probe `cb_class_new` with an invalid code: it must answer `invalid` and store nothing.
- **Effort:** S to M

### R1.4-04 · Medium · The baseline sits in `migrations/`, runs without complaint on a migrated database, and reopens the leak
- **Where:**
  - `20261124000000_codeblack_baseline.sql`: the whole file, with no `begin`/`commit` and no guard.
  - `supabase/README.md` step 1.
  - `supabase/tests/run.sh:22-23`.
- **What's wrong:**
  - **Mixed signals.** The header says "A record, not something to run on the live project". The folder, the file name and `run.sh` all treat it as migration number one.
  - **Reproduced:** on my own cluster, I applied both migrations, then ran the baseline again.
    - It succeeded with only NOTICEs.
    - It brought back `public.cb_results` (with anon column-insert grants), the open `cb_class(text)`, and both trigger functions.
    - As `anon`, I inserted a row named "Mallory Full Name" and read it back with `cb_class('AAA-AAA')`, by code alone.
  - **It overwrites another app's code.** It replaces `caseroom.client_ip()`, Case Room's live function, with this repo's copy.
  - **It breaks the folder's own rule 1** ("Wrap it in begin; ... commit;").
  - **"Safe to run twice" is never tested for the chain.** `run.sh` re-runs only the latest file.
  - **The row guard is untested.** The private migration's guard (`:22-27`) works: I put one row in the table, and it refused and rolled back. But no check in `privacy_test.sql` exercises it.
- **Fix:**
  - Move the record out of `migrations/` (for example to `supabase/baseline/`), or make its first statement refuse when `codeblack.classes` exists.
  - Make `run.sh` apply the whole chain twice.
  - Add a check that the guard refuses a table that has a row.
- **Effort:** S

### R1.4-05 · Medium · No test anywhere sends the game's request to the real functions
- **Where:**
  - `test/class_test.py:37-41, 91-95, 127-133`: the stubs accept any body.
  - `supabase/tests/privacy_test.sql`: its own payloads, in SQL, without PostgREST.
  - `test/db_live.js:33`: a third payload, with `p_stats: {}`.
  - `codeblack.stats_ok` (migration `:159-171`).
  - `src/ui.js:2489-2493`.
- **What's wrong:**
  - **Three layers, three payloads, no contract.**
    - The game's real request is checked only by a Python stub that never validates it.
    - The SQL is checked only with hand-written arguments.
    - The live check uses a third payload.
  - **The contract is strict where it hurts.** `stats_ok` refuses any key it doesn't know. Reproduced on my cluster:
    - The exact payload `class_test.py` captured from the game, passed to `cb_submit` by named arguments as PostgREST does, returns `{"ok": true}`.
    - The same payload with one more stat (`"rosc"`) returns `{"error": "invalid"}`.
  - **All three test suites stay green through that drift.** Players would be the first to find it.
  - **Then the game blames the student.** For `invalid` it shows "Check your name: letters only." (`ui.js:2493`, confirmed in `probe.py` F). But `cbClean` already enforces the server's name rule, so a server `invalid` is almost never about the name.
  - **The rules exist twice, in different engines:**
    - the name rule (R1.4-16);
    - the code alphabet, in 7 places across JS, SQL and the tests;
    - key normalization (`cbKeyNorm` and `norm_key`);
    - the stats keys and ranges (the client clamps to the server's numbers by hand).
- **Fix:**
  - Add one contract test. Move the payload builder out of `ACT.cbSend` into something Node can load, and feed its output to the SQL functions with named arguments inside `db:test`.
  - Better: run PostgREST against the throwaway cluster in CI, and point `class_test.py` at it.
  - Make the server ignore unknown stats keys.
  - Have `invalid` say which field failed.
- **Effort:** M

### R1.4-06 · Medium · Registering a code isn't idempotent: a slow answer leaves a live code with no key, and both sides get false messages
- **Where:** `src/ui.js:2047-2057` (`cbRegister`), `2058-2062` (`cbRegHTML`), migration `:192-206` (`cb_class_new`).
- **What's wrong:**
  - **Inconsistent design.** `cb_submit` got a client-made id so a retry is harmless. `cb_class_new` didn't. If the server commits but its answer misses the 8-second limit, the key exists only in the lost response.
  - **Reproduced with a held route** (`probe2.py`):
    - After 9 s the sheet says "Class results are off for this code … The code still works for playing; students just can't send you their results." Copy, Share and Play it are still on screen.
    - If the server did commit, students can send. Each is told "Sent to the instructor … Only they can see it", for a class nobody can open for 30 days.
    - "Try again" sends the same code, gets `taken`, and silently swaps the code on screen (`T0C-09H` to `GHK-898`).
  - **The same swap on a first `taken`.** It also happens on a first-try `taken` after the code was already shown with a Copy button (`probe.py` E: `SD3-G1N` to `413-81X`).
  - **A second code drops the first key.** Making a second code while the first is still registering loses the first key: two codes are registered and one key is kept (`probe.py` D). The guard at `ui.js:2050` throws the answer away.
- **Fix:**
  - Make the key on the device and send only its SHA-256. `cb_class_new(p_code, p_key_hash, p_ver)` then becomes idempotent (the same code and hash answer "ok"), and the key never crosses the network.
  - Hide Copy and Share until registration settles.
  - Save any key that arrives, even for a code no longer on screen.
- **Effort:** S

### R1.4-07 · Medium · Browsing the sheet registers codes, spends the school's quota, and pushes real codes out of reach
- **Where:**
  - `src/ui.js:2466-2469`: `codeMake` registers on every tap.
  - `src/ui.js:2083`: `mine.slice(0, 8)`.
  - `src/ui.js:2501-2506`: a typed code ignores keys stored on the device.
  - Migration `:197, 217, 250, 268`: the per-network limits.
- **What's wrong:**
  - **Every tap writes to the server.** Tapping the four shift buttons to compare them registers four codes and stores four keys (`probe.py` A). Each `taken` retry is another write.
  - **A school is one network.** The limits count per network, so behind one school NAT:
    - 20 new codes an hour are shared by every instructor;
    - 200 sends an hour, though a class can hold 300;
    - 120 reads an hour.
  - **Only 8 codes are listed.** With 9 keys stored, the oldest isn't listed.
  - **Typing it doesn't help.** Typing that code alone answers "An instructor key is 16 letters and numbers, from the device that made the code" on the very device that made it and holds the key (`probe.py` B).
- **Fix:**
  - Make the code locally, and register it only on an explicit step: "Use this code", or Copy, Share or Play.
  - Look a typed code up in `oc-ckeys` before asking for a key.
  - List every stored code, or add a "more" row.
  - Set the per-network send limit at least as high as the per-class cap.
- **Effort:** S

### R1.4-08 · Medium · A live class becomes unreadable by typing its code after two releases, because the shift checksum gates the results path
- **Where:** `src/ui.js:2504` (`E.readCode` gates the typed path), the engine's `readCode`/`setCodeVersion`, and CLAUDE.md ("PAST_V holds only the version just before this one").
- **What's wrong:**
  - **Two different windows.** The server keeps a class for 30 days and accepts any well-formed code. The typed results path first runs the code through `readCode`, whose checksum is salted with the game version and accepts only the current version and the one before.
  - **Reproduced:** I made 200 codes at v0.31.0 and set the version to v0.33.0. One in 200 still read: that's the 1-in-64 accident.
  - **Releases here are days apart.** v0.30.0 to v0.31.0 took a day. An instructor on a second device loses the typed path well inside the 30 days.
- **Fix:** the results path checks only the format (alphabet and length), as `codeblack.norm_code` does; the key is the authentication. Keep `readCode` for playing.
- **Effort:** S

### R1.4-09 · Medium · The rate limiter writes a row for every request, refused ones included, into a database shared with Case Room
- **Where:** migration `:117-126`. `codeblack.allow` counts, then inserts, then returns. The four functions return status JSON instead of raising, so the row is committed.
- **What's wrong:**
  - **A regression from the old design.** The old trigger raised an error, which rolled back its `cb_hits` row, so a refused insert left nothing. The new design commits a row for every call and keeps it 24 hours.
  - **Each call gets slower.** Every call counts all of that network's rows for the past hour.
  - **Measured on my cluster:** 20,000 refused `cb_class_read` calls from one address left 20,000 rows (2.4 MB, about 120 bytes each) and took 27 s, slowing as the rows grew.
  - **The free plan's ceiling.** At that size, the free plan's 500 MB database is about 4 million calls in a day: some 50 a second from one machine. A free project that goes over its size limit loses writes for every app on it, Case Room included. That last point is from Supabase's plan rules as I know them; I didn't check it here.
- **Fix:**
  - Keep one counter row per network, kind and hour (`insert … on conflict do update set n = n + 1`), and stop counting past the limit. Storage then grows with networks, not with requests.
  - Consider raising an error with a PostgREST status code instead (R1.4-10), so refused calls roll back.
- **Effort:** S

### R1.4-10 · Medium · Two error channels, and the client reads only one: every HTTP failure says "Couldn't reach the server"
- **Where:** `src/ui.js:2019-2027`. `cbFetch` throws `HTTP nnn`, and `cbNet` turns anything that isn't a timeout into "Couldn't reach the server". The four functions answer HTTP 200 with `{"error": …}`.
- **What's wrong:**
  - **PostgREST still fails over HTTP.** It answers:
    - 404 when the function is missing, which is exactly the state in R1.4-01;
    - 400 for a bad argument, for example a `p_cid` that isn't a uuid;
    - 401 when a grant has been revoked;
    - 5xx when the server fails.
  - **The client reads them all as a connection problem.** In `probe.py` C, 404, 400 and 500 all show the same text.
  - **Refusals are invisible in the logs.** Every refusal (`busy`, `full`, `key`, `invalid`) is an HTTP 200, so Supabase's API logs show success. There's no way to see refusal rates without reading the database.
  - **Two conventions in one client.** The gate's functions return bare booleans; the class functions return objects.
- **Fix:**
  - Map HTTP status codes to messages: "the class-results service isn't available" for 404 and 5xx; "update the game" for 400.
  - Either raise with PostgREST's `PT4xx` codes, so refusals show as 4xx in the logs, or count refusals in the ledger (R1.4-03).
- **Effort:** S

### R1.4-11 · Low · R1-05's config half is still open, and a third copy is now read by a regex
- **Where:** `src/ui.js:2018` (`CB`), `build.js:33` (the CSP's `connect-src`), `test/db_live.js:9-12` (a regex over `src/ui.js`), and `pages.yml:59-63` (which checks out `src/ui.js` into the deploy job to feed that regex).
- **What's wrong:**
  - The URL and key live in two source files, and `db_live.js` reads them back by regex from the source, not from the `index.html` it just deployed.
  - Reformat the `CB` line (double quotes, another key order, a line break) and the deploy fails.
  - If the build ever injects a per-environment URL, `db_live.js` will test the wrong project.
- **Fix:** keep one `supabase.json` (url and key), read by `build.js` (for both `CB` and the CSP) and by `db_live.js`. Or have `db_live.js` read `CB` from the deployed `index.html`.
- **Effort:** S

### R1.4-12 · Low · Test fidelity: a screenshot script writes to production, its "unreachable" stub doesn't match, and the new CI job has never run
- **Where:** `test/audit_shots.py:62` and `:109`, `test/class_test.py`, and `tests.yml:7-9`.
- **What's wrong:**
  - **A test that writes to production.** `audit_shots.py:62` taps `codeMake` with no `cb_class_new` stub. On any machine with a network (the owner's laptop, a CI runner), each of the four screen sizes registers a real class on production. It's harmless here only because this container can't reach supabase.co.
  - **A stub that doesn't match.** `:109` blocks `'**/supabase.co/**'`. Playwright's glob needs a "/" right before "supabase.co", but the real host is `ecpx….supabase.co`.
    - I checked the same pattern shape on a stand-in host (`routeglob.py`): not matched.
    - So the "can't reach the server" gate screenshot is right only because the sandbox has no network.
  - **class_test.py:**
    - It blocks nothing by default, so any call it doesn't stub goes to production.
    - Its stubbed `expires` has no fraction of a second, but Postgres sends six digits (`2026-12-24T17:09:43.177675+00:00`). If a browser's `Date.parse` rejected that, `cbKeySave` (`:2044`) would drop the key as expired. That path is never exercised, and I couldn't check WebKit (not installed).
  - **The new CI job has never run.** The database job runs only on pushes to `main` and `3d`, and `origin/3d` is still at `0619766`. Unless someone started it by hand, it has never run in CI, yet `supabase/README.md` says "CI runs them on every push".
- **Fix:**
  - In every UI test, first route `**/*.supabase.co/**` to abort, then add the stubs.
  - Stub `cb_class_new` in `audit_shots.py`.
  - Return timestamps shaped like Postgres's from the stubs.
  - Push the branch to `3d`, or add a branch or pull-request trigger (R2-03).
- **Effort:** S

### R1.4-13 · Low · `cb_class_delete` deletes everything when the id is missing
- **Where:** migration `:263-275` (`p_id bigint default null` means "all"), and `src/ui.js:2516-2519` (`p_id: a === 'all' ? null : +a`).
- **What's wrong:**
  - **The destructive case is the default.** A request without `p_id`, or with a garbled one, deletes every result for the class: `+a` gives NaN, and `JSON.stringify(NaN)` is `null`.
  - **Safe today, not tomorrow.** The id always comes from a number in the table now, but a later id-type change (a uuid, a string) turns "delete one" into "delete all".
  - **The ids leak volume.** They come from one global sequence, so every instructor can estimate how many results the whole system holds.
- **Fix:** use two functions (delete one, delete all) or a required `p_all` boolean. Use per-class numbers or random ids instead of the global sequence.
- **Effort:** S

### R1.4-14 · Low · Two more unversioned stored formats, the wrong version sent with a result, and a silent Send when storage is blocked (R1-07, worse)
- **Where:**
  - `src/ui.js:2041-2046`: `oc-ckeys` is `{code: {k, exp, t}}`.
  - `src/ui.js:2486, 2495`: `cid` and `sent` added to `oc-last-report`.
  - `src/ui.js:2491`: `p_ver: GAME_V`.
  - `src/ui.js:2857`: the report is saved without a version.
  - Migration `:42`: `classes.ver`.
- **What's wrong:**
  - **Unversioned formats.** `oc-ckeys` holds a credential whose loss costs access to results, with no version field and no migration path. `oc-last-report` gained two fields and still has no version.
  - **The wrong version is sent.** The report doesn't record which version played it, so a v0.30.0 shift sent from v0.31.0 is stored as "0.31.0", and the table's "Played on another version" marker is wrong.
  - **A write-only column.** `classes.ver` is written and never read.
  - **Silent Send with storage blocked** (site data off; `probe3.py`):
    - The report still shows the Send box, and Send does nothing: no request, no message.
    - `cbSend`'s first line returns when `lastReport()` is null.
    - `showReport`'s `kept` guard can never be false, because `store()` swallows the error.
- **Fix:**
  - Put `{v: 1, …}` on both formats.
  - Store `GAME_V` with the report, and send that.
  - When storage is blocked, send from memory and say the result can't be resent after a reload.
  - Use `classes.ver` or drop it.
- **Effort:** S

### R1.4-15 · Low · Case Room coupling is left behind in both directions
- **Where:** `baseline.sql:16-48` (it defines `caseroom.client_ip` and `caseroom.cb_hits`), and the migration's `:18` and `:80-104`.
- **What's wrong:**
  - **This repo carries Case Room's code.** It defines a Case Room function it no longer uses, and running the baseline overwrites Case Room's live function (R1.4-04).
  - **A dead table neither repo can drop.** `caseroom.cb_hits` stays as a dead Code Black table inside Case Room's schema "because caseroom.tidy() cleans it". Neither repo can drop it without the other, and the only record of that dependency is a SQL comment.
  - **The IP logic now exists twice** in one database (`caseroom.client_ip` and `codeblack.client_ip`). If Supabase changes its headers, one copy will get fixed and the other won't.
  - **Case Room's migrations have changed Code Black objects before.** The baseline's header names "security_fixes", "review_fixes" and "hostile_review_fixes". Nothing would catch it next time (R1.4-03).
- **Fix:**
  - Drop `caseroom.cb_hits` with a coordinated pair of migrations, one in each repo.
  - Take the `caseroom.*` definitions out of the Code Black record, and name them as a dependency instead.
  - Add a `comment on` to each `codeblack` object naming the repo that owns it.
- **Effort:** S

### R1.4-16 · Low · The name rule exists in two regex engines, and they disagree
- **Where:** `src/ui.js:2030` (`cbClean`, `\p{L}`), and the migration's `:174-179` (`clean_name`, `[[:alpha:]]`).
- **What's wrong:**
  - **The game is stricter than the server.** `\p{L}` excludes combining marks; Postgres's `[[:alpha:]]` accepts them. "अनिल" (Anil, in Devanagari) is refused by the game as "letters only" and accepted by the server, so a student with a Hindi, Tamil or Bengali first name must use initials.
  - **The result depends on the machine.** `clean_name` is declared IMMUTABLE, but its result depends on the database locale. `db:test` runs C.UTF-8 here and en_US.UTF-8 in CI and on the live project (per `run.sh:17`), so the same check can pass on one machine and fail on another.
- **Fix:** enforce one rule on the server and show the server's reason; or use `[\p{L}\p{M}]` in the client and a locale-independent class on the server, with one shared list of test names used by both suites.
- **Effort:** S

### R1.4-17 · Low · Docs that don't match the code
- **About › Privacy** lists "average wait, walkouts, patients seen". The request also sends AMA departures, deaths (`expired`), the bed-first count, the scenario, the role, the shift and the version (`ui.js:2489-2491`).
- **supabase/README.md:**
  - It says "This folder holds every Code Black object", but the extensions the chain needs aren't recorded (R1.4-03).
  - It says "CI runs them on every push", but only pushes to `main` and `3d` trigger the job (R1.4-12).
  - Its rule 1 ("wrap it in begin … commit, safe to run twice") is broken by its own first file (R1.4-04).
- **CLAUDE.md:**
  - Its Layout block doesn't list `supabase/`.
  - Its rollback procedure is wrong once this migration is applied (R1.4-01).
- **Fix:** correct each line.
- **Effort:** S

### R1.4-18 · Low · UI state grows by ad-hoc fields, and only one of three server calls drops a stale answer
- **Where:** `src/ui.js:8` (the `U` literal), against `U.reg`, `U.cbOpen`, `U.cbCid`, `U.cbSent`, `U.cbList` and `U.codeMade`; `2050` against `2508-2512` and `2518-2523`; and `2932`.
- **What's wrong:**
  - **Undeclared fields.** None of the class-results fields is declared in `U`.
  - **Stale answers win.** `cbRegister` ignores a stale answer, but `cbShow` and `cbDelGo` don't:
    - tap code A, then code B, and A's slower answer replaces B's table;
    - a failed delete puts the old list back over whatever is open now.
  - **A hoisting workaround.** `gatedHost` became a function declaration only because the About page reads it before its `const` line runs. That is an ordering hazard in a 3,000-line file, worked around with hoisting instead of fixed in the structure.
- **Fix:**
  - Declare the fields in `U`.
  - Give each request a sequence number and drop stale answers.
  - Move the gate code above its first use.
- **Effort:** S

### R1.4-19 · Nitpick
- The migration timestamps are invented (`…000000`, `…120000`).
- CI's database job uses whatever Postgres the runner has (`sort -V | tail -1`), not the live project's major version.
- The deploy job runs `node test/db_live.js` without `setup-node`. It works only because the runner image has Node 18 or newer.
- `privacy_test.sql:152` hard-codes "six networks were seen", so any new rate-limit check breaks an unrelated line.
- `cb_class_new` counts every row of `codeblack.classes` on every call, and `cb_submit` counts all of `codeblack.results` on every call.
- `classHTML` → `cbListHTML` parses `oc-ckeys` and runs `readCode` on each stored code on every render while the sheet is open.
- The privacy suite runs as a real superuser with `set role anon`. Supabase's `postgres` role isn't one, and the difference is never exercised.

## 4. Coverage

**Read in full:**
- `supabase/README.md`, both migrations, `supabase/tests/run.sh`, `stubs.sql` and `privacy_test.sql`.
- `test/db_live.js` and `test/class_test.py`.
- `.github/workflows/pages.yml`, and the diff of `tests.yml`.
- The `src/ui.js` diff and the code around it: `CB` through `cbListHTML`, the `ACT` entries, `showReport`, `lastReport`, `gate` and `U`.
- The diffs of `src/style.css`, `test/audit_shots.py`, CLAUDE.md, the README, `docs/SMOKE.md` and `docs/audit/BRIEF.md`.
- My round 1 to 3 reports, and the round 2 and 3 status files.

**Ran:**
- `npm run db:test`: 119 ok, all passed, 2.4 s.
- A fresh build in a scratch clone: the same as the committed `index.html`.
- `test/class_test.py` in Chrome on that build: every check ok.
- My own throwaway Postgres 16 cluster (C.UTF-8):
  - re-running the baseline on a migrated database (R1.4-04);
  - the row guard;
  - the game's captured payload, and one with an extra stat, by named arguments (R1.4-05);
  - 20,000 refused calls (R1.4-09);
  - the name rule on 13 non-ASCII names (R1.4-16);
  - the timestamp format the API returns (R1.4-12).
- Node checks: `readCode` across two version bumps (R1.4-08), and `cbClean` on the same names.
- Playwright in Chrome, with every Supabase call stubbed or aborted:
  - `probe.py`: A, B, C, D, E, F;
  - `probe2.py`: the registration timeout;
  - `probe3.py`: storage blocked;
  - `routeglob.py`: the route glob.

**Not checked, and why:**
- **The live project:** off limits by the brief. R1.4-02 rests on the baseline's own comment.
- **PostgREST:** there's no binary here. The HTTP codes in R1.4-01 and R1.4-10, and the 401 in R1.4-03, come from PostgREST's documented error mapping, which the baseline's comment repeats ("permission denied is a 401").
- **Real pg_cron:** it's a stub here.
- **WebKit and the en_US.UTF-8 locale:** not installed.
- **GitHub Actions runs:** I have no access. "Never ran" in R1.4-12 is inferred from the triggers and `origin/3d`.
- **`npm test` and `npm run stress`:** `engine.js` is unchanged across the diff, and golden moved only its version line.
- **Security of the SQL (RLS, SECURITY DEFINER use, key entropy, HMAC strength):** left to R3. I looked at it only as structure.

## 5. What I'd keep

- A private schema with no grants, reached only through `SECURITY DEFINER` functions with an empty `search_path`. Plus the checks that read `prosecdef`, `proconfig` and the ACLs from the catalog instead of trusting the file.
- The result's own client id and `on conflict do nothing`: retries are harmless where that was applied.
- The row guard at the top of the migration.
- `run.sh`: a throwaway cluster, no network, two seconds, in CI.
- `cbFetch`'s 8-second limit with an `AbortController`.
- Escaping and forcing numbers on every server row, and the hostile-row test that proves it.
- `db_live.js` as an idea: an outside-in check with the public key. It needs to become a gate, a schedule and a version check (R1.4-01, R1.4-03).
