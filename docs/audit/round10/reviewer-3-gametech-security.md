# Reviewer 3, round 10: game tech, security and privacy (the round-9 fixes)

Branch `claude/sleepy-rubin-jot35n`, v0.31.0, reviewed at `1ab6fa9`. Under review: `git diff 0541eeb..1ab6fa9 -- src supabase test tools .github build.js package.json CLAUDE.md README.md docs/SMOKE.md`, and the second migration `supabase/migrations/20261125120000_codeblack_round6.sql` as the owner will paste it (not live yet). Reviewed Nov 25, 2026.

I exported `1ab6fa9` with `git archive` into scratch and tested only that copy. Nothing here touched the live project, supabase.co or edcodeblack.com.

**How I tested.**
- **Shipped suites, on the exported copy:** `npm run db:test` passed (225 ok, fingerprint `dcd21130a3b2c81b54b6a02804585d75`). `npm test` passed (717 ok). `test/class_test.py` passed (107 ok). A rebuild in scratch is byte-identical to the committed `index.html` and `sw.js`.
- **Database:** a throwaway PostgreSQL 16.15 cluster (`en_US.UTF-8`), loaded in order: stubs, baseline, migration 1, migration 2. Its data folder is under `/tmp/r3pg.*`, not in scratch, because the `postgres` user can't enter `/tmp/claude-0` (the same reason `run.sh` uses `mktemp`). It was stopped and deleted afterwards.
- **Client:** the committed `index.html` in Chrome, through Playwright for Python, with every `**/rest/v1/**` call stubbed, held or aborted.
- **Engine:** Node scripts against `src/engine.js`.
- **Scratch:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round10/r3/` holds:
  - `db/`: the SQL and its output (`held_takeover`, `fp_ws`, `unknown_counts`, `mutation_revive`, `revive_full`, `junk_cost`, `slow_repro`, `fp_anon`);
  - `eng/`: `arrival_arrest.js`, `queued_arrest.js`, `arrival_exploit.js` and output;
  - `ui/`: `probe_kbd.py`, `probe_reg.py`, `probe_font.py`, their `.txt` output and screenshots (`k4.png`, `k4-tab.png`, `t-taken-off.png`).

## 0. Round-9 status

| Item | Status | Evidence |
|---|---|---|
| R3.9-01 held codes had no cap and no monitor | **Fixed, but the fix opens R3.10-01** | `cb_class_new` releases the oldest held codes past 30,000; `cb_health` reports `held`; the watch fails at 0.5. A setup can no longer be emptied silently. But the release is something any caller can trigger, and it hands a planned code to whoever registers it next (R3.10-01). |
| R3.9-02 "Use it without results" for failures others can cause | **Partly fixed** | `probe_reg` R: 503, 500, 429, HTML and `{}` no longer offer it; abort, timeout and `full` do. A 429 reads as busy, but only in the panel: the row, Send and Results still say "The server had a problem" (nitpick 3). `full` is left by decision. A classmate who saturates the classroom Wi-Fi past 8 seconds still produces `timeout`. |
| R3.9-03 the fingerprint ignored whitespace and everything but function text | **Partly fixed** | It now covers each object, return types, grants, tables and the cron job. But one space made two inside a string literal still leaves it unchanged and breaks every two-word name (R3.10-04). |
| R3.9-04 `overdue` and registration slow at the backstops | **Still open** | Left in STATUS, with the reason. |
| R3.9-05 the ended row's date and button | **Fixed** | A used class shows its deletion date with Turn results back on. An unused one says "unless a student has sent one since" with Results. One new edge: after a refused read, Results is gone even once the class is live again (R3.10-09). |
| R3.9-06 nitpicks | **Partly fixed** | Fixed: 1 (`invalid` and `key` now get their own messages), 3, 4, 5, 6, 8, 9. Partly fixed: 2 (only malformed sends skip the count; the runbook claims more, R3.10-05) and 10 (429 only in the panel; Copy key left). Still open: 7 (`deploy.txt`). |

**Totals:** 2 fixed, 3 partly fixed, 1 still open, 0 worse. One fix (R3.9-01) opens a new Medium, R3.10-01.

**STATUS overclaims:**
- "Once a class ends, its code is held 30 days … so nobody else can take it" is false once someone triggers the cap (R3.10-01). It's in the panel, the README, `supabase/README.md` and CLAUDE.md.
- "a changed string can't pass" (the fingerprint) is false (R3.10-04).
- "Junk sends spent a campus's limit: fixed" holds only for malformed sends. `supabase/README.md` says the class and version are checked before counting, and they aren't (R3.10-05).
- "It applies only to an own arrest at least 5 minutes old": an arrival in arrest is never 5 minutes old to this rule (R3.10-02).
- "A focused button that disappears hands the focus to the control now in its place": in the class list that control is another class's Show key (R3.10-03).
- "privacy_test.sql … R3.9-01: at most 30,000 held codes": the cap is never exercised by a test (R3.10-07).
- R3.8-03, R3.8-07 and R3.8-08 are still neither fixed nor listed, as in round 9.

## 1. Verdict

**Don't paste the migration as it stands. There are no Critical or High findings, but there are three new Mediums, all caused by round-9 fixes. One is in the unapplied migration, where it is cheapest to fix now.**

- **R3.10-01 (privacy, Medium).** The 30,000 held-code cap releases the oldest held codes, and any caller can trigger it.
  - 30,001 throwaway registrations, made after a planned code, end 14 days later.
  - One call then releases the planned code and registers it under the attacker's key, in the same call.
  - Students who send at the lesson send to the attacker. I ran it end to end: the attacker read "Maria G., 81". The instructor gets `key`, then `taken`.
  - Every other held code older than the batch goes too.
- **R3.10-02 (game rules, Medium).** The end-of-shift arrest rule counts minutes from `tArrest`, which only in-room arrests have.
  - An arrival in arrest left 14 minutes is never penalised, and is sent to the instructor as 0.
  - An in-room arrest the attending had already queued behind the code they were running is penalised, and the M&M says "nobody was running the code".
- **R3.10-03 (privacy and accessibility, Medium).** Pressing Enter on "Forget this key" moves the focus to the next class's Show key. A second Enter shows that class's instructor key on the projected sheet.

Everything else holds up:
- `fingerprint_parts` and `fingerprint` are unreachable by `anon` and `authenticated`. `cb_health` returns only `fp`.
- Uncounted invalid sends cost about 25 µs each, cheaper than the 77 µs of a busy refusal, so they add no load.
- The `/48` health limit works.
- `codeLost` isn't counted twice: once at `leave`, or once in `deadHere`, never both.
- `logOrders` dedupes the after-ROSC order log.
- The Tab trap and opener restore work, and N still works with the sheet focused.
- Every new template interpolation is `esc()`'d or a number from the engine. `verdictOf`'s `<b>` wraps constants only.

## 2. Score

**6 / 10** (round 9: 7). Most round-9 fixes are real. But three of them introduced new Mediums: a takeover path in the migration, a scoring rule that depends on where the arrest started, and a focus hand-off that reveals keys. Round-8 Lows are still unlisted.

## 3. New findings, worst first

### R3.10-01 · Medium · The held-code cap lets anyone release a planned code early and take it over

**Location:**
- In the migration's `cb_class_new`, lines 239–241: when more than 30,000 codes are held, it deletes the 1,000 with the oldest `expires_at`. This runs in the same call, before the `taken` check at line 244.
- The promise it breaks:
  - `cbRegHTML` in `src/ui.js`: "Once a class ends, its code is held 30 days … so nobody else can take it";
  - README v0.31.0: "nobody else can take it";
  - `supabase/README.md` line 36;
  - CLAUDE.md, Backend.

**Reproduction** (`db/held_takeover.sql`, about 2 seconds):
1. The instructor registers `TGT-001` with key `TEACHERKEY000001`. It's a planned code, posted for a lesson on day 20.
2. The attacker registers 30,001 codes after it. In the script they're inserted with the same columns a successful `cb_class_new` writes; the cost is in the calls (below).
3. 16 days pass. The state: 0 live, 30,002 held, target held. `cb_health` shows `classes 0.0`, `held 1.0`, `overdue 0`.
4. From another address, `cb_class_new('TGT-001', 'ATTACKERKEY00002', '0.31.0')` answers `{"ok": true}`. Held drops to 29,002, and the target is among the 1,000 released.
5. On day 20 a student sends `cb_submit('TGT-001', …, 'Maria G.', … 81 …)`: `{"ok": true}`.
6. The attacker's `cb_class_read` returns `Maria G.`, `81`.
7. The instructor's read answers `{"error": "key"}`. Turn results back on answers `{"error": "taken"}`.

**Cost:**
- About 30,000 registrations, made after the target code and early enough to end before its lesson. Then one call.
- That's 151 IPv4 address-days (200 a day each) or 31 IPv6 /48-days (1,000 a day each). Five free tunnel-broker /48s do it in a week.

**Silence:**
- While the codes are live, `classes` reads 0.3, under the deploy's 0.5 warning.
- `held` jumps to 1.0 only when they end, and the attacker's call can come the same minute.
- The daily watch fails the next morning, after the fact. The runbook has no step to give an evicted code back to its owner.

**Collateral:** every held code older than the batch is released in 1,000-code steps. That includes every planned code waiting for its lesson, and every code whose class ended with results, whose late sends then go to whoever registers it.

**Why it's new:** at `0541eeb`, held codes were never released early, so this takeover was impossible until day 44. My round-9 fix option 1 suggested evicting the oldest held codes. That suggestion was wrong.

**Fix:**
- Never release a held code early. When live plus held reaches the cap, refuse new codes with `full`, which the deploy and the watch already read. A flood then becomes a visible denial of service, not a silent takeover.
- Or keep a separate held cap that refuses rather than evicts.
- Add a test with 30,001 held codes.

**Effort:** S.

### R3.10-02 · Medium · The end-of-shift arrest rule counts from the wrong clock: arrivals in arrest are excused, and a code already queued is punished as unrun

**Location:**
- `src/engine.js` 4409: `age = G.t - (p.tArrest != null ? p.tArrest : G.t)`. `tArrest` is set only by `toArrest` (line 3525). Arrivals with `arrest: true` (case `arrest`, line 702) never get one, so their age is 0.
- `arrestNoTeam` (line 2307) and the card's countdown (`ui.js` 989) both use `p.tArrest ?? p.tArrive`.
- The `arrestOpen` filter `p.ev !== 'doing'` counts a code the attending has asked for but not started (`ev 'q'`).

**Reproduction** (`eng/queued_arrest.js`, 3 seeds each, same result):
1. 14 minutes before the end, the attending runs a code on patient A and answers every rhythm check right.
2. Patient B, also theirs, is in arrest. They tap Run the code (`assign`), and B's code queues behind A's.
3. Variant 1, B arrived in arrest:
   - `arrestOpen 1`, `arrestLeft 0`;
   - legal risk 0 → 0, no M&M;
   - `mdArrestOpen` sent as 0.
4. Variant 2, B arrested in the room:
   - `arrestOpen 1`, `arrestLeft 1`;
   - legal risk 0 → 15, and −40 to the attending's score;
   - M&M: "Rosa T. was in cardiac arrest when the shift ended (14 min), and nobody was running the code".

Also `eng/arrival_arrest.js`: an own arrival in arrest left 15 minutes, nothing queued, gets no penalty, no M&M, and is sent as 0.

**Impact:**
- The instructor's "left in an unrun arrest 5+ min" column under-counts arrivals and blames a code the student did call.
- STATUS's "an own arrest at least 5 minutes old" is false for arrivals.
- The round-8 principle "never cheaper than running it" (R5.8-03) no longer holds for an arrival arrest at the end of the shift.

**Fix:**
- Take the age from `p.tArrest ?? p.tArrive`, as `arrestNoTeam` does.
- Don't count an arrest whose code is queued on the attending as unrun, or count only the minutes the attending was free.
- Add `rules13.js` cases for both.

**Effort:** S.

### R3.10-03 · Medium · Enter on "Forget this key" puts the focus on the next class's Show key; a second Enter shows that key on the projected sheet

**Location:**
- `src/ui.js` `morph()` lines 27 and 30–35: the new fallback `f[Math.min(at, f.length - 1)]` picks the focusable at the old index.
- `cbListHTML` line 2232: the confirm replaces four controls (main, Show key, Copy key, Forget) with two (Keep, Forget), so the old index lands in the next row.

**Reproduction** (`ui/probe_kbd.py` K4–K5, Chrome 1280×800, three saved keys):
1. Tab to row `00S-84S`'s "Forget this key on this device" and press Enter. The confirm opens, but the focus is on row `01J-G53`'s **Show key**.
2. Press Enter again, as a keyboard user does to answer the confirm. `01J-G53`'s key `EEEE-FFFF-GGGG-HHHH` is drawn, and the confirm for `00S-84S` is still open. One Tab scrolls the key into view (`k4-tab.png`).
3. Keep: the focus goes to `01J-G53`'s **Results**. A second Enter opens that class's names and scores, though the sheet says "not on a projected screen".

A screen reader announces "Show key, button" and nothing about the confirm.

**Why it matters:**
- The key stays hidden until asked for precisely because this sheet gets projected (R5.6-02). This walks around that for any keyboard user.
- Round 9 introduced it (R4.9-03).
- The README says the sheet "keeps the focus in place after a confirm".

**Fix:**
- When a confirm opens, focus its safe button (Keep).
- When it closes, return the focus to the button that opened it, saved by its act and arg, as `U.opener` does for the sheet. Never fall back to an index.
- Add a `class_test` check.

**Effort:** S.

### R3.10-04 · Low · The fingerprint still passes a changed string

**Location:** `codeblack.fingerprint_parts()`, migration line 371: `btrim(regexp_replace(p.prosrc, '\s+', ' ', 'g'))`.

**Reproduction** (`db/fp_ws.sql`): in `clean_name`, change `'\s+', ' ', 'g'` to `'\s+', '  ', 'g'` (one space to two, inside the literal).
- The fingerprint stays `dcd21130a3b2c81b54b6a02804585d75`.
- `clean_name('Maria G')` returns NULL, so every two-word name is refused.

STATUS says "a changed string can't pass".

The comment "a hand edit to anything here, can't pass" also overclaims. It leaves out:
- triggers (`pg_trigger`);
- row-level security policies;
- the schema's grants;
- function and table owners.

**Fix:** normalise only line endings and each line's leading and trailing blanks, which a re-indented paste changes and a literal doesn't. Or narrow the claim.

**Effort:** S.

### R3.10-05 · Low · Well-formed junk sends still spend a campus's limit, and the runbook says otherwise

**Location:**
- `cb_submit` lines 283–286: the four `allow` calls come before the class lookup at 287–293.
- `supabase/README.md`, "Sending a result": "the code is registered and live, and the result's version matches the class's … checked before the call counts toward any limit, so junk sends can't spend a campus's limit".

**Reproduction** (`db/unknown_counts.sql`):
1. Send 600 results to `ZZZ-999`, a code nobody registered, from one address. All 600 answer `unknown`, and all count.
2. Then a real send from the same address to a live class answers `{"error": "busy"}`.

A classmate's loop with any six-character code still blocks the campus for the hour, as before round 9. STATUS lists R5.9-05 as fixed.

**Fix:** either look the class up (a primary-key read) before counting, and count unknown sends in their own bucket, or correct `supabase/README.md`, the SQL comment and STATUS.

**Effort:** S.

### R3.10-06 · Low · The code on screen still offers itself after its row learns another class has it

This is R3.8-04's `taken` half. It isn't listed in STATUS.

**Location:** `ACT.codeRegSaved`'s `taken` branch (ui.js 2703) updates the row only, not `U.reg`.

**Reproduction** (`ui/probe_reg.py` T, `t-taken-off.png`):
1. The registration times out. Tap Use it without results: `FG2-045` is shown with results off.
2. The row's Set up results answers `taken`.
3. The row now says "class ended · Another class has FG2-045 on the server now".
4. The panel above isn't struck through. It still has Copy and Play it, and still says "Try again sets results up for this same code". Only the panel's own Try again then marks it lost.

The row is also wrong twice:
- It says "class ended", though nothing ended: another class has the code.
- It says "Its key: Show key and Copy key, with the code above", but the results-off panel has neither button.

**Fix:**
- In the `taken` branch, when `U.reg.code === c`, set `U.reg.st = 'lost'`.
- Word the row as "another class has this code".
- Show the row's key buttons whenever the panel doesn't.

**Effort:** S.

### R3.10-07 · Low · The round-9 server rules are tested at their edges, not their logic

- **The cap:** nothing exercises it. `privacy_test.sql` only checks `cb_health(false) ? 'held'`, so deleting lines 239–241 still passes `db:test`.
- **The revival** (`db/mutation_revive.sql`): with `and c.expires_at < c.created_at + interval '30 days'` removed from it:
  - the shipped test "a class that got results and ended stays ended (no revival)" still passes. Its timestamps put the class exactly at the end of the 30-day hold, so the window condition refuses it first.
  - a used class 10 days into its hold is revived: `{"ok": true}`.

**Fix:**
- Add a test with 30,001 held codes (what is released, or, after R3.10-01, what is refused).
- Move the "stays ended" case inside the hold.

**Effort:** S.

### R3.10-08 · Low · On an upright phone the instructor key box is 14 px, so iOS Safari zooms in when it's focused

**Location:** `src/style.css` line 1028 (`@media (max-width: 480px)`). `ui/probe_font.py` measures `cbKey: 14px` at 390 px wide and 16 px at 844.

WebKit zooms the page into any focused input under 16 px, and the viewport meta has no `maximum-scale`. This is by reading and from WebKit's known behaviour; there's no iPhone here.

**Fix:** keep 16 px and recover the width from the letter spacing and padding, or let the box wrap.

**Effort:** S.

### R3.10-09 · Low · After one refused read, a planned code's row says "class ended" with no Results, even once students have started it again

**Location:**
- `ACT.cbShow`: a `key` answer saves `x: 1`.
- `cbListHTML` 2221: `ended = K.x || …` gives "class ended" with only Turn results back on.

**Case:**
1. The instructor checks a planned code on day 15, while it's held: the read is refused.
2. Students' sends on day 20 start the class again.
3. The row still says the class ended and offers no Results. The results are reachable only through Turn results back on, which happens to answer `ok` for the live class.

STATUS says such a row keeps "unless a student has sent one since, with Results to check". That is true only until the first refused read.

**Fix:** for an unused class (`K.e - K.t < 20` days) still inside its hold, keep that wording and Results even when `x` is set.

**Effort:** S.

### R3.10-10 · Nitpicks

1. **A send refused as full still starts a planned class again.**
   - A send answered `{"error": "full", "scope": "all"}` still revives the held class, for 30 days, with no result (`db/revive_full.sql`: made just now, ends in 30 days, 0 results).
   - That uses up its one revival: when it ends, the next send answers `unknown`.
   - The revival also skips the 100,000 live backstop.
   - Fix: revive after the full checks.
2. **The revival resets `created_at`.** The row's "made" date and the device's `K.t` become the revival date once Results is read.
3. **429 as busy is in the panel only.** The row's Set up results, Send and Results still say "The server had a problem" on a 429.
4. **Out-of-date error text.** The typed-key read error (ui.js 2771) still says results are "deleted 30 days after the code was made, or 14 if nobody sent one". Revival changed that.
5. **A stale generic plan can make `cb_class_new` take over a minute.**
   - In a session that first ran `cb_class_new` against an empty `classes` table, each later call took 79–89 s once 30,000 rows were in (`db/slow_repro.sql`).
   - The cached generic plan for `delete … where c.code in (select … limit 500)` is a nested loop with a sequential scan inside.
   - On live, autoanalyze and pooled-connection recycling make this window small.
   - Rewriting the three deletes with `using` or `ctid = any(array(…))` removes the cliff.
6. **The dialog's label.** Its `aria-label` is the heading's whole `textContent`, nested small text included.
7. **Focus after Delete.** After Delete in the results list, the focus skips a row and lands on the ✕ after next (K6).
8. **`deploy.txt`.** It still publishes the commit SHA and the run id (R3.9-06.7).
9. **Unlisted round-8 items.** R3.8-03 (the key box drops focus), R3.8-07 (Forget overwrites the clipboard) and R3.8-08 (a key pasted into Play a code) are still open and unlisted.

## 4. Coverage

**Read:**
- The whole round-9 diff of the migration, `privacy_test.sql`, `run.sh`, `db_live.js`, `db-watch.yml` and `pages.yml`.
- From `ui.js`: `morph`, `focusables`, `renderSheet`'s focus and opener logic, the keydown handlers (Tab trap, Escape, N), `cbRegister`, `cbFetch`/`cbNet`, `codeRegSaved`, `cbShow`, `cbDelGo`, `cbListHTML`'s states, `cbSendHTML`'s invalid state, `verdictOf`, `litHTML`, `ordLogHTML` and `mdReportHTML`.
- From the engine: `litAdd`/`litCheck`, `codeOutcome`'s `codeLost`, `leave`, `endShift`'s arrest rule, `signOrders`' new branches, `assign` and `toArrest`.

**Checked for XSS:** every new template interpolation. Each is `esc()`'d, a constant, or a number from the engine.

**Ran on PostgreSQL 16:**
- the forced release and takeover;
- anon and authenticated against `fingerprint_parts` and `fingerprint` (permission denied; `cb_health` gives only `fp`);
- the whitespace edit to the fingerprint;
- the cost of junk and busy sends;
- unknown-code sends spending the limit;
- the revival mutation;
- revival under a full backstop;
- the stale-plan slowdown.

**Ran in Node:** arrival and queued arrests at the end of the shift (6 trials), the assign path, and `npm test`.

**Ran in Chrome:**
- registration failures: 503, 500, 429, HTML, `{}`, abort, `full` and an 8-second timeout;
- the results-off code with its row answered `taken`;
- keyboard: open, the Tab cycle, Shift+Tab, Escape and the opener, Forget, Keep, Delete, and N in a shift;
- input font sizes at 390 and 844.

**Couldn't check:**
- PostgreSQL 17: whether `pg_get_expr` and `pg_get_constraintdef` print the same as 16, which the committed fingerprint assumes;
- the live gateway's 429/503 behaviour and the anon `statement_timeout`;
- iOS Safari's zoom on a real phone;
- GitHub Actions.

## 5. What I'd keep

- **Validation before counting in `cb_submit`.** It's the right order. Junk is now cheaper than a refusal.
- **`fingerprint_parts`.** One md5 per object, names you can diff, C-collation sorting, and no API access.
- **The HTTP split in `cbRegister`.** Only an abort, a timeout or `full` offers results off; a 429 is busy.
- **`codeLost` against `died`.** One count per death, whether the body has left or not, and a lost code alone isn't blamed on the student.
- **The Tab trap and opener restore.** Both work. Escape returns the focus to Class code, and N still works with the sheet focused.
- **The held-code rules themselves:** a hash only, `taken` to anyone else, an empty revive for the owner, a first send revives an unused class, and the 30-day end. They are sound. Only the early release is wrong.
