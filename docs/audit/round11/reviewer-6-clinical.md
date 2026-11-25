# Reviewer 6, round 11: clinical accuracy and medical education (release review)

Role: board-certified emergency physician and paramedic educator. Branch `claude/sleepy-rubin-jot35n`, v0.31.0, reviewed at `e3fbeec`. Reviewed 2026-11-25. A fresh `node build.js` of `git archive e3fbeec` in scratch is byte-identical to the committed `index.html`, so the page I tested is the source I reviewed. Scratch: `scratchpad/round11/r6/` (`s0_combos.js`, `s1.js`, `s1c.js`, `s2.js`, `ui1.py`, plus their `.out`/`.json` files and screenshots).

## What changed in the engine, and did any clinical content change?

`git diff 1ab6fa9..e3fbeec -- src/engine.js` has two hunks and nothing else:

| Hunk | What it does | Verified |
|---|---|---|
| `codeOutcome` (engine.js:2274–2279) | `book = C.wait <= 3 && (!C.me || C.right >= n)`. `p.codeLost` is set only when `book` is true. When the attending ran the code and it wasn't by the book: +10 legal risk and an M&M line of 60. | `s1.js`, 40 seeds per strategy (below) |
| `endShift` (engine.js:4413) | The age of an open arrest counts from `code.tLeft`, then `tArrest`, then `tArrive`, so an arrival in arrest counts from the door | rules13 (R1.10-02); `s2.js` |

- `test/golden.json` does not appear in the diff.
- `npm test`: 720 ok, 0 FAIL.
- The `ui.js` diff only rewords "after a code you ran / they ran" to "after a code run by the book" (verdict, summary row, list, CSV header, Send box, About, `CB_MDNOTE`), plus class-sheet focus, the date fix and the 5xx fallback. No lesson, coach step, dose, drug, answer key or case changed.
- The round-10 combination sweep (`s0_combos.js` = round-10 `s1.js`), re-run unchanged, gives output identical to round 10's line for line (145 lines, compared sorted). No required drug lands in "Also reasonable", for any group alternative, in either order, at either age. `partOk`, the clean bonus, the order log after ROSC and the `litAdd`/`litStage` end-of-shift guards are unchanged since round 10 and still pass.
- **Still: no licensed clinician has reviewed any of this content.**

## 0. Round-10 status

| Finding | Status | Evidence |
|---|---|---|
| R6.10-01 High: every lost code labelled "run well", and a token code paid | **Partly fixed** | Labels fixed. `s1.js` "selfLateWrong" (19.5 min late, 0 of 3 right): 40 of 40 died, `codeLost` 0, M&M "died after a VF / 0 of 3 … 20 min", +10 legal. Not fixed: the token code still beats the honest no-code death, at 3★/84 vs 2★/81 (R6.11-04). |
| R6.10-02 Medium: an own patient's code run by another doctor counted as an unexplained death | **Partly fixed** | A prompt hand-off is now labelled. A **late** hand-off still gets no M&M, and now carries no penalty at all (R6.11-01). The prompt hand-off also brought in a false label (R6.11-03). |
| R6.10-03 Low: "Attending of the year" over an unrun arrest | **Still open** | `s2.js`: an own arrest 3 min before the end gives avg 88, 3★ and VERDICT_MD[3]. `ui1.json` "lastSecond" shows the same verdict. |
| R6.10-04 Low: the 5-minute grace is really 4.5 | **Still open** | `s2.js`: 4.4 min is not counted; 4.6 min gives `arrestLeft` 1, +15 and M&M "(5 min)". engine.js:4414 still rounds before it compares. |
| R6.10-05 Low: rules13 skips the branches that matter | **Partly fixed** | A lost code with every call wrong and a prompt md2 code are now tested. Still untested: a late code with every check right, a late hand-off, a code started just before the end, the night-death construction (`tDied < 0`), and the `litAdd` guard (line 99 still passes on `p.late = !G.fail` alone). |
| R6.10-06 Nitpick: wording and docs | **Still open** | `cbDet` (ui.js:2205) still reads "2 of them died, after a code run by the book". A crafted `mdCodeLost` > `mdDied` still prints. The migration header, now frozen, still says "four more numbers". "The team got there N min after the arrest" still counts from the door. |

**Counts:** Fixed 0 · Partly fixed 3 · Still open 3 · Worse 0.

**STATUS claims checked:**

