# Reviewer 6, round 6: clinical accuracy and medical education

Role: board-certified emergency physician and paramedic educator. Branch `claude/sleepy-rubin-jot35n`, v0.31.0, HEAD `6328cdf`. The round-5 fixes are `git diff 7cb5613..6328cdf`. Reviewed 2026-11-24.

**Not re-reported:** items that `docs/audit/round2/` to `round5/STATUS.md` defer, move or leave to the owner, unless the fix made them worse. The attending's scoring (R6.4-01, R6.4-09, R6.5-01's root) is the owner's Phase 6 decision. I judge only what the screens now show about it.

**Scripts, output and screenshots** are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round6/r6/`.

| Script | What it does |
|---|---|
| `s1.js` | Manic Monday (seed 11) and Full Moon Friday (seed 3333) attending shifts: perfect, radio only (all right), radio only (all wrong), idle, poor (fired). It builds the payload with a copy of `cbArgs` at `6328cdf` and records every radio call offered. Output: `s1.out`. |
| `s2.js` | What "harm" counts. (a) One patient gets two contraindicated drugs in one order, on 4 seeds. (b) The same unneeded treatment (an insulin drip) is ordered once in 30 otherwise perfect shifts. Output: `s2.out`. |
| `s3.js` | Payloads for the instructor list: 6 attendings on one code (including "Hal", who gave one patient two contraindicated drugs), and 3 charge nurses (full, idle, staff walkout). Output: `rows.json`, `s3.out`. |
| `s4.js` | Do two attendings on one code get the same radio calls? Four seeds, three skill levels. Output: `s4.out`. |
| `s5.js` | Do an attending's own patients die in ordinary play? 24 shifts. Output: `s5.out`. |
| `ui1.py` | Chrome, 390×844. Makes an attending code, plays it in the page (radio calls only), shows the summary, the print view and the Send box, then sends. Runs it back as a fired attending. Feeds the instructor's list with `rows.json` plus the real payload, then captures Copy table, Download CSV and a charge nurse list with a walkout. Also captures Lessons. Output: `ui1.json`, `md.csv`, `shots/`. |
| `ui2.py` | The About page, from the menu and as a first visitor. Output: `ui2.json`. |

`fetch` is replaced in the page, and every request that isn't to a local file is aborted. Every `leaked` list is empty. Nothing reached supabase.co or edcodeblack.com.

## 0. Did any clinical content change in the round-5 fixes?

**No.** The evidence:

- **The clinical files are byte-identical at `7cb5613` and `6328cdf`.** `git rev-parse` gives the same blob for:
  - `src/engine.js` (`dfbf2ad4…`) and `src/map.js`
  - `test/golden.js` and `test/golden.json` (`680c949e…`)
  - `test/rules10.js`, `rules11.js`, `rules12.js`
- **The diff is empty.** `git diff --quiet 7cb5613..6328cdf -- src/engine.js test/golden.json 'test/rules*.js' test/golden.js test/sim.js test/stress.js src/map.js src3d` exits 0.
- **The `src/ui.js` hunks avoid the clinical text.** They touch:
  - `morph` (typing)
  - `inStrip` (toasts)
  - the class code sheet and class results (2006–2200)
  - the class `ACT` actions
  - About's Privacy paragraph
  - `start`, `lastReport` and `unsentGuard`
  - one line at the end of `reportHTML`
  - `showReport` (`mdSeen` and `mdHarm` added to the saved report)
  - `OCUI` exports

  `GLOSS`, `LESSONS`, the orders, the cards, Orientation, the M&M lines and the report's clinical tables are untouched.
- **The only clinical-adjacent text added** is disclaimer text:
  - `CB_NOTE`: "…no licensed clinician has reviewed the game's clinical content."
  - `CB_MDNOTE`, on what an attending's score means
  - the summary's last line (ui.js:2921): "A teaching game, not clinical guidance. No licensed clinician has reviewed its clinical content yet."

  The disclaimers are accurate. `CB_MDNOTE` is partly inaccurate: see R6.6-01 and R6.6-02.
- **The tests pass:**
  - `npm test`: exit 0, **694 "ok", 0 FAIL**, "golden: 13 shifts, 3 stream checks, 20 codes, save round trip, **71 answer keys unchanged**".
  - `python3 test/class_test.py`: **67 ok**, exit 0.

### Round-5 status

| ID | Status | Evidence |
|---|---|---|
| R6.5-01 ranked list | **Fixed (presentation)** | No rank number and no Rank column. Rows are sorted by `created_at` (`cbRows`, 2114). The new caveat says the score mostly reflects the department. A radio-only "saw 0 patients" row still reads 94/100 ★★★, but the row now says so. The score itself is the owner's (Phase 6). |
| R6.5-02 keys lost on day 7 | **Fixed** | `CB_LIFE` is 30 days from when the code was made (`cbKeys`). `class_test.py` checks that a 20-day-old key is still listed. |
| R6.5-03 "fired" for a charge nurse | **Fixed on the instructor side** | `walkout` is now a separate flag. The list shows "staff walked out: shift ended early", the CSV has an "Ended early" column, and the patient count is "left without being seen". The student's Send box and About still say "walkouts" (R6.6-07). The fired attending's own summary now says the staff walked out (R6.6-05). |
| R6.5-04 attending's deaths | **Partly fixed** | The row now reads "dept.: … N died". The attending's own patients' deaths still aren't sent (R6.6-04). |
| R6.5-05 name pre-filled | **Fixed** | `U.cbName` is cleared after a send, in `start()` and in `showReport()`. Verified: after Run it back, the name box is empty. |
| R6.5-06 exports drop caveats | **Fixed, with a new gap** | The first row carries the notes. There is no Rank column, and the department columns are labelled. Missed radio calls are dropped (R6.6-03). |
| R6.5-07 attending's own work | **Mostly fixed** | `mdSeen`, `harm`, `radioRight`, `radioWrong` and `radioMiss` are sent, stored (`clean_stats`) and shown. `mdDied` and `untreated` aren't. What "harm" counts is mislabelled (R6.6-02). |
| R6.5-08 disclaimer where results are used | **Mostly fixed** | It is now in the list note, the CSV's first row and the printed summary. The "Make one (instructors)" box still doesn't say it. No test checks the Lessons line (R6.6-11). |
| R6.5-09 instructor box wording | **Fixed** | |
| R6.5-10 About "patients seen" | **Fixed** | It now reads "patients who came in". "walkouts" is still unglossed (R6.6-07). |
| R6.5-11 Send box | **Partly fixed** | It lists the categories now. It doesn't say the result was fired, that "93/100" is the average of the four cards (no 93 appears anywhere else on the summary), or that the deaths are the department's (R6.6-07). |
| R6.5-12 repeats invisible | **Fixed** | Each row shows when it was sent, and a repeated name is marked "(2nd result)". The mark can't tell a retry from a second student with the same first name (R6.6-06). |
| R6.5-13 partial shifts | **Still open** | No end time. Not mentioned in `round5/STATUS.md` (R6.6-08). |
| R6.5-14 README overclaims | **Fixed** | Rewritten to point at the STATUS files. A new overclaim, "each student's own numbers", is in R6.6-01 and R6.6-02. |
| R6.5-15 close button over the stars | **Fixed** | `shots/f-instructor-list-md-rows.png` |
| R6.5-16 "wait" unglossed | **Still open** | Not mentioned in STATUS (R6.6-14). |
| R6.5-17 round-4 STATUS overclaim | **Fixed** | `round4/STATUS.md` now says six of seven were only partly fixed. |

`round5/STATUS.md` lists R6.5-04, -08 and -11 as fixed. They are partly fixed. It doesn't mention R6.5-13 or -16 at all.

## 1. Verdict for use with real students

**Clinical content: still "only after major work".** It is unchanged: the engine is the same bytes rounds 3 to 5 scored. The game now says on every results surface that no licensed clinician has reviewed it, which is correct.

**Class results:**

- **Charge nurse:** usable to start a debrief, not for grades. The labels are now right.
- **Attending:** usable to start a debrief on diagnoses, as long as nobody compares students. Three of the numbers that `CB_MDNOTE` calls "the attending's own work" are not like-for-like:
  - **Radio calls differ between students on the same code.** The timing, the count and on some codes the questions themselves differ (R6.6-01).
  - **"Harm" is a count of harmful orders, not of patients,** and half of it is a dice roll (R6.6-02).
  - **The export drops missed radio calls,** so a student who let every call ring out exports as if no calls came (R6.6-03).

No Critical or High finding remains. The round-5 Highs are fixed.

## 2. Score

**5 / 10** (round 5: 4).

- **Better:** the list is unranked and the caveats travel with the export. The "fired" mislabel and the 7-day key loss are gone, and the attending's own numbers now reach the instructor.
- **Held down by:**
  - the unchanged, unreviewed clinical content (the ceiling);
  - a "harm" number that means something different on each screen and is partly chance;
  - radio counts presented as comparable when the calls aren't.

## 3. Findings, worst first

### Medium

**R6.6-01 · Medium · Students on one class code don't get the same radio calls, but the list, its note and the README treat the radio numbers as comparable**

- **Location:**
  - `boxTick` (engine.js:3872) draws the next call's time (`randi(L.consult…)`) and the shuffled call order (`nextScen`) from the **main** random stream. Arrivals and events have their own streams (`inStream`); radio calls don't.
  - The class code sheet (ui.js:2011): "Everyone who enters the same code plays the same shift: the same patients and events, at the same times".
  - README "For a class": "the same scheduled ambulances and **radio calls**, the same events".
  - `CB_MDNOTE` (ui.js:2121) calls radio calls "the attending's own work".
  - `cbDet` shows "radio 17 right, 0 wrong" with no number of calls offered.
- **What's wrong (verified, `s1.out` and `s4.out`).** Same seed, different play:

  | Code | Calls offered (accuracy 1 / 0.85 / 0.6) | Same call within 2 minutes (1 vs 0.85) | First calls, accuracy 1 | First calls, accuracy 0.85 |
  |---|---|---|---|---|
  | Manic Monday 11 | 17 / 19 / 14 | 2 of 17 | `8:9 48:17 97:4 142:21` | `8:9 48:17 83:4 125:21` |
  | Full Moon Friday 3333 | 22 / 21 / 21 | **0 of 22** | `12:17 38:23 68:0 106:2` | `12:8 50:23 80:16 107:21` |

  Each call is written as game minute:question number.

  - On Full Moon Friday, **the very first call is a different question**.
  - A debrief built on "who got call 3 wrong" can't work.
  - "radio 17 right" against "radio 19 right" compares different calls. The instructor's list doesn't show how many calls each student was offered.
  - This is the attending's medical-direction objective, the reason a paramedic program would run the attending role.
- **Standard:** INACSL *Simulation Design*: learners compared in a debrief must face equivalent scenarios, or the comparison must say they didn't.
- **Fix:**
  - **Now (text):**
    - README: replace "radio calls" with "Radio calls come at different times for each player, and can be different calls."
    - Class code sheet: add "(radio calls differ)".
    - `CB_MDNOTE`: add "Radio calls differ between players."
    - `cbDet`: show "radio 17 of 17 right" (right / (right + wrong + missed)).
  - **Engine (owner):** draw `nextC` and the `G.box.scen` shuffle inside their own `inStream('rngB', …)`, as arrivals are. That moves golden fingerprints, so run `golden:update` and say why in the commit. Add a `golden.js` stream check: two players, the same radio calls.
- **Effort:** S (text) / M (stream, golden)

**R6.6-02 · Medium · "Harm" counts harmful orders, not patients, and its unneeded-treatment half is a dice roll; the student's summary calls it "Patients hurt by an order", and the instructor's note calls it the attending's own work**

- **Location:**
  - engine.js:1887: `for (const k of contraX) { S.harm++ …`. That is one count per contraindicated drug in an order, deterministic.
  - engine.js:1953–1958 (`harmCheck`): an unneeded treatment harms only `if (chance(h[0]))`, at 10–50% depending on the treatment.
  - The student's summary labels it `t('Patients hurt by an order', m.harm)` (ui.js:2968).
  - The list shows "harm N" (`cbDet`), the CSV has "Harm", and `CB_MDNOTE` names "harm" as the attending's own work.
- **What's wrong (verified, `s2.out` and `s3.out`):**
  - **One patient, two drugs → "2".** Giving one patient two contraindicated drugs in one order adds **2**: Brenda F. got ibuprofen and ketorolac in chest pain; Kwame S. (trauma) got heparin and enoxaparin. The student's summary then says "Patients hurt by an order: 2". It was one patient.
  - **The same error is a coin flip.** In 30 otherwise perfect shifts, the same unneeded insulin drip was ordered once. "harm" was **1 in 17 and 0 in 13**. The instructor sees "harm 0" for 13 students who ordered an insulin drip nobody needed. That order isn't sent anywhere else: "extra orders" isn't a stat.
  - **Harm costs nothing visible.** "Hal" (two contraindicated drugs) shows **92/100 ★★★**, exactly the same as "Pat", who harmed nobody. That is the owner's scoring, but it sits on the same row as "harm 2".
- **Standard:**
  - Patient-safety teaching separates an unsafe order (the learner's act) from the harm that follows (partly chance).
  - A count labelled "patients" must count patients.
- **Fix:**
  - **Labels now, no new key:**
    - Summary: "Harmful orders (contraindicated drugs, and complications of unneeded treatments)".
    - List: "harmful orders 2".
    - CSV: "Harmful orders".
    - `CB_MDNOTE`: "…harmful orders (some complications are chance)".
  - **Better, with a migration (owner approval):** send `contra` (contraindicated drugs ordered, deterministic) and `unneeded` (unindicated high-risk treatments ordered, whatever the dice did) as the attending's own unsafe orders. Keep `harm` for the outcome.
  - **Test:** a `rules` check that one order with two contraindicated drugs gives the label's unit.
- **Effort:** S (labels) / M (keys and migration)

**R6.6-03 · Medium · Copy table and Download CSV drop missed radio calls: a student who let every call ring out exports exactly like one who got no calls**

- **Location:** `cbTable` (ui.js:2157). The header has "Radio right" and "Radio wrong" and no "Radio missed". `r.rM` is read by `cbRow` and shown by `cbDet`, but never exported.
- **What's wrong (verified, `md.csv`):**
  - "Ida" missed all 18 calls. On screen she reads "radio 0 right, 0 wrong, 18 missed".
  - In the export she is `Ida,…,0,0,…`: radio right 0, radio wrong 0.
  - A missed call is the worst medical-direction outcome. The crew "rolled to another hospital's physician" (`missBox`), and it costs the most points.
  - The export is the copy that reaches a spreadsheet or gradebook. `radioMiss` is already sent and stored (`clean_stats`), so this is UI only.
- **Standard:** An exported record must carry the same facts as the screen it came from.
- **Fix:**
  - Add `'Radio missed'` after "Radio wrong", with `r.md ? r.rM : ''`.
  - Test: `class_test.py` feeds one `md` row with `radioMiss` and checks the column.
- **Effort:** XS

### Low

**R6.6-04 · Low · An attending's own patients' deaths are invisible to the instructor (the rest of R6.5-04)**

- **Location:**
  - `cbArgs` sends only the department's `expired`.
  - `CB_MDNOTE` lists the attending's own work without deaths.
- **What's wrong (verified, `s5.out`):**
  - In 24 attending shifts, **6 had a death among the student's own patients** ("dept died 3, own 1", and others).
  - The list shows "dept.: … 3 died". It can't say one was the student's.
  - In an EM debrief, your own patient's death is the first thing discussed.
  - The attribution is honest now (round 5 was Medium), but the fact is missing.
  - The migration is live: `clean_stats` drops unknown keys, so a new key now needs a migration and the owner's approval.
- **Fix:**
  - **Now:** add to `CB_MDNOTE`: "Deaths are the department's, including any of the attending's own patients: their summary's worst moments say which."
  - **Later:** send `mdDied` (deaths with `p.mine`), with the next migration.
- **Effort:** S / M

**R6.6-05 · Low · A fired attending's own summary says the staff walked out**

- **Location:** `scoreCardsHTML`, ui.js:2942: the Staff card reads `R.fail ? 'They walked out' : 'Average morale'`.
- **What's wrong (verified, `shots/d-fired-summary-top.png`):**
  - The fired attending's summary is headed "Your group let you go".
  - Its Staff card reads "76% ★★☆ **They walked out**".
  - The staff didn't walk out: walkouts only happen for the charge nurse (engine.js:3669). The instructor's row correctly says "fired".
  - The student's printout, which they may hand in, contradicts the record.
- **Fix:**
  - Change it to `R.fail === 'walkout' ? 'They walked out' : 'Average morale'`.
  - Test: a fired attending's summary doesn't contain "walked out".
- **Effort:** XS

**R6.6-06 · Low · "(2nd result)" by first name: two students called Sam become one student's second try**

- **Location:** `cbRows` (ui.js:2114) counts repeats by `name.toLowerCase()`.
- **What's wrong:**
  - The Send box asks for a "first name or initials", so two Sams in a class of 30 is ordinary.
  - The second Sam is shown as "Sam (2nd result)". An instructor reads that as a repeat attempt and may delete it.
  - The first row isn't marked at all, so scanning down, nothing says another one follows.
- **Fix:**
  - Use "(2nd result under this name)".
  - Mark the first row "(1 of 2)".
  - Add to `CB_NOTE`: "A repeated name may be a retry or another student."
- **Effort:** XS

**R6.6-07 · Low · What the student is told is still vaguer than what the instructor sees (the rest of R6.5-10 and -11)**

- **Location:**
  - `cbSendHTML` (ui.js:2176): "this shift's numbers (wait, walkouts, arrivals, deaths, your patients, diagnoses, harm and radio calls)".
  - About (ui.js:2837): "the department's average wait, walkouts, …".
- **What's wrong (`ui1.json`, `shots/c-radio-send-box.png`):**
  - **"walkouts"** is what the instructor sees as "left without being seen". The same student can also be listed as "staff walked out".
  - **"deaths"** goes beside their name, but nothing says they are the department's.
  - **The fired student's Send box** (`fired_summary.send`) doesn't say "and that you were fired" goes to the instructor.
  - **"score 93/100"** appears nowhere else on the summary, which shows four percentages (84, 100, 99, 90). Nothing says 93 is their average.
- **Fix:** "Sends your first name or initials, score 93/100 (the average of your four scores) · ★★★ · 21 min played, whether the shift ended early, and these numbers: the department's wait, patients who left without being seen, arrivals and deaths; your patients, diagnoses, harmful orders and radio calls." Use the same nouns in About.
- **Effort:** S

**R6.6-08 · Low · A shift that ended early still sits beside full shifts with no end time (R6.5-13, not in STATUS)**

- **Location:** `cbDet`. `cbArgs` sends no end clock.
- **What's wrong (verified, `list_rn` in `ui1.json`):**
  - "Wally", whose staff walked out at 12:01, reads "average wait 7 min · 0 left without being seen · 0 died". That looks better than "Nora", a full 12-hour shift: "average wait 8 min".
  - Wally's numbers cover 5 of 12 hours. The new "shift ended early" tag doesn't say that the numbers are partial.
- **Fix:**
  - **Now:** on ended-early rows, add "(numbers cover only the part played)".
  - **Later:** send `end` (game minutes) with the next migration, and show "ended 12:01".
- **Effort:** XS / S

**R6.6-09 · Low · The attending's verdict tells a student who saw no patients "The residents want to copy your orders"**

- **Location:** `VERDICT_MD[3]` (ui.js:2882), chosen by stars.
- **What's wrong (verified, `radio_summary` in `ui1.json`):**
  - The radio-only shift saw **0 patients and wrote 0 orders**. It is told "Attending of the year. The residents want to copy your orders."
  - The stars are the owner's Phase 6 scoring. The sentence is a separate, plainly false statement on a summary that can be printed and handed in.
- **Fix:** when `R.md.seen === 0`, the verdict reads "You saw no patients this shift: the stars come from the radio and the department the computer ran."
- **Effort:** XS

**R6.6-10 · Low · Four numbers are sent and stored but never shown to anyone**

- **Location:**
  - `cbArgs` sends `seen` (arrivals), `ama`, `bedFirst` and `scen`.
  - `cbRow` reads none of them. Neither the list nor the CSV shows them.
- **What's wrong:**
  - About says the data "is used only to show the instructor the class's results". Four sent fields are shown nowhere.
  - For the charge nurse, AMA and "bedded before registration" are the student's own decisions, and they would be useful in a debrief.
  - Either show them or stop collecting them. Data minimization overlaps with Reviewer 3.
- **Fix:**
  - Show "left against advice N · bedded before registration N" on charge nurse rows and in the CSV.
  - Drop `seen` and `scen` from `cbArgs` and from About's list, since the code already names the scenario.
- **Effort:** S

**R6.6-11 · Low · No test covers an attending's row or the Lessons disclaimer**

- **Location:** `test/class_test.py:153–157` feeds only `role: 'rn'` rows.
- **What's wrong:**
  - None of these is checked by any test:
    - `CB_MDNOTE`;
    - "saw N patients", "harm", "radio … missed" and "dept.:";
    - the CSV's attending columns;
    - that `cbArgs` gets `mdSeen`, `mdHarm` and `boxC` from the report (`showReport` adds the first two by hand, ui.js:2990).
  - A rename would turn the whole attending row into "?" with every test green.
  - The Lessons line "no licensed clinician has reviewed them yet" (2203) is untested. R6.5-08 asked for that test.
- **Fix:**
  - Add one `md` row (with `radioMiss` and `harm`) and check the row and CSV text.
  - After an attending class shift in `class_test.py`, check that the payload's `mdSeen`, `radioRight` and `radioMiss` equal the report's.
  - Check the Lessons line.
- **Effort:** S

### Nitpick

**R6.6-12 · Nitpick · "fired" is unexplained on the list.** It means the legal-risk meter reached 75%. **Fix:** "fired (legal risk)" on screen and in the CSV.

**R6.6-13 · Nitpick · The clinician line on the summary is the last thing on the page, below the buttons.** On a phone it is below the fold. It does print (`rep-note` isn't hidden in print, verified). **Fix:** move it under the verdict, or into `.rep-meta`.

**R6.6-14 · Nitpick · "average wait" is still unglossed (R6.5-16).** It is door to provider, over every arrival, including patients still waiting at 19:00. STATUS doesn't mention it. **Fix:** "door-to-provider wait" on screen and in the CSV.

**R6.6-15 · Nitpick · `round5/STATUS.md` overclaims again.** It lists R6.5-04, -08 and -11 as fixed (they are partly fixed) and omits R6.5-13 and -16. **Fix:** a "Partly fixed" line for those three and a "Left" line for -13 and -16.

**R6.6-16 · Nitpick · The make box says nothing about grading or review.** "Make one (instructors)" still has no "not for grading" or clinician note (part of R6.5-08). The instructor first meets those caveats when results arrive. **Fix:** append `CB_NOTE` in small type under "Class results are on."

**Counts:** Critical 0 · High 0 · Medium 3 · Low 8 · Nitpick 5.

## 4. Coverage

**Reviewed:**

- **Content-change check:**
  - blob identity of `src/engine.js`, `src/map.js`, `test/golden.js`, `test/golden.json`, `rules10–12.js`;
  - an empty diff over every clinical source and rule test;
  - every `src/ui.js` hunk read.
- **Tests:**
  - `npm test` (exit 0, 694 ok, 0 FAIL, 71 answer keys unchanged);
  - `test/class_test.py` (67 ok).
- **What the numbers count**, in the engine through Node: `dxPick`, `assign` (`md.seen`), `signOrders` and `harmCheck` (harm), `boxDecide`, `missBox` and `autoDirection` (radio: only the attending's own answers and misses; `autoDirection` is off for the attending), `boxTick` (not on a stream), `endShift` (`walkout` only for the charge nurse, `fired` only for the attending), and deaths by owner.
- **Screens, in Chrome at 390×844:**
  - the make box;
  - an attending class shift's summary, print view and Send box;
  - the payload actually sent;
  - Run it back (name box empty) and the fired summary;
  - the instructor list for 7 attending rows and 3 charge nurse rows;
  - Copy table and Download CSV;
  - About (menu and first visit) and the Lessons header.
- **Code:** `cbRow`, `cbRows`, `CB_NOTE`, `CB_MDNOTE`, `cbDet`, `cbListHTML`, `cbTable`, `cbCell`, `cbArgs`, `cbWhat`, `cbSendHTML`, `showReport`, `scoreCardsHTML`, `aboutHTML`, and `clean_stats` and `cb_class_read` in the migration.
- **Texts:** README v0.31.0 and "For a class", About's Privacy section, the Lessons header, the summary's last line.

**Not checked:**

- **The live database and site.** Off limits.
- **`npm run db:test`.** Reviewer 3's area. I read the SQL that decides what is stored and shown.
- **The round-3 clinical findings.** The engine is byte-identical, so their state is unchanged.
- **WebKit and Firefox.** Chrome only.

**Side effect:** `class_test.py` wrote its screenshots to the gitignored `test/shots/`. No tracked file changed (`git status` is clean apart from this report).

## 5. What I'd keep

- **The unranked list in arrival order,** with the time sent and repeats marked. It reads as a class log, not a league table.
- **The attending's own numbers first, the department's after "dept.:".** That is the right split. It needs honest units (R6.6-02) and the missed calls in the export (R6.6-03).
- **The caveats travel with the data.** The CSV's first row carries `CB_NOTE` and `CB_MDNOTE`.
- **"staff walked out: shift ended early" and "fired" kept apart,** with an "Ended early" column.
- **The clinician-review line** on the list, in the export and on the printed summary. It is short, plain and true.
- **A clean phase:** the round-5 fixes touched no clinical content, so they introduced no clinical regressions.
