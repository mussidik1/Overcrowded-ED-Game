# Reviewer 5, round 6: Hardcore gamer, game critic and classroom user

Build reviewed: branch `claude/sleepy-rubin-jot35n` at HEAD `6328cdf` (v0.31.0). I rebuilt the source in a scratch copy with `node build.js`; `index.html` and `sw.js` came out byte-identical to the committed ones. I served the repo at http://127.0.0.1:8766 and drove it with Playwright for Python in headless Chrome.

**The server was the real migration, not a stub.**
- I built a throwaway Postgres 16 cluster (`mktemp -d`, as `supabase/tests/run.sh` does).
- I loaded `stubs.sql`, the baseline, then `20261124120000_codeblack_private_results.sql` as it stands at HEAD.
- Every `/rest/v1/rpc/*` call from the page went into the real functions, run `as anon`. Each call carried `request.headers` with a fake `x-forwarded-for` for its network: the campus NAT, the instructor's cellular phone, and a classroom PC.
- Any other request that didn't go to 127.0.0.1 was aborted. Nothing contacted supabase.co or edcodeblack.com, and the logs show no blocked request to either.
- **Time travel:** I moved `created_at` and `expires_at` back in the database, and moved `Date` forward in the page by the same number of days.
- **A release mid-course:** a second scratch build at v0.31.1 (`PAST_V = ['0.31.0']`) on port 8767, with the device's storage carried over.

