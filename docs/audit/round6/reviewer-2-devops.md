# Reviewer 2, round 6: DevOps, tooling, CI and legal

Branch `claude/sleepy-rubin-jot35n` at `6328cdf` (v0.31.0). Reviewed: the round-5 fixes, `git diff 7cb5613..6328cdf`. Nov 24, 2026.
`origin/main` is still `815e279` (v0.30.0). `origin/3d` is still `0619766`. `gh run list` shows **no CI run for any Phase 2 commit** (`c941ede` to `6328cdf`). The `database` job and the reworked Deploy workflow have still never run.
The migration is live on the real project (STATUS, `6328cdf`). I did not contact supabase.co or edcodeblack.com. Scratch: `scratchpad/round6/r2/`.

## 0. Round-5 status

| ID | Was | Status | Evidence |
|---|---|---|---|
| R2.5-01 Gate blocks rollbacks, freezes `main` | High | **Partly fixed** | `db_live.js:30` is now `hj.db >= LATEST`. Simulated with a newer name: passes. CLAUDE.md and `supabase/README.md` "Rolling back" are rewritten. **Still open:** the "expand first, remove later" rule I asked for isn't in the runbook. A rolled-back `db_live.js` still asserts exact answers from the newer database (R2.6-05). |
| R2.5-02 Key dropped on day 7 | High | **Fixed** | `cbKeys()` keeps a key until `t + CB_LIFE` (30 days, `ui.js:2026`, `:2063-2067`), whatever the server's expiry. |
| R2.5-03 False fails, wrong remedy, no bypass | Medium | **Fixed** | Re-run in the same hour: passes (31 refused). Health bucket exhausted: `FAIL: this network has used its health checks for this hour. Re-run after 22:00 UTC`, exit 1. Unreachable: `couldn't reach the database (fetch failed)`, exit 1. Hanging: the same after 15 s. Minute 59:30 (faked clock): "waiting 35 s for the next hour", then pass. `skip_db_check` works on push and dispatch. New wording problems are in R2.6-04. |
| R2.5-04 `addr` doesn't prove a per-caller address | Low | **Fixed as asked** | `cb_health` returns `public`. A stand-in gateway at 10.0.0.5 fails the check; one honouring client headers fails the forged-header check. Residual reserved ranges: R2.6-09. |
| R2.5-05 Nothing checks the self-recorded name | Low | **Fixed, with a hole** | `run.sh:45` checks it, `:47-50` checks the refusal. The check is NULL-blind (R2.6-06). |
| R2.5-06 Previous student's name prefilled | Low | **Fixed** | `U.cbName = ''` after a successful send (`ui.js:2595`), in `start()` (`:2863`) and at `:2989`. |
| R2.5-07 Privacy wording | Low | **Partly fixed** | Fixed: the list box names the developer (`ui.js:2130`), exports are disclosed, the CSV and Copy carry the caveat row, the time sent is listed. **Still open:** log retention is still not stated ("the short time Supabase sets"). The Send box's list is incomplete (R2.6-08). |
| R2.5-08 Build job holds `pages: write` / `id-token: write` | Low | **Worse** | The permissions moved to `deploy` as I asked. The `build` job still runs `actions/configure-pages@v5`, which needs Pages read. Every deploy now fails (R2.6-01). That's on my round-5 fix text as much as on the change. |
| R2.5-09 `class_test.py` flaky request checks | Low | **Partly fixed** | Four checks now use `expect_request`, including the one that failed. The main read check (`class_test.py:177-183`) still reads `asked[-1]` after a fixed 600 ms sleep. 51 `wait_for_timeout` remain. Passed 3 of 3 here (67 ok). |
| R2.5-10 Time limits | Low | **Fixed** | Build, deploy and rules jobs: 30 minutes. The 404 checks run first. The reordering has its own problem (R2.6-07). |
| R2.5-11 Docs drift | Low | **Fixed** | "A release" and "Rolling back" mention the database. `run.sh:4` says bash 3.2. CLAUDE.md says "~690" (I count 694). The rate-limit list includes `cb_health`. README no longer says "closes". Small leftovers are in R2.6-05. |
| R2.5-12 Nitpicks | Nitpick | **Partly fixed** | Forget's confirm now warns the results become unreachable. Everything else is still open (R2.6-09). |

Counts: 7 Fixed, 4 Partly fixed, 1 Worse, 0 Still open.

