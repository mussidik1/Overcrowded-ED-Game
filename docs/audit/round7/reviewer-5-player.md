# Reviewer 5, round 7: Hardcore gamer, game critic and classroom user

**Build reviewed:** branch `claude/sleepy-rubin-jot35n` at HEAD `18a71f9` (v0.31.0).
- I rebuilt the source in a scratch copy with `node build.js`. `index.html` and `sw.js` came out byte-identical to the committed ones.
- I served the scratch copy at http://127.0.0.1:8776 and drove it with Playwright for Python in headless Chrome (`/usr/bin/google-chrome`).

**The server was the real migrations, not a stub.**
- I built a throwaway Postgres 16 cluster and loaded, in order: `stubs.sql`, the baseline, `20261124120000_codeblack_private_results.sql`, then `20261125120000_codeblack_round6.sql`. `codeblack.migrations` lists both.
- Every `/rest/v1/rpc/*` call from the page went into the real functions, run `as anon`. Each call carried `request.headers` with a fake `x-forwarded-for` per network: the campus NAT `198.51.100.20`, the instructor's phone `192.0.2.50`, and another phone.
- Every other request that didn't go to 127.0.0.1 was aborted. Nothing contacted supabase.co or edcodeblack.com, and the logs show no blocked request to either.

**Time travel:**
- The page's `Date` moved forward N days, and the class rows moved back N days in the database.
- New since round 6: the server now returns `created`, and the game stores it. So my fake REST front also shifts every `created`, `expires` and `created_at` in an answer forward by N days, which keeps both clocks in agreement as they would be in real life. My first day-15 run without this shift lost a key on day 15. That was my harness's doubled clock, not the game, and it is not reported.

**A release mid-course:** a second scratch build at v0.31.1 (`PAST_V = ['0.31.0']`) on port 8777, with the device's storage carried over.

**Scratch:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round7/r5/`
- `py/db.py`: the fake REST front.
- `py/common.py`: the browser, clock and student helpers.
- `py/s1.py` to `py/s12b.py`: the scenarios.
- `mdd3.js`: the engine check in Node.
- `shots/`: screenshots, cited by name.

Items that round-6 STATUS lists as partly fixed with a reason, moved, or the owner's decision are not re-reported. That covers the CSV caveat row, a Cyrillic lookalike counting as another name, the radio-call stream, the sheet's × overlap and the attending's scoring.

## 0. Round-6 status (my R5.6 findings)

| ID | Status | Evidence |
|---|---|---|
| R5.6-01 High: typed key left in the box for the next user | **Fixed** | Opening Class code clears the form (`ACT.classCode`, ui.js:2612). The next user found no form and `U.cbForm` null in each case: after a failed read and a closed sheet; after a typed, never-submitted key followed by a whole Five-Minute Rush; and after a typed read (`s4.py` (c), (d), (e)). |
| R5.6-02 Medium: key typed in clear on the projector | **Fixed, with a regression** | `#cbKey` computes `-webkit-text-security: disc`, and Show toggles it off. The same change squeezed the box to 0 px of text width at every screen size: see **R5.7-01**. |
| R5.6-03 Medium: Set up results replaces the projected code; stray taps | **Fixed** | The level buttons are disabled while saving: three taps refused, one class made (`s1.py` (c)). A level tapped while a code is shown asks first, and Escape answers "Keep". Four stray taps during the ask registered nothing. Set up results works in its own row, and nothing else is projected (`s11.py` (a)). |
| R5.6-04 Medium: a dead planned code looks live | **Partly fixed** | Each row now says "results until …", and after a failed Results the row says "class ended" with **Turn results back on**, which works: a student's resend went through (`s3.py`, `21-pc-day15-ended.png`). Before that tap, though, the row on Dec 9 still reads "results until Dec 8 (Dec 24 once a student sends)", with nothing marked, and a student played the whole shift and was refused. See R5.7-05. |
| R5.6-05 Low: ✕ on its own line | **Fixed** | The ✕ sits beside the name, centred (`41-phone-delete-ask.png`). Rows are 103–154 px on a phone, because of the wrapped detail text. |
| R5.6-06 Low: "(3rd result)" counted names, not students | **Fixed** | Rows say "Ben (1 of 2 under this name)" and "(2 of 2…)". The export has "Same name (n of total)", and the note says a repeated name may be another student. Full-width names are now refused on both sides. |
| R5.6-07 Low: Copy key's line couldn't be pasted | **Fixed** | Pasted into either box, it fills both. It still works when an email app wraps the line before the key, and Show results reads the class (`s4.py` (g)). |
| R5.6-08 Low: names in several scripts refused | **Fixed** | マリア・ガルシア, 阿卜杜拉·买买提, علی‌رضا (ZWNJ), ශ්‍රියානි (ZWJ) and ג׳ון were typed key by key on a shared iPad and sent (`s2.py`). I ran 85 names through `cbClean` in Chrome and through the server's `clean_name`: 85 of 85 agree (`s6.py`). Two scripts are still refused; see R5.7-08. |
| R5.6-09 Low: Set up results on a pre-release code | **Fixed** | On v0.31.1, a v0.31.0 code that was used without results reads "Made on an older version of the game: make a new code." and has no Set up button (`s7.py`, `50-wed-list.png`). |
| R5.6-10 Nitpick bundle | **Partly fixed** | **Fixed:** "made" is now the server's date; the global backstop no longer blames the class (`scope`); Delete all's confirm is in view at y 735–851 of 851. **Still open:** the Send box's heading only peeks in at y 782 of 847 on a phone, and its name box is below the first screen (`70-student-phone-top.png`). |

