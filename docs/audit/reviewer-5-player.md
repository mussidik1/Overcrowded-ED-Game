# Reviewer 5: Hardcore gamer and game critic

Build reviewed: branch `claude/sleepy-rubin-jot35n`, v0.29.1, working tree as committed. Served over http and played in headless Chrome at 844x390 (phone held sideways), with real taps on real buttons. Screenshots and scripts are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/r5/` (`shots/`, `driver.py`, `player.py`, `mdpolicy.py`). Where I used `OC`/`OCUI` hooks to fast-forward time or to read state, I say so.

## 1. Verdict

No, I would not keep playing past ten minutes on my own, and I would not recommend it as it stands. The verdict is **Only after major work.** Under the jargon, the charge-nurse game is "tap Next, then tap the first button". Its difficulty runs backwards: the Five-Minute Rush hands a button-masher "Charge nurse of the year", and "Quiet Tuesday, learn the board" buries a newcomer. The attending game should be about diagnosis, and it keeps giving the answers away. It prints the diagnosis on alert patients before any test, tells you "Still needed: Urinalysis, Pregnancy test", and when you guess wrong it fixes the diagnosis for you and carries on. The end-of-shift summary lies about what happened. Patients sit in cardiac arrest for six hours, "Everybody survived the shift, mostly" shows on screen, and one of my own patients got stuck in endless CPR because the game has no button to run her code.

## 2. Score

**4/10.** There is real content here: 76 cases, 41 events, a medical-direction quiz and a readable flat map. But the core loops are either solved for you or broken at the edges, and the scoring reflects what the AI did more than what the player did.

## 3. Findings, worst first

### R5-01 High: your own patient who arrests can never have a code run. CPR goes on until the shift ends.
- **Where:** Attending, Manic Monday, real play. Brenda R., 21F, a ruptured ectopic, was assigned to me (`prov: md1, mine: true`). She went to "Traumatic arrest after hemorrhage" in Resus 3. Her card then showed "No pulse. CPR in progress" with nothing but the normal order menus. There was no "Run the code" button. "Sign with no orders" was refused with "Pick at least one order". She stayed in arrest from about 14:30 to 19:00. I fast-forwarded the last 22 minutes with `OC.step` and checked: still `arrest: true, ev: 'none', outcome: null` at 19:00.
- **Cause:** a code only resolves through a `code` task, and that task is created only inside `assign()` (`src/engine.js:1433`). `toArrest()` (`engine.js:3149`) leaves `p.prov` set. The UI shows "Run the code" only when `!p.prov` (`src/ui.js:948`), and the autopilot skips patients whose `p.prov === G.me` (`engine.js:4121`). The board tag still says "CODE: run it" (`ui.js:504`), but there is no button that does it.
- **Why a player cares:** the game's most dramatic moment turns into a dead end that never resolves. The patient also never shows up as a death (see R5-02).
- **Fix:** in `toArrest`, if `p.prov` is set, queue a `code` task on that provider. For `G.me`, put a "Run the code" button first on the card whenever `p.arrest && p.ev !== 'doing'`. Add a rule test that arrests a patient who is already `mine` and expects `codeOutcome` within 20 minutes.
- **Effort:** S.

### R5-02 High: patients who arrest and never get a team stay in arrest forever. The summary says everyone survived.
- **Where:** Charge nurse, Quiet Tuesday. I went AFK from 13:56 to 19:00 and answered only the decision cards. At 19:00, seven patients were `arrest: true` with `outcome: null`. They were in the triage line or on the wall, and some had arrested at 06:07 game time (`tCrash` 367 to 677). `stats.expired` was 0. The report (`shots/22-afk-end.png`) lists "Ivan L. went into cardiac arrest in the waiting room" and "Joyce C. bled until their heart stopped" under M&M. Directly above them it says "**Rough one. Everybody survived the shift, mostly.**" The Manic Monday report (`shots/27-mm-report.png`) prints the same sentence over the waiting-room arrest of Liam C., a seven-year-old.
- **Cause:** `waitingArrest`/`toArrest` (`engine.js:3149-3160`) set `dispo: 'code'`, and nothing ever ends an unattended arrest. The verdict is a fixed string picked by star count (`ui.js:2629-2630`, `ui.js:2643`). It never looks at arrests or deaths.
- **Why a player cares:** for a teaching game this is the wrong lesson. A pulseless child "waits" for hours with no consequence beyond points, and the game reassures you that everyone lived. Any clinician who plays it will stop trusting it.
- **Fix:** an arrest with no code started within about 10 minutes ends as `expired` and counts as a death. Pick the verdict from outcomes first: any death means no "survived" line. Name every death at the top of the report.
- **Effort:** S.

### R5-03 High: the attending's grade is mostly the AI's work. "Solid shift" with 28% clinical and 1 of 3 diagnoses right.
- **Where:** Attending, Manic Monday (`shots/50-md-stuck-code.png`, `shots/51-md-report.png`). My result was Clinical 28%, 6 of 11 radio calls wrong, 2 must-not-miss diagnoses wrong, and one patient left in shock and then arrest (R5-01). The verdict was "**Solid shift. The nurses like working with you.**" Patients scored 85%, Admin 97% and Staff 88%. The engine produced those by running the charge nurse, registration, EVS and transport for me.
- **Cause:** `overallStars()` averages the stars of all four categories (`engine.js:783`). `care()` (`engine.js:788`) limits only Clinical to the attending's own patients, so the other three reflect the computer.
- **Why a player cares:** the one score that measures your decisions counts for a quarter of the grade. You can play the attending badly and still be praised. Stars and "best" records stop meaning anything.
- **Fix:** in attending mode, base the stars and verdict on Clinical, diagnostic accuracy, medical direction and legal risk. Show the department-wide scores as context only.
- **Effort:** M.

### R5-04 High: the difficulty curve is backwards for the charge nurse and flat for the attending.
- **Where:** my own play plus the project's own simulation. I ran `node test/sim.js` unmodified.
  - The same naive "tap Next, pick the first button" player (`player.py`) earned "**Charge nurse of the year. Somebody frame this board.**" on the Five-Minute Rush (Patients 87, Clinical 77, Admin 96: `shots/53-rush-report.png`). On **Quiet Tuesday**, which the menu sells as "Fewer ambulances, no call-outs. Learn the board.", it collapsed to Clinical 21% and Admin 26% by 13:56.
  - The developer's own profiles agree. "newbie" averages 2.4 stars on Rush and 0.4 stars on Quiet Tuesday. "real", described in `sim.js` as a first shift, averages 2.8 on Rush, 1.4 on Quiet Tuesday and 0.4 on Manic Monday.
  - Attending: the "doc" profile gets 3.0 stars on every level, including Full Moon Friday, with the same ~44-46 patients seen. Even "slowdoc" gets 3.0 on easy and medium and 2.2 on hard. The level choice barely changes the attending's job, because the engine absorbs the extra load.
- **Why a player cares:** the mode labelled as the gentle on-ramp is where newcomers fail, and the "intense" five-minute mode is a free win. As the attending, the four difficulty buttons look like choices but mostly aren't.
- **Fix:** retune `LEVELS.easy` (`engine.js:77`) until the "real" sim profile reaches about 2 stars there. Make Rush scoring stricter, or relabel it as the tutorial-length mode. For the attending, scale the player's own load with the level: more patients assigned to "You", more radio calls, sicker cases.
- **Effort:** M.

### R5-05 High: the attending game gives away its own answers.
- **Where:** Attending, Manic Monday, real play.
  - **Workup:** I ordered a urine dip and nitrofurantoin for a UTI and signed. The card came back with "**Still needed: Urinalysis, Pregnancy test.**" For a GI bleed: "**Still needed: IV fluids.**" Any partial order is followed by the exact list of what is missing (`gapHint`, `ui.js:1082`). My hint-following policy (`mdpolicy.py`) needs no medical knowledge: order one CBC, read the hint, order exactly that.
  - **Diagnosis:** Jean D., a trauma alert, arrived with "**DIAGNOSIS: Subdural hematoma**" printed on the card and Neurosurgery already at the bedside. No CT had been ordered (`shots/40-md-next.png`).
  - **Wrong diagnosis:** I picked "Lower GI bleed" for "Vomiting blood". The toast said "Not Lower GI bleed. It's Upper GI bleed.", the card switched to Upper GI bleed, and play went on as if I'd been right. The cost was 5 legal-risk points (`shots/46-md-wrongdx.png`).
  - **Consults (charge nurse):** a wrong service is declined with "Trauma Surgery declined Resus 1: not theirs. **Try Neurosurgery.**"
  - **Diagnosis questions** are often answered by the chief complaint: "Vomiting blood" against Lower GI bleed / Gastritis / Upper GI bleed / Esophagitis.
- **Why a player cares:** "see patients, order tests, make the call" is the attending's whole appeal, and each step comes with its answer. There is nothing to master, and no learning happens, because recall is never required.
- **Fix:** show "Still needed" only in Orientation and Lessons, never in a regular shift. On a shift, an incomplete workup should hold back the results the player needs for the diagnosis. Show the diagnosis on alert patients only after the confirming test returns. A wrong diagnosis should drive a wrong-track outcome, such as the wrong consult or a deteriorating patient, not an instant fix. Decline consults without naming the right one.
- **Effort:** M.

### R5-06 High: turning the 3D floor off doesn't stop it rendering.
- **Where:** I started a shift with the 3D floor on, wrapped the WebGL draw calls in a counter, then set the floor to off (`U.three = false`, the same thing the menu's "3D floor: off" does). Result: **2,431 draw calls in 5 s with 3D on, and 3,490 in 5 s with it off.** The canvas stayed `display: block` behind the flat map. Before I found this, I had switched 3D off mid-Orientation, and the page dropped to **1 animation frame in 2 seconds**. Screenshots timed out, and taps took over 20 s.
- **Cause:** `frame()` in `src3d/map3d.js:658-680` keeps drawing while `el.isConnected && !document.hidden`. `el` is `#map`, which is always connected. `off3d()` (`src/map.js:535`) only removes a class.
- **Why a player cares:** the people who turn 3D off are the ones whose phones are struggling. They keep paying the GPU and battery cost and get nothing for it. On a weak phone the flat map stutters for no visible reason.
- **Fix:** give `OC3D` a `pause()`/`resume()` that cancels the animation-frame loop, and call it from `off3d()` and whenever `floor3d()` is false. Add a test that counts draw calls after the toggle.
- **Effort:** S.

