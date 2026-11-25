# Reviewer 3, round 8: game tech, security and privacy (the round-7 fixes)

Branch `claude/sleepy-rubin-jot35n`, v0.31.0, reviewed at `87c9c13`. Under review: `git diff 18a71f9..87c9c13 -- src supabase test tools .github build.js`, and the second migration `supabase/migrations/20261125120000_codeblack_round6.sql`, taken as the version the owner will paste. It is not live yet. Reviewed Nov 25, 2026.

The working tree changed while I worked (another session is fixing reviewers 1 and 2). So I exported `87c9c13` with `git archive` into scratch, and tested only that copy. Nothing here touches the live project, supabase.co or edcodeblack.com.

**How I tested.**
- **Database:** a throwaway PostgreSQL 16.15 cluster (en_US.UTF-8), in a `mktemp` folder under `/tmp`, loaded in this order: stubs, baseline, migration 1, migration 2.
- **Shipped suites, on the exported copy:**
  - `npm run db:test` passed (207 ok).
  - `npm test` passed.
  - `test/class_test.py` passed (91 ok).
- **Client:** the committed `index.html` in Chrome 153, through Playwright for Python, with every `**/rest/v1/**` call stubbed, held or aborted.
- **Scratch:** scripts, outputs and screenshots are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round8/r3/`. That folder also holds files from an earlier, interrupted run of this review. I re-ran everything I cite against `87c9c13`.

## 0. Round-7 status

| Item | Status | Evidence |
|---|---|---|
| R3.7-01 "Use it without results" after a reopen lost the key | **Fixed** | `probe1` A1–A4: fail, reopen (key still stored, `p:1 s:0`), "Use it without results" (`s:1`), reload: the code is listed with its key. |
| R3.7-02 one IPv6 /48 trips the results backstop in 2 hours | **Partly fixed** | `allow48` works: 4 /56s in one /48 at a limit of 3 give `true,true,true,false`; another /48 and IPv4 aren't held back (`a48b.sql`). The arithmetic now: one /48 at 10,000 sends a day reaches 300,000 after about 30 days; two /48s take about 15 days. No /40 cap was added. The class side got *worse*, through the held codes (R3.8-02). |
| R3.7-03 `morph()` matched the held branch by position | **Fixed** | `probe6` M0–M4: the saved-codes list appears and then disappears above the form while I type in the key box. Focus stays, and every keystroke lands. A new focus loss from matching by class is R3.8-03. |
| R3.7-04 a lost code stayed shareable | **Partly fixed** | The main path is fixed (`probe1` E1): Try again answered `taken` strikes the code through, removes Copy, Share and Play, and deletes the key. The row path still leaves it shareable (R3.8-04). |
| R3.7-05 joiners between Latin letters; server wider than client | **Fixed** | A sweep of every code point in 10 positions, including joiners after Devanagari, Arabic and Malayalam letters, and joiners after `a`. The server accepts **nothing** the client refuses. The client accepts more only for code points unassigned in Unicode 15.1 (documented). All 1,157,745 distinct client outputs went to `clean_name`; the 71,765 it refused each contain a Unicode 16/17 character (`cmp.txt`, `refused_out.txt`). |
| R3.7-06 `is_public` missed the 2024 blocks and non-global-unicast | **Fixed** | IPv6 must be inside `2000::/3`, and `2001::/23`, `2001:db8::/32`, `2002::/16` and `3fff::/20` are excluded. That covers every not-globally-reachable entry of IANA's registry inside `2000::/3`. Tests added. |
| R3.7-07 the time-zone probe couldn't fail | **Fixed** | Odd calls send Kathmandu (+5:45) and even calls UTC. A database that split buckets by zone would count 16 and 15, call 31 would pass, and the check would fail. |
| R3.7-08 unpinned PyPI code ran before packaging | **Fixed** | PGDG, PyPI and Playwright now run only in the `contract` job. The `build` job, which packages `_site`, runs only lockfile-pinned `npm ci`. |
| R3.7-09 nitpicks | **Partly fixed** | Fixed: per-row request sequence, `skip_reason` sanitised, `scen` dropped, the hidden-character message, the version-mismatch wording. Still open: "The server had a problem" for a gateway 429, Copy key putting code and key on the clipboard together, and docs saying the fallback is for an unreachable server. `cb_health` fill is now to a tenth (coarser, still public). |

**Totals:** 6 fixed, 3 partly fixed, 0 still open, 0 worse. One side effect of another round-7 fix made an older issue worse (R3.8-02).

## 1. Verdict

**Not ready for `main`. There are no Critical or High findings, but two new Medium findings come from round-7 changes. Both are cheap to fix now, because the migration isn't applied yet.**

- **R3.8-01 (privacy).** Round 7 widened "Use it without results" from "server unreachable" to every failure, including `busy` and `full`. A caller can cause both:
  - `busy`: one student on the classroom Wi-Fi spends the network's hour (60 junk calls, which count even when invalid).
  - `full`: anyone fills the global backstop.

  The code then goes on the projector unregistered. The student registers it from phone data and receives every classmate's Send, while each classmate is told "Sent to the instructor". I ran the whole chain on the local database.
- **R3.8-02 (availability).** The held codes stay in `codeblack.classes`, so they count against the 100,000-row backstop for 44–60 days instead of 14–30. That makes a sustained fill about 3× cheaper, and recovery after an attack 30 days slower. They also make `cb_health`, which anyone can call, about 150× more expensive: 140 ms instead of under 1 ms at 99,000 rows.

Everything else that round 7 promised, I verified:
- The name rules agree exactly.
- `is_public` is right.
- The key survives the fallback.
- The redraw keeps the key box through list changes.
- The deploy's supply-chain split holds.

## 2. Score

**7 / 10** (round 7: 7). The round-7 fixes are real, and four of them are verified exhaustively. But the fallback and the held codes are new security and availability regressions, in exactly the area this phase exists for.

## 3. New findings, worst first

### R3.8-01 · Medium · "Use it without results" can be forced, and the unregistered code it puts on the projector can be claimed: classmates' results go to whoever claims it

**Location:**
- `src/ui.js` 2034: the fallback is offered for every failure, no longer only `R.net`.
- `codeNoRes` (2649).
- The `off` text (2144).
- In the migration's `cb_class_new`, lines 224–236: `busy` and `full` are answered before the "taken" check (240–247). Every call counts against the network's limits before validation, so invalid junk counts too.

**Reproduction, database** (`hijack.sql`, all on the local cluster):
1. As the classroom's public address `203.0.113.50`, call `cb_class_new('', '', '')` 61 times. The answers are 60 × `invalid`, then `busy`. The network's hourly bucket is spent. With 200 calls, it is spent for the whole UTC day.
2. The instructor, on the same Wi-Fi, registers `7WJ-81R` and gets `{"error":"busy"}`.
3. A student on phone data (`198.51.100.9`) calls `cb_class_new('7WJ-81R', '<own key>', '0.31.0')` and gets `{"ok":true,...}`.
4. A classmate on the Wi-Fi sends `cb_submit('7WJ-81R', ..., 'Maria G.', ...)` and gets `{"ok":true}`. The game shows "Sent to the instructor for 7WJ-81R".
5. The student calls `cb_class_read('7WJ-81R', '<own key>')` and gets name `Maria G.`, score `81`.
6. The instructor taps Try again in the same hour and still gets `busy`. The game never learns the code was taken, so it never shows the "lost" warning. With the daily variant, it doesn't for the rest of the day.
7. **The `full` variant:** with `reltuples` over 100,000, a code another key already owns answers `{"error":"full"}`, not `taken`. So an attacker who fills the backstop with codes for the popular setups also squats the codes the fallback will show. There are 131,072 seeds per setup, so 100,000 rows cover up to 76% of one setup.

**Reproduction, client** (`probe1` D, `class_test` step 1):
1. `busy` shows "No class code yet" with Try again and "Use it without results".
2. Tapping "Use it without results" shows the code with Copy, Share and Play.
3. The box says only "a result sent now **may not reach you**". It doesn't say a result may reach *someone else*.

**Impact:**
- Classmates' first names, scores, stars, minutes and stats go to a classmate or an outsider. The game tells each of them their result went to the instructor.
- The only defence is the instructor relaying "don't tap Send". The wording undersells why that matters.
- In round 7 nobody could force the fallback, because a caller can't make the instructor's network fail.

**Fix (pick one):**
1. Offer the fallback only for network and timeout failures, as before. For `busy` and `full`, say when to try again.
2. Or, in `cb_class_new`, run a read-only "exists with another key → `taken`" check **before** the limits and the backstop, and validate before counting. That closes the squat path and makes junk calls free to refuse.
3. Either way, change the `off` text to say plainly that until results are set up, anyone who registers the code first receives what students send.
4. If the owner wants a code even then, a "results off" code variant is the robust fix. For example, a second checksum salt that students' games recognise, and whose summary has no Send box.

**Effort:** S (option 1 or 2), M (option 4).

### R3.8-02 · Medium · Held codes count against the class backstop for 30 extra days, and make the public `cb_health` about 150× more expensive

**Location:** the migration.
- `tidy` 205–206 and `cb_class_new` 232–233: ended codes stay in `codeblack.classes` 30 more days.
- 234: the backstop is `reltuples > 100000` over all rows.
- `cb_health` 349–350: `overdue` runs `exists (... results ...)` for every row past `now() - 2 hours`.

**Arithmetic** (my numbers; R1.8-04 and R2.8-01 note the same effect in less detail):
- **Lifetimes:** a junk code now lives 14 + 30 = **44 days**, or 30 + 30 = **60 days** with one result each. Before, it was 14 or 30.
- **IPv4 at 200 codes a day per address:**
  - To keep the class table over 100,000: 12 addresses (9 with the one-result trick) instead of 36 (17).
  - For a one-day burst (500 address-days, cheap through a residential proxy service), the table stays full **44 days** after the attack stops instead of 14.
- **IPv6 at 1,000 a day per /48:** 3 /48s (2 with one result each) instead of 8 (4).
- **Effect while full:** every registration answers `full`, so every instructor is pushed into the fallback of R3.8-01.

**The health amplifier** (`perf2.sql`, 99,000 rows):
- `cb_health(false)` takes **133–190 ms** when the rows are held, and **0.7–1.2 ms** when the same rows are live.
- It is anonymous, limited to 120 calls an hour per /56, with **no /48 limit**. One /48 (256 /56s × 120 × 0.14 s) keeps more than one CPU core busy, on a free-plan database that Case Room shares.

**Fix:**
1. Keep held codes in a separate small table, `codeblack.held(code, key_hash, until)`, that the backstop doesn't count. Give it its own cap: when it is full, delete as before instead of holding.
2. Or hold only codes whose class received a result. Nobody sent to an unused code in 14 days, so there is little to take over.
3. Compute `overdue` with indexed queries: `count(*) where expires_at < now() - '30 days 2 hours'`, plus a count driven from `results` joined to ended classes.
4. Give `health` a /48 bucket.

**Effort:** S–M.

### R3.8-03 · Low · The key box drops focus whenever its own class changes: with Show on, every wrong key closes the keyboard

**Location:**
- `src/ui.js` 2727 and 2730: a failed read sets `U.cbKeyVis = false`, which adds `masked` to `#cbKey`'s class.
- `morphSame` (28) requires an identical `class`, including on the focused input itself. With no match, the input is replaced.