**Counts:** Fixed 8, Partly fixed 2, Still open 0, Worse 0. R5.6-02's fix brought a new High, counted under R5.7-01.

## 1. Verdict

**Usable in a 50-minute class. Usable a month later on the same device. Reading results on any other device is now done blind.**

What works, in a real class flow, against the real SQL:
- **The code:**
  - It shows 0.15 s after the tap, and only once the server has it.
  - Stray taps do nothing, and a tap on a level asks before it replaces a projected code.
  - "Use it without results" covers an unreachable server, and Try again later registers the same code. A lost answer past 8 s comes back as the same code.
- **The students:**
  - Thirty students type the code in lower case and press Enter.
  - A shared iPad passes from student to student with an empty name box each time.
  - A cut-off send and a lost answer are each retried and kept once.
  - Leaving unsent warns inside the Send box.
- **The instructor, same device:**
  - Results open on days 8, 15 and 25.
  - An ended class says so and comes back with Turn results back on.
- **Results:**
  - Deleting a troll at row 27 of 30, a failed delete and Delete all each show their confirm or error in view.
  - The CSV has 26 columns, a BOM and CRLF, and blanks the attending's columns on charge-nurse rows.
- **A release mid-course works:**
  - Old results open, and an unsent Monday summary sends on Wednesday.
  - Each side's code is refused on the other version, with the right message.
- **Regular play is unchanged:**
  - `npm test`: 694 ok, golden unchanged.
  - `npm run stress`: exit 0, vitals in range.
  - `class_test.py`: 86 ok.
  - A Quiet Tuesday and an attending Rush made no class-results calls and showed no Send box.

What is broken or fragile:
- **The key box (R5.7-01):** it has 0 px of text width on every screen, so the instructor types 16 characters blind, and Show reveals nothing.
- **The attending's own deaths (R5.7-02):** the new counter misses any death the shift ends on.
- **Busy or full (R5.7-03):** no playable code at all.
- **Forget (R5.7-04):** it leaves the key on the shared computer's clipboard.

## 2. Score

**6/10.** Most round-6 findings are really fixed, and the class loop works on the day and a month later. But the fix for the projected key broke the key box itself on every device. A new attending counter under-reports the very number it was added to show. And the server's limits can now stop a class from getting a code at all.

## 3. New findings, worst first

### R5.7-01 High: the instructor key box has 0 px of text width on every screen; the key is typed blind, and Show shows nothing
- **Where:**
  - The markup: ui.js:2184 (`<div class="cc-row cb-keyrow"><input id="cbKey" class="cb-code cb-keyin…"><button class="big" data-act="cbKeyVis">`).
  - The CSS: `.big { width: 100% }` (style.css:275) with `.cb-keyrow { flex-wrap: nowrap }` and `.cb-keyrow .big { flex: 0 0 auto }` (style.css:1020–1022). The button's flex basis is 100% of the row and it may not shrink. The input (`flex: 1 1 140px; min-width: 0`) collapses to its padding.
