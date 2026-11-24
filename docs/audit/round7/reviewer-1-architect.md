# Reviewer 1, round 7: Senior Software Architect

Review of the round-6 fixes on branch `claude/sleepy-rubin-jot35n` at v0.31.0, HEAD `18a71f9` (fixes in `cde15e4`), Nov 24, 2026. The first migration is live and frozen. The second, `20261125120000_codeblack_round6.sql`, is not applied yet.
- **Scope:** `git diff 6328cdf..18a71f9 -- src supabase test tools .github build.js CLAUDE.md README.md docs/SMOKE.md`, plus `docs/audit/round6/STATUS.md`, `supabase/README.md` and the BRIEF (rounds 4 to 7).
- **Changes to the repo:** none, except this file. One side effect: `python3 test/class_test.py` writes `test/shots/class-report.png` and `class-results.png`, which are gitignored. Running it here overwrote those two.
- **Where the work ran:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round7/r1/`:
  - `repo/` is a `git archive` of HEAD. `node build3d.js && node build.js` there reproduces the committed `index.html`, `sw.js` and `3d/map3d.js` byte for byte.
  - `pg/` holds the scripts for my own throwaway PostgreSQL 16 cluster (C.UTF-8). Its data folder was a `mktemp` folder under `/tmp`, and it has been deleted. The `.sql` probes I ran there are quoted in the findings.
  - `probe_state.py`, `probe_perf.py`: Playwright in Chrome 153, with every Supabase call stubbed or aborted.
  - `died.js`, `died2.js`: engine probes in Node.
  - `names_js.js`, `names_js.tsv`, `diff2.txt`: the name rule on both sides, for every code point.
  - `sha/`: the `sha256sum -c` probe.
- Nothing contacted supabase.co or edcodeblack.com.

## 0. Round-6 status

| Finding | Status | Evidence |
|---|---|---|
| R1.6-01 The live migration isn't frozen; the tooling assumes one migration | **Fixed** | `applied.sha256` plus `run.sh:24-31` refuse an edited applied file, or a new one that sorts before an applied one. `privacy_test.sql` takes `:latest`. `cb_health` returns `migs`. The README says "never edit an applied migration". The remaining gap (nothing ties the file to the live ledger) is new finding R1.7-03. |
| R1.6-02 Go in the code or key box shows nothing until blur | **Fixed** | Recursive `morphKids` (`ui.js:25-40`). `probe_state.py` D1: Enter in `#cbKey` shows the list at once. D2: switching to Lessons while typing drops the class form. `class_test.py` types key by key and presses Enter. The new index-alignment weakness is R1.7-06. |
| R1.6-03 The deploy doesn't wait for the database suite or the contract test | **Fixed** | `pages.yml:49-67` runs `run.sh` on PostgreSQL 17 and `class_test.py` before `db_live.js`, on `main` only. The cost of this is in R1.7-09. |
| R1.6-04 A skipped migration is invisible | **Fixed** | Migration 2 refuses without its predecessor (`round6.sql:26-29`). `db_live.js:46-49` lists every repo migration ≤ live that isn't recorded. The rule lives only in this one file (R1.7-12). |
| R1.6-05 The contract binds names only; the error check is vacuous; responses drift | **Partly fixed** | **Fixed:** `responses` are checked exactly in SQL (`privacy_test.sql`: `cb_class_new`, `cb_class_read` and its rows, `cb_health`), and the UI test drives four send errors and three registration errors. **Still open:** `answers` now has no game-side check at all (the grep was removed, not replaced). Registration `invalid`, read `busy` and every delete error are not driven. `dup`, `field` and `scope` aren't in the contract. Nothing guards the version format. **Worse in one part:** a bad version now blocks making a code altogether (R1.7-11). |
| R1.6-06 The name rule has no generator; three Unicode versions | **Partly fixed** | My full sweep now finds **0** inputs that the server accepts and the game refuses (round 6: 1,295). What remains: 4,741 letters from Unicode 16 and 17 (game yes, server no; documented, and the game says so), and 19 space characters that the game normalizes before sending. The generator isn't pinned or wired into CI (R1.7-10). |
| R1.6-07 The full list is rebuilt every frame | **Fixed** | `probe_perf.py`: with 500 rows, `render()` takes **2.3 ms** while nothing changes (round 6: 219 ms) and 50 ms when the header changes. `cbRows` is memoised on the identity of the rows array. |
| R1.6-08 Two taps leave an unseen code listed | **Fixed** | The level buttons are disabled while saving (`classHTML`), and `codeMake` returns early. Codes never shown are filtered out of the list and purged on open. A similar race in the row flow is R1.7-07. |
| R1.6-09 Deploy-gate rough edges | **Fixed** | Three messages (equal, ahead, behind). Any non-200 answer gives one diagnosis. `overdue` and `cron` are warnings. `skip_reason` is required. `if: github.ref == 'refs/heads/main'` is on both jobs. |
| R1.6-10 The write-scoped CI job runs project code | **Fixed** | The `webkit` job checks out with `persist-credentials: false`. `webkit-save` alone has `contents: write` and runs only git. |
| R1.6-11 Docs that don't match the code | **Fixed** | CLAUDE.md now has the `oc-ckeys` shape, the deploy steps, and Layout with `supabase/`, `backend.json` and `db_live.js` and current sizes. The read order is fixed in the SQL and its comment. The README's `cb_health` bullet and the contract's description are corrected. New drift is in R1.7-12. |
| R1.6-12 Nitpicks | **Partly fixed** | **Fixed:** ON_ERROR_STOP (`run.sh:64`), a typed key's `t` (now `r.created`), the string sort (now `Date.parse`), the CSV's "UTC" (the functions now run in UTC), and the GNU `\?`. **Unchanged:** the route at `audit_shots.py:110`, `cron.job` without RLS in `stubs.sql`, and the salt count that breaks across midnight. The undeclared `U` fields moved to Phase 5. |

