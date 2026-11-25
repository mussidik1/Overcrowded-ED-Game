# Reviewer 6, round 9: clinical accuracy and medical education

Role: board-certified emergency physician and paramedic educator. Branch `claude/sleepy-rubin-jot35n`, v0.31.0, HEAD `ba471b7`. Reviewed 2026-11-25. The committed `index.html` is byte-identical to a fresh `node build.js` of the tree (scratch copy), so every screen below is the source under review.

**Not re-reported (owner decisions or STATUS "left"):** the attending's scoring and stars (Phase 6; a fired attending listed at 89/100 with ☆☆☆ is the owner's scoring), radio calls on the main stream, and a real attending payload in `class_test.py` (STATUS says still a hand-written row).

**Scripts, output and screenshots** are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round9/r6/`.

| Script | What it does |
|---|---|
| `s1.js` → `s1.out` | Node against `src/engine.js`. (A) An own patient from before 07:00, assigned with `OC.assign` (so `md.seen` counts), dies with no code, body still here. (B) The death that fires the attending. (C) `OC.assign('md2', …)`: does it work, and what does rules13's md2 case actually test? (D) An own arrest at the end: unrun 0.4, 3 and 15 min before the end; unrun to death; run with every rhythm check right and lost; run and still running. (E) Legal risk 65 plus an unrun arrest 1 min before the end; legal risk 20 plus the same. (F) Fired by an unrelated +10 one minute after an own arrest. (G) Night deaths in 300 pre-rolls; (G2) a constructed one. (H) Complications = harm − contra, 40 shifts. (I) The "Can hurt them" text, and `CONTRA_WHY`. |
| `s2.js` → `s2.out` | 88 real attending shifts with the autopilot (`mdPlay`): what the own deaths are made of, the verdict text (a copy of `ui.js` `verdictOf` and the line at ui.js:3048), and how often an own arrest starts in the last 2 or 5 minutes. |
| `s3.js` → `s3.out` | Debugging a lost "Can hurt them" line in the first UI run. Cause: my construction left an eval task queued; not reachable in play (see Coverage). |
| `s4.js` → `s4.out` | Every case ordered the textbook way (the `rules10.js` key): which required drugs the order log files under "Also reasonable". |
| `s5.js` → `s5.out` | (a) Reproducible seeds for "The numbers were good" with calls to review. (b) Charge nurse: a patient from before 07:00 who dies late. (c) Arrests in progress at 07:00 in 400 pre-rolls. |
| `s6.js` → `s6.out` | A contraindicated drug ordered after a pulse comes back: does the order review name it? |
| `s7.js` → `s7.out` | 400 perfect codes (every rhythm check right, a doctor at the bedside at once) on the attending's own patient: how often the patient still dies. |
| `ui1.py` → `ui1.json`, `md.csv`, `shots/a-…` to `j-…` | Chrome at 390×844. One attending Five-Minute Rush class code, played in the page four ways and sent. **Pia:** legal risk 65 at 08:59; her own patient arrests 22 game seconds before the end. **Leo:** an own field arrest at the door, every rhythm check right, door to code 0 min, lost. **Uma:** an NSTEMI ordered by the book plus ibuprofen. **Max:** his own patient arrests at 07:50; an unrelated +10 fires him at 07:51. The four real payloads then feed the instructor's list, Copy table and Download CSV. Also About. |
| `ui2.py` → `ui2.json`, `shots/k-yourcall-*.png` | Chrome at 390×844, attending Rush. An NSTEMI, bacterial meningitis and status epilepticus, each ordered by the book; the in-shift "Your call" card. |

`fetch` is replaced in the page and every request that isn't to a local file is aborted. Both `leaked` lists are empty: nothing reached supabase.co or edcodeblack.com. `python3 test/class_test.py`: 95 ok, "No errors". `git status` shows only this report.

## 0. What changed in the engine, and did any clinical content change?

`git diff 87c9c13..ba471b7 -- src/engine.js` is five hunks, 24 lines:

| Where | Change |
|---|---|
| `signOrders`, engine.js:1887, 1924–1928 | `ul` = each contraindicated drug as "Name (contraWhy)"; stored as `ordLog.unsafe`; an unsafe drug alone now puts the patient in "Orders to review" |
| lost code, engine.js:2270; `arrestNoTeam`, 2315 | `p.tDied = G.t` |
| `leave`, engine.js:3380 | `S.expired` and `md.died` skip a death with `tDied < 0` (the night shift's) |
| `endShift`, engine.js:4401 | `deadHere`: every body still in the department, from `G.order` (not the `tArrive >= 0` list), except a death before 07:00. Used for `expired` and, with `p.mine`, for `md.died` |
| `endShift`, engine.js:4403–4404 | `arrestOpen`: the attending's own patients in a room, in arrest, with no code running (`ev !== 'doing'`). Each: `care(-40)`, `litAdd(15)`, an M&M line at severity 90. Reported as `md.arrestOpen`, sent as `mdArrestOpen` |

**No random draw added or moved.** None of the new lines call `chance`/`rnd`. **No clinical content changed:** `git diff --quiet 87c9c13..ba471b7` over `test/golden.*`, `rules.js`–`rules12.js`, `sim.js`, `stress.js`, `src/map.js` and `src3d` exits 0. `npm test`: exit 0, 709 "ok", 0 FAIL, "golden: 13 shifts, 3 stream checks, 20 codes, save round trip, 71 answer keys unchanged". `CASES`, `CONTRA`, `CONTRA_IF`, `CONTRA_WHY`, the code cards, lessons and glossary are the bytes rounds 3 to 8 judged.

**Every number, checked again in Node (`s1`, `s2`, `s5`, `s7`):**

| Case | Engine | Label true? |
|---|---|---|
| Own patient from before 07:00 (arrived −25, picked up with `OC.assign`, `md.seen` 1), dies unrun at 09:00, body here (`s1` A) | `md.died` 1, `expired` 1 | Yes. **R6.8-01 fixed** |
| The death that fires the attending (`s1` B) | fired, `md.died` 1, `expired` 1 | Yes |
| Another doctor's patient, really assigned to md2 (`s1` C) | assign ok, md2 queues the code; **ROSC** | rules13's md2 case never sees a death: R6.9-05 |
| Charge nurse, patient from before 07:00 dies at 08:40 (`s5` b) | "Died in the department" 1 | Yes (it isn't among "Arrived this shift" 15: R6.9-08) |
| A night death (died at 06:35, body here at 07:00) (`s1` G2) | `expired` 0, `md.died` 0 | Yes. In 700 real pre-rolls there was never one (`s1` G, `s5` c) |
| Own arrest unrun, 0.4 / 3 / 15 min before the end (`s1` D) | legal risk +15 each, care −40, M&M 90, `arrestOpen` 1 | Counted, but age-blind: R6.9-02 |
| Own arrest unrun to death, 25 min before the end | legal risk +15, care −40, `md.died` 1 | Same legal risk as an arrest 24 seconds old |
| Own arrest run, every check right, lost | legal risk 0, `md.died` 1, M&M 60 | Cheaper than unrun: yes. Worded as a failure: R6.9-03 |
| Own arrest run, still running at the end | nothing counted | Fair (a code in progress at handover) |
| Legal risk 65 + unrun arrest 1 min before the end (`s1` E) | `fail` null, `lit` 79, 3 stars | litbox says "Fired": R6.9-02 |
| Fired by an unrelated +10, own arrest 1 min old (`s1` F) | `lit` 95, litLog gains a +15 **after** the firing | R6.9-02 |
| Complications = harm − contra, ibuprofen + unneeded insulin, 40 shifts (`s1` H) | contra 40, unneeded 40, harm 61, harm − contra 21 = the 21 hypoglycemia M&M lines | Yes |
| "Can hurt them" (`s1` I) | "Ibuprofen (a heart attack isn't ruled out until the troponin is back)", "Ibuprofen (NSAIDs are harmful when chest pain could be the heart)" | Yes; names no diagnosis. **But** the same entry calls aspirin "Also reasonable": R6.9-01 |
| Verdicts, 88 autopilot shifts (`s2`) | Rush 0.85: 14 of 40 "Three stars. Now read the calls to review below."; 2 of 40 "The numbers were good" with a wrong disposition; the only own deaths (2 in 80 Rush shifts) were field arrests run perfectly | R6.9-03, R6.9-04 |

### Round-8 status

| ID | Status | Evidence |
|---|---|---|
| R6.8-01 own pre-07:00 deaths dropped, including the firing death | **Fixed** | `s1` A/B: `md.died` 1, `expired` 1 for an own patient from 06:35, and for the death that fires. Charge nurse too (`s5` b). |
| R6.8-02 STATUS overclaims | **Partly fixed** | `round8/STATUS.md` now corrects R6.7-01 and R6.7-07. It makes four new overclaims: "no 'numbers were good' … when there are calls to review" (false, R6.9-04); rules13 covers "a real other doctor's patient" (that patient gets ROSC) and "the complications count" (a range check) (R6.9-05); "the order review names each contraindicated drug" (not after ROSC, R6.9-07); "docs … corrected (R6.8-08)" (README unchanged). |
| R6.8-03 ledger "Harm" | **Fixed** | "Unsafe orders, complications and untreated patients −20" on Uma's ledger (`ui1.json`). |
| R6.8-04 order review never lists a contraindicated drug | **Fixed** | Uma: "Nadia H. · NSTEMI (heart attack) / Can hurt them: Ibuprofen (NSAIDs are harmful when chest pain could be the heart)" (`shots/f-uma-orders.png`). Gap after ROSC: R6.9-07. |
| R6.8-05 "Attending of the year" with wrong calls | **Fixed** | `s2`: 14 of 40 three-star Rush shifts with calls to review read "Three stars. Now read the calls to review below." The sibling sentence still praises: R6.9-04. |
| R6.8-06 rules13 tests the easy cases | **Partly fixed** | Pre-07:00 patient and the firing death are tested (rules13:56–66). The md2 case passes with a live patient ("outcome none", npm test line 704); the complications case is `0 <= comp <= 20` with a dead `h0` line; the night-death branch is untested; the 3-minute arrest penalty is asserted as intended. R6.9-05. |
| R6.8-07 fired verdict blamed the worst moments | **Fixed** | "'What raised your legal risk', above, lists every reason." The new end-of-shift penalty now adds a post-firing reason to that list: R6.9-02. |
| R6.8-08 docs | **Partly fixed** | Migration header now says "four more numbers" and lists four. About, Send box and list all say "mean door-to-provider wait". README's v0.31.0 paragraph still cites only `round4`–`round6/STATUS.md`, and "For a class" (README:92) still says "average wait". |

**Round-8 count:** 5 fixed, 3 partly fixed, 0 still open, 0 worse.

## 1. Verdict for use with real students

**Clinical content: unchanged, and still "only after major work".** No licensed clinician has reviewed it, and every results surface says so. This round I found one more content defect that eight rounds missed: the order review and the in-shift "Your call" card file required drugs under **"Also reasonable"**. A student who orders an NSTEMI by the book reads "Also reasonable: Aspirin." under "Aspirin and heparin." Bacterial meningitis gets "Also reasonable: Ceftriaxone", status epilepticus "Also reasonable: Lorazepam". Eight cases (R6.9-01).

**Class results:**

- **Charge nurse:** usable to open a debrief, not for grades. The department death count is now right whenever the patient arrived.
- **Attending:** usable to open a debrief beside the student's printed summary, not for grades. The round-8 count fixes hold. Two new labels mislead:
  - **"(1 of them died)" and the verdict treat a perfectly run, lost code as the student's failure.** In 80 autopilot Rush shifts the only own deaths were two field arrests run with every rhythm check right; both printed "One of your own patients died or was left in an arrest. Read the worst moments below." A perfect code still loses 23% to 52% of patients (`s7`). The list frames the count as "the attending's own work". A student who leaves the field arrest to another doctor shows 0 deaths (R6.9-03).
  - **The end-of-shift arrest penalty doesn't care how old the arrest is or why the shift ended.** An arrest 22 game seconds before the end (under one real second at 1×) costs the same +15 legal risk as a 20-minute abandoned code, reads "1 left in cardiac arrest with no code running at the end" on the list, and can print "Legal risk · Fired" on a three-star summary of a shift that was not fired. A fired attending gets a reason added after the firing (R6.9-02).

**Can the numbers be misread as clinical competence?** Less than in round 8: "Attending of the year" no longer prints over wrong calls. But "The numbers were good" still does (R6.9-04), and "own patients who died" is not risk-adjusted at all.

## 2. Score

**5 / 10** (round 8: 6).

- **Better:** the death counts are right whenever the patient arrived, including the firing death and the charge nurse's department; the unsafe drug is named in the order review; the ledger label is honest; "Attending of the year" is gone from shifts with calls to review; an unrun arrest at the end is no longer free.
- **Held down by:** the unreviewed content (the ceiling); a required-drug mislabel in eight must-not-miss cases, now printed next to the new "Can hurt them" line; an own-death count and verdict that punish taking the sickest patient; an end-of-shift penalty that can print "Fired" on a shift that wasn't; a STATUS file that again claims more than the code does.

## 3. New findings, worst first

### High

**R6.9-01 · High · Required drugs are filed under "Also reasonable" in eight must-not-miss cases: aspirin in STEMI and NSTEMI, ceftriaxone and vancomycin in bacterial meningitis, lorazepam in status epilepticus**

- **Location:**
  - engine.js:1867, the combination branch of `signOrders`: a drug that fills one group of an `RXREQ` combination but doesn't complete it goes to `drugOk` (`else drugOk.push(D.n)`).
  - engine.js:1889, `fl.push(...drugOk)`; `fl` is commented "reasonable orders. Not required, not counted against you" and becomes `ordLog.fine`.
  - ui.js:1131 `mdDecideBlock` (the in-shift "Your call" card) and ui.js:3093 `ordLogHTML` (the summary's "Orders to review") print `fine` as "Also reasonable: …".
  - Origin: `b65e32b` (v0.29.0). Not reported in eight audit rounds (`grep -rn "Also reasonable" docs/audit` is empty).
- **What's wrong (verified):**
  - **Every case, textbook orders (`s4.out`):** 8 cases print a required drug as "Also reasonable":

    | Case | Textbook drugs | "Also reasonable" | Same box, "The workup" |
    |---|---|---|---|
    | NSTEMI | asa, heparin | **Aspirin** | "Aspirin and heparin." |
    | Anterior STEMI | asa, heparin | **Aspirin** | "Aspirin and heparin." |
    | Bacterial meningitis | ctx, vanc, ampi, dexa | **Ceftriaxone, Vancomycin** | "Ceftriaxone and vancomycin, with dexamethasone" |
    | Status epilepticus | loraz, levet | **Lorazepam** | "Lorazepam IV now, then a second drug" |
    | Subdural on a blood thinner | pcc, vitk | **4-factor PCC** | "Reverse it." |
    | Hyperkalemia | calc, d50, insreg | **Calcium chloride** | "Calcium protects the heart" |
    | Necrotizing fasciitis | vanc, piptazo, clinda | **Vancomycin, Piperacillin-tazobactam** | "Broad antibiotics (vancomycin, piperacillin-tazobactam, clindamycin)" |
    | Spinal epidural abscess | vanc, ctx | **Vancomycin** | "vancomycin and ceftriaxone" |

  - Which drug is mislabelled depends on order: heparin then aspirin prints "Also reasonable: Heparin" (`s4`).
  - Aspirin alone, heparin later: "Missed: Medications (heparin)" beside "Also reasonable: Aspirin" (`s4`).
  - **In the page, during play (`ui2.json`, `shots/k-yourcall-nstemi.png`, `-mening.png`, `-status.png`):** "YOUR CALL · NSTEMI (HEART ATTACK) / The workup: ECG and troponin make the diagnosis. Aspirin and heparin. … / Also reasonable: Aspirin." The same for meningitis ("Also reasonable: Ceftriaxone.") and status epilepticus ("Also reasonable: Lorazepam."). This is on every correctly ordered patient of these eight kinds, every shift.
  - **On the summary (`ui1.json`, Uma; `shots/f-uma-orders.png`):** the round-8 fix (R6.8-04) logs a patient whose only problem is an unsafe drug. So Uma's NSTEMI now reads "Can hurt them: Ibuprofen (…) / **Also reasonable: Aspirin** / ECG and troponin … Aspirin and heparin." The new line puts the mislabel on the page students hand in.
- **Why it matters:** in the game's own three-way vocabulary ("Missed" = required, "Not needed" = wrong, "Also reasonable" = optional and not counted), aspirin in acute coronary syndrome, empiric antibiotics in meningitis and a benzodiazepine in status epilepticus are taught as optional. Those are Class I, time-critical, mortality-reducing therapies and core exam content for every audience this game names. The correct sentence sits directly above the wrong label, so the card contradicts itself: a student has to guess which line is true. That keeps it at High, not Critical.
- **Fix:**
  - In `signOrders`, keep a drug that fills part of a combination out of `fl`: push it to a separate list (`part`), or drop it from `fl` once the group completes. A partial combination stays visible through "Missed: …" as it does now.
  - `rules10.js`: for every case, assert that no drug from `RXREQ[case]` (or `REQ_AGE`) is in `ordLog.fine` after the textbook order, in both drug orders.
  - `golden.json` may not move (it doesn't fingerprint `ordLog.fine`); if it does, say so.
- **Effort:** S.

### Medium

**R6.9-02 · Medium · The end-of-shift arrest penalty ignores how old the arrest is and why the shift ended: an arrest seconds old costs as much as an abandoned code, a not-fired summary can read "Legal risk · Fired", and a fired attending gets a reason added after the firing**

- **Location:** engine.js:4403–4404 (`arrestOpen` and its `care(-40)`, `litAdd(15)`, `mm(90)`), which run after `G.over = true` (4398); ui.js:3072 (`litHTML` picks "Fired" from `lit >= 75` alone); `litCheck`, engine.js:548–556 (sets a legal-risk card even when `G.over`); test/rules13.js:74 asserts the 3-minute case as intended ("3 minutes before the end: under the 20-minute rule").
- **What's wrong (verified):**
  - **Age-blind (`s1` D):** legal risk +15 for an own arrest unrun 0.4, 3 or 15 minutes before the end, the same +15 as an arrest left 20 minutes to die. The in-shift rule (`ARREST_NO_TEAM`, and the "Run the code" countdown at ui.js:982) gives the student 20 minutes.
  - **In the page (Pia, `ui1.json`; `shots/a-pia-summary-top.png`, `b-pia-mm.png`):** her own patient arrests at 119.64 of 120 game minutes, 22 game seconds before the end (0.9 real seconds at 1×, 0.2 at 4×).
    - M&M #1: "Walt V. was in cardiac arrest when the shift ended, and nobody was running the code / Run the code: an arrest nobody runs is a death".
    - Verdict: "One of your own patients died or was left in an arrest."
    - List row: "saw 10 patients, **1 left in cardiac arrest with no code running at the end**". CSV: "Own patients left in an unrun arrest (attending) 1".
  - **"Fired" on a shift that wasn't (Pia; `s1` E):** legal risk 65 at 08:59 plus that arrest: `R.fail` null, `R.lit` 79, three stars, heading "Attending shift summary", and the litbox reads "**79% Legal risk · Fired**".
  - **A reason added after the firing (Max, `ui1.json`; `shots/g-max-summary-top.png`, `h-max-mm.png`; `s1` F):** his own patient arrests at 07:50; an unrelated +10 fires him at 07:51.
    - "What raised your legal risk" (which the fired verdict says "lists every reason"): "+10: a wrong medical direction order (test step)" and "+15: Ruth E.: in cardiac arrest at the end of the shift with no code running". Legal risk 95.
    - The only M&M line is that arrest.
    - List row: "1 left in cardiac arrest with no code running at the end · fired (legal risk) at 07:51". An instructor reads "abandoned a code, then got fired" for an arrest one minute old at the moment his contract ended.
  - **State after the end (`s1` E):** legal risk 20 → 34 at `endShift` sets G.card "A call from the hospital administrator" on a finished game. Invisible today (the report scene doesn't draw cards), but it is the engine changing the game after it ended.
  - **How often:** rare. No own arrest started in the last 5 minutes of 88 autopilot shifts (`s2`). When it happens, three surfaces state something false or unfair, and the test locks it in.
- **Fix:**
  - Count every open arrest (that part is right), but apply the penalty only if the arrest is old enough to have been run, e.g. `G.t - p.tArrest >= 5`. Say its age in the M&M: "arrested 0 min before the end".
  - Skip the penalty, keep the count, when `G.fail` is set: the attending was gone.
  - In `litHTML`, "Fired" only when `R.fail === 'fired'`; otherwise cap the shown stage below it. In `litCheck`, return early when `G.over`.
  - rules13: an arrest at `shift − 0.5` is counted with no legal risk; one at `shift − 15` gets the penalty; a fired shift gets no litLog entry after `endMin`.
- **Effort:** S.

**R6.9-03 · Medium · "Own patients who died" and the new verdict treat a perfectly run, lost code as the student's failure, and reward leaving the sickest patient to another doctor**

- **Location:** ui.js:3015–3018 (`verdictOf`: `m.died || m.arrestOpen` → "One of your own patients died or was left in an arrest. Read the worst moments below."); ui.js:3048 (the same test blocks "The numbers were good"); engine.js:2271 (a lost code's M&M line, severity 60, under "your worst moments"); `md.died` counts lost codes and no-code deaths alike; `cbDet` "(N of them died)"; `CB_MDNOTE` (ui.js:2174): "The attending's own work is the patients they saw (and how many of them died)".
- **What's wrong (verified):**
  - **Real shifts (`s2`):** 80 autopilot Rush shifts at 100% and 85% accuracy. The only own deaths, 2, were field arrests run with every rhythm check right. Both shifts read "1 died in the dept. One of your own patients died or was left in an arrest." At 100% accuracy, 36 of the other 39 shifts read "Attending of the year".
  - **Perfect codes (`s7`, 400 codes, every check right, a doctor at the bedside at once):**
    - Field VF: 46 of 100 die.
    - VF from a STEMI in the ED: 23 of 98 die.
    - PE with PEA: 52 of 100 die.
    - Overdose with PEA: 42 of 100 die.

    Those rates are realistic. The labels are what's wrong.
  - **In the page (Leo, `ui1.json`; `shots/d-leo-summary-top.png`, `e-leo-mm.png`):** his own field arrest, door to code 0 minutes, 3 of 3 rhythm checks right, lost.
    - Verdict: "1 patient died in the department. One of your own patients died or was left in an arrest. Read the worst moments below."
    - "M&M · your three worst moments": "Lucia H. died after a VF / 3 of 3 rhythm checks right; the team got there 0 min after the arrest".
    - The list: "saw 8 patients (1 of them died)", under a note calling that number "the attending's own work". CSV: "Own patients died (attending) 1".
  - **The incentive:** an unassigned arrest shows "Another doctor takes it in a minute if you don't" (ui.js:980), and another doctor's patient never counts against the student (`s1` C). A student who lets the field arrest go shows 0 deaths. One who takes it and runs it perfectly shows a death about half the time.
  - Before round 8 the verdict came from the stars. The round-8 verdict change (for R5.8-05 and R6.8-05) made a death after a perfect code override praise the student had earned.
- **Standard:** unadjusted mortality is not a performance measure in any EM or EMS quality program. An M&M conference reviews deaths for *preventable* error. Telling a student that a perfectly run, unsurvivable code is one of their "worst moments" teaches the wrong lesson about resuscitation and about debriefing.
- **Fix:**
  - Engine: split `md.died` into `diedNoCode` (no team, unrun) and `codeLost` (a code the attending ran), keeping the checks-right score. The second migration isn't applied yet, so add `mdCodeLost` to `clean_stats` and `client_call.json` now.
  - Verdict: the negative line only for no-code deaths and unrun arrests. For a lost code with every check right and the wait ≤ 3: "You ran X's code by the book. Not every arrest comes back."
  - M&M: list a lost code only when a rhythm check was wrong or the wait was over 3 minutes.
  - List and CSV: "1 died after a code they ran (3 of 3 checks right)". `CB_MDNOTE`: "Deaths include patients who arrived in cardiac arrest; many die even with a perfect code."
- **Effort:** S–M.

### Low

**R6.9-04 · Low · "The numbers were good" still prints over calls to review; the round-8 STATUS says it doesn't**

- **Location:** ui.js:3048: `R.stars >= 2 && !(R.mode === 'md' && R.md && (!R.md.seen || R.md.died || R.md.arrestOpen))`. It checks deaths, not `dxWrong`, `dispoWrong`, `contra`, `unneeded` or `untreated`, which `verdictOf` counts as calls to review.
- **What's wrong (verified, `s5` a, `s2`):** Rush seeds 12077 and 12182 (autopilot at 85%): three stars, one department death (not the student's), one wrong disposition. Verdict: "1 patient died in the department. The numbers were good; read the worst moments below." 2 of 40 Rush shifts at 85%. `round8/STATUS.md`: "no 'numbers were good' or 'Attending of the year' when an own patient died **or there are calls to review**".
- **Fix:** use the same calls-to-review test in the guard, falling through to `verdictOf`.
- **Effort:** XS.

**R6.9-05 · Low · rules13 still tests less than it claims**

- **Location:** test/rules13.js.
- **What's wrong (verified):**
  - **Line 68–71, "another doctor's patient (md2) who arrests":** the patient gets ROSC. The assertion `md.died === 0` holds trivially; the test's own output says so: "(md.died 0, **outcome none**)" (npm test line 704; `s1` C reproduces it). No death of another doctor's patient is tested. STATUS lists "a real other doctor's patient" as covered.
  - **Line 49:** "another provider's patient" is still an unassigned patient (`p.prov = null`), the misnomer R6.8-06 named.
  - **Line 81–82, complications:** `comp >= 0 && comp <= 20` over 20 shifts, with `h0 += OC.G.mm ? 0 : 0`, a line that always adds 0. It would pass if `harmCheck` never fired. The comment promises "exactly the unneeded treatments that went wrong"; `s1` H shows the real check is easy (harm − contra = 21 = the 21 hypoglycemia M&M lines).
  - **Line 74:** asserts the 3-minute arrest penalty as intended (R6.9-02).
  - **Nothing tests** the night-death exclusion (`tDied < 0` in `leave` and `deadHere`): `grep tDied test/` is empty. Nothing tests a code the attending ran and lost.
- **Fix:** pick a seed where md2's code is lost (or force `codeOdds` to 0 through the code's wait) and assert `md.died` 0 with `expired` 1; assert harm − contra equals the count of "without an indication" complications and is above 0; a constructed night death (as `s1` G2) with `expired` 0; a lost own code with `md.died` 1; correct the STATUS lines.
- **Effort:** S.

**R6.9-06 · Low · The Send box and About don't name a number that is sent**

- **Location:** ui.js:2250 `cbWhatAll` ("your patients (and how many died), diagnoses, unsafe orders and radio calls"); ui.js:2976, About's Privacy list ("patients seen and how many died, diagnoses right and wrong, unsafe orders and their complications, and radio calls"); `cbArgs` sends `mdArrestOpen` (and `harm`).
- **What's wrong (verified, `ui1.json` `pia_sent`, `about`):** Pia's payload has `"mdArrestOpen": 1`. Neither the Send box she reads before tapping Send nor About's list of what is sent mentions patients left in an arrest. The Send box also still omits complications (the rest of R6.7-05). Every other sent number is named, so this is the one gap.
- **Fix:** add "and any left in cardiac arrest at the end" to both; "unsafe orders and their complications" in the Send box.
- **Effort:** XS.

**R6.9-07 · Low · A contraindicated drug ordered after a pulse comes back is counted but never reaches "Orders to review"**

- **Location:** engine.js:1926, `else if (p.ordLog)`. After ROSC the engine sets `p.ord = 'signed'` and `p.right` (2265) with no `ordLog`, so a later order takes neither branch.
- **What's wrong (verified, `s6.out`):** an own STEMI, ROSC after a perfect code, then ibuprofen: `contra` 0 → 1 (the instructor sees "unsafe orders 1"), `ordLog` undefined, `md.log` undefined. The order review has no entry for it. The sign message says "0 orders signed for Room 4". STATUS: "the order review names each contraindicated drug and why."
- **Fix:** when `p.ordLog` is missing and `ul` or `xl` isn't empty, create the entry and log it.
- **Effort:** XS.

### Nitpick

**R6.9-08 · Nitpick · Wording and docs**

- **Two deaths, one sentence.** "One of your own patients died or was left in an arrest" prints for two deaths too, and doesn't say which happened.
- **Death and arrivals don't share a base.** "Died in the department" now counts patients who arrived before 07:00; "Arrived this shift" doesn't (`s5` b: died 1, and the dead patient isn't among the 15 arrivals). A rate made from the two columns of the CSV is wrong.
- **The in-shift card leaves out the unsafe drug.** The "Your call" card shows "Not needed" and "Also reasonable" but not "Can hurt them" (ui.js:1131).
- **Docs.** README's v0.31.0 paragraph still cites only `round4`–`round6/STATUS.md`; README:92 still says "average wait".
- **The database's `harm`.** `harm` still means "unsafe drugs plus complications". Only the game's UI subtracts `contra`, and the migration header doesn't define it.

**Counts:** Critical 0 · High 1 · Medium 2 · Low 4 · Nitpick 1.

## 4. Coverage

**Reviewed:**

- **Engine:** `git diff 87c9c13..ba471b7 -- src/engine.js` (all five hunks); `signOrders` in full; `awaitOrders`, `taskStart`/`taskDone`, `assign`, `toArrest`, `codeStart`, `codeOdds`, `codeOutcome`, `codeEnd`, `arrestNoTeam`, `leave`, `endShift`, `litAdd`/`litCheck`, `care`, `mm`, `newGame`/`startShift`/`orphanPatients`, `contraOf`, `CONTRA_WHY`, `RXREQ` and the `addCase` `req` entries, `mdPlay`'s code handling.
- **Content-change check:** `git diff --quiet` over golden, rules 1–12, sim, stress, map and src3d; `npm test` (709 ok, 0 FAIL, golden unchanged).
- **Tests:** `test/rules13.js` line by line, against its own output; `test/class_test.py` (95 ok, "No errors") and its round-8 diff.
- **Node:** `s1`–`s7`: about 530 shifts and 600 constructed cases.
- **Screens (Chrome 390×844), from a Rush class code played in the page and sent four ways:** summary header, score cards, litbox and "What raised your legal risk", verdict, Send box, M&M, Orders to review, Your patients, ledger; the four real payloads; the instructor's list; Copy table; Download CSV; About's Privacy. Also the in-shift "Your call" card for three cases.
- **Text:** `verdictOf`, `VERDICT_MD`, `reportHTML`, `litHTML`, `mmHTML`, `ordLogHTML`, `mdReportHTML`, `mdDecideBlock`, `cbRow`, `cbDet`, `cbTable`, `cbArgs`, `cbWhatAll`, `cbSendHTML`, `CB_NOTE`, `CB_MDNOTE`, `aboutHTML`'s Privacy, `showReport`; README v0.31.0 and "For a class"; `round8/STATUS.md`.
- **The second migration, as the clinical reviewer:** `clean_stats` keeps `mdArrestOpen` (the contract test at privacy_test.sql:60 covers it through `client_call.json`); the header's "four more numbers" now lists four.

**Not checked:**

- **The live database and site.** Off limits.
- **The migration's security, limits and name rules, and `npm run db:test`.** Reviewer 3's area.
- **The case lessons' own cards** for the eight "Also reasonable" cases. The defect is in the order log and the in-shift card, not the lesson text.
- **WebKit and Firefox.** Chrome only.

**A false lead, ruled out.** In my first UI run, Uma's "Can hurt them" line vanished. My construction had set `ev = 'done'` while `OC.assign` had already queued an eval. That eval later ran `awaitOrders` and a second "first" order set, which replaced the log (`s3.out`). In play, an attending's patient gets one eval, so this isn't a game bug; the rerun with the real eval shows the line.

**Side effects:** `class_test.py` wrote screenshots to the gitignored `test/shots/`. The scratch build was in my scratch folder. `git status` shows only `docs/audit/round9/`.

## 5. What I'd keep

- **`deadHere`:** the dead counted from `G.order`, whatever their arrival time, with the night's deaths excluded by the time of death, not of arrival. That is the right rule, and it fixed both the attending's and the charge nurse's counts with one line.
- **`tDied` set at both death paths, before `leave`,** so an unroomed death is classified correctly too.
- **"Can hurt them: Ibuprofen (NSAIDs are harmful when chest pain could be the heart)":** drug, reason, no diagnosis given away.
- **"Three stars. Now read the calls to review below.":** keeps the owner's stars and stops the praise.
- **The unrun-arrest count itself,** sent and shown with its own label rather than folded into deaths.
- **A clean engine change:** no random draws, no content moved, and golden proves it.
