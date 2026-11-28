# Round 13, Reviewer 6: clinical accuracy (v0.33.0 release review)

Reviewer: board-certified emergency physician and clinical educator, hostile brief.
Scope: `git diff 78916ef..HEAD` (src, test), branch `claude/sleepy-rubin-jot35n`, HEAD 895bc15.
Method: I ran every claim against `src/engine.js` in Node and checked the built `index.html` in Chromium with Playwright. Scratch scripts are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round13/r6/` (`a.js` to `e.js`, `p1.py`, `ectopic.png`).

## 1. Verdict

The reworded text is mostly sound. The new stroke, PE, overdose and NSAID harm reasons, the dry-arrest card and the stroke exclusions card are clinically defensible, and the renamed diagnoses ("Syncope", "Chest pain") stop giving away the risk band. The release's two main clinical claims still don't hold in play:
- **"The attending sees signs, not the diagnosis" is undone by the patient card.** For a ruptured ectopic or AAA the attending hasn't diagnosed, the card says "Hemorrhage. Activate MTP." Next shows "Bleeding: activate MTP", and a red "Activate massive transfusion" button appears. That is the diagnosis category and the whole answer key.
- **"The attending is graded on their own calls" pays for doing nothing.** An attending who sees no one on Quiet Tuesday scores Clinical 100 and Legal 100 and gets two stars. On Manic Monday the same idle attending gets one or two stars while an LVO stroke and mesenteric ischemia sit unseen and unchanged for 11 hours.

Other problems:
- The new "no sign it's needed" message is false in several cases. For example, it fires on nicardipine at BP 180/106 in heart failure.
- The new Canadian Syncope Risk Score (CSRS) from parts mislabels two of its items.
- The stroke card tells lay learners that any "blood thinner" rules out the clot drug.

None of this harms a real patient, but a student would carry it into practice. Fix 01 to 05 before `main`.

## 2. Score

**5 / 10.** Up from 3. The wording work is careful. The grading and the "no giveaways" goals are not met where they matter most.

## 3. Findings (worst first)

### R6.13-01 High: the attending's card still names the hemorrhage and prescribes MTP for an undiagnosed patient
- **Location:**
  - `src/ui.js:980` (`kv.push(['Bleeding', … '<b>Hemorrhage. Activate MTP.</b>'])`, with no `MD()` gate).
  - `src/ui.js:566`: the Next chip "Bleeding: activate MTP" / "SHOCK: activate MTP".
  - `src/ui.js:621`: the `MTP` need tag.
  - `src/ui.js:1017`: `mtpBtn` in `mdPrimary0`.
- **Claim:**
  - QA3-2 and QA5-4 changed the bleeding toasts so the attending hears "the pressure is falling, the heart is racing, and they're pale and sweaty", not the diagnosis.
  - The card, the Next chip, the tag and a red button still tell the attending it is a hemorrhage and that the treatment is massive transfusion.
  - For `ectopic`, `aaa`, `mvc` and `mcired`, `p.tr` is `['mtp']`, so the screen shows the answer key before any test.
  - The diagnosis question for a ruptured ectopic is then trivial.
  - This breaks the Phase 6 rule (no answer giveaways on regular shifts) and makes the toast change pointless.
- **Reproduce:** `CHROME_PATH=/opt/pw-browsers/chromium python3 …/round13/r6/p1.py` starts a Manic Monday attending shift and puts an ectopic in a room. Output: `{'bleed': 'mtp', 'tr': ['mtp'], 'dxK': False}`, followed by `>> Hemorrhage. Activate MTP.`, `>> activate MTP` and `>> Activate massive transfusion`.
- **Fix:**
  - On the attending's own shift (`MD() && !train`), show signs in the card ("Pale, fast pulse, pressure falling").
  - Drop the MTP chip and tag until MTP is ordered.
  - Keep MTP only as an order in the sheet (it is already in `ORDER_TX`).
  - The charge nurse and Orientation keep today's text.
  - Add a rules15 or Playwright check that an undiagnosed attending's card has no "Hemorrhage" or "MTP".
- **Effort:** S.

### R6.13-02 High: unseen critical patients never get worse, and an idle attending earns two stars
- **Location:**
  - `src/engine.js` `mdScores` (Clinical is `scoreOf('clinical')`, which is 100 when nothing was scored).
  - `baseStars`.
  - `unseenHanded`: -25 once, only when the patient leaves or the shift ends.
  - `minuteTick`: deterioration (`txHarm`) only for `mdMine(p)`, which needs `p.mine`.
  - Known issue F-134, which understates it.
- **Claim:**
  - Patients the charge nurse hands to the attending (ESI 1 and 2) keep stable vitals all shift if never seen. In seed 4242 on Manic Monday:
    - an LVO stroke stayed at HR 95, BP 198/94 from 08:00 to 19:00;
    - mesenteric ischemia stayed at HR 125, BP 127.
  - An idle attending scores:
    - Quiet Tuesday: Clinical 100, Legal 100, Radio 0, **2 stars** (seeds 301 to 304);
    - Manic Monday: 1 to **2 stars** (seeds 301 to 304 and 4242);
    - Full Moon Friday: 1 star.
  - F-134 says "Clinical 55% and a star". The Quiet Tuesday result is worse than that.
  - Clinically, an unseen LVO for 11 hours loses most of the brain the thrombectomy window could save, and mesenteric ischemia dies.
  - For a teaching game whose audience includes attendings, "nobody got worse while you ignored them" is the wrong lesson. "Unseen critical patients don't deteriorate" is **not acceptable**, even with the end penalty: the penalty is small, late, and paid in Legal and Clinical points the idle attending never risked otherwise.
- **Reproduce:** `node …/round13/r6/e.js` prints `easy 301 stars 2 avg 67 {"clinical":100,"dx":null,"radio":0,"legal":100} unseen 0`. `node …/round13/r6/c.js` prints the vitals track of the unseen LVO and mesenteric ischemia.
- **Fix:**
  - Start the untreated clock (`tGap` / `txHarm`) at handover for handed, unseen patients: one deterioration step, a toast with signs only, and an M&M entry.
  - Let `CRASH` fire for an unseen ESI 1 after about 60 minutes.
  - In `mdScores`, make Clinical `null` (left out) when the attending saw no patient, and give 0 stars when no own patient was seen and no radio call was answered.
- **Effort:** M.

### R6.13-03 Medium: "no sign it's needed, and it carries real risk" is false in common cases and gives the answer at signing
- **Location:** `src/engine.js` `signOrders` (`ul.push(\`${TREAT[k].label} (no sign it's needed, and it carries real risk)\`)`), new in QA-10. `HARM`.
- **Claim:** The message fires for any `HARM` treatment outside the case's key, whatever the vitals:
  - **Heart failure, BP 180/106, SpO2 91%: nicardipine** gets "Blood pressure control (no sign it's needed…)". A hypertensive flash-pulmonary-edema patient has every sign. Nitroglycerin is first choice, but an IV vasodilator such as nicardipine is accepted (AHA/ACC/HFSA 2022). At worst it is "works, but not the first choice".
  - **Sepsis, BP 90/58: norepinephrine.** "No sign" is wrong. The reason is "fluids first; MAP is still 65 or more" (SSC 2021). Meanwhile the labetalol harm reason for the same patient says the pressure "is already falling".
  - **Asthma, SpO2 91%, three-word sentences: IM epinephrine.** IM epinephrine is a recognised adjunct in severe or life-threatening asthma (NAEPP; BTS/SIGN). Debatable, not "no sign".
  - **Stroke not eligible for the drug, BP 192 to 212 / 100 to 114: blood pressure control.** The correct reason is permissive hypertension under 220/120. "No sign it's needed" next to a BP of 205/110 teaches a lay learner that the pressure is normal.
  - Because it appears at signing on a regular shift, it is also an instant verdict, which Phase 6 removed everywhere else.