**Counts:** Fixed 9 · Partly fixed 3 · Still open 0 · Worse 0 (one part of R1.6-05 is worse; see R1.7-11).

## 1. Verdict

**The second migration is fit to apply.**
- **It upgrades a live database cleanly.** On my cluster I applied the baseline, then migration 1, then seeded it the way live looks: two classes (one ended but not tidied), five results, a rate row of every old kind, and yesterday's salt. Migration 2 then ran clean, and again on top of that data.
  - Both check constraints were rebuilt as intended.
  - Migration 1 re-run now refuses ("A newer Code Black migration is already applied").
  - Migration 2 on a database that only has the baseline refuses.
- **The game from the first migration still works against it.** It reads only keys that are still there, `scope` and `created` are extra keys it ignores, and `scen` is still accepted.
- **The new game degrades gracefully on migration 1 alone.** `Date.parse(undefined)` falls back, unknown stats keys are dropped, and the rows fall back to "complications from orders".
- **v0.30.0 is unaffected.** It was already cut off by migration 1, as documented.

**What is wrong is around the migration, not in it:**
- **The freeze runs on trust for exactly this file** (R1.7-03). The moment the owner applies it, it is live and editable, and only a hand-typed line in `applied.sha256` changes that. A one-space typo in that line makes `sha256sum -c` skip it silently.
- **The deploy's time-zone probe can't fail** (R1.7-04).

**The client and engine have three real defects:**
- **R1.7-01:** the attending's "own patients who died" undercounts. It repeats the bug R5-02 fixed for the department count, and none of the three new counters has a test.
- **R1.7-02:** "Use it without results" can put a code on the projector with no saved key.
- **R1.7-06:** the new `morphKids` aligns by position, so a sibling that appears above the focused form takes the keyboard away.

**No Critical or High.** Fix R1.7-01, R1.7-02 and R1.7-03 before the merge to `main`. Do R1.7-03 before the owner applies the migration.

## 2. Score

**7 / 10** (round 6: 6).
- **Up:** the deploy gate, the freeze and the contract are real mechanisms now, and the migration is careful.
- **Not higher:**
  - the freeze isn't self-enforcing;
  - one live probe proves nothing;
  - the round's new engine counters shipped untested, and one of them is wrong;
  - the client state machine still has paths, each a few taps long, that lose a key or show a stale state.

## 3. New findings (worst first)

