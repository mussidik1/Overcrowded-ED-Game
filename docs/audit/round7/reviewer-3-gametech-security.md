# Reviewer 3, round 7: game tech, security and privacy (the round-6 fixes)

Branch `claude/sleepy-rubin-jot35n`, v0.31.0, HEAD `18a71f9`. Under review: `git diff 6328cdf..18a71f9 -- src supabase test tools .github build.js`, and the second migration `supabase/migrations/20261125120000_codeblack_round6.sql`, which is not live yet. Reviewed Nov 24, 2026.

**How I tested.**
- **Database:** I attacked both migrations on a throwaway PostgreSQL 16.15 cluster (C.UTF-8, glibc 2.39), loaded in this order: stubs, baseline, migration 1, migration 2. It lived in a `mktemp` folder under `/tmp`. Nothing reached supabase.co or edcodeblack.com.
- **Shipped suites:**
  - `npm run db:test` passed.
  - `npm test` passed (694 ok).
  - A scratch copy of `test/class_test.py` passed (86 ok). Its screenshot path was moved to scratch, so no project file was written.
- **Client:** I drove the committed `index.html` in Chrome 153 through Playwright, with every `**/rest/v1/**` call stubbed, held or aborted.
- **Scratch:** scripts, outputs and screenshots are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round7/r3/`.

## 0. Round-6 status

| Item | Status | Evidence |
|---|---|---|
| R3.6-01 configure-pages without a Pages permission | **Fixed** (read, not run) | The build job has `pages: read`, and both jobs run only on `refs/heads/main`. |
| R3.6-02 `morph()` froze the key form | **Fixed** | Enter with a wrong key shows the error while the box keeps focus. Enter with the right key shows the list and closes the form (`class_test`). A new focus loss from the recursive `morph` is R3.7-03. |
| R3.6-03 Forget or Close didn't cancel requests in flight | **Fixed** | `probe2` I1: a read answered after Forget shows nothing and saves nothing. I2: a typed read answered after the sheet was reopened is dropped. Close results bumps `cbSeq`. |
| R3.6-04 typed key left in the form | **Fixed** | `classCode()` clears `cbOpen`, `cbForm` and `cbKeyVis` (`class_test`). |
| R3.6-05 rate buckets split by time zone | **Fixed** | 499 zones from `pg_timezone_names`, each set with `set_config('timezone', z, true)` as `Prefer: timezone` does: one bucket, 469 of 499 refused, one salt. Session-level Kiritimati and GMT−12 hit the same bucket (`tz.txt`). The deploy's probe can't detect a regression (R3.7-07). |
| R3.6-06 unchecked codes shown | **Fixed** for every answer the server gives | `busy`, `full`, `invalid` and an unknown error show no code (`probe1` C). The deliberate "Use it without results" path has two new problems: R3.7-01 and R3.7-04. |
| R3.6-07 backstops as a kill switch | **Partly fixed** | Daily caps per /56 and fill levels in `cb_health` were added. One IPv6 /48 still trips the results backstop in about 2 hours (R3.7-02). My own round-6 numbers were too generous for the goal I gave them. |
| R3.6-08 404 checks before the new version | **Fixed** | `pages.yml` waits for `"<ver>"` in `index.html`, then runs the 404s. |
| R3.6-09 `public` flag | **Partly fixed** | The address is now checked whole, and the 13 addresses I listed are now not public. It still calls `3fff::/20`, `5f00::/16`, `fec0::/10` and everything outside `2000::/3` public (R3.7-06). The shared-gateway gap is a documented decision. |
| R3.6-10 names | **Partly fixed** | Mark-first names, U+034F, variation selectors and enclosing marks are now refused on both sides. Every client output is accepted by the server, apart from newer Unicode, which is documented. Still open: a joiner between Latin letters is invisible and accepted, and the server accepts a joiner before a mark (R3.7-05). |
| R3.6-11 new code erased a saved key | **Fixed** | `cbDraw` skips codes this device already holds. |
| R3.6-12 the key forgotten before the class ended | **Fixed** | `t` is the server's `created` (`probe2` H1, code B). A race can still leave the old `t` (R3.7-09, nitpick). |
| R3.6-13 nitpicks | **Partly fixed** | Fixed: ghost codes, focus held in a closed sheet (`probe2` G1: focus on body, `#ccIn` gone), focus restore, the stats size, `cbCell`, the Delete all wording, the main-only skip, the zero-argument `cb_health`, `fast` capped, the past-expiry re-registration, the all-Z probe key. Still open: the version-mismatch wording, `lastReport()` parsing storage every frame, Copy key writing code and key to the clipboard together, and the "don't reveal live codes" and "no invisible fillers" claims in `supabase/README.md`. |