**Reproduction** (`probe4` K0–K3):
1. Open with an instructor key. Type a code, tap Show, type a 16-character key, press Enter. The stub answers `{"error":"key"}`.
2. The error shows, and focus goes to `BODY` (K1).
3. The next letter typed goes nowhere (K2).
4. With Show off, the same Enter keeps focus in the box (K3).

**Impact:**
- This is the R3.6-02 bug back, for the instructor most likely to mistype: the one who turned Show on to check the key.
- **Possible variant (untested):** in a browser that doesn't move focus to a tapped button (Safari), tapping Show or Hide while typing should drop focus the same way. A scripted click without a focus change did drop it (K4). I couldn't test a real iPhone.

**Fix:**
- Exempt the focused element itself from the class comparison: match it by id, and patch its attributes, class included.
- Or keep Show on after a failed read.

**Effort:** S.

### R3.8-04 · Low · The saved-codes row and the code on screen disagree: a row answered `taken` leaves the code shareable; a row answered `ok` leaves "results are off" on screen

**Location:**
- `codeRegSaved` (2654) updates storage and `U.regRows` only.
- The made box reads `U.reg` (2042, 2144).
- In the `off` state the code appears in both places, each with its own button.

**Reproduction** (`probe1` C1 and D1; `c1-row-on-top-off.png`, `d1-taken-in-row-top-shareable.png`):
1. **Taken:** `busy`, "Use it without results", then the row's Set up results answered `taken`.
   - The row says "Another class has 5YD-R0H … Forget it and make a new code".
   - The box above is not struck through. It keeps Copy and Play (and Share where it exists), and still says "Try again sets them up for this same code".
   - Copy still puts the code on the clipboard (D2).
   - The key isn't deleted.