- **What happened (`s12.py`, `s12b.py`):**

  | Size | Key box width | `clientWidth` (text 0 px) | Show button | Overflow |
  |---|---|---|---|---|
  | Phone 390×844 | 28 px | 24 | 372 px | ends at x 438 on a 390 px screen |
  | Sideways phone | 28 px | 24 | 414 px | 36 px past the box |
  | Tablet | 28 px | 24 | 520 px | 36 px past the box |
  | Projector 1024×768 | 28 px | 24 | 520 px | 36 px past the box |
  | PC 1440×900 | 28 px | 24 | 520 px | 36 px past the box |

  - The typed key's `scrollWidth` is 249 px inside a 0-px window. With Show ("Hide" on the button), nothing more is visible (`34-pc-keybox-shown.png`).
  - On the phone, the class code box above it also runs past the card's border (`33-phone-keybox.png`, `30-proj-key-typed.png`).
- **Why it matters:**
  - This is the only way to read results on a device that didn't make the code: the classroom PC, a colleague's laptop, the instructor's other phone.
  - Sixteen characters go in with no feedback, not even masking dots. One wrong letter gives "That code and key don't match, or the class has ended", and nothing on screen shows which letter.
  - Paste still works, and so does typing blind; I read the class both ways (`s4.py` (e), (g)).
  - `class_test.py` types the key and checks values, never the box's size, so CI is green.
- **Fix:**
  - Add `.cb-keyrow .big { width: auto; }` and `.cb-keyrow .cb-code { flex: 1 1 0; }`.
  - Add a UI check that `#cbKey`'s `clientWidth` is above 200 at 390 px wide.
- **Effort:** XS.

### R5.7-02 Medium: "Your own patients who died" misses any death in roughly the last 15–35 game minutes, which is up to 29% of a Five-Minute Rush
- **Where:**
  - engine.js:3377 counts `S.md.died` only in `leave(p, 'expired')`.
  - A roomed death first sits as `dsp = 'family'` for 15 minutes, then `morgue`, and leaves more than 20 minutes later or when transport takes it. See engine.js:2268 (a failed code), engine.js:2313 (no code team) and engine.js:3280–3281.
  - The department's count already includes the dead still in their rooms (engine.js:4404, the audit R5-02 fix). The attending's new count doesn't.
- **What happened:**
  - **Node (`mdd3.js`, seed 4242, attending Rush):** an own patient arrests and no code is run.
    - At 07:50 or 08:10, `md.died` was 1.
    - At 08:28, the patient died at about 08:48 and was still in the room ("family") at 09:00: `md.died` 0, department `expired` 1.
  - **In the browser (`s9.py`, a real class code, the real `cb_submit`):**
    - The summary's M&M opens with "08:48 Brenda W. died in cardiac arrest with no code team | 20 minutes of CPR and no doctor ran the code". The same summary says "Your own patients who died 0".
    - The instructor's row reads "saw 2 patients · … · department: … 1 died", with no "(1 of them died)". The CSV's "Own patients died (attending)" is 0 next to "Died (dept.)" 1.
- **Why it matters:**
  - This number was added in round 6 because the attending's own work was invisible to the instructor (R6.6-04). It now under-reports exactly the deaths a struggling student causes late in a shift. A Rush is 120 minutes, so any own death after about 08:25 is lost.
- **Fix:** count the attending's own death when it happens: in `arrestNoTeam`'s roomed branch, the failed-code branch and engine.js:2313. Or add the attending's own patients still in `family`/`morgue`/`morguing` when the shift ends, as engine.js:4404 does for the department.
- **Effort:** XS. Add a rule test with a death at minute 100 of a Rush.

### R5.7-03 Medium: when the server is busy or full, the class gets no playable code at all; "Use it without results" is offered only when the server can't be reached
- **Where:**
  - classHTML, ui.js:2020–2021 (`${R.net ? 'Use it without results' : ''}`).
  - `cbRegister`, ui.js:2117–2119: busy and full become `st: 'fail'`, never shown.
