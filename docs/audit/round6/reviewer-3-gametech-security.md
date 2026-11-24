# Reviewer 3, round 6: game tech, security and privacy (the round-5 fixes)

Branch `claude/sleepy-rubin-jot35n`, v0.31.0, HEAD `6328cdf`. The fixes under review are `git diff 7cb5613..6328cdf -- src supabase test .github build.js`. Reviewed Nov 24, 2026.

**How I tested.**
- **Database:** I attacked the migration on a throwaway PostgreSQL 16 cluster (C.UTF-8, glibc 2.39) with the stubs, the baseline and the migration loaded. It lived in a `mktemp` folder, because the scratchpad's parent folder isn't readable by the `postgres` user. I deleted it afterwards. Nothing reached supabase.co or edcodeblack.com.
- **Shipped suites:** `npm run db:test` passed (158 ok). `test/class_test.py` passed (67 ok); it rewrote its own gitignored screenshots in `test/shots/`.
- **Client:** I drove the committed `index.html` in Chrome 153 through Playwright, with every `**/rest/v1/**` call stubbed, held or aborted.
- **Scratch:** scripts, outputs and screenshots are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round6/r3/`.

## 0. Round-5 status

| Item | Status | Evidence |
|---|---|---|
| R3.5-01 keys lost on day 7 | **Fixed** | `cbKeys` keeps a key until `t` + 30 days. `class_test` lists a 20-day-old key. One edge case is new: R3.6-12. |
| R3.5-02 backstop above the quota | **Fixed** | The backstops are now 100,000 classes and 300,000 results, and the answer is `full`. With `reltuples` forced to 100,001, `cb_class_new` answered `{"error": "full"}`. The kill-switch side of this is R3.6-07. |
| R3.5-03 taken code shown | **Partly fixed** | Five `taken` answers now end with "No class code was made" and no code on screen (`probe_f` F1). But `busy`, `full`, a network failure and a 5xx still show a code nobody checked (R3.6-06). |
| R3.5-04 name pre-fills for the next student | **Fixed** | `U.cbName` is cleared in `start()`, in `showReport()` and after an ok. `class_test` checks this. |
| R3.5-05 rollback blocked | **Fixed** | `hj.db >= LATEST`. |
| R3.5-06 name rules | **Partly fixed** | In the middle of a name, the two sides now agree on every assigned Unicode 15.1 character. Still wrong: names that start with a mark, invisible marks, and Unicode 16 and 17 letters (R3.6-10). |
| R3.5-07 focus lost after a refusal | **Fixed** | `cbRedraw(focus)` restores it. Checked in `class_test` and `probe_s` I1. It now also takes focus back from wherever the student moved it (nitpick). |
| R3.5-08 stale stored summary | **Fixed** | `lastReport()` returns `U.lastRep \|\| d`. |
| R3.5-09 Copy table writes formulas raw | **Fixed** | Both exports use `cbCell` (`probe_x`). It converts a leading tab to a space before checking for a formula (nitpick). |
| R3.5-10 live-code oracles | **Partly fixed** | A version mismatch now answers `unknown`. `taken` stays, by decision. A send that carries the public version still answers `ok` for a live code (it writes a row). |
| R3.5-11 raw addresses in `cb_hits` | **Fixed** | The migration deletes them, and `privacy_test` checks that they're gone. |
| R3.5-12 `db_live.js` fails by itself | **Fixed** | The probe has its own bucket, the check waits when the minute is 58 or later, and a `busy` answer says when to re-run. Slow calls can still cross the hour (nitpick). |
| R3.5-13 nitpicks | **Partly fixed** | `exp` parsing is gone. The contract now lists the errors, but not the response shapes. Most of the rest is still open (R3.6-13). |

**Totals:** 9 fixed, 4 partly fixed, 0 still open, 0 worse.

## 1. Verdict

**Not ready for `main`.** The database is close: atomic counters, generated Unicode tables that really match the client in the middle of a name, and a version check that no longer gives away live codes. Some of the round-5 fixes broke other things:

- **The deploy:** the permission change very likely makes the next push to `main` fail at `actions/configure-pages`, before anything is published (R3.6-01).
- **The instructor's key form:** the `morph()` typing hold breaks it. Enter shows nothing, and the button still on screen then throws away the results and the typed key (R3.6-02).
- **Shared computers:** Forget can be undone by a request still in flight, and a typed key stays in plain text for the next person (R3.6-03, R3.6-04).
- **Rate limits:** every limit splits into about five buckets per address, depending on the session time zone (R3.6-05).
- **Squatting:** the "never shows a taken code" fix covers only one answer, and `full`, which an attacker can force, still shows the code (R3.6-06, R3.6-07).

## 2. Score

**6 / 10** (round 5: 6). The server side gained. The client and the deploy workflow lost about as much through new regressions.

## 3. New findings, worst first

### R3.6-01 · High · The deploy's build job can no longer run `actions/configure-pages`, so the release very likely fails before it publishes
- **Location:**
  - `.github/workflows/pages.yml` line 16: the workflow-wide `permissions: contents: read`.
  - Line 52: `actions/configure-pages@v5` runs in the `build` job, which has no `permissions:` of its own.
- **Evidence** (read, not run; Actions can't run here):
  - configure-pages v5 (`src/api-client.js`, read from GitHub) calls `octokit.rest.repos.getPages` with `github.token`. `enablement` defaults to `false`, so a failed call logs "Get Pages site failed" and throws.
  - GitHub's REST docs list the Pages (read) permission for "Get a GitHub Pages site". Round 5 moved `pages: write` to the deploy job only, so the build job's token now has no Pages permission. The repo is private, so the call can't succeed anonymously.
  - v0.30.0 deployed with `pages: write` set for the whole workflow. Nothing runs `pages.yml` before a push to `main`.
- **Impact:** It fails safe: nothing is published. But the release stalls in the "database first" window, while the live v0.30.0 site's Send and Class results are already broken.
- **Fix:** Give the build job `permissions: { contents: read, pages: read }`, or delete the configure-pages step (none of its outputs are used).
- **Effort:** S.

### R3.6-02 · High · The `morph()` typing hold freezes the whole Class results box: Enter shows nothing, then the stale button throws the results away
- **Location:**
  - `src/ui.js` `morph` (line 16): a top-level section that contains the focused box isn't replaced, and it stays that way until focus leaves.
  - The code box, the key box, the error line, "Loading…" and the results list all sit in one top-level section, `.cb-res`.
  - `bind()` line 3046: Enter in either box runs `ACT.cbShow(); render()`, and focus stays in the box.
- **Reproduction** (`probe_a.py` D, `probe_d.py` E, `e1-results-replaced-by-error.png`):
  1. Class code, then Open with an instructor key. Type the code and the key, then press Enter (the phone keyboard's Go).
  2. The read succeeds: `U.cbList.rows` has 1 row and `U.cbOpen` is false. But while the box has focus, the screen still shows the form and no rows, 3 seconds later too. With a wrong key, the error is in state but not on screen.
  3. Tap the Show results button that is still on screen. `cbShow()` runs with `U.cbForm` already null and says "A class code is six letters and numbers, like ABC-DEF." The loaded results are dropped, and the typed code and key are gone. Only one read was ever sent.
- **Why it matters:** This is the round-5 typing fix (R4.5-01) breaking the form it was meant to help. Enter is how most people submit a form, on a phone or a desktop.
- **Fix:**
  - Hold only the focused element itself, not its whole section. For example, patch the section's other children, or match the focused box by id.
  - Blur the box when Enter submits.
  - Add a `class_test` step: Enter in the key box shows the results.
- **Effort:** S-M.

### R3.6-03 · Medium · Forget and Close results don't cancel a request in flight, so a forgotten key comes back
- **Location:**
  - `ACT.keyForgetGo` (line 2571) and `ACT.cbClose` (line 2621) clear the state but don't bump `U.cbSeq` or `U.regSeq`.
  - The answer handlers in `cbShow` and `cbRegister` then write the state back.
  - `ACT.classCode` (line 2557) only clears lists that were opened with a typed key.
- **Reproduction:**
  - **A read in flight** (`probe_a.py` A, `a2-forgotten-but-shown.png`):
    1. Tap Results on a saved code.
    2. While the read is out, tap Forget and confirm. Storage is now empty.
    3. The read answers. The list shows "Priya K", `U.cbList.key` holds the key, and the Delete buttons work.
    4. Close the sheet and open Class code again, as the next person on a shared computer would. The names and the Delete buttons are still there.
  - **A registration in flight** (`probe_r.py`): make a code, then Forget it while the registration is out. When the server answers `ok`, the key is written back to `oc-ckeys` and the code shows again. After a reload, it's still listed.
  - **Close results** (`probe_a.py` B): tap Refresh, then Close results. The answer reopens the list.
- **Window:** As long as a call is out, which is up to 8 s on a bad network.
- **Fix:**
  - Bump both sequence numbers in Forget, in Close results, and when the sheet closes.
  - In the answer handlers, drop any answer for a code that is no longer in `cbKeys()`, unless it was typed and is still wanted.
- **Effort:** S.

### R3.6-04 · Medium · A typed instructor key stays in the form, in plain text, for the next person
- **Location:**
  - `ACT.classCode` (line 2557) resets `showKey`, `cbForget` and lists opened with a typed key, but not `U.cbOpen` or `U.cbForm`.
  - `cbShow` clears the form only after a successful read.
- **Reproduction** (`probe_a.py` C, `c1-key-left-in-form.png`):
  1. Type a code and a key, then tap Show results.
  2. Make the call fail: the network fails, or the server answers `key`. Closing the sheet without submitting leaves the key the same way.
  3. Open Class code again. The form is open, with `7K2M9QXH4V1R8ZTB` in a `type="text"` box.
- **Why it matters:** STATUS (R4.5-04) says reopening Class code "hides any key left showing". This key isn't hidden.
- **Fix:** When the class sheet opens fresh, set `U.cbOpen = false` and `U.cbForm = null`.
- **Effort:** S.

### R3.6-05 · Medium · Every rate limit splits by the caller's session time zone: about five buckets per address
- **Location:** The migration.
  - Line 149: `date_trunc('hour', now())` in `codeblack.allow`.
  - Lines 133–136: `current_date` in `codeblack.who`, which picks the daily salt.
  - Both follow the session's `TimeZone`, and neither function pins it.
- **Reproduction** (`tz.sql`; one address, 198.51.100.7; at 22:00 UTC):
  - 31 `cb_health(true)` calls in UTC: the 31st was refused (`busy`).
  - Then 30 calls each under `Asia/Kolkata`, `Asia/Kathmandu`, `Pacific/Kiritimati` and `America/St_Johns`: none was refused.
  - `Etc/GMT+12` shared the UTC bucket and was refused.
  - That's five buckets of 30 for one address.
  - Across every zone in `pg_timezone_names`, in 5-minute steps over a day, there are 4 to 6 buckets at any moment (5.3 on average). Zones already on tomorrow's date get tomorrow's salt, so a different network hash. Zones at :30 and :45 get a different hour start.
- **How a caller sets it:** PostgREST 12 and later documents a `Prefer: timezone=<IANA name>` request header that sets the time zone for that request. I couldn't send it to Supabase's gateway from here.
- **Impact:**
  - Every limit is about five times higher for anyone who adds one header: 60 codes, 600 sends, 300 reads and 120 wrong keys an hour.
  - It divides the cost of R3.6-07 by five.
  - The deploy's forged-header probe can't see it.
- **Fix:**
  - Add `set timezone to 'UTC'` to `allow`, `who` and `tidy`, or use `date_trunc('hour', now(), 'UTC')` and `(now() at time zone 'UTC')::date`.
  - Add a `privacy_test` check that runs under two time zones.
- **Effort:** S.

### R3.6-06 · Medium · "Never shows a taken code" covers only the answer `taken`; `full`, which a squatter can force, still shows his code
- **Location:** `cbRegister` (line 2075).
  - The `else` branch (`busy`, `full`, anything unknown) sets `U.codeMade = code`.
  - So does `.catch` (network, timeout, 5xx).
  - The README now says the game "never shows a taken code", and STATUS says the same.
- **Reproduction** (`probe_f.py` F2, F3):
  - `busy`, `full`, an aborted call and an HTTP 503 each show the code (for example `RBX-G8M`). It comes with Copy, Play it, and "has a Send button that sends you the result". The server never checked whether another class owns it.
  - Try again, then `taken`, hides the code. By then it may already be on the projector.
- **The attack chain:**
  1. The class backstop (R3.6-07) answers `full` to every registration.
  2. An attacker fills it with codes for the most common setup: 100,000 of the 131,072 charge nurse, Manic Monday, no-scenario codes.
  3. About 3 in 4 instructors who pick that setup are then shown a code he owns.
  4. Students play it and tap Send. The game says "Sent to the instructor", and their names go to him.
- **Fix:** On any answer except `ok`, don't show a shareable code. Say that results couldn't be set up, and offer Try again. Alternatively, disable Copy, Share and Play it until a retry answers `ok`.
- **Effort:** S.

### R3.6-07 · Medium · The smaller backstops are a cheaper, longer global kill switch, and nothing stops or reports one
- **Location:** The migration.
  - Line 247: more than 100,000 classes answers `full`.
  - Line 290: more than 300,000 results answers `full`.
  - Line 61: a class nobody has sent to now lasts 14 days, not 7.
- **What changed:** Lowering them was right for the quota (my R3.5-02). But they apply to everyone, and the only thing between one attacker and them is the per-address hourly limit.
  - **Classes:**
    - 100,000 at 60 an hour is about 1,670 network-hours.
    - From one IPv6 /48 (256 buckets of /56), that's about 6.5 hours, if the API answers over IPv6 (I couldn't check). With R3.6-05, it's about a fifth of that.
    - In round 5 this backstop was 300,000.
    - The junk now lasts 14 days, not 7.
  - **Results:**
    - 300,000 at 600 an hour is 500 network-hours: about 2 hours from a /48, or under half an hour with R3.6-05.
    - The junk lasts 30 days. The attacker holds his classes' keys, so he can delete and refill.
  - **Effect:** Until the junk expires, every instructor's registration or every student's Send answers `full`.
  - **Nobody finds out:** `cb_health` doesn't report table sizes or a tripped backstop, and `db_live` runs only at deploy.
- **Fix:**
  - Add a per-address daily cap (for example 200 codes and 3,000 sends a day), so one /48 can't reach the backstop.
  - Report both `reltuples` and `pg_total_relation_size` in `cb_health`, and fail the deploy check past half.
  - When the class backstop trips, delete the oldest classes that have no results instead of refusing everyone.
- **Effort:** M.

### R3.6-08 · Low · The "source not published" check now runs before the new version is confirmed live
- **Location:** `pages.yml` lines 96–97.
  - `want 404` returns at the first 404.
  - With a CNAME set, `page_url` is the custom domain, so only one site is checked.
- **The problem:**
  - The 404 checks run first, so they can pass against the previous deployment, which already answers 404 for these paths, before the new one is served.
  - The comment's own reason, that the site is slow to update, is exactly that window.
  - So the check meant to catch a packaging mistake in this release can end up testing the last release.
- **Fix:** Wait (bounded) for `index.html` with the new version first, then run the 404 checks. Or run the 404 checks again after the 200 checks.
- **Effort:** S.

### R3.6-09 · Low · `cb_health`'s `public` flag calls IPv6 loopback public, and can't see the failure it's there for
- **Location:** Migration lines 344–360. `client_ip()` masks IPv6 to its /56 before the check, so `::1` becomes `::/56`, which isn't `<<= ::1/128`.
- **Reproduction** (local, via `cf-connecting-ip`): `::1` reads as `::/56` with `public` true. These are also called public:
  - `::10.0.0.1`
  - `0.0.0.0`
  - `255.255.255.255`
  - `224.0.0.1`
  - `192.0.2.10`
  - `198.18.0.1`
  - `64:ff9b::a00:1` (NAT64 for 10.0.0.1)
  - `2001:db8::1`
- **The bigger gap:** A public address that every caller shares passes, for example the gateway's own outgoing address. That's the realistic way everyone ends up in one bucket.
- **Fix:**
  - Check the address before masking it, against IANA's special-purpose lists.
  - Better: have `db_live` send the runner's own public address, and have `cb_health` say only whether it matches what it read.
- **Effort:** S.

### R3.6-10 · Low · Names: invisible marks, circles made with a combining mark, mark-first names, newer letters
- **Location:** `codeblack.clean_name` (line 208); `cbClean` and `CB_BADCH` (line 2046).
- **Method:** I ran every code point (first, middle and alone) through `codeblack.clean_name` (PostgreSQL 16, glibc 2.39) and `OCUI.cbClean` (Chrome 153): `names_client.py`, `cmp.py`, `dicp.js`.
- **What I found:**
  - **The middle of a name:** both sides now agree on every assigned Unicode 15.1 character.
  - **Invisible marks:** both accept 263 of them: U+034F (combining grapheme joiner), U+17B4–17B5, U+180B–180D, U+180F, U+FE00–FE0F and U+E0100–E01EF. "Sam" plus U+034F is listed as a second "Sam", without "(2nd result)" (`probe_z.py`).
  - **Enclosing marks:** both accept 13 of them. `S⃝a⃝m⃝` (U+20DD) is exactly the circled-letter name the rule says it refuses.
  - **Mark-first names:** the server accepts a name that starts with, or is only, a combining mark: 1,295 code points, for example U+05B0 on its own. Its `[[:alpha:]]` is glibc's Alphabetic, which includes vowel signs. The client refuses these.
  - **Newer letters:** the client accepts about 8,900 Unicode 16 and 17 characters that the server's glibc doesn't know (for example U+1C89, U+A7CB, Garay, Kirat Rai, Ol Onal). The student is told "The server refused that name". The contract's fixed list can't catch this.
- **Fix:**
  - Refuse `\p{Default_Ignorable_Code_Point}` and `\p{Me}` on both sides.
  - On the server, the first character must be alphabetic and not in the marks list.
  - Have the client either use the server's Unicode version or explain the refusal.
- **Effort:** S.

### R3.6-11 · Low · Making a code can erase this device's key to an earlier live class
- **Location:** `cbRegister` (line 2075). `cbKeySave(code, { k: key, t, p: 1 })` overwrites any saved entry for the same code before the server answers. A `taken` answer then deletes the entry.
- **Reproduction** (`probe_k.py`):
  1. The key `AAAABBBBCCCCDDDD` is saved for `062-88Q`.
  2. Making a new code draws the same seed, and the server answers `taken` (it's the device's own earlier class).
  3. Storage now holds only the new code. The earlier class's results can't be reached from this device.
- **Odds:** For each new code, the number of this instructor's saved codes for that setup, out of 131,072. Rare, and silent.
- **Fix:** If the drawn code is already in `cbKeys()`, draw another before registering.
- **Effort:** S.

### R3.6-12 · Low · "Set up results" on a deleted class: the device forgets the key before the class ends
- **Location:**
  - `cbRegister` keeps the stored `t`.
  - `cb_class_new` makes a new class, with a new `created_at`, once the old one has been deleted.
  - `cbKeys` drops a key at `t` + 30 days.
- **Example:**
  1. A registration is never confirmed on day 0.
  2. With no results, the server deletes the class on day 14.
  3. Set up results on day 20 makes a new class. It lives to day 50 once a result arrives.
  4. The device drops the key on day 30, while the box says "deleted 30 days from today".
- **Fix:** Return `created_at` from `cb_class_new`, and store it as `t`.
- **Effort:** S.

### R3.6-13 · Nitpicks
- **Ghost codes** (round 5) are now labelled "results not set up yet", though the server has them (`probe_f` G1).
- **morph's hold is by position:**
  - Enter in Play a code leaves the focused box inside the closed sheet: `#ccIn` is still in `#sheet` (`probe_s` S0).
  - If a sheet's structure changes while a box has focus, the old section keeps its slot in the new sheet.
  - While a held section's markup keeps changing, the whole sheet is re-parsed every frame, including a list of up to 500 rows.