**Totals:** 9 fixed, 4 partly fixed, 0 still open, 0 worse.

## 1. Verdict

**Not ready for `main` yet, but close. There are no Critical or High findings.**

What holds up:
- The second migration is well built. The UTC pinning holds in every zone, local or session. The daily counters, the salt day and `tidy` agree. A live class can't be taken over or deleted.
- An ended class can be taken over by anyone. That was already true through the batch delete in migration 1, and its results were unreadable and due for deletion anyway (`takeover.txt`).
- The client never shows a code the server refused, and in-flight answers are dropped after Forget and Close.

What is left:
- **The fallback path loses the key.** "Use it without results", chosen after the sheet was reopened, puts a code on the projector whose key is in memory only. A reload loses it for good (R3.7-01).
- **The daily caps don't stop one IPv6 /48** from filling the results backstop (R3.7-02). The migration isn't applied yet, so this is the cheap moment to fix it.

## 2. Score

**7 / 10** (round 6: 6). The database side is now solid, and the round-6 client regressions are fixed. Two Medium findings remain, on the fallback and the kill switch.

## 3. New findings, worst first

### R3.7-01 · Medium · "Use it without results" after reopening the sheet: the code goes on the projector, and its key is never saved and never shown
- **Location:** `src/ui.js`.
  - `ACT.classCode` line 2615 deletes every stored key with `p && !s`, unless its registration is in flight. A failed registration counts: `U.reg.st === 'fail'`.
  - `ACT.codeNoRes` line 2632 saves `s: 1` only `if (K)`, that is, only if the stored entry still exists.
  - `cbRegHTML`'s `off` box (line 2129) has no Show key or Copy key.
- **Reproduction** (`probe1.py` A1–A5; `a3-code-shown-key-not-saved.png`):
  1. Make a code while the network is down. The answer is "No class code yet" with Try again and "Use it without results". `oc-ckeys` holds the key, with `p: 1, s: 0`.
  2. Close the sheet and open Class code again, as anyone would to check the Wi-Fi. `oc-ckeys` is now `{"v":1,"c":{}}`, while `U.reg` still holds the code and key.
  3. Tap "Use it without results". `GDG-08T` shows, with Copy and Play it. Storage is still empty. The saved-codes list is empty. The made box has no Show key or Copy key.
  4. Reload. The key is gone for good, and the code isn't listed.
- **Impact:**
  - **If the timed-out call reached the server** (an answer lost after the commit), every student who sends sees "Sent to the instructor for GDG-08T". The results then sit for 30 days in a class nobody can read or delete.
  - **If it didn't,** the code on the projector can never get results: Set up results needs the lost key.
  - Either way, the fallback STATUS presents as safe isn't.
- **Fix:**
  - `codeNoRes`: always `cbKeySave(R.code, { k: R.key, t: Date.now(), p: 1, s: 1 })`.
  - In `classCode`'s clean-up, skip `U.reg.code` whatever its state.
  - Give the `off` box Show key and Copy key, as the `ok` box has.
  - Add a `class_test` step: fail, reopen, "Use it without results", reload, and check the code is listed.
- **Effort:** S.

### R3.7-02 · Medium · The daily caps are per /56: one free IPv6 /48 still trips the results backstop in about 2 hours
- **Location:** The migration.
  - `cb_class_new` line 199: `allow_day('class_day', 200)`.
  - `cb_submit` line 232: `allow_day('submit_day', 3000)`.
  - Both are keyed by `client_ip()`, which groups IPv6 by /56.
  - The backstops are `reltuples > 100000` and `> 300000`.