### R5-07 Medium: leaving Orientation through "Main menu" throws away your progress, even though the menu says it's saved.
- **Steps:** a fresh profile with the flat floor. Learn, Orientation, play to step 11 of 69 (Maria in the waiting room). Open ☰. The menu reads "**The shift is paused and saved on this device.**" Tap Main menu. You land on the Learn menu, and Orientation shows "Start here" with no resume option. Tap it: it starts again at step 1 of 69, "Welcome to Orientation" (`shots/58-orient-resume.png`). `oc-save` is gone. Only finished chapters are kept (`oc-ch-rn-N`). A regular shift does offer "Resume your shift" (`shots/59-title-after-quit.png`).
- **Why a player cares:** Chapter 1 alone is 27 steps. A student whose phone rings has to redo it all.
- **Fix:** save and resume the coach step the way a shift is saved. Until then, change the menu text in Orientation so it doesn't promise a save.
- **Effort:** S.

### R5-08 Medium: "Sign with no orders" refuses to sign with no orders.
- **Steps:** Attending. Open a new chest-pain patient (Lucia H., 70F) and tap the big blue "**Sign with no orders**". The toast says "**Pick at least one order**" and nothing is signed (`shots/47-md-noorders.png`).
- **Cause:** the label is shown whenever `p.ord === 'need'` (`ui.js:1083`), but the engine accepts a no-order sign only if the case truly needs nothing (`engine.js:1802`).
- **Why a player cares:** the button contradicts itself, and the refusal also tells you the patient needs something, which is another free answer (R5-05).
- **Fix:** let it sign, and score it as "missed" afterwards.
- **Effort:** S.