- **Focus restore** pulls focus back to the name box even when the student moved on during the wait (`probe_s` I1).
- **A real version mismatch** now reads "isn't set up for class results, or its class has ended" (`probe_s` I2).
- **`clean_stats` with 16 keys:** 5-digit values in 14 keys make 434 bytes, over the column's `< 400` check. The answer is a raw check-constraint error that names the constraint, instead of `invalid`. No real client sends values that large.
- **`cbCell`:**
  - It turns a leading tab into a space before it checks for a formula: `\t=cmd|x` comes out as ` =cmd|x`, with no guard. Round 5's CSV guard caught a leading tab.
  - The full-width `＝` isn't guarded.
  - The server's name rule makes both defence in depth only.
- **"Delete all N results"** deletes everything on the server, including results that arrived after the list was loaded.
- **The minute-58 wait** doesn't cover slow calls: 31 calls at 4 s each, started at 57:59, cross the hour and fail the deploy. That's safe, but it's a false failure.
- **`skip_db_check`** can be ticked on a manual run from any branch. The workflow doesn't check `github.ref`. Only the `github-pages` environment's branch rule, which I couldn't see, stops a feature branch from being published without the database check.
- **The migration doesn't drop the old zero-argument `public.cb_health()`.** A database that ever got an earlier draft keeps it, still executable by anon, and then `rpc/cb_health` called with `{}` is ambiguous.
- **README overclaims:**
  - "never shows a taken code" (R3.6-06).
  - "the answers don't reveal live codes": `taken` stays, and a send with the public version still answers `ok`.
  - "no invisible fillers" (R3.6-10).
