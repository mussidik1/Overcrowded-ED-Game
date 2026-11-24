# Reviewer 4, round 4: UI/UX (senior game UI/UX designer)

Review of Phase 2 (private class results) on branch `claude/sleepy-rubin-jot35n`, v0.31.0, HEAD `ce11887` (the UI is from `c941ede`). Nov 24 2026.

**Setup**
- Scratch folder: `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round4/r4/`, called `r4/` below. Screenshots are in `r4/shots/`, scripts are `r4/s0_wide.py` to `r4/s9_projtable.py`, and their raw output is `r4/s*.out`.
- I ran the committed `index.html` over `http://127.0.0.1` in headless Chrome (`CHROME_PATH=/usr/bin/google-chrome`) with mobile emulation and touch on. Sizes: `p` 390×844, `pl` 844×390 and `s` 360×640. I also checked 320 and 260 wide (reflow, and a 390 phone at 150% zoom) and 1024×768, 1280×720 and 1440×900 non-mobile (a laptop on a projector).
- I stubbed all four RPCs in Playwright (`r4/common.py`, `Server`), the same way `test/class_test.py` does. Every other off-host request was aborted. Nothing reached supabase.co or edcodeblack.com.
- Severity follows the brief. Items already deferred or waived in round 2 or 3 are not re-reported unless they got worse.

## 0. Status of R4-02 and R4-03

| ID | Status | Evidence |
|---|---|---|
| **R4-02** The Class code sheet scrolls sideways | **Fixed for the sheet. The overflow moved into the new table (R4.4-02).** | `#sheet` scrollWidth equals clientWidth at 390, 360 and 844×390 in every state I reached: open, code made, key shown, 30-row table, both delete confirms, the other-device form, every error (`s1.out`, `s2.out`). The `.cc-box { grid-template-columns: minmax(0, 1fr) }` fix works. The new `.cb-tabw { overflow-x: auto }` table now scrolls sideways with no affordance, and it hides the delete column in landscape (R4.4-02). Separately, and from before this phase: at 360 the page behind the sheet is 370 px wide, because the demo HUD's Staff pill (`#pStaff`) overflows, so the layout viewport is 10 px wider than the screen (`r4/s0_wide.py`). |
| **R4-03** A new code gives no visible result | **Partly fixed** | **What works.** The code is now fully on screen right after the tap at all three sizes: 567–611 of 851 (p), 105–149 of 390 (pl), 374–418 of 658 (s). Class results is now its own box. **What doesn't.** The instructor key, the one new thing on this screen the instructor must act on, lands **cut off at the bottom edge**, and **Copy key** is off screen at all three sizes (key at 847–871 of 851, 386–412 of 390 and 654–676 of 658; `p-03`, `pl-03`, `s-03-made-key.png`). There is no highlight and nothing a screen reader announces. **Copy** also closes the sheet, and the key with it. See R4.4-07. |

## 1. Verdict

**No.** The plumbing is careful: timeouts, every error state, the hostile-row escaping, the one-send guard, the 30-day wording. The screen built on top of it undoes the privacy the phase exists for.
- **The key is shown to the class.** The instructor key that reads and deletes every student's result is printed in 22 px bold directly under the class code. That screen is the one a teacher projects or holds up. At 1024×768, 1280×720 and 1440×900 both sit fully on one screen.
- **Delete is hidden in landscape.** In the orientation this game is built for, the delete column is clipped off the right edge of the results table. Its confirm reads "D" / "K".
- **The key is shown once.** It is never shown again, even though the device stores it.

Around those sit a delete confirm that a double tap defeats and a delete that throws you back to the top of the list. The teacher's table also uses numbers ("Points", "Stars", "Wait") that appear nowhere on the student's summary.

## 2. Score

**4 / 10.** Held. The flow works end to end and its words are mostly plain. But this phase adds three new Highs, and every round-1 High is still deferred.

## 3. New findings (worst first)

### R4.4-01 · High · The instructor key is printed right under the class code, on the screen a teacher shows the class
- **Where:**
  - `src/ui.js` `classHTML()` (line ~2011): `cbRegHTML(made.code)` is rendered inside `.cc-made`, directly under the code and its Copy / Play it buttons.
  - `cbRegHTML()` (line ~2058).
  - `src/style.css` `.cb-key-v` (22 px bold, `user-select: all`).
