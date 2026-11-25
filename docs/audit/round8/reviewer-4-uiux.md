# Reviewer 4, round 8: UI/UX (senior game UI/UX designer)

Review of the round-7 fixes on branch `claude/sleepy-rubin-jot35n`, v0.31.0, HEAD `87c9c13` (the UI changes are `git diff 18a71f9..87c9c13 -- src`). Nov 25, 2026.

**Setup**
- Scratch folder: `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round8/r4/`, called `r8/` below.
  - Screenshots: `r8/shots/` (237 files).
  - Scripts: `r8/t1_form.py` to `r8/t14_refresh.py`, `r8/gen.py` and `r8/gen2.py`–`gen4.py` (real class-code shifts played to the end), `r8/seed.py` (saved codes in every state). Raw output is in `r8/t*.out`.
- The page: the committed `index.html` at `87c9c13`, from a `git archive` copy in `r8/repo/`, served at `http://127.0.0.1:8780`, in headless Chrome (`CHROME_PATH=/usr/bin/google-chrome`). I rebuilt that copy: the build matches the committed `index.html` byte for byte.
- Sizes: `p` 390×844, `pl` 844×390 and `s` 360×640 with mobile emulation and touch; `proj` 1280×720, a desktop projector.
- The server: the four RPCs are stubbed in Playwright (`r8/common.py`, `Server`), answering with the contract's keys. Every other off-host request is aborted. Nothing reached supabase.co or edcodeblack.com.
- **Typing:** every box was typed into with real key events (`page.keyboard.type(…, delay=40–150)`), plus Enter, Backspace, End and Tab. I never used `fill()`.
- Regression runs in `r8/repo/`: `class_test.py` (91 ok), `ui_test.py` and `md_ui_test.py`. All three end "No errors."
- **A commit landed during this review:** `1d284f1` ("round-8 fixes from reviewers 1 and 2"). I reviewed `87c9c13`, as briefed. Where `1d284f1` changes a finding, I say so; I checked its built page only for R4.8-01 and R4.8-03.
- Not re-reported: what `round7/STATUS.md` leaves to the owner or moves to Phase 4/5 (row height, the close button over text, the About list's typography, the attending's scoring), unless the fix made it worse.

## 0. Round-7 status

