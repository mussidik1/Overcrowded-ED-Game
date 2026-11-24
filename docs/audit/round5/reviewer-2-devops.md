# Reviewer 2, round 5: DevOps, tooling, CI and legal

Branch `claude/sleepy-rubin-jot35n` at `7cb5613` (v0.31.0). Reviewed: the round-4 fixes, `git diff ce11887..46a0b03`. Nov 24, 2026.
`origin/main` is still `815e279` (v0.30.0). `origin/3d` is still `0619766`. **None of these commits has been through CI**, so the new `database` job and the new pre-publish database check have never run.
Scratch: `scratchpad/round5/r2/`. I did not contact supabase.co or edcodeblack.com.

## 0. Round-4 status

| ID | Was | Status | Evidence |
|---|---|---|---|
| R2.4-01 Privacy notice: no operator, no contact, false "only the instructor" | High | **Partly fixed** | About (`ui.js:2803`) and the Send box (`CB_WHO`, `ui.js:2145`) now say the developer can see the database, list every sent field and give a use limit. **Still open:** the operator is "the game's developer", with no name. The contact is the owner's decision, and the empty case reads fine ("ask your instructor"). The instructor list still says "Only the instructor who made a code can see what students send" (`ui.js:2103`). New gaps are in R2.5-07. |
| R2.4-02 No cutover order, no runbook for a red DB check | Medium | **Partly fixed** | The order is written down (`supabase/README.md` "Releasing", CLAUDE.md Backend) and enforced: `db_live.js` runs before upload (`pages.yml:35-38`). The 404 message is fixed (`cbNet`, `ui.js:2033`). **Still open:** there is no scheduled or on-demand database check, only the deploy. The runbook covers one failure cause out of six (R2.5-03). The new check turns the documented order into a deploy freeze (R2.5-01). |
| R2.4-03 Baseline runnable as a migration | Medium | **Fixed** | Moved to `supabase/baseline/`. A guard at the top refuses on a migrated database, which `run.sh:45` tests. `caseroom.client_ip()` is created only if it's missing. |
| R2.4-04 Nothing records live migrations; no drift check | Medium | **Partly fixed** | `codeblack.migrations`, `cb_health().db`, and `db_live.js:22` asserts it. **Still open:** no live check ever sends a valid result, so a migration that refuses valid sends, the failure that already broke v0.30.0, still passes. Nothing checks that a migration records its own name (R2.5-05). |
| R2.4-05 30-day deletion rests on an unseen job | Medium | **Partly fixed** | `cb_health().overdue` is checked at deploy. Every `cb_class_new` clears 500 expired classes. **Still open:** the schedule is not asserted (`privacy_test.sql:39` checks name and command only). "pg_cron must be enabled" is still not in any doc. Nothing watches between deploys. |
| R2.4-06 CI on PostgreSQL 18, live version unrecorded | Medium | **Fixed** | `runs-on: ubuntu-24.04`, the PGDG repo, `postgresql-17`, `PG_BIN` pinned, `locale-gen en_US.UTF-8`. The README records "PostgreSQL 17", which I can't check from here. Remaining: migrations still run as superuser (R2.5-12). |
| R2.4-07 Every request adds a row | Medium | **Fixed** | One row per network, kind and hour, and nothing written past the limit. My 140-call run left 5 `codeblack.rate` rows. |
| R2.4-08 `db_live.js` gaps | Low | **Fixed** | The `cb_class_new` probe, old table 404 only, private tables 4xx only, `AbortSignal.timeout(15000)`, `curl --max-time 20`, deploy `timeout-minutes: 15`, Node pinned. It still has never run against real PostgREST. |
| R2.4-09 `run.sh` evidence and portability | Low | **Fixed** | On failure it keeps the folder and prints the server log. Reproduced with `shared_buffers=1TB`: exit 1 with the log tail. A broken check gives exit 3. `as=(env)` avoids the empty array. It prints the version and locale. bash 3.2 itself is unverified (the download was refused), and the header still says "bash 4.4 or newer". |
| R2.4-10 DB job inherits `contents: write` | Low | **Fixed** (tests.yml) | Workflow-level `contents: read`, with `write` on `webkit` only. `pages.yml` was not touched (R2.5-08). |
| R2.4-11 Smaller privacy gaps | Low | **Partly fixed** | Fixed: "never stored", the hits linkage, the name in `localStorage`. **Still open:** the name is carried in memory to the next student in the same tab (R2.5-06). There's no age statement. |
| R2.4-12 Docs wrong | Low | **Partly fixed** | Fixed: the supabase/README CI line and BRIEF. Still open: `CLAUDE.md:156` says "~520" (`npm test` prints 694). New drift is in R2.5-11. |
| R2.4-13 Nitpicks | Nitpick | **Partly fixed** | The data-guard test was added (`run.sh:38-41`). Still cone mode. `46a0b03` is again one commit mixing the migration, UI, CI and 2,000 lines of reports. |
| R2.3-08 Docs | Low | Still open | "~520 'ok -' lines". |
| R2.2-13 Commit hygiene | Nitpick | Still open | See R2.4-13. |

