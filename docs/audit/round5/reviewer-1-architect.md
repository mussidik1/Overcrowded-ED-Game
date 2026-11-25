# Reviewer 1, round 5: Senior Software Architect

Review of the round-4 fixes on branch `claude/sleepy-rubin-jot35n` at v0.31.0, HEAD `7cb5613` (fixes in `46a0b03`), Nov 24, 2026.
- **Scope:** `git diff ce11887..46a0b03`. That covers the migration, the baseline, `supabase/tests/*`, `src/backend.json`, `build.js`, the class-results client in `src/ui.js`, `test/db_live.js`, `test/class_test.py`, both workflows, and the docs.
- **Changes to the repo:** none, except this file. Running `test/class_test.py` rewrote its two screenshots in the gitignored `test/shots/`.
- **Where the work ran:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round5/r1/`:
  - `repo/`: a clone at `46a0b03`, rebuilt with `node build.js`. The result matches the committed `index.html` and `sw.js`.
  - `pg/`: my own throwaway Postgres 16 cluster (`up.sh`, `q.sh`, `down.sh`).
  - `fakerest.py`: a local stand-in for Supabase's gateway and PostgREST in front of that cluster. It sets `cf-connecting-ip` to the real peer, as Cloudflare does, and answers 404 for an unknown function or argument names. `live/` holds a copy of `test/db_live.js` pointed at it.
  - `probe_exp.py` and `probe_reg.py`: Playwright probes in Chrome with every Supabase call stubbed or aborted.
  - `names.js`: the client's name rule run in Node.
- Nothing contacted supabase.co or edcodeblack.com.

## 0. Round-4 status

| Finding | Status | Evidence |
|---|---|---|
| R1.4-01 Client and database ship with no order, window, gate or rollback | **Partly fixed** | **Fixed:** `db_live.js` now runs before `upload-pages-artifact` (`pages.yml:37-38`), and the order is written down ("database first"). **Still open:** the migration still adds the new API and drops the old one in one transaction (`:352-355`). There's no staging backend: `build.js` now refuses any URL that isn't `*.supabase.co`. **New problem:** the gate blocks rollbacks (R1.5-02). |
| R1.4-02 Production Send broken since Nov 24, recorded only in a SQL comment | **Still open** | STATUS lists it as fixed. The outage is still recorded only at `baseline/live_before_v0.31.0.sql:89-90`: not in STATUS, the README or SMOKE. No one-line hotfix grant was put to the owner separately. There's no scheduled check. Live Send stays broken until the whole migration ships. |
| R1.4-03 No record of what's applied, no drift detection | **Partly fixed** | **Fixed:** `codeblack.migrations`, `cb_health`, and the deploy compares the two. **Still open:** the record holds names only, with no hash. The check reads only the latest name. Re-running an older file silently reverts newer functions (reproduced, R1.5-04). The check never runs on a schedule. |
| R1.4-04 Baseline in `migrations/` reopens the leak | **Partly fixed** | **Fixed:** the file moved to `supabase/baseline/`, it has a guard, and it no longer overwrites Case Room's `client_ip()`. **Still open:** the guard holds only if the client stops at the first error. Plain `psql -f` carries on and recreates the open table and `cb_class` (reproduced, R1.5-07). `run.sh` still re-runs only the last file. |
| R1.4-05 No test sends the game's request to the real functions | **Partly fixed** | **Fixed:** `client_call.json` pins argument names and stats keys on both sides, unknown stats keys are dropped instead of refused, and a refusal names its field. **Still open:** responses, error codes, value formats and validation rules aren't in the contract (R1.5-05). There's still no PostgREST in CI. |
| R1.4-06 Registration not idempotent; lost key; false messages | **Partly fixed** | **Fixed:** the key is made on the client, so a retry is the same call. The key is saved before the call. A stale answer no longer drops a key. **Still open:** an unknown outcome still reads as "off", and a later refusal deletes the key (reproduced, R1.5-06). |
| R1.4-07 Browsing registers codes; quota; only 8 listed | Partly fixed (STATUS) | Every saved code is listed, and the limits went up to 60/600/300. Every tap still registers a code; that's the owner's reasoned call. Not re-reported. |
| R1.4-08 Typed results path gated by the version checksum | **Fixed** | `cbCodeNorm` checks format only (`ui.js:2041`), and `class_test.py:205-209` sends an old-version code. |
| R1.4-09 Rate limiter writes a row per request | **Fixed** | One counter per network, kind and hour (`:141-143`). The counter stops at limit + 1 (`privacy_test.sql:178, 183`). |
| R1.4-10 Every HTTP failure says "Couldn't reach the server" | **Partly fixed** | `cbFetch` now reports timeout, network, http (with a 404 message) and bad. Refusals are still HTTP 200, so the API logs can't count them. |
| R1.4-11 Config copied three times, read by regex | **Fixed** | `src/backend.json` is read by `build.js:4` (for `CB` and the CSP) and by `db_live.js:10`. |
| R1.4-12 Tests write to production; wrong glob; stub timestamps | **Partly fixed** | `audit_shots.py:25` and `class_test.py:36` abort `**/rest/v1/**`. The wrong glob at `audit_shots.py:110` is still there as dead code. The stubs still return `expires` without fractional seconds. |
| R1.4-13 Delete-all is the default; global ids | **Fixed** | `p_all` is explicit (`:309-323`), ids are client-made uuids, and the tests cover both. |
| R1.4-14 Unversioned stored formats; wrong version sent; silent Send | **Partly fixed** | **Fixed:** `R.ver` is stored and sent, `classes.ver` is read (`:271`), and `U.lastRep` covers blocked storage. **Still open:** the report's `v: 1` is written (`ui.js:2945`) but never read. A foreign `oc-ckeys` version gets overwritten (R1.5-09). |
| R1.4-15 Case Room coupling | Partly fixed (STATUS) | Owner's decision. Not re-reported. |
| R1.4-16 The name rule in two regex engines, disagreeing | **Still open** | STATUS lists it as fixed. Run in Node, `cbClean` refuses "अनिल", "অনিল", "தமிழ்" and "ਗੁਰਪ੍ਰੀਤ". `codeblack.clean_name` accepts "अनिल" and "অনিল" (my cluster, C.UTF-8). The comment at `ui.js:2036` still claims "the same rule". |
| R1.4-17 Docs don't match the code | **Partly fixed** | **Fixed:** the Privacy text is complete. **Still open:** CLAUDE.md's Layout block lacks `supabase/` and `src/backend.json`. Its "Rolling back" line is false in a new way (R1.5-02). See R1.5-13. |
| R1.4-18 Ad-hoc `U` fields; stale answers | Partly fixed (STATUS) | There are 8 more undeclared `U` fields (54 → 61 distinct). The new shared sequence counter causes R1.5-12. The `gatedHost` hoisting workaround is unchanged (`ui.js:3028`). |
| R1.4-19 Nitpicks | Partly fixed | **Fixed:** CI pins PG17 with `PG_BIN`, `setup-node` is in the job that runs `db_live`, and the counts use `reltuples`. **Still open:** invented timestamps, a storage parse on every render, and tests that run as a superuser. |

**Counts:** Fixed 4 · Partly fixed 12 · Still open 2 · Worse 0.

## 1. Verdict

The database side got real engineering this round: counters, idempotent registration, a self-recording migration, a health call, one config file, and a contract file read by both test suites. The release machinery around it has a new flaw:
- **The gate can't be bypassed, and it's too broad.** It demands that the live database's newest migration *equals* the repo's newest file. So:
  - a rollback of any release that carries a migration can't deploy;
  - a hotfix can't deploy during the window the README itself requires;
  - a Supabase hiccup or a slow cron job blocks a clinical content fix.
- **There is still no compatibility discipline**, so "database first" guarantees an outage for the live client.
- **The client rewrite introduced a silent data-access loss.** A code made on a device vanishes from that device after 7 days, and its key is wiped, while the class and its results live for 30.

**Do not merge to `main` until R1.5-01 and R1.5-02 are fixed.** R1.5-03 and R1.5-04 should be fixed before the next migration is written.

## 2. Score

**5 / 10** (round 4: 4). That's one point for a database layer that is now coherent and tested on the live major version. It's held back by two new Highs, one of which the fix itself created (the gate).

## 3. New findings (worst first)

### R1.5-01 · High · A code made on this device disappears after 7 days and its key is wiped, while the class and its results live for 30
- **Where:**
  - `src/ui.js:2054-2060`: `cbKeys` drops any entry whose stored `exp` has passed, and `cbKeySave` rewrites the store from that filtered list.
  - `ui.js:2067, 2070`: registration stores `exp` = the server's 7-day expiry.
  - `ui.js:2573`: a read refreshes `exp` only for a *typed* code (`if (!a && rem)`), never for a code opened from the list.
  - Migration `:283-284`: the first result moves the class to 30 days.
- **What's wrong:**
  - **Normal flow.** The instructor makes a code, students send results, and the instructor opens Results from the list.
  - **The device never learns about the 30 days.** The server now says the class lasts 30 days, but the device keeps its 7-day guess.
  - **On day 8, the code leaves the list.** The next save of any other code then purges the key from `oc-ckeys` for good.
  - **The results become unreachable.** The class and its results stay on the server until day 30, and nobody can read them unless the instructor copied the key somewhere else. The registration text had told them "It's saved on this device".
- **Reproduced** (`probe_exp.py`, Postgres-shaped timestamps):
  - after registering, the stored exp is `2026-12-01…`;
  - the results header says "deleted on Dec 24" while the list row says "until Dec 1";
  - after reading the results, the stored exp is unchanged;
  - day 8: the list has the code: False; after making another code, the raw `oc-ckeys` still holds it: False.
- **Fix:**
  - Save `r.expires` on every successful read and registration, typed or listed.
  - Never delete an entry on the client's own guess. Keep it until the server answers `key` for that code, or use created + 30 days as the local limit.
  - Keep unrecognized or unparseable entries verbatim (see R1.5-09).
  - Add a `class_test.py` step that advances the clock past 7 days.
- **Effort:** S

### R1.5-02 · High · The deploy gate blocks rollbacks and hotfixes, and can't be overridden
- **Where:**
  - `test/db_live.js:11` (`LATEST` = the newest file name) and `:22` (`hj.db === LATEST`).
  - `test/db_live.js:23-25`: overdue, cron and address are hard failures.
  - `pages.yml:35-38`: no input to skip the check.
  - `supabase/README.md:39-48`.
  - `CLAUDE.md:22` ("Rolling back … the deploy republishes the previous version").
- **What's wrong:**
  - **Equality, not "has it".** The gate passes only if the live database's *newest* recorded migration is exactly the repo's newest file.
  - **Reproduced on my stand-in.** I applied a purely additive next migration, then ran the previous release's `db_live.js`. It printed `FAIL the live database has the latest migration, 20261124120000_… (200 {"db": "20261201000000_codeblack_next", …})` and exited 1.
  - **Rollback is blocked.** `git revert -m 1` of any release that carried a migration can't publish. CLAUDE.md's emergency path ("If the live-site check reports a published source file, roll back first") depends on that revert.
    - For v0.31.0 itself, the revert removes the gate, and v0.30.0 deploys green with class results dead. `supabase/README.md:48` admits this; CLAUDE.md doesn't.
  - **Hotfixes are blocked.** The README's order is: apply the migration (step 3), then merge (step 4). Any push to `main` in between, such as a hotfix, fails the gate.
  - **One optional service now gates the whole game.** CLAUDE.md calls the backend "small, optional". Every deploy, including a clinical-content fix, now depends on all of these:
    - supabase.co being reachable;
    - the free project not being paused;
    - `overdue === 0`, which means the cron job ran within two hours;
    - the runner's quota for `cb_health` (R1.5-08).
  - **No escape hatch.** The only workaround is hand-editing `codeblack.migrations` on live, which falsifies the very record the check reads.
- **Fix:**
  - Check that the live database *contains* the repo's newest migration: have `cb_health` return the list of names, or take a name and say whether it's recorded.
  - Keep the schema checks (functions answer, contract shapes) as the hard gate. Move overdue and cron to a warning or a scheduled job.
  - Add a `workflow_dispatch` input (`skip_db_check`, with a reason that's logged) for rollbacks.
  - Correct CLAUDE.md's "Rolling back".
- **Effort:** S

### R1.5-03 · Medium · "Database first" without backward compatibility guarantees an outage, and nothing tests compatibility with the live client
- **Where:**
  - Migration `:351-355`: it drops `public.cb_results` and `cb_class(text)` in the same transaction that adds the new API.
  - `supabase/README.md:39-46`.
  - `privacy_test.sql:43-48`: only the *new* `client_call.json` is checked.
- **What's wrong:**
  - **The live game breaks first.** The README now requires the migration before the game. This migration removes the live v0.30.0 client's endpoints, so class results on the live site break the moment the owner applies it.
  - **The outage outlasts the deploy.** It lasts until the deploy, then until each player's service worker swaps in the new page.
  - **The rule allows it.** Nothing in "Releasing a database change" says a migration must keep the live release's calls working.
  - **No test can catch it.** The SQL suite checks the new contract only. The previous release's calls are never run against the new schema, so the next breaking migration will pass every check.
  - **In fairness:** for v0.31.0 the damage is small (0 rows, and old Send already broken by R1.4-02). The harm is the template.
- **Fix:**
  - Add a rule to the README: expand (add, keep old behaviour), release, then contract (drop) in a later migration once the old client is gone.
  - Keep the previous release's contract (for example `git show <last tag>:supabase/tests/client_call.json`, or a committed `client_call.prev.json`) and run its calls in `privacy_test.sql`.
- **Effort:** S to M

### R1.5-04 · Medium · Drift detection by "the latest name" can't see edits, gaps, re-runs or hand changes
- **Where:**
  - Migration `:38-41` (name and time only), `:337` (`order by name desc limit 1`), `:360` (`on conflict do nothing`).
  - `db_live.js:22`.
  - `privacy_test.sql:41, 71`: the name is hard-coded.
- **What's wrong:**
  - **Re-running an old file reverts newer code without a trace.** Every file is "safe to run twice" because it is all `create or replace`. Reproduced on my cluster:
    - a stand-in migration 2 changed `cb_class_new`;
    - I re-ran migration 1, as an owner pasting the wrong file would;
    - `cb_class_new` went back to the old body, and `cb_health` still reported `20261201000000_codeblack_next`, so the deploy would pass.
  - **An edited file is invisible.** This round rewrote the migration under the same name. Once a file is applied, any later edit to it can't be seen, because the record has no hash and `applied_at` never changes.
  - **Gaps are invisible.** An earlier file that was never applied doesn't show, because only the newest name is compared.
  - **Changes outside the files are invisible.** Hand edits in the SQL editor, and Case Room migrations touching Code Black objects (R1.4-15), leave the record unchanged.
  - **It only runs at deploy.** There's still no scheduled check, so drift between releases waits for the next deploy.
  - **Nothing enforces the self-record rule.** The README's "have it record itself" isn't checked. The next migration also breaks two unrelated checks that hard-code `count(*) = 1` and the name.
- **Fix:**
  - Have `cb_health` return a fingerprint: md5 over `prosrc`, `proconfig`, `prosecdef` and the ACL of every `cb_*` and `codeblack.*` function, plus the table definitions.
  - Have `run.sh` compute the same fingerprint on PG17 after applying the chain, compare it with a committed `supabase/fingerprint.txt`, and have `db_live.js` compare it with live.
  - Have `run.sh` assert that every file in `migrations/` appears in `codeblack.migrations`.
  - Schedule `db_live` daily.
- **Effort:** M

### R1.5-05 · Medium · `client_call.json` pins only request names; responses, errors and value rules still drift silently
- **Where:**
  - `supabase/tests/client_call.json`.
  - `class_test.py:129, 48, 164, 187`: sorted key names only. The stub bodies at `:42, 103-105, 145, 149` are written by hand.
  - `privacy_test.sql:44-48`.
  - `ui.js:2069-2081, 2556-2559, 2571-2577, 2586-2589`: the client depends on `ok`, `expires`, `error`, `field`, `rows[]`, `deleted` and `dup`.
- **What's wrong:**
  - **One direction only.** The contract binds the names the game sends to the names the functions take, plus the stats keys. That's all.
  - **Responses are hand copies.** What comes back (`rows` and every key in a row, `expires`, `deleted`, the error words `taken|busy|full|invalid|unknown|version|key`, and the `field` names) is written once in `privacy_test.sql`'s expectations and again in `class_test.py`'s stubs.
  - **A one-sided rename ships green.** Rename `rows` in the SQL and its test, and every suite stays green while the game shows nothing.
  - **The stub timestamps aren't Postgres's.** Postgres sends a variable fraction of a second (my stand-in returned `…:27.05473+00:00`). The stubs send none.
  - **The version format is checked nowhere.** `GAME_V` comes straight from `package.json`, but the server accepts only `^\d{1,3}\.\d{1,3}\.\d{1,3}$` (`:231, 266`). A pre-release version like `0.32.0-rc.1` would get `invalid` for every registration ("The server turned this code down"), and no test would fail. Every test uses a literal `'0.31.0'`.
  - **The rules are still written twice.** The name rule (R1.4-16, still disagreeing), the code alphabet and its normalization (`cbAlpha` and `norm_code`) and key normalization have no shared test vectors.
- **Fix:**
  - Add a `responses` section to the contract: each function's success shape with every key, and each error and field.
  - Build `class_test.py`'s stub bodies from it, and assert in `privacy_test.sql` that real outputs have exactly those keys.
  - Add a vectors file (names, codes, keys, accept and refuse) read by both Node and SQL.
  - In `build.js`, stop the build when the version doesn't match the server's pattern.
- **Effort:** M

### R1.5-06 · Low · Registration treats "outcome unknown" as "failed", then deletes the key on the next refusal
- **Where:** `ui.js:2076-2081` (the refusal branch deletes the key) and `2081` (the catch path), against `cbRegHTML` at `2087`.
- **What's wrong:**
  - **A timeout is an unknown outcome.** The server may have kept the class. Yet the sheet shows the code with Copy and Share, and says "Class results are off … students just can't send you their results". That's false whenever the server kept it.
  - **Try again can orphan the class.** If Try again then gets `busy`, `full` or `invalid`, `cbKeySave(code, null)` deletes the key, though the class may exist on the server with exactly that key. That's R1.4-06's orphan class reached by a new path: students who were given the code are told "Sent to the instructor".
  - **Reproduced** (`probe_reg.py` B):
    - after the 8 s limit: "Class results are off…", with Copy visible and the key kept;
    - Try again answered `busy`;
    - key still on the device: False; the same key was sent both times: True.
- **Fix:**
  - Model three states: registered, refused, unknown. In the unknown state, say "may be on; checking", and keep the key.
  - Delete a key only after a definite refusal on the first attempt.
- **Effort:** S

### R1.5-07 · Low · The baseline's guard works only in clients that stop on the first error
- **Where:** `supabase/baseline/live_before_v0.31.0.sql:19-23`: a `DO` block that raises, in a file with no `begin`/`commit`. Also `run.sh:45`, which tests it with `ON_ERROR_STOP=1`.
- **What's wrong:**
  - **psql carries on by default.** I ran `psql -f live_before_v0.31.0.sql` without `ON_ERROR_STOP` on a migrated database. It printed the guard's ERROR, then recreated:
    - `public.cb_results`, with anon column-insert grants and the "anyone may add" policy;
    - both trigger functions;
    - the open `cb_class(text)`.
  - **The test can't see it.** `run.sh` passes only because its harness stops on error.
- **Fix:**
  - Wrap the file in `begin; … commit;`, so the guard's exception aborts everything in any client.
  - Run the refusal check without `ON_ERROR_STOP`, and assert that `cb_results` is still absent afterwards.
- **Effort:** S

### R1.5-08 · Low · The live check spends the quota it measures, and never gives up early
- **Where:** `db_live.js:21, 45-51`, migration `:335` (120 `health` calls an hour per network), and the build job with no `timeout-minutes`.
- **What's wrong:**
  - **It saturates its own counter.** One run makes 122 `cb_health` calls, filling the network's counter for the clock hour.
  - **A re-run fails, with the wrong reason.** Reproduced on my stand-in: run 1 passed; run 2 straight after printed `FAIL the live database has the latest migration … (200 {"error": "busy"})` plus three more FAILs. That matters for the owner's `npm run db:live` from home, or a re-run that lands on the same egress address. The step's own advice ("apply the migration first, then re-run") is then wrong.
  - **It can flake at the hour.** If the 121 calls straddle the top of the hour, call 121 isn't refused, and the check fails falsely.
  - **No fail-fast.** It makes about 134 calls whatever the first answer is. Against an unreachable host, each waits 15 s: about 33 minutes before the deploy fails.
- **Fix:**
  - Have `cb_health` return a short per-day hash prefix of the caller's `who`. Then two calls with different forged headers must show the same prefix: no quota used.
  - Stop after the first unreachable call.
  - Add `timeout-minutes` to the build job.
- **Effort:** S

### R1.5-09 · Low · Stored-format versions are write-only or destructive
- **Where:**
  - `ui.js:2945` writes `v: 1` on the report; `lastReport` (`2841-2845`) never reads it.
  - `ui.js:2056` treats any `oc-ckeys` with `v !== 1` as empty, and `2060` then overwrites it with `{v: 1, c: {new}}`.
  - The same filter drops any entry that fails validation, including an unparseable `exp`, on the next write.
- **What's wrong:**
  - **A version nobody checks isn't versioning.** The report's `v: 1` is never read.
  - **Downgrades wipe keys.** After a rollback from a future `v: 2` key store, the first code made wipes every saved instructor key.
  - **"Ignored" really means "deleted".** STATUS's "a broken oc-ckeys entry is ignored" is true only until the next write, which deletes it.
- **Fix:**
  - On an unknown version, don't write (or write under a new storage key).
  - Carry unrecognized entries through unchanged.
  - Check `v` when reading the report.
- **Effort:** S

### R1.5-10 · Low · The two exports escape differently
- **Where:** `ui.js:2593` (Copy table: tabs and newlines only) against `2596` (CSV: prefixes `= + - @`).
- **What's wrong:**
  - **Copy table pastes raw text.** The CSV neutralizes formulas; Copy table doesn't.
  - **It's theoretical today, but it breaks the rule everywhere else.** `clean_name` makes a formula name impossible from an honest server, yet everywhere else the client treats server rows as hostile (`cbRow`, `esc`). The hostile-row test covers only the CSV (`class_test.py:177`).
  - **STATUS overstates it:** "Copy table and Download CSV (no cell can run as a formula)".
- **Fix:** use one cell function for both exports, and extend the hostile-row check to Copy table.
- **Effort:** S

### R1.5-11 · Low · "The migrations alone build a fresh project" checks one function; the gate isn't in any migration
- **Where:** `run.sh:47-51` (it checks only `cb_submit` exists) and `supabase/README.md:7` ("so it can be read, reviewed and rebuilt").
- **What's wrong:**
  - **The gate is missing on a fresh project.** On a fresh database built from stubs plus the migration, I found `cb_gate`, `cb_gate_on` and `cb_gate_check` all missing (`t|f|f|f`). They exist only in the baseline, which is declared "not a migration".
  - **Everyone would be locked out.** A gated build against a rebuilt project shows "Can't reach the server" to every player.
- **Fix:** move the gate into a migration, or document "baseline, then migrations" as the rebuild path and check `cb_gate_on` in step 5.
- **Effort:** S

### R1.5-12 · Low · One sequence counter for reads and deletes leaves "loading…" stuck
- **Where:** `ui.js:2568-2578` (`cbShow`) and `2584-2591` (`cbDelGo`), which share `U.cbSeq`.
- **What's wrong:**
  - **The read's answer gets dropped.** A delete during a Refresh takes a newer number, so the read's answer is thrown away as stale. Nothing then clears `loading`.
  - **Reproduced** (`probe_reg.py` C): the header stayed "… 2 results · deleted on Dec 1 · loading…" after the read had answered.
  - **The file keeps growing.** The rewrite also added 8 undeclared `U` fields (`cbForget`, `cbForm`, `cbSeq`, `lastRep`, `leaveAsk`, `regSeq`, `repLost`, `showKey`), and `ui.js` went from 2,985 to 3,081 lines.
- **Fix:** give each request kind its own token, and clear `loading` on every completion path.
- **Effort:** S

### R1.5-13 · Low · STATUS, CLAUDE.md and comments that don't match the code
- **STATUS.md:**
  - "Fixed" for R1.4-16: the client still refuses Indic-script names the server accepts.
  - "Fixed" for R1.4-02: the outage is still recorded only in a SQL comment.
  - "Stored formats carry a version": the report's is never read.
  - "A broken oc-ckeys entry is ignored": it's deleted on the next write.
  - "Copy table and Download CSV (no cell can run as a formula)": see R1.5-10.
  - "Stale answers are dropped for every call": see R1.5-12.
  - "Job permissions are read-only except the WebKit results upload": `pages.yml`'s build job holds `pages: write` and `id-token: write` while running `npm ci` and calling a third-party service.
  - "`run.sh` … runs on bash 3.2": `run.sh:4` says "bash 4.4 or newer".
- **CLAUDE.md:**
  - "Rolling back" (`:22`) is false (R1.5-02).
  - "Before a merge into main" describes the deploy without the database gate, which is now the first thing that can stop a release.
  - The Layout block still lacks `supabase/` and `src/backend.json`.
- **Comments:** `ui.js:2036` says `cbClean` is "the same rule as codeblack.clean_name". It isn't.
- **`class_test.py:208`:** the assertion is a tautology. `oldc in D is False` is a Python chained comparison and always False, so the check reduces to "the call went out". Whether Remember stored anything is never tested.
- **Fix:** correct each line.
- **Effort:** S

### R1.5-14 · Nitpick
- `audit_shots.py:110` still routes `**/supabase.co/**`. It's dead, and it never matched the real host.
- `stubs.sql`'s `cron.job` has no RLS and no `username`, unlike real pg_cron, so `cb_health`'s cron read is never exercised as it runs on live.
- `privacy_test.sql:199` ("there is one salt, for today") fails if a run straddles midnight UTC.
- `client_call.json` lists `cb_health`, which `ui.js` never calls, though its description says "the exact arguments src/ui.js sends".
- "Refusals past the limit write nothing" is true for rows only. `ON CONFLICT … DO UPDATE … WHERE false` still locks the tuple, which writes and logs a lock.
- `run.sh:28` relies on GNU grep's `\?` in a basic regex. The header advertises macOS (bash 3.2).
- `cbListHTML` still parses `oc-ckeys` and runs `readCode` on every render while the sheet is open.
- The privacy suite still runs as a real superuser with `set role anon`. Supabase's `postgres` role isn't a superuser.

## 4. Coverage

**Read in full:**
- The migration, the baseline, `run.sh`, `stubs.sql`, `privacy_test.sql` and `client_call.json`.
- `test/db_live.js`, `test/class_test.py`, `src/backend.json`, and the diff of `build.js`.
- Both workflows.
- `src/ui.js` from `classHTML` to `copyText`, every class and key `ACT` entry, `lastReport`, `saveRep`, `unsentGuard`, the About page's Privacy text, and the gate calls.
- The diffs of CLAUDE.md, the README, SMOKE.md and `audit_shots.py`.
- `supabase/README.md`, `docs/audit/BRIEF.md` (rounds 4 and 5), `round4/STATUS.md`, and my round-4 report.

**Ran:**
- `npm run db:test`: 149 ok, 3.1 s, PG16 C.UTF-8.
- `test/class_test.py` (Chrome, committed build): 60 ok, no errors.
- A scratch rebuild: it matches the committed build.
- On my own PG16 cluster:
  - the name rule on Indic and other names;
  - the baseline without `ON_ERROR_STOP` on a migrated database;
  - a fresh project from migrations alone;
  - the "re-run an old file" revert.
- On the local gateway stand-in: `db_live.js` run twice in one hour, and against a database one migration ahead.
- Playwright probes in Chrome:
  - `probe_exp.py`: the 7-day purge;
  - `probe_reg.py`: the timeout then `busy`, and the refresh and delete race.
- `names.js`: `cbClean` in Node.

**Not checked, and why:**
- **The live project, real PostgREST and Cloudflare:** off limits or not available. The stand-in models PostgREST's 404 for unknown functions or argument names, and Cloudflare's replacement of `cf-connecting-ip`.
- **PG17 and en_US.UTF-8:** not installed. The name-rule result above is from C.UTF-8.
- **WebKit:** not installed, so `Date.parse` of Postgres's fractional timestamps in Safari is unverified.
- **GitHub Actions runs:** no access. Whether the PGDG step works on `ubuntu-24.04` is read from the script, not seen.
- **`npm test` and `stress`:** `engine.js` is untouched by this diff.
- **Security of the SQL:** left to R3.

## 5. What I'd keep

- One counter per network, kind and hour, with the counter stopping at limit + 1. Storage now grows with networks, not with requests.
- The client-made key and the same-code-same-key-is-ok rule in `cb_class_new`. It's the right shape for idempotency.
- `codeblack.migrations` and `cb_health` as the start of a ledger and a health check. They need a fingerprint and "contains", not "equals".
- `src/backend.json` as the single source of the backend config, validated by `build.js`.
- `client_call.json` read by both the SQL suite and the Playwright suite. Extend it to responses.
- PG17 from PGDG with `PG_BIN` pinned in CI.
- `run.sh` checking the row guard and the baseline refusal at all, and keeping its evidence on failure.
- `storeOk`'s read-back check, and `U.lastRep`, so Send works with storage blocked.
