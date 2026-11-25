# Reviewer 1, round 6: Senior Software Architect

Review of the round-5 fixes on branch `claude/sleepy-rubin-jot35n` at v0.31.0, HEAD `6328cdf` (fixes in `2b51323`), Nov 24, 2026. The migration is live on the real project.
- **Scope:** `git diff 7cb5613..6328cdf -- src supabase test .github build.js CLAUDE.md`, plus the README, `supabase/README.md` and `docs/audit/round5/STATUS.md`. `src/engine.js` is untouched by this diff.
- **Changes to the repo:** none, except this file.
- **Where the work ran:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round6/r1/`:
  - `repo/`: a clone at `6328cdf`. `node build.js` there reproduces the committed `index.html` and `sw.js` byte for byte.
  - `pg/`: scripts for my own throwaway PostgreSQL 16 cluster (C.UTF-8). Its data folder was a `mktemp` folder under `/tmp`, because `/tmp/claude-0` is mode 700 and the `postgres` user can't enter it. The folder has been deleted.
  - `fakerest.py`: a local stand-in for Supabase's gateway and PostgREST, adapted from round 5. `live/` holds a copy of `test/db_live.js` pointed at it.
  - Playwright probes in Chrome 153 with every Supabase call stubbed or aborted: `probe_focus.py`, `probe_perf.py`, `probe_perf2.py`, `probe_words.py`, `probe_reg.py`, `probe_uni.py`.
  - `names_client.js`, `names_client.txt` and `names_server.txt`: the name rule on both sides for every code point.
- Nothing contacted supabase.co or edcodeblack.com.
- **Disclosure:** at about 22:09 UTC I ran `rm -rf /tmp/tmp.*` to clean up a `run.sh` folder that a failed run of mine had left behind. If another reviewer's `npm run db:test` was running at that moment, its temp folder was deleted too, and that run should be repeated.

## 0. Round-5 status

| Finding | Status | Evidence |
|---|---|---|
| R1.5-01 Key purged on day 7 while the class lives 30 | **Fixed** | `cbKeys` keeps an entry until `t + CB_LIFE` (30 days) (`ui.js:2063-2067`). `class_test.py` ages a key by 20 days and it is still listed. |
| R1.5-02 Deploy gate blocks rollbacks and hotfixes, can't be overridden | **Fixed** | `hj.db >= LATEST` (`db_live.js:30`). There are separate exits for busy (`:28`) and unreachable (`:27`), and `skip_db_check` (`pages.yml:10-14, 43-44`). On my stand-in, a second run in the same hour passes ("31 refused"). The leftovers are in R1.6-04 and R1.6-09. |
| R1.5-03 "Database first" without backward compatibility | Left (STATUS gives a reason) | Not re-reported. A rollback now depends on the old release's `db_live.js` probes passing against a newer schema. That is still an untested compatibility rule (R1.6-04). |
| R1.5-04 Drift detection by "the latest name" | **Partly fixed** | **Fixed:** an older file over a newer one is refused (`migration:30-34`; `run.sh:47-50`). **Still open:** there is no hash, so a revised file under the same name re-applies silently. I reproduced it: the result is a broken database while the gate stays green (R1.6-01). Gaps are invisible (R1.6-04). Nothing runs on a schedule. STATUS gives a reason only for hand edits. |
| R1.5-05 Contract pins only request names | **Partly fixed** | **Fixed:** errors and 41 names were added. **Still open:** the game side checks errors by a text search that passes vacuously. Responses are still stubbed by hand. The format of `p_ver` is checked nowhere (R1.6-05). |
| R1.5-06 Unknown outcome reads as "failed", and the key is deleted later | **Partly fixed** | **Fixed:** the key is kept (`p: 1`) on busy, full and timeout, and the list says "results not set up yet". **Still open:** after a timeout, the sheet still says "Class results are off for this code … can't send you their results until it's set up" when the server may have kept the class (`probe_reg.py` B). |
| R1.5-07 Baseline guard works only with ON_ERROR_STOP | **Fixed** | The file is wrapped in `begin; … commit;`. With plain `psql -f` on a migrated database, the guard raises, every later statement is aborted, and `cb_results` and `cb_class` stay absent (reproduced). The test still runs it with ON_ERROR_STOP (R1.6-12). |
| R1.5-08 Live check spends its own quota, never gives up early | **Fixed** | It has a probe bucket of 30 and waits out the top of the hour (`:55`). It fails fast when the host can't be reached (exit after one call, 0.09 s). Both jobs have 30-minute limits. A 5xx answer still doesn't fail fast (R1.6-09). |
| R1.5-09 Stored-format versions | Moved to Phase 5 (STATUS) | Not re-reported. The key record changed shape (`exp` became `p`) under the same `v: 1`. That's harmless only because the old format never shipped. |
| R1.5-10 The two exports escape differently | **Fixed** | One `cbCell` (`ui.js:2163`) is used by both Copy table and CSV. |
| R1.5-11 The gate isn't in any migration | **Still open** | STATUS says "the fresh-project check covers every function". `run.sh:56` checks the five `cb_` functions, not `cb_gate`, `cb_gate_on` or `cb_gate_check`. A fresh database built from stubs plus the migration returns `f|f|f` for all three (reproduced). A rebuilt project still locks every player out of a gated build. |
| R1.5-12 One sequence counter for reads and deletes | **Fixed** | `cbDelGo` no longer touches `U.cbSeq`. A delete now updates the list that is open at the time. |
| R1.5-13 STATUS, CLAUDE.md and comments vs code | **Partly fixed** | **Fixed:** "Rolling back" is corrected, and the `class_test.py` tautology is replaced by `expect_request`. **Still open:** the Layout block still lacks `supabase/`. **New mismatches:** see R1.6-11. |
| R1.5-14 Nitpicks | **Partly fixed** | **Still there:** the dead route at `audit_shots.py:110`, `cron.job` without RLS in the stub, the salt check that fails across midnight (`privacy_test.sql:215`), `cb_health` listed as a game call in `client_call.json`, and the `\?` at `run.sh:28`. **Worse:** the per-frame cost of the list now includes two `Intl` calls per row (R1.6-07). |

**Counts:** Fixed 6 · Partly fixed 5 · Still open 1 · Worse 0 · Left or moved 2.

## 1. Verdict

**The gate:** this round fixed what I asked for. Rollbacks pass. A busy or unreachable Supabase says so. There is an emergency skip, the baseline is transactional, the keys live 30 days, and both exports share one escape.

**The migration:**
- **No hash.** The migration is live now, yet nothing records which text was applied.
- **Same-name revisions slip through.** Re-applying an earlier revision of the same file turns a database silently wrong: `cb_health()` becomes ambiguous, new classes last 7 days, and the probe kind is missing. `cb_health` still reports the expected name, so the deploy goes green.
- **The test harness assumes a single migration.** A second, template-correct migration fails `privacy_test.sql:41`, and makes `run.sh` step 2 pass for the wrong reason. So the easy path for this round's SQL fixes is the dangerous one: editing the live file.

**The contract:**
- **Requests are bound.** It binds request names and 41 sample names.
- **Errors are not really bound.** On the game side, the error check is a substring search over 3,000 lines that matches `{ key: el.value }` and the bed board's `'full'`.
- **Responses are not bound at all.** Nothing on the server side pins `created_at`, and the game's "in the order they came in" depends on it.

**The client:** `morph()`'s new focus hold works one top-level section at a time. In the class sheet, that one section holds the form, the errors and the results list. So pressing the keyboard's Go in the key box reads the results and shows nothing until the box loses focus.

**Merge and next steps:**
- **No Critical or High.** Fix R1.6-02 before the merge to `main`.
- **Before any new SQL:** fix R1.6-01 and R1.6-04 before the next database change is written, which this round's SQL findings may need.
- **Deploy gate:** R1.6-03 is a one-line hole in the release gate.

## 2. Score

**6 / 10** (round 5: 5). The deploy gate, the key lifetime and the baseline are now sound. The migration ledger isn't. The contract tests promise more than they check, and the hold in the new typing fix is one level too coarse.

## 3. New findings (worst first)

### R1.6-01 · Medium · The live migration isn't frozen, and the tooling only works with one migration
- **Where:**
  - `supabase/migrations/20261124120000_codeblack_private_results.sql`. It was rewritten under the same name in `46a0b03` and `2b51323`, then applied to live at the `2b51323` text. Nothing in the repo records that.
  - `codeblack.migrations` (name and time only).
  - `privacy_test.sql:41` (`count(*) = 1` and the name, hard-coded) and `:78` (the name, hard-coded).
  - `run.sh:38-41` (step 2 runs `$last` over the pre-v0.31 baseline).
  - `supabase/README.md` "Releasing" (no rule that an applied file never changes).
- **What's wrong:**
  - **A revised file re-applies silently.** On a fresh cluster I applied the round-5 text of this same file (`git show 7cb5613:…`), then the current text. Both ran without error. `codeblack.migrations` holds one row with the expected name, so `cb_health` and the deploy gate are satisfied. Meanwhile:
    - `pg_proc` has both `cb_health()` and `cb_health(boolean)`. `select public.cb_health()`, the README's step-3 check, fails with "function public.cb_health() is not unique".
    - The check on `codeblack.rate.kind` still lacks `'probe'`, because `create table if not exists` skipped it. So every `cb_health(true)` call errors, and the deploy's forged-header check fails with the wrong diagnosis.
    - `codeblack.classes.expires_at` still defaults to `now() + 7 days`, while the game and docs say 14.
  - **"Safe to run twice" holds only for identical text.** The live project got only the final text, so it's fine today. A developer database that ran an earlier revision is in the broken state above, and nothing reports it.
  - **The next migration fights the harness.** I added a stand-in `20261201000000_codeblack_next.sql` that follows the README template exactly: one transaction, the newer-name guard, records itself. `npm run db:test` (in my scratch clone) then fails at `privacy_test.sql:41`, "the migration recorded itself, once".
  - **Step 2 goes vacuous.** "with a row in the old table, the migration refuses and changes nothing" still prints ok. But it now runs the new file over the pre-v0.31 baseline, where it fails only because the `codeblack` schema doesn't exist.
  - **The cheap path is the dangerous one.** Every SQL fix from now on has to be a new file. The harness punishes that, and an in-place edit of the live file is invisible to every check.
- **Fix:**
  - Commit `supabase/applied.txt` listing each applied file's name and sha256. A CI step fails if an applied file's hash changes. Have `cb_health` return the list of names.
  - Pass the expected newest name to `privacy_test.sql` as a psql variable, instead of hard-coding it and the count.
  - Make `run.sh` step 2 apply the whole chain over the baseline-with-a-row.
  - Add to the README: "An applied migration never changes. Fix forward with a new file."
- **Effort:** S to M

### R1.6-02 · Medium · The keyboard's Go in the instructor's code or key box shows nothing until the box loses focus
- **Where:**
  - `morph()` (`ui.js:16-33`) holds the whole top-level child that contains the focused input, and sets `el._h = null` to try again every frame.
  - `classHTML` puts the form, the saved codes, the errors and the results list into one top-level child, `.cb-res` (`cbListHTML`, `ui.js:2128`).
  - `ui.js:3046` binds Enter in `#cbCode` and `#cbKey` to `ACT.cbShow(); render()`, without moving focus.
