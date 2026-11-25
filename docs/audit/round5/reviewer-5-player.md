# Reviewer 5, round 5: Hardcore gamer, game critic and classroom user

Build reviewed: branch `claude/sleepy-rubin-jot35n` at HEAD `7cb5613` (code as of `46a0b03`, v0.31.0). I rebuilt the source in a scratch copy, and the result is byte-identical to the committed `index.html`. I served the repo at http://127.0.0.1:8766 and drove it with Playwright for Python in headless Chrome.

**The server was the real migration, not a stub.**
- I built a throwaway Postgres 16 cluster with `mktemp -d`, as `supabase/tests/run.sh` does.
- I loaded `supabase/tests/stubs.sql`, then `supabase/migrations/20261124120000_codeblack_private_results.sql`.
- Every `/rest/v1/rpc/*` call from the page went into the real `cb_class_new`, `cb_submit`, `cb_class_read` and `cb_class_delete`, run `as anon`. Each call carried `request.headers` with a fake `x-forwarded-for` for its network: the campus NAT, the instructor's cellular phone, a classroom PC.
- Any other request that didn't go to 127.0.0.1 was aborted. Nothing contacted supabase.co or edcodeblack.com; the log shows no blocked request to either.
- **Time travel:** I moved `created_at` and `expires_at` back in the database, and shifted `Date` in the page by the same number of days.

