# Reviewer 2, round 9: DevOps, tooling, CI and legal

Branch `claude/sleepy-rubin-jot35n` at `ba471b7` (v0.31.0). Reviewed: the round-8 fixes (`git diff 87c9c13..ba471b7 -- src supabase test tools .github build.js package.json CLAUDE.md README.md docs/SMOKE.md`), and the second migration as the owner will paste it. Nov 25, 2026.

**CI status (read from the GitHub REST API, read-only):**
- `origin/main` is still `815e279` (v0.30.0). `origin/3d` is still `0619766`.
- This branch is pushed (`ba471b7`), but `tests.yml` runs only on `main` and `3d`. So **still no workflow run for any Phase 2 commit**. None of these has ever executed on GitHub:
  - the `database` job on PostgreSQL 17, now with the fingerprint and `name_ranges.py --check`;
  - the deploy's `contract` job;
  - the reworked Deploy workflow with `deploy.txt`;
  - `db-watch.yml` and its issue step.
- The repo has issues enabled (`has_issues: true`), so the watch's `gh issue create` can work.

**The migration as reviewed.** `20261125120000_codeblack_round6.sql`:
- SHA-256 `32b43a2ec456c81c01b803bd4985190e4c73c37beb5c71dc98fef163726316e1`;
- functions' fingerprint `ba875605562fd90e2834ae94141f2373`;
- 0 non-ASCII bytes and 0 CRs in the whole file, comments included.

The owner should compare the SHA with what he pastes. The same line goes into `applied.sha256` afterwards.

I did not contact supabase.co or edcodeblack.com. Every database request in my scripts went to a local PostgREST stand-in on a throwaway PostgreSQL 16 cluster. Scratch: `scratchpad/round9/r2/`.

## 0. Round-8 status

| ID | Was | Status | Evidence |
|---|---|---|---|
| R2.8-01 Retention statements said the code is deleted with its results | Low | **Fixed** | The hold now appears where the instructor sees it and in the docs: the registration box (`ui.js:2150`: "Results are deleted on X … The code is then held 30 more days with only its key's hash"), the typed-key error (`ui.js:2737`: "its results are deleted …"), `README.md:55` and `CLAUDE.md:141`. The backstop counts live classes only (migration `:242-243`, `cb_health` `:382`), and `supabase/README.md:39` says so. I checked the count by hand (R2.9-04). |
| R2.8-02 The live-site check tested the previous deployment | Low | **Fixed** | `pages.yml:111` writes `deploy.txt` with `$GITHUB_SHA $GITHUB_RUN_ID $GITHUB_RUN_ATTEMPT`. `:178` waits for `"$GITHUB_SHA $GITHUB_RUN_ID"` first, with 30 tries. Then come `index.html`'s version (6 tries), the 12 `gone` checks, the cache name and `map3d.js`. The attempt number is left out of the marker, so re-running only the deploy job still matches. The comment at `:144-147` still describes the old order (R2.9-05b). |
| R2.8-03 The runbook contradicted the gate | Low | **Fixed** | `supabase/README.md:56` now calls a missing or paused job a failure and gives the `cron.schedule`/`cron.alter_job` lines; `db_live.js:70` prints the same lines. `:57` covers both `applied.sha256` mismatches. Step 1 (`:48`) requires a migration to schedule the job again. `CLAUDE.md:158` says `rules13.js`. README `:238` lists `db:live`. A new fingerprint entry (`:58`) has a remedy that doesn't always work (R2.9-02). |
| R2.8-04 Nitpicks (15) | Nitpick | **Partly fixed** | 10 fixed, 2 partly, 2 open, 1 worse; per item below. |

