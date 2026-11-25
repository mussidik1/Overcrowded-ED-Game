# Reviewer 1, round 10: Senior Software Architect

This reviews the round-9 fixes on branch `claude/sleepy-rubin-jot35n` at v0.31.0, HEAD `1ab6fa9`, on Nov 25, 2026.

The first migration is live and frozen. The second, `20261125120000_codeblack_round6.sql`, is not applied yet. It changed again in round 9, in commit `9609482`. I reviewed it as the file the owner will paste.

- **Scope:** `git diff 0541eeb..1ab6fa9 -- src supabase test tools .github build.js package.json CLAUDE.md README.md docs/SMOKE.md`. I also read `docs/audit/round9/STATUS.md`, `supabase/README.md`, the BRIEF (rounds 9 and 10) and my round-9 report.
- **Changes to the repo:** none, apart from this file. `npm test`, `npm run db:test` and `class_test.py` ran in the repo and wrote nothing that git tracks.
- **Scratch folder:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round10/r1/`
  - `repo/`: a `git archive` of HEAD.
  - `pg/up.sh` and `pg/q.sh`: a throwaway PostgreSQL 16.15 cluster in en_US.UTF-8. It ran from a `mktemp` folder, because the postgres user can't read the scratchpad. Database `m` holds the stubs plus both migrations, and each probe ran on a copy of it.
  - `held_cap.sql`, `race_setup.sql`, `race_a.sql`, `race_b.sql`: the held-code cap probes.
  - `arrival_arrest.js`: the end-of-shift arrest rule.
  - `probe_ui.py`: the UI states in Chrome, with every Supabase call stubbed.
- **Network:** nothing contacted supabase.co or edcodeblack.com.

## 0. Round-9 status

| Finding | Status | Evidence |
|---|---|---|
| R1.9-01 Medium: a contraindicated drug still scored a "clean" order set | **Fixed** | `engine.js:1923` now reads `!miss && !extra && !contraX.length`. Round 9's `clean.js` now prints `contra +1 \| clean +0` for cwp, stemi and nstemi. A `rules13.js` check compares the textbook set with the same set plus ibuprofen. |
| R1.9-02 Medium: the fingerprint was one opaque md5 over function bodies only | **Partly fixed** | **Fixed:** there is now one md5 per object (functions, tables, the cron job), with return type, arguments, defaults, strictness, volatility and grants. Every list sorts in the C collation. `run.sh` builds the fresh project in the C locale and names the objects that differ, and README step 3 compares `fp` after the paste. **Remaining:** the live side is still a single md5, and the owner has to compare 27 hashes by eye. The README's remedy is wrong for the four functions only migration 1 makes (R1.10-05). The owner, triggers, column grants and policies are still invisible, and a changed string literal passes (R1.10-04). The new table parts depend on the PostgreSQL major version (R1.10-03). |
| R1.9-03 Low: the panel and the row split | **Fixed** | `probe_ui.py` A (the row refuses, then the panel succeeds): the panel says on, and `U.regRows[code]` is `null`. B (the row succeeds while the panel's request is out, then that request fails): `U.reg.st` stays `ok`, and the row says "results until …". |
| R1.9-04 Low: round 8's server branches had no tests | **Fixed** | `privacy_test.sql` fills 100,001 live classes plus held ones. It checks `full`, `taken` (live and held), the instructor's own retry, turning a class back on, `cb_health` and `health48`. The new cap has no test (R1.10-06). |
| R1.9-05 Low: two vacuous `rules13.js` checks | **Fixed** | The md2 check now finds a real death (`{"sd":7601,"own":0,"dept":1}`). The complications check takes 0 or 1 per shift and 11 of 20 overall. The dead `h0` is gone. |
| R1.9-06 Low: ended rows, docs and STATUS | **Partly fixed** | **Fixed:** `probe_ui.py` C shows every saved-row state correctly. An unused class past its end: "ended Nov 4 with no results, unless … Results checks", with a Results button. A used class: "class ended: results deleted Nov 20", with Turn results back on. The HTTP fallback, `cb_submit`'s validation order, the db-watch text, CLAUDE.md's `cb_health` bullet and the `ui.js` comment block now match the code. **Remaining:** `tools/name_ranges.py:63` still says "Use Python 3.12 or 3.13" (`python3.12 tools/name_ranges.py --check` prints exactly that). The README says "eight rounds of review" (there are now nine). STATUS lists R1.9-06 as "docs corrected". |
| R1.9-07 Nitpicks | **Partly fixed** | **Fixed:** `collate "C"`; the README now says the fingerprint vouches for itself; the daily watch keeps one issue open. **Unchanged:** `deploy.txt` publishes the commit SHA; `overdue`'s invariant; Died vs Arrivals (left by design); every R1.8-08 leftover. |

**Counts:** Fixed 4, partly fixed 3, still open 0, worse 0.

## 1. Verdict

**Every round-9 fix I checked works as claimed. But three of the fixes brought new defects that a professional would catch before the paste:**
- **The held-code cap (R1.10-01)** releases real instructors' codes first. A taker's single call both releases a code and takes it, so the cap undoes the hold that exists to stop takeovers.
- **The end-of-shift arrest age rule (R1.10-02)** exempts every patient who arrived in cardiac arrest.
- **The fingerprint's table parts (R1.10-03)** change under PostgreSQL 18 with nothing edited. That would block the deploy after a routine Supabase upgrade.

R1.10-01 and R1.10-03 sit in the unapplied migration, so they cost nothing to fix today and a migration 3 after the paste.

**What checks out:**
- **The suites pass.** `npm test`: 717 ok, exit 0. `npm run db:test`: 225 ok, "ALL DATABASE CHECKS PASSED", with the fingerprint `dcd21130…` as committed. `class_test.py`: 107 ok, "No errors."
- **The revival is mostly right.** It runs under the per-code advisory lock, checks the version, can't revive a class that had results, and tidy can't race it (tidy's DELETE re-checks `expires_at` on the new row). An instructor's "Turn results back on" over a class a student has revived doesn't wipe it.
- **`cb_submit` validates before it counts.** A junk call costs about 0.05 ms (2,000 junk sends took 98 ms), cheaper than the counting it skips.
- **The engine changes add no random draws, and saves stay JSON.** `golden.json` didn't change, and `p.codeLost` is a plain object. Lost codes are always a subset of own deaths, because `leave()` and `deadHere` both require `p.mine`.
- **The UI state is consistent.** `U.regRows` vs `U.reg`/`regSeq` (probe A and B), the `g` flag surviving a reopen (D), and a 503 offering no fallback (E) all behave as STATUS says.

**No Critical or High.**

## 2. Score

**6 / 10** (round 9: 7).
- **Up:** every round-9 finding of mine is fixed or mostly fixed, and the fingerprint is now a real per-object manifest.
- **Down:** three new Mediums, and two of them are regressions caused by this round's fixes:
  - a security control undone by its own cap;
  - a scoring hole reopened by the age rule.

  The third is a release gate that depends on the server's major version. And the new server rule (the cap) shipped with a test that only checks a key exists.

## 3. New findings (worst first)

### R1.10-01 · Medium · The held-code cap releases the oldest held codes first (real classes, never the flood), and the taker's own `cb_class_new` releases a code and takes it in one call; a student's send that revives a class can also be wiped by a concurrent release
- **Where:** `20261125120000_codeblack_round6.sql:239-241`:

  ```sql
  if (select count(*) from (select 1 from codeblack.classes x where x.expires_at <= now() limit 30001) y) > 30000 then
    delete from codeblack.classes c where c.code in (select x.code from codeblack.classes x where x.expires_at <= now() order by x.expires_at limit 1000);
  end if;
  ```

  This runs before the `taken` check (`:243`), takes no per-code lock, and doesn't re-check `expires_at` on the row it deletes.
- **Why it matters:** the hold exists so that "nobody else, such as a student who knows it, can take it over" (supabase/README "How long", audit R1.7-08). Planned codes are posted weeks ahead, and those are the codes that sit in the hold.
- **Reproduce A, takeover** (`held_cap.sql`, on a copy of database `m`). A real planned code `REA-R00` was made 20 days ago and ended unused 6 days ago, so it is held and revivable. Flood codes were made 15 days ago and are held too, all newer than `REA-R00`:

  ```
  1. held|30000
  1. another key on the real code, at the cap|{"error": "taken"}
  2. held|30002|cb_health held|1.0
  2. the same call, one code over the cap|{"ok": true, ...}          <- the taker's call released REA-R00 and registered it
  3. a student sends to the posted code|{"ok": true}
  4. the taker reads|Ana                                            <- the student's name goes to the taker
  5. the real instructor reads|{"error": "key"}
  6. the real instructor turns it back on|{"error": "taken"}
  7. flood codes released|999|held now|29002
  ```
- **Reproduce B, race** (`race_setup.sql`, then `race_a.sql` in the background and `race_b.sql`):
  1. Session A: `cb_submit` revives `REA-R00` and holds its transaction for 4 s.
  2. Session B: anyone's new code runs the release, which waits on A's row lock.
  3. After A commits, B deletes the revived class anyway. The subquery's snapshot isn't re-checked.

  Result: A answered `{"ok": true}`, but afterwards "class REA-R00: (none) | results 0". The result is gone (cascade), and the code is free for anyone.
- **The monitor gives no warning in time.** 30,001 live flood classes read `classes 0.3`, under the 0.5 warning. They become held all at once 14 days later, and the next call releases codes at once.
- **What it costs an attacker:** about 31 IPv6 /48s for one day, or 150 IPv4 networks (1,000 or 200 codes a day each), then a 14-day wait. Before round 9, held codes cost about 8 MB at 30,000 and couldn't be released early at all.
- **Fix** (any one closes the takeover):
  - **(a)** At the cap, answer `full` to new codes, as the live backstop does. Existing codes keep `taken` and `ok`, and nothing is released early.
  - **(b)** If release must stay, release the newest held codes (the flood), not the oldest. Add `and c.expires_at <= now()` to the outer DELETE, so the row is re-checked after its lock. Run it after the `taken` check, never on the code being registered.

  Then add a `privacy_test.sql` block: a held planned code survives 30,001 newer held codes, and another key gets `taken`. Fix the README's "at most 30,000" and "a flood … can't block new ones".
- **Effort:** S.

### R1.10-02 · Medium · An own patient who arrived in cardiac arrest and is left unrun at the end of the shift is never "late": no penalty, no legal risk, no M&M line, and `arrestLeft` and `mdArrestOpen` both 0
- **Where:** `engine.js:4409`: `const age = Math.max(0, Math.round(G.t - (p.tArrest != null ? p.tArrest : G.t)));`. Arrivals in arrest (`CASES` 'arrest', `:702`) have no `tArrest`: by design, their 20 minutes count from the door (`arrestNoTeam`, `:2307`, and the save fix at `:4882`). So `age` is always 0 for them, and `p.late` is always false.
- **Reproduce:** `node scratchpad/round10/r1/arrival_arrest.js /home/user/Overcrowded-ED-Game`. Each patient is the attending's own, roomed, and unrun for the last 15 minutes:

  ```
  arrival  ck=arrest arrest=true tArrive=705 tArrest=undefined unrun for 15 min | arrestOpen 1 arrestLeft 0 late=false | legal 0 -> 0 | M&M line: false
  inED     ck=cwp arrest=true tArrive=680 tArrest=705 unrun for 15 min | arrestOpen 1 arrestLeft 1 late=true | legal 0 -> 15 | M&M line: true
  ```

  The result is the same on seeds 8100 to 8102.
- **Effect:** R5.8-03's rule ("an arrest nobody runs is never cheaper than running it") is broken for EMS arrests, the most common arrest arrival (weight 1.3). One that arrives after about 18:40 can be ignored for free, while running it risks a lost code.
  - The verdict says nothing.
  - The instructor's list gets `mdArrestOpen 0`, since `ui.js:3179` sends `arrestLeft`.
  - The student's own table still shows "still in cardiac arrest at the end: 1" (`arrestOpen`), so the two screens disagree.
- **Why the tests miss it:** every `rules13.js` arrest check uses `toArrest` on an in-ED patient. The verdict tests in `class_test.py` pass in a hand-made `arrestLeft`.
- **Fix:** measure from the same clock as `arrestNoTeam`: `p.code && p.code.tLeft != null ? p.code.tLeft : p.tArrest != null ? p.tArrest : p.tArrive`, in one shared helper. Add a `rules13.js` check with an arrival in arrest, and run `npm run golden:update` if a fingerprint moves.
- **Effort:** S.

### R1.10-03 · Medium · The fingerprint's table parts hash every `pg_constraint` row, and PostgreSQL 18 stores NOT NULL there: every table part changes on PG 18 with nothing edited, and the deploy blocks with a remedy that can't fix it
- **Where:** `round6.sql`, `fingerprint_parts()`, the table branch: `select … pg_get_constraintdef(o.oid) … from pg_catalog.pg_constraint o where o.conrelid = c.oid`. There is no `contype` filter. NOT NULL is already covered by `attnotnull` in the column list.
- **Mechanism:** PostgreSQL 18 records column NOT NULL specifications in `pg_constraint` (`contype = 'n'`, deparsed as `NOT NULL <column>`). That is in the PG 18 release notes, and `pg_upgrade` creates these rows too. On PG 16 today, `codeblack` has no `n` rows; I listed all 21 constraints. On PG 18, each of the five tables gains several, so all five `t …` parts and the total `fp` change.
- **Consequences:**
  - When the owner takes Supabase's major upgrade, `db_live.js` fails: "the live functions differ … an older draft was applied, or something was changed by hand". That stops every deploy, and the daily watch opens an issue every day. The runbook's remedies (re-paste, undo a hand change) can't fix it.
  - Locally, `run.sh` picks the newest installed PostgreSQL. On a machine with PG 18 it fails and prints a "replacement" `fingerprint.json`. Committing that breaks CI (pinned to 17) and the live comparison.
  - CLAUDE.md and the README still say `db:test` needs "PostgreSQL 15 or newer".
  - The committed file came from PG 16. STATUS concedes that the first PG 17 run is on GitHub. If 16 and 17 deparse anything differently, the file can match only one of them, and local and CI can't both be green.
- **Not run here:** I downloaded PostgreSQL 17.12 and 18.7 server binaries to check, but the permission system refused to run them. This finding rests on the code (no `contype` filter) and PG 18's documented catalog change.
- **To reproduce elsewhere:** `PG_BIN=/usr/lib/postgresql/18/bin npm run db:test`. Expect "FAIL: what the migrations make has changed", listing `t classes`, `t migrations`, `t rate`, `t results` and `t salt`.
- **Fix:**
  - Add `and o.contype <> 'n'` to the constraint list.
  - Have `run.sh` say which PostgreSQL major the committed file is for, and refuse, with that message, to compare on another major.
  - Have the runbook say that a Supabase major upgrade needs a new `fingerprint.json` from a fresh project on the new version, plus a new migration if `fingerprint()` itself must change.
- **Why now:** migration 2 is unapplied. After the paste, this needs migration 3.
- **Effort:** S.

### R1.10-04 · Low · The fingerprint's blind spots contradict its claims: a changed string literal passes, and the owner, column grants, triggers, policies and schema grants are not hashed
- **The claims:**
  - STATUS: "a function body's whitespace runs count as one space, so a changed string can't pass but a re-indented paste can".
  - The code comment: "a stale or edited draft, or a hand edit to anything here, can't pass".
- **Reproduce 1, a changed string.** Re-create `codeblack.clean_name` with `'( [[:alpha:]]'` changed to `'(  [[:alpha:]]'` (one space becomes two inside the name regex). The fingerprint stays `dcd21130…`, but `clean_name('Ana Maria')` is now refused. Every two-word student name gets `invalid name`.
- **Reproduce 2, other edits.** Each of these, on a copy of `m`, leaves the fingerprint at `dcd21130…`:

  ```sql
  alter function public.cb_submit(text,uuid,text,text,text,int,int,int,jsonb,text) owner to sneaky;   -- security definer: runs as its owner
  grant select (name, score) on codeblack.results to anon;                                            -- column grants live in attacl, not relacl
  grant usage on schema codeblack to anon;
  create trigger t_copy after insert on codeblack.results for each row execute function codeblack_copy();
  create policy p on codeblack.results for select to anon using (true);
  create role peek; grant peek to anon; grant select on codeblack.results to peek;                     -- only grants named to anon/authenticated/PUBLIC count
  alter table codeblack.results set unlogged;
  alter function codeblack.clean_name(text) cost 1000 parallel unsafe leakproof;
  ```
- **Fix:**
  - Hash `prosrc` with only `\r` removed, or with leading and trailing whitespace per line trimmed, not with every run collapsed.
  - Add `proowner::regrole`, `pg_trigger` (non-internal), `pg_policy`, `relpersistence`, `attacl` and `nspacl` for `codeblack`.
  - Reword the claims to "catches a stale draft and the listed attributes".
- **Effort:** S.

### R1.10-05 · Low · The runbook's remedy for a function mismatch is false for four functions, and the live side still can't say what differs
- **The false remedy:** `supabase/README.md`, Releasing, step 4: "A function: paste the newest migration again from the green commit (it re-creates every function)". Migration 2 never creates `norm_code`, `norm_key`, `key_hash` or `keyed_class`. `grep -c "create or replace function …"` gives m1=1, m2=0 for each. Re-pasting migration 2 leaves drift in those four in place. Migration 1 itself refuses to run over migration 2, so the owner must paste one function's `create or replace` out of migration 1. The runbook doesn't say that. `db_live.js`'s message ("the migration that makes it … for most") is right; the README is not.
- **What remains unchanged since R1.9-02:**
  - `cb_health` returns only the total. The owner, on a phone, must run `fingerprint_parts()` in the SQL editor and compare 27 md5s against `fingerprint.json` by eye.
  - `run.sh`'s fresh-vs-migrated mismatch ("a fresh project and the migrated baseline differ") prints no parts.
- **Fix:**
  - README: name the four migration-1 functions and say to paste each one's statement from migration 1.
  - Ship a one-line SQL that diffs: paste `fingerprint.json`'s parts as a literal, and it returns the differing keys.
  - Print the parts on the fresh-vs-migrated mismatch too.
- **Effort:** S.

### R1.10-06 · Low · The new server rules' tests don't test them: the revival's "had results stays ended" check passes on a mutant that revives such classes, and the 30,000 cap has no test at all
- **The revival check:** `privacy_test.sql`, "a class that got results and ended stays ended (no revival)". Its setup puts the class at `created_at = now() - 60 days`, `expires_at = now() - 30 days`, which is outside the 30-day hold. It would be refused even if it had never had results.
  - **Mutant:** I removed `and c.expires_at < c.created_at + interval '30 days'` from `cb_submit`, then ran `revive_mut.sql`.
  - The repo's setup still gets `{"error": "unknown"}`, so the test passes.
  - A class that had results and ended 10 days ago gets `{"ok": true}` on the mutant, so it is revived: late results land in a class whose results the privacy text says were deleted.
  - The real function refuses both.
- **The cap:** the block titled "R3.9-01: at most 30,000 held codes, the oldest let go first, and the health check reports how many" asserts only `cb_health(false) ? 'held'`. Nothing exercises the release, its order or its race (R1.10-01).
- **Also untested:** a revival with a version mismatch, a revival refused by `full` (R1.10-07), and the arrival-in-arrest age (R1.10-02).
- **Fix:** move the revival test's class inside the hold (ended 10 days ago, life of 30 days). Add the cap block from R1.10-01's fix, and a `rules13.js` arrival case.
- **Effort:** S.

### R1.10-07 · Low · The revival has side effects nobody designed: a refused send restarts the class, the "made" date moves, and the device can forget a key while its class still has results
- **A refused send revives the class.** The revival UPDATE (`round6.sql:289-293`) runs before the per-class and service-wide `full` checks.
  - `rev_full.sql`: with `reltuples` above 300,000, a send to a held planned code returns `{"error": "full", "scope": "all"}`, but the class is now `made_today t | life 30 days | results 0`.
  - The planned class has been restarted with no result, in the 30-day form, so it can never be revived again.
  - **Fix:** revive only after the `full` checks, right before the insert.
- **The instructor's "made" date jumps.** The revival rewrites `created_at`, and `cbShow` saves it as `t` (`ui.js` `cbShow`, `t: Date.parse(r.created)`). The instructor's row then shows "made <the date a student first sent>" for a code they made weeks earlier.
- **The device's key can expire before the class.**
  - The device drops a key at `t + 60 days` (`cbKeys`, `CB_KEEP`), and `t` moves only when the instructor opens Results.
  - A planned code revived on day 40 lives to day 70 and is held to day 100. If nobody opens Results before day 60, the key is gone while the class still has results.
  - `probe_ui.py` C: a record with `t` 61 days ago is not listed ("rows shown: 4 of 5").
  - These texts are now stale: `CB_LIFE`'s comment ("a class's longest life"), CLAUDE.md ("The device keeps a key 60 days from when its class was made (its life, then the hold)"), and the typed-key error at `ui.js:2771` ("deleted 30 days after the code was made, or 14 if nobody sent one").
  - **Fix:** keep the key until `max(t + 60 days, e + 30 days)`. Update `e` whenever it is learned, and fix those texts.
- **Effort:** S.

### R1.10-08 · Low · STATUS and docs overclaim this round
- **STATUS, the arrest penalty:** "It applies only to an own arrest at least 5 minutes old". Arrivals in arrest never qualify (R1.10-02).
- **STATUS, the fingerprint:** "a changed string can't pass" is false (R1.10-04). "The runbook says … what fixes each kind" is false for migration-1 functions (R1.10-05).
- **STATUS and the README, the cap:**
  - "At most 30,000 held" is not literally true. Only `cb_class_new` enforces it, 1,000 rows per call, and `tidy()` doesn't. A burst of classes ending at once sits above 30,000 until enough codes are made.
  - The README's rationale ("a flood of codes made only to hold them can't block new ones") doesn't say that the release reopens takeover (R1.10-01).
- **STATUS, "docs corrected (R1.9-06)":** `tools/name_ranges.py:63` is unchanged.
- **The `privacy_test.sql` comment** for R3.9-01 claims tests it doesn't contain (R1.10-06).
- **README:** "eight rounds of review"; there are nine.
- **Effort:** S.

### R1.10-09 · Nitpick
- **`ordLogHTML`'s count.** It shows `max(12, bad.length)` entries, but says "And {L.length - 12} more". With 15 unsafe entries and 5 others, it shows 15 and says "And 8 more"; the true number is 5.
- **`codeRegSaved`'s dead branch.** The final branch still tests `x.error === 'taken'`, which the new branch above already handled.
- **A taken row that was never set up.** A row with `p:1` that gets `taken` is saved as `x:1` and reads "class ended", though it never had a class (`probe_ui.py` D: "made Nov 23 … · class ended | Another class has 07V-01N on the server now").
- **The cap's batch size.** It releases 1,000 codes to get under 30,000, so 999 more than needed are released early (`held_cap.sql`: "flood codes released 999").
- **The arrest field's meaning changed.** `mdArrestOpen` on the server now means "left 5+ min" (`arrestLeft`). The student's table means all of them. The name and the student's label don't say which.
- **R1.8-08 leftovers, unchanged:**
  - `class_test.py`'s "the failure reads as an error" (its line 7 of output);
  - the dead `cardiovert` clause in `signOrders`;
  - rounding to a tenth (0.45 shows as 0.5);
  - `allow48` discarding `who()`;
  - `clean_name`'s input collation;
  - the predecessor test is `grep -q 'first'`;
  - Forget overwriting a later clipboard;
  - `2001::/23`.
- **`deploy.txt`** still publishes the private repo's commit SHA and run id.

## 4. Coverage

**Read in full:**
- **The migration and release checks:** the round-9 diff of migration 2 and its current `cb_class_new`, `cb_submit`, `fingerprint_parts`, `fingerprint`, `cb_health` and `tidy`; `run.sh`; `db_live.js`; the `privacy_test.sql` and `client_call.json` diffs; `fingerprint.json`.
- **Workflows:** `db-watch.yml`, `pages.yml`, and the PostgreSQL pins in `tests.yml`.
- **Engine:** the `engine.js` diff, with `signOrders`, `codeOutcome`, `toArrest`, `arrestNoTeam`, `leave` and `endShift` in context.
- **UI:** the `ui.js` diff, with `morph`, `focusables`, `renderSheet`, `cbRegister`, `codeRegSaved`, `cbListHTML`, `cbShow`, `cbSendHTML`, `verdictOf`, `litHTML`, `ordLogHTML` and `showReport`.
- **Tests:** the `rules10.js`, `rules13.js` and `class_test.py` diffs.
- **Docs:** CLAUDE.md, `supabase/README.md`, the README's v0.31.0 paragraph, and round-9 STATUS.

**Ran:**
- **The suites:**
  - `npm test`: 717 ok, exit 0.
  - `npm run db:test`: 225 ok, PostgreSQL 16.15, en_US.UTF-8. Kept with `KEEP=1` and deleted afterwards.
  - `CHROME_PATH=/usr/bin/google-chrome python3 test/class_test.py`: 107 ok, "No errors."
- **PostgreSQL 16:**
  - the fingerprint against the committed file;
  - eight hand edits and a string change that leave it unchanged;
  - the constraint list;
  - the cap's takeover and its race;
  - the revival mutant;
  - a revival refused by `full`;
  - the cost of junk sends.
- **Node:** `arrival_arrest.js` (3 seeds, two kinds of arrest), and round 9's `clean.js` against HEAD.
- **Playwright in Chrome, server stubbed:**
  - `probe_ui.py` A and B (R1.9-03);
  - C (every saved-row state, and key retention);
  - D (the taken row, before and after a reopen);
  - E (a 503).

**Not checked, and why:**
- **PostgreSQL 17 and 18:** not installed. Running downloaded binaries was refused, so R1.10-03 rests on the code and PG 18's documented catalog change. PG 16 vs 17 is unverified until CI runs.
- **Off limits:** the live project, PostgREST, Cloudflare and real pg_cron (including `cron.job`'s row security under the owner's role).
- **No access:** GitHub Actions.
- **Not installed:** WebKit and iOS.

## 5. What I'd keep

- **The fingerprint as a per-object manifest in a committed JSON file.** `run.sh` names the objects that differ, and checks a C-locale fresh project against an en_US migrated one. It is the right shape. It just needs a `contype` filter and a line-ending-only body normalisation.
- **Grants hashed only for `anon`, `authenticated` and PUBLIC.** That makes it independent of who owns or pastes the objects.
- **The revival.** It is one guarded UPDATE under the per-code advisory lock, with version and "never had results" conditions. Tidy can't race it, and the instructor's turn-back-on can't wipe it.
- **`cb_submit`'s validate-then-count order.** It is cheaper per junk call and keeps campus limits for real sends.
- **Panel and row reconciled by sequence numbers in both directions,** and the `g` flag keeping "taken" across reopens.
- **`p.codeLost` as a plain fact on the patient,** gated on `p.mine` everywhere it is counted.