- **Screens:** `proj1280-41-made.png`, `proj1280-42-code-at-top.png`, `proj1440-41-made.png`, `proj1024-41-made.png`, `p-04-key-box.png`.
- **What (measured, `r4/s5_edges.py`):**
  - **On a projector.** At 1280×720, 1440×900 and 1024×768 the 40 px code and the 22 px key are **both fully visible**. Scroll the code to the top of the sheet and the key is still on screen 264 px below it.
  - **On a phone held up.** At 390×844, once the key box arrives, the code and the key sit on one screen (`p-04`).
  - **The warning.** "Don't share it with the class" is 13 px grey text, below the key.
  - **The design.** The code display is built to be read across a room: 40 px, letter-spaced, "Copy" and "Share". The way a teacher gives a class a typed code is to put it on the projector. Doing that shows the key, which opens the results and **deletes them, singly or all at once** (`cbDelGo`).
- **Why it matters:** Phase 2 exists to make class results private (names and scores). In the main classroom flow, the UI hands the credential to the whole room. Any student can then read classmates' names and scores, or press Delete all.
- **Fix:**
  - Mask the key by default (`••••-••••-••••-8ZTB`) and require a tap on **Show key** to reveal it.
  - Or move it to its own step ("You're the instructor: save your key") that replaces the code view, not one that sits under it.
  - Add a **Show the class** full-screen view with only the code, in very large type.
- **Effort:** S–M

### R4.4-02 · High · The results table hides its delete column in landscape and whenever one name is long, and the confirm reads "D" / "K"
- **Where:**
  - `src/style.css:1022`: `@media (max-width: 460px) { .cb-tab .cb-n, .cb-tab .cb-p { display: none } … }`
  - `.cb-tabw { overflow-x: auto }`
  - `.cb-del { min-width: 40px }`
  - `ui.js` `cbListHTML()`: when you tap ✕, it becomes **two** buttons (`Delete` and `Keep`) in the same cell.
- **Screens:** `pl-20-table-natural.png`, `pl-21-confirm-natural.png`, `s-21-confirm-natural.png`, `p-62-longname.png`, `w320-61-table.png`.
- **What (measured, `r4/s3_confirm.py`, `r4/s7_narrow.py`, no scripted scrolling):**
  - **Landscape 844×390, before any tap.** The media query reads the *viewport* (844), but the sheet there is a 470 px side panel, so all 8 columns stay. The table is 440 px wide in a 414 px box. Each ✕ is cut in half: 20 of 40 px visible. A tap at its centre lands on the box (`elementFromPoint` → `DIV.cc-box`).
  - **Landscape after tapping ✕.** The table grows to 463 px. **Delete** shows 20 of 63 px and **Keep** 20 of 52 px. On screen they read "D" and "K".
  - **360×640 after tapping ✕.** The table is 333 px in a 310 px box. "Delet" and "Keep" are cut.
  - **390×844 with one long name.** A single 19-letter name ("Bartholomewjonathan", within the allowed 20) with its MD and version tags pushes the table to 366 px in a 333 px box. **Every** row's ✕ is then 10 of 40 px visible.
  - **320 (reflow width).** The ✕ column is entirely outside the box.
  - **No affordance.** None of these states shows a scrollbar, fade or hint.
- **Why it matters:**
  - Sideways is this game's main orientation.
  - The new Privacy text promises "ask your instructor: they can delete any result". On a sideways phone the delete control is half gone, and its confirm can't be read.
  - This is the same hidden-sideways-scroll problem as R4-02 and R4-19, moved one box inward.
- **Fix:**
  - Key the column hiding to the sheet's width (a container query on `.sheet`, or a rule for `body:not(.portrait) .sheet`). Drop "#" everywhere, since the order already shows the rank.
  - Use `table-layout: fixed` with an ellipsis on Name.
  - Make the confirm keep the cell's width: one "Delete?" button that replaces ✕, or a confirm row spanning the full width under the row.
  - Or make delete a sticky last column.
- **Effort:** S