**Scratch:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round6/r5/`
- `py/db.py`: the fake REST front.
- `py/common.py`: the browser, clock and student helpers.
- `py/s1.py` to `py/s12.py`: the scenarios.
- `shots/`: screenshots, cited by name.

Items that round-5 STATUS lists as partly fixed with a reason, or as the owner's decision, are not re-reported.

## 0. Round-5 status (my R5.5 findings)

| ID | Status | Evidence |
|---|---|---|
| R5.5-01 Critical: key deleted on day 7 | **Fixed** | `cbKeys` keeps a key 30 days from when its code was made (`CB_LIFE`). With 6 results on a phone-made code, **Results** opened on day 8, day 15 and day 25, with "6 results · deleted on Dec 24" (`s3.py`, `20-phone-day25.png`). |
| R5.5-02 High: Delete confirm off screen | **Partly fixed** | The confirm now sits in the tapped row: troll at row 27 of 30, confirm at y 605–720 of 851 (`41-phone-delete-ask.png`). A **failed** delete is still silent. The confirm closes, the row stays, and "Couldn't reach the server" is drawn above the list at y = −3,263 (`s5.py`, `42-phone-delete-failed.png`; ui.js:2141, 2634). |
| R5.5-03 High: Forget leaves the key; typed lists survive | **Fixed** for the two paths reported. After Forget, the next user sees no Show key, no made-code box and no names (`s4.py` (a)). A typed, unremembered list is gone when the sheet reopens (`s4.py` (b)). A third path leaks (R5.6-01). |
| R5.5-04 Medium: failed registration listed as live | **Fixed** | After a reload the code says "results not set up yet", with **Set up results**, which works (`s7.py`). It brought a side effect (R5.6-03). |
| R5.5-05 Medium: a code made a week ahead dies silently | **Partly fixed** | The creation card now says "deleted 30 days from today, or in 14 days if no student sends one". On day 15, though, the dead code is listed exactly like a live one, with nothing to turn it back on. A student plays the whole shift, then gets "isn't set up for class results" (`s3.py`). See R5.6-04. |
| R5.5-06 Medium: Results opens off screen | **Partly fixed** | The header now scrolls in with `block: 'nearest'`, so it lands on the last line of the screen: header at y 794–851 of 851, and the first result at 917 (`s5.py`, `13-phone-results.png`, `40-phone-results-tap.png`). |
| R5.5-07 Low: stray taps | **Still open** | Four quick taps after a projected code: 5 classes registered, 5 keys stored, and two identical "Charge nurse · Manic Monday" rows with no label. The projected code was swapped at once (`s1.py`). It is worse on a slow network (R5.6-03). |
| R5.5-08 Low: Copy key without code; Forget doesn't warn | **Fixed** | It copies "Code Black instructor key for class code DD7-R94: 1HCY-…". Forget asks: "Without it, nobody can read or delete DD7-R94's results" (`s4.py`, `30-pc-forget-ask.png`). |
| R5.5-09 Low: test stub's 30-day answer | **Fixed** | The stub now answers 14 days (class_test.py:42), and the key's lifetime no longer depends on the answer. `class_test.py`: 67 checks, "No errors". |
| R5.5-10 Low: only a named ranking to project | **Partly fixed** | Unranked, in the order results arrived. It is still the only view: names next to scores and deaths. There is no anonymous "show the class" view. |
| R5.5-11 Nitpick bundle | **Partly fixed** | **Fixed:** the README (14 days) and the two contradictory dates (the list shows none now). **Still open:** after a timeout the card says "students just can't send you their results until it's set up", though the server has the code and a student's send went through (`s1.py`: `{"ok": true}`). Old-version codes lose their description (`s7.py`), and "Ｓａｍ" passes (`s6.py`). |

**Counts:** Fixed 5, Partly fixed 5, Still open 1, Worse 0.

## 1. Verdict

**Usable in a 50-minute class. Usable a month later on the same device.**

What works now, in a real class flow:
- **The day itself:**
  - The code shows in under a second, with the key hidden.
  - Thirty students type it in lower case and play. One tap sends.
  - A cut-off send or a lost answer is retried and kept once.
  - The name box is emptied for the next student on a shared iPad.
  - Leaving unsent shows the warning inside the Send box, in view.
- **The instructor:**
  - Opens results on days 8 and 25.
  - Deletes a troll at row 27 with an in-row confirm.
  - Exports a CSV whose first row carries the caveats.
- **Regular play is untouched:**
  - `src/engine.js`, `map.js` and `src3d/` aren't in the diff.
  - A Quiet Tuesday and an attending Rush made no network calls and showed no Send box.
  - Menu and Run it back leave in one tap.
  - The Words search keeps focus while typed in (`s8.py`).

Still unfit for the shared classroom PC, and still fragile:
- **Typed key left in the box:** the key box keeps a typed key for the next user, even with "Remember" unchecked.
- **Key shown on the projector:** the key is typed in clear, large letters on the projected screen.
- **The projected code changes under the class:** any level tap, or **Set up results** on an older row, swaps it, and the class splits across two shifts.
- **A dead code looks live:** a code planned two weeks ahead looks live in the list on day 15 and silently refuses every result.
- **The results list got 2–3× longer:** each ✕ now wraps onto its own line.

## 2. Score

**6/10.** The day-7 key loss and the off-screen delete are fixed, and the class loop works on the day and a month on. What's left is shared-PC privacy and projector hygiene, which is exactly where classroom teaching lives. One of those is a new High.

## 3. New findings, worst first

### R5.6-01 High: on a shared PC, an instructor key typed with "Remember" unchecked stays in the box for the next user, who reads every name in one tap
- **Where:**
  - `ACT.classCode`, ui.js:2557–2560: on reopening, it clears `U.cbList`, `U.showKey` and `U.cbForget`, but not `U.cbForm` or `U.cbOpen`.
  - `cbShow`, ui.js:2615: it clears the form only after a **successful** read.
  - The form, ui.js:2136–2139, re-renders `value="${esc(F.key)}"`.
- **What happened (`s4.py` (c) and (d), `s4e.py`, real SQL, 1440×900):**
  - **The Wi-Fi drops:** the instructor types the code and key, leaves Remember unchecked, and taps Show results. They get "Couldn't reach the server", give up and close the sheet. The next user opens Class code and finds the code box holding `DD7-R94` and the key box holding `1HCYM6P17ZBPK0PK`. One tap on **Show results** shows every name, with ✕ on each.
  - **Interrupted before reading:** the instructor types both and closes the sheet without tapping Show results. The next user played a whole Five-Minute Rush in between, and the key was still in the box (`32-pc-form-left.png`).
  - **A typo:** after one wrong letter, the next user sees 15 of the 16 key characters.
- **Why it matters:**
  - The checkbox says "Remember the key on this device (not on a shared computer)". Unchecked, it promises nothing is kept, yet the key stays for anyone who opens the sheet until the tab is reloaded.
  - Classroom PCs keep the browser open between sections, and the key reads and deletes every student's result.
  - `class_test.py:222` asserts the typed key is kept after an error "to fix it", and line 229 checks only that the **list** is gone on reopen. CI can't see this.
- **Fix:**
  - Opening Class code, closing the sheet, and leaving for the menu all clear `U.cbForm.key` and close the form unless Remember is checked.
  - After a failed read, keep the code but empty the key box.
- **Effort:** S.

### R5.6-02 Medium: the instructor key is typed in clear, large letters, so on the classroom's projected PC the class reads it
- **Where:** the `#cbKey` input, ui.js:2138 (`type="text"`, `.cb-keyin` at 18 px with letter spacing).
- **What happened:**
  - **A Show key click isn't needed:** the round-4/5 fix hid the made key behind Show key "so the code can be shown to a class".
  - **The usual way to read results in class exposes it:** sitting at the projected classroom PC and typing the key under "A code made on another device" (or pasting it, see R5.6-07) puts `QPGXM5PP24VWDTD8` on the wall in an 18 px box (`32-pc-form-left.png`).
  - **What a student can do with it:** photograph it, then read and delete the whole class's results from a phone.