- **Reproduce:** `node …/round13/r6/b.js`:
  - `chf … BP 180/106 SpO2 91 … Can hurt them: Blood pressure control (no sign it's needed, and it carries real risk).`
  - `sepsisw … BP 90/58 … Vasopressor (no sign it's needed…)`
  - `asthma … Epinephrine (no sign it's needed…)`
- **Fix:**
  - Add per-case reasons, an `UNNEEDED_WHY[case][tx]`, in the style of `CONTRA_WHY`: "fluids first: the MAP is still over 65"; "under 220/120 with no clot drug, let the pressure run".
  - Add nicardipine to `ALSO.chf`, or make it a `SAME_CLASS_OK` alternative to nitroglycerin.
  - On a shift, say only "Can hurt them: …" in the end review, not at signing.
  - Add tests for the four cases.
- **Effort:** S to M.

### R6.13-04 Medium: the stroke exclusions card overstates "blood thinner" and simplifies the time rule
- **Location:** `src/ui.js` LESSONS.stroke `k8b` and `k9`. Also `src/ui.js:975`: "Takes apixaban (a blood thinner)".
- **Claim:**
  - "Take a **blood thinner** like apixaban" is too broad for the lay audience the tutorial must teach (CLAUDE.md design rules):
    - Lay people call aspirin and clopidogrel "blood thinners". Antiplatelets are **not** a contraindication to IV thrombolysis (AHA/ASA 2019 §3.5).
    - Warfarin with INR ≤1.7 is eligible.
    - A DOAC is an exclusion only if taken in the last 48 hours (or with abnormal specific levels).
  - "Arrived over 4½ hours after last known well" is not the criterion. The criterion is whether the drug can go in within 4.5 hours. A patient arriving at 4 h 15 min is effectively excluded too.
  - "Woke up with it (onset unknown counts as too late)" should say that an MRI mismatch can make them eligible, but this game doesn't model it. The harm reason already says so for perfusion imaging.
  - The 220/120 and thrombectomy BP lines are correct.
