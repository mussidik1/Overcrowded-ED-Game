# Reviewer 4, round 6: UI/UX (senior game UI/UX designer)

Review of the round-5 fixes on branch `claude/sleepy-rubin-jot35n`, v0.31.0, HEAD `6328cdf` (the UI changes are `git diff 7cb5613..6328cdf -- src`). Nov 24, 2026.

**Setup**
- Scratch folder: `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round6/r4/`, called `r6/` below.
  - Screenshots: `r6/shots/`.
  - Scripts: `r6/t0_play.py` to `r6/t18.py`. Raw output is in `r6/t*.out`.
- The page: the committed `index.html`, served at `http://127.0.0.1:8769`, in headless Chrome (`CHROME_PATH=/usr/bin/google-chrome`).
- Sizes:
  - `p` 390×844, `pl` 844×390 and `s` 360×640, with mobile emulation and touch.
  - `proj` 1280×720, a desktop projector.
- The server: all four RPCs are stubbed in Playwright (`r6/common.py`, `Server`), and every other off-host request is aborted. Nothing reached supabase.co or edcodeblack.com.
- **Typing:** every box was typed into with real key events. I used `page.keyboard.type(…, delay=60–150)` and `locator.press_sequentially`, plus Enter, Backspace, End and Tab. I never used `fill()` to check typing.
- Not re-reported: the items that `round5/STATUS.md` leaves to the owner or moves to later phases.

## 0. Round-5 status

