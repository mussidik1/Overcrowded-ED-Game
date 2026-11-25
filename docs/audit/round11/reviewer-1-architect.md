# Reviewer 1, round 11: Senior Software Architect (release review of v0.31.0 at e3fbeec)

Scope: `git diff 1ab6fa9..e3fbeec -- src supabase test tools .github build.js package.json CLAUDE.md README.md docs/SMOKE.md`, then the release as a whole. Scratch: `scratchpad/round11/r1/`. Nothing here contacted supabase.co or edcodeblack.com.

## 0. Round-10 status

| Round-10 finding | Status | Evidence |
|---|---|---|
| R1.10-01 Medium: the held-code cap releases real codes; one call frees a code and takes it; a revived class can be wiped by a concurrent release | **Partly fixed** | **Fixed:** the code being registered is excluded (`x.code <> v_code`), and the outer `DELETE` re-checks `c.expires_at <= now()`, so a concurrent revival survives (`race_*.sql` re-run: "class REA-R00 (2026-11-25, 2026-12-25), results 1"). **Still open:** the release order is now newest-ended first. A flood that ended *before* a real planned code still pushes that code out, and two calls take it over (R1.11-01). Fix (b) in my round-10 report suggested newest-first, and that was wrong. Only fix (a), refusing new codes at the cap, closes the takeover. |
| R1.10-02 Medium: an arrival in arrest left unrun at the end is never late | **Fixed** | `engine.js:4413` measures from `code.tLeft`, then `tArrest`, then `tArrive`. The new `rules13.js` check passes. The fix brings a smaller new problem: time before the patient had a room now counts against the attending (R1.11-03). |
| R1.10-03 Medium: the fingerprint changes on PostgreSQL 18 (NOT NULL rows in `pg_constraint`) | **Fixed** (the cause) | `fingerprint_parts()` now has `and o.contype <> 'n'`. **Not done:** `run.sh` still has no major-version guard, and the runbook has no note on Supabase major upgrades. PG 17 and 18 were not run here; the live match on PG 17 is the owner's word. |
| R1.10-04 Low: the fingerprint's blind spots (whitespace inside string literals; owner, triggers, policies, column and schema grants) | **Still open, and it now matters** | Re-run on this commit: `clean_name` with `'( [[:alpha:]]'` changed to `'(  [[:alpha:]]'` keeps `fp d6705b15…`, and `clean_name('Ana Maria')` returns NULL. The live `clean_name` was rebuilt by hand during the paste (R1.11-02). |
| R1.10-05 Low: the runbook's remedy is false for the four migration-1 functions; no machine diff | **Still open** | `supabase/README.md`, step 4, is unchanged ("paste the newest migration again … it re-creates every function"). |
| R1.10-06 Low: the revival test sits outside the hold; the cap had no test | **Partly fixed** | A cap block was added, but it only tests a flood *newer* than the planned code, the one ordering the new code handles. The "stays ended (no revival)" setup is still at `created 60 d / expires 30 d` (`privacy_test.sql:413`), outside the hold, so the round-10 mutant still passes. |
| R1.10-07 Low: the revival runs before the `full` checks; "made" moves; the device can drop the key early | **Still open** | `cb_submit` still revives (the `update … set created_at = now()`) before both `full` checks. `CB_KEEP` and the CLAUDE.md "60 days" line are unchanged. |
| R1.10-08 Low: STATUS and docs overclaim | **Still open** | The README still says "eight rounds"; `tools/name_ranges.py:63` is unchanged. This round adds new overclaims (R1.11-05). |
| R1.10-09 Nitpick | **Still open** | `ordLogHTML` still says "And {L.length - 12} more" after showing `max(12, bad.length)` (`ui.js:3146`). `codeRegSaved`'s last branch still tests `x.error === 'taken'` (`ui.js:2706`). |

Counts: Fixed 2, Partly fixed 2, Still open 5, Worse 0.

## 1. Verdict

This is the release review, so I answer the owner's question first.

**Ship v0.31.0 behind the gate: yes, today, with one check first.** The privacy core holds:
- the results table is out of the API's reach;
- the key-hash design and the rate limits work;
- deletion happens on schedule;
- 720 `npm test` lines, all of `db:test` (PostgreSQL 16 here) and 107 `class_test.py` checks pass;
- the committed build matches the source (I rebuilt it in a scratch copy).

**The check first:** the live `codeblack.clean_name` was re-created by hand after Claude's Supabase tool changed its `\u` escapes. The one check the deploy makes on it, the fingerprint, cannot see a whitespace change inside its name regex. Nothing in `db_live.js` sends a name with a space. Before students send anything, run one SQL statement (R1.11-02).

**Turning the gate off: not until migration 3.** The held-code cap still lets anyone take over a planned class code, now in two calls instead of one (R1.11-01). It costs an attacker a 30,000-code flood, made at least two weeks ahead. The daily watch notices on the day it starts, but the runbook has no remedy for a held-code flood (R1.11-04). With the gate on and a handful of classes this is not urgent. Open to anyone, it is a hole in the very guarantee ("nobody else can take it over") that the hold exists to give. Both migrations are frozen, so every database finding here needs `20261126…_codeblack_*.sql`.

Smaller problems:
- The arrest-at-the-end clock now counts minutes the patient waited without a room (R1.11-03).
- "By the book" is applied to codes the game's own doctor ran, which the game itself models as only partly right (R1.11-06).
- STATUS says the cap "fix" works because "a flood ends after the real classes it would push out". That holds only if the attacker cooperates (R1.11-05).

## 2. Score

**6 / 10.** It is the same number as round 10, for different reasons. The engine and the UI work this round fixed what it claimed to. The held-code fix moved the hole rather than closing it, and the one function rebuilt by hand on live has no check that could catch a wrong rebuild.

## 3. New findings (worst first)

### R1.11-01 · Medium · The held-code cap now releases the *newest* held codes, so a flood that ended earlier makes every newly ended class releasable at the next registration, and a planned code can be taken over in two calls
- **Where:** `supabase/migrations/20261125120000_codeblack_round6.sql:242-245` (live and frozen):

  ```sql
  if (select count(*) from (select 1 from codeblack.classes x where x.expires_at <= now() limit 30001) y) > 30000 then
    delete from codeblack.classes c where c.code in (select x.code from codeblack.classes x where x.expires_at <= now() and x.code <> v_code order by x.expires_at desc limit 1000)
      and c.expires_at <= now();
  end if;
  ```
- **The claim** (code comment, supabase/README "How long", STATUS): "a flood made to fill the hold ends after the real classes it would push out, so it goes first". That is true only for a flood made *after* the real class. A flood made *before* it sits at the old end of the order, and each real class that ends afterwards is the newest held code, so it is released first.
- **Reproduce** (`scratchpad/round11/r1/cap_old_flood.sql`, run in one transaction on the database `KEEP=1 npm run db:test` leaves behind, rolled back):
  - 30,001 flood codes were made 24 days ago and ended 10 days ago (held 20 more days).
  - The real planned code `REA-R00` was made 15 days ago and ended unused yesterday, so it is held and revivable for 29 more days.

  ```
  2. attacker, any other code|true                                  <- releases the 1,000 newest: REA-R00 and 999 flood codes
  3. attacker, the planned code again|{"ok": true, ...}           <- the attacker now owns the posted code
  4. a student sends to the posted code|{"ok": true}
  5. attacker reads|Ana                                             <- the student's name goes to the attacker
  6. real instructor reads|{"error": "key"}
  7. real instructor turns it back on|{"error": "taken"}
  ```

  Without step 2, a direct attempt answers `taken`. The `v_code` exclusion stops only the one-call version.
- **The steady state is worse than one takeover.** While the old flood stays held (up to 30 days), held codes stay at about 30,000. Every class that ends during that time is the newest held code and is released by the very next `cb_class_new` from anyone. For a month, the hold protects nothing: any ended code, including every planned code in its revival window, is free to the first taker. A planned code (made ahead, ended unused at 14 days, posted for a class next week) is exactly what the hold and the revival exist for.
- **Cost:** the same as in round 10. About 30,000 codes, from about 31 IPv6 /48s for a day or 150 IPv4 networks, then 14 days of waiting.
- **What does catch it:** `db-watch.yml` fails once `held >= 0.5`, so the owner gets an issue on the day the flood turns held. What it costs him then is R1.11-04.
- **Fix** (migration 3): at the cap, answer `full` to a *new* code (one not already in `codeblack.classes`), the way the live-class backstop does, and release nothing early. Existing codes keep `taken` and `ok`. Then:
  - Add `privacy_test.sql` blocks for both orderings: an older flood, a held planned code, a third code, then the planned code with another key must still be `taken`.
  - Fix the README, CLAUDE.md, STATUS, the code comment and `db_live.js`'s warning text.
- **Effort:** S (one migration, two test blocks, five text edits).

### R1.11-02 · Medium · The live `clean_name` was rebuilt by hand, and nothing in the release can tell whether the rebuild is exact: the fingerprint ignores whitespace inside its name regex, and `db_live.js` never sends a name with a space
- **Where:**
  - `supabase/README.md`, Releasing, step 3 (new this round): "Applied through Claude's Supabase tool, the tool turns `\uXXXX` escapes in the text into the characters themselves … the round-6 migration's `clean_name` had to be re-sent with the escapes rebuilt in the database. The fingerprint check below catches it."
  - `fingerprint_parts()`: `md5(btrim(regexp_replace(p.prosrc, '\s+', ' ', 'g')) …`.
  - `test/db_live.js:99`: the only live `cb_submit` probe uses `p_name: 'Probe'`.
- **Why it matters:** `clean_name` is the one function where whitespace inside a string literal changes behaviour. The name pattern is `'( [[:alpha:]]…'`, and a single space separates the words. The repo does not record the statement that rebuilt it, so `applied.sha256` vouches for a file whose text is not what ran for this function.
- **Reproduce** (`scratchpad/round11/r1/cn.sql`, on a local migrated database):

  ```
  before|d6705b15e275614018b897e730e13fa4|Ana Maria
  after |d6705b15e275614018b897e730e13fa4|              <- one space doubled in the regex: same fingerprint, "Ana Maria" refused
  ```

  `d6705b15…` is the committed `fp`. A rebuild that broke every two-word name ("Ana Maria", "J. R.") would pass the deploy, and every such student would get "invalid name".
- **I have not shown the live function is wrong.** I can't contact it. The finding is that the release has no check that could show it is right.
- **Fix:**
  - **Now (owner, SQL editor):** `select md5(prosrc), length(prosrc), codeblack.clean_name('Ana Maria'), codeblack.clean_name('J. R.') from pg_proc where oid = 'codeblack.clean_name(text)'::regprocedure;`. A fresh local build gives `f8adf6a0d7619b06b6e73ad9b8b6a9ab | 7958` and two non-null names.
  - **In `db_live.js`, at no cost:** send `cb_submit` with `p_name: 'Ana Maria'` and `p_level: 'x'`. `v_bad` checks `name` before `level`, so a working rule answers `field: level` and a broken one answers `field: name`. It changes nothing on the server and counts toward no limit (validation runs first). Loop over `client_call.json`'s accepted names the same way.
  - **In migration 3:** hash `prosrc` exactly, with only `\r` stripped, at least for `clean_name` (R1.10-04).
  - **README:** "The fingerprint check below catches it" is false for whitespace. Say what was run, and keep the rebuild statement in the repo.
- **Effort:** S.

### R1.11-03 · Low · The end-of-shift arrest penalty now counts the minutes before the patient had a room, which the attending couldn't use
- **Where:** `engine.js:4413`: `ref = … p.tArrest != null ? p.tArrest : p.tArrive`. `arrestNoTeam` (`:2307-2316`) uses the same clock to decide *when*, but it blames the attending only `if roomed` ("the attending can only run a code on a patient in a room").
- **Reproduce:** `node scratchpad/round11/r1/late_room.js /home/user/Overcrowded-ED-Game`:

  ```
  arrived 16 min before the end, roomed 15 min before the end: late=true arrestLeft=1 legal 0 -> 15 mm=... (16 min) ...
  arrived 16 min before the end, roomed 1 min before the end:  late=true arrestLeft=1 legal 0 -> 15 mm=... (16 min) ...
  ```

  A patient roomed one minute before 19:00 costs care -40, legal risk +15, an M&M line saying "16 min" and `mdArrestOpen 1` on the instructor's list.
- **Fix:** `ref = max(p.tRoom ?? ref, ref)` for the blame test only; keep `arrestNoTeam`'s door clock for the death. Add a `rules13.js` case.
- **Effort:** S.

### R1.11-04 · Low · When the held codes fill up, the alarm points to a runbook section that says *not* to delete held codes, and offers no other remedy
- **Where:**
  - `db_live.js:79-80` sends the owner to "See supabase/README.md, 'Backstops'".
  - "Backstops" gives one remedy, for live classes, and says explicitly "(not held codes, which have no results by design)".
- **Effect:** in R1.11-01's attack, the daily watch opens an issue on day one. The owner, on his phone, finds no SQL to run. Meanwhile every ending class is released at the next registration.
- **Fix:** add a held-flood remedy. For example: `delete from codeblack.classes where expires_at <= now() and created_at between '<start>' and '<end>' and key_hash in (select key_hash from codeblack.classes group by 1 having count(*) > 50);`, with a warning that it frees those codes. Better, after R1.11-01's fix, there is no release, and the remedy is to delete the flood's held rows.
- **Effort:** S.

### R1.11-05 · Low · STATUS and the docs overclaim the cap fix, and stale comments contradict the code
- **STATUS, "Fixed":** "Past 30,000 held, the most recently ended go first (a flood ends after the real classes it would push out)". That is false for an earlier flood (R1.11-01). The privacy test checks only the ordering that works.
- **README "How long" and the code comment:** the same rationale.
- **`privacy_test.sql:419`:** still headed "the oldest let go first". The code now does the opposite.
- **`fingerprint_parts()` comment:** still says "a re-indented paste passes but a changed string doesn't". That is false (R1.10-04, re-run above). It is now load-bearing (R1.11-02).
- **README step 3:** "The fingerprint check below catches it" (R1.11-02).
- **README v0.31.0 paragraph:** "eight rounds of review" and "`round4/STATUS.md` through `round9/STATUS.md`". It is ten rounds, and round 10 has a STATUS.
- **Effort:** S.

### R1.11-06 · Low · "A code run by the book" is applied to codes the game's own doctor ran, which the engine models as only partly right, and the definition shown to instructors is then false
- **Where:**
  - `engine.js:2276`: `const book = C.wait <= 3 && (!C.me || C.right >= n)`. A code another doctor ran within 3 minutes is "by the book" whatever happened.
  - `CODE_AI_Q = 0.6` (`:2243`): "a doctor run by the game gets it partly right".
  - `ui.js` `CB_MDNOTE`, `cbWhatAll` and the About page define "by the book" as "every rhythm check right, a doctor there within 3 minutes".
- **Effect:** `rules13.js`'s R6.10-02 check asserts that such a code counts toward `codeLost`. On the instructor's list, the CSV column "Of them, after a code run by the book" therefore includes codes whose rhythm checks the game itself treats as 40% wrong.
- **Fix:** keep the behaviour, which is defensible (it's not the student's failure), but name it honestly. Store `me` in the summary (`codeLostOwn` and `codeLostOther`), or define the column as "after a code run by the book, or run promptly by another doctor".
- **Effort:** S.

### R1.11-07 · Low · A saved class whose first result came before day 14 reads "ended … with no results" from day 15 to day 30 while it is live with results
- **Where:** `ui.js:2222-2225`. `used` is `K.e - K.t >= 20 days`, but `K.e` is the 14-day end saved at registration. It is updated only when the instructor opens Results.
- **Effect:** a class with results still on the server reads "**ended Dec 9 with no results**, unless a student has sent one since (a first result before Jan 8 starts it again)". The result was sent *before* Dec 9, so "since" is wrong. The server would refuse to restart such a class. The row then offers Forget, which drops the key to a live class with results after a confirm.
- **Fix:** while `now < K.t + CB_LIFE`, say "results until {e}, or {t + 30 d} if a student has sent one: Results checks". Or refresh `e` from the server when the sheet opens.
- **Effort:** S.

### R1.11-08 · Nitpick
- **`codeAskNo`, `cbDelNo` and `keyForgetNo`** build CSS selectors by interpolating `U.codeAsk`, a result id and a code. All are safe today (fixed alphabets and UUIDs), but nothing escapes them. `CSS.escape` costs nothing.
- **The 5xx fallback rationale:** "a 5xx is the service down, which a classmate can't cause". PostgREST answers 503 when its connection pool is exhausted, which load from anyone can cause. That is acceptable, but the comment states it as fact.
- **`codeAskNo`** puts the focus back on `[data-act="codeMake"][data-arg=level]`. With two shifts of the same level on screen (role or scenario change), it picks the first.
- **`run.sh`'s header and CLAUDE.md** still say `db:test` needs "PostgreSQL 15 or newer". The fingerprint was only ever compared on 16 (here) and 17 (CI and live).
- **The R1.10-09 items** (above) and the R1.8-08 leftovers are unchanged.

## 4. Coverage

- **Read:**
  - BRIEF rounds 10 and 11, round-10 STATUS, my round-10 report;
  - the full diff `1ab6fa9..e3fbeec` for the listed paths;
  - `cb_submit`, `cb_class_new`'s cap, `fingerprint_parts()` and `fingerprint()` in migration 2;
  - `run.sh`, `db_live.js`'s health section, `privacy_test.sql`'s new and changed blocks;
  - in the engine: `codeOutcome`, `codeStart`, `arrestNoTeam`, `endShift`'s arrest loop, `litAdd`, `litCheck` and `lawTick`;
  - in the UI: `cbRegister`, `codeRegSaved`, `cbShow`, `cbListHTML`, the focus and confirm actions, and Escape in `bind()`.
- **Ran:**
  - `npm test`: exit 0, 720 ok.
  - `npm run db:test`: PostgreSQL 16, all checks passed.
  - `CHROME_PATH=/usr/bin/google-chrome python3 test/class_test.py`: 107 ok, exit 0.
  - `node build.js` in a scratch copy: `index.html` and `sw.js` byte-identical to the committed ones.
- **Database experiments** ran on the kept `db:test` cluster, all in rolled-back transactions or a scratch database:
  - `cap_old_flood.sql`: the takeover (R1.11-01);
  - the round-10 race scripts with the new ordering: the race is fixed;
  - `cn.sql`: the fingerprint is blind to regex whitespace (R1.11-02).
- **Engine:** `late_room.js` (R1.11-03).
- **Not done:**
  - PostgreSQL 17 and 18 are not installed. The PG 18 fix rests on the code.
  - The live database was not contacted, so the live `clean_name` is unverified, which is the point of R1.11-02.
  - No phone.
  - Not run: `npm run stress`, `npm run sim`, the other Playwright suites.

## 5. What I'd keep

- The newest-migration-first discipline: frozen hashes, the predecessor and newer-migration refusals, and the deploy refusing to publish ahead of the database.
- The per-object fingerprint. With an exact hash of `prosrc` it would be the right tool.
- The re-check after the row lock in the cap's `DELETE`. It is correct, and the race is closed.
- The single clock for the arrest age, shared with `arrestNoTeam`.
- Results validated before any limit counts them.
