# Reviewer 6, round 8: clinical accuracy and medical education

Role: board-certified emergency physician and paramedic educator. Branch `claude/sleepy-rubin-jot35n`, v0.31.0. The brief names HEAD `87c9c13`; the working tree is `cbe992b` (round-8 R1/R2 fixes and the R1–R4 reports on top). `git diff 87c9c13..cbe992b -- src/engine.js test/golden.json test/rules*.js` is empty, and the `src/ui.js` hunks after `87c9c13` are focus handling, Set up results and retention wording only, so everything below holds for both. Screens were taken from the `index.html` in the tree. Reviewed 2026-11-25.

**Not re-reported:** the attending's scoring and stars (Phase 6, owner) and radio calls on the main random stream (owner). A fired attending listed at 88/100, and three stars on 19 of 20 Rush shifts played at 60% accuracy, are the owner's scoring, not findings. R6.8-05 is about the sentence printed under the stars, not the stars.

**Scripts, output and screenshots** are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round8/r6/`.

| Script | What it does |
|---|---|
| `s1.js` → `s1.out` | Node against `src/engine.js`. (A) Two contraindicated drugs in one order, with vitals 60 min later. (A2) The same drug ordered twice. (B) An unneeded insulin drip ordered, and the shift ended before it was given. (B2) The same drip ordered, then the patient assigned to another doctor (30 seeds). (B3) The same drip, patient kept (30 seeds). (C1–C6) Deaths: an own patient who arrived during the shift, an own patient who arrived **before 07:00**, the own death that fires, another doctor's patient, a handed-off patient. (D) Fired two minutes after an own death. (E) Fired by radio orders alone. (F) The ledger after one contraindicated drug. (G) Radio denominators and the two wait numbers on 6 shifts. |
| `s2.js` → `s2.out` | Real shifts with the attending autopilot (`mdPlay`). (N1) Rush, three seeds: an own patient who arrived before 07:00 arrests 32 min before the end, and nobody runs the code. (N2) Rush: that death fires the attending at 07:50. (N3) How many own patients arrived before 07:00. (N4) A charge nurse's department count for the same kind of death. |
| `s3.js` → `s3.out` | An NSTEMI ordered correctly plus ibuprofen: what "Orders to review", the M&M and the legal-risk list say. |
| `s4.js` → `s4.out` | 60 Rush attending shifts at three accuracies: how often "Attending of the year" goes with wrong diagnoses, dispositions or unsafe orders. |
| `ui1.py` → `ui1.json`, `md.csv`, `shots/a-…` to `l-…` | Chrome at 390×844. Makes an attending Five-Minute Rush class code and plays it in the page four ways. **Ava:** own patient (arrived 07:10) dies with no code at 08:48. **Nina:** own patient who arrived at 06:46 dies with no code at 08:48. **Fred:** own patient who arrived at 06:43 dies with no code and fires him at 07:50. **Ray:** radio only, lets one call ring out. Each one sends. The four real payloads then feed the instructor's list, Copy table and Download CSV. Also About. |
| `ui2.py` → `ui2.json`, `shots/m-…` to `o-…` | One NSTEMI patient gets ibuprofen and ketorolac in one order; three chest-wall patients get an insulin drip nobody needs. The summary, the sent payload, the list row and the table. |

`fetch` is replaced in the page, and every request that isn't to a local file is aborted. Both `leaked` lists are empty: nothing reached supabase.co or edcodeblack.com.

## 0. What changed in the engine, and did any clinical content change?

**The engine change is two hunks, four lines net, in `src/engine.js`** (`git diff 18a71f9..87c9c13 -- src/engine.js`):

| Where | Change | What it counts now |
|---|---|---|
| `signOrders`, engine.js:1910 | `S.unneeded++` moved here from `harmCheck`, guarded by `HARM[k] && !p.arrest && !(cardiovert in A-fib that may be shocked)` | One per unneeded HARM-listed treatment, **at signing** |
| `harmCheck`, engine.js:1956–1963 | the old `unneeded++` line removed | Only the dice complication (`md.harm++`) is left there |
| `endShift`, engine.js:4422–4423 | `md.died` = deaths counted when the body left + own dead (`p.mine`) still in the department, from `list` | The attending's own dead at the end of the shift, **but `list` (4397) drops every patient with `tArrive < 0`**: see R6.8-01 |

**No random draws were added or moved:** the `unneeded` line has no `chance()`, and the removed one sat before the existing `chance(h[0])`.

**No clinical content, scoring, answer key or lesson changed:**

- `git diff --quiet 18a71f9..HEAD -- test/golden.json test/golden.js test/rules10.js test/rules11.js test/rules12.js test/sim.js test/stress.js src/map.js src3d` exits 0.
- `npm test`: exit 0, **703 "ok", 0 FAIL**; "golden: 13 shifts, 3 stream checks, 20 codes, save round trip, 71 answer keys unchanged". The 8 new lines are `rules13.js`.
- `python3 test/class_test.py`: **95 ok, 0 FAIL**, "No errors".
- `md.harm` increments (1887, 1960) and `accuracy()` (608) are unchanged. `LESSONS`, `GLOSS`, Orientation, the orders, the code cards and the M&M text are untouched. The `src/ui.js` hunks are the class sheet and results, `morph`, the Send box, About, and the summary labels (`mdReportHTML`, `verdictOf`, `reportHTML`'s fired line).

**What each number counts now, against its label:**

| Case (evidence) | Engine | Screen | Label true? |
|---|---|---|---|
| Two contraindicated drugs, one order (`s1` A, `ui2`) | contra 2, harm 2; vitals 98/149 → 100/154 | Summary "Unsafe orders 2", "Complications (partly chance) 0" (harm − contra) | **Yes** |
| The same contraindicated drug re-ordered (`s1` A2) | refused ("Pick at least one order"); a second drug counts | — | Yes |
| Unneeded insulin, not yet given at the end (`s1` B) | unneeded 1, harm 0 (treatment at `verify`) | "Unsafe orders 1" | **Yes** (R6.7-03 fixed) |
| Unneeded insulin, then handed to Dr. Okafor (`s1` B2) | counted 30 of 30; complication 0 of 30 (`harmCheck` needs `mdMine`) | — | Yes. The handoff is engine-only: in the attending's UI the Change provider button is cleared (`b.length = 0`, ui.js:966). |
| Two contra + three unneeded, two hypoglycemias (`ui2`) | contra 2, unneeded 3, harm 4 | Summary "Unsafe orders 5", "Complications (partly chance) 2". List "unsafe orders 5 (complications, partly chance: 2)". CSV 5 and 2 | **Yes** |
| Own patient arrived after 07:00 (07:50 in `s1`, 07:10 for Ava), died 08:48, body still there (`s1` C1; `ui1` Ava) | md.died 1, expired 1 | "saw 7 patients (1 of them died)" | **Yes** |
| **Own patient arrived 06:40–06:59, died in the last 23 min** (`s1` C2; `s2` N1 ×3; `ui1` Nina) | **md.died 0, expired 0** | "Your own patients who died 0" under M&M #1 "Wei W. died in cardiac arrest with no code team"; verdict "Attending of the year" | **No:** R6.8-01 |
| **That death fires the attending** (`s2` N2; `ui1` Fred) | **md.died 0, expired 0**, fired 07:50 | Row "saw 4 patients · … 0 died · fired (legal risk) at 07:50" | **No:** R6.8-01 |
| Own death that fires, patient arrived during the shift (`s1` C3, D) | md.died 1 | — | Yes |
| Another doctor's patient (`s1` C4) | md.died 0, dept 1, no legal risk | — | Yes |
| Radio (`s1` G ×6, `ui1` Ray) | ans = right + wrong in 6 of 6 | List "5 of 6 right, 1 missed"; summary "answered 5 of 6", "right (of those you answered) 5 of 5" | **Yes** (R6.7-08 fixed) |
| "mean door-to-provider wait (all arrivals)" (`s1` G) | `avgWait()`: mean over this shift's arrivals; a patient never seen counts until they left or the shift ended | 25/17/23/16/26/21 against the student's median 21/15/20/17/25/18 | Named honestly on the list; still not on the student's summary (R6.7-04) |
| Fired (`ui1` Fred), early end | endMin 50 → "07:50" | "fired (legal risk) at 07:50 (these numbers cover only the part played)" | Yes |
| No patients (`ui1` Ray) | md.seen 0 | "You saw no patients this shift: the stars come from the radio calls and the department the computer ran." | **Yes** (R6.7-09 fixed) |

### Round-7 status

| ID | Status | Evidence |
|---|---|---|
| R6.7-01 own deaths lost in the last ~23 min and at firing | **Partly fixed** | Counted now for patients who arrived after 07:00 (`s1` C1, C3, D; `ui1` Ava). Still 0 for an own patient who arrived before 07:00, including the death that fires (`s2` N1, N2; `ui1` Nina, Fred): R6.8-01. |
| R6.7-02 "caused harm" / "Complications" counted contraindicated drugs | **Fixed** | Complications = harm − contra on the summary, list and CSV; Nadia-type case shows "Complications (partly chance) 0" (`s1` A). The ledger still books the drug as "Harm": R6.8-03. |
| R6.7-03 unneeded counted at administration | **Fixed** | Counted at signing: ordered-not-given 1 (`s1` B), handed off 30 of 30 (`s1` B2). |
| R6.7-04 list wait ≠ student's number | **Partly fixed** | List/CSV say "mean door-to-provider wait (all arrivals)". The student's summary still shows only the median (21 vs 25 on seed 8800). About still says "average wait", the Send box "the department's wait": three names. "All arrivals" doesn't say a never-seen patient's clock runs to the end. |
| R6.7-05 Send box left out sent numbers | **Partly fixed** | Department wording complete. The attending's `harm` (complications) is still sent (`cbArgs`) and not named in the Send box (`ui1` Ava `send`). |
| R6.7-06 fired verdict blamed diagnoses and harm | **Fixed** | Now "The worst moments below show what raised it." Can be false: R6.8-07. |
| R6.7-07 no tests for the counters or the payload | **Partly fixed** | `rules13.js` covers contra, unneeded, a body left and unleft, and `endMin`. It steps around the failing case, never tests the death that fires, and nothing tests the payload: R6.8-06. |
| R6.7-08 two radio denominators | **Fixed** | "Medical direction calls right (of those you answered)". |
| R6.7-09 "you saw no patients" skipped after a death | **Fixed** | `reportHTML` checks `md.seen` before "The numbers were good". |
| R6.7-10 `CB_MDNOTE` didn't name own deaths | **Fixed** | "the patients they saw (and how many of them died)". |
| R6.7-11 STATUS overclaims | **Still open** | `round6/STATUS.md` unchanged since `cde15e4`; `round7/STATUS.md` repeats the pattern: R6.8-02. |

**Round-7 count:** 6 fixed, 4 partly fixed, 1 still open, 0 worse.

## 1. Verdict for use with real students

**Clinical content: unchanged, and still "only after major work".** The tables, cards and lessons are the bytes rounds 3 to 7 judged; no licensed clinician has reviewed them, and every results surface says so.

**Class results:**

- **Charge nurse:** usable to open a debrief, not for grades. The department "died" count has the same blind spot as R6.8-01 for patients who were already in the department at 07:00.
- **Attending:** usable to open a debrief beside the student's printed summary. The round-7 labels are now honest: unsafe orders count orders, complications count only dice outcomes of unneeded treatments, and the radio denominators are named. **One count is still wrong where it matters most.** An own patient who arrived before 07:00 (the night's patients, whom the attending picks up first on a Rush) and who dies with the body still in the department is missing from "Your own patients who died", from "(N of them died)", from the CSV and from the department's deaths. That includes the death that gets the attending fired. Fred's row reads "saw 4 patients · … 0 died · fired (legal risk) at 07:50" when his own patient's no-code death fired him. Nina's summary reads "Attending of the year" above an M&M that says her own patient died with no code team.

**Can the numbers be misread as clinical competence?** Yes, by anyone who reads only the score column or the verdict line. The list's caveat ("mostly reflect the department the computer runs") is accurate and placed above the rows, but the student's own summary praises in words the instructor never sees: "Attending of the year. The residents want to copy your orders." prints on 16 of 19 three-star Rush shifts at 60% accuracy that had wrong diagnoses or dispositions (R6.8-05).

No Critical or High finding.

## 2. Score

**6 / 10** (round 7: 5).

- **Better:** complications no longer count contraindicated drugs; unneeded treatments are counted as orders; own deaths near the end count for most patients; radio denominators are named; "you saw no patients" always shows; `CB_MDNOTE` names deaths; a rules file for the counters.
- **Held down by:** the unreviewed clinical content (the ceiling); an own-death count that is still blind for the night's patients, which the STATUS file and the round-8 architecture review both call fixed; a "Harm" ledger line that undoes the act-versus-outcome split on the student's own score card.

## 3. Findings, worst first

### Medium

**R6.8-01 · Medium · Own patients who arrived before 07:00 are dropped from the end-of-shift death count (own and department), including the death that fires the attending**

- **Location:** engine.js:4397, `const list = G.order.map(...).filter(p => p.tArrive >= 0 && ...)`. The new own-dead term (4423) and the department's `expired` term (4405, the audit R5-02 fix) both filter `list`, so a body still in the department at the end is counted only if the patient arrived after 07:00. A death counted on leaving (3378) has no such filter.
- **The test knew:** `test/rules13.js:10` moves its patient to minute 60 with the comment "a patient who arrives during the shift (one placed at 0 arrived before it)". The failing case was seen and stepped around.
- **What's wrong (verified):**
  - **Constructed (`s1` C2):** own patient arrived 06:40, seen 07:05 (`md.seen` 1), dies with no code at 08:50 on a Rush. `md.died` 0, department `expired` 0. M&M: "Sofia P. died in cardiac arrest with no code team".
  - **Real Rush shifts (`s2` N1, seeds 9101, 9107, 9109):** the autopilot attending's own patients who arrived at 06:54, 06:44 and 06:59 die 12 minutes before the end. All three: `md.died` 0, `expired` 0, and the death is M&M #1.
  - **The firing (`s2` N2, seed 9200):** legal risk 62, own patient (arrived 06:50) dies with no code at 07:50, +15 fires the attending. `md.died` 0, `expired` 0. `litLog`: "Yara K.: died in cardiac arrest and no code was run".
  - **In the page (`ui1.json`; `shots/e-nina-summary-top.png`, `f-nina-your-patients.png`, `g-fred-summary-top.png`, `h-fred-your-patients.png`):**
    - Nina: "Your own patients who died 0", M&M #1 "Wei W. died in cardiac arrest with no code team", and the verdict "**Attending of the year. The residents want to copy your orders.**" (with `expired` 0, the "1 patient died in the department" prefix is skipped).
    - Fred: "Your group let you go", M&M #1 "Keisha W. died in cardiac arrest with no code team", "Your own patients who died 0". His list row: "saw 4 patients · … · department: … 0 died · **fired (legal risk) at 07:50**". The CSV: "Own patients died 0", "Died (dept.) 0".
  - **Charge nurse too (`s2` N4):** a patient who arrived at 05:42 dies with no code late in a Rush: "Died in the department 0".
  - **How often:** on Rush (the class level), 12 of 104 own patients arrived before 07:00, and they are the first ones the attending picks up (`s1` C2b). Any no-code death of one of them that fires the attending is lost, at any time; any other is lost in the last ~23 minutes. 9 of 391 on Manic Monday (`s2` N3).
- **Standard:** the same as R6.7-01. A count labelled "your own patients who died" must agree with the same page's M&M, and the death that ended the shift is the first thing a debrief discusses.
- **Fix:**
  - Record the time of death at both in-room death paths (2269 and 2314: `p.tDied = G.t`).
  - In `endShift`, count the dead from `G.order`, not `list`: `const dead = p => p.loc !== 'gone' && ['family', 'morgue', 'morguing'].includes(p.dsp) && (p.tDied == null || p.tDied >= 0)`. Use it for `expired` and, with `p.mine`, for `md.died`. (A patient can only become `mine` after 07:00: 0 of 6 seeds in round 7.)
  - In `leave`, skip `S.expired++` for a body whose death was before 07:00 (`p.tDied < 0`), so a night death isn't charged to the day shift.
  - **Tests (`rules13.js`):** place the patient at minute 0 (it arrives at −25), assign it with `OC.assign`, let it die unrun, end: `md.died` 1, `expired` 1. The same with legal risk at 62: fired, `md.died` 1.
  - `golden.json` may move if a recorded shift has such a death; no random draw is involved.
- **Effort:** S

### Low

**R6.8-02 · Low · The round-7 STATUS calls R6.7-01 and R6.7-07 fixed; the round-6 STATUS is still not corrected**

- **Location:** `docs/audit/round7/STATUS.md:21–23`: "The dead whose bodies haven't left by the end of the shift count too, once … `test/rules13.js` checks it, and the other new counters (R6.7-07)." `docs/audit/round6/STATUS.md` is unchanged since `cde15e4`.
- **What's wrong:**
  - The claim is false for patients who arrived before 07:00 (R6.8-01), and the test that "checks it" was written to avoid them.
  - R6.7-07 asked for a payload test (a real attending's `mdSeen`, `mdDied`, `contra`, `unneeded`, `radioMiss` against the report). `class_test.py` still feeds a hand-written "Ida" row.
  - The overclaim propagated: `docs/audit/round8/reviewer-1-architect.md:17` marks R1.7-01 "Fixed" on the strength of `rules13.js`.
  - R6.7-11 (the round-6 file's four overclaims) got no response.
- **Fix:** mark R6.7-01 and R6.7-07 "Partly fixed" with the reason, and add the "Partly fixed" lines R6.7-11 asked for.
- **Effort:** XS

**R6.8-03 · Low · The student's ledger and Clinical card still call a contraindicated drug "Harm"**

- **Location:** engine.js:1887, `care(-20, 'harm', p)` for each contraindicated drug; ui.js:3033, `harm: 'Harm and untreated patients'`; ui.js:3068, "Hurt most:".
- **What's wrong (verified):**
  - One ibuprofen order in chest pain, nothing happening to the patient (vitals 96/154): `ledger.harm` −20 (`s1` F).
  - `ui2` (`shots/m-unsafe-summary-top.png`): "Hurt most: Harm and untreated patients" on the Clinical card, and "Harm and untreated patients −90" in "Where your points came from", of which −40 is two NSAIDs that did nothing.
  - Round 7 split the unsafe act from the harm on the instructor's list and the summary table (R6.7-02, "one label everywhere"). The student's own score card puts them back together. Patient-safety teaching (an error that reached the patient vs. an adverse event) is exactly the distinction a nursing or EM class is graded on.
- **Fix (label only, no scoring change):** rename the ledger line to "Unsafe orders, complications and untreated patients". Or give contraindicated drugs their own care key ("Unsafe orders") added to the same score tags; that keeps every score and may move `golden.json`.
- **Effort:** XS

**R6.8-04 · Low · "Orders to review" never lists a contraindicated drug**

- **Location:** engine.js:1863 sends contraindicated drugs to `contraX`, never to `xl`; the order log (1923) holds `extra: xl` and `fine: fl` only, and `logOrders` runs only when something is missed or extra.
- **What's wrong (verified, `s3.out`):** an NSTEMI ordered correctly plus ibuprofen. "Unsafe orders 1". `md.log` is empty, so the summary's "Orders to review" has no entry for that patient at all. The drug shows only in the M&M (top three by severity, so it can be pushed out by worse moments) and in the collapsed "What raised your legal risk".
  - The list now puts "unsafe orders N" beside the student's name. The student's order review should name them.
- **Fix:** add an `unsafe` list to `ordLog` (drug name and `contraWhy`), call `logOrders` when it's non-empty, and render "Can hurt them: ibuprofen (NSAIDs are harmful when chest pain could be the heart)" in `ordLogHTML`.
- **Effort:** S

**R6.8-05 · Low · "Attending of the year. The residents want to copy your orders." prints on three-star shifts with wrong diagnoses, wrong dispositions and unsafe orders**

- **Location:** ui.js:3010 `VERDICT_MD[3]`, chosen by `R.stars` alone (`verdictOf`, 3008).
- **What's wrong (verified, `s4.out`):** 60 Rush attending shifts. At 60% accuracy, 19 of 20 get three stars with no death, and **16 of those 19** had a wrong diagnosis, a wrong disposition, an unsafe order or an untreated patient (one: 3 wrong diagnoses, a wrong disposition, accuracy 75%). At 90%, 8 of 18. `ui1` Nina: "Attending of the year" with two patients sent home who needed admission or the ICU (one a massive PE).
  - The stars are the owner's. The sentence is a competence claim, printed on a page the student may hand in, and it is the line a student quotes. R6.6-09 fixed the same sentence for a student who saw no patients.
- **Fix (copy only):** when `md.dxWrong + md.dispoWrong + contra + unneeded + md.untreated > 0`, print "Three stars. Now read the calls to review below." instead of the praise.
- **Effort:** XS

**R6.8-06 · Low · `rules13.js` tests the easy cases and misnames one**

- **Location:** `test/rules13.js`.
- **What's wrong:**
  - Line 10: patients are placed at minute 60 so they arrive after 07:00; the failing case (R6.8-01) is never tested.
  - Lines 47–54: "another provider's patient" sets `p.prov = null`. That is an *unassigned* patient, whose no-code death the engine bills to the attending (+15 legal risk, engine.js:2311). It doesn't test another provider at all (`s1` C4 does, with Dr. Okafor), and it depends on finding a lost code in seeds 7300–7339.
  - Line 57: the "fired" test sets `G.fireNow` on an empty shift. The case R6.7-01 named, an own death that fires, isn't tested.
  - `mine()` sets `p.mine` by hand, so `md.seen` stays 0 and no test checks that the dead are among the "patients you saw".
  - Nothing checks the invariant the UI depends on (complications = `harm − contra`), or that `showReport`/`cbArgs` send `R.md.died`, `contra`, `unneeded`, and `endMin` null on a full shift.
- **Fix:** the two R6.8-01 tests; a real other provider via `OC.assign(otherMd, …)`; a rule that `md.harm − md.contra` equals the number of "without an indication" M&M entries; one attending shift in `class_test.py` whose payload matches its report.
- **Effort:** S

### Nitpick

**R6.8-07 · Nitpick · The fired verdict says the worst moments "show what raised it", and sometimes they don't**

- **What:** three legal-risk sources never make an M&M entry: a wrong radio order (+3), a missed diagnosis that isn't must-not-miss (+2), and talking to a lawyer (+6). Three M&M kinds raise no legal risk: a code the attending ran and lost, hemorrhagic shock, and missed time goals. Constructed (`s1` E): fired by radio orders, and the page reads "Your group let you go … The worst moments below show what raised it" over an M&M that says "Nothing went badly wrong this shift. Take the win." The list that does show it ("What raised your legal risk") is above the verdict, collapsed.
- **Fix:** "…mid-shift. What raised your legal risk, above, lists every reason." And don't print "Take the win" on a fired summary.

**R6.8-08 · Nitpick · Docs**

- **What:**
  - README's v0.31.0 paragraph still says "two rounds of review of the fixes" and cites only `round4` to `round6/STATUS.md`.
  - The second migration's header says "four more numbers from the attending's own work (…)" and lists three, then `endMin`.
  - About calls the wait "average wait", the Send box "the department's wait", and the list "mean door-to-provider wait (all arrivals)" (the rest of R6.7-04).
- **Fix:** update the paragraph; "three more numbers from the attending's own work … and the minute an early-ended shift stopped"; one name for the wait everywhere.

**Counts:** Critical 0 · High 0 · Medium 1 · Low 5 · Nitpick 2.

## 4. Coverage

**Reviewed:**

- **Engine:** `git diff 18a71f9..87c9c13 -- src/engine.js` (both hunks), and `87c9c13..HEAD` (empty). `signOrders` in full, `harmCheck`, `HARM`, `assign`/`unassign`/`canAssign`, `mdMine`, `toArrest`, `arrestNoTeam`, the lost-code path, `leave`, `endShift`, `avgWait`, `metrics`, `litAdd` and every caller, `mm()` ownership, `boxDecide`, `mdPlay`, `trainPatient`, `newGame`/`startShift`/`seedBoarders`.
- **Content-change check:** `git diff --quiet` over golden, the rules files 10–12, sim, stress, `map.js` and `src3d`; every `ui.js` hunk in `18a71f9..HEAD`.
- **Tests:** `npm test` (703 ok, 0 FAIL, golden unchanged), `test/class_test.py` (95 ok), `test/rules13.js` read line by line.
- **Node:** `s1`–`s4`, about 120 shifts and 90 constructed cases.
- **Screens, Chrome 390×844, from Rush class codes played in the page and sent:** the make box, four attending summaries (normal, night death, fired by a night death, radio only) and one constructed unsafe-orders summary: header, score cards, litbox, verdict, clinician line, Send box (it now sits at 583–630 px on an 844 px screen), M&M, "Your patients", ledger; the real payloads; the instructor's list; Copy table; Download CSV; About.
- **Text:** `cbRow`, `cbRows`, `cbDet`, `CB_NOTE`, `CB_MDNOTE`, `cbTable`, `cbArgs`, `cbWhat`, `cbWhatAll`, `cbSendHTML`, `cbRegHTML`, `aboutHTML`, `verdictOf`, `VERDICT_MD`, `reportHTML`, `mdReportHTML`, `mdDeptHTML`, `scoreCardsHTML`, `ordLogHTML`, `mmHTML`, `showReport`; README v0.31.0, v0.30.0 and "For a class"; `round7/STATUS.md`, `round6/STATUS.md`.
- **The second migration:** read as the clinical reviewer, for what it keeps of the attending's numbers. `clean_stats` keeps `mdDied`, `contra`, `unneeded`, `endMin` and the rest as whole numbers 0 to 999,999, and drops `scen`. It stores `harm` as the engine's combined count; only the game's UI subtracts `contra`, so anyone reading the table directly sees "harm 2" for two contraindicated drugs that did nothing.

**Not checked:**

- **The live database and site.** Off limits.
- **The migration's SQL security, rate limits and name rules, and `npm run db:test`.** Reviewer 3's area.
- **The round-3 clinical findings.** The clinical tables are unchanged, so their state is unchanged.
- **WebKit and Firefox.** Chrome only.

**Side effects:** `class_test.py` wrote its screenshots to the gitignored `test/shots/`. `git status` was clean before this report.

## 5. What I'd keep

- **The unsafe-orders count:** per order, at signing, independent of the dice and of who has the patient later. It is now what its label says.
- **"Complications (partly chance)" as harm − contra:** the act and the outcome are separate on the list, the summary table and the CSV.
- **"(of those you answered)"** on the summary and "N of M right, K missed" on the list: two denominators, both named.
- **The ended-early tag** with the clock time and "these numbers cover only the part played".
- **Owner over chance:** another provider's patient is never charged to the student (`s1` C4).
- **A clean engine change:** four lines, no random draws, no content or scoring moved, and `golden.json` proves it.