### R1.7-01 · Medium · The attending's "own patients who died" misses deaths still in the room, and none of the three new counters is tested
- **Where:**
  - `engine.js:3377` counts `S.md.died` only in `leave(p, 'expired')`.
  - A roomed death first goes to `dsp = 'family'` (`:2268`, `:2313`), then to the morgue. That is at least 35 game minutes, and an action, before `leave`.
  - `endShift` (`:4404`) counts those not-yet-gone dead in `R.expired` (the audit's R5-02 fix), but nothing does the same for `md.died`.
  - The undercount flows into the summary row "Your own patients who died" (`ui.js:3065`), `mdDied` in the Send payload (`:3087`, `:2222`), and the instructor's row and CSV.
- **What's wrong** (`died2.js`):
  - **The setup.** Manic Monday as the attending, seed 22. At game minute 680 one of the attending's own roomed patients arrests, and nobody runs the code.
  - **The result at shift end:** `Tamika S. dsp=morguing mine=true | md.died=0 | report.expired=1`.
  - **What the instructor would read:** "saw N patients" with no "(1 of them died)", next to "department: … 1 died".
  - **It isn't only late arrests.** Any death within roughly the last hour, or before an early end (fired, or a walkout), is lost the same way.
  - **No tests.** `grep` finds no rule test for `md.contra`, `md.unneeded`, `md.died` or `endMin`. Only `class_test.py` exercises them, and only by rendering stubbed numbers. CLAUDE.md's "each release adds tests for its new rules" isn't met.
- **Fix:**
  - Count the death where it happens: where `dsp` becomes `'family'` and in the unroomed `leave`. Or add the attending's own not-yet-gone dead in `endShift`, the way `expired` does.
  - Add a rules test that forces an own-patient arrest at minute 700 and asserts that `md.died === 1` at the end.
  - Add rules tests for `contra` (a contraindicated drug), `unneeded` (counted whatever the dice say) and `endMin` (a fired shift).
- **Effort:** S

### R1.7-02 · Medium · "Use it without results" after the sheet was reopened shows a code whose key is saved nowhere
- **Where:**
  - `ui.js:2615`: opening Class code deletes every key with `p && !s`, unless `U.reg` is `saving`.
  - `ui.js:2630-2633`: `codeNoRes` saves the key only `if (K)`.
  - `U.reg` (with its key and its fail panel) survives closing and reopening the sheet.
- **What's wrong** (`probe_state.py` A, Supabase calls aborted):
  - **A1.** Tap Five-Minute Rush. The state is `{"st":"fail","net":true}` and the key is saved as `p:1, s:0`.
  - **A2.** Close and reopen the sheet. `oc-ckeys` is now `{}`, but "Use it without results" is still offered.
  - **A3.** Tap it. Code `MMX-80K` is on screen, `oc-ckeys` is still `{}`, the code isn't in the saved list, and the key lives only in `U.reg.key`.
  - **A4.** After a reload, `oc-ckeys` is still `{}`.
  - **Who gets hurt.** The class plays the code, and the instructor can never "Set up results".
  - **The worse case is a timeout.** A timeout also sets `net`. If the 8-second timeout fired after the server had registered the class, students' named results go into a class whose key no longer exists. Nobody can read or delete them for 30 days.
  - **It breaks the documented promise.** The comment on `cbRegister` promises "the key is saved before the call … so it isn't lost if the answer is".
- **Fix:**
  - `codeNoRes` writes `{ k: R.key, t: Date.now(), p: 1, s: 1 }` from `U.reg`, whether or not a record exists.
  - The purge on open skips any code that `U.reg` holds, in any state, not only `saving`.
- **Effort:** S

### R1.7-03 · Medium · The freeze runs on trust for the migration about to go live, and a malformed line is silently skipped
- **Where:**
  - `supabase/README.md`, "Releasing" step 3, and STATUS "Needs the owner": add the hash by hand after applying.
  - `run.sh:26`: `sha256sum -c` without `--strict`, with stdout to `/dev/null`.
  - `run.sh:27`: `awk '{print $2}'` counts the name as applied anyway.
  - `db_live.js:46-49` has the live ledger (`hj.migs`) and never reads `applied.sha256`.
- **What's wrong:**
  - **The window opens on apply.** Once the owner applies migration 2, it is live but not frozen until someone commits its hash. In that window the exact failure from R1.6-01 is back: an in-place edit passes `run.sh`, `privacy_test.sql` and the deploy, because `db === LATEST` and `migs` contains the name.
  - **Nothing notices a forgotten hash,** ever.
  - **A typo disables the check without a failure.** I ran `sha/`: a line written with one space between hash and name (an easy hand-typed slip) makes `sha256sum -c` print a warning and exit 0, even with a wrong hash. Meanwhile `run.sh:27` counts the file as applied. So the file is listed as frozen and never checked.
- **Fix:**
  - In `db_live.js`, fail when a migration recorded live and present in the repo is missing from `applied.sha256`. Both lists are already in hand, so the deploy enforces the freeze.
  - Use `sha256sum --strict -c` (and `shasum -a 256 --strict -c`).
  - Optionally, have `run.sh` refuse an `applied.sha256` line that doesn't match `^[0-9a-f]{64}  [0-9]{14}_.*\.sql$`.
- **Effort:** S

### R1.7-04 · Low · The deploy's time-zone probe passes on a database without the fix
- **Where:** `db_live.js:84-89`. All 31 probe calls send the same `Prefer: timezone=Asia/Kathmandu`.
- **What's wrong** (my cluster, the same address on every call):

  | | Migration 1 only (live today) | With migration 2 |
  |---|---|---|
  | `db_live` style: all 31 calls in Kathmandu | call 31 `busy` | call 31 `busy` |
  | Mixed: 30 calls in UTC, then call 31 in Kathmandu | call 31 `{"ok": true}` (a new bucket) | call 31 `busy` |

  - **One zone throughout opens no new bucket.** With a single zone, the hour bucket is the same on every call, so the probe can't tell the fixed database from the broken one.
  - **The check proves nothing, but its message claims it does:** "forged address headers and another time zone don't get round the rate limit". STATUS repeats the claim. The local SQL test does cover this, but the live check is supposed to catch a gateway or database that differs from the local one.
- **Fix:** send calls 1 to 30 without `Prefer` (UTC), and call 31 with `Prefer: timezone=Asia/Kathmandu`. Expect `busy`.
- **Effort:** S

### R1.7-05 · Low · `busy` doesn't say hour or day; the game promises "up to an hour" for a refusal that can last until UTC midnight
- **Where:**
  - `round6.sql:198-199` and `:231-232`: `allow_day` refusals return the same `{"error":"busy"}`.
  - `ui.js:2055`: `CB_BUSY` says "Wait a while (up to an hour), then try again."
- **What's wrong:**
  - **The message is wrong for the daily limits.** A network that hits 200 codes or 3,000 sends in a UTC day is refused until midnight UTC, up to 24 hours. Every refusal tells the instructor or student "up to an hour".
  - **Shared networks hit it first.** The networks that get there are the shared ones the design already worries about: a school NAT, or a carrier's CGNAT IPv4 address. Those users will retry every hour, all day.
  - **The contract can't express the difference.**
- **Fix:**
  - Return `{"error":"busy","scope":"day"}` from the daily checks.
  - Add `scope` to `client_call.json`.
  - Show "until about <local time of the next UTC midnight>".
- **Effort:** S

### R1.7-06 · Low · `morphKids` matches children by position: a sibling that appears above the focused form drops the keyboard, and typing goes nowhere
- **Where:** `ui.js:25-40`. The focused branch is patched in place only if `cur[i]` and `next[i]` have the same tag, id and class at the *same index*. Otherwise the branch is replaced.
- **What's wrong** (`probe_state.py` B, registration answer held):
  - **B1.** Tap a shift (saving). Then tap "Open with an instructor key" and type `ABC` into `#cbCode`. Focus is in `#cbCode`.
  - **B2.** The registration answers `ok`. The saved-codes `<ul>` and its note are now inserted above the form, inside `.cb-res`. The index shift replaces the form, and focus goes to `BODY`.
  - **B3.** Type `DEF`. The box still holds `ABC`, and `U.cbForm.code` is `ABC`.
  - **Other ways in.** Forgetting the last saved key while typing in the form removes the `<ul>` and gives the same shift.
  - **The general weakness.** Any sheet where something can appear above a text box has this problem. Today that is only this one.
- **Fix:**
  - Find the focused branch's counterpart in `next` by id (or by `data-pick`) wherever it sits, not by index.
  - Or give the form a fixed position: render the saved-codes list after the form, or always render an empty `<ul>`.
- **Effort:** S to M

### R1.7-07 · Low · Setting up two saved codes at once drops the first success; its row keeps saying "results not set up yet"
- **Where:** `ui.js:2634-2643`. There is one `U.regRow` and one `U.rowSeq`. A second row's tap bumps `rowSeq`, so the first answer is dropped before `cbKeySave` runs.
- **What's wrong** (`probe_state.py` C):
  - **The setup.** Two listed codes with `p:1, s:1`. I tapped "Set up results" on both, and both answers were `ok`.
  - **The records afterwards:** `00V-R5S: {p:1, s:1, e:0}` and `01Q-G86: {s:1, e:…}`.
  - **The rows afterwards:** `00V-R5S … results not set up yet | Set up results`, although the server registered it.
  - **The first row's button is enabled again** while its call is still out.
  - **It is recoverable,** because the call is idempotent. It is still the same "list says one thing, server another" class of bug that R1.6-08 was about.
- **Fix:** keep the sequence per code (`U.regRows[code]`). Or disable every row's Set up while one is saving. And a dropped `ok` should still save the record.
- **Effort:** S

### R1.7-08 · Low · An ended class's code can be taken at once by anyone who has it (every student), and later sends go to them
- **Where:**
  - `round6.sql:204-205`: any caller with any key deletes an ended class and registers the code to itself.
  - The game's "Turn results back on" then answers `taken`, with the message "Another class has X on the server now".
- **What's wrong** (my cluster):
  1. Instructor A registers `TKE-001`, and the class ends.
  2. Student B registers `TKE-001` with their own key: `{"ok": true, …}`.
  3. A classmate sends: `{"ok": true}`.
  4. B reads it back, name included: `Ana`.
  5. A's "Turn results back on" gets `{"error": "taken"}`.
  - **The mechanism is older than this round.** Migration 1's 500-row clean-up in `cb_class_new`, and the hourly tidy, allow it too.
  - **But this round makes it immediate and gives it a user-facing path.** The code still plays on the same version, the student's Send box still says it goes "to the instructor who made X", and there is no tombstone.
- **Fix:**
  - On expiry, keep `(code, key_hash, until)` for the rest of the version's useful life, or 30 days.
  - During that window, only the same key may re-register the code; another key gets `taken`.
- **Effort:** M

### R1.7-09 · Low · A release, including an emergency rollback, now depends on four more outside services and a longer build
- **Where:**
  - `pages.yml:51-67`: PGDG's apt repository, `pip install -q playwright` (unpinned), `playwright install --with-deps chromium` (Playwright's CDN plus apt), and npm.
  - `pages.yml:23-25`: `concurrency: pages` with `cancel-in-progress: false`.
