# Reviewer 2, round 8: DevOps, tooling, CI and legal

Branch `claude/sleepy-rubin-jot35n` at `87c9c13` (v0.31.0). Reviewed: the round-7 fixes (`git diff 18a71f9..87c9c13`), and the second migration as the owner will paste it. Nov 25, 2026.

**CI status:**
- `origin/main` is still `815e279` (v0.30.0), and `origin/3d` is still `0619766` (round 3).
- The REST API still shows **no workflow run for any Phase 2 commit**. These have never run on GitHub:
  - the `database` job on PostgreSQL 17;
  - the new `contract` job;
  - the reworked Deploy workflow;
  - `db-watch.yml`.
- Pushes, and so scheduled-workflow notices, come from the owner's own account (`actor: mussidik1`, type User). That fits "GitHub emails the owner".
- The first migration is live and frozen. The second is not applied.

**The migration as reviewed.** `20261125120000_codeblack_round6.sql` at SHA-256 `995464dc88f6a0845c0dcd57ea5a65aadddc5500f9a371d01967e7e11ad43b86`. The owner should compare this with what he pastes. The same line goes into `applied.sha256` afterwards.

I did not contact supabase.co or edcodeblack.com. Every request to the database in my scripts went to a local PostgREST stand-in. Scratch: `scratchpad/round8/r2/`.

## 0. Round-7 status

