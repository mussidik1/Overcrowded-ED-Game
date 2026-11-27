# Round 13, Reviewer 3: game tech, security and privacy (v0.33.0)

Branch `claude/sleepy-rubin-jot35n` at `895bc15`. Diff: `git diff 78916ef..HEAD` over the paths in BRIEF.md, Round 13. I made no changes to the repo. Scratch scripts are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round13/r3/`: `crash1.py`, `crash2.py`, `crash3.py`, `store.py`, `names.py`, `back.py`, `perf.py`, `size.js`, `sync.js`, `idle.js`, `fired.js`.

## 1. Verdict

**Do not ship v0.33.0 yet.** The headline Phase 4 promise, that the crash guard "keeps the last good save (doesn't save the state the error left half-done)", is false in the running game. Both buttons on the crash card (Reload, and "Start over without the save") reload the page. `pagehide` then calls `save(true)` and writes the broken state. "Start over without the save" puts the save straight back, and Resume offers it. The crash card is also not modal for the keyboard. From it you can reach Main menu, which also saves the broken state. A new shift started after that is frozen, because the frame loop never restarts and nothing says so.

The headline Phase 6 promise, that the attending is graded on their own calls, can be gamed. An attending who never sees a patient and only answers the radio gets **3 stars and a 100/100 score** on Easy, Manic Monday and the Rush. That score goes to the instructor and adds career rank.

The "initials only" privacy rule lets full names through ("John", "Al Wu", 王伟, 李小龙, 김민준). The instructor-facing attending note now says the opposite of how attendings are graded.

Things that hold up:
- CSP is unchanged, with no inline handlers. The new string-built HTML is escaped.
- The save cap is sound (a full Hard shift is about 0.3 MB against a 3 MB cap).
- The service worker never touches POSTs or cross-origin requests.
- Class-code walk-ins stay in sync for the attending on Easy, Hard and the Rush.
- The 3D loop stops and starts correctly, and a lost WebGL context falls back to the flat map.
- I rebuilt into a copy: `index.html` and `sw.js` match the committed files byte for byte.
- `npm test`: 782 ok, 0 FAIL. `npm run lint`: clean. `crash_test.py`, `career_test.py` and `map3d_life_test.py` all pass. They pass because they don't test the failure modes below.

## 2. Score

**5 / 10.** Escaping, CSP, the save cap, offline play, the 3D lifecycle and class-code sync are all fine. But the crash guard's main guarantee doesn't hold. The new attending grade gives full marks for doing nothing. And the privacy rule the owner chose doesn't do what the About page says.

## 3. Findings (worst first)

### R3.13-01 High: the crash card re-saves the broken state; "Start over without the save" puts the save back
- **Location:** `src/ui.js` `crash()` (3324-3339), `save()` (3003), `pagehide` listener (3452), `visibilitychange` listener (3451).
- **Claim:** The comment at 3321-3322 says the guard "keeps the last good save (it doesn't save the state the error left half-done)". `save()` has no `crashed` check, and `U.scene` stays `'game'` after a crash.
  - `#crashReload` calls `location.reload()`. That fires `pagehide`, which calls `save(true)` and writes the half-done `G`.
  - `#crashDrop` calls `store('oc-save', null)`, then `location.reload()`. `pagehide` then writes the save again.
  - Hiding the tab after a crash does the same through `visibilitychange`.
  - If the error comes back from that state, the player loops: Resume, crash, "Start over", the same save again.
- **Reproduce:** `python3 crash1.py /home/user/Overcrowded-ED-Game`. It saves a good state (t 0.32), marks `G.HALF_DONE`, moves `t` on by 100, and makes `OC.step` throw. Output:
  - Before any tap: `HALF_DONE in save = False`.
  - After "Start over without the save": `save exists = True HALF_DONE = True t = 100.33` and `resume offered on menu = 1`.
  - `crash_test.py` checks the save before Reload is tapped, and never after.
