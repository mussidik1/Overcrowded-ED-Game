# Reviewer 5, round 8: Hardcore gamer, game critic and classroom user

**Build reviewed: `32dbdae` (v0.31.0), not `87c9c13`.**
- The brief names `87c9c13`. The branch moved three times while I worked: `1d284f1` (round-8 fixes from R1 and R2), then `cbe992b` (reports only), then `32dbdae` (round-8 fixes from R3 and R4) at 01:10 UTC.
- I pinned the review to `32dbdae` with `git archive` into a scratch copy and rebuilt it there. `index.html`, `sw.js` and `3d/map3d.js` came out byte-identical to the committed ones.
- Every finding below was reproduced on `32dbdae`. Where `87c9c13` behaved differently, I say so.
- **The second migration is the `32dbdae` version**, the one the owner will paste. Its `codeblack.fingerprint()` on my database equals `supabase/tests/fingerprint.txt` (`0fb0d391…`).
- **Disclosure:** at the start, one shell command ran `node build.js` in the repo instead of the scratch copy, because `rsync` was missing and the `&&` chain broke. It rewrote `index.html` and `sw.js` with identical bytes, and `git status` stayed clean. Nothing else in the repo was touched.

**The server was the real migrations, not a stub.**
- I used a throwaway PostgreSQL 16 with `stubs.sql`, the baseline, then both migrations in order (a C.UTF-8 database), plus a second en_US.UTF-8 database for the name rule.
- Every `/rest/v1/rpc/*` call from the page went into the real functions as `anon`, with a fake `x-forwarded-for` per network:
  - IPv4: the campus NAT `198.51.100.20`.
  - IPv6: the instructor's phone `2a02:26f0:1d:4::17`, a troll `2a01:4f8:aa:bb::1`, and 13 student phones in `2a02:26f0:1d::/48`.
- All other traffic not going to 127.0.0.1 was aborted. Nothing reached supabase.co or edcodeblack.com, and the logs show no blocked request.

**Time travel:** the page clock moved forward N days, the class rows moved back N days, and the answers' timestamps were shifted so both clocks agree.

**A release mid-course:** a second scratch build at v0.31.1 with `PAST_V = ['0.31.0']`, on port 8787, using the same device storage.

