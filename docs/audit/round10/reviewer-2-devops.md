# Reviewer 2, round 10: DevOps, tooling, CI and legal

Branch `claude/sleepy-rubin-jot35n` at `1ab6fa9` (v0.31.0). Reviewed: the round-9 fixes (`git diff 0541eeb..1ab6fa9 -- src supabase test tools .github build.js package.json CLAUDE.md README.md docs/SMOKE.md`), and the second migration as the owner will paste it. Nov 25, 2026.

**CI status (GitHub REST API, read-only):**
- `origin/3d` is now `1ab6fa9`. The Tests workflow ran there (run 45545391085) and **is green**: Rule checks, **Database rules on PostgreSQL 17.12** (en_US.UTF-8 cluster, C-locale fresh project, fingerprint `dcd21130…` = the committed one, 229 ok, `name_ranges.py --check` on Python 3.13.18 ok) and UI tests in Chrome. WebKit was skipped (it runs only for `main` or by hand).
- This is the first Phase 2 commit to run on GitHub. PostgreSQL 17 is no longer unproven: it gives the same fingerprint as 16.
- Still never executed: `pages.yml` (the `contract` job, `deploy.txt`, the live checks) and `db-watch.yml` with its new `notify` job. Both run from `main` only.
- `origin/main` is still `815e279` (v0.30.0).

**The migration as reviewed.** `20261125120000_codeblack_round6.sql`:
- SHA-256 `37efafd6101cf750dead06f029c105a9f4aaf900c6942d54a3e890deeb8224d4`;
- fingerprint `dcd21130a3b2c81b54b6a02804585d75` (`supabase/tests/fingerprint.json`), the same on 16.15 here and 17.12 in CI;
- 0 non-ASCII bytes and 0 CRs in the whole file.

The owner should compare the SHA with the file he pastes. The same line goes into `applied.sha256` afterwards. Any fix commit after `1ab6fa9` needs its own green Tests run before the paste.

I did not contact supabase.co or edcodeblack.com. Every database request in my scripts went to a local PostgREST stand-in on a throwaway PostgreSQL 16 cluster. Scratch: `scratchpad/round10/r2/` (`live/` has the cluster, stand-in and SQL; `ui/keep.py` the device check; `tree/` a `git archive` of HEAD).

## 0. Round-9 status

| ID | Was | Status | Evidence |
|---|---|---|---|
| R2.9-01 The fingerprint covered bodies and settings only | Low | **Fixed** | `fingerprint_parts()` (migration `:356-398`) now hashes volatility, strictness, return type, argument names and defaults, grants, every codeblack table and the cron job. My round-9 reproduction now fails as it should: `alter function public.cb_class_new(text,text,text) stable` (and `cb_class_delete`) gives fingerprint `79f1f64e…` and db_live exits 1 on the fingerprint line. The optional write probe is an owner decision (STATUS). What it still misses is new finding R2.10-04. |
| R2.9-02 A mismatch couldn't be diagnosed, and the remedy couldn't fix two causes | Low | **Partly fixed** | Diagnosis works: `fingerprint_parts()` names the object, and `run.sh` lists the differing keys (I changed `allow('class', 60)` to 61 in a scratch copy: it printed `f public.cb_class_new(text,text,text)` and the replacement file). The daily watch now keeps one issue. **The remedy is still wrong for the same two causes.** `supabase/README.md:58` now says "A function: paste the newest migration again … (it re-creates every function)". It doesn't. Migration 2 never creates `norm_code`, `norm_key`, `key_hash` or `keyed_class`, and re-pasting drops nothing. On the local cluster: hand-edit `codeblack.keyed_class`, add `public.cb_debug()`, and move the cron schedule to `7 * * * *`. Then re-paste migration 2: the cron part is fixed, but `f codeblack.keyed_class(text,text)` and `f public.cb_debug()` still differ, and migration 1 refuses to run ("A newer Code Black migration is already applied"). db_live's own text (`:58`, "re-create it from the migration that makes it … for most") is closer, but it never says to drop an object that isn't in `fingerprint.json`. |
| R2.9-03 The privacy notice omitted `mdArrestOpen` | Low | **Fixed** | About (`ui.js:3013`) and the Send box (`ui.js:2281`) now name arrests left at the end and deaths after a code (`mdCodeLost`, also in `client_call.json` and `clean_stats`). The same edit added a number the game never sends (R2.10-01). |
| R2.9-04 The migration's round-8 branches had no tests | Low | **Partly fixed** | Now tested (`privacy_test.sql:318-383`): `full` over 100,001 live classes, "taken" before "full" (live and held), the own-key retry, turning a held class back on, `cb_health` `classes`/`held`, the `health48` limit, and 700 junk sends. Still untested: `cb_submit`'s service-wide `{"error":"full","scope":"all"}` (only `scope: class` at `:196`). The new round-9 cap is untested too (R2.10-03). |
| R2.9-05 Nitpicks (7) | Nitpick | **Partly fixed** | 4 fixed, 2 partly fixed, 1 still open (below). |

