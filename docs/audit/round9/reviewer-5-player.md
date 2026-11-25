# Reviewer 5, round 9: Hardcore gamer, game critic and classroom user

**Build reviewed: `ba471b7` (v0.31.0).**
- I pinned the review with `git archive` into a scratch copy and rebuilt it there. `index.html`, `sw.js` and `3d/map3d.js` came out byte-identical to the committed ones.
- **The second migration is the `ba471b7` version**, the one the owner will paste. On my database `codeblack.fingerprint()` is `ba875605…`, the same as `supabase/tests/fingerprint.txt`.

**The server was the real migrations, not a stub.**
- A throwaway PostgreSQL 16 (C.UTF-8) loaded `stubs.sql`, the baseline, then both migrations in order. A second database in en_US.UTF-8 (the live locale) checked the name rule.
- Every `/rest/v1/rpc/*` call from the page went into the real functions as `anon`, each with a fake `x-forwarded-for` for its network:
  - IPv4: the campus NAT `198.51.100.20`.
  - IPv6: the instructor's phone `2a02:26f0:1d:4::17`, a troll `2a01:4f8:aa:bb::1`, a student who squats codes `2a00:1450:4001:829::200e`, and classmates in `2a02:26f0:1d::/48`.
- All other traffic was aborted. Nothing reached supabase.co or edcodeblack.com, and the logs show no blocked request.

**Time travel:** the page clock moved forward N days and the class rows moved back N days. The answers' timestamps were shifted so both clocks agree. N could be a fraction of a day, to test the hour of day.

