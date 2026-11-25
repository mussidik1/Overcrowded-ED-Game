# Reviewer 1, round 8: Senior Software Architect

Review of the round-7 fixes on branch `claude/sleepy-rubin-jot35n` at v0.31.0, HEAD `87c9c13` (fixes in `2f2b08d`), Nov 25, 2026. The first migration is live and frozen. The second, `20261125120000_codeblack_round6.sql`, is not applied, and it changed again in round 7. I reviewed it as the file the owner will paste.
- **Scope:** `git diff 18a71f9..87c9c13 -- src supabase test tools .github build.js package.json CLAUDE.md README.md docs/SMOKE.md .gitattributes`, plus `docs/audit/round7/STATUS.md`, `supabase/README.md`, the BRIEF (rounds 6 to 8) and my round-7 report.
- **Changes to the repo:** none, except this file. `python3 test/class_test.py` rewrote the gitignored `test/shots/class-*.png`.
- **Scratch:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round8/r1/`
  - `repo/` is a `git archive` of HEAD. `node build3d.js && node build.js` there reproduces the committed `index.html`, `sw.js` and `3d/map3d.js` byte for byte.
  - `pg/` holds `up.sh` and `q.sh`, which ran my own throwaway PostgreSQL 16 cluster (en_US.UTF-8, data in a `mktemp` folder, now deleted), and `m2_round6draft.sql`, which is `git show 18a71f9:supabase/migrations/20261125120000_codeblack_round6.sql`.
  - `probe.py`, `probe2.py` and `probe3.py` are Playwright probes in Chrome with every Supabase call stubbed or aborted.
  - `joiners.js` and `joiners.tsv` hold the joiner sweep (game side).
- Nothing contacted supabase.co or edcodeblack.com.

## 0. Round-7 status

| Finding | Status | Evidence |
|---|---|---|
| R1.7-01 The attending's own deaths undercounted; the new counters untested | **Fixed** | `endShift` (`engine.js:4422-4423`) adds own dead with `dsp` family, morgue or morguing that haven't gone. `test/rules13.js` checks the unleft body (1), a body that left (counted once), another provider's death (0), `contra`, `unneeded` and `endMin`. It is part of `npm test` (703 ok). The UI, Send and export all read `R.md.died`. |
| R1.7-02 "Use it without results" after a reopen showed a code with no saved key | **Fixed** | The purge on open skips `U.reg.st === 'fail'` (`ui.js:2634`). `codeNoRes` writes the record from `U.reg` (`:2649-2653`). `probe.py` P3: after a reopen, the key is still there (`p:1, s:0`); after the tap it is `p:1, s:1` and the code is on screen. |
| R1.7-03 The freeze runs on trust; malformed lines skipped | **Fixed** | `run.sh` refuses any line that isn't `^[0-9a-f]{64}  [0-9]{14}_[a-z0-9_]+\.sql$` and uses `--strict`. `db_live.js:15,55-57` fails on a migration live but not in `applied.sha256`, or listed there but not live. What is still missing is checking *content*, not names: that is new finding R1.8-01. |
| R1.7-04 The time-zone probe couldn't fail | **Fixed** | Odd calls send `Prefer: timezone=Asia/Kathmandu` (`db_live.js`, probe loop). On a database that buckets by zone, call 31 is the 16th in the UTC bucket and answers `ok`, so the check fails as it should. |
| R1.7-05 `busy` doesn't say hour or day | **Partly fixed** | The message now reads "Try again in an hour (or tomorrow, if it has hit its daily limit)". The server still sends no `scope`. The daily reset is 00:00 UTC, which in the US falls in the same evening, so "tomorrow" is wrong there. |
| R1.7-06 `morphKids` matched by position | **Fixed** | The held branch is matched by tag, id and class (`ui.js:41-48`). `probe.py` P2: type `ABC` in `#cbCode`, release the registration (the list appears above the form), type `DEF`. Focus stays in `cbCode`, which holds `ABCDEF`. The new button hand-off has its own defect: R1.8-02. |
| R1.7-07 Two Set up results at once dropped one | **Fixed** | `U.regRows[code]` holds a sequence per row (`ui.js:2654-2665`). `probe2.py` P4: both held answers are released `ok`, and both records are confirmed with `e` set. |
| R1.7-08 An ended class's code could be taken over | **Fixed in the SQL** | `tidy` deletes results at the end and codes 30 days later; `cb_class_new` gives `taken` to another key (`round6.sql:202-210, 240-248`). On my cluster, another key gets `{"error":"taken"}` and the own key gets a fresh 14-day class. The deploy cannot tell whether *this* version is the one applied: R1.8-01. |
| R1.7-09 Release depends on more outside services | **Fixed** | Playwright is pinned to 1.65.2 in both workflows, and that version exists on PyPI. The `contract` job is separate. `skip_db_check` plus a reason skips it. The PGDG step says when the repository is unreachable. Step time limits are set. CLAUDE.md's "Rolling back" is updated. |
| R1.7-10 `name_ranges.py` depends on the Python version, and nothing runs it | **Partly fixed** | It now exits unless the Python has Unicode 15.1.0, and it generates and checks `di` too. It still isn't in CI, and the new message is wrong for Python 3.12: R1.8-05. |
| R1.7-11 A non-x.y.z version blocked making codes | **Fixed** | `build.js:5-6` stops the build. |
| R1.7-12 Nitpicks | **Partly fixed** | **Fixed:** lock timeout, re-run over data, the predecessor refusal tested, the README template, fill to a tenth, `client_addr` names, the names and stats paragraphs, the 15-minute comment, "may have ended". **Unchanged:** `2001::/23` still covers the globally reachable `2001:3::/32`, `2001:4:112::/48` and `2001:20::/28`. The rest are documented as left by design. |