## 1. Verdict

**Don't merge into `main` until R2.6-01 is fixed. As committed, the first deploy of v0.31.0 fails after the tests and the live database check. The live v0.30.0 site's Send and Class results then stay broken until someone works out why.**

**Before anything else touches the database, run the Tests workflow on this branch.** The live project already runs a migration that CI's PostgreSQL 17 job has never executed (R2.6-02).

The round-5 work on the gate itself is solid. I reproduced every one of these against a local Postgres behind a PostgREST stand-in:
- "live may be ahead";
- the busy and unreachable exits;
- the probe's own bucket;
- the minute-58 wait;
- the `public` check.

What's wrong now is mostly around it:
- one permission move breaks publishing;
- the irreversible step (the live migration) came before the only CI gate;
- an applied migration can still be edited in place without anything noticing.

## 2. Score

**6 / 10** (round 5: 6). The gate and the key fix are real improvements. A deploy that can't publish, plus a live migration with no CI run behind it, cancel the gain.

## 3. New findings (worst first)

### R2.6-01 · High · Every deploy now fails at `configure-pages`: the build job has no Pages permission
- **Location:**
  - `.github/workflows/pages.yml:16-17`: workflow-level `contents: read` only.
  - `pages.yml:52`: `- uses: actions/configure-pages@v5` in the `build` job.
  - `pages.yml:61-64`: `pages: write` is now only on `deploy`.
