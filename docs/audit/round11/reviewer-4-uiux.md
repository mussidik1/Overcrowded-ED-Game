# Reviewer 4, round 11: UI/UX (senior game UI/UX designer)

Release review of v0.31.0 on branch `claude/sleepy-rubin-jot35n`, HEAD `e3fbeec`. The UI changes since round 10 are `git diff 1ab6fa9..e3fbeec -- src`. Nov 25, 2026.

**Setup**
- **Scratch folder:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round11/r4/`, called `r11/` below. Screenshots are in `r11/shots/`, scripts are `r11/t*.py` and `r11/gen*.py`, and raw output is `r11/*.out`.
- **The page:** the committed `index.html` at `e3fbeec`, from a `git archive` copy in `r11/repo/`. My `node build.js` there matches the committed file byte for byte (`cmp`). Served at `http://127.0.0.1:8791` and opened in headless Chrome (`CHROME_PATH=/usr/bin/google-chrome`).
- **Sizes:**
  - 390×844, 844×390, 360×640 and 320×568 with mobile emulation and touch.
  - A true 360 and a true 320 (no emulation), and 375×667.
  - A 1280×720 desktop projector.
- **The server:** the RPCs are stubbed in Playwright (`r11/common.py`). They answer with the contract's keys, and can also abort, send HTTP 503 or 429, or hold a request. Every other off-host request is aborted. Nothing reached supabase.co or edcodeblack.com.
- **Typing:** real key events only (`keyboard.type`, `press`, Enter, Tab, Shift+Tab, Escape). Never `fill()`. The one exception is `t41_keys.py`, which sets 3,000 random keys into the box with script, to measure their width.
- **Not re-reported:** anything `round10/STATUS.md` and earlier STATUS files leave to the owner, to a later pass, or mark "partly fixed, with the reason", unless the fix made it worse.

## 0. Round-10 status

| ID | Status | Evidence |
|---|---|---|
| **R4.10-01** (Medium) The planned-code date was blank | **Partly fixed** | **Fixed:** the date now shows: "…a student's first result before **Jan 7** starts it again for 30 days" (`t14-p.out`). It uses `Date.parse(R.exp)`.<br>**Still wrong:** the same paragraph says "Results are deleted on Dec 24 once a student sends one". That's false for a first result between Dec 9 and Jan 7, which the next sentence advertises: that result restarts the class for 30 days from then. The panel is still 115 words with nothing about the dates in bold. |
| **R4.10-02** (Medium) Refresh wiped the ended class's copy | **Fixed** | After a refused delete, the buttons are Copy table, Download CSV and Close results, with all 8 rows kept and no ✕ (`t15-p.out`). **New, smaller hole:** the saved row's **Turn results back on**, then its **Results**, still replaces the copy without asking. See R4.11-04. |
| **R4.10-03** (Medium) Focus after a confirm landed on the wrong row, or on BODY | **Partly fixed** | **Fixed:**<br>• ✕ puts focus on Keep. Keep and Escape put it back on the same ✕ (li#1 → li#1).<br>• Delete all: the question's Keep, and Escape returns to the link.<br>• Forget: Keep, and back to Forget. Forget's confirm goes to the sheet.<br>• The replace question: its Keep.<br>**Still broken** (`t30-proj.out`):<br>• **Delete**, a failed delete and **Delete all** end on `BODY` once the server answers. See R4.11-01.<br>• **Set up results** and a shift button: `BODY` while waiting and after the answer.<br>• **New code** that fails: another code's **Show key**, off screen (y=735 of 720).<br>• **Close results**: "A code made on another device", not the Results button that opened the list.<br>• The typed-key form: Enter on a wrong key, or on the right one: `BODY` (`t1-*.out`). |
| **R4.10-04** (Medium) The key box was 14 px, so iOS zooms into it | **Fixed** | It is 16 px at every size (`t33`). 3,000 random keys shown at 390, 375, a true 360 and even a true 320 never clip (`t41_keys.py`: 0 of 3000 at each). Only a freak all-W key clips: Nitpick 1. |
| **R4.10-05** (Medium) A 5xx blocked making a code | **Fixed** | 503, fresh and on Try again, offers **Try again** and **Use it without results**. A 429 and `busy` offer only Try again (`t2-p.out`). |
| **R4.10-06** (Low) A 429 reads "the server had a problem" outside making a code | **Still open** | Send box, step `10c_429`: "The server had a problem. Try again in a minute." (`t6-p.out`). `cbNet` (`ui.js:2087`) is unchanged. |
| **R4.10-07** (Low) The summary counts an arrest under 5 minutes as "still in cardiac arrest at the end" | **Still open** | `1FN-8A8`: the row reads "Your own patients still in cardiac arrest at the end, with no code running 1". The verdict and the M&M say nothing, and `arrestLeft` is 0 (`t5-mdarrest-p.out`). |
| **R4.10-08** (Low) The verdict points at sections that don't exist, and a lost code hides the other pointers | **Still open** | "Three stars. Now read Diagnoses to review, above and your wrong disposition." (`1FN-8A8`; the comma is still missing and no section lists dispositions). "Three stars. Now read your wrong disposition." (`1J0-87M`). Synthetic `{codeLost:1, dxWrong:2, contra:1, dispoWrong:2}` gives only "A patient died after a code run by the book…" (`t39_verd.py`, `t21.out`). |
| **R4.10-09** (Low) A code taken before it was registered says "class ended" | **Still open** | Row J: "made Nov 22 · **class ended** \| Another class has KJF-G57 on the server now." (`t13-p.out`). |
| **R4.10-10** (Low) Every patient sheet is a dialog named "Details" | **Still open** | `t16-proj.out`: `aria-label` is "Details" for every `pt:` sheet. |
| **R4.10-11** (Low) The page is 349 px wide at 320 | **Still open, and wider than reported** | 349 at 320, and **370 at 360**, the most common Android width. On a true 360 the document `scrollWidth` is 370. The overflow is the top bar's `B` and the `.pm` pills (`t36_360.py`, `t0.out`). |
| **R4.10-12** (Low) The charge nurse reads "The numbers were good" over two deaths | **Still open** | `1BR-89E`: "2 patients died in the department. The numbers were good; read the worst moments below." The M&M has two falls and a CT delay, and neither death (`t5-rn1-p.out`). |
| **R4.10-13** (Nitpick, 18 items) | **Still open** | Rechecked items: #9 still shows 15 entries and "And 7 more." (`t21.out`). #12: "no results · deleted on Dec 8" after Delete all (`t30`). #15: "(stats)" (`t6`). #17: "reached 75%" next to 79% (`1H7-8FA`). #2, #3, #7 and #8 are in unchanged code. |

**Counts: 3 Fixed, 2 Partly fixed, 8 Still open, 0 Worse.**

**STATUS overclaims**
- **"Delete puts it on the results heading."** That's true only while "Deleting…" shows.
  - When the answer comes, the list re-renders. `#cbHead` is replaced, because `morph` keeps only the focused element if it has a `data-act` or is an input.
  - Focus falls to `BODY`, and the next Tab goes to the sheet's ✕ at the top (`t37_del.py`: `["DIV#cbHead", "BODY", false, false, "BUTTON[closeSheet]", …]`).
  - No test checks it: `class_test` asserts focus only for Forget.
- **"a wide 19-character key still fits at 390 and 360."**
  - `class_test` was changed from `WWWW-WWWW-WWWW-WWWW` to `MWMW-HNKD-QG0W-8MHN`, which is half as wide.
  - An all-W key fits at 390, but clips at 375 (320/318), at an emulated 360 (320/306) and at a true 360 (320/296).
  - In practice this is harmless: no random key clipped in 3,000 tries. But the claim and the test were both narrowed without saying so.
- **README:** "The class sheet works from a keyboard: … keeps the focus in place after a confirm." Not after Delete, Delete all, Set up results, making a code, or Enter in the key form.

## 1. Verdict

**Ship v0.31.0 to students: yes.** Nothing on the student's path blocks it:
- **Sending:** the Send box marks the name invalid only for a name problem, survives every network error, and sends once.
- **Codes:** they play the same shift.
- **Summaries:** every verdict I forced is true, if not always complete.
- **Layout:** nothing scrolls sideways in the class sheet at any size, contrast passes in light and dark, and every class-sheet button is at least 44 px (the Remember checkbox is 13×22, but its whole label is the target).

**But the instructor side doesn't yet match what the README promises:**
1. A keyboard or screen-reader instructor who deletes one result is thrown to the top of the sheet. Deleting five results means tabbing through the whole sheet five times (R4.11-01). The README says focus "stays in place after a confirm".
2. Set up results, making a code and the typed-key form still drop focus to `BODY`.
3. The code panel still misstates when a late class's results are deleted.

None of these is harm or data loss. Fix R4.11-01, or drop the README sentence, before it goes to `main`. The rest can wait for the next pass.

## 2. Score

**7 / 10** (round 10: 6). Four of the five round-10 Mediums are fixed or nearly fixed, nothing got worse, and there's no High.

It isn't higher because:
- the round's own focus fix is half-done, in exactly the step it advertises;
- eight Lows from round 10 are untouched;
- the code-loss wording now asserts something the engine doesn't model (R4.11-03).

## 3. New findings (worst first)

### R4.11-01 · Medium · After Delete, a failed delete or Delete all, keyboard focus falls to BODY; the next Tab starts at the top of the sheet
- **Where:**
  - `ACT.cbDelGo` (`ui.js:2786`) sets `U.focusTo = '#cbHead'`. That works for the render that shows "Deleting…".
  - When the server answers, `render()` re-renders `.cb-res`.
  - `morph` (`ui.js:19–35`) only re-homes focus from a focused element that has a `data-act`, or from a text input. `#cbHead` (`tabindex="-1"`, no `data-act`) is replaced by a new node, so `document.activeElement` becomes `BODY`.
- **Reproduce:** `r11/t37_del.py` (1280×720, keyboard only):
  1. Open the class sheet, focus **Results** on a saved code, and press Enter.
  2. Focus the third row's ✕ and press Enter. Focus is on Keep.
  3. Press Tab (focus on Delete), then Enter. The server holds the request; focus is `DIV#cbHead`.
  4. The server answers `{deleted: 1}`. Focus is now `BODY`, and the old `#cbHead` is detached.
  5. Tab goes to `BUTTON[closeSheet]`, then `#ccIn` (Play a code), then the shift buttons.
  - The same happens on a delete that fails (abort): focus `BODY`, and the error is announced through `role=alert`. It also happens after **Delete all** (`t30-proj.out`: `after_delete`, `after_delete_fail`, `after_delall`).
- **Why it matters:**
  - STATUS lists this as fixed ("Delete puts it on the results heading"), and the README promises it.
  - A keyboard instructor clearing a few test results from a list of 30 must Tab back through Play a code, four shift buttons, every saved code and every row before the one deleted. A screen reader hears nothing about where it is.
  - `class_test.py` doesn't check focus after Delete.
- **Fix:**
  - After the answer, focus the row now at the deleted row's index (its ✕), or `#cbHead` when the list is empty.
  - Set `U.focusTo` again in the `.then` and `.catch` of `cbDelGo`, because the answer's render is the one that replaces the node.
  - Or give `#cbHead` a stable identity in `morph`: match by `id` and patch it in place.
  - Add a `class_test` assertion on `document.activeElement` after Delete and after Delete all.
- **Effort:** XS

### R4.11-02 · Low · Keep and Escape on the replace question put focus on a shift button scrolled off the top of the sheet
- **Where:** `ACT.codeAskNo` (`ui.js:2685`) sets `U.focusTo` to the shift button. `renderSheet` applies it with `focus({ preventScroll: true })` (`ui.js:1604`). The question sits at the bottom of the sheet, under the code panel, so the shift buttons are scrolled out of view.
- **Reproduce:** `r11/t30_focus.py proj`:
  1. Make a code.
  2. Press Enter on **Quiet Tuesday**. The question gets focus.
  3. Press Enter on Keep. Focus is on `BUTTON[codeMake](easy) "Quiet Tuesday"` at **y=-131, off screen**. Escape gives the same result.
  - Opening Results is the same: focus stays on the row's **Results**, at y=-103, while the list scrolls into view (`after_results`).
- **Why it matters:** the focus ring is off screen (WCAG 2.4.11, focus not obscured). A sighted keyboard user can't see where they are until they press a key.
- **Fix:** drop `preventScroll` for `U.focusTo`, or call `scrollIntoView({ block: 'nearest' })` after focusing. On Results, move focus to `#cbHead`.
- **Effort:** XS

### R4.11-03 · Low · "A code run by the book (every rhythm check right, a doctor there within 3 minutes)" is also given to codes another doctor ran, which the engine scores as only partly right
- **Where:**
  - `codeOutcome` (`engine.js:2276`): `book = C.wait <= 3 && (!C.me || C.right >= n)`. A code the attending didn't run counts as by the book whenever the team arrived within 3 minutes.
  - The engine models that doctor at `CODE_AI_Q = 0.6`, with the comment "a doctor run by the game gets it partly right" (`engine.js:2243`).
  - The definition goes to three audiences:
    - the instructor, in `CB_MDNOTE` (`ui.js:2200`) and the CSV header "Of them, after a code run by the book";
    - the student, in the Send box (`cbWhatAll`: "(every rhythm check right, a doctor there within 3 minutes)");
    - the verdict: "A patient died after a code run by the book: many arrests don't come back…".
- **Reproduce:**
  - Read the code. An attending sees a patient (`assign` sets `p.mine = true`, `engine.js:1494`; it is never cleared), then reassigns them to another provider. The patient arrests, and `codeStart` gives `me: false` (`engine.js:2206`, `p.prov !== G.me`). The team arrives within 3 minutes and the code is lost. The death counts in `md.codeLost` (`engine.js:3388`).
  - The instructor list then says the student's patient "died after a code run by the book", and the note defines that as "every rhythm check right". Nobody answered any rhythm check.
  - The engine's own odds for that code are lower than for a code run right (0.6 vs 3/3).
- **Why it matters:** the label exists to tell an instructor that a death wasn't the student's fault. For these codes it asserts a quality ("every rhythm check right") that the model says didn't happen. That's teaching text, read by the people grading the class.
- **Fix:** keep "by the book" for `C.me` codes only. For another doctor's code, either don't set `codeLost`, or label it "after a code another doctor ran" and send it as its own count. In both cases, define the label in the summary too, not only in the note and the Send box.
- **Effort:** S (an engine change: rules and golden lines move)

### R4.11-04 · Low · After a refused delete at the class's end, Turn results back on leaves "The class has ended" over a row that says results are on, and the row's Results replaces the kept copy without asking
- **Where:** `codeRegSaved` (`ui.js:2694–2709`) doesn't touch `U.cbList`. The row's main button becomes **Results** (`cbShow`), which replaces `U.cbList` with the server's (now empty) list.
- **Reproduce:** `r11/t15c_ended.py p` (code `114-G96`, 8 results):
  1. Open Results.
  2. Tap ✕, then Delete. The server answers `key`.
  3. The screen shows the ended copy, with no Refresh (R4.10-02 is fixed).
  4. Tap the row's **Turn results back on**. The server answers ok.
  5. The row now reads "results until Dec 8 (Dec 24 once a student sends) | **Results**". Under it, the list still says "The class has ended, and the server has deleted its results. Below is the copy this screen loaded…" (`shots/p-55-turned-on.png`).
  6. Tap **Results**. The list is replaced by whatever the server has: for a restarted class, nothing. My stub kept rows, so it reloaded 8; a real server would return 0. Either way there's no question and no "you'll lose the copy".
- **Fix:** when a row's code matches an ended `U.cbList`, keep the copy and change its message to "Results are on again for X. This list is the copy from before; Copy table or Download CSV keeps it." Make Results on that row ask first, or append below the copy.
- **Effort:** XS

### R4.11-05 · Nitpick (10 items)
1. **The key-fit test was weakened.** `class_test.py` went from the all-W key to `MWMW-HNKD-QG0W-8MHN`. An all-W key clips at 375 (320/318) and 360 (320/296). Real keys don't (0 of 3,000), so the fix is fine, but the test no longer checks what its message claims ("a whole 19-character key of wide letters").
2. **The legal box can read "0% · No action"** over "What raised your legal risk" items adding up to +21. Example: `1QG-0B2`, with "+10: Priya P.: died after a code with 0 of 3 rhythm checks right…". The slow decay (`engine.js:564`) is never mentioned. "Brought down by clean time since" would explain it.
3. **"the team there 0 min after the arrest"** in the new legal line reads like a defect. Say "a doctor there at once".
4. **The Send box text nests parentheses three deep:** "your patients (how many died, how many of those after a code run by the book (every rhythm check right, a doctor there within 3 minutes), and …)".
5. **"Priya P. died after a PEA"** shows "PEA" with no gloss in the M&M title, and "died after a PEA" isn't English. Use "died after a pulseless electrical activity (PEA) arrest", or `DX_PLAIN`.
6. **Close results puts focus on "A code made on another device"**, not on the Results button that opened the list (`t30`).
7. **A 1-star attending whose patient died after a code run by the book** reads "You kept your patients moving. Tomorrow will be better." The death isn't mentioned (`t39`).
8. **"All the numbers" is 317×43**, 1 px under the 44 px target (`t18_lit.py`).
9. **An unused class in its hold now has two full-width buttons**, Results and Turn results back on, over a 30-word sentence ending ": Results checks" (row H in `t13`).
10. **"Your patients" wraps its numbers mid-value at 390:** "149 / 0 / 0" and "19 of 19" break onto two lines (`shots/p-c1a-54-yourpatients.png`).

## 4. Coverage

**Read:**
- `docs/audit/BRIEF.md` (rounds 11 and 10), my round-10 report and `round10/STATUS.md`.
- `git diff 1ab6fa9..e3fbeec` for `src/ui.js`, `src/style.css`, `src/engine.js`, `test/class_test.py`, `README.md` and `CLAUDE.md`.
- `morph`/`morphKids`, `renderSheet`, `cbDelGo`, `codeRegSaved`, `cbNet`, `verdictOf`, `codeStart` and `codeOutcome`.

**Ran, as the instructor:**
- **The other-device form:** at every size, typed key by key; Show; Enter. Also an all-W key, and 3,000 random keys, for width.
- **Making a code:** ok, busy, full, abort, 503 and 429, fresh and on Try again; invalid; the off state; the replace question.
- **The saved-code row in 12 states.**
- **Results:**
  - a refused delete at the class's end, then Turn results back on, then Results;
  - a held delete;
  - a failed delete;
  - Delete all;
  - layout and tap sizes at five sizes;
  - contrast in light and dark.
- **Keyboard only, on the projector:** opening; Tab and Shift+Tab wrap; ✕, Keep, Escape, Delete (held, ok, failed); Delete all and Escape on it; Close results; Set up results; a shift button; the replace question's Keep and Escape; New code failing; Use it without results; Forget, its Keep, its Escape, and its confirm; Escape out of the sheet.
- **In a shift:** a mouse tap (no focus taken); Enter on a list row (focus taken); N after a click (no focus taken); Space then N; the dialog's name.

**Ran, as the student, on real class-code shifts played to the end on this build:**
- **Code deaths:** two codes lost by the book (`1QF-8AD`, `1QF-GB4`) and a badly run code that was lost (`1QG-0B2`, `1QG-8A8`).
- **Arrests:** an own patient's unrun arrest that ended in death (`1GE-8B4`); an arrest 4 minutes old at the end (`1FN-8A8`), and one 10 minutes old (`1FN-GBY`).
- **Other attending shifts:** a fired attending with an unsafe drug (`1H7-8FA`); a 3-star attending (`1J0-87M`).
- **Charge nurse:** one with two deaths (`1BR-89E`), and a forced walkout.
- **Synthetic checks:** 8 verdict inputs; more than 12 unsafe entries.
- **The Send box:** the full sequence of name refusals and network failures, then sent.
- **The legal box:** for three shifts.

**Regressions** in `r11/repo/`: `class_test.py` (107 ok, "No errors.") and `ui_test.py` (51 ok, "No errors."). `md_ui_test.py` (28 ok, "No errors.").

**Not covered:**
- **Devices:** no real iOS or Android, so the 16 px no-zoom fix is from the code plus WebKit's documented rule. No soft keyboard, and no WebKit or Firefox.
- **Screen readers:** no VoiceOver or NVDA, only Chrome's focus and ARIA attributes.
- **The live server:** not contacted, by rule.
- **The migrations:** read only for the restart rule. The database is other reviewers' ground.

## 5. What I'd keep
- **Row questions** take focus on Keep, and Keep and Escape return it to the same row's ✕. A keyboard user can no longer delete the wrong student's result.
- **An outage still gives the class a code** (5xx), while a 429 that a classmate can cause doesn't.
- **A 16 px key box** that still fits every real key down to 320.
- **No Refresh over the ended copy.**
- **Unsafe orders come first** in Orders to review, and the badly-run-code M&M line says how many rhythm checks were right and how long the team took.
- **Codes run by the book and lost** are told apart from badly run ones in the student's own report. Apply the label to the attending's own codes only (R4.11-03).
