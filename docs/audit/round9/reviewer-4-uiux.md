# Reviewer 4, round 9: UI/UX (senior game UI/UX designer)

I reviewed the round-8 fixes on branch `claude/sleepy-rubin-jot35n`, v0.31.0, HEAD `ba471b7` (the UI changes are `git diff 87c9c13..ba471b7 -- src`). Nov 25, 2026.

**Setup**
- **Scratch folder:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round9/r4/`, called `r9/` below.
  - Screenshots: `r9/shots/` (212 files).
  - Scripts: `r9/t1_form.py` to `r9/t11_taps.py`, `r9/gen.py` (real class-code shifts played to the end), `r9/gen_dead.py` and `r9/chk_late.py`.
  - Raw output: `r9/t*.out` and `r9/reg-*.out`. Summaries: `r9/rep-*.json`.
- **The page:** the committed `index.html` at `ba471b7`, from a `git archive` copy in `r9/repo/`. I rebuilt that copy, and its `node build.js` output matches the committed file byte for byte. It was served at `http://127.0.0.1:8790` and opened in headless Chrome (`CHROME_PATH=/usr/bin/google-chrome`).
- **Sizes:**
  - `p` 390×844, `pl` 844×390 and `s` 360×640, with mobile emulation and touch;
  - `proj` 1280×720, a desktop projector.
- **The server:** the four RPCs are stubbed in Playwright (`r9/common.py`, `Server`). They answer with the contract's keys, plus aborts, 503s and held requests. Every other off-host request is aborted. Nothing reached supabase.co or edcodeblack.com.
- **Typing:** every box got real key events (`page.keyboard.type`), plus Enter, Backspace, End, Tab and Escape. I never used `fill()`.
- **Not re-reported:** what `round8/STATUS.md` and earlier STATUS files leave to the owner or to Phase 5/6, unless the fix made it worse. That covers the Send box below the first screen, row height, the ✕ over the text, and the attending's scoring.

## 0. Round-8 status