- **What's wrong:**
  - **What the action does.** `configure-pages` always calls `GET /repos/{owner}/{repo}/pages`: `src/index.js` → `findOrCreatePagesSite` → `octokit.rest.repos.getPages`, from `actions/configure-pages@v5`, read here. On any error, with `enablement` at its default `false`, it logs "Get Pages site failed…" and calls `setFailed` / `exit 1`.
  - **What that endpoint needs.** GitHub's own permission table (`github/docs`, `src/github-apps/data/fpt-2022-11-28/server-to-server-permissions.json`) lists `get-a-github-pages-site`, `GET /repos/{owner}/{repo}/pages`, under **Pages: read**.
  - **What the token has.** A `permissions:` block sets every scope it doesn't name to `none`, so the build job's token has `pages: none`. The repo is private.
  - **Why it worked before.** v0.30.0's last green deploy (run 45418798750) had `pages: write` at workflow level (`git show origin/main:.github/workflows/pages.yml`, lines 11-14).
  - **Why nothing catches it early.** `pages.yml` runs only on `main` (or a manual run). CI on `3d` can't catch this, and actionlint can't see it. It will first show at the merge, after `npm test`, stress and the live database probes have all passed.
  - **Why it matters now.** The database-first outage window (v0.30.0's Send and Class results failing) stays open while someone debugs it.
- **Fix (either one):**
  - Delete the `configure-pages` step. Nothing uses its outputs (no static site generator, no `steps.<id>.outputs`), and `upload-pages-artifact` and `deploy-pages` don't need it.
  - Or give `build` `permissions: { contents: read, pages: read }`. Read can't create a deployment, so the round-5 goal still holds.
- **Effort:** XS.

### R2.6-02 · Medium · The live database was migrated before CI ever ran the migration, and the runbook allows that order
- **Location:**
  - `supabase/README.md:39-46` ("Releasing": steps 2 and 3 go from a local `db:test` straight to the owner pasting the file into the live project).
  - CLAUDE.md:19 ("the owner applies it to the live project first") and CLAUDE.md:21 (green CI is required only "before a merge into `main`").
  - README v0.31.0 paragraph ("the database rules run on a local PostgreSQL 17 in CI").
- **What's wrong:**
  - **The evidence.** `gh run list`: the newest runs are from v0.30.0. `origin/3d` = `0619766`. `tests.yml` only runs on pushes to `main`/`3d` or by hand, and nobody pushed or dispatched. So the PG17 `database` job has run zero times on `20261124120000_codeblack_private_results.sql`.
  - **What tested it instead.** Locally, PostgreSQL **16.15** with **C.UTF-8** (`run.sh` prints this here; no `en_US` locale). Live is 17 with en_US.UTF-8.
  - **Why that matters.** There's "no database rollback" (`supabase/README.md:50`). The step that can't be undone happened before the only check on the live major version, and the docs' ordering lets that happen every release.
  - **Mitigation.** The owner's verification in a rolled-back transaction is real, but it's one manual path.
  - **The README claim isn't true yet.** It says the rules run on PostgreSQL 17 in CI.
- **Fix:**
  - Now: run the Tests workflow on this branch (`workflow_dispatch`; note it also starts the macOS WebKit job), or push to `3d`, and get `database` green.
  - Runbook: insert a step between 2 and 3: "push to `3d`; the Tests workflow's `database` job is green at the commit whose file the owner pastes".
  - Record in `supabase/README.md` which commit's file went live.
- **Effort:** S.

### R2.6-03 · Medium · An applied migration can be edited in place, and nothing would notice
- **Location:**
  - `test/db_live.js:11` and `:30`: compares the newest file's *name* only.
  - `codeblack.migrations`: a name, no content hash.
  - `supabase/README.md:43` says "add a new file", but no rule says never edit an applied one.
  - No CI check for it.
- **What's wrong:**
  - **The habit.** This file was rewritten under the same name in `c941ede`, `46a0b03` and `2b51323`. That was correct while it was unapplied.
  - **Since `6328cdf` it is live.** Round 6 will produce database fixes. The established habit is to edit `20261124120000_…sql`.
  - **If someone edits it:**
    - `run.sh` tests the edited file;
    - CI goes green;
    - `db_live.js` sees the same name and passes;
    - the repo then documents rules the live project doesn't have.
  - **The record is thin.** Which content went live is recorded nowhere except a commit message, and that's implicit (the file is unchanged since `2b51323`).
  - **How this differs from R1.5-04.** STATUS's "drift by hand edits" item covers edits made in the SQL editor. This one covers edits made in the repo, and it needs no database change to fix.
- **Fix:**
  - Add `supabase/applied.txt` (`<name> <sha256>` per applied file). The owner or the session appends a line when a migration goes live.
  - Add a `run.sh` step that fails if any listed file's hash differs.
  - Add one line to the runbook: "never edit a migration listed in `applied.txt`; add a new one."
  - Later, optionally, a `sha` column returned by `cb_health` and compared by `db_live.js`.
- **Effort:** S.

### R2.6-04 · Low · `db_live.js` still gives the wrong diagnosis in common failure modes
- **Location:** `test/db_live.js:15`, `:26-30`, `:65`.
- **What's wrong (each reproduced in `scratchpad/round6/r2/live/`):**
  1. **No usable answer.** If the health call answers anything that isn't JSON with `db` (a paused project, a 5xx, a rotated key's 401, or an old database's 404 `PGRST202`), line 30 prints `FAIL the live database has this release's migration … (live: undefined). A newer one is fine (a rollback).` That's because `undefined < '2026…'` is false. It's the opposite of the remedy, followed by 16 more FAIL lines. A paused project isn't recognised: "Supabase may be down or paused" prints only for status 0. With a stand-in answering `540 Project paused`, all 18 checks fail with no diagnosis.
  2. **A stall mid-body.** A server that sends headers then stalls the body makes `r.text()` reject *inside* the first `.then` handler. That escapes the per-call catch, and the whole run dies with an unlabelled `FAIL: The operation was aborted due to timeout`, with no call named and no "down or paused" text.
  3. **Every normal run** prints "A newer one is fine (a rollback)" when live equals the repo.
- **Fix:**
  - If `h.status !== 200 || typeof hj.db !== 'string'`, print one diagnosis: "the health check didn't answer (HTTP n: …): Supabase paused or down, the key changed, or the migration isn't applied", then exit.
  - Use three-way wording: equal / newer (rollback) / older (apply).
  - Move `.text()` inside a try in `call()`.
- **Effort:** XS.

### R2.6-05 · Low · Runbook and docs gaps around the new gate
1. **No backward-compatibility rule.** CLAUDE.md:22 says "a live database ahead of the game passes the deploy's check". Only the name line accepts that. A rolled-back `db_live.js` still requires:
   - `cb_submit` answers `field: 'level'`;
   - `cb_class_new` answers `invalid` for `p_ver: 'x'`;
   - the `cb_health(p_probe)` signature;
   - the exact `busy`/`key` strings.

   A future migration that changes any of them blocks every rollback deploy unless `skip_db_check` is used.

   **Fix:** a runbook rule: "a migration keeps the previous release's game and its `db_live.js` passing: add first, remove a release later".
2. **No remedies for the four rule checks.** `supabase/README.md:46` lumps overdue, cron, address and public under "a rule broken", with no remedy. For example: pg_cron disabled or the job inactive, so enable it and check `cron.job`; or the gateway changed its headers. "pg_cron must be enabled" is still in no doc.
3. **`supabase/README.md:35` is stale.** Its `cb_health` bullet still lists only name/overdue/cron/address, with no `public` and no probe.
4. **`run.sh:7-12`'s step list** doesn't include the two new steps.
5. **`pages.yml:79`** still says "retries for up to 5 minutes". The real figure is up to 15 per URL.
6. **CLAUDE.md:21 "Before a merge"** still describes the deploy as build check, tests and stress, then the live site, without the database check that sits between them.

**Effort:** S.

### R2.6-06 · Low · `run.sh`'s new self-recorded-name check passes when nothing was recorded
- **Location:** `supabase/tests/run.sh:45`, `if (select max(name) …) <> '${last%.sql}' then raise`.
- **What's wrong:** with no rows, `max(name)` is NULL. `NULL <> 'x'` is NULL, so the `IF` doesn't fire.
- **Reproduction:** a scratch copy with the migration's `insert into codeblack.migrations` removed prints `ok - the latest migration recorded its own name (the deploy's check depends on it)`. Only `privacy_test.sql:41`'s hard-coded name catches it, and that line must itself be edited for every new migration.
- **Also:** the refusal step (`:48`) counts *any* failure as the guard working, with stderr sent to `/dev/null`.
- **Fix:**
  - Use `is distinct from`.
  - grep the refused run's stderr for "A newer Code Black migration".
  - Make `privacy_test.sql:41` compare against the newest file rather than a literal.
- **Effort:** XS.

### R2.6-07 · Low · The 404 checks now run before the new deployment is confirmed live
- **Location:** `pages.yml:96-100`.
- **What's wrong:**
  - The comment's premise is that propagation can be slow. In exactly that case, the 404 probes run first and can hit the *previous* deployment, which is clean.
  - Then `want 200 index.html "$ver"` waits for the new one, and the run goes green even if this deployment published source.
  - My round-5 advice ("run the 404 checks first") caused this. It should have said: confirm the version, then 404.
- **Fix:**
  1. `want 200 index.html "$ver"` first: this proves the new deployment is served.
  2. Then the 404 list with a short budget (one or two tries each: a 404 is immediate).
  3. Then `sw.js` and `map3d.js`.
- **Effort:** XS.

### R2.6-08 · Low · Privacy text: the point-of-collection notice is incomplete
- **The Send box (`ui.js:2181`)** reads as a complete list: "your first name or initials, score…, and this shift's numbers (wait, walkouts, arrivals, deaths…)". It also sends, and About lists:
  - patients who left against advice;
  - patients bedded before registration;
  - the sped-up percentage;
  - the fired / staff-walked-out flags;
  - the scenario;
  - the game version;
  - the result's id;
  - the arrival time.

  It has no link to About. STATUS says "the Send box lists what goes out". It lists part of it.
- **The registration box (`cbRegHTML`, `ui.js:2100`)** says "Students' results come to you" and doesn't mention the developer. Only the list box does. STATUS says "the instructor box says the developer can see the database".
- **Supabase log retention is still unquantified** (`ui.js:2847`).
- **CSV on a shared computer.** "On a shared computer, forget your keys when you're done" (`ui.js:2136`) says nothing about the downloaded `code-black-<code>.csv` of student names left in Downloads.
- **Fix:**
  - Send box: "…and the rest of this shift's summary (see About › Privacy)", with a link.
  - Add the developer clause to `cbRegHTML`.
  - State the retention period, or name the plan's figure.
  - Add one clause about deleting downloaded files on shared computers.
- **Effort:** S.

### R2.6-09 · Nitpick
- **`cb_health`'s `public` test misses reserved ranges:**
  - IPv4: `0.0.0.0/8`, `192.0.0.0/24`, the three TEST-NETs, `198.18.0.0/15`, `224.0.0.0/4`, `240.0.0.0/4`;
  - IPv6: `::/128`, `2001:db8::/32`, `64:ff9b::/96`.

  A stand-in gateway at `192.0.2.44` reports `public: true` and passes. It also can't tell one shared *public* gateway address (a CDN edge) from per-caller addresses.
- **`SKIP_DB_CHECK`** is any truthy string, so `SKIP_DB_CHECK=0 npm run db:live` skips.
- **The private-table check** (`db_live.js:43`) still accepts 401 and 429 as "isn't reachable".
- **Probe timeouts are misattributed.** A probe that times out is reported as "forged address headers don't get round the rate limit … FAIL", a security failure.
- **`db_live.js:4`** says counters are "one row per network and hour". They're per kind too.
- **`workflow_dispatch` deploys whatever ref is picked,** now with an easy database bypass. Add `if: github.ref == 'refs/heads/main'` on `deploy`. I couldn't check the `github-pages` environment's branch rule: the proxy refuses that API.
- **README:**
  - The v0.31.0 paragraph says names are "letters only". Spaces, periods, hyphens, apostrophes and marks are allowed.
  - The changelog runs v0.31.0, v0.29.1, v0.30.0, v0.29.0.
- **Round-5 carry-overs, still open:**
  - `run.sh` runs migrations as superuser.
  - Its trust-auth socket sits in a `755` temp directory.
  - The version prints as "(PostgreSQL) 16.15".
  - SC2012 ×2.
  - `locale -a | grep -q` under `pipefail`.
  - The `stubs.sql` `cron.job` stand-in.
  - `build.js` inlines `contact` unescaped.
  - `tidy` keeps yesterday's salt for no use.
  - Node 22.
  - Cone-mode sparse checkout.
  - The CI database job's install has never run.

## 4. Coverage

**Read:**
- `git diff 7cb5613..6328cdf` for `.github/`, `test/db_live.js`, `supabase/` (the migration diff, baseline, `run.sh`, `privacy_test.sql` diff, README), CLAUDE.md and README.
- In `src/ui.js`: `cbKeys` through `cbRegister`, `cbRegHTML`, `cbListHTML`, `cbTable`/`cbCell`/`cbCsv`, `cbArgs`, `cbSendHTML`, `aboutHTML`, the name clearing.
- `test/class_test.py`'s request checks.
- Round-5 STATUS and BRIEF rounds 4-6.
- Third-party sources fetched from raw.githubusercontent.com: `actions/configure-pages@v5` (`action.yml`, `src/index.js`, `src/api-client.js`), `actions/deploy-pages@v4` (`src/internal/api-client.js`), the Pages starter `jekyll.yml`, and GitHub's server-to-server permission table.

**Ran:**
- `npm run db:test`: 158 ok, exit 0, 2.7 s (PG 16.15, C.UTF-8).
- `bash -n`: clean. shellcheck 0.11.0: SC2012 ×2 (info). actionlint 1.7.12 (with shellcheck) on both workflows: clean.
- `npm test`: 694 ok, exit 0, 53 s. `npm run stress`: exit 0, 92 s.
- A scratch rebuild: `index.html`, `sw.js` and `3d/map3d.js` byte-identical to the committed files.
- `class_test.py` ×3 from a scratch copy: 67 ok each.
- `test/db_live.js` against a local Postgres plus a PostgREST stand-in, in these cases:
  - pass;
  - re-run in the same hour;
  - health bucket busy;
  - unreachable;
  - hanging;
  - stall mid-body;
  - `540 Project paused`;
  - old database (`404 PGRST202`);
  - a minute-59:30 faked clock;
  - a gateway that honours client headers;
  - a private egress;
  - a TEST-NET egress.
- `run.sh` on a scratch copy with the self-record removed.
- A secret scan of the diff: nothing beyond the publishable key. No bcrypt hash, no `sb_secret_`, no tokens. The only addresses are refuse-list test names.

**Couldn't check:**
- The live project or site (barred).
- The `github-pages` environment's branch rule (proxy refuses that API) and docs.github.com (refused).
- A real Actions run of either workflow.
- bash 3.2.

## 5. What I'd keep

- **The gate's shape:** a distinct exit for "rate-limited this hour" and for "unreachable"; the probe in its own bucket; the wait at minute 58; "live may be ahead".
- **`skip_db_check`:** a boolean `inputs` expression that is correctly empty on push, and a `::warning::` annotation when used.
- **Narrowed tokens on the deploy job** (once R2.6-01 is fixed, the build job really is read-only).
- **`run.sh`'s new steps:** the self-recorded name and the refusal over a newer migration. Make them NULL-proof.
- **The contract file:** it now holds every error and both name lists, checked from the SQL side and the UI side.
- **Exports that carry their caveats, and Forget's honest confirm.**