**Scratch:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round9/r5/`
- `py/db.py`, `py/common.py`: the fake REST front and the browser helpers.
- `py/s1.py` … `py/s10.py`, `js/end.js`: the scenarios.
- `*.out`: their output.
- `shots/`: screenshots.

**Not re-reported** (a STATUS reason or an owner decision):
- Bullets (U+2022, U+2219) and full-width dots in names.
- The Send box on a sideways phone (Phase 5).
- Not counting `taken` answers against the limit.
- The campus sharing one rate-limit bucket (accepted in round 6). R5.9-05 is only about the part round 8 said it had fixed.
- Copy key, then a reload, then Forget leaves the key on the clipboard, and so does Copy table. STATUS lists both as limits. They are unchanged (`s4b.out`).

## 0. Round-8 status (my R5.8 findings)

| ID | Status | Evidence |
|---|---|---|
| R5.8-01 Medium: busy or full gives no code | **Fixed** | `s1.out`. **Full** (100,036 live classes) now offers **Use it without results**. The code plays, and the "off" text says "until then, whoever registers this code first gets what students send". While full, another network trying to register that code gets `full`. Try again after the backstop cleared registered the same code. **Busy** still shows no code, by design, but now says "Or make the code on your phone using mobile data (another network)". 80 malformed `cb_class_new` calls from the NAT no longer spend its limit (`s1.out` (d2)). |
| R5.8-02 Medium: a lapsed planned code can be taken over | **Partly fixed** | `s3.out` day 15: a student's own key on the lapsed planned code gets `{"error": "taken"}`. The 30-day hold works. But `s3b.out` day 45: an untouched planned code was released at day 44. The student registered it (`ok`), a classmate's result went in (`ok`), and the student read "Priya" with their own key. The device still listed it as "class ended: results deleted Dec 9". A planned code also stops taking results at day 14 (**R5.9-01**). |
| R5.8-03 Medium: an unrun arrest at the end recorded nowhere | **Fixed** | `s9-ignore.out`: an M&M line, legal risk +15, care −40 (`end.out`: −204 against −164 with no arrest). The summary row says "still in cardiac arrest at the end, with no code running: 1". `mdArrestOpen: 1` is sent, and the instructor's row and CSV column show it. The fix brings a new fairness hole: **R5.9-02**. |
| R5.8-04 Low: an ended used class vanished from the device | **Partly fixed** | `s3.out` day 31: the row reads "class ended: results deleted Dec 25", and the server still holds the code (another key gets `taken`). But the row's button is **Results**, which answers "The server has no class for 2X7-018 now". **Turn results back on** appears only after that. A class never reopened shows the wrong date (**R5.9-04**). |
| R5.8-05 Low: "The numbers were good" over an own death | **Fixed** | `s9-*.out`: "1 patient died in the department. One of your own patients died or was left in an arrest. Read the worst moments below." |
| R5.8-06 Low: results open on a projected screen without a caution | **Fixed** | `s5.out`: "Results show every student's name and score: not on a projected screen." It sits under the saved-codes list, and under Show results on the typed form. |
| R5.8-07 Low: real names refused | **Fixed** | `s6.out`: 150 names were checked by the game, the C.UTF-8 server and the en_US.UTF-8 server. 米高‧佐敦, 巴奈‧庫穗, בן־גוריון and র‍্যাচেল pass everywhere. `s2.out`: typed key by key on the iPad and stored as typed. Bullets are still refused (an owner decision). |
| R5.8-08 Low: round-7 STATUS overclaims | **Fixed** | The round-8 STATUS corrects all three. It has new overclaims of its own: **R5.9-06**. |
| R5.8-09 Nitpicks | **Partly fixed** | **Fixed:** older codes show "v0.30.0 · Attending · Full Moon Friday · General radio calls" (`s8.out`). A refused delete marks the row "class ended" (`s5.out`). **Still open:** the shown key is 249 px wide in a 225-px box on a phone (`s4.out`). "Tomorrow" means UTC midnight. Zalgo still passes, and so does `A‧‧‧‧‧‧‧‧` now. The page is 393 px wide on a 390-px phone (397 on the summary, `s10.out`). **Fixed only part way:** the ask sits under the code, but the sheet scrolls to it, so the code still moves (**R5.9-07**). A "taken" row hides Turn results back on only until the sheet is reopened (`s3b.out` day 59). |

**Counts:** Fixed 6, Partly fixed 3, Still open 0, Worse 0.

## 1. Verdict

**Usable in a 50-minute class if the code is made the same week. A month later the dates can lie. A code planned more than two weeks ahead is a trap.**

What works, end to end against the real SQL:
- **Making a code:** the code shows 0.19 s after the tap. Four stray taps change nothing, and the ask guards a projected code.
  - **Full:** Use it without results.
  - **Unreachable:** Use it without results. When a troll squats the code, Try again says "can't get class results. Tell students not to tap Send."
  - **A lost answer past 8 s:** Try again brings back the same code.
- **The students:**
  - Thirteen names in nine scripts were typed key by key and stored as typed, including the three round-8 additions.
  - A cut-off send, a lost answer and a double tap are each kept once.
  - An offline Send succeeds later from Last summary after a reload.
  - Leaving unsent warns.
- **The instructor:**
  - 32 results read on a phone, with the caution shown.
  - The troll deleted with the confirm in view.
  - A failed delete and a refused delete each say "Nothing was deleted" in the row.
  - The CSV has 27 columns, including the new arrest column.
- **The attending:** an own patient from before 07:00 who dies is counted. So is an own arrest left open at the end.
- **Regular play is unchanged** apart from the engine's new counts: no class calls and no Send box.

What is broken or fragile:
- **Planned codes (R5.9-01):** results stop being accepted 14 days after the code was made, to the hour, unless a student sent one. Nothing at making time says so.
  - Lesson on day 14, six hours later in the day than the code was made: every Send gets "isn't set up for class results".
  - Lesson after day 14: the same, until the instructor finds the row and taps Results, then Turn results back on.
  - Lesson after day 44: a student can register the code first and receive the class's results.
- **End-of-shift arrests (R5.9-02):** an own patient who arrests 24 game seconds before the end (about one real second at 1×) costs exactly what 20 minutes of ignoring them costs. The patient's card meanwhile says "20m before they are gone."
- **Smaller:**
  - "Legal risk · Fired" on a shift that ran to the end.
  - "Results deleted Dec 9" for results deleted Dec 25.
  - 601 junk sends close the campus's Send for the hour.

## 2. Score

**6.5/10.** All three round-8 Mediums are fixed or mostly fixed. The names are fixed. The classroom flow on the day is solid. But the hold fix left the most natural instructor plan, a code posted two to six weeks ahead, broken in three different ways. The arrest fix punishes a student for an event they had about a second to see.

## 3. New findings, worst first

### R5.9-01 Medium: a planned code stops taking results 14 days after it was made (to the hour), and is released at day 44; the card and the row never say so
- **Where:**
  - First migration, line 61: `expires_at … default now() + interval '14 days'`.
  - Second migration, `cb_submit` line 284 (`… and c.expires_at > now()`), the hold in `tidy()` (line 210) and `cb_class_new` (line 238).
  - `ui.js:2150`, the card: "Results are deleted on Dec 9 if no student sends one… The code is then held 30 more days…". The date has no time.
  - `ui.js:2194–2196`, the list row.
  - README.md:55 and supabase/README.md:36 describe deletion only, never that sends stop.
- **What happened (`s7.out`, real taps, real SQL):**
  1. On the PC, Manic Monday code V2N-88Z is made Nov 25 at 02:56 for a lesson on Dec 9. The card says "Results are deleted on Dec 9 if no student sends one, or on Dec 25 once one does. The code is then held 30 more days … so nobody else can take it."
  2. The evening before the lesson, the row reads "results until Dec 9 (Dec 25 once a student sends)".
  3. The lesson, Dec 9 at 08:56 (six hours later in the day). A student plays and taps Send. The answer: "V2N-88Z isn't set up for class results: its class may have ended, or been made on another version of the game. Show your instructor this summary instead." The server answered `{"error": "unknown"}`. Every student in the room gets this.
  4. The way out needs the device that holds the key: Results ("The server has no class for V2N-88Z now…"), then **Turn results back on**, then every student taps Send again. That worked.
- **Longer plans:**
  - **Day 21** (`s3.out`, MD9-8DN): every Send is refused (`unknown`) until the instructor does the same two taps. The row says only "may have ended Dec 9 (if no student sent a result): open Results to check".
  - **Day 45** (`s3b.out`, P38-084, never touched): the hold ended on day 44.
    1. A student registers the code with their own key: `ok`.
    2. A classmate sends "Priya": `ok`.
    3. The student reads it: `{"rows": [{"name": "Priya", …`.
    4. The instructor's row still says "class ended: results deleted Dec 9" with **Results**. Only Results, then Turn results back on, reveals "Another class has P38-084 on the server now".
- **Why it matters:**
  - A code planned ahead is exactly what goes into a syllabus or an LMS page weeks before the lesson.
  - The game's own wording invites it: "deleted on Dec 9 if no student sends one" reads as "students can send on Dec 9".
  - The round-8 STATUS calls the takeover fixed ("so a planned code posted ahead can't be taken over"). That holds only for 44 days.
- **Fix:**
  - Simplest: let `cb_submit` revive a held class that never got a result. The key's hash is still there, so the result goes to the right instructor. Reset `created_at`/`expires_at` on that first send.
  - At least, put on the card: "Make the code within two weeks of the lesson, or tap Turn results back on before class." Show the end time when it's within two days ("until Dec 9, 2:56 AM").
  - Past the hold, make the row say "released Jan 8: make a new code" instead of offering Results.
- **Effort:** S.

### R5.9-02 Medium: an own arrest in the last seconds of a shift gets the full "nobody ran the code" penalty, while the patient's card promises 20 minutes
- **Where:**
  - `engine.js:4403–4404`, `endShift`: `arrestOpen` takes every own patient in `p.arrest` with `p.ev !== 'doing'`, whenever the arrest began. Each gets `care(-40)`, `litAdd(15)` and `mm(90, '… nobody was running the code', 'Run the code: an arrest nobody runs is a death')`.
  - `ui.js:982`: the countdown `tArrest + ARREST_NO_TEAM` ("20m before they are gone"), with no cap at the end of the shift.
- **What happened (`s9-ignore.out`, attending Rush, class code 062-83V, real `cb_submit`):**
  1. Earl A., the student's own patient, arrests at 08:59:36 through `OC.toArrest`, the engine's own path.
  2. His card: "Run the code. Your patient has no pulse. Every minute without a doctor lowers the odds. **20m before they are gone.**"
  3. 24 game seconds later the shift ends. At 1× that is one real second; at 4×, a quarter of one.
  4. The summary: the worst moment "09:00 Earl A. was in cardiac arrest when the shift ended, and nobody was running the code", legal risk +15, "Your own patients still in cardiac arrest at the end, with no code running 1", and the verdict "One of your own patients died or was left in an arrest".
  5. Sent: `"mdArrestOpen": 1`. The instructor's row: "1 left in cardiac arrest with no code running at the end".
- **`end.js` (Node, real engine):** arrests 0.5, 2, 5 and 19.5 game minutes before the end, left alone, each cost the same: care −204 against −164 without the arrest, legal 15, M&M 90. Tapping Run the code removes all of it (`s9-run.out`).
- **Why it matters:**
  - Round 8's goal was "never cheaper than running it". This goes past that, to "punished for something you had a second to see".
  - The game's own countdown tells the student they have 20 minutes, so a gamer will call this a cheap shot. The instructor will read an abandonment that never happened.
- **Fix:**
  - Apply the end-of-shift penalty only when the arrest has been open longer than a short grace (for example the 3 minutes `codeOdds` already forgives), or scale it by the minutes open.
  - Cap the countdown at the time left in the shift ("shift ends in 0:24: run it now").
  - Word the M&M with the minutes ("arrested 0.4 min before the end").
- **Effort:** S.

### R5.9-03 Low: the end-of-shift legal step can make the summary say "Legal risk · Fired" on a shift that ran to the end, and queues a legal card after the shift
- **Where:** `engine.js:4404` calls `litAdd` after `G.over = true`. `litCheck` (`engine.js:548`) then skips firing (it checks `!G.over`) but still runs `setCard('lit', …)`. `litHTML` names the stage from the number alone (`L >= 75 ? 'Fired'`).
- **What happened:**
  - `s9-lit62.out`: legal risk 62% (the PIP range, set by script; a struggling attending gets there in normal play) plus an own arrest open at the end. The summary's legal box reads "**76%** Legal risk · **Fired**". The heading is "Attending shift summary", `fail` is null, the verdict is the normal one, and the instructor's row says nothing about being fired.
  - `end.js` (lit 30 and 45): after the shift, `G.card` is "Peer review" or "Performance improvement plan". The legal box then names a stage whose call the player never got. `s9-ignore.out` shows the same: "Call from administration".
- **Fix:** add the end-of-shift legal risk without stages (no `litCheck` once `G.over`), and name the box's stage from what happened (`R.fail === 'fired'`), not the number.
- **Effort:** XS.

### R5.9-04 Low: "class ended: results deleted Dec 9" for results deleted Dec 25; and the ended row's button is Results, which fails
- **Where:** `ui.js:2194`. The date is `K.e`, the end the device last heard from the server, which is the registration's 14-day date unless someone opened Results after the first student sent.
- **What happened (`s3b.out`):**
  - DK5-85P got three results on day 1 and was never reopened. Its row on days 31 and 45: "class ended: results deleted **Dec 9**". The server deleted them on Dec 25.
  - An instructor reading that on Dec 26 concludes nobody ever sent.
  - The row's main button is **Results**, which answers "The server has no class for DK5-85P now: it ended, or its results were never set up". The server holds the code for that key until day 60. Turn results back on appears only after this failed tap.
- **Fix:** without a read since registration, say "class ended (results deleted by Dec 25)". Make Turn results back on the main button once `K.t + CB_LIFE < now`. Say "it ended" without "the server has no class".
- **Effort:** XS.

### R5.9-05 Low: junk sends still spend the campus's send limit; round 8 fixed this only for new codes
- **Where:** second migration, `cb_submit` line 272 (`allow('submit', 600)`) comes before validation (line 277). `cb_class_new` was reordered for R3.8-01 (line 228: "checked before anything is counted, so junk calls can't spend a network's limits").
- **What happened (`junk_submit.out`):**
  1. 601 calls of `cb_submit('7MT-80C', <uuid>, '1', …)` with a name the rule refuses, from the campus NAT, took 0.1 s of server time.
  2. A classmate on the same NAT then sends "Nadia" and gets `{"error": "busy"}`. So does everyone else in the room, for the rest of the UTC hour (3,000 junk calls close it for the UTC day).
  3. Unlike a flood of valid results, this leaves no trace in the class list.
- **Fix:** validate before `allow`/`allow_day`/`allow48` in `cb_submit` too, as `cb_class_new` now does. Correct the STATUS (R5.9-06).
- **Effort:** XS.

### R5.9-06 Low: the round-8 STATUS overclaims
- "**a planned code posted ahead can't be taken over**": false after day 44 (R5.9-01, `s3b.out`).
- "**In the migration, invalid calls are refused before they count against a network's limits**": true only for `cb_class_new` (R5.9-05).
- "**a class past its end says "class ended" with Turn results back on (R5.8-04)**": it says "class ended: results deleted <date>" with **Results**. Turn results back on comes after a failed read, and the date can be wrong (R5.9-04).
- "**a taken row offers no Turn results back on (R5.8-09)**": only until the sheet is reopened (`s3b.out` day 59: "class ended / Turn results back on" again, and again "Another class has…").
- "**the replace question sits under the code**": it does, but the sheet scrolls to it, so the projected code still moves (R5.9-07).
- **Fix:** correct the entries. The round-9 STATUS should list them under "Partly fixed".
- **Effort:** XS.

### R5.9-07 Nitpick: small things
- **The ask still moves the code** (`s1b.out`). A stray level tap scrolls the sheet to the ask:
  - Projector: 189→67.
  - PC: 312→191.
  - Phone: 241→101.
  - Sideways phone: 9→**−289**, off the screen.
- **A refused delete** says "The class has ended: its results have been deleted" above all 31 rows, which stay on screen with Copy table and Download CSV still live (`s5.out`).
- **Busy from a saved row** ("Turn results back on", `ui.js` `codeRegSaved`) has no mobile-data hint. The screen's code has one.
- **Names:**
  - `A‧‧‧‧‧‧‧‧` passes both rules (U+2027 repeated), like Zalgo.
  - `Jean‑Luc` (U+2011), `Ann‐Marie` (U+2010), `Ann–Marie` and `O‘Brien` (U+2018) are refused with "letters only", though hyphens and apostrophes are allowed. Map them to `-` and `'` as `’` already is.
- **Wording:**
  - README.md:55 still lists only "the joiners Persian, Sinhala and Malayalam keyboards add" (Bengali is missing).
  - `ui.js:2083` has two `//` comments run together on one line.
- **Still open from round 8:** the shown key is cut off on a phone; "tomorrow" means UTC midnight; the page is 393 px (397 on the summary) on a 390-px phone.

**Counts:** Critical 0, High 0, Medium 2, Low 4, Nitpick 1 (7 total).

## 4. Coverage

**Instructor (real taps, real SQL):**
- **Making codes on a 1024×768 projector (`s1.py`):**
  - A fast network; the ask (its position, Escape, four stray taps); a slow answer with the level buttons disabled.
  - Busy (62 well-formed calls from the NAT); 80 malformed calls (no longer counted).
  - Full (100,036 live classes), Use it without results, another network refused `full`, Try again after it cleared.
  - Unreachable, Use it without results, a troll squats the projected code, then Try again ("can't get class results").
  - A lost answer past 8 s; a reload and the saved list.
  - The ask's movement on four screens (`s1b.py`).
- **Finding the key later (`s3.py`, `s3b.py`, classroom PC):**
  - Days 1, 8, 13.9, 14.25, 15, 21, 25, 31, 45, 59 and 61.
  - A used class read on day 8; a used class never read; planned codes for day 14 (afternoon) and day 21; an untouched planned code.
  - "May have ended", Results, "class ended", Turn results back on, "taken", and the hold's end at day 44.
- **The planned code on lesson day, both sides (`s7.py`).**
- **The classroom PC:**
  - The key box at five sizes, masked, with Show; a failed read; a typed read with Remember off.
  - Pasting Copy key's line into either box; a bare key in four forms (`s4.py`).
  - Forget and the clipboard (`s4b.py`).
- **An older version's saved code (`s8.py`).**
- **Results (`s5.py`):**
  - 32 results read on a phone (the caution, row heights, the attending's and the fired student's rows).
  - The troll deleted; a failed delete (network); a refused delete (the class ended with the list open); Delete all's confirm.
  - Copy table (34 lines, 27 columns) and Download CSV (BOM, CRLF, parsed).

**Students:**
- **One iPad on the NAT (`s2.py`):**
  - The code typed in lower case, then Enter.
  - Thirteen names typed key by key: 米高‧佐敦, 巴奈‧庫穗, בן־גוריון, র‍্যাচেল, আচার্‍য, Kaʻiulani, Марʼяна, Seán Ó Súilleabháin, علی‌رضا, ශ්‍රියානි, അര്‍ജുന്‍, བསྟན་འཛིན, Mary Ann.
  - A cut-off send; a lost answer past 8 s; a double tap; offline then a reload (`s2b.py`: sent later from Last summary).
  - Six trolls; leaving unsent.
- **Names (`s6.py`):** 150 names through the game, the C.UTF-8 server and the en_US.UTF-8 server. Disagreements are only the BOM, NBSP and NNBSP names, which the game cleans before sending.
- **Junk sends against the NAT's limit (`junk_submit.out`).**

**Attending (`s9.py` on a sideways phone, class code, real `cb_submit`; `js/end.js` in Node):**
- A patient from before 07:00, seen by tap, arrests at 07:50 and dies with no code. They count as an own death.
- An own arrest at 08:59:36: left alone; Run the code tapped and answered; left alone with legal risk at 30, 45 or 62.
- The summary, verdict, legal box, M&M, the sent stats and the instructor's row.

**Regular play:**
- `s10.py`: a Quiet Tuesday as charge nurse and an attending Rush without a code. No RPC calls, no Send box, and Menu leaves in one tap. Page width checked on a phone.
- On the scratch copy:
  - `npm test`: 709 ok, exit 0.
  - `npm run stress`: exit 0.
  - `test/class_test.py`: 95 ok, "No errors".
  - `supabase/tests/run.sh`: 210 ok, "ALL DATABASE CHECKS PASSED".

**Not covered:**
- Real Safari and Firefox, a real campus NAT, the live project, the 3D floor and the gate.
- A full shift played entirely by hand. Arrests were started with `OC.toArrest`, the engine's own path, not by waiting for one.
- A release mid-course: no version change this round.

## 5. What I'd keep

- **A code appears only when it's real**, and full or unreachable still gives the class a playable shift with an honest warning.
- **A squatted code says so** in the code's own box, and tells the instructor to keep students from tapping Send.
- **The name rule:** every script I threw at it, the new middle dot, maqaf and Bengali joiner included, passes the game and both server locales the same way.
- **Retries:** a cut-off, timed-out, doubled or offline send is kept exactly once, and an unsent summary survives a reload.
- **Deletes:** the confirm and every error sit in the row under the finger.
- **The attending's numbers:** own deaths whenever the patient arrived, an arrest left open, unsafe orders named with the reason, and the verdict no longer praises a shift where your patient died.
- **Regular play is untouched** by the class machinery.