- **Reproduce:** Start Lessons, then Stroke, and read card `k8b`. Or read `src/ui.js:1942`.
- **Fix:** "Takes an **anticoagulant** (apixaban, rivaroxaban, warfarin with a high INR) in the last two days. Aspirin doesn't count." "More than **4½ hours** since last known well by the time the drug could go in." "Woke up with it: onset unknown (an MRI can sometimes decide; not in this game)." Use "an anticoagulant (blood thinner)" on the Home meds line.
- **Effort:** S.

### R6.13-05 Medium: the new CSRS from parts mislabels two items and claims findings the screen doesn't show
- **Location:** `src/engine.js` `grayScore`, syncope branch (QA2-3).
- **Claim:** CSRS (Thiruganasambandamoorthy, CMAJ 2016) items are:
  - Predisposition to vasovagal symptoms −1. The triggers are a warm crowded place, prolonged standing, fear, emotion or pain.
  - Heart disease +1.
  - SBP <90 or >180 +2.
  - Troponin raised +2.
  - Abnormal QRS axis +1.
  - QRS >130 ms +1.
  - QTc >480 ms +2.
  - ED diagnosis vasovagal −2 or cardiac +2.

  The game gets these wrong:
  - **"No warning with that ECG: likely the heart (2)"**. The +2 item is the ED diagnosis of cardiac syncope. "No warning" is the reasoning, not the item.
  - **"Warning signs, long standing: vasovagal (-1)"**. The item is predisposition (the trigger), not a prodrome.
  - **Scores −3 and −2 are "very low" risk, not "low"**. The game prints "low risk" for every low-risk patient.
  - **"QRS over 130 ms: new bundle branch block"**. A BBB is a QRS of 120 ms or more. Not every BBB is over 130.
  - **"Abnormal QRS axis (1)"** is drawn 50% of the time and **"history of heart disease (1)"** 20 to 60%. The ECG result shown is always just "New bundle branch block". The exam says nothing about heart disease. The score contradicts the findings, the same class of problem as R6.12-07 (HEART).
  - Bands and dispositions are right: medium and high go to observation, admit is defensible. The low-risk score correctly leads home.
- **Reproduce:** `node -e "const OC=require('./src/engine.js');OC.newGame('med',1,{});console.log(OC.CASES.find(c=>c.k==='synchigh').find, OC.EXAM.synchigh)"`, then read the `grayScore` parts (engine.js, the syncope branch).
- **Fix:**
  - Rename the parts: "triggers: long standing (−1)", "ED diagnosis: cardiac syncope (2)".
  - Print the band as "very low" for −3 and −2.
  - Write "QRS 140 ms (1)".
  - Put the axis and heart disease into `find.ecg` and the exam when drawn, from the same dice.
- **Effort:** S.

