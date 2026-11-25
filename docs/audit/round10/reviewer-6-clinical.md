# Reviewer 6, round 10: clinical accuracy and medical education

Role: board-certified emergency physician and paramedic educator. Branch `claude/sleepy-rubin-jot35n`, v0.31.0, reviewed at `1ab6fa9` (the brief's commit; later commits are audit reports only). Reviewed 2026-11-25. A fresh `node build.js` of `git archive HEAD` in scratch is byte-identical to the committed `index.html`, so the page tested is the source reviewed. Scratch: `scratchpad/round10/r6/` (`s1.js`–`s5.js`, `ui1.py`–`ui3.py`, their `.out`/`.json` and screenshots).

## What changed in the engine, and did any clinical content change?

`git diff 0541eeb..1ab6fa9 -- src/engine.js` is 31 lines in seven hunks, and nothing else:

| Hunk | What it does | Verified |
|---|---|---|
| `signOrders` `partOk` | A drug that fills part of an `RXREQ` combination goes to `partOk`, not `drugOk`, and counts for "Pick at least one order" | `s1.js`: all 12 combination cases (nstemi, stemi, tfall, dissect, hyperk, mening, mesisch, necfasc, salod, sea, status, tcaod), each at its own age and at 70, first and **last** alternative of every group, both drug orders: `fine` empty, nothing missed, clean +1 (96 runs). Split over two sheets: sheet 1 shows "Missed: Medications (heparin)" etc. with no "Also reasonable"; sheet 2 completes it. |
| Clean bonus | `+10`/`clean++` only if no contraindicated drug | rules13 (textbook vs textbook + ibuprofen) |
| R6.9-07 branch | A later order with no `ordLog` (after ROSC) creates the entry and logs it | rules13 |
| `codeOutcome` | `p.codeLost = {right, n, wait}` whenever the attending ran it; M&M line only if a check was wrong or `wait > 3` | `s2.js`, below |
| `leave` / `endShift` | `md.codeLost` counted beside `md.died` | `s2.js` |
| `litAdd` | No reason added when `G.over && G.fail`; no `litCheck` once `G.over` | rules13; `s3.js` |
| `endShift` | Open own arrest penalised only if `!G.fail && round(age) >= 5`; `litStage` and `arrestLeft` in the report | `s3.js`: see R6.10-04 for the rounding |

`test/golden.json` is unchanged in the diff and `npm test` passes (717 ok, 0 FAIL; "golden: 13 shifts, 3 stream checks, 20 codes, save round trip, 71 answer keys unchanged"). The `ui.js` diff touches no lesson, coach step, dose or drug text. **No clinical content, answer key or lesson changed.** Still: no licensed clinician has reviewed any of it.

## 0. Round-9 status

| Finding | Status | Evidence |
|---|---|---|
| R6.9-01 required drugs under "Also reasonable" | **Fixed** | `s1.js`: 0 of 96 runs (every group alternative, both orders, two ages) put a required drug in `fine`; rules10's new assert passes. |
| R6.9-02 end-of-shift arrest penalty | **Fixed**, with a rounding residue | `s3.js`: 0.5 and 3 min before the end, counted with no legal risk or M&M; 15 min, +15 and M&M "(15 min)". Fired shift: no reason after the firing. "Fired" only when `R.fail === 'fired'`. Residue: 4.5 min counts as 5 (R6.10-04). |
| R6.9-03 a perfect lost code read as failure | **Partly fixed** | A 3/3, wait-0 lost code now reads "You ran the code and lost a patient: many arrests don't come back, even when the code is run well" with no M&M line (`ui2.json`). But the same sentence and the same list label go on a code run 0 of 3 after 20 minutes (R6.10-01), and an own patient whose code another doctor ran reads as a death with no code (R6.10-02). |
| R6.9-04 "The numbers were good" over calls to review | **Fixed** | ui.js:3094 guard now includes `dxWrong`, `dispoWrong`, `contra`, `unneeded`, `untreated`, `codeLost`, `arrestLeft`. |
| R6.9-05 rules13 tests less than it claims | **Partly fixed** | A real md2 death (seed search on `tDied`), a bounded per-shift complication check and a lost own code are now tested. Still untested: the night-death exclusion (`tDied < 0`); a lost code with a wrong check or a late team (the M&M branch); the verdict text. See R6.10-05. |
| R6.9-06 Send box and About omit a sent number | **Fixed** | Send box: "how many died, how many of those after a code you ran, and how many were left in cardiac arrest … complications"; About's Privacy list the same (ui.js:3013). |
| R6.9-07 unsafe drug after ROSC not in the review | **Fixed** | engine.js:1926 branch; rules13 passes. |
| R6.9-08 wording and docs | **Partly fixed** | Two deaths now worded from what happened; README cites round4–round9 STATUS. The in-shift card still omits "Can hurt them", the died/arrivals base and the database's `harm` are left (STATUS says so). |

**Counts:** Fixed 5 · Partly fixed 3 · Still open 0 · Worse 0.

**STATUS claims checked:** "It applies only to an own arrest at least 5 minutes old" is false by 30 seconds (4.5 min, R6.10-04). "The verdict's negative line is only for deaths without a code and unrun arrests; a lost code alone reads 'You ran the code … even when the code is run well'" is accurate as a description, and is the defect in R6.10-01. "rules13.js checks a real death of another doctor's patient" is now true.

## 1. Verdict

**Clinical content: unchanged, and still "only after major work".** The required-drug mislabel is properly fixed and properly tested. The end-of-shift penalty is now fair.

**The new lost-code labels went too far the other way.** The engine records how a lost code was run (`codeLost = {right, n, wait}`) and uses it for the M&M. The verdict, the summary table, the class list, the CSV and the instructor note ignore it. A student who ignores their own VF arrest for 19.5 minutes, then taps Run the code and answers every rhythm check wrong is told "many arrests don't come back, even when the code is run well". The instructor sees "1 of them died, after a code they ran", under a note that offers those deaths as the excusable ones. That student also scores better than one who never ran the code: no legal risk, 85 vs 73, and three stars (R6.10-01). Meanwhile an attending who hands their arrest to the second doctor, who runs it at once and loses, is reported as an unexplained own death (R6.10-02).

**Are deaths after a well-run code now labelled fairly without hiding real failures?** Well-run ones: yes. Real failures: no, they are hidden on every surface except the student's own M&M.

**Can a student game it?** Yes: the token code above. Diluting does nothing because the list shows counts, not rates. Leaving an arrest late is capped at the 4.5-minute grace, because arrests aren't scheduled.

**Fit for a debrief?** The "Not for grading" caveat and the unrated counts hold up. The new column must not be read as "deaths that weren't the student's fault", and today the note invites exactly that reading.

## 2. Score

**5 / 10** (round 9: 5).

- **Better:** R6.9-01 fixed and tested across every group alternative; the end-of-shift penalty, the "Fired" label and the post-firing reason are fixed; the Send box and About name every number; unsafe drugs after ROSC reach the review.
- **Held down by:** the unreviewed content (the ceiling); a lost-code label that can't tell a perfect code from an abandoned one and pays the abandoner, on the instructor's only view; delegation punished; a test file that still skips the new M&M branch.

## 3. New findings, worst first

### High

**R6.10-01 · High · "After a code they ran" and "even when the code is run well" go on every lost code, including one started 20 minutes late with every rhythm check wrong. A token code beats an honest no-code death on every measure.**

- **Location:**
  - engine.js:2274: `if (C.me) p.codeLost = {…}`, set whatever `right`, `n` and `wait` are.
  - engine.js:4439: `md.codeLost` counts every such death.
  - ui.js:3058: `verdictOf`: `if (m && cl && R.stars >= 2) return 'You ran the code and lost … even when the code is run well.'`
  - ui.js:3157: summary row "Of them, after a code you ran".
  - ui.js:2205: `cbDet` "(N of them died, after a code they ran)".
  - ui.js:2264: CSV "Of them, after a code they ran".
  - ui.js:2199: `CB_MDNOTE`: "Many patients who arrest die even after a well-run code (the list says which deaths came after a code they ran)".
  - Only the M&M (engine.js:2275) uses the quality test `C.right < n || C.wait > 3`.
- **Reproduction:**
  - `node s4.js`, 40 seeds, an own `cwp` patient (assigned, so counted as seen) arrests at minute 60:
    - **Unrun:** dies at 20 min. Legal risk +15, care −90, M&M 90 "died in cardiac arrest with no code team", mean score 81.4.
    - **Token code:** wait 19.5 min, `OC.assign(G.me)`, every check answered wrong. 0 of 40 ROSC; `codeLost {right 0, n 3, wait 20}`. Legal risk +0, care −61, mean score 84.3. Seed 9000: 3 stars, score 85 (vs 2 stars, 73 unrun).
  - In the page (`ui3.py`, `CHROME_PATH=/usr/bin/google-chrome`, server stubbed), the same seed, VF, 0 of 3 right, the team 20 min late:
    - Verdict: "1 patient died in the department. **You ran the code and lost a patient: many arrests don't come back, even when the code is run well.**"
    - Summary table: "Your own patients who died 1 / Of them, after a code you ran 1".
    - Send payload: `mdDied 1, mdCodeLost 1`. So the instructor's row reads "(1 of them died, after a code they ran)", the same as a 3/3 code run at minute 0 (`ui2.json` "perfect").
  - The only true line is M&M "Jen S. died after a VF / 0 of 3 rhythm checks right; the team got there 20 min after the arrest". The instructor never sees it.
- **Why it matters:** VF is the most survivable arrest rhythm. A 20-minute no-flow time with wrong ACLS steps is the textbook preventable death that an M&M exists to catch. The game's headline tells the student it was bad luck, its instructor view files the death with the unavoidable ones, and its scoring pays for the token code. That is clinically wrong teaching about resuscitation, and it is new in round 9. Before, all own deaths read the same.
- **Fix:**
  - Engine: count `codeLostWell` only when `right === n && wait <= 3`, the M&M's own test. Count the rest with the no-code deaths, or as `codeLostLate`.
  - Send `mdCodeLostWell` instead of (or beside) `mdCodeLost`. The second migration isn't applied, so change `clean_stats`, `client_call.json` and `fingerprint.json` now.
  - `verdictOf`: the "run well" sentence only for well-run losses. Otherwise: "X died after a code that started N min late / with K of N checks right. Read the M&M."
  - List and CSV: "1 died after a well-run code" vs "1 died after a late or off-protocol code". Reword `CB_MDNOTE` to match.
  - rules13: a lost code with a wrong check and one with `wait > 3`: M&M present, not counted as well-run, and the verdict doesn't say "run well".
- **Effort:** S–M.

### Medium

**R6.10-02 · Medium · An own patient whose code the attending hands to the second doctor, who loses it, counts as an unexplained own death: the verdict blames the student, the M&M is silent, and the list shows no "after a code"**

- **Location:** engine.js:2274 (`codeLost` only `if (C.me)`); engine.js:3384 (`md.died` counts `p.mine`, and `p.mine` stays true after `assign('md2')`); ui.js:3056 (`d - cl > 0` → negative line).
- **Reproduction:** `node s5.js`, 60 seeds: own `cwp` arrests at 60, `OC.assign('md2', p.id)` succeeds, md2 runs the code at once. 33 of 60 die. In every one: `p.mine` true, `md.died` 1, `md.codeLost` 0, **no M&M line** about the death. `verdictOf` then prints "One of your own patients died. Read the worst moments below." and points to a section that doesn't mention it. The list reads "(1 of them died)" with no qualifier, which is worse than R6.10-01's token code.
- **Why it matters:** handing a code to a free colleague while you hold the rest of the board is sound practice. A debrief that frames it as the attending's failure teaches the wrong lesson about team resuscitation. Because of R6.10-01 it also reads worse than abandoning the code and running a token one later.
- **Fix:** set `p.codeLost` (or a `codeByOther` flag) for any code run by a doctor on the attending's own patient, with that doctor's quality. Count deaths after a game-run code apart from both buckets, or leave them out of `md.died` as for another doctor's patient. Test it in rules13.
- **Effort:** S.

### Low

**R6.10-03 · Low · "Attending of the year" prints over an own patient in an unrun cardiac arrest, and the instructor never sees an arrest under the grace period**

- **Location:** ui.js:3056 (uses `arrestLeft`, the penalised ones), ui.js:3157 (table uses `arrestOpen`, all of them), ui.js:3179 (sends `arrestLeft` as `mdArrestOpen`).
- **Reproduction:** `ui2.py` "unrun3": an own patient arrests 3 game minutes before the end with no code run. Verdict: "**Attending of the year.** The residents want to copy your orders." Two lines below, the table reads "Your own patients still in cardiac arrest at the end, with no code running 1". The class list shows nothing.
- **Why it matters:** in a monitored ED room, three minutes without CPR is a sentinel event. Not penalising it at the end is a fair game rule, but praising the shift in the same breath is not. The summary contradicts itself.
- **Fix:** when `arrestOpen > arrestLeft`, use a neutral line ("Room N arrested N min before the end; nobody had started the code"), never the top VERDICT_MD. Keep the penalty rule.
- **Effort:** XS.

**R6.10-04 · Low · The 5-minute grace is really 4.5 minutes, so the M&M, the list and STATUS overstate it**

- **Location:** engine.js:4409–4410: `age = Math.round(G.t - p.tArrest); p.late = !G.fail && age >= 5`.
- **Reproduction:** `node s3.js`: an arrest 4.6 min before the end gets `arrestLeft 1`, legal risk +15 and M&M "was in cardiac arrest when the shift ended **(5 min)**". The list prints "left in cardiac arrest 5+ min". At 4x, the 30 seconds is 7.5 real seconds. STATUS says "at least 5 minutes old".
- **Fix:** compare the unrounded age (`G.t - p.tArrest >= 5`) and round only for display.
- **Effort:** XS.

**R6.10-05 · Low · rules13 still doesn't test the branches that matter for R6.10-01**

- **Location:** test/rules13.js:104–110 (the lost-code test answers every check right with no delay, then asserts no M&M).
- **What's missing:**
  - A lost code with a wrong check or `wait > 3` (the M&M line, and how it's counted).
  - The verdict text for either case (`OCUI.verdictOf` is exported for this, but no Python test calls it with a lost code).
  - An own patient's code handed to md2 (R6.10-02).
  - The night-death exclusion: `tDied` appears in rules13 only as a death detector (line 85). Nothing constructs `tDied < 0`.
- **Line 99:** "a fired shift adds no reason after the firing" passes on `p.late = !G.fail` alone, so it doesn't test the new `litAdd` guard.
- **Fix:** the four tests above; for the guard, call `OC.litAdd(10, 'x')` after a firing and assert `litLog` didn't grow.
- **Effort:** S.

### Nitpick

**R6.10-06 · Nitpick · Wording and docs**

- **Plural:** two deaths after two codes print "2 of them died, after a code they ran" (ui.js:2205). The summary has "all after codes you ran"; the list doesn't.
- **No sanity check:** a crafted send with `mdCodeLost` > `mdDied` prints "1 of them died, 5 after a code they ran". `clean_stats` checks each number's range, not the pair. Self-reported data and the caveat says so, but a `least()` costs nothing while the migration is still open.
- **Migration header** (round6.sql:26–27): "four more numbers from the attending's own work … own patients left in an unrun cardiac arrest at the end". There are five now (`mdCodeLost`), and the arrest count is "5+ min" (really 4.5). That is the file the owner will paste.
- **"The team got there N min after the arrest"** for a patient who arrived in arrest measures from the door (`tArrive`), not from the arrest.
- **Legal risk 77% · Performance improvement plan** on a shift that ran to the end: right by the new rule, but the box sits under a game whose firing line is 75%. Add "(added at the end of the shift)" when `lit >= 75 && !fail`.

**Counts:** Critical 0 · High 1 · Medium 1 · Low 3 · Nitpick 1.

## 4. Coverage

**Checked:**

- **Engine diff, line by line;** `npm test` (717 ok); golden unchanged; no lesson, dose or answer key changed (ui.js diff grep).
- **Combinations (`s1.js`):** every `RXREQ`/`REQ_AGE` case, every first and last alternative, both orders, two ages, split sheets, re-orders. rules10's new check only covers each group's first drug in the textbook key. My sweep covers the rest, and it is clean.
- **Codes (`s2.js`, `s4.js`, `s5.js`):** by the book; one wrong check; team 10 min late; 19.5 min late; 19.5 late with every check wrong; unrun vs token code over 40 seeds; handed to md2 over 60 seeds.
- **End of shift (`s3.js`):** 0.5, 3, 4.6, 4.9, 5, 15 and 19.9 min before the end.
- **In the page (Chrome, server stubbed):**
  - verdicts and summary tables for a perfect lost code, a late wrong code, and unrun arrests at 3 and 4.6 min;
  - the Send box text;
  - About's Privacy list (source ui.js:3008–3016);
  - `cbDet`, `cbTable` and `CB_MDNOTE` read against the payloads the page built.
- **The second migration:** `clean_stats` keeps `mdCodeLost` and `mdArrestOpen`; the header is out of date (R6.10-06).

**Not checked:**

- **The live database and site:** off limits.
- **`npm run db:test` and the migration's security:** Reviewer 3's area.
- **The class list rendered with an `mdCodeLost` row in Playwright.** I read `cbDet` and the CSV code against real payloads instead.
- **WebKit and Firefox.**

**Side effects:** none in the repo except this report. My first page runs built own patients with `p.mine = true` already set, which skips `md.seen` and gave "You saw no patients"; the reruns assign through `OC.assign`, as in play.

## 5. What I'd keep

- **`partOk`:** a one-line fix that is exactly right, with a test that fails on the old engine.
- **`p.codeLost = {right, n, wait}`:** the engine already holds the data R6.10-01 needs. The UI just has to use it.
- **The end-of-shift rule:** counted always, penalised only when it could have been run, never after a firing, never a card after the end.