**R2.8-04 by item:**
- **a. Partly fixed.** The comment is now correct (`name_ranges.py:58`), and CI runs `--check` on Python 3.13 (`tests.yml:59-62`; 3.13 passes here). But under `/usr/bin/python3.12` the refusal at `:63` still says "This Python has Unicode 15.0.0 … Use Python 3.12 or 3.13" (exit 1).
- **b. Fixed** by wording: "about half full or more … to a tenth".
- **c. Fixed.** `!cancelled()` (`pages.yml:77,124`). actionlint 1.7.12 is clean.
- **d. Worse.** `run.sh:38` now pipes through `sed 's|.*/||'`. The `.*` is greedy, so on a code line that itself contains `/`, the file name, the line number and the start of the code all go. I put a U+200B after `'2000::/3'` (`:102`) in a scratch copy. The whole report was `3'​::pg_catalog.inet)   -- IPv6: global unicast only`: no file, no line. Many code lines have a `/` (CIDRs, `/48`, `/56`). Use `sed 's|^[^:]*/||'`.
- **e. Partly fixed.** `db_live.js:58` now names malformed lines. But the wrong diagnosis still follows it (`:62-63`). With CRLF, `*` or a path prefix (all three reproduced), the output is:
  - `FAIL malformed line(s) …`, then
  - `FAIL applied live but not in supabase/migrations/applied.sha256: …20261124120000…, …20261125120000…. Add its line`.

  Also, `l.slice(0, 100)` cuts each 112-character line before the trailing `\r`. So in the CRLF case the quoted "malformed" line looks well formed.
- **f. Fixed.** `:87-88`: "couldn't confirm … (401: the key changed; 429: rate-limited)".
- **g. Fixed.** `db-watch.yml:19` runs on `ubuntu-24.04`.
- **h. Fixed.** The ref name goes through `env:` (`pages.yml:34-36`).
- **i. Fixed.** The PGDG candidate check and the 8-minute step limit are in `tests.yml:48-51`. `webkit-save`'s download has `continue-on-error` (`:173`), so its fallback can now run.
- **j. Fixed.** Migration `:293`.
- **k. Still open.** shellcheck 0.11.0 on `run.sh`: SC2010 ×3 (`:23,32,57`) and SC2012 (`:20`). `bash -n` is clean.
- **l. Fixed.** `build.js:29` escapes `<` in `IMGCREDIT`, and the rebuild is byte-identical.
- **m. Fixed.** `CLAUDE.md:19`.
- **n. Still open, and grew.** `class_test.py` has 76 fixed `wait_for_timeout` sleeps (68 at round 8). It still gates every deploy.
- **o. Fixed.** `supabase/README.md:68` says how to copy the gate out of the baseline.

**Counts:** 3 Fixed, 1 Partly fixed, 0 Still open, 0 Worse at the finding level. Inside R2.8-04, one item (d) is worse.

**STATUS claims that overreach:**
- **"so a stale or edited paste can't pass (R1.8-01)."** A stale draft can't pass: both real drafts I pasted fail. An edited one can. Two `ALTER FUNCTION … STABLE` lines leave the fingerprint at the committed value, and `db_live.js` exits 0 while every real registration fails (R2.9-01).
- **"In the migration, invalid calls are refused before they count against a network's limits."** True of `cb_class_new` only. `cb_submit` still counts first (`:272-275`) and validates after (`:276-282`). That is defensible for sends, but the sentence is general.
- **"docs and runbook corrected (… R2.8-01, R2.8-03 …)."** Several lines were left behind (R2.9-05b):
  - `supabase/README.md:26` (emails, not an issue);
  - `supabase/README.md:32` ("can't be reached at all", but `full` now offers it too);
  - `CLAUDE.md:21` and `:138`;
  - the `pages.yml` comment;
  - README's "five rounds".
- **`db-watch.yml:2`: "so the owner hears about it whatever his email settings".** An issue notification also follows his GitHub notification settings. He gets at least a web notification and a visible issue, which beats a failed-run email. But "whatever" is too strong.

## 1. Verdict

**Nothing in my area blocks the owner's paste, once the Tests workflow, its PostgreSQL 17 database job included, is green on `3d` at the commit he pastes from.**