**R2.9-05 by item:**
- **a. Still open.** `run.sh:38` still pipes through the greedy `sed 's|.*/||'`.
- **b. Partly fixed.** Fixed: `supabase/README.md:26` and `:32`, `CLAUDE.md:14`, `:21` and `:138`. Two remain:
  - The `pages.yml:144-148` comment still gets the order wrong. It says the cache name is checked before the 404s. The script does `deploy.txt`, `index.html`, the 12 `gone` checks, `sw.js`, then `3d/map3d.js`, which the comment doesn't name.
  - README `:55` now says "eight rounds of review of the fixes". Rounds 5 to 9 reviewed fixes, which is five (six with round 4).
- **c. Partly fixed.** Fixed: a separate `notify` job with `issues: write` only, one open issue that later failures comment on, and the step's 8-minute limit inside the job's 10 (actionlint 1.7.12 clean). Open: nothing says that a rollback to v0.30.0 removes `db-watch.yml` from `main` and so stops the watch (`supabase/README.md:64`, CLAUDE.md "Rolling back").
- **d. Fixed.** `deploy.txt` is documented (`CLAUDE.md:14`, `pages.yml:144`).
- **e. Fixed.** Every list in `fingerprint_parts()` and `fingerprint()` sorts `collate "C"`. `run.sh:88` builds the fresh project in the C locale and requires the same value as the en_US cluster. It passed here (16.15) and in CI (17.12).
- **f. Fixed.** Runbook step 3 (`supabase/README.md:50`) compares `fp`.
- **g. Fixed.** `db_live.js:11-16` runs the skip before any `require` or file read. In an empty scratch folder holding only `test/db_live.js`:
  - with `SKIP_DB_CHECK=1` and a reason: the warning, exit 0;
  - with a blank reason: FAIL, exit 1.

**Carried over from round 8, unchanged:**
- **R2.8-04a.** Under Python 3.12, `name_ranges.py --check` still says "This Python has Unicode 15.0.0 … Use Python 3.12 or 3.13".
- **R2.8-04k.** shellcheck 0.11.0 still flags `run.sh` with SC2010 ×3 (`:23,32,57`) and SC2012 (`:20`).
- **R2.8-04n.** `class_test.py` now has 95 fixed `wait_for_timeout` sleeps, up from 76.

**Counts:** 2 Fixed, 3 Partly fixed, 0 Still open, 0 Worse.

**STATUS claims that overreach:**
- **"the runbook says … what fixes each kind".** It doesn't for a function only migration 1 makes, or for an extra object (R2.9-02 above).
- **"the Send box and About list every number sent".** They also list one that isn't sent (R2.10-01).
- **"Round 8's server branches had no tests … privacy_test.sql fills 100,001 live classes …"** True. But the test headed "R3.9-01: at most 30,000 held codes, the oldest let go first" (`privacy_test.sql:401`) checks only that `cb_health` has a `held` key (R2.10-03).
- **The migration comment** (`:350-355`) says "a stale or edited draft, or a hand edit to anything here, can't pass". The README (`:42`) says "it catches a stale or edited paste". A trigger or a public view that exposes every result passes (R2.10-04).
- **"A read-only look at the live project … the same grants as the local copy".** I can't verify this (barred). The PostgreSQL 17 CI result is consistent with it.

## 1. Verdict

**Nothing in my area blocks the owner's paste at `1ab6fa9`.** Its Tests run, the PostgreSQL 17 database job included, is green.

**Retention holds.** I traced every path that sets `created_at` or `expires_at`:
- a first result within 14 days;
- revival by a late first result;
- revival by a refused send;
- the own key turning a class back on;
- a live retry;
- a used class after its end;
- the 30,000 cap.