**Counts:** Fixed 9 · Partly fixed 3 · Still open 0 · Worse 0.

## 1. Verdict

**The second migration is correct, but the release machinery can't prove that the reviewed version is the one that goes live.**

What checks out on my cluster:
- **Guards.** It refuses without migration 1 and refuses over a newer migration.
- **Lock timeout.** With a transaction holding a row lock on `codeblack.rate`, the migration stopped after 10 s at line 52 ("canceling statement due to lock timeout") and changed nothing.
- **Idempotent.** It is safe to re-run over data (`run.sh` step 8, 72 classes and 2 results kept).
- **The held-code tombstone** behaves as documented.
- **v0.30.0 is unaffected.** It only uses the gate, which no migration touches.
- **The engine counters are right** and now tested.

What fails:
- **R1.8-01: the ledger identifies a migration by its name only.** This file has been rewritten twice under one name. The round-6 draft and the final version give `test/db_live.js` the same answers on every check. The draft lacks the R1.7-08 fix, so another key takes an ended code.
- **`applied.sha256` freezes the repo's file, written after the paste.** If the owner pastes a stale copy, the repo, `run.sh` and the deploy all pass while describing a database that isn't live.
- **R1.8-02 to R1.8-07 are Low.**
  - The new button focus hand-off jumps to a different button.
  - The panel and the saved-codes row contradict each other about whether results are on.
  - The tombstone's cost to the backstop and to `cb_health` wasn't recomputed.
  - `name_ranges.py` tells a Python 3.12 user to use Python 3.12.
  - The watch's alert path is unverified.
  - Docs drift again.

**No Critical or High.** Fix R1.8-01 before the owner applies the migration. It is a cheap change, and after the paste it can only be checked by hand.

## 2. Score

**7 / 10** (round 7: 7).
- **Up:** every round-7 finding is fixed or partly fixed, and I verified each one in code and in a running browser or database. The migration is careful.
- **Not higher:** the freeze and the deploy gate still trust a file name for the one migration that matters most right now. The client still has two sources of truth for one code (`U.reg` and `oc-ckeys`). Each round's fixes bring new doc drift and a vacuous test.

## 3. New findings (worst first)

### R1.8-01 · Medium · The live ledger records a migration's name, not its content: a stale or edited draft of migration 2 passes the deploy
- **Where:**
  - `round6.sql:372` records only `'20261125120000_codeblack_round6'`.
  - `cb_health` returns names (`migs`), and `db_live.js:15,47-57` compares names.
  - `applied.sha256` is the SHA-256 of the *repo's* file, added after the paste (`supabase/README.md` "Releasing" step 3; STATUS "Needs the owner").
