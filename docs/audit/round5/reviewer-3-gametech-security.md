# Reviewer 3, round 5: game tech, security and privacy (the round-4 fixes)

Branch `claude/sleepy-rubin-jot35n`, v0.31.0, HEAD `7cb5613`. The fixes under review are `git diff ce11887..46a0b03`. Reviewed Nov 24, 2026.

**How I tested.**
- **Database:** I attacked the migration on two throwaway PostgreSQL 16 clusters: one at `C.UTF-8`, and one at `en_US.UTF-8` (locale built with `localedef`). Each had the stubs, the baseline and the migration loaded.
- **Shipped suites:** `npm run db:test` passed (149 ok). `test/class_test.py` passed (60 ok).
- **Client:** I drove the committed `index.html` in Chrome through Playwright. Every `**/rest/v1/**` request was stubbed or aborted. Nothing reached supabase.co or edcodeblack.com.
- **Scratch:** scripts and screenshots are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round5/r3/`.

**Working tree changed during the review.** At 19:54:31 another process changed `src/ui.js`, `src/style.css`, `index.html` and `sw.js` in the working tree. The ui.js change touches `morph` (focus while typing) and `inStrip`. I edited none of these files. Every browser result below was taken before that change, against the committed build, which I had confirmed matches HEAD's source byte for byte.

## 0. Round-4 status

| Item | Status | Evidence |
|---|---|---|
| R3.4-01 global caps are a kill switch | **Partly fixed** | Per-network counters replace the global hourly caps, and unused codes now last 7 days. What remains are backstops of 300,000 classes and 1,000,000 results. Reaching them takes about 5,000 or about 1,700 network-hours. The results backstop sits above the shared project's storage quota, so it can't trip in time (R3.5-02). |
| R3.4-02 a limiter row for every request | **Fixed** | One row per network, kind and hour. pgbench: 1,200 concurrent calls from one network left `n = 601`. 800 calls from about 800 networks left 1,040 rows across all kinds. Refusals write nothing. |
| R3.4-03 key under the projected code | **Fixed** | The key is hidden until Show key, and the code sheet never draws it. `class_test` checks this, and my probe confirms it. |
| R3.4-04 `0e-16383` amplification | **Fixed** | `clean_stats` rebuilds from known keys: `scale(n) = 0` and casts to int. `0e-16383`, `1e1000`, `5.000` and `1.0e0` are all dropped. The maximum is 290 bytes, under the column's 400. |
| R3.4-05 one student fills a class | **Partly fixed** | Accepted in STATUS. Keyed deletes are unlimited and one call deletes all. A 500-row fill still takes one network about a minute. |
| R3.4-06 a campus counts as one person, and refusals count | **Partly fixed** | The limits are now 10 times higher. Invalid probes still spend the same 600 an hour as real sends: `privacy_test` asserts "probes count too". One student's script still blocks a whole Wi-Fi's Send for the hour. |
| R3.4-07 whose address | **Partly fixed** | Addresses are parsed: `::ffff:`, `/mask` and leading zeros all collapse, and garbage goes to one shared "unknown" bucket. The deploy now proves forged headers are limited. When `cf-connecting-ip` is absent, the leftmost `x-forwarded-for` entry is still used. |
| R3.4-08 a lost reply loses the key | **Fixed** | The client makes the key, and a retry with the same code and key is ok (tested). The new edge case is a code the server calls `taken` (R3.5-03). |
| R3.4-09 shared PC, no Forget, codes unreachable | **Partly fixed** | Forget works. "Remember" is off by default for typed keys. Every code is listed. But every saved key now drops out of the list on day 7 and is then erased, even though its class lives to day 30 (R3.5-01). For "codes become unreachable", that part is worse than round 4. |
| R3.4-10 old codes can't be typed | **Fixed** | `cbCodeNorm` accepts any well-formed code. `class_test` checks an other-version code. |
| R3.4-11 Send dead when storage is blocked | **Fixed** | With `localStorage` throwing on every access, Send went out and said "Sent" (`probe4`). A partial-failure edge remains (R3.5-08). |
| R3.4-12 expensive cleanup before the limit | **Fixed** | `octet_length` and `pg_column_size` checks run first, then `allow()`, then normalization. |
| R3.4-13 races | **Fixed** | pgbench, 80 clients on up to 60,000 networks racing one class: exactly 500 results. One network: the counter stopped at 601. The daily salt insert, raced five times by 60 clients: no failures, one salt. |
| R3.4-14 invisible names, digits | **Partly fixed** | Hangul fillers are refused, and so are the listed digit blocks. The server still accepts digits from at least 14 scripts (R3.5-06). |
| R3.4-15 errors blame the network | **Partly fixed** | Network, timeout, 404 and server faults are now told apart. The results backstop answers `busy`, which the client shows as "Too many requests from your network this hour" (R3.5-02). |
| R3.4-16 `db_live.js` weak and after the deploy | **Fixed** | It runs before the upload and requires 404 for the old table and for writes to it. The old-table POST fails the role check and rolls back, so it never writes. It has a 15-second timeout. New problems with it are R3.5-05 and R3.5-12. |
| R3.4-17 privacy wording, salt, unmonitored cron | **Partly fixed** | The developer is named. The salt is now daily. `cb_health` reports cron and overdue classes. The contact is still empty, which is the owner's decision. |
| R3.4-18 malformed `oc-ckeys` freezes the game | **Fixed** | `null`, numbers, `__proto__` and bad keys are ignored (`probe4`). A hand-crafted `exp` object still throws (nitpick). |
| R3.4-19 version never checked | **Fixed** | `cb_submit` returns `version` on a mismatch (tested). |
| R3.4-20 R3.2-07 dropped silently | **Moved** | Moved to Phase 5 in STATUS, with a reason. |
| R3.4-21 database test gaps | **Partly fixed** | Tests now cover the guard, the baseline's refusal, a fresh project, number formats and unicode names. There's still no concurrency test; my pgbench runs hold. |
| R3.4-22 `audit_shots.py` hits production | **Fixed** | It now routes `**/rest/v1/**` to abort at the context level. |
| R3.4-23 nitpicks | **Fixed** | All fixed: the search path, the guard's lock, ids, `copyText`, the delete column, the sparse checkout, `run.sh` on bash 3.2, code points, and the key's `aria-label`. |

**Totals:** 13 fixed, 9 partly fixed, 0 still open, 0 worse, 1 moved. The day-7 key loss is a regression inside R3.4-09.

## 1. Verdict

**Not yet, but close on the server side.** In two hours I found no way to read a name or delete a result without the key. The rewritten database is a real improvement: atomic counters, a per-class lock, stats rebuilt as integers, a version check, and size checks first.

What still stops me:
- **The live database** still serves every name by code. The deploy now refuses to publish v0.31.0 until the migration is applied, which is correct, but the owner hasn't applied it.
- **Day 7:** the instructor's saved key falls off the device, though the class's results live for 30 days (R3.5-01).
- **Shared lab PCs:** one student's typed name pre-fills the next student's summary, and one tap sends it (R3.5-04).
- **A squatter can capture a class's results.** If every code for a shift setup is taken, the game shows a code that belongs to another class, and the students' results go to that class (R3.5-03).
- **The storage backstop** is set above the shared free project's whole quota (R3.5-02).

## 2. Score

**6 / 10** (round 4: 5). The database work is professional now. The client still loses keys, leaks names between students, and shows codes it was told belong to someone else.

## 3. New findings, worst first

### R3.5-01 · High · Every saved instructor key drops off the device on day 7, while its results live to day 30
- **Location:**
  - `src/ui.js`, `cbRegister`: stores `exp` from the 7-day registration reply.
  - `ACT.cbShow`: for a saved code (`a` set), it never calls `cbKeySave`, so the stored `exp` is never refreshed.
  - `cbKeys`: drops entries whose stored `exp` has passed.
  - `cbKeySave`: rewrites storage from `cbKeys()`, so the dropped entry is erased for good.
  - Migration line 283: the first result moves `expires_at` to `created_at + 30 days`.
- **Reproduction** (`probe1.py`, section A):
  1. Make a code. The stored `exp` is now + 7 days.
  2. Tap Results. The server replies with an expiry 30 days out. The list header says "deleted on Dec 24", but the saved row still says "until Dec 1", and storage still holds Dec 1.
  3. Move the clock 8 days. The code is gone from Class results (`a3-day8-list.png`), though it's still in storage.
  4. Make any other code. Storage now holds only the new code, and the old key is erased.
  - Forget, and a typed key with Remember, erase it the same way.
  - The instructor can't read results the README promises for 30 days. A lost key "can't be recovered", and the results then sit unreadable until deletion.
  - The README's "Class results lists every code you made there" is false after day 7.
- **Fix:**
  - On every successful `cb_class_read`, save `r.expires` for that code.
  - Store the creation time and keep entries until `created + 31 days`, or until the server answers `key`. Don't trust the 7-day estimate.
  - Show the server's date in the row.
- **Effort:** S.

### R3.5-02 · High · The "storage backstop" sits above the shared free project's quota, so it can't protect it
- **Location:**
  - Migration lines 235 and 278: `reltuples` above 300,000 classes or 1,000,000 results.
  - `supabase/README.md`, "Backstops": "far above any real use, there to protect the shared free-plan database".
- **Reproduction:** I measured on my PostgreSQL 16 cluster, after `VACUUM ANALYZE`, indexes included.
  - **Results, 1,000,000 rows:**
    - Typical rows ("Sam", nine small stats): **330 MB**.
    - 20 ASCII letters and the largest stats: **440 MB**.
    - 20 four-byte letters, which `clean_name` accepts (`𐐀` × 20): **about 510 MB**.
  - **Classes, 300,000 rows:** **44 MB**.
  - Supabase documents that a free-plan project over its 500 MB database limit goes read-only. That would take Case Room down too. An attacker filling to the backstop crosses the quota first.
  - `reltuples` is an estimate that trails bulk inserts until autoanalyze runs, so it overshoots further.
  - Deleting the rows doesn't return disk space without `VACUUM FULL`.
- **Attack cost:**
  - 2,000 classes at 60 an hour, plus 1,000,000 results at 600 an hour: about 1,700 network-hours. That's a small rotating-proxy bill, or about 6.5 hours from one IPv6 /48 (256 buckets of /56) if the API answers over IPv6. I couldn't check that from here.
  - The junk lives 30 days.
  - Until then, every student's Send gets `busy`, which the client renders as "Too many requests from your network this hour". That blames a global condition on the student's network.
- **Fix:**
  - Size the backstop in bytes against the real quota. For example, refuse when `pg_total_relation_size('codeblack.results') > 50 MB`. That is 100,000 to 150,000 results, still far above use.
  - Return a distinct `full` from `cb_submit`, with its own message.
  - Report the size in `cb_health`, and fail the deploy check above about 25 MB.
- **Effort:** S-M.

### R3.5-03 · Medium · After five `taken` replies, the game shows another class's code, and students' results go to that class
- **Location:** `src/ui.js`, `cbRegister`. In the `else` branch it sets `U.codeMade = code` for a code the server called `taken`. Separately, `cbRegHTML` says "The code still works for playing; students just can't send you their results".
- **Reproduction** (`probe3.py`, section E, `e-taken-code-shown.png`):
  1. Stub `cb_class_new` to always answer `taken`. The game tries 5 codes, then shows the fifth with Copy, Play it, and "Each summary… has a Send button that sends you the result".
  2. A student plays it and sends. The game says "Sent to the instructor for 471-R9H", and `cb_submit` went to that code: whoever registered it gets the names.
- **How an attacker reaches it:** One shift setup (role, level, scenario, pack) has only 131,072 codes, the 17-bit seed. The server accepts any six characters. Squatting all of them is 131,072 `cb_class_new` calls, all within the per-network limits from rotating addresses. A squatted code lasts 7 days, or 30 after one result. From then on, every instructor who picks that setup is shown a code whose results flow to the squatter. Without an attacker, the path needs five random collisions, so in practice only the attack reaches it.
- **Fix:**
  - Never display a code the server refused as `taken`. Say "Couldn't make a class code. Try again" with no code on screen.
  - On the `shown` path (Try again after a network failure, then `taken`), replace the code with that message as well.
- **Effort:** S.

### R3.5-04 · Medium · On a shared device, one student's name pre-fills the next student's summary, and one tap sends it
- **Location:** `src/ui.js`. `U.cbName` is set by the `input` listener in `bind()`, and nothing clears it: not `start()`, not `showReport()`, not a successful send.
- **Reproduction** (`probe1.py`, section B):
  1. Student 1 sends as "Priya K".
  2. Menu, then a second class shift in the same tab.
  3. Student 2's summary opens with "Priya K" already in the name box.
  4. One tap on Send submitted student 2's score as "Priya K".
- **Why it matters:** This is the shared-lab-PC case that the "never stores the name" fix was meant to handle. The name isn't in `localStorage`, but it lives as long as the tab. It shows one student's name to the next, and it corrupts the instructor's list.
- **Fix:** Clear `U.cbName` in `start()` and after `r.ok`, and render the box empty for each new report.
- **Effort:** S.

### R3.5-05 · Medium · The deploy's exact-migration check blocks the documented rollback of any release that adds a migration
- **Location:** `test/db_live.js`: `hj.db === LATEST`, where `LATEST` is the newest file in the checked-out `supabase/migrations/`.
- **What the docs say:**
  - CLAUDE.md, "Rolling back": `git revert -m 1 <merge>`, and "the deploy republishes the previous version".
  - `supabase/README.md`: "Rolling back the game … leaves the database as it is".
- **Reproduction** (by reading; it can't run here):
  1. Release N adds `2026120…_x.sql`, and the owner applies it.
  2. Reverting N's merge deletes that file from the tree, so `LATEST` becomes the older name.
  3. `cb_health` reports the newer one.
  4. "the live database has the latest migration" fails, and nothing is published.
  - The rollback is blocked exactly when it's most needed: after a release that changed the database. It works for v0.31.0 only because the revert also removes the check itself.
- **Fix:**
  - Require `hj.db >= LATEST` (the names are timestamped, so they sort as text).
  - Document that a game rollback never needs a database rollback.
- **Effort:** S.

### R3.5-06 · Low · The name rule still lets digits through and still refuses real names, and the client and server disagree
- **Location:** migration line 203, the digit blocklist; `src/ui.js` `cbClean`, which uses `\p{L}` only.
- **Reproduction** (`names.js` and `names.sql`; identical at `C.UTF-8` and `en_US.UTF-8` on glibc 2.39):
  - **Server accepts digits:** `Sam᱑᱒` (Ol Chiki). Also digits in Adlam, Osmanya, Balinese, Javanese, Meetei, Sundanese, New Tai Lue, Limbu, Vai, Cham and Brahmi, plus circled and squared letters (`Ⓢⓐⓜ`, `🅂🄰🄼`). "No digits in any script" (migration header, STATUS) is false at the API.
  - **Both sides refuse real names** with a virama or a tone mark: `प्रिया`, `कृष्ण`, `अर्जुन`, `ਗੁਰਪ੍ਰੀਤ`, `ಅನಿಲ್`, `தமிழ்`, `ลุ่ม`, `สมศักดิ์`.
  - **The client refuses names the server accepts:** `राम`, `অমিত`, `مُحَمَّد` and `שָׁלוֹם`. `\p{L}` rejects their combining marks. The student is told "letters only".
- **Fix:**
  - Client: `^\p{L}[\p{L}\p{M}.'-]*…`.
  - Server: generate the blocklist from every Unicode `Nd` range (about 70), and allow combining marks after the first letter.
  - Test both against one shared list.
- **Effort:** S.

### R3.5-07 · Low · Focus is lost after any server-side refusal; STATUS says the Send box "keeps focus"
- **Location:** `cbSend` and `cbRedraw`. The box is redrawn `disabled` while sending, so `typing` is false when the answer arrives.
- **Reproduction** (`probe2.py` C1 and C2): Enter, then the server answers `{"error":"invalid","field":"name"}` or `busy`. Focus moves to `BODY`. On a phone the keyboard closes, and the student must tap the box again to fix the name. Only the client-side refusal keeps focus.
- **Fix:** Remember that the box had focus when the send started, and restore it when the answer arrives.
- **Effort:** S.

### R3.5-08 · Low · When storage takes the summary but refuses the next write, a resend gets a new id, and a sent result is reported as unsent
- **Location:** `lastReport()`. When the stored copy and `U.lastRep` have the same `at`, it returns the stale stored copy instead of the in-memory one.
- **Reproduction** (`probe2.py` D):
  1. The summary is saved; then `setItem('oc-last-report')` starts throwing.
  2. Send times out after 8 s; then Send again.
  3. The two calls carried different `p_cid`s (`da275ec2…` and `4701a78d…`). If the first committed, the result is stored twice.
  4. After "Sent", Menu still says "Your result … isn't sent yet".
- **Fix:** Prefer `U.lastRep` whenever it exists: memory is always the newest copy.
- **Effort:** S.

### R3.5-09 · Low · Copy table writes formulas raw; only the CSV is guarded
- **Location:** `ACT.cbCopyTab`. STATUS says "Copy table and Download CSV (no cell can run as a formula)".
- **Reproduction** (`probe2.py` F): with rows named `=1+2` and `+SUM(A1)`, the CSV writes `'=1+2`, but the clipboard gets `1\t=1+2\t…`. Pasting into Sheets or Excel evaluates it.
- **Note:** Today's server refuses such names, so this is a missing second layer, not a live hole.
- **Fix:** Use the same `cell()` guard for both exports.
- **Effort:** S.

### R3.5-10 · Low · Two calls tell anyone which codes are live, without the key
- **Location:** `cb_submit` (`unknown` versus `version`), and `cb_class_new` (`taken`).
- **Reproduction** (my cluster):
  - `cb_submit('RCE-003', …, '9.9.9')` returns `version`, and a dead code returns `unknown`. Neither writes anything.
  - `cb_class_new(code, other key)` returns `taken`.
- **Why it matters:** The README's "a wrong key, an unknown code and an expired class get the same answer" holds only for reads. One setup's 131,072 codes can be swept in about 220 network-hours to find live classes to junk-fill, or to squat around (R3.5-03).
- **Fix:**
  - Check the version only after the class is found and the request is otherwise valid, and give it the same answer as `unknown` to callers.
  - Or accept the oracle, and stop listing "the same answer" as a protection.
- **Effort:** S.

### R3.5-11 · Low · Raw addresses stay in `caseroom.cb_hits` after the migration
- **Location:** migration line 21 ("caseroom.cb_hits stays … nothing writes to it after this"). The baseline's `cb_results_stamp` wrote plaintext `client_ip()` there.
- **What's wrong:**
  - The Privacy text now says the database keeps "a keyed hash of the address … not the address itself".
  - Every Code Black send attempt before the migration left a raw address in that table. It stays for as long as Case Room's `tidy()` keeps it, and that isn't in this repo.
- **Fix:** Add `delete from caseroom.cb_hits;` to the migration. Only Code Black's old trigger wrote to it.
- **Effort:** S.

### R3.5-12 · Low · `db_live.js` can fail on its own: at the clock hour, and on a second run within the hour
- **Location:** `test/db_live.js`. One health call, then 121 forged-header calls, against a limit of 120 per clock hour.
- **What's wrong:**
  - If the 121 calls straddle the hour (`date_trunc('hour')`), the counter restarts, call 121 isn't `busy`, and the deploy fails. With sequential calls taking about 6 to 18 s, that's roughly 0.2 to 0.5 percent of runs.
  - The run itself uses up the network's health budget. A second `npm run db:live` within the same hour (the owner checking after applying the migration) fails the first four checks with `{"error":"busy"}`.
- **Fix:**
  - Read the minute first, and wait if it's 59.
  - Skip the first four checks with a clear message when `cb_health` answers `busy`.
- **Effort:** S.

### R3.5-13 · Nitpicks
- **Ghost codes** (`probe3.py` G1): two level taps while the first registration is out leave the first code registered and listed under Class results, though the instructor never saw it.
- **An expired, unpurged class:** with more than 500 expired classes queued, re-registering one with its key answers `ok` with an expiry in the past. The client then saves nothing and says "This device can't save it".
- **Stats bounds:** `fired` accepts 999,999, and `fast` (a percentage) accepts 999,999, so the list can show "(999999% sped up)". Bound `fast` to 100 and `fired` to 1.
- **The `/56` comment** ("one home or one phone carrier's customer") is wrong both ways. Carriers give each device a /64, so one /56 can hold up to 256 subscribers. A free tunnel-broker /48 gives one person 256 buckets.
- **`Date.parse` on a hand-made `exp` object** (`{"toString":1}`) throws inside `cbKeys`, which breaks rendering. This needs a crafted store. An `exp` of year 9999 is kept forever.
- **`client_call.json` pins requests only.** Response shapes (`expires`, `rows[].id`, `deleted`) are stubbed by hand in `class_test.py`. If `expires` were renamed, the client would quietly fall back to 7 days.
- **Purge cost:** one anonymous `cb_class_new` can purge 500 classes and 250,000 results. That took 0.85 s here. Supabase's anon statement timeout is reported to be 3 s.
- **The refusal message:** a name of 21 or more characters, or four words, gets "letters only", which isn't the reason.
- **`db_live.js` probe:** it uses `ZZZ-ZZZ` with the all-Z key. Anyone who registers that pair turns the deploy red.
- **Copy key** puts the key in the shared computer's clipboard history.
- **A `busy` on Refresh** throws away the loaded list. A network error keeps it.
- **Privacy text:** it says counters last "up to two days". They're deleted within about three hours; only the salts last two days.

## 4. Coverage

**Read:**
- The whole migration and the baseline.
- `stubs.sql`, `privacy_test.sql`, `run.sh` and `client_call.json`.
- `test/db_live.js`, and the `pages.yml`, `tests.yml` and `build.js` diffs.
- `src/backend.json` and `supabase/README.md`.
- In `src/ui.js`: the full class-results section, the ACT handlers, `bind()`, `lastReport`, `saveRep`, `unsentGuard`, `showReport`, `toast`/`res`, About/Privacy, and README v0.31.0.

**Ran on PostgreSQL 16:**
- Name rules: about 70 strings, at both locales.
- `clean_stats` edge cases.
- pgbench races: one network, many networks, the class cap, and the midnight salt insert.
- `client_ip` with 23 header forms.
- Storage at the backstops: 300,000 classes and 1,000,000 results, plus typical and worst-case rows.
- The purge's cost.
- The existence oracles.
- Re-registering an expired class.

**Ran in Chrome:**
- The key-expiry chain, with the clock moved.
- Two students on one tab.
- Focus after server refusals.
- Ten error kinds: the cid stayed the same across all ten.
- A partial storage failure.
- Copy table and CSV formulas.
- Five `taken` replies, and the student's send that follows.
- Rapid level taps.
- Junk `oc-ckeys`.
- Fully blocked storage.
- `class_test.py` (60 ok) and `npm run db:test` (149 ok).

**Couldn't check:**
- The live database and gateway, including whether the API answers over IPv6.
- Supabase's real anon statement timeout and quota enforcement.
- pg_graphql exposure of the `cb_` functions.
- Whether `caseroom.tidy()` cleans `cb_hits`.
- WebKit and real phones.
- IME composition with Enter in Safari.

## 5. What I'd keep

- The counter design: `insert … on conflict do update … where n <= limit returning n`. It is atomic and bounded, and it stops at limit + 1 under 40 concurrent clients.
- The advisory lock per class, taken before the existence, version, duplicate and cap checks. The cap held at exactly 500 under concurrency.
- Stats rebuilt server-side from a key list as integers, with `scale(n) = 0` checked without printing the number.
- Size checks before the limiter, the limiter before normalization, and normalization before anything is stored.
- A client-made 80-bit key from `getRandomValues & 31`: no modulo bias over a 32-letter alphabet. Registration is idempotent and stores only SHA-256.
- The version check, the explicit "all" on delete, deletes by the result's own id, and no global ids leaving the database.
- `cbFetch` naming the failure kind. The cid stayed stable across ten different failures.
- The deploy refusing to publish ahead of its database, and proving from outside that forged headers are still limited.
- The baseline refusing to run on a migrated database, and the guard taking `access exclusive` before it counts.
