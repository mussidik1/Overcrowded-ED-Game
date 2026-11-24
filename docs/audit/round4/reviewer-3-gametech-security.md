# Reviewer 3, round 4: game tech, security and privacy (Phase 2)

Branch `claude/sleepy-rubin-jot35n`, v0.31.0, HEAD `ce11887`. Phase 2 is `git diff 101e07a..ce11887`. Reviewed Nov 24, 2026.

I attacked the database on my own throwaway Postgres 16 cluster: stubs, the baseline, then the migration. I also ran the shipped suite (`npm run db:test`: 119 ok). I attacked the client in Chrome through Playwright, with every Supabase request routed at the context level and anything unrouted aborted. Nothing reached supabase.co or edcodeblack.com. Scratch scripts and screenshots are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round4/r3/`.

## 0. Status of the Phase 2 targets

| Item | Status | Evidence |
|---|---|---|
| R3-01 forge, flood, impersonate | **Partly fixed** | In the repo, results go in only through `cb_submit`, which checks every field, has an idempotent cid, per-network limits and caps. **The live database is unchanged.** The baseline records `grant insert ... to anon` with `with check (true)` on `public.cb_results`. I rebuilt it locally and anon's insert went through. Anyone with a code can still post fake rows under classmates' names (the README admits this). The new caps add cheap lockouts (R3.4-01, R3.4-05). |
| R3-02 names readable by code | **Partly fixed** | In the repo, reading needs the 80-bit key. A wrong key and an unknown code get the same answer, and guesses are capped at 120 an hour. **Live:** the baseline's `cb_class(text)` still returns every name for a code; locally, as anon, it returned the row I inserted. The new UI prints the key under the code the class is shown (R3.4-03) and leaves it on shared machines (R3.4-09). |
| R3-03 backend unverifiable | **Fixed** (within what a repo can do) | Schema, functions, grants and cron are in `supabase/migrations/`. 119 local checks pass. There's a CI job and `db_live.js`. A separate project stays deferred by the owner. Gaps: the header trust is never tested (R3.4-07), and `db_live.js` is weak (R3.4-16). |
| R3-13 double send | **Fixed** | The button is off and guarded while a send is out. The cid is stored before sending, and `sent` is persisted. There's no resend on a 400. Seven tries (junk, 404, 500, hang, ok) all carried one cid. New edge: when storage is full or blocked, Send does nothing (R3.4-11). |
| R3-14 no timeouts | **Fixed** | `cbFetch` uses AbortController plus a `Promise.race` fallback. A held request gave up at 8.1 s with "The server didn't answer in time". The gate uses it too. |
| R3-15 privacy disclosure | **Partly fixed** | Done: what is sent, to whom, for how long, how to delete, the network hashing, and `autocomplete="off"`. Missing: who controls the data, a contact, and that the developer can read everything. The "scrambled" address can be reversed in minutes by anyone who holds the database. The 30-day promise rests on a cron job nothing watches (R3.4-17). |
| R4-02 sideways scroll | **Fixed** | At 320, 360 and 390 px, the sheet's `scrollWidth` equals its `clientWidth`. The results table scrolls inside its own box, which leaves the delete column off-screen (nitpick). |
| R4-03 code scrolls into view | **Fixed** | One run on a phone left the key box (drawn after the reply) partly below the fold: its bottom at 871 px in an 851 px viewport. Cosmetic. |
| R3.2-07 (listed for Phase 2 in `round2/STATUS.md`) | **Still open, dropped silently** | Neither done nor mentioned in `c941ede` (R3.4-20). |

**What the baseline says about the live database today (v0.30.0 live):**
- Anon can insert into `public.cb_results` with any values. Only `ver` lacks an insert grant.
- `cb_class(text)` hands every name and score for a code to anyone.
- The v0.30.0 client's Send has been refused (401) since the Nov 24 version-column migration.

So production leaks names by code today. Its Send button is dead. And one `curl` row into the old table makes the new migration's guard refuse to run (I checked: `public.cb_results has 1 rows ...`). R3-01 and R3-02 stay Critical on the live site until the owner applies the migration and v0.31.0 ships with it.

## 1. Verdict

**Not yet.** The repo's core read path is finally sound: a private schema, four `SECURITY DEFINER` functions with an empty search path, no table grants, a hashed 80-bit key, and the same answer for a wrong key and an unknown code. I could not read a name without the key, and I could not delete without it.

But I would not let a nursing school put student names in this yet:
- The live database still serves names by code.
- The UI prints the instructor key right under the big class code, on the screen the instructor projects.
- A typed key is saved silently on whatever lecture-hall PC it was typed into, with no Forget.
- Four IPv4 addresses can stop every instructor in the world from making a class code, for good.
- One IP can grow the shared project's database by about 500 MB a day through the rate limiter itself.
- The privacy page still doesn't say who controls the data or how to reach them.

## 2. Score

**5 / 10.** Round 3 was 5. The schema work is real and tested. The availability design is naive, and the instructor-key UX undoes much of the privacy gain in a real classroom.

## 3. New findings, worst first

### R3.4-01 · High · The global caps are a kill switch: four networks lock out every instructor, three lock out every student
- **Location:**
  - Migration: line 200 (50,000 live classes), lines 231-235 (3,000 results an hour, 10,000 a day, 100,000 in all), lines 197 and 217 (20 codes and 200 results an hour per network).
  - `src/ui.js:2028` (`CB_BUSY`).
- **Reproduction:**
  - `cap.sql` fills `codeblack.classes` to 50,000. `cb_class_new` from a fresh network then returns `{"error": "busy"}`, so a real instructor gets nothing.
  - Classes live 30 days. One network can hold 20 × 24 × 30 = 14,400 live classes, so four networks hold 57,600 and the cap never clears. One IPv6 /62 does the same (four /64s), and free tunnel brokers hand out /48s.
  - The results caps go the same way. 200 an hour × 24 = 4,800 a day per network, so three networks keep the 10,000-a-day cap full indefinitely. Results also live 30 days, so the 100,000 total fills in ten days and stays full.
  - The client then tells the instructor "Too many requests from this network right now", which blames their network for a global cap.
- **Fix:**
  - Let a registered code that has no results expire after 48 hours, and extend it to 30 days on its first result.
  - Drop the hard global result caps, or make them per class.
  - Put proof-of-work or a Turnstile token, checked in an Edge Function, on `cb_class_new`.
  - Return a distinct `overloaded` error, and alert the owner as a cap nears.
- **Effort:** M.

### R3.4-02 · High · The rate limiter writes a row for every request, refused or not, with no ceiling
- **Location:** migration lines 117-126 (`codeblack.allow`), 65-70 (`codeblack.hits`), 181-186 (`tidy`).
- **Reproduction** (`hits.sql`):
  - 1,000,000 calls from one network add **111 MB** to `codeblack.hits` (116 bytes a call, index included).
  - With a million calls in the last hour, each further refused call costs **138-184 ms** of database time after `VACUUM ANALYZE`, against 2-6 ms normally. The limiter counts every row in the hour for that network.
  - A steady 50 requests a second from one address is 4.3 million rows, about **500 MB a day**. That's the free plan's whole database size, and the plan makes the project read-only when it's exceeded, for Case Room too. `tidy()` deletes rows, but Postgres doesn't return the space without `VACUUM FULL`.
  - Nothing in the repo limits request rate before the database.
- **Fix:**
  - Keep one counter row per (network hash, kind, hour), using `insert ... on conflict do update set n = n + 1`.
  - Stop incrementing at twice the limit.
  - The check becomes a single-row read, and storage is bounded at 4 × 24 rows per network.
- **Effort:** S.

### R3.4-03 · High · The instructor key is drawn directly under the code the instructor shows the class
- **Location:**
  - `src/ui.js:2058-2066`: `cbRegHTML` is rendered inside `.cc-made`, under the 40 px code, its Copy, Share and Play it buttons, and "Students: Play a shift…".
  - `src/ui.js:2466-2469`: `codeMake` scrolls that box into view.
- **Reproduction:**
  - `probe.py`, `p1-code-and-key-1440.png`: at 1440×900 (a projector), the code is at y 429-473 and the key at 692-719. Both are on one screen.
  - `p6-results-390.png`: on a phone, both fit on one screen.
  - Closing and reopening the sheet to show a latecomer the code shows the key again.
  - A student who photographs the projector can read every classmate's name and delete results. That is R3-02, back through the UI. "Don't share it with the class" is small print under a 22 px key.
- **Fix:**
  - Show the code alone, in a "Show to class" view.
  - Put the key behind a "Show instructor key" tap that hides itself again.
  - Never draw the key on the screen that holds the big code.
- **Effort:** S.

### R3.4-04 · Medium · Stats numbers with a huge scale: 136 bytes stored, 98 KB returned per row
- **Location:** migration line 168 (`stats_ok` accepts any numeric from 0 to 100,000) and lines 254-258 (`jsonb_agg` of the stored stats).
- **Reproduction** (`amp.sql`):
  - `{"wait":0e-16383, "lwbs":0e-16383, ... six keys}` passes `stats_ok`. It is stored in 136 bytes and printed as 98,376 characters, because numeric keeps 16,383 zero decimals.
  - 300 such rows from two networks take 40 kB on disk. **Every** `cb_class_read` of that class then returns **28 MB** and costs 149 ms of database time.
  - In Chrome with the server stubbed, the crafted 300-row class took 6-8 s to show, against 0.2-0.9 s for a normal one. One run at 6× CPU throttle hit the 8-second timeout and showed nothing.
  - Anyone with the class code can do this.
  - Caveat: PostgREST hands the body to `json_to_record`, so the number text should reach `numeric_in` as written. I couldn't run a real PostgREST here.
- **Fix:** In `stats_ok`, require `(e.value #>> '{}') ~ '^[0-9]{1,6}$'`, or rebuild the stats server-side as `jsonb_build_object(k, round(v)::int)`.
- **Effort:** S.

### R3.4-05 · Medium · One student with the code fills the class in a minute, and the cleanup takes the instructor three hours
- **Location:** migration line 230 (300 per class) and line 268 (deletes limited to 120 an hour per network).
- **Reproduction:**
  - 200 calls from school Wi-Fi plus 100 from a phone hotspot fill the class. Each network's limit is per hour, not per second.
  - Every real student then gets "This class already has 300 results."
  - The junk can carry real classmates' names. Nothing marks a row as coming from one sender.
  - Deleting one row is limited to 120 an hour from the instructor's network, and each takes two taps, so 300 junk rows need three hours. Delete all also wipes the real results, and the student refills the class.
  - The README admits fake results. It doesn't mention the lockout.
- **Fix:**
  - Store the network hash on each result, so an instructor can delete everything from one sender.
  - Don't count keyed deletes against the limit.
  - Cap results per class per network per hour.
- **Effort:** M.

### R3.4-06 · Medium · Per-network limits treat a campus as one person, and refused requests count
- **Location:** migration lines 197, 217, 250, 268, and `allow()` lines 117-126. In `cb_submit`, `allow()` runs before validation.
- **Reproduction:**
  - In `privacy_test.sql` (lines 131-135), the 201st submit and then an invalid name are both refused with `busy`.
  - So 200 invalid calls (no registered code needed) from one student's laptop block the whole classroom's Send for an hour.
  - A campus NAT shares 200 results, 20 new codes and 120 reads an hour.
  - Every level tap registers a code: twelve taps in `eight.py` used twelve of the network's twenty. A faculty workshop on one Wi-Fi runs out.
- **Fix:**
  - Count invalid or unknown calls in their own, larger bucket.
  - Limit submits per class rather than per network.
  - Register a code only when the instructor says "Use this code".
- **Effort:** S-M.

### R3.4-07 · Medium · Rate-limit identity is whichever header comes first, and nothing shows that the gateway sets it
- **Location:** migration lines 82-104 (`codeblack.client_ip`); `privacy_test.sql` lines 157-158.
- **Reproduction** (`hdr.sql`):
  - The leftmost `x-forwarded-for` entry wins: `"6.6.6.1, 198.51.100.9"` counts as 6.6.6.1.
  - Any string is a bucket: `"anything-at-all"` is accepted.
  - `::ffff:6.6.6.5`, `::FFFF:6.6.6.5`, `0:0:0:0:0:ffff:606:605` and `6.6.6.5` are four buckets for one address.
  - Each IPv6 /64 is its own bucket, so a free /48 gives 65,536 of them.
  - Whether Supabase's edge overwrites client-supplied `cf-connecting-ip`, `x-real-ip` and `x-forwarded-for` decides whether every limit means anything. No test checks it. The local test even asserts that a forged `cf-connecting-ip` wins.
- **Fix:**
  - Run once, from a machine that can reach the project: 121 `cb_class_read` calls, each with a different forged header. If the 121st isn't `busy`, the limits are void.
  - Read only the header the gateway is documented to set, and canonicalise it (cast to `inet`, unmap `::ffff:`).
  - Also count IPv6 by /48.
- **Effort:** S.

### R3.4-08 · Medium · A lost reply to `cb_class_new` loses the key, and Try again silently swaps the code
- **Location:** `src/ui.js:2047-2057` (`cbRegister`); migration lines 192-206.
- **Reproduction:**
  - While registration is in flight, Copy, Share and Play it already work.
  - If the reply is lost after the server committed (the 8 s timeout), the sheet says "Class results are off" and offers Try again.
  - Try again gets `taken`, because the first call registered the code. The client then makes a different code, for a different shift, and says nothing. The `taken` swap itself is already exercised in `class_test.py`.
  - If the first code is on the board, students play a registered class whose key nobody has. Their results are unreadable for 30 days, and the code can't be registered again.
- **Fix:**
  - Have the client make the key (`crypto.getRandomValues`, 80 bits) and send it.
  - A retry with the same code and key then returns ok, which makes registration idempotent.
  - Say so when the code changes.
- **Effort:** S.

### R3.4-09 · Medium · On a shared computer, a typed key stays with no Forget, and older codes become unreachable
- **Location:** `src/ui.js:2501-2514` (`cbShow` saves a typed key), `src/ui.js:2083` (`mine.slice(0, 8)`), `src/ui.js:2041-2046`.
- **Reproduction:**
  - `class_test.py` itself checks the save: "and is then saved on that device too".
  - `probe.py`: the class sheet has no Forget, Remove or "not my device" control.
  - The lecture-hall PC keeps one-tap access to every name for 30 days, for whoever sits down next.
  - `eight.py`: twelve level taps registered twelve classes and stored twelve keys, but only eight buttons show. The first four are unreachable even on that device: their keys are stored but never shown again.
- **Fix:**
  - Add "Remember on this device", off by default for typed keys.
  - Add a Forget button and a Show key button per code.
  - List every live code.
- **Effort:** S.

### R3.4-10 · Medium · A code made two releases ago can't be typed in, while its class lives 30 days
- **Location:** `src/ui.js:2503` (`cbShow` runs `E.readCode`); `PAST_V` holds one entry.
- **Reproduction:**
  - A Node script made 2,000 codes on v0.31.0 and typed them into a v0.33.0 client. **1,945 were refused**.
  - Releases ship days apart: v0.28.0 to v0.31.0 took two days.
  - The server accepts any six characters. Only the client's checksum blocks an instructor on a new device from their own live class.
- **Fix:** For reading results, accept any well-formed six characters and skip the version checksum.
- **Effort:** S.

### R3.4-11 · Medium · Send does nothing, silently, when the report can't be stored
- **Location:**
  - `src/ui.js:2857`: `store()` never throws, so `kept` is always true and the comment "a full or blocked store" is wrong.
  - `src/ui.js:2481`: `lastReport()` returns null or the previous report, and `cbSend` returns without a word.
- **Reproduction:** `probe3.py` and `probe.py`. With `setItem` throwing `QuotaExceededError`, or `localStorage` blocked (cookies off, some managed Chromebooks), the Send box shows. Tapping it sends **0 requests** and shows nothing.
- **Note:** This predates Phase 2. Phase 2 rewrote `cbSend` and made the stored report the source of truth for the cid and for `sent`.
- **Fix:** Keep the report in memory and send from it. Have `store()` report failure.
- **Effort:** S.

### R3.4-12 · Low · The expensive argument clean-up runs before the rate limit
- **Location:** the `declare` initialisers (`norm_code`, `clean_name`) at migration lines 195, 215, 248 and 266.
- **Reproduction** (`pre.sql`):
  - A network already over its limit costs 1.8 ms with normal arguments and **4,896 ms** with 10 MB arguments, and still gets `busy`.
  - `norm_code` takes 1.9 s on 10 MB and `clean_name` 2.9 s.
  - If the gateway accepts big bodies, a throttled caller still burns seconds of shared CPU on every call.
- **Fix:** Check `octet_length` of every text argument (64 or less) first, then `allow()`, then clean.
- **Effort:** S.

### R3.4-13 · Low · Count-then-insert races let the caps overshoot
- **Reproduction** (pgbench on my cluster):
  - 40 concurrent clients on one network ended with **237** results against a limit of 200.
  - 50 networks racing ended with **322** in one class against a cap of 300.
- **Fix:** `pg_advisory_xact_lock(hashtext(v_code))` before the count, or counter rows.
- **Effort:** S.

### R3.4-14 · Low · Invisible names and phone numbers get through, though the README says they don't
- **Reproduction** (`names.sql`, plus Node with the client rule):
  - U+3164 (Hangul filler) passes **both** rules. It was sent from the real UI as `'ㅤㅤㅤ'` and the game said "Sent".
  - The server accepts fullwidth, Arabic-Indic and Devanagari digits, such as `５５５-１２３４`, plus `Ⅷ`, math-bold letters and Cyrillic look-alikes.
  - These claims are false at the API: "letters only, so an email or phone number is refused" (README v0.31.0), and "No digits or @, so an email or phone number is refused" (migration header).
- **Fix:**
  - Normalize to NFC on the server.
  - Refuse U+115F, U+1160, U+3164 and U+FFA0, and any character in Unicode category Nd.
  - Match the client to it.
- **Effort:** S.

### R3.4-15 · Low · Error messages blame the network for server faults
- **Location:** `src/ui.js:2027` (`cbNet`), `src/ui.js:2028`.
- **Reproduction** (`probe.py` section 4):
  - A 404 (migration not applied), a 500, or a 200 with an HTML body all say "Couldn't reach the server. Check the connection".
  - A global cap says "Too many requests from this network".
- **Fix:** Separate the cases by HTTP status and by error code.
- **Effort:** S.

### R3.4-16 · Low · `db_live.js` runs after the deploy, has a check that passes on today's open database, and can be made to fail by anyone
- **Location:** `pages.yml` lines 90-93 (after `deploy-pages`); `test/db_live.js` lines 21-22 and 33-34.
- **What's wrong:**
  - A missing migration is found only after the site has switched to v0.31.0.
  - `oldTable` accepts 401, which is what today's database answers, because anon never had SELECT. That check is vacuous.
  - The script never probes the real R3-01 hole, the anon insert grant. A POST of an invalid row would answer 400 while the hole is open and 404 once it's gone.
  - It probes `ZZZ-ZZZ`, which anyone can register: the server doesn't check checksums. A stranger's registration turns the deploy red and writes a "Probe" result into their class.
  - It has no per-request timeout.
- **Fix:**
  - Run it in the build job, before the upload.
  - Require 404 for both the old table and an insert into it.
  - Probe with a code the game can never make, and add a fetch timeout.
- **Effort:** S.

### R3.4-17 · Low · The privacy wording overstates what holds, and the 30-day promise is unmonitored
- **Location:** `src/ui.js:2727-2728` and the Send box at `src/ui.js:2074-2076`.
- **What's wrong:**
  - "Only the instructor who made the code can read them" and "Only they can see it" leave out the developer, who owns the database, and Supabase.
  - There is no data controller and no contact.
  - "A scrambled form of the address" sits next to its salt in the same database, and the salt never rotates. Every IPv4 address in a day's `hits` can be recovered by brute force: 2^32 HMACs is about 20 CPU-core-minutes at the roughly 7 million SHA-256 a second this container does.
  - Deletion after 30 days depends on a pg_cron job that nothing checks. `db_live.js` can't see it.
- **Fix:**
  - Name the controller and a contact. Say that the developer can read the data.
  - Rotate the salt daily.
  - Add a `cb_health()` that reports whether any class is older than 31 days, and check it in `db_live.js`.
- **Effort:** S.

### R3.4-18 · Low · A malformed `oc-ckeys` entry freezes the game
- **Location:** `src/ui.js:2083` (`keys[c].exp`).
- **Reproduction** (`junk.py`): with `{"ABC-DEF":null}` stored, opening Class code throws "Cannot read properties of null (reading 'exp')". The sheet is empty and the frame loop dies (R3-04). It needs a corrupted store.
- **Fix:** Have `cbKeys()` drop entries that aren't objects.
- **Effort:** S.

### R3.4-19 · Low · The server stores the class version and never checks it
- **Location:** `classes.ver` (migration line 42) is never read. `cb_submit` (lines 211-241) doesn't compare `p_ver`.
- **What's wrong:**
  - A late send of an old saved report, after its class expired and another instructor re-registered the same six characters, lands in that stranger's class, from any version.
  - Codes the game can never make can be squatted.
- **Fix:** Refuse a result whose version differs from the class's version.
- **Effort:** S.

### R3.4-20 · Low · R3.2-07 was listed for Phase 2 and dropped without a word
- **Location:** `docs/audit/round2/STATUS.md` line 20; commit `c941ede`.
- **What's wrong:** `OC.CODE_Q`, `toArrest`, `botStep` and an editable `OC.G` all still ship. Scores now feed an instructor's table, and these are the cheapest way to send a 100.
- **Fix:** Do it, or move it in STATUS with a reason.
- **Effort:** S.

### R3.4-21 · Low · Gaps in the database tests
- **What's missing:**
  - No test of the migration guard. I tested it: it stops correctly.
  - No concurrency test.
  - No test of the number format.
  - Few unicode name cases.
- **Also:**
  - CI uses the runner's glibc, and the live server's may differ, so `[[:alpha:]]` can classify letters differently.
  - The tests run the definer functions as a superuser. I re-ran both migrations as a non-superuser owner and they work, so this is untested rather than broken.
- **Fix:** Add those tests.
- **Effort:** S.

### R3.4-22 · Low · `audit_shots.py` registers real classes in production
- **Location:** `test/audit_shots.py:62`.
- **What's wrong:** `act('codeMake', 'med')` runs with no `cb_class_new` route, at four sizes a run. On a machine with network access, each run creates four live classes and uses rate-limit budget.
- **Fix:** Route `**/rest/v1/**` at the context level and abort anything unrouted.
- **Effort:** S.

### R3.4-23 · Nitpick
- **The empty `search_path` searches pg_temp first for type names.** After `create domain pg_temp.inet as text`, `codeblack.client_ip()` stopped cutting IPv6 to /64 (shown in `tmp.sql`). A session needs SQL access for this, which PostgREST doesn't give. Use `pg_catalog, pg_temp`, or qualify casts as `pg_catalog.inet`. The tests treat `search_path=""` as the safety property.
- **The migration guard counts, then drops, without a lock.** A row inserted in between is lost; anyone can insert into the live table today. Take `lock table public.cb_results in access exclusive mode` first.
- **`cb_class_read` returns the global sequential `id`,** so an instructor can see how many results the whole service holds.
- **`copyText` ignores the `writeText` promise,** so "Copied the instructor key" shows even when the write is rejected. The key is the one string that can't be recovered.
- **The delete column of the results table is off-screen at 320-390 px:** the table is 380 px wide in a 289-333 px box.
- **The deploy's sparse checkout lists files in cone mode.** It works only because cone mode pulls every top-level file of `src/` and `test/`.
- **`run.sh` needs bash 4.4 or newer:** `"${as[@]}"` on an empty array under `set -u` fails in macOS's bash 3.2. It also needs `runuser` and GNU tools.
- **The client counts UTF-16 units, the server code points,** so "the same rule as codeblack.clean_name" (`src/ui.js:2029`) isn't quite true.
- **`aria-label` reads the key aloud,** one character at a time.

## 4. Coverage

**Read line by line:**
- Both migrations, `stubs.sql`, `privacy_test.sql`, `run.sh` and `supabase/README.md`.
- `test/db_live.js` and the `tests.yml` and `pages.yml` changes.
- The `src/ui.js` and `src/style.css` diff, plus the surrounding `store`, `lastReport`, `showReport`, `copyText`, `codeText` and gate code.
- `test/class_test.py` and `test/audit_shots.py`.

**Ran:**
- `npm run db:test`: 119 ok.
- My own cluster (stubs, baseline, migration):
  - unicode names;
  - numeric amplification;
  - growth and cost of the hits table, at 1M rows, before and after VACUUM;
  - header parsing;
  - the 50,000-class cap;
  - pgbench races on the per-network limit and the per-class cap;
  - argument cost before the limit;
  - temp-schema type shadowing;
  - the guard with a row present;
  - the baseline's open insert and `cb_class` read;
  - both migrations applied as a non-superuser owner.
- The deploy's sparse checkout, emulated with git 2.43, and the `db_live.js` regex against it.
- Playwright in Chrome, from `file://` with service workers blocked:
  - the key's placement at 390 and 1440 px;
  - Forget controls;
  - Send with storage full and with storage blocked;
  - junk, 404, 500, `[]` and hung replies;
  - cid stability;
  - an invisible name;
  - a 29.6 MB read at 1×, 4× and 6× CPU throttle;
  - widths of 320, 360 and 390 px;
  - malformed `oc-ckeys`;
  - twelve code registrations.
- Clipboard behaviour, and SHA-256 speed with `openssl speed`.

**Couldn't check:**
- Supabase's real gateway: which address headers it sets or strips, the request-size limit, and the anon statement timeout.
- PostgREST's handling of `0e-16383` end to end.
- Whether the API answers over IPv6.
- pg_cron on the live project.
- The live database itself, by the rules.
- WebKit and real phones.

## 5. What I'd keep

- A private schema with no grants, four `SECURITY DEFINER` entry points, schema-qualified everything, and helpers that aren't definers.
- An 80-bit key from `gen_random_bytes`, stored only as SHA-256. A wrong key and an unknown code get the same answer.
- An idempotent cid with `on conflict do nothing`, and `dup` checked before the cap.
- Server-side validation of every field. The stats check uses `CASE`, so `jsonb_each` never sees a non-object.
- The migration guard against existing rows, a transaction, and an idempotent re-run that is tested twice in CI.
- A local Postgres test suite that runs in CI, with stubs that copy Supabase's default grants.
- On the client: an 8-second timeout with an old-Safari fallback, escaped output everywhere (the hostile row in `class_test.py` stays text), and the send button off while a send is out.
