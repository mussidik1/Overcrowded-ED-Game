# Reviewer 2, round 4: DevOps, tooling, CI and legal

Branch `claude/sleepy-rubin-jot35n` at `ce11887` (v0.31.0). Reviewed: Phase 2 (`git diff 101e07a..ce11887`). Nov 24, 2026.
`origin/main` is `815e279` (v0.30.0, deployed today by "Deploy to Pages" run `45418798750`). `origin/3d` is `0619766`. Neither Phase 2 commit has been through CI.
Scratch: `scratchpad/round4/r2/`. I did not contact supabase.co or edcodeblack.com.

## 0. Status of R2-07 and the round-3 findings this phase touched

| ID | Was | Status | Evidence |
|---|---|---|---|
| R2-07 Backend not in version control | High | **Partly fixed** | **Fixed:** the schema, RLS, functions and gate are in `supabase/migrations/`, and 119 local checks include "anon can't read the results". The owner waived a separate project. **Still open:** nothing ties the repo to the live database. The baseline says "read from the live project", which nobody can check. Nothing records which files are applied. The newest migration isn't applied. No drift check exists (R2.4-03, R2.4-04). |
| R2.3-03 Post-deploy check version-blind | Medium | **Partly fixed** | **Fixed:** the version is now checked. Run `45418798750` logged `ok https://edcodeblack.com/index.html -> 200 (has "0.30.0")`. The custom domain is checked and the rollback is written down (CLAUDE.md:22). **Still open:** curl still has no `--max-time`, and the deploy job still has no `timeout-minutes`. The new DB step adds 10 more fetches with no timeout (R2.4-08). |
| R2.3-06 Merge deploys un-CI'd code | Medium | Fixed (process) | CLAUDE.md:21 requires green Tests on `3d` at the merge commit. The v0.30.0 merge `815e279` merged `0619766`, which passed Tests run `45412797811`. |
| R2.3-08 Docs wrong | Low | Still open | CLAUDE.md:155 still says "~520 'ok -' lines" (the commit says 694). New stale lines are in R2.4-12. |
| R2.2-13 Commit hygiene | Nitpick | Still open | The `c941ede` subject is 95 characters. One commit of 1,225 insertions mixes the migration, the UI, CI, docs and build outputs. |
| R3-15 Privacy disclosure (R3's finding; legal is my remit) | Medium | **Partly fixed** | **Fixed:** `autocomplete="off"`, a retention job, and text on what is sent, for how long and the US hosting. **Still open:** the finding's own fix asked for "a contact" and "who controls the data". Neither is there, and "only the instructor can read them" is false (R2.4-01). |

## 1. Verdict

**Don't apply the migration or merge yet.** The database work is real and mostly careful:
- The data guard works. I added a row, and the migration stopped and changed nothing.
- The suite fails loudly: a broken check exits 3.
- It runs as root or not.
- actionlint and shellcheck pass the workflows.

What's wrong is around it:
- The privacy notice still names **no operator and no contact**, and claims a read restriction the operator doesn't have.
- Nobody wrote down the order of "apply the migration" and "merge". The deploy's DB check has never run, and it can't catch the failure that already broke Send in production.
- The baseline file in `migrations/` silently reopens read-by-code if anyone re-runs it.
- The new CI job will test PostgreSQL **18.7**, not 16. `ubuntu-latest` became Ubuntu 26.04 this month, and the live major isn't recorded anywhere.

## 2. Score

**5 / 10** (round 3: 5). The backend in the repo with a real test harness is worth a point. A privacy notice that still fails its own finding, no migration-state tracking and an unplanned cutover take it back.

## 3. New findings (worst first)

### R2.4-01 · High · The Privacy notice names no operator or contact, and overstates who can read the data
- **Location:**
  - `src/ui.js:2726-2728` (`aboutHTML`, the Privacy section).
  - `src/ui.js:2072` (`cbSendHTML`: "Only they can see it").
  - `src/ui.js:2085` (`cbListHTML`).
  - `README.md:55`, which claims the section says "who can read it … and how to have it deleted".
- **What's wrong:**
  1. **No controller.** Nowhere in the game, the README or `supabase/README.md` names who runs the service. "The game's database (Supabase, hosted in the US)" says where the data is, not who holds it.
  2. **No contact.** There's no email, no form and no issue link. The only way to get a result deleted is "ask your instructor". An instructor who lost the key (new phone, cleared storage; the key lives only in `localStorage['oc-ckeys']`) can't delete anything. The student then has no path at all until day 30.
  3. **"Only the instructor who made the code can read them" is false.** These can also read every row of `codeblack.results`:
     - the project owner, through the Supabase dashboard and SQL editor;
     - anyone else with access to the project (it is shared with Case Room);
     - any Claude session holding the owner's Supabase connector (this audit session's tool list includes `execute_sql`);
     - Supabase as host;
     - anyone the 16-character key is copied to.
  4. **The field list is incomplete.** The notice lists "average wait, walkouts, patients seen". `cbSend` (`ui.js:2489-2491`) also sends:
     - AMA count;
     - **deaths** (`expired`);
     - beds before registration;
     - scenario, role, shift level, game version;
     - the class code and a per-result UUID.

     The server also stamps the time.
  5. **No use limits.** Nothing says the data isn't used for anything else, isn't sold, isn't shared with anyone, and isn't fed to AI tools. There are no terms of use.
  6. **No log retention.** "Supabase's own logs also see your address" doesn't say how long they keep it.