- **Fix:** mask the field (`-webkit-text-security: disc`, or `type="password"` with `autocomplete="off"`) with a small "show" toggle, and say "Not on a projected screen" beside it.
- **Effort:** S.

### R5.6-03 Medium: "Set up results" on an older listed code replaces the code on the projector, and stray taps on a slow network create exactly those rows
- **Where:**
  - `ACT.codeRegSaved`, ui.js:2566 (`U.codeMade = c`).
  - `cbRegister`, ui.js:2080: a superseded registration returns before it clears the `p: 1` mark, though the server registered it.
  - `codeMake`, ui.js:2562: `U.codeMade = null` on any level tap.
- **What happened (`s1b.py`, answers held as on a slow campus network):**
  1. A projected code CPN-R85, then three quick level taps. The projector showed "Making a class code…" and then 2GV-80A.
  2. The server had all four codes, but the list marked two of them (WZF-R5G, 3WR-0DJ) "**results not set up yet**", with a blue **Set up results** button (`07-pc-stray-list.png`).
  3. The instructor taps it to tidy up, and the big projected code becomes 3WR-0DJ, a **Full Moon Friday**. The sheet scrolls up to it (`08-pc-setup-replaces.png`).
- **Why it matters:**
  - Students still typing copy the new code. The class splits across two shifts and two result lists, and the debrief compares different shifts.
  - The code comment at ui.js:2561 says the code "never changes after the class has seen it".
- **Fix:**
  - Setting up a listed code shouldn't touch `U.codeMade`. Show its state in its own row.
  - Clear `p` when any answer comes back, including a superseded one.
  - Ask before replacing a code that is on screen.
- **Effort:** S.

### R5.6-04 Medium: the saved-codes list no longer says when a code ends; an unused code the server deleted on day 14 looks live for 16 more days and can't be turned back on
- **Where:**
  - `cbListHTML`, ui.js:2132: each row shows only "made <date>". Round 5's "until …" is gone, and the server's `expires` from registration is never stored.
  - `cbShow`'s error, ui.js:2617.
  - Set up results is offered only for `p: 1` codes.