### R5-09 Medium: pausing hides the board. There's no way to stop the clock and plan.
- **Where:** the only pause is ☰, which opens a full-screen menu over the board (`shots/06-menu.png`, `shots/19-stuck.png`). Patient sheets don't pause, so you write orders and pick consults with the clock running: 1.4 game minutes in 3 s at 1×, measured. As the attending I lost my first patient to PA Rivera while reading the card ("Leave them too long and another provider picks them up").
- **Why a player cares:** every serious management sim (Two Point Hospital, Project Hospital, RimWorld, Frostpunk) lets you pause and still look at and act on the world. Here, pausing means you can't see anything. On a phone you can't plan, and a long order menu becomes a race against the clock.
- **Fix:** make the speed button cycle through a ⏸ that freezes `E.step` but keeps the board and sheets usable. Keep the menu separate.
- **Effort:** M.

### R5-10 Medium: the order menus are an ever-growing accordion that keeps its state across patients, with the clock running.
- **Where:** Attending. After ordering oral antibiotics for a UTI and clot drugs for the subdural, the next patient's order sheet (Ivan M., GI bleed) opened with "Antibiotics by mouth" and "Clots, bleeding, and reversal" already expanded. That's 16 irrelevant chips before you reach anything you want (`shots/42-md-next.png`). Opening "Fluids and blood" collapses the Medications menu you just opened, so "med:other" disappears and you have to open Medications again. There is no search.
- **Why a player cares:** in a real-time game that is pure friction. On a phone in landscape you scroll a 1,000+ px sheet while your patient gets worse.
- **Fix:** reset the menu state for each patient. Let several groups stay open. Add a type-ahead search field for drugs and tests.
- **Effort:** M.