2. **Ok:** the same, answered `ok`.
   - The row shows "results until Dec 9" and Results.
   - The box above still says "Class results are off… **Tell them not to tap Send**".

R1.8-03 covers the `ok` half. The `taken` half bypasses the R3.7-04 fix.

**Fix:**
- When `c === U.codeMade`, route the row's button through `cbRegister`, or update `U.reg` from the row's answer.
- Or hide the row's Set up results while the code is in the made box.

**Effort:** S.

### R3.8-05 · Low · The focus hand-off picks the first button with the same action and argument: Refresh sends focus up to the saved list, and a disabled replacement drops it

**Location:** `morph` (26): `.find()` takes the first `[data-act][data-arg]` match in document order.

**Reproduction** (`probe4` R0–R1):
1. Make a code, open its Results (empty), focus Refresh, press Enter. The answer has one row.
2. Focus is now on the saved-codes row's **Results** button: `inSavedList=true`, above and off screen, with `preventScroll`.

This is the same bug as R1.8-02. I confirmed it.

**By reading:**
- Pressing Set up results in a row redraws it `disabled`.
- The hand-off then calls `focus()` on the disabled copy, which does nothing, so focus falls to `BODY`.
- I found no duplicate action and argument pairs in the containers redrawn during play (`#istaff`, `#sideTeam`, 24 patient sheets in both roles; `probe3b`). So there is no focus stealing in play.