| ID | Status | Evidence |
|---|---|---|
| **R4.5-01** Each box keeps one character, then is rebuilt | **Partly fixed** | **Typing is fixed:**<br>• Every box keeps every character and the focus, at all four sizes (`t1.out`).<br>• Play a code: `114g1v` with focus on `#ccIn`.<br>• Class code: `114-g1v`.<br>• Instructor key: `7k2m-9qxh-4v1r-8ztX`, 19 characters with dashes.<br>• Tab moves from Class code to Instructor key.<br>• The summary's name box: `Siobhán` with focus kept (`t2.out`).<br>**Still open: buttons.** The same rebuild drops focus to `BODY` after Results, ✕, Show results, Delete, Close results and Copy (`t4.out`, `t8.out`). After Enter on a row's ✕, the next Tab lands on the **first saved code's Results** button, not on the confirm.<br>**New: the fix freezes the whole results section while a box has focus.** See R4.6-01 (High). |
| **R4.5-02** The device forgets a key on day 7 | **Fixed** | Keys made 8 and 29 days ago are listed. One made 31 days ago is gone (`t14.out`). Each tile shows only the date it was made; the list header shows the server's deletion date. There's an edge case where the device and the server disagree (R4.6-09). |
| **R4.5-03** The delete confirm renders off screen | **Fixed** | **The row confirm:**<br>• It renders inside the tapped row: row 20, at 565–680 on an 851 px screen (p). The ✕ stays at y 435 before and after the tap, so nothing jumps.<br>• It names the result: "Delete Li's result (57/100, sent Nov 24 6:19 PM)?"<br>• The same holds at pl, s and proj (`t4.out`, `p-52-row-confirm.png`, `proj-52-row-confirm.png`).<br>• A second tap on the ✕ sends no delete call.<br>**Delete all:** its confirm sits where the link was.<br>**Leftovers (nitpicks, R4.6-13):**<br>• At 390, the Delete all confirm ends 12 px below the screen (767–863 on 851).<br>• Escape still closes the whole sheet, and the confirm is still armed when the sheet is reopened (R4.6-10). |
| **R4.5-04** A shown key stays shown on reopen | **Fixed** | Close and reopen leaves no key in the DOM at any size (`t3.out`, `keyInDom: false`; `p-35-reopen.png`). |
| **R4.5-05** Results opens below the fold; the open code isn't marked | **Partly fixed** | **The scroll stops at the bottom edge.** `cbScroll('#cbHead')` uses `block: 'nearest'`, so the header stops at the bottom of the screen and **no result row is on screen** at any size (`t4.out`, `t10.out`):<br>• p: header at 794–851 on 851, first row at 917.<br>• pl: header at 352–390 on 390.<br>• s: header at 602–658 on 658.<br>• proj: header at 633–670, and the sheet ends at 670.<br>Screens: `p-51-results-open.png`, `proj-51-results-open.png`.<br>**"Loading…" is off screen** while the read is in flight: at 992 on an 851 screen (p) and at 811 on 720 (proj).<br>**The open tile's mark is visual only:** a 4 px blue bar with no `aria-current`. |
| **R4.5-06** Class-sheet toasts in a cut-off 12 px pill | **Fixed** | **Toasts on menus and the summary** are full toasts at 14.5 px with no clamp. Examples:<br>• "Copy didn't work here. Tap Show key and write it down." is 346×56 at 360, not cut.<br>• "Copied the instructor key for …, with its code. Keep it private." is 369×56 at 390.<br>**The leave warning** is now inline in the Send box. The box scrolls to the middle of the screen (`p-rn-24-leave-warning.png`, `pl-rn-24-leave-warning.png`).<br>**In a shift** the strip is unchanged (`t13.out`). |
| **R4.5-07** Forget is the biggest button; its confirm is vague | **Fixed** | Forget is a 208×44 red underlined link. The confirm says "Forget the key for 2P2-R9E on this device? Without it, nobody can read or delete 2P2-R9E's results.", and **Keep** is under the finger (`t5.out`, `p-60-forget-confirm.png`). Forgetting the code just made also removes it from the made box (`t5b.out`). |
| **R4.5-08** Codes the instructor never saw sit in the list | **Partly fixed** | **The shift buttons still work during "Making a class code…"**: `lv_disabled_while_making: [false ×4]` at every size.<br>**Three quick taps** with the answers held (`t5b.out`, `p-65-rapid-tiles.png`):<br>• All three codes are listed for 30 days. The two never shown say "**results not set up yet**" and offer **Set up results**.<br>• That label is false: the server set them up and answered ok. `cbRegister` threw the answers away (`seq !== U.regSeq`), so the `p: 1` mark never cleared.<br>• Round 4 hid them. Round 5 listed them as normal codes. Now they're listed as broken ones. |
| **R4.5-09** The Privacy paragraph is too long and doesn't mention exports | **Partly fixed; the length is worse** | **Exports are now mentioned.**<br>**The paragraph is longer:** 154 → **194 words** in one block.<br>• 665 px tall at 390 and 690 px at 360 (it was 517 and 567).<br>• It packs about 25 data items into one sentence (`t7.out`, `p-80-about-privacy.png`).<br>• That's against the owner's "few words, key words in bold" rule. |
| **R4.5-10** Busy or full gives "Try again later" with no button | **Fixed** | Busy, full and server failure now show **Try again**, which resends the same code and key (`t3.out`, `p-36-busy.png`, `p-38-full-retry.png`). Wording nits are in R4.6-13. A new problem is R4.6-06. |
| **R4.5-11** Polish | **Partly fixed** | **Fixed:**<br>• The made-code box now gives both deletion dates.<br>• Result rows have 36 px of right padding, clear of Close.<br>**Still open:**<br>• The row delete is the same "✕" as the sheet's Close.<br>• Close still covers words in the header, the "Not for grading" note and the tiles at every size (`t9.out`). For example, "the" at proj, and "day", "he", "ent" at p (`proj-51-results-open.png`, `*-90-close-overlap.png`).<br>• A CSV download gives no feedback.<br>• Show key has no `aria-expanded`.<br>• `role="dialog"` has no name.<br>• The name box is still `maxlength="40"` for a 20-character rule. |

**Counts: 6 Fixed, 5 Partly fixed, 0 Still open, 0 Worse.** R4.5-09's length is worse. The R4.5-01 fix causes the new High.

## 1. Verdict

**Not yet.** Most of round 5 is fixed on screen, including the three round-5 Highs:
- Typing keeps every character.
- The device keeps keys 30 days.
- The delete confirm renders in the tapped row.