| ID | Status | Evidence |
|---|---|---|
| **R4.7-01** (High) The key box was 28 px; the sheet scrolled sideways | **Partly fixed** | **Fixed:** the key box is 292 px at 390, 292 at 360, 334 at 844×390 and 440 on the projector. Show sits beside it. Show and Hide work before and after a failed read (`t1-*.out`).<br>**Still open:** at **390 and 360** the other-device form is still wider than its card, and the sheet still scrolls sideways. See **R4.8-01** (High). STATUS's "nothing scrolls sideways" is true only at 844×390, the one size the test runs. |
| **R4.7-02** (Medium) Busy or full blocked making any code | **Fixed** | Busy, full, 503 and unreachable all offer **Try again** and **Use it without results** (`t2-*.out`, `p-21-busy.png`, `p-22-full.png`). The key survives a reopen of the sheet in the fail and off states. |
| **R4.7-03** (Medium) Errors were grey | **Fixed** | `#cbErr`, row errors, `#cbDelErr` and the Send box's errors are `rgb(165, 29, 47)`, weight 700, at all four sizes. |
| **R4.7-04** (Low) Row delete: no "Deleting…", error at the bottom | **Partly fixed** | **Fixed for a row:** "Deleting…" shows in the row. A 503 shows "Nothing was deleted. The server had a problem…" in the row, in red, at 737–771 on an 851 screen (`p-52-deleting.png`, `p-53-delete-failed.png`).<br>**Still open for Delete all:** while it's in flight, the confirm vanishes and nothing says "Deleting…". The list looks untouched and the **Delete all** link comes back, tappable again (`t5-p.out`, `delall_held`; `p-55-delall-held.png`). |
| **R4.7-05** (Low) Row confirm below the fold | **Fixed** | ✕ at 631–675 opens its confirm at 735–850 on 851. Keep and Delete are fully in view. |
| **R4.7-06** (Low) Results header under the ✕ | **Fixed** | Header top against the ✕'s bottom: 202 vs 190 (390), 181 vs 168 (360), 60 vs 48 (844×390), 111 vs 98 (projector). |
| **R4.7-07** (Low) Replace ask promised "stays in your saved codes" | **Fixed** | The parenthesis shows only for a saved code. **Keep ABC-DEF** is now the main button. Leftover in R4.8-07. |
| **R4.7-08** (Low) The instructor's wait is a different number from the student's | **Partly fixed** | The row now says "mean door-to-provider wait 13 min (all arrivals)", and the export says the same. But the student never sees that number:<br>• A charge nurse's summary shows only "Door to provider (median)".<br>• An attending's summary shows no wait at all (`mdDeptHTML`, `ui.js:3044`).<br>• The Send box still promises to send "the department's wait", and About calls it "average wait". |
| **R4.7-09** (Low) Focus dropped to BODY after every button | **Partly fixed** | **Fixed:** a button that survives the redraw keeps focus: ✕, Results, Show key and Show (`t6-proj.out`). After ✕, Tab goes to Keep.<br>**Still open** (`t6-proj.out`, `t1-*.out`):<br>• **Keep, Delete, Forget, Close results, Use it without results, New code, Keep ABC-DEF, a shift button and Set up results** drop focus to BODY. After Keep, the next Tab lands on the first saved code's **Set up results** at the top of the sheet.<br>• **Opening the sheet** leaves focus on the menu button behind it. Tab then walks the scenario buttons behind the `aria-modal` sheet.<br>• **The dialog** still has no accessible name.<br>• **"A code made on another device"** doesn't focus the Class code box.<br>• **Tapping Show** moves focus off the key box, so a phone's keyboard closes.<br>**New:** the hand-off misfires. **Refresh** gives its focus to the saved row's **Results**, 1,502 px above the view (`t14_refresh.py`; = R1.8-02, changed in `1d284f1`). |
| **R4.7-10** (Low) One number, three names | **Fixed** | "Complications (partly chance)" in the summary and the export; "(complications, partly chance: 2)" in the row; "complications are partly chance" in the caveat. Leftovers in R4.8-07. |
| **R4.7-11** (Nitpick) Polish | **Partly fixed** | **Fixed:**<br>• "No results for this code right now." after Delete all.<br>• Busy now says an hour or tomorrow.<br>• The Send box's refusal clears on typing. That fix broke Send: see **R4.8-02**.<br>• "made … · made" no longer repeats.<br>• The ended-class message no longer quotes the 30/14-day rule.<br>• The walked-out row has one colon.<br>• Show and Hide no longer use `aria-pressed`, and `text-security` is gone.<br>**Still open:**<br>• Full: "It may take days to clear." still sits above **Try again**.<br>• Invalid: still "No class code yet… make another."<br>• The not-for-grading note still appears twice in two lengths (R4.8-07). |

**Counts: 6 Fixed, 5 Partly fixed, 0 Still open, 0 Worse.**

**STATUS overclaims**
- "The key box had no room to type … the UI test now checks … that nothing scrolls sideways." The test (`class_test.py:16`, `:274–275`) runs only at 844×390. At 390 and 360 the sheet still scrolls sideways (R4.8-01).
- README.md:55 says "The class code screen no longer scrolls sideways on a phone." That is false at 390 and 360 with the other-device form open.
- "A redrawn button hands its focus to its replacement (R4.7-09)" is listed under Fixed. It covers only buttons that survive the redraw, and it can move focus to the wrong button (Refresh).
- "Typing again clears a name refusal" is listed under Fixed. It works, but the same edit leaves Send dead when the same text is sent again (R4.8-02).