In every one, a result is deleted within 30 days of the class's first result. The only exceptions are the clean-up job's lag of up to an hour, and the 500-class batch in `cb_class_new` if pg_cron is down, which the watch reports. So the student-facing promise is true: About's "How long" and `CB_WHO` ("within 30 days of the class's first result").

**Decide two things before the paste.** After it, each needs a new migration:
- **R2.10-05:** one `contype` filter, so a PostgreSQL 18 upgrade doesn't break every deploy.
- **R2.10-04:** whether the fingerprint should also cover triggers, policies, owners and views over the results.

Both change `fingerprint.json` and need a new green run.

**Before the merge into `main`:**
- **Fix R2.10-01.** The student privacy list names a number the game doesn't send.
- **Fix the runbook remedy** (R2.9-02).
- **R2.10-02 is a client-only fix** and can ride along.

## 2. Score

**8 / 10** (round 9: 8).

**What earned the points:**
- Phase 2 finally ran on GitHub, green, with PostgreSQL 17 giving the committed fingerprint.
- The fingerprint now catches what I broke last round.
- The emergency skip can't be blocked by a file.
- The watch has least privilege and one issue.
- The retention promise holds on every path.

**What costs the rest:**
- Round 9 wrote a new privacy-list error.
- The device forgets keys while results are still live.
- A new database branch with no test.
- A runbook remedy that is wrong in writing.
- A fingerprint that will break on the next PostgreSQL major version.

## 3. New findings (worst first)

### R2.10-01 · Low · The privacy notice lists a number the game never sends: "how quickly the sickest patients were seen"

- **Location:** two lists, both added in round 9 (`9609482`), the same commit that claimed "every number sent":
  - About, Privacy, "The department" (`src/ui.js:3012`);
  - the Send box (`cbWhatAll`, `src/ui.js:2282`).
- **What is sent.** `cbArgs` (`ui.js:2270-2279`) sends these stats: `wait`, `lwbs`, `seen`, `ama`, `expired`, `bedFirst`, `fired`, `walkout`, `fast`, `dxRight`, `dxWrong`, `mdSeen`, `harm`, `radioRight`, `radioWrong`, `radioMiss`, `mdDied`, `contra`, `unneeded`, `mdArrestOpen`, `mdCodeLost`, `endMin`.
  - None of them measures time for the sickest (ESI 1-2) patients.
  - `wait` is the mean door-to-provider wait over all arrivals (`cbDet`: "(all arrivals)").
  - `fast` is the share of time sped up. The same lists already name it as "how much was sped up".
  - The server keeps the same key list (`clean_stats`, migration `:172`).
- **Why it matters.** A privacy notice must say what is collected. This one now says something false, in the place a student reads before tapping Send.
- **Reproduction:**
  - `grep -n "sickest patients were seen" src/ui.js` gives `:2282` and `:3012`;
  - compare with the `p_stats` keys in `cbArgs` and in `supabase/tests/client_call.json`.
- **Fix:** delete "how quickly the sickest patients were seen" from both lists.
- **Effort:** XS.

### R2.10-02 · Low · The device forgets a revived class's key while the server still holds its results

- **Location:**
  - `src/ui.js:2075` (`CB_KEEP = 60 * 864e5`, commented "the life plus the server's 30-day hold");
  - `ui.js:2129` (`cbKeys()` drops any key with `t + CB_KEEP <= now`, and the next `cbKeySave` writes the filtered map back);
  - `CLAUDE.md:141` ("The device keeps a key 60 days from when its class was made (its life, then the hold)").
- **What changed in round 9.** A late first result now restarts an unused class (migration `:289-293`): `created_at = now()`, `expires_at = now() + 30 days`. A code made on day 0, unused, ends on day 14. A first result on day 43 runs it to day 73, held to day 103.
- **Where the device falls behind.** The device learns the new `created` only if the instructor opens Results after the revival (`ui.js:2762` updates `t` on a read). Otherwise it still has `t` = day 0 and drops the key on day 60. From then until day 73, the instructor has no row and no key on that device. So they can't read the results, or delete any. About still says "Sooner: ask your instructor, who can delete any result".
- **Reproduction:** `scratchpad/round10/r2/ui/keep.py`, against the committed `index.html`, server calls aborted.
  1. Store two saved keys:
     - A: `t` = now − 61 days, `e` = now − 47 days (made 61 days ago, ended unused on day 14);
     - B: `t` = now − 59 days.
  2. Open Class code, then Class results. Only B is listed ("ended Oct 11 with no results, unless a student has sent one since …"). A is gone, though a revival on day 43 would keep its results on the server until day 73.

  The server side of the revival is tested (`privacy_test.sql:385-394`).