| ID | Was | Status | Evidence |
|---|---|---|---|
| R2.7-01 Raw invisible characters in the migration | Medium | **Fixed** | `LC_ALL=C grep '[^ -~\t]'` finds 0 non-ASCII bytes in either migration. `run.sh:37-39` refuses a raw character in code (reproduced: a raw U+200C/U+200D at `:193` gives "FAIL: a migration has a character outside ASCII"). The optional function digest was not done. |
| R2.7-02 "They go at launch" locks out new visitors | Medium | **Partly fixed (not in STATUS)** | `supabase/README.md:64` now says "Don't drop them". The game is unchanged: `ui.js:3230` still shows "Can't reach the server" for any failure of `cb_gate_on`, including a 404 or an outage. About's gate sentence still depends on the hostname (`ui.js:2966`), not on whether the gate is on. STATUS doesn't mention R2.7-02 at all. |
| R2.7-03 Releases and rollbacks depend on outside services, with no bypass | Medium | **Fixed** | The reason is checked in the build job's first step (`pages.yml:82-86`). `skip_db_check` skips the whole `contract` job (`:41`). Playwright is pinned to 1.65.2, which exists on PyPI (the latest). There is a PGDG candidate check (`:54`), install steps have time limits, and CLAUDE.md says "and a reason". |
| R2.7-04 Time-zone probe can't fail | Low | **Fixed** | Reproduced on a local database with migration 1's `who()`/`allow()` restored and `cb_health`'s time zone reset. Result: `FAIL … (call 31: {"ok": true}; 0 refused)`, buckets 23:00 (16) and 23:15 (15). It passes on the real round 6. With only migration 1 live, it fails too. |
| R2.7-05 Clean-up job missing is only a warning | Low | **Partly fixed** | `db_live.js:62` now fails, and the warnings name the problem. Re-running round 6 restores a paused or deleted job (checked with the stand-in pg_cron; real pg_cron untested). But `supabase/README.md:55` still lists "the clean-up job missing" under "**warnings (not failures)**", with the old remedy (R2.8-03). |
| R2.7-06 Nothing checks an applied migration was frozen | Low | **Fixed** | `db_live.js:15,55-57`. With round 6 live and not listed: `FAIL applied live but not in supabase/migrations/applied.sha256: 20261125120000_codeblack_round6`. With it listed, the check passes. A rollback (live migration not in the release's `MIGS`) is correctly ignored. |
| R2.7-07 Backstops bigger than documented; one /48 fills them | Low | **Fixed** | The README says "up to about 250 MB". There are now /48 limits (1,000 codes and 10,000 sends a day, 2,000 sends an hour), and a daily watch. One stale comment remains (R2.8-04j). |
| R2.7-08 About omits GitHub Pages logging | Low | **Fixed** | `ui.js:2966`: "hosted on GitHub Pages, which, like any web host, logs the address of every visit." |
| R2.7-09 Nitpicks | Nitpick | **Partly fixed** | Fixed: odd files, static checks before `mktemp` (no leaked folder: 11 temp folders before and after five failing runs), required `migs`/`classes`/`results`, `SKIP_REASON` newlines and `::`, 401/429 now fail, red wrong-branch run, `gone()` with retries, `webkit-save` `!cancelled()`, `persist-credentials` everywhere, the attending's Send box, the class code in About, `.gitattributes`, the README name rule and changelog order, `contact` escaping, the `locale -a` pipe. Still open: `download-artifact` fallback dead code, `name_ranges.py` not in CI, `db:live` missing from README, deployment identity (R2.8-02), shellcheck. |

**Counts:** 5 Fixed, 3 Partly fixed (one of them silent in STATUS), 0 Still open, 0 Worse.

**STATUS claims that overreach:**
- **"the live-site check names this exact deployment (the service worker's cache name)".** The cache name is a hash of `index.html`, not a deployment, and it is checked last (R2.8-02).
- **"docs corrected (CLAUDE.md, both READMEs …)".** Not done:
  - CLAUDE.md:141 and README.md:55 contradict the held-code change (R2.8-01);
  - CLAUDE.md:158 stops at `rules12.js`;
  - `supabase/README.md:55` contradicts the deploy (R2.8-03).
- **The `name_ranges.py` comment** says Python 3.12 ships Unicode 15.1. It ships 15.0.0 (R2.8-04a).

## 1. Verdict

**Nothing in my area blocks the owner's paste, once the Tests workflow is green on `3d` at the commit he applies from.**

**What I checked of the migration.** On PostgreSQL 16.15, under both en_US.UTF-8 and C.UTF-8:
- it is pure ASCII;
- it runs twice;
- it refuses without its predecessor and over a newer migration;
- it holds a lock timeout;
- it reschedules and re-enables the clean-up job;
- it runs again over a full database and keeps everything (72 classes / 2 results);
- the held-code lifecycle behaves as the comments say.

**PostgreSQL 17 is still unproven.** apt.postgresql.org is refused by this container's proxy (403). So the never-run `database` job is the only PostgreSQL 17 evidence there will be: push to `3d` and get it green first.

**Before the merge into `main`:**
- **Fix R2.8-01's wording.** Every instructor who makes a code is told the code is deleted on a date when it is in fact held 30 more days.
- **R2.8-02 and R2.8-03 are each a few lines.**

## 2. Score

**8 / 10** (round 7: 7).

**What earned the points:**
- Every Medium from round 7 is fixed or reduced to a doc line.
- The deploy gate behaves under every failure I could simulate.
- The freeze is closed end to end.

**What costs the rest:**
- Not one line of the new CI has executed on GitHub.
- PostgreSQL 17 is untested.
- Retention statements disagree with the database.
- The "this exact deployment" check doesn't identify a deployment.

## 3. New findings (worst first)

### R2.8-01 · Low · The held-code change left four retention statements saying the code is deleted with its results, two of them shown to instructors; and held codes now sit in the "live classes" backstop for 44 days

- **Location (the statements):**
  - `src/ui.js:2146` (`cbRegHTML`, shown under every new code): "The code and its results are deleted on <14-day date> if no student sends one, or on <30-day date> once one does."
  - `src/ui.js:2726` (the typed-key error): "a code and its results are deleted 30 days after it was made, or 14 if nobody sent a result".
  - `README.md:55` (v0.31.0): "A code and everything sent for it are **deleted 30 days** after the code was made".
  - `CLAUDE.md:141`: "then it and its results are deleted".
- **Location (the database):** migration `:18-21` and `tidy()` `:205-206`. `supabase/README.md:35` is the only document that describes it.
- **Reproduction (local database, both migrations):**
  - `cb_class_new('HJK-MNP', key A)`, then `cb_submit`.
  - Set `expires_at` to a minute ago, then `tidy()`. Results go to 0, but the class row stays.
  - `cb_class_new` with key B gives `{"error": "taken"}`. With key A it gives `ok`: the code is turned back on.
  - Only when `expires_at < now() - 30 days` does `tidy()` delete the row.
  - Until then the server keeps:
    - the code;
    - the SHA-256 of the instructor key;
    - the version;
    - both dates.
  - That is 30 days past the date the instructor was given.
- **What is still accurate:** the student-facing text (About, the Send box, CB_WHO). It speaks of the result, and results do go on the date given.
- **The backstop.** `supabase/README.md:38` says "About 100,000 **live** classes", but `reltuples` on `codeblack.classes` counts held codes too.
  - A junk code with no result used to occupy the backstop for 14 days. Now it occupies it for 44 days (`expires_at` default 14 days, then held 30).
  - So a flood keeps every new code answering `full` about three times as long before anyone cleans it by hand.
  - `db-watch.yml` does warn at half full.
- **Fix:**
  - In all four places, say: "Its results are deleted on X. The code itself is held 30 more days with only its key's hash, so nobody else can take it over."
  - Change the backstop line to "100,000 classes, including codes held after they end".
- **Effort:** XS.

### R2.8-02 · Low · The live-site check still tests the previous deployment whenever `index.html` doesn't change, and its "this exact deployment" marker is checked last, with a fifth of the patience

- **Location:**
  - `pages.yml:151`: `cache=$(grep -o "overcrowded-[0-9.]*-[0-9a-f]*" sw.js | head -1)`, with the comment "names this exact deployment (R2.7-09o)".
  - `:174-176`, the order of the checks:
    1. version, 30 tries (about 15 min);
    2. the 12 `gone` checks;
    3. `sw.js` cache name, 6 tries (about 3 min).
  - `build.js:41`: the cache name is `version + sha1(index.html)`.
- **What's wrong:**
  - **The marker names the build, not the deployment.** The cache name identifies the content of `index.html`. A merge into `main` that changes only the workflow or the docs keeps the same version and the same `index.html`. The version check, all 404 checks and the cache-name check then pass at once against the **previous** deployment.
  - **That is the one case the 404 checks exist for.** An edit to the package step (`pages.yml:106-112`) that publishes `src/` or `docs/` deploys, the check passes, and nobody is told. The source stays public until someone notices.
  - **A same-version deploy with a changed `index.html` also checks the wrong deployment first.** The 404 checks run against the old deployment, and then the cache name gets about 3 minutes, where the version got 15.
- **Fix:**
  - Write a marker into the artifact, for example `echo "$GITHUB_SHA $GITHUB_RUN_ID $GITHUB_RUN_ATTEMPT" > _site/deploy.txt`.
  - Wait for that marker first, with 30 tries.
  - Then run the 404 checks.
  - Keep the cache-name check as a second assertion.
- **Effort:** XS.

### R2.8-03 · Low · The runbook contradicts the gate it documents
- **`supabase/README.md:55`.**
  - **It calls a hard failure a warning:** "**warnings (not failures):** classes overdue for deletion or the clean-up job missing (enable pg_cron under Database > Extensions; `select * from cron.job`)". `db_live.js:62` fails the deploy on a missing or paused job.
  - **The remedy is the old one.** The script now prints "re-run the newest migration in the SQL editor (it schedules and turns the job on)". The README doesn't say that.
- **Two new failures have no runbook entry.** `db_live.js:56-57` can say:
  - "applied live but not in applied.sha256";
  - "listed in applied.sha256 but not live".
- **The remedy depends on an unwritten rule.** "Re-run the newest migration" works only while the newest migration contains `cron.schedule`. Round 6 does. Step 1's checklist (`supabase/README.md:46`) doesn't require the next one to.
  - The fix is either a rule in step 1, or printing the one-line `select cron.schedule('codeblack-tidy', '41 * * * *', 'select codeblack.tidy()');` in `db_live.js`.
- **`CLAUDE.md:158`** says `npm test` runs "rules.js through rules12.js". `package.json` runs `rules13.js` too.
- **README "Development"** lists `db:test` but still no `db:live`.
- **Fix:** edit the lines above.
- **Effort:** XS.

### R2.8-04 · Nitpick (15 items)
- **a. `tools/name_ranges.py:58`.**
  - **The comment is wrong.** `UNICODE = '15.1.0'   # … Python 3.12 and 3.13 ship it`, but Python 3.12 ships 15.0.0.
  - **So the refusal message contradicts itself.** `/usr/bin/python3.12` (3.12.3) prints "This Python has Unicode 15.0.0; the lists are Unicode 15.1.0. Use Python 3.12 or 3.13" and exits 1.
  - **Where it works.** Python 3.13.18 passes.
  - **CI still doesn't run it.**
- **b. The watch fires at 45 %.** `cb_health` rounds to a tenth. With `reltuples = 135000` for results, the watch prints `FAIL the storage backstops are MORE than half full (classes 0, results 0.5)` (reproduced). Either compare against 0.45, or say "about half".
- **c. `pages.yml:75,121` use `always()`.**
  - This is the pattern R2.7-09 had removed from `webkit-save`.
  - A Cancel pressed between two jobs is ignored, and the deploy goes ahead.
  - `!cancelled() && …` would work, and the skipped-contract path would still work.
- **d. The ASCII refusal cuts off its own evidence.** `run.sh:38` pipes through `cut -c1-120`. On a GitHub runner, the path `/home/runner/work/Overcrowded-ED-Game/Overcrowded-ED-Game/supabase/tests/../migrations/20261125120000_codeblack_round6.sql` is 122 characters. So the line number and the bad text are cut off (measured). Also, comment lines are exempt, so the claim "refuses raw ones in any migration" is slightly wide.
- **e. Malformed lines get the wrong diagnosis.** If `applied.sha256` has a malformed line (binary-mode `*`, a path prefix, or CRLF), `db_live.js` says "applied live but not in applied.sha256: …20261124120000…, …20261125120000…. Add its line", although the lines are there (reproduced, all three). `run.sh` catches it first on a normal deploy, but not in the watch or an emergency deploy.
- **f. A failing line excuses itself.** The private-table message reads `FAIL the private results table isn't reachable … (HTTP 401; 401 or 429 would only mean the check itself was refused)`. The line fails, but the text says the result doesn't matter.
- **g. `db-watch.yml:17`** runs on `ubuntu-latest`. Every other Linux job is pinned to `ubuntu-24.04`.
- **h. `pages.yml:34` puts `${{ github.ref_name }}` straight into a `run:` script.**
  - This is the expression-injection pattern. A ref name can hold `"`, `$` and `;`.
  - There is nothing to gain from it here, because a dispatch runs that branch's own workflow file.
  - Pass the value through `env:` anyway.
- **i. `tests.yml`.**
  - **No PGDG check.** The `database` job has no candidate check and no step time limit (`pages.yml` has both).
  - **The `webkit-save` fallback is still unreachable.** `download-artifact` has no `continue-on-error`, so if the download fails, the push step never runs and its "no results" fallback can't happen.
- **j. A stale comment.** Migration `:285` still says "a storage backstop (about 150 MB)". The README now says up to about 250.
- **k. shellcheck 0.11.0 on `run.sh`:** SC2010 ×3 (the odd-file check adds a third) and SC2012. `bash -n` is clean, and actionlint 1.7.12 is clean on all three workflows.
- **l. `build.js:29`** now escapes `<` in `BACKEND`, but not in `IMGCREDIT`, which carries third-party author strings from `img/credits.json`. None contains `<` today.
- **m. CLAUDE.md's release step** omits "after the Tests workflow, PostgreSQL 17 included, is green", which `supabase/README.md` step 2 and STATUS both require.
- **n. `class_test.py` now gates every deploy, rollbacks included,** with 68 fixed `wait_for_timeout` sleeps (it had 51 when R2.5-09 was raised).
- **o. A rebuild step that can't be followed.** `supabase/README.md:64` says a project rebuilt from `migrations/` alone "needs the gate's part of the baseline too". The baseline refuses to run on a migrated database and has no separate gate part, and nothing says how to extract one.

## 4. Coverage

**Read:**
- `git diff 18a71f9..87c9c13` for `.github/` (all three workflows in full), `supabase/` (the round-6 migration in full, `run.sh`, `stubs.sql`, `client_call.json`, the README), `test/db_live.js` in full, `build.js`, `tools/name_ranges.py`, `.gitattributes`, `package.json`, CLAUDE.md, and README (v0.31.0 paragraph, "For a class", "Development").
- In `src/ui.js`: `cbRegHTML`, `cbArgs`, `cbWhatAll`, `CB_WHO`, `cbSendHTML`, the read and delete error text, `aboutHTML`, the gate.
- Migration 1's `who`/`allow`/`keyed_class`/classes table/cron.
- BRIEF rounds 6 to 8, round-7 STATUS, my round-7 report.

**Ran:**
- **`npm run db:test`:** 207 ok, exit 0, 4 s, on PostgreSQL 16.15 en_US.UTF-8. Again with `locale` faked to offer only C.UTF-8: 207 ok.
- **Lint:** `bash -n` clean. shellcheck 0.11.0 and actionlint 1.7.12, installed in a scratch venv, as above.
- **A scratch copy of HEAD** (`git archive`):
  - the rebuild is byte-identical for `index.html`, `sw.js` and `3d/map3d.js`;
  - `npm test`: 703 ok, 0 FAIL, 40 s;
  - `npm run stress`: exit 0, 42 s;
  - `class_test.py`: 91 ok, "No errors.", 42 s.
- **`test/db_live.js`** against a local PostgreSQL behind a PostgREST stand-in that honours `Prefer: timezone` and replaces `cf-connecting-ip`:
  - the repo as is (round 6 live, not frozen): fails on `applied.sha256` only;
  - with the line added: all pass, normal and `DB_WATCH=1`;
  - cron paused: fails;
  - an ended class with a result 3 hours late: `::warning::` on deploy, FAIL in watch;
  - results at 45 %: watch FAIL;
  - regressed time-zone limits: FAIL;
  - only migration 1 live: behind and the probe both fail, including the real minute-55 wait (279 s);
  - `SKIP_DB_CHECK=1` with an empty reason, a blank reason, a newline plus `::error::`, and `%0A`;
  - `applied.sha256` with CRLF, `*`, a path prefix and a trailing blank line.
- **`run.sh` on scratch copies:**
  - a 13-digit file name;
  - raw U+200C/U+200D in code;
  - a raw character in a comment (passes);
  - a `*` line in `applied.sha256`;
  - an edited frozen file;
  - temp folders counted before and after.
- **The held-code lifecycle and the cron remedy,** by hand in SQL.
- **The deploy job's cone-mode sparse checkout,** with git 2.43: `sw.js`, `package.json` and `CNAME` are present (and so is every other root file).
- **Python 3.11, 3.12 and 3.13** against `name_ranges.py --check`.
- **A secret scan of the diff:** no `sb_secret_`, JWT, bcrypt hash, GitHub, AWS or Slack token, or private key. The publishable key isn't in the diff.
- **`gh api`** (REST) for the default branch (`main`), visibility (private), and the latest runs and their actors.

**Couldn't check:**
- PostgreSQL 17: apt.postgresql.org is refused by the proxy.
- Real pg_cron's `schedule`/`alter_job` behaviour (only the stand-in).
- Any real Actions run of the three workflows.
- The `github-pages` environment rules.
- The live project and site (barred).
- bash 3.2 and macOS `shasum --strict`.

## 5. What I'd keep
- **`db_live.js` as it now stands:**
  - one diagnosis when health doesn't answer;
  - the round-6 fields required by version;
  - `applied.sha256` checked against the live list, with the rollback case ignored correctly;
  - the clean-up job as a failure;
  - warnings that name the problem;
  - a watch mode that turns the soft checks hard;
  - an alternating-zone probe that fails on the bug it targets;
  - `SKIP_REASON` reduced to one line with no workflow command.
- **The deploy's job split:**
  - outside package servers in their own job;
  - the reason checked before anything runs;
  - a red run for a wrong branch;
  - `gone()`, which tells "published" apart from "couldn't check".
- **`run.sh`'s static checks before any temp folder:**
  - odd files;
  - a strict, well-formed `applied.sha256`;
  - the sorts-before rule;
  - ASCII-only code.
- **Then the full sequence:** predecessor refusal, newer-migration refusal, re-run over data. Every rule the README lists is tested.
- **The migration's discipline:**
  - escapes only;
  - a lock timeout;
  - dynamic SQL in the predecessor check, so it fails with a message instead of a parse error;
  - the job rescheduled idempotently.
- **The privacy text:**
  - About names the class code, the Supabase and GitHub Pages logs, and their retention;
  - the Send box lists the same numbers for both roles and points to About;
  - student-facing retention matches the database.
