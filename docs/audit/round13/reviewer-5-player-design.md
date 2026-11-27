# Round 13, Reviewer 5: player, game critic and classroom user (v0.33.0)

Branch `claude/sleepy-rubin-jot35n`. HEAD was 76c553f during the review; engine.js is unchanged since 895bc15. Other reviewers' uncommitted edits to ui.js were in the tree (crash guard, CB_MDNOTE), and none of them touches these findings. I made no changes to the repo.

Scratch scripts are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round13/r5/`:
- Shift sampling: `h.js`, `x.js`, `cmp.js` (v0.32.0 against v0.33.0, using `engine_old.js` from 78916ef), `load.js`, `ign.js`, `stop.js`.
- Single checks: `leak.js`, `handed.js`, `rush.js`, `div.js`, `radio.js`, `esi.js`.
- Browser: `pw.py`, `pw2.py`, `pw3.py`, with screenshots in `shots/`.

## 1. Verdict

**Not shippable as a graded teaching game, even behind the gate, until R5.13-01 to R5.13-04 are fixed.**

Phase 6 set out to grade the attending on their own calls and stop giving answers away. It does neither reliably:
- **The answer is still given away.** The moment the attending picks a diagnosis, the engine writes the true diagnosis to the board log ("Room 9: Cholecystitis. Your call."). The list board shows that log on screen.
- **Idling beats trying.** The grade only ever subtracts, from a start of 100% Clinical and 100% Legal. Every patient seen is pure risk, and no part rewards work done. An attending who never touches the phone earns 2 stars on Quiet Tuesday. An engaged 70%-accurate student earns 1.33 to 1.75. Answering the radio alone earns 3 stars.
- **Abstaining beats guessing.** Never calling a diagnosis takes the Diagnoses part out of the average: 2 stars on every level, 3 in the Rush, and the verdict "Solid shift. Your calls held up."
- **The handover is broken.** A patient handed to the attending gets no toast and no mark on the floor plan, and the rule isn't taught anywhere. The penalty is a one-time hit capped by the very patients it leaves stuck.

What works:
- The charge nurse's Rush pace cap works and can't be beaten by going on divert.
- Regular levels are not easier than v0.32.0. The charge nurse's results are identical; the attending's are harsher.
- Radio calls never repeat within a shift.

## 2. Score: 4 / 10

The grading model rewards doing less. A working attending would see through it in one shift, and a student learns that the best play is to not commit.

## 3. Findings (worst first)

### R5.13-01 Critical: the true diagnosis is posted to the board log the instant the attending makes a call
- **Location:** `src/engine.js` `checkDispo`, line 3279: `note(\`${label(p)}: ${p.dx}. Your call.\`)`. It runs as soon as the attending's own patient has `dxK` (set by `dxPick`) and reaches `mddecide`. The log is drawn by `renderLog` in `src/ui.js` (about line 707) into the "Radio log" section of the list board.
- **What happens:** `dxPick` carefully says "Your diagnosis: Pancreatitis. The results and how they do will tell." In the same game minute, `checkDispo` logs "Room 7: Gastroenteritis. Your call." That is the right answer, posted while the patient is still in the room and before the disposition. The leak happened in all four of four picks.
  - On the list board (the owner's kept option) it is visible text.
  - On the floor plan it sits in `G.log` and in the saved game.
  - The attending can then pick the disposition with the truth in hand. The Phase 6 promise ("no answer giveaways on regular shifts") is broken for every patient.
- **Reproduction:**
  - `node leak.js`. It picks the wrong answer on four patients and prints the log line, at +0 min each time, for example "PICKED WRONG … said Pancreatitis truth Gastroenteritis … LOG at +0min: Room 7: Gastroenteritis. Your call."
  - `CHROME_PATH=/opt/pw-browsers/chromium python3 pw2.py`: at both phone and desktop sizes the list board's Radio log contains "Room 9: Cholecystitis. Your call." right after the pick "Biliary colic" (`#log` visible: True).
- **Fix:**
  - For `mdMine(p) && !G.train`, log `${label(p)}: results are in. Your call: home, a consult, or a transfer.`, or the player's own `p.dxPick`.
  - Audit every `note(…p.dx…)` path for the attending's own patients: lines 1649 and 2034 are safe today only because `needsDx` guards them.
  - Add a rules15 check: after `dxPick` on a shift, no `G.log` entry or toast contains `p.dx` until the patient leaves.
- **Effort:** 20 minutes plus the test.

### R5.13-02 Critical: an attending who does nothing outscores one who tries, and quitting early beats playing the whole shift
- **Location:** `src/engine.js`:
  - `mdScores` (about 849) and `SC_PRIOR = 150`: Clinical starts at 100 and only falls.
  - The `litCheck` decay (570): legal risk falls 1 point per 20 clean minutes.
  - `baseStars` for the attending averages the stars of the non-null parts.
  - `MD_LOAD.easy = 0`: nobody is ever handed to the attending on Quiet Tuesday.
- **What happens:** nothing in the attending's grade credits work. Two of the four parts (Clinical and Legal) are free at 100% for a player who never acts, and Diagnoses drops out entirely. Each patient seen can only cost points.

  Averages over 4 to 6 seeds, stars per shift:

  | Attending | Quiet Tuesday | Manic Monday | Full Moon Friday | Rush |
  |---|---|---|---|---|
  | Never touches the phone (radio rings out) | **2.0** (Clinical 100, Radio 0, Legal 100) | 1.5 | 0.75 | **2.0** |
  | Answers the radio only, sees no patient | **3.0** (avg 100) | 2.5 | 1.5 | 2.5 |
  | Engaged, 70% accurate (`slowdoc`) | 1.75 | 1.5 | 1.5 | 2.0 |
  | 70% accurate, plays the whole shift | 1.33 | 1.83 | – | – |
  | 70% accurate, plays 2 h, then walks away (radio still 70%) | **2.0** | 1.67 | – | – |

  The report then gives +4 or +6 rank points for this. A student learns that the safest attending is the one who sees nobody. A working attending will find this the least credible thing in the game: volume is the job.
- **Reproduction:**
  - `node h.js easy idle_md 3` gives 2 stars, `{"clinical":100,"dx":null,"radio":0,"legal":100}`.
  - `node x.js easy radioOnly 2` gives 3 stars with avg 100 and 0 patients.
  - `node cmp.js /home/user/Overcrowded-ED-Game/src/engine.js idle_md,slowdoc 4`.
  - `node stop.js` runs the "walk away at 09:00" experiment.
  - In the browser, `python3 pw.py easy:md:idle` shows the report "CLINICAL 100% ★★★ … +4 rank points".
- **Fix:** grade the attending per patient, against an expected load.
  - (a) Clinical becomes the mean quality of the attending's own patients, times coverage: own patients seen divided by the level's expected count, with handed patients in the denominator.
  - (b) Seeing no patients gives 0 stars, whatever the radio did.
  - (c) Legal never decays below the shift's peak minus a small amount, or doesn't decay at all for the grade.
  - Add rules tests: idle gives 0 stars and radio-only gives at most 1 star on every level, and a 70% attending outscores an idle one on every level.
- **Effort:** half a day to a day of design, plus golden and stress updates.

### R5.13-03 High: never calling a diagnosis beats calling one; abstention is the dominant strategy, and the verdict praises it
- **Location:** `mdScores` (`dx: dn ? … : null`); `needsDx`, `dxAsk` and `checkDispo` (a patient with an open `dxq` never gets `dxK`, so it never reaches a disposition); the open-call penalty `care(-0.3,'md')` (3737); `verdictOf` in `src/ui.js`.
- **What happens:** a diagnosis left unanswered is never scored. The patient stays in the room all shift, never reaches a disposition, and adds no legal risk.

  | Attending who signs perfect orders but never picks a diagnosis | Quiet Tuesday | Manic Monday | Full Moon Friday | Rush |
  |---|---|---|---|---|
  | Stars | 2 | 2 | 2 | **3** |
  | Scores | Clinical about 33, Dx —, Radio 100, Legal 100 | same | same | Clinical 87 to 89 |

  A guessing student in the Rush who gets 0 of 2 right scores 0 stars on that part; one who refuses to answer is left out. The report says "Diagnoses — · 0 of 0 right" and the verdict reads "Solid shift. Your calls held up." Patients sit in rooms all day with no diagnosis.
- **Reproduction:** `node x.js rush noDx 2` and `node x.js med noDx 2`.
- **Fix:**
  - At leave and at the end of the shift, a patient with an open `dxq` counts as "not called": it adds to `dxWrong`, or to a separate `dxNone` that scores as wrong. It goes in "Diagnoses to review" as "Not called. It was X."
  - Don't leave a part out because the player declined to act. Leave it out only when the game never asked.
- **Effort:** 1 hour plus tests.

### R5.13-04 High: a handed-over patient is invisible on the floor plan, the rule is never taught, and the penalty is capped and one-off (F-134 is part of this)
- **Location:** the handover in `src/engine.js` (about 4653) uses `note(...)`, not `toast(...)`. Other parts:
  - `unseenHanded` (3471): one `care(-25)` and `+5` legal, once.
  - `mdLoad` (873) counts the stuck handed patients, so they block further handovers.
  - `src/ui.js` `nextStep` has no state for "on your list". Neither Orientation nor How to play mentions it: `grep -i "your list" src/ui.js` finds nothing.
- **What happens:**
  - **No notice.** On the floor plan (the default) a handed ESI 1 shows the same stethoscope as any patient without a provider. No toast fires, and the provider rail reads "You · Free". The only notice is a log line on the list board.
  - **No deterioration.** Handed patients never deteriorate (F-134). A handed STEMI stays at HR 99 to 109, BP 143 to 148, for 11 hours. An anaphylaxis sits at SpO2 94 and BP 84/52 from 10:48 to 19:00.
  - **Capped penalty.** Stuck patients fill `MD_LOAD` (2 on Manic Monday, 4 on Full Moon Friday), so the charge nurse stops handing over. Ignoring them costs at most 2 × 25 or 4 × 25, once.
  - **Ignoring costs nothing.** For a 70%-accurate attending over 8 seeds:

    | Full Moon Friday | Stars | Patients handed |
    |---|---|---|
    | Ignores handed patients | 2.13 | 2.6 (all left unseen) |
    | Sees them | 2.25 | 22.9 |

    On Manic Monday, ignoring them scored better: 2.5 stars against 2.38.

  So "the attending's load grows with the level" does not reach a player who ignores the list. It only reaches the one who does the right thing.
- **Reproduction:**
  - `python3 pw3.py` (844x390): Resus 1 is handed at 07:01. The floor-plan text has no "on your list", and no toast fires.
  - `node handed.js` shows the vitals at handover and at 19:00.
  - `node ign.js` compares ignoring and seeing.
- **Fix:**
  - Toast the handover, and give a distinct "On your list · waiting N min" state and icon in `nextStep`.
  - Make the penalty per time: for example `care(-0.5)` a minute after 15 minutes, with legal risk rising.
  - Make unseen ESI 1-2 patients deteriorate on the same clock as a waiting ESI 2 (F-134).
  - Exclude handed-unseen patients from `mdLoad`, or reassign them after 30 minutes with the penalty kept.
  - Teach the rule in attending Orientation chapter 1.
- **Effort:** 2 to 3 hours.

### R5.13-05 High: the attending's Rush has no pace cap, so idling, radio-only play or never diagnosing earns 2 to 3 stars in 75 seconds at 4×
- **Location:** `paced = () => G.level === 'rush' && G.mode !== 'md'`.
- **What happens:** the cap that fixed "tapping through the Rush earned three stars" for the charge nurse was not applied to the attending:
  - Idle attending: 2 stars on every seed.
  - Radio-only: 2 to 3 stars.
  - Never diagnosing: 3 stars.
  - An honest 70% attending: 2 to 2.5 stars.

  The Diagnoses part rests on 1 to 3 calls. One wrong call makes it 0% or 50% and moves a whole quarter of the grade, so honest play is a coin flip while idling is steady.
- **Reproduction:** `node h.js rush idle_md 3`, `node x.js rush radioOnly 2`, `node x.js rush noDx 2`.
- **Fix:** cap the attending's Rush stars by their own throughput, for example their door-to-doctor time for their own and handed patients, or patients dispositioned. Let a part based on fewer than 3 items weigh less.
- **Effort:** 1 to 2 hours.

### R5.13-06 Medium: the stars and the score disagree, so the instructor's list shows a higher score with fewer stars
- **Location:** `baseStars` (the mean of per-part stars) against `avgScore` (the mean of the parts) in `src/engine.js`. The report's score cards, and `cbWhat` in ui.js, which sends "score N/100 · ★★☆".
- **What happens:**
  - The idle Quiet Tuesday attending scores 67 with 2 stars. On the game's own scale, 67 is 1 star (`scoreStars`: 55 to 69).
  - A 70% Manic Monday attending (`slowdoc` seed 3) scores 68 with 1 star.
  - A student comparing results, or an instructor reading Class results, sees 67 ★★ above 68 ★.
- **Reproduction:** `node h.js easy idle_md 3` (avg 67, stars 2) and `node h.js med slowdoc 3` (avg 68, stars 1).
- **Fix:** derive the stars from the averaged score, `scoreStars(avgScore())`, or send and show per-part stars instead of an average.
- **Effort:** 15 minutes plus golden.

### R5.13-07 Medium: the career rank rewards grinding, not skill, and the Rush earns about 3 times faster
- **Location:** `careerAdd` and `RANK_AT` in `src/ui.js` (about 3270 to 3295).
- **What happens:**
  - Points are stars × 2 (× 1 in the Rush), with no level weighting.
  - A Rush lasts about 75 s at 4× against 7.5 min for a full shift. That is about 2.4 points per real minute in the Rush against 0.8 on a full shift.
  - Quiet Tuesday 3 stars pays the same as Full Moon Friday 3 stars.
  - With R5.13-02 and R5.13-05, an attending reaches Department chair (120 points) without seeing a patient: about 60 idle Rushes, 75 minutes at 4×.
  - The rank never falls, so it measures time spent, not ability.
- **Fix:** weight by level (easy ×1, med ×2, hard ×3), give the Rush points per real minute in line with a full shift, and give no points to a shift with no patients seen. Consider "best 10 shifts" instead of a lifetime sum.
- **Effort:** 30 minutes.

### R5.13-08 Medium: one mistake is charged three times, and when it happens decides whether it counts
- **Location:**
  - `scoreDx`: a wrong diagnosis costs `care(-8/-20)` in Clinical, a miss in the Diagnoses part, and `litAdd(2/5)` in Legal.
  - `mdDecide('home')` when the patient needed admission: `care(-25)` and `litAdd(5/10)`.
  - The legal decay in `litCheck`.
- **What happens:**
  - A missed must-not-miss diagnosis sent home moves three of the four parts: about -45 Clinical, the Dx percentage, and +15 legal.
  - Legal decays by up to 36 points over a shift. An early mistake is mostly forgiven by 19:00; the same mistake at 18:30 counts in full.
  - Together with R5.13-02, this pushes the engaged player under the idle one.
- **Fix:** let each error land in one part: Diagnoses for the call, Clinical for orders and disposition. Make Legal the peak risk of the shift, and keep it as the firing mechanic rather than a graded part.
- **Effort:** 1 to 2 hours plus golden.

### R5.13-09 Medium: the attending's report gives wrong reasons
- **Location:** `verdictOf` and `scoreCardsHTML` in `src/ui.js` (about 3151 and 3225 to 3232); `SC_TAGS.clinical` includes `'box'`.
- **What happens:** on the idle Quiet Tuesday report (`shots/easy-md-idle.txt`):
  - "You saw no patients this shift: the stars come from the radio calls and the department the computer ran." Radio was 0%, and the department is labelled "not your grade". The stars actually came from Clinical 100% and Legal 100% for doing nothing.
  - The Clinical card reads "100% ★★★ · Your own patients · Hurt most: The Box", but radio calls no longer count in Clinical (QA5-3).
  - "Clinical accuracy 100%" (a different formula, `accuracy()`) appears beside "Clinical 100%". On Manic Monday they differ: 83% against 76%. Two "clinical" numbers with different meanings sit next to each other.
- **Fix:**
  - For a shift with no patients seen: "You saw no patients. Clinical and Legal start full and only fall: seeing patients is the job."
  - Drop `box` and `boxn` from the attending's Clinical "Hurt most".
  - Rename "Clinical accuracy" to "Order and diagnosis accuracy", or remove it.
- **Effort:** 30 minutes.

### R5.13-10 Medium: with the instant verdict gone, a wrong diagnosis teaches only a label
- **Location:** `scoreDx` pushes `{name, said, dx, must}`; "Diagnoses to review" in `litHTML`.
- **What happens:** in a shift, a wrong call now gets no feedback until the patient leaves (by design). At the end the student reads "Carmen A.: you called Inferior MI. It was Cholecystitis." and nothing else: no finding that separated the two, and no `DX_PLAIN` gloss. The orders review has reasons; the diagnosis review, the core skill of Phase 6, has none.
- **Fix:** add one line per miss: the key result or exam finding (from `RES`, `EXAM` or `pearl`) and `DX_PLAIN[dx]`. For example: "RUQ ultrasound: wall thickening and pericholecystic fluid. That's an infected gallbladder, not a heart attack."
- **Effort:** 1 to 2 hours, plus R6 review of the lines.

### R5.13-11 Medium: the case mix isn't credible, and it is the same on every level (F-143, which QA rated Low)
- **Location:** case weights and arrival setup in `src/engine.js`.
- **What happens:** over 4 shifts per level:

  | Level | ESI 1 | ESI 2 | ESI 3 | ESI 4 to 5 |
  |---|---|---|---|---|
  | Quiet Tuesday | 12% | 31% | 35% | 21% |
  | Manic Monday | 14% | 31% | 35% | 20% |
  | Full Moon Friday | 15% | 30% | 37% | 19% |
  | Rush | 15% | 28% | 32% | 24% |

  Real EDs see about 1 to 2% ESI 1. "Quiet Tuesday" differs only in volume, so levels don't feel different in kind. One resuscitation in eight arrivals will read as fantasy to working charge nurses and attendings.
- **Reproduction:** `node esi.js`.
- **Fix:** scale the ESI 1 weight down (to about 3 to 5% for teaching density) and let `sickMax` and the alert rate shape the mix per level.
- **Effort:** 1 hour plus golden and stress.

### R5.13-12 Low: the Rush pace rule is explained only after the Rush, with no readout during it, and it swings with the seed
- **Location:** the `R.pace` hint shows only in `scoreCardsHTML`. The Rush blurb ("Two packed hours…") doesn't mention pace, and there is no HUD readout of `avgWait`.
- **What happens:**
  - The charge nurse learns the cap after it has cost them.
  - The same play style (`real`) lands anywhere from 13 to 42 minutes of pace on different seeds, so 0 to 3 stars.
  - Divert can't game it (checked with `div.js`); fine.
- **Fix:** add "Stars capped by door-to-provider pace: 15/25/40 min" to the Rush card and the first-shift card, and a live pace pill in the Rush.
- **Effort:** 30 minutes.

### R5.13-13 Low: levels barely change the attending's game
- **Location:** `MD_LOAD`, `MD_HOLD`.
- **What happens:**
  - 80%-accurate attending: 2.75 / 2.5 / 2.25 stars on easy / med / hard.
  - 70%-accurate attending: 1.75 / 1.5 / 1.5.
  - Quiet Tuesday has `MD_LOAD 0`, so the attending can legally see no one (R5.13-02).
  - Full Moon Friday hands about 23 patients to an attending who sees them, and 2.6 to one who doesn't (R5.13-04). The level's difficulty is opt-in.
- **Fix:** follows from R5.13-02 and R5.13-04: an expected-load denominator per level.
- **Effort:** included above.

### R5.13-14 Low: some partial answer signals are left
- **Location:** `consult`; the HUD pills.
- **What happens:**
  - A wrong service answers "Not ours." at once, and the player can try again. Cycling services, at -10 each, reveals the disposition and so the family of the diagnosis.
  - The Clinical and Legal pills jump by 8 and 2 to 5 at each discharge, so a player watching them learns each call's verdict mid-shift. That may be acceptable ("how they do will tell"), but it is not "at the end", which is what Orientation line 1847 promises.
- **Fix:** after the first refusal on a shift, make further wrong services cost legal risk. Reword Orientation to "shows as each patient leaves".
- **Effort:** 20 minutes.

### R5.13-15 Nitpick: the attending autopilot never sees handed patients, so the sim, stress and golden figures miscalibrate the grade
- **Location:** `mdPlay` (4708) only picks up `!p.prov` patients. A handed patient has `prov === me`.
- **What happens:** every handed patient ends unseen in `test/sim.js` attending profiles. `node load.js` before the patch shows "handed 2.5, unseen 2.5". Any tuning done with the bot sees the unseen penalty as unavoidable.
- **Fix:** in `mdPlay`, `assign(G.me, p.id)` for `p.handed && !p.mine && p.prov === G.me && p.ev === 'none'`.
- **Effort:** 5 minutes plus golden.

### R5.13-16 Nitpick: leftover numbers and text on the attending's report
- "Where your points came from · The Box -390" (`G.care`) and `STARS_MD` remain. That is a fifth number the attending isn't graded on.
- The verdict prefix "N patients died in the department" sits on a report whose department is "not your grade".
- `src/ui.js` 2231 says "for an attending the score mostly measures the department the computer runs". That is stale since Phase 6.
- The HUD's "Dx called" pill is a bare count with no meaning as a score.
- The "Radio log" heading holds every message, not only radio.
- **Effort:** 20 minutes.

### Known issues accepted by the owner (F-134 to F-144), as I rate them
| Item | My rating | Where |
|---|---|---|
| F-134 (unseen patients don't deteriorate) | **High** | Part of R5.13-04 |
| F-143 (case mix) | **Medium** | R5.13-11 |
| F-140 (needed-work tags on a non-own alert patient) | Low | A minor hint; R5.13-01 is far worse |
| F-139, F-135, F-137, F-141, F-142, F-144, F-136, F-138 | Not re-verified | Outside my game-design remit (UI, initials, HEART text); R4, R3 and R6 cover them |
