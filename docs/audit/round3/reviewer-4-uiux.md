# Reviewer 4, round 3: UI/UX (senior game UI/UX designer)

Re-audit of the round-2 fixes on branch `claude/sleepy-rubin-jot35n` at v0.30.0, Nov 24 2026. HEAD 6001dd4. No `src/` or build file changed after 8357568.

**Setup**
- Scratch folder: `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round3/r4/`, called `r4/` below. Images are in `r4/shots/`.
- I rebuilt the game in a scratch copy of the tracked files. The new `index.html` is byte-identical to the committed one.
- I ran the committed build in headless Chrome over http at four sizes: 390×844 (`phone`), 844×390 (`phone-land`), 820×1180 (`tablet`) and 1440×900 (`desktop`). A few strip checks also ran at 667×375.
- Unless a line says 3D, the board is the flat floor (`oc-3d=0`).

## 0. Round-2 status

| ID | Severity | Status | Evidence |
|---|---|---|---|
| R4.2-01 Code-card shuffle | High | **Fixed** | I ran 540 code cards through the real engine flow (30 seeds × 6 cases, own patient). The right answer was the 1st, 2nd, 3rd or 4th button 128 / 126 / 157 / 129 times. The `mixHash` formula over 70,623 orderings gives 24.9 / 25.2 / 24.9 / 25.0 %. |
| R4.2-02 Feedback is a late toast | High | **Partly fixed** | A result card now follows every check, with "You:", "The call:" and both reasons (`s1-*-03-result-*.png`). Its design is weak (R4.3-04). The summary is still missing (see the list below the table). |
| R4.2-03 The dead keep a live card | Medium | **Partly fixed** | Only "Update them on the plan" was removed (`ui.js:927`). Everything else is still there: `s3-phone-land-rn-04-dead-card.png`. |
| R4.2-04 The card contradicts itself after ROSC | Medium | **Partly fixed** | "Pulseless" is gone and the Exam text is new. But "Your call" keeps the old case's workup and the "Discharge home" button, and gray-zone cases now offer Home, Obs or Admit (R4.3-01). |
| R4.2-05 Cardioversion under Procedures | Medium | **Fixed** | Synchronized cardioversion and pacing are now in "Resuscitation" (`ui.js:1010`, `s9-phone-land-03-after-cv.png`). They are also still in Procedures (R4.3-11). |
| R4.2-06 Procedure chips show their use | Medium | **Deferred (Phase 6), slightly worse** | The two sub-labels that name what the chip is for now also appear in the Resuscitation grid. They are the only chips there with one; every drug beside them has none. |
| R4.2-07 Code cards taught nowhere | Medium | **Partly fixed** | 14 glossary entries and two lessons were added. The lessons are 10 text slides with no patient and no code card. The card has no plain-words line, and a dozen of its terms are still unexplained. |
| R4.2-08 Invisible deadline, 1.5 s death message | Medium | **Partly fixed** | Only your own patient's card counts down. The death toast now stays 4.25 s, but only when nothing is queued behind it. |
| R4.2-09 Deaths missing from the report | Medium | **Partly fixed** | A "Died in the department" row was added. The verdict still praises the shift: "Solid shift. The night charge owes you. 2 patients died in the department. Five-Minute Rush." (`s5-phone-land-rn-rush-d2-01-report-top.png`). |

**Counts:**
- High (2): 1 fixed, 1 partly fixed.
- Medium (7): 1 fixed, 5 partly fixed, 1 deferred (slightly worse).
- 0 are still open and 0 are worse.

**What is left of the partly fixed items**

R4.2-02, the end of a code you ran (`r4/s10.py`, phone-land at 1×, every answer wrong):
- After **Back to the code** there is nothing for 16.8 s.
- Then "Code called at 07:20 in Room 8. The chaplain is with the family." appears as a 12 px dark **info** toast. That is the same style as "Casey picked up Pod E".
- It waited 1.5 s behind "Missed radio call", stayed 3.3 s, and made no sound (`engine.js:2241` has no `sound()`).
- There is no tally of the checks.
- `G.stats.rosc`, `codeRight` and `codeWrong` appear nowhere in the report. Neither does a "Codes to review" section.