- **Why it matters:** the audience is US nursing, EM and paramedic programs, including high-school EMT programs. A program's compliance office handles FERPA "school official" use, state student-privacy agreements and a dean's sign-off. It needs an operator, a contact, a use limit and a deletion path before students type names into a third-party site. This notice gives none of them, and its central sentence is untrue. This was the phase's stated deliverable for R3-15.
- **Fix:**
  - Name the operator (a person or a project name) and give a contact (a role address or a GitHub issue link).
  - Say "the instructor with the key, and the site's operator for upkeep".
  - List every field.
  - Add one line: "used only to show your instructor your result; not sold or shared; not used to train AI".
  - Give Supabase's log retention for this plan, and link Supabase's privacy policy.
  - Add an operator-side delete path ("email us the class code and first name").
  - Update `about_test.py:171`, which pins the false sentence.
- **Effort:** S.

### R2.4-02 · Medium · No cutover order between the migration and the deploy, and no runbook for a red database check
- **Location:**
  - `CLAUDE.md:19-22` (release, merge and rollback) and `CLAUDE.md:140`.
  - `supabase/README.md:45-51`.
  - `pages.yml` (the "Check the database rules" step).
  - `src/ui.js:2027`, `ui.js:2056`.
- **What's wrong:**
  - **Merge before the migration:** v0.31.0 goes live calling `cb_class_new`, which doesn't exist yet (PostgREST 404).
    - Every instructor sees "Class results are off for this code. *Couldn't reach the server. Check the connection*". That's the wrong reason: `cbFetch` turns any non-2xx into that text.
    - Then `db_live.js` fails 4 of its 9 checks: `cb_class` still answers 200, and read, delete and submit answer 404. The deploy goes red **after** the site is already live.
  - **The docs give no response to that red.** CLAUDE.md's "Rolling back" covers only a published source file. The right response is to apply the migration, not to revert.
  - **Rollback after the migration:** `git revert -m 1` (CLAUDE.md:22) puts back a v0.30.0 client whose `cb_class` and `cb_results` the migration dropped. No reverse migration exists or is described.
  - **The correct order isn't written anywhere:** apply, verify, then merge. It's only implied by SMOKE.md's new Send step, which can't pass before the migration. SMOKE.md is the step the owner waived for Claude.
  - **The DB check is tied to the site deploy.** A database change gets no check until some unrelated push to `main`. That later deploy goes red for a cause it didn't introduce.
  - **It's skipped exactly when needed.** It runs only if the site check passed, so a red site check also hides the database state.
- **Fix:**
  - **Release steps:** add a line to CLAUDE.md and `supabase/README.md`: "1. owner applies the migration; 2. `db-live` workflow green; 3. merge".
  - **Workflow:**
    - Move `db_live.js` into its own `workflow_dispatch` + daily `schedule` workflow.
    - Keep it in `pages.yml` as `if: always()`.
    - Print "apply the pending migration" when `cb_class` still exists.
  - **Client message:** make `cbNet` say "the server refused (HTTP n)" for HTTP errors.
- **Effort:** S.