### R6.13-06 Medium: arrivals are half ESI 1 and 2, with ESI 1 at 11%, even on Quiet Tuesday (F-143)
- **Location:** `src/engine.js` CASES weights and `LEVELS`.
- **Claim:** One bot-run shift per level:
  - Quiet Tuesday: 89 arrivals. ESI 1 = 10 (11%), ESI 2 = 34, ESI 3 = 26, ESI 4 = 10, ESI 5 = 9. That is 49% ESI 1 and 2.
  - Manic Monday: 50% ESI 1 and 2.

  US data (NHAMCS) run about 1 to 2% ESI 1, 20 to 30% ESI 2 and about 45% ESI 3. Working charge nurses will see this at once (credibility rule). It also inflates the attending's ESI 1 and 2 handovers.
- **Reproduce:** Run the inline `node -e` count from my session: `easy 89 {"1":10,"2":34,"3":26,"4":10,"5":9} ESI1-2 % 49`.
- **Fix:** Rebalance case weights per level toward ESI 3. Keep Full Moon Friday heavier on purpose, and say so.
- **Effort:** M (the golden file moves).

### R6.13-07 Medium: gray-zone grading punishes caution for certain and recklessness by chance
- **Location:** `src/engine.js` `grayDispo`, and `bounceRoll` (`p.grayUnder ? 0.3`).
- **Claim:**
  - Observing a low-risk patient always costs −6 ("That bed was needed").
  - Sending a high-risk CSRS or moderate HEART patient home costs **nothing at the call**. It shows only as a 30% chance of a return visit.
  - For the attending, `dispoWrong` isn't part of `mdScores`, so the dangerous error scores better than the safe one 70% of the time.
  - In real practice and in malpractice terms, the missed ACS sent home is the error that matters.
  - The call also still gives an instant verdict ("Good call. Low-risk HEART score (2)", "Most would keep this patient"), while diagnoses now wait until the patient leaves. That is inconsistent with Phase 6.
- **Reproduce:** Read `grayDispo` (engine.js, around line 3324): the `S.under` branch has no `care()` and no `litAdd`.
- **Fix:**
  - For an "under" call, apply `care(-12,'gray')` and `litAdd(MUST? 5 : 3)`.
  - Defer the message on a shift the way `dxPend` does.
- **Effort:** S.

### R6.13-08 Low: the end-of-shift "never seen" penalty has no time cutoff and also hits patients another doctor cared for
- **Location:** `src/engine.js` `unseenHanded`, called from `endShift` and `leave`. The handover in `botStep` has no time check.
- **Claim:**
  - A patient the charge nurse hands over at 18:55 costs −25 Clinical and +5 legal risk, with an M&M line "was on your list and never seen". A normal shift-change handover counts as a failure.
  - The branch "another doctor finished their care" also counts as "never seen", though the patient was cared for.
  - The idea itself, an unseen handover counting against you, is fair. Delayed diagnosis scoring is also fair and realistic.
- **Reproduce:** Read the code. My idle runs never reached the late case (`d.js`), because an idle attending's list stays full.
- **Fix:** Exclude patients handed over in the last 30 minutes, with a sign-out line instead. For the "another doctor" case, use a smaller penalty and wording such as "Handed back without being seen".
- **Effort:** S.

### R6.13-09 Low: two harm reasons still name the diagnosis, and one teaches an imprecise rule
- **Location:** `src/engine.js` `CONTRA_WHY`, `CONTRA_WHY_DRUG`.
- **Claim:**
  - `sbo.reglan`: "it pushes the gut against **a blockage**" names the diagnosis (bowel obstruction) at signing, before the CT. This breaks the CLAUDE.md rule this release applied to four other reasons.
  - `CONTRA_WHY_DRUG.ibu/ketor`: "NSAIDs can make bleeding **and heart attacks** worse" shows for trauma and GI bleed patients. That is irrelevant there and hints at a cardiac process.
  - The new stroke heparin text, "in the **first day** of sudden weakness…", implies anticoagulation is fine from day 2. Urgent anticoagulation is not recommended (AHA/ASA 2019 §4.9). In A-fib it usually starts after 4 to 14 days, or within 48 hours for a minor stroke (ELAN).
- **Reproduce:** `node -e "const OC=require('./src/engine.js');console.log(OC.CONTRA_WHY.sbo, OC.CONTRA_WHY.stroke.heparin)"`.
- **Fix:**
  - "It speeds up a gut that may not be able to move things on."
  - "NSAIDs make bleeding worse."
  - "No blood thinner in the first days after sudden weakness or speech trouble…"
- **Effort:** S.