## 1. Verdict

**Not yet.** The round is mostly good work:
- Busy and full no longer block a class.
- Errors are red.
- Row deletes say what they're doing, where the finger is.
- The Results header clears the ✕.
- The Send box sits under the score cards with the name box first.

Three things stop it:
- **The other-device form still slides the class sheet sideways at 390 and 360**, the two phone widths that matter most. This is the fourth round this form has broken the sheet's layout. The one size the new test checks is the one size where it's fine.
- **The student's Send button goes dead** after a refusal is cleared and the same text is sent again. No message, no `aria-invalid`, nothing, on every further tap.
- **A code made "without results" keeps telling the instructor "Tell them not to tap Send"** after its own row turned results on (fixed after the review HEAD, in `1d284f1`).

## 2. Score

**6 / 10** (round 7: 5). The flow is now sound end to end at the projector and in landscape. Portrait phones still get a sideways sheet on the second-device path. The student side has a silent dead button on a plausible path, and no test in the suite types a name twice.

## 3. New findings (worst first)

### R4.8-01 · High · The other-device form still pushes the class sheet sideways at 390 and 360; the new test only runs at 844×390
- **Where:**
  - `style.css:1032`: `.cb-form { display: grid; gap: 6px; }` has no `grid-template-columns`. Its implicit `auto` column takes the min-content width of `#cbCode`. That input uses `.cb-code` (`:1011`: 24 px bold, `letter-spacing: .12em`, default `size`), whose intrinsic width is 372 px.
  - `.cc-box` got `minmax(0, 1fr)` for exactly this in R4-02 (`:1007`). `.cb-form` inside it didn't.
  - `test/class_test.py:16` opens 844×390 only. The check at `:274–275` passes there because that sheet is 470 px wide.
- **Reproduce:** `r8/t1_form.py p` and `t1_form.py s`. Play a shift › Class code › **Open with an instructor key**. Type a code and a key.
  - **390:** the Class code box, the key row and **Show results** run from x 30 to 402. The card ends at 377 and the sheet at 393. `#sheet.scrollWidth` is 402 against `clientWidth` 393. Focusing a box scrolls the sheet 9 px sideways.
  - **360:** the same 372 px form sits in a 370 px sheet (`scrollWidth` 402). Focusing a box scrolls the sheet **30 px** sideways:
    - the card's left edge goes to x −14 or −16;
    - every line loses its first letters ("lass results", "nstructor key");
    - the **Show** button is clipped on the right.
  - Screens: `s-03-key-shown.png`, `s-04-wrong-key.png`, `p-02-key-typed-masked.png`.
  - 844×390 and the projector are fine.
  - Still present in `1d284f1`: its built page gives `scrollWidth` 402 on 370 at 360.
- **Why it matters:**
  - This is the only way to read results on a second device.
  - It is the same defect as R4-02 (High, round 1), one box further in.
  - Two docs now say it's fixed: STATUS ("nothing scrolls sideways") and README:55 ("no longer scrolls sideways on a phone").
- **Fix (verified in a scratch copy, `r8/fix/`):** `.cb-form { grid-template-columns: minmax(0, 1fr) }`.
  - **360:** the key box is 230 px, Show sits at 268–340 inside the card, and `scrollWidth` equals `clientWidth`.
  - **390:** the key box is 253 px, with no sideways scroll.
  - Run the `class_test.py` layout check at 390×844 and 360×640 as well as 844×390.
- **Effort:** XS

### R4.8-02 · Medium · Send goes silently dead when a cleared refusal is sent again with the same text
- **Where:**
  - The input handler (`ui.js:3159–3164`, at `87c9c13`) handles typing again by editing the live DOM: it removes `#cbNameErr` and the box's `aria-invalid` and `aria-describedby`, and deletes `U.cbSent[at]`.
  - It doesn't touch `#report._h`.
  - The next `cbRedraw()` calls `setH()` (`:13`), which skips when the new HTML equals `_h`. With the same name text, the new HTML is byte-identical to the refused render it remembers. Nothing is redrawn.
