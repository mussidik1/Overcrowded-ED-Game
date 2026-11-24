# Reviewer 5, round 2: Hardcore gamer and game critic

Build reviewed: branch `claude/sleepy-rubin-jot35n` at v0.30.0 (HEAD `49aea94`), the committed `index.html`. I served it over http and played it in headless Chrome at 844x390 (a phone held sideways) on the flat floor plan, using real taps on real buttons. Screenshots are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round2/r5/shots/`, Playwright scripts in the folder above, and Node scripts in `.../round2/r5/node/` (`odds.js`, `ignore.js`, `two.js`, `rhythms.js`, plus `sim.out` from an unmodified `node test/sim.js`). I say every time I used an `OC`/`OCUI` hook.

## 0. Round-1 status

| Round-1 finding | Status | Evidence |
|---|---|---|
| **R5-01** High: your own patient's arrest can't be run | **Fixed** | Tyler T. (mine, MCI red) arrested in Resus 2. His card showed a red **Run the code** button (`shots/09-arrest-board.png`). A forced mid-exam arrest (Tamika B.) also showed it (`22-midexam-arrest-card.png`), and Next jumped to my coding room (Room 13). Every code I ran ended in ROSC or death. |
| **R5-02** High: untreated arrests never die; "everybody survived" | **Partly fixed** | Arrests with no code team now die at 20 minutes and are counted (`noTeam`, `expired`), and the 0-star line no longer says everybody survived. But the report still never shows a death count, the 1-3 star verdicts ignore deaths, and the M&M can leave a death out. See R5.2-05. |
| **R5-03** High: the attending's grade is mostly the AI's work | **Still open** | Manic Monday attending: Clinical 25%, 0 of 1 diagnoses right, 8 of 15 radio calls wrong, and my own patient dead. The verdict was "**Solid shift. The nurses like working with you.**" at 2 stars (`21-md-report-verdict.png`). `overallStars()` (engine.js:802) is unchanged. |
| **R5-04** High (Verifier: Medium): difficulty curve | **Still open** | Rerunning `node test/sim.js` unmodified: newbie gets 2.4 stars on Rush and 0.2 on Quiet Tuesday; real gets 2.8 / 1.4 / 0.4 / 0.0; doc gets 3.0 / 3.0 / 3.0 / 2.8; slowdoc gets 3.0 / 3.0 / 3.0 / 2.8. Same shape as round 1. |
| **R5-05** High: the attending game gives its answers away | **Still open** | On a regular Manic Monday: "THE WORKUP ISN'T COMPLETE. **Still needed: BMP, Chest X-ray.**" (`16-still-needed.png`). Hector C. showed "DIAGNOSIS Subdural hematoma" above "Still needed: Coags (PT/INR), **CT head**", so the diagnosis was printed before the scan that makes it (`32-board-now.png`). `gapHint` (ui.js:977) is unchanged. |
| **R5-06** High (Verifier: Medium): 3D keeps rendering when off | **Still open** (not re-measured) | `git diff 6edcc3d..HEAD` shows no change to `src3d/` or `src/map.js`. |
| R5-07 Medium: leaving Orientation loses progress | **Partly fixed** | "Resume your shift" on the main title now restores the step (I left at step 6 and resumed at step 6). But Main menu drops you on the Learn screen, and its Orientation tile restarts at step 1 of 69 and overwrites the save (`63-orient-restart.png`). |
| R5-08 Medium: "Sign with no orders" refuses | **Still open** | The label still shows (Malik V.'s order sheet), and the refusal is still in the engine (engine.js:1825). |
| R5-09 Medium: no pause that keeps the board | **Still open, now worse** | Sheets still don't pause (ui.js:2177). Each minute of delay now costs 5% of the code odds. At 4×, five seconds spent reading a card is 8 game minutes, about a third of the odds. |
| R5-10 Medium: the order accordion keeps its state across patients | **Still open** | `U.ordM` is still one global set (ui.js:985). |
| R5-12 Medium: radio penalties ignore danger | **Still open** | Every wrong call is still a flat `litAdd(3, …)` (engine.js:3717). |
| R5-13 Medium: the radio pool is small | **Still open** | 6 of the 9 calls in my Full Moon Friday attending shift had already come up in my Manic Monday shift: glucose 38, tadalafil, femur fentanyl, LVO bypass, bee sting, SVT adenosine dose. |
| R5-14 Medium: lessons never test recall | **Still open, worse** | The new ACLS cards have no lesson at all (R5.2-09). |
| R5-15 Medium: no progression | **Still open** | Nothing new unlocks. |
| R5-16 Medium: pantoprazole "Not needed" in a GI bleed | **Still open** | `ALSO` has no `gib` entry (engine.js:445). |
| R5-18 Low: Experience % and exam text frozen | **Still open, worse** | A **dead** patient shows "Experience 84% · how they feel about the visit; an update raises it" and an exam of "Belly rigid, tender…" (`15-code-outcome.png`). Ana P., pronounced dead, reads "Wheezing… Drowsy. Experience 92%". |
| R5-19 Low: every shift opens with the call-out card | **Still open** | The Rush opened on "House supervisor · Call-out" at 07:00 (`66-rush-callout.png`). |
| R5-21 Low: one ledger line dominates | **Still open** | AFK Manic Monday: "Wall time −6703" against "Safety events −400" for 10 deaths. See R5.2-13. |
| R5-22 Low: two Dr. Okafors | **Still open** | engine.js:120 and engine.js:4457. |
| R5-26 Low: zero stars shown as ☆☆☆ | **Still open** | `60-play-menu-after-0star.png`. |
| R5-31 Nitpick: joke verdict over deaths | **Fixed** for 0 stars | Now "Rough one. Read the worst moments below, then try again." At 1 to 3 stars the verdict still ignores deaths (R5.2-05). |

**Summary of round-1 Highs:** 1 Fixed, 1 Partly fixed, 4 Still open. **Of the Mediums and Lows I rechecked:** 1 Fixed (R5-31, 0 stars only), 1 Partly fixed, 12 Still open, 3 of them now worse.

## 1. Verdict

**Only after major work.** I still would not play past ten minutes on my own. Phase 1 replaced a dead end with a quiz:
- The clock freezes, you answer two or three multiple-choice cards with the rhythm already named for you, you stand there for 15 minutes with nothing to do, and the dice decide.
- Worse, the scoring makes running the code a bad bet. As the attending, letting your own patient die with no code team costs **zero points**. Running the code and getting cards wrong costs points, and so does the radio call you miss while you're in the room.
- The fixes around the new code are broken. A post-arrest patient on a ventilator can be discharged home, and she walks back in an hour later with "Back again: collapsed during the exam". Pulseless patients at the door or on the wall now die in 20 minutes, but they look like every other "?" icon, and Next never points at them. A ruptured ectopic still gets "decompress both sides of the chest".
- The report still says "Solid shift" over my own dead patient.

## 2. Score

**4/10.** The arrest dead end is gone and save/resume works mid-code. But the new feature isn't taught, is scored backwards for the attending, can't be seen outside rooms, and opens a new run of credibility bugs, so the game is no closer to fun than in round 1.

## 3. New findings, worst first

"Phase 1" marks findings that sit in code Phase 1 changed or in a fix Phase 1 claimed.

### R5.2-01 High: as the attending, letting your own patient die in arrest costs nothing, and trying the code costs points (Phase 1)
- **Where:** Quiet Tuesday, attending. Maria M., my GI bleed patient in Room 1, arrested (I forced it with the hook `OC.toArrest`). I did nothing for 20 minutes. The toast read "Maria M. died in cardiac arrest. Nobody ran the code." **Clinical stayed at 63%. Legal risk went *down*, from 9% to 8% (normal decay).** The ledger didn't change (`shots/29-ignored-arrest-death.png`).
- **Node check** (`node/ignore.js`, own patient, no other activity):
  - **GI bleed, ignored:** score 0, Clinical 100%.
  - **GI bleed, code run with every card wrong:** score −12, Clinical 93%.
  - **STEMI:** −20 either way (a missed alert goal), plus −12 for running it wrong.
- **During the code:** the radio rang in three of my four codes, and each unanswered call costs −30 (`missBox`, engine.js:3683). That is worth more than three right cards (+12).
- **Cause:** `arrestNoTeam` charges `care(-40, 'safety')` with no patient (engine.js:2120). `'safety'` isn't in `MD_TAGS` (engine.js:785), so in attending mode `care()` drops it (engine.js:807-808). `codePick` charges `care(±4, 'md', p)`, which does count.
- **Why a player cares:** a student unsure of ACLS learns that the cheapest play is to walk away from a pulseless patient. This is the exact behaviour Phase 1 was meant to punish.
- **Fix:**
  - In attending mode, charge a no-team death of your own patient as harm to that patient: `care(-60, 'harm', p)` plus `litAdd(15, …)`, and count it in `md.untreated`.
  - Never let running a code score worse than not running it. Make the floor of a code you ran ≥ 0, and make the bonus come from right answers only.
  - Hold the radio while you're in a code (see R5.2-10).
  - Add a rule test: ignored own arrest < code run badly < code run well.
- **Effort:** S.

### R5.2-02 High: a ventilated post-arrest patient can be discharged home, and she walks back in an hour later (Phase 1)
- **Steps:**
  1. Quiet Tuesday, attending. Tamika B. (30F, cholecystitis) arrests mid-exam (forced with the hook). I answered all three PEA cards right and got ROSC at 07:29.
  2. Her card offered **Discharge home / Admit / Transfer** (`26-pea-outcome.png`). I tapped **Discharge home**. The toast read "Room 2 is going home once treatment is done." The cost was −25 points and +5 legal risk.
  3. She was intubated at 07:48, put on the ventilator at 07:51, and **discharged at 07:56** (`outcome: 'dc'`).
  4. At 09:01 she was back in Room 5 as a **72-hour return**: "Walk-in", complaint "**Back again: collapsed during the exam**", ESI 2, being worked up for her gallbladder (`30-rosc-bounceback.png`).
- **The post-ROSC card is also wrong:**
  - "Your call · ROSC after cardiac arrest" shows the *cholecystitis* teaching text: "Ultrasound first, not CT. Labs show infection and the liver. Pain control, then General Surgery."
  - The exam reverts to "Tender under the right ribs".
- **Cause:** `codeOutcome` sets up ROSC (engine.js:2096-2104). `mdDecide` (engine.js:1906-1911) accepts `home` for any patient with a −25. The bounce-back code then turns the case into a return visit.
- **Why a player cares:** any nurse or doctor who sees this stops trusting the game. It also turns the new best outcome in the code into a farce.
- **Fix:**
  - After ROSC, offer only ICU admission (or a transfer if the ICU is full).
  - Clear the old case's `ORD_WHY` and exam text, and give ROSC its own exam ("Intubated, sedated, on the monitor").
  - Never generate a return visit from an ICU-level patient sent home. Make it a death and an M&M line instead.
- **Effort:** S.

### R5.2-03 High: pulseless patients outside rooms are invisible on the floor plan and skipped by Next, and they now die in 20 minutes (Phase 1)
- **What I saw**, charge nurse, Manic Monday:
  - **Andre M. (wall):** arrested on the wall at 11:37 and died at 11:57. Next pointed at "Ana W." and "Brenda D.", never at him.
  - **Raj E. (triage line):** I put him in arrest with the hook to reproduce it cleanly. I then tapped **Next** eight times and got The Box, Brenda D., Earl W., Aisha J., Frank B., Resus 3, Ivan B., The Box. **Never Raj** (`54-rn-triage-arrest-next.png`).
  - **The door cluster** shows 12 identical grey "?" icons. One of them is a pulseless man (`55-door-cluster.png`). Only the list sheet behind the cluster shows a CODE badge (`56-door-list.png`). Raj died at 12:29.
  - **Tyler D.** (90M, a natural arrest at the door): his card says "Straight to a room". I tapped a room and nothing happened. The engine's reason, "ESI 1 needs a resus bay", never showed. All four resus bays were full (one held a 9-year-old with an ear infection), so he couldn't be roomed anywhere, and he died.
- **Cause:**
  - `needList` (ui.js:2197-2223) gives a wall arrest the same priority as any ESI 1 or alert (`pr 1.5`). Patients in triage or the waiting room get no entry at all, only "The door" (pr 7) or "Waiting room" (pr 6.2).
  - `map.js` draws arrest styling only on rooms (`codefl` and the beacon, map.js:639-642), not on queued or wall patients.
  - `canPlace` forbids any non-resus bed for ESI 1.
- **Why a player cares:** the 20-minute death clock is new. The Next button, which the first-shift card says "jumps to the most urgent thing", sends you elsewhere, and the patient has no marker. The death is unfair and unlearnable.
- **Fix:**
  - Any `p.arrest` gets `pr 0.5` in `needList`, whatever its location.
  - Wall, door and waiting icons get the same red beacon as rooms.
  - An arrest may be coded in any open room or a hallway bed when resus is full. Otherwise the card offers "Move [least sick resus patient] out".
  - A refused tap shows its reason as a toast.
- **Effort:** S-M.

### R5.2-04 High: medical bleeds still get the trauma algorithm ("decompress both sides of the chest") on the path they actually take (Phase 1, a claimed fix)
- **Where:** attending Manic Monday. Fatima K., 28F, a ruptured ectopic, went into shock in the triage line and arrested there at 10:38.
  - Okafor ran her code as `{ r: 'trauma' }`.
  - Her complaint was rewritten to "**Traumatic arrest after hemorrhage**".
  - The trauma card set scores "Stop the bleeding… **decompress the chest**", then "**Decompress both sides of the chest**", as the right answers.
  - The autopilot tally (`node/rhythms.js`, 24 shifts) shows the same: `ectopic:trauma`.
- **Cause:** `hemorrhageTick` sets `p.traumatic = true` for every `bleed: 'mtp'` patient (engine.js:3374), and ectopic and AAA are `bleed: 'mtp'` cases. `codeRhythm` checks `p.traumatic` before `BLEED_CASES` (engine.js:2040-2043).
- **Why the tests pass anyway:** the commit `443497d` says medical bleeds are now hemorrhagic PEA. Its test (`test/rules11.js`) calls `codeRhythm` on a hand-built object that never went through `hemorrhageTick`.
- **Why a player cares:** the game scores a wrong invasive procedure as right for a young woman bleeding from a pregnancy, after the fix for exactly this was announced. R6 should rate it clinically.
- **Fix:**
  - In `hemorrhageTick`, set `traumatic` only for `TRAUMA_CASES` or `alert === 'trauma'`.
  - Word it "Arrested after hemorrhage" for medical bleeds.
  - Add a rule test that lets an untreated ectopic bleed out through `step()` and expects `code.r === 'pea'`.
- **Effort:** S.

### R5.2-05 High: the end-of-shift report still hides deaths (Phase 1, the rest of R5-02)
- **No death count anywhere.** `R.expired` is computed, but the UI uses it only in the class-results payload (ui.js:2395). The "All the numbers" tables have no "Died" row.
- **The verdict is still chosen by stars alone** (ui.js:2632-2633):
  - "Solid shift. The nurses like working with you." over my own dead patient (`21-md-report-verdict.png`).
  - "You kept the doors open. Tomorrow will be better." over a Rush with a no-team death (`67-rush-report.png`).
- **The M&M ranks a quiz answer above a death.** A wrong code card is severity 40. "X died after a VF arrest" is severity 30. Top 3 is by severity (engine.js:4219). So my attending report's "three worst moments" listed two hemorrhagic shocks and "Code for Tyler T.: amiodarone 300 mg", **and left out Tyler's death**.
- **The AFK charge shift:** 10 patients died, and the top 3 were three "went into cardiac arrest in the waiting room" lines. "Died… no code team" is severity 90, below the arrest's 95.
- **A patient still in arrest at 19:00** (Rush: Dmitri H. on the wall) is neither counted nor mentioned.
- **Contradiction:** "Patients who got worse untreated: 0" sits beside a patient of mine who bled to death.
- **Why a player cares:** a teaching game's main feedback screen can't say "good shift" while leaving out who died.
- **Fix:**
  - Put a "**Deaths: N**" line, with names, at the top of every report.
  - With any death, use a death-aware verdict ("You lost N patients today…").
  - Give deaths severity 100 so they always lead the M&M.
  - Report open codes at handoff.
- **Effort:** S.

### R5.2-06 Medium: the code is a frozen-clock quiz, then a 15-minute empty wait, then a dice roll (Phase 1)
- **Time doesn't move between rhythm checks.** Every card says "Two minutes of CPR…" or "Two more minutes…", but all three cards came up at the same clock time: 09:48 → 09:48, 07:14 → 07:14 → 07:14, 13:54. The card pauses the shift (ui.js:2177), and `codePick` shows the next card at once (engine.js:2075-2086).
- **"Two units in, still no pulse"** appears with no blood ordered or given.
- **The orders are locked during the arrest.** The order sheet is hidden ("You're running the code. CPR is going."). The **Resuscitation drugs** menu, labelled "Arrest, unstable rhythms, shock", can never be used in an arrest.
- **Then 15 game minutes with nothing to do** and no timer, ending in "Code called at 10:03. The chaplain is with the family."
- **Why a player cares:** a code should be the most intense two minutes in the game. Here it's a pop quiz with the clock off, followed by waiting. Compare the timed, hands-on resus in Project Hospital or any Code Blue trainer.
- **Fix:**
  - Run the clock during the code, with a rhythm-check card every 2 game minutes.
  - Let the player's own orders (shock, epinephrine, blood) be the answers, using the existing resus menu.
  - Show a code timer and the next check.
- **Effort:** M.

### R5.2-07 Medium: the odds barely reward skill outside VF, and the result explains nothing (Phase 1)
- **The odds** (`node/odds.js`, 150 codes each, own patient):

  | Case | Right answers, run at once | Wrong answers, run at once | Run at 19 min, right / wrong |
  |---|---|---|---|
  | VF | 59% | 21% | |
  | Trauma | 19% | 10% | 15% / 11% |
  | Ectopic (PEA) | 29% | 13% | |

- **What the player can't control:** a free respiratory therapist adds a flat +5% (engine.js:2094). That is half of the best possible asystole odds (10%).
- **No explanation.** The result is one toast, with no odds and no reason.
- **A perfect code is filed as a failure.** It goes into the M&M as one of "your worst moments": "Ana P. died after a VF arrest. 3 of 3 rhythm checks right; the team got there 0 min after the arrest."
- **Why a player cares:** you can't tell whether you played well. In trauma and asystole, wrong answers lose almost nothing, so the cards feel cosmetic.
- **Fix:**
  - Widen the skill term, e.g. `0.15 + 0.85*q`, and make the RT bonus multiplicative.
  - Show "Odds were X%: rhythm, Y min delay, Z of N right" on the outcome toast and in the report.
  - Keep a well-run code out of "worst moments", or add a "Good calls" list.
- **Effort:** S.

### R5.2-08 Medium: the ACLS content is thin, repeats itself, and mostly never shows up (Phase 1)
- **Ten distinct questions in all.** PEA and asystole share their first two cards word for word (`23-card-1.png` and `37-asys-1.png`).
- **The rhythm is named for you** in the title ("Code blue: VF") and in the question, so rhythm recognition, the core ACLS skill, is never tested.
- **What you'll actually see.** Rooms only arrest from bleeding: the only `toArrest` callers are engine.js:3330, 3359 and 3374.
  - Autopilot, 24 shifts: 29 natural arrests. 21 were the EMS arrest case (always the same 3 VF cards), 5 traumatic, 1 PEA, **0 asystole**.
  - My own play, about 18 game hours as attending: every natural arrest was "traumatic PEA" (2 cards).
- **Why a player cares:** after one or two codes the cards are memorised, and most of the content is out of reach.
- **Fix:**
  - Show a rhythm strip image and make naming it the first card.
  - Vary the rhythm between checks (VF to PEA, PEA to VF).
  - Let crashed room patients go on to arrest when untreated.
  - Write 3 to 4 variants per step.
- **Effort:** M-L.

### R5.2-09 Medium: nothing teaches the code, and no code term is explained (Phase 1)
- **No lesson.** The Lessons list has 30 entries and no cardiac arrest lesson (`62-lessons.png`).
- **Turned off where you'd learn.** Code cards are disabled in Orientation and Lessons (`me: … && !G.train`, engine.js:2064).
- **Nothing in the glossary.** Words has none of ROSC, PEA, VF, asystole, defibrillate, amiodarone, "H's and T's" or synchronized cardioversion (0 matches in ui.js).
- **Jargon before the explanation.** The toast "ROSC in Room 2!" is never explained. "The reversible causes: the H's and T's" is offered as an answer before the game has said what they are.
- **Why a player cares:** this breaks the owner's two rules: teach in Orientation and the Lessons, and explain every acronym. A lay student first meets ACLS on a scored shift.
- **Fix:** add a "Cardiac arrest" lesson (a guided VF code, then a PEA code) with code cards turned on in that lesson, and add the eight terms to Words.
- **Effort:** M.

### R5.2-10 Medium: the radio silently pulls you out of a code; ignoring it costs −30 (Phase 1)
- **Steps:** Full Moon Friday, attending.
  1. In Priya S.'s code, the Box rang at 14:27. I tapped **Answer**.
  2. My queue became `box*, code:p14*`: the code paused behind a 5-minute radio call, with no message (`41-radio-during-code.png`).
  3. In my other codes I didn't answer. "Missed radio call" cost −30 each, at 07:26 and 14:09.
- **Cause:** a `box` task has priority −100, ahead of `code` at −90 (engine.js:1462-1463). `boxTake` only docks hidden morale (engine.js:3707).
- **Why a player cares:** either choice is punished, and nothing says so. The charge-nurse Orientation even says not to route a call to a doctor running a code.
- **Fix:** while you run a code, the call rolls to a free attending (Okafor or Nguyen) with a toast, or a card asks "Hand the radio to Dr. Okafor?".
- **Effort:** S.

### R5.2-11 Medium: the plain-words radio glosses give the answer away
- **Where:** Full Moon Friday. "64-year-old male with crushing chest pain. BP 84/52… I'd like to give nitroglycerin." The plain-words line under it read: "**Chest pain with a low blood pressure. They want a drug that lowers pressure.**" Other glosses: "…Simple maneuvers failed. They want the drug that resets it." (`RADIO_PLAIN`, engine.js:1691-1707). Plain words is on by default.
- **Why a player cares:** the same problem as R5-05, now on the radio. The gloss does the reasoning for you.
- **Fix:** the gloss defines terms ("BP 84/52: low pressure") and never states the conflict. Show the reason only on the result card.
- **Effort:** S.

### R5.2-12 Medium: the attending's M&M blames them for patients they can't touch
- **Where:** attending Manic Monday report: "**Fatima (28F) went into hemorrhagic shock.** Massive transfusion wasn't activated in the first 15 min" was one of *my* three worst moments.
- **The attending couldn't act on her.** She was in the triage line, and the attending's card for a patient not in a room is only "The charge nurse is working on a room for Fatima." There is no MTP button (ui.js:945-947).
- **Cause:** `hemorrhageTick` passes `own = !p.prov || !!p.mine`, and `arrestNoTeam` always passes `own = true`.
- **Fix:** count it as yours only when `p.mine`, and give the attending the MTP button for any `bleed: 'mtp'` patient on the board.
- **Effort:** S.

### R5.2-13 Medium: a death is worth less than 80 minutes of an ambulance on the wall
- **Where:** charge nurse, Manic Monday. I went AFK from 12:49 and fast-forwarded with the `OC.step` hook, answering cards with the first choice.
  - The report: 10 deaths with no code team, "Safety events −400", against "**Wall time −6703**".
  - The rates: each death with no code team is −40 (engine.js:2120). Each ambulance on the wall costs −0.5 a minute after 30 minutes (engine.js:3422). One crew parked 110 minutes costs the same as one patient dying unattended.
- **Why a player cares:** a charge nurse learns that parked ambulances matter 17 times more than dead patients. That is R5-21 with real stakes now.
- **Fix:** score a death at −200 or worse, cap wall time per unit, and show each ledger line's share.
- **Effort:** S.

### R5.2-14 Low: two of your own patients in arrest are run one after the other, with no hand-off
- **Where:** Node (`node/two.js`). Two of my patients arrest together. I tap **Run the code** on both, and the second waits 15 minutes in my queue (`wait 15`, which cuts the odds by 60%). Dr. Okafor is free the whole time. No button hands the second code to him.
- **Fix:** a queued code shows "Hand to Dr. Okafor", or it goes to a free attending automatically.
- **Effort:** S.

### R5.2-15 Low: the post-ROSC and dead-patient cards are stale
- **After ROSC:** vitals snap to "HR 100 BP 140/84 … Not improving · treatment not given yet" the moment the pulse is back. The ESI pill stays at 3 (`26-pea-outcome.png`).
- **The CODE badge stays** on dead and ROSC patients.
- **A dead patient's card** still offers "Mark STAT: first in line" and "Call for help from upstairs".
- **"Provider: Not assigned yet"** shows on my own patient in arrest (`22-midexam-arrest-card.png`).
- **Fix:** give arrest, ROSC and dead patients their own card state.
- **Effort:** S.

### R5.2-16 Low: the code feedback arrives after the next question
- **Where:** the floor plan shows toasts one at a time. When card 3 was on screen, the visible toast was still card 1's "Right…". The feedback for cards 2 and 3 arrived after the code.
- **Fix:** put the "Right / Not this one" line on the next card itself, above the new question.
- **Effort:** S.

### R5.2-17 Low: labels on the arrest screens are wrong
- **Wrong card header:** "RHYTHM CHECK 3 OF 3" sits over "The blood gas is back: potassium 7.9" and "The bag-mask isn't moving the chest well", which aren't rhythm checks.
- **Wrong place:** "Arrested in the waiting room" and "went into cardiac arrest in the waiting room" are used for patients in the triage line at the door (Tyler D., Tamika G.).
- **Fix:** label the third card "Cause found", and use the patient's real location.
- **Effort:** S.

### R5.2-18 Low: the cause card is random and doesn't fit the patient
- **Where:**
  - A 30F with cholecystitis got "The bag-mask isn't moving the chest well".
  - A low-risk syncope patient got "potassium 7.9".
- **Cause:** for cases outside the three lists, `codeCause` picks the cause from a hash of the patient id (engine.js:2051-2056).
- **Fix:** derive the cause from the case (a table per condition), or say why ("Unknown history. The gas shows…").
- **Effort:** S.

### R5.2-19 Low: a 9-year-old says "I can't miss another shift at work"
- **Where:** charge nurse, Manic Monday, the AMA card for Mia P. (9 yo F, ear pain). `AMA_LINES` (engine.js:743) ignores age.
- **Fix:** give children's AMA lines a parent's voice ("Her mom says they've waited long enough").
- **Effort:** S.

### R5.2-20 Low: the attending report says "Patients who got worse untreated: 0" while your patient bled to death
- **Where:** Manic Monday attending report. Tyler T. bled into arrest with MTP never ordered, and the counter tracks only the `txGap` path.
- **Fix:** count bleed-driven shock and arrest in "got worse untreated".
- **Effort:** S.

### R5.2-21 Nitpick: the M&M text breaks grammar and capitals
- "Priya S. died after **a asystole** arrest."
- "The call: keep **cpr** going; epinephrine 1 mg **iv** now." "…the **h's and t's**." "…in case it turns to **vf**." `codePick` lowercases the whole answer (engine.js:2083).
- **Fix:** use "an" before a vowel, and don't lowercase answer text.
- **Effort:** S.

### R5.2-22 Nitpick: the same report names patients three different ways
- "**Resus 2** went into hemorrhagic shock" (that is Tyler T.), "**Fatima (28F)** went into…" and "**Tamika G.** died…".
- **Fix:** use "Name, age and sex" everywhere in the M&M.
- **Effort:** S.

### R5.2-23 Nitpick: the Play menu contradicts itself
- "Attending, 07:00 to 19:00." sits directly above "Five-Minute Rush: Two packed hours, 07:00 to 09:00." (`01-play-menu-md.png`).
- **Fix:** "Attending. Pick a shift."
- **Effort:** S.

### R5.2-24 Nitpick: "Run the code" promises a takeover that doesn't happen for your own patient
- The unassigned-arrest hint says "Another doctor takes it in a minute if you don't." Your own patient's hint says "After 20 minutes they are gone." Nobody takes your patient (see R5.2-14), so the two hints describe different rules without saying why.
- **Fix:** one rule, stated once: "If you can't, hand it to Dr. X."
- **Effort:** S.

**Counts:** High 5, Medium 8, Low 7, Nitpick 4 (24 total). The Phase 1 findings are R5.2-01 to R5.2-10.

## 4. Coverage

**Played with real taps:**
- **Attending, Manic Monday, 07:00 to 19:00.**
  - By hand: the first patients, the first radio call, the A-fib order set, Tyler T.'s natural traumatic arrest with code cards answered 1 right and 1 wrong, and the end-of-shift report.
  - In between, my round-1 policy played: it follows the "Still needed" hints and reads the true diagnosis, and it answered radio calls with the first option. It also saw another provider run a natural arrest (Fatima K.).
- **Attending, Quiet Tuesday, to 09:37.** A forced mid-exam arrest: PEA, all right, ROSC, then Discharge home on purpose, the patient's return visit, and a forced own arrest ignored for 20 minutes.
- **Attending, Full Moon Friday, 07:00 to 14:40** (policy to 13:07):
  - a forced VF arrest I lost while another patient's sheet hid the room, which is my own fumble but a real UI trap;
  - a forced VF code, all right, died;
  - a forced asystole code, all wrong on purpose;
  - answering the radio mid-code.
- **Attending, Five-Minute Rush:** Next jumped to my own arrest. I reloaded the page mid-code at rhythm check 2, and Resume brought back the same card and step.
- **Charge nurse, Manic Monday, 07:00 to 12:49,** with the round-1 "tap Next, first sensible button" player plus my hands:
  - a natural wall arrest (Andre M.);
  - a forced triage arrest (Raj E.) with the Next cycle;
  - natural waiting-room arrests (Tyler D., Keisha J., Olga L.);
  - trying to bed a pulseless patient with resus full.
  - Then I fast-forwarded with `OC.step` to 19:00 (AFK) and read the report.
- **Charge nurse, Five-Minute Rush,** at 1× in real time, full length, with the player script. There were two natural arrests (triage, wall).
- **Orientation:** the first 10 steps, the Main-menu exit, the Learn tile and the main-title resume. I also opened the Lessons list.

**Hooks used:**
- `OC.toArrest` to force 7 arrests. Natural arrests in attending play are almost all bleeds.
- `OCUI.U.paused` once.
- `OC.step` for the AFK charge-nurse fast-forward.
- Read-only `OC.G` / `OC.pt` / `OC.codeRhythm` for state.

**Node:** `node/odds.js` (ROSC odds by rhythm, answers and delay), `node/ignore.js` (score cost of ignoring a code versus running it), `node/two.js` (two codes at once), `node/rhythms.js` (natural rhythms in 24 autopilot shifts), and `node test/sim.js` unmodified.

**Not covered, and why:**
- **The 3D floor:** software GL here is too slow, and its code is unchanged.
- **Class codes end to end:** the backend is unreachable from this container.
- **Feel on real touch hardware, and sound:** the browser was headless.
- **Others not played:** attending Orientation, the MIEMSS pack, scenarios and weather, and the unstable A-fib cardioversion path in live play. That last one is R6's area, and no A-fib patient crashed for me.
- **A natural asystole code:** none occurred, so I forced one.

## 5. What I'd grudgingly keep

- **Run the code** on your own patient exists, and every code I ran ended in ROSC or death.
- Save and resume mid-code restores the exact card and step.
- Next jumps to your own coding room.
- Each code card's one-line "why" is short and correct in its wording.
- The 20-minute rule gives the toast teeth: "Nobody ran the code."
- The flat floor plan still runs smoothly and reads clearly.