- **Smaller effect:** after a read, the row's "made" date becomes the revival date (`ui.js:2228` prints `K.t`).
- **Fix:**
  - Keep a key 104 days (14 + 30 + 30 + 30), or until `max(t + 60 days, e + 30 days)` where `e` comes from the last answer.
  - Correct the `CB_KEEP` comment and CLAUDE.md.
- **Effort:** XS (client only, no database change).

### R2.10-03 · Low · The new 30,000 held-code cap has no test, though the test file claims one

- **Location:**
  - `supabase/tests/privacy_test.sql:401-402`: the heading reads "R3.9-01: at most 30,000 held codes, the oldest let go first, and the health check reports how many". The only check is `cb_health(false) ? 'held'`.
  - The branch it should cover: migration `:239-241`.
- **Why it matters.** This branch deletes up to 1,000 class rows per call, cascading to their results through the foreign key. It goes live frozen with this paste, and any later change to it goes into a new migration with no regression test.
- **What I checked by hand** (`scratchpad/round10/r2/live/cap.sql`):
  - 30,001 held classes give `cb_health` `held` `1.0`.
  - One `cb_class_new` (22 ms) leaves 29,001 held, the oldest 1,000 gone.
  - db_live then warns (deploy) and FAILs (watch) on "held codes are about half their cap".

  It works today.
- **Fix:** put that script into `privacy_test.sql`, with one more case: a held code released by the cap can be taken by another key.
- **Effort:** S.

### R2.10-04 · Low · The fingerprint ignores triggers, policies, owners, schema grants and views over the results; an edit that copies or exposes every result passes the live check

- **Location:**
  - `codeblack.fingerprint_parts()` (migration `:356-398`);
  - its comment `:350-355` ("a stale or edited draft, or a hand edit to anything here, can't pass");
  - `supabase/README.md:42` ("it catches a stale or edited paste").
- **What it omits:**
  - `pg_trigger` on codeblack tables;
  - `pg_policy`;
  - `relforcerowsecurity`;
  - `proowner` and `relowner` (a SECURITY DEFINER function runs as its owner);
  - the `codeblack` schema's `nspacl`;
  - any view, function or table outside `codeblack` that reads a codeblack table.
- **Reproduction** (local cluster, `live/setup.sh 9`, then `runshim.sh`, `fpdiff.sh` and `node tB/test/db_live.js`):
  1. `create function public.copyit() returns trigger … security definer …; create trigger t_leak after insert on codeblack.results … execute function public.copyit();`
  2. `create view public.cbv as select * from codeblack.results; grant select on public.cbv to anon;`
  3. Also `create policy … on codeblack.results`, `force row level security` and `grant usage on schema codeblack to anon`.

  Result: `fpdiff.sh` reports no difference, and db_live gives "All live database checks passed.", exit 0.

  On the real API, `GET /rest/v1/cbv` would return every result to the publishable key. The view runs as its owner. db_live probes only `cb_results` and the codeblack tables through `Accept-Profile`.
- **Why only Low.** The threat this check exists for is a stale or accidentally edited paste from this repo, and no draft ever had a trigger or view. But the docs promise more than the check does, and the project is shared with Case Room's migrations.
- **Fix, before the paste:**
  - Add to the table part: `relforcerowsecurity`, `relowner::regrole`, the non-internal triggers (`pg_get_triggerdef`), and the policies (`polname`, `polcmd`, `pg_get_expr(polqual)`, roles).
  - Add to the function part: `proowner::regrole`.
  - Add one part for the schema's `nspacl`.
  - Add one part listing every `pg_depend` or `pg_rewrite` dependant of a codeblack table that is outside `codeblack`.
  - Or narrow the two sentences to what is hashed.
- **Effort:** S (it changes `fingerprint.json`, so a new green run).

### R2.10-05 · Low · The fingerprint depends on the PostgreSQL major version: on PostgreSQL 18 every table part changes

- **Location:**
  - migration `:386` (`… from pg_catalog.pg_constraint o where o.conrelid = c.oid`, with no `contype` filter);
  - `run.sh:20` (picks the newest installed PostgreSQL);
  - `run.sh:4`, `supabase/README.md:25` and `CLAUDE.md` ("PostgreSQL 15 or newer").
