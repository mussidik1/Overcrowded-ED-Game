# Reviewer 4, round 10: UI/UX (senior game UI/UX designer)

I reviewed the round-9 fixes on branch `claude/sleepy-rubin-jot35n`, v0.31.0, HEAD `1ab6fa9` (the UI changes are `git diff 0541eeb..1ab6fa9 -- src`). Nov 25, 2026.

**Setup**
- **Scratch folder:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round10/r4/`, called `r10/` below.
  - Screenshots: `r10/shots/`.
  - Scripts: `r10/t0_*.py` to `r10/t21_many.py`, `r10/gen.py` (real class-code shifts played to the end), `r10/common.py` (the stubbed server).
  - Raw output: `r10/t*.out`, `r10/g*.out`, `r10/reg-*.out`. Summaries: `r10/rep-*.json`.
- **The page:** the committed `index.html` at `1ab6fa9`, from a `git archive` copy in `r10/repo/`. My `node build.js` there matches the committed file byte for byte. Served at `http://127.0.0.1:8791`, opened in headless Chrome (`CHROME_PATH=/usr/bin/google-chrome`).
- **Sizes:** `p` 390×844, `pl` 844×390, `s` 360×640 and `xs` 320×568 with mobile emulation and touch; `proj` 1280×720 as a desktop projector. I also checked 320×568 without mobile emulation (a true 320 layout).
- **The server:** the four RPCs are stubbed in Playwright (`r10/common.py`). They answer with the contract's keys, plus aborts, HTTP 503, HTTP 429 and held requests. Every other off-host request is aborted. Nothing reached supabase.co or edcodeblack.com.
- **Typing:** real key events only (`keyboard.type`, `press`, Enter, Tab, Shift+Tab, Escape, End, Backspace). Never `fill()`.
- **Not re-reported:** what `round9/STATUS.md` and earlier STATUS files leave to the owner, to a later release, or as "partly fixed, with the reason", unless the fix made it worse. That covers the replace question's scroll (R5.9-07), "full" still offering "Use it without results", and the verdict naming counts rather than patients.

## 0. Round-9 status