### R6.13-10 Low: the risk cards hide zero-point parts (F-138)
- **Location:** `src/engine.js` `grayScore` (`parts.filter(Boolean)` drops every 0-point part). `src/ui.js:983` Risk row.
- **Claim:**
  - A 30-year-old with low-risk chest pain sees "HEART score 0 · low risk (troponin normal (0))", one part of five.
  - CSRS likewise omits axis, QTc and heart disease when they score 0.
  - A student learns a score by seeing every part, zeros included. The phase 3 fix (R6-16), which showed the parts so the number could be checked, is half met.
- **Reproduce:** Any `cwp` aged under 45 with no risk factor.
- **Fix:** List all five HEART parts and all CSRS items, with "(0)".
- **Effort:** S.

### R6.13-11 Low: the stroke card on the attending's shift tells them whether the patient can have the drug
- **Location:** `src/ui.js:973`: "outside the 4.5-hour window for the thrombolytic" or "check the home meds". Not changed in this release.
- **Claim:** On a regular attending shift this is the eligibility answer. It conflicts with the Phase 6 "no hints" rule this release applied to diagnoses, consults and alerts. The last-known-well time alone is enough.
- **Fix:** Show only "Last known well HH:MM" and the Home meds line on the attending's shift. Keep the hint for the charge nurse and in Orientation.
- **Effort:** S.

### R6.13-12 Nitpick: the HEART gate exists only in the UI
- **Location:** `src/ui.js` `grayBlock` / `tropIn`. `src/engine.js` `grayDispo` doesn't check for a troponin.
- **Claim:**
  - For the attending's own HEART patients the gate is redundant, because `NEED.cwp/cpmod` require a troponin.
  - It is the only clinical rule enforced only by hiding buttons. Any future path to `grayDispo` (autopilot, a test) skips it.
  - `tropIn` treats "labs back" as a troponin for game-run providers' patients even when no troponin was drawn, so the Risk row can say "troponin normal" for an undrawn test.
- **Fix:** Check `tropBack(p)` in `grayDispo` for HEART.
- **Effort:** S.

### R6.13-13 Nitpick: low-risk chest pain goes home on one troponin
- **Location:** `ORD_WHY.cwp`, `find.lab` "Troponin negative".
- **Claim:** The HEART pathway discharges a low HEART score after serial troponins (0 and 3 h), or after a single high-sensitivity troponin below the detection limit with symptoms more than 3 hours old. One unqualified "troponin negative" teaches single-troponin discharge.
- **Fix:** "Troponin negative twice, 3 hours apart" or "a high-sensitivity troponin below the detection limit".
- **Effort:** S.

### R6.13-14 Nitpick: the source document misspells the CSRS author
- **Location:** `docs/clinical-sources.md` line 27: "Thiruganesan et al., 2016".
- **Claim:** The author is Thiruganasambandamoorthy V, et al., CMAJ 2016;188(12):E289-E298. The engine comment spells it right. A reader can't find the citation as written.
- **Fix:** Correct the name and add the journal reference.
- **Effort:** S.

## 4. Things I checked and found sound
- Renamed diagnoses "Syncope" and "Chest pain", and their `DX_PLAIN` glosses. Nothing still refers to the old names. Gray cases are excluded from the diagnosis question and the distractor pool.
- HEART parts for `cpmod` now match the exam (diabetes and hypertension: 1). Bands and dispositions are right.
- Reworded harm reasons:
  - PE tenecteplase with a steady pressure matches ESC 2019.
  - Lorazepam in a drowsy opioid overdose.
  - "NSAIDs are harmful when the pain could be the heart".
  - The stroke tenecteplase reasons for apixaban and unknown onset.
- Dry-arrest card `tnkDry`: an empty heart on ultrasound needs volume, and nothing points to a clot. It is correct for DKA, dehydration and sepsis (`CAUSE_OF` → `vol`).
- Stroke card: no door-to-needle clock when there is no drug, permissive hypertension to 220/120, and 185/110 before thrombectomy, all match AHA/ASA 2019.
- The teaching-game notice appears on the order sheet, code cards, radio calls, the patient, help and glossary sheets, Lessons, Learn, Play and Class code.
- The attending Orientation's scores text matches `mdScores`.
- Scoring a diagnosis when the patient leaves is clinically fair and realistic: feedback comes from how the patient does.