- **Arithmetic** (one /48 is 256 buckets of /56; Hurricane Electric's tunnel broker hands out /48s free):
  - **Results:** the hourly cap (600) binds first. 256 × 600 is 153,600 an hour, so 300,000 takes about 2 hours, the same as in round 6. The daily cap (256 × 3,000 = 768,000 a day) never binds. Junk lasts 30 days.
  - **Classes:** 256 × 200 is 51,200 a day, so 100,000 takes 2 days. That's up from 6.5 hours, but junk without results lasts 14 days, so it still trips.
  - The results side needs at least 600 live classes (500 results each), which three /56s register in a day.
- **Effect:** Every Send in the whole game answers `full` for up to 30 days. `cb_health` now reports the fill level, but only the deploy reads it, and only as a warning.
- **Caveat:** This assumes the Supabase API answers over IPv6. Cloudflare-proxied hosts usually do, but I couldn't check from here.
- **Fix** (migration 2 isn't frozen yet, so do it there):
  - Add an aggregate daily and hourly cap per IPv6 /48 (and per /40), as new `rate` kinds. For example: 1,000 codes and 10,000 sends a day per /48, and 2,000 sends an hour.
  - Run `db_live.js` on a daily `schedule:` workflow that fails (and so notifies) past half full, instead of only at release.
- **Effort:** M.

### R3.7-03 · Low · The recursive `morph()` still matches by position: an element inserted above the key box drops focus and swallows typing
- **Location:** `morphKids` (line 25). A held branch is patched only when the new node at the *same index* has the same tag, id and class.
- **Reproduction** (`probe1.py` D1–D3):
  1. Make a code, with the server holding the answer.
  2. Tap "Open with an instructor key" and type `AAAA` in the key box.
  3. The registration answers. The new code joins the saved-codes `<ul>`, which is inserted *above* the form in `.cb-res`, so the form's index shifts.
  4. The form is replaced. Focus goes to `BODY` (D2). The next four keystrokes go nowhere: the value stays `AAAA` (D3).
- **Impact:** On a phone, the keyboard drops mid-key. This is the class of bug the round-6 fix (R4.6-01) was meant to end. The same happens whenever the list appears or disappears above the form.
- **Fix:** Match the held branch by key rather than index. For example, find the new child whose subtree has `#<ae.id>`, and keep the old node in its new slot. Or always render the `<ul class="cb-codes">`, empty if need be, so nothing is ever inserted above the form.
- **Effort:** S-M.

### R3.7-04 · Low · A "lost" code stays shareable, and its students' Sends go to another instructor
- **Location:**
  - `cbRegister` line 2116: the `taken` answer for a shown code sets `st: 'lost'` and deletes the key.
  - The made box (line 2029) still shows the code and its buttons.
  - `cbRegHTML` line 2128.
  - The ask at line 2022.
- **Reproduction** (`probe1.py` B1–B3; `b2-lost-code-still-shareable.png`):
  1. "Use it without results", then Try again, answered `taken`.
  2. The code stays on screen with Copy and Play it (and Share, where it exists). Above the red box it still says "has a Send button that sends you the result".
  3. The red box says "Students can still play it. To collect results, make a new code."
  4. It doesn't say that every Send now goes, with the student's name, to the instructor who owns that code, and the student is told "Sent to the instructor".
  5. Tapping another shift asks "(it stays in your saved codes below)". It doesn't: the key was deleted.
- **Fix:**
  - For `lost`, drop Copy, Share and Play it.
  - Say plainly that Sends would go to another class.
  - Word the ask by state: no "saved codes" claim when the code has no key.
- **Effort:** S.

### R3.7-05 · Low · Names: a zero-width joiner or non-joiner between *any* letters is accepted; repeated names aren't caught; the server is wider than the client
- **Location:**
  - The migration's `clean_name`, line 169: `([[:alpha:]m])[ZWNJ ZWJ](?=[[:alpha:]])`.
  - `cbClean` line 2064.
  - `cbRows` line 2149: `nm = NFKC + toLowerCase`.
- **Reproduction:**
  - `clean_name('S' || U&'\200C' || 'am')` returns it, and `cbClean` accepts it too.
  - With "Sam", "S‌am" and "Sa‍m" in one class, the list shows three plain "Sam" rows with no "(1 of 3 under this name)". Copy table exports the invisible characters (`probe3` L1, L4).
  - The rule is meant "for Persian and Sinhala" (STATUS), but it applies to Latin.
  - **Server wider than client:** in the code-point sweep (`cmp.txt`, position `a+ZWJ+ch`), the server accepts a joiner before 1,295 marks (Mn/Mc, for example U+05B0), because glibc's `[[:alpha:]]` includes Alphabetic marks. The client refuses all of them.
  - Every other position agrees, and every client output the server receives is accepted (`client_out.sql`: 0 refused). The only exception is unassigned/newer code points, which is documented.
- **Fix:**
  - Strip U+200C and U+200D before the NFKC comparison in `cbRows` and in the export.
  - On the server, make the lookahead refuse a mark: `(?=[[:alpha:]])(?![<m>])`.
  - Optionally, allow joiners only after a letter of a joining script (Arabic, Syriac, Brahmic, Sinhala).
- **Effort:** S.

### R3.7-06 · Low · `is_public` misses IANA's 2024 special-purpose blocks, and everything outside global unicast
- **Location:** Migration line 87.
- **Reproduction** (local): `is_public` returns true for:
  - `3fff::1` (Documentation, RFC 9637)
  - `5f00::1` (SRv6 SIDs, RFC 9602)
  - `fec0::1` (deprecated site-local)
  - `::ffff:0:a00:1` (IPv4-translated 10.0.0.1, which `client_ip` also buckets with `::1` as `::/56`)
  - `1::1`, `4000::1` and `e000::1` (all IETF-reserved)
- **Why it matters:** The comment and `supabase/README.md` say "IANA's special-purpose registries".
- **Fix:** For IPv6, require `a <<= '2000::/3'`, plus the existing exclusions, `3fff::/20` and `5f00::/16`. Add these to `privacy_test.sql`.
- **Effort:** S.

### R3.7-07 · Low · The deploy's time-zone probe can't fail for the bug it names
- **Location:** `test/db_live.js` line 84. All 31 probe calls send the same `Prefer: timezone=Asia/Kathmandu`.
- **Why it can't fail:**
  - With the round-6 bug back (buckets per session zone), 31 calls in one zone still fill that zone's bucket of 30, and call 31 is `busy`.
  - The check passes and prints "forged address headers and another time zone don't get round the rate limit".
- **Fix:** Send 15 calls without `Prefer` and 16 with Kathmandu (a :45 offset gives a different hour start), then expect `busy` on call 31.
- **Effort:** S.

### R3.7-08 · Low · The release job installs unpinned third-party code after the build check, then publishes the working tree
- **Location:** `pages.yml`.
  - Lines 65–66: `pip install -q playwright` and `python -m playwright install --with-deps chromium` run after "The committed build matches the source".
  - "Package the game files only" then copies `index.html` from the working tree into `_site`.
- **Impact:** A compromised PyPI `playwright` release (or anything it pulls) can rewrite `index.html` or `sw.js` before packaging, and it would be published to edcodeblack.com. The npm side is lockfile-pinned; this isn't.
- **Fix:**
  - Run `git diff --exit-code` again right before packaging.
  - Or package and hash `_site` before any `pip` step.
  - Or pin `playwright==<x>` with `--require-hashes`.
  - Or move the class test into its own job that `build` needs.
- **Effort:** S.

### R3.7-09 · Nitpicks
- **`U.rowSeq` is shared by every row** (`probe2` H0, H1):
  1. Tap Turn results back on for ended code A, then Set up results for B, before A answers.
  2. A's `ok` is dropped, although the server re-made A's class.
  3. The device keeps A's old `t` (made Nov 4) and still says "class ended". A's button re-enables while its call is out.
  - Tapping again recovers. A per-code sequence number would avoid it.
- **"Use it without results" isn't only for an unreachable server.** It is offered on HTTP 5xx, 404, 429 and malformed JSON (`probe1` C). A 429 from the gateway reads "The server had a problem".
- **README overclaims:**
  - `README.md` says "A code shows only once the server has set up its results", which is false for the fallback.
  - `supabase/README.md` line 31 still says "the answers don't reveal live codes" and "no invisible fillers".
- **`skip_reason` is printed after `::warning::` unescaped** (`db_live.js` line 31). A reason with a newline (via the API) or `%0A` can issue workflow commands. Only someone who can dispatch the workflow can do it.
- **`cb_health` tells anyone with the public key how full the backstops are** (`classes` and `results`, from `reltuples`). An attacker can watch a fill attack's progress, and anyone can read rough usage numbers.
- **`cbNameWhy` and invisible characters:** a name with an invisible character from a paste (U+200B; `trim()` keeps it) gets "letters only, like Sam", and the student can't see what's wrong. Strip Default_Ignorable characters, other than the allowed joiners, before validating.
- **Older `oc-ckeys` records** `{k, t, p: 1}` from the round-6 build, which did show unconfirmed codes, now read as `s: 0` and are silently deleted when Class code opens. This is harmless only because v0.31.0 never shipped.
- **`clean_stats` still accepts `scen`,** which the game no longer sends: a dead path.
- **Round-6 nitpicks still open:**
  - A real version mismatch reads "isn't set up for class results, or its class has ended".
  - `lastReport()` parses `oc-last-report` before checking memory, on every call.
  - Copy key puts the code and the key into the clipboard history together.

## 4. Coverage

**Read:**
- The second migration, line by line, and the first migration's helpers and tables.
- `run.sh` (the frozen-migration and refusal checks), the `privacy_test.sql` time-zone and daily tests, `client_call.json`, `tools/name_ranges.py` (I ran `--check`, and checked its `DI` list against Unicode 15.1), `stubs.sql`, and `supabase/README.md`'s Backstops and Releasing.
- `test/db_live.js`, all of `pages.yml`, and all of `tests.yml` (permissions, `persist-credentials`, `webkit-save`, skip_db_check with skip_reason, main-only).
- The whole `src/ui.js` diff:
  - `morph` and `morphKids`;
  - `classHTML`, `cbRegister`, `cbDraw`, `cbRegHTML`, `cbListHTML`, `cbRows`, `cbDet`, `cbTable`, `cbCell` and `cbCsv`;
  - the class actions, the paste parser and the Escape handler;
  - `cbSend` and `back()`, and About's Privacy;
  - every new template literal (no XSS: each interpolation is escaped or constant).
- The engine's three counters: no new random draws, and `npm test` passed.

**Ran on PostgreSQL 16:**
- Rate buckets under 499 zones (local `set_config`) and two session zones.
- The daily caps, the salt day and `tidy`.
- `is_public` on 12 more addresses.
- Live and ended takeover with `cb_class_new`.
- The largest cleaned stats (558 bytes, under 1,000).
- `clean_name` timing (about 50 µs a call).
- Every code point through `clean_name` in six positions: first, middle, alone, second word, after a joiner, before a joiner. Each was compared with `cbClean`, and every client output was fed to the server.

**Ran in Chrome** (stubbed server):
- Every registration answer: `busy`, `full`, `invalid`, unknown, 503, 404, 429, abort.
- Fail, reopen and "Use it without results", then a reload. "Use it without results", then Try again answered `taken`, and the ask.
- Focus while a registration lands; Enter in Play a code; Escape with an open question.
- The `codeRegSaved` race.
- Forget during a read; typed read across a reopen; saved read across a reopen.
- Hostile, invisible and formula names in the list and in Copy table.

**Couldn't check:**
- The live database and gateway: whether the API answers over IPv6 (R3.7-02), and the live glibc's Unicode version.
- GitHub Actions itself, including the `github-pages` environment's branch rule.
- WebKit and Firefox. In particular, whether `-webkit-text-security` masks the key box in Firefox. `text-security` isn't a real property, so if Firefox lacks the prefixed one, the key shows in clear despite "(hidden as you type)". Someone should check this on Firefox.
- Real phones.

## 5. What I'd keep

- **UTC pinned at the function level:** `SET timezone` on every function that reads the clock, explicit `'UTC'` in `date_trunc`, and the salt day from `now() at time zone 'UTC'`. It held in every zone I tried.
- **The whole-address check before grouping,** and IPv4-mapped addresses unwrapped once, in `client_addr()`.
- **The single-code delete before re-registering:** it removes the past-expiry `ok` cleanly without opening a live class to anyone.
- **The name rule's generated lists, and `--check`.** The server now accepts every name the client sends, in every position, apart from the documented newer-Unicode letters.
- **The frozen-migration check in `run.sh`:** hashes, plus "nothing unapplied sorts before an applied one".
- **Per-job permissions:** `persist-credentials: false` on every job that runs project code, and a WebKit saver job that runs none.
- **Client sequence numbers for reads, registrations and rows,** and the `!cbKeys()[code]` guard, which together make Forget and Close actually final.
- **`cbCell`'s leading-whitespace and full-width guard,** shared by Copy table and CSV.
