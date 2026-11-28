# 02 Spec: Emergency Department: Code Black (v0.33.0 candidate)

Retrofitted Nov 26, 2026, from `README.md` and `CLAUDE.md`. It described v0.32.0 as released for QA round 1; since round 2 it describes the **v0.33.0 candidate** (Phase 6 game design, the owner's decisions of Nov 26, 2026). Corrected after QA round 1 where the spec, not the game, was wrong: REQ-03 (the radio pack is on Play a shift by design) and REQ-14 (two lessons were always read-through). Each requirement (REQ) has acceptance
criteria (AC) an evaluator can check in the running game. "Phone" means about 390 x 844 upright and 844 x 390 sideways; "desktop" means
about 1280 x 800. A local copy has no password gate.

## Menu and first visit

**REQ-01 First visit.** A new visitor sees what the game is before the menu.
- AC1: The first visit opens on a welcome page: what the game is, who it is for, privacy, credits, and that it isn't clinical guidance.
- AC2: Start goes to the menu; later visits open on the menu; About on the menu reopens the page with a way back.

**REQ-02 Menu.** The menu offers a role (Charge nurse, Attending), Play a shift, Learn, Settings, How to play and About.
- AC1: Play a shift lists Five-Minute Rush, Quiet Tuesday, Manic Monday and Full Moon Friday, plus scenarios, weather and Class code.
- AC2: Learn lists Orientation for the chosen role and the Lessons.
- AC3: The chosen role is clear on the menu and carries into the shift.

**REQ-03 Settings.** Settings change the board view (floor plan or list), the 3D floor (on or off, with a detail level), sound, plain
words, and full screen where the browser allows it. Choices are remembered on the device. The radio-call pack is chosen on Play a
shift, for the attending only (radio calls are the attending's job).

## A shift

**REQ-04 Starting and running a shift.** A shift runs 07:00 to 19:00 (the Rush 07:00 to 09:00) on a game clock.
- AC1: The clock advances while play is running, at 1x to 4x, and stops while paused or while a decision card is open.
- AC2: Pause opens a menu with resume, settings and quit; quitting keeps a resumable save.
- AC3: The shift ends at the end time, or early if the staff walk out or the attending is fired, with an end-of-shift report.

**REQ-05 Patients arrive.** Walk-ins come through the front door and ambulances to the bay; alerts (stroke, STEMI, trauma, sepsis,
cardiac arrest and others) are announced first.
- AC1: Arrivals keep coming on every level; harder levels bring more and sicker patients.
- AC2: Each patient has a name, age, complaint and vital signs that change over time and respond to treatment.

**REQ-06 Charge nurse: the board.** The charge nurse registers and triages walk-ins (an ESI level 1 to 5), takes ambulance report,
places patients in rooms, assigns providers, sends EVS to clean rooms, calls consults, admits, transfers, discharges, and can divert.
- AC1: Every one of these is a player action; none happens on its own (EVS, provider assignment, registration, triage, transport, IFT,
  diversion and gray-zone dispositions all wait for the player).
- AC2: The Next button names the most urgent waiting task and goes to it.
- AC3: Decision cards (events, phone calls, an administrator) ask the player and change the scores by the answer.

**REQ-07 Attending: seeing patients.** The attending sees patients, writes orders from an order sheet (tests by name, drugs by class,
procedures), reads results, picks a diagnosis from a short list, and picks a disposition (home, a consult or admission, a transfer).
- AC1: Results come back after realistic delays and read as findings.
- AC2: The right orders on the first sheet score; extra orders cost; a drug that can hurt this patient now is flagged as harm with a reason
  that never names an undiagnosed condition.
- AC3: An incomplete workup leaves a gap that shows in the patient getting no better.
- AC4: Gray-zone patients (chest pain, syncope, TIA, pneumonia) show a validated risk score built from the patient's own parts, and
  the attending makes the call.
- AC5: On a regular shift the game gives no answers away: no list of missing orders, no instant right or wrong on a diagnosis (the card
  keeps the attending's call), a consultant who isn't the right one says so without naming the right one, and an incoming alert (named as EMS
  calls it) doesn't count as the diagnosis: the attending still works it up and names it. Orientation and Lessons still show all of these, as teaching.
- AC6: On Manic Monday, Full Moon Friday and the Rush the game's charge nurse puts some of the sickest patients on the attending's list,
  with a message; each waits for the attending (See this patient; no credit until then), gets worse after 45 minutes unseen, and goes to
  another doctor after an hour, counted as never seen.

**REQ-08 Attending: radio calls.** EMS medical-direction calls ring on the radio (the Box); the attending answers with a choice of
orders. Calls not answered ring out and count as missed. The charge nurse doesn't give medical direction.

**REQ-09 Cardiac arrest.** An arrest is run by the attending as a series of rhythm-check cards (ACLS for adults, PALS by weight for
children under 13), with a result. An arrest nobody runs for 20 minutes is a death and counts.

**REQ-10 Strokes.** A stroke patient shows last known well; most arrive inside the 4.5-hour thrombolytic window, some late, some woke
up with it, and some on a blood thinner. Tenecteplase is harm outside the window or on a blood thinner. Pressure over 185/110 must be
lowered before the drug.

**REQ-11 Scores and report.** Four scores run on screen during a shift. The end-of-shift report shows four scores with stars (0 to 3),
a verdict, the M&M (worst moments), and for the attending the orders, diagnoses and radio calls to review, with reasons.
- The charge nurse is graded on Patients, Clinical, Admin and Staff. The attending is graded on their own decisions: Clinical (own
  patients), Diagnoses called right, Radio calls answered right, and Legal (100 minus legal risk); the department's scores show as
  context. During a shift the attending's Diagnoses box shows how many were called, not how many were right. The attending's stars are capped by patients seen (a full shift 30, 24 and 18 for three, two and one stars; the Rush 5, 4 and 3); a diagnosis left uncalled counts as a miss.
- In the Five-Minute Rush, the charge nurse's stars are capped by pace: the average minutes from the door to a provider (15, 25 and 40
  for three, two and one stars), shown on the report.
- A career rank per role (charge nurse: New grad to Director of emergency nursing; attending: Intern to Department chair) grows with the
  stars earned (two points a star, one in the Rush), shows on the menu, and the report says what the shift added. Device only.
- AC1: Every report line follows from what happened in that shift.
- AC2: The best result per level is remembered on the device and shown on the menu.

**REQ-12 Saves and resume.** A shift in progress is saved on the device and offered as Resume on the menu after a reload. A class shift
saved on another game version can't resume, and the menu says why. A damaged save is never offered or is removed with a message. An
error during a shift stops it with a message, keeps the last good save, and offers Reload.

## Learning

**REQ-13 Orientation.** Each role has a scripted Orientation with a preceptor that lights up what to tap, holds the clock until the
player acts, and explains every term and abbreviation the first time.
- AC1: It can be finished start to end in both roles by following the prompts.
- AC2: It comes in chapters; a finished chapter is remembered and the next one is offered.

**REQ-14 Lessons.** Short lessons per condition: 9 played on a patient (radio calls, stroke, chest pain, sepsis, bleeding trauma, trouble
breathing, overdose, belly pain, falls), 2 read-through (cardiac arrest, fast heart rhythms), and a text lesson for each newer condition.
The Lessons screen says which are which. A finished lesson is marked done.

## Class codes and results

**REQ-15 Class code.** An instructor makes a code for a role, level, scenario and radio pack; it shows as six characters (ABC-DEF) with
Copy and Share, and an instructor key hidden until Show key. A student types the code and plays exactly the same shift.
- AC1: Mistyped codes are refused before Start (about 63 in 64); O reads as 0 and I or L as 1.
- AC2: A code from the previous game version is refused as stale; one from an older version is refused as mistyped (about 63 in 64).
- AC3: If the server can't be reached, the instructor is told so and may use the code without results.

**REQ-16 Sending a result.** At the end of a class shift a student may Send their summary with their initials only.
- AC1: The game sends initials only: 1 to 4 single letters with periods or spaces ("S.K.", "J S", "J.S.K.M."; up to three
  spaced groups), or 2 or 3 capitals typed together ("JS", "JSK"). Names, numbers, other
  forms and rude words spelled as initials are refused with a reason; a result can't be sent twice.
- AC2: A failure says whether it was the network, a timeout or the server.

**REQ-17 Class results.** With the code and key, the instructor reads the class's results (unranked), can delete one or all, and can copy
or download them as CSV.

**REQ-18 Password gate.** On the public site during testing, a password gate shows before the game; a device that passed once plays
offline. A local copy has no gate.

## Phone, offline and install

**REQ-19 Phone first.** Every screen works at phone size, upright and sideways, and on desktop: no sideways scrolling, readable text,
tap targets about 44 px, and the primary action obvious.

**REQ-20 Floor plan and list board.** The board is a floor plan (3D by default where WebGL works over http, flat otherwise) or a list.
Tapping a room or patient opens its card. Turning 3D off shows the flat map.

**REQ-21 Offline and install.** After one visit over http(s), the game loads and plays with no network (the service worker), installs to
the home screen, and a new version replaces the old one on a later load.

**REQ-22 Accessibility.** Controls work by keyboard; dialogs take and return focus; the board behind a menu or card can't be reached by
keyboard; Escape closes the pause menu; important state is not shown by colour alone. In a shift, the phone's back button closes what is
open or opens the pause menu.

## Safety and privacy

**REQ-23 Clinical notice.** The game says it is a teaching game, not clinical guidance, and that no licensed clinician has reviewed its
clinical content yet: on About, in Lessons, on the report, and on class results.

**REQ-24 No personal data.** Every patient is invented. The only personal data that leaves the device is a student's chosen
initials, sent with a result; they are not stored on the device; nothing personal is logged or cached.

## Architecture contracts (for the Code quality criterion)

- One self-contained `index.html` built from `src/`; `index.html`, `sw.js` and `3d/map3d.js` are build outputs that match the source.
- All game state is one JSON-safe object (`G`); the engine never calls `Math.random()`; arrivals and events draw from seeded streams so a
  class code gives every player the same patients.
- The UI talks to the engine only through `OC`; taps go through delegated `data-act` handlers; a Content Security Policy blocks inline
  handlers.
- Database access only through the `cb_` functions; the contract is `supabase/tests/client_call.json`.