### R2.4-03 · Medium · The baseline is a runnable "migration" that silently reopens read-by-code and overwrites a Case Room function
- **Location:** `supabase/migrations/20261124000000_codeblack_baseline.sql`.
  - There's no `begin`/`commit` and no guard.
  - `:23-48` holds `create or replace function caseroom.client_ip()`.
  - `:135-144` holds `create function public.cb_class(text)` and its `grant … to anon`.
- **Reproduction** (`scratchpad/round4/r2/pg/run_guard.sh`):
  1. Apply the baseline, then the private migration.
  2. Run the baseline again. It exits 0.
  3. Afterwards: `public.cb_results back: true`, `cb_class(text) back: true`, `anon can execute cb_class: true`.
- **Why it matters:**
  - The file is named and placed exactly like a pending migration. `supabase db push`, an MCP `apply_migration`, or a session told to "apply the migrations in supabase/migrations" would run it against live, because its version isn't in the live migration history (the live history holds Case Room's names, per the file header).
  - That reopens R3-02's read-by-code function, empty for now.
  - It replaces Case Room's `caseroom.client_ip()` with a copy frozen at Nov 24. Meanwhile `supabase/README.md:6` says Case Room's objects "are not here".
  - `db_live.js` would notice only at the next deploy.
- **Fix (either):**
  - Move it to `supabase/baseline/`, and have `run.sh` load it explicitly before `migrations/`.
  - Or start it with `do $$ begin if to_regnamespace('codeblack') is not null then raise exception 'baseline: already past it'; end if; end $$;` and wrap it in a transaction.

  Either way, drop the `caseroom.*` definitions from anything that can run on live, and keep them only in `tests/stubs.sql`.
- **Effort:** S.

### R2.4-04 · Medium · Nothing records which migrations are live, and the live check can't see the failure that already broke production
- **Location:** `supabase/README.md:45-51`, `CLAUDE.md:140`, `test/db_live.js`.
- **What's wrong:**
  1. **No record of what was applied.** A paste into the SQL editor records nothing. `apply_migration` records the version and name given at call time, which needn't match the repo file. There's no `codeblack` version table, no `cb_version()` RPC and no applied-on log. The brief itself has to say "until the owner approves it, the live database is what the baseline records". That's state held in a human's memory.
  2. **No drift check.** `db_live.js` probes nine behaviours. It can't see grants, function bodies, the cron job, the salt, or whether `codeblack` is in the exposed schemas beyond one `Accept-Profile` probe.
  3. **It can't catch the failure that already happened.** The baseline (`:74-76`) records that the Nov 24 version-column migration left `ver` without an insert grant. Every v0.30.0 Send has been refused since (confirmed: `git show 101e07a:src/ui.js:2431` sends `ver`). Nobody noticed until this phase read the database. `db_live.js` never performs a valid submit, so a future migration that again refuses valid results would pass it.
  4. **It can't run on demand.** It can't run from this container, and the owner works from a phone. In practice it runs only when `main` deploys.
- **Fix:**
  - Have each migration end with `insert into codeblack.migrations(id) values ('<file stem>') on conflict do nothing`, plus an anon-callable `cb_schema()` returning the newest id. `db_live.js` asserts it equals the newest file in `supabase/migrations/`.
  - Add a canary class: register one code once, and keep its key as a repo secret. On each scheduled run, submit (fixed cid), read and delete-by-id.
  - Log applies in `supabase/APPLIED.md` (date, file, who approved).
- **Effort:** M.

### R2.4-05 · Medium · The "deleted after 30 days" promise rests on a job nobody has seen run
- **Location:**
  - The migration `:293` (`cron.schedule`).
  - `tests/stubs.sql:8-14`: a fake `cron` that only records the row.
  - `privacy_test.sql:35-36`: checks the name and command, never the schedule.
  - `privacy_test.sql:184`: calls `tidy()` by hand.
- **What's wrong:**
  - **Undocumented prerequisite.** The migration needs pg_cron enabled on the live project, and neither README nor CLAUDE.md says so. If pg_cron is missing, the whole transaction fails. That's safe, but it stops the release.
  - **The schedule is unchecked.** A schedule of `0 0 31 2 *` (never) passes every check.
  - **No run history.** Nothing reads `cron.job_run_details`, so a job failing every hour goes unseen.
  - **A pause stops it.** The brief says the project is on Supabase's free plan, which pauses a project after a week without activity, and nothing runs while it is paused. Names would then outlive the 30 days the notice promises (they can't be read: the functions check `expires_at`, but they aren't deleted).