- **"A code run with wrong calls or late is a death like any other: an M&M line and +10 legal risk."** Half true. It is *not* a death like any other. A death with no code costs +15 legal, −40 care and an M&M line of 90; a badly run code costs +10, about −12 and 60. That is a fair gradient, but the sentence overclaims (R6.11-04). And when a late code is run by **another doctor**, there is no M&M line and no legal risk at all (R6.11-01).
- **"An own patient whose code another doctor ran at once and lost counts as by the book."** True. But the game's own definition, printed on every surface, is "every rhythm check right, a doctor there within 3 minutes", and those patients have `codeLost.right = 0` (R6.11-03).
- **"Its age counts from the door, the same clock as the 20-minute no-team rule."** True (rules13; `s2.js`).

## 1. Verdict

**Do not ship v0.31.0 to students today.** Fix R6.11-01 to -03 first. Each is a few lines in engine.js or ui.js and none needs a migration.

- **Clinical content:** unchanged since v0.30.0 and still unreviewed. That is the same ceiling as every round, and the owner already knows it.
- **Release blockers:** the arrest accountability added over rounds 8–10, now on the instructor's screen, can be undone with one ordinary tap:
  - **The late hand-off (R6.11-01).** A student leaves their own VF arrest for 19.5 minutes, then hands it to Dr. Okafor. That costs no legal risk and no M&M line. The verdict tells them to "Read the M&M below", and the M&M doesn't mention the patient. It scores 85 and 3★, the same stars as running a perfect code at once (86, 3★), against 81 and 2★ for leaving it alone.
  - **The last-second start (R6.11-02).** Leave an arrest for 18.6 minutes, then tap Run the code (or hand it off) in the last half-minute of the shift. Nothing is counted anywhere, and the verdict says "Attending of the year".
  - **The false label (R6.11-03).** Hand every arrest to md2 at once and every loss is filed as "after a code run by the book: every rhythm check right", by a student who answered no rhythm checks.

**Are deaths after a well-run code labelled fairly without hiding real failures?** A well-run code the student ran: yes. A badly run code the student ran: yes, it is now an honest M&M line and an honest list label. A delay before *another doctor's* code: hidden. A delay that isn't finished when the shift ends: hidden. A code the student never ran: labelled as if they ran it perfectly.

**Can a student game it?** Yes, by the three routes above. Diluting by taking more arrests still does nothing, because the list shows counts, not rates. Leaving an arrest late is no longer capped by the grace period, because of the last-second start.

**Fit for a debrief?** The "Not for grading" caveat and the unranked list are right. "By the book" is a competence claim. Today it can be earned by answering nothing.

## 2. Score

**5 / 10** (round 10: 5).

- **Better:** a badly run code the student ran is now judged on every surface: M&M, legal risk, list, CSV, verdict.
- **Held down by:** the unreviewed content (the ceiling); two one-tap bypasses of the unrun-arrest rule; a "by the book" label that is false for a third of the cases it covers; rules13 tests the paths that were fixed and none of the ways around them.

## 3. New findings, worst first

### High

**R6.11-01 · High · A late hand-off to the second doctor wipes out every consequence of leaving your own arrest unrun. No legal risk, no M&M line, and the same 3★ as a perfect code run at once**

- **Location:**
  - engine.js:2278–2279: the legal risk and the M&M for a code that wasn't by the book are both gated on `C.me`. A code md2 runs has `C.me = false`, so neither fires, whatever `C.wait` is.
  - engine.js:2307–2311 (`arrestNoTeam`) never fires, because a code is now running.
  - engine.js:3388 / 4443: the death still counts in `md.died`, because `p.mine` stays true after `assign('md2')`.
  - ui.js:3059–3063: the verdict says "One of your own patients died. Read the M&M below."
- **Reproduction:**
  - `node scratchpad/round11/r6/s1.js`. Own `cwp` patient, `OC.toArrest` at minute 60, 40 seeds per strategy. Means are over the patients who died:

    | Strategy | Died | Legal risk added | M&M line on the death | Mean score | Mean stars |
    |---|---|---|---|---|---|
    | unrun | 40/40 | +15 | 40/40 | 81.0 | 2.00 |
    | **handoffLate** (idle 19.5 min, then `OC.assign('md2', p.id)`) | 36/40 | **+0.4** | **1/36** | **85.0** | **2.97** |
    | selfLateRight (19.5 min, 3/3) | 35/40 | +10 | 35/35 | 85.4 | 3.00 |
    | selfNowRight (at once, 3/3) | 14/40 | 0 | 0 | 83.5 | 2.71 |

    The per-seed figures from `s1c.js` (seed 9001) say the same. Unrun: care −90, legal 14, 82, 2★. Late hand-off: care −50, legal 0, 85, 3★. Perfect code at once: 86, 3★.
  - In the page: `CHROME_PATH=/usr/bin/google-chrome python3 scratchpad/round11/r6/ui1.py`, case "handoffLate", with the server stubbed:
    - Verdict: "1 patient died in the department. One of your own patients died. **Read the M&M below.**"
    - The M&M's only line is "Door to ECG went past 10 min for Shanice P." Legal risk 0.
