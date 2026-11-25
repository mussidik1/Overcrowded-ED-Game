# Round 11 · Reviewer 3 (game tech, security, privacy) · v0.31.0 at e3fbeec

Scratch: `scratchpad/round11/r3/` (`attack1.sql`, `t2.sql`, `cost.sql`, `litcard.js`, `litcard0.js`, `dbtest.txt`).
Local database: `npm run db:test` on PostgreSQL 16 (`KEEP=1`), 228 `ok`, exit 0, then reused for the attacks below.
Nothing touched supabase.co or edcodeblack.com.

## 0. Round-10 status

| Finding | Status | Evidence |
|---|---|---|
| R3.10-01 cap lets anyone release a planned code and take it | **Partly fixed** | The order is now newest-ended first, and the code being registered is excluded. A planned code that ended *before* the flood survives. A planned code that ends *after* the flood is the first to go, and two calls take it (R3.11-01, run end to end). |
| R3.10-02 end-of-shift arrest rule used the wrong clock | **Partly fixed** | An arrival in arrest now counts from the door (`engine.js` 4413). The queued half is unchanged: `arrestOpen` still filters on `p.ev !== 'doing'`, so a code already queued behind the code the attending is running is penalised, and the M&M still says "nobody was running the code". |
| R3.10-03 Forget moved the focus to the next Show key | **Fixed** | `keyForget`, `keyForgetNo` and `keyForgetGo` set `U.focusTo`. `class_test.py` passes its check: Forget goes to Keep, Keep goes back to Forget, Forget goes to the sheet. |
| R3.10-04 the fingerprint passes a changed string | **Still open** | `fingerprint_parts` still collapses `\s+` inside the body. The migration is frozen now, so this needs a new file. STATUS lists it under "Lows wait". |
| R3.10-05 well-formed junk sends still spend a campus's limit | **Still open** | `cb_submit` still runs the four `allow` calls before the class lookup. `supabase/README.md` still says the class and version are "checked before the call counts toward any limit". |
| R3.10-06 the code on screen offers itself after its row learns it's taken | **Still open** | `codeRegSaved`'s `taken` branch (ui.js 2705) still never touches `U.reg`. |
| R3.10-07 round-9 rules tested only at their edges | **Partly fixed** | A 30,001-code cap test exists, but only for the case that works: the planned code ended 6 days ago and the flood 1 day ago. The case that fails isn't tested. The "stays ended (no revival)" case is still exactly on the 30-day boundary (`privacy_test.sql` 413). |
| R3.10-08 the 14 px key box makes iOS zoom | **Fixed** | `style.css` 1028: 16 px. |
| R3.10-09 one refused read marks a planned code ended | **Fixed** | `cbShow` doesn't set `x` for an unused class still inside its hold. |
| R3.10-10 nitpicks | **Partly fixed** | Fixed: 7 (Delete now focuses `#cbHead`). Still open: 1 (a `full` send still revives a class), 2, 3 (a 429 still reads "The server had a problem" in rows, Send and Results: `cbNet`), 4, 5, 6, 8 (`deploy.txt`), 9. |

**Totals:** 3 fixed, 4 partly fixed, 3 still open, 0 worse.

**Overclaims in STATUS and the docs:**
- STATUS, "Fixed": *"The held-code cap released real codes … a flood ends after the real classes it would push out … `privacy_test.sql` checks a planned code survives a 30,001-code flood."* That holds only for classes that ended before the flood. Every real class that ends after it is released first.
- `supabase/README.md`: *"never the code being registered, so one call can't free a code and take it."* That's true for one call. Two calls do it.
- CLAUDE.md and README.md: *"its code is held 30 more days … (so nobody else can take it …)."* That's false once a flood is in place.
- STATUS lists R3.10-02 under R1.10-02 as fixed. Only the arrival half is.

## 1. Verdict

**Ship v0.31.0 to students for play. Ship class results with your eyes open, and put R3.11-01's fix in the next migration.**

There is no Critical and no High. The game itself is sound:
- the committed build matches the source (rebuilt in a scratch copy: `index.html`, `sw.js` and `3d/map3d.js` are byte-identical);
- `npm test` is green (720 `ok`, no `FAIL`);
- `class_test.py` is green on Chrome.

**R3.11-01 (Medium, privacy) is still a takeover path.** It needs about 30,000 throwaway registrations, which is about a week from one IPv6 /48, or a day from about 150 IPv4 networks. Two calls then claim any planned code that ends after the flood. Students who tap Send then send their names and scores to the attacker.

What softens it:
- the daily watch fails once held codes reach 0.5 of the cap;
- the attacker must time the target's end.