- **Reproduce** (my PG16 cluster, scripts in `pg/`):
  1. Two databases, each with stubs, baseline and migration 1.
  2. Database `a` gets HEAD's migration 2. Database `b` gets `git show 18a71f9:supabase/migrations/20261125120000_codeblack_round6.sql`, the round-6 draft with the same name.
  3. Call what `db_live.js` calls, with `request.headers` set to `{"cf-connecting-ip":"8.8.4.4"}` and `set role anon`. Both give identical answers:
     - `cb_health(false)`: same `db`, `migs`, `cron`, `addr`, `public`, `overdue`. The only difference is `"classes": 0.0` against `0.000`, and both are numbers.
     - `cb_class_read` and `cb_class_delete` with a made-up key: `{"error": "key"}`.
     - `cb_submit` with level `x`: `{"error": "invalid", "field": "level"}`.
     - `cb_class_new` with version `x`: `{"error": "invalid"}`.
     - The probe test hits `busy` in both, since both use UTC.
  4. Register `TKE-001` with key `AAAA…`, set `expires_at` one minute in the past, then register with key `BBBB…`:
     - `a`: `{"error": "taken"}`.
     - `b`: `{"ok": true, …}`. A student takes over the ended code, which is R1.7-08 again.
  5. The function bodies differ (md5 of the `prosrc` and `proconfig` of the `codeblack.*` and `public.cb_*` functions, gate excluded):
     - `a`: `ed4a157b…`, 19 functions.
     - `b`: `5c39f42a…`, 18 functions.
     - Nothing reads this.
- **Why it matters now:**
  - The file changed after two reviews under one name.
  - The round-6 draft contains raw invisible characters that a paste can alter (R2.7-01).
  - The hash the owner commits is computed from the repo, not from what he pasted. A stale paste, or an edit slipped into the "add hash" commit, gets frozen as truth. `run.sh`, `db_live.js` and the daily watch all pass from then on, and every later migration is reviewed against a database that doesn't exist.
- **Fix** (pick one):
  - **Content fingerprint (best).** `cb_health` returns `fp`: the md5 of `string_agg(oid::regprocedure || prosrc || proconfig)` over the `codeblack` and `cb_` functions, plus the check-constraint definitions. `prosrc` is the literal `$$` body, so it doesn't depend on the PostgreSQL version. `run.sh` computes it after applying every migration and compares it with a committed `supabase/migrations/fingerprint`, and `db_live.js` fails when live differs. Because this lands in migration 2 itself, it covers this apply.
  - **Cheaper.** The migration records a revision tag, for example `name = '…_round6'` plus `rev = 'r7'` in a new column, and `db_live.js` requires it. Bump it whenever the file changes before it is applied.
  - **Now, with no code.** The owner pastes from the green commit's raw file on GitHub, not from any copy he already holds. Before committing the hash, he runs a behavioural check in the SQL editor: a held code refuses another key.
- **Effort:** S to M.

### R1.8-02 · Low · The button focus hand-off moves focus to a *different* button with the same action: Refresh jumps to the saved-codes row's Results
- **Where:** `ui.js:21,26`. After a redraw, focus goes to the first `[data-act]` in the container with the same `data-act` and `data-arg`.
- **Reproduce** (`probe.py` P1, stubbed server):
  1. Make a code (`ok`) and open its results (3 rows).
  2. Focus **Refresh** at the bottom of the results, then press Enter while the read is held.
  3. `document.activeElement` is now the **Results** button in the saved-codes row at the top (`closest('.cb-codes')` is true). It stays there after the answer.
  4. Enter again re-reads from that button.
- **Other pairs that collide:**
  - `cbShow` + code: the row's Results and the list's Refresh.
  - `keyShow` and `keyCopy` + code: the code panel's buttons and its row's.
- **Effect.** For a keyboard or screen-reader user, focus leaves the place they were. With `preventScroll`, a sighted keyboard user doesn't even see where it went. This is the opposite of what R4.7-09 asked for.
- **Fix:** remember which match it was (its index among the same `act`/`arg` in `el.querySelectorAll`), or give each button a stable key (`data-k`) and match on that.
- **Effort:** S.

### R1.8-03 · Low · Two sources of truth for the code on screen: the panel says results are off after its row turned them on
- **Where:**
  - `classHTML` and `cbRegHTML` read `U.reg`.
  - `cbListHTML` reads `oc-ckeys`.
  - `codeRegSaved` (`ui.js:2654-2665`) updates `oc-ckeys` and `U.regRows`, never `U.reg`.
  - In the `off` state, the same code offers **Try again** in the panel and **Set up results** in its row.