**Fix:**
- Remember the button's index among its matches.
- Skip disabled candidates, and fall back to the nearest focusable ancestor.

**Effort:** S.

### R3.8-06 · Low · "Its own key turns it back on" can never happen for a class that received a result

**Location:**
- `cbKeys()` drops a key at `t + CB_LIFE`, which is 30 days (2053, and 2106).
- `t` is the server's `created`.
- A class with a result ends at `created_at + 30 days`, in `cb_submit` 289.

**What happens:**
- The device forgets the key at the instant the class ends, so "Turn results back on" never appears for a class that had a result.
- For an unused class it works only between day 14 and day 30.
- For used classes, the 30-day hold only blocks the code. STATUS ("its own key turns it back on, empty") and `supabase/README.md` line 35 promise more.

**Fix:**
- Keep the device key until the hold ends.
- Or say in the docs that turning results back on is for unused codes within 30 days.

**Effort:** S.

### R3.8-07 · Low · Forget's clipboard clean-up overwrites whatever is on the clipboard, works only until a reload, and can't reach clipboard history

**Location:** `keyCopy` sets `U.keyCopied` (memory only); `keyForgetGo` (2671) does `copyText(' ')`.

**Reproduction** (`probe2` F1):
1. Copy key for A, then Copy, which puts the class code text on the clipboard.
2. Forget A. The clipboard now holds `' '`: the code text, or anything the instructor copied in another app since, is destroyed.