- **What's wrong:**
  - **`skip_db_check` skips only `db_live.js`.** If apt.postgresql.org or the Playwright CDN is down, a rollback can't publish, and nothing documents what to do.
  - **A new Playwright release can break the release gate without any code change.**
  - **The emergency path got slower.** A rollback pushed while a build is running waits for it, and the build now installs PostgreSQL and a browser.
  - **The docs don't match.** CLAUDE.md's "Rolling back" describes only the Supabase-down case.
- **Fix:**
  - Pin `playwright==<version>` (and the same in `tests.yml`).
  - Add an emergency input that still runs `npm test` but skips the PostgreSQL and Playwright steps for a revert.
  - Or trigger the deploy on `workflow_run` of a green Tests run, so nothing is installed twice.
- **Effort:** S

### R1.7-10 · Low · `tools/name_ranges.py` depends on whichever Python runs it, and nothing runs it
- **Where:** `tools/name_ranges.py` uses `unicodedata` from the running Python. It isn't called from `run.sh`, `tests.yml` or `pages.yml`.
- **What's wrong:**
  - **The result depends on the Python version:**

    | Python | Unicode | `--check` |
    |---|---|---|
    | 3.11 | 14.0 | **FAIL** (`m`, `d`) |
    | 3.12 | 15.0 | ok ("is Unicode 15.0.0") |
    | 3.13 | 15.1 | ok ("is Unicode 15.1.0") |
    | 3.14 | 16.0 | will fail |

    It passes on 3.12 only because 15.0 and 15.1 happen to have the same M and N tables. The migration says "Unicode 15.1".
  - **The invisible-character list (`DI`) is pasted by hand.** It is correct for 15.1, but the generator doesn't generate it.
  - **Letters still come from glibc** (`[[:alpha:]]`) on the server and from `\p{L}` in the browser.
  - **The sweep that would catch drift isn't a test.** Today that sweep finds 4,741 Unicode 16 and 17 letters that the game accepts and the server refuses, plus 19 spaces the game normalizes.