| ID | Status | Evidence |
|---|---|---|
| **R4.9-01** (Medium) Orders to review hid an unsafe drug after 12 entries | **Fixed** | Code `1AZ-8A7` (attending, Manic Monday, ibuprofen signed after 16:00): Keisha P. is now entry 1 of 19, with "Can hurt them: Ibuprofen (a heart attack isn't ruled out until the troponin is back)" (`t5-mdlate-p.out`, `chk_late.py`). Leftovers: "And 7 more." is still plain text, and its count is wrong when more than 12 entries are unsafe (R4.10-13, item 9). |
| **R4.9-02** (Medium) The shown key didn't fit at 390 and 360 | **Fixed, with a side effect** | Shown key `scrollWidth`/`clientWidth`: 329/329 at 390, 306/306 at 360, 285/285 at 320 on Android emulation (`t1-*.out`). Show sits under the box. **Side effect:** the box is now 14 px on any screen up to 480 px wide, which makes iOS Safari zoom on focus. See **R4.10-04**. |
| **R4.9-03** (Medium) The class sheet failed keyboard and screen-reader users | **Partly fixed** | **Fixed:** opened from the keyboard, the sheet takes focus (`DIV#sheetBox`) and is named "Class code". Tab and Shift+Tab wrap inside it. Escape gives focus back to Class code. **A code made on another device** focuses the Class code box. "Use it without results" lands on **Play it**.<br>**Still broken:** **Set up results** and the shift buttons still drop focus to `BODY`. Keep, Delete, Escape on a question, **Keep ABC-DEF**, **New code** and **Forget this key** put focus on another row's or another code's button. See **R4.10-03**. |
| **R4.9-04** (Low) A refused delete at the class's end left the results on screen | **Partly fixed** | The message is right: "The class has ended, and the server has deleted its results. Below is the copy this screen loaded: Copy table or Download CSV keeps it." The ✕s and **Delete all** are gone. `invalid` has its own message. **New hole:** **Refresh**, the first button under that copy, wipes it. See **R4.10-02**. |
| **R4.9-05** (Low) A "results deleted" tile offered Results | **Fixed** | The row for a used class past its end reads "class ended: results deleted Nov 15" with **Turn results back on** (row D in `t13-p.out`). The date is `e` for a used class, which is right. |
| **R4.9-06** (Low) The busy hint said "make the code on your phone" | **Fixed** | It now reads "Or turn off Wi-Fi and tap Try again on mobile data (another network): same code, same key." The off state and the row agree (`t2-p.out`, `busy` and `off_busy`). |
| **R4.9-07** (Low) The verdicts misled | **Partly fixed** | The verdicts now name sections, and "The numbers were good" no longer shows over calls to review (`1FN-8A8`, `1GE-862`, `1AZ-8A7`). **Still wrong:** "read your 3 wrong dispositions" points at a section that doesn't exist, and a lost code hides the pointer to an unsafe drug. See **R4.10-08**. |
| **R4.9-08** (Low) A walkout's empty M&M pointed at the legal box | **Fixed** | A forced walkout on a Rush code (seed 777) reads "No single moment stood out: staff morale ended the shift." (`t8.out`). |
| **R4.9-09** (Low) "What raised your legal risk" was 19 px tall | **Fixed** | 289×44 at 390 (`t18_lit.py mdarrest10 p`). It also opens with Enter. |
| **R4.9-10** (Low) Two Show key buttons for the code on screen | **Fixed** | The row now says "Its key: Show key and Copy key, with the code above." (`t2-p.out`, `off_full.list`). That sentence is a fragment (R4.10-13, item 10). |
| **R4.9-11** (Low) A network failure marked the name invalid | **Fixed** | After busy, abort, 503, 429, `unknown`, `full` and `invalid stats` the box has no `aria-invalid`, and the message survives typing. A refused name still marks the box, and typing clears that refusal (`t6-p.out`, steps 10 to 10e). |
| **R4.9-12** (Nitpick, 10 items) | **Still open** | Item 4 (the question's scroll) is now an owner decision, so it isn't counted. **None of the other 9 is fixed:**<br>• #1: **Delete all** in flight still shows no "Deleting…". The link comes back and all 8 ✕s stay enabled (`t17_delall.py`).<br>• #2: the projector caution still shows twice (`t1-p-saved.out`, `caution: 2`).<br>• #3: "with only its key's hash" is still there.<br>• #5: "Can hurt them" still uses the same red as "Not needed" (`.ol-m, .ol-x`, `style.css:917`).<br>• #6: the fallback reason is still nested parentheses (`engine.js:491`).<br>• #7: the unrun-arrest number now has four names.<br>• #8: the fired verdict still uses straight quotes.<br>• #9: "Try again in an hour" still sits above **Try again**.<br>• #10: the busy box grew from about 50 to about 65 words, still with nothing in bold. |

**Counts: 8 Fixed (one with a side effect), 3 Partly fixed, 1 Still open, 0 Worse.**

**STATUS overclaims**
- **"A planned code stopped at 14 days (R5.9-01) … The code panel says so."** The panel's date is blank on every code the server registers: "a student's first result before starts it again for 30 days". See R4.10-01.
- **"A focused button that disappears hands the focus to the control now in its place … `class_test` checks each."**
  - "In its place" means the same index in a list that has just grown or shrunk. So Keep lands on the next student's ✕, and Delete lands two rows down.
  - **Set up results** and the shift buttons are disabled while they wait, not removed, so focus still drops to `BODY`.
  - `class_test` checks only that focus stays somewhere inside the sheet (`class_test.py:379–389`). It never checks which control has focus.
- **"The sheet is named after its heading."** True for menu sheets. A patient sheet, the sheet a player opens most in a shift, has no `h2` or `h3`, so its dialog is named "Details" (`t16_game_focus.py`).
- **"a 429 reads as busy."** Only when making a code (`cbRegister`). Send, Results, Delete and a row's **Set up results** go through `cbNet`, which says a 429 is "The server had a problem. Try again in a minute." See R4.10-06.
- **"a refused delete at the class's end … hides ✕ and Delete all."** True, but it leaves **Refresh**, which deletes the copy the message tells the instructor to keep (R4.10-02).

## 1. Verdict

**Not yet.** The round fixed most of what it set out to fix:
- **Unsafe drugs** come first in Orders to review.
- **The key** fits its box at 390 and 360.
- **The ended-class row** offers the right button.
- **Network failures** no longer mark the student's name invalid.
- **The class sheet** opens with focus, has a name, and keeps Tab inside it.

But this round's own fixes added new problems:
1. **The planned-code date is blank.** R5.9-01's headline fix reads "a student's first result before starts it again for 30 days" on every registered code, because a number is added to the server's date string.
2. **The "copy this screen loaded" can be lost in one tap.** After a refused delete, the screen says the list is the instructor's last copy. Then it puts **Refresh**, which wipes that list, first in the row of buttons under it.
3. **Keyboard focus after a confirm lands on the wrong student or code.** After Keep, Enter asks to delete the *next* student's result. **Set up results** and making a code still drop focus to `BODY`.
4. **The key box shrank to 14 px**, the size at which iOS Safari zooms the page when the box is focused.
5. **A server error now blocks making a class code entirely.** Only a dead network offers "Use it without results". So during a Supabase incident, turning Wi-Fi off is the only way to get a code.

## 2. Score

**6 / 10** (round 9: 6). The High-free state holds and the instructor flow mostly works, but two of the five Mediums are regressions caused by this round's fixes, and a third is a hole in one.

## 3. New findings (worst first)

### R4.10-01 · Medium · The code panel's planned-code date is always blank, and the panel contradicts itself about when results are deleted
- **Where:** `cbRegHTML`, `ui.js:2175`:
  `a student's first result before ${esc(cbDate((R.exp || made + 14 * 864e5) + 30 * 864e5))} starts it again`.
  - `R.exp` is the server's `expires` string (`cbRegister` stores `exp: r.expires`; so does `codeRegSaved`, `ui.js:2700`).
  - `'2026-12-08T16:00:00+00:00' + 2592000000` concatenates two strings, so `cbDate` gets an invalid date and returns `''`.
  - The fallback works only when the server sent no `expires`, which a successful answer never does.
- **Reproduce:** `r10/t14_made.py p`, or by hand:
  1. Play a shift › Class code › Manic Monday, with the server answering ok.
  2. The panel reads: "…Results are deleted on Dec 24 once a student sends one. If none has by Dec 8, the class ends, but a student's first result **before starts** it again for 30 days: a code made ahead of a class still works then." (`shots/p-made-box.png`, and `shots/xs320-made.png` at 320).
  3. `OCUI.U.reg.exp` is `"2026-12-08T16:00:00+00:00"` (type `string`).
- **Second problem, in the same paragraph:** "Results are deleted on Dec 24 once a student sends one" is false for the case the next sentence advertises.
  - In the migration, a first result during the hold sets `created_at = now()` and `expires_at = now() + 30 days` (`20261125120000_codeblack_round6.sql:290`).
  - So a code made Nov 24 and first used Dec 20 keeps its results until Jan 19, not Dec 24.
- **Why it matters:**
  - This is the instructor's privacy and retention text, and the one place that says how long a code made ahead of class works.
  - STATUS lists the date as the R5.9-01 fix ("The code panel says so"). Neither the class test nor any other test reads this sentence.
- **Fix:** `const end = Date.parse(R.exp) || made + 14 * 864e5;` then use `cbDate(end + 30 * 864e5)`. Reword: "Results are deleted 30 days after the class starts: on Dec 24 if a student sends one by Dec 8. Otherwise the class ends on Dec 8, but a student's first result before Jan 7 starts it again for 30 days from that result." Add a `class_test` check that the panel contains no date-less "before starts".
- **Effort:** XS

### R4.10-02 · Medium · After a refused delete at the class's end, Refresh wipes the "copy this screen loaded" that the message tells the instructor to keep
- **Where:**
  - `cbListHTML` (`ui.js:2254`) still renders **Refresh** first in the button row when `L.ended`.
  - `ACT.cbShow`'s error branch (`ui.js:2767–2772`) replaces `U.cbList` with `{ code, typed, err }` on a `key` answer. That drops `rows`, so **Copy table** and **Download CSV** disappear too.
- **Reproduce:** `r10/t15_ended.py p` (code `114-G96`, 8 results).
  1. Open Results.
  2. Tap ✕ on the third row, then Delete. The server answers `key`.
  3. The screen shows "The class has ended, and the server has deleted its results. Below is the copy this screen loaded: Copy table or Download CSV keeps it." The ✕s are gone and all 8 rows are listed (`shots/p-50-ended.png`). The buttons are **Refresh**, Copy table, Download CSV, Close results.
  4. Tap **Refresh**. The server answers `key` (it has no class).
  5. Now there are 0 rows, no Copy table, and "The server has no class for 114-G96 now: it ended, or its results were never set up." (`shots/p-51-ended-refresh.png`).
- **Why it matters:**
  - The server has already deleted the results, so this list is the instructor's only remaining copy, and the screen says so.
  - The first button under it destroys it, with no question.
  - A busy refresh keeps the list (`ui.js:2766`); a `key` refresh doesn't.
- **Fix:** when `L.ended`, drop **Refresh** (and say "Refresh would clear this copy" if it's kept). Also, on a `key` answer to a refresh of a list that has rows, keep the rows and mark it `ended`, as the busy branch does.
- **Effort:** XS

### R4.10-03 · Medium · Keyboard focus after a confirm lands on the wrong student's or code's button; Set up results, making a code and the typed-key form still drop it to BODY
- **Where:**
  - `morph` (`ui.js:31–35`): when the focused button disappears, focus goes to `focusables(el)[at]`, the same index in the new list.
  - Opening a question inserts buttons and answering it removes them, so that index points to a different row.
  - **Set up results** (`ui.js:2226`) and the shift buttons (`ui.js:2053`) are `disabled` while they wait. A disabled button loses focus, so nothing restores it.
- **Reproduce:** `r10/t12_focus2.py proj`, keyboard only (`t12-proj.out`). Rows are numbered li#0, li#1…
  - **Keep on a row's delete question** (opened on li#1, Ana Maria Lopez-Ruiz): focus goes to **li#2's ✕** (Bartholomewjonathans). The next Enter asks to delete *his* result (`shots/proj-80-after-keep.png`).
  - **Delete** on li#1: during "Deleting…" focus jumps to li#3's ✕. After the row is removed it is on Ng, so the row right after the deleted one is skipped.
  - **Escape on a row's question** (li#2): focus goes to li#3's ✕.
  - **Keep ABC-DEF** under the code: focus goes to the first saved row's **Results** at the bottom of the screen (y 701), not to the code or the shift button.
  - **New code** that fails: focus goes to another code's **Show key**, off screen.
  - **Forget this key on this device** (for 114-R8F): focus goes to **Show key for 115-054**, another code. It never reaches the question's Keep or Forget (`shots/proj-82-after-forget-link.png`).
  - **Set up results**, **Five-Minute Rush** (making a code): `BODY` while waiting and after the answer.
  - **The typed-key form** (`t1-*.out`): Enter on a wrong key with the key shown drops focus to `BODY`. The `masked` class comes back, and that replaces the input. Enter on the right key opens the results with focus on `BODY`.
- **Why it matters:** this is the R4.9-03 fix, and STATUS says each case is checked. For a keyboard or screen-reader instructor, the control a confirm hands them is now a *different student's* delete button. That's worse than `BODY`, which at least announced nothing.
- **Fix:**
  - Remember the opener of each question (`L.askFrom`, `U.forgetFrom`, `U.codeAskFrom`). Keep and Escape focus it. Delete focuses the row now at the deleted row's index, or the list head if none.
  - Opening a question focuses its Keep.
  - For **Set up results** and the shift buttons, use `aria-disabled` and ignore the tap, not `disabled`. Or focus the "Setting up…" status line, then the new main button.
  - Don't toggle `masked` on the focused input.
  - Make `class_test` assert the focused control's `data-act` and `data-arg`, not just "inside the sheet".
- **Effort:** S

### R4.10-04 · Medium · The key box is 14 px on phones, so iOS Safari zooms the page when an instructor taps it (a side effect of the R4.9-02 fix)
- **Where:** `style.css:1028`, `@media (max-width: 480px) { .cb-keyrow .cb-keyin { … font-size: 14px; } }`. The viewport is `width=device-width, initial-scale=1, viewport-fit=cover` (`index.template.html:6`), with no `maximum-scale`, so iOS may zoom. Every other text box in the game is 16 px or more (`.cb-code` 24, `.cb-name` 18).
- **Reproduce:**
  1. Run `r10/t20_320.py`, or open the other-device form at 390 or 360.
  2. `getComputedStyle(#cbKey).fontSize` is `14px`.
  3. On an iPhone, Safari zooms in on any focused text field under 16 px. It leaves the page zoomed after blur, until the user pinches out.
  - I could not run iOS here, so this is from the code plus WebKit's documented behaviour, not seen on a device.
- **Why it matters:**
  - Zoomed in, the 333 px sheet runs off the right edge on a 390 phone, the same kind of sideways slide that was High in R4.8-01.
  - It happens on the box an instructor types a 16-character secret into, on the phone the owner tests with.
- **Fix:** keep the input at 16 px. Show the unmasked key below the box in a read-only `.cb-key-v` line, which already exists for the code panel. Or keep 16 px with `letter-spacing: -.02em`, and check that 19 W's fit at 360.
- **Effort:** S

### R4.10-05 · Medium · Any HTTP error from the server now blocks making a class code at all, while a dead network still allows it
- **Where:**
  - `cbRegister`'s `catch` (`ui.js:2164`): `net` is true only for `network` or `timeout`.
  - `classHTML`'s fail box (`ui.js:2052`) offers **Use it without results** only for `R.net || R.full`.
  - A 500, 502, 503 or 504 gives "The server had a problem. Try again in a minute." and **Try again**, and no code.
- **Reproduce:** `r10/t2_make.py p` (`fresh_fail`, `503`): no code and one button, **Try again**. `fresh_abort` (connection refused) shows **Try again** and **Use it without results**. So during an outage, the instructor's only way to a code is to turn Wi-Fi off and make it again.
- **Why it matters:**
  - Class codes are offline by design: the shift comes from the code, not the server.
  - R3.9-02 narrowed the fallback so that someone else can't push an instructor into an unregistered code.
  - But the off state already exists to make that safe ("Tell them not to tap Send … whoever registers this code first gets what students send"), and anyone can get past the narrowing by going offline.
  - The cost lands on the instructor standing in front of a class during a Supabase incident.
- **Fix:**
  - After a second 5xx in a row on **Try again**, offer **Use it without results** with the off text.
  - Or offer it at once for 5xx, and keep the restriction for 429 and `busy`, the answers a classmate can cause.
- **Effort:** XS

### R4.10-06 · Low · A 429 means "busy" only while making a code; everywhere else it reads "The server had a problem. Try again in a minute."
- **Where:** `cbNet` (`ui.js:2087–2090`) has no 429 case. Only `cbRegister` maps it to `CB_BUSY`. Send, Results, Refresh, Delete and a row's **Set up results** all use `cbNet`.
- **Reproduce:** `r10/t6_send.py mddie p`, step `10c_429`. The Send box says "The server had a problem. Try again in a minute." `t2_make.py`'s `429` step says "Your network has made too many requests … Try again in an hour."
- **Fix:** `e.kind === 'http' && e.status === 429 ? CB_BUSY : …` in `cbNet`.
- **Effort:** XS

### R4.10-07 · Low · The student's summary counts an arrest under 5 minutes old as "still in cardiac arrest at the end", while the verdict, the M&M and the number sent to the instructor say 0
- **Where:**
  - `mdReportHTML` (`ui.js:3157`) shows `m.arrestOpen`, every own arrest at 19:00.
  - `showReport` sends `arrestLeft` (`ui.js:3179`), only arrests 5+ minutes old. The verdict and the M&M use `arrestLeft` too.
  - The summary's label has no "5+ min"; the instructor's list and CSV do.
- **Reproduce:** `r10/gen.py mdarrest:md:med:6101:0.8:arrest`, then `t5_summary.py mdarrest p`.
  - The code is `1FN-8A8`, attending, Manic Monday. Brenda D. arrests at 18:56.
  - The verdict reads "Three stars. Now read Diagnoses to review, above and your wrong disposition." The M&M doesn't mention her.
  - "Your patients" shows "Your own patients still in cardiac arrest at the end, with no code running: 1".
  - The instructor gets `mdArrestOpen: 0`.
- **Fix:** show `arrestLeft` with the same "5+ min" wording. If `arrestOpen > arrestLeft`, add "In arrest under 5 minutes at 19:00 (not counted)".
- **Effort:** XS

### R4.10-08 · Low · The verdict tells students to read wrong dispositions that no section lists, and a lost code replaces the pointer to an unsafe drug
- **Where:** `verdictOf` (`ui.js:3052–3067`).
- **Reproduce:**
  - **No section lists them.** `1GE-G78` (3 stars, 3 wrong dispositions) reads "Three stars. Now read Diagnoses to review, above and your 3 wrong dispositions."
    - No section is called that. "Your patients" has only a count.
    - The M&M shows 2 of the 3. The rest are inside the collapsed legal list.
    - The missing comma makes it read "above and your …".
  - **A lost code hides the pointer.** `OCUI.verdictOf({mode:'md', stars:3, md:{seen:6, died:1, codeLost:1, dxWrong:2, contra:1}, mm:[]})` returns only "You ran the code and lost a patient: many arrests don't come back…". An unsafe drug and two wrong diagnoses get no pointer (`t21_many.py`).
- **Fix:**
  - Add a "Dispositions to review" list. The engine already keeps `p.wrongHome` and the M&M text. Or point to "What raised your legal risk".
  - Append the section pointer to the lost-code line.
  - Write "above, and …".
- **Effort:** S

### R4.10-09 · Low · A code that turned out to be taken before it was ever registered says "class ended"
- **Where:**
  - `codeRegSaved`'s taken branch saves `{ x: 1, p: 0, g: 1 }` (`ui.js:2703`).
  - `cbListHTML`'s `ended` is true for any `K.x` (`ui.js:2221`).
- **Reproduce:** `r10/t13_rows.py p`, row I.
  1. The row reads "results not set up yet". Tap **Set up results**; the server answers `taken`.
  2. The row now reads "… made Nov 22 · **class ended** | Another class has HMK-R1Z on the server now."
  3. It reads the same after the sheet is reopened.
- **Why it's wrong:** this device never had a class for that code.
- **Fix:** when `K.g`, put "another class has this code" where the class's state goes, not "class ended".
- **Effort:** XS

### R4.10-10 · Low · In a shift, every patient sheet is announced as a dialog named "Details"
- **Where:** `renderSheet` (`ui.js:1595–1599`) names the dialog after the first `h3` or `h2`. The patient sheet has neither.
- **Reproduce:** `r10/t16_game_focus.py proj`. Open a patient with Enter from the list board: `aria-label` is "Details". Menu sheets get their names: "Class code", "Find a doctor".
- **Fix:** label the patient sheet with the patient's name and room, or render its name as an `h3`.
- **Effort:** XS

### R4.10-11 · Low · At 320 px the page is 349 px wide, so Android shows everything at about 92%
- **Where:** the top bar's pills (`#pStaff`, the score `B`, `.ob.beds`, `#objs`) run past 320, behind the title screen's demo and in a shift. This isn't new this round, but 320 is a size the brief asks for: an iPhone SE (1st generation), or a 375 iPhone with Display Zoom.
- **Reproduce:** `r10/t0_wide.py` and `r10/t0_game320.py`.
  - The document `scrollWidth` is 349 at 320 for the title, the menus and the class sheet.
  - In a shift it's 349 as charge nurse and 327 as attending.
  - With mobile emulation `innerWidth` becomes 349, because the browser shrinks the page to fit.
- **Fix:** let the top bar wrap or drop a pill under 360, and add a 320 check to `ui_test.py`.
- **Effort:** S

### R4.10-12 · Low · The charge nurse still reads "The numbers were good" over two deaths (R4.8-04, open since round 8, in no STATUS)
- **Reproduce:** `r10/gen.py rn1:rn:med:5601:0`, then `t5_summary.py rn1 p`.
  - The code is `1BR-89E`, charge nurse, Manic Monday. It reads "2 patients died in the department. The numbers were good; read the worst moments below."
  - The M&M shows two falls and a CT delay, and neither death.
- **Fix:** for the charge nurse, say where the deaths are (for example "2 patients died in the department: see the M&M") and add a death to the M&M when one happens.
- **Effort:** S

### R4.10-13 · Nitpick (18 items)
1. **Delete all in flight** shows no "Deleting…". The link comes back and every ✕ stays enabled (`t17_delall.py`; R4.9-12 #1).
2. **The projector caution shows twice** with saved codes and the form open (R4.9-12 #2).
3. **"With only its key's hash"** is jargon in the code panel (R4.9-12 #3).
4. **"Can hurt them" uses the same red** as "Not needed: Chest X-ray" (R4.9-12 #5).
5. **The fallback reason is nested parentheses:** "(it isn't safe for this patient (the case's lesson says why))" (R4.9-12 #6).
6. **The unrun-arrest number now has four names:**
   - "still in cardiac arrest at the end, with no code running";
   - "left in cardiac arrest 5+ min with no code running at the end";
   - "Own patients left in an unrun arrest 5+ min";
   - "how many were left in cardiac arrest" (R4.9-12 #7).
7. **Straight quotes** around "What raised your legal risk" in the fired verdict (R4.9-12 #8).
8. **The busy box** has "Try again in an hour" over a **Try again** button, in about 65 words with nothing in bold (R4.9-12 #9 and #10).
9. **"And 7 more."** is still plain text, not a disclosure. With more than 12 unsafe entries it shows `max(12, bad)` entries but still counts `L.length - 12`: 15 shown, "And 7 more", when 4 remain (`t21_many.py`).
10. **The row of the code on screen** says "Its key: Show key and Copy key, with the code above.", a fragment.
11. **The "ended with no results" row** ends "…: Results checks". "results until Dec 7 (Dec 23 once a student sends)" is wrong for a first result after Dec 7.
12. **After Delete all,** the header reads "no results · deleted on Dec 8", a future deletion of what was just deleted.
13. **The legal box** shows "42% · Call from administration" after the end-of-shift +15 passed the 40% peer-review line. Nothing says why the stage and the number disagree (`shots/p-mdarrest10-lit.png`).
14. **Saved-row buttons don't name their code.** A screen reader hears "Results", "Show key", "Copy key" again for every code (`t19.out`). The stars' `aria-label` sits on a plain `span`, so they read as "★★★".
15. **"The server turned this result down (stats)."** shows an internal field name to a student.
16. **At a true 320 layout,** a shown key heavy in M and W clips: `scrollWidth` 259, box 256 (`t20_320.py`).
17. **The fired verdict** says "Legal risk reached 75%" while the box beside it shows 83% (`1QF-GB4`).
18. **On Delete all's question,** an Enter within 450 ms of opening it does nothing, with no feedback. A keyboard user who tabs quickly hits this.

## 4. Coverage

**Read:**
- `docs/audit/BRIEF.md` (rounds 10 and 9), my round-9 report and `round9/STATUS.md`.
- `git diff 0541eeb..1ab6fa9` for `src/ui.js`, `src/style.css`, `src/index.template.html`, `src/engine.js`, `test/class_test.py` and `supabase/tests/client_call.json`.
- In the second migration: `cb_class_new` (turn back on), `cb_submit` (the revive in the hold), `cb_class_read` and `cb_class_delete` (their answers), and `clean_stats` (`mdCodeLost` accepted).

**Ran, as the instructor:**
- **The other-device form:** at p, s, xs, pl and proj (plus a true 320), typed key by key; Show; Enter on a wrong key and then the right one.
- **Making a code:**
  - answers: ok, busy, full, abort, HTTP 503 and HTTP 429, both fresh and on **Try again**; invalid;
  - **Use it without results**, and the off state answered busy;
  - the replace question: **Keep**, and **New code** failing.
- **The saved-code row in 12 states:** active unused and used; not set up; ended (`x`); used and past its end; unused in the hold; unused and released; ended and released; taken on setup; taken and kept; older version confirmed and unconfirmed.
  - Results on a released code; reopening the sheet.
- **Results:** open; a refused delete at the class end, then Refresh; **Delete all** held and done; the screen-reader tree with a question open.
- **Keyboard only, on the projector:** opening; Tab and Shift+Tab wrap; every confirm (Keep, Delete, Escape on a question, **Delete all**, **Close results**, **Set up results**, a shift button, **Keep ABC-DEF**, **New code**, **Use it without results**, Forget and Forget's Keep); Escape.
- **In a shift:** a mouse tap (no focus taken); Enter on a list row (focus taken); N inside the sheet; N after a click; Space then N; Escape returning focus; Tab out of the sheet.

**Ran, as the student, on real class-code shifts played to the end:**
- **The shifts:**
  - an own unrun-arrest death (`1FN-RB4`);
  - an arrest 4 minutes old at 19:00 (`1FN-8A8`), and one 10 minutes old (`1FN-GBY`);
  - an unsafe drug late, with 19 entries (`1AZ-8A7`);
  - two 3-star attendings with wrong diagnoses and dispositions (`1GE-862`, `1GE-G78`);
  - an attending who saw no patients (`1H7-8AR`);
  - two fired attendings, one with a lost code (`1QF-8EZ`, `1QF-GB4`);
  - a charge nurse with two deaths (`1BR-89E`);
  - a forced walkout.
- **Synthetic checks:** more than 12 unsafe entries, and the lost-code verdict with other errors.
- **The Send box:** an empty Send twice; a local refusal cleared and repeated; a server refusal three ways; busy, then typing; abort, 503, 429, `unknown`, class full and `invalid stats`; a network failure followed by a bad name; sent.
- **The legal box:** its stage and the summary target, opened with Enter.

**Regressions** in `r10/repo/`: `class_test.py` (107 ok), `ui_test.py` (50 ok) and `md_ui_test.py`. All end "No errors."

**Not covered:**
- **Devices:** no real iOS or Android, so R4.10-04 is from the code. No soft keyboard, no WebKit or Firefox.
- **Screen readers:** no VoiceOver or NVDA, only Chrome's accessibility tree.
- **Share:** `navigator.share` doesn't exist in headless desktop Chrome.
- **The live server:** not contacted, by rule.

## 5. What I'd keep
- **Unsafe orders first in Orders to review,** never cut off.
- **The ended-class row:** "class ended: results deleted Nov 15" with **Turn results back on**, and the honest "ended … with no results, unless a student has sent one since" for an unused class in its hold.
- **The class sheet** takes focus on open, is named, keeps Tab inside it, and gives focus back on Escape. In a shift, a tap doesn't steal focus.
- **The Send box** marks the name invalid only when the name is the problem, and a network message survives typing.
- **The busy hint:** same device, same code, same key.
- **The walkout's own empty-M&M line,** and a 44 px legal-box summary.