- **Why it matters:**
  - Twenty minutes of no-flow in VF is the textbook preventable death. "An arrest nobody runs for 20 minutes is a death, and it counts" is the rule this game exists to teach.
  - Handing the arrest off at the end of its countdown is a natural move for a busy student, not an exotic exploit. It erases the lesson and pays the same stars as doing it right.
  - The debrief sends the student to a section that says nothing about the patient.
- **Fix:**
  - In `codeOutcome`, judge the delay for every code on an own patient: `const own = C.me || p.mine;`. Apply the legal risk and the M&M line when `own && !book`, worded for who ran it, e.g. "the code started N min after the arrest (handed to Dr. X)".
  - Do the same in the ROSC branch for `wait > 3`, at least as an M&M line.
  - Add a rules13 case: idle 19.5 min, then `assign('md2')`, lost; expect an M&M line, legal risk ≥ 10 and `codeLost` 0.
- **Effort:** S.

### Medium

**R6.11-02 · Medium · An arrest left for up to 19 minutes and started (or handed off) in the last seconds of the shift escapes the end-of-shift rule completely, and the verdict says "Attending of the year"**

- **Location:** engine.js:4410. `arrestOpen` excludes `p.ev === 'doing'`, and so does the `p.ev` check in `arrestNoTeam`. A running code's `C.wait` is never looked at when the shift ends.
- **Reproduction:**
  - `node scratchpad/round11/r6/s2.js`. Own arrest 15 minutes before the end. Left unrun: `arrestLeft` 1, +15 legal, M&M "(15 min) … nobody was running the code", 2★.
  - Same arrest, `OC.assign(OC.G.me, p.id)` 0.5 min before the end: `arrestOpen 0, arrestLeft 0, died 0`, legal +0, no M&M line on the delay, 3★.
  - The same with `assign('md2')` instead, or with the arrest 19.4 minutes before the end: the same result.
  - In the page (`ui1.py`, "lastSecond"): arrest at `shift − 19`, Run the code at `shift − 0.4`. Verdict: "**Attending of the year.** The residents want to copy your orders." The table and the class list show nothing.
- **Why it matters:** this reopens R6.9-02/R5.8-03 by a different door. An arrest that comes in during the last 20 minutes can be left for the whole window. The instructor never sees it, and the student is praised.
- **Fix:** at `endShift`, for an own patient still in arrest with a code running, compute the delay it started with (`p.code.wait`, plus `G.t - p.code.tLeft` if the doctor left). When that delay is over 3–5 minutes, count it like an open arrest (`late`). Add the rules13 case above.
- **Effort:** XS–S.

**R6.11-03 · Medium · "After a code run by the book: every rhythm check right, a doctor there within 3 minutes" is printed for codes the student never ran (game doctor, `right: 0`), so handing every arrest off at once files every loss as perfect ACLS**

- **Location:**
  - engine.js:2276: `book` is true for any `!C.me` code with `wait <= 3`, and `p.codeLost = {right: 0, n: 3, …, me: false}`.
  - Definition text: ui.js:2200 (`CB_MDNOTE`), ui.js `cbWhatAll` (the Send box), and the summary row, the list (ui.js:2205), the CSV header and the verdict (ui.js:3065).
  - The game doctor's quality is `CODE_AI_Q = 0.6`, which engine.js describes as a doctor who "gets it partly right".
- **Reproduction:**
  - `ui1.py`, "handoffNow": own arrest, `OC.assign('md2', p.id)` at once, lost.
    - `codeLost = {"right":0,"n":3,"wait":0,"me":false}`.
    - Verdict: "**A patient died after a code run by the book: many arrests don't come back, even when the code is run well.**" 3★.
    - Summary: "Of them, after a code run by the book 1".
    - The Send box on the same screen defines it as "(every rhythm check right, a doctor there within 3 minutes)".
    - The instructor's row would read "(1 of them died, after a code run by the book)".
  - `s1.js` "handoffNow": 22 of 22 deaths labelled by the book. "selfNowRight" got 26/40 ROSC against 18/40 for the hand-off, so the student who hands off has worse outcomes and a better-sounding label.