- **Reproduce** (`probe3.py`):
  1. Abort `cb_class_new`. Tap Five-Minute Rush, then **Use it without results**.
     - The panel says "Class results are off for this code … **Tell them not to tap Send**".
     - The row says "results not set up yet · Set up results".
  2. Let `cb_class_new` answer `ok`, and tap the row's **Set up results**.
     - The row says "results until Dec 8 … · Results".
     - The panel still says results are off, tell students not to send.
     - `U.reg.st` is `off`. The record is `{k, t, e, s:1}`.
- **Effect.** The projected panel tells the class not to send while results are actually on. This is the same "one screen, two answers" class of bug as R1.6-08 and R1.7-07.
- **Fix:** in `codeRegSaved`'s `ok` branch, when `U.reg && U.reg.code === c`, move `U.reg` to `ok` (with `key`, `exp`, `made`, `saved`). Or hide the row's Set up results for the code that is in the panel. Or derive the panel's state from the stored record.
- **Effort:** S.

### R1.8-04 · Low · The held-code tombstone wasn't re-costed: it counts against the backstop, makes filling it about 3× cheaper, and makes `cb_health` scan every held code
- **Where:**
  - `round6.sql:206`: codes are held 30 days after they end.
  - `:234`: `reltuples > 100000` counts held rows.
  - `:349-350`: `overdue` is an `OR` with an `exists` per row.
  - `supabase/README.md` "Backstops" still says "About 100,000 *live* classes". Its clean-up query, `delete … where created_at > '<start>' and not exists (select 1 from codeblack.results …)`, now matches every legitimate held code too, since held codes have no results by design. Running it reopens the takeover the hold exists to prevent.
- **Numbers:**
  - **Lifetime.** An unused code now holds a row for 44 days (was 14); a used one for 60 (was 30).
  - **Cost to fill.** Keeping 100,000 rows takes about 2,300 new codes a day (was about 7,150). That is 12 IPv4 addresses at 200 a day, or 3 IPv6 /48s at 1,000 a day (was 36 and 8).
  - **Recovery.** Once full, `full` refuses every instructor for up to 44 days unless someone cleans up by hand.
  - **The health scan.** On my cluster with 90,000 held rows, `cb_health(false)` took **543 ms** (`cb_class_new` 2 to 10 ms). Anyone with the public key may call it 120 times an hour per network.
- **Fix:**
  - Compare the backstop with *live* classes (`count(*) where expires_at > now()`, which the index serves), or keep tombstones in a narrow table (`code`, `key_hash`, `until`).
  - Split `overdue` into two indexed counts: held past 30 days, and results joined to ended classes.
  - Change the README query to `expires_at > now()`.
- **Effort:** S.

### R1.8-05 · Low · `tools/name_ranges.py` tells a Python 3.12 user to use Python 3.12, and every CI job runs 3.12
- **Where:** `tools/name_ranges.py:58` (`UNICODE = '15.1.0'   # … Python 3.12 and 3.13 ship it`) and `:63`.
- **Reproduce:** `python3.12 tools/name_ranges.py --check` exits 1 with "This Python has Unicode 15.0.0; the lists are Unicode 15.1.0. Use Python 3.12 or 3.13 …".
  - Python 3.12.3 ships Unicode 15.0.0, 3.13 ships 15.1.0, and 3.11 ships 14.0.0. I checked all three here.
  - `tests.yml` and `pages.yml` both set up Python `'3.12'`, so the check can't be added to CI as it stands (R1.7-10).
- **Fix:** say "Python 3.13". Add a database-job step with `setup-python` 3.13 that runs `--check`.
- **Effort:** S.

### R1.8-06 · Low · The daily watch's alert path is unverified: GitHub emails scheduled-run failures to whoever last changed the cron line, and that was a commit authored as `Claude <noreply@anthropic.com>`
- **Where:**
  - `db-watch.yml:1-3` ("GitHub emails the repo's owner").
  - `supabase/README.md:25`.
  - STATUS line 37.
- **Evidence:**
  - `git log -- .github/workflows/db-watch.yml` shows `2f2b08d`, authored and committed by `Claude <noreply@anthropic.com>`.
  - GitHub's rule for scheduled workflows is that notifications go to the user who last modified the cron syntax, subject to that user's notification settings.
  - Nothing has ever made the watch fail on purpose to see whether an email arrives.