- **Reproduce:** `r8/t12_empty.py rn p` and `r8/t8_student.py md p`. Any real class-code summary (`r8/rep-*.json`).
  - **Empty box:** tap **Send** → "Type your first name or initials.", `aria-invalid="true"`. Type "a", then Backspace. Tap **Send** → nothing: no message, no `aria-invalid`, no request. Every further tap → nothing.
  - **Same name:** type "Sam 2" and press Enter → "No numbers…". Type a space, then Backspace. Press Enter → nothing. Click Send → nothing.
  - Screen: `p-md-72b-same-again.png`.
  - Same at 360, 844×390 and the projector. Unchanged in `1d284f1`.
- **Why it matters:**
  - Send is the student's one action on this screen. Here it neither sends nor says why.
  - A screen reader gets no alert, because the `role="alert"` node is never re-added.
  - The student may walk away thinking it sent. The leave guard catches Menu and Run it back, but not closing the tab.
- **Fix:**
  - In the handler, reset the cache with `const r = $('#report'); if (r) r._h = null;`, or call `cbRedraw()` instead of editing the DOM.
  - Add the empty-Send-twice case to `class_test.py`.
- **Effort:** XS

### R4.8-03 · Medium · "Class results are off … Tell them not to tap Send" stays on screen after the code's own row turned results on
*(Same as R1.8-03, which rated it Low. Changed in `1d284f1`: I checked its built page, and the box now says "Class results are on.")*
- **Where:** `codeRegSaved` (`ui.js:2654`) saves the key with its new dates but leaves `U.reg` in `off`. `cbRegHTML` (`:2144`) keeps drawing the off box.
- **Reproduce:** `r8/t3_lost.py p`.
  1. The server answers 503. Tap **Five-Minute Rush**, then **Use it without results**.
  2. The code shows with "Class results are off for this code… **Tell them not to tap Send**… Try again".
  3. In the saved list right below, tap **Set up results**. The server says ok.
  4. The toast says "Class results are on for 87E-R08". The tile says "results until Dec 8 … · Results". The box above still says off and still tells the instructor to stop students sending (`p-30-row-setup-while-off.png`).
- **Why it matters:** two opposite instructions sit on one screen. Followed, the box costs the class its results.
- **Fix:** done in `1d284f1`. Also give the two buttons one name ("Try again" and "Set up results" both do this).
- **Effort:** XS

### R4.8-04 · Low · An attending's summary says a patient died, then "Nothing went badly wrong this shift. Take the win."
- **Where:**
  - In attending mode, M&M keeps only the attending's own events (`engine.js:1220`, `mm()` returns unless `own`).
  - The verdict (`ui.js:3028`) leads with "N patients died in the department".
  - `mmHTML` (`:3090`) prints "Nothing went badly wrong this shift. Take the win." whenever the list is empty.
- **Reproduce (a real shift, not a crafted one):** `r8/gen4.py` plays `OC.classCode({ mode: 'md', level: 'med', scen: 'none', pack: 'national', seed: 8888 })`, which is code `25E-0BY`, Manic Monday, with the autopilot running the department and the attending seeing no patients.
  - The summary reads "1 patient died in the department. You saw no patients this shift…".
  - Under it, M&M reads "Nothing went badly wrong this shift. Take the win." (`p-real8888-80-summary.png`, `r8/rep-real8888.json`). Hard seed 5555 gives the same.
  - An attending who saw patients and kept 2+ stars gets "The numbers were good; read the worst moments below." over the same empty list (`rep-mddept.json`).
- **Fix:** in attending mode with deaths and an empty list, say "None of your own patients had a bad outcome. N died in the department: see The department." Don't point at an empty list.
- **Effort:** XS

