# Reviewer 2, round 7: DevOps, tooling, CI and legal

Branch `claude/sleepy-rubin-jot35n` at `18a71f9` (v0.31.0). Reviewed: the round-6 fixes, `git diff 6328cdf..18a71f9`, and the second migration before it goes live. Nov 24, 2026.

**CI status:**
- `origin/main` is still `815e279` (v0.30.0), and `origin/3d` is still `0619766`.
- `gh run list` still shows **no CI run for any Phase 2 commit**. The `database` job, the reworked Deploy workflow and `webkit-save` have never run.
- The first migration is live and frozen. The second (`20261125120000_codeblack_round6.sql`) is not applied.

I did not contact supabase.co or edcodeblack.com. Every request to those names in my scripts was answered locally (a stand-in server or a Playwright route). Scratch: `scratchpad/round7/r2/`.

## 0. Round-6 status

| ID | Was | Status | Evidence |
|---|---|---|---|
| R2.6-01 Every deploy fails at `configure-pages` | High | **Fixed** | `pages.yml:33-35`: `build` has `contents: read, pages: read`. Read is what `GET /repos/{o}/{r}/pages` needs. Not proven on real Actions: the workflow has never run. |
| R2.6-02 Live migration applied before CI ever ran it | Medium | **Partly fixed (STATUS reason)** | STATUS: "the merge into `3d` runs it, before the round-6 migration goes live." As of `18a71f9` that hasn't happened: zero runs. `supabase/README.md` "Releasing" still has no "Tests green on `3d`" step between the local `db:test` and the owner's paste. The README still says the rules "run on a local PostgreSQL 17 in CI". |
| R2.6-03 An applied migration can be edited in place | Medium | **Fixed, with a gap** | `applied.sha256` exists, and its hash matches the file at `2b51323` and `6328cdf`. `run.sh:26` refuses an edit (reproduced). `run.sh:28-30` refuses an unapplied file that sorts before an applied one (reproduced). Gap: nothing checks that a newly applied migration gets listed (R2.7-06). |
| R2.6-04 `db_live.js` misdiagnoses failures | Low | **Fixed** | Reproduced against stand-ins: `540 Project paused`, `404 PGRST202` and a body that stalls each give one diagnosis and exit 1 (the stall after 15 s). The live database being equal, ahead or behind each gets its own message. |
| R2.6-05 Runbook gaps | Low | **Partly fixed** | Now present: the backward-compatibility rule (CLAUDE.md, `supabase/README.md:46`), the `cb_health` bullet, the `run.sh` step list, and "Before a merge". The pg_cron remedy `db_live.js` now prints doesn't work once round 6 is applied (R2.7-05). |
| R2.6-06 `run.sh` self-record check is NULL-blind | Low | **Fixed** | `is distinct from` (`:56`). Removing the insert fails the run (reproduced). The refusal is matched by its message (`:60`). `privacy_test.sql:45` uses `:'latest'`. |
| R2.6-07 404 checks run before the new deployment is live | Low | **Fixed** | `pages.yml:131` checks the version first, with `continue` on failure, then the 404 list. In a rollback, `PAST_V` is single-quoted in `index.html`, so `"0.30.0"` doesn't match the newer page. |
| R2.6-08 Privacy notice incomplete | Low | **Fixed** | The Send box points to About; `cbRegHTML` names the developer; log retention is stated ("a day on its free plan", which matches Supabase's `pricing.ts`, `free: '1 day'`); the shared-computer note covers downloaded files. One leftover is in R2.7-09. |
| R2.6-09 Nitpicks | Nitpick | **Partly fixed** | Fixed: the reserved ranges, `SKIP_DB_CHECK === '1'`, probe time-outs, the `db_live.js:4` comment, main-only deploys, "letters only", and a `700` work folder. Still open: 401/429 accepted for the private tables, the changelog order, and most round-5 carry-overs (R2.7-09). |

**Counts:** 6 Fixed, 3 Partly fixed, 0 Still open, 0 Worse.

## 1. Verdict

**Before the owner pastes `20261125120000_codeblack_round6.sql`, do two things:**
- **Fix R2.7-01.** It is one line now; once the migration is applied, it takes a third migration.
- **Push to `3d` and get the `database` job green on PostgreSQL 17.** I couldn't install 17 here: apt.postgresql.org is unreachable from this container. So round 6 has still only run on 16.15, under C.UTF-8 and en_US.UTF-8.

**Before the merge into `main`:**
- **R2.7-02:** the launch note can lock out every new visitor.
- **R2.7-03:** the rollback path now depends on four more outside services, with no bypass.

**What I checked of the round-6 work on the deploy gate.** Against a local Postgres behind a PostgREST stand-in:
- the diagnoses;
- the live database being equal, ahead or behind;
- the skipped-migration check;
- `SKIP_REASON`;
- the minute-55 wait;
- the frozen-migration check.

All behave as documented. Two things still say more than they prove:
- the "another time zone" probe;
- the clean-up warnings.

## 2. Score

**7 / 10** (round 6: 6). The deploy should publish now, the gate diagnoses well, and applied migrations are frozen. Points come off for:
- a hand-pasted migration that relies on invisible characters;
- a launch note that contradicts the launch step;
- a heavier rollback with no escape hatch;
- CI still never run.

## 3. New findings (worst first)

### R2.7-01 · Medium · The round-6 migration contains two raw invisible characters. A paste that drops them applies cleanly, records itself, and breaks every Send.
- **Location:**
  - `supabase/migrations/20261125120000_codeblack_round6.sql:169`: `[‌‍]` is a raw U+200C (zero-width non-joiner) and U+200D (zero-width joiner).
  - The same file has raw `·・׳״` (`:165`) and `！-～①-⓿` (`:167`).
  - Every other code point in the file is written as a `\u…`/`\U…` escape.
  - `supabase/README.md:48`: the owner "pastes the file into the Supabase SQL editor".
- **What's wrong:**
  - **Reproduction.** I removed the two characters from a copy (what a clipboard or editor that strips zero-width characters does) and applied it over migration 1. The migration commits without error and inserts its own name.
  - **The first use fails.** `select codeblack.clean_name('Sam')` gives `ERROR: invalid regular expression: parentheses () not balanced`, because `[](?=[[:alpha:]])` no longer parses. Every `cb_submit` then answers a server error.
  - **What `db_live.js` catches.** Its `cb_submit` probe fails (`500 … parentheses () not balanced`), so v0.31.0 wouldn't publish. That is the only thing that notices, and it notices after the live database already holds the broken function.
  - **The cost after that.** The file is frozen once applied: the fix needs a third migration and another approval cycle.
  - **The record would be wrong.** `applied.sha256` would record the hash of a file that isn't what went live. The check can't tell, because the hash is taken from the repo, not from the database.
  - **The test runs miss it.** `run.sh` tests the file with the characters intact, so CI can't catch it either.
- **Fix:**
  - Write `[‌‍]`, `·・׳״` and `！-～①-⓿`. PostgreSQL's regex reads these escapes, as the rest of the file already relies on.
  - Add a `run.sh` step that refuses any non-ASCII byte in `migrations/*.sql` (`LC_ALL=C grep -n '[^ -~	]'`).
  - Optional (S): have `cb_health` return an md5 of `string_agg(pg_get_functiondef(oid) order by oid)` over the `codeblack` and `cb_` functions, and have `db_live.js` compare it with the same digest `run.sh` computes locally. That detects a bad paste and hand edits in the SQL editor (R1.5-04's drift).
- **Effort:** XS (the escapes and the ASCII check), S (the digest).

### R2.7-02 · Medium · "They go at launch": the new gate note contradicts the launch step, and following it locks every new visitor out
- **Location:**
  - `supabase/README.md:63` (new in round 6): "a fresh project built from `migrations/` alone has no gate. They go at launch."
  - The other launch instructions: `supabase/README.md:72` and CLAUDE.md "Gate" ("Launch is one SQL line: … `gate_on = false`").
  - `src/ui.js:3179-3180`: `GATED` is decided by hostname, not by gate state.
  - `src/ui.js:3200`: `cbFetch('/rest/v1/rpc/cb_gate_on', {}).then(on => (on === false ? open() : form())).catch(() => form('Can’t reach the server…', true))`.
- **What's wrong:**
  - **The game keeps calling the gate.** The shipped game calls `cb_gate_on` on every first visit to edcodeblack.com, before and after launch.
  - **Reproduction.** I ran a Playwright script with every request routed locally (`gate_dropped.py`). `cb_gate_on` answered `404 PGRST202`, which is what dropping the objects "at launch" gives, and what a project rebuilt "from `migrations/` alone" gives. A first visit then shows "In private testing. Enter the password to play. … Can’t reach the server." There is no way in. A device that kept a password gets in (`cb_gate_check`'s `.catch(open)`).
  - **Recovery locks them out too.** `supabase/README.md:7` promises the folder can be "rebuilt". A disaster-recovery rebuild from `migrations/` produces a project the live game can't start against, for every new visitor.
  - **So does an outage.** A Supabase outage, or a paused free project, does the same. CLAUDE.md calls the backend "small, optional" and says "everything else runs offline".
  - **About is wrong after launch.** It keeps saying "On this private test site, opening the game checks the test password with the same database" (`ui.js:2943`, also by hostname), and every visit keeps sending the visitor's address to Supabase.
- **Fix:**
  - Replace "They go at launch" with: "At launch only `gate_on` goes false; the objects stay until a release takes the gate out of the game, then a migration drops them."
  - Make the game treat a 404 from `cb_gate_on` as "no gate". Hardening the gate is out of scope by the owner's decision, so failing open on a missing function costs nothing.
  - Condition About's sentence on the gate actually being on.
- **Effort:** XS.

### R2.7-03 · Medium · Releases and rollbacks now depend on four more outside services and a browser test, with no bypass. The skip reason is checked last.
- **Location:**
  - `pages.yml:51-54`: the PGDG script, then `apt-get install postgresql-17`.
  - `:60-67`: `pip install -q playwright` (unpinned), then `playwright install --with-deps chromium` (Ubuntu mirrors and Playwright's browser CDN), then `class_test.py`.
  - `:70-74`: `SKIP_REASON` is checked only inside `db_live.js`, the last check.
  - CLAUDE.md "Rolling back" says "with **skip_db_check** ticked", and doesn't mention that a reason is required.
- **What's wrong:**
  - **A revert reruns everything.** `git revert -m 1` on `main` reruns this whole job. `skip_db_check` skips only the live check.
  - **No way through an outage.** If any of these stops a release or a rollback, the only way through is editing the workflow on `main`, mid-incident:
    - apt.postgresql.org down;
    - PyPI or the Playwright CDN down;
    - a new Playwright release;
    - a `class_test.py` flake (51 fixed sleeps, R2.5-09).
  - **The PGDG script hides the outage.** From this container, apt.postgresql.org was unreachable. `apt.postgresql.org.sh -y` still printed "You can now start installing packages" and exited 0. The next step failed with "Unable to locate package postgresql-17", and the CI step sends its stdout to `/dev/null`.
  - **A missing reason is found late.** A forgotten `skip_reason` fails only after about 8 to 10 minutes of installs and tests.
  - **The rollback is slower.** v0.30.0's whole deploy took 2 min 55 s. By my local timings the new build job alone is about 10 minutes.
- **Fix:**
  - Validate `skip_db_check`/`skip_reason` in the build job's first step.
  - Add an emergency input that also skips the local PostgreSQL 17 run and `class_test.py`. They re-prove what Tests proved on `3d`.
  - Pin `playwright==<version>`.
  - Add `timeout-minutes` to the install steps.
  - After the PGDG script, fail clearly if `apt-cache policy postgresql-17` has no candidate.
  - Add "and a reason" to CLAUDE.md's rollback line.
- **Effort:** S.

### R2.7-04 · Low · The deploy's time-zone probe can't fail: all 31 calls ask for the same zone
- **Location:**
  - `test/db_live.js:84`: `Prefer: 'timezone=Asia/Kathmandu'` on every probe call.
  - `:89`: "forged address headers and another time zone don't get round the rate limit".
  - STATUS: "the deploy's probe now also asks for another time zone".
- **What's wrong:**
  - **What the fix is for.** The R3.6-05 attack is one caller using several zones to open several buckets.
  - **Reproduction.** On a local database with round 6, I restored migration 1's `who()`/`allow()` and reset `cb_health`'s time zone, which brings back the bug.
    - By hand, 20 UTC calls and 20 Kathmandu calls were all accepted, in two buckets (hour keys 22:15 and 23:00).
    - `db_live.js` still printed `ok … another time zone don't get round the rate limit (call 31: {"error": "busy"}; 1 refused)` and exited 0. All 31 calls landed in the one Kathmandu bucket.
    - It printed the same "ok" against a database with only migration 1, which has the bug.
  - **A fix that works.** A copy that alternates (`i % 2 ? 'Asia/Kathmandu' : 'UTC'`) fails on the regressed database (`call 31: {"ok": true}; 0 refused`) and passes on the real round 6.
  - **Why it's only Low.** `db_live.js` also requires round 6 by name, so the real risk is low. The problem is that the line claims a check it doesn't make.
- **Fix:** alternate the zones. 31 calls is still enough against a bucket of 30.
- **Effort:** XS.

### R2.7-05 · Low · A dead clean-up job is only a warning, the warning reads as a pass, its remedy fails after round 6, and About's two-day promise depends on it
- **Location:**
  - `test/db_live.js:50-54`.
  - `supabase/README.md:54`.
  - About, `ui.js:2943`: "counts requests per network for up to two days".
  - Round 6's `tidy()`.
  - Migration 1, `:31-33`: it refuses to run once a newer migration is recorded.
- **What's wrong:**
  1. **Retention breaks silently.** `cb_class_new` clears expired classes, but nothing except `tidy()` deletes `codeblack.rate` rows or `codeblack.salt` rows. With pg_cron off, the address hashes, and the salts that make them reversible (R3.4: 2^32 HMACs), are kept indefinitely, and the deploy goes green with a warning annotation. The comment at `:51` says "a lagging clean-up job doesn't expose anything". That is wrong for these two tables.
  2. **The warnings state the opposite of the problem.** Reproduced with the job inactive and one overdue class:
     - `::warning::the hourly clean-up job is scheduled.`
     - `::warning::no class is more than two hours past its deletion time (1).`

     That is what the owner sees on the phone.
  3. **The remedy is wrong.** "enable pg_cron (Database > Extensions) and re-run the migration" no longer works:
     - Only migration 1 calls `cron.schedule`, and it now refuses ("A newer Code Black migration is already applied").
     - Round 6 has no `cron.schedule`.
     - Reproduced: I deleted the job and re-ran both migrations. `cron.job` still had 0 rows.
- **Fix:**
  - Make `cron` a failure. It backs a privacy promise. Keep `overdue` as a warning.
  - Word each warning as the problem ("the clean-up job is NOT scheduled").
  - Give the exact remedy in `db_live.js` and the README: `select cron.schedule('codeblack-tidy', '41 * * * *', 'select codeblack.tidy()');`, or `cron.alter_job(<jobid>, active := true)`.
- **Effort:** XS.

### R2.7-06 · Low · Nothing checks that an applied migration was actually frozen
- **Location:**
  - `run.sh:26-30`: checks only files already listed in `applied.sha256`.
  - `test/db_live.js:46-49`: has the live list (`hj.migs`) but never reads `applied.sha256`.
  - `supabase/README.md:48`: listing the file is a manual step after the paste.
- **What's wrong:**
  - **R2.6-03 comes back on one missed step.** Round 6 goes live, nobody adds its line, and the next session edits it in place (the established habit). `run.sh`, CI and `db_live.js` all pass, because the name is unchanged.
  - **The data to check is already there.** The deploy already knows which migrations are live.
- **Fix:** `db_live.js` reads `applied.sha256` and fails on any migration in both `hj.migs` and `MIGS` that isn't listed: "add its SHA-256 to `applied.sha256` and commit, then re-run".
- **Effort:** XS.

### R2.7-07 · Low · The storage backstops are bigger than documented, and one free IPv6 /48 reaches the results backstop in hours
- **Location:**
  - `20261125120000_codeblack_round6.sql:250`: "a storage backstop (about 150 MB)".
  - `supabase/README.md:37`.
- **What's wrong:**
  - **The measured size.** I took a worst-case row: 20 four-byte letters as the name, all 20 stats at 999999, plus `scen`. Its cleaned stats are 550 bytes, against the 1,000-byte cap round 6 set (it was 400 before). With indexes the row is 857 bytes. 300,000 rows come to about **245 MB, not 150**. `reltuples` lags by autovacuum's 10 to 20 per cent, so the cap is approximate. That sits next to about 15 MB of classes, in the 500 MB free quota Case Room shares.
  - **How fast it fills.** `client_ip()` groups IPv6 by /56. A tunnel broker's free routed /48 is 256 "networks".
    - **Results:** at 600 sends an hour each, 256 networks fill 300,000 results in about 2 hours. They need 600 classes, which is three networks' daily allowance.
    - **Classes:** 51,200 a day.
  - **After that,** every Send answers `full` (scope `all`) until the owner deletes by hand. The deploy's half-full warning fires only at deploy time. Rate-limit design is R3's area; I'm reporting it because of the numbers.
- **Fix:**
  - State the measured worst case in both places.
  - Consider a /48 grouping, or a global cap, for the daily limits.
- **Effort:** S.

### R2.7-08 · Low · About doesn't say that the site's host logs every visitor's address
- **Location:** `ui.js:2934`: "No accounts, ads, or tracking." Only Supabase's logs are disclosed (`:2943`).
- **What's wrong:** the site is on GitHub Pages (`pages.yml`). GitHub's own Pages docs (`what-is-github-pages.md:92`, read from `github/docs`) say: "When a GitHub Pages site is visited, the visitor's IP address is logged and stored for security purposes." That happens on every visit, not only for class results.
- **Fix:** add one clause: "The site is hosted on GitHub Pages, which logs visitors' addresses for security (GitHub's privacy statement)."
- **Effort:** XS.

### R2.7-09 · Nitpick
- **`run.sh`:**
  - **A misnamed migration is silently skipped.** I added `2026112613000_codeblack_typo.sql` (13 digits) containing `select 1/0`. `run.sh` printed ALL DATABASE CHECKS PASSED, and `db_live.js`'s `MIGS` ignores it too. Fail on any `migrations/*.sql` that doesn't match `^[0-9]{14}_`.
  - **A garbled message:** `:29` says "…sorts before X, which is: rename it…".
  - **A leaked temp folder:** a freeze failure exits before `trap finish` is set (`:38`), so `$work` is left behind.
  - **shellcheck 0.11.0:** SC2010 ×2 (warning; the one at `:28` is new) and SC2012 (info).
  - **The version line** still prints "(PostgreSQL) 16.15".
- **`tools/name_ranges.py --check`:**
  - It compares with whatever Unicode the local `python3` has.
  - It passes on 3.12 while printing "Unicode 15.0.0", although the migration says 15.1. It fails on 3.11, and will fail on 3.14 (Unicode 16).
  - It isn't run by CI.
  - Fix: refuse unless `unicodedata.unidata_version` equals the version the migration states, and wire it into `run.sh`.
  - I couldn't verify the claim "DI unchanged in 16.0 and 17.0".
- **`db_live.js`:**
  - **Two checks can vanish quietly.** The skipped-migration and backstop checks are skipped if `migs`/`classes` disappear (`if (Array.isArray(hj.migs))`, `if (hj.classes != null)`). Require them when `hj.db >= '20261125120000'`.
  - **A newline in `SKIP_REASON` injects a workflow command.** Reproduced: `::error::injected` became its own annotation. Strip `\r\n`.
  - **`:66-69`** still accepts 401 and 429 for the private tables.
- **`cb_health`** gives anyone with the public key:
  - approximate live counts: classes to the nearest 100, results to the nearest 300;
  - every migration name in a private repo.
- **`pages.yml`:**
  - **A wrong-branch manual run looks green.** It skips both jobs and shows success.
  - **Mixed runners:** `ubuntu-24.04` for build, `ubuntu-latest` for deploy.
  - **Transient errors read as published source.** The 404 checks have 2 tries, so a passing `000` or 5xx reads as "published source" with a roll-back instruction.
  - **The version doesn't identify a deployment.** A same-version deploy (a docs merge, a re-run) checks the previous deployment. Publish a marker with `GITHUB_SHA` and wait for that.
- **`tests.yml`:**
  - `webkit-save`'s `always()` also runs when the run is cancelled; `!cancelled()` doesn't.
  - If `download-artifact` fails, the push step is skipped, so its "no results" fallback is dead code (`continue-on-error` on the download fixes it).
  - The `rules` and `chrome` checkouts still persist the token.
- **Privacy text:**
  - For an attending, the Send box omits "left against advice" and "bedded before registration". `cbArgs` sends both for either role (`ui.js:2220` vs `:2226`).
  - About's list doesn't name the class code itself.
- **Docs:**
  - `supabase/README.md:31`'s name rule omits middle dots, geresh, joiners, enclosing marks and full-width forms, and still says "no @". A double blank line at `:64-65`.
  - README "Development" says "six suites, 310 checks" (it's 12 suites plus golden, 694 ok) and lists no `db:test` or `db:live`.
  - The changelog still runs v0.31.0, v0.29.1, v0.30.0.
- **No `.gitattributes`.** A Windows checkout with `autocrlf` makes the frozen file CRLF, and `run.sh` then reports "an applied migration was edited".
- **Carry-overs still open:**
  - migrations run as superuser in `run.sh`;
  - `locale -a | grep -q` under `pipefail`;
  - the `stubs.sql` cron stand-in;
  - `build.js` puts `contact` into a `<script>` through `JSON.stringify`, which doesn't escape `</script>`;
  - `tidy()` keeps yesterday's salt;
  - Node 22;
  - cone-mode sparse checkout;
  - actions pinned by tag.

## 4. Coverage

**Read:**
- `git diff 6328cdf..18a71f9` for `.github/`, `supabase/` (the round-6 migration in full, `run.sh`, `applied.sha256`, the README, the start of the `privacy_test.sql` diff), `test/db_live.js`, `tools/name_ranges.py`, CLAUDE.md, README (the v0.31.0 paragraph, "For a class", "Development"), `docs/SMOKE.md`.
- In `src/ui.js`: `cbFetch`, `cbKeys`, `cbRegister`, `cbRegHTML`, `cbRow`/`cbDet`, `cbListHTML`, `cbTable`, `cbArgs`, `cbWhatAll`, `cbSendHTML`, `aboutHTML`, the gate.
- `sw.js`, the built CSP, migration 1's helpers and guard, the baseline's transaction and gate.
- BRIEF rounds 4 to 7, round-6 STATUS, my round-6 report.
- Third-party sources fetched from raw.githubusercontent.com:
  - the `actions/upload-artifact` v4 and `download-artifact` v4 READMEs;
  - Supabase's `packages/shared-data/pricing.ts` and `apps/docs/.../observability/logs.mdx` (log retention);
  - GitHub's `what-is-github-pages.md`.

**Ran:**
- `npm run db:test`: 193 ok, exit 0, 2.8 s, on PG 16.15 with C.UTF-8. Again under en_US.UTF-8 after generating the locale: 193 ok.
- `bash -n`: clean. shellcheck 0.11.0 as above. actionlint 1.7.12 (with shellcheck) on both workflows: clean.
- A scratch rebuild: `index.html`, `sw.js` and `3d/map3d.js` byte-identical to the committed files.
- `npm test`: 694 ok, 0 FAIL, 45 s. `npm run stress`: exit 0, 42 s.
- `class_test.py` ×2 from a scratch copy: 86 ok each, about 59 s.
- `test/db_live.js` against a local Postgres behind a PostgREST stand-in that honours `Prefer: timezone`:
  - pass, including the real minute-55 wait (91 s);
  - only migration 1 live (behind);
  - a newer migration live (ahead);
  - a skipped migration;
  - cron off with one overdue class;
  - regressed time-zone limits, run with the shipped probe and with an alternating copy;
  - round 6 applied with its zero-width characters stripped;
  - `540` paused, `404 PGRST202`, and a stalled body;
  - `SKIP_DB_CHECK` set to 1 with no reason, a blank reason, a reason, and a reason with a newline; and set to 0.
- `run.sh` on scratch copies:
  - the self-record removed;
  - the frozen file edited;
  - an early unapplied file;
  - a misnamed file.
- The pg_cron remedy after round 6.
- A worst-case row-size measurement (20,000 rows).
- A routed Playwright run of the gate with `cb_gate_*` answering 404.
- A secret scan of the diff: only the publishable key. No `sb_secret_`, JWT, bcrypt hash, token or private key.

**Couldn't check:**
- PostgreSQL 17: apt.postgresql.org is unreachable from here. I added the PGDG source to try it and removed it afterwards; the locale I generated stays.
- A real Actions run of either workflow.
- The live project or site (barred).
- The `github-pages` environment rules.
- Whether `upload-artifact@v4` refuses on a re-run.
- bash 3.2.

## 5. What I'd keep
- **`db_live.js`'s shape now:**
  - one diagnosis when the health check doesn't answer;
  - separate wording for a live database that is equal, ahead or behind;
  - the skipped-migration list;
  - a random probe key;
  - lost probes reported as lost;
  - `SKIP_DB_CHECK === '1'` plus a required reason.
- **The freeze:** `applied.sha256` and both `run.sh` rules, the edited-file check and the sorts-after check. Close the listing gap (R2.7-06) and it does what R2.6-03 asked.
- **`run.sh`'s refusal checks:** they now match their own messages, are NULL-proof, and check the baseline without ON_ERROR_STOP.
- **The live-site check:** version first, `continue` past a site that never updates, short budgets for the 404s.
- **The WebKit split:** tests with no push token, a separate job that pushes data only.
- **Job-level permissions:** `pages: read` for build, `write` and `id-token` only on deploy, `persist-credentials: false` where project code runs.
- **The privacy text:** a list with key words in bold, and log retention now stated with a figure that matches Supabase's own pricing data.