**What I checked of the migration** (PostgreSQL 16.15, en_US.UTF-8 and C.UTF-8):
- it is pure ASCII;
- `db:test` passes (210 ok);
- the fingerprint is the committed one;
- the fingerprint is locale-independent;
- every real earlier draft is caught by it;
- `full`, `taken` before `full`, the own-key retry and held codes not counting all behave as documented (by hand: the suite doesn't test them, R2.9-04);
- re-pasting HEAD over a stale draft recovers.

**PostgreSQL 17 is still unproven.** apt.postgresql.org is refused by this container's proxy (403). Running a PostgreSQL 17 build from npm was refused by this session's permission system, and I did not work around it. The CI database job compares PostgreSQL 17's fingerprint with the committed file before any paste, so a 16/17 difference would show there first.

**Before the merge into `main`:**
- **Fix R2.9-03.** The student-facing privacy list is the one legal text that is now wrong: it leaves out a number the game sends.
- **Correct the fingerprint claim in STATUS and in the migration comment (R2.9-01).** Today it promises more than it checks.

The rest can follow.

## 2. Score

**8 / 10** (round 8: 8).

**What earned the points:**
- Every round-8 Low is fixed.
- The deploy now proves which deployment it is checking.
- A stale paste is now caught, end to end.
- The rebuild is reproducible.

**What costs the rest:**
- Still not one line of Phase 2 CI has executed on GitHub.
- PostgreSQL 17 is unproven.
- The fingerprint is sold as broader than it is, and its one-md5 failure can't be diagnosed.
- The privacy list missed the new number.
- One nitpick fix made the output worse.

## 3. New findings (worst first)

### R2.9-01 · Low · The fingerprint covers function bodies and settings only, and `db_live.js` never reaches a write path of `cb_class_new` or `cb_class_delete`. An edited database with broken registration passes the whole live check

- **Location:**
  - migration `:345-354` (`codeblack.fingerprint()`);
  - its comment `:344` ("a stale or edited draft can't pass");
  - STATUS "Needs the owner" ("a stale or edited paste can't pass");
  - `test/db_live.js:96-97` (the only `cb_class_new` probe: a bad version, refused at migration `:230-231` before anything is counted or written, since the R3.8-01 reorder);
  - `:92-93` (`cb_class_delete` with a made-up key, refused before any delete).
- **What the fingerprint omits:**
  - volatility (`provolatile`);
  - return type;
  - language;
  - default argument values (`proargdefaults`);
  - grants (`proacl`);
  - everything that isn't a function: constraints, indexes, the cron schedule.
- **Reproduction** (local cluster with stubs, baseline and both migrations: `scratchpad/round9/r2/live/setup.sh 9`, then `runshim.sh`; tree `tB` = repo plus the `applied.sha256` line):
  1. `alter function public.cb_class_new(text,text,text) stable; alter function public.cb_class_delete(text,text,uuid,boolean) stable;`
  2. `select codeblack.fingerprint()` gives `ba875605562fd90e2834ae94141f2373`, the committed value.
  3. `select public.cb_class_new('HJK-MNS','ABCDEFGHJKMNPQRS','0.31.0')` gives `ERROR: DELETE is not allowed in a non-volatile function`.
  4. `node tB/test/db_live.js` gives "All live database checks passed.", exit 0.
- **Same result as a pasted edit.** An edited migration with `cb_class_new` STABLE and `cb_health`'s default flipped to `true` (via drop and create) also gives the committed fingerprint and exit 0.
- **Why it's only Low:** an accidental paste is far more likely to fail or truncate than to change a volatility keyword, and the real stale drafts (`2f2b08d`, `32dbdae`) are caught. But the claim is wider than the check. And the live check now has no probe that would notice registration failing.
- **Fix:**
  - Add `p.provolatile`, `p.prorettype::regtype`, `pg_get_expr(p.proargdefaults, 0)` and `p.proacl` to `x`. Add `collate "C"` to the `order by` when you do (R2.9-05e).
  - Or say in STATUS and the comment what it covers.
  - Optionally, register one fixed probe code once (a class row with a key hash and no student data). Every later run then gets `taken`, which exercises `allow()`, the clean-up deletes and `key_hash`.

  It's a new migration if done after the paste.
- **Effort:** S.

### R2.9-02 · Low · A fingerprint mismatch can't be diagnosed, and the runbook's remedy can't fix two of its causes, so it blocks every deploy and opens a new issue every day

- **Location:**
  - `supabase/README.md:58` ("an older draft was pasted, or something was edited by hand. Paste the newest migration again from the green commit, then re-run.");
  - `db_live.js:56-57` (prints two md5s and the same remedy);
  - `db-watch.yml:31-37`.
- **What the remedy can't fix.** The fingerprint also covers:
  - the four functions only migration 1 makes (`norm_code`, `norm_key`, `key_hash`, `keyed_class`);
  - any function in `codeblack`;
  - any function in `public` named `cb_*` other than the gate's.

  Re-pasting migration 2 replaces none of the four, and drops no extras. Migration 1 refuses to run over migration 2.
- **Reproduction** (same cluster):
  1. Re-create `codeblack.keyed_class` with a trailing comment in its body. The fingerprint becomes `696a2dc6…`, and db_live FAILs.
  2. Re-run migration 2. Still `696a2dc6…`.
  3. Running migration 1 gives "A newer Code Black migration is already applied".
  4. `create function public.cb_debug() …` gives `768e8e7c…`. Re-running migration 2 leaves it at `768e8e7c…`.
- **Nothing says which function differs.** From then on:
  - every deploy needs `skip_db_check`, which also skips the PostgreSQL and class tests;
  - the daily watch opens one new issue per day.
- **What does work:** re-pasting HEAD over every real stale draft, which recovers (checked from `32dbdae`). The functions migration 1 leaves untouched are identical in every migration-1 draft that could be live (`46a0b03`, `7cb5613`, `2b51323`). So the likely cause recovers. The unlikely ones lock the owner out.
- **Fix:**
  - Commit a per-function list (`fingerprint.txt` as `regprocedure md5` lines; `run.sh` writes it).
  - Have `cb_health` return the per-function md5s, or give the owner the query in the README, so `db_live.js` can print which function differs.
  - Change the runbook remedy to "re-create that function from the newest migration that defines it; drop functions that aren't in any migration".
- **Effort:** S.

### R2.9-03 · Low · The privacy notice omits a number the game now sends (`mdArrestOpen`)

- **Location:**
  - `src/ui.js:2976` (About, Privacy, "An attending's own work: patients seen and how many died, diagnoses right and wrong, unsafe orders and their complications, and radio calls");
  - `ui.js:2250` (`cbWhatAll`: "your patients (and how many died), diagnoses, unsafe orders and radio calls");
  - `ui.js:2263`: the Send box calls About's list "The full list".
- **What is sent.** The game sends `mdArrestOpen: md ? n(R.mdArrestOpen) : null` (`ui.js:2246`). The server keeps it (migration `:173`). The instructor sees it as "left in cardiac arrest with no code running at the end" (`:2180`) and in the CSV (`:2230`).
- **Why it isn't covered by "how many died".** It is counted separately from deaths. It is a judgement on a named student's play.
- **Reproduction:**
  - `grep -n "mdArrestOpen" src/ui.js`: sent at `cbArgs`, shown at `:2180` and `:2230`;
  - `grep -n "An attending" src/ui.js`: no mention.
- **Fix:** add "and patients left in cardiac arrest with no code running" to both lists.
- **Effort:** XS.

### R2.9-04 · Low · The migration about to be frozen has round-8 branches with no automated test

- **Location:** `supabase/tests/privacy_test.sql` (no test reaches these):
  - `cb_class_new`'s `full` answer, which counts live classes only;
  - "taken" before "full";
  - an own-key retry not refused as full (migration `:241-245`);
  - the `health48` limit (`:371`);
  - `cb_submit`'s `full`/`all` (`:292-294`).

  The only `full` test is the 501st result to one class (`:196`).
- **Why it matters.** `full` now decides whether the game offers "Use it without results" (`ui.js:2654`, `codeNoRes`: `R.net || R.full`). After the paste, any later change to these lines goes into a new migration with no regression test.
- **What I checked by hand** (`scratchpad/round9/r2/live`, about 4 s), with 100,001 live classes:
  - a new code gives `{"error": "full"}`;
  - a code held by another key gives `taken`;
  - an own-key retry gives `ok`;
  - `cb_health` `classes` gives `1.0`.

  With the same rows ended, a new code gives `ok` and `classes` gives `0.0`. All correct today.
- **Fix:** put that script into `privacy_test.sql`, plus 1,001 `health48` calls from one IPv6 /48.
- **Effort:** S.

### R2.9-05 · Nitpick (7 items)

- **a. `run.sh:38` hides its own evidence** on any code line with a `/` (R2.8-04d, above).
- **b. Docs left behind by round 8:**
  - `supabase/README.md:26`: the watch "fails the run (GitHub emails the owner)", but it now opens an issue.
  - `supabase/README.md:32`: "if the server can't be reached at all, the instructor may use the code without results", but `full` offers it too (`CLAUDE.md:135` is right).
  - `pages.yml:144-147`: still says the version check comes first and is the 15-minute one.
  - `CLAUDE.md:21`: describes the live-site check as "the new version is in index.html", with no `deploy.txt` and no fingerprint stop.
  - `CLAUDE.md:138`: `cb_health`'s fields without `fp`.
  - `CLAUDE.md:14`: the published-files list lacks `deploy.txt`, `CNAME` and `apple-touch-icon.png`.
  - `README.md:55`: "five rounds of review", citing STATUS files only through round 6.
- **c. `db-watch.yml`:**
  - Every failing day opens a new issue (no `gh issue list --search … --state open` and comment).
  - `issues: write` is granted to the whole job that runs `node test/db_live.js`. The token isn't passed to it, but a separate `notify` job with `needs: watch` and `if: failure()` would be least privilege, as `webkit-save` is.
  - A job that hits `timeout-minutes: 10` is cancelled, and `if: failure()` doesn't run. That happens if health answers and the later calls stall: about 43 × 15 s.
  - A rollback to v0.30.0 removes `db-watch.yml` from `main`, which silently stops the watch. The rollback runbook doesn't say so.
- **d. `deploy.txt`** publishes the private repo's commit SHA and run ID on the public site. They're harmless, but undocumented (see b).
- **e. The fingerprint is locale-independent only by accident.**
  - `x` sorts as "C" because `pg_proc.prosrc` is a C-collated catalog column whose implicit collation wins over the default. `order by x collate "en_US"` gives `9d95a557…`.
  - Widening the fingerprint with `pg_get_functiondef()` or `regprocedure` text alone (R2.9-01's fix) would sort by the database's collation. Then `run.sh`'s C.UTF-8 fallback (`:52`) would print a different value and tell the developer to commit it.
  - Write `order by x collate "C"`.
- **f. The runbook's step 3** (`supabase/README.md:50`) checks only that `cb_health()` names the migration. Comparing `cb_health()->>'fp'` with `supabase/tests/fingerprint.txt` there would catch a stale paste before the merge, not in the deploy after it.
- **g. Top-level reads block the emergency skip.** `db_live.js:15-19` reads `applied.sha256` and `fingerprint.txt` at the top level, before the `SKIP_DB_CHECK` branch (`:36`). If either file is missing or unreadable, the emergency deploy crashes with a stack trace too.

## 4. Coverage

**Read:**
- BRIEF rounds 8 and 9;
- round-8 STATUS;
- my round-8 report;
- `git diff 87c9c13..ba471b7` for `.github/` (all three workflows in full), `test/db_live.js` (in full), `supabase/tests/run.sh` (in full), `fingerprint.txt`, `client_call.json`, `privacy_test.sql`, `build.js`, `tools/name_ranges.py`, CLAUDE.md, README and `supabase/README.md` (in full);
- the second migration in full;
- migration 1's history (`c941ede`, `46a0b03`, `7cb5613`, `2b51323`) for functions the fingerprint covers but migration 2 doesn't replace;
- in `src/ui.js`: the registration box, `cbListHTML`, `cbWhatAll`, `CB_WHO`, the Send box, About's Privacy, the typed-key error, the delete errors, `codeNoRes`, `cbArgs`, the export header;
- the engine diff (no new random draws).

**Ran:**
- **`npm run db:test`** on the repo: 210 ok, exit 0 (PostgreSQL 16.15, en_US.UTF-8). Again with `locale -a` faked to offer only C.UTF-8: passes, same fingerprint.
- **The fingerprint under explicit collations**, and the sort orders of the 20 function names.
- **`test/db_live.js`** against a local PostgREST stand-in (it honours `Prefer: timezone` and replaces `cf-connecting-ip`):
  - the repo as is: fails on `applied.sha256` only;
  - with the line added: all pass, deploy and watch;
  - stale drafts `2f2b08d` and `32dbdae` pasted instead: fail on the fingerprint;
  - a hand edit of `keyed_class`, and a stray `public.cb_debug()`, before and after re-pasting migration 2;
  - `ALTER FUNCTION … STABLE` on two API functions;
  - an edited paste (STABLE plus a flipped default);
  - `applied.sha256` with CRLF, `*` and a path prefix.
- **The `full` branch with 100,001 rows, by hand.**
- **`run.sh` on a scratch copy** with a raw U+200B on a code line containing `/`.
- **Lint:** actionlint 1.7.12 on all three workflows: clean. shellcheck 0.11.0 on `run.sh`: as above. `bash -n`: clean.
- **`name_ranges.py --check`** on Python 3.13.18 (passes) and 3.12.3 (refuses, with the old message).
- **A scratch copy of HEAD** (`git archive`):
  - the rebuild is byte-identical for `index.html`, `sw.js` and `3d/map3d.js`;
  - `npm test`: 709 ok, 0 FAIL, 28 s;
  - `class_test.py`: 95 ok, "No errors.".
- **A secret scan of the diff:** no `sb_secret_`, JWT, bcrypt hash, GitHub, AWS or Slack token, or private key. Only the publishable key, in the built `index.html`.
- **`gh api`** (read-only): runs, branches, issues enabled, visibility.

**Couldn't check:**
- PostgreSQL 17: the PGDG apt repository is blocked, and the npm build was refused by the permission system.
- Real pg_cron.
- Any Actions run of the changed workflows.
- The `github-pages` environment rules.
- The live project and site (barred).

## 5. What I'd keep

- **`deploy.txt` as the first live check:**
  - it names the run, not the build, so a docs-only merge is still checked against itself;
  - `RUN_ATTEMPT` is left out of the match, so re-running only the deploy job works.
- **The fingerprint's design:**
  - `run.sh` compares a fresh project with the migrated baseline and with the committed value;
  - `db_live.js` checks it only when the live migration is this release's, so rollbacks and "database first" still pass;
  - `cb_health` carries it, so the daily watch catches drift.
- **The CI hygiene:**
  - the PGDG candidate check with a step limit;
  - `name_ranges.py --check` on the Python that matches;
  - `!cancelled()`;
  - refs through `env:`;
  - `webkit-save` that can finally write its fallback.
- **The retention text** now matches the database everywhere an instructor reads it, held codes included. The student-facing promise ("deleted 30 days after the code was made") is true.