**Scratch:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round5/r5/`
- `py/db.py`: the fake REST front.
- `py/common.py`: the browser, clock and student helpers.
- `py/s1.py` to `py/s12.py`: the scenarios.
- `shots/`: screenshots, cited by name.

Items that round-4 STATUS lists as moved or as the owner's decision are not re-reported.

## 0. Round-4 status (my R5.4 findings)

| ID | Status | Evidence |
|---|---|---|
| R5.4-01 High: key beside the code, shared PCs keep keys | **Partly fixed** | Projection is fixed: the key is behind **Show key** (`02-pc-code-made.png`). The shared-PC half is not. Making a code saves the key with no question asked. If the instructor forgets **Forget**, the next user reads every name in one tap (`s5.py`). If he does tap Forget, the page still shows the key (R5.5-03). There is still no full-screen "Show to class" view. |
| R5.4-02 High: slow registration swaps the code | **Partly fixed** | The code never changes once shown. In `s6.py` the answer was held past 8 s: D4X-890 shows with **Try again**, and Try again turns results on for the same code. After a reload, a code whose registration failed is listed as a live class and can't be retried (R5.5-04). |
| R5.4-03 High: other-device read refuses codes after two releases | **Fixed** | With `setCodeVersion('0.32.1', ['0.32.0'])`, the code opened from its own list and by typing it with the key on another device (`s9.py`). |
| R5.4-04 High: the key is effectively one-time | **Worse** | Every code is listed, with Results, Show key, Copy key and Forget. Then each listed key deletes itself 7 days after the code was made, even when the class sent results that the server keeps for 30 days (R5.5-01). Round 4 kept keys for 30 days. There are still no labels, and Copy key still copies the key without the code. |
| R5.4-05 High: no way to keep the results | **Fixed** | **Copy table** pastes tab-separated rows. **Download CSV** is UTF-8 with a BOM and a Sent (UTC) column (`s4.py`). |
| R5.4-06 Medium: rate limits on a campus | Partly fixed (STATUS says so). Not re-reported. | On the real SQL, 62 registrations from one network gave 60 ok and 2 `busy`, and the counter stopped at 61. |
| R5.4-07 Medium: self-reported scores | Moved (R3.2-07, Phase 5). Not re-reported. | Unchanged. An edited saved report sent 100/100, 3 stars, in 0 minutes, and it ranks first (`s4.py`). |
| R5.4-08 Medium: duplicates and trolls | Partly fixed (STATUS says so). Not re-reported. | **Run it back**, then Send, still gives a second "Ben" row. The list has no time sent and no attempt number; only the export has the time (`s2.py`). |
| R5.4-09 Medium: lab PC prefills the last student's name | **Partly fixed** | The name is no longer in localStorage, but `U.cbName` stays in memory. On a shared iPad that isn't reloaded, the second student's Send box holds **Priya**, and one tap sends the shift as Priya (`s4.py`, `30-lab-ipad-prefilled.png`). Fix: clear `U.cbName` after a send and when a new shift starts. |
| R5.4-10 Medium: an unsent class result is lost after another shift | **Partly fixed** | The first tap on Menu or Run it back gives a toast; the second tap leaves, and a double tap leaves too. Then any shift overwrites `oc-last-report`, and the class result is gone. `s2.py` student D: the last report's code is `null`. There is no `beforeunload` guard and no unsent queue. |
| R5.4-11 Medium: wrong numbers in the table | **Fixed** | Died, fired, sped-up %, the attending's diagnoses, and "Score (0-100)". |
| R5.4-12 Low: "ask for a new code" after 30 minutes | **Fixed** | `unknown` now says "…isn't set up for class results, or its class has ended. Show your instructor this summary instead." |
| R5.4-13 Low: privacy text undersells | **Fixed** | About lists every field sent. The README no longer claims students see no Class results box. |
| R5.4-14 Low: two-word names with an initial refused | **Fixed** | On the real SQL, "Mary Ann K.", "De la Cruz", "Nguyen Van A", "Ana M. R." and "Đặng Thu" all pass. |
| R5.4-15 Low: Copy closes the sheet | **Fixed** | The sheet stays open after Copy (`s1.py`). |
| R5.4-16 Nitpick: small things | **Partly fixed** | Fixed: Delete all is a link now, and "self-reported" moved to the instructor's list. Still open: the sheet's × covers **Play it**, a row's **Copy key**, and row text (`12-phone-results.png`, `60-phone-results-tap.png`, `70-phone-delete-row25.png`). The Send box is still the last thing on the report, under "All the numbers". |

**Counts:** Fixed 7, Partly fixed 7, Worse 1, Moved 1, Still open 0.

## 1. Verdict

**Usable on the day. Broken a week later.** In a 50-minute class on a working network, the loop now works:
- The instructor taps a shift and the code shows in under a second, with the key hidden, so the projector is safe.
- Thirty students type the code, play, and send in one tap.
- A retry after a Wi-Fi drop is kept once.
- The instructor reads the list, deletes a troll, and downloads a CSV.
- Regular play is untouched: `src/engine.js` isn't in the diff, and a Quiet Tuesday and an attending Rush made no network calls and showed no Send box.

But the fixes introduced new breaks in exactly the places a teacher lives:
- **Keys delete themselves at day 7.** The device that made the code deletes its key 7 days after making it, even when the class sent results the server keeps for 30. An instructor who grades on day 8, or comes back on day 25, finds no code, no key and no results.
- **Delete looks dead in a real class.** In a class of 30, tapping ✕ on a lower row puts the Delete/Keep bar about 1,100 px above the screen, so nothing visibly happens.
- **Forget doesn't forget.** On a shared PC, the instructor follows the screen's own advice and taps Forget. The next user then taps **Show key** and gets the full key.
- **A code made more than a week ahead loses its results silently.** Nothing at creation says so. The code just vanishes from the list.

## 2. Score

**5/10.** The work is better than round 4 and works on the day. But the key lifetime alone fails the brief's "come back after 25 days" test outright, and the test suite can't see it, because its stub answers with a 30-day expiry that the real function never returns.

## 3. New findings, worst first

### R5.5-01 Critical: the device deletes the instructor key 7 days after making the code, even when the class has results the server keeps for 30 days
- **Where:**
  - `cbRegister`, ui.js:2068 and 2071: it stores `exp` = the registration answer, 7 days.
  - `cbKeys`, ui.js:2057: it drops any key past `exp`.
  - `cbKeySave`, ui.js:2060: it rewrites storage without the dropped keys.
  - `cbShow`, ui.js:2573: it updates `exp` only for a typed key with Remember, never for a listed code.
  - Migration lines 53 and 283-284: the server extends the class to 30 days on the first result.
- **What happened (`s2.py`, then `s3.py`, real SQL):**
  - An instructor phone made QD3-015, and four students sent results. The server: `created 11-24, expires 12-24, 4 results`. The phone stored `"exp":"2026-12-01…"`.
  - **Day 6:** the list says "QD3-015 … **until Dec 1**", and its Results header right below says "4 results · **deleted on Dec 24**" (`12-phone-results.png`). Opening the results doesn't update the stored date.
  - **Day 8:** the server still holds the class and its 4 results until Dec 24. The phone's list shows only "Open with an instructor key" (`20-phone-day8.png`).
  - Making any new code that day physically removed the old key from `oc-ckeys` ("old key still stored? False").
  - **Day 25:** nothing (`20-phone-day25.png`).
- **The same bug, typed path:** an instructor who types the code and key on a second device with Remember, before anyone has sent, also stores the 7-day date.
- **Why it matters:**
  - The screen said "It's saved on this device", and the README says "Class results lists every code you made there". Results are kept for 30 days.
  - Grading after a weekend of homework, or a debrief the next week, needs the key after day 7. An instructor who didn't also copy the key has lost the class's results, though the rows still sit on the server for another 3 weeks.
  - Students were told to ask the instructor to delete their result, and he no longer can.
- **Why CI is green:** `test/class_test.py:42` stubs `cb_class_new` with `expires: 2026-12-24`, a 30-day answer the real function never gives on registration. `client_call.json` pins the arguments, not the answers (see R5.5-09).
- **Fix:**
  - Keep a made code's key for 30 days from creation: the longest the server can keep it.
  - Drop the key only when a read answers `key` after day 7.
  - Update `exp` from every successful `cb_class_read`.
  - Show one date: "results kept until Dec 24 (Dec 1 if nobody sends)".
- **Effort:** S.

### R5.5-02 High: in a class of 30, tapping ✕ on any lower row seems to do nothing: the Delete/Keep bar is drawn above the list, off screen
- **Where:** `cbListHTML`, ui.js:2120. The `cb-ask` bar and `cb-err` sit before `<ol class="cb-list">`. The "Delete all" link at the bottom has the same problem.
- **What happened (`s10.py`, 30 results, the troll at row 27):**
  - I scrolled to the troll and tapped ✕.
  - **Phone 390x844:** the bar's top was at −1,124 px, with nothing on screen (`70-phone-delete-row25.png`).
  - **PC 1440x900:** −1,170 px (`s10pc.py`).
  - A failed delete's error goes to the same off-screen spot.
- **Why it matters:**
  - "Delete a troll" is the only moderation tool, and the list is ranked best-first, so trolls with low scores sit at the bottom.
  - The instructor taps ✕, sees no change, and taps again. That just re-arms the ask.
  - `class_test.py` only deletes from a 2-row list, so it never sees this.
- **Fix:**
  - Put the confirm inside the row that was tapped (replace the row's text with "Delete Troll's result? Delete · Keep"), keeping the 450 ms double-tap guard.
  - Or use a bar fixed to the bottom of the screen.
  - Put the error in the row too.
- **Effort:** S.

### R5.5-03 High: on a shared PC, Forget leaves the key on screen, and a typed key that wasn't remembered leaves the names on screen
- **Where:**
  - `keyForgetGo`, ui.js:2536: it clears storage, `U.showKey` and `U.cbList`, but not `U.reg` or `U.codeMade`.
  - `cbKeyOf`, ui.js:2061: it reads `U.reg.key` first.
  - `cbRegHTML`, ui.js:2083-2091.
  - Nothing clears `U.cbList` when the sheet closes.
- **What happened:**
  - **Forget (`s12.py`):**
    1. On a 1440x900 classroom PC, I made BAP-009, and a student sent. I opened Results, tapped **Forget**, then **Forget** again to confirm. Storage became `{"v":1,"c":{}}` and the toast said "This device has forgotten the key".
    2. I closed the sheet and went back to the menu.
    3. The next user opened Class code. The made-code box still reads "Class results are on… **It's saved on this device**", and **Show key** displays YW4Z-Y0AE-SNRW-W8P0 (`80-pc-after-forget.png`).
    4. With that key, **Open with an instructor key** reads every name, and can delete them.
  - **Typed key, Remember unchecked (`s11.py`):** I read a class on the PC, closed the sheet and went to the menu. The next user who opens Class code sees the whole named list, with Refresh and the ✕ buttons working (the key is in `U.cbList.key`).
- **Why it matters:**
  - "On a shared computer, tap Forget when you're done" and "(not on a shared computer)" are the two controls Phase 2 added for shared PCs. Both fail until someone reloads the tab.
  - Classroom PCs keep the browser open between sections.
- **Fix:**
  - Forget also clears `U.reg` and `U.codeMade` for that code.
  - Closing the Class code sheet, or leaving to the menu, clears `U.cbList` when its key isn't saved.
  - Better: a "Done on this computer" button that clears all of it and reloads.
- **Effort:** S.

### R5.5-04 Medium: a code whose registration failed is listed as a live class after a reload, with no way to turn results on
- **Where:**
  - `cbRegister`, ui.js:2068: the key is saved before the call, and kept on a network failure.
  - `codeReg`, ui.js:2531: retry needs `U.reg`, which a reload clears.
  - `cbShow`'s error text, ui.js:2576.
- **What happened (`s6.py`):**
  - School Wi-Fi was down when the instructor tapped Five-Minute Rush. Code 98Z-G16 showed with "Class results are off" and **Try again**.
  - After a reload, the list shows "98Z-G16 · Charge nurse · Five-Minute Rush · until Dec 1" with Results, Show key and Copy key, like a working class. There is no Try again anywhere.
  - **Results** says "That code and key don't match, or the class has ended". Neither is true: it was never registered.
  - Students who play it and Send get `unknown`. Registration is idempotent with the stored key, so one call would fix it.
- **Fix:**
  - Store `pending: true` with the key, and show "Results are off · **Turn on**" on the listed code.
  - Or have Results send `cb_class_new` with the stored key when a read says `key`.
- **Effort:** S.

### R5.5-05 Medium: a code made more than 7 days before the class silently loses its results, and nothing says so where the code is made
- **Where:**
  - `cbRegHTML`: no date or rule on the made-code card.
  - `cbKeys`: drops the code from the list without a word.
  - Migration line 53.
- **What happened (`s5.py`):**
  - I made EWM-809 as a lesson plan a week ahead. The creation card mentions no deadline ("7 days" isn't on the screen). The only hint is "until Dec 1" in the list below.
  - **Day 8:** the code is gone from the instructor's list.
  - A student plays the whole shift, and Send then says "EWM-809 isn't set up for class results, or its class has ended."
  - The shift can't be re-made: Make one draws a new random seed, so the handout or LMS post is dead.
- **Fix:**
  - Say it on the card: "Results open until Dec 1 if nobody sends; once a student sends, until Dec 24. Make the code within a week of the class."
  - Keep an expired, unused code in the list, greyed, with "Expired unused · Re-register". `cb_class_new` accepts the same code again once it's deleted.
- **Effort:** S.

### R5.5-06 Medium: tapping Results on a phone opens the results off screen, so nothing seems to happen
- **Where:** `cbShow`, ui.js:2562-2579. It doesn't scroll to the results, unlike `cbScroll` for a new code.
- **What happened (`s7b.py`):**
  - The instructor phone held 6 codes (two sections, a few mis-taps). I tapped **Results** on the newest code, at y = 771.
  - The results header rendered at y = 1,776 in an 851 px view.
  - With one saved code, it lands at the bottom edge (y = 823, `60-phone-results-tap.png`).
- **Fix:** scroll the results header into view when they load, or show the results in their own sheet with Back.
- **Effort:** S.

### R5.5-07 Low: stray taps register codes the instructor never saw, and the list can't tell them apart
- **Where:** `codeMake`, ui.js:2527, and `cbRegister`. A registration superseded by a newer tap still keeps its saved key (`seq !== U.regSeq` returns before any clean-up).
- **What happened (`s1.py`):**
  - Four quick taps (Quiet Tuesday, Full Moon Friday, Five-Minute Rush, Manic Monday) after WBN-086 left 5 registered classes and 5 stored keys. Only 2 codes were ever on screen.
  - The list shows three rows reading "Charge nurse · Manic Monday · until Dec 1" (`s7.py`), with no label and no "shown/shared" mark.
  - A mis-tap on a level button also takes the projected code off the screen and puts a different one up.
- **Fix:**
  - Drop keys for registrations superseded before they were shown.
  - Let the instructor name a code ("Tue 9am").
  - Ask before replacing a code that is on screen.
- **Effort:** S.

### R5.5-08 Low: Copy key copies the key without its code, and Forget doesn't warn that the results become unreachable and undeletable
- **Where:** `keyCopy`, ui.js:2533; the Forget confirm, ui.js:2107.
- **What happened:**
  - **Copy key** puts `STNP-56HW-S3BJ-XPNB` on the clipboard, and nothing else (`s5.py`). Pasted into an email to himself, it doesn't say which code it opens.
  - The Forget confirm says only "Forget this key on this device?" (`40-pc-forget-ask.png`). It doesn't show the key, doesn't offer Copy, and doesn't say that without the key nobody can open or delete these results.
  - The About page tells students that their instructor can delete their result.
- **Fix:**
  - Copy "Code H8C-R91 · key STNP-…".
  - Forget's confirm: "Without this key nobody can read or delete these results. Copy it first?", with Copy key and Delete all results first.
- **Effort:** S.

### R5.5-09 Low: the UI test answers registration with a 30-day expiry the real function never sends; the contract pins arguments only
- **Where:** `test/class_test.py:42` (`'expires': '2026-12-24T16:00:00+00:00'` for `cb_class_new`); `supabase/tests/client_call.json`; `privacy_test.sql:76` asserts the real answer is 7 days.
- **Why it matters:** this is how R5.5-01 passed all 60 UI checks, which I ran on a scratch copy: "No errors".
- **Fix:** add the answers' shapes to `client_call.json` (a 7-day `expires` on registration), have the stub use them, and have the SQL tests check them.
- **Effort:** S.

### R5.5-10 Low: the only results view is a named, best-first ranking, with nothing safe to project for a debrief
- **Where:** `cbListHTML`.
- **What's wrong:**
  - A debrief means showing the class how it went. The only view lists "27. Troll 20/100 … 3 died" by first name, ranked.
  - Projecting it posts identifiable scores to the room, and many nursing programs forbid that.
  - Hiding Show key fixed the projector problem for the code. The results have the same problem.
- **Fix:** a **Show to class** view: the distribution (median score, deaths, walkouts), with no names.
- **Effort:** S-M.

### R5.5-11 Nitpick: small things on the new screens
- **Wrong "results are off" message:** after a timeout where the server did save the code (`s6.py`: "server has it? 1"), the card says "students just can't send you their results". In fact they can, as soon as **Try again** succeeds, or even without it.
- **Listed codes lose their description after a release:** "PR6-81Y until Dec 1", with no role or shift (`s9.py`).
- **The README undersells the 7-day rule:**
  - "For a class" says everything is deleted 30 days after the code was made, and doesn't mention the 7-day rule.
  - The v0.31.0 paragraph says the list holds "every code you made there", which is false after day 7 (R5.5-01).
- **Fullwidth letters pass the name rule:** "Ｓａｍ" is accepted on the real SQL, so a student can sit next to "Sam" in the list.
- **Two contradictory dates on one screen:** the list says "until Dec 1" for a code whose results header says "deleted on Dec 24" (`12-phone-results.png`).

**Counts:** Critical 1, High 2, Medium 3, Low 4, Nitpick 1 (11 total).

## 4. Coverage

**Instructor (real taps):**
- **Codes:**
  - Made codes on a 1440x900 classroom PC, a 1024x768 projector, a 390x844 phone and an 820x1180 tablet.
  - Used Copy, Copy key, Show key and Play it.
  - Made four quick stray taps, and tapped during a held registration answer.
- **Reading:**
  - Read results from the saved list, and by typing the code and key on another device, with and without Remember.
  - Read on a simulated build two releases later.
- **Managing:**
  - Deleted a troll in a 3-row list and in a 30-row list, on a phone and on a PC.
  - Used Copy table (read back from the clipboard) and Download CSV (bytes checked).
  - Used Forget on a shared PC, then checked what the next user sees.
- **Time travel:** came back on days 6, 8 and 25 to a used code, and on day 8 to an unused one.

**Registration failures (real SQL):**
- An answer held past 8 seconds, then Try again.
- The network down, then a reload.

**Students (real taps, phone and tablet, campus network):**
- **Normal sends:** typed the code in lower case, played Five-Minute Rush (the bot finished the shift; every send, guard and menu action was a real tap), and sent.
- **Retries and repeats:** Wi-Fi down, then a retry; a reload; Last summary; Run it back, then a second send.
- **Shared device:** a second student on the same iPad.
- **Cheating:** an edited saved report.
- **Leaving:** left without sending, then played another shift; a send on day 8 to an expired code.

**Server rules (`as anon`, per fake network):**
- 62 registrations from one network.
- The 500-result cap from three networks.
- 26 names through `codeblack.clean_name`.

**Regular play (`s8.py`):**
- A Quiet Tuesday as charge nurse in landscape, 20 s at 1× untouched, then the bot.
- An attending Five-Minute Rush.
- No network calls, no Send box, Menu leaves in one tap, and no console errors.
- `git diff ce11887..46a0b03` doesn't touch `src/engine.js`, `src/map.js` or `src3d/`.

**Test suite:** `test/class_test.py`, run on a scratch copy of the tree (it writes screenshots into `test/shots/`): all checks pass.

**Not covered:**
- Real Safari and its 7-day storage eviction.
- A real campus NAT, and IPv6 rotation.
- The live project (off limits).
- WebKit and Firefox.
- The 3D floor.
- The password gate.
- A full 30-minute shift played entirely by hand.

## 5. What I'd keep

- **The code never changes once shown.** A slow or lost answer gives the same code with Try again, and registration is idempotent with the key the game made.
- **The projector is safe:** the key is behind Show key.
- **Results open on any version.** A well-formed code with its key opens whatever version made it.
- **A real export.** Copy table and a CSV that Excel opens cleanly: BOM, CRLF, formula-safe cells, and a Sent (UTC) column.
- **The list says what a debrief needs:** deaths, fired, sped-up %, the attending's diagnoses, and "Not for grading" in plain words.
- **Retries are safe.** A retried send is kept once, a reload remembers "Sent", and every call gives up after 8 seconds with the reason: network, timeout or server.
- **The name rule fits real names.** "Mary Ann K.", "De la Cruz", "Nguyen Van A" and "Đặng Thu" are accepted, digits and emails are refused, and the name never touches storage.
- **The class cap and the rate limits are sane.** The cap is 500; per network, 60 codes, 600 results and 300 reads an hour, and refusals past the limit no longer count.
- **Regular play is untouched.**