- **What happened (`s3.py`):**
  - The instructor made 7EG-G9G the same day as a used class, for a lesson two weeks out. On day 8 the server says "deleted on Nov 30".
  - On day 15 the server has deleted it, but the phone lists it exactly like the live class beside it ("Results / Show key / Copy key / Forget"), with no mark.
  - **Results** says "That code and key don't match, or the class has ended".
  - A student plays the full shift on day 15, then gets "7EG-G9G isn't set up for class results, or its class has ended".
  - `cb_class_new` would accept the same code with the stored key again, but nothing in the game offers it.
- **Fix:**
  - Store `expires` on the key, from registration and from every read. Show "results until Dec 8 (Dec 24 once a student sends)", and grey a code that has passed it.
  - Offer **Turn results back on** (re-register with the stored key) for an unused code past its 14 days.
- **Effort:** S.

### R5.6-05 Low: each result's ✕ now sits on its own line above the name, making a 30-row list two to three times longer
- **Where:** style.css:1036–1040. `.cb-row` gained `flex-wrap: wrap` (for the in-row confirm), and `.cb-main { flex: 1 1 auto }` then wraps below the ✕.
- **What happened (`s5b.py`):**
  - On a phone, a tablet and a PC, the ✕ is at the row's top and the name 52 px below, at the same left edge.
  - Rows are 122–139 px tall; round 5's were about 60 (compare `43-phone-rows.png` and `43-pc-rows.png` with round 5's `70-phone-delete-row25.png`). The 30-row list scrolls past 5,600 px.
  - Each ✕ sits directly under the previous student's "sent …" line. The confirm names the student, so a wrong ✕ is caught, but scanning and moderating are slower.
- **Fix:** `.cb-main { flex: 1 1 0; }`, or keep `nowrap` and put `.cb-ask` on its own line with `order` and `flex-basis: 100%` in a wrapping inner box.
- **Effort:** XS.

### R5.6-06 Low: "(2nd result)" and the export's "Result #" count names, not students: two students called Ben become "Ben (3rd result)", and a lookalike name escapes it
- **Where:** `cbRows`, ui.js:2114–2118 (`r.name.toLowerCase()`); `cbTable`'s "Result #".
- **What happened (`s2.py`):**
  - Ben sent, ran it back, and sent again. A different student, also Ben, sent from her own phone.
  - The list shows "Ben", "Ben (2nd result)" and "**Ben (3rd result)**", and the CSV gives 1, 2, 3.
  - An instructor removing "extra attempts" deletes the second Ben's only result.
- **Lookalike names (`s6.py`):** "Ｂｅｎ" (fullwidth) and "Bеn" (Cyrillic е) pass both name rules and are not counted as Ben. A troll gets a twin row that the marker misses.
- **Fix:**
  - Label it "same name as an earlier result", not as an attempt number.
  - Fold names with NFKC (and a confusables skeleton) before comparing, or refuse fullwidth forms on both sides.
- **Effort:** XS–S.

### R5.6-07 Low: what Copy key copies can't be pasted back: the boxes cut it to "Code Blac" and "Code Black instructor ke"
- **Where:**
  - `keyCopy`, ui.js:2568: it copies a sentence.
  - The `#cbCode` (`maxlength="9"`) and `#cbKey` (`maxlength="24"`) inputs, ui.js:2137–2138.
- **What happened (`s11.py`):**
  - The instructor copies the key on the classroom PC and emails it to themself.
  - On the phone, pasting that line into the code box gives `Code Blac`, and into the key box `Code Black instructor ke`. Show results: "A class code is six letters and numbers".
  - The only way is to hand-select the 19 characters `BCJW-SJP8-DEAC-ZMJC` out of an email on a phone, where a long-press stops at each dash.
- **Fix:** let either box accept the whole copied line, find the 6-character code and the 16-character key in it, and fill both. Drop the `maxlength`s.
- **Effort:** S.