- **Fix:** In `save()`, return at once if `crashed`. Also skip the `pagehide` and `visibilitychange` saves when `crashed`. Add a crash_test check: after Reload and after Start over, the save is the pre-crash one (or absent), and has no marker.
- **Effort:** 15 minutes, plus the test.

### R3.13-02 High: an attending who sees nobody gets 3 stars and a 100/100 class score
- **Location:** `src/engine.js` `mdScores` (849), `baseStars` (862), `avgScore`, `gradeParts`. `src/ui.js` `cbArgs` (2315: `p_score` is `R.avg`) and `careerAdd` (3284).
- **Claim:**
  - `clinical` is `scoreOf('clinical')`, which reads 100 when the attending has done nothing.
  - `dx` is `null` with no calls, and is dropped from the average.
  - Missed radio calls count against Radio, so an idle player gets radio 0. But answering the radio (multiple choice) is enough for radio 100.
  - Easy has `MD_LOAD` 0, so nothing is handed over and nothing counts as unseen.
- **Reproduce:**
  - `node idle.js` plays a "radio-only" attending: never sees a patient, answers each radio call correctly. Results (seen 0 in every row):
    - Easy, seeds 777/31337/4: **3 stars, avg 100** `{"clinical":100,"dx":null,"radio":100,"legal":100}`.
    - Manic Monday: 3 stars on two of three seeds (avg 88).
    - Rush: 3 stars on all three seeds.
    - Hard: 2 stars.
  - `node sync.js`, a fully idle attending (doesn't even answer the radio):
    - Easy and the Rush: 2 stars, the same as or better than the autopilot attending playing at 60% accuracy (2 and 1 stars on Easy).
    - Hard: the idle attending gets 1 star; the active autopilot is fired with 0.
- **Impact:**
  - This score and these stars are what `cb_submit` sends, and what the instructor's table and CSV show.
  - Each idle Rush adds 3 career rank points (about a minute at 4×).
  - It undoes the release's main grading change (R5-03).
- **Fix:**
  - When `M.seen === 0`, or own patients are under some floor, Clinical is `null` and not 100. The grade then needs at least Clinical and Diagnoses to award stars.
  - Or cap stars by patients seen per hour, the way the Rush pace cap works.
  - Add rules tests: an idle attending and a radio-only attending each get 0 stars on every level.
  - R5 should decide the exact rule.
- **Effort:** 1 to 2 hours, plus golden.

### R3.13-03 Medium: the crash card doesn't trap the keyboard; the board behind it still acts, and a shift started afterwards is frozen with no message
- **Location:** `src/ui.js` `crash()` (3324). `.app` is never made inert. The Tab trap in `bind()` covers only `#modal` and `#sheetBox`. `frame()` returns at once while `crashed` is set (3341).
- **Claim:**
  - Tab moves out of the card onto the HUD.
  - Enter on Menu opens the pause card. Main menu then calls `save(true)` and writes the broken state.
  - The crash card stays on screen over the menu.
  - A shift started after that never advances: `crashed` is never cleared, so `requestAnimationFrame(frame)` is never called again.
- **Reproduce:**
  - `python3 crash2.py`: the Tab order is `crashReload[in], crashCopy[in], crashDrop[in], BODY[OUT], btnYellow[OUT], btnSpeed[OUT], btnPause[OUT]`, and `app inert False`.
  - `python3 crash3.py`: after a crash, Menu, then Main menu, prints `scene title, crash card still there 1, HALF in save True`. A new Quiet Tuesday then prints `time advances? 0 0`.
- **Fix:**
  - Set `$('.app').inert = true` and make `#title`, `#report` and `#sheetWrap` inert in `crash()`.
  - Trap Tab inside `#crash`.
  - Make `mapAct` and `ACT` no-ops while `crashed` (the same `save` guard as in 01).
  - Add a crash_test check: after a crash, Tab stays in `#crash`.
- **Effort:** 30 minutes.

### R3.13-04 Medium: "initials only" lets full names through, and the About page promises initials
- **Location:** `src/ui.js` `cbInitials` (2141), `cbSendable`. The About text "your initials (not kept on this device)". The owner's decision (QA5-1): "so no full name can get through".
- **Claim:** `/^(\p{L}\.?\s?){1,4}$/u` with at most 4 letters accepts:
  - Any first name of 4 letters or fewer.
  - A first and last name totalling 4 letters.
  - Most Chinese and Korean full names, which are 2 to 3 characters.
- **Reproduce:** `python3 names.py` shows these accepted: `John`, `Mary`, `Liam`, `Emma`, `Al Wu`, `Jo Li`, `Bo Li`, `王伟`, `李小龙`, `김민준`, `Ana M`, `Олег`, `Иван`.
- **Fix:**
  - Either accept only single letters, each optionally followed by "." or a space (`/^(\p{Lu}\.?\s?){1,4}$/u` after uppercasing, with no two letters in a row unless the whole entry is 2 to 3 Latin capitals), and refuse Han, Hangul and kana, where one character is a name syllable.
  - Or change the About and Send wording to "initials or a short nickname: not your full name" and drop "no full name can get through" from the rationale.
  - The server still accepts full names. That is documented, but say so in R2's notes.
- **Effort:** 30 minutes, plus the contract-file names list.

### R3.13-05 Medium: the instructor note says the attending's score reflects the department, the opposite of v0.33.0
- **Location:** `src/ui.js` `CB_MDNOTE` (2240). It is shown in the class results list (2289) and the CSV (2306). Related: the Send box says "the score is the average of your four scores" (2347).
- **Claim:** `CB_MDNOTE` still says "the score and stars mostly reflect the department the computer runs". Since Phase 6 the attending's `R.avg` and `R.stars` come from `mdScores` (own Clinical, Diagnoses, Radio, Legal). Instructors reading results are told the wrong thing about the main number. For the attending, the average also drops null parts, so it is often the average of three, not four.
- **Reproduce:** read `CB_MDNOTE` next to `gradeParts()` and `avgScore()` in `engine.js` 860-861. A radio-only shift sends `avg 100` with `dx null` (`idle.js`).
- **Fix:** Rewrite `CB_MDNOTE`: "Attending: the score and stars are the attending's own four (clinical on their own patients, diagnoses, radio calls, legal); a part with nothing to grade is left out." Fix the Send box wording for the attending.
- **Effort:** 10 minutes.

### R3.13-06 Low: a malformed `oc-career` or `oc-bests-*` value blanks the whole app on every load
- **Location:** `src/ui.js` `career()` (3277) checks only `v === 1`. `rankLine` (3292) reads `c[m].pts`. `bestStars` (3053) returns the raw stored number, and `'☆'.repeat(3 - st)` throws on any value over 3.
- **Claim:** Boot throws inside `titleHTML`, so `window.OCUI` is never defined and the page stays blank until site data is cleared. This is the same class of failure Phase 4 fixed for `oc-save` (R3-09). A string `pts` also concatenates in `careerAdd` (`'5' + 2 = '52'`).
- **Reproduce:** `python3 store.py`.
  - `oc-career = {"v":1}` gives `Cannot read properties of undefined (reading 'pts')`, `OCUI is not defined`, and title text length 0.
  - `oc-bests-easy = 9` gives `Invalid count value: -6` and a blank title.
- **Fix:**
  - `career()`: check that `c.rn` and `c.md` are objects with finite numeric `pts` and `n`, otherwise start a fresh record.
  - `bestStars`: clamp to 0 to 3.
  - Wrap `titleHTML` in the same fallback as the save.
- **Effort:** 15 minutes.

### R3.13-07 Low: the end-of-shift settlement adds legal-risk reasons after a firing, and can pass 75% with no firing
- **Location:** `src/engine.js` `endShift` (4522). The `settleDx`/`unseenHanded` loop runs **before** `if (G.over) return` and before `G.over` and `G.fail` are set. `litAdd` (548) guards only on `G.over && G.fail`.
- **Claim:**
  - When the attending is fired, the loop adds `litLog` and M&M lines after the firing reason, which breaks R6.9-02. The added lines say "on your list and never seen (they were still waiting when the shift ended)" and "missed … (must not miss)".
  - At 19:00, the settled calls can push legal risk past 75: `litCheck` sets `G.fireNow`, which is never acted on. The report then shows Legal 0 to 25% with no firing, and a stale `fireNow: true` is left in `G`.
- **Reproduce:** `node fired.js` (Hard, seed 777, autopilot attending). Fired at t 698.0, then 7 entries at 698.1: five "never seen… when the shift ended" and two "missed …".
- **Fix:** In `endShift`, skip the settlement when `reason === 'fired'`, or set `G.over` and `G.fail` first and let the settlement add only to stats, not `litLog`. After settling, clear `G.fireNow`.
- **Effort:** 20 minutes, plus a rules15 check.

### R3.13-08 Low: the back button leaves a class summary without the "not sent yet" guard; back doesn't close the pause menu
- **Location:** `src/ui.js` `popstate` (3439-3450) and `backTrap` (3120).
- **Claim:**
  - On the report scene the handler returns without pushing state. The first Back does nothing, and the second leaves the site with the result unsent. `unsentGuard` only runs for in-game taps. It is recoverable through Last summary.
  - In a shift with the pause menu open, Back does nothing but push state, though an Android user expects it to close the menu.
  - On the menus, after using the on-screen back, the next device Back is a dead press.
- **Reproduce:** `python3 back.py` plays a class-code Rush to its report. Back 1 stays on `report`. Back 2 lands on the previous page (`data:text/html,…`).
- **Fix:** On `report`, run `unsentGuard()` and push state again when it returns true. In a shift, `else if (U.paused && !U.modal) ACT.pause()` closes the menu.
- **Effort:** 15 minutes.

### R3.13-09 Low: a card that opens takes keyboard focus, so a held or repeated Enter picks its first choice
- **Location:** `src/ui.js` `renderModal` (2515) focuses the first enabled button on every card that appears, wherever focus was.
- **Claim:** A keyboard player pressing Enter on the board when an event or code card pops up activates the card's first option. Enter clicks on keydown, and auto-repeat continues. Taps got `startGuard` (QA-18) for the same reason; the keyboard didn't.
- **Reproduce:** By reading the code: the focus moves inside the same `render()` that shows the card, every 110 ms. Any held Enter lands on the card's first button.
- **Fix:** Focus the card container (`#modal`, `tabindex="-1"`) or its heading, not the first choice. Or ignore `repeat` keydowns and Enter for 400 ms after a card opens.
- **Effort:** 10 minutes.

### R3.13-10 Low: with the 3D floor on (the default), 32+ invisible SVG rooms are in the tab order
- **Location:** `src/map.js` 568 adds `tabindex="0"` to every `mroom-*`. `src/style.css` 521 sets `#map.three > svg.floor { opacity: 0; pointer-events: none; }`.
- **Claim:** Keyboard users tab through every room with no visible focus ring, because the SVG is transparent under the canvas. Enter opens a room they can't see is focused.
- **Reproduce:** By reading the code (served page, 3D on: the `g[tabindex="0"]` elements are inside an opacity-0 SVG).
- **Fix:** Set `tabindex="-1"` on the rooms while `#map.three`, or `visibility: hidden` on the SVG (which also takes it out of the tab order). Give the 3D canvas its own keyboard path, or document that the keyboard uses the flat map or the list.
- **Effort:** 15 minutes.

### R3.13-11 Low: problems in the replace-saved-shift question
- **Location:** `src/ui.js` `start()` (first line), `replaceHTML` (3122), `replaceGo`/`replaceNo` (2977), `codePlay` (2781).
- **Claim:**
  - (a) `codePlay` sets and stores `U.mode`, `U.scen` and `U.pack` from the code before `start()` asks. "Keep my shift" then leaves the menu on the code's role and scenario.
  - (b) `U.replaceAsk` isn't cleared when the player goes to a submenu and back, so the question comes back later. Its "Start the new one" then starts the earlier choice, which may be a class shift.
  - (c) `replaceGo` doesn't set `startGuard`, so the QA-18 double-tap problem comes back on this path.
  - (d) Escape and Back don't answer it, though it is `role="alertdialog"`.
- **Fix:** Ask before `codePlay` changes any settings. Clear `replaceAsk` in `tmenu`. Set `startGuard` in `replaceGo`. Map Escape and Back to `replaceNo`.
- **Effort:** 20 minutes.

### R3.13-12 Nitpick: crash card details
- "Saved up to the last few seconds": saves are 15 real seconds apart, which is about 24 game minutes at 4×. Say "the last minute".
- Copy details uses only `navigator.clipboard`, which is undefined on plain-http LAN hosts. `copyText()` with its fallback already exists in the file.
- A crash on the title scene (the demo) offers "Start over without the save", which deletes a valid save that had nothing to do with the error.
- `#crashH` (with `tabindex="-1"`) shows a focus box around the heading (screenshot `crash.png`).

### R3.13-13 Nitpick: the arrival queue `ARRQ` (261) is module-level and never cleared
Arrivals queued in one shift can pop up as "New: …" in the next if it starts within about 3 seconds. Above 4 queued, the oldest are dropped. Up to 12 seconds of lag on a sideways phone shows patients who may already be roomed.

### R3.13-14 Nitpick: new unescaped interpolations of stored report fields
`scoreCardsHTML` and `reportHTML` put these into HTML without `esc` or a number cast: `R.pace.wait`, `R.pace.lim[*]`, `R.dxRight`, `R.dxWrong`, `R.lit`, `B.right`, and `U.career.gain`. All but `U.career.gain` come from `oc-last-report`. The site's CSP blocks script execution. The Claude artifact copy has no CSP. Cast them with `+x|0`.

### R3.13-15 Nitpick: the `THIRD_PARTY_NOTICES.txt` link in About
It isn't in the service worker's `FILES`, so offline it opens a blank 503. `tools/pack3d.js` doesn't include it, so it 404s in the artifact copy.

### R3.13-16 Nitpick: the rude-initials list refuses real initials
It refuses real initials such as A.S.S., K.K.K. and S.E.X. with "Please use your own initials", which accuses a student of something they didn't do. Use a neutral message: "Those letters can't be sent; try adding a middle initial."

### R3.13-17 Nitpick: render cost
`perf.py`, Hard shift two hours in, paused: list board 0.57 to 0.69 ms per `render()`, floor plan 1.56 to 2.01 ms (about +25%, from `focusMgr`, the inert toggle and the new HUD). Fine at a 110 ms cadence. Noted for the record.

### R3.13-18 Nitpick: `careerAdd` dedupes on `Date.now()`
`c.last >= at`: if a device clock is moved back, shifts stop counting until the clock passes `last`. Use a per-report id (the report's `at` is already stored) or a counter.

## 4. Checked and fine
- **CSP:** unchanged (two script hashes, `object-src 'none'`, `base-uri 'none'`). `index.html` has no `on*=` attributes. The crash card's `innerHTML` is static (the error message goes to the clipboard only). `replaceHTML`, `rankLine` and the lesson kinds are escaped or constant.
- **Saves:** a full Hard shift is about 0.30 MB (`size.js`; stringify 4 to 24 ms) against `SAVE_MAX` 3e6. `saveShape` rejects the broken-save fixtures. `resumeSave` drops a save that fails its first render.
- **Service worker:** same-origin GET only, so `cb_submit` POSTs and the name are never cached. The name isn't stored in `oc-last-report`, `U.cbName` is cleared on start and after send, and the report's name line is blank.
- **Class-code sync for the attending:** normal vs idle attending on seeds 777 and 31337. Walk-ins are identical all shift on Easy, Hard and the Rush. EMS arrivals differ, through the documented diversion exception: the game's charge nurse diverts depending on the attending's board.
- **3D:** `map3d_life_test.py` passes (the loop stops and starts; a lost context falls back to the flat map with a toast).
- **Build:** a rebuild in a copy is byte-identical. `npm test` (782 ok), `npm run lint`, `crash_test.py` and `career_test.py` pass.
