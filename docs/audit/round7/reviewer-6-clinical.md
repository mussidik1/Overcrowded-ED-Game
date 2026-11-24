# Reviewer 6, round 7: clinical accuracy and medical education

Role: board-certified emergency physician and paramedic educator. Branch `claude/sleepy-rubin-jot35n`, v0.31.0, HEAD `18a71f9`. The round-6 fixes are `git diff 6328cdf..18a71f9`. Reviewed 2026-11-24.

**Not re-reported:** the attending's scoring (Phase 6, owner) and moving radio calls to their own random stream (owner). I judge only what the screens now say about them. A fired attending listed at 87/100, and a student who saw no patients at 90/100 ★★★, are the owner's scoring. They are not findings here.

**Scripts, output and screenshots** are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round7/r6/`.

| Script | What it does |
|---|---|
| `s1.js` | Node against `src/engine.js`. It covers four cases. (A) Two contraindicated drugs in one order for one patient. (A2) What a contraindicated drug does to the patient over 60 minutes. (B) An unneeded insulin drip on 60 seeds: when it is counted, and how often harm follows. (B2) The same drip ordered, then the patient handed to another doctor. Then: own and others' deaths, a code run and lost, and `endMin` for a fired attending and a full Rush. Output: `s1.out`. |
| `s2.js` | Real arrivals. An own patient arrests 32 min before the end of a Rush (3 seeds) and of a Manic Monday; nobody runs the code. An own patient's no-code death that gets the attending fired. A charge nurse walkout. Patients marked "mine" before 07:00. 24 ordinary attending shifts. Output: `s2.out`. |
| `s3.js` | The instructor's "door-to-provider wait" (`R.wait`) against the summary's "Door to provider (median)" (`R.m.d2p`). Radio counts as each screen shows them. 7 shifts. Output: `s3.out`. |
| `ui1.py` | Chrome, 390×844. It makes an attending **Five-Minute Rush** class code and plays it in the page three ways. **Ava:** the autopilot; her own patient arrests at 08:28 and nobody runs it. **Fred:** his own patient's no-code death fires him (legal risk set to 62 first). **Ray:** radio calls only. Each one sends. The three real payloads then feed the instructor's list, Copy table and Download CSV. Also About and the class code sheet. Output: `ui1.json`, `md.csv`, `shots/a-…` to `i-…`. |
| `ui2.py` | The same on a **Manic Monday** code (`ui2.json`, `md2.csv`, `shots/m-*`). |
| `ui3.py` | One own patient gets metoprolol and ibuprofen in one order; another gets an unneeded insulin drip that the dice spare. Reads the summary's "Your patients" rows (`ui3.json`, `shots/n-unsafe-orders-summary.png`). |

`fetch` is replaced in the page, and every request that isn't to a local file is aborted. Every `leaked` list is empty: nothing reached supabase.co or edcodeblack.com.

## 0. What changed in the engine, and did any clinical content change?

**The engine change is exactly four hunks, seven lines in `src/engine.js`:**

| Where | What was added | What it counts |
|---|---|---|
| `signOrders`, engine.js:1887 | `S.contra = (S.contra \|\| 0) + 1` (`S` is `G.stats.md`, line 1843) | One per contraindicated drug in an order, beside the existing `S.harm++` |
| `harmCheck`, engine.js:1957 | `G.stats.md.unneeded++` | Placed **before** the existing `chance(h[0])`: an unneeded HARM-listed treatment, counted when it is **given** to a patient who is still the attending's (`mdMine`) |
| `leave`, engine.js:3377 | `S.md.died++` | When `outcome === 'expired'` and `p.mine`: counted when the body **leaves** the department |
| `endShift`, engine.js:4401 | `endMin: Math.round(Math.min(G.t, G.shift \|\| G.t))` | The minute the shift stopped |

**No random draws were added.** The new line in `harmCheck` sits before a `chance()` that was already there. `golden.json` didn't move, so the random sequence is unchanged.

**No clinical content, scoring, answer key or lesson changed:**

- **Byte-identical at `6328cdf` and `18a71f9`:**
  - `test/golden.json` (`680c949e…`) and `test/golden.js`
  - `test/rules10.js`, `rules11.js`, `rules12.js`
  - `src/map.js`
- **`git diff --quiet 6328cdf..18a71f9`** over `test/golden.json`, `test/rules*.js`, `test/golden.js`, `test/sim.js`, `test/stress.js`, `src/map.js` and `src3d` exits 0.
- **The `md.harm` increments are unchanged** (engine.js:1887 and 1959). `accuracy()` (608) and `care()` are untouched.
- **The `src/ui.js` hunks** are the class sheet and results, `ACT`, `morph`, `bind`, About's Privacy, and the summary's labels:
  - `reportHTML`: the clinician line moved, and the fired verdict text is unchanged;
  - `scoreCardsHTML`: the Staff card;
  - `mdReportHTML`: the unsafe-orders, complications and own-deaths rows;
  - `verdictOf`.

  `LESSONS`, `GLOSS`, Orientation, the orders, the code cards and the M&M lines are untouched.

**Tests:**

- `npm test`: exit 0, **694 "ok", 0 FAIL**, "golden: 13 shifts, 3 stream checks, 20 codes, save round trip, 71 answer keys unchanged".
- `python3 test/class_test.py`: **86 ok, 0 FAIL**, "No errors".
- **No rule test covers the new counters.** The rules files are byte-identical. `class_test.py` only feeds a hand-written attending row ("Ida") to the list.

**What each new number really counts, against the labels:**

| Case (evidence) | Engine | What the screens say | Label true? |
|---|---|---|---|
| One NSTEMI patient, ibuprofen + ketorolac in one order (`s1.out` A) | contra +2, harm +2 | Summary: "Unsafe orders … 2", "Complications from those orders (some are chance) 2". List: "unsafe orders 2 (2 caused harm)" | **Unsafe orders: yes** (two drug orders). **"Complications" / "caused harm": no.** Nothing happened to the patient (A2: no crash, no arrest, still in the room 60 min later; `ui3.json` HR 96, SBP 156). The M&M itself says only "It can hurt them". Every contraindicated drug is scored as a complication automatically: R6.7-02. |
| Unneeded insulin drip, dice spare the patient (`s1.out` B, `ui3.json`) | unneeded +1 at administration, harm +0 (35 of 60 seeds were harmed) | "Unsafe orders 3, Complications 2" | Yes, once it is given. Not counted at signing (0 of 60), and never counted if the patient is handed to another doctor first (B2): R6.7-03. |
| Own patient vs another's death (`s1.out` C1, C2, C3) | own: md.died +1, **23.2 min after death**; another's: +0 | "Your own patients who died", "(N of them died)", CSV "Own patients died" | Right owner. **Wrong timing:** see the next two rows. |
| Own patient dies in the last ~23 min (`s2.out` D1 ×3 Rush, D2 Manic Monday; `ui1`/`ui2` Ava) | md.died **0**; report.expired 1 | "Your own patients who died 0" under an M&M headed "Kwame D. died in cardiac arrest with no code team" (her patient). List: "saw 7 patients" with no "(1 of them died)"; "department: … 1 died" | **No:** R6.7-01. |
| The own patient's no-code death that fires the attending (`s2.out` F; `ui1` and `ui2` Fred) | md.died **0**, fired at the minute of death | List: "fired (legal risk) at 11:20", no own death. Summary: "Your own patients who died 0"; M&M #1 "Ruth B. died in cardiac arrest with no code team"; Ruth B. is in his "Diagnoses to review" | **No:** R6.7-01. |
| A code the attending runs and loses (`s1.out` C3, 5 deaths) | counted 23.2 min after "Resuscitation unsuccessful" | as above | Same lag. |
| Fired at 200 min; staff walkout at 151 min; full Rush (`s1.out` E1, E3; `s2.out` W) | endMin 200 / 151 / 120 | "fired (legal risk) at 10:20 / staff walked out: shift ended early at 09:31: these numbers cover only the part played"; `cbArgs` sends `endMin` only when the shift failed | **Yes.** `cbClock` (07:00 + minutes) matches the engine's `clock()`. |
| Radio (`s3.out`, `ui2`) | right + wrong + miss | List: "radio calls 5 of 6 right, 1 wrong". Summary: "answered 6 of 6", "right 5 of 6" | Yes. The two screens use different denominators once a call is missed: R6.7-08. |
| "door-to-provider wait" (`s3.out`) | `avgWait()`: the **mean** door-to-provider time over every arrival, counting those still waiting at the end | List and CSV: "door-to-provider wait 19 min". The student's summary shows only "Door to provider (median) 10m" | Name now right; the number differs from the student's: R6.7-04. |

### Round-6 status

| ID | Status | Evidence |
|---|---|---|
| R6.6-01 radio calls differ | **Fixed (text).** The stream is the owner's decision. | The class code sheet: "The attending's radio calls can differ between players." `CB_MDNOTE`: "Radio calls differ between players". README "For a class" and the v0.31.0 paragraph say so. Rows read "radio calls 17 of 17 right" (`ui2.json`). |
| R6.6-02 "harm" | **Partly fixed** | The unit is now orders, and the unsafe-order count doesn't depend on the dice. But "caused harm" and "Complications" still count every contraindicated drug as a complication (R6.7-02). The unneeded count is taken at administration (R6.7-03). The asked-for rule test doesn't exist (R6.7-07). |
| R6.6-03 missed calls not exported | **Fixed** | CSV "Radio missed". `class_test.py` checks Ida's `Radio missed == 1`. |
| R6.6-04 own deaths | **Partly fixed, with a new defect** | `mdDied` is sent, listed and exported. It is counted only when the body leaves, so the last ~23 minutes and the death that fires the attending are lost (R6.7-01). |
| R6.6-05 fired Staff card | **Fixed** | Fred's Staff card reads "Average morale" (`shots/m-e-fred-summary-top.png`). |
| R6.6-06 repeated names | **Fixed** | "(1 of 2 under this name)" on both rows. `CB_NOTE`: "a repeated name may be a retry or another student". |
| R6.6-07 Send box vaguer than the list | **Mostly fixed** | It says the score is the average of the four scores and lists the categories. About is a list. The attending's Send box still leaves out three things that are sent (R6.7-05). |
| R6.6-08 partial shifts | **Fixed** | "fired (legal risk) at 11:20: these numbers cover only the part played"; the CSV has "Ended at". |
| R6.6-09 "residents want to copy your orders" | **Fixed, with a gap** | The false sentence is gone for a student who saw no patients. The new line is skipped when anyone in the department died (R6.7-09). |
| R6.6-10 numbers sent but never shown | **Fixed** | Charge nurse rows show arrivals, left against advice and bedded before registration. `scen` is no longer sent. |
| R6.6-11 no tests | **Partly fixed** | The Lessons line and a hand-written attending row are tested. Nothing tests the engine counters, or that a real attending's payload matches their report (R6.7-07). |
| R6.6-12 "fired" unexplained | **Fixed** | "fired (legal risk)" on screen and in the CSV. |
| R6.6-13 clinician line below the buttons | **Fixed** | It is now after the header lines and above the M&M: 533 to 791 px down an 844 px screen, depending on how many diagnoses are listed for review. It prints. |
| R6.6-14 "average wait" | **Fixed in name** | Now "door-to-provider wait". A new mismatch with the summary's median (R6.7-04). |
| R6.6-15 STATUS overclaims | **Still open** | `round5/STATUS.md` is unchanged, and `round6/STATUS.md` repeats the pattern (R6.7-11). |
| R6.6-16 make box | **Fixed** | `make_box` in `ui1.json` ends with the full "Not for grading…" note. |

## 1. Verdict for use with real students

**Clinical content: unchanged. Still "only after major work".** The engine's clinical tables, cards and lessons are the bytes that rounds 3 to 6 judged, and no licensed clinician has reviewed them. Every results surface says so, correctly.

**Class results:**

- **Charge nurse: usable to open a debrief, not for grades.** The labels are right.
- **Attending: usable to open a debrief only beside the student's own printed summary,** because two of the new "own work" numbers are wrong in ways an EM educator would catch at once:
  - **"(N of them died)" misses every own-patient death in the last ~23 minutes, and the very death that got the attending fired** (R6.7-01). On Five-Minute Rush, the 120-minute shift built for class, that window is a fifth of the shift.
  - **"unsafe orders 2 (2 caused harm)" reports harm that the game never simulated** (R6.7-02). Every contraindicated drug is counted as a complication.

Neither number teaches wrong medicine. Both put false facts beside a student's name. No Critical or High finding.

## 2. Score

**5 / 10** (round 6: 5).

- **Better:**
  - missed radio calls in the export;
  - when a shift ended, and that its numbers are partial;
  - "fired (legal risk)" and a Staff card that no longer says the staff walked out;
  - a deterministic unsafe-orders count;
  - honest text about radio calls.
- **Held down by:**
  - the unreviewed clinical content (the ceiling);
  - a new own-deaths counter that is blind exactly when a death matters most;
  - a "caused harm" label that counts harm the game never simulated.

## 3. Findings, worst first

### Medium

**R6.7-01 · Medium · The attending's own deaths are counted only when the body leaves the department, so the last ~23 minutes and the death that fires the attending are lost**

- **Location:**
  - engine.js:3377, `leave(p, 'expired')`.
  - Both in-room death paths set `p.dsp = 'family'; p.due = G.t + 15`: a lost code (2268) and no code team (2313). The body leaves after the family's 15 minutes plus the morgue transport, 23.2 minutes in every run (`s1.out` C1 and C3).
  - `showReport` (ui.js:3087) reads `G.stats.md.died`. `endShift` counts the department's not-yet-gone dead in `expired` (4404, the audit R5-02 fix) but not the attending's.
- **What's wrong (verified):**
  - **Rush, three seeds (`s2.out` D1).** An own patient dies at 08:48. The report says department died 1, `md.died` 0. M&M #1 is "Ivan R. died in cardiac arrest with no code team".
  - **Manic Monday (D2).** The same at 18:48.
  - **In the page (`ui1.json`, `ui2.json`).**
    - Ava's row: "saw 7 patients · … · department: … 1 died". There is no "(1 of them died)", and the CSV's "Own patients died" is 0. Her own Kwame D. died at 08:48.
    - Fred's row: "fired (legal risk) at 11:20". His own Ruth B.'s no-code death (+15 legal risk) is what fired him (`litLog`: "Ruth B.: died in cardiac arrest and no code was run").
    - Fred's summary prints "Your own patients who died 0", with "Ruth B. died in cardiac arrest with no code team" as M&M #1 and Ruth B. in his "Diagnoses to review" (`shots/m-e-fred-summary-top.png`, `m-f-fred-your-patients.png`).
  - **Ordinary play (`s2.out` S).** 24 attending shifts had 5 own deaths, none in the window. The defect is the window, and the firing case lands in it every time.
  - **How often it bites.** On Five-Minute Rush, the class level, any own death after 08:37 is lost: 19% of the shift. Your own patient's death is the first thing an EM debrief discusses.
- **Standard:** A count labelled "your own patients who died" must agree with the same summary's M&M. The department count was fixed for exactly this reason (R5-02).
- **Fix:**
  - **Engine:** count at the moment of death, as `expired` does. In `endShift`, build the report's `md` with

    ```js
    died: (S.md.died || 0) + list.filter(p => p.mine && p.loc !== 'gone' && ['family', 'morgue', 'morguing'].includes(p.dsp)).length
    ```

    Then make `showReport` send `mdDied: (R.md || {}).died || 0` instead of reading `G.stats.md`. No random draw is involved; `golden.json` won't move.
  - **Test (rules):**
    - an own patient arrests at `shift - 32`, nobody runs it: `report.md.died === 1`;
    - an own death that fires the attending: `report.md.died === 1`;
    - another provider's patient: 0.
- **Effort:** S

**R6.7-02 · Medium · "caused harm" and "Complications from those orders" count every contraindicated drug as a complication, though the game simulates none**

- **Location:**
  - engine.js:1887. Each contraindicated drug does `S.harm++` and `S.contra++` together, with only a score penalty, +10 legal risk, a toast and an M&M line that says "It can hurt them". There is no change to the patient.
  - engine.js:1959. `md.harm++` for an unneeded treatment, only if the dice hit.
  - So `md.harm` = contraindicated drugs + dice complications, exactly.
  - The labels:
    - the summary: `t('Complications from those orders (some are chance)', m.harm)` (ui.js:3065);
    - the list: `unsafe orders N (${harm} caused harm)` (`cbDet`, 2162);
    - the CSV: "Complications from orders";
    - `CB_MDNOTE`: "some complications are chance";
    - About: "unsafe orders and their complications".
- **What's wrong (verified):**
  - **The case (`ui3.json`, `shots/n-unsafe-orders-summary.png`).**
    - Nadia G. (NSTEMI) gets metoprolol and ibuprofen in one order. Her vitals stay HR 96, SBP 156. The M&M reads "Nadia G. was given metoprolol. It can hurt them: …".
    - Yara B. gets an insulin drip she doesn't need, and the dice spare her.
  - **The summary prints:**
    - "Unsafe orders 3"
    - "**Complications from those orders (some are chance) 2**"
  - **The instructor would read** "unsafe orders 3 (**2 caused harm**)".
  - **Both are wrong:**
    - Nobody had a complication. The two "complications" are the two contraindicated drugs themselves.
    - "(some are chance)" is backwards here: none of the 2 was chance.
  - **For a nursing or EM class,** "caused harm" is an adverse-event claim. A contraindicated drug that reached the patient without a modelled effect is an error that reached the patient, not harm (NCC MERP category C/D against E and above). Students are taught exactly this distinction.
- **Standard:** Patient-safety teaching separates the unsafe act (the learner's) from the harm that follows (an outcome). A count labelled "complications" or "caused harm" must count outcomes.
- **Fix (UI only, no migration, no scoring change):**
  - Leave `md.harm` alone: it feeds `accuracy()` at engine.js:608, which is Phase 6.
  - Since harm = contra + dice hits, compute `comp = harm - contra`.
  - **List:** "unsafe orders 3 (2 contraindicated drugs, 1 unneeded risky treatment; 0 complications)".
  - **Summary:**
    - "Contraindicated drugs given 2"
    - "Risky treatments with no reason 1"
    - "Complications of those treatments (chance) 0"
  - **CSV:** split the columns the same way.
  - **`CB_MDNOTE`:** "…a contraindicated drug counts as unsafe whatever follows; complications of unneeded treatments are chance."
  - **About:** "unsafe orders and any complications of unneeded treatments".
  - **Test (rules):** a rule check that `md.harm === md.contra + dice hits`, so the subtraction stays valid.
  - Older rows without `contra` keep the current fallback.
- **Effort:** S

### Low

**R6.7-03 · Low · An "unsafe order" of an unneeded treatment is counted when the nurse gives it, not when it is ordered, and is lost if the patient changes hands**

- **Location:** `harmCheck` (engine.js:1954–1957) runs at treatment completion and returns early unless `mdMine(p)` (the attending is still the provider). The order itself is recorded at signing, at engine.js:1909 (`p.extraTr.push(k)`).
- **What's wrong (verified, `s1.out`):**
  - **At signing:** counted 0 times of 60. After 90 minutes, 60 of 60.
  - **Handed off (B2):** an unneeded insulin drip ordered, then the patient assigned to `md2`, gives `unneeded +0`.
  - **At the end of a shift:** an order the nurse hasn't given by 19:00 (or 09:00 on Rush) is never counted.
  - **The labels don't match:** the summary and list call these "unsafe orders", and the code comment says "the unsafe order, whatever the dice do next". The thing being judged is the order.
- **Fix:** move the `unneeded` increment to engine.js:1909, when `HARM[k]` and not (`k === 'cardiovert'` with `cardiovertOk(p)`). Add a rules test that ordering it counts once, whatever happens next.
- **Effort:** S

**R6.7-04 · Low · "Door-to-provider wait" on the list is not the student's "Door to provider" number**

- **Location:**
  - `cbDet` and `cbTable` label `R.wait` "door-to-provider wait".
  - `avgWait()` (engine.js:4356) is the **mean** over every arrival, counting those never seen up to the end.
  - The student's summary never shows `R.wait`. It shows `metrics().d2p` as "Door to provider (median)", over only those seen.
  - About calls the same sent number "average wait". The Send box calls it "the department's wait".
- **What's wrong (verified, `s3.out`):**

  | Shift | List ("door-to-provider wait") | Student's summary ("Door to provider (median)") |
  |---|---|---|
  | Full Moon Friday, charge nurse | **19 min** | **10m** |
  | Full Moon Friday, attending | 32 | 24 |
  | Manic Monday, attending | 26 | 21 |
  | Idle charge nurse | 226 | "—" |

  A student and instructor comparing numbers in a debrief disagree by half, under the same name. Three names for one number across four screens.
- **Fix:**
  - Label it "average door-to-provider wait (every arrival, including any still waiting)" on the list, the CSV, About and the Send box.
  - Add the same row to the student's summary (ED metrics), or send `d2p` instead.
- **Effort:** XS

**R6.7-05 · Low · The attending's Send box leaves out three things that are sent and exported**

- **Location:**
  - `cbWhatAll` for an attending (ui.js:2226) lists "your patients (and how many died), diagnoses, unsafe orders and radio calls; the department's wait, arrivals, patients who left without being seen and deaths".
  - `cbArgs` also sends `ama`, `bedFirst` and `harm` for an attending. The CSV shows "Left against advice (dept.)" and "Bedded before registration (dept.)" on attending rows (Ava: 1 left against advice, `md2.csv`).
  - About lists all three.
- **What's wrong:**
  - The student sees the shorter list at the moment of consent.
  - "Complications" goes beside their name, a number they weren't told about there.
- **Fix:** use the charge nurse's department wording for both roles ("…patients who left without being seen or against advice, patients bedded before registration, and deaths"), and add "and any complications".
- **Effort:** XS

**R6.7-06 · Low · The fired verdict always blames "missed diagnoses and harmed patients", whatever raised the legal risk**

- **Location:** `reportHTML` (ui.js:3005), a fixed string: "Legal risk reached 75%. Too many missed diagnoses and harmed patients…".
- **What's wrong:**
  - Legal risk has eight sources (engine.js `litAdd` calls):
    - missed diagnoses (601) and contraindicated drugs (1887);
    - harm from unneeded treatments (1959) and sent home when they needed admission (1971);
    - no code run (2310) and left untreated 20 min (3612);
    - wrong radio orders (3916) and discussing a case with a lawyer (574).
  - **Fred on Rush (`ui1.json`)** had 0 diagnoses made, 0 unsafe orders and 0 harm. His own patient's no-code death fired him, and he is told "Too many missed diagnoses and harmed patients".
  - My repro set the starting risk to 62. The sentence is constant, so any firing driven by codes, discharges, untreated patients or radio orders gets the same false cause.
  - This is the printable page a student may hand in. The truth is one tap away under "What raised your legal risk".
- **Fix:** "Legal risk reached 75%, mostly from: " plus the two largest `litLog` reasons, grouped by kind.
- **Effort:** S

**R6.7-07 · Low · No engine test covers the three new counters or `endMin`, and no test checks a real attending's payload (the rest of R6.6-11)**

- **Location:**
  - `test/rules*.js` are byte-identical to round 6.
  - `class_test.py` checks the list with a hand-written "Ida" row (`harm 2, contra 1, unneeded 2, mdDied 1`) and plays only a charge nurse.
  - CLAUDE.md: "Each release adds tests for its new rules."
- **What's wrong:** R6.7-01 and R6.7-03 would each have failed a ten-line rules check. A rename in `showReport`'s hand-copied `mdDied`, `mdContra` or `mdUnneeded` would send zeros with every test green.
- **Fix:** a rules block with these checks:
  - two contraindicated drugs in one order give contra 2;
  - an unneeded treatment counts once with the dice forced to miss;
  - an own death 10 min before the end gives `report.md.died` 1; another's death gives 0;
  - fired and walkout give `endMin` equal to the minute they stopped;
  - full shift: `cbArgs` sends `endMin` null.

  Plus an attending class shift in `class_test.py` whose payload's `mdSeen`, `mdDied`, `contra`, `unneeded` and `radioMiss` equal the report's.
- **Effort:** S

### Nitpick

**R6.7-08 · Nitpick · Radio calls "right" have two denominators.**

- **What:** the summary says "Medical direction calls right 5 of 6" (of those answered), while the list says "radio calls 5 of 7 right" (of all offered) for the same student once a call rings out.
- **Fix:** add "out of all calls: 5 of 7" to the summary, or "of 7 offered" to the list.

**R6.7-09 · Nitpick · "You saw no patients" is skipped when anyone in the department died.**

- **What:** in `reportHTML` the death sentence takes precedence. Ray (0 patients, radio only, Manic Monday) reads "1 patient died in the department. The numbers were good; read the worst moments below." (`ui2.json`).
- **Fix:** test `R.md.seen === 0` first.

**R6.7-10 · Nitpick · `CB_MDNOTE` doesn't name own deaths.**

- **What:** it lists the attending's own work as "the patients they saw, their diagnoses, unsafe orders and radio calls", and leaves out the own deaths the row now shows.
- **Fix:** add "and how many of them died".

**R6.7-11 · Nitpick · The status files overclaim again.**

- **What:**
  - `round6/STATUS.md` lists R6.6-02, -04, -07 and -09 as fixed. They are partly fixed (above).
  - It doesn't mention R6.6-11 or R6.6-15.
  - `round5/STATUS.md` is unchanged.
- **Fix:** add a "Partly fixed" line for those four, and record -11 and -15.

**Counts:** Critical 0 · High 0 · Medium 2 · Low 5 · Nitpick 4.

## 4. Coverage

**Reviewed:**

- **Engine change:**
  - all four hunks of `git diff 6328cdf..18a71f9 -- src/engine.js`;
  - every increment of `md.harm`, `contra`, `unneeded` and `died`;
  - the three death paths (2268, 2313, 3281/2842) and `endShift`;
  - `harmCheck`'s guards, `assign` (`p.mine`), `freshStats` reset at 07:00, `avgWait` and `metrics`;
  - `boxTick`, `missBox`, `boxDecide`, the `litAdd` sources and `mm()` ownership.
- **Content-change check:** blob identity of `golden.json`, `golden.js`, `rules10` to `rules12`, `map.js`; an empty `git diff --quiet` over the tests, sim, stress, `map.js` and `src3d`; every `ui.js` hunk header, with the summary hunks read in full.
- **Tests:** `npm test` (exit 0, 694 ok, 0 FAIL, golden unchanged) and `test/class_test.py` (86 ok).
- **Node checks:** `s1`, `s2`, `s3`, about 40 shifts and 130 constructed cases.
- **Screens in Chrome at 390×844**, from Rush and Manic Monday class codes played in the page and sent:
  - the class code sheet and the make box;
  - three attending summaries (normal, fired, radio only): the header, verdict, clinician line, Staff card, litbox, M&M, "Your patients" and the Send box;
  - the print-media check for the clinician line;
  - the real payloads; the instructor's list; Copy table; Download CSV; About;
  - a constructed unsafe-orders summary.
- **Text:** `cbDet`, `cbRow`, `cbRows`, `CB_NOTE`, `CB_MDNOTE`, `cbTable`, `cbArgs`, `cbWhat`, `cbWhatAll`, `cbSendHTML`, `verdictOf`, `VERDICT_MD`, `reportHTML`, `mdReportHTML`, `mdDeptHTML`, `scoreCardsHTML`, `aboutHTML`, README's v0.31.0 paragraph and "For a class", `round6/STATUS.md`.

**Not checked:**

- **The live database and site.** Off limits.
- **The second migration's SQL and `npm run db:test`.** Reviewer 3's area. I read only which keys `cbArgs` sends.
- **The round-3 clinical findings.** The clinical tables are unchanged, so their state is unchanged.
- **WebKit and Firefox.** Chrome only.

**Side effect:** `class_test.py` wrote its screenshots to the gitignored `test/shots/`. `git status` is clean apart from this report.

## 5. What I'd keep

- **The unsafe-orders count itself:** deterministic, per drug order, and now separate from the dice. It needs the honest split in R6.7-02, not a rewrite.
- **The ended-early tag:** "fired (legal risk) at 11:20: these numbers cover only the part played". It is exact, and it matches the engine's clock.
- **"Radio calls 17 of 17 right"** with the plain warning that calls differ between players, on the sheet, in the note and in the README.
- **Owner over chance:** own deaths count only `p.mine`, so another provider's death is never charged to the student. It needs counting at the moment of death (R6.7-01).
- **The clinician line above the M&M on the printed summary,** plus the not-for-grading note in the make box. The caveats now meet the instructor before the first result arrives.
- **A clean engine change:** seven lines, no random draws, no scoring or content touched, and `golden.json` proves it.