- **Fix:**
  - Add "pg_cron must be enabled" to the README.
  - Assert `schedule = '41 * * * *'` in the test.
  - Add a `cb_health()` RPC (or a canary step) that returns the last successful `codeblack-tidy` run time, and fail the scheduled live check if it's over 2 hours old.
  - Mention a paused project in the notice, or keep the project active.
- **Effort:** S.

### R2.4-06 · Medium · The CI database job will run PostgreSQL 18.7, not 16, and the live version isn't recorded
- **Location:**
  - `.github/workflows/tests.yml` (the `database` job, `runs-on: ubuntu-latest`).
  - `run.sh:8`, which picks the newest installed major.
  - `BRIEF.md:81` ("Postgres 16"), `supabase/README.md:19` and `CLAUDE.md:160` ("15 or newer").
- **Evidence:**
  - Today's deploy log (`45418798750`) shows `Image: ubuntu-26.04, Version: 20261116.202.1`.
  - That image's software list (`scratchpad/round4/r2/ubuntu2604.md`) lists `PostgreSQL 18.7` (service disabled), `Node.js 24.22.3`, and "`ubuntu-latest` label will use Ubuntu 26.04 in November 2026".
  - So the `ls …/initdb` step finds 18 and skips apt, and `run.sh` uses 18.
- **What's wrong:**
  - Local runs use 16 (this container has only `/usr/lib/postgresql/16`). CI uses 18. Live is unknown (probably 15 or 17). Three majors, and the one that matters is the one nobody tests.
  - SQL that's valid on 17 or 18 but not on live (JSON_TABLE, `MERGE … RETURNING`) would pass both suites and fail in the SQL editor.
  - The harness runs every migration as a superuser, while Supabase's `postgres` role isn't one, so a step that needs superuser would pass here and fail live.
  - The job has never run.
  - I tried to run the suite against PostgreSQL 18.7 binaries in scratch. The session's permission check refused it, so compatibility with 18 is **unverified**. It probably passes.
- **Fix:**
  - Record the live `select version()` in `supabase/README.md`.
  - Run the job on that major: a `postgres:<major>` service container, or the PGDG apt repo with `PG_BIN` pinned, and `runs-on: ubuntu-24.04` if the image's Postgres is relied on.
  - Apply the migrations as a `NOSUPERUSER CREATEROLE` role that mimics Supabase's `postgres`.
- **Effort:** S.