- **Fix:**
  - Exit unless `unicodedata.unidata_version == '15.1.0'` (or read vendored UCD files).
  - Run `--check` in the `database` CI job.
  - Commit the sweep, verbatim `cbClean` against `clean_name`, as a test that allows only the documented classes.
- **Effort:** S

### R1.7-11 · Low · A version that doesn't match `X.Y.Z` now blocks making a class code at all
- **Where:**
  - `cbRegister` (`ui.js:2105-2123`): `invalid` sets `hard`, deletes the key and never shows the code.
  - `build.js` still has no check of the version format.
  - Server side: `p_ver !~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'` returns `invalid`.
- **What's wrong:**
  - **Then:** with `"version": "0.31.1-hotfix"` (or `-rc.1`), every registration was refused, but the code still showed and played ("Class results are off").
  - **Now:** the instructor sees "No class code yet. The server turned this code down. Make another." with no Try again and no "Use it without results". Making another code fails the same way. The classroom feature, not just results, is gone.
  - **Nothing in the tests sees it.** The contract's `p_ver` is the literal `"0.31.0"`, so no test catches it.
- **Fix:** make `build.js` stop when `package.json`'s `version` doesn't match the server's pattern. In the game, treat a registration `invalid` like a network failure: offer "Use it without results".
- **Effort:** S