### R4.8-05 · Low · The fired verdict points at the wrong list
- **Where:** `ui.js:3028`: "Legal risk reached 75%, and the group ended your contract mid-shift. The worst moments below show what raised it."
- **What:**
  - M&M doesn't hold most of what raises legal risk. These `litAdd` calls write no M&M line (`engine.js`):
    - "a wrong medical direction order" (`:3917`);
    - "discussed a case with a lawyer" (`:574`);
    - "died in cardiac arrest and no code was run" (`:2311`);
    - "left untreated for 20 minutes" (`:3613`).
  - The list that does say why is the **What raised your legal risk** disclosure, *above* the verdict (`p-mdfired-70-summary-top.png`).
- **Reproduce:** a fired attending summary (`r8/rep-mdfired.json`, via `t10_verdict.py mdfired`). The verdict sends the student down to "Jean V. went home with A-fib with rapid rate", and the disclosure above lists the real causes.
- **Fix:** "Open **What raised your legal risk**, above, to see why."
- **Effort:** XS

### R4.8-06 · Low · The no-results states contradict themselves
- **Where:**
  - `classHTML` fail box (`ui.js:2033`).
  - The made box plus `cbRegHTML`'s off box (`:2144`).
- **What** (`p-22-full.png`, `p-24b-noresults-scrolled.png`):
  - **The fail box** says "A code is shown only once its class results are set up, so it never changes in front of a class." The next button is **Use it without results**, which shows a code with no results set up. "Use **it**" refers to a code that isn't on screen.
  - **The off box** has "Students: … has a Send button that **sends you the result**." directly above "**Tell them not to tap Send**".
  - **The off box says results "are off"** even after a timeout, when the server may have registered the code. Round 6 said "may be off", which was right for a timeout. The instructor then tells the class not to send results that would have arrived.
- **Fix:**
  - Drop the "shown only once…" sentence when offering the way out, and rename the button **Show a code without results**.
  - Hide the "Students: … Send button…" line in the off state.
  - Say "may be off" for a timeout.
- **Effort:** XS

### R4.8-07 · Nitpick (17 items)
1. **A one-patient attending row** reads "saw 1 patient (1 of them died)" (`t7-p.out`).
2. **An older-version, unconfirmed tile** says "an older version of the game" twice: in the description and in "Made on an older version of the game: make a new code." (`p-41-saved-1.png`).
3. **The ask on a lost code:** its main (blue) button is **Keep VW9-G59**, a struck-through code. The box above says to make a new one (`p-32-ask-lost.png`).
4. **Full** still says "It may take days to clear." above **Try again**.
5. **Invalid** still says "No class code yet … make another" after a code was on screen a moment ago (`p-35-invalid.png`).
6. **The made box** says "Class results, below, says more". Below says more only after a list is opened.
7. **The caveat above an attending code's list** grew to about 100 words. With the 85-word not-for-grading note, it fills 8–10 lines at 360 before the first result.
8. **The Send box's small print** is 103 words for a charge nurse and 115 for an attending, at 12.5 px. It now sits after the box, which helps.
9. **At 360×640 and 844×390 the Send box is below the first screen** (it starts at 722 on 658, and at 621 on 390).
10. **Forget** writes a space to the clipboard if this page ever copied that key, even if the instructor has copied something else since (`ui.js:2671`).
11. **A row's ✕ stays enabled while that row says "Deleting…"** (`t5-p.out`, `xDisabled: false`).
12. **Turn results back on** changes the tile's made date. The tile then jumps from the bottom of the list to the top, away from the finger (`t4-p.out`, `c_done`).
13. **A row without the new keys reads "harm from orders 2"**, a fourth name. For such a row, the export's "Complications (partly chance)" column holds the whole harm count, contraindicated drugs included (`t7-p.out`, `clip_old`).
14. **An attending who saw no patients** gets "100% Clinical accuracy" over "0 of 0 Diagnoses right" (`p-real8888-80-summary.png`).
15. **The lost code** is at opacity .35, about 2.3:1 contrast. It's deliberate, but the code is still the only thing that names the class.
16. **Misplaced CSS comment:** the `.cc-code.lost` rule carried the masked box's comment (`style.css:1021`). Fixed in `1d284f1`.
17. **README.md:55:** "The class code screen no longer scrolls sideways on a phone." See R4.8-01.

