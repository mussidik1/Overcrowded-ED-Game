# Reviewer 5, round 10: Hardcore gamer, game critic and classroom user

**Build reviewed: `1ab6fa9` (v0.31.0).**
- Pinned with `git archive` into scratch and rebuilt there: `index.html`, `sw.js` and `3d/map3d.js` came out byte-identical to the committed ones.
- **Server: the real migrations.** PostgreSQL 16, en_US.UTF-8: `stubs.sql`, the baseline, then both migrations in order, the second at `1ab6fa9` (the version the owner will paste). `codeblack.fingerprint()` = `dcd21130a3b2c81b54b6a02804585d75`, the same as `supabase/tests/fingerprint.json`.
- Every `/rest/v1/rpc/*` call from the page went into the real functions as `anon`, with a fake `x-forwarded-for` per network: campus NAT `198.51.100.20`, instructor phone `2a02:26f0:1d:4::17`, classmates in `2a02:26f0:1d::/48`, a code-squatting student `2a00:1450:4001:829::200e`. Everything else was aborted. Nothing reached supabase.co or edcodeblack.com.
- **Time travel:** the page clock moved forward N days, the class rows back N days, and answer timestamps shifted so both agree.
- **Scratch:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round10/r5/` (`py/*.py`, `js/*.js`, `*.out`, `shots/`).

**Not re-reported** (STATUS reasons or owner decisions): bullets and full-width dots in names; the Send box sideways; `taken` not counted; one campus bucket; the clipboard after Forget; `full` still offering "without results"; validation-before-limits only for malformed codes; the verdict naming counts not patients; the replace question's scroll.

## 0. Round-9 status (my R5.9 findings)

| ID | Status | Evidence |
|---|---|---|
| R5.9-01 Medium: planned codes stop at 14 days, released at 44 | **Partly fixed** | Server side works (`s3r.out`): a planned code first used on day 14 at +6 h, on day 20 and on day 40 each took the student's result (`ok`), and the class restarted for 30 days. On day 45 a student's own key on the revived code got `taken`. But the card's new deadline is blank (**R5.10-02**). One Results check after day 14 makes the device row lie for the rest of the class's life, and the key can be dropped while the class still has results (**R5.10-01**). |
| R5.9-02 Medium: an own arrest seconds before the end gets the full penalty | **Partly fixed** | Arrests 1 and 3 min before the end now cost nothing (`end10.js`). The countdown is unchanged: at 08:58 and at 08:50 the card still says "**20m** before they are gone" (`s9r-late2.out`, `s9r-late10lit.out`). The grace is 5 *game* minutes, so 12.5 real seconds at 1× and 3 s at 4×. `Math.round` charges an arrest 4.5 min old (4.9 min: care −204 against −164, legal +15, M&M 90). |
| R5.9-03 Low: "Legal risk · Fired" on a full shift, plus a card after it | **Fixed** | `s9r-late10lit.out`: no card after the shift (`G.card` null), and the stage reads "Performance improvement plan". A leftover is in **R5.10-07**. |
| R5.9-04 Low: wrong end date, and Results first on an ended row | **Partly fixed** | A used class read during its life now reads "class ended: results deleted Dec 25 / Turn results back on" (TBP-R1S, days 31–59). A used class never reopened is still wrong. 0BB-R5F had 3 results on day 1. From day 14.25 to day 31 its row says "ended Dec 9 **with no results**, unless a student has sent one since" while the server kept those results live until Dec 25. Results on day 31 says "The server has no class". On day 45 the row says "code released Jan 8", but the server holds it until Jan 24. |
| R5.9-05 Low: junk sends spend the campus limit | **Fixed** | `junk.out`: 700 refused names from the NAT, then "Nadia" → `{"ok": true}`. |
| R5.9-06 Low: round-8 STATUS overclaims | **Fixed** | The round-9 STATUS corrects all five. It has new ones of its own: **R5.10-08**. |
| R5.9-07 Nitpicks | **Partly fixed** | **Fixed:** the saved row's busy text has the mobile-data hint. A refused delete hides ✕ and Delete all (`s5.out`: 0 and 0). **Still open:** `Jean‑Luc` (U+2011), `Ann‐Marie` (U+2010) and `O‘Brien` are refused with "letters only" (`s2r.out`). README:55 still leaves out Bengali in the joiner list. The page is 393 px wide on a 390 px phone, 397 on the summary (`s10.out`). |

**Counts:** Fixed 3, Partly fixed 4, Still open 0, Worse 0.

## 1. Verdict

**A 50-minute class on a code made this week: yes, solid. A code planned weeks ahead: the server now keeps its promise, but the instructor's own screen talks them out of reading the results. The attending's arrest feedback still can't tell a botched code from a perfect one.**

What works, against the real SQL:
- **Making codes on a projector:** fast (a code in 1.5 s). Busy and 429 read as busy with the mobile-data hint. Unreachable and a timeout offer Use it without results, and so does full. Try again recovers after a 429, 503 or 500.
- **Students:**
  - A cut-off send, a timed-out send and a double tap are kept once ("Seán": 1 row).
  - A failed send no longer marks the name box invalid.
  - Leaving unsent warns ("Not sent yet. Tap Send first…").
  - Junk names don't block the campus.
- **The instructor:** 31 results read on a phone with the caution. The troll was deleted with the ask in view. A network delete failure and a class-end refusal each say "Nothing was deleted" in the row. The CSV and Copy table have 28 columns, including "Of them, after a code they ran".
- **Keyboard:** Tab stays inside the sheet. The Forget ask takes the focus, and Escape answers no.
- **Regular play:** no RPC calls, no Send box, Menu leaves in one tap. `npm test` gives 717 ok with exit 0, and `class_test.py` says "No errors".

What is broken: R5.10-01 to R5.10-04 below.

## 2. Score

**6.5/10.** The server fixes are real: revival, junk sends, the end-of-shift legal stage. But each fix brought a new hole one layer up, in the UI and in the attending's feedback, and three of them are on the screens an instructor actually reads.

## 3. New findings, worst first

### R5.10-01 Medium: one Results check on an unused planned code marks it "class ended" for good. After students restart it, the row says "class ended" and then "code released", has no Results button, and the device can drop the key while the class still has results.
- **Where:**
  - `ui.js:2769`: a read refused with `key` saves `x: 1`.
  - The saved-code row, `ui.js:2221–2228`: `ended = K.x || …` shows only Turn results back on. `gone` is computed from the stale `K.e`.
  - `cbKeys` drops a key at `K.t + CB_KEEP` (60 days from the original `t`).
  - Second migration, `cb_submit`: revival resets `created_at`/`expires_at` (up to day 44 + 30 = day 74).
- **What happened (`s3c.out`):**
  1. On the PC, Manic Monday EBT-08D was made on Nov 25 for a later lesson.
  2. **Day 16.** The row says "ended Dec 9 with no results, unless a student has sent one since (a first result before Jan 8 starts it again): **Results checks**". The instructor taps Results, which answers "The server has no class for EBT-08D now… Turn results back on to use the code again." The row is now "class ended / Turn results back on".
  3. **Day 40, the lesson.** Pia, Quinn and Rosa send, each `{"ok": true}`. The server now has "EBT-08D made Jan 04 until Feb 03 (3 results)". The row after a reload still says "class ended / Turn results back on", with no Results button.
  4. **Days 45 and 59.** The row says "class ended; **code released Jan 8**". The server holds a live class with 3 results until Feb 3.
  5. **The only way back** is to tap Turn results back on, on a row that says the code was released. It works ("results until Feb 3", 3 results), because the class is live, so nothing is deleted.
  6. **Without that tap** (`s3r.out`, 1PT-G1J, revived on day 40 with 1 result): on **day 61 the code is no longer listed**. The device dropped the key 60 days after the original `t`, while the server keeps the class and its result until day 70. Nobody can read or delete that result now.
- **Why it matters:** the row's own wording invites the check that breaks it. An instructor who reads "code released" after a lesson concludes the results are gone and taps Forget.
- **Fix:**
  - On a `key` refusal for a class that never had a result and is still inside its hold (`K.e + 30 d > now`, `K.e − K.t < 20 d`), keep the "ended with no results, unless…" state and keep Results. Better: have `cb_class_read` say `ended`/`held` for the owner's key instead of looking unknown.
  - Never print "released" from a local guess once the server could have restarted the class. Say "released by Jan 8 unless a student sent a result: Results checks".
  - Keep keys until `max(K.t, K.e) + 60 d`.
- **Effort:** S.

### R5.10-02 Medium: the code card's new restart deadline is blank on every code: "a student's first result before starts it again"
- **Where:** `ui.js:2175`. `cbDate((R.exp || made + 14 * 864e5) + 30 * 864e5)`: `R.exp` is the server's ISO string (`U.reg.exp = r.expires`), so `+ 30 * 864e5` concatenates text. `new Date()` is invalid, and `cbDate` returns `''`.
- **What happened (`s3r.out`, the first line):** "Results are deleted on Dec 25 once a student sends one. If none has by Dec 9, the class ends, but a student's first result **before starts** it again for 30 days: a code made ahead of a class still works then."
- **Why it matters:** this sentence is the round-9 fix for R5.9-01's "nothing at making time says so". The one date a planner needs (the last day students can restart the code) is the one that is missing. It shows on every registered code, at the moment every instructor reads the card. `class_test.py` passes over it.
- **Fix:** `Date.parse(R.exp)`. Add a test that the card has no doubled space and holds two dates.
- **Effort:** XS.

### R5.10-03 Medium: a code run with every rhythm check wrong, then lost, gets the same verdict and the same instructor line as a perfect code
- **Where:**
  - `engine.js:2274`: `if (C.me) p.codeLost = …` whatever `C.right` is.
  - `ui.js:3061` (`verdictOf`): `if (m && cl && R.stars >= 2) return 'You ran the code and lost a patient: many arrests don’t come back, even when the code is run well.'`.
  - The results row: "(1 of them died, after a code they ran)". The CSV: "Of them, after a code they ran". `CB_MDNOTE` adds "Many patients who arrest die even after a well-run code".
- **What happened (`s9r-lost.out` against `s9r-wronglost.out`, the same patient, the same class code, real `cb_submit` and read):**
  - **By the book:** "Shock now", "Shock again, then epinephrine", "Shock, then amiodarone"; called.
  - **All wrong:** "Epinephrine 1 mg IV first, then shock at the next rhythm check", "Amiodarone 300 mg instead of a second shock", "**Adenosine 6 mg rapid push**" in VF; called.
  - **Both verdicts:** "1 patient died in the department. You ran the code and lost a patient: many arrests don't come back, even when the code is run well."
  - **Both sent:** `"mdDied": 1, "mdCodeLost": 1`.
  - **Both instructor rows:** "saw 1 patient (1 of them died, after a code they ran)".
  - Only the M&M tells them apart ("0 of 3 rhythm checks right").
- **Also (`vd.py`):** at three stars, a lost code hides everything else. With `dxWrong: 2` or `contra: 1` plus a lost code, the verdict is still the consolation line. "Diagnoses to review" and "Orders to review" are never named.
- **Why it matters:** the game's headline consoles a student for giving adenosine in VF. The instructor's only number files that student with the one who ran ACLS perfectly. The round-9 STATUS gates the M&M on right answers, but not the verdict or the number sent.
- **Fix:** keep `codeLost` only when `right === n && wait <= 3` (or send `mdCodeLostClean` beside it). Give a code with errors its own verdict ("You ran the code, but N of M rhythm checks were wrong: read the M&M"). Let the three-star "read these sections" line come after the code line.
- **Effort:** S.

### R5.10-04 Medium: a server outage (any 5xx) leaves the class with no code at all
- **Where:** `cbRegister`'s catch, `ui.js:2164`. `net` is true only for `network`/`timeout`, so `http` 5xx gives "The server had a problem. Try again in a minute." with Try again and nothing else.
- **What happened (`s1r.out`, projector):**
  - **503:** `''` (no code) / "The server had a problem. Try again in a minute." / buttons: Try again. Without results offered: False. The same for 500.
  - **Unreachable (aborted):** Try again / Use it without results.
  - So the workaround is to **turn off Wi-Fi**, so that the fetch fails and the game offers the button.
- **Why it matters:**
  - A hosted database that is down or degraded answers 5xx from its gateway; it does not go silent. During an outage, the 50-minute lesson gets no shared shift at all.
  - Round 9 removed the fallback for 5xx to stop "errors others can cause" (R3.9-02). A student can cause a 429. A student cannot cause a 503.
- **Fix:** offer Use it without results after a 5xx, at least on the second failed Try again, with the existing "tell students not to Send" text. Keep 429 as busy.
- **Effort:** XS.

### R5.10-05 Low: an own arrest left at the end under 5 minutes old shows in the summary's table, while the verdict and the M&M say all is well
- **Where:** `endShift`, `engine.js:4407`: `arrestOpen` counts every own open arrest, and `md.arrestOpen` feeds the table row. Only `arrestLeft` reaches the verdict, the M&M and `mdArrestOpen`.
- **What happened (`s9r-late2.out`):** Wei K. arrests at 08:58 and is ignored.
  - The table: "Your own patients still in cardiac arrest at the end, with no code running **1**".
  - The verdict: "Solid shift. The nurses like working with you."
  - The M&M: "Nothing went badly wrong this shift. **Take the win.**"
  - Sent: `mdArrestOpen: 0`, and the instructor's row says nothing.
- **Fix:** show `arrestLeft` in the table, or label the under-5-minute case ("arrested in the last 5 minutes: not counted").
- **Effort:** XS.

### R5.10-06 Low: a code still running when the shift ends vanishes from every record
- **Where:** `endShift`: `arrestOpen` skips `p.ev === 'doing'`. A code takes about 15 game minutes to resolve (`codelen.js`: "codeend … @15.1", "@15.2").
- **What happened (`s9r-run10.out`):** an own arrest at 08:50 was run with all three checks right. At the end the patient is still `arrest: true, ev: 'doing'`.
  - The summary: "Solid shift" and "Nothing went badly wrong this shift. Take the win."
  - Nothing about the code reaches the instructor.
  - A code started in the last 15 minutes is never resolved, whether it was run well or badly. A badly run one leaves no M&M line once its cards are filtered out (`end10.js` RUN wrong at 1–15 min: its wrong cards appear only as 25-point M&M items).
- **Fix:** at the end, list "code still running at the end of the shift (N checks, M right)" in the summary and the M&M.
- **Effort:** S.

### R5.10-07 Low: legal risk added at the end can pass the firing line with no consequence and no word
- **Where:** `litAdd` skips `litCheck` once `G.over`. `litHTML` names the stage from `litStage`.
- **What happened (`s9r-late10lit.out`):** legal risk 62%, then an own arrest left 10 minutes. The box reads "**76%** Legal risk · Performance improvement plan". The game's own firing text says "Legal risk reached 75%, and the group ended your contract".
- **Fix:** cap the end-of-shift addition below 75, or add a line: "76%: past the firing line after the shift ended; it would have ended your contract."
- **Effort:** XS.

### R5.10-08 Low: round-9 STATUS overclaims
- "**a code made ahead works up to 44 days after it was made. The code panel says so**": the panel's date is blank (R5.10-02).
- "**Past the hold it says when the code was released**": it also says so for revived classes that are live with results (R5.10-01).
- "**An unused class past its end says it ended with no results unless a student has sent one since**": it says "with no results" for a used class never reopened too (0BB-R5F, R5.9-04).
- "**It applies only to an own arrest at least 5 minutes old**": `Math.round` makes 4.5 minutes count (4.9 min was charged in `end10.js`).
- **Effort:** XS.

### R5.10-09 Nitpick: small things
- **Keyboard:** pressing Enter on a level button disables it during saving, and the focus drops to `BODY` (`kb.py`: "focus now: BODY"). A keyboard user starts over from ✕.
- **Refused delete:** it says "the server has deleted all its results". They are still there until the hourly job at :41 (`s5.out`: "on server 30").
- **README:55:** it still says "Everything sent for a code is deleted 30 days after the code was made". A revived class keeps results to day 74.
- **A planned code's row:** before day 14 it says "results until Dec 9 (Dec 25 once a student sends)". For a code first used after Dec 9, it will be 30 days after that send.
- **The end-of-shift legal step:** it is 15 points either way. Once over the 5-minute grace, an arrest 5 minutes old costs the same as one 19 minutes old (`end10.js`: 5.1, 8 and 15 min each cost care −40, legal +15, M&M 90).

**Counts:** Critical 0, High 0, Medium 4, Low 4, Nitpick 1 (9 total).

## 4. Coverage

**Instructor (real taps, real SQL):**
- **`s1r.py`, projector:** fast; busy (62 well-formed calls); 429; 503; 500; unreachable, then Use it without results; timeout past 8 s; full (100,041 live classes); Try again after each.
- **`s3r.py`, classroom PC:** days 0, 1, 8, 13, 14.25, 15, 20, 25, 31, 40, 45, 59 and 61.
  - Codes: a used class read on day 8; a used class never read; planned codes for day 14 +6 h, day 20 and day 40.
  - Each row's text and buttons; Results; a student squatting the code on day 45.
- **`s3c.py`:** a planned code checked on day 16, revived on day 40, then days 45, 59 and 61, with Turn results back on.
- **`s5.py`, phone:** 31 results; the caution; deleting the troll; a network delete failure; a refused delete at the class end; the PC's Copy table and CSV (BOM, CRLF, 28 columns).
- **`kb.py`, keyboard only:** title → Play a shift → Class code → make a code → the Tab ring → Forget's ask → Escape.

**Students:**
- **`s2r.py`, tablet on the NAT:** a real class shift; names with U+2011, U+2010 and U+2018; bad Wi-Fi; typing after a network error; a timeout; retry plus a double tap (kept once); leaving unsent.
- **`junk.out`:** 700 junk names, then a real send; 600 valid sends (the class cap of 500); a real send after that.

**Attending (`s9r.py`, sideways phone, class code 062-83V, real `cb_submit` and instructor read; `end10.js` and `codelen.js` in Node):**
- An own arrest run by the book and lost.
- One run all wrong and lost.
- One abandoned (dies with no code at 20 minutes).
- One 2 minutes before the end of a Rush; one 10 minutes before the end with legal risk at 62%; one run 10 minutes before the end.
- Ignored and run at 1, 3, 4.9, 5.1, 8 and 15 minutes before the end.
- The verdict with three stars and a wrong diagnosis, and its variants (`vd.py`).

**Regular play:**
- `s10.py`: Quiet Tuesday as charge nurse and an attending Rush. No RPC calls, no Send box, Menu leaves in one tap; widths checked.
- `npm test`: 717 ok, exit 0. `test/class_test.py`: "No errors", exit 0.

**Not covered:**
- Real Safari and Firefox, a real NAT, the live project, 3D, the gate, a release mid-course.
- Arrests were started with `OC.toArrest`.

## 5. What I'd keep

- **The server's revival:** a planned code used on day 14 at +6 h, day 20 or day 40 just works. A student can't take it over during the hold.
- **Junk sends** no longer close the campus.
- **The code on screen is always real**, and full or unreachable still gives a playable shift with an honest warning.
- **Sends are kept exactly once** however a student's Wi-Fi fails, and a network error no longer blames the name.
- **Delete errors sit in the row**, and an ended class hides the buttons that can't work.
- **The arrest rules now separate** an abandoned code, an unrun arrest at the end and a code that was run. The legal box no longer says "Fired" on a full shift.
- **Regular play is untouched** by any of it.