### R5-11 Medium: repeated taps on a wrong consult are each charged in full, with no debounce.
- **Where:** Charge nurse, Manic Monday. My scripted player kept re-picking Trauma Surgery for a subarachnoid hemorrhage. Each pick was declined ("Try Neurosurgery") and each was charged: `stats.wrongSpec = 173`, and the report showed **Consults −1760**, the biggest single line.
- **Why a player cares:** a nervous double-tap on a phone costs twice, and one stuck habit can wreck a shift's score with no warning.
- **Fix:** after a decline, grey out that service for that patient for a few minutes. Charge a wrong-service penalty once per patient per service.
- **Effort:** S.

### R5-12 Medium: medical-direction penalties ignore how dangerous the order is.
- **Where:** In my "try to lose" attending run I answered 10 radio calls wrong on purpose. They included CPAP for a tension pneumothorax with BP 70/30, refusing calcium and albuterol for hyperkalemia with a heart rate of 44, and "keep going" after 25 minutes of asystole. Legal risk only reached **17%** by 14:51, with no admin call. Every wrong order is a flat `litAdd(3, ...)` (`engine.js:3542`), and the risk decays by 1 every 20 minutes (`engine.js:513`).
- **Why a player cares:** a fentanyl dose that's a bit high is penalised the same as killing a patient with CPAP on a tension pneumothorax. The legal-risk meter teaches no sense of priority.
- **Fix:** give each scenario a harm weight (lethal choices 10 or more), and attach an M&M line to lethal answers.
- **Effort:** S.

### R5-13 Medium: the medical-direction pool is small enough to memorise in two shifts.
- **Where:** `SCEN.national` has **24** scenarios (10 multiple choice, 14 yes/no). Manic Monday fires one every 32-50 game minutes (`engine.js:78`), so about 18 per shift, and `nextScen` shuffles without repeats until the pool runs out (`engine.js:3483`). By the second attending shift you have seen nearly all of them. On the yes/no calls, "Approve" is right in 23 of 32 across both packs (72%).
- **Why a player cares:** the radio is the attending's most frequent interruption, and after one shift it becomes recall of the same cards. Always tapping Approve beats chance.
- **Fix:** write 3 to 4 times more scenarios, vary the numbers (weights, doses, vitals) in each, and balance yes and no answers.
- **Effort:** L.