## 4. Coverage

**Read:**
- `docs/audit/BRIEF.md` (Rounds 8, 7 and 6), my round-7 report and `round7/STATUS.md`.
- `git diff 18a71f9..87c9c13 -- src` (`ui.js`, `style.css`, `engine.js`).
- The `class_test.py` layout check, the contract (`client_call.json`), the README's v0.31.0 paragraph, and the second migration's held-code and backstop parts (for the messages the game shows).
- Skimmed the round-8 R1 and R2 reports, to cross-reference R1.8-02 and R1.8-03.

**Ran, as the instructor** (p, pl, s and proj):
- **The other-device form.** Code and key typed key by key, Show and Hide (click and touch), Enter with a wrong key (error colour and position), Show after the failed read, Enter with the right key (read held, "Loading…", then the list), and the header against the ✕. Overflow measured in every class-sheet state.
- **Making a code.** Held, busy, full, 503, a reopen in the fail state, Use it without results, a reopen in the off state, Set up results in the row while the box says off, Try again answered `taken` (struck through), the ask on a lost code, the ask on an ok code (Keep, New code), and invalid.
- **Saved codes.** Eight codes: confirmed, unconfirmed, ended, past their date ("may have ended"), never shown, two older-version codes and an attending code. Two Set up results at once (one held then busy, one ok). Results on a past-date code answered `key`.
- **Results and deletes.** A row confirm from the lower third, "Deleting…", a 503 in the row, another ✕ clearing the error, a delete ok, Delete all held then busy, Delete all done, and the empty state. Copy table read back, including an attending row and a row without the new keys.
- **Keyboard.** Opening the sheet, Tab order, Enter on each button, Escape on each confirm, Refresh.
- **Tap targets.** Sizes in every state.

**Ran, as the student** (real class-code shifts: charge nurse, attending, an attending who saw no patients, a fired attending, plus full Manic Monday and Full Moon Friday attending shifts):
- **The summary.** Verdicts, "Your patients", the complications label, and where the Send box sits at four sizes.
- **The Send box.** A local refusal, clearing it by typing, the same text again, an empty Send twice, the server's name refusal, full, unknown, and sent, with the call body checked.

**Also:**
- **Regressions.** Play a code typed key by key with a made code on screen, then Enter starts the shift. The Words search typed in a running shift. `class_test`, `ui_test` and `md_ui_test` in a scratch copy, all clean.
- **The newer commit.** `1d284f1`'s built page, for R4.8-01 (still broken) and R4.8-03 (fixed).

**Not covered:**
- **Devices and browsers.** No real iOS or Android, so no soft keyboard. Errors at the bottom edge ("Loading…" at 799–815 on 851, the wrong-key error at 801–851) may sit under a real keyboard. No WebKit or Firefox here, so `-webkit-text-security` on the masked box is unverified in Firefox.
- **Screen readers.** No VoiceOver or NVDA.
- **Share.** No `navigator.share` in headless desktop Chrome.
- **The live server.** Not contacted, by rule.

## 5. What I'd keep
- **Use it without results** for every failure, with the key kept so Try again can still set the same code up.
- **The lost state:** struck through, with no Copy, Share or Play, and a plain "Tell students not to tap Send."
- **Row deletes:** "Deleting…" and the error in the row, and confirms that scroll into view.
- **Red, bold errors** across both halves of the feature.
- **The Results header** placed clear of the ✕ at every size.
- **"may have ended … open Results to check"** and the plain "The server has no class for X now" message.
- **The Send box** right under the score cards, with the name box first.
- **The complications number:** one label, counting only chance outcomes, not contraindicated drugs a second time.