What doesn't: there is no runbook for clearing a held flood.

That's a real, if expensive, attack on student data. Fix it before class results are advertised widely. It isn't a reason to hold the game.

## 2. Score

**6 / 10** (round 10: 6). The round-10 fixes are mostly real and nothing got worse. But the main security fix only moved the hole, and its test checks the one ordering that works. One fix adds a new regression (R3.11-02). Three of my round-10 Lows are untouched.

## 3. New findings, worst first

### R3.11-01 · Medium · A flood still releases and hands over any planned code that ends after it, in two calls

**Location:** `supabase/migrations/20261125120000_codeblack_round6.sql`, `cb_class_new`, lines 239–245 (the `order by x.expires_at desc limit 1000` release, before the `taken` check).

**Reproduction** (`scratchpad/round11/r3/attack1.sql`, run against the `db:test` database):
1. Insert 30,000 attacker codes made 24 days ago. They ended 10 days ago and are now held. In real life, that's 30,000 `cb_class_new` calls 24 days earlier.
2. Insert the instructor's planned code `PKN-X01` (key K2): made 15 days ago, no result, ended 1 day ago, held for K2. Held count: 30,002.
3. Attacker, call 1, any new code: `cb_class_new('ATK-001', KA, '0.31.0')` gives `ok`. It also deletes the 1,000 most recently ended held codes. `PKN-X01` is the newest, so it goes first.
4. Attacker, call 2: `cb_class_new('PKN-X01', KA, '0.31.0')` gives `{"ok": true, …}`.
5. A student sends to `PKN-X01` and gets `{"ok": true}`.
6. Attacker: `cb_class_read('PKN-X01', KA)` gives `rows: [{"name": "Maria", "score": 77, …}]`.
7. Instructor: `cb_class_read('PKN-X01', K2)` gives `{"error": "key"}`. Turning it back on gives `{"error": "taken"}`.

Notes:
- The trigger needn't be the attacker. Any instructor's registration while held is over 30,000 releases the newest-ended 1,000.
- `t2.sql`: each call while over the cap takes 13–20 ms and deletes exactly 1,000.
- Newest-first also makes things worse under organic load. Past the cap, it releases exactly the codes still in their 30-day revival window, which are the ones a class is about to use, and keeps codes 29 days into their hold.
- `cb_health` reports `held` to a tenth. An attacker can see when the count is near the cap (1.0 means at least 28,500).
- The runbook (`supabase/README.md`, "Backstops") says to delete live classes, "not held codes". There is no procedure for a held flood, which is exactly what the watch would alarm on.

