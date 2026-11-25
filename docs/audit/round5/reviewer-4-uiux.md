# Reviewer 4, round 5: UI/UX (senior game UI/UX designer)

Review of the round-4 fixes to Phase 2 (private class results) on branch `claude/sleepy-rubin-jot35n`, v0.31.0, HEAD `7cb5613` (the UI is from `46a0b03`). Nov 24 2026.

**Setup**
- Scratch folder: `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round5/r4/`, called `r5/` below. Screenshots are in `r5/shots/`. Scripts are `r5/s1_make.py` to `r5/s11_reopen_proj.py`, and their raw output is in `r5/s*.out` or was printed.
- I ran the committed `index.html` over `http://127.0.0.1:8767` in headless Chrome (`CHROME_PATH=/usr/bin/google-chrome`).
  - Phone sizes, with mobile emulation and touch on: `p` 390×844, `pl` 844×390 and `s` 360×640.
  - Projector: `proj` 1280×720, not mobile.
- I stubbed all four RPCs in Playwright (`r5/common.py`, `Server`, the same way `test/class_test.py` does) and aborted every other off-host request. Nothing reached supabase.co or edcodeblack.com.
- For comparison, I ran the round-4 build (`git show ce11887:index.html`) and the v0.30.0 build (`101e07a`) from `r5/old/`.
- Severity follows the brief. Items that `round4/STATUS.md` moved or left to the owner are not re-reported.

## 0. Round-4 status