## 1. Verdict

**The migration can be applied. Don't merge into `main` until R2.5-01 and R2.5-02 are fixed and the `database` job has been green once on `3d`.**

Most of round 4 really is fixed:
- The CI database job targets the right major on a pinned image.
- The baseline can't be pushed by accident.
- Rate rows are bounded.
- Job permissions are narrowed.
- `run.sh` keeps its evidence.
- The notice no longer lies about who reads results.

What's wrong now is the operational design around the new gate, plus one functional bug that defeats the privacy story:
- **R2.5-01:** the deploy demands that the live migration *equals* the newest file in the repo. The documented order (database first, then the game) then blocks every `main` deploy in between. Any rollback of a release that carries a migration can never publish. I reproduced it.
- **R2.5-02:** the instructor's key silently falls off the device on **day 7**. The class and its results live until day 30, and the list itself says "deleted on Dec 24". After day 7 the instructor can't read or delete anything. That is the only deletion route the privacy notice offers. I reproduced it.
- **R2.5-03:** the gate's forged-header probe uses up the network's hourly `cb_health` quota. A re-run within the hour fails 4 checks with the wrong diagnosis. I reproduced it.

## 2. Score

**6 / 10** (round 4: 5). Real progress on the CI job, the baseline, the counters and the permissions. Two new Highs, both a few lines to fix, keep it from 7.

## 3. New findings (worst first)

### R2.5-01 · High · The database gate blocks rollbacks and freezes `main` during the documented release order
- **Location:**
  - `test/db_live.js:11` (`LATEST` = the newest file in `supabase/migrations/`).
  - `test/db_live.js:22` (`hj.db === LATEST`).
  - `supabase/README.md`, "Releasing a database change" steps 3-4, and "Rolling back the game".
  - CLAUDE.md "Rolling back" and the Backend section.
- **What's wrong:** the check asserts equality, not "at least".
  1. **The freeze.** The runbook says the owner applies migration M2 (step 3), *then* merges the game (step 4). Any push to `main` in between, such as a hotfix or a README edit, runs `db_live.js` with `LATEST` = M1 while live reports M2. It fails, and nothing publishes.
  2. **Rollback is impossible.** `git revert -m 1` on a release that added M2 removes M2's file, so `LATEST` goes back to M1. The live database can't go back: "There is no database rollback", says the README. The deploy refuses forever, so the documented rollback can't publish the previous game. That's the exact path CLAUDE.md tells you to take when a source file leaks.
  3. **v0.31.0 itself escapes this.** Reverting it also removes `db_live.js` and the step, because `origin/main`'s `pages.yml` has no database step. So it bites at the first release with a second migration.
- **Reproduction** (`scratchpad/round5/r2/live/`, a local Postgres with the migration plus `shim.js`, a PostgREST stand-in): with `codeblack.migrations` holding a newer name, the run prints `FAIL the live database has the latest migration, 20261124120000_codeblack_private_results (200 {"db": "20270115000000_codeblack_next_release", …})` and exits 1.
- **Fix:**
  - Use `hj.db >= LATEST`. The names are timestamp-prefixed, so string order is time order.
  - Add one rule to `supabase/README.md`: every migration must keep the previous release's game working (expand first, remove later).
  - Rewrite "Rolling back the game" to match.
- **Effort:** S.

### R2.5-02 · High · The instructor's key drops off the device on day 7, while the class and its results live 30 days
- **Location:** `src/ui.js`:
  - `:2068` and `:2071`: the key is saved with the registration expiry, which is 7 days.
  - `:2056`: `cbKeys()` drops any entry whose `exp` has passed.
  - `:2060`: `cbKeySave` rewrites storage from that filtered list, which deletes the key for good.
  - `:2573`: only a *typed* key with "Remember" ever updates `exp`. Opening a saved code (`cbShow(code)`) never does.
- **What's wrong:** the server moves a class to 30 days from creation once a result arrives (`cb_submit`, migration `:283`). The device never learns this.
  - On day 8 the code disappears from Class results.
  - The key is purged from `oc-ckeys` the next time any key is saved.
  - The instructor can no longer read, export or delete the results unless they copied the key.
  - The list even shows "deleted on Dec 24" while the device drops the key on Dec 1.
