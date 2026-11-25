# Reviewer 5, round 4: Hardcore gamer, game critic and classroom user

Build reviewed: branch `claude/sleepy-rubin-jot35n` at v0.31.0 (HEAD `ce11887`), the committed `index.html` (it matches HEAD, `GAME_V = "0.31.0"`), served at http://127.0.0.1:8765 and driven with Playwright for Python in headless Chrome (`CHROME_PATH=/usr/bin/google-chrome`).

**The server was not a canned stub.** I built a throwaway Postgres 16 (a `mktemp -d` cluster, like `supabase/tests/run.sh`), loaded `supabase/tests/stubs.sql` and both migrations, and routed every `/rest/v1/rpc/*` call from the page into the real `cb_class_new`, `cb_submit`, `cb_class_read` and `cb_class_delete`. I ran them `as anon`, with `request.headers` set to a fake `x-forwarded-for` for each "network" (a school NAT, a phone on cellular, the instructor's home). So the rate limits, the 300 cap, the name rule and the "taken" answer are the migration's own. Nothing contacted supabase.co or edcodeblack.com.

Scratch is in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round4/r5/`:
- `py/db.py` (the fake REST front over psql) and `py/common.py`;
- `py/s1.py` to `py/s9.py` (the scenarios below);
- screenshots in `shots/`, cited by number.

Deferred and waived items from round2/STATUS.md and round3/STATUS.md are not re-reported. The one exception is R3.2-07 (see R5.4-07), which round 2 put in this phase.

## 1. Verdict

**Not ready for a real class.** The privacy work underneath is real. Results are behind a key, a retry is sent once, every call gives up after 8 seconds, and an email in the name box is refused. But the instructor side breaks the way teachers actually work:

- **The key shows beside the code.** The classroom PC is on the projector when the instructor makes the code. The key prints right under it, so the whole room can read the key (`02-pc-code-made.png`). Any student can then read and delete classmates' results.
- **A slow school network can lose the whole class's results.** A registration answer slower than 8 seconds that the server still saved, then **Try again**, silently swaps the code. The class already has the first code. It is registered with a key nobody holds, so every result the students send lands in a class nobody can open.
- **Results are hard to find again.**
  - The key is never shown again after a reload.
  - The device lists only the 8 newest codes.
  - "A code made on another device" refuses about 97% of codes once the game has had two releases. There were 15 releases in the last 7 days.
  - There is no export, Print gives a blank page, and everything is deleted at 30 days.
- **The rate limits fight a real school network.**
  - 20 stray taps on the student-visible "Make one" buttons lock the instructor out of making a code for an hour.
  - A lecture of 250 on one campus network gets 50 refusals, though the README promises 300 a class.
  - Refused tries count, so students retrying keep the lock on.

**"Scores are self-reported" is acceptable** for a formative debrief. It isn't acceptable for a table sorted best-first with no plausibility check. I sent 100 points and 3 stars in 4 seconds of play, and it ranked first.

**Regular play is unchanged.** `src/engine.js` is not in the diff, and a Quiet Tuesday played normally with no network calls. The fun problems from round 3 stand as they were.

## 2. Score

**4/10.** The game itself is unchanged. The class loop works on a fast network for one class on one device. It fails on the real cases: a projector, slow Wi-Fi, a second device, a phone a week later, a lab of shared PCs.

## 3. Findings, worst first

### R5.4-01 High: the instructor key is shown beside the code students copy, so projecting the code projects the key; shared PCs keep every key, with no way to forget one
- **Where:** `cbRegHTML`, ui.js:2058-2065; `classHTML`, ui.js:2009; `cbKeySave`, ui.js:2042.
- **What happened:**
  - On a 1440x900 classroom PC, I tapped **Manic Monday** under "Make one (instructors)".
  - The code N66-88C (40 px) and "Your instructor key 1JHB-NDTQ-SN0E-9NKA" (22 px, bold, top at 808 px) are on screen together, with nothing to tap first (`02-pc-code-made.png`).
  - The small print "Don't share it with the class" sits under a key that is already on the wall.
- **Why it matters:**
  - Projecting the code is how a teacher hands it out. Phase 2's goal, R3-02 (no student reads classmates' names), is undone in the first minute.
  - With the code and key, a student can open the table and delete anyone's result: `cbShow` and `cbDelGo` need nothing else.
- **Shared PCs:**
  - The key is saved in the browser (`oc-ckeys`) of the classroom or lab PC. The next person at that PC opens Class code and sees the code listed; one tap shows every name and score (`s3.py`, with the instructor's saved storage).
  - There is no "forget this key on this device" control. `cbKeySave` only drops expired keys.
- **Fix:**
  - Hide the key behind a **Show instructor key** tap.
  - Add a **Show to class** full-screen view with the code and no key.
  - Add **Forget on this device** to each listed code.
- **Effort:** S.

### R5.4-02 High: a slow registration that the server saved, then Try again, silently swaps the code; the class's results go to a code nobody can open
- **Where:** `cbRegister`, ui.js:2047-2057 (`r.error === 'taken'` makes a new code); `cb_class_new`, migration lines 203-204 (not idempotent); `codeCopy` closes the sheet (`res(..., true)`, ui.js:2472).
- **What happened (`s7.py`, real SQL):**
  1. I tapped **Manic Monday** on a phone. The server inserted N6T-08F, but its answer took longer than 8 seconds.
  2. The sheet said: "Class results are off for this code. The server didn't answer in time… **The code still works for playing**; students just can't send you their results." The instructor writes N6T-08F on the board.
  3. I tapped **Try again**. The server answered `{"error":"taken"}` (the instructor's own first insert), and the game made a new code, 5EJ-G9N, and showed its key, with no notice.
  4. N6T-08F is registered on the server (`count = 1`), and no device holds its key. Students who play it and tap Send see "Sent to the instructor". Their results land in a class nobody can read.
- **The same swap after Copy (`s6.py`):**
  - The code, **Copy**, **Share** and **Play it** all work while the sheet still says "Setting up class results…".
  - I tapped **Copy** ("Copied TD1-G89 and how to play it"). Copy closes the sheet.
  - The answer came back `taken`, and the code became 498-R8C with no message (`41-pc-code-swapped.png`).
  - In a real collision, TD1-G89 belongs to another instructor's live class, so these students' names go to a stranger.
- **After a reload:** a code whose registration failed can't be registered again. `U.codeMade` isn't saved, and nothing else offers Try again.
- **Fix:**
  - Make registration idempotent: send a client token, and return the same key for the same token.
  - Turn the code grey ("not ready") and disable Copy, Share and Play until it is registered.
  - Never replace a code that has been shown, copied or shared without a blocking card: "Don't use N6T-08F. Your code is 5EJ-G9N."
- **Effort:** S-M.

### R5.4-03 High: "A code made on another device" refuses about 97% of codes after two game releases, before asking the server
- **Where:** `cbShow`, ui.js:2504 (`E.readCode(...)`, then `code = c && c.code`); `PAST_V` holds one version (ui.js:1998).
- **What happened:**
  - In Node, I made 640 codes on v0.31.0 and read them on a build two releases later (`setCodeVersion('0.32.0', ['0.31.1'])`): 618 come back `null`.
  - In the browser (`s4.py`, `OC.setCodeVersion('0.32.1', ['0.32.0'])`), I typed DCS-013 with its correct key. The result was "That code doesn't look right. Check each letter." No request went to the server.
  - With the version set back, the same code and key opened the table at once.
- **Why it matters:**
  - Codes live 30 days. The git log has 15 versions between Nov 18 and Nov 24.
  - "Find them on another device three weeks later" is exactly this path. The message sends a teacher hunting for a typo that isn't there.
  - The server's `norm_code` doesn't care about the version. Only the game blocks it.
- **Fix:** for results, check only the format (six characters in the code alphabet) and let the server answer. Keep the checksum test for **Play a code**.
- **Effort:** S.

### R5.4-04 High: the key is effectively one-time: under the fold on a phone, never shown again, 8 codes listed at most, and lost with the browser's storage
- **Where:** `cbRegHTML`, ui.js:2058; `cbListHTML`, ui.js:2083 (`mine.slice(0, 8)`, no key and no label shown); `codeKeyCopy`, ui.js:2471.
- **What happened:**
  - **Phone (390x844):** after making a code, the key's top edge is at 847 px in an 851 px view (`03-phone-code-made.png`). The instructor sees the code, **Copy** and **Play it**. Copy closes the sheet.
  - **After a reload:** the listed code is a button, and the key is never displayed again on the device that holds it (`s6.py`: "is any key on the Class code screen? 0").
  - **Ten codes on one phone** (two sections a week, or a few exploratory taps, each of which registers a code): all 10 keys were stored, and only the newest 8 are listed. The first two classes' results can't be reached without the key, which the game never shows again (`s4.py`).
  - **Listed codes have no name.** Six buttons can read "Charge nurse · Manic Monday · until Dec 24", with no section or label.
  - **Copy key** copies "4YYN-SKEK-XRAS-903F" alone. The other device needs the code too.
- **Not reproduced here, but certain to bite:**
  - Safari (WebKit, since 13.1 in 2020) deletes a site's script-written storage, `localStorage` included, after seven days of Safari use without the user interacting with that site. Home Screen web apps are exempt. An iPhone instructor who doesn't open the game for a week loses every key.
  - Many school PCs wipe the browser profile at logout.
  - Nothing warns that **a lost key can't be recovered by anyone**. The text says only "It's saved on this device."
- **Fix:**
  - A **Show key** button on each listed code.
  - List all live codes, with a label the instructor types ("Tue 9am").
  - Copy "code + key" together.
  - Say plainly: "Lose this key and nobody can open these results. Copy it somewhere safe now."
- **Effort:** S-M.

### R5.4-05 High: no way to keep the results; Print gives a blank page, and everything is deleted at 30 days
- **Where:** `cbListHTML`, ui.js:2080-2104 (the only controls are cbShow, cbOpen, cbDel, Refresh and Delete all); style.css:827-829 (`body > *:not(#report) { display: none }` in print).
- **What happened:**
  - I opened a class's results on the classroom PC and printed to PDF (`s8.py`, `50-print-results.pdf`). The PDF is one blank page. `pdftotext` returned only a form feed.
  - There is no Copy, CSV or Print button for the table. The server returns `created_at`, and the table doesn't show it.
- **Why it matters:**
  - A nursing instructor who records participation or a lab grade has to retype names from a phone-sized modal before day 30.
  - A teacher evaluating the tool would reject a results table that deletes itself and can't be saved.
- **Fix:** add **Copy results** (tab-separated: name, points, stars, played, wait, LWBS, deaths, time sent) and a print style for the results box.
- **Effort:** S.

### R5.4-06 Medium: the rate limits fight a real school network: stray taps lock the instructor out, a big lecture can't all send, and retrying keeps the lock on
- **Where:** migration lines 124 (every call is counted, refused or not), 197 (`allow('class', 20)`), 217 (`allow('submit', 200)`), 230-233 (global caps answer `busy`); `CB_BUSY`, ui.js:2028.
- **Measured on the real SQL (`s5.py`):**
  - **Make one:** 25 registrations from one school network gave 20 accepted and 5 `busy`. Then the instructor's own registration was refused with `busy`.
    - The four level buttons sit under "Make one (instructors)" on the same sheet students open to type the code.
    - Each tap registers a code and holds a slot for 30 days.
  - **Sending:** 250 students on one campus network gave 200 accepted, then 50 refused from student 201. The README and the server allow 300 per class.
  - **Refusals count:** after 250 tries the network had 250 counted submits. Students told "Wait a while and try again" who keep tapping keep the hour from running out.
  - **Global caps blame the user:** the global limits (3,000 an hour, 10,000 a day, 100,000 in all, 50,000 live classes) also return `busy`. The game then tells a student "Too many requests from this network right now", when it is the whole service.
- **Fix:**
  - Don't count refused requests.
  - Count sends per class, or raise the per-network send limit above the class cap.
  - Put "Make one" behind an "I'm the instructor" step.
  - Give global limits their own message.
- **Effort:** M.

### R5.4-07 Medium: self-reported scores are one localStorage edit away, with no plausibility check, and the table ranks them; the Phase 2 cheat item was dropped
- **Where:** `cbSend`, ui.js:2480-2498 (sends `R.avg`, `R.stars` and `R.realSec` from `oc-last-report`); `cb_submit` checks ranges only; style.css:1022 hides **Played** under 460 px.
- **What happened (`s3.py`):**
  - Before sending, I edited `oc-last-report` (avg 100, stars 3, realSec 4) and reloaded. I opened **Last summary** and tapped **Send** as "Taylor".
  - The instructor's table: **1. Taylor 100 ★★★ 0m**, above two genuine 90s (`20-pc-results.png`).
  - The server also took 100 points and 3 stars in 0 seconds on Full Moon Friday, and 0 points with 3 stars.
  - On the instructor's phone, the **Played** column, the only hint of a fake, is hidden.
- **`window.OC`:** it still has 239 members, including the ACLS answer key (`CODE_Q`). Round 2's STATUS put R3.2-07 (the cheat surface) in Phase 2. Commit `c941ede` doesn't mention it, and no status note closes or defers it.
- **Is "self-reported" acceptable?** Yes for a discussion, with the label. No for a best-first ranking with no checks.
- **Fix:**
  - Reject impossible results on the server: real time under a floor for the level at 4×, and stars that don't match the score.
  - Show **Played** on phones.
  - Sort by time sent by default.
  - Close or formally defer R3.2-07.
- **Effort:** S-M.

### R5.4-08 Medium: one student can appear many times, anyone can use a classmate's name, and a troll with the code can fill the class
- **Where:** `cbSend` (a new `cid` per finished shift); `cb_submit` (no per-device or per-name limit); `cbListHTML` (no time or attempt column).
- **What happened:**
  - **Run it back** on the class shift, then **Send**: a second "Sam 90" row. The table can't tell two attempts from two students named Sam (`s2.py`, `20-pc-results.png`).
  - "Sam" sent from two phones: both accepted.
  - Joke names pass the name rule ("Hugh Jass", "Poopy"). After the instructor deletes one, a replay sends it back.
  - 300 sends from two networks (a laptop on school Wi-Fi and a phone on cellular) filled class TRL-300. The next real student got `full`, shown as "This class already has 300 results." with no next step.
  - A class that replays the 5-minute Rush code can fill its own cap at 10 sends per student.
- **Fix:**
  - Show time sent and an attempt number per device: send a stable per-device id with the result.
  - Add a **Stop new results** switch for the instructor.
  - Give "full" a next step ("Tell your instructor").
- **Effort:** S-M.

### R5.4-09 Medium: on a shared lab PC or iPad, the Send box is filled in with the last student's name
- **Where:** `cbName`, ui.js:2066 (`store('oc-cb-name')`, saved on every send).
- **What happened:**
  - "Sam" sent from a phone. The next shift on that browser showed the name box already holding **Sam** (`12-labpc-prefilled-name.png`).
  - A second student who taps Send sends their shift as Sam's.
- **Note:** the prefill predates v0.31, but Phase 2 rewrote this box for a school setting (and set `autocomplete="off"` so the browser doesn't fill a name), then fills one itself.
- **Fix:** don't prefill, or show "Sending as Sam. Not you?" and clear the name after a send.
- **Effort:** S.

### R5.4-10 Medium: an unsent class result is lost as soon as any other shift ends
- **Where:** `showReport`, ui.js:2857 (overwrites `oc-last-report` every time); `cbSendHTML` needs `d.at === at`.
- **What happened (`s3.py`):**
  1. A student finished the class code. The Wi-Fi was down, and **Send** said "Couldn't reach the server".
  2. While waiting, the student played a regular Five-Minute Rush.
  3. Back online, the report and **Last summary** have no class line and no Send box. The class result is gone.
  - **Run it back** on the class shift before sending does the same.
- **Why it matters:** "retry when the Wi-Fi drops" works only if the student does nothing else in between. The README says a result "is remembered after a reload". It isn't remembered after another shift.
- **Fix:** keep unsent class results in their own small queue, offered on the menu until sent.
- **Effort:** S.

### R5.4-11 Medium: the results table shows the wrong numbers for a debrief
- **Where:** `cbListHTML`, ui.js:2093-2099 (Points, Stars, Played, Wait, LWBS); `cbSend` sends `expired` (deaths), `ama` and `seen`, which are never shown.
- **What's wrong:**
  - **Deaths are sent and hidden.** A student who let three patients die can top the table.
  - **The attending gets charge-nurse columns.** An attending class sees Wait and LWBS, and nothing on diagnoses, harm, legal risk or radio calls.
  - **"Points" is a number the student's report never shows.** It is the average of the four score cards (`avgScore`). The report's own "Where your points came from" lists ledger points (+156, −15), so "Taylor got 100 points" means nothing to the class.
- **Fix:**
  - Add a **Died** column.
  - For an attending class, add the Clinical score and diagnoses right.
  - Rename Points to "Average score", and show that number on the student's report.
- **Effort:** S.

### R5.4-12 Low: after a 30-minute shift, an unregistered code tells the student to "ask your instructor for a new code"
- **Where:** `WHY.unknown`, ui.js:2492.
- **What's wrong:** a new code means replaying the shift. What usually happened is a failed registration, and **Try again** on the instructor's screen fixes it (until a reload, see R5.4-02).
- **Fix:** "Ask your instructor to open Class code and tap Try again, then send again."
- **Effort:** S.

### R5.4-13 Low: the privacy text and the README undersell what is sent and shown
- **Where:** `aboutHTML`, ui.js:2727.
- **The privacy text** says "a few shift numbers (average wait, walkouts, patients seen)". The send also includes role, shift, game version, deaths (`expired`), AMA, bed-first count, scenario and a result id.
- **The README** says "Students no longer see a Class results box". Every student sees "Class results (instructors)", with **Open with an instructor key** and the four "Make one" buttons.
- **Fix:** list every field, and fix the README line.
- **Effort:** S.

### R5.4-14 Low: two-word first names with an initial are refused
- **Where:** `cbClean`, ui.js:2030; `codeblack.clean_name`.
- **What happened:** "Mary Ann K.", "De la Cruz" and "Nguyen Van A" come back `invalid` on the real SQL. The hint's own example is "Ana M.", so a student named Mary Ann can't add an initial to tell herself apart from another Mary Ann.
- **Fix:** allow two spaces.
- **Effort:** S.

### R5.4-15 Low: Copy (the code) closes the sheet, which now holds the key
- **Where:** ui.js:2472 (`res(..., true)`).
- **What's wrong:** copying the code is the first thing an instructor does. It now hides the key box they haven't read yet, and on a phone that box is below the fold.
- **Fix:** keep the sheet open after Copy.
- **Effort:** S.

### R5.4-16 Nitpick: small things on the new screens
- **Delete all** uses the same dark primary button as **Refresh**, right under it (`31-phone-delete-ask.png`).
- The student's Send box ends with "Scores are self-reported." That reads as an invitation, and it is meant for the instructor.
- On a phone, the sheet's × sits on top of the "Full Moon Friday" button and the "Play a code" box border (`03-phone-code-made.png`, `31-phone-delete-ask.png`).
- The Send box is the last thing in a long report, below "All the numbers", so a student has to scroll past everything to reach the one action the class needs.

**Counts:** Critical 0, High 5, Medium 6, Low 4, Nitpick 1 (16 total).

## 4. Coverage

**Instructor (real taps):**
- Made codes on a 1440x900 PC and a 390x844 phone, with Copy, Copy key and Play it (`s1.py`, `s4.py`).
- Read results by one tap on the device that made the code, and by typing the code and key on another device: on the same version, and on a simulated build two releases later.
- Deleted one result (with the Keep/Delete prompt).
- Made 10 codes on one device and checked the list.
- Reloaded and looked for the key.
- Printed the results to PDF.

**Registration failures (routed through the real SQL):**
- An answer slower than 8 seconds, then Try again (`s7.py`).
- A slow `taken` after Copy (`s6.py`).

**Student (real taps, phone):**
- Typed the code in lower case, played Five-Minute Rush codes, and sent.
- Wi-Fi down, then a retry with the same result id: kept once.
- Sent again after Run it back.
- A second student on the same browser (shared device).
- An edited saved report, sent from Last summary.
- Wi-Fi down, then played another shift, then tried to send (`s2.py`, `s3.py`).
- The bot finished each shift quickly (`OC.botStep`); the sends and screens were real taps.

**Server rules (`s5.py`, as anon, per fake network):**
- 25 registrations from one network.
- 250 sends from one campus network.
- A 300-result fill from two networks, then a real student.
- Joke names, delete and resend.
- Impossible scores.
- The same name twice.
- Eight real-world names.

**Regular play (`s9.py`):**
- A Quiet Tuesday at 1× as charge nurse, landscape phone, then finished by the bot. No network calls, no Send box, no console errors.
- `git diff 101e07a..ce11887` doesn't touch `src/engine.js`. The UI changes are the class code sheet, the report's Send box, About and the gate's fetch timeout.

**Not covered, and why:**
- Real Safari: the 7-day storage rule is WebKit's documented policy; I did not reproduce it here.
- A real school NAT, and IPv6 address rotation.
- The live Supabase project (off limits).
- WebKit and Firefox.
- The 3D floor.
- The password gate on a gated host.
- A full 30-minute class shift by hand.

## 5. What I'd keep

- A retry carries the same result id, so a send that timed out and is sent again is kept once. A reload remembers "Sent".
- Every call gives up after 8 seconds, with a plain message, and Send is off while a send is out.
- The name box refuses an email address before anything leaves the device. Accented names (José María, Zoë, O'Neil, Jean-Luc P.) pass on the real SQL.
- No device without a key sees any name. A wrong key and an expired class give the same answer.
- Deleting asks first, per row and for all.
- The key is shown in groups of four, and O, I and L are read as 0, 1 and 1.
- When the device can't save the key, it says so ("write it down now").
- The class code sheet no longer scrolls sideways on a phone, and the new code scrolls into view.