| ID | Status | Evidence |
|---|---|---|
| **R4.4-01** The key is printed under the code | **Fixed** | The key is not in the DOM until **Show key** (`key_text_in_dom: false` at p, pl, s and proj; `p-03-made.png`, `proj-04-key-shown.png`). One way back in: R4.5-04. |
| **R4.4-02** Delete column clipped, confirm reads "D"/"K" | **Fixed** | It's a list now. Every ✕ is 44×44, on the left, and fully on screen at all four sizes, next to a 20-letter name. `#sheet` scrollWidth equals clientWidth in every state (`s4.out`, `over`). |
| **R4.4-03** The key is shown once | **Partly fixed; one part is worse** | Every saved code now has **Results**, **Show key**, **Copy key** and **Forget**, all codes are listed, and a typed code uses the saved key. **But** the device now drops the key on day 7 while the class lives to day 30 (R4.5-02). In round 4 it kept the key 30 days. |
| **R4.4-04** A double tap on ✕ deletes | **Fixed for the double tap** | Two clicks 120 ms apart didn't delete. `cbDelGo` ignores taps within 450 ms. But the confirm now renders where nobody can see it (R4.5-03). |
| **R4.4-05** Delete and Refresh jump to the top | **Fixed** | Delete row 20: `scrollTop` 1312 → 1312 (p), 1090 → 1090 (pl). During Refresh the 29 rows stay, and the header adds "· loading…". |
| **R4.4-06** The table's numbers aren't on the summary | **Partly fixed** | **Fixed:** the list says "95/100", "walked out" and "died". The student's Send box and sent state now say "90/100 · ★★★ · 5 min played". **Still open:** each row's "wait 14 min" is the shift's average wait, and the student's summary never shows it. "All the numbers" lists EMS wall time, not the average wait (`ui.js:2869-2872`). |
| **R4.4-07** The key below the fold; Copy closes the sheet | **Partly fixed** | **Fixed:** Copy keeps the sheet open (`sheet_open_after_copy: true`). The failure box has `role="alert"`, and "Making a class code…" is a `role="status"`. **Still open in landscape (844×390):** after the code appears, **Show key** sits at 344–394 and **Copy key** at 402–452, below a 390 px screen (`pl-03-made.png`), because `cbScroll` uses `block: 'nearest'` on a `.cc-made` taller than the screen. When the code replaces "Making…", the status node is removed and nothing is announced. |
| **R4.4-08** "Copied" shown when nothing was copied | **Fixed** | `copyText` resolves false on a refused clipboard plus a failed `execCommand`. The toast then says "Copy didn't work here. Tap Show key and write it down.", and the secret is no longer in a toast. That toast is cut off at 360 (R4.5-06). |
| **R4.4-09** Enter does nothing; focus lost | **Partly fixed** | Enter sends, and `enterkeyhint="send"` is set. Typing keeps focus (the summary isn't redrawn by the frame loop). **Still open:** after Send with the button, after any server answer, and during Sending…, focus goes to `BODY`. The box still has no `aria-invalid` and no `aria-describedby`. |
| **R4.4-10** Refusal wording | **Partly fixed** | **Fixed:** the unknown-code answer is "…Show your instructor this summary instead." "Self-reported" is gone from the student box. Busy says "this hour". **Still open:** one sentence ("…letters only…") answers an empty box, a 21-letter name ("Bartholomewjonathanss") and a four-word name ("Ana Maria Lopez Ruiz"), all of them letters only. The box now allows 40 characters (`maxlength="40"`, `ui.js:2153`) for a 20-character rule. |
| **R4.4-11** A wrong key wipes the key box | **Worse** | The fix writes every keystroke into `U.cbForm`, and `cbListHTML` writes it back as `value="…"`. The box is then rebuilt within 110 ms of each key, so the form can't be typed into at all (R4.5-01). It worked at `ce11887`. |
| **R4.4-12** 40 px targets; Delete all doesn't look destructive | **Partly fixed** | **Fixed:** targets are 44 px. Both confirms use a red `.danger` button. **Still open:** neither confirm says it can't be undone. **Refresh** is still at the bottom: 3,789 px down a 3,987 px sheet with 30 rows (p). |
| **R4.4-13** The code can change on screen | **Fixed** | The code shows only after registration. A `taken` answer swaps it before anyone sees it (class_test checks this, and I saw it in `s1.out`). |
| **R4.4-14** An unsent result is lost without warning | **Partly fixed** | Menu and Run it back now ask once. That warning is cut off on upright phones (R4.5-06). There is still no "Send to your instructor ↓" near the top: the Send box starts at 705 px (pl) and 756 px (s), below the first screen. |
| **R4.4-15** Privacy text | **Partly fixed; the length is worse** | **Fixed:** it lists every field. The region is recorded (`supabase/README.md:4`, AWS us-east-1). The README sentence is fixed. **Worse:** the paragraph went from 82 to **154 words** in one block, 517 px tall at 390 and 567 px at 360 (`p-70-about-privacy.png`). See R4.5-09. |
| **R4.4-16** Screen-reader details | **Partly fixed** (STATUS: partly) | **Fixed:** visible labels "Class code" and "Instructor key". **Fix doesn't work:** the star `aria-label` sits on a plain `<span>`, and the ARIA snapshot still reads "★★★". **Still open:** focus after "A code made on another device" stays on `BODY`. |
| **R4.4-17** The projected results | **Partly fixed** (STATUS: partly) | It's still a 580 px modal, with 8 rows per 720 px screen. "A code made on another device" is still a full-width dark button. When no code is saved it's still labelled "Open with an instructor key". |
| **R4.4-18** Polish | **Still open, mostly** | **Fixed:** "MD" on every row. **Still open:** "Sending…" at about 1.9:1. "Copy" next to "Copy key". **Play it** as the blue primary. "until Dec 24". "No results sent for this code **yet**" right after Delete all. **Worse:** the version tag lost its `title`, so "v0.30.0" now explains itself nowhere. The repeat registrations now show up in the list (R4.5-08). |

**Counts: 6 Fixed, 10 Partly fixed, 1 Still open, 1 Worse** (R4.4-11). R4.4-03 and R4.4-15 each have a part that got worse.

## 1. Verdict

**No.** The round-4 fixes address the right problems: the key is hidden, the list is a list, and the copy feedback is honest. But the rewrite breaks basic interaction:
- **Typing.** The "A code made on another device" form can't be typed into. Each box keeps one character, then the box is rebuilt and focus and the keyboard go away. The student's **Play a code** box has the same bug (since v0.20). The tests use `fill()`, which hides it.
- **The saved key.** The device forgets an instructor key on **day 7**, while the class and its results live to day 30. The screen promises "It's saved on this device" and "A lost key can't be recovered".
- **Delete.** Tapping ✕ on any row past the first few shows nothing. The confirm renders at the top of the list, 870 to 1,900 px above the screen, and the row under the finger jumps 103 px. "Delete all" does the same. The Privacy page's promise ("ask your instructor: they can delete any result") rests on this control.

## 2. Score

**4 / 10.** Held. More round-4 items are fixed than not, but there are three new Highs, and one is a regression a tester hits on the first keystroke.

## 3. New findings (worst first)

### R4.5-01 · High · Typing in the class sheet: each box keeps one character, then is rebuilt under the finger
- **Where:**
  - `ui.js:2973`: `frame()` calls `render()` every 110 ms, and that calls `renderSheet()` → `classHTML()` → `morph()` (`ui.js:16`).
  - `morph` replaces any top-level child of `#sheet` whose HTML changed.
  - The boxes write what is typed into state, and the state back into the HTML:
    - `#cbCode` and `#cbKey`: `value="${esc(F.code)}"` and `value="${esc(F.key)}"` (`ui.js:2110-2111`). The input handler stores every keystroke in `U.cbForm` (`ui.js` `bind()`).
    - `#ccIn` (Play a code): `value="${esc(U.codeIn)}"` plus the hint text and the Start button's state (`ui.js:2007`).
- **Screens:** `p-22-typed-form.png`, `pl-22-typed-form.png`. Scripts: `r5/s3_typing.py`, `s3c_ident.py`, `s3b_old.py`, `s3d_oldform.py`.
- **What (real key events, one key every 180 ms):**
  - **At HEAD.** Typing "wcvr0j" into **Class code** leaves `w`. Typing the 16-character key leaves `7`. `document.activeElement` is `BODY` after the first key, at 390×844 and at 844×390.
  - **It's the rebuild.** The input I typed into is `isConnected: false` 250 ms later (`s3c_ident.py`). The same happens with mobile emulation off.
  - **The other-device form is a regression.** At `ce11887` the same keystrokes gave `cbCode=wcvr0j` and `cbKey=7K2M9QXH` with focus kept. The R4.4-11 fix (keep the typed key) is what broke it.
  - **Play a code is old.** The student's box loses focus after one key at HEAD, at `ce11887` and at v0.30.0 (`s3b_old.py`). Per `git log -S`, the `value` binding and the morph-rendered sheet both date from v0.20.0. I missed it in round 4 because my scripts used `fill()`, as `class_test.py` does: `fill()` sets the whole value in one input event.
  - **Paste.** One paste works, but focus is lost right after it (`s10_form.py`: `focus_after_paste: BODY`), so Enter can't be used either.
  - **Buttons too.** The same rebuild drops keyboard focus after **every** button in the sheet. After Enter on **Hide key**, on ✕ and on **Delete**, focus is `BODY` (`s2q.out`, `s7.out`).
- **Why it matters:**
  - On a phone, the keyboard closes after each character. A student typing the code from a projector, the main way a class joins, has to tap the box again for every character.
  - An instructor opening results on the classroom PC, the documented recovery route, can't type a 16-character key at all.
  - `docs/SMOKE.md` lines 30 and 35 ask for both of these on a phone.
- **Fix:**
  - Don't put typed values in the rendered HTML. Drop the `value=` bindings and write `U.cbForm` / `U.codeIn` back after `morph`, only when the box isn't focused.
  - Or make `morph` keep a node that holds `document.activeElement` and patch its siblings.
  - Add one UI test that types with `page.keyboard.type(..., delay=150)`.
- **Effort:** S

### R4.5-02 · High · The device forgets a saved instructor key on day 7; the class and its results live to day 30
- **Where:**
  - `cbRegister` (`ui.js:2065`) saves `exp` from `cb_class_new`. The migration answers 7 days there (`…private_results.sql:53, 245`) and moves the class to `created_at + 30 days` when the first result arrives (lines 283–284).
  - `cbShow` refreshes the saved record only for a typed key: `if (!a && rem) cbKeySave(…)` (`ui.js:2573`). Reading a saved code never updates its `exp`.
  - `cbKeys()` (`ui.js:2054`) hides any record past `exp`, and the next `cbKeySave` deletes it from storage.
- **Screens:** `p-50-two-dates.png`, `p-51-day8-key-gone.png`. Script: `r5/s5_expiry.py`, output `s5.out`.
- **What:**
  1. **Make a code.** The stored `exp` is now + 7 days.
  2. **A student sends a result, and the instructor reads it with the saved key.** The header says "1 result · **deleted on Dec 24**". The tile for the same code, on the same screen, says "**until Dec 1**". The stored `exp` is still Dec 1.
  3. **Day 8** (Playwright clock). Class results lists nothing and offers only "Open with an instructor key". The record is still in storage but hidden.
  4. **Making any new code** deletes it for good (`day8_store_after_new_code_has_old: false`).
  5. **In round 4** the server answered 30 days on register, so the device kept keys for the class's whole life. This is a regression from the new 7-day rule.
- **Why it matters:**
  - A weekly class is the normal case: make the code Monday, play Wednesday, debrief the next Tuesday. On day 8 the instructor loses the results and the ability to delete any of them, for the remaining 22 days.
  - The made-code box says "It's saved on this device" and "A lost key can't be recovered". The second one comes true.
- **Fix:**
  - In `cbShow`, whenever the server returns `expires` for a saved code, save it: `cbKeySave(code, { k: key, exp: r.expires, t })`.
  - Better: store `created + 30 days` as the keep-until date, and let the server's "no such class" remove it.
  - Show one date per code, the server's.
- **Effort:** S

### R4.5-03 · High · Tapping ✕ (or Delete all) shows nothing: the confirm renders at the top of the list, far off screen, and the row jumps under the finger
- **Where:** `cbListHTML()` (`ui.js:2120`) inserts `.cb-ask` **above the list**, after the "Not for grading" line, whichever row was tapped. `cbDel` scrolls nothing and focuses nothing.
- **Screens:** `p-34-x-tapped-mid.png`, `pl-34-x-tapped-mid.png`, `s-34-…`, `proj-34-…`, `p-38-delall-tapped.png`, and `p-35-confirm-bar.png` (scrolled up to it). Script: `r5/s4_results.py`, output `s4.out`.
- **What (30 results, ✕ on row 20 with that row mid-screen):**
  - **Where the confirm lands.** Its top edge is at **−874 px** (p), **−1,025** (pl), **−1,123** (s) and **−859** (proj), relative to the screen.
  - **What the instructor sees.** The ✕ doesn't change. Row 20's ✕ moves from y 474 to y 577: everything shifts down by the bar's 97 px plus a gap. What is now under the finger is the body of another row.
  - **Delete all.** The link at the bottom does the same. Its bar is at −1,517 (p), −1,741 (pl) and −1,918 (s), and the link text doesn't change.
  - **Where the confirm is visible.** With the tapped row mid-screen, only the first ~5 rows at 390, ~3 in landscape (4 rows fit) and ~4 at 360.
  - **Which student.** The confirm names only the name: "Delete Li's result?". In my list, rows 10, 20 and 30 are all "Li". Duplicate names are routine (each **Run it back** plus **Send** adds a row under the same name), and the bar doesn't say which one.
  - **Escape** closes the whole sheet instead of cancelling.
- **Why it matters:** Deleting one student's result is the only deletion route the Privacy page offers. On a phone, past the first few rows it looks broken, and a second tap lands on a different row.
- **Fix:**
  - Render the confirm inline, directly under the tapped row, full width. Put **Keep** under the finger and **Delete** away from it. Keep the 450 ms guard.
  - Or keep it at the top but scroll it into view and move focus to **Keep**.
  - Put the rank and score in the question: "Delete Li's result (20th, 57/100)?".
  - Put the Delete all confirm where its link is.
- **Effort:** S

### R4.5-04 · Medium · A key shown once stays shown: reopen Class code later (on the projector) and it's printed twice under the code
- **Where:** `U.showKey` is cleared only by `codeMake`, `keyShow` and `keyForgetGo` (`ui.js:2527-2536`). Closing the sheet (`closeSheet`, `ui.js:2660`) leaves it set. `cbRegHTML` and the saved-code tile both draw the key when `U.showKey === code`.
- **Screens:** `proj-21-reopen-key-shown.png`, `p-20-reopen-key-still-shown.png`. Scripts: `r5/s11_reopen_proj.py`, `s2_quick.py`.
- **What:**
  - **The steps.** Make a code, tap **Show key**, close the sheet with ✕, open **Class code** again.
  - **What shows.** The key is in the made box **and** in the saved-code tile.
  - **On the projector.** At 1280×720, with the code at the top of the sheet (y 50–94), the key is at y 369–395 and again near the bottom: three lines of one screen.
- **Why it matters:** Closing the sheet is how people hide things. A teacher who checked the key at their desk and later opens the sheet on the room's screen shows it to the class. That is R4.4-01's leak again, one step removed.
- **Fix:** Reset `U.showKey` whenever the sheet closes or the code changes. Also hide it again after about 30 seconds.
- **Effort:** S

### R4.5-05 · Medium · Results opens the list below the fold at every size, even with one saved code, and nothing marks which code is open
- **Where:** `cbShow` (`ui.js:2562`) sets `U.cbList` and renders. The list draws below the saved codes and the other-device button, and nothing scrolls to it.
- **Screens:** `p-32-after-results-tap.png` (looks identical to before the tap), `p-80-results-after-make.png`, `p-82-results-one-code.png`. Script: `r5/s8_one.py`.
- **What (12 results):**

| Case | 390×844 | 844×390 | 360×640 | 1280×720 |
|---|---|---|---|---|
| **One saved code, fresh load:** list header top | 997 (screen 851) | 366 (screen 390) | 631 (screen 658) | 769 (sheet ends 670) |
| **One saved code, fresh load:** first row top | 1,084 | 453 | 718 | 837 |
| **Five saved codes:** list header top | 1,160 | 653 | 1,158 | 703 |

  - "Loading…" shows down there too.
  - The open code's tile has no `aria-current`, highlight or "Showing" label.
- **Why it matters:** Every tap on **Results** looks like it did nothing (the same failure as R4-03). Teachers tap it again, which re-reads against the 300-an-hour limit.
- **Fix:**
  - Scroll `.cb-head` to the top of the sheet when the list loads, and mark the open tile.
  - Or show results as their own view with a Back link.
- **Effort:** S

### R4.5-06 · Medium · The leave warning and every class-sheet message ride in a 109–139 px, 12 px pill in the top corner that cuts them off
- **Where:**
  - On the title and report scenes the body keeps `mapmode`, so `toast()` uses the in-game strip (`style.css:527, 543`): two or three clamped lines next to the hidden HUD pills.
  - `unsentGuard()` (`ui.js:2848`) and every `res()` in the class sheet use it.
- **Screens:** `p-65-leave-guard.png`, `s-65-leave-guard.png`, `s-90-copykey-failed.png`. Scripts: `r5/s6_student.py`, `s9_copyfail.py`.
- **What:**
  - **The leave warning.** At 390 and 360 it is a **139×43 / 109×43** pill at the top right, at 12 px, reading "Your result for 062-80A isn't sent yet. Tap Send first, or t…". The instruction it exists for is cut off.
  - **Where it appears.** At the opposite edge of the screen from the **Menu** button that was just tapped, sitting over the score cards. It's gone after about 3 seconds.
  - **The second tap.** At any later time it leaves without asking again (`leave_second_tap_after_4s: true`).
  - **Copy failure at 360.** It reads "Copy didn't work here. Tap Show key an…".
  - **Other messages.** "Deleted 1 result", "This device has forgotten the key for …" and "Copied the table…" go to the same pill.
- **Why it matters:** A guard nobody can read works only as a second tap, and the student who taps Menu twice loses the class result. A failure message cut mid-word doesn't tell the instructor what to do.
- **Fix:**
  - Show the leave warning inline above Run it back and Menu: "Not sent to your instructor yet. **Send** · Leave anyway".
  - Show copy failures inside the key box.
  - Outside a shift, don't use the strip layout for toasts.
- **Effort:** S

### R4.5-07 · Low · "Forget", which destroys the only copy of a key, is the biggest button in each tile, and its confirm doesn't say so
- **Where:** `cbListHTML()` (`ui.js:2108`), with `.cb-codes .cc-row .big { flex: 1 1 88px }`.
- **Screens:** `p-30-saved-codes.png`, `p-32-after-results-tap.png`, `p-31-forget-confirm.png`.
- **What:**
  - **Size.** At 390 and 360 the four buttons wrap three plus one, so **Forget** is a full-width 333×50 (310×50 at 360) dark button. It's the heaviest object in every tile, under the actions that matter.
  - **The confirm.** It reads "Forget this key on this device?". It doesn't say that without the key the results can't be opened again, and doesn't offer **Copy key** first.
  - **What works.** The confirm puts **Keep** under the finger, so a double tap doesn't forget.
- **Fix:** Make Forget a small text link, like "Delete all…". Change the confirm to "Forget the key for 2KY-R1H? Without it you can't open these results again. Copy it first."
- **Effort:** S

### R4.5-08 · Low · Codes the instructor never saw now sit in Class results
- **Where:** `codeMake` (`ui.js:2527`) and `cbRegister` (`ui.js:2065`). The key is saved **before** the call. The four shift buttons stay live during "Making a class code…" (`lv_disabled_while_making: [false ×4]`).
- **Screen:** `p-14-rapid.png`. Output: `s1.out` (`rapid_list`).
- **What:**
  - **Quick taps.** Three quick shift taps registered three codes. Only the last was shown, but all three are listed: "M2F-086 … Manic Monday", "HBD-R4D … Quiet Tuesday", "WAV-012 … Five-Minute Rush".
  - **A timed-out registration.** That code stays listed with its key ("NTV-RC5 … until Dec 1"). Its **Results** answers "That code and key don't match, or the class has ended".
  - **In round 4** the orphans were invisible (R4.4-18). Now they clutter the list the instructor uses to find their class.
- **Fix:** Disable the shift buttons while "Making…". Only list a code once the server has said `ok`. Keep the pre-call record hidden as "pending".
- **Effort:** S

### R4.5-09 · Low · The Privacy paragraph doubled to 154 words in one block, and it doesn't mention the instructor's exports
- **Where:** `aboutHTML()` (`ui.js:2803`).
- **Screens:** `p-70-about-privacy.png`, `s-70-about-privacy.png`.
- **What:**
  - **Length.** One paragraph lists 17 fields in a single sentence: 154 words, 517 px tall at 390 and 567 px at 360. That's against the owner's "few words, key words in bold" rule.
  - **Exports.** **Copy table** and **Download CSV** put every name and score on the instructor's clipboard or disk, outside the 30-day deletion. The text says "Everything sent for a code is deleted 30 days after the code was made" and doesn't mention copies.
- **Fix:** A bold lead and a short bullet list (Who sees it · What is sent · How long · How to delete). Add "Your instructor can copy or download the list; those copies are theirs to delete."
- **Effort:** S

### R4.5-10 · Low · A busy, full or taken registration says "Try again later" with no way to try again, and leaves the dead code big on screen
- **Where:** `cbRegister` / `cbRegHTML`. `hard: true` hides **Try again** (`ui.js:2083`).
- **Screen:** `p-12-busy.png`.
- **What:**
  - **The message.** "Class results are off for this code. Too many requests from your network this hour. Try again later." There's no button.
  - **The dead code.** It stays in 40 px with Copy, Share and **Play it** (blue).
  - **The only retry** is tapping a shift again, which makes a different code. Nothing says so.
- **Fix:** Say "Make a new code in a while (tap a shift above)". Dim the dead code, or label it "results off".
- **Effort:** S

### R4.5-11 · Nitpick · Polish
- **Glyphs.** The row's delete button is the same "✕" glyph as the sheet's Close, a few centimetres away. On the projector both are in view (`proj-33-results-top.png`). ✕ means dismiss; use a bin icon or the word.
- **Overlap.** On the projector the sheet's Close covers the end of "Not for grading … under any name" (`proj-33`).
- **No feedback.** Nothing says a CSV was downloaded. On a phone it goes to Files without a word.
- **Show key state.** It has no `aria-expanded` or `aria-pressed`. The sheet `role="dialog"` has no accessible name.
- **The name box.** `maxlength="40"` while the rule is 20 characters. The 21st letter earns "letters only".
- **The made-code box.** It no longer says when the code and results are deleted. The only date is the tile's "until …", which is the wrong date (R4.5-02).

## 4. Coverage

**Read:**
- `docs/audit/BRIEF.md` (Rounds 4 and 5, How to run), my round-4 report, `round4/STATUS.md`.
- `git diff ce11887..46a0b03 -- src` (ui.js, style.css, backend.json), the commit message, `test/class_test.py`, the SMOKE class-code section, the README v0.31.0 paragraph.
- The migration's expiry rules, at HEAD and at `ce11887`.

**Ran, as the instructor** (p, pl, s, proj):
- **Making a code.** Make a code with registration held ("Making…"), answered, failed (503), busy, and never answered (8 s). Try again. Three quick shift taps.
- **The key.** Show key, Hide key, Copy key (granted and refused clipboard, with `execCommand` failing). Copy code. Close and reopen with the key shown.
- **Saved codes.** Five of them: Results, Show key, Copy key, Forget and its confirm, a double tap on Forget.
- **Results.** A 30-row list with long, three-word, accented, attending, old-version and fired rows. ✕ mid-list, the confirm, the double-tap guard, Delete, Refresh held, Copy table (clipboard read back), Download CSV (file read back), Delete all.
- **Another device.** The form typed key by key, pasted, and Enter.
- **Expiry.** The 7-day and 30-day dates, and day 8 on a Playwright clock.

**Ran, as the student** (p, pl, s, on a fresh class-code Rush summary):
- **Names.** Empty, an email, "Mary Jo Ann", "Ana Maria Lopez Ruiz", "Sam 2", 20 and 21 letters, "李小龙", "Siobhán Ó Briain", "J.R.R.", "D'Angelo", "Sam_R", "Sam!". Typing key by key.
- **Sending.** Enter, then every server answer (unknown, version, full, busy, invalid name, invalid stats, 503, 404, network failure), Sending… held, the 8 s timeout, and sent.
- **Leaving.** Menu with the result unsent, then again after 4 s.

**Also:**
- About → Privacy and "A game, not a protocol" at p, pl and s. The Lessons header line.
- The ARIA snapshot of the made code, the saved tiles, the results list, the confirm and the form. Keyboard Tab and Enter through a delete.

**Not covered:**
- **Real devices.** No iOS Safari, Android Chrome or real touch, and no WebKit or Firefox. In particular, the `execCommand` fallback on iOS and the CSV download on iOS.
- **Screen readers.** No VoiceOver or NVDA. Accessibility findings come from Chrome's ARIA snapshot and the DOM.
- **Share.** `navigator.share` doesn't exist in headless desktop Chrome, so the Share button was never drawn.
- **Long reports.** The Send box position was measured on a short Rush report only.

## 5. What I'd keep
- **The hidden key.** Nothing in the DOM until **Show key**. Masked is the right default for a screen made to be projected.
- **The list layout.** ✕ on the left at 44 px, nothing clipped at any width, and a per-name `aria-label` on each ✕.
- **Deletes in place.** The list stays while it refreshes, and the scroll position survives a delete.
- **Honest copy feedback.** `copyText` reports what really happened, and no secret goes in a toast.
- **Registration before display.** The code shows only after the server has it, so it never changes in front of a class. Try again resends the same code and key, so it's safe to repeat.
- **Errors.** They say whether it was the network, a timeout, the server or a version mismatch, and the student's dead ends now point to "Show your instructor this summary instead".
- **Exports.** Copy table and the CSV are formula-safe and carry plain column names.
- **The disclaimers.** "No licensed clinician has reviewed …" is in About ("A game, not a protocol") and in the Lessons header, in bold.