- **The change in 18.** PostgreSQL 18 stores every column's NOT NULL as a row in `pg_constraint` (`contype 'n'`, "Store column NOT NULL specifications in pg_constraint" in the 18 release notes). `pg_get_constraintdef` prints those rows as `NOT NULL <col>`. Every `t …` part already includes `attnotnull`. On 18 it gets the same facts again in the constraint list, so its md5 differs from 15 to 17.
- **The consequences:**
  - **Locally.** On a machine with 18, `npm run db:test` fails with "what the migrations make has changed … replace supabase/tests/fingerprint.json with: …". That is an instruction which, if followed, breaks CI (17) and the live check.
  - **On live.** If the owner upgrades the Supabase project to 18, the deploy and the daily watch fail on "the live database differs". Every runbook remedy then fails: no hand change, re-paste or drop fixes it. It needs a new migration.
- **Reproduction:** not run here; this container has 16 only and apt.postgresql.org is refused. With 18 installed: `PG_BIN=/usr/lib/postgresql/18/bin npm run db:test`. The `t classes`, `t migrations`, `t rate`, `t results` and `t salt` parts should differ.
- **Fix, before the paste:**
  - Add `and o.contype <> 'n'` at `:386`. On 15 to 17 it is a no-op, apart from the function's own body hash.
  - Add a runbook line: "a PostgreSQL major upgrade can change the fingerprint: run the Tests workflow on the new version before upgrading".
- **Effort:** XS.

### R2.10-06 · Nitpick (12 items)

- **a. A refused send still revives a class.** `cb_submit`'s revival (migration `:289-293`) runs before the `dup`, `full`/`class` and `full`/`all` checks. A send refused as `{"error":"full","scope":"all"}` still restarts an ended, unused class for 30 days, with no result (`live/rev.sql`: made 20 days ago, ended 6 days ago; after the refused send it is live, made today, ending in 30 days, 0 results). The docs say a student's *first result* starts it. Harmless (no data), but it isn't what the docs describe. Move the revival after the cap checks, or undo it when nothing is inserted.
- **b. Retention lines left behind by round 9.**
  - README `:55`: "Everything sent for a code is **deleted 30 days** after the code was made; … starts it again, for 30 days". The second half contradicts the first.
  - The typed-key error (`ui.js:2771`): "its results are deleted 30 days after the code was made, or 14 if nobody sent one".
  - `CLAUDE.md:141`: "then 30 days from when it was made", and the revival is given no length.
- **c. The migration's header (`:3-31`)**, which the owner approves and pastes, doesn't mention round 9's changes:
  - the revival (a retention change);
  - the 30,000 cap;
  - `fingerprint_parts`;
  - `mdCodeLost` (it still says "four more numbers").
- **d. Two backstop sizes.**
  - `supabase/README.md:39` says 100,000 live classes are "about 25 MB with indexes". The migration (`:247`) says "about 15 MB".
  - Measured on 16.15: 15.6 MB (12.6 MB table). 30,000 held is about 4.7 MB, against the README's "about 8 MB".
  - Results: 238.5 MB per 300,000 with every stats key at 999999 matches "up to about 250 MB".
- **e. db_live's wording** (`:56-58`) still says "functions" for a fingerprint that covers tables and the job. Its remedy asks the owner to compare 31 md5 lines by eye on a phone. A one-line query does it: `select key from jsonb_each_text(codeblack.fingerprint_parts()) a full join jsonb_each_text('<parts from fingerprint.json>'::jsonb) b using (key) where a.value is distinct from b.value;`. db_live could print it with the repo's parts filled in.
- **f. `pages.yml:144-148`:** the comment's order (R2.9-05b, above).
- **g. `db-watch.yml`:**
  - The header (`:1-4`) doesn't mention held codes or the fingerprint.
  - It still says "whatever his email settings".
  - A passing day doesn't close or comment on the open issue.
  - A job-level timeout cancels the run, and then `notify` doesn't run.
  - Two runs at once (schedule plus a manual run) can both find no open issue and open two.
- **h. Held codes have no remedy.** Held codes past half fail the watch every day. "Backstops" (`supabase/README.md:39`) says to delete junk "(not held codes, which have no results by design)" and gives nothing else. An attack leaves up to 30 days of daily failure comments with nothing to do.
- **i. `run.sh` now needs `python3`** (`:99`, `:102`), but `:4` lists only PostgreSQL and bash. Without it, `want` is empty, the run says "what the migrations make has changed (… committed none)", and then dies on `python3: command not found` without printing the replacement.
- **j. README `:55`:** "eight rounds of review of the fixes" (R2.9-05b, above).
- **k. CLAUDE.md's release bullet** (`:19`) leaves out the step-3 check that `cb_health`'s `fp` matches `fingerprint.json`. STATUS's "Needs the owner" and the runbook both have it.
- **l. The run.sh fallback check is weak.** When en_US isn't available, the cluster is C.UTF-8 and the fresh project C. The "another locale" check then compares two code-point collations, and `run.sh:88`'s comment ("en_US, as live") doesn't hold.