**Fix:** a new migration. Past the held cap, refuse new codes (`full`) instead of releasing held ones: a denial of service is better than a takeover. Or store held codes in a separate, compact table (code plus key hash, about 100 bytes) with a cap high enough that a flood costs real money. Also:
- add the "held flood" deletion SQL to the runbook (held codes `created_at` in the attack window, no results ever, which `codeblack` can't tell apart, so use the window);
- correct STATUS, README, CLAUDE.md and `supabase/README.md`;
- add the failing ordering to `privacy_test.sql`: a planned code that ends after the flood.

**Effort:** M (a migration, a test, the docs).

### R3.11-02 · Low · A badly run, lost code that crosses a legal-risk threshold loses its "The code is called" debrief card

**Location:** `engine.js` 2278–2281. The new `litAdd(10, …)` runs before `codeEnd(p, false, n)`. `litAdd` calls `litCheck`, which takes `G.card` with the administrator, peer-review or PIP card. `codeEnd` then returns at `if (… || G.card) return;`.

**Reproduction** (`scratchpad/round11/r3/litcard.js`): the attending's own `cwp` patient arrests, seeds 8200 and up, and every rhythm check is answered wrong.
- With `G.lit = 20` before the code, the card sequence is `code, coderes ×3, lit` in 7 of 7 lost codes. No `codeend`.
- `litcard0.js`, the same with `G.lit = 0`: `code, coderes ×3, codeend` in 7 of 7.

The debrief (*"0 of 3 rhythm checks right · a doctor took over fast … Not every arrest comes back"*) disappears for exactly the codes that went wrong, the ones the teaching needs. The M&M keeps the facts, at the end of the shift.

**Fix:** call `codeEnd` before `litAdd`/`mm`, or have `litCheck` wait while a code card is due (`lawTick` already re-checks every tick).

**Effort:** S.

### R3.11-03 · Low · "Run by the book (every rhythm check right, a doctor there within 3 minutes)" is told to students for codes nobody answered

**Location:**
- `engine.js` 2276: `book = C.wait <= 3 && (!C.me || C.right >= n)`;
- `ui.js` `cbWhatAll` ("a code run by the book (every rhythm check right, a doctor there within 3 minutes)");
- `cbDet`, `cbTable` ("Of them, after a code run by the book"), `verdictOf`, About.

A code the game's doctor ran (`C.me` false) counts as "by the book" on timing alone. Yet `codeOdds` models that doctor as partly right (`CODE_AI_Q = 0.6`), and no rhythm check was answered. The Send box states a definition that is false for those rows. The instructor's column mixes the two.

**Fix:** label the AI-run case separately ("after a prompt code another doctor ran"), or word the definition to cover both.

**Effort:** S.

### R3.11-04 · Low · The 5xx fallback rests on "a classmate can't cause it", but the 8-second timeout already offers the same button

**Location:** `ui.js` 2164 (`net = … || e.status >= 500`) and its comment.

Not exploited here; this is by reading. A network that drops or delays the call (a school's TLS proxy, a captive portal, a saturated free-tier pool) already gets "Use it without results" through `timeout` or `network`. The 5xx case adds no new exposure. But the comment's reasoning is the same one round 9 rejected for 429.

The panel's warning ("whoever registers this code first gets what students send") is the real mitigation. Say so in the comment instead.

**Effort:** XS.

### R3.11-05 · Nitpicks

1. **`U.focusTo` selectors are built from unescaped values.** `cbDelNo` uses `[data-arg="${L.ask}"]`, where `L.ask` is the server's result id. `render()` calls `$()` outside the `try`, so an id containing `"` would throw inside the frame loop. Ids are `uuid` today; `CSS.escape` would make it robust.
2. **`verdictOf` returns HTML and interpolates numbers raw.** These are `m.died`, `m.dispoWrong` and `R.expired` (line 3098), from `oc-last-report` in storage. Only same-origin storage can feed it, and the CSP blocks inline handlers, so it's not exploitable. Still, wrap them in `+x | 0`.
3. **The `held` field rounds to a tenth and saturates at 1.0.** Once a flood sits at the cap, the watch fails daily with no further information.
4. **Round-10 nitpicks 1–6, 8 and 9 are still open** (see section 0).

## 4. Coverage

- **Read:** BRIEF rounds 10 and 11, STATUS, my round-10 report, the whole `git diff 1ab6fa9..e3fbeec` for the listed paths, `cb_class_new`, `cb_submit`, `cb_class_read`, `cb_class_delete`, `cb_health`, the fingerprint functions, and the client's registration, row, read, delete, focus, Escape and N code paths. Also `codeOutcome`, `codeStart`, `arrestNoTeam`, the `endShift` arrest block, `litAdd` and `litCheck`, and `verdictOf`.
- **Database** (PostgreSQL 16, `db:test` kept, then attacked):
  - the held cap takeover, end to end (R3.11-01);
  - trim cost and batch size (`t2.sql`);
  - uncounted invalid sends: about 50 µs each, 0 rate rows (`cost.sql`), which is no amplification;
  - `fingerprint_parts`, `fingerprint` and `tidy` are not executable by `anon` or `authenticated`;
  - `cb_health` returns only summary fields (`held: 1.0` after the flood);
  - revival by first send: a send revives the class under the original key hash. A prankster who knows a held unused code can only add a deletable junk row and restart its 30 days; the results stay the instructor's;
  - the /48 health test passes in `db:test`.
- **Engine:** `litcard.js` and `litcard0.js` (R3.11-02).
  - `codeLost` is counted once: at the `expired` outcome or in `deadHere`, as round 10 found. Unchanged.
  - `toArrest` clears `p.code`, so a re-arrest doesn't carry the old code's `wait`.
  - The after-ROSC order log is unchanged since round 10 (deduplicated).
- **Client:** the build matches the source; `npm test` is green; `CHROME_PATH=/usr/bin/google-chrome python3 test/class_test.py` reports no errors, including the Tab trap, Escape, opener restore and Forget focus. Every new template interpolation in the diff is `esc()`'d, or is a number, a constant or a validated code.
- **Not done:** WebKit, a real phone, Supabase's gateway behaviour on statement timeout, and the IPv6 cost of the flood on real providers (estimated from the limits).

## 5. What I'd keep

- `db:test`: frozen-migration checks, run twice, refusal paths, then attackable on a real Postgres in minutes.
- Junk calls are validated and refused before they count, and are cheap.
- The focus and Escape plumbing for the class sheet is now consistent, and tested.
- The committed build is reproducible byte for byte.