**By reading:**
- After a reload `U.keyCopied` is empty, so Forget leaves the key on the clipboard.
- Windows' clipboard history, Gboard and clipboard managers keep the key whatever the page writes.

**Why it matters:** STATUS says "Forget replaces a key this page copied". That is true only in the same page session, and only by clobbering the clipboard blindly.

**Fix:**
- Read before writing (`navigator.clipboard.readText()` where permitted), and replace only if it still holds the key.
- Otherwise, tell the instructor to clear the clipboard themselves. Drop the claim.

**Effort:** S.

### R3.8-08 · Low · A key pasted into "Play a code" (the first box on the sheet) shows half of it on the projector

**Location:**
- `#ccIn` (2037, `maxlength="9"`).
- The R5.7-07 paste fix (3168) covers only the results form's code box.

**Reproduction** (`probe5` P1, `p1-key-in-play-box.png`):
1. Paste `ABCD-EFGH-JKMN-PQRS` into Play a code.
2. The box shows `ABCD-EFGH`, with "That code doesn't look right".
3. In the results form's code box, the same paste moves the key to the masked box (P2).

**Impact:** 40 of the key's 80 bits on a projected screen. The other 40 bits are out of reach at the read limit, so this is hygiene, not a break.

**Fix:** In the input handler, treat a `cbKeyNorm`-valid value in `#ccIn` the same way: clear it, and say "That's an instructor key: use Open with an instructor key".

**Effort:** S.

### R3.8-09 · Nitpicks
1. **Misplaced comment.** `style.css` 1021: the comment "the key isn't readable on a projected screen" now sits on `.cc-code.lost`, not on `.cb-keyin.masked`.
2. **Docs on the fallback.** `supabase/README.md` 31 ("if the server can't be reached at all"), `CLAUDE.md` 135 and the README v0.31.0 paragraph ("if the server can't") all say the fallback is for an unreachable server. It is offered for `busy`, `full` and every HTTP error.
3. **"Live classes."** `supabase/README.md` 38 says "about 100,000 live classes", but held codes count too.
4. **Gateway 429.** A 429 from the gateway still reads "The server had a problem" (`cbNet`).
5. **Copy key.** It still copies the code and the key together (open since round 6).
6. **`full` before the existing-row check.** Retrying a live registration, or turning results back on, answers `full` although neither adds a row.
7. **Fill rounded to a tenth.** `cb_health` rounds fill to a tenth, so the daily watch's `< 0.5` fails at 45%.
8. **Revive racing `tidy`.** A revive racing `tidy`'s 30-day delete answers `taken` for the caller's own code, at the boundary instant.
9. **`R.saved` unused.** The `off` box ignores `R.saved`. With storage blocked there's no "this device can't save it", and no Show key: the key is reachable only through a later Try again answered `ok`.
10. **Joiner names.** `cbNameWhy` checks for hidden characters before the word count. A legitimate Persian or Sinhala name with a joiner that fails for another reason (four words) is told "Your keyboard added a hidden character".
11. **The daily watch's alert path is unverified.** I agree with R1.8-06: GitHub mails scheduled-run failures to the account that last changed the cron line. If pushes come through an app account, nobody is mailed, and the backstop alarm R3.7-02 relies on is silent.