But the typing fix is too broad. `morph()` now holds the **whole top-level section** that contains the focused box. In the class sheet, that section is all of Class results: the saved codes, the form, errors, "Loading…" and the list.

So the documented recovery route, a code made on another device, breaks. The instructor types the code and the 16-character key on the classroom PC and presses **Enter**:
- Nothing shows: no "Loading…", no error, no list.
- Tapping **Show results** after that throws away the list that already loaded and wipes both boxes.
- It then says "A class code is six letters and numbers, like ABC-DEF."

The CI test clicks the button after `fill()`, so it can't see this. The new results list layout also halves how many results fit on a screen.

## 2. Score

**5 / 10** (round 5: 4). Most of the list is fixed, and the delete and Forget flows are now sound. One High (a regression from the fix) and two Mediums keep it from shipping.

## 3. New findings (worst first)

### R4.6-01 · High · A focused box freezes all of Class results: Enter shows nothing, then Show results wipes the form and reports a false error
- **Where:**
  - `ui.js:16-33` `morph()`:
    - `if (c && typing && c.contains(ae)) { held = true; continue; }` skips the whole top-level child that holds the focused box.
    - `classHTML()` puts every Class results element (the tiles, the form, `.cb-err`, "Loading…", the list) in **one** top-level child, `cbListHTML()`'s `.cc-box.cb-res` (`ui.js:2130`).
  - `ui.js:3046`: Enter in `#cbCode` or `#cbKey` runs `ACT.cbShow(); render()`, and focus stays in the box.
  - `ui.js:2615`: a successful typed read sets `U.cbOpen = false; U.cbForm = null`, but the old form stays on screen while it's held.
  - `ui.js:2605`: `cbShow()` with an empty `U.cbForm` replaces `U.cbList` with an error.
- **Screens:**
  - `p-04-loading-focused.png` and `p-05-answered-focused.png`: a held read, then the answer, both with focus in the box.
  - `p-tap-93-after-enter.png`: the form still on screen after the list loaded.
  - `p-tap-94-after-tap-show.png`: the form gone and the false error.
  - `p-74-list-arrived-while-typing.png`.
- **Scripts:** `t1_typing.py` (`t1.out`), `t12_enter_then_tap.py` (`t12.out`), `t6_form.py` (`t6.out`).
- **What, at 390×844 (the same at pl, s and proj):**
  1. **Wrong key, then Enter.** `U.cbList.err` is set, but no `.cb-err` is in the DOM and focus is still `#cbKey`. The instructor sees nothing.
  2. **Right key, then Enter.**
     - With the read held, "Loading…" never shows (`U.cbList.loading: true`, `loadingShown: false`).
     - After the answer, `U.cbList.rows` has 12 rows and 0 are on screen, and the form is still shown.
     - It's the same 3 seconds later. The list appears only when focus leaves the box.
  3. **Then Show results** (click or touch tap), the natural next move.
     - The list that already loaded is replaced by "A class code is six letters and numbers, like ABC-DEF."
     - The form is gone, and the typed code and key are wiped (`U.cbForm = null`).
     - One read was made, and its result was discarded.
  4. **Typing while a saved code's results load.** Open a saved code's Results, then type in the other-device form. The answer arrives, but "Loading…" stays and no rows render (`C_list_while_typing`).
- **Not tested:**
  - On iOS Safari a tap doesn't focus a button. If a tap there also leaves focus in the box, the button path freezes the same way.
  - WebKit isn't installed here.