### R5-14 Medium: Lessons don't make you recall anything, and Orientation is 69 steps on rails.
- **Where:**
  - The **Aortic dissection** lesson is five text cards with "Got it" over an empty department, with no patient and no question (`shots/56-dissect-1.png`). It took 1.3 s to "complete", and the lesson was marked done. That is 21 of the 30 lessons.
  - The guided **Stroke** lesson dictates the exact taps: "Tap her room. Then CT head, BMP, Labetalol …, Tenecteplase (Clots), Sign." It ends with no check.
  - Orientation (charge nurse) is **69 steps**, and every one tells you what to tap. Even step 51, titled "**Your call**", says "Tap her room, then Observation."
- **Why a player cares:** none of this is a game, and it isn't good teaching either: nothing asks the learner to retrieve anything. A gamer quits Chapter 1 around step 15. A student finishes the lessons without being tested once.
- **Fix:** end each case lesson with a short real case in a room, with no hints, scored. Make guided lessons ask the question ("What do you order first?") before showing the answer. In Orientation, replace the dictated "Your call" steps with real choices and feedback.
- **Effort:** M.

### R5-15 Medium: there is almost no progression or reward loop.
- **Where:** after Orientation, two lessons and four shifts, all the game has kept is stars per level (`oc-best4-*`), lesson ticks and "Done ✓" on Learn. Nothing unlocks: no new hospital, staff, scenario, rank or career track. Scenarios and weather are open dropdowns from the start (`shots/23-play-menu.png`).
- **Why a player cares:** Two Point Hospital, Diner Dash and Overcooked all hang a next goal in front of you. Here, once you've seen the cases there is no reason to play another shift except to raise a star count.
- **Fix:** add a light campaign: a sequence of shifts with goals that unlock scenarios, specialties or a second hospital, plus per-case mastery ticks fed by the attending accuracy log the game already keeps.
- **Effort:** L.

### R5-16 Medium: pantoprazole for an upper GI bleed is scored "Not needed", despite the drug's own description.
- **Where:** Attending. Ivan M., "Vomiting blood". I ordered pantoprazole, and the report says "Ivan M. · Upper GI bleed · **Not needed: Meds**". The drug's own chip in the order menu reads "Pantoprazole: Acid blocker by vein: **ulcer bleeding**" (`engine.js:374`). The `gib` case has `tr: ['fluids', 'blood']` (`engine.js:638`), and `ALSO` lists only `dka: ['kcl']` (`engine.js:430`).
- **Why a player cares:** the game recommends a drug for exactly this, then marks the player down for using it. A student who trusts the tooltip gets penalised.
- **Fix:** add `panto` (and probably `octreo` for a suspected variceal bleed) to `ALSO.gib`.
- **Effort:** S.

### R5-17 Medium: toasts cover the HUD on the upright list board.
- **Where:** `docs/audit/screenshots/phone-21-rn-busy-midday.png`. Two stacked red toasts ("Missed radio call…" and "Missed: Door to CT under 25 min…") hide the clock and the four score pills. The translucent Next button floats over rooms 15-16.
- **Why a player cares:** the moment something goes wrong is the moment you lose sight of the clock and your scores.
- **Fix:** put toasts in a lane below the top bar (or above the dock), show one at a time, and keep the Next button off the room grid.
- **Effort:** S.

### R5-18 Low: patient-experience scores and exam text are frozen and break immersion.
- **Where:**
  - Brenda R., "No pulse. CPR in progress", shows "**Experience 89% · updated 50m ago**".
  - Lucia P., status epilepticus, after **2 hours** in Resus 1 still reads "Rhythmic jerking of all four limbs. Eyes open, not responding" beside "Steady" vitals (`shots/17-qt-play.png`).
- **Fix:** hide Experience for patients in arrest or unresponsive. Give each case an "after treatment" exam string.
- **Effort:** S.