### R5.6-08 Low: real names in several scripts are refused with a message that doesn't say why
- **Where:** `cbClean`, ui.js:2047, and `codeblack.clean_name`. They agree on every name I tried (`s6.py`).
- **Refused:**
  - Japanese katakana names with the nakaguro: マリア・ガルシア.
  - Chinese transliterations with the middle dot: 阿卜杜拉·买买提.
  - Persian names with a zero-width non-joiner: علی‌رضا.
  - Sinhala with a zero-width joiner: ශ්‍රියානි.
  - Hebrew with a geresh: ג׳ון.
- **The message:** "Use your first name or initials, letters only". The ZWNJ and ZWJ are invisible and come from the keyboard, so the student can't see what to remove.
- **Accepted:** Vietnamese, Devanagari, Bengali, Gurmukhi, Tamil, Telugu, Malayalam, Thai, Burmese, Khmer, Arabic with harakat, pointed Hebrew, Georgian, Armenian, Ge'ez, Hangul and kana.
- **Fix:**
  - Allow U+00B7, U+30FB and U+05F3 inside a name, and ZWNJ/ZWJ only between two letters. Update both rules and `client_call.json`.
  - Say "a dot or joiner in the middle isn't allowed: type the first part only".
- **Effort:** S.

### R5.6-09 Low: "Set up results" on a code made before a release registers it under the new version and says "Class results are on" for a code nobody can use
- **Where:** `codeRegSaved`, ui.js:2566, and `cbRegister` (`p_ver: GAME_V`).
- **What happened (`s7.py`):**
  1. Monday, v0.31.0: JJX-G0E's registration failed.
  2. Wednesday, v0.31.1: the list shows "JJX-G0E made … · results not set up yet" with no description. **Set up results** stores the class as version 0.31.1 and shows "Class results are on" with "Charge nurse · Five-Minute Rush" (`50-wed-setup-stale.png`).
  3. On v0.31.1 the code reads as "mistyped, or made on another version". A student still on v0.31.0 plays it and gets "isn't set up for class results, or its class has ended": since round 5, a version mismatch is reported as `unknown`.
- **Fix:** for a code that reads `stale`, don't offer Set up results. Say "Made on an older version; make a new code."
- **Effort:** XS.

### R5.6-10 Nitpick: small things
- **Wrong "made" date:** a code opened on another device with Remember is listed as "made <the day it was typed in>". `s12.py`: the server made it Nov 19, and the phone says "made Nov 24".
- **The CSV's first rows:** row 1 is a caveat sentence and row 2 is blank, so the header is row 3. Excel's Sort and Format as Table, and Sheets' import, take the caveat as the header. Put the caveat in a last column or a trailing note row, or ship a second "README" sheet.
- **The global backstop blames the class:** past the 300,000-result backstop, students are told "This class can't take more results right now. Tell your instructor", and the instructor can do nothing about it (ui.js:2593).
- **Delete all's confirm:** it opens 12 px past the bottom edge of a phone (767–863 of 851, `s5.py`).
- **The sheet's ×:** on a PC it still overlaps the top-right corner of the first listed code's **Copy key** (`43-pc-rows.png`).
- **The Send box:** it still starts below the first screen, under "All the numbers": offset 866 in an 860 px view (`70-student-report-top.png`).

**Counts:** Critical 0, High 1, Medium 3, Low 5, Nitpick 1 (10 total).

## 4. Coverage

**Instructor (real taps, real SQL):**
- **Making codes:**
  - On a 1440×900 classroom PC, a 1024×768 projector (the code at y 261–305) and a 390×844 phone.
  - Four quick stray taps, on a fast network and with answers held as on a slow one.
  - A registration answer held past 8 s, a student sending before Try again, then Try again.
  - Set up results on a listed code while another was projected.
