# Reviewer 6, round 5: clinical accuracy and medical education

Role: board-certified emergency physician and paramedic educator. Branch `claude/sleepy-rubin-jot35n`, v0.31.0, HEAD 7cb5613. The round-4 fixes are `git diff ce11887..46a0b03`. Reviewed 2026-11-24.

**Not re-reported:** items that `docs/audit/round2/STATUS.md`, `round3/STATUS.md` and `round4/STATUS.md` defer, move or leave to the owner, unless the fix made them worse. The attending's scoring (R6.4-01, R6.4-09) is the owner's Phase 6 decision. I judge only what the class list now shows about it.

**Scripts and screenshots** are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round5/r6/`.

**Node scripts** (each runs the real engine through whole shifts):

| Script | What it plays |
|---|---|
| `s1.js` | Manic Monday and Full Moon Friday attending shifts on the same seeds: perfect (`mdPlay` at accuracy 1.0), poor (0.3, fired), radio calls only (sees no patient), and idle. Charge nurse shifts: full, slow and idle. It builds the exact payload the game sends (a copy of `cbArgs`) and counts whose patients died. Output: `s1.out`, `rows.json`. |
| `s2.js` | A charge nurse shift that ends with the staff walking out. Morale is forced down at 12:00, and the engine's own check ends the shift. |

**Playwright scripts** (Chrome, 390×844). `fetch` is replaced in the page and every non-file request is aborted. Every `leaked` list is empty.

| Script | What it shows |
|---|---|
| `ui1.py` | Make an attending code; play it answering radio calls only; the summary and the Send box; the payload. Then the instructor's list fed with `rows.json` and the real payload, Copy table, a charge nurse list, and Lessons. |
| `ui2.py` | The About page as a first visitor sees it |
| `ui3.py` | Register a code (7-day expiry), a result arrives (30 days), open Results, then move the device clock 8 days on |
| `ui4.py` | A shared device in one tab: student A sends as "Sam", the next student taps Run it back and finishes |

Screenshots are in `shots/`.

## 0. Did any clinical content change in the round-4 fixes?

**No.** The evidence:

- **Clinical files are byte-identical at `ce11887` and `46a0b03`.** `git rev-parse` gives the same blob for:
  - `src/engine.js` (`dfbf2ad4…`)
  - `src/map.js`, `src3d/map3d.js`
  - `test/rules10.js`, `rules11.js`, `rules12.js`, `test/golden.js`
  - `test/golden.json` (`680c949e…`)
- **So the diff the brief names is empty.** `git diff ce11887..46a0b03 -- src/engine.js test/golden.json` prints nothing.
- **The ui.js hunks avoid the clinical text.** They are at:
  - 2006–2170: the class code sheet, class results and the Send box
  - 2524–2607: the class-code `ACT` actions
  - 2712: `menu` and `again` ask before you leave an unsent summary
  - 2798: About
  - 2837: `lastReport`, `saveRep`, `unsentGuard`, `realTxt`
  - 2941: `showReport`
  - 2989: `bind`

  `GLOSS`, `LESSONS`, the orders, the cards, Orientation, the M&M lines and the report's clinical tables are untouched.
- **The only clinical-adjacent text added** is the disclaimer:
  - About: "It was written with AI, and **no licensed clinician has reviewed its clinical content yet**."
  - Lessons: "Written with AI: **no licensed clinician has reviewed them yet**."
  - Both are accurate (CLAUDE.md: "No licensed clinician has reviewed this content yet").
- **The tests pass.** `npm test` ran to the end this time: exit 0, **694 "ok" lines, 0 FAIL**. The run includes "golden: 13 shifts, 3 stream checks, 20 codes, save round trip, **71 answer keys unchanged**", 26 of 40 pulses back in the scripted codes, and the save and stream checks. `test/class_test.py` gives 60 ok and exit 0.
- **Payload changes.** `cbArgs` (ui.js:2135) now adds `fired`, `fast`, `dxRight` and `dxWrong` to `p_stats`, and sends `R.ver`. `p_score` is unchanged (`Math.round(+R.avg || 0)`, clamped to 0–100).

### Round-4 status

| ID | Status | Evidence |
|---|---|---|
| R6.4-01 attending score | **Still open (owner, Phase 6).** Phase 2's presentation only partly helps. | Measured again: a radio-only attending scores 93–94 ★★★ and the list ranks them **#1, above the perfect attending (92, 34 of 34 diagnoses)**. Fired attendings (83, 86 ☆☆☆) rank above idle ones (73, 74 ★★☆). See R6.5-01. |
| R6.4-02 clinician disclaimer | **Partly fixed** | Now in About, Lessons and README. It is absent from the instructor's class flow, the summary and its printout. About shows once. See R6.5-08. |
| R6.4-03 nothing clinical reaches the instructor | **Partly fixed** | Deaths, diagnoses and "fired" now show. An attending's deaths are the whole department's, unlabelled (R6.5-04). The attending's own work (patients seen, harm, radio calls) isn't sent (R6.5-07). |
| R6.4-04 shared device name | **Partly fixed** | Not stored any more, but kept in memory (`U.cbName`) and pre-filled for the next student in the same tab. One tap sent "Sam" again (`ui4.py`). See R6.5-05. |
| R6.4-05 privacy wording | **Partly fixed** | About and the Send box are right now. The instructor box still says "Only the instructor … can see" (R6.5-09). "Patients seen" still means arrivals (R6.5-10). |
| R6.4-06 sent number not on the student's screen | **Partly fixed** | The Send box shows "87/100 · ★★★ · N min played". It doesn't say it's the average of the four cards. "A few shift numbers" hides deaths, "fired" and diagnoses (R6.5-11). |
| R6.4-07 repeats and impersonation | **Partly fixed** | "Not for grading" was added, and the CSV has "Sent (UTC)". The list shows no time, doesn't mark a repeated name, and doesn't say "as often as they like" (R6.5-12). |
| R6.4-08 attending's wait and LWBS | **Fixed** | "dept. wait", and the caveat names wait and walkouts. Deaths were left out (R6.5-04). |
| R6.4-09 the computer's dispositions credited | **Still open (owner)** | The radio-only summary still shows "Disposition calls +24" with 0 patients seen (`shots/c-radio-send-box.png`). |
| R6.4-10 key lost, no deletion route | **Worse** | The contact waits for the owner. The key panel now warns "A lost key can't be recovered". But the rewrite makes **every device drop its saved key on day 7 while the results live to day 30** (R6.5-02). |
| R6.4-11 "Scores are self-reported" in the student box | **Fixed** | |
| R6.4-12 README claims | **Fixed** | The three named claims are corrected. New overclaims are in R6.5-14. |
| R6.4-13 table polish | **Partly fixed** | The MD badge is gone, LWBS is glossed and minutes show on a phone. Rows are still numbered as ranks. |
| R6.4-14 speed not sent | **Fixed** | `fast` is sent, shown as "(N% sped up)" and exported. |

`round4/STATUS.md` lists R6.4-02 to -08 as **Fixed**. Six of those seven are only partly fixed.

## 1. Verdict for use with real students

**Clinical content: still "only after major work"**, unchanged. The engine is the same bytes round 3 and round 4 scored.

**Class results:**

- **Charge nurse:** usable to start a debrief, not for grades. Two labels are wrong:
  - a shift that ended with the staff walking out is listed as **"fired"**;
  - "walked out" means patients who left unseen, in a game whose failure screen is "The staff walked out".
- **Attending: still not usable for any comparison.**
  - The list numbers the rows as ranks. Copy table and CSV export a **"Rank"** column.
  - The list puts a student who saw **no patient** first, above a student who made 34 of 34 diagnoses.
  - "4 died" sits next to a student who saw nobody.
  - The only caveat for attendings names the wait and the walkouts. It doesn't name the score, the stars or the deaths, which are just as much the computer's.

**New defect:** an instructor who opens results more than a week after making the code finds the code gone from the device, while its results live 3 more weeks. They can't read them or delete them without a key they may never have copied.

## 2. Score

**4 / 10.** Unchanged.

- The clinical content is unchanged.
- The class list is more honest than round 4's table: deaths, diagnoses, firing, sped-up play and "Not for grading" now show.
- That is offset by:
  - a ranked list and export built on a number the screen still doesn't say is mostly the computer's;
  - a "fired" label applied to charge nurses;
  - department deaths shown against an attending's name;
  - a 7-day key regression.

## 3. Findings, worst first

### High

**R6.5-01 · High · The class list and its export still rank attendings by a number the screen never says is mostly the computer's: a student who saw no patient is #1**

- **Location:**
  - `cb_class_read` returns rows `order by r.score desc` (migration 20261124120000, line 303).
  - `cbListHTML` numbers them `${i + 1}.` (ui.js:2121).
  - `cbTable` exports a `'Rank'` column (2131).
  - The caveat (2119): "For an attending, the wait and walkouts are the whole department's, run by the computer charge nurse."
- **What's wrong (verified, `s1.js` and `ui1.py`, `shots/e-instructor-list-md-rows.png`).** Manic Monday, the list as an instructor sees it:

  | Row | Score | Stars | Detail line |
  |---|---|---|---|
  | **1. Radio** (sees no patient, answers radio calls) | **94/100** | ★★★ | diagnoses **0 right, 0 wrong** · dept. wait 22 min · 0 walked out · 0 died |
  | 2. Perf B (perfect) | 93/100 | ★★★ | diagnoses 29 right, 0 wrong |
  | 3. Radio B | 93/100 | ★★★ | diagnoses 0 right, 0 wrong |
  | **4. Perfect** | **92/100** | ★★★ | diagnoses **34 right, 0 wrong** |
  | 5. Rad (the radio-only shift played in the browser) | 87/100 | ★★★ | diagnoses 0 right, 0 wrong · **4 died** |
  | **6. Poor B** | **86/100** | ☆☆☆ | diagnoses 13 right, 13 wrong · **fired** |
  | 7. Poor | 83/100 | ☆☆☆ | diagnoses 3 right, 11 wrong · fired |
  | 8. Idle | 74/100 | ★★☆ | diagnoses 0 right, 0 wrong |

  - **Copy table exports the same order** as `Rank 1 Radio Attending 94 3 …`.
  - **The caveat explains the wrong numbers.** It tells the instructor which numbers are the department's (wait and walkouts). By omission it implies the rest are the student's. But in MD mode:
    - Patients, Admin and Staff, three of the four scores averaged into "Score (0-100)", are produced by the computer (`scores()` and `care()`, engine.js:832–842).
    - So are the deaths (R6.5-04).
  - **The fired student contradicts themselves on one row.** "86/100 ☆☆☆" puts a high score next to zero stars, with no explanation.
  - **The README says the opposite.** "Without a code … scores are for discussion, not for ranking". The screen ranks them with a code.
- **Standard:** INACSL *Evaluation of Learning and Performance*: a measure that isn't valid for a construct must not be presented as if it were. A numbered list sorted by score, with an exported "Rank", is a league table whatever the label above it says.
- **Fix (presentation only; the scoring stays the owner's Phase 6 call):**
  - **No ranks.** Drop the `i + 1.` numbering and the CSV `Rank` column.
  - **Sort neutrally.** Sort by time sent (or name) in `cbListHTML`, or change `order by` to `r.created_at`. Either way, shifts that ended early go last.
  - **Replace the attending caveat** with: "For an attending, the score and stars are mostly the department's, which the computer runs: three of the four scores (patients, admin, staff) don't depend on the student. Their own work is the diagnoses. The wait, walkouts and deaths are the whole department's."
  - **Show 0 stars with no score.** For an `md` row with `dxR + dxW === 0`, show "saw no patients to diagnose" in place of the score.
  - **Test.** `class_test.py` asserts no rank number and the new caveat on an attending code.
- **Effort:** S

**R6.5-02 · High · Every device forgets an instructor key on day 7, while the class's results live to day 30: the debrief list vanishes, and "ask your instructor" can no longer delete a student's result**

- **Location:**
  - `cbRegister` saves the key with `exp: now + 7 days`, then `r.expires` from `cb_class_new` (ui.js:2068–2073). That is also 7 days: the migration's `expires_at default now() + interval '7 days'`, line 53.
  - The first result moves the server's expiry to `created_at + 30 days` (migration lines 283–284).
  - `cbShow` updates the saved expiry only for a **typed** key: `if (!a && rem) cbKeySave(…)` (ui.js:2573).
  - `cbKeys` drops any entry past its `exp` (2057).
- **What's wrong (verified, `ui3.py`, `shots/i-day8-keys.png`):**
  - **Day 0.** Make a code, a result arrives, open Results. The same screen says "2AC-8BJ … **until Dec 1**" in the saved-codes list and "**deleted on Dec 24**" in the results header. `oc-ckeys` still holds `exp: 2026-12-01`.
  - **Day 8.** With the device clock moved 8 days on, Class results shows only "Open with an instructor key". The code is gone from the list. Its results are on the server until Dec 24.
  - **The two predictable cases both break:**
    - a class that plays during the week and debriefs at the next weekly session;
    - a student who asks the instructor to delete their result after a week.

    Both now need a key the instructor was only advised to "copy somewhere safe".
  - **This is a regression from the round-4 fixes.** In round 4, `cb_class_new` gave 30 days (`default now() + interval '30 days'`), so the saved key lived as long as the class.
- **Standard:**
  - The class result is the debrief record.
  - The About page promises "To have yours deleted sooner, ask your instructor: they can delete any result". That promise must hold for the whole 30 days it states.
- **Fix:**
  - **Keep the expiry current.** In `ACT.cbShow`, after a successful read, update the saved expiry whenever the code is already saved: `if (cbKeys()[code] || (!a && rem)) cbKeySave(code, { k: key, exp: r.expires, t: (cbKeys()[code] || {}).t || Date.now() })`.
  - **Never drop a key early.** Save keys with `exp = made + 30 days`, the longest a class can live, and let a read of an ended class say so.
  - **Test.** `class_test.py`: register (7 days), read (30 days) → the saved `exp` is 30 days. With the clock 8 days on, the code is still listed.
- **Effort:** S

### Medium

**R6.5-03 · Medium · A charge nurse whose staff walked out is listed, exported and described as "fired", and "walked out" means something else on the same line**

- **Location:**
  - `cbArgs` sends `fired: R.fail ? 1 : 0` (ui.js:2139).
  - `R.fail` is `'walkout'` for the charge nurse (engine.js:3669) and `'fired'` only for the attending (engine.js:550 and 959).
  - `cbRow` → "· **fired**". `cbTable` → "Fired: yes".
  - About (2803): "whether you were fired".
  - `test/class_test.py:139` and `:169` assert "fired" on a `role: 'rn'` row, so the test enshrines the mislabel.
- **What's wrong (verified, `s2.js`):**
  - The charge nurse shift ends `fail walkout` at game minute 301 and sends `fired = 1`.
  - The list then reads, for example, "47/100 ☆☆☆ · 12 min played · wait 8 min · 6 walked out · 0 died · **fired**" (`shots/f-instructor-list-rn.png`).
  - An instructor reads it as "6 staff walked out and the nurse was fired". In fact 6 patients left without being seen, and the staff walked out. Nobody fired the charge nurse.
  - The student's own summary says "The staff walked out". The instructor's record of the same shift says something different.
- **Standard:** An assessment record must name the event that happened. "Fired" next to a learner's name is a serious label.
- **Fix:**
  - **Label by role.** In `cbRow`, show `r.md ? 'fired' : 'staff walked out'`.
  - **Export.** Rename the CSV column "Ended early", with values "fired (legal risk)" or "staff walked out".
  - **Rename the patient count.** "walked out" becomes "left unseen" on screen and in the CSV.
  - **About text:** "whether the shift ended early (fired, or the staff walked out)".
  - **Test.** Change the `class_test.py` expectation for the `rn` row.
- **Effort:** S

**R6.5-04 · Medium · An attending's "N died" is every death in the department, including other doctors' patients, and the caveat leaves deaths out**

- **Location:**
  - `R.expired` is department-wide (engine.js:4403).
  - `cbRow` → "· N died", with no "dept." prefix (ui.js:2122).
  - The caveat (2119) names only the wait and the walkouts.
- **What's wrong (verified):**
  - The browser radio-only attending saw 0 patients (`R.md.seen = 0`) and sent `expired: 4`.
  - The list shows "5. Rad 87/100 ★★★ · diagnoses 0 right, 0 wrong · dept. wait 33 min · 0 walked out · **4 died**".
  - None of the four were the student's patients. On Full Moon Friday (`s1.js`) the radio-only and idle attendings each carry "1 died", and the student's own count is 0.
  - In an EM debrief, deaths are the first thing discussed. Here they are attributed to a student who had no part in them.
- **Standard:** INACSL *The Debriefing Process*: performance data must be attributable to the learner it is shown for.
- **Fix:**
  - **Now:** for `md` rows, write "dept.: 0 left unseen, 4 died", and add "and deaths" to the caveat.
  - **Better:** send `mdDied`, deaths among patients with `p.mine`, and show it as "your patients: 0 died". This is a new stats key (see R6.5-07).
- **Effort:** S (label) / S (new key, before the migration is applied)

**R6.5-05 · Medium · On a shared device the next student's Send box is still pre-filled with the previous student's name, and one tap sends it**

- **Location:**
  - `bind`: `U.cbName = el.value` (ui.js:2994).
  - `cbSendHTML`: `value="${esc(U.cbName || '')}"` (2153).
  - `U.cbName` is never cleared, not after a send and not by `start()`.
- **What's wrong (verified, `ui4.py`, `shots/j-shared-device-prefill.png`):**
  1. Student A finishes a class shift and sends as "Sam".
  2. The tablet passes on. The next student taps **Run it back** and finishes. The name box reads "Sam".
  3. One tap on Send submitted `p_name: "Sam"` again, with a new result id.
  - The instructor sees two "Sam" rows and no "B".
  - The round-4 fix stopped the name being *stored*. It didn't stop the name being *offered*, which was the harm R6.4-04 described.
- **Standard:** Integrity of learner records on shared classroom hardware.
- **Fix:**
  - Set `U.cbName = ''` after a successful send, and in `start()` and `showReport()`.
  - **Test.** `class_test.py`: send as Sam, Run it back, finish; the name box is empty.
- **Effort:** S

**R6.5-06 · Medium · Copy table and Download CSV drop every caveat: the spreadsheet is a ranked gradebook**

- **Location:** `cbTable` (ui.js:2130–2133).
- **What's wrong (verified: `table_md` in `ui1.json`):**
  - The header row is `Rank, Name, Role, Score (0-100), Stars, Minutes played, Sped up %, Diagnoses right, Diagnoses wrong, Avg wait (min), Walked out, Died, Fired, Version, Sent (UTC)`.
  - No "Not for grading" note.
  - No "dept." on the attending's wait, walkouts or deaths.
  - "Fired" for charge nurses (R6.5-03).
  - Once pasted into a spreadsheet, the only context the instructor had is gone. The spreadsheet is the artifact that reaches a gradebook.
- **Standard:** An exported assessment record must carry its own validity limits.
- **Fix:**
  - **A note above the header** (a first line, or a "Note" column on every row): "Not for grading. Self-reported; anyone with the code can send under any name, as often as they like. Attending: score, stars, wait, walkouts and deaths are mostly the department's, which the computer runs. No licensed clinician has reviewed the clinical content yet."
  - **Drop `Rank`** (R6.5-01).
  - **Name the attending's columns** "Dept. avg wait", "Dept. left unseen" and "Dept. deaths".
- **Effort:** S

**R6.5-07 · Medium · The attending's row leaves out the student's own clinical work: patients seen, patients harmed, radio calls**

- **Location:**
  - `cbArgs` (ui.js:2135–2141) sends `dxRight` and `dxWrong` only.
  - `R.md.seen`, `R.md.harm`, `R.md.untreated` and `R.boxC` are on the report (engine.js:4409, 4420) and shown on the student's own summary ("Patients you saw 0", "Patients hurt by an order", "Medical direction calls right 19 of 19").
- **What's wrong:**
  - **"Diagnoses 0 right, 0 wrong" is ambiguous.** It can't tell apart:
    - a student who saw nobody;
    - one who saw only patients with no diagnosis question (`NODX`: unstable trauma, lacerations, refills, behavioral);
    - one whose patients still had results pending at 19:00.
  - **Harm isn't sent.** Patients hurt by a contraindicated order are the attending's most important safety outcome after deaths.
  - **Medical direction isn't sent.** It is the attending's EMS radio calls, the objective a paramedic program would run this game for, and it is invisible to the instructor.
  - **This is the unfixed half of R6.4-03.** STATUS lists R6.4-03 as fixed.
  - **Now is the cheap time.** The migration isn't applied yet, so adding keys costs no extra approval.
- **Standard:** INACSL *The Debriefing Process*: the debrief data must map to the learning objectives. For the attending role those are seeing patients, diagnosing, not harming, and medical direction.
- **Fix:**
  - **Add the stats:** `mdSeen`, `harm`, `untreated`, `radioRight` and `radioAll`, plus `mdDied` (R6.5-04).
  - **Change these together:** `cbArgs`, `client_call.json`, the `clean_stats` whitelist (migration line 184) and `privacy_test.sql`.
  - **Show them first on `md` rows:** "saw 0 patients · 0 of 0 diagnoses · 0 harmed · radio 19 of 19".
- **Effort:** S–M

**R6.5-08 · Medium · The clinician-review disclaimer isn't where the results are made, read or exported**

- **Location:**
  - The disclaimer appears only in About (ui.js:2801), the Lessons header (2172) and README (not published: `pages.yml` requires README to 404).
  - About shows once, on first visit (`oc-seen-about`, 2811). Automated browsers skip it.
- **What's wrong:**
  - **The instructor's flow never says it.** That flow is the "Make one (instructors)" box, the "Class results are on" key panel, the results list, the "Not for grading" note and the CSV (`make_box` and `list_md` in `ui1.json`).
  - **The student never sees it after a scored shift.** The summary, which states "Right answer: …" for radio calls and "It was **X**" for diagnoses, doesn't say it. Neither does its "Print or save as PDF" page, which a student may hand in.
  - **Returning users miss it.** Anyone who dismissed About before v0.31, including every current tester, never sees the new sentence unless they reopen About.
  - **No test covers Lessons.** `class_test.py:215` checks the About line only.
- **Standard:** INACSL *Simulation Design* and *Facilitation*. Facilitators must know the content's validation status at the point they use it for assessment.
- **Fix:**
  - **Add one sentence** to the "Not for grading" note, the "Make one (instructors)" box, the CSV note (R6.5-06) and the printed summary: "No licensed clinician has reviewed the clinical content yet."
  - **Test.** Add a `class_test.py` (or `about_test.py`) check for the Lessons line.
- **Effort:** S

### Low

**R6.5-09 · Low · The instructor box still says "Only the instructor who made a code can see what students send"**

- **Location:** `cbListHTML`, ui.js:2103.
- **What's wrong:**
  - About now says "the developer can also see the database". The Send box says "Only they, and the game's developer who runs the database".
  - The instructor, who is the person students and parents will ask, reads the old, false sentence.
- **Fix:** "Only you, with the code's instructor key, can open them in the game. The game's developer, who runs the database, can also see them."
- **Effort:** S

**R6.5-10 · Low · About still calls the arrivals count "patients seen"**

- **Location:** About (ui.js:2803): "average wait, walkouts, patients seen, …".
- **What's wrong:**
  - `seen` is `R.seen`, every arrival in the department.
  - The radio-only attending who saw 0 patients sent `seen: 113` (`ui1.json`).
  - R6.4-05 gave the exact fix, "how many patients arrived". It wasn't applied.
  - "Walkouts" is unglossed, and collides with the staff walkout (R6.5-03).
- **Fix:** "how many patients arrived, left without being seen, left against advice, died, or were bedded before registration".
- **Effort:** S

**R6.5-11 · Low · The Send box shows the score but not what it is, and "a few shift numbers" hides what goes out under the student's name**

- **Location:** `cbWhat` and `cbSendHTML` (ui.js:2144–2151).
- **What's wrong (`shots/c-radio-send-box.png`):**
  - The box says "Sends **87/100 · ★★★ · 0 min played**, a few shift numbers and your first name or initials".
  - Nothing says 87 is the average of the four cards above it: 85, 100, 80 and 81.
  - Nothing says "4 died", "fired" or the diagnosis count go to the instructor beside the name.
  - The student summary still has no "/100" anywhere else.
- **Fix:** "Sends: your name · overall 87/100 (the average of your four scores) · ★★★ · 21 min played · diagnoses 0 right, 0 wrong · 4 died in the department · not fired."
- **Effort:** S

**R6.5-12 · Low · Repeat attempts are still invisible on screen**

- **Location:** `cbListHTML` (2119–2123) shows no time sent. The `score desc` order puts a student's best try on top.
- **What's wrong:**
  - "Run it back" makes a new report and a new result id.
  - A student can resend until a high score tops the list. With no time shown and no "2nd try" mark, the instructor can't tell attempt 1 from attempt 5.
  - The caveat says "under any name" but not "as often as they like".
- **Fix:**
  - Show the time sent on each row.
  - Mark repeated names "2nd try" and so on, in order of `created_at`.
  - Add "as often as they like" to the note.
- **Effort:** S

**R6.5-13 · Low · A shift cut short shows its partial numbers beside full shifts, with no end time**

- **Location:** `cbRow` and `cbArgs` send `real_sec` but not the game clock at the end.
- **What's wrong:**
  - A fired or walked-out row's wait, walkouts and deaths cover 07:00 to whenever it ended (12:01 in `s2.js`).
  - "18 min played" doesn't tell the instructor whether it ended at 08:00 or 18:45.
- **Fix:** Send `end` (game minutes) and show "ended at 12:01" on rows that ended early. This is a new stats key, so do it with R6.5-07.
- **Effort:** S

**R6.5-14 · Low · README v0.31.0 overclaims**

- **Location:** README.md:55.
- **What's wrong:**
  - "This release closes audit findings … and the round-4 review of them": R6.4-01, -09 and -10 are open, and five R6.4 items are partial.
  - The Send box "shows what will be sent": it shows the score, stars and minutes, then "a few shift numbers".
- **Fix:**
  - "…and most of the round-4 review (see `docs/audit/round4/STATUS.md`)".
  - "shows the score being sent".
- **Effort:** S

### Nitpick

**R6.5-15 · Nitpick · The sheet's close button covers the stars of the first visible row.** In `shots/e-instructor-list-md-rows.png` row 1 reads "94/100 ★★ ×": the third star is under the ✕. The delete buttons moved left for this reason, but the score column didn't. **Fix:** right-pad `.cb-top` by the close button's width while the sheet scrolls.

**R6.5-16 · Nitpick · "wait" is unglossed, and "run by the computer charge nurse" oversimplifies it**

- **What "wait" is:** `avgWait()` is door to provider, averaged over every arrival, including patients still waiting at 19:00.
- **What it depends on for an attending:** the student's own pickups. The caveat's "run by the computer charge nurse" isn't the whole story.
- **Fix:** label it "door-to-provider" on screen and in the CSV.

**R6.5-17 · Nitpick · `round4/STATUS.md` lists R6.4-02 to -08 as Fixed.** Six of those seven are partly fixed (table above). The STATUS line should say so.

**Counts:** Critical 0 · High 2 · Medium 6 · Low 6 · Nitpick 3.

## 4. Coverage

**Reviewed:**

- **Content-change check:**
  - blob identity of every clinical source and test file at `ce11887` and `46a0b03`;
  - the empty diff of `src/engine.js` and `test/golden.json`;
  - every `src/ui.js` hunk;
  - the README and SMOKE diffs.
- **Tests:**
  - `npm test` in full (exit 0, 694 ok, 0 FAIL, 71 answer keys unchanged);
  - `test/class_test.py` (60 ok).
- **Instructor screens, in Chrome at 390×844:**
  - the class code sheet and the "Make one" box;
  - the key panel;
  - the saved-codes list;
  - the results list for an attending code (9 rows: 8 measured in Node, 1 played in the browser) and a charge nurse code (6 rows);
  - Copy table (captured);
  - the day-8 key check.
- **Student screens:**
  - the radio-only attending's summary and Send box;
  - the payload actually sent;
  - the shared-device pre-fill;
  - About as a first visitor;
  - the Lessons header.
- **Code:**
  - `cbRow`, `cbListHTML`, `cbTable`, `cbArgs`, `cbWhat`, `CB_WHO`, `cbSendHTML`, `cbRegister`, `cbKeys`, `cbKeySave`, `ACT.cbSend`, `ACT.cbShow`;
  - `aboutHTML` and `lessonsHTML`;
  - the engine paths behind each number: `endShift` report fields, `avgWait`, `scores`, `avgScore`, `overallStars`, `care` gating, `dxPick`, `needsDx`, `litAdd`/`litCheck` (fired), the staff walkout check, death recording, `R.md.seen` and `R.md.harm`;
  - in the migration, `clean_stats`, `cb_submit`'s expiry extension, `cb_class_read`'s order, and `classes.expires_at`.
- **Texts:**
  - README v0.31.0;
  - README "For a class";
  - About's Privacy section and "A game, not a protocol";
  - the Lessons header;
  - the "Not for grading" note;
  - the Send box before and after sending.

**Not checked, and why:**

- **The live database and site.** Off limits by the brief.
- **`npm run db:test`.** Reviewer 3's area. I read the SQL that decides what the instructor sees.
- **The round-3 clinical findings.** Not re-audited: the engine is byte-identical, so their state is unchanged from round 4.
- **WebKit and Firefox.** Chrome only.

**Network:** every Playwright run replaced `fetch` in the page and aborted non-file requests. Every `leaked` list is empty. Nothing reached supabase.co or edcodeblack.com.

## 5. What I'd keep

- **Deaths, diagnoses, "fired" and sped-up play** on the instructor's list. That is the first time anything clinical reaches the instructor. It needs correct attribution, not removal.
- **The "Not for grading" note** placed above the rows, not in a footer.
- **The disclaimer wording** in About and Lessons: short, plain and accurate. "Written with AI" is honest.
- **The Send box showing the score** before sending, and **About listing every field sent**. That is the right transparency, and nearly complete.
- **The name is no longer stored**, and the old `oc-cb-name` is wiped on load.
- **A clean phase.** The round-4 fixes touched no clinical content, so they introduced no clinical regressions.
