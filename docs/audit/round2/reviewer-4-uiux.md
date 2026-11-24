# Reviewer 4, round 2: UI/UX (senior game UI/UX designer)

Re-audit of branch `claude/sleepy-rubin-jot35n` at v0.30.0 (HEAD 49aea94), Nov 24 2026.
Screenshots and scripts: `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round2/r4/` (called `r4/` below; images in `r4/shots/`).
I ran the committed `index.html` in headless Chrome at 390×844 (`phone`), 844×390 (`phone-land`), 820×1180 (`tablet`) and 1440×900 (`desktop`). Before that I rebuilt it in a scratch copy: the only differences from the committed file were the image credits and the CSP hash that changes with them, so the committed build matches the source.

What changed in my area since round 1: `src/style.css`, `src/map.js` and `src3d/` are **byte-identical** to the audited commit (`git diff 6edcc3d..HEAD --stat` is empty for them). `src/ui.js` changed in four places only: the `cardiovert` entry in `ORDER_TX`, the own-patient arrest block in `mdPrimary0`, a `PAST_V` comment, and the 0-star verdict text. Everything else that is new on screen comes from engine data: the code cards, the "Pronounced dead" vitals line, the IM antibiotic group, the cardioversion chip and the no-team death toast.

## 0. Round-1 status