- **Finding the key later:**
  - The same phone on days 8, 15 and 25, with the database and page clocks moved.
  - The classroom PC.
  - A phone, by typing the code and key, and by pasting Copy key's text.
  - With and without Remember.
- **The shared PC:**
  - Forget, then the next user.
  - A typed key that read, a typed key whose read failed, a typed key never submitted, and a mistyped key, each followed by the next user (after a whole shift in between).
- **Results:**
  - Read 6 results (from real student shifts) and 30 results (30 sends through the real `cb_submit` from five networks).
  - Deleted the troll at row 27 on a phone, including a delete that failed on bad Wi-Fi.
  - Opened Delete all's confirm.
  - Copy table (read back from the clipboard) and Download CSV (bytes: BOM, CRLF, 32 rows, the caveat row).
- **A release mid-course:** a v0.31.1 scratch build with the same storage. Listed codes, Results on an old code, Set up results on an old unconfirmed code, an absent student, an unsent Monday summary sent on Wednesday (accepted), and a student still on v0.31.0.

**Students (real taps, campus network):**
- **Normal sends:**
  - Typed the code in lower case with the keyboard: Start enabled while typing, Enter started the shift.
  - Played Five-Minute Rush (the bot finished the shift; every Send, guard and menu action was a real tap or key).
  - Typed the name with the keyboard (focus kept) and sent with Enter.
- **Bad Wi-Fi:** a send cut off, then a retry. A send whose answer was lost past 8 s while the server kept it, then a retry: Sent, one row.
- **Repeats:** a reload, Last summary, Run it back and a second send.
- **Shared iPad:** two students in turn (the name box is empty for the second).
- **Two students with the same name.**
- **Leaving:** left without sending (the warning in view at y 507, the second tap leaves). A send on day 15 to an expired code.

**Names:** 57 names through the game's rule in Chrome and the server's `clean_name`. All agreed: 50 accepted, 7 refused (`s6.py`). The refused ones are the five in R5.6-08, a four-word name, which the three-word rule refuses by design, and "Ⓑen".

**Regular play (`s8.py`):**
- A Quiet Tuesday as charge nurse on a sideways phone: the clock runs at 1×, and toasts sit in the strip during the shift.
- The Words search typed into mid-shift: focus kept, entries filtered.
- The bot played to the end: no Send box, and Menu leaves in one tap.
- An attending Five-Minute Rush: no Send box, and Run it back leaves in one tap.
- No network calls and no console errors.

**Test suite:** `test/class_test.py` on a scratch copy: 67 ok, "No errors".

**Not re-reported (STATUS: partly fixed with a reason, moved, or the owner's decision):**
- Self-reported scores (an edited report).
- Troll results under any name.
- The campus sharing one rate-limit bucket: a troll on the same NAT can fill the class's 500 slots or the network's 600 sends an hour.
- Leaving unsent on a second tap.
- The attending's scoring.

**Not covered:**
- Real Safari and its storage eviction, WebKit and Firefox.
- A real campus NAT and IPv6 (the server groups IPv6 by /56).
- The live project (off limits), the 3D floor and the password gate.
- A full 30-minute shift played entirely by hand.

## 5. What I'd keep

- **A key lives as long as its class can.** On the same device, results open on day 25, and Copy key carries the code with it.
- **Forget really forgets,** and its confirm says what is lost.
- **The delete confirm sits where the finger is,** names the student, score and time, and ignores a double tap.
- **Sending is solid:**
  - One tap, Enter works, and focus survives typing.
  - A lost answer or a cut-off send retried is kept once.
  - Sent survives a reload, and the box is empty for the next student.
  - The leave warning sits in the Send box, in view.
- **The name rule fits most of the world's names,** and the game and server agree on every one I tried.
- **The list is unranked and labels the department's numbers as the department's.** The export carries its caveats.
- **A code made the day of class shows its rules on the card:** 30 days, or 14 if nobody sends.
- **Regular play is untouched,** and the `morph` typing fix doesn't disturb it.