## 4. Coverage

**Read:**
- The whole `ui.js` diff:
  - `morph`, `morphKids`, `morphHeld` and `morphSame`;
  - `classHTML`, `cbRegister`, `cbRegHTML`, `cbListHTML` and `cbRows`;
  - every class action (`codeNoRes`, `codeRegSaved`, `keyCopy`, `keyForgetGo`, `cbShow`, `cbDel*`);
  - the input and paste handler, the Escape handler, `cbSendHTML` and About;
  - every new template literal. No XSS: each interpolation is escaped, numeric or constant, and `conf()` ids are constants.
- The engine diff: no new random draws; the counters are in `G.stats`, JSON-safe.
- `build.js`, `style.css` and `tools/name_ranges.py`.
- The second migration, line by line, and migration 1's helpers.
- `run.sh` (strict freeze, odd files, ASCII check, predecessor and re-run steps), the `privacy_test.sql` diff, `stubs.sql` (`cron.alter_job` matches pg_cron's signature), `client_call.json` and `supabase/README.md`.
- `test/db_live.js`, `pages.yml`, `tests.yml` and `db-watch.yml`:
  - permissions per job;
  - `persist-credentials: false` everywhere project code runs;
  - the emergency path, with the reason checked by environment variable, not interpolation, and sanitised in `db_live.js`;
  - the branch guard;
  - the `contract`/`build` split;
  - `playwright==1.65.2`, which exists on PyPI.

**Ran on PostgreSQL 16:**
- Held codes:
  - another key gets `taken`;
  - `submit` gets `unknown`;
  - read and delete with the own key get `key`;
  - a revive deletes the old results, resets to 14 days and takes the new version;
  - `overdue` counts results more than 2 hours late, and holds past 30 days and 2 hours;
  - `tidy` clears both.
- `allow48`: per /48, per /56 inside it, IPv4 and mapped IPv4 exempt, and `tidy`'s kind lists.
- Registration with 99,000 held rows: about 1 ms. `cb_health` with held and with live rows (R3.8-02).
- The forced-fallback takeover chain (R3.8-01).
- `clean_name` over every code point in 10 positions, against the client's verdicts.
- Every distinct client output (1,157,745) through `clean_name`.

**Ran in Chrome** (stubbed server):
- The fail, reopen, fallback and reload path.
- The `off` state, then the row's Set up results answered `ok` and `taken`.
- Try again answered `taken`, and the ask after it.
- Forget's clipboard handling.
- The list appearing and vanishing above the key box while typing.
- Show plus a failed read.
- The Refresh hand-off.
- Duplicate action and argument pairs in the containers redrawn during play.
- Pasting a key into each code box.

**Couldn't check:**
- The live database and gateway (IPv6 reachability, the live glibc's Unicode version).
- GitHub Actions itself, including who receives the scheduled-run mail.
- Safari and Firefox: whether `-webkit-text-security` masks the key box in Firefox, now that the unprefixed fallback is gone; and the focus variant in R3.8-03.
- Real phones.

## 5. What I'd keep

- **The name rule pair.** It is now exact: across 10 positions and every assigned code point, the server never accepts what the client refuses, and accepts every client output apart from newer Unicode.
- **`allow48`'s design.** A separate HMAC string per /48, UTC buckets, and the hourly and daily kinds kept apart in `tidy`.
- **`is_public`** as "global unicast minus the registry's non-global blocks", instead of a deny-list alone.
- **The supply-chain split in `pages.yml`.** Everything from PGDG and PyPI runs in a job that publishes nothing; the packaging job installs only from the npm lockfile.
- **The alternating-zone probe.** It can now fail for the bug it names.
- **The identity-matched redraw** for the held branch. It does fix the keyboard drop when lists come and go above the form (apart from R3.8-03's class case).
- **Per-row request sequences, and the key saved on "Use it without results".** Both close the round-7 races cleanly.