### R2.4-07 · Medium · Every request, refused ones included, adds a row: one client can fill the shared free-plan database
- **Location:** the migration `:117-126` (`codeblack.allow` counts, then always inserts) and `:185` (`tidy` keeps a day of rows). (This overlaps R3's remit; the capacity side is mine.)
- **Reproduction** (`scratchpad/round4/r2/pg/probe1.sql`): 20,000 refused `cb_submit` calls from one address left 20,000 rows taking 2,320 kB, which is **118 bytes per row** with the index. The 20,001st call is still answered `busy`, and its row is still written.
- **Why it matters:**
  - At a modest 50 requests a second, one looping client writes about 4.3 M rows (about 510 MB) before `tidy` deletes any. Deleted rows are reused, not returned.
  - The free plan's database cap is 500 MB, and an over-quota project goes read-only. That takes down Case Room as well as the gate, so nobody can open the gated site.
  - **The same design hurts honest users.** A campus is one network: 200 results an hour and 120 reads an hour are shared by every class behind a school's NAT. "Refused requests count too" means each retry pushes the lockout further out.
  - The global caps are also a lever. 50,000 live classes at 20 per /64 per hour is about 10 hours from one routed IPv6 /56, and that locks out every instructor for 30 days.
- **Fix:**
  - Keep one counter row per (who, kind, hour) with `insert … on conflict do update set n = n + 1`, and don't count beyond the limit.
  - Raise the per-network limits for campus NAT, or key them on the class code as well.
  - Watch database size (an alert at 300 MB).
- **Effort:** S.

### R2.4-08 · Low · `db_live.js` has never run, skips `cb_class_new`, and accepts outages and the old state as passes
- **Location:** `test/db_live.js:22-24`, `:25-28`, `:16`; `pages.yml` (curl, and the deploy job).
- **What's wrong:**
  - **It has never run.** It can't run here, and no deploy has included it, so its status-code expectations are untested against PostgREST.
  - **It never calls `cb_class_new`**, the entry point of the whole feature. `cb_class_new('BAD', '0.0.0')` → `invalid` would prove the function exists and anon can execute it, without writing a class.
  - **The "old table" line accepts 401**, which is also the pre-migration answer: anon has no SELECT there today. The comment calls the table "gone".
  - **The private-table lines treat any status ≥ 400 except 500 as a pass,** so 502, 503 and 504 (an outage, a paused project) print `ok`.
  - **No timeouts anywhere:**
    - `fetch` has no `AbortSignal.timeout`.
    - `want()`'s curl still has no `--max-time`.
    - The deploy job has no `timeout-minutes`, so a hung host holds the job up to the 6-hour default.
  - Node comes from the image (24.22.3 today), not a pinned version.
- **Fix:**
  - Add the `cb_class_new` probe.
  - Accept only 404 for the old table.
  - Accept only 401, 403, 404 or 406 for the private tables.
  - Use `AbortSignal.timeout(15000)`, `curl --max-time 15`, and `timeout-minutes: 20`.
- **Effort:** S.

### R2.4-09 · Low · `run.sh` deletes its own failure evidence and has shell portability traps
- **Location:** `supabase/tests/run.sh:15-20`.
- **What's wrong:**
  - **The log is deleted.** I made the server fail to start (a scratch copy with `shared_buffers=1TB`). The output was `pg_ctl: could not start server / Examine the log output.` and exit 1, but the `EXIT` trap had already deleted `$work/log`. A CI failure there leaves nothing to examine.
  - **It breaks on macOS bash 3.2.** `"${as[@]}"` on an empty array under `set -u` is "unbound variable" there, which is the default `/usr/bin/env bash` on a Mac.
  - **Silent locale fallback.** `locale -a | grep -qi …` under `pipefail` can take SIGPIPE when there are many locales and quietly fall back to C.UTF-8. That's the fallback this container already uses, while the comment says live is en_US.UTF-8. The script never prints the Postgres version or locale it used.
- **Fix:**
  - `cat "$work/log"` in the trap when the exit status is non-zero.
  - `${as[@]+"${as[@]}"}`.
  - `locale -a > "$work/locales"` and then grep the file.
  - Echo `postgres --version` and the locale.
- **Effort:** S.

### R2.4-10 · Low · The new database job inherits `contents: write`
- **Location:** `tests.yml:12-13` (workflow-level `permissions: contents: write`) and the `database` job.
- **What's wrong:** the job runs repo-controlled bash and SQL with a write-scoped `GITHUB_TOKEN` persisted in `.git/config` by `actions/checkout`. Only the WebKit job needs write.
- **Fix:** set `permissions: contents: read` at workflow level, and `contents: write` on `webkit` only. Add `persist-credentials: false` on checkouts that don't push.
- **Effort:** S.

### R2.4-11 · Low · Smaller privacy overstatements and gaps
- **"Never stored" overstates it.** `supabase/README.md:39` says "The network address is never stored". The HMAC salt sits in the same database (`codeblack.salt`), so whoever can read it can re-identify every IPv4 hash by enumeration. This box measured 597,874 HMAC-SHA256 a second in Python, so all 2³² addresses take about 2 core-hours. For the operator, the hash is pseudonymous, not anonymous.
- **Hits link to results.** A `hits` row (`who`, `kind='submit'`, `at`) matches a result's `created_at` to the millisecond, so for a day each named result is tied to a network hash.
- **Names persist on shared computers.** The student's name is remembered in `localStorage['oc-cb-name']` (`ui.js:2485`) and prefilled. On shared skills-lab computers, the next student sees, and can send under, the previous student's name. The notice doesn't mention it.
- **No age statement.** The audience is "anyone curious", and high-school EMT students are minors.
- **Fix:** say "pseudonymous, held one day" instead of "never stored". Clear the remembered name after a send, or make remembering opt-in. Add one line on age.
- **Effort:** S.

### R2.4-12 · Low · Docs made wrong by this phase
- `README.md:92` still describes the old model: send "to the class", and "an instructor types the code and sees everyone". It also says the table "can … give back the results for a code it is asked for", which is the hole this phase closed.
- `CLAUDE.md:116`: "the instructor can still read its class results" for a `PAST_V` code. v0.30.0 codes have no key, and their table is dropped.
- `supabase/README.md:19`: "CI runs them on every push". It runs on pushes to `main` and `3d` only.
- `BRIEF.md:81` says Postgres 16; CI uses 18 (R2.4-06).
- `CLAUDE.md:155`: "~520 'ok -' lines" (R2.3-08).
- **Effort:** S.

### R2.4-13 · Nitpick
- **Sparse checkout.** `pages.yml`'s `sparse-checkout` runs in cone mode (the default). I reproduced it: `src/ui.js` and `test/db_live.js` are treated as directories, so all of `src/` and `test/`'s top-level files are checked out (`scratchpad/round4/r2/sp`). It works by accident. Set `sparse-checkout-cone-mode: false`.
- **Untested data guard.** The "stop if `public.cb_results` has rows" guard has no test. It works: by hand, 1 row gave ERROR, exit 3, `codeblack` absent and `cb_class` intact. Add it to the suite.
- **The hour.** `tidy` runs at minute 41, so "deleted 30 days after" means up to 59 minutes after.
- **One mixed commit.** `c941ede` is one 1,225-insertion commit mixing a database migration with UI, CI and docs, so the DB change can't be reverted alone.

## 4. Must block the migration and the merge

1. **R2.4-01:** the notice names an operator and a contact, says who else can read the data, and lists every field. It's the only legal text students see.
2. **R2.4-02:** the order is written down and followed: owner applies → live check green → merge. Otherwise the deploy goes red with class results broken on the live site.
3. **R2.4-03:** move the baseline out of `migrations/` (or guard it) **before** anyone with a migrations tool touches the live project.
4. **R2.4-06:** the first CI run of the `database` job must be green on `3d` at the merge commit. It will be PostgreSQL 18; record the live major next to it.

## 5. Coverage

**Read in full:**
- `git diff 101e07a..ce11887` for `.github/`, `package.json`, `CLAUDE.md`, `README.md` and `docs/SMOKE.md`.
- Both migrations, `stubs.sql`, `privacy_test.sql`, `run.sh`, `test/db_live.js` and `supabase/README.md`.
- In `src/ui.js`: the `cb*` functions and actions, `aboutHTML` and `cbSendHTML`.
- The round-1/2/3 R2 reports, and the STATUS files for rounds 2 and 3.

**Ran:**
- `npm run db:test`: 119 ok, exit 0, 1.9 s, as root. Also run as non-root uid 102: exit 0.
- A scratch copy with one check broken: exit 3.
- A forced server-start failure: the log was deleted.
- In my own throwaway clusters:
  - the data guard;
  - the baseline re-run (R2.4-03);
  - the rate-limit table growth (R2.4-07).
- actionlint 1.7.12 with shellcheck: workflows clean. `run.sh` shows SC2012 info only. `bash -n` passes.
- A cone-mode sparse checkout reproduction.
- `class_test.py` from a scratch copy: 42 ok, "No errors".
- Secret scan of `git log --all -p`: no bcrypt hash (`$2a$/$2b$/$2y$`), `sb_secret_`, JWT, `ghp_`, `github_pat_`, AKIA or private-key header. The gate hash is not in history. The only emails are `noreply@anthropic.com` and the test string `a@b.com`.
- `gh run list` and the log of deploy run `45418798750`.
- The runner-images readme for `ubuntu26/20261116.202`, fetched from raw.githubusercontent.com.

**Couldn't check:**
- The live database (blocked by the brief), so the baseline's fidelity, pg_cron on live, the live Postgres major and the PostgREST answers `db_live.js` expects.
- The suite on PostgreSQL 18: the session refused running downloaded binaries.
- WebKit, and Supabase's plan settings.

## 6. What I'd keep

- **The migration's own safety:**
  - the refuse-if-rows guard, tested by hand;
  - one transaction;
  - safe to run twice;
  - `SECURITY DEFINER` functions with an empty `search_path`;
  - wrong-key and unknown-code answers that look the same.
- **The test harness:** a throwaway cluster on a unix socket in a temp dir (no port clashes), with failures that actually fail the run.
- **The deploy check:** it now checks the version and the real domain, and its grep no longer pipes into `grep -q`.
- **The gate hash** is kept out of the repo, with the SQL to set it written next to it.