### R5-19 Low: every shift with call-outs opens with the same staffing card before you've seen a patient.
- **Where:** Manic Monday (`shots/24-mm-intro.png`) and the Rush (`shots/52-rush-start.png`) both open at 07:00 with "House supervisor · Call-out", offering the same four choices (Float Casey / Split / Agency / Mandate). In the Rush, the safe-looking "Float RN Casey picks up Pod A" led straight to "Raj D. fell in Room 1 … load of 6.0 against a limit of 4".
- **Why a player cares:** the first thing you do is a costed decision whose costs you can't judge yet, and it's identical every shift.
- **Fix:** fire the call-out 20 to 60 minutes into the shift. Vary who calls out and the options, and show each pod's current load on the card.
- **Effort:** S.

### R5-20 Low: the charge nurse's Box is busywork.
- **Where:** charge nurse, every shift. Each medical-direction call is "Find a doctor", then pick a doctor from a list (`shots/21-find-doctor.png`). You never answer it yourself. Unanswered calls still cost points ("The Box −600" in the AFK run), and the EMS coordinator card complains about them.
- **Why a player cares:** a recurring two-tap chore with no decision in it.
- **Fix:** make the routing a real choice. Show each doctor's load and code status, and charge for a busy pick. Or route automatically to the least-busy attending, with an override.
- **Effort:** S.

### R5-21 Low: the score ledger is dominated by one line, so it can't guide the player.
- **Where:** AFK Quiet Tuesday: "Wall time **−3637**" against every other line combined at about −2,000 (`shots/22-afk-end.png`).
- **Fix:** cap or log-scale each ledger line, and show the share each one contributed.
- **Effort:** S.

### R5-22 Low: two different Dr. Okafors.
- **Where:** the ED attending is "Dr. Okafor" (`engine.js:118`), and so is the vascular surgeon (`engine.js:4275`). Both appear on the same consult screen and board.
- **Fix:** rename the surgeon.
- **Effort:** S.

### R5-23 Low: "Sign 5 orders" signs 4.
- **Where:** Attending, Lucia H. I ordered troponin, CBC, BMP, chest X-ray and aspirin. The button said "Sign 5 orders" and the toast said "4 orders signed for Room 3".
- **Fix:** count the same way in both places, and say which one was dropped and why.
- **Effort:** S.

### R5-24 Low: the coach card and the patient card disagree on vitals.
- **Where:** Orientation step 38. The coach says Tyler's "BP 78/40". His card beside it reads "BP 77/37" (`shots/or_t2.png`).
- **Fix:** have the coach text read the live vitals.
- **Effort:** S.

### R5-25 Low: the default 3D floor doesn't show room numbers at phone size, though Orientation says "Tap Room 1".
- **Where:** `shots/04-orient-a.png`, 3D at 844x390. Pod signs are about 8 px, and the individual room numbers can't be read. Only the preceptor's ring shows you where Room 1 is.
- **Fix:** put room-number labels on the 3D floor at the default zoom, or open Orientation on the flat map.
- **Effort:** S.

### R5-26 Low: zero-star results show as three orange star outlines on the menu.
- **Where:** after a 0-star Quiet Tuesday, the Play menu shows "☆☆☆" in gold beside it (`shots/23-play-menu.png`). At a glance it reads as an award.
- **Fix:** show nothing for 0 stars, or grey outlines.
- **Effort:** S.

### R5-27 Low: "Learn: Done ✓" after Orientation, with 28 of 30 lessons untouched.
- **Where:** the title after Orientation and two lessons reads "Learn … Done ✓". The Learn menu itself says "Lessons 2 of 30 ✓".
- **Fix:** show "Orientation ✓ · 2/30 lessons" on the tile.
- **Effort:** S.

### R5-28 Nitpick: the first-visit About page puts Start below the fold on a sideways phone.
- **Where:** `shots/01-first-visit.png`, 844x390. You have to scroll to find Start.
- **Fix:** make the Start button sticky.
- **Effort:** S.