- **What happened (`s1.py` (d)–(f), the real `cb_class_new`):**
  - **Busy:** 60 registrations from the campus NAT in one hour (another instructor's script, or a troll with the public key). The projected PC showed "No class code yet. Your network has made too many requests … Wait a while (up to an hour)", with **Try again** only (`04-proj-busy.png`).
  - **Full:** with the classes backstop tripped, the same card read "Class results are full across the whole game right now … It may take days to clear", again with Try again only (`05-proj-full.png`).
  - **Unreachable:** the same request offers "Use it without results", and the code plays.
- **Why it matters:**
  - Before round 6, a busy or full server meant "results off"; now it means no shared shift for anyone.
  - The class code is a fully offline feature, since the seed is in the code. A limit meant for results now stops 30 students from starting.
  - "Full" is global and lasts until unused codes age out (up to 14 days). With 200 codes a day per network and IPv6 counted by /56, a determined troll can trip it.
  - Even in the busy case, the only way to get a code in the room is to take the projected PC off the network.
- **Fix:**
  - Offer "Use it without results" for `busy` and `full` too, as for `net`. The code then shows as "results may be off", and Set up results in the list registers it later.
  - Suggest "or make it on a phone using mobile data" when busy.
- **Effort:** XS.

### R5.7-04 Medium: Forget says "This device has forgotten the key", but Copy key left it on the shared computer's clipboard, and the new paste fills both boxes from it
- **Where:**
  - `keyCopy`, ui.js:2645. The card itself says "copy it somewhere safe too".
  - `keyForgetGo`, ui.js:2648–2654.
  - The paste handler, ui.js:3137–3141.
  - `cbCopyTab`, ui.js:2725.
- **What happened (`s4b.py`, classroom PC):**
  1. The instructor makes a code and taps Copy key to email it to themself.
  2. They tap Forget, then Forget again; the sheet closes.
  3. The clipboard still holds "Code Black instructor key for class code HEW-049: KSVR-MBWG-71KW-JTXW".
  4. The next user opens Class code, then "A code made on another device", pastes once into the key box, and taps Show results: "Results for HEW-049 …". With the key, they can delete every result.
  - **Copy table, the same way:** after a typed read with Remember off, the class table (every name and score, caveat first) stays on the clipboard after the sheet closes (`s4.py` (e)).
- **Why it matters:** on a classroom PC, the clipboard is the next person's. The Forget toast promises what isn't true, and R5.6-07's paste fix turned a leftover key into a one-paste login.
- **Fix:**
  - Forget is a user gesture, so call `navigator.clipboard.writeText('')` when this page copied that key.
  - Do the same on Close results after Copy table.
  - Add "If you copied the key on this computer, it may still be on the clipboard" to the Forget confirm.
- **Effort:** S.

### R5.7-05 Low: the saved-codes list never compares "results until" with today; a dead planned code, or an unused code from before a release, looks live
- **Where:** `cbListHTML`, ui.js:2174. `when` reads `K.x`, `K.p` and `K.e`, but never `Date.now()`.
- **What happened:**
  - **A planned code (`s3.py`):**
    - On Dec 9, the code made Nov 24 for a lesson two weeks out reads "results until Dec 8 (Dec 24 once a student sends)", with a blue **Results**, though the server deleted it on Dec 8.
    - A student played the full Manic Monday and got "7YS-08V isn't set up for class results, or its class has ended".
    - Only after the instructor tapped Results did the row say "class ended". Turn results back on then worked, and the student's resend went through.
  - **A planned code across a release (`s7.py`):**
    - On v0.31.1, QK8-8DR (unused, made on v0.31.0) is listed as "made on an older version · … · results until Dec 8 (Dec 24 once a student sends)", with **Results**.
    - Every student phone on v0.31.1 calls it "mistyped, or made on another version". Nothing tells the instructor that this code can't be played any more.
- **Fix:**
  - If `K.e && K.e < Date.now()`, mark the row "class ended" and offer Turn results back on straight away.
  - For a stale code with no results, say "Students on v0.31.1 can't play it: make a new code."
- **Effort:** XS.

### R5.7-06 Low: the shared-computer note appears only when the device has saved codes, so never in the typed-key case it exists for
- **Where:** ui.js:2182. The note "On a shared computer, forget your keys when you're done, and delete any results file you downloaded" sits inside `if (mine.length)`.
- **What happened (`s4.py` (e)):**
  - On the classroom PC, a typed key with Remember off reads the class. The instructor uses Copy table and Download CSV (`code-black-XS9-R9Z.csv` lands in Downloads).
  - The note is not on screen anywhere (`'delete any results file' in lst(p)` is False).
- **Fix:** put the note under the export buttons whenever a list is open.
- **Effort:** XS.

### R5.7-07 Low: an instructor key pasted on its own into the class code box shows in clear on the projector
- **Where:** `#cbCode`, ui.js:2183. It isn't masked and has no `maxlength`. The paste handler only splits a line that holds both a code and a key.
- **What happened (`s11.py` (b)):**
  - Pasting `G0E8-76W3-60BJ-BWT1`, the key alone as it sits in an instructor's notes, into the first box of the projected PC's form leaves it there, 24 px tall and unmasked (`32-proj-key-in-code-box.png`).
  - Show results then says "A class code is six letters and numbers", and the key stays on the wall.
- **Fix:** if the code box receives a well-formed 16-character key, move it to the masked key box. Keep a `maxlength` of about 60 so a whole line still pastes.
- **Effort:** XS.

### R5.7-08 Low: two scripts' names are still refused, with a message that doesn't say why
- **Where:** `cbClean`, ui.js:2062–2068, and `codeblack.clean_name`. Both agree on all 85 names (`s6.py`).
- **Refused:**
  - **Tibetan** names, whose syllables are always separated by the tsheg (U+0F0B, punctuation): བསྟན་འཛིན (Tenzin).
  - **Malayalam** names typed on keyboards that write a chillu as virama + ZWJ at the end of a word: ജയന്‍, അര്‍ജുന്‍. The atomic form ജയൻ passes.
- **The message:** "Use your first name or initials: letters only, like Sam, Ana M. or S.K." The ZWJ is invisible, and the tsheg looks like part of the letters.
- **Fix:**
  - Allow U+0F0B between Tibetan letters, and a ZWJ after a virama at the end of a word, on both sides and in `client_call.json`.
  - For any invisible character, say "Your keyboard added a hidden character: type the name again, or use initials."
- **Effort:** S.

### R5.7-09 Nitpick: small things
- **"saw 1 patients":** the instructor's row says this for an attending who saw one patient (cbDet, ui.js:2161; `s9.py`).
- **The ask moves the projected code:** the ask is inserted above it (ui.js:2026). On the projector, the code jumps from y 189–233 down to 311–355 when a stray level tap asks (`s1.py` (b), `02-proj-ask.png`). In the ask, **New code** is the blue primary button and **Keep** the plain one.
- **Old codes lose their description:** an old-version code in the list still says "made on an older version" instead of "Charge nurse · Five-Minute Rush", though `readCode` returns `mode` and `level` for stale codes (engine.js:51–52). It also doesn't name the version (`c.stale` holds it).
- **"Unneeded" is counted at completion:** an unneeded risky treatment counts when it is finished (`harmCheck` via `treatDone`, engine.js:1957), not when it is ordered. One ordered late in the shift that finishes after 19:00 isn't counted. The comment says "the unsafe order, whatever the dice do next".
- **The Send box:** 80 words of small print sit before the name box. The box starts at y 782 of an 847 px phone screen, and Send is below the first screen (`70-student-phone-top.png`).
- **Show stays on:** after a failed read, a key revealed with Show stays revealed for anyone who walks up while the sheet is open (`s4.py` (b)).

**Counts:** Critical 0, High 1, Medium 3, Low 4, Nitpick 1 (9 total).

## 4. Coverage

**Instructor (real taps, real SQL):**
- **Making codes:**
  - On a 1024×768 projector: fast; stray taps during the ask; a slow answer held 2.5 s with three taps on disabled buttons.
  - Busy (60 a hour from the NAT), full (backstop tripped), unreachable with "Use it without results", then Try again online.
  - An answer lost past 8 s, then Try again: the same code. A reload, then the saved list.
- **Finding the key later:**
  - The classroom PC on days 0, 8, 15, 25 and 31 with both clocks moved.
  - A planned code past its 14 days, with a student refused on day 15. Results, then "class ended", then Turn results back on, then the student's resend.
- **The shared PC:**
  - The masked key, and Show.
  - A failed read; a closed sheet; a typed key never submitted with a whole Rush in between; a typed read with Remember off.
  - Copy table, Download CSV, Copy key, then Forget and the next user.
  - Forget while Results is loading: nothing shown or saved.
- **Paste:** Copy key's line, whole and wrapped, into each box on a phone. The key alone into the code box.
- **Results:**
  - 30 results: 6 from real student shifts, the rest through the real `cb_submit`, including an attending row and an ended-early row.
  - Deleted a troll at row 27 on a phone; a delete that failed; Delete all's confirm.
  - Copy table (read back) and Download CSV (bytes parsed: BOM, CRLF, 32 rows, 26 columns).
- **A release mid-course:**
  - v0.31.1 with the same storage: the list; Results on an old code; an old "no results" code.
  - An unsent Monday summary sent on Wednesday.
  - An old code typed on the new version, and a new code typed on a cached v0.31.0.

**Students (real taps, campus NAT):**
- **Typing and sending:**
  - The code typed in lower case with Enter.
  - Six students in turn on one iPad, the name typed key by key with focus kept, and Enter to send.
- **Bad Wi-Fi:** a send cut off, then retried. An answer lost past 8 s, then retried: one row on the server.
- **Repeats:** a reload, then a repeat send under the same name.
- **Trolls:** seven troll names. Four were refused (full-width, zero-width space, circled, enclosing mark). Three were sent (the Cyrillic "Bеn", "Mr. Poopy Pants", "Dr Hfuhruhurr").
- **Leaving:** left unsent (warning in view, second tap leaves).
- **An attending on a class code:**
  - A contraindicated drug (metoprolol): "unsafe orders 1 (1 caused harm)".
  - An own patient's late death: R5.7-02.
  - Radio calls: "0 of 6 right, 6 missed".

**Names:** 85 through both rules, all agreeing: 66 accepted, 19 refused. Refused: Tibetan, Malayalam with ZWJ chillus, 4-word names (by design), full-width, invisible, circled and enclosing-mark trolls, numbers, emoji.

**Regular play:**
- `npm test` (694 ok, golden unchanged) and `npm run stress` (exit 0, vitals in range), in the scratch copy.
- `test/class_test.py`: 86 ok.
- A Quiet Tuesday as charge nurse on a sideways phone and an attending Rush: no class-results calls, no Send box, Menu leaves in one tap.

**Not covered:**
- Real Safari, WebKit and Firefox. `-webkit-text-security` was checked only in Chrome.
- A real campus NAT and IPv6.
- The live project (off limits), the 3D floor and the password gate.
- A full 30-minute shift played entirely by hand.
- An unsafe order through the order sheet's taps (I used `OC.signOrders`).

## 5. What I'd keep

- **A code shows only when it's real:** stray taps are dead, and an ask guards the projected code. Escape means "Keep".
- **Turn results back on:** it brings a planned code back, and a student's earlier summary still sends to it.
- **Nothing typed survives reopening the sheet:** not after a failed read, not after a whole shift.
- **Paste of Copy key's line:** it fills both boxes, even when an email app wraps the line.
- **The name rule:** it now takes nakaguro, middle dots, geresh, ZWNJ and ZWJ names, and the game and server agree on every name tried.
- **The results list:**
  - The ✕ sits beside the name again.
  - "1 of 2 under this name" is honest.
  - The delete confirm sits at the finger.
  - A failed delete says "Nothing was deleted" in view.
- **The attending's row:** it now shows their own patients, unsafe orders and radio calls out of those offered. The contraindicated-drug counter works.
- **A release mid-course:** old results stay readable, and an unsent summary still sends after the update.
- **Regular play is untouched:** no calls, no Send box, golden unchanged.