- **Why it's mine:** the About page's only deletion route is "ask your instructor: they can delete any result" (`ui.js:2803`, `contact` empty). After day 7 that is false for most instructors, and there's no operator contact to fall back on.
- **Reproduction:** `scratchpad/round5/r2/ct/key_expiry.py`, with the server stubbed:

  ```
  after registering: 9A5-80A saved exp 2026-12-01
  list header after Results: 9A5-80A · … · 1 result · deleted on Dec 24
  after reading results (server says 30 days): saved exp 2026-12-01 | server exp 2026-12-24
  day 8: codes listed: 0 | open-with-key button: Open with an instructor key
  ```
- **Fix:**
  - On every successful `cb_class_read` (saved or typed), call `cbKeySave(code, { k, exp: r.expires, t })`.
  - Better: keep keys for 31 days from creation whatever the stored `exp` says, and let the server answer "ended".
  - Add a `class_test.py` check.
  - (This overlaps R3 and R4. It's here because the privacy notice depends on it.)
- **Effort:** S.

### R2.5-03 · Medium · The pre-publish gate fails falsely, and its failure text points to the wrong fix
- **Location:**
  - `test/db_live.js:21-25` and `:45-51`.
  - The migration `:335` (`cb_health` is limited to 120 an hour per network) and `:141` (`date_trunc('hour', now())`).
  - The `pages.yml:35-36` comment.
- **What's wrong:**
  1. **A re-run within the hour fails.** One run makes 122 `cb_health` calls from the runner's address: 1 to start, then 121 with forged headers that count against the real address, as intended. A second run from the same address in the same clock hour gets `busy` on its very first call. Four checks then fail, led by "the live database has the latest migration … FAIL (200 {"error": "busy"})". The `pages.yml` comment says "apply the migration first, then re-run the deploy", which is wrong for this cause. Whether a GitHub re-run gets a fresh address isn't promised. Two `npm run db:live` runs from one network certainly collide.
  2. **A run that straddles the hour fails the security check.** If the 122 calls cross hh:00, the counter restarts, so call 121 isn't `busy` and the run reports "forged address headers don't get round the rate limit … FAIL". That is a false alarm about a security control.
  3. **Every deploy depends on Supabase.** Every publish of the site, including an emergency rollback for a leaked source file, now requires Supabase to be up and unpaused. There's no bypass (`workflow_dispatch` has no inputs), and the six failure causes aren't told apart: not migrated, overdue, cron, address, forged headers, network.
- **Reproduction** (`scratchpad/round5/r2/live/`): run 1 printed "All live database checks passed." Run 2, immediately after, printed `FAIL the live database has the latest migration … (200 {"error": "busy"})`, then 3 more FAILs, "4 FAILED", exit 1. The `codeblack.rate` row was `health|19:00|121`.
- **Fix:**
  - If the first `cb_health` returns `busy`, print "rate-limited until hh:00; re-run after it" and exit with a distinct message.
  - Give the forged-header probe its own `kind` and budget (for example 30 calls), or read the counter through `cb_health` instead of exhausting it.
  - Retry the forged loop once if it crossed the hour.
  - Add a `skip_db_check` `workflow_dispatch` input for rollbacks, with a loud log line.
  - List each failure and its remedy in `supabase/README.md`.
- **Effort:** S.

### R2.5-04 · Low · `addr: true` doesn't prove the address is the caller's
- **Location:** migration `:340` (`codeblack.client_ip() is not null`), `db_live.js:25` and `:45-51`, and the `supabase/README.md` claim that the deploy "proves" addresses are read.
- **What's wrong:** if the gateway ever put its own or an internal address in `cf-connecting-ip` or `x-real-ip`:
  - `addr` would still be `true`;
  - every caller in the world would share one bucket (600 sends an hour for all schools);
  - the forged-header check would still pass, because all 122 calls land in that one bucket.

  The two checks together can't tell "per caller" from "one shared bucket".
- **Fix:** have `cb_health` also return whether the address is public (not `10/8`, `172.16/12`, `192.168/16`, `100.64/10`, `fc00::/7`, loopback), and assert it.
- **Effort:** S.

### R2.5-05 · Low · Nothing checks that a migration records its own name, which the gate now depends on
- **Location:** `supabase/README.md` "Releasing" step 1; `privacy_test.sql:41` hardcodes `'20261124120000_codeblack_private_results'`.
- **What's wrong:** a future migration that forgets `insert into codeblack.migrations`, or records a typo, passes `npm run db:test`. Then every deploy fails on the live name.
- **Fix:** in `run.sh`, after the migrations, assert that `select max(name) from codeblack.migrations` equals `${last%.sql}`.
- **Effort:** S.

### R2.5-06 · Low · The previous student's name is prefilled for the next student in the same tab
- **Location:** `src/ui.js:2153` (`value="${esc(U.cbName || '')}"`) and `:2994`. Nothing ever clears `U.cbName`: not a send, not `start()`, not `showTitle()`.
- **Reproduction** (`scratchpad/round5/r2/ct/name_carry.py`): student 1 sends as "Alice". Back to the menu, student 2 plays another class code, and the name box starts with `'Alice'`.
- **Why it matters:**
  - On a shared skills-lab device, the next student sees a classmate's name.
  - One Enter sends a result under it.
  - That is the round-4 shared-computer case. It's fixed across reloads, not within a tab.
- **Fix:** clear `U.cbName` after a successful send and in `start()`.
- **Effort:** S.

### R2.5-07 · Low · Privacy wording left wrong or made incomplete by this round
- **The instructor list contradicts About.** `ui.js:2103` says "Only the instructor who made a code can see what students send for it". The README's lead still says results "go only to the instructor".
- **Exports aren't disclosed.** **Copy table** and **Download CSV** (new) create copies outside the "deleted 30 days after the code was made" promise, and About doesn't say the instructor can copy or download results.
- **The CSV drops the caveat.** The export has no "Not for grading" line, so the caveat is lost the moment it goes into a gradebook spreadsheet.
- **The send time isn't listed.** The server stamps the time sent and the instructor sees it ("Sent (UTC)" in `cbTable`), but About's field list omits it.
- **Log retention is still unstated.** "Supabase's own logs also see the address" gives no period.
- **Fix:** correct `ui.js:2103` and the README lead; add one sentence on exports and the time sent; put "Not for grading: self-reported" in the CSV's first row; state the log retention.
- **Effort:** S.

### R2.5-08 · Low · The Pages build job holds `pages: write` and `id-token: write`
- **Location:** `pages.yml:11-14` (workflow-level permissions), applying to the `build` job.
- **What's wrong:** `build` runs `npm ci` (dependency install scripts), the whole test suite, and now a network probe. It does that with tokens that can mint OIDC tokens and create Pages deployments, so a compromised dependency could publish to edcodeblack.com without the checks. STATUS says "job permissions are read-only except the WebKit results upload". That's true of `tests.yml` only.
- **Fix:** workflow-level `contents: read`; `pages: write` and `id-token: write` on `deploy` only.
- **Effort:** S.

### R2.5-09 · Low · `class_test.py`, a CI gate, failed 1 of 6 runs here
- **Location:** `test/class_test.py:205-209`, with 49 `wait_for_timeout` sleeps in the file.
- **Evidence:** run 1 failed with `FAIL a code the game can no longer play (another version) still goes to the server with its key (4FS-01A)`. Five re-runs (two under extra CPU load) passed with 60 ok. Outputs are in `scratchpad/round5/r2/ct/class*.txt`. The cause isn't pinned down. The check reads `asked[-1]` after a fixed 600 ms sleep, so a slow or missed request reads as a failure.
- **Fix:** `with page.expect_request('**/cb_class_read') as rq:` around the tap, then assert on `rq.value.post_data_json`. Do the same for the other request checks.
- **Effort:** S.

### R2.5-10 · Low · Time limits don't match the checks they guard
- **Deploy job:**
  - `timeout-minutes: 15` (`pages.yml:54`) includes `deploy-pages` (default timeout 10 minutes).
  - Each `want()` can take up to 30 × (≤20 s + 10 s) = 15 minutes. The comment says "up to 5 minutes", which is true only when curl answers instantly.
  - When propagation is slow, the job ends as a timeout. The source-exposure 404 checks, which run last, may never run.
- **Build job:** it now holds `npm test`, `stress` and `db_live.js` (up to 131 calls × 15 s) and has no `timeout-minutes` at all. Neither does `tests.yml`'s `rules` job.
- **Fix:** run the 404 checks first; deploy timeout 30; build timeout 30.
- **Effort:** S.

### R2.5-11 · Low · Docs drift
- **CLAUDE.md "Before a merge into `main`" and "A release"** don't mention applying the migration or the pre-publish database check. Both are only in the Backend section.
- **CLAUDE.md "Rolling back"** doesn't mention the database (and see R2.5-01).
- **`run.sh:4`** says "bash 4.4 or newer". STATUS says it runs on bash 3.2.
- **CLAUDE.md:156** says "~520 'ok -' lines". It's 694.
- **`supabase/README.md`'s rate-limit list** omits `cb_health`'s 120 an hour, which is what trips a re-run.
- **The README v0.31.0 paragraph** says it "closes … the round-4 review of them". STATUS lists partly-fixed and owner-blocked items.
- **Effort:** S.

### R2.5-12 · Nitpick
- **CI database job:**
  - It relies on the image's PGDG `postgresql-common` shipping `apt.postgresql.org.sh`. It does today (`install-postgresql.sh` installs from PGDG).
  - `apt-get update` refreshes every runner repo with no retry.
  - stdout is discarded.
  - It has never run.
- **`run.sh`:**
  - Every migration runs as a superuser (Supabase's `postgres` isn't one).
  - The trust-auth cluster's socket sits in a `755` temp folder, so any local user can connect as superuser while it runs.
  - The version prints as "(PostgreSQL) 16.15".
  - `ls 2*.sql` (SC2012).
  - `locale -a | grep -q` under `pipefail`.
- **`stubs.sql`:** `cron.job` has no `username` column and no RLS policy, unlike pg_cron, so `cb_health().cron` is only proven against a stand-in.
- **`build.js` and `contact`:**
  - `contact` isn't validated and is inlined through `JSON.stringify` without escaping `<`. A `</script>` contact is caught only by the script count (I tried it: "expected 2 inline scripts, found 3"). A `<!--<script>` one wouldn't be.
  - The `/*BACKEND*/` replacement isn't asserted.
  - The contact shows as plain text, not a `mailto:` link.
- **Salt retention:** `tidy` keeps yesterday's salt, though `who()` reads only today's. "Deleted within two days" is really up to 48 h 41 min, for no use.
- **Node 22** is maintenance LTS (EOL April 2027). Node 24 is current LTS.
- **Sparse checkout** is still cone mode (R2.4-13).
- **Forget's confirm** doesn't warn that without a copy of the key the results can't be opened or deleted again.
- **`db_live.js:35`** accepts 429 as "not reachable".

## 4. Coverage

**Read:**
- `git diff ce11887..46a0b03` for `.github/`, `build.js`, `src/backend.json`, `package.json`, CLAUDE.md, README, `docs/SMOKE.md`, `supabase/` (README, baseline, migration, `run.sh`, stubs, `client_call.json`, `privacy_test.sql` in part) and `test/db_live.js`.
- In `src/ui.js`: `cbFetch` through `cbRedraw`, the `cb*`/`key*`/`code*` actions, the input handlers and `aboutHTML`.
- The round-4 STATUS and my round-4 report.
- PGDG's `apt.postgresql.org.sh` (local copy), plus the runner image's `Ubuntu2404-Readme.md` and `install-postgresql.sh` (from raw.githubusercontent.com).

**Ran:**
- `npm run db:test`: 149 ok, exit 0, 2.8 s, as root; also as non-root.
- A scratch copy with a forced server failure (exit 1, log kept) and with a broken check (exit 3, kept).
- `bash -n`: clean. shellcheck 0.11.0: SC2012 info ×2. actionlint 1.7.12 on both workflows: clean.
- `npm test`: 694 ok, exit 0.
- A scratch rebuild: `index.html`, `sw.js` and `3d/map3d.js` byte-identical to the committed files.
- `build.js` validation probes (a secret key, http, a script in the contact, an array contact).
- `test/db_live.js` against a local Postgres through a PostgREST stand-in:
  - pass;
  - re-run fail (R2.5-03);
  - newer-migration fail (R2.5-01).
- `class_test.py` ×6 (1 fail) and `about_test.py` (pass) from a scratch copy.
- `key_expiry.py` (R2.5-02) and `name_carry.py` (R2.5-06).
- A secret scan of the diff and of today's history: none. The only key is the publishable one, now in `src/backend.json`.
- `gh run list`: no run exists for any Phase 2 commit.

**Couldn't check:**
- The live project (barred), so the real PostgREST answers, the live major and collation, pg_cron's RLS on live, and Supabase's address headers.
- bash 3.2: the source downloads were refused by the proxy.
- The first real run of the `database` job.

## 5. What I'd keep

- **The ordering is enforced by machine.** The deploy refuses to publish before the database is ready, instead of relying on a person to remember.
- **The baseline is out of `migrations/`**, and the refusals and the data guard are tested on every run.
- **CI is pinned:** a fixed image and major, `PG_BIN`, and a locale that matches live.
- **The bounded counters**, with no write past the limit.
- **`run.sh`'s failure handling:** a non-zero exit, a kept folder and the server log.
- **`src/backend.json` validation** that refuses a secret key at build time.