R4.2-03, the dead patient's card, seen in both roles (`s3-phone-land-md-04`, `s3-phone-land-rn-04`):
- **Contradictions on the card.** "VITALS Pronounced dead" sits directly above "EXAM Pain free now. Lungs clear.", then "RISK HEART score 4 · moderate risk". Experience reads "85% · no update yet / … an update raises it", but the update button is gone.
- **Stale tags.** The black CODE tag and the orange ESI 2 badge stay.
- **Wrong history.** "Provider: Seen by a provider" shows on a patient no provider ever saw.
- **Actions still offered.** Mark STAT works: the STAT tag appears. Move bed, Consult… ("Who do you call? Ray Holt · Died in cardiac arrest: no code team") and Change provider all open.

R4.2-04, after ROSC:
- A 4-year-old with ROSC after an asthma arrest gets "The workup: No tests. Breathing treatments and a steroid. Then watch that the wheezing stays away." **Discharge home** is still the first button (`s1-phone-asthma-a4-w0-06-card-after-code.png`).

R4.2-07, teaching the code:
- **No practice.** The lessons never put a patient on the board, never show **Run the code** and never show a code card. Round 2 asked for "one VF code and one PEA code".
- **Missing words.** Not in Words: QRS (in a card's feedback), SVT, J/kg or joules, IO, pericardiocentesis, bag-mask, lidocaine, diltiazem, sedation. Amiodarone and adenosine appear only as names in the "Resuscitation drugs" list (`r4/s8.py`).

R4.2-08, the deadline and the death message:
- **Countdown.** The countdown is a 13.5 px `#485263` fragment, the third sentence of a grey hint (`s3-phone-land-md-02-card-1min-left.png`, at "1m"). Nothing escalates near the end.
- **No timer elsewhere.** The tile says "CODE: run it" or "CODE: send an MD" with no timer. An unassigned arrest ("Another doctor takes it in a minute") has none, and the charge nurse's card has none.
- **Death message.** The death toast is 12 px with the generic `bad` sound. `toastPump` still swaps it out after 1.5 s whenever another message is queued (`ui.js:187`).

R4.2-09, the report:
- The new row sits inside the collapsed "All the numbers", 2,289 px down on a phone. The verdict text is still chosen by stars alone (`ui.js:2674–2675`). The death sentence is glued between the praise and the level name, in the same grey 15 px.

## 1. Verdict

**No.** Round 2 fixed the two things I hit hardest: the shuffle and the missing result card. Then it shipped these:
- **A Critical in the new ROSC flow.** The R5.2-02 rule "home is refused" guards one button and misses the gray-zone card. An intubated post-arrest patient can be sent home, and sending him to observation scores "Good call".
- **A code marker the default board never draws.** The marker that is "impossible to miss" exists only on the flat floor, and only when the waiting room has a free seat. On the default 3D floor the pulseless patient sits in a chair with an ESI bubble.
- **An unreadable notice.** The lost-class-save notice is one 3-second toast, cut off before it says anything.

Five of the seven Mediums are half done. Each fix touched the line I quoted and left the rest of the finding alone.

## 2. Score

**4 / 10.** Held. The two round-2 Highs moved, but a new Critical and two new Highs replace them. Every round-1 High is still open (deferred).

## 3. New findings (worst first)

### R4.3-01 · Critical · After ROSC, a gray-zone patient gets "Home / Observation / Admit", and Home discharges an intubated post-arrest patient
- **Where:**
  - `engine.js:2220–2237` (`codeOutcome` sets `dispo = 'icu'` but leaves `p.gray`)
  - `engine.js:3130` (`if (p.gray && !p.grayPick) p.dsp = 'decide'`)
  - `engine.js:3151` (`grayDispo`, which has no `p.rosc` check)
  - `ui.js:794` (`grayBlock`)
  - The R5.2-02 guard exists only in `mdDecide` (`engine.js:1953`).
  - Screens: `s2-phone-land-cpmod-home-01-rosc-card.png`, `s1-phone-cpmod-w1-06-card-after-code.png`. Script: `r4/s2.py`.
- **What:** Every gray-zone case has this path: `cpmod` and `cwp` (HEART), `syncope` and `synchigh`, `tia` (ABCD2), and `pnalow`. After a successful code the card reads, top to bottom:
  1. "EXAM A pulse came back after CPR. Intubated and on the ventilator."
  2. "RISK HEART score 5 · moderate risk"
  3. "YOUR CALL · HEART SCORE 5 · 0 to 3 is low risk (home)…"
  4. Three buttons: **Home** ("Frees the bed now"), **Observation**, **Admit**
- **What I tapped:**
  - **Home** on `cpmod` (phone-land): the patient went `dcing`, then left with outcome `dc`. That is an intubated patient discharged home. It counted only as a "gray under" and one wrong dispo.
  - **Home** on `tia`: the same result.
  - **Observation:** the game answered "Room 2: observation. **Good call.** Moderate-risk HEART score (6)." and awarded the gray-zone points.
  - The path above still says "Consult: Needed. Pick the right service."
  - The flow is the same for the charge nurse, who makes gray-zone calls in that role.
- **Why it matters:** This is clinically wrong teaching. It also rewards the wrong call, and it contradicts the fix the release notes describe ("a patient with a pulse back… goes to the ICU: 'home' is refused").
- **Fix:**
  - On ROSC, clear `p.gray` (or set `grayPick`) so the flow goes to the ICU call.
  - Make `grayDispo` refuse `home` and `obs` when `p.rosc`.
  - Drop the Risk row after ROSC.
  - Add a rules test: every gray case with ROSC can't go home or to observation.
- **Effort:** S

### R4.3-02 · High · The red code marker for an arrest outside a room is missing on the default 3D floor, and missing on the flat floor whenever the waiting room is full
- **Where:**
  - `map.js:104` (the marker, SVG only)
  - `map.js:764`: the 3D snapshot `SN.pts` carries `esi`, `name`, `sel`, `ok`, `fresh`, but **no `arrest`**
  - `map3d.js:513–514`: the walker sprite draws only the ESI digit
  - `map3d.js:255`: a waiting patient is posed `sitting-idle`
  - `map.js:709–717`: 30 seats; anyone past them is counted in "+N standing" and not drawn
  - Screens: `s4-phone-land-3d-01-board.png` with its crop `crop-s4-pl3d-marker.png`; `s4-desktop-crowd40-01-board.png` with its crop `crop-s4-desk-crowd-next.png`; `crop-s4-pl-marker.png`
- **What (measured):**
  - **3D, the default view, at 844×390.** The SVG layer has opacity 0, and `elementFromPoint` at the marker is `CANVAS.floor3d`. The pulseless patient is a tiny seated figure with an ESI bubble. There is no ring, no code glyph and no flash. In the real path a crash first sets ESI 1, so the bubble is the same red "1" any ESI 1 walker gets. I set ESI 3 by hand, so mine showed a yellow "3".
  - **Flat floor, 33 waiting.** The arrested patient arrived last, so they are one of "+3 standing". No marker is drawn anywhere. An arrest in the waiting room is most likely exactly when it is overcrowded.
  - **Flat floor at 844×390, with a seat.** The marker is 18×19 CSS px. In my run, an orange tech chip "T" and the registrar chip "R" overlapped its lower right. The zigzag glyph can't be read at that size. On desktop it is 38×41 px.
  - **What does work.** Next is right in every case: "CODE: Omar Haddad has no pulse in the waiting room. Room them now", and the tap lights the resus bays.
- **Why it matters:** The round-2 fix promises "impossible to miss" (`map.js:104` comment). On the board most players use, it isn't drawn at all.
- **Fix:**
  - Add `arrest: !!p.arrest` to `SN.pts`. In 3D, draw a red pulsing ring and the code glyph, and lay the figure down.
  - Give arrested patients the first seat (or a fixed "code" spot by the door), so they are never among the standing.
  - Draw walkers in arrest above the staff layer, at a minimum of 28 px.
- **Effort:** S–M

### R4.3-03 · High · The only notice that a class save is lost is a one-time, 3-second toast that is cut off before its point
- **Where:**
  - `ui.js:2577–2586` (`staleClassNote`). It calls `toast(…, 'info', true)`, but `toast` takes two arguments, so the third is dropped.
  - `ui.js:168–175`: the strip is used because the title demo sets `mapmode`.
  - `style.css:527, 543, 603–605`: the 2–3 line clamp.
  - Screens: `s6-phone-notice.png`, `s6-phone-land-notice.png`, `s6-tablet-notice.png`. Script: `r4/s6.py`.
- **What (measured):**
  - **Phone 390×844.** A 139 px wide box in the top-right corner, 12 px, clamped. The visible text ends "Your class shift (code K7Q-M2X) was saved on v0.29.1 a…". The words that matter ("can't continue… start it again with the code") are not on screen.
  - **Clamped on two more sizes.** Phone-land: 10.5 px, clamped (scrollHeight 37 vs clientHeight 34). Tablet: 12 px, clamped (57 vs 43). Only desktop shows it whole.
  - **Gone in seconds.** It is removed after 3.3 s. `oc-save-noted` then blocks it for good: a second reload shows nothing, and the menu has no line about it.
- **Why it matters:**
  - **The audience.** A student opens the game for class, and their saved shift has vanished. The one explanation is unreadable on the device the game is designed for, and it never comes back.
  - **The R3-08 fix.** The notice was that fix's whole deliverable, and on a phone it doesn't deliver.
- **Fix:**
  - Show it as a dismissable card on the title or Play screen, outside the strip.
  - Keep it until the student taps **OK** or starts the code again.
  - Mark it as noted only after that tap.
- **Effort:** S

### R4.3-04 · Medium · The new result card has no hierarchy: right and wrong look the same, and the continue button looks like a fifth answer
- **Where:** `engine.js:2209–2211` (`setCard('coderes', …)`) is rendered by the generic card branch of `renderModal` (`ui.js:2189`). The UI never reads `ctx.ok`, and there is no `coderes` styling. Screens: `s1-phone-land-cpmod-w1-03-result-1.png`, `s1-phone-cpmod-w1-03-result-1.png`, `s1-desktop-cpmod-w1-03-result-1.png`.
- **What:**
  - **Right and wrong look alike.** "Right" and "Not this one" are both a 19 px ink `h3`, with no colour, icon or mark. The four answer buttons are gone, so nothing shows the picked one red or the right one green.
  - **One paragraph for everything.** "You:", "The call:", why your pick is wrong and why the right one is right all run together in one 14 px paragraph. On phone-land that is 4 lines, 94 px tall.
  - **The continue button.** It is the same white, 2 px ink-bordered, left-aligned button as the answers. At 844×390 it is half width, sitting where answer 1 sat. Its label is a clinical action ("Two more minutes of CPR"), so it reads as another option.
  - **The header loses context.** "CODE BLUE: VF · RHYTHM CHECK 1" drops the patient and the "of 3".
  - **Inconsistent.** The radio result next door has a green or red "CORRECT"/"INCORRECT" label (`.mc-res`) and **Back to the shift**.
  - **Sound.** `codePick` plays `good` or `bad`, and `setCard` immediately plays the rising `card` chime over it (`engine.js:3895`). A wrong answer sounds like a buzz plus a cheerful chime.
- **Fix:**
  - Reuse `.mc-res ok/bad` for the label, and add ✓/✗ marks so colour isn't the only signal.
  - Split the body into "Why not" and "Why".
  - Make the continue button a filled primary ("Continue CPR · next check in 2 min").
  - Pass `quiet` to `setCard` for `coderes`.
- **Effort:** S

### R4.3-05 · Medium · The card for a patient in arrest in the waiting room offers a vitals recheck and a plan update
- **Where:** `ui.js:772` (`recheckBlock` for anyone in the waiting room) and `ui.js:928` (the Update button; its guard is only "not dead"). Screen: `s4-phone-land-03-card.png`.
- **What:**
  - Under "VITALS No pulse. CPR in progress" the card offers "RECHECK VITALS · LAST CHECK 31M AGO" with the triage nurse Bea as a button.
  - It also offers "Update them on the plan".
  - The path says "ECG: Doing it now" and "Plan: Not decided yet".
- **Why it matters:** This is the R5.2-03 flow the fix made reachable. A charge nurse who opens the card instead of tapping Next sees routine waiting-room chores next to "Choose a room".
- **Fix:** When `p.arrest`, show only "Choose a room" (resus first), and hide the recheck, the update and the work rows.
- **Effort:** S

### R4.3-06 · Low · The PALS cards give their answer away
- **Where:** `CODE_Q.kidvf`, `kidpea` and `kidasys` (`engine.js`). Screens: `s1-phone-asthma-a4-w0-02-code-card-1.png` and the JSON in `r4/s1-asthma4-w0.json`.
- **What:**
  - **Only the right answer is per kilogram.** On every child card, the right option is the only one with a per-kg figure: "epinephrine 0.18 mg IV or IO now (0.01 mg/kg)". The wrong dose is the adult "1 mg IV".
  - **The VF distractor labels itself.** It reads "Shock at 200 J, **the adult setting**".
  - **The title says child.** "Code blue: PEA (child)" already tells the player the dose must be by weight. Card 1 needs no knowledge at all.
- **Fix:** Give every dose option a number without its rule ("0.18 mg", "1 mg", "0.5 mg"). Put the rule ("0.01 mg/kg") in the feedback only.
- **Effort:** S

### R4.3-07 · Low · The child's weight, which every dose depends on, sits in the least readable line on the card
- **Where:** `engine.js:2192` (the `who` line) and `style.css:351` (`.mc-who`: 12 px uppercase, `line-height: 1`, #7A8493 on white, **3.78:1**). Screen: `s1-phone-asthma-a4-w0-02-code-card-1.png`.
- **What:**
  - At 390 px the line wraps as "ROOM 6 · DANA ORTIZ, 4 YO M · ABOUT 18 KG" / "· RHYTHM CHECK 1 OF 3", with a leading orphan "·".
  - The two lines touch, because the line height is 1.
  - The weight that the 0.18 mg is checked against is in the AA-failing caption, not in the question.
- **Fix:** Put "about 18 kg" in the prompt or under the title at 15 px or more in `--ink`. Move the check count to its own indicator. Set `line-height: 1.25`.
- **Effort:** S

### R4.3-08 · Low · Glossary search misses the code card's own spelling, and "IO" matches 66 entries
- **Where:** `wordsHTML` (`ui.js:1453–1457`): a plain substring match. Script: `r4/s8.py`.
- **What:**
  - **Apostrophes.** The code cards print "H's and T's" with straight apostrophes (`CODE_Q`, `CODE_WHY`). The glossary entry uses curly ones. Searching "H's and T's" returns "Nothing matches. Try a shorter word."
  - **Short terms.** "IO", used on every PALS card, is not defined, and searching it lists 66 unrelated entries ("ratIO", "admInistratIOn"…).
- **Fix:** Normalise apostrophes in the query and in the entries. Match whole words for terms of 3 characters or fewer. Add IO.
- **Effort:** S

### R4.3-09 · Low · The new harm wording: the longest message is clipped in landscape, and 7 drug–case pairs give no reason
- **Where:** `CONTRA_WHY` and `contraWhy` (`engine.js:470–486`), the strip clamp (`style.css:603–605`). Screens: `s11-phone-land-0.png`, `s11-se-land-0.png`. Script: `r4/s11.py`.
- **What:**
  - **Clipped.** "Tenecteplase can hurt Helen V.: it is more than 4.5 hours since they were last known well (later treatment needs advanced imaging this ED doesn't have)." is 152 characters. It renders at 10.5 px and is clamped at both 844×390 and 667×375; the last line, "doesn't have).", is cut at the bottom. The parenthesis added in round 2 is what pushes it over.
  - **No reason.** For hyperk + succinylcholine or KCl, apapod + acetaminophen, tcaod + procainamide, amiodarone or ondansetron, and hypogly + insulin (×2), the reason before diagnosis is "it isn't safe for this patient (the case's lesson says why)". That sends a student on a real shift to a lesson they may never have opened.
  - **Wording.**
    - "it slows a heart that is already holding no pressure" (the pressure is 80/50, not zero).
    - "Epinephrine 1 mg IV can hurt Rosa M.: 1 mg IV is the cardiac arrest dose: with a pulse…" has two colons in one sentence.
- **Fix:**
  - Move the parenthesis to the M&M only.
  - Write the seven missing reasons without naming the diagnosis.
  - Rephrase the two awkward sentences.
- **Effort:** S

### R4.3-10 · Low · A green "0 orders signed" toast follows the red harm toast
- **Where:** `engine.js:1923–1925`. The count excludes contraindicated and wrong drugs. This is older code, newly paired with the round-2 harm message. Script: `r4/s9.py`.
- **What:** I signed diltiazem alone on a crashing A-fib. "Diltiazem can hurt Ana Ruiz 4: it slows a heart…" (red) was followed by "0 orders signed for Room 9" (green). The drug was given, and the green toast says nothing was.
- **Fix:** Count every signed item. Don't use the `good` style when the order caused harm.
- **Effort:** S

### R4.3-11 · Low · Cardioversion and pacing now live in two menus, and one pick shows up as two
- **Where:** `ui.js:1010` (Resuscitation) and `engine.js:500` (Procedures still lists `tcp` and `synccv`). `LESSONS.tachy` step `ta2` (`ui.js:1876`). `GLOSS` "Resuscitation drugs" (`ui.js:1413`).
- **What:**
  - Tapping cardioversion once badges **both** "Resuscitation 1" and "Procedures 1", while the button says "Sign 1 order" (`s9-phone-land-03-after-cv.png`).
  - The new lesson still teaches "It's on the order sheet, under **Procedures**", the menu the fix moved away from.
  - The glossary still calls the menu "Resuscitation drugs".
- **Fix:**
  - Remove `tcp` and `synccv` from Procedures, or don't count them there.
  - Point the lesson to Resuscitation.
  - Rename the glossary entry.
- **Effort:** S

### R4.3-12 · Low · The new lessons overuse bold, and the Lessons intro doesn't describe them
- **Where:** `LESSONS.arrest` and `LESSONS.tachy` (`ui.js:1865–1878`). The intro is in the Lessons sheet. Screens: `s7-phone-land-arrest-03.png`, `s12-phone-lessons.png`.
- **What:**
  - **Too much bold.** "Not shockable" has 12 bold runs in 37 words. Every H and T is bolded on its own, and at 13 px on a landscape phone the paragraph reads as all bold. The owner's rule is "few words with key words in bold".
  - **Intro doesn't match.** The intro says "The first lessons put you on a patient as the doctor… The case cards (five short cards)…". The two new lessons, listed first under Cardiovascular, are 6 and 4 text slides with an empty floor behind them.
- **Fix:**
  - Bold the two or three words a student must remember per card.
  - Either give the lessons a patient (see R4.2-07) or say in the intro what they are.
- **Effort:** S

### R4.3-13 · Low · Small contradictions on the arrest and ROSC cards
- **Where:** `pathRows` and `OC.examOf` for ROSC (`engine.js`, last line). Screens: `s1-phone-cpmod-w1-01b-countdown-after-3min.png`, `s2-phone-land-cpmod-home-01-rosc-card.png`.
- **What:**
  - **Before the code.** Your own patient's card says "Your patient has **no pulse**" above the path row "Provider: **Not assigned yet**" (blue, as a to-do).
  - **After ROSC.** The Exam says "Intubated and on the ventilator". The path says "Intubation: Underway · Ventilator: After the intubation", and the toast says "Intubate (attending and RT), then the vent."
- **Fix:**
  - Show "You (code)" in the provider row.
  - Make the ROSC exam text follow the actual intubation state.
- **Effort:** S

### R4.3-14 · Nitpick · "Not sure when it started: at least a few days"
- **Where:** `ui.js:909`.
- **What:** The line claims knowledge in the same breath as admitting there is none.
- **Fix:** "Not known. Treat it as more than 48 hours."
- **Effort:** S

**New findings by severity:** Critical 1 · High 2 · Medium 2 · Low 8 · Nitpick 1 (14 in total).

## 4. Coverage

**Read:**
- `git diff 49aea94..HEAD -- src` in full: `ui.js` (+62), `map.js` (+1), and the engine parts that reach the screen.
- In the engine: `codeCard`, `codePick`, `codeOutcome`, `arrestNoTeam`, `toArrest`, `CODE_Q`, `CODE_WHY`, `CONTRA_WHY`, `afOnset`, `grayDispo`, `mdDecide` and the end-of-shift fields.
- In `map3d.js`: the walker sprites and poses.

**Ran in Chrome** (scripts in `r4/`):
- `s1.py`: your own patient's arrest at all four sizes. **Run the code** and the countdown, each code card, each result card, the outcome, and the card afterwards. Also a child (4 years) and an infant at phone and phone-land.
- `s2.py`: ROSC on `cpmod` and `tia`, tapping Home. Plus an engine check of the Observation message.
- `s3.py`: an unrun code in both roles. The countdown at 1 minute left, a 1× timeline of the strip through the death (every change logged), the dead card, and every action on it.
- `s4.py`: a waiting-room arrest as the charge nurse. The flat floor at phone-land and desktop, the 3D floor at phone-land, an overflowing waiting room (33 patients), Next, and the card.
- `s5.py`: an autopilot Five-Minute Rush with two injected arrest deaths, both roles, at phone-land, phone and desktop. Verdict, rows, M&M.
- `s6.py`: the stale class-save notice at all four sizes, including the reload.
- `s7.py`: both new lessons, every step, at phone, phone-land and desktop. Size, overflow and bold count.
- `s8.py`: glossary searches.
- `s9.py`: the A-fib onset line (known and unknown), the Resuscitation menu, the double badge, and the harm toast.
- `s10.py`: how the end of a code you ran is announced, at 1×.
- `s11.py`: harm strings in the landscape strip at 844×390 and 667×375.
- `s12.py`: the Lessons list.
- `shuf.js`: the answer-position counts.

**Could not check, or checked only partly:**
- **Devices and engines.** No real phones, WebKit or Firefox. All sizes are CSS px from emulation.
- **Audio.** Judged from code, including the overlapping `good`/`bad` and `card` sounds.
- **3D.** Only at 844×390, under software GL.
- **Hand-made states.**
  - The waiting-room patients in `s4` and `s5` were set up through the hooks. I set ESI by hand (a real crash sets ESI 1).
  - In `s5` I back-dated `tArrest` to force deaths.
  - The 33-patient waiting room was injected. I didn't play a natural Full Moon Friday to that point.
- **Not re-examined.** The round-1 items deferred to Phase 6 (R4-01 to R4-08) and the round-2 Lows.

## 5. What I'd keep

- **The shuffle.** It is now a real, seeded permutation, uniform to within a few points over 540 real cards.
- **The result card's content.** "The call:" plus the reason for both the wrong pick and the right one is the right teaching move. It only needs styling.
- **Next for an arrest outside a room.** It ranks the patient first (priority 1.2), names them, says "Room them now", and lights the resus bays green.
- **Cardioversion and pacing in Resuscitation.** The menu's label finally matches what is in it.
- **The child code card.** Doses are computed from an estimated weight, the title says "(child)", and the age shows in months under two.
- **The new glossary entries.** They are plain, short and correct in tone ("VF: the heart quivers instead of pumping").
- **The death toast.** It now stays 4.2 s when nothing is queued, and the bad news is protected when the queue is trimmed.
- **The lesson cards fit.** Every step of both lessons fits its card at every size I tried (scrollHeight equals clientHeight).