| ID | Status | Evidence |
|---|---|---|
| **R4.8-01** (High) The other-device form slid the sheet sideways at 390 and 360 | **Fixed** | `#sheet.scrollWidth` equals `clientWidth` in every state at all four sizes, with and without saved codes: 393/393, 370/370, 470/470 and 580/580 (`t1-*.out`). Show sits inside the card: 291–363 on a 377 card at 390, and 268–340 on 354 at 360. `class_test.py:281` now checks 390×844 and 360×640. **Side effect:** the narrower key box clips the shown key. See **R4.9-02**. |
| **R4.8-02** (Medium) Send went dead after a refusal was cleared | **Fixed** | Sending an empty box twice shows the message twice, with `aria-invalid` each time. "Sam 2" refused, then a space and a Backspace, then Enter: the refusal shows again (`t6-p.out` steps 3 and 6, `t6-s.out`). A server-refused name sent again shows the refusal again. |
| **R4.8-03** (Medium) "Class results are off" stayed up after the row turned results on | **Fixed** | `codeRegSaved` now rewrites `U.reg` (`ui.js:2669`). The new `class_test.py` check passes: 95 ok in `r9/reg-class_test.out`. |
| **R4.8-04** (Low) Deaths in the verdict, "Nothing went badly wrong… Take the win" below | **Still open** | `mmHTML` changed only for `R.fail`. Code `25E-0BY` (attending, Manic Monday, saw no patients) still reads "1 patient died in the department…" over "Nothing went badly wrong this shift. Take the win." (`p-mdnone-51-verdict.png`). The charge nurse has the same gap: `1BR-89E` (Manic Monday, seed 5601) reads "2 patients died in the department. The numbers were good; read the worst moments below.", and the worst moments are two falls and a CT delay. Neither death (failed codes run by the game's doctors) writes an M&M line (`gen_dead.py`). Not in STATUS. |
| **R4.8-05** (Low) The fired verdict pointed at M&M | **Fixed** | The fired code `17V-8EJ` reads: "Legal risk reached 75%… "What raised your legal risk", above, lists every reason." The new empty-M&M line misfires for walkouts (R4.9-08), and the target is 19 px tall (R4.9-09). |
| **R4.8-06** (Low) The no-results states contradict themselves | **Still open** | All three parts are unchanged:<br>• The fail box still says "A code is shown only once its class results are set up, so it never changes in front of a class." right above **Use it without results** (`p-12-full.png`).<br>• The off box still has "Students: … a Send button that sends you the result." right above "Tell them not to tap Send" (`p-13b-off-full-scrolled.png`).<br>• After a timeout, it still says results "are off", when the server may have registered the code. |
| **R4.8-07** (Nitpick, 17 items) | **Partly fixed** | **Fixed (3):**<br>• #2: an older-version tile now reads "v0.30.0 · Attending · …".<br>• #16: the CSS comment.<br>• #17: README:55 is now true.<br>**Still open (14):**<br>• #1: "saw 1 patient (1 of them died)" (`t9_rows.py`).<br>• #3: **Keep** a lost code is still the main button.<br>• #4: "It may take days to clear." still sits above **Try again**.<br>• #5: invalid still says "No class code yet".<br>• #6: "Class results, below, says more".<br>• #7: the ~100-word attending caveat.<br>• #8: the Send small print, now longer ("mean door-to-provider wait").<br>• #9: the Send box below the first screen. This is Phase 5, so it's not counted.<br>• #10: Forget writes a space to the clipboard.<br>• #11: a row's ✕ stays enabled while "Deleting…".<br>• #12: Turn results back on moves the tile.<br>• #13: "harm from orders 2" on old rows, and the CSV puts all harm under Complications.<br>• #14: "100%" accuracy over "0 of 0" (`p-mdnone-51-verdict.png`).<br>• #15: the lost code at opacity .35. |

**Counts: 4 Fixed, 1 Partly fixed, 2 Still open, 0 Worse.**

**STATUS overclaims**
- **"no 'numbers were good' … when an own patient died or there are calls to review."**
  - The calls-to-review case isn't excluded from the death branch (`ui.js:3048`).
  - Code `1EW-8AN` (attending, Manic Monday, seed 6001) has 3 stars, a wrong diagnosis and one department death. It reads "1 patient died in the department. The numbers were good; read the worst moments below." (`t5-s6001-p.out`). See R4.9-07.
- **"the order review names each contraindicated drug and why."** That holds only within its first 12 entries. On `1AZ-8A7` the ibuprofen is entry 16 of 19, behind "And 7 more." See R4.9-01.
- **"a class past its end says 'class ended' with Turn results back on."**
  - The new "class ended: results deleted Oct 30" tile offers **Results**.
  - **Turn results back on** appears only after that request fails. See R4.9-05.
- **"a refused delete at the class's end marks it ended."** True. But the list keeps showing the 8 deleted results under "its results have been deleted". See R4.9-04.
- **"the replace question sits under the code."** True. But the scroll to it pushes the code off the screen at 360×640 and 844×390, and on the projector the code still moves 121 px (R4.9-12, item 5).

## 1. Verdict

**Close, not yet.** The round fixed what it set out to fix:
- **The other-device form** fits at every size.
- **Send** no longer goes silently dead.
- **The code panel and its row** agree.
- **"Use it without results"** is gone for busy.
- **The fired verdict** points at the right list.
- **The order review** names unsafe drugs.

Three things stop it:
1. **The order review drops an unsafe drug past its first 12 entries.** On a real 3-star Manic Monday attending shift, an NSAID in chest pain before the troponin is entry 16 of 19, hidden behind a plain-text "And 7 more." Its reason appears nowhere on the summary. The verdict tells the student to "read the calls to review below".
2. **The key box fix clips the shown key on upright phones.** After **Show**, the last one to three characters are cut, and at 390 a half-cut T reads as a 7. The one control meant for checking a 16-character key can't show the whole key.
3. **The class sheet still isn't usable by keyboard or screen reader.** The `aria-modal` dialog never takes focus, Tab walks the buttons behind it, it has no name, and nine buttons drop focus to `BODY`. This has been open since round 7, with no STATUS entry.

## 2. Score

**6 / 10** (round 8: 6). The High is gone, and the instructor flow is sound at every size. This round's fixes brought new problems:
- a narrower box that hides the key;
- a verdict rewrite that still says "numbers were good" over a wrong call;
- an empty-M&M line that points a charge nurse at a section they don't have.

The teaching payoff of the unsafe-drug fix is lost exactly when a shift is busy.

## 3. New findings (worst first)

### R4.9-01 · Medium · Orders to review hides an unsafe drug, and its reason, after the first 12 entries
- **Where:**
  - `ordLogHTML` (`ui.js:3092–3094`) keeps entries in the order they were logged, shows `L.slice(0, 12)`, and ends with `<p class="hint">And ${L.length - 12} more.</p>`.
  - That last line is plain text, not a disclosure.
  - The round-8 `unsafe` field (`engine.js:1887`, `:1924`) only rides on an entry, so its place in the list depends on when the order was signed.
- **Reproduce:**
  - `r9/gen.py mdlate:md:med:5501:0.75:unsafeLate` plays a real class-code shift: `1AZ-8A7`, attending, Manic Monday. The autopilot plays at 75% accuracy. After 16:00 the script signs ibuprofen for an own chest-pain patient, Keisha P., before her troponin: a player's own order.
  - Then `r9/t5_summary.py mdlate p` and `r9/chk_late.py`.
  - **The summary:** "Three stars. Now read the calls to review below."
  - **Orders to review:** 12 entries ("Not needed: CT head", "Not needed: Chest X-ray"…), then "And 7 more." Keisha P. is entry 16 of 19.
  - **The full `#report`:** "Keisha P." and "Ibuprofen" are not in its `innerText`. The reason ("a heart attack isn't ruled out until the troponin is back") is not in its `textContent` at all.
  - **What's left:**
    - "Unsafe orders … 1" in Your patients;
    - "Unsafe orders, complications and untreated patients −20" in the ledger;
    - "+10: Keisha P.: given ibuprofen, which can hurt them" inside the collapsed **What raised your legal risk**, with no reason.
  - M&M's top three are discharges.
  - Screens: `p-mdlate-55-and-more.png`, and `p-mdunsafe-53-orders.png` for the early case, where it does show.
- **Why it matters:**
  - A contraindicated drug is the most important order error the game teaches.
  - The R6.8-04 fix exists to say what and why. Here it only works in the first hour of a shift: busy shifts log a dozen "Not needed" scans first.
- **Fix:** put entries with `unsafe` first, or always show them before the cap. Make "And N more" a `<details>` that opens the rest.
- **Effort:** S

### R4.9-02 · Medium · The shown key doesn't fit its box at 390 and 360, and a half-cut T reads as 7 (a side effect of the R4.8-01 fix)
- **Where:**
  - `.cb-keyin { font-size: 18px; letter-spacing: .06em }` (`style.css:1019`) inside `.cb-keyrow` (`:1022–1024`).
  - The R4.8-01 grid rule narrowed the box to 253 px at 390 and 230 px at 360. The unmasked 19-character key needs 275 px.
- **Reproduce:** `r9/t1_form.py p` and `r9/t1_form.py s`.
  1. Play a shift › Class code › Open with an instructor key.
  2. Type `7k2m-9qxh-4v1r-8ztq` and tap **Show**.
  3. `#cbKey` measures `scrollWidth` 275 against `clientWidth` 249 (390) and 226 (360).
  4. Focus is on Show, so the box scrolls back to its start.
- **What shows:**
  - **390:** "7K2M-9QXH-4V1R-8Z" and half a T that looks like a 7 (`p-03-shown.png`).
  - **360:** "7K2M-9QXH-4V1R-8", with three characters gone (`s-03-shown.png`).
  - **Before typing, at 360:** the placeholder is clipped to "XXXX-XXXX-XXX", so it no longer shows the key's four groups (`s-01-form-empty.png`).
  - 844×390 and the projector fit (330 and 436 px boxes).
- **Why it matters:** Show exists so an instructor can check a key against their note. A wrong key only says "don't match", so a misread last block costs a round trip with no clue. `class_test.py` checks the box's width, not whether the key fits.
- **Fix:** on narrow screens, `.cb-keyrow .cb-keyin { font-size: clamp(14px, 4.2vw, 18px); letter-spacing: .02em; }`, or put Show on its own line under the box. Add a check that `scrollWidth <= clientWidth` with the key shown at 360.
- **Effort:** XS

### R4.9-03 · Medium · The class sheet still fails keyboard and screen-reader users (the R4.7-09 leftovers, in no STATUS file)
- **Where:**
  - `morph()` (`ui.js:16–30`) hands focus only to a button that survives the redraw.
  - Nothing moves focus into the sheet when it opens.
  - `.sheet` has `role="dialog" aria-modal="true"` with no `aria-label` or `aria-labelledby`.
- **Reproduce:** `r9/t7_focus.py proj` (keyboard only, `t7-proj.out`).
  - **Opening the sheet:** open Play a shift › Class code with Enter. Focus stays on `BUTTON[classCode]` behind the sheet. Six Tabs go to five scenario buttons and a weather button, all outside `#sheet`.
  - **Buttons that drop focus to `BODY`:**
    - **Keep** and **Delete** on a row confirm;
    - **Close results**;
    - **Set up results**;
    - **A code made on another device** (the Class code box isn't focused);
    - a shift button while it makes a code;
    - **Keep ABC-DEF**;
    - **Forget this key on this device**, and **Keep** on its confirm;
    - **Use it without results** (`t2-*.out`).
  - **After Keep, Delete, or Keep ABC-DEF**, the next Tab goes to the first **Results** or to **Five-Minute Rush**, at the top of the sheet.
  - **Fixed this round:** Refresh keeps its focus (R1.8-02).
- **Why it matters:**
  - With `aria-modal="true"`, a screen reader treats everything outside the dialog as inert. But focus is still on the menu button behind it, so the user starts on a control they can't reach.
  - Every confirm then drops them back at the document's start.
  - This is the instructor half of a classroom tool. A projector laptop is driven by keyboard as often as by mouse.
- **Fix:**
  - On open, focus the sheet's heading (`tabindex="-1"`), and name the dialog with `aria-labelledby`.
  - Trap Tab inside `#sheet`.
  - When a focused button disappears, focus its nearest surviving neighbour or the row's main button. Use the box for **A code made on another device**, and the replaced row's ✕ position for deletes.
- **Effort:** S

### R4.9-04 · Low · A delete refused at the class's end leaves the "deleted" results on screen, and the message contradicts itself
- **Where:** `cbDelGo` (`ui.js:2755–2757`). On any error but `busy` it writes "Nothing was deleted. The class has ended: its results have been deleted." It marks the key ended but leaves `L.rows`, the header, every ✕ and **Delete all**.
- **Reproduce:** `r9/t4_results.py p` (code `114-G96`, 8 results).
  1. Open Results.
  2. Tap ✕ on the third row, then Delete. The server answers `key`.
  3. The row error reads "Nothing was deleted. The class has ended: its results have been deleted."
  4. The 8 rows are still listed, under "Results for 114-G96 · … 8 results … · deleted on Dec 8" (`p-41-delete-refused.png`).
  5. The saved tile above now says "class ended · **Turn results back on**".
  6. Every further ✕ and **Delete all** gives the same refusal.
- **Also:** an `invalid` answer, which the contract lists for `cb_class_delete`, or any unexpected body, is also reported as "The class has ended".
- **Fix:**
  - On `key`, replace the header with: "The class has ended, and the server deleted its results. Below is the copy this screen loaded: Copy table or Download CSV keeps it."
  - Hide the ✕s and Delete all.
  - Give `invalid` its own "The server turned this down" message.
- **Effort:** XS

### R4.9-05 · Low · A "class ended: results deleted" tile offers Results, a guaranteed failure; its date can be 16 days early
- **Where:** `cbListHTML` (`ui.js:2194` and `:2197`). The new `when` branch reads `K.e < now && K.t + CB_LIFE < now`. But `main` still picks **Results** whenever the key isn't `x` or `p`.
- **Reproduce:** `r9/t3_saved.py p`.
  1. Seed a key made 40 days ago with `e` 26 days ago.
  2. The tile reads "9CJ-0DS … made Oct 16 · **class ended**: results deleted Oct 30", with a blue **Results** (`s-30-row-D.png`).
  3. Tap **Results**. The server answers `key`, and the tile says "Turn results back on" only now.
- **The date:** `K.e` is whatever the device last heard. A class made Oct 16 whose first result came after the last read was deleted Nov 15, not Oct 30.
- **Fix:**
  - In that branch, render **Turn results back on** as the main button.
  - Say "results deleted by ${cbDate(K.t + CB_LIFE)}", or "deleted" with no date when `K.e - K.t < 20 days`.
- **Effort:** XS

### R4.9-06 · Low · The busy hint says "make the code on your phone", on a phone, and in the off state it can't be done
- **Where:** `cbRegister`'s `why` (`ui.js:2128`): `CB_BUSY + ' Or make the code on your phone using mobile data (another network).'`
- **Reproduce:** `r9/t2_make.py s`.
  - **First problem: it already is a phone.** The busy box at 360 says "make the code on your phone" (`s-10-busy.png`).
  - **Second problem: the off state.**
    1. The server is full, so tap **Use it without results**. Code `3CE-80T` shows.
    2. Tap **Try again**. The server answers busy.
    3. The box says "Or make the code on your phone using mobile data" and, three lines later, "Try again sets results up for this same code" (`s-14-off-busy.png`).
    4. A code made on another device is a different random code. The class already has `3CE-80T`.
  - **Third problem: nothing says the key then lives on the phone.** To read results on the projector, the instructor must use **A code made on another device**.
- **Fix:** "Or turn off Wi-Fi and tap Try again on mobile data (another network)." That keeps the same device, the same code and the same key.
- **Effort:** XS

### R4.9-07 · Low · The new verdicts still mislead
- **Where:** `verdictOf` and the death branch in `reportHTML` (`ui.js:3015–3021`, `:3048`).
- **Reproduce:** `r9/gen.py`, then `r9/t5_summary.py <name> p`, on real class-code shifts.
- **What:**
  - **"The numbers were good" still shows with calls to review.**
    - The death branch excludes the attending only for no patients, own deaths or open arrests, not for calls to review.
    - On `1EW-8AN` (3 stars, a wrong diagnosis, another doctor's patient died), the verdict reads "1 patient died in the department. The numbers were good; read the worst moments below." The M&M has no death.
    - This is the overclaim above.
  - **"One of your own patients died or was left in an arrest."**
    - The game knows which.
    - On `1CH-866` the one patient reads "1 patient died in the department. One of your own patients died or was left in an arrest.", which sounds like two people.
    - With two own deaths, "One of" is false.
    - On `19D-866` (left in an arrest, not dead) the student is told someone may have died.
  - **"Three stars. Now read the calls to review below."**
    - No section is called that except **Radio calls to review**, and wrong radio calls aren't in the condition.
    - Wrong diagnoses, in the condition, are listed *above*, in **Diagnoses to review**.
    - Wrong dispositions appear only as a count.
    - Codes `18M-87M` and `1A6-87X`.
- **Fix:**
  - Build the line from the facts: "Andre M., your patient, died in an arrest nobody ran: see M&M below." or "Mia J. was still in arrest at 19:00: see M&M below."
  - Name the sections: "Read Diagnoses to review, above, and Orders to review, below."
  - Add the calls-to-review case to the death branch's exclusion.
- **Effort:** S

### R4.9-08 · Low · The new empty-M&M line points a charge nurse at a legal-risk section they don't have
- **Where:** `mmHTML` (`ui.js:3112`) shows "No single moment stood out. What raised your legal risk, above, lists every reason." for any `R.fail`, which includes `'walkout'`. But `litHTML` returns `''` for a charge nurse (`:3071`), and a walkout is about staff morale.
- **Reproduce:** `r9/t8_walkout.py`.
  1. Start a Five-Minute Rush code (seed 777).
  2. At minute 10, set every staff member's morale to 5. This is injected, to reach a walkout with an empty M&M.
  3. The summary reads "The staff walked out … Staff satisfaction hit bottom … No single moment stood out. What raised your legal risk, above, lists every reason." (`p-walkout-56-mm.png`).
- **Fix:** test `R.fail === 'fired'`. For a walkout, say "No single moment stood out: staff morale ended the shift."
- **Effort:** XS

### R4.9-09 · Low · "What raised your legal risk", where the fired verdict now sends students, is a 19 px tap target
- **Where:** the `<summary>` in `litHTML` (`ui.js:3074`), with no height rule.
- **Reproduce:** `r9/t11_taps.py mdlate p` → 289×19. `t11_taps.py mdlate s` → 266×19.
- **Why it matters:** the round-8 fired verdict and the new empty-M&M line both point students at this one disclosure.
- **Fix:** `.litbox summary { min-height: 44px; display: flex; align-items: center; }`
- **Effort:** XS

### R4.9-10 · Low · Show key on the saved row of the code on screen shows the key in the panel above; the row's button doesn't change
- **Where:**
  - `cbListHTML`: `show = U.showKey === c && U.codeMade !== c` (`ui.js:2192`).
  - `cbRegHTML` shows the key for the same `U.showKey`.
  - Both sets of Show key and Copy key buttons render for the code on screen.
- **Reproduce:** `r9/t10_showkey.py p` and `proj`.
  1. Make a code.
  2. In Class results, tap that code's row **Show key**.
  3. The key appears in large type in the code panel at the top (y 186, or 88 on the projector).
  4. The row's button still reads "Show key" with `aria-expanded="false"`. The panel's button now reads "Hide key" (`p-80-row-showkey.png`).
- **Why it matters:** a keyboard user, whose focus now correctly stays on the row button, gets no change in that button.
- **Fix:** hide the row's Show key and Copy key for the code on screen, or show the key in the row.
- **Effort:** XS

### R4.9-11 · Low · A network or server failure marks the student's name as invalid
- **Where:** `cbSendHTML` (`ui.js:2261`) adds `aria-invalid="true" aria-describedby="cbNameErr"` for any `st`.
- **Reproduce:** `r9/t6_send.py mdown p`, step 10.
  1. The server answers busy.
  2. The name box gets `aria-invalid="true"`, and a screen reader hears that the name is invalid.
  3. Typing in the box then clears the busy message too (the R4.7-11d handler).
- **The same applies to:** full, unknown, timeout and network errors.
- **Fix:** add `aria-invalid` only for name refusals (`cbNameWhy`, or `invalid` with `field: name`). Give other failures their own `role="alert"` line that typing doesn't clear.
- **Effort:** XS

### R4.9-12 · Nitpick (10 items)
1. **Delete all in flight** still shows no "Deleting…". The confirm vanishes and the **Delete all** link comes back (`t4-p.out`, `delall_held`; the R4.7-04 leftover, not in STATUS).
2. **The new caution shows twice**: "Results show every student's name and score: not on a projected screen." appears twice when saved codes and the other-device form are both open (`t1-*-saved.out`, `caution: 2`). It is also a fragment.
3. **"With only its key's hash"** (the code panel, README) is jargon. The owner's rule is to explain every term.
4. **The ask scrolls the code off the screen**: at 360×640 the code goes to y 38, with the sheet's top at 120; at 844×390 it goes to y −177. The ask says "3CE-80T goes off the screen" while it already has (`s-15-ask.png`). On the projector the code still moves 121 px (`proj-15-ask.png`).
5. **"Can hurt them"** uses the same red as "Missed" and "Not needed: Chest X-ray", so the one harmful line has no extra weight (`p-mdunsafe-53-orders.png`).
6. **Nested parentheses:** seven case and drug pairs use the fallback reason, so the review would read "Can hurt them: Insulin, regular (it isn't safe for this patient (the case's lesson says why))". The pairs are `hyperk:succ`, `hyperk:kcl`, `tcaod:procain`, `tcaod:amio`, `tcaod:ondan`, `hypogly:insreg` and `hypogly:insdrip` (checked with `contraWhy` in Node, not on screen).
7. **The unrun-arrest number has three names:**
   - the summary: "Your own patients still in cardiac arrest at the end, with no code running";
   - the row: "left in cardiac arrest with no code running at the end";
   - the export: "Own patients left in an unrun arrest".
8. **Straight quotes:** the fired verdict quotes "What raised your legal risk" with straight quotes; the rest of the game uses curly ones.
9. **"Try again in an hour"** sits right above a big **Try again** button in the busy box.
10. **The busy box now runs about 50 words** with nothing in bold. The owner's rule is few words, with key words in bold.

## 4. Coverage

**Read:**
- `docs/audit/BRIEF.md` (Rounds 9 and 8), my round-8 report and `round8/STATUS.md`.
- `git diff 87c9c13..ba471b7 -- src` (`ui.js`, `style.css`, `engine.js`), the README and CLAUDE.md changes, and the new `class_test.py` checks.
- The second migration's `cb_class_new`, `cb_class_read`, `cb_class_delete` and limits, for the messages the game shows. The contract's answer lists.

**Ran, as the instructor (p, s, pl and proj):**
- **The other-device form:** code and key typed key by key, Show and Hide, Enter on a wrong key, Enter on the right key, with and without saved codes. Overflow and positions measured in every state.
- **Making a code:**
  - busy (with the mobile-data hint), held, full, **Use it without results**;
  - the off text;
  - **Try again** answered busy in the off state;
  - the replace question under the code, **Keep**, **New code**;
  - network abort, 503, invalid, ok.
- **Saved codes (nine states):** active; not set up; ended (`x`); past 30 days ("results deleted"); may have ended; older version confirmed and unconfirmed; a taken row; a 50-day-old key. Results on a deleted class.
- **Results:** open, a row delete refused at the class's end, a second one, **Delete all** held then refused, Refresh refused. Attending rows, an old row and Copy table read back.
- **Keyboard:** opening the sheet, Tab order, Enter on every button, Escape, Refresh.
- **Tap targets:** in the sheet and the summary.

**Ran, as the student (real class-code shifts played to the end):**
- **The shifts:** an attending who saw no patients; a fired attending; 3-star attendings with calls to review; an own death; an own unrun arrest at 19:00; unsafe drugs early and late; a charge nurse with two deaths; a forced walkout.
- **The summary:** verdicts, M&M, Orders to review, Your patients, the ledger label, and where the Send box sits at four sizes.
- **The Send box:** an empty Send twice, a local refusal cleared and sent again, a server refusal twice, busy, and sent.

**Regressions:** in `r9/repo/`, `class_test.py` (95 ok), `ui_test.py` and `md_ui_test.py`. All three end "No errors."

**Not covered:**
- **Devices:** no real iOS or Android, so no soft keyboard. No WebKit or Firefox.
- **Screen readers:** no VoiceOver or NVDA.
- **Share:** `navigator.share` doesn't exist in headless desktop Chrome.
- **The live server:** not contacted, by rule.

## 5. What I'd keep
- **The form's one grid rule,** with the 390 and 360 checks in `class_test.py`.
- **"Use it without results" only when nobody can register** (unreachable or full), and **Try again** alone for busy.
- **The code panel and its row agree** once a row sets results up.
- **The Send box redraws on every refusal,** identical or not.
- **The unrun arrest at 19:00:** first in M&M, its own row in Your patients, and sent to the instructor.
- **"Can hurt them: Labetalol (the pressure is already too low)"** in Orders to review. Now make sure it's always shown.
- **Older-version tiles** that keep their description and say which version.