| ID | Round-1 severity (Verifier) | Status | Evidence at v0.30.0 |
|---|---|---|---|
| R4-01 Gate on a phone: Play off-screen | High | **Still open** | With edcodeblack.com routed to the local build at 390×844: gate scrollWidth is 514 against 390, the card spans x=47–467 and **Play** sits at x=389–467 (`r4/shots/s6-gate-phone.png`). The CSS is unchanged. |
| R4-02 Class-code sheet scrolls sideways | High | **Still open** | At 390×844 the sheet's scrollWidth is 437 against clientWidth 393, before and after making a code (`s6-classcode-made-phone.png`). |
| R4-03 A new class code is invisible | High | **Still open** | After tapping Manic Monday, `.cc-code` top is at 864 px in an 851 px viewport, and at 703 px in a 390 px viewport. The `.cc-box .cc-box` nesting is still there. |
| R4-04 Toasts cover the HUD and the radio | High→Medium | **Still open** | `phone-05-outcome-toast.png`: two toasts cover the clock, all four score pills and the Box bar ("Medic 34 needs you on the line"). `s4-phone-bicillin.png`: a toast is drawn across the clock. It now also carries the code-card feedback (R4.2-02). |
| R4-05 Four "waiting" counters | High→Medium | **Still open** (not re-demonstrated) | `renderMeter` and the Next code are unchanged. In my midday run the autopilot had cleared the waiting room, so all the counters read 0. |
| R4-06 State text far below legible size | High | **Still open** | `.tg` is 9.5 px and `.pv` 10 px. On the flat floor at 844×390, 52 of 101 SVG labels render at ≤9 px (minimum 7.3 px, median 8.7 px). The 3D zone pills are about 7 px (`s7-desktop-3d-arrest.png`). New text at this size: code feedback at 10.5 px (R4.2-02). |
| R4-07 Touch targets under 44 px | High | **Still open** | Flat floor at 844×390: 68 of 104 visible tappables are under 44 px in one dimension. Staff are 21×21, waiting patients 15×17, rooms 46×21 and pills 38×20. New: code-card answers are 42 px tall at 844×390 (R4.2-15). |
| R4-08 Colour-only meaning | High→Medium | **Still open** | The CSS is unchanged. `.tg.need` and `.tg.done` still differ only in hue. |
| R4-09 Contrast failures | Medium | **Still open** | The tokens are unchanged. `.mc-who` (#7A8493 on white, 3.78:1) is now the code card's "rhythm check N of M" line. The ESI 2 badge is still 2.97:1. |
| R4-10 Next blinks constantly | Medium | **Still open** | The Next button is caught mid-fade in `phone-05-outcome-toast.png` and `s7-desktop-3d-arrest.png` ("1 Next · Room 6" in washed-out pink). |
| R4-11 See-through "Turn sideways" screen | Medium | **Still open** | `phone-00-rotate.png`: the "Three things to know" card and its buttons show through the overlay. |
| R4-12 Dialog focus and keyboard | Medium | **Still open** | I opened a code card with Enter on "Run the code": `document.activeElement` is `BODY`, not in the modal. The body text starts with the background graffiti ("rm 6 → 4W ✓ call ortho!!"). |
| R4-13 No text scaling | Medium | **Still open** | `body.ingame { touch-action: pan-x pan-y }`, every size is in px, and there is no text-size setting. |
| R4-15 The "fired" screen contradicts itself | Medium | **Still open** | `scoreCardsHTML` still prints `R.fail ? 'They walked out'`. `mmHTML` still prints "Take the win" with no `R.fail` guard. |
| R4-16 Report hierarchy | Medium | **Still open** | `s5-phone-land-report-0star.png`: the Staff card sits alone on row two and all four borders are red. The overall star count that drives the verdict and the class result is still not shown. `starLine()` exists but is never called. |
| R4-18 Layout across sizes | Medium | **Still open** | `tablet-02-code-card-1.png`: the floor is fitted to width, leaving roughly 60% of the portrait tablet as empty grey and green. |
| R4-22 Five-column grid for four pills | Low | **Still open** | `style.css:65` still reads `repeat(5, …)`. |
| R4-23 Floating controls over the board | Low | **Still open** | `phone-05-outcome-toast.png`: the waiting meter sits on R1 and the faded Next covers Room 4 and "The Bo…". |

**Counts:** of the 8 round-1 Highs, 0 are fixed, 0 partly fixed, **8 still open** and 0 worse. All 10 Mediums and Lows I rechecked are still open.

## 1. Verdict

**No.** Not one round-1 UI finding was touched. The phone gate, the class-code sheet, the HUD-covering toasts, the 7–10 px state text and the 15–21 px tap targets are exactly where I left them. The one new piece of interaction design, the ACLS code card, is a quiz whose right answer is the **top button on 170 of 170 cards** I generated. Its feedback is a 3-second toast, set at 10.5 px on a landscape phone, often clipped or queued behind unrelated messages, and it never shows the right answer. Around it, the patient card for someone pronounced dead still offers "Update them on the plan… They feel heard". A studio would send this back to design before QA saw it.

## 2. Score

**4 / 10.** This is held, not raised. Nothing from round 1 was fixed. Phase 1 added a decision feature whose layout gives away the answer and whose feedback doesn't reach the player.

## 3. New findings (worst first)

"Phase 1" marks findings in the UI or flow that Phase 1 added or made reachable.

### R4.2-01 · High · Phase 1 · The code-card "shuffle" does nothing: the right answer is always the top button
- **Where:**
  - `src/engine.js:2070`, `codeCard()`: `order = q.c.map((x, i) => [vhash(p.id + 'cq' + C.step + i), i]).sort(...)`.
  - `src/engine.js:998`: `vhash = h*33 + charCode`, then `(h % 1000) / 1000`.
  - Data: in all 12 cards in `CODE_Q` and `CODE_CAUSE`, the right answer is at index 0.
  - Screens: `phone-02-code-card-1.png`, `phone-03-after-answer1-0ms.png`, `tablet-02-code-card-1.png`, `tablet-03-after-answer1-1500ms.png`, `phone-land-02-code-card-1.png`, `phone-land-03-after-answer1-0ms.png`. In every one, the right answer is the first button (top-left in the two-column landscape layout).
- **What:**
  - The four sort keys differ only in their last character, so their hashes are four consecutive integers mod 1000. They sort back into data order unless they straddle 999→0.
  - Over 5,000 ids × 12 cards (59,988 orderings, using the engine's own `vhash`), the right answer landed first **99.7%** of the time, and second, third or fourth 0.1% each.
  - In the real engine flow (60 shifts, 6 case types, own patient arrests, `OC.assign`), **170 of 170** code cards put the right answer first.
- **Why it matters:** Players learn "tap the top one" within one code. The answers set the ROSC odds and the attending's score (`care(±4,'md')`), so the new decision layer is both gameable and useless for teaching. Answer order is the first thing a UI designer checks on any multiple-choice screen.
- **Fix:** Shuffle with a real permutation. Seed a Fisher–Yates shuffle from the patient's sub-seed (or an avalanche hash such as `seedOf`) so class codes still sync. Add a rules test that the right answer's position is roughly uniform across ids.
- **Effort:** S

### R4.2-02 · High · Phase 1 · Code-card feedback is a toast that arrives late, gets cut off, and never shows the right answer
- **Where:**
  - `src/engine.js:2075–2087`: `codePick` calls `toast(...)`, then calls `codeCard(p)` straight away.
  - `src/ui.js:168–200`: the floor strip shows one message at a time, each lasts 3 s, a queued one replaces it after 1.5 s, and the queue is cut to 4.
  - `src/style.css:543, 603–605`: the strip is clamped to 2–3 lines at 12 px, and long messages drop to 10.5 px.
- **What (measured):**
  - **No result state.** The next card replaces the answered one in the same frame. The card shows no right or wrong mark, no correct answer and no tally (`phone-land-03-after-answer1-0ms.png`, `tablet-03-after-answer1-1500ms.png`).
  - **Late on the default board.** On the floor plan (the default on every size), messages queue. After a wrong answer, the strip first showed "You picked up Room 7" (the toast from tapping Run the code) and an earlier queued message. "Not this one…" appeared **3.1 s** after the tap on phone-land and tablet, and about 3.9 s on desktop, while card 2 had been up the whole time. In a clean run with nothing queued (`r4/s3.py`) the feedback appears at once, but it's replaced as soon as the player answers the next card (minimum 1.5 s).
  - **Tiny and clipped.** At 844×390 the code feedback renders at **10.5 px**. The H's-and-T's line (147 characters) and the traumatic-arrest line (160) overflow the 3-line clamp: with the Box ringing, it ends "…tension pneumothorax,…" (`s9-crop-ring.png`). With no call, the last line's descenders are cut (`s9-crop-quiet.png`; scrollHeight 37 against clientHeight 34). It is the same at 667×375.
  - **The right answer is never shown.** The wrong-answer toast explains why your pick was wrong, not what was right. For example, "Not this one. A pulse check takes under 10 seconds…" never says "shock". The right answer ("The call: …") goes only into an M&M entry at severity 40.
  - **The report hides it too.** The report keeps only the top three M&M entries by severity (`engine.js:4219`). A waiting-room arrest (95), no-team death (90), shock (70) or crash (60) outranks a missed rhythm check, so in a busy shift the right answer appears nowhere. `codeRight` and `codeWrong` are counted (`engine.js:2080`) and never displayed. There is no "Code decisions to review" section to match "Radio calls to review".
  - **No sound.** `codePick` plays nothing. The next card plays the same `'card'` chime whether you were right or wrong, and the last answer is silent.
  - **Inconsistent with the radio call.** The attending's other quiz, the radio call, gets a full result modal ("Correct"/"Incorrect", "The order: …", the reason, **Back to the shift**) plus good and bad sounds (`ui.js:2478` and the `result` branch of `renderModal`).
- **Why it matters:** The cards exist to teach ACLS decisions. On the board most players use, the teaching sentence is late, tiny, clipped and replaced. A wrong answer is never corrected on screen. That breaks the feature's purpose.
- **Fix:**
  - After a pick, keep the card in a result state: mark the picked button red or green, reveal the right one, and show the reason in the card body at 15 px or larger.
  - Play the good or bad sound, then continue with **Next rhythm check**.
  - End with a summary card ("2 of 3 right · team arrived after 4 min").
  - Add "Codes to review" to the report.
- **Effort:** M

### R4.2-03 · Medium · Phase 1 · A patient pronounced dead keeps a live patient's card and actions
- **Where:** `src/ui.js:898–935` (`ptSheet`); `src/engine.js:2112–2122` (`arrestNoTeam`: `ev = 'done'`, `dsp = 'family'`, still in the room); `:2106` (death after a code). Screens: `s5-phone-land-noteam-card.png`, `phone-06-card-after-code.png`, `phone-land-06-card-after-code.png`. Actions were tapped in `r4/s8.py`.
- **What:**
  - **Contradictions on the card.** "VITALS **Pronounced dead**" sits directly above "EXAM No pulse. CPR in progress." on the EMS arrest case, or "EXAM Pain free now. Lungs clear." on chest pain. Below that: "RISK HEART score 4 · moderate risk" and "EXPERIENCE 85% · no update yet / how they feel about the visit; an update raises it".
  - **Wrong history.** "Provider: **Seen by a provider**" appears on a no-team death, a patient who died because no provider ever saw them.
  - **Stale tags.** The orange ESI 2 badge and the black **CODE** tag stay after death and after ROSC.
  - **Charge nurse actions on a dead patient:**
    - **Update them on the plan** shows "You updated Room 7 on the plan and the wait. They feel heard." Experience goes from 85 to 93 and `stats.updates` goes up by one, which feeds the report's "Updates you gave".
    - **Mark STAT** shows "Room 7 marked STAT. Everyone works it first."
    - **Change provider** shows "Dr. Patel has Room 7".
    - **Consult…** opens "Who do you call? … Admit by phone: Hospitalist".
  - **Attending actions on a dead patient:** **Mark STAT: first in line** (`phone-06`).
- **Why it matters:** Working charge nurses and attendings, the audience the owner most wants to convince, will screenshot this. Students see two opposite facts on one card, and the scoring leaks.
- **Fix:** Give deceased patients their own card state: time of death, cause, the M&M line, and no Exam, Risk, Experience, goals or actions. Show "Family at the bedside" and then "Morgue" as status only. Clear `alertOn` (the CODE tag) when the code ends.
- **Effort:** S

### R4.2-04 · Medium · Phase 1 flow (old text, newly reachable on your own patient) · After ROSC the card contradicts itself
- **Where:** `r4/s8.py`, own patient on the EMS arrest case, desktop (`s8-rosc-card.png`); `engine.js:2096–2103`; `ORD_WHY.arrest` (`engine.js:1654`); `EXAM.arrest`; the arrest case's `vit` sign.
- **What:**
  - The vitals line reads "HR 145 BP 81/47 RR 28 SpO2 94% … **Pulseless, VF on the monitor** ▼ Getting worse · treatment not given yet". It says "pulseless" next to a blood pressure.
  - "EXAM No pulse. CPR in progress."
  - The decision block reads "YOUR CALL · ROSC AFTER CARDIAC ARREST — **The workup: No orders. Run the code.**", with **Discharge home / No admission needed** as the first of three equal buttons.
  - The post-ROSC to-do list ("Intubate (attending and RT), then the vent. Get Critical Care down here.") exists only as a 3-second toast wrapped into the strip (`s7-phone-land-3d-after.png`).
- **Fix:** When the arrest ends, drop the arrest case's vitals sign and exam text. Add a ROSC-specific workup line. Put the post-ROSC checklist on the card as steps that tick off.
- **Effort:** S

### R4.2-05 · Medium · Phase 1 · Synchronized cardioversion is filed under "Procedures", not the menu labelled for unstable rhythms
- **Where:** `engine.js:474` (`ORDER_MENUS` proc: `repair`, `tcp`, `synccv`); `ui.js:1008` (`'Resuscitation drugs', 'Arrest, unstable rhythms, shock'`); `s4-desktop-cardiovert.png`.
- **What:** A crashing A-fib (HR 174, BP 80/50) needs the shock. The player opens the menu whose subtitle literally says "Arrest, **unstable rhythms**, shock" and finds only drugs. The shock is two menus down under "Procedures", next to "Laceration repair" and "Chest tube". Transcutaneous pacing is filed the same way.
- **Why it matters:** The menu label points away from a time-critical item. This is the information-architecture mistake that costs seconds in a crash.
- **Fix:** Rename the menu "Resuscitation: drugs and shocks" and put cardioversion and pacing in it, or change the resus subtitle and rename Procedures to "Procedures and shocks".
- **Effort:** S

### R4.2-06 · Medium · Phase 1 · Procedure chips show their indication on a real shift; drug chips don't
- **Where:** `ui.js:1002` (drug sub-label only when `pl && E.G.train`, with the comment "what a drug treats shows in Orientation and lessons, not on a real shift"); `ui.js:1010` (procedure chips: `pl ? E.PROC[k].p : ''`). Plain words is on by default (`ui.js:62`).
- **What:** On every attending shift the new chip reads "Synchronized cardioversion · *A timed shock for a fast rhythm with a crashing pressure*" (`s4-*-cardiovert.png`). The drug chips in the same sheet deliberately hide what they treat.
- **Why it matters:** One sheet follows two rules, and the inconsistent one states the indication the player is being graded on.
- **Fix:** Apply the same `E.G.train` rule to procedure sub-labels, or describe the procedure without its indication ("A shock timed to the heartbeat").
- **Effort:** S

### R4.2-07 · Medium · Phase 1 · The code cards are taught nowhere, and their terms are in neither the glossary nor plain words
- **Where:**
  - `LESSONS` (`ui.js:1819+`): the guided lessons are radio, stroke, heart, sepsis, bleed, breath, od, belly and falls, plus the case cards. None covers an arrest.
  - How to play (`helpHTML`, `ui.js:1466`) mentions a code only as "pick one who isn't in a code".
  - The Words glossary has "Code" and "Resuscitation drugs". It has no VF, PEA, asystole, shockable or defibrillate, synchronized cardioversion, H's and T's, ROSC or adenosine.
  - `renderModal`: the radio card has an "In plain words" line and the code card has none. The code choices carry no `sub` text, though `.mc-ch button small` supports it.
- **What:** A student's first sight of "Code blue: PEA. Two minutes later, still no pulse. What are you hunting for? The reversible causes: the H's and T's" comes mid-shift, with no gloss and no way to look it up. Searching Words for "VF" returns nothing.
- **Why it matters:** This breaks two of the owner's rules: teach in Orientation and the Lessons, and a lay person must be able to learn, with every term explained.
- **Fix:**
  - Add a guided "Cardiac arrest" lesson: one VF code and one PEA code.
  - Add glossary entries for each term.
  - Add plain sub-labels on the code choices, and an "In plain words" line on the card, when Plain words is on.
- **Effort:** M

### R4.2-08 · Medium · Phase 1 · The 20-minute no-team deadline is invisible, and the death message lasts 1.5 seconds
- **Where:** `engine.js:2112–2121`; `ui.js:504` (board label "CODE: send an MD"); `ui.js:950` (attending hint); `toastPump` (`ui.js:183–190`).
- **What:**
  - **No countdown.** The charge nurse's card and room tile say "CODE: send an MD" with no timer, though the `data-cd` live timers used elsewhere would do it. The attending's hint says "After 20 minutes they are gone", also with no timer.
  - **The death message barely shows.** I let a Five-Minute Rush run at 1× on a 844×390 floor, observing the message strip (`r4/s5.py`). "Ray Holt died in cardiac arrest. Nobody ran the code." appeared at 50.29 s and was replaced at **51.79 s** by "Missed: Into a resus bay under 5 min · Omar (63M)".
  - **No hierarchy.** The death message is 12 px, the same red, and plays the same `'bad'` sound as a missed timer (`s5-phone-land-noteam-death.png`).
  - **No warning in between.** Nothing is said between the patient's arrival and the death.
- **Why it matters:** A hard, scored deadline has to be visible. A death has to read as more serious than a missed door-to-bed goal.
- **Fix:**
  - Show a countdown on the tile and the card ("No doctor · 14:32 left"), with escalation at 10 and 15 minutes.
  - Make the death a short stop card, or at least give it top priority, at least 5 seconds on screen and its own sound.
- **Effort:** S–M

### R4.2-09 · Medium · Phase 1 · The report never counts deaths, and the 1-star verdict congratulates over them
- **Where:** `ui.js:2632–2633` (`VERDICT`, `VERDICT_MD`); the patient tables in `reportHTML` and `mdDeptHTML`; `engine.js:4206` (`noTeam` is computed but never rendered); `G.stats.rosc` is never rendered.
- **What:** In my passive Five-Minute Rush (`r4/s5.py`, first run) the M&M lists a waiting-room arrest and two no-team deaths. Above it, the 1-star verdict reads "**You kept the doors open. Tomorrow will be better.**" No death row appears anywhere:
  - "All the numbers > Patients" lists arrived, discharged, admitted, OR, transferred, LWBS, AMA, returns and still-in-ED, but no deaths.
  - No-team deaths are folded into the ledger's "Safety events" row (`care(-40,'safety')`).
  - The M&M shows three entries at most, so a fourth death is invisible.
  - Phase 1 fixed this tone for 0 stars only.
- **Fix:** Add "Died in the department" (codes lost, no team) and "Codes run / pulse back" rows. Pick verdict text by deaths as well as stars.
- **Effort:** S

### R4.2-10 · Low · Phase 1 · The new 0-star verdict depends on an M&M list that can be empty
- **Where:** `ui.js:2632–2633` ("Rough one. Read the worst moments below, then try again.") and `mmHTML` (`ui.js:2710`: "Nothing went badly wrong this shift. Take the win.").
- **What:**
  - Nothing ties the two together. A 0-star shift with an empty M&M would print "Read the worst moments below" above "Take the win". I did not produce such a shift: every passive shift I ran generated M&M entries. This is a code-path risk.
  - The line ends in a fragment: "…then try again. Five-Minute Rush." (`s5-phone-land-report-0star.png`). I reached 0 stars by injecting bad scores into `G.sc`, patient experience and morale; the rendering is real, the shift is not.
- **Fix:** Use different text when `R.mm` is empty. Put the level name on its own meta line.
- **Effort:** S

### R4.2-11 · Low · Phase 1 · On the floor, cardiac arrest and death use the same heart
- **Where:** `map.js:60` (`code`: a heart with a 1.5-unit zigzag cut-out) and `map.js:76` (`heart`: the same heart). Crops: `s7-phone-land-3d-arrest-crop.png`, `crop-flat-arrest.png`, `crop-flat-dead.png`.
- **What:**
  - On the default 3D floor at 844×390, your own patient in arrest is a roughly 16 px heart with an amber frame. The zigzag can't be seen and there is no red ring. On desktop 3D it's a faint red floor tint.
  - The dead patient's tile shows the same heart, with a red ESI 1 badge.
  - The first-shift card promises "a flashing red ring is a patient crashing".
- **Fix:** Give arrest a distinct glyph (an ECG bolt) and the ring. Give deceased patients a neutral, desaturated treatment.
- **Effort:** S

### R4.2-12 · Low · Phase 1 · The IM antibiotic group is a whole sub-menu for one chip, grouped by route in an otherwise mixed list
- **Where:** `engine.js:312` (`abxm`) and `:335`; `s4-phone-bicillin.png`.
- **What:**
  - A sub-menu holds exactly one drug, "Penicillin G benzathine (IM only)", which repeats the "IM" from the menu label.
  - Other shots stay in other groups: "Epinephrine 0.5 mg IM" is under "Allergy and steroids", and midazolam is under "Seizures…".
  - "Antibiotics by shot in the muscle (IM)" is the longest label in the list, and the sub-menu header is 38 px tall.
- **Fix:** Either group by route or by indication, not a mix. Or merge into "Antibiotics by mouth or shot" and show "IM only" as a tag, not as part of the drug name.
- **Effort:** S

### R4.2-13 · Low · Phase 1 · The new chip throws the Procedures grid out of alignment
- **Where:** `style.css:488` (`.och { display: grid }` in stretched rows) and `:979–982`; `s4-phone-land-cardiovert.png`, `s4-desktop-cardiovert.png`.
- **What:** At 129–139 px chip width, "Synchronized cardioversion" plus its sub-label wraps to an 87 px row. Its neighbours' sub-labels float to mid-chip: "Stitches. You do them" hangs halfway down under "Laceration repair".
- **Fix:** `align-content: start` on `.och`.
- **Effort:** S

### R4.2-14 · Low · Phase 1 · The code card's progress line is its least legible text
- **Where:** `style.css:351` (`.mc-who`: 12 px uppercase, #7A8493 on white, **3.78:1**); `phone-02-code-card-1.png`.
- **What:** "ROOM 1 · DANA ORTIZ · RHYTHM CHECK 1 OF 3" wraps at 390 px and leaves "3" alone on a second line. Where you are in the code is the card's context, and it fails AA.
- **Fix:** Show the step as its own indicator (three dots, or "Check 1 of 3" at 14 px or larger in `--ink-2`). Keep room and name on one line.
- **Effort:** S

### R4.2-15 · Low · Phase 1 · Code-card answers are under 44 px on a landscape phone
- **Where:** `style.css:627` (`.mc-ch button { min-height: 42px }` under `max-height: 520px`). Measured 42 px tall for the third VF check at 844×390.
- **Fix:** 44 px minimum.
- **Effort:** S

### R4.2-16 · Low · Phase 1 · A pulseless patient keeps an orange ESI 2 badge
- **Where:** `toArrest` (`engine.js:3317`) doesn't raise acuity. `phone-01-card-run-the-code.png` and `phone-land-01-card-run-the-code.png` show an orange "2" next to "CODE", and the 3D tile in `s7-phone-land-3d-arrest-crop.png` has the orange badge too.
- **What:** The board's acuity colour under-signals the most urgent patient in the building.
- **Fix:** Show ESI 1 while in arrest.
- **Effort:** S

### R4.2-17 · Low · Phase 1 · The card's wording answers its own question
- **Where:** `CODE_Q` first cards (`engine.js:2016–2026`).
- **What:** The prompt bolds the rhythm and then classifies it: "…**ventricular fibrillation (VF)**: a shockable rhythm. What first?" and "…**a rhythm but no pulse (PEA)**: not shockable." Shockable or not is the decision the card is testing. Combined with R4.2-01, card 1 needs no knowledge at all. Game-design overlap with R5.
- **Fix:** Name the rhythm and stop there. Move "shockable / not shockable" into the feedback.
- **Effort:** S

### R4.2-18 · Nitpick · Phase 1 · Two strings for one state, and a straight apostrophe
- **Where:** `ui.js:951` ("You're running the code. CPR is going.", straight `'`) and `ui.js:957` ("You’re running the code.", curly). The rest of the UI uses curly apostrophes.
- **Fix:** One string, one apostrophe style.
- **Effort:** S

### R4.2-19 · Nitpick · Phase 1 · Dead UI data
- **Where:** `ORDER_TX` gained a `cardiovert` entry (`ui.js:941`) that nothing reads. `ORDER_TX` is consulted only at `ui.js:1010`, for menu keys that are neither drugs nor `PROC`, and `cardiovert` is not a menu key.
- **What:** Its sub-label ("…a fast heart that is crashing") disagrees with `PROC.synccv` ("…a fast rhythm with a crashing pressure"). `starLine()` (`ui.js:2683`) is also never called.
- **Fix:** Delete both.
- **Effort:** S

### R4.2-20 · Nitpick · Phase 1 · "Pronounced dead" is styled as an alarm
- **Where:** `ui.js:659` (`.vv.vbad`, red bold).
- **What:** It looks identical to "No pulse. CPR in progress", which means "act now". A terminal state needs a neutral treatment, such as ink with a small marker.
- **Effort:** S

### R4.2-21 · Nitpick · The M&M is sorted by severity but leads with clock times
- **Where:** `engine.js:4219`.
- **What:** The list reads 08:02, 07:20, 07:35 (`r4/s5.py` run), so it looks shuffled. No-team deaths now feed it more often.
- **Fix:** Order by time, or move the time to the end of each line.
- **Effort:** S

### R4.2-22 · Nitpick · Phase 1 · The headline is the acronym
- **Where:** `CODE_NAME` (`engine.js:2039`).
- **What:** The card titles read "Code blue: VF", "Code blue: PEA" and "Code blue: traumatic PEA", while the body expands the term. The largest text on the card is the least explained.
- **Fix:** "Code blue · Ventricular fibrillation".
- **Effort:** S

### R4.2-23 · Nitpick · Phase 1 · Tapping "Run the code" toasts "You picked up Room 7"
- **Where:** The `assign` message (`engine.js:1459`).
- **What:** "Picked up" is the wrong verb for starting a resuscitation, and on the floor the toast takes the single message slot just before the first code feedback (see R4.2-02).
- **Fix:** "You're running the code in Room 7", or no toast; the card itself confirms the tap.
- **Effort:** S

### R4.2-24 · Nitpick · Phase 1 · The arrest card puts noise above the action
- **Where:** `phone-01-card-run-the-code.png`.
- **What:** On a pulseless patient the button sits under Complaint, Vitals, Working, and "Experience 85% · no update yet / how they feel about the visit; an update raises it".
- **Fix:** In an arrest, show Vitals and the button first, and nothing else above the fold.
- **Effort:** S

**New findings by severity:** Critical 0 · High 2 · Medium 7 · Low 8 · Nitpick 7 (24 in total; 22 of them in the Phase 1 UI or flow).

## 4. Coverage

**Reviewed:**
- The full `git diff 6edcc3d..HEAD` for `src/ui.js`, `src/style.css`, `src/index.template.html`, `src/map.js` and `src3d/`.
- The Phase 1 engine code that renders on screen: `CODE_Q`, `CODE_CAUSE`, `CODE_WHY`, `codeCard`, `codePick`, `codeOutcome`, `arrestNoTeam`, `toArrest`, `DRUG_CLASS`, `ORDER_MENUS`, `PROC`, `vitalsOf` for deaths, and the report fields.
- `ptSheet`, `mdPrimary0`, `renderModal`, `orderMenus`, the toast pump, `reportHTML`, `mmHTML`, `scoreCardsHTML`, the Words glossary, `LESSONS` and How to play.

**Ran, all in Chrome:**
- `r4/s1.py`: an own-patient arrest at four sizes. Measured the Run the code button, every code card, every feedback toast at 0, 1.5, 3.1 and 3.9 s, the outcome, and the card afterwards.
- `r4/s3.py`: a realistic arrest from an untreated bleed, opened from Next, with feedback timing logged every 150 ms.
- `r4/s4.py`: the cardioversion and IM chips at four sizes.
- `r4/s5.py`: a 1× no-team death with a timeline of every message in the strip, then the 0-star report.
- `r4/s6.py`: the round-1 Highs remeasured.
- `r4/s7.py`: the 3D floor at 844×390 and 1440×900.
- `r4/s8.py`: tapping every action on a dead patient, focus and Escape on the code card, and the ROSC card.
- `r4/s9.py`: clamping of the longest feedback strings, with and without the Box ringing, at 844×390 and 667×375.
- Node checks of the code-card answer order: 59,988 orderings with the engine's own hash, and 170 cards through the real engine flow.

**Could not check, or checked only partly:**
- Real phones, iOS Safari, WebKit and Firefox: not run. All sizes are CSS px from emulation.
- Audio: judged from code. `codePick` makes no sound; the card chime is the same for right and wrong answers.
- Screen readers: no VoiceOver or NVDA session; I checked focus and the DOM only.
- The 0-star verdict: reached by injecting bad scores (see R4.2-10). A natural 0-star shift with an empty M&M was not produced.
- ROSC: produced and photographed only at 1440×900 (`s8-rosc-card.png`) and on the 3D floor at 844×390 (`s7-phone-land-3d-after.png`).
- 3D: only phone-land and desktop, under software GL. Canvas tap targets can't be measured from the DOM.
- R4-05 (the waiting counters): not re-demonstrated, because the autopilot emptied the queue in my run. The code is unchanged.
- The pre-existing ROSC text in R4.2-04 dates from before Phase 1. Phase 1 is what puts it on the attending's own patient.

## 5. What I'd grudgingly keep
- **Run the code:** full width, 50 px tall, white on `--bad` at 5.57:1, and it is the first action on the card.
- **The code card pauses the clock** and reuses the existing modal, so nothing ticks while you read.
- **Code-card answer buttons:** 49–62 px tall in portrait, with full-sentence labels, not jargon fragments.
- **Next goes straight to your own arrest:** in `r4/s3.py` Next opened the arresting patient's card first.
- **The "(IM)" gloss:** "by shot in the muscle (IM)" spells out the acronym where it's used.
- **The message log:** Events keeps every message, so a lost toast can be found, if anyone thinks to look.