### R1.7-12 · Nitpick
- **No lock timeout.** Migration 2 has no `set local lock_timeout`. Its `ALTER TABLE`s take ACCESS EXCLUSIVE on `codeblack.rate`, which every API call writes, and on `results`. Behind a stuck lock, every call queues for as long as the SQL editor allows.
- **`run.sh` coverage:**
  - it never re-runs the newest migration over data (I did: it's fine);
  - it never tests migration 2's "apply the first one first" refusal;
  - the README's template (step 1) doesn't ask future migrations for that predecessor guard, so R1.6-04's fix lives in one file.
- **`is_public` doesn't match its comment.** The comment says "IANA's special-purpose registries", but the list:
  - misses `3fff::/20` and `5f00::/16` (both 2024);
  - with `2001::/23`, covers blocks IANA marks globally reachable (`2001:3::/32`, `2001:4:112::/48`, `2001:20::/28`).
- **`cb_health` publishes usage.** It gives the classes and results fill levels to 3 decimals to anyone with the public key, which is roughly the live counts to ±100 and ±300. The deploy needs only "under half".
- **Stale names and lists in the docs:**
  - `db_live.js:58` says `codeblack.client_ip`, and so does `supabase/README.md` "Whose address"; the address is now read by `client_addr`.
  - The README's names paragraph omits middle dots, the geresh and joiners.
  - Its stats sentence omits `mdDied`, `contra`, `unneeded` and `endMin`.
  - CLAUDE.md's contract sentence omits `responses`, and its `cb_health` bullet omits `migs` and the backstops.
- **The live-site comment understates.** It says "retries for up to 5 minutes per address". 30 tries × (curl ≤ 20 s + 10 s) is about 15 minutes. With two addresses that can use the whole 30-minute job before the 404 checks run.
- **STATUS overstates.** "The UI test drives each send and registration error": registration `invalid` isn't driven.
- **Remember is lost.** A typed read with Remember ticked, still in flight when the sheet is closed and reopened, is dropped, and its key isn't remembered.
- **A past date can show.** A saved row says "results until <date>" after the date has passed, until a read marks it ended.
- **The record migration reinterprets old records.** `cbKeys` now reads a pre-round-6 `{k, t, p: 1}` (then meaning shown but unconfirmed) as never shown, and the next open deletes it. Only internal test builds wrote that shape, but the `v: 1` record changed meaning without a version bump.
- **New counters aren't initialised.** `contra`, `unneeded` and `died` aren't in the attending's initial stats object (`engine.js:861`); every reader relies on `|| 0`.
- **R1.6-12 leftovers:** see §0.

## 4. Coverage

**Read in full:**
- **Database:** `20261125120000_codeblack_round6.sql` (against migration 1, line by line), `run.sh`, `applied.sha256`, the `privacy_test.sql` diff, `client_call.json`, `tools/name_ranges.py`.
- **Deploy and CI:** `test/db_live.js`, `pages.yml`, `tests.yml` (and its diff).
- **Client and engine:** the `ui.js` diff (all 17 hunks: `morph`/`morphKids`, `classHTML`, the name rule, `cbKeys`, `cbDraw`, `cbRegister`, `cbRegHTML`, `cbRow`/`cbRows`/`cbDet`/`cbListHTML`/`cbTable`, `cbArgs`, every class `ACT` entry, the paste handler, Escape, About, the report), the `engine.js`, `style.css`, README and `SMOKE.md` diffs, and `class_test.py`.
- **Docs:** CLAUDE.md, `supabase/README.md`, round-6 STATUS, my round-6 report, and the BRIEF.

**Ran:**
- `npm run db:test`: 193 ok, PG16, C.UTF-8, 2.4 s.
- `npm test`: 694 ok, exit 0.
- `python3 tools/name_ranges.py --check` under Python 3.11, 3.12 and 3.13.
- `CHROME_PATH=/usr/bin/google-chrome python3 test/class_test.py`: 86 ok, no errors.
- A scratch rebuild: byte-identical.
- **On my PG16 cluster:**
  - migration 2 over seeded migration-1 data, twice;
  - migration 1 re-run over migration 2;
  - migration 2 over the bare baseline;
  - the time-zone probe on migration 1 alone and with migration 2;
  - the ended-class takeover;
  - the name sweep over U+0080 to U+2FFFF and U+E0000 to U+E01EF, in three shapes (584,784 inputs).
- **Node:** `died.js` (36 bot shifts as the attending: none had an own-patient death) and `died2.js` (a forced late arrest).
- **Playwright in Chrome 153:** the state probes A to D and the render cost at 30, 100 and 500 rows.

**Not checked, and why:**
- **The live project, real PostgREST or Cloudflare (including whether `Prefer: timezone` is honoured):** off limits.
- **PostgreSQL 17 and en_US.UTF-8:** not installed here. The sweep's server half used glibc's C.UTF-8.
- **WebKit and iOS:** not installed. Whether Safari parses six-digit fractional seconds is not checked; the format is unchanged from migration 1.
- **GitHub Actions and environment settings:** no access.
- **`npm run stress`:** the engine change is three counters with no random draws, and `npm test` (golden) passed.

## 5. What I'd keep

- **Migration 2's guards:** refuse without its predecessor, refuse over a newer migration, one transaction, and it records its own name.
- **Its constraint handling:** constraints dropped by type and definition, then re-added with fixed names. It is idempotent over real data.
- **`SET timezone TO 'UTC'` on every function that reads the clock,** with `date_trunc(..., 'UTC')` as well. The SQL test checks it with UTC+14 and UTC+5:45.
- **`client_addr` and `client_ip` split:** the address is judged whole and grouped only for limits.
- **The joiner strip with a lookahead on both sides,** so a stray joiner is still refused.
- **The freeze file with `run.sh`'s "sorts before an applied one" rule.** Make it strict and tie it to the ledger (R1.7-03).
- **The deploy gate:** the same database and contract tests as CI, on `main` only, version first and then the 404 checks.
- **`responses` checked exactly on the SQL side.**
- **On the client:**
  - the per-kind sequence numbers, bumped on Forget, Close and reopen;
  - `cbRows` memoised on array identity, with shared formatters;
  - a code shown only after `ok`;
  - the ask before replacing a code on screen;
  - the masked key box, cleared on reopen.
- **Engine counters with no random draws,** so golden stays put.