## 4. Coverage

**Read:**
- BRIEF rounds 9 and 10;
- round-9 STATUS;
- my round-9 report;
- the full round-9 diff of `.github/` (all three workflows in full; `tests.yml` unchanged), `test/db_live.js` (in full), `supabase/tests/run.sh` (in full), `fingerprint.json`, `client_call.json`, `privacy_test.sql`, `supabase/README.md` (in full), CLAUDE.md, README and `src/index.template.html`;
- the second migration's diff, and `tidy`, `cb_class_new`, `cb_submit`, `fingerprint_parts`, `fingerprint` and `cb_health` in full;
- migration 1's expiry logic;
- in `src/ui.js`: `cbFetch`, `cbNet`, `cbRegister`, the made box, the saved-code rows, `cbRow`/`cbDet`, `cbTable`, `cbArgs`, `cbWhatAll`, `CB_WHO`, the Send box, About's Privacy, the typed-key error, `cbKeys`/`CB_KEEP`;
- the engine diff (no new random draws, no new storage or network calls).

**Ran:**
- **`npm run db:test`:** 225 ok, "ALL DATABASE CHECKS PASSED" (PostgreSQL 16.15, en_US.UTF-8, 3 s).
- **CI logs (read-only):** the `3d` Tests run at `1ab6fa9`, all jobs green, with PostgreSQL 17.12 giving the committed fingerprint.
- **`test/db_live.js` against a local PostgREST stand-in** on a cluster with the baseline and both migrations:
  - the repo as is: fails on `applied.sha256` only;
  - with the line added: all pass, deploy and watch;
  - with 29,001 held: warns, and FAILs in watch;
  - `ALTER … STABLE`: FAIL on the fingerprint;
  - trigger plus public view: passes (R2.10-04).
- **`fpdiff.sh`** after each hand change: volatility, a table grant, a trigger, a view, a policy, FORCE RLS, a schema grant, `keyed_class`, `cb_debug()`, the cron schedule. Then a re-paste of migration 2, and migration 1 over it.
- **By hand:**
  - the revival, by a result and by a refused send;
  - the 30,000 cap;
  - the table sizes (100,000 classes and 30,000 max-stats results);
  - the emergency skip in an empty folder.
- **`run.sh` on a scratch copy** with a changed migration: names the object and prints the file.
- **Lint:** actionlint 1.7.12 with shellcheck on all three workflows: clean. shellcheck 0.11.0 on `run.sh`: the four old notes. `bash -n run.sh` and `node --check db_live.js`: clean.
- **A scratch copy of HEAD** (`git archive`):
  - rebuild byte-identical for `index.html`, `sw.js` and `3d/map3d.js`;
  - `npm test`: 717 ok, 0 FAIL, 29 s;
  - `class_test.py`: 107 ok, "No errors.";
  - Playwright `ui/keep.py` (R2.10-02).
- **`name_ranges.py --check`** on 3.13 and 3.12.
- **A secret scan of the round-9 diff:** no `sb_secret_`, JWT, bcrypt, GitHub, AWS or Slack token, or private key. `backend.json` unchanged.

**Couldn't check:**
- PostgreSQL 18 (R2.10-05 is from its catalog change, not a run).
- Real pg_cron and its row security.
- Any run of `pages.yml` or `db-watch.yml`.
- The `github-pages` environment rules.
- The live project and site (barred).

## 5. What I'd keep

- **The fingerprint per object:**
  - it is C-collated;
  - `run.sh` names the differing objects and prints the replacement;
  - its value matched across 16 and 17, and across en_US and C.
- **The emergency skip** ahead of every file read.
- **The watch's `notify` job:** least privilege, one issue, a step timeout inside the job's.
- **`cb_submit` validating before it counts.**
- **The retention design:** every path I traced deletes a result within 30 days of the class's first result. About's "How long" and `CB_WHO` say exactly that.
- **The contract file,** which caught `mdCodeLost` on both sides.