### R4.4-03 · High · The instructor key is shown once, and never again, even though the device keeps it
- **Where:**
  - `ui.js` `cbRegHTML()` is the only place the key is ever drawn. It uses `U.reg`, which lives in memory only.
  - `cbListHTML()` lists saved codes (`oc-ckeys`) as tiles with no key.
  - `cbShow()` for a typed code reads only the typed key, and never the saved one.
  - `mine.slice(0, 8)` drops every code after the eighth.
- **Screen:** none needed. `r4/s5_edges.py` → `after_reload_key_shown: false` while `oc-ckeys` holds the code.
- **What:**
  1. **The promise.** The key box says "It opens and deletes the results … **on this device or another** … It's saved on this device."
  2. **After a reload,** Class results lists the code (`VH5-R0H … until Dec 24`) but shows no key and has no **Show key**. The key is in `localStorage`, and the UI will never display it.
  3. **The real path.** A teacher makes the code on a phone the night before, then opens results on the classroom PC to debrief. The PC needs the key. The phone has it and won't show it.
  4. **iOS.** Safari can clear a site's script-written storage after 7 days of browser use with no visit to it (WebKit's tracking-prevention cap; home-screen apps are exempt), while codes live 30 days. So "It's saved on this device" can turn false before the class ends.
  5. **Codes past the eighth.** A ninth live code (several sections, 30-day codes) vanishes from the list. Typing it with an empty key box gives "An instructor key is 16 letters and numbers, from the device that made the code", on the very device that made it.
- **Why it matters:** A secret is shown once, the text implies there's no need to write it down, and there is no way to recover it. A professional would reject that. Losing the key loses the class's results, and the ability to delete them.
- **Fix:**
  - Add **Show key** (masked, tap to reveal) and **Copy key** on every saved-code tile.
  - Use the saved key when a typed code matches one.
  - List every live code, or add "More".
  - Change the copy to "Copy or write it down: you need it to open results on another device".
- **Effort:** S

### R4.4-04 · Medium · A double tap on ✕ deletes the result: the confirm button appears exactly under the finger
- **Where:** `ui.js` `cbListHTML()`: `ask === id ? '<button … cbDelGo>Delete</button><button … cbDelNo>Keep</button>'` replaces the ✕ in place.
- **Screens:** `p-21-confirm-natural.png`, `s-21-confirm-natural.png`.
- **What (`r4/s2_results.py`, `double_tap_deleted`):**
  - At 390, ✕ is at [320–360, 228–268], and **Delete** then renders at [297–360, 228–268].
  - At 360, ✕ is at [297–337, 206–246], and **Delete** at [297–360, 206–246].
  - Two clicks 120 ms apart at the ✕'s centre sent `cb_class_delete {p_id: 102}` at both sizes.
  - There is no undo. The only feedback is a 12 px "Deleted 1 result" toast.
- **Fix:**
  - Put **Keep** where ✕ was and **Delete** away from it.
  - Or ignore taps on the confirm for about 400 ms after it appears.
  - Or delete with a 5-second **Undo**.
- **Effort:** S

### R4.4-05 · Medium · Each delete (and Refresh) throws the instructor back near the top of the list
- **Where:** `ui.js` `cbDelGo` sets `L.loading = true`. `cbListHTML()` then renders only "Loading…" in place of the whole table, the sheet shrinks, and `scrollTop` is clamped. `cbShow` does the same on Refresh.
- **Screens:** `p-14-deleting.png`, `p-70-after-mid-delete.png`, `pl-70-after-mid-delete.png`.
- **What (`r4/s8_place.py`, 30 rows):**
  - Deleting row 15 with it mid-screen: `scrollTop` went 1225 → 78 at 390×844, and 1299 → 393 at 844×390. The next row ended up 1,573 px below the top of the screen.
  - This will be routine. Each **Run it back** plus **Send** adds another row under the same name, so cleaning up duplicates means delete, scroll, find, delete.
- **Fix:** Keep the table while loading (dim it, disable its buttons). Remove the row optimistically and keep the scroll position.
- **Effort:** S

### R4.4-06 · Medium · The teacher's table uses numbers the student's summary never shows
- **Where:**
  - `ui.js` `cbSend` sends `p_score: R.avg`, `p_stars: R.stars` and `p_stats.wait: R.wait`. The table heads say **Points**, **Stars**, **Wait** and **LWBS**.
  - `reportHTML()` / `scoreCardsHTML()` show four percentage cards with stars each, and a ledger headed "Where your points came from".