- **Round-5 nitpicks still open:**
  - An expired class that hasn't been deleted yet re-registers as `ok` with an expiry in the past.
  - `fast` has no upper limit: the list shows "999999% sped up" (`probe_x`).
  - The `/56` comment.
  - "letters only" is the message for a name that's too long.
  - `busy` on Refresh throws away the loaded list.
  - Privacy says counters are kept "up to two days".
  - Anyone who reads `db_live.js` can register `ZZZ-ZZZ` with the all-Z key, and every deploy then fails.
  - Copy key now puts the code and the key together into the clipboard history.
- **`lastReport()`** still parses `oc-last-report` on every title-screen frame, even though the copy in memory wins.

## 4. Coverage

**Read:**
- The whole migration and its diff.
- The baseline's `cb_hits` and gate parts.
- `run.sh`, the `privacy_test.sql` diff and `client_call.json`.
- `test/db_live.js`, `pages.yml` and the `tests.yml` diff.
- The configure-pages v5 source.
- The `supabase/README.md` diff.
- In `src/ui.js`, the whole diff, plus:
  - `morph`, `setH` and `bind()`;
  - the class sheet and its actions;
  - `cbRegister`, `cbKeys`, `cbShow`, `cbDel*` and the exports;
  - `cbSend`, `cbRedraw`, `lastReport`, `saveRep`, `unsentGuard` and `showLastReport`;
  - the About privacy text;
  - `esc`, and every new template literal (no XSS found).