### R5-29 Nitpick: the returning player's title screen has no hook.
- **Where:** `shots/01-first-load.png`. After the first visit, the title is "Code Black" and two role buttons, over a blurred board. The only line that sells the game ("Run a busy ER for one twelve-hour shift.") lives on the About page.
- **Fix:** keep the one-line pitch under the title.
- **Effort:** S.

### R5-30 Nitpick: an ambiguous list on a lesson card.
- **Where:** Aortic dissection card 3: "Order an ECG, CT angiogram, aorta, Troponin and Type and screen." "CT angiogram, aorta" reads as two items.
- **Fix:** "CT angiogram of the aorta".
- **Effort:** S.

### R5-31 Nitpick: the joke verdict reads as cruel over child deaths.
- **Where:** "Everybody survived the shift, **mostly**." printed over a seven-year-old's waiting-room arrest (`shots/27-mm-report.png`).
- **Fix:** covered by R5-02. Drop the joke whenever any patient died.
- **Effort:** S.

## 4. Coverage

**Played, with real taps:**
- First visit with the About page. To reach it I overrode `navigator.webdriver` with an init script, because the game skips About for automated browsers (`ui.js:2602`).
- Charge-nurse Orientation, all 4 chapters and 69 steps. The first 10 steps were on the 3D floor; I tapped the preceptor's lit target at every step, as `train_test.py` does.
- Quiet Tuesday as charge nurse: about 7 hours with a "tap Next and the first button" player, then AFK to 19:00. I answered cards only, to try to lose.
- Manic Monday as charge nurse: a full shift with a scripted UI-only player (`player.py`, `chooser.py`). It reads the card and taps buttons, with my interventions along the way.
- Five-Minute Rush as charge nurse: full, at 1×, real time (301 s).
- Manic Monday as attending, played by hand from 07:00 to about 10:00. That covered 6 radio calls (one answered wrong on purpose), UTI, subdural, GI bleed and NSTEMI patients, one deliberate wrong diagnosis and one "Sign with no orders". After that, a hint-following UI policy (`mdpolicy.py`) played to 18:38, and I fast-forwarded the last 22 minutes with `OC.step` to confirm R5-01.
- A second attending Manic Monday, playing to lose: 10 radio calls deliberately wrong, to 14:51.
- Lessons: Stroke (guided) and Aortic dissection (case cards).
- Menus, Settings, How to play, the Lessons list, the resume and quit paths, and the Main-menu exit from Orientation.

**Hooks used:**
- `OC.G`/`OC.pt` to read state for the findings, and (in `mdpolicy.py`) to read the true diagnosis, so the policy could act like a competent clinician. That's noted where it matters.
- `OC.step` for one 22-minute fast-forward.
- `OCUI.U.paused`/`U.three`/`U.sheet` a few times, to inspect or isolate a state.
- A WebGL draw-call counter for R5-06.
- `node test/sim.js`, unmodified, for the difficulty numbers.

**Not covered, and why:**
- **The 3D floor as a real player sees it.** Software GL in this container rendered so slowly (10 Orientation steps took 422 s) that I switched to the flat floor for everything else. I can't judge 3D frame rate or touch feel on real phones. R5-06 holds regardless.
- **Feel on real touch hardware**, and sound (headless).
- **Attending Orientation** (3 chapters), **Full Moon Friday**, the scenarios and weather, and the **MIEMSS** radio pack.
- **Class-code join and results end to end.** The backend can't be reached from this container, so I relied on the brief's screenshots.
- **A real "fired" ending.** It needs 75% legal risk, and playing badly through the UI only reached 17%. The fired screen exists in the brief's screenshots, which were made with `litAdd`.

## 5. What I'd grudgingly keep

- The flat SVG floor plan: legible, it ran at 60 fps here, and one tap on a dirty room sends EVS.
- The Next button as a prioritised to-do jump.
- The M&M "three worst moments" lines, which say why ("25 min to get a bed. 20 clean beds were open at the time.").
- The radio-call result cards with a one-line plain-words reason.
- Regular shifts resume correctly from the title ("Resume your shift").
- Plain-words glosses on every drug and test chip.
- The amount of case content: 76 cases and 41 events is enough to build a real game on.