- **Screens:** `p-30-summary-top.png` against `proj1280-44-results.png` and `p-11-table-top.png`.
- **What:**
  - **Points.** "Points" is the average of the four percentages (`avgScore()`, `engine.js:833`). In my run the student saw Patients 85 / Clinical 95 / Admin 100 / Staff 80, and ledger points adding up to **+474**. The teacher's table says **Points 90**. The number 90 appears nowhere on the student's screen, and the game's own "points" mean something else.
  - **Stars.** "Stars" is `overallStars()`, also never shown. The student sees four separate star rows.
  - **Wait.** "Wait" is `avgWait()`, which is not on the summary either (it shows medians: door to triage, door to provider).
  - **Deaths.** These are sent (`expired`) and never shown to the teacher.
  - **LWBS.** It is unexplained in a table for a lay-friendly classroom.
- **Why it matters:** At the debrief, "Sam, why is your Points 61?" can't be answered from Sam's screen.
- **Fix:**
  - Show an "Overall 90% ★★★" line at the top of the student's summary.
  - Name the columns as the summary does: "Overall %", "Avg wait", "Left unseen".
  - Add a Deaths column.
- **Effort:** S

### R4.4-07 · Medium · After making a code, the key lands below the fold, and Copy closes the sheet that shows it
- **Where:**
  - `ui.js` `ACT.codeMake`: `setTimeout(() => el.scrollIntoView({ block: 'nearest' }), 60)` runs before the registration answers. When the key box arrives later, it grows below the fold.
  - `ACT.codeCopy` calls `res(…, true)`, and `closeOnOk` sets `U.sheet = null`.
- **Screens:** `p-03-made-key.png`, `pl-03-made-key.png`, `s-03-made-key.png`, `p-06-after-copy-code.png`.
- **What:**
  - **The key's position.** Measured above, under R4-03: the key value is cut off at the bottom edge and **Copy key** starts 81–111 px below the bottom of the screen at all three sizes.
  - **Copy closes the sheet.** The instructor's natural next tap is **Copy** (to paste the code to students), and that closes the sheet (`sheet_open_after_copy: false`). The key goes with it.
  - **Getting it back.** Reopening Class code shows it again only while `U.codeMade` is still in memory. After a reload it's gone for good (R4.4-03).
  - **Screen readers** hear nothing when the code or the key appears. The "Class results are off for this code" box has no `role="alert"` either.