- **Why it matters:**
  - This form is the only way to read results on a second device. The key is 16 characters typed by hand.
  - Enter (or the phone's Go key) is how people submit a form, and the code deliberately handles it.
  - The result is a screen that does nothing, then a false error and an empty form.
  - The tests call `fill()` and click the button, so CI is green.
- **Fix:**
  - Hold only the focused `<input>`, not its whole section. Either make `morph` recurse into the held child and patch its other children, or render the form and the results (errors, loading, list) as separate top-level sections.
  - On Enter, blur the box before `ACT.cbShow()`.
  - Make `cbShow()` with no argument do nothing when `!U.cbOpen`.
  - Add a test that types the code and key with `keyboard.type` and presses Enter, then checks that the error and the list appear while focus is still in the box.
- **Effort:** S–M

### R4.6-02 · Medium · After a name is refused, the box is rebuilt with the caret at the start: Backspace does nothing and new letters go in front
- **Where:** `cbRedraw(focus)` (`ui.js:2187-2191`) replaces the whole summary with `setH` and calls `i.focus()` on a new `<input>`. Nothing restores `selectionStart`.
- **Script:** `t2b_caret.py` (`t2b.out`), at 390 and at the projector.
- **What:**
  - **Refused on the device.** Type "Sam 2" and press Enter. The refusal shows, and the caret is at 0 (`s: 0, e: 0`). Two Backspaces leave "Sam 2". Typing "x" gives "**xSam 2**".
  - **Refused by the server.** Type "Sam", press Enter, and the server answers `{error: invalid, field: name}`. The caret is at 0, and typing "my" gives "**mySam**".
  - **The Send button path** happens to land the caret at the end.
  - **No error link.** The box still has no `aria-invalid` and no `aria-describedby` for the error (`invalid_enter`).
- **Why it matters:** The round-5 fix ("focus comes back after a server refusal") brings the keyboard back to a box that edits the wrong end. Enter is the path the box advertises (`enterkeyhint="send"`), and a student fixing a name on a phone gets "xSam 2".
- **Fix:**
  - Don't rebuild the input. Update only the message nodes and the button.
  - Or, after `focus()`, call `i.setSelectionRange(i.value.length, i.value.length)`.
  - Add `aria-invalid="true"` and `aria-describedby` pointing at the error.
- **Effort:** S

### R4.6-03 · Medium · The results list layout regressed: the ✕ now sits alone on a line above every name, doubling each row's height
- **Where:** `style.css:1036`: `.cb-row { display: flex; flex-wrap: wrap; … padding: 8px 36px 8px 0 }`. `flex-wrap` was added so the inline confirm can take a full line (`.cb-row .cb-ask { flex: 1 1 100% }`). But `.cb-main { flex: 1 1 auto }` (`:1040`) has a long flex basis, so it now always wraps under the 44 px ✕.
- **Screens:** `p-52-row-confirm.png` and `proj-52-row-confirm.png`, against round 5's `round5/r4/shots/p-34-x-tapped-mid.png`. Script: `t4.out` (`row_h`).
- **What:**
  - **Row height.** It was about 70 px in round 5, with the ✕ beside the name. Now it's 122–155 px at 390, 139–172 px at 360 and 122–139 px on the projector.
  - **Rows per screen.** About 5 at 390 (it was about 10). About **4.5** in the projector's 620 px sheet (it was 8).
  - **Total length.** 30 results now make a list of about 4,000 px.
  - **The look.** Each ✕ floats in an empty band under the previous row's divider, like a stray control.
- **Why it matters:** The projector view of a class is the main way an instructor debriefs. It now shows four students per screen, and the round-5 note "R4.4-17: 8 rows per 720 px screen" got worse.
- **Fix:** Wrap only when the confirm is present. Either use `.cb-main { flex: 1 1 0 }` (or `flex-basis: calc(100% - 52px)`), or drop `flex-wrap` and render `.cb-ask` as a sibling block after the flex line.
- **Effort:** XS

### R4.6-04 · Low · "Set up results" on a tile gives no feedback where it was tapped
- **Where:** `codeRegSaved` (`ui.js:2566`) sets `U.codeMade` and calls `cbRegister`. The "Setting up class results…" status (`ui.js:2097`) renders in the made box at the top of the sheet. The tile's button and its "results not set up yet" don't change until the answer comes.
- **Screen:** `p-42-setup-saving.png` looks the same as before the tap. Script: `t3.out` (`setup_saving_view`).
- **What:** While the call is in flight, the status is off screen at every size:
  - −166…127 at 390, behind the sheet header.
  - −413…−119 at 844×390.
  - −309…−16 at 360.
  - −259…18 at the projector.

  The sheet scrolls up only when the answer arrives, up to 8 s later.
- **Fix:** Show the state in the tile ("Setting up…", button disabled). Scroll on the answer only if the made box isn't already in view.
- **Effort:** S

### R4.6-05 · Low · The exports leave out the missed radio calls that the list shows
- **Where:** `cbTable` head (`ui.js:2158`) has 'Radio right' and 'Radio wrong'. The list (`cbDet`) shows "radio 3 right, 1 wrong, **1 missed**". `radioMiss` is sent and read (`cbRow` `rM`) but never exported.
- **Script:** `t4.out` (`clip`, `csv`).
- **Fix:** Add a 'Radio missed' column.
- **Effort:** XS

### R4.6-06 · Low · "No class code was made" for a code that was made and shown
- **Where:** `cbRegister` (`ui.js:2085`) and `classHTML` (`ui.js:2015`).
- **Screen:** `p-39-taken-shown.png`.
- **What:**
  - The code was shown with "Class results are off … Try again" (busy, full or network), so it may already be on the projector.
  - If the retry answers `taken`, the code disappears and the box says "**No class code was made.** Another class has just taken SKA-059. Make a new code."
  - The code was made. It still plays the same shift, and students may already be in it. They just can't send results.
- **Fix:**
  - Keep the code on screen, dimmed.
  - Say: "SKA-059 can't get class results (another class has that code). Students can still play it. Make a new code to collect results."
- **Effort:** S

### R4.6-07 · Low · The Send box says it lists what it sends, but leaves out six things that go
- **Where:** `cbSendHTML` (`ui.js:2181`): "this shift's numbers (wait, walkouts, arrivals, deaths[, your patients, diagnoses, harm and radio calls])". `cbArgs` also sends:
  - `ama` (left against advice);
  - `bedFirst`;
  - `fired` and `walkout`;
  - `fast` (the share that was sped up);
  - `scen`;
  - `p_ver`.
- **Screen:** `p-rn-21-send-box.png` (`t2.out`, `t7.out`, `md_send_txt`).
- **What:** `round5/STATUS.md` says "the Send box lists what goes out". It lists part. The About page lists all of it, in a 194-word sentence.
- **Fix:** List them all in short form, or say "these numbers (full list in About › Privacy)" with a link.
- **Effort:** XS

### R4.6-08 · Low · The instructor's words don't match the student's summary, and "dept." and "harm 2" aren't explained
- **Where:** `cbDet` (`ui.js:2124`), against `mdDeptHTML` (`ui.js:2968`).
- **What:**
  - **Harm.** The row says "harm 2". The student's summary says "Patients hurt by an order".
  - **Radio calls.** The row says "radio 3 right, 1 wrong, 1 missed". The summary says "Medical direction calls answered / right".
  - **"dept.:"** is an abbreviation with no gloss. The owner's rule is to explain every term.
  - **Repeats.** "(2nd result)" marks any two students who typed the same name, such as two different "Li"s, as if one student sent twice.
- **Fix:**
  - "2 patients hurt by an order".
  - "radio calls 3 right, 1 wrong, 1 missed".
  - "department:".
  - "(2nd under this name)".
- **Effort:** XS

### R4.6-09 · Low · Dead codes stay listed, and a code set up later loses its key before its class ends
- **Where:**
  - `cbKeys` keeps a record until `t + 30 days`, where `t` is when the code was made.
  - The server's class starts at registration (`…private_results.sql:60-61`) and lives 14 days unused, or 30 days with results.
- **Script and screen:** `t11.out` (`day16_*`), `s-92-day16-results.png`.
- **What:**
  - **A dead code.** A code that never got a result is deleted on day 14, but its tile still says **Results** until day 30. Tapping it says "That code and key don't match, or the class has ended…". For the device's own saved key, "don't match" can't be the reason, and the tile stays.
  - **A code set up later.** With **Set up results** on day 10 (after a failed registration):
    - The server class lives to day 40, but the device drops the key on day 30.
    - The made box tells the instructor "deleted 30 days from today".
- **Fix:**
  - When the server says the class is gone for a saved code, mark the tile "class ended" and offer Forget.
  - Set `t` from the first confirmed registration.
- **Effort:** S

### R4.6-10 · Low · Escape closes the sheet with a delete confirm open, and the confirm is still armed when the sheet is reopened
- **Where:**
  - The Escape handler (`ui.js:3060`) closes the sheet.
  - The `classCode` action (`ui.js:2557`) clears `showKey` and `cbForget` but not `U.cbList.ask`.
- **Script:** `t11.out`: `escape_closed_sheet: true` and `confirm_after_reopen: "Delete Bartholomewjonathans's result (91/100, …)? Keep Delete"`.
- **What:** Its `askAt` is old, so the 450 ms guard no longer applies.
- **Fix:** Make Escape cancel an open confirm first. Clear `ask` when the sheet opens.
- **Effort:** XS

### R4.6-11 · Low · The instructor key is typed in clear, in 22 px bold, on the computer the class watches
- **Where:** `#cbKey` is `type="text"` (`ui.js:2138`).
- **Screen:** `p-tap-93-after-enter.png` shows "7K2M9QXH4V1R8ZTB" in full.
- **What:** Everywhere else the key is masked until **Show key**, because the sheet is meant to be projected (R4.4-01). The other-device form is the one place built for a classroom PC, and it prints every character as it's typed.
- **Fix:** Mask the box (`-webkit-text-security: disc` or `type="password"` with `autocomplete="off"`) and add a Show toggle.
- **Effort:** S

### R4.6-12 · Low · (pre-existing, found this round) The menus are wider than the phone, so the whole UI is zoomed out at 390 and 360
- **Where:** In the HUD behind the menus, the staff pill's number `<b>79%</b>` (`#pStaff.pill` inside `.pills`, `header.hud`) overflows to x 393 at 390 and x 370 at 360. Nothing clips it.
- **Script:** `t16.out`, `t18.py`.
- **What:**
  - `innerWidth` is 393 on a 390 screen and **370 on a 360 screen**. Mobile Chrome zooms the page out to fit (`visualViewport` height 640 against `innerHeight` 658).
  - Every menu and sheet is shown at 0.973 scale on a 360 phone, so a 44 px target is 42.8 px.
  - The same was true in round 5 (`round5/r4/s4.out`, `vw: 370 / 393`). I missed it.
- **Fix:** Give `.pills`, or each `.pill`, `min-width: 0; overflow: hidden`, and shorten or ellipsize the number.
- **Effort:** S

### R4.6-13 · Nitpick · Polish
- **The Delete all confirm** ends 12 px below the screen at 390 (767–863 on 851). Nothing scrolls it into view (`p-55-delall-confirm.png`).
- **After Delete all** the list says "**0 results, in the order they came in**" and "No results sent for this code **yet**" (`p-56-after-delall.png`).
- **Retry wording.** "Too many requests … **Try again later.**" sits above a **Try again** button. "Class results are full right now. Try again later." reads the same for a storage backstop that won't clear soon.
- **The made-code box.** Typing in **Play a code** while a new code finishes registering scrolls the box being typed in under the sheet header: `#ccIn` at 134–182 (p) and 43–91 (proj) (`p-70-typing-while-made.png`).
- **The key shown twice.** With Show key on, the key is printed in both the made box and the saved tile (`pl-34-copykey-toast.png`).
- **Toasts in landscape.** With the sheet open at 844×390, toasts sit top-centre over the sheet's top edge.
- **"Sending…"** is at `opacity: .45`: white on about #9AB5E5, about 2:1.
- **The name box** is 40 px tall (under 44), and "All the numbers" is 294×43.
- **The clinician line.** "No licensed clinician has reviewed its clinical content yet" is the last line of a 2,250–2,400 px summary, after the four buttons (`p-81-summary-bottom-md.png`).
- **Focus on open.** Opening the class sheet (`role="dialog" aria-modal="true"`) leaves focus on the menu's Class code button behind it.
- **Tests.** There's still no UI test that types into the sheet boxes: `class_test.py` uses `fill()` throughout. That's why R4.6-01 is green in CI.

## 4. Coverage

**Read:**
- `docs/audit/BRIEF.md` (Rounds 4, 5 and 6, and How to run), my round-5 report and `round5/STATUS.md`.
- `git diff 7cb5613..6328cdf -- src` (all of `ui.js` and `style.css`) and the `test/class_test.py` diff.
- The migration's class lifetime (`created_at` and `expires_at`, lines 60–61 and 295–296).

**Ran, as the instructor** (p, pl, s and proj):
- **Making a code.** Held registration ("Making a class code…"); `taken` followed by ok, and the taken code never in the DOM; busy, full and network failure with Try again; `taken` on a retry of a shown code; six `taken` in a row.
- **The key.** Show key, Copy key (clipboard read back: "Code Black instructor key for class code …: XXXX-…"), and copy refused (clipboard rejected and `execCommand` false).
- **Reopening.** Close and reopen with the key shown.
- **Saved codes.** "made" date and time, "results not set up yet" with Set up results (held and answered), three quick taps with held answers, the Forget link with its confirm and a second tap, and Forget of the code just made.
- **Expiry.** Keys 8, 29 and 31 days old, and a day-16 unused code.
- **Results.** One and three saved codes; held and answered reads; the open-tile mark; 30 rows with repeats, attending, old-version, fired and walked-out rows.
- **Deleting.** ✕ mid-list with its inline confirm, a double tap, Escape, Delete, Delete all, and Close results.
- **Exports.** Copy table (read back) and Download CSV (file read back).
- **Another device.** The form typed key by key: Tab, Enter with a wrong and a right key (held and answered), the Show results button by click and by touch tap, and typing while a list loads.
- **Overlap.** Text under the sheet's Close at every scroll position (`t9.out`).
- **Cost.** Render time with 30 rows at 4× CPU throttle, focused and not: 36–40 ms median per frame both ways, so it isn't reported.

**Ran, as the student** (p, pl, s and proj, on real class-code Rush summaries as charge nurse and as attending):
- **Typing.** Accented names typed key by key.
- **Refusals.** An invalid name with Enter; caret and editing after refusals (local and server); busy held through "Sending…".
- **Leaving.** The in-box leave warning, and leaving with a second tap.
- **After sending.** The sent state and the call body, the Share-result toast, and tap targets on the summary.

**Also:**
- **About.** About › Privacy at all four sizes.
- **Accessibility.** ARIA snapshots of the tiles, the list and the row confirm. Focus after every button.
- **Width.** Layout-viewport width at 390 and 360 (`t16`–`t18`).

**Not covered:**
- **Devices and browsers.** No real iOS or Android, no WebKit or Firefox (not installed here). In particular I couldn't check whether iOS Safari's tap on Show results leaves focus in the key box (R4.6-01's button path).
- **Screen readers.** No VoiceOver or NVDA; accessibility findings come from Chrome's ARIA tree and the DOM.
- **Share.** `navigator.share` isn't present in headless desktop Chrome, so the Share button wasn't tested.
- **Live server.** Not contacted, by rule.

## 5. What I'd keep
- **The inline delete confirm.** It sits in the row, names the score and time, keeps the ✕ still, puts Keep first, and has the 450 ms guard.
- **Forget.** A small red link, and a confirm that says exactly what is lost.
- **Never showing a taken code.** The swap happens before the code reaches the screen.
- **Try again on every soft failure.** It resends the same code and key.
- **The 30-day key** on the device, with the server's date in the list header.
- **Typing that keeps every character** in every box, at every size.
- **The full-width toasts** off-shift, and the leave warning inside the Send box, where the student acts on it.
- **The attending's own numbers first**, with the department's labelled.
- **Caveats in the first row** of both exports.