- **Smaller points:**
  - The file uses `ubuntu-latest`, while this round pinned every other job to 24.04.
  - It runs only from `main`, where none of it exists until v0.31.0 merges.
- **Fix:** after the merge, add a `force_fail` input, run it once by hand, and confirm the owner receives the email. Or have the owner make a commit that touches the cron line. Or open a GitHub issue on failure (`issues: write`), so the alert doesn't depend on mail settings.
- **Effort:** S.

### R1.8-07 · Low · Docs and STATUS that don't match the code
- **`supabase/README.md:55`** lists "the clean-up job missing" under "warnings (not failures)". `db_live.js` now fails on it, and STATUS says it does.
- **Deletion wording ignores the hold:**
  - CLAUDE.md:141 says a code lasts 14 or 30 days, "then it and its results are deleted".
  - The README's v0.31.0 paragraph says "A code and everything sent for it are deleted 30 days…".
  - The code row is now held 30 more days with its key hash.
- **`supabase/README.md`, other lines:**
  - The `round6.sql` row in the files table omits the hold, the /48 limits and the rescheduled job.
  - `privacy_test.sql` is listed as "About 190 checks"; it runs 207.
  - Step 1 says "(`run.sh` checks all of these)". `run.sh` doesn't check `set local lock_timeout` or `begin … commit`, and its predecessor check is `grep -q 'first'`.
- **CLAUDE.md:158** says "`npm test` # rules.js through rules12.js … (~690 'ok' lines)". `rules13.js` is in `npm test`, and it prints 703 ok lines. The Layout section's `test/rules*.js` line doesn't mention `rules13.js`.
- **`style.css:1021`:** the masked-key comment (R5.6-02) now sits on `.cc-code.lost`.
- **STATUS overclaims:**
  - "'Use it without results' is offered for any failure." It isn't offered for `invalid`: `hard` hides both buttons. That case is unreachable now that `build.js` checks the version, but the sentence is false.
  - "docs corrected": see the points above.
  - "GitHub emails the owner": see R1.8-06.
- **Effort:** S.

### R1.8-08 · Nitpick
- **A vacuous test.** `test/class_test.py:54`, "the failure reads as an error", is `color == red or 'No class code yet' in t`. The second half is already asserted on the line above, so the check can't fail. It would fail without it: `.cb-key.bad small` has no red colour; only the border is red.
- **Dead code.** `engine.js:1910` `!(k === 'cardiovert' && p.ck === 'afib' && cardiovertOk(p))` can never be false: the `else if (k === 'cardiovert' && cardiovertOk(p))` branch above has already taken that case.
- **Rounding.** `cb_health` rounds fill to a tenth, so 0.45 becomes 0.5. The watch then fails at 45% and says "MORE than half full".
- **The clean-up job remedy depends on an unwritten convention.** The remedy "re-run the newest migration" works only while the newest migration contains `cron.schedule`. README step 1 doesn't require future migrations to include it. Re-running a whole migration (ACCESS EXCLUSIVE on `rate`) to re-enable a job is heavy; the one-line `select cron.schedule('codeblack-tidy', '41 * * * *', 'select codeblack.tidy()')` is the remedy to print.
- **The live-site check can test the previous deployment.**
  - The version check (`"$ver"` in `index.html`, 30 tries) passes at once against the previous deployment when a push to `main` doesn't bump the version.
  - Then only the cache name tells deployments apart (6 tries). It is identical when `index.html` didn't change, for example a change only to the package step, which is exactly the leak the 404 checks exist for.
  - It works today because `PAST_V` is single-quoted.
- **Wasted work in `allow48`.** It calls `who()` and throws the HMAC away. Each send parses `request.headers` about five times.
- **`clean_name` depends on its input's collation.** Given C-collated text, such as `convert_from(…, 'UTF8')`, `[[:alpha:]]` matches no non-ASCII letter, and every non-Latin name is refused. Production passes default-collated text, so it holds today. My first sweep reported 14,739 false mismatches because of it. Pin it with `n collate "default"` or document it.
- **The predecessor test is weak.** `run.sh` runs it only on a database with no `codeblack` schema. A migration 3 that checks for migration 1 but not migration 2 passes it; `db_live.js`'s skipped-migration check would catch that only at deploy.
- **Missing PGDG check.** `tests.yml`'s database job lacks the PGDG reachability check that `pages.yml` got.
- **Forget can overwrite an unrelated clipboard.** `keyForgetGo` writes `' '` to the clipboard whenever `U.keyCopied === c`, even if the instructor copied the code (`codeCopy`) after the key, because other copies don't clear `U.keyCopied`.
- **R1.7-12 leftover:** `is_public`'s `2001::/23`.

