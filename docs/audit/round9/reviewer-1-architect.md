# Reviewer 1, round 9: Senior Software Architect

Review of the round-8 fixes on branch `claude/sleepy-rubin-jot35n` at v0.31.0, HEAD `ba471b7`, Nov 25, 2026. The first migration is live and frozen. The second, `20261125120000_codeblack_round6.sql`, is not applied and changed again in round 8 (three times: `1d284f1`, `32dbdae`, `4905f3e`). I reviewed it as the file the owner will paste.

- **Scope:** `git diff 87c9c13..ba471b7 -- src supabase test tools .github build.js package.json CLAUDE.md README.md docs/SMOKE.md`, plus `docs/audit/round8/STATUS.md`, `supabase/README.md`, the BRIEF (rounds 8 and 9) and my round-8 report.
- **Changes to the repo:** none, except this file. `npm test`, `npm run db:test` and `npm run stress` ran in the repo and wrote nothing tracked.
- **Scratch:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round9/r1/`
  - `repo/` is a `git archive` of HEAD.
  - `pg/up.sh` and `pg/q.sh` ran two throwaway PostgreSQL 16.15 clusters, one en_US.UTF-8 and one C.UTF-8, in a `mktemp` folder.
  - `probe_a.py` and `probe_b.py` are Playwright probes in Chrome with every Supabase call stubbed or aborted.
  - `clean.js` and `md2.js` are Node probes against `src/engine.js`.
- Nothing contacted supabase.co or edcodeblack.com.

## 0. Round-8 status

| Finding | Status | Evidence |
|---|---|---|
| R1.8-01 Medium: the ledger identified a migration by name only | **Fixed** | `codeblack.fingerprint()` is in `cb_health` as `fp`. `run.sh` checks the fresh and migrated databases against `supabase/tests/fingerprint.txt`. `db_live.js` fails when live is at `LATEST` and `fp` differs. On my cluster, the round-8 draft `32dbdae` gives `0fb0d391…` against the committed `ba875605…`, and the round-6 draft has no `fp` key at all. Both fail the deploy. What it misses, and why a failure can't be diagnosed, is R1.9-02. |
| R1.8-02 Low: the focus hand-off jumped to another button | **Fixed** | `morph()` now records the focused button's index among buttons with the same `data-act` and `data-arg`. `probe_a.py` C: focus Refresh, press Enter with the read held, then let the answer arrive. Focus stays on Refresh in the results list the whole time; it never moves to the row's Results. |
| R1.8-03 Low: the panel and the row disagreed | **Partly fixed** | When the row's Set up results gets `ok`, it now moves `U.reg` to `ok`. Two orderings still split the state: R1.9-03. |
| R1.8-04 Low: held codes not re-costed | **Fixed** | The backstop counts live classes only (`expires_at > now()`, limit 100,001, an index-only scan of 15 ms at 138k live rows). `overdue` is two indexed counts. With 119,594 held rows, `cb_health(false)` takes 5 to 6 ms (it was 543 ms). The README's clean-up query now says `expires_at > now()`. |
| R1.8-05 Low: `name_ranges.py` told a 3.12 user to use 3.12 | **Partly fixed** | CI runs `--check` on Python 3.13 (`tests.yml`, database job), and the comment on line 58 is right. The message users actually see, on line 63, still says "Use Python 3.12 or 3.13". `python3.12 tools/name_ranges.py --check` prints exactly that. |
| R1.8-06 Low: the watch's alert path was unverified | **Fixed in code** | A failure opens an issue (`gh issue create`, `issues: write`), and the job runs on `ubuntu-24.04`. Nothing has run on GitHub yet, so this is unproven in practice. |
| R1.8-07 Low: docs drift | **Partly fixed** | **Fixed:** the cron warning, the deletion wording in CLAUDE.md and the README, the files table, step 1's claim, CLAUDE.md's test line and Layout line, and the `style.css` comment. **New or remaining drift:** R1.9-06. |
| R1.8-08 Nitpicks | **Partly fixed** | **Fixed:** the cron one-liner remedy, the `deploy.txt` marker, and the PGDG check in `tests.yml`. **Unchanged:** the vacuous `class_test.py:54`, dead code at `engine.js:1911`, rounding to a tenth, `allow48`'s discarded `who()`, `clean_name`'s collation, the weak predecessor test, Forget's clipboard, and `2001::/23`. |

**Counts:** Fixed 4 · Partly fixed 4 · Still open 0 · Worse 0.

## 1. Verdict

**The migration is now safe to paste, and the stale-draft hole is closed. But the new release gate can only say "different". It can't say what differs, and its remedy doesn't fix every case it can trip on.** The engine and UI fixes are sound, with two exceptions:
- An order set with a harmful drug is still scored "clean".
- The panel and the row can still disagree.

What checks out:
- **The stale draft (R1.8-01) is closed.**
  - Every draft of migration 2 since round 6 has a different fingerprint, or none.
  - The fingerprint is the same under en_US.UTF-8 and C.UTF-8 (`ba875605…` on both of my clusters). That is only by accident: `prosrc` is C-collated in the catalog, so the `order by` runs in C.
  - Every function signature has been the same across drafts since round 6, so re-pasting the newest migration over any of them fixes it.
- **The cb_class_new ordering is right:** validation before limits, then "taken" before "full". On my cluster with 138,446 live and 119,594 held classes:
  - a new code with a new key gets `full`;
  - a live code with another key gets `taken`;
  - an instructor's own retry gets `ok`;
  - `cb_health` reports `classes: 1.0`;
  - held rows don't count toward the backstop.
- **The engine changes keep everything else sound.** `tDied`, `deadHere` and `arrestOpen` add no random draws. `npm test` passes (709 ok) with `golden.json` unchanged. `npm run stress` passes 188 shifts with vitals in range. Saves stay JSON. `endShift` is guarded against running twice.

What fails:
- **R1.9-01 (Medium): "clean" plus "can hurt them".** A first order set with a contraindicated drug still gets the +10 clean-order bonus and counts under "Clean order sets". Round 8's order review now lists the same order set under "Can hurt them".
- **R1.9-02 (Medium): the fingerprint is a single opaque md5.**
  - It covers only function bodies, settings and the definer flag. Constraints, indexes, grants, strictness, argument names and defaults are all invisible to it.
  - Its remedy, "paste the newest migration again", can't fix drift in the four functions that only migration 1 makes. It can't remove an extra function either.
  - Migration 2 isn't frozen yet, so this is the last time `fingerprint()` can be improved without a migration 3.
- **R1.9-03 to R1.9-06 (Low):**
  - The panel and the row disagree in two orderings.
  - The round-8 server paths have no tests.
  - Two of the new `rules13.js` checks are vacuous.
  - The row for an ended class shows a wrong date, and docs and STATUS overclaim.

**No Critical or High.** Fix R1.9-02 before the paste, because once the migration is applied it costs another migration. R1.9-01 is a one-line engine fix plus a golden update.

## 2. Score

**7 / 10** (round 8: 7).
- **Up:** the round-8 Medium is closed, and closed properly: drafts are told apart by content, and I verified that against two real drafts. The backstop and `overdue` are now cheap and correct, and I verified that at 258k rows.
- **Down:**
  - The release gate's failure mode is undiagnosable.
  - The client still keeps two copies of one code's state, so each round finds a new ordering that splits them.
  - Round 8 added server behaviour (the backstop, taken before full, `health48`) with no test.
  - Round 8 added engine tests that pass whatever the engine does.

## 3. New findings (worst first)

### R1.9-01 · Medium · An order set with a contraindicated drug is scored "clean" (+10, and counted under "Clean order sets"), while the order review now lists it as "Can hurt them"
- **Where:**
  - `src/engine.js:1923`: `if (!miss && !extra) { pts += 10; S.clean++; }`. Contraindicated drugs (`contraX`) never add to `extra`; only `drugX` and unneeded tests and treatments do (`:1886`, `:1899`, `:1910`).
  - `src/ui.js:3108` shows `t('Clean order sets', m.clean)`.
  - Round 8 added the unsafe list to the order review (`engine.js:1887`, `:1924-1928`; `ui.js` `ordLogHTML`: "Can hurt them: …").
- **Reproduce:** `node scratchpad/round9/r1/clean.js /home/user/Overcrowded-ED-Game`. It orders the textbook set plus ibuprofen for the first signing:

  ```
  cwp    ok true | contra +1 | clean +1 | ordLog unsafe: ["Ibuprofen (a heart attack isn't ruled out until the troponin is back)"] | extra: [] | miss: []
  stemi  ok true | contra +1 | clean +1 | ordLog unsafe: ["Ibuprofen (NSAIDs are harmful when chest pain could be the heart)"] | extra: [] | miss: []
  nstemi ok true | contra +1 | clean +1 | …
  ```
- **What the student reads.** The summary's "Your patients" table says "Clean order sets 1". "Orders to review" names the same patient: "Can hurt them: Ibuprofen (…)". The Orders line of the ledger also gets +10.
- **History.** The scoring bug is older than round 8. Round 8's fix for R6.8-04 put both claims on one screen.
- **Fix:** `if (!miss && !extra && !contraX.length)` at `:1923`, then `npm run golden:update`, with a `rules13.js` check that a contraindicated drug never counts as clean.
- **Effort:** S.

### R1.9-02 · Medium · The fingerprint is one opaque md5 over function bodies only: it can't name what differs, misses everything but functions, and its remedy can't fix drift in migration 1's functions
- **Where:**
  - `round6.sql:345-355` (`codeblack.fingerprint()`) and `:375` (`'fp'`).
  - `test/db_live.js:56`, whose remedy reads "Re-apply the repo's newest migration from the green commit".
  - `supabase/README.md` "Releasing", step 4, the fingerprint bullet.
  - STATUS: "so a stale or edited paste can't pass".
- **What it hashes:** `regprocedure`, `prosrc` without whitespace, `proconfig` and `prosecdef`.
- **What it misses:**
  - return type, language, volatility, `STRICT`;
  - argument names (PostgREST calls by name) and defaults;
  - the owner and ACLs (`proacl`);
  - every table, column, check constraint and index;
  - the cron job's command and schedule;
  - whitespace inside string literals (the name regex has meaningful spaces).
- **Reproduce** (my C.UTF-8 cluster: stubs, migration 1, HEAD's migration 2; fingerprint `ba875605…`):
  1. Run these by hand:

     ```sql
     alter table codeblack.results drop constraint results_stats_check;
     alter table codeblack.results add constraint results_stats_check check (jsonb_typeof(stats) = 'object' and pg_column_size(stats) < 100000);
     drop index codeblack.classes_expires_idx;   -- the live-only backstop count and overdue now scan the table
     grant execute on function codeblack.tidy() to anon;
     alter function public.cb_submit(text,uuid,text,text,text,int,int,int,jsonb,text) strict;
     ```

     The fingerprint is still `ba875605…`, so the deploy passes.
  2. Replace `codeblack.norm_code` (made only by migration 1; migration 2 never redefines it, nor `norm_key`, `key_hash` or `keyed_class`) with another body. The fingerprint is now `cb17cf79…`. Paste migration 2 again, which is the documented remedy. It is still `cb17cf79…`, so the deploy is blocked for good.
     - Nobody can see *which* function differs. `cb_health` returns one md5, `fingerprint.txt` is one md5, and the README gives no per-function query.
     - Migration 1's live content has never been checked by content. It was verified by behaviour in round 6, which is the gap R1.8-01 described. So the first v0.31.0 deploy is the first content check of those four functions too.
- **Why now:** migration 2 is unapplied. After the paste, any change to `fingerprint()` needs a migration 3 and another round.
- **Fix:**
  1. Make `fingerprint.txt` a manifest, one `signature md5` line per function, plus a line for the constraints (`pg_get_constraintdef`) and one for the indexes (`pg_get_indexdef`) over the `codeblack` tables. Have `cb_health` return the per-function md5s (they aren't secret: the repo has the bodies), and have `db_live.js` print which lines differ.
  2. Add `prorettype`, `proargnames`, `proargdefaults`, `proisstrict`, `provolatile` and `proacl` to each line.
  3. Use `order by x collate "C"`, so the order doesn't depend on `prosrc`'s catalog collation.
  4. README step 3: compare `fp` with `fingerprint.txt` right after the paste, before committing `applied.sha256`. Say that drift in a migration-1 function needs that function re-created from migration 1, not migration 2 re-pasted.
- **Effort:** S to M.

### R1.9-03 · Low · The panel and the row still split: a late answer to the panel's Try again overwrites the row's `ok`, and the panel's `ok` leaves the row's old refusal on screen
- **Where:**
  - `ui.js` `codeRegSaved` (`:2661-2675`): it sets `U.reg` to `ok` but doesn't bump `U.regSeq`, so an answer to the panel's own request still in flight is applied afterwards.
  - `cbRegister`'s `ok` branch (`:2131`): it never clears `U.regRows[code]`, so the row's last refusal stays.
- **Reproduce B (stub server):**
  1. Abort `cb_class_new`, tap Five-Minute Rush, then Use it without results.
  2. Hold `cb_class_new`, then tap the panel's Try again. The panel says "Setting up class results…" and the row still offers Set up results.
  3. Answer `ok` to the row's Set up results. The panel reads "Class results are on", and `U.reg.st` is `ok`.
  4. Abort the held request. The panel now reads "Class results are off for this code. Couldn't reach the server… Tell them not to tap Send", and `U.reg.st` is `off`.
  5. The row says "results until Dec 8 · Results", and the record is `{k, t, e, s:1}` (confirmed).
- **Reproduce A:**
  1. From the off state, answer the row's Set up results with `busy`. The row shows the busy message.
  2. Answer the panel's Try again with `ok`. The panel says on. The row says "results until Dec 8 (Dec 24 once a student sends)" and still shows "Your network has made too many requests…" in red. `U.regRows[code]` is `{"st":"fail",…}`.
- **Effect.** The projected panel can tell a class not to send while results are on, which loses results; and the row shows an error for a code that's working. This is the same class of bug as R1.6-08, R1.7-07 and R1.8-03: one code with two state stores.
- **Fix:**
  - In `codeRegSaved`'s `ok` branch, bump `U.regSeq` when `U.reg.code === c`.
  - In `cbRegister`'s `ok` branch, `delete (U.regRows || {})[code]`.
  - Better: derive the panel's state from the stored record, and keep only the in-flight flag in `U`.
- **Effort:** S.

### R1.9-04 · Low · Round 8's server changes have no tests: the live-only backstop, held codes not counting, "taken" before "full", the own retry when full, and `health48`
- **Where:**
  - `round6.sql:240-245` and `:371`.
  - `supabase/tests/privacy_test.sql`. Its only "full" check is the per-class 500 (`:196`). The new block (`:309-314`) tests invalid-before-limits and plain `taken`, with the backstop empty. Nothing inserts past 100,000 live classes, and nothing calls `cb_health` 1,001 times from one /48.
- **Evidence it works today:** my hand test above, with 138,446 live and 119,594 held classes: `full`, `taken`, `ok`, `1.0`.
- **Why it matters:** this ordering is what makes "Use it without results" for `full` safe (R3.8-01). A future migration that moves the `taken` check below the backstop, or counts held rows again, passes `db:test` as it stands.
- **Fix:** in `privacy_test.sql`, insert 100,001 live classes and some held ones (about 1 s). Check:
  - `full` for a new code;
  - `taken` for a live code and a held code under another key;
  - `ok` for the own key's retry and for turning back on;
  - `cb_health` gives `classes = 1.0`;
  - one `health48` refusal (call 1,001 from a /48).

  Then delete the rows.
- **Effort:** S.

### R1.9-05 · Low · Two of the new `rules13.js` checks pass whatever the engine does
- **"Another doctor's patient (md2) who arrests isn't counted as the attending's" (`rules13.js:68-71`).** At seed 7600 that patient gets ROSC. The test prints "outcome none". So `md.died === 0` is checked on a patient who never died.
  - `node scratchpad/round9/r1/md2.js /home/user/Overcrowded-ED-Game 1`: `arrest false dsp none … dx ROSC after cardiac arrest`.
  - Over 40 seeds, 23 of those patients die, and `md.died` is 0 for all of them. So the behaviour is right, but this check doesn't show it.
- **"Harm minus contraindicated drugs counts only complications of unneeded treatments" (`:80-82`).** It asserts `comp >= 0 && comp <= 20` over 20 shifts, each with one unneeded treatment. That is every possible outcome. It also carries dead code (`h0 += OC.G.mm ? 0 : 0`).
- **STATUS** says "`rules13.js` covers … a real other doctor's patient".
- **Fix:**
  - Loop seeds until the md2 patient is dead, then assert own 0 and department ≥ 1.
  - Assert per shift that `harm - contra` is 0 or 1, and over the 20 shifts `0 < comp < 20`.
  - Delete `h0`.
- **Effort:** S.

### R1.9-06 · Low · An ended class's row shows a wrong deletion date and the wrong button; docs and STATUS that don't match the code
- **The ended row (`ui.js:2194`)** reads "class ended: results deleted {K.e}". `K.e` is the end date the device last heard. It is still the 14-day date if a student sent after the instructor's last read; the server then deleted on day 30.
  - The row's button is **Results**, not Turn results back on. That appears only after a read comes back `key` and sets `x`.
  - `probe_b.py`, with a record made 35 days ago whose last known end is day 14: "class ended: results deleted Nov 4 | Results". Day 30 was Nov 20.
  - STATUS says "a class past its end says 'class ended' with Turn results back on (R5.8-04)".
  - **Fix:** when `K.e - K.t < 20 days`, say "ended (results deleted by {K.t + 30 days})". Offer Turn results back on in the row once it reads ended.
- **`tools/name_ranges.py:63`** still says "Use Python 3.12 or 3.13" (R1.8-05).
- **STATUS: "'Use it without results' is offered when the server can't be reached".** `cbFetch` sets `kind: 'http'` for every non-2xx status and `'bad'` for an unreadable body, and `cbRegister`'s catch marks all of them `net: true` (`ui.js:2141`). So a 4xx, 5xx or 429 also offers it. CLAUDE.md repeats the claim.
- **STATUS and the migration header: "invalid calls are refused before they count against a network's limits".** That is true only in `cb_class_new`. In `cb_submit`, the four limits (`:272-275`) run before its validation (`:276-282`).
- **`supabase/README.md`:**
  - It still says `db-watch.yml` "fails the run (GitHub emails the owner)". It now opens an issue.
  - Step 3 doesn't say to compare `fp` (R1.9-02).
  - The files table says "review rounds 6 and 7" for the migration that round 8 changed.
- **CLAUDE.md:**
  - The `cb_health` bullet doesn't mention the fingerprint.
  - "Changing the database" doesn't mention `supabase/tests/fingerprint.txt`, the file each migration change must update.
- **`ui.js:2053-2054`'s comment block** still says "A code and its results are deleted 30 days after the code was made (14 if nobody sends a result)", with no hold.
- **README's v0.31.0 paragraph** cites "five rounds of review" and `round4` to `round6` STATUS. There are eight rounds now.
- **Effort:** S.

### R1.9-07 · Nitpick
- **The fingerprint's order.** It is the same under C and en_US only because `prosrc` is C-collated in `pg_proc`, which makes the concatenation C. Write `collate "C"`.
- **The fingerprint vouches for itself.** It is computed by a function that is part of what it checks. A stale draft can't fake it, but a hand edit that includes `fingerprint()` can. Say so in the README.
- **The daily watch opens a new issue on every failing day,** with no check for an open one.
- **`deploy.txt` publishes the private repo's commit SHA and run id** on the public site.
- **`overdue`'s second count relies on an invariant set elsewhere:** that a class with results has `expires_at = created_at + 30 days`, which `cb_submit` sets. A future change to that rule silently hides overdue results.
- **The department's "Died" can now count patients who are not in its "Arrivals"** (arrived before 07:00, died on shift). The CSV puts the two side by side.
- **R1.8-08 leftovers, unchanged:**
  - `class_test.py:54` can't fail;
  - the dead `cardiovert` clause at `engine.js:1911`;
  - rounding to a tenth (0.45 shows as 0.5 and fails the watch);
  - `allow48` discards `who()`;
  - `clean_name` depends on its input's collation;
  - the predecessor test is `grep -q 'first'`;
  - Forget overwrites a clipboard copied after the key;
  - `is_public` still has `2001::/23`.

## 4. Coverage

**Read in full:**
- **Migrations:** the round-8 diff of migration 2, and the whole current file against migration 1.
- **Release checks:** `run.sh`, `test/db_live.js`, the `privacy_test.sql` and `client_call.json` diffs, `supabase/tests/fingerprint.txt` and its history (`1d284f1`, `32dbdae`, `4905f3e`).
- **Workflows:** the `pages.yml`, `tests.yml` and `db-watch.yml` diffs.
- **Game:**
  - The `engine.js` diff, with `signOrders`, `codeOutcome`, `arrestNoTeam`, `toArrest`, `leave` and `endShift` in context.
  - The `ui.js` diff, with `morph`, `classHTML`, `cbRegister`, `cbRegHTML`, `cbKeys`, `cbListHTML`, `codeNoRes`, `codeRegSaved`, `cbShow`, `cbArgs`, `verdictOf`, `ordLogHTML` and `mdReportHTML`.
  - The `build.js` and `name_ranges.py` diffs, and `test/rules13.js`.
- **Docs:** CLAUDE.md, `supabase/README.md`, the README's v0.31.0 paragraph and test block, round-8 STATUS, and the BRIEF.

**Ran:**
- **The suites:**
  - `npm run db:test`: all passed, 210 ok lines, PostgreSQL 16.15, en_US.UTF-8.
  - `npm test`: 709 ok, exit 0.
  - `npm run stress`: exit 0; vitals stayed in range in every run.
  - `name_ranges.py --check`: ok on 3.13, and the wrong message on 3.12.
  - `CHROME_PATH=/usr/bin/google-chrome python3 test/class_test.py`: 95 ok, "No errors." Line 7, "the failure reads as an error", is still the vacuous check.
- **On my PostgreSQL 16 clusters:**
  - The fingerprint under en_US.UTF-8 and C.UTF-8 (identical), with the collation traced to `prosrc`.
  - The `32dbdae` and `18a71f9` drafts against HEAD.
  - Hand edits the fingerprint misses.
  - Migration-1 drift that the documented remedy leaves in place.
  - 119,594 held and 138,446 live classes: `full`, `taken`, own retry, `cb_health` timing, the backstop scan plan.
  - Bytes per class row (165, with indexes).
- **Node:** `clean.js` (the clean bonus with a contraindicated drug) and `md2.js` (the md2 check's seed, and 40 seeds).
- **Playwright in Chrome, server stubbed:**
  - `probe_a.py`: A, the row's stale refusal; B, the panel's late answer; C, the focus hand-off.
  - `probe_b.py`: rows for ended classes.

**Not checked, and why:**
- **PostgreSQL 17:** not installed here. The fingerprint's equality between PostgreSQL 16 and 17 is unverified until CI runs. I found nothing in its inputs that differs between 16 and 17.
- **The live project, PostgREST, Cloudflare and real pg_cron:** off limits.
- **GitHub Actions** (the issue step, the `deploy.txt` check): no access.
- **WebKit and iOS:** not installed.

## 5. What I'd keep

- **Fingerprinting by content, through the database's own catalog,** compared by `run.sh` and by the deploy against one committed file, and skipped when live is ahead (a rollback still deploys). Its whitespace stripping makes it survive line-ending changes.
- **The order in `cb_class_new`:** validation, then the limits, then "taken", then a backstop that counts only live classes and exempts the instructor's own code.
- **Per-/48 limits applied consistently, now including `cb_health`.**
- **`tDied` as a fact on the patient,** not inferred from arrival time. Pre-07:00 deaths go to the night shift by one comparison.
- **The `unsafe` list carried as strings in `ordLog`:** JSON-safe, and older saves read `|| []`.
- **The position-aware focus hand-off,** and the `deploy.txt` marker naming the exact deployment.