**Scratch:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round8/r5/`
- `py/db.py`, `py/common.py`: the fake REST front and the browser helpers.
- `py/s1.py` … `py/s10.py`, `py/t3.py`: the scenarios.
- `*.out`: their output. Files named `-32dbdae` are reruns on the pinned build.
- `shots/`: screenshots.

Not re-reported (round-7 STATUS gives a reason, or the owner decided): the CSV caveat row, a Cyrillic lookalike counting as another name, the radio-call stream, tall rows (Phase 5), the attending's scoring.

## 0. Round-7 status (my R5.7 findings)

| ID | Status | Evidence |
|---|---|---|
| R5.7-01 High: key box 0 px wide | **Fixed** | `s4.py` on `32dbdae`. Phone 390×844: the box is 253 px with 225 px of text and masked (`disc`). Show is at x 291–363, inside the 16–377 card. Sideways phone, tablet, projector and PC: the box is 334–440 px. Show reveals the key, and nothing scrolls sideways. On `87c9c13`/`cbe992b` the phone form still overflowed its card (Show ended at x 402); R4.8-01 fixed that in `32dbdae`. |
| R5.7-02 Medium: own deaths at the end of the shift missed | **Fixed** | `s9.py`, attending Rush. Frank F. (own) arrests at 08:28, nobody runs the code, he dies at 08:48 and is still in the room at 09:00. The report has `md.died` 1. The summary says "Your own patients who died 1". The sent stats have `mdDied: 1`. The instructor's row says "saw 3 patients (1 of them died)". A new hole sits next to it: **R5.8-03**. |
| R5.7-03 Medium: busy or full gives no code | **Still open (the fix was reverted)** | On `cbe992b` (`s1.out`), busy and full offered "Use it without results". On `32dbdae` (`s1b.out`), busy shows only **Try again**, and so does full. R3.8-01 took the button back. See **R5.8-01**. |
| R5.7-04 Medium: Forget leaves the key on the clipboard | **Partly fixed** | `s4b.py` (a): Copy key, then Forget, clears the clipboard. (b): Copy key, a reload, then Forget leaves "Code Black instructor key for class code WCK-R00: 0KEM-…", and the next user pastes it and reads the class. (c): Copy table, then Close results: the whole table (1,176 chars) stays on the clipboard. The Forget confirm says nothing about the clipboard. STATUS lists this as Fixed. |
| R5.7-05 Low: the list never compares the date with today | **Partly fixed** | `s3.py`, day 15: a planned code reads "may have ended Dec 9 (if no student sent a result): open Results to check". That part works. After a release (`s7.py`), the unused v0.31.0 code NP0-8CE reads "an older version of the game · made Nov 25" with a blue **Results** and no date. Nothing says students on v0.31.1 can't play it, and every student who types it gets "That code looks mistyped". |
| R5.7-06 Low: shared-computer note missing in the typed-key case | **Fixed** | `s4.py` (b): the note shows on the typed form when the device has no saved codes. It goes away once the list opens (`s5.py`: not under the export buttons). |
| R5.7-07 Low: a bare key pasted into the code box shows in clear | **Fixed** | `s4.py` (e): with dashes, without, lower case, or with spaces and a newline, the paste empties the code box and fills the masked key box (`disc`). The code typed after it then reads the class. |
| R5.7-08 Low: Tibetan and Malayalam chillu names refused | **Fixed** | `s2.py`: བསྟན་འཛིན, ജയന്‍ and അര്‍ജുന്‍ were typed key by key and stored as typed. `s6.py`: 93 names went through the game, the C.UTF-8 server and the en_US.UTF-8 server. The two "disagreements" (a leading BOM, an NBSP) are cleaned by the game before sending; "Mary Ann" was stored that way. A stray joiner says "Your keyboard added a hidden character", and one Backspace clears it. |
| R5.7-09 Nitpicks | **Partly fixed** | **Fixed:** "saw 1 patient"; unneeded counted when ordered (`unneeded 1` the moment Sign was tapped, `s9.py`); the Send box on an upright phone (y 445 of 857, name box at 475); Show turns off after a failed read. **Still open:** the ask still pushes the projected code from y 189 to 311 (`s1b.out`; Keep is now the main button); old codes still have no role, shift or version ("an older version of the game"). |

**Counts:** Fixed 5, Partly fixed 3, Still open 1 (reverted), Worse 0.

## 1. Verdict

**Usable in a 50-minute class when the server says yes. Usable a month later, except that a planned code can now be taken over, and the key-box fix finally holds.**

What works, end to end against the real SQL:
- **The code:** it shows 0.1–0.16 s after the tap. Stray taps do nothing, and the ask guards a projected code. An unreachable server offers "Use it without results", and Try again later registers the same code. An answer lost past 8 s comes back as the same code.
- **The students:**
  - Ten names in eight scripts were typed key by key on one iPad and stored as typed, with an empty box for each student.
  - A cut-off send, a lost answer past 8 s, and a double tap are each kept once.
  - A stray joiner gets a plain message.
  - Leaving unsent warns in view.
- **The instructor:**
  - Days 8, 15 and 25 work. "May have ended" works, and so does Turn results back on.
  - A troll at row 16 of 30 is deleted with the confirm in view. A failed delete and a refused delete each say "Nothing was deleted" in the row.
  - The CSV has a BOM, CRLF, 26 columns and blank attending columns on charge-nurse rows.
- **The attending:** own deaths, unsafe orders, chance complications and radio calls all reach the instructor correctly.
- **A release mid-course:** old results stay readable, an unsent Monday summary sends on Wednesday, and each version refuses the other's codes with the right message.
- **Regular play is unchanged:** no class calls and no Send box. Tests: `npm test` 703 ok, stress exit 0, `class_test.py` 95 ok, `db:test` 210 ok.

What is broken or fragile:
- **Busy or full (R5.8-01):** busy or full means no shared shift again. One student with a script on the campus Wi-Fi can cause busy for the hour.
- **Planned codes (R5.8-02):** the card promises that a code is "held 30 more days … so nobody else can take it". Since `32dbdae`, a code nobody sent to is deleted when it ends. I registered a lapsed planned code as a troll and read a classmate's result with my own key.
- **Abandoned codes (R5.8-03):** an attending can ignore an own patient's arrest in the last 20 minutes and nothing records it. Running that code and losing it records a death.

## 2. Score

**6/10.** Round 7's two worst items are really fixed: the key box and the missed deaths. So are the names and the Send box. But a round-8 fix took back the busy/full fix, a round-8 change made the card's privacy promise false for planned codes, and the new death count still has a gap a gamer will find.

## 3. New findings, worst first

### R5.8-01 Medium: busy or full again leaves the class with no playable code. For "full" the stated reason doesn't hold, and one student can cause "busy"
- **Where:**
  - ui.js:2037 (`${R.net ? '<button … data-act="codeNoRes">Use it without results</button>' : ''}`).
  - ui.js:2652 (`codeNoRes` refuses unless `R.net`).
  - Migration line 232 (`allow('class', 60)` counts every well-formed call, including ones answered `taken`) and line 244 (the backstop).
- **What happened (`s1b.out`, real `cb_class_new`, 1024×768 projector):**
  - **Busy:** 62 well-formed calls from the campus NAT, a few lines of script any student can run with the public key. The projector then showed "No class code yet. Your network has made too many requests … Try again in an hour (or tomorrow…)" with **Try again** only. There was no code to play.
  - **Full:** with 100,001 live classes, the projector showed "Class results are full across the whole game right now … It may take days to clear", again with **Try again** only.
  - **While full, nobody can take a shown code.** Another network registering that same code got `{"error": "full"}`, and a brand-new code also got `full`. R3.8-01's reason ("someone else could register the shown code first") can't happen while the backstop is full.
  - **On `cbe992b`** (`s1.out`), both cases offered "Use it without results", and the code played.
- **Why it matters:**
  - The class code is an offline feature: the seed is in the code. A results limit again stops 30 students from playing the same shift.
  - Busy needs no botnet. One student on the campus NAT makes it last the hour, which is the whole class. With 200 calls it lasts until UTC midnight.
  - The busy screen never mentions the obvious way out: make the code on a phone using mobile data, which is another network.
- **Fix:**
  - Offer "Use it without results" for `full`, which has the same exposure window as an unreachable server.
  - For `busy`, add "or make the code on your phone using mobile data (another network)".
  - Optionally, don't count `taken` answers against the hourly class limit.
- **Effort:** XS.

### R5.8-02 Medium: the card, README, supabase/README and CLAUDE.md promise a held code "so nobody else can take it". A planned code nobody sent to is deleted at day 14, and a student can take it and receive classmates' results
- **Where:**
  - The promise: ui.js:2149 ("Results are deleted on Dec 9 if no student sends one, or on Dec 25 once one does. The code is then held 30 more days with only its key's hash, so nobody else can take it."). It is repeated in README.md:55, supabase/README.md:36 and CLAUDE.md:141.
  - The behaviour: migration lines 18–21 ("An unused class goes when it ends (R3.8-02)") and `tidy()` line 209. `cb_class_new` does the same clean-up.
- **What happened:**
  - **In the browser (`s3.py`, rerun on `32dbdae`):**
    1. The instructor makes Manic Monday code 3JV-R8F on Nov 25 for a lesson two weeks out. The card shows the promise above.
    2. On day 15 the server has no row for it.
    3. A student's phone (IPv6) calls `cb_class_new('3JV-R8F', 'TTTTTTTTTTTTTTTT', '0.31.0')` and gets `{"ok": true}`.
    4. The instructor's row reads "may have ended", then "class ended". Turn results back on gives "Another class has 3JV-R8F on the server now. Forget it and make a new code."
  - **The takeover, end to end, real SQL:**
    1. Code 26A-888 is registered on day 0 and moved to day 15; `tidy()` deletes it.
    2. A troll registers it (ok).
    3. On class day, a classmate sends "Priya", 71/100 (ok).
    4. `cb_class_read('26A-888', troll key)` returns `{"rows": [{"name": "Priya", "score": 71, …`.
    5. The instructor's key then gets `{"error": "taken"}`.
- **Why it matters:**
  - A planned code is exactly the one posted ahead in a syllabus or LMS, so students know it.
  - The UI told the instructor this can't happen, the very promise R2.8-01 asked for. Then R3.8-02 made it untrue, and nobody updated the wording.
  - The instructor finds out only by tapping Results or Turn results back on. If they just project the code, the class sends to a stranger.
- **Fix:**
  - **Either** hold unused codes too: the key hash only, no data, kept out of the backstop.
  - **Or** make the words true: "If no student sends a result by Dec 9, the code is released and anyone could register it: make a new code for a later lesson." The row past that date should say "released: make a new code" instead of offering Turn results back on.
  - Correct the three docs either way.
- **Effort:** S.

### R5.8-03 Medium: an attending's own patient left in an unrun arrest at the end of the shift is recorded nowhere, while running that code and losing it records a death
- **Where:**
  - `arrestNoTeam`, engine.js:2297–2315: nothing happens until 20 minutes have passed.
  - `endShift`, engine.js:4423: it counts only `family`/`morgue`/`morguing`.
  - The failed code, engine.js:2268–2270: `dsp = 'family'` plus an M&M line.
- **What happened (`s9.py`, attending Rush on class code 7MT-825, real `cb_submit`):**
  - Jamal L., the student's own patient, arrests at 08:52 through `OC.toArrest`, the engine's own path. Nobody taps Run the code.
  - At 09:00 he is still `arrest: true`.
  - The report has `md.died` 1 (Frank only). The M&M's three worst moments don't name Jamal, and no line of the summary mentions him.
  - The sent stats have `mdDied: 1`, and the instructor's row reads "saw 3 patients (1 of them died)".
- **Why it matters:**
  - In the last 20 minutes of any shift (a sixth of a Five-Minute Rush), ignoring "Run the code" costs nothing. Running it risks "died after a …" in the M&M and an own death sent to the instructor.
  - That breaks the game's own rule "never cheaper than running it" (the R5.2-01 comment at engine.js:2311), at the end of exactly the shifts a class plays.
  - It's the same end-of-shift blind spot R5.7-02 was about, one step earlier.
- **Fix:**
  - At `endShift`, find the attending's own patients with `p.arrest` and no code running.
  - Add an M&M line: "X was in cardiac arrest when the shift ended and nobody was running the code".
  - Apply the no-team penalty and the litigation step.
  - Count them in what is sent: add them to `mdDied`, or add a new key such as `mdArrestOpen`.
  - Add a rules13 case with an arrest at minute 112 of a Rush.
- **Effort:** S.

### R5.8-04 Low: a used class's code disappears from the instructor's device the moment the class ends; the hold's "its own key turns it back on" can't be reached from the game, and a month later there is no trace
- **Where:**
  - ui.js:2109: a key is kept while `t + CB_LIFE > Date.now()`, where `t` is the server's created time.
  - The server's used class ends at `created_at + 30 days`, the same instant.
  - The typed-key form only reads (`cb_class_read`), which answers `key` for an ended class.
- **What happened (`s3.py`):**
  - On day 25, B23-815 reads "results until Dec 25".
  - On day 31 it is "(not listed)", with no "class ended" row and no Turn results back on.
  - The server still holds the code for that key: another key gets `{"error": "taken"}`. On day 61 it is free.
- **Why it matters:**
  - An instructor who reruns the same shift for a second section a month later can't get results on the same code, though the server keeps it for exactly that.
  - Anyone looking for last month's class finds nothing at all, rather than "class ended, results deleted Dec 25".
- **Fix:**
  - Keep the device key through the hold (60 days).
  - Show "class ended · results deleted on Dec 25" with Turn results back on.
- **Effort:** S.

### R5.8-05 Low: the attending verdict says "The numbers were good" when the attending's own patient died with no code run
- **Where:** `reportHTML`, ui.js:3036. The condition is `R.stars >= 2 && !(R.mode === 'md' && R.md && !R.md.seen)`. It ignores `R.md.died`, `contra` and `unneeded`.
- **What happened (`s9.py`, `s9-report.txt`):**
  - The shift: an own patient died with nobody running the code; another was still in an unrun arrest; the student ordered ibuprofen for an NSTEMI and an insulin drip nobody needed, and missed aspirin and heparin; 0 of 6 radio calls were answered.
  - The verdict: "1 patient died in the department. The numbers were good; read the worst moments below."
- **Fix:** when `R.mode === 'md' && (R.md.died || R.md.contra)`, use `verdictOf(R)` or say "Your own patient died: read the worst moments below."
- **Effort:** XS.

### R5.8-06 Low: Results opens a projected screen's view of every student's name and score, with no caution, though the same form masks the key "for a projected screen"
- **Where:** cbListHTML (ui.js:2187). Show results and a row's Results draw the full list with no warning.
- **What happened (`s5.py` on the PC):** the 30 names, scores and stars appear on the same screen whose key box says "(hidden as you type, for a projected screen)".
- **Why it matters:** the form plainly expects projection. A class sees who scored 34/100.
- **Fix:** add one line by Show results and the row's Results button: "Shows every student's name and score: not on a projected screen."
- **Effort:** XS.

### R5.8-07 Low: real names still refused on both sides
- **Where:** `cbClean` / `CB_NAME` (ui.js) and `codeblack.clean_name`. They agree, so the student just gets a refusal (`s6.py`).
- **Refused:**
  - Taiwanese and Chinese transliterated names written with **U+2027** ‧, the Big5 middle dot used for Taiwanese indigenous names: 米高‧佐敦, and 巴奈‧庫穗 in the same form.
  - The same names with U+2022 •, U+2219 ∙ and full-width ．
  - The Hebrew maqaf **U+05BE** (בן־גוריון).
  - Bengali **র‍্য** (ZWJ before the virama, as in র‍্যাচেল). Its message blames the keyboard ("Your keyboard added a hidden character"), and the same keyboard adds it again.
- **Fix:**
  - Treat U+2027, U+2022 and U+2219 as the middle dot (normalise them to U+00B7), and U+05BE as a hyphen.
  - Allow a ZWJ before a virama in Bengali.
  - Make the change in both rules and in `client_call.json`.
- **Effort:** S.

### R5.8-08 Low: the round-7 STATUS overclaims for three of my items
- **R5.7-04** is listed as Fixed. The fix lasts one page load (`s4b.py` (b)). Copy table was never addressed (`s4b.py` (c)). Neither limit is listed under "Partly fixed".
- **R5.7-05** is listed as fixed ("may have ended"). A planned code made before a release still shows **Results** and no date, with nothing saying it can't be played (`s7.py`).
- **R5.7-03** is listed as Fixed ("offered for any failure"). That was true at `87c9c13` and is false at `32dbdae` (R5.8-01). The round-8 STATUS must say the fix was reverted, and why.
- **Fix:** correct the STATUS entries. The round-8 STATUS should carry R5.7-04's remaining half (Copy table, reload) explicitly.
- **Effort:** XS.

### R5.8-09 Nitpick: small things
- **The ask still moves the projected code:** on a 1024×768 projector it jumps from y 189–233 to 311–355 when a stray level tap asks (`s1b.out`).
- **Old codes still have no description:** they read "an older version of the game", without the role, the shift or which version, although `readCode` returns all three for stale codes.
- **A refused delete at the class's end:** it says "That key no longer opens this class", a puzzling sentence a second after the key opened it, and the saved row still says "results until Dec 25". The read path marks the class ended; the delete path doesn't.
- **After "taken":** a row answered "Another class has 3JV-R8F … Forget it and make a new code" still offers **Turn results back on**, which only says the same again (`s3.py`, day 25).
- **The Send box on a sideways phone:** that's how the game is played, and there the box starts at y 412 of 390, below the first screen. The four score cards wrap three and one, leaving half a row empty (`13-land-report-top.png`).
- **The shown key on a phone:** the 16-character key needs 249 px in a 225-px text area, so its last character is cut off while the instructor checks it (`30-phone-keybox.png`). With dashes it's worse.
- **"Tomorrow" in the busy message:** it means UTC midnight, which is 7 pm in New York and 4 pm in Los Angeles.
- **Zalgo names pass:** Z̴a̵l̶g̷o̸ passes both rules and sits in the instructor's list (row 17 in `s5.py`).
- **Regular play:** at 390 px upright, the title page is 393 px wide. The HUD's Staff pill and the provider dock behind it stick out, so the page pans 3 px sideways.

**Counts:** Critical 0, High 0, Medium 3, Low 5, Nitpick 1 (9 total).

## 4. Coverage

**Instructor (real taps, real SQL, `32dbdae` unless noted):**
- **Making codes on a 1024×768 projector (`s1.py`):**
  - A fast network; the ask, with Escape and four stray taps; a slow answer held 2.5 s with the level buttons disabled.
  - Busy (62 calls from the NAT): no code. Full (100,001 live classes): no code; another network refused `full` for that code and for a fresh one.
  - Unreachable, then "Use it without results", then Try again online: the same code. An answer lost past 8 s, then Try again: the same code. A reload, then the saved list.
  - The same run on `cbe992b` for comparison (`s1.out`).
- **Finding the key later (`s3.py`, both builds):**
  - Days 0, 8, 15, 25, 31 and 61 on the classroom PC, with a used class (6 results) and a planned one.
  - "May have ended", then Results, then "class ended", then Turn results back on, then "taken" after a student registered the lapsed planned code.
  - The 30-day hold: another key is refused on day 31 and accepted on day 61. The takeover of a lapsed planned code was checked end to end in SQL.
- **The classroom PC (`s4.py`, `s4b.py`):**
  - The key box at five sizes, masked, with Show.
  - A failed read: Show turns off, and nothing is left for the next user. A typed read with Remember off: nothing kept after reopening.
  - Copy key then Forget, in the same page and across a reload. Copy table then Close results, with the clipboard read back.
- **Paste on a phone:** Copy key's line into either box. A bare key in four forms into the code box.
- **Results (`s5.py`):**
  - 30 results: 17 typed on the iPad, 13 from IPv6 phones, including an attending and a fired shift. Read on a phone.
  - Deleted the troll. A failed delete (network). A refused delete (the class ended under the open list). Delete all's confirm.
  - Copy table (32 lines, 26 columns). Download CSV (BOM, CRLF, parsed).

**Students:**
- **One iPad on the NAT (`s2.py`, both builds):**
  - The code typed in lower case, then Enter.
  - Ten names typed key by key: Persian with ZWNJ, Sinhala with ZWJ, two Malayalam chillu names, Tibetan, Japanese, Chinese with the middle dot, Hebrew with geresh, Vietnamese, and an NBSP name.
  - A Latin name with a stray ZWJ.
  - A cut-off send, a lost answer past 8 s, a double tap: one row each.
  - Seven trolls (three sent, four refused). Leaving unsent, and the device handed on.
- **Names (`s6.py`):** 93 names through the game and both server locales. All agree except two that the game cleans before sending.

**Attending (`s9.py`, sideways phone, class code, real `cb_submit`):**
- A contraindicated drug and an unneeded insulin drip, tapped in the order sheet.
- An own arrest at 08:28 that nobody ran, and another at 08:52.
- Radio calls rang out.
- The summary, the sent stats, the instructor's row and the CSV.

**A release mid-course (`s7.py`):**
- v0.31.1 with v0.31.0's storage: the list, Results on an old used code and an old planned code, and an old "no results" code.
- An unsent Monday summary sent on Wednesday. Each version typing the other's code.

**Regular play:**
- `s10.py`: a Quiet Tuesday as charge nurse and an attending Rush without a code. No RPC calls, no Send box, and Menu leaves in one tap.
- `npm test`: 703 ok, golden unchanged (on `cbe992b`; `engine.js` is unchanged at `32dbdae`).
- `npm run stress`: exit 0. `class_test.py`: 95 ok. `supabase/tests/run.sh`: 210 ok, all passed. The last two ran on `32dbdae`.

**Not covered:**
- Real Safari and Firefox, a real campus NAT, the live project, the 3D floor and the gate.
- A full 30-minute shift played entirely by hand. Arrests were started through `OC.toArrest`, the engine's own path, not by waiting for one.

## 5. What I'd keep

- **The key box:** it finally has room on every screen, and a key pasted into the wrong box goes to the masked one.
- **A code appears only when it's real:** stray taps are dead, an ask guards the projected code, and Keep is the main button.
- **"May have ended":** Results, then "class ended", then Turn results back on, all in the code's own row, without touching the code on screen.
- **The name rule:** Tibetan, Malayalam chillus, Persian, Sinhala, Japanese and Hebrew names all pass, and both sides agree on every name tried. A hidden character gets a sentence that tells the student what happened.
- **The attending's numbers:** own deaths (including bodies still in the room), unsafe orders counted when signed, and "complications, partly chance".
- **The Send box:** at the top of an upright phone's summary, with the name box first. Leaving unsent scrolls the warning into view.
- **Deletes:** the confirm and every error sit in the row under the finger.
- **A release mid-course:** old results stay readable, and old summaries still send.
- **Regular play is untouched.**