- **Fix:**
  - Scroll again when the registration answers, with the key's box at `block: 'end'`, or put the key above the code's buttons (with R4.4-01's mask).
  - Don't close the sheet on **Copy**.
  - Announce the code and the key result in a polite live region.
  - Give the failure box `role="alert"`.
- **Effort:** S

### R4.4-08 · Medium · "Copied the instructor key" shows even when nothing was copied
- **Where:** `ui.js:2108` `copyText()`: `navigator.clipboard.writeText(t); return true;`. The promise is neither awaited nor caught. Used by `codeKeyCopy`, which is new, and `codeCopy`.
- **Screens:** `p-40-copykey-failed.png`, `s-40-copykey-failed.png`.
- **What (`r4/s5_edges.py`):**
  - **When the clipboard refuses.** I made `writeText` reject, as a permission refusal or an iframe without `clipboard-write` does; the private Claude artifact copy runs in one. The game still showed "Copied the instructor key. Keep it private." and logged an uncaught `pageerror: Write permission denied.`
  - **When there is no clipboard at all** (plain-http Safari, older WebViews): the fallback toast "Copy didn't work here. The key is 7K2M-9QXH-4V1R-8ZTB." is clamped at 390 and 360 ("…The key is 7K2M…", scrollHeight 57 and 70 against 43). It is 12 px, in the corner, and gone after 3.3 s.
- **Why it matters:** The instructor trusts the paste, the key never shows again (R4.4-03), and they find out on the classroom PC.
- **Fix:** Await `writeText`. On failure, keep the key on screen in a selectable box with "Copy didn't work: select and copy it, or write it down". Never put a secret in a toast.
- **Effort:** S

### R4.4-09 · Low · The name box: Enter does nothing, and every Send drops focus and the keyboard
- **Where:**
  - `ui.js` `bind()` has Enter handlers for `cbcode`, `cbkey` and `code`, but **not** `cbname`.
  - There is no `<form>`.
  - `cbRedraw()` rebuilds the whole report with `setH`.
- **What (`r4/s4_student.py`):**
  - **Enter.** With a valid name, Enter sends nothing (`enter_sent: 0`). On a phone, Return or Go does nothing.
  - **Focus.** After every Send, refusal or error, `document.activeElement` is `BODY`. The button and the box were destroyed, so the on-screen keyboard closes.
  - **The error and the box.** The error has `role="alert"` (good). The input gets no `aria-invalid` and no `aria-describedby` pointing at it.
- **Fix:** Handle Enter in `cbname`, or wrap the box in a `<form>`. Re-render only the send box, and put focus back in the input on a refusal. Link the error to the input.
- **Effort:** S

### R4.4-10 · Low · Refusal and failure wording sends students the wrong way
- **Where:** `ui.js` `cbSend` (`WHY`, the `cbClean` refusal).
- **Screens:** `p-32-empty-refused.png`, `p-33-unknown.png`.
- **What:**
  - **One message for three cases.** "Mary Jo Ann" is refused with "Use your first name or initials, **letters only**" although it is only letters; the real rule is one space at most. An empty box gets the same sentence.
  - **The unknown-code answer.** It tells a student who has just finished a 5- to 30-minute shift to "**Ask your instructor for a new code**", which means playing it again. The **Share result** button two rows below is never mentioned as a way to get this result to the teacher.
  - **"Self-reported."** "Scores are self-reported." is shown to the *student* in the send box. For them it reads as an accusation or as noise. The instructor's version, "a player can change theirs before sending", suggests the game has an edit feature.
  - **Busy.** "Wait a while" is vague when the window is an hour.
- **Fix:** Separate messages for "Type your name first", "One space at most" and "Letters only". For an unknown code: "Results can't go to this code. Use Share result to send it to your instructor." Drop "self-reported" from the student box.
- **Effort:** S

### R4.4-11 · Low · A wrong key from the server wipes the key box
- **Where:** `ui.js` `cbListHTML()`: the `#cbKey` input has no `value`, and the server's answer calls `render()`.
- **What:** After "That code and key don't match…" the key box is empty (`after_wrong_inputs: ["cbCode=11R-885", "cbKey="]`). One typo in 16 characters means retyping all 16, and the instructor can't see what they typed to find it. The local "too short" check keeps the text (`key_kept: "ABCD-1234"`), so the two paths behave differently.
- **Fix:** Keep the typed key in `U` and write it back into the box.
- **Effort:** S

### R4.4-12 · Low · Delete targets are 40 px, and Delete all's confirm doesn't look destructive
- **Where:** `style.css` `.cb-del { min-width: 40px; min-height: 40px }`. The Delete all confirm uses plain `.big` for both buttons.
- **Screens:** `p-11-table-top.png`, `p-13-delall-confirm.png`.
- **What:**
  - **Tap size.** 30 ✕ buttons at 40×40, stacked at a 49 px pitch against the sheet's right edge.
  - **Look of the confirm.** **Delete all** and **Keep** are identical dark buttons (`rgb(27,34,48)` both). It doesn't say "can't be undone". `.big.bad` (red) exists and isn't used.
  - **Refresh.** It sits at the bottom: 2,325 px down a 2,473 px sheet with 30 rows. To check for new results in class, the teacher scrolls past the whole class.
- **Fix:**
  - 44 px targets.
  - `.big.bad` on the confirm, with "This can't be undone."
  - Refresh and the count above the table.
- **Effort:** S

### R4.4-13 · Low · The code can change on screen without a word, after the instructor may have copied it
- **Where:** `ui.js` `cbRegister()`. On `taken` it sets `U.codeMade` to a fresh code and re-registers. Copy, Share and Play it are live during "Setting up…" (up to 8 s).
- **What (`taken_swap`):** "SP8-01W" became "N97-80D" with no toast or note. A code copied or shared in that window belongs to another live class. Those students' names would go to a stranger instructor, and their own teacher would see nothing. It's rare (a seed collision), but the UI makes it silent.
- **Fix:** Disable Copy and Share until registration settles, or say "The code changed: use N97-80D".
- **Effort:** S

### R4.4-14 · Low · An unsent class result is lost without a warning
- **Where:** `ui.js` `ACT.menu` (`save(true); showTitle()`). `showReport()` overwrites `oc-last-report`.
- **What:**
  - **Placement.** The Send box is at the bottom of the summary, after "All the numbers". It is 705–756 px down, so below the first screen in landscape and at 360 (`pl-30`, `s-30-summary-top.png`, on a short Rush report).
  - **Losing it.** A student who taps **Menu** and plays any other shift replaces the class result for good. Nothing says "Not sent to your instructor yet".
- **Fix:** Put a one-line "Send to your instructor ↓" link under the score cards. Ask before leaving an unsent class result, or keep unsent class results apart from the last summary.
- **Effort:** S–M

### R4.4-15 · Low · The Privacy text is incomplete about what is sent, and one claim has no source
- **Where:** `ui.js` `aboutHTML()`. Screens: `p-50-about-privacy.png`, `s-50-about-privacy.png`.
- **What:**
  - **What it lists.** "Your first name or initials, your score and stars, the time you played and a few shift numbers (average wait, walkouts, patients seen)."
  - **What `cbSend` also sends.** Deaths (`expired`), left-against-advice (`ama`), bedded-before-registration (`bedFirst`), the scenario, the role, the shift level, the game version and a random result id. The parenthesis reads as the complete list.
  - **"Hosted in the US".** Nothing in the repo records the project's region (`supabase/README.md`, README, SMOKE).
  - **Length.** The Class results paragraph is 82 words, 320 px tall at 360. That's against the owner's "few words, key words in bold" rule.
  - **README.** The README's "Students no longer see a Class results box" is wrong: a student opening Class code sees "Class results (instructors)" with **Open with an instructor key** (`p-01-class-sheet.png`).
- **Fix:** A short bullet list of every field. State the region only after checking it in the dashboard. Fix the README sentence.
- **Effort:** S

### R4.4-16 · Low · Screen-reader details in the new table and boxes
- **Where:** `cbListHTML()`, `classHTML()`, `cbRegHTML()`. AX tree from CDP, `r4/s5_edges.py` (`ax_table`, `ax_code_key`).
- **What:**
  - **Stars.** The table's Stars cell is read as "★★☆", which comes out as "black star, black star, white star". The summary cards next door give theirs `aria-label="2 of 3 stars"`.
  - **Code and key names.** `.cc-code` and `.cb-key-v` are role-less `div`s with `aria-label`. ARIA 1.2 forbids naming generic elements. Chrome exposes the name anyway, but other screen readers may read the visible text instead. The key's label is 16 ungrouped characters.
  - **No table caption.**
  - **Silent states.** "Loading…" and "Sending…" aren't announced.
  - **Focus.** After **Open with an instructor key**, focus stays on `BODY` and doesn't move to the new code box.
  - **Labels.** The code and key inputs have only a placeholder and an `aria-label`. They have no visible label. The code box looks identical to the **Play a code** box above it (`p-17-other-device.png`).
  - **The hidden Delete column header** is exposed correctly as a column header.
- **Fix:** `aria-label` on the star cell. `role="img"` (or visually hidden spelled text) for the code and key, with the key in groups of four. A caption. A polite live region for the loading and sending states. Focus the first new input. Visible labels "Class code" and "Instructor key".
- **Effort:** S

### R4.4-17 · Low · Projected, the results are a 580 px modal with 15 px text, and the rarest action is the loudest button
- **Where:** `.sheet` on desktop. `cbListHTML()`. Screen: `proj1280-44-results.png`.
- **What:**
  - **Size.** At 1280×720 the table is 520 px wide, in 15 px text. 7 of 14 rows fit. 55% of the screen is dimmed background.
  - **Hierarchy.** The heaviest element in the box is the full-width dark **A code made on another device**, the action the teacher uses least. It outweighs the table and the code tiles.
  - **Labels.** The same action is labelled **Open with an instructor key** when no codes are saved.
- **Fix:** A wide or full-screen results view on large screens. A text link for the other-device action, with one label.
- **Effort:** S–M

### R4.4-18 · Nitpick · Polish
- **Contrast.** "Sending…" is the only progress cue, and it shows in a disabled button at about 2.1:1 (`button:disabled { opacity: .45 }`, `pl-34-sending.png`).
- **Close button.** In landscape the sheet's ✕ covers the end of the results summary line ("deleted on Dec 24", `pl-21`).
- **Labels.**
  - "Copy" beside "Copy key" is ambiguous; it should say "Copy code".
  - On the made screen, the blue primary is **Play it**, not the instructor's real job (Copy or Share).
- **Wording.**
  - The code tiles say "until Dec 24" without saying what ends.
  - After Delete all, the box says "0 results · deleted on Dec 24" and "No results sent for this code **yet**", right after the instructor deleted them.
  - Every row of an attending code carries "MD".
  - The version tag's meaning is only in a `title`, which a phone never shows.
- **Repeat registrations.** Four quick level taps register four codes (four `cb_class_new` calls against the 20-per-hour network limit) and leave three orphans with keys nobody has.

## 4. Coverage

**Read:**
- `docs/audit/BRIEF.md` (Round 4), my round 1–3 reports, `round2/STATUS.md` and `round3/STATUS.md`.
- The Phase 2 diff of `src/ui.js` and `src/style.css`, the commit message, `test/class_test.py`, the README v0.31.0 paragraph, the SMOKE class-code section.
- The rate limits in the new migration (for the "busy" wording only).

**Ran, as the instructor** (at p, pl and s, then 320, 260 and three desktop sizes):
- **Making a code.** Open Class code, make a code with registration held, answered, failed (503), `taken`, `busy` and never answered (8 s timeout), then Try again.
- **The key.** Copy key, including with no clipboard and with a refused clipboard. Copy (code), reopening, and reloading.
- **Results.** Saved-code tiles. A 30-row table with long, hyphenated, accented, MD and old-version names. Delete one, a double tap on ✕, Delete all with its confirm, a held delete (Loading), Refresh, and read errors (busy, 503, timeout).
- **Another device.** "A code made on another device": Enter with no key, a short key, a wrong key, and a right key in lower case with spaces.
- **Measured throughout:** sideways overflow, the positions of the code, key, ✕, Delete and Keep, scroll position after a delete, tap sizes, and the accessibility tree.

**Ran, as the student** (p, pl, s, on a real class-code Rush summary):
- Empty name, an email, "Mary Jo Ann", "Sam 2", "Ana-María", "Ng", "Dr. Smith".
- Enter in the box.
- The unknown-code answer, Sending… (held), the 8 s timeout, busy, and sent.
- The sent state after a reload, and the same result id on every try.

**Also ran:** About → Privacy at three sizes.

**Not covered:**
- **Real devices.** No iOS Safari, Android Chrome or real touch, and no WebKit or Firefox.
- **Screen readers.** No VoiceOver or NVDA session; accessibility findings come from the Chrome AX tree and the DOM.
- **Share.** `navigator.share` doesn't exist in headless desktop Chrome, so the Share button was never drawn.
- **Display settings.** The game has no dark mode (`prefers-color-scheme` appears nowhere) and no text-size setting. R4-13 is still deferred and unchanged.
- **Report length.** The Send box position was measured only on a short Rush report. Longer reports push it further down.

## 5. What I'd keep
- **Error states.** Every network state has a sentence: timeout, unreachable, busy, refused, unknown code, wrong key. Each ends in something the person can do.
- **The 8-second cap.** `cbFetch` puts it on everything, so no screen says "Setting up…" or "Sending…" forever.
- **Sending.** One send at a time, with the box and button disabled while sending. The result's own id is reused on retry, and "sent" survives a reload.
- **The name box.** 18 px, so iOS doesn't zoom. `autocomplete="off"`, so the browser doesn't fill in a full name. An email is refused before anything leaves the device.
- **The table's safety.** Hostile rows render as text. The Delete column header is hidden visually but kept for screen readers, and each ✕ has a per-name `aria-label`.
- **The sheet.** The `minmax(0, 1fr)` grid fix: the sheet itself no longer moves sideways.
- **Plain dates.** "Deleted on Dec 24" appears wherever a date matters.