## 4. Coverage

**Read in full:**
- **The second migration**, against migration 1 line by line, including the diff from the round-6 draft.
- **The deploy and its checks:** `run.sh`, `stubs.sql`, the `privacy_test.sql` and `client_call.json` diffs, `test/db_live.js`, `pages.yml`, `db-watch.yml`, the `tests.yml` diff.
- **The game:**
  - The `ui.js` diff (`morph`, `morphSame`, `morphHeld`, `morphKids`, `classHTML`, `cbRegister`, `cbRegHTML`, `cbListHTML`, `cbDet`, `cbTable`, `cbSendHTML`, every class `ACT` entry, About and the report).
  - The `engine.js`, `style.css`, `build.js` and `package.json` diffs.
  - `test/rules13.js` and the `class_test.py` diff.
  - `tools/name_ranges.py`.
- **Docs:** CLAUDE.md, `supabase/README.md`, the README's v0.31.0 paragraph and test block, `docs/SMOKE.md`'s class section, round-7 STATUS, the BRIEF.

**Ran:**
- **The suites:**
  - `npm run db:test`: 207 ok, PG16, en_US.UTF-8.
  - `npm test`: 703 ok, exit 0.
  - `python3 tools/name_ranges.py --check`: ok on 3.13 and refused on 3.12.
  - `CHROME_PATH=/usr/bin/google-chrome python3 test/class_test.py`: 91 ok, "No errors."
  - A scratch rebuild, byte-identical to the committed build.
- **On my PG16 cluster:**
  - The final migration against the round-6 draft: `db_live`-visible answers, the takeover, function fingerprints.
  - The lock timeout, with a held row lock.
  - 90,000 held codes: timings of `cb_class_new` and `cb_health`.
  - A joiner sweep: 64,064 inputs (alef + X + ZWNJ/ZWJ + letter or mark, and X + joiner at the end, for X in U+0590 to U+0E7F). With default collation there are **40** mismatches, all game-yes and server-no, all on Unicode 16 additions (U+088F, U+0897, U+0C5C, U+0CDD). That is the documented class.
- **Playwright in Chrome**, with the server stubbed:
  - The typing redraw (P2).
  - The focus hand-off (P1).
  - "Use it without results" after a reopen (P3).
  - Two rows' Set up results at once (P4).
  - Turn results back on for an ended code (P5).
  - Off, then Try again answering `taken`, which strikes the code through and removes Copy and Share (P6).
  - The replace question for a struck-through code (P7).
  - The panel and row disagreeing (`probe3.py`).
- Checked that `playwright==1.65.2` exists on PyPI.

**Not checked, and why:**
- **The live project, real PostgREST or Cloudflare, real pg_cron's `schedule` upsert and `alter_job` permissions:** off limits, or not installed here.
- **PostgreSQL 17:** not installed here.
- **GitHub Actions** (the job graph was read, not run) and GitHub's notification routing: no access.
- **WebKit and iOS:** not installed.
- **`npm run stress`:** the engine change adds no random draws, and golden passed.

## 5. What I'd keep

- **Migration 2's guards:** predecessor, newer migration, a lock timeout that really fires (10 s, nothing changed), one transaction, and self-recording.
- **The tombstone's semantics:** results gone at the end, the code held with only its key hash, `taken` for any other key, a fresh empty class for its own key. It is clean SQL under the per-code advisory lock.
- **`run.sh`'s strict freeze:** the format line, `--strict`, the odd-file refusal, the ASCII-only check, the predecessor test and the re-run over data.
- **`db_live.js`:** its two-way check of `applied.sha256` against live, which accepts a rollback (it filters by the files present), and the alternating time-zone probe.
- **The deploy graph:** a red branch guard, the contract tests in their own job, `always()` with explicit result checks, and an emergency path that needs a reason and checks it twice.
- **`morphKids` matching the held branch by identity,** and the per-row registration sequence.
- **`build.js`** refusing a version the database would refuse.
- **`rules13.js`,** which drives the real game paths.