**Ran on PostgreSQL 16:**
- Every code point through `clean_name`, three ways.
- Rate buckets under six session time zones, plus bucket counts over all zones for a whole day.
- The `public` flag for 13 addresses.
- The stats size limit.
- The class backstop answer.

**Ran in Chrome** (stubbed server):
- Every code point through `cbClean`.
- Forget and Close results during a read, and Forget during a registration.
- A typed key across reopening the sheet.
- Enter in the key form, then a tap on the stale Show results button.
- `taken`, `busy`, `full`, an aborted call and a 503 on registration, then Try again.
- Ghost codes and Set up results.
- A new code that collides with a saved one.
- Invisible, enclosing and stacked-mark names in the list.
- Copy table and CSV, with hostile names.
- A full class shift, then:
  - Enter in Play a code;
  - focus after a `busy` answer;
  - the `unknown` message;
  - the unsent guard, and reopening the last summary.
- `class_test.py` (67 ok) and `npm run db:test` (158 ok).

**Couldn't check:**
- The live database and gateway, including whether PostgREST honours `Prefer: timezone`, and whether the API answers over IPv6.
- GitHub Actions itself (R3.6-01) and the `github-pages` environment's branch rule.
- WebKit (no Playwright WebKit installed), so whether a hidden, focused box keeps focus there (R3.6-13).
- Real phones and Supabase's live glibc version.

## 5. What I'd keep

- **The generated mark and number tables.** For assigned Unicode 15.1 characters in the middle of a name, the server and the client now give exactly the same answers.
- **The version check:** it answers like an unknown code, and only after the lock and the lookup.
- **Keys kept by creation time,** with a separate "unconfirmed" flag, instead of trusting a guessed expiry.
- **Everything that is already right:**
  - the probe's own bucket;
  - the `busy` and unreachable messages in `db_live`;
  - `>=` for rollbacks;
  - the newer-migration guard, with `run.sh` proving it refuses;
  - the per-job permissions idea (once the build job gets `pages: read`).
- **The exports:** one `cbCell` for both, the caveats in the first row, and no rank.
- **The name box:** cleared in `start()`, in `showReport()` and after a send; and memory preferred over storage for the summary.
- **No XSS:** every new template literal escapes what it interpolates, and every attribute is double-quoted with `esc` escaping `"`.