- **Why it matters:** the instructor note itself says the list tells which deaths came after a code run by the book, i.e. well-run. A student who can't run ACLS learns that handing off every arrest at once is never wrong, never shows a code card, and reads as perfect ACLS. That is exactly the "misread as clinical competence" failure.
- **Fix:** tell the two apart without a migration:
  - Keep `mdCodeLost` for the student's own 3/3, ≤ 3 min codes.
  - Fold a prompt hand-off into neither bucket, or reword every surface to "after a prompt code: run by the book by them, or started at once by another doctor".
  - Do not reuse "every rhythm check right" for it.
  - If a separate count is wanted on the list, that needs a new migration (`clean_stats` whitelists keys). The text fix doesn't.
- **Effort:** XS (text) / S (engine split).

### Low

**R6.11-04 · Low · A token code still scores better than an honest no-code death, and STATUS's "a death like any other" overclaims**

- **Reproduction:** `s1.js`. "selfLateWrong" (19.5 min idle, then 0 of 3 right, 0/40 ROSC): +10 legal, care about −62, 84.0, **3.00★**. "unrun": +15, −90, 81.0, **2.00★**.
- **Why it's only Low:** a late attempt is clinically better than none, so a gradient is defensible, and the labels are now honest. But a code with zero chance of ROSC and every call wrong earns a star over doing nothing, and STATUS says it is "a death like any other".
- **Fix:** reword STATUS. Optionally make an attempt with `wait ≥ 15` and no right check cost the same as an unrun one.
- **Effort:** XS.

**R6.11-05 · Low · rules13 tests the two paths that were fixed and none of the ways around them**

- **Location:** test/rules13.js:157–174.
- **Untested:**
  - a late code with every check right (`wait > 3`, `right == n`; I checked by hand: +10 and an M&M line, correct);
  - the late hand-off (R6.11-01);
  - a code started just before the end (R6.11-02);
  - that a prompt hand-off's label matches its printed definition (R6.11-03);
  - the night-death exclusion (`tDied < 0`), still never constructed;
  - the `litAdd` guard after a firing. Line 99 still passes on `p.late = !G.fail`. `OC.litAdd` is exported (engine.js:4900), so a direct call after a firing is one line.
- The class_test verdict checks (class_test.py:360–370) feed synthetic `R` objects, so none of them would catch R6.11-01 to -03.
- **Effort:** S.

### Nitpick

**R6.11-06 · Nitpick · Wording left over**

- **ui.js:2205:** "2 of them died, after a code run by the book" (should be "both after codes run by the book").
- **No clamp:** `cbClean` doesn't clamp `codeLost` to `mdDied`. The migration is frozen now, so the client is the only place left to do it.
- **"A doctor there within 3 minutes":** this is measured from the door for arrivals in arrest, and a game doctor's code counts too.
- **Frozen migration header** (round6.sql:26–27): still "four more numbers", without `mdCodeLost`. It is harmless now, but it is the comment the owner pasted.
- **Verdict "Read the M&M below."** whenever the M&M has any line, even when no line is about the death it follows (see R6.11-01).

**Counts:** Critical 0 · High 1 · Medium 2 · Low 2 · Nitpick 1.

## 4. Coverage

**Checked:**

- The engine diff line by line; `npm test` (720 ok, 0 FAIL); golden unchanged; the ui.js diff for lesson, dose and answer-key text (none changed).
- A byte-identical rebuild of `e3fbeec`.
- The combination sweep re-run in full: every `RXREQ`/`REQ_AGE` case, the first and last alternative in each group, both orders, two ages, split sheets.
- Codes, 40 seeds × 7 strategies (`s1.js`): unrun; hand-off at once; hand-off at 19.5 min; self at 19.5 min with all right and with all wrong; self at once with all right and with all wrong.
- End of shift (`s2.js`): unrun at 3, 4.4, 4.6, 5 and 15 min; abandoned 15 or 19.4 min, then self or md2 in the last 0.5 min.
- In the page (Chrome, server stubbed, `ui1.py`):
  - the verdict, summary table, M&M and Send box for a late hand-off, a prompt hand-off and a last-second start;
  - the list wording from `cbDet`, `CB_MDNOTE` and the CSV header, read in source.
- rules13 read in full, against what it claims.
- The frozen migration's stats whitelist (`mdCodeLost` present; no pair check).

**Not checked:**

- Any clinical content beyond the code flow. It hasn't changed since round 10, and my round-2 to round-10 notes stand.
- WebKit and Firefox.
- The live database (forbidden).
- Every lesson.

## 5. What I'd keep

- `codeOutcome`'s honest M&M line and legal risk for a code the student ran badly, and the `codeEnd` card's "why" line. A student who gets the rhythm checks wrong is told exactly which call was wrong and why.
- The arrival-in-arrest clock fix: one clock for the 20-minute rule and the end-of-shift rule.
- The "Not for grading" caveat, the unranked list and the Send box that names every number sent.