- **What's wrong** (`probe_focus.py`, Chrome 153, phone viewport):
  - **A: Enter in the key box (the soft keyboard's Go).** The read goes out and `U.cbList.rows` is filled, but `.cb-list` isn't on screen. It's still missing 3 s later, and the form stays visible although `U.cbOpen` is false. The results appear only after `blur()`.
  - **B: a wrong key plus Enter.** `U.cbList.err` holds "That code and key don't match…", but it isn't on screen.
  - **C: a malformed key plus Enter.** The client's own message ("An instructor key is 16 letters…") isn't shown either.
  - **D: a click that leaves focus in the box** (here a script click; the same happens in any browser that doesn't move focus to a tapped button). The results aren't shown.
  - **E: the hold survives a sheet change.** With focus in `#cbKey`, switching `U.sheet` to Lessons leaves the whole class form inside the Lessons sheet.
- **Fix:**
  - Blur the input in the Enter handlers (`e.target.blur()`).
  - Hold only the focused input element, not its whole section. Or give the form its own top-level node, so errors and results are siblings that can still update.
  - Drop the hold when the sheet's type changes.
- **Effort:** S

### R1.6-03 · Medium · The deploy doesn't wait for the database suite or the game-side contract test
- **Where:**
  - `pages.yml:33-44`: the build job runs `npm test`, `npm run stress` and `db_live.js`.
  - `tests.yml:36-78`: `run.sh` and `class_test.py` run only here.
  - `CLAUDE.md`, "Before a merge into main".
- **What's wrong:**
  - **Neither half of the contract gates a publish.** `client_call.json` is checked by `privacy_test.sql` (database side) and `class_test.py` (game side). Neither runs in `pages.yml`.
  - **The two workflows race.** A push to `main` starts the Tests workflow and the Deploy workflow in parallel. The deploy publishes in minutes, while the Chrome job has a 75-minute budget.
  - **A red contract still ships.** A merge whose contract or SQL tests fail deploys anyway. The only thing standing in the way is a human remembering "the Tests workflow is green on `3d` at the exact commit".
- **Fix:**
  - Add the `database` job and `class_test.py` to `pages.yml`'s build. Or trigger the deploy on `workflow_run` of Tests (conclusion `success`, branch `main`).
- **Effort:** S

### R1.6-04 · Medium · "Live ≥ repo" can't see a skipped migration, and the new guard makes the skipped file impossible to apply
- **Where:**
  - `db_live.js:30` compares the newest live name with the repo's newest name.
  - The guard (`migration:30-34`) refuses when any newer name is recorded.
  - The README template asks for the guard but not for a check of the previous migration.
- **What's wrong:**
  - **Reproduced on my cluster.** I wrote two stand-in migrations to the template: M2 adds `cb_two()`, M3 adds `cb_three()`. I applied M3 and skipped M2. Then:
    - M2 refuses for good ("A newer Code Black migration is already applied");
    - `cb_health()->>'db'` is M3, and `cb_two()` doesn't exist;
    - `db_live.js`'s check (`db >= LATEST`) passes.
  - **Easy to hit.** This happens whenever a release carries two files and the owner pastes only the newest. The README's step 3 says "the file", singular.
  - **Recovery means hand edits.** Fixing it requires hand-editing either the ledger or the file.
- **Fix:**
  - Each migration also raises if its predecessor's name isn't recorded.
  - Have `cb_health` return every recorded name. `db_live.js` then asserts that each file in `migrations/` is recorded; live-only extras stay allowed, for rollbacks.
- **Effort:** S

### R1.6-05 · Medium · `client_call.json` binds request names and 41 sample names; the error check passes vacuously, and responses still drift
- **Where:**
  - `class_test.py:46-48`: `f"'{e}'" not in src_ui and f"{e}:" not in src_ui`, run over all of `ui.js`.
  - `privacy_test.sql:49-52`: a regex over `prosrc` for `'error', '<word>'`.
  - The contract file has no response section.
  - `build.js` has no version check.
- **What's wrong:**
  - **The error check is a substring search.** In `ui.js`:
    - `key:` is found at `ui.js:3041` (`{ key: el.value }`, a form field).
    - `'full'` is found at `ui.js:591` (a bed's capacity state).
    - `cb_class_read`'s `key` error has no branch of its own: it lands in the `else` message (`ui.js:2617`).
    - A future error named `expired` would "have a message" because the stats builder contains `expired:` (`ui.js:2169`).
    - STATUS's "the UI test checks the game has a message for each" overstates a grep.
  - **Responses are unbound.** Nothing in `privacy_test.sql` asserts that a row has `created_at`; `:152` checks `id`, `ver`, `stats` and that `code` is absent. `class_test.py`'s rows are hand-written. If `created_at` were renamed, both suites would stay green, and the game would lose the time on every row.
    - **The sort would quietly turn into a ranking.** `cbRows` sorts by that missing string (`ui.js:2114-2117`), so the list would fall back to the server's order, `order by r.score desc` (`migration:315`), under a header that says "in the order they came in".
  - **Version format still unchecked.** A pre-release `package.json` version (`0.32.0-rc.1`) makes every registration `invalid`, which also deletes the key (`ui.js:2087`), and every send is refused (`field: ver`). The contract's `p_ver` is the literal `"0.31.0"`, so no test sees it.
- **Fix:**
  - Export the game's error-to-message table (for example `OCUI.CB_WHY[fn][err]`), and test its keys against `answers` exactly.
  - Add a `responses` section with each function's keys. Build `class_test.py`'s stubs from it, and assert real outputs against it in SQL.
  - Stop the build when `version` doesn't match the server's pattern.
- **Effort:** M

### R1.6-06 · Low · The name rule's Unicode ranges have no generator, and the two sides use three different Unicode versions
- **Where:**
  - `clean_name` (`migration:204-218`): about 4 KB of `\u` ranges, "generated from Unicode 15.1". No script in the repo makes them.
  - `cbClean` (`ui.js:2046-2047`) uses the browser's own `\p{L}`, `\p{M}` and `\p{N}`.
  - The server's `[[:alpha:]]` follows glibc on Supabase's image.
- **What's wrong:**
  - **Every code point, swept.** I tested each code point from U+0080 to U+2FFFF, as a whole name (`ch`) and after a letter (`"A" + ch`). Client: the verbatim `cbClean` in Node 22 (Unicode 17). Server: `codeblack.clean_name` on PG16 C.UTF-8. They disagree on **10,703** inputs:
    - **9,389 newer than Unicode 15.1.** Unassigned in 15.1, letters or marks in Unicode 16 and 17. The client accepts them; the server refuses. Confirmed in Chrome 153: `cbClean('𐵐𐵑')` (Garay) and `'𖵃𖵄'` (Kirat Rai) are accepted, and `clean_name` returns null for both. The student gets "The server refused that name".
    - **1,295 combining marks the server accepts as the first character.** For example U+0345, U+05B0 and U+093E, because glibc counts many marks as `alpha`. The SQL comment says "a letter, then…". The client refuses them.
    - **19 space and format characters.** The client normalizes them before sending, so they're harmless.
  - **No regeneration path.** It isn't written down, and the function is in an applied migration (R1.6-01). So when Unicode changes, the fix is a new migration with hand-pasted ranges.
  - **The contract can't see the drift.** Its 41 sample names don't reach it.
- **Fix:**
  - Commit the generator, pinned to one UCD version. Have it write explicit letter, mark and number tables for both SQL and JS, and stop relying on `\p{}` and `[[:alpha:]]`.
  - Make the sweep a test.
  - Document "regenerate, then a new migration".
- **Effort:** M

### R1.6-07 · Low · Every frame rebuilds the whole results list: 500 results cost about 220 ms per render
- **Where:** `frame()` calls `render()` every 110 ms (`ui.js:3018`). While the sheet is open, `classHTML` → `cbListHTML` → `cbRows` re-sorts every row, and for each row calls `cbDet` and `cbDate(r.at, true)`, which means two `Intl` calls. It also re-parses `oc-ckeys` and runs `readCode` on every saved code.
- **What's wrong** (`probe_perf.py`, this container's CPU):
  - **The sheet costs this much per render(), with nothing changing on screen:**
    - 30 rows: 6 to 24 ms;
    - 100 rows: 61 ms;
    - 500 rows (the server's cap per class): 219 ms.
  - **Focus makes it worse.** With focus held in a box, it's 300 → 403 ms (`probe_focus.py` F), because `_h = null` disables the early return.
  - **Past about 110 ms, the main thread never rests.** Taps queue behind the renders. A phone is slower than this container.
- **Fix:**
  - Memoize the sheet's HTML on its inputs: list identity, a keys revision, `showKey`, `cbForget`, `ask`.
  - Precompute the rows once per response, and reuse one `Intl.DateTimeFormat`.
- **Effort:** S

### R1.6-08 · Low · Two taps on a shift leave a code the instructor never saw, listed as "results not set up yet" for 30 days
- **Where:** `codeMake` and `cbRegister` (`ui.js:2561, 2075-2092`). Each tap saves a `p: 1` key before its call, and a superseded answer is dropped (`seq !== U.regSeq`) without touching that key. The level buttons stay enabled while saving.
- **What's wrong** (`probe_reg.py` A, a 600 ms network):
  - **The setup.** I tapped Five-Minute Rush, then Quiet Tuesday. The server answered `ok` to both.
  - **What the instructor sees.** The screen shows the second code. The list also shows `FWS-018 … Five-Minute Rush … results not set up yet`, with a Set up results button.
  - **That listing is wrong twice.** The instructor never saw `FWS-018`, and it *is* set up on the server: it holds a class row for 14 days.
- **Fix:** disable the level buttons while saving. On a superseded answer, delete the unseen code's key: nobody has that code.
- **Effort:** S

### R1.6-09 · Low · Deploy-gate rough edges
- **Where:** `db_live.js:26-33` and `pages.yml:9-14, 41-44, 57-71`.
- **What's wrong:**
  - **Misleading messages.** The migration line ends "A newer one is fine (a rollback)." on every normal pass (equal names). It says the same when `db` is missing: on a 503 stand-in it printed `(live: undefined). A newer one is fine (a rollback).`, because `undefined < LATEST` is false.
  - **No fail-fast on a 5xx answer.** A paused or broken gateway that answers 5xx falls through to about 45 more calls.
  - **`overdue` and `cron` are still hard failures,** and the only escape is the all-or-nothing `skip_db_check`. A lagging cron job therefore forces a clinical hotfix to skip the migration check too.
  - **The skip has no reason field.**
  - **Nothing in the workflow limits a manual run (or its skip) to `main`.** Whether another branch can publish rests on the `github-pages` environment's branch rule, which isn't in the repo or the docs.
- **Fix:**
  - Use three messages: equal, ahead, unknown.
  - Treat a non-200 answer like an unreachable host.
  - Turn `overdue` and `cron` into warnings, or give them their own skip.
  - Add a required `reason` input.
  - Add `if: github.ref == 'refs/heads/main'` on the deploy job.
- **Effort:** S

### R1.6-10 · Low · The one write-scoped CI job runs `npm ci`, `pip install` and 16 test scripts with its token in `.git/config`
- **Where:** `tests.yml:80-156`. The `webkit` job has `contents: write` for the whole job, and `actions/checkout@v4` keeps the token (`persist-credentials` defaults to true).
- **What's wrong:**
  - **A compromised dependency can push.** Install scripts (esbuild's postinstall) and every test run with a token that can push to any unprotected branch, including `main`.
  - **A push to `main` deploys.**
  - **Already suggested once.** R2.4-10 suggested `persist-credentials: false`; it wasn't applied.
- **Fix:** check out with `persist-credentials: false`, upload `results.txt` as an artifact, and push it from a small `needs: webkit` job that alone has write.
- **Effort:** S

### R1.6-11 · Low · Docs that don't match the code
- **CLAUDE.md:**
  - The Backend section gives `oc-ckeys` as `{ v: 1, c: { code: { k, exp, t } } }`. The code stores `{ k, t, p }` (`ui.js:2061-2066`).
  - "Before a merge into main" describes the deploy as build check, `npm test`, stress and the live-site check. It omits the database check, which is now the first thing that can stop a release.
  - The Layout block still lacks `supabase/`, `src/backend.json` and `test/db_live.js`. Its sizes are stale: `engine.js` is 4,889 lines, not about 4,400; `ui.js` is 3,126, not about 2,800.
- **STATUS (round 5):**
  - "The fresh-project check covers every function": it doesn't cover the gate's (R1.5-11).
  - "The UI test checks the game has a message for each": it's a substring search (R1.6-05).
  - "Both sides now take" the same name rule: they don't (R1.6-06).
- **Code and SQL comments:**
  - `ui.js:2043` says `cbClean` is "the same rule as codeblack.clean_name".
  - `migration:300` says `cb_class_read` returns results "best first", and `privacy_test.sql:149` tests "best score first". The server still ranks by score, which contradicts the unranked decision. The game's arrival order depends on a key nothing pins (R1.6-05).
- **`supabase/README.md`:** the `cb_health` bullet lacks `public` and the probe mode.
- **`client_call.json`:** its description says "calls: the exact arguments src/ui.js sends". It includes `cb_health`, which `ui.js` never calls.
- **Fix:** correct each line.
- **Effort:** S

### R1.6-12 · Nitpick
- `run.sh:51` still runs the baseline-refusal check with `ON_ERROR_STOP=1`. Deleting the new `begin;` from the baseline would go unnoticed.
- A typed key kept with Remember gets `t` = now (`ui.js:2613`), so the list says "made <today>" for a code made elsewhere, days earlier.
- `cbRows` sorts timestamps as strings. That works only while every row has the same UTC format. The CSV's "Sent (UTC)" column assumes the server's session time zone.
- The dead route at `audit_shots.py:110`, `cron.job` without RLS in `stubs.sql`, the midnight-sensitive salt check (`privacy_test.sql:215`) and the GNU `\?` at `run.sh:28` are all unchanged.
- `U` still has 37 undeclared fields; 7 of them (`cbForget`, `cbForm`, `cbSeq`, `lastRep`, `leaveAsk`, `regSeq`, `showKey`) come from Phase 2 (Phase 5 per STATUS).
- `lastReport()` now returns `U.lastRep || d`, so a storage copy is never consulted while the page lives. That's correct for one tab, but no comment says it assumes one tab.

## 4. Coverage

**Read in full:**
- The diff of `src/ui.js` (morph, toasts, `classHTML`, `cbFetch` through `cbSendHTML`, every class and key `ACT` entry, `lastReport`, `saveRep`, `unsentGuard`, `showReport`, About), `test/db_live.js`, `pages.yml`, `tests.yml`, the migration, `run.sh`, the `privacy_test.sql` diff, `client_call.json` and the `class_test.py` diff.
- The diffs of CLAUDE.md, the README, `supabase/README.md` and the baseline.
- `docs/audit/round5/STATUS.md` and the BRIEF (rounds 4 to 6).

**Ran:**
- `npm run db:test`: 158 ok, 2.3 s, PG16 C.UTF-8.
- `test/class_test.py` on the scratch build: 67 ok, no errors.
- A scratch rebuild: it matches the committed build.
- On my own PG16 cluster:
  - the baseline without ON_ERROR_STOP on a migrated database;
  - a fresh project from the migration alone (the gate is missing);
  - two revisions of the same migration in sequence;
  - a skipped migration under the new guard;
  - the full name-rule sweep.
- In the scratch clone: `run.sh` with a second, template-correct migration.
- On the gateway stand-in: `db_live.js` run twice in one hour, against an unreachable host, and against a 503 gateway.
- Playwright in Chrome 153: the focus hold (A to F), render cost with 30, 100 and 500 rows, the Words sheet cost (no change: about 1-2 ms), two quick taps on a shift, and a timeout.

**Not checked, and why:**
- **The live project, real PostgREST and Cloudflare:** off limits.
- **PG17 and en_US.UTF-8:** not installed. The sweep's server half used glibc's C.UTF-8 tables here; Supabase's glibc may differ again.
- **WebKit and iOS focus behaviour:** not installed. R1.6-02 is shown with Enter, a path the code binds itself.
- **GitHub Actions and environment settings:** no access, including the `github-pages` branch rule.
- **`npm test` and stress:** `engine.js` is untouched.

## 5. What I'd keep

- `hj.db >= LATEST` with separate busy and unreachable exits, and a skip that announces itself as a `::warning::`. That's the right shape for a gate that has to allow rollbacks.
- The probe bucket. Testing forged headers against their own small counter, and waiting out the top of the hour, makes re-runs deterministic.
- The newer-name guard. Add a predecessor check and it's a real ledger rule.
- The baseline in one transaction.
- `CB_LIFE` keyed to creation time, instead of the client's guess at expiry.
- One `cbCell` for both exports.
- Per-kind sequence handling: reads use `cbSeq`; deletes update the list that is open.
- The `names` lists in the contract, checked on both sides. It's the right mechanism, just with too few names (R1.6-06).
- Job-scoped `pages: write` and `id-token: write`, and `timeout-minutes` on every job.
