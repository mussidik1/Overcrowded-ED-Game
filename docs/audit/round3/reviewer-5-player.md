# Reviewer 5, round 3: Hardcore gamer and game critic

Build reviewed: branch `claude/sleepy-rubin-jot35n` at v0.30.0 (HEAD `8357568`), the committed `index.html`. I served the repo over http and drove headless Chrome (Playwright) at 844x390, a phone held sideways, with the flat floor plan. Every play step was a real tap unless I say otherwise.

Scratch files are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round3/r5/`:
- screenshots in `shots/` (cited below by number);
- Node scripts in `node/`: `pos.js`, `tell.js`, `odds.js`, `ignore.js`, `roscdest.js`, `rhythms.js`, `two.js`, `busy.js`, `midexam.js`.

## 0. Round-2 status (my R5.2 Highs and Mediums)

STATUS.md marks R5.2-01 to 05 as fixed and defers the R5.2 Mediums to Phase 6. I rechecked all of them anyway.

| Finding | Status | One line of evidence |
|---|---|---|
| **R5.2-01** High: ignoring your own arrest was free | **Fixed** | Aisha D. (forced arrest, ignored 20 min): "md" ledger 61 → 21, legal risk 0 → 15%, Clinical 48 → 44. In Node (`ignore.js`): ignored −40 points and +15 legal; run with every card wrong −12; run right +42. |
| **R5.2-02** High: a post-arrest patient sent home | **Partly fixed** | "Discharge home" is refused with a toast and the exam text is replaced. But the button is still offered, the old case's workup text and vitals stay on the card (`24-kid-rosc-card.png`), and every ROSC is now forced into Critical Care, even when the game's own card says cath lab or OR (new **R5.3-01**). |
| **R5.2-03** High: arrests outside rooms invisible | **Partly fixed** | Triage line: red marker, first on Next, pod rooms turn green when resus is full (`41-triage-arrest-marker.png`, `43-helen-place-pod2.png`). The wall, where most natural arrests happen, still has no code marker (new **R5.3-06**). |
| **R5.2-04** High: an ectopic run as trauma | **Fixed** | Tamika N., a ruptured ectopic, bled into arrest. Her complaint read "Arrested after a massive bleed", she got PEA cards, and the cause card asked for "massive transfusion… surgeon or interventional radiology". No chest decompression (`31-ect-card3.png`). |
| **R5.2-05** High: the report hides deaths | **Partly fixed** | The verdict now says "3 patients died in the department", and the table has a "Died" row. But the verdict over those three deaths of mine is still "Solid shift. The nurses like working with you.", and the M&M dropped 2 of the 3 (new **R5.3-07**). |
| R5.2-06 Medium: frozen-clock quiz, then a 15-minute wait | **Partly fixed** | The clock now runs 4 game minutes between checks (measured 3.97 and 3.95 min, 10.1 s each at 1×), and every check gets a result card. Orders are still locked ("You're running the code. CPR is going."). After the last card there are still 7 idle minutes with no timer. |
| R5.2-07 Medium: odds ignore skill; the result explains nothing | **Partly fixed; one part worse** | The skill now matters: VF run at once gets 50% ROSC with every card right and 1.3% with every card wrong (`odds.js`). The outcome toast still gives no odds or reason. **Worse:** a death after a perfect code went from severity 30 to 60. "Joyce C. died after a VF. 3 of 3 rhythm checks right; the team got there 0 min after the arrest" now outranks every wrong answer as a "worst moment". |
| R5.2-08 Medium: thin ACLS content that rarely shows up | **Still open** | In 24 autopilot shifts (`rhythms.js`) there were 29 natural arrests. 21 were the EMS VF case, and **0 were asystole**. The title still names the rhythm ("Code blue: VF"). |
| R5.2-09 Medium: no lesson, no glossary words | **Partly fixed** | Two lessons and 14 words now exist. But "Cardiac arrest" is six text slides with no patient, and code cards are still off in lessons (`!G.train`, engine.js:2182), so the first card a student answers is scored. |
| R5.2-10 Medium: the radio during a code | **Still open** | "Missed radio call. Medic 24 rolled to another hospital's physician" fired at 08:26, during Joyce C.'s code (−30). `taskPr` is unchanged: box −100 still beats code −90 (engine.js:1497-1498). |
| R5.2-11 Medium: plain-words radio glosses give the answer | **Still open** | My Quiet Tuesday report shows "Chest pain with a low blood pressure. They want a drug that lowers pressure." |
| R5.2-12 Medium: M&M blames the attending for patients out of reach | **Still open** | `hemorrhageTick` still passes `!p.prov \|\| !!p.mine` (engine.js:3517). "Resus 2 went into hemorrhagic shock" (Yara N., then taken by Dr. Okafor) was one of my three worst moments. |
| R5.2-13 Medium: a death is worth less than wall time | **Still open** | Charge-nurse Manic Monday: 19 deaths with no code team gave "Safety events −766" against "Wall time −5752" (`49-rn-report.png`). |

**Tally:** Highs: 2 Fixed, 3 Partly fixed. Mediums: 0 Fixed, 3 Partly fixed (one part of R5.2-07 worse), 5 Still open.

## 1. Verdict

**Only after major work.** The code loop is better as a loop:
- a result card after every check;
- real time passing between checks;
- shuffled answer positions;
- a countdown on "Run the code";
- a real cost for walking away.

But the round-2 fixes opened new holes that a working clinician hits at once:
- **After ROSC, the game sends everyone to Critical Care and fines you for calling the surgeon.** This covers the ruptured ectopic, the AAA, the STEMI and the trauma patient. The same card's own text says "OB/GYN to the OR", and the code card you just answered says "straight to the cath lab".
- **The quiz gives itself away.** The right answer is the longest choice on 23 of 28 code cards.
- **The clock contradicts the content.** The cards say "two minutes of CPR", the clock moves four, and "it has been 4 minutes" shows at minute 8.

I still would not play past ten minutes on my own.

## 2. Score

**4/10.** The code feels better minute to minute. But the round-2 ROSC fix now teaches a clinically wrong disposition every time a code succeeds, and the cards can be passed without knowing ACLS.

## 3. New findings, worst first

### R5.3-01 Critical: after ROSC every patient is forced to Critical Care; the surgeon, cath lab and OB are "not ours", and the bleeding stops by itself
- **Steps (real taps, Quiet Tuesday, attending):**
  1. I put Tamika N. (22F, ruptured ectopic) in Resus 4 with a hook (`OC.trainPatient`), then tapped **See this patient**.
  2. I did not activate MTP. She went into shock at 10:21 and lost her pulse at 10:36 ("Resus 4 lost pulses. They needed blood.").
  3. I tapped **Run the code** and answered all three PEA cards right. Card 3's right answer was "Massive transfusion now, and the surgeon or interventional radiology to stop the bleeding". ROSC came at 10:59.
  4. Her card read: "The workup: … ruptured ectopic until proven otherwise. Massive transfusion, type and screen, **OB/GYN to the OR**." I tapped **Admit: call a consult → OB/GYN**.
  5. The result: Dr. Adeyemi (OB/GYN): "**Why is ob/gyn getting this call? Not ours. Call Critical Care.**" That cost −10 consult points, and the service's mood dropped (`34-ectopic-rosc-obgyn.png`).
- **The vitals:** BP 79/45, HR 140, marked "▲ Improving". No blood was ever given, and there was no MTP button any more. `hemorrhageTick` sets `p.bleed = null` when the patient arrests (engine.js:3506, 3522), so the hemorrhage is cured by the arrest.
- **Every surgical or cath cause does the same** (Node, `roscdest.js`, a real ROSC each time, then the service the case's own card names):

  | Case | Service called | Answer | What the card says |
  |---|---|---|---|
  | STEMI | Cardiology | **REFUSED** | "Cardiology and the cath lab" |
  | AAA | Vascular | **REFUSED** | "vascular surgery to the OR" |
  | Ectopic | OB/GYN | **REFUSED** | "OB/GYN to the OR" |
  | MVC | Trauma surgery | **REFUSED** | "Massive transfusion…" |
  | GI bleed | GI | **REFUSED** | "GI for a scope" |
  | Dissection | Cardiothoracic | **REFUSED** | the hospital has no cardiac surgery, so the patient needs a transfer; the game wants its own ICU |

- **The game contradicts itself.** The coronary cause card's right answer is "if the pulse comes back, straight to the cath lab", and the patient is then refused by Cardiology.
- **Cause:** `codeOutcome` sets `p.con = 'icu'; p.dispo = 'icu'` for every ROSC (engine.js:2229), and `consult()` refuses any `spec !== p.con` (engine.js:3004). The R5.2-02 fix ("home is refused, go to the ICU", engine.js:1953) cemented it. My own round-2 suggestion ("offer only ICU admission") was too blunt, and this is the result.
- **Why a player cares:** a student who brings back a bleeding 22-year-old is told the gynecologist has nothing to do with her. A working EM doctor closes the game here. It is clinically wrong teaching, and it is the reward screen for doing the code right.
- **Fix:**
  - Keep the source-control service after ROSC: `p.con` stays the case's service (`CASES[ck].con`), with Critical Care as `con2`.
  - A bleed that arrested keeps `p.bleed = 'mtp'`, so MTP is still needed.
  - STEMI or coronary ROSC goes to the cath lab. Dissection is a transfer.
  - Add a rule test per case: ROSC, then the case's own service accepts.
  - R6 should rate it.
- **Effort:** S-M.

### R5.3-02 High: a post-arrest infant can't be transferred; the game admits a 10-month-old to the adult ICU and fines the transfer its own card recommends
- **Steps (hook to inject, real taps to play):**
  1. Owen K., 10 months, RSV, was in Room 9 (`OC.trainPatient('rsv')`). I tapped **See this patient** and forced the arrest (`OC.toArrest`).
  2. I ran the PALS code (card 1 wrong on purpose) and got ROSC at 09:11.
  3. His card: "The workup: A blood gas shows the baby is tiring. High-flow oxygen. **Transfer to a children's hospital.**" (`24-kid-rosc-card.png`).
  4. I tapped **Transfer**: "The receiving hospital declined: Owen K. can be cared for here." That cost −10 and a wrong-disposition count (`26-rosc-infant-transfer-refused.png`; mdDecide, engine.js:1962).
  5. I tapped **Admit → Critical Care**: +12. The consult list has no pediatric service at all.
- **On top of that:** the M&M then listed "Transfer requested went past 45 min for Owen K." against me, for the transfer the game had just refused.
- **The rest of the card is stale:**
  - "Discharge home" is still a button.
  - "High-flow oxygen" sits beside "Intubated and on the ventilator".
  - The vitals still show RR 41.
  - "Intubation: Underway" contradicts the exam line.
- **Why a player cares:** the hospital transfers sick infants (the RSV case says so), yet a post-arrest infant stays in its adult ICU. A pediatric nurse or paramedic stops trusting the game. A child arrest is rare in normal play (0 in 24 autopilot shifts), which is why this is High and not Critical.
- **Fix:**
  - A child under 13 with ROSC is a transfer (critical-care transport) unless the case says otherwise.
  - The ROSC card replaces the case's `ORD_WHY` and vitals.
  - Drop "Discharge home" from the buttons after ROSC.
- **Effort:** S.

### R5.3-03 High: the right code-card answer is the longest one on 23 of 28 cards
- **Measured** (`node/tell.js`, every card in `CODE_Q` and `CODE_CAUSE`):
  - The right answer is the **uniquely longest** choice on 23 of 28 cards.
  - "Shock it" (8 characters) is a filler distractor on 16 of them.
  - The 5 exceptions are VF card 3, and PEA and asystole cards 1 and 2. On those, a wrong option is longer.
- **Seen in play:**
  - "All at once: stop the bleeding, give blood, secure the airway, decompress both sides of the chest" (97 characters) against "Shock it", "Normal saline, six liters" and "Epinephrine every 3 minutes and nothing else" (`52-trauma-card1.png`).
  - "Keep CPR going; epinephrine 0.1 mg IV or IO now (0.01 mg/kg)" against "Shock it" (`23-kid-card1.png`).
- **The shuffle doesn't help.** I measured 1,200 cards (`pos.js`): the right answer sat at positions 1 to 4 about evenly (275, 333, 279, 313). Position is fixed; length now gives the answer away.
- **The radio calls don't have this problem:** the right answer is the longest on only 3 of 10.
- **Why a player cares:** "pick the longest" scores about 82% with no ACLS knowledge. The cards set the ROSC odds and the Clinical score, so a test-wise student wins without learning. Any item writer (NCLEX, NREMT) treats this as the first flaw to remove.
- **Fix:**
  - Rewrite the distractors to the same length and structure as the key ("Shock, then epinephrine 1 mg every 3 to 5 minutes" against "Epinephrine 1 mg, then shock").
  - Retire "Shock it" as filler.
  - Add a lint to `lintCode()`: the key may not be the uniquely longest choice on more than a third of the cards.
- **Effort:** S-M (content).

### R5.3-04 Medium: the cards say "two minutes of CPR", but the clock moves four; "it has been 4 minutes" appears at minute 8
- **Steps:** Joyce C., forced VF, run at once. The cards came at 08:11, 08:15 and 08:19.
  - Card 2: "Two minutes of CPR. Rhythm check: still VF."
  - Card 3: "Two more minutes. Still VF…", with the distractor "Call the code: it has been 4 minutes" (engine.js:2093), while the clock read 8 minutes in (`22-vf-card3.png`).
  - The lesson's last card says "Each rhythm check is a card, about two minutes apart."
- **Cause:** the round-2 spacing fix set `CODE_GAP = 4` (engine.js:2032), but the text kept ACLS's 2-minute cycle.
- **Why a player cares:** the clock is the most visible thing on screen. A student watching it learns 4-minute CPR cycles, and a clinician sees the mismatch on the first code.
- **Fix:** set `CODE_GAP = 2`, or show the code's own "CPR 2:00" timer on the card and keep the shift clock out of it. Either way, the minute counts in the text must match.
- **Effort:** S.

### R5.3-05 Medium: the class-save notice flashes once for 3 seconds and tells students to do something the game refuses
- **Steps:**
  1. With a hook, I wrote a class shift saved on v0.29.1 into `localStorage` and reloaded.
  2. A 38-word message appeared in the thin top strip for 3 seconds: "…can't continue on v0.30.0… **Start it again with the code**, or ask your instructor for a new one." (`36-stale-class-1200.png`).
  3. It was gone by 4 seconds and never shows again (`oc-save-noted`). The toast is 3000 ms (ui.js:174). The `true` third argument passed to `toast()` is ignored (ui.js:192).
- **"Start it again with the code" can't work.**
  - The note only fires when the save's version differs from the game's, so the code was made on the old version.
  - Codes are version-salted. In Node, 628 of 640 v0.29.0 codes read as **stale** on v0.30.0 and can't be played (`staleWhy`, ui.js:2000).
  - The Class code screen will then say "made on another version… ask your instructor for a new code."
- **Why a player cares:** this note exists for one moment, a class mid-shift when the site updates. In that moment it is easy to miss, and its first instruction is wrong.
- **Fix:**
  - Show it as a card that stays until the student taps it (or on the Class code screen).
  - Say: "Ask your instructor for a new code."
- **Effort:** S.

### R5.3-06 Medium: arrests on the wall, the most common place, still get no code marker; past the sixth stretcher they aren't drawn at all (the rest of R5.2-03)
- **Where natural arrests happen:**
  - 24 autopilot shifts: 14 of 29 arrests were on the wall (`rhythms.js`).
  - My two charge-nurse shifts: 9 of the 15 natural arrests I logged were on the wall. Every bleeding trauma or AAA left on the wall arrests there at 30 minutes.
- **Steps (charge nurse, Manic Monday):**
  - **Walt G.** (the EMS arrest case) arrived at 07:23 on the wall.
    - His stretcher showed the same small flashing "!" as every ESI 1 on the wall.
    - Next went to The Box first, then Walt.
    - The Next line reads "needs a room now", not "CODE".
    - He died at 07:43: "They never got a room" (`38-rn-wall-arrest.png`).
  - **Kevin C.** (forced with a hook, 2nd on the wall): drawn with the plain alert badge, no red code ring (`46-wall-arrest-closeup.png`).
  - **Andre B.** (forced with a hook, 11th on the wall): not drawn at all. The wall shows "14 outside" and "+10 more". He died at 13:21 with no marker anywhere.
- **Cause:**
  - The R5.2-03 fix put the red ring only in `ptChipSVG` (walkers). `stretcherSVG` ignores `p.arrest` (map.js:113).
  - `wall.slice(0, 6)` hides the rest (map.js:740).
  - `needList` adds the "CODE:" line only for `waiting` and `triage` (ui.js:2246). The wall stays at pr 1.5, tied with every ESI 1 (ui.js:2245).
- **Why a player cares:** the 20-minute death clock is the same everywhere, but only the rarer places got the fix.
- **Fix:**
  - Draw the red code ring on a wall stretcher.
  - Always draw an arrested patient, even past the sixth: pull them inside, or ring the "outside" pill red.
  - Give `p.arrest` on the wall the same pr 1.2 "CODE:" entry.
- **Effort:** S.

### R5.3-07 Medium: the report still buries deaths under softer events, and now lists a perfect code as a "worst moment" (the rest of R5.2-05)
- **Attending, Quiet Tuesday** (`35-md-easy-report.png`):
  - Three of my own patients died: Dmitri E. (PEA), Joyce C. (VF, 3 of 3 right) and Aisha D. (ignored).
  - The verdict: "**Solid shift. The nurses like working with you.** 3 patients died in the department."
  - The three worst moments: Aisha's death (90), then "Resus 2 went into hemorrhagic shock" (70) and "Resus 4 went into hemorrhagic shock" (70).
  - Dmitri's and Joyce's deaths (60, engine.js:2240) were left out.
- **Charge nurse, Manic Monday** (`49-rn-report.png`):
  - 20 patients died.
  - The three worst moments were two "went into cardiac arrest in the waiting room" lines (95) and "bled until their heart stopped" (95). The word "died" never appears; "died… no code team" is 90 (engine.js:2256).
  - Both "waiting room" lines were patients in the triage line (R5.2-17, still open).
- **A perfect code counts as a worst moment.** On Manic Monday, "Lucia H. died after a traumatic arrest. 2 of 2 rhythm checks right" topped my worst moments.
- **Fix:**
  - Deaths get severity 100 (a death after a well-run code goes to a separate "Lost despite good care" line).
  - With any death, the verdict starts with it: "You lost N patients today."
  - Arrest lines that ended in death merge into the death line.
- **Effort:** S.

### R5.3-08 Low: the code card names the diagnosis the player hasn't made
- **Where:** Tamika N., cause card (`31-ect-card3.png`): "Hemoglobin 5 on the gas. The bleeding is inside: **a ruptured ectopic pregnancy**." I had never picked a diagnosis (orders were still `need`).
- **The rule it breaks:** CLAUDE.md says the harm messages "must never name a diagnosis the player hasn't made". The code card does it through `BLEED_SRC` (`{src}`).
- **Fix:** "The bleeding is inside the belly." Name the source only once `p.dxPick` is made.
- **Effort:** S.

### R5.3-09 Low: the new content uses words the glossary doesn't have
- **Missing from Words** (searched in the open glossary, `07-words.png`):
  - from the code cards: IO, J and J/kg (joules), amiodarone, sodium bicarbonate, calcium chloride, QRS (in a "why" line), interventional radiology, dialysis, bag-mask, advanced airway, adenosine, flumazenil, lidocaine;
  - from the A-fib lesson: diltiazem, metoprolol, sedation.
- **The worst case:** "IV or IO" is part of the right answer on every PALS card.
- **Why a player cares:** this breaks the owner's rule that every term is explained. A lay student can't tell what IO is.
- **Fix:** add the 15 words, and a "Words" button on the code card.
- **Effort:** S.

### R5.3-10 Low: an arrest mid-exam keeps the attending "examining" a pulseless patient
- **Steps:** in Node (`midexam.js`) and live (Lucia H.), the arrest comes while my exam is under way.
  - The queue stays `eval:p*` (started) for the rest of the exam: 07:02 to 07:11 in Node. The staff card says "You · Eval".
  - The code only starts if the player taps "Run the code", which preempts the exam.
- **Why a player cares:** a player who doesn't notice is busy for 8 minutes examining a patient in arrest, and can't pick up anyone else.
- **Fix:** `toArrest` ends a started eval for that patient too.
- **Effort:** S.

### R5.3-11 Nitpick: grammar and labels in the new screens
- "Olga R. died after **a asystole**" (Node). "Joyce C. died after a VF": the word "arrest" was dropped, so it reads oddly.
- "keep **cpr** going; epinephrine 1 mg **iv** now" (R5.2-21, still lowercased).
- The child's result card loses "(child)": "CODE BLUE: PEA · RHYTHM CHECK 1".
- "RHYTHM CHECK 3 OF 3" sits on cause cards that aren't rhythm checks (R5.2-17).
- The Lessons header still says "The first lessons put you on a patient as the doctor" and "five short cards". Its new first lesson has no patient and six cards; the next has four.
- The A-fib lesson's "short version" adds new content (the 48-hour rule) instead of summarizing.
- **Fix:** use "an" before a vowel and keep the answer's own case. Rewrite the header. Make the summary a summary.
- **Effort:** S.

**Counts:** Critical 1, High 2, Medium 5, Low 3, Nitpick 1 (12 total).

## 4. Coverage

**Played with real taps:**
- **Lessons:** Cardiac arrest (6 cards) and A fast heart (4 cards), start to end from Learn, then Lessons. Words: searched for 50 terms.
- **Attending, Quiet Tuesday, 07:00 to 19:00** (seed 902571953):
  - By hand:
    - Dmitri E.: exam, orders, then a forced PEA code. I waited 8 minutes on the countdown, then answered 2 of 3. He died.
    - Joyce C.: forced VF, 3 of 3. She died.
    - Owen K.: an injected infant, a PALS code, ROSC. Home was refused, the transfer was refused, then Critical Care.
    - Tamika N.: an injected ectopic, a natural bleed arrest, PEA 3 of 3, ROSC. OB/GYN refused, then Critical Care.
    - Aisha D.: a forced arrest, ignored for 20 minutes.
    - Radio calls answered by hand.
  - From 11:50 to 18:06, my policy player ran it. It follows "Still needed" and reads the true diagnosis, which is a cheat, so I didn't score that part. I read the report.
- **Charge nurse, Manic Monday, twice:**
  - Shift 1 by hand to about 09:45: a natural wall arrest (Walt G.), and forced triage arrests (Helen V., Jim L.). Jim was bedded in pod Room 7 with resus full and coded by Dr. Okafor. Then my policy player ran it to 15:32, where I forced a wall arrest (Kevin C.). My browser driver was stopped there, so this shift has no report.
  - Shift 2 (seed 275885378): my policy player ran it to 19:00, with natural arrests on the wall and in triage. I forced one more wall arrest (Andre B., 11th on the wall) and read the report.
- **Attending, Manic Monday, 07:00 to 19:00** (seed 1916741071): my policy player, with radio and orders by hand at times. Lucia H. was an injected MVC with a forced traumatic arrest, 2 of 2. She died. I read the report.
- **Class-save notice:** a fabricated v0.29.1 class save, then a reload.

**Hooks used:**
- `OC.toArrest` to force 9 arrests.
- `OC.trainPatient` to inject 5 patients (RSV infant, AAA, two ectopics, MVC), with `tArrive` reset so the bleed clock starts.
- `localStorage` for the stale class save.
- Read-only `OC.codeRhythm`, `OC.codeCause` and `OC.G` for state. The pause menu was used to stop the clock while injecting.

**Node:**
- `pos.js`: answer positions over 1,200 cards.
- `tell.js`: answer lengths.
- `odds.js`: ROSC odds by case, answers and delay.
- `ignore.js`: the cost of ignoring a code against running it.
- `roscdest.js`: which services accept a ROSC patient.
- `rhythms.js`: natural arrests over 24 autopilot shifts.
- `two.js`: two codes at once (R5.2-14, unchanged: the second waits 15 minutes).
- `busy.js`: Run the code preempts an exam (it works).
- `midexam.js`.
- Class-code staleness across versions.

**Not covered, and why:**
- The 3D floor, which is slow here.
- Real touch and sound.
- WebKit.
- The class results backend, which is unreachable from this container.
- The other modes: Orientation, the Five-Minute Rush, the MIEMSS pack, scenarios and weather.
- Unstable A-fib in live play: no A-fib patient crashed for me.
- Natural asystole in a room: none occurred.

## 5. What I'd keep

- A result card after every rhythm check. Feedback now lands before the next question (R5.2-16 is gone).
- Real time between checks, and the "Run the code" countdown ("19m before they are gone"), which ticks down correctly.
- Walking away from your own arrest now costs 40 points and legal risk, more than a badly run code.
- Answer positions are truly shuffled.
- A triage-line arrest gets the red ring and goes first on Next. With resus full, the pod rooms light up green and the hallway and chairs don't.
- Medical bleeds are no longer run as trauma.
- PALS cards with weight-based doses ("about 10 kg… 0.1 mg") are a real teaching step.
