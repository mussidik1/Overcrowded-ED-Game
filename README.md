# Overcrowded: an ED shift survival game

A 32-bed emergency department, 07:00 to 19:00. Patients come in by ambulance and through the front door, the radio keeps ringing, and an administrator just walked in. Pick your role on the title screen:

- **Charge nurse.** You run the board: registration, triage, beds, providers, EVS, consults, and getting patients upstairs or out the door.
- **Attending.** The charge nurse runs the board. You see patients, write the orders, make the disposition call, and give EMS medical direction on the radio.

**Play it:** https://mussidik1.github.io/Overcrowded-ED-Game/

## The floor plan

The department is drawn from above: a bed in every room, chairs in the waiting room and the results area, a nurses' station, a break room, and the ambulance bay outside. Everyone on shift is a person on the floor. Nurses stand by their pods, providers sit at the station, techs, EVS, and transport go where the work is, and staff on break sit in the break room. EMS crews hold the wall with their patients until a nurse takes report. When the wall is full, the next ambulances back up in the driveway, each with its wait time.

**It fits a phone held sideways.** The whole department is on screen at once, with no dragging. Scores run along a slim strip on top, registrars and the triage nurse sit on a rail at the left, and providers sit on a rail at the right. Each room shows one icon for what it needs: a blue stethoscope for "needs a provider," a phone for "call a consult," a broom for a dirty room. Filled, pulsing icons need you. Gray ones are waiting on someone else. Pinch (or use the + button) to zoom in and the icons turn into words, with name tags on the staff. Zoomed out, tap the waiting room, the line at the door, or the wall to pick a person from a list: tap the row to give them a bed, or Card to read their card. Zoomed in, a room's words wrap onto a second line before they are ever cut off.

**Every patient has a name tag.** Each occupied room shows the patient's name on a dark tag, at both zoom levels, drawn above the staff so a nurse at the bedside never hides it. The same tag is on the wall, in the waiting-room list, and on the list board. When a message says "Kwame E. is crashing," you can find Kwame.

**Taps forgive a sliding thumb.** A real fingertip moves during a tap. The floor takes a tap that slides up to 16 px, or a quick one up to 30, and a thumb resting on the glass does not block the other hand.

**Messages stay off the floor.** On the floor plan a message rides in the top strip, over the scores, one at a time. It never covers a room, a patient card, or what the preceptor is pointing at. The strip stays one line on every phone, even with the Box ringing, and a patient card opens under it, so the clock, the scores, and the Box stay in view and in reach.

On a laptop the same floor shows the words all the time, with the staff in a dock along the bottom. The list board is still there if you want it: switch on the title screen or in the pause menu.

**People move.** Walk-ins come through the front door, stop at registration and triage, and take a seat. When you give someone a bed, they walk there, and ambulance patients roll in on the stretcher with their crew. Patients who go home walk out the front door, and admitted patients ride upstairs with transport. The light through the windows goes from morning to dusk over the shift.

**"Next."** A button counts everything that is waiting on you and names the most urgent one: a room that needs a provider or a consult call, a crew on the wall, the line at the door, the radio. Tap it (or press N) and it goes exactly there. Tap again for the next. When the Box rings it turns red and says so. A patient on the wall with two vital signs in red goes ahead of routine work. On a sideways phone it sits at the foot of the left rail, off the floor.

**Full screen and offline.** On Android, tap Full screen on the title screen or in the pause menu. On an iPhone, add the page to your Home Screen (Share, then Add to Home Screen) and open it from there. After the first visit the game is saved on the device, so it opens with no signal.

![The floor plan on a laptop: rooms, the wall, ambulances backed up outside, the station, the break room](docs/screenshots/floor-plan.png)

![The whole floor on a phone held sideways, with icons on the rooms](docs/screenshots/floor-plan-phone.png)

**New here? Start with Orientation.** Each role has its own. It lights up what to tap, holds the clock until you act, and fast-forwards through the waiting. Nothing counts against you. Skip it, and your first real shift opens with three lines to know, not the whole manual; How to play is one tap away.

**No medical background needed.** Orientation is written for someone who has never worked in a hospital, and it teaches the real game, not an easier one. Every short name is explained in plain words the first time it comes up: ESI, EMS, RN, PCT, EVS, the Box, MTP, ECG, CT, HEART score, boarding, divert, and the rest. It shows how to read a room and a patient card, including what each vital sign is and what a normal number looks like. A **Words** button on every preceptor card, in How to play, and in the pause menu opens the whole list: about a hundred terms in plain language.

- **Charge nurse (63 steps):** the screen and your five scores, a walk-in from registration to discharge, the Next button, an ambulance patient through report, consult, admission, and transport, a trauma alert with massive transfusion, routing a medical-direction call to a doctor, a chest-pain call, chairs, waiting-room rechecks, an interpreter, breaks, a decision card, an equipment outage, a transfer, and the words you will hear on a real shift.
- **Attending (34 steps):** reading a card and its vital signs, strep throat (see, order, discharge), DKA (treat what you find, admit to the ICU), appendicitis (a thin workup, the missing CT, call surgery), a medical-direction call on the radio, and a stroke alert from last known well to door to needle, with the pressure limit for the thrombolytic.

On a phone held sideways the preceptor's card sits beside an open patient card, not inside it, so what you are told to tap is always on screen.

![Orientation: the preceptor lights up the next tap](docs/screenshots/orientation.png)

![Intake, transport, and ambulance screens](docs/screenshots/intake-and-transport.png)

## Vitals that change

Every patient card shows heart rate, blood pressure, breathing rate, oxygen, and temperature, and they move. A sick patient who waits gets worse: the heart rate climbs, the pressure sags, and the card says "Getting worse" and why ("no bed yet," "no provider yet," "treatment not given yet"). The label is read off the numbers: it says worse or improving only when someone watching the monitor would see it. Abnormal numbers that are not moving read "Not improving." Anything out of range shows in red. Walk-ins have no vitals until triage takes them. Ambulance patients arrive with the crew's set.

Treatment turns it around, each on its own clock: naloxone and epinephrine work in minutes, fluids and blood take about twenty. Antibiotics stop the decline but take hours to move a heart rate or a fever, so they get no credit they have not earned.

The numbers follow the case, not just the acuity:

- Oxygen is low only when breathing is the problem. A stroke, a GI bleed, or DKA arrives with a normal sat.
- Oxygen is an order now. Pneumonia and septic shock need it, and for any low sat it is never a wrong order. For patients who are not the attending player's own, a nurse who has assessed a low sat still puts oxygen on, and the card says "on oxygen."
- No case arrives with vitals that contradict its triage level. (A test checks every case.)
- An overdose arrives drowsy after the crew's naloxone, and its breathing slows again as the field dose wears off.
- A head bleed's pressure climbs while the heart slows.
- A stroke's pressure stays where it came in until someone treats it. About four in ten strokes arrive over 185/110, the limit for the thrombolytic. Those need blood pressure control first: the nurse holds the drug until the pressure is down, and it stays under 180/105 afterwards. The thrombolytic itself does not lower the pressure.
- Septic shock stays low on fluids alone and comes up on a vasopressor. A complete heart block stays slow until it is paced.
- A crash looks like what is wrong. Asthma crashes as breathing failure with the pressure intact, a bleed goes pale and fast with a normal sat, sepsis goes hot and low, a heart attack goes into cardiogenic shock. The diagnosis changes with it ("Asthma attack with respiratory failure"), so does what the patient needs, and nobody who crashed is sent home. The five risk-score cases do not crash.
- A bleed nobody treats does not sit still: with no fluids and no blood it goes into shock at 75 minutes and arrests at two hours.
- The ECG line reads the rate on the monitor: a heart rate of 127 is "Sinus tachycardia, rate 127," not normal sinus rhythm.
- A child's numbers are scaled to a child's normals, and flagged against them.

![A patient card: heart rate, pressure, and breathing in red, and getting worse](docs/screenshots/vitals.png)

## For a class

- **Five-Minute Rush.** Two packed hours, 07:00 to 09:00, in about five minutes of play. It has its own stars.
- **Scenarios.** Pick one on the title screen and any shift gets a named problem early on: **CT down**, **Bus crash** (a multiple-casualty incident: EMS asks what you can take, then a red tag comes by radio, then a yellow, then four greens, each wearing its tag), **Boarding** (extra admitted patients, slow beds upstairs), or **Short-staffed** (two more call-outs). The game says so at the start, keeps a "Scenario" tag on the status strip, and names it in the pause menu and on the report. Scenario shifts do not count toward your bests.
- **Print the report.** The shift report has a "Print or save as PDF" button. On paper it is just the report, with the role, shift, scenario, date, and a line for a name.
- **The last report is kept.** Leave the report by accident and it is still there: "Last report" on the title screen brings it back, after a reload too. "Run it back" starts the same shift again in one tap.
- **Every student gets a different shift.** Arrivals and events are random, so scores are for discussion, not for ranking students against each other.
- **Sound.** Monitors beep, the radio squelches when the Box opens, and the big moments (alerts, codes, massive transfusion) go out as an overhead page. Turn it off on the title screen or in the pause menu.

## How a shift works: charge nurse

1. **Intake.** Walk-ins and EMS patients each need a quick registration and triage, and you direct both. At the front door registration comes first. On the wall the crew's report comes first: a nurse takes it without waiting for the registrar. Full registration happens later at the bedside. EMS crews wait on the wall until a nurse takes report. Walk-ins go to the waiting room after triage, where triage can miss: have a nurse recheck people who have waited, and walk the room to update them. Alerts and crashing patients can go straight to a bed.
2. **Beds.** Put triaged patients in rooms. ESI 1 goes to Resus, Fast Track opens at 09:00 and takes ESI 4 and 5, and airborne isolation needs Room 8 or 16. Rooms 19 and 20 are safe rooms. Six results-pending chairs free a bed for anyone a provider has already seen. Tap dirty rooms to send EVS.
3. **Providers.** Assign attendings, PAs, and NPs. PAs and NPs take ESI 2 to 5, with an attending co-sign on ESI 2. Intubations need an attending and an RT. A provider with a long line starts missing things. Station a provider in triage to work the waiting room.
4. **The Box.** EMS calls come in two kinds. Alert reports are notifications: take the report so the team is ready. Medical direction needs a doctor: tap Find a doctor, pick an attending who isn't in a code, and they give the medic orders.
5. **Workup and treatment.** Techs draw labs and do ECGs, pharmacy verifies meds, respiratory therapy runs breathing treatments and vents, and the blood bank runs massive transfusion. A stroke over 185/110 gets blood pressure control before the thrombolytic, septic shock gets a vasopressor, a head bleed on a blood thinner gets a reversal agent, and a complete heart block gets paced. Get interpreters for patients who need one.
6. **Disposition.** Discharge, consult and admit. Chest pain, fainting, and TIA patients come back with a risk score (HEART, Canadian Syncope Risk Score, ABCD2), and you make the home, observation, or admit call. Admitted patients wait for a bed upstairs, their nurse calls report, then you send them with a transporter or a tech; a hold nurse can take every admitted patient in the ED. Request transfers as soon as the diagnosis is clear, then book an ALS ambulance, critical care transport, or a helicopter; the patient holds the room until the crew arrives.

**When something breaks, divert for it.** The CT scanner, cath lab, trauma OR, lab, and power can go down mid-shift. Go on the matching status (CT Divert, STEMI Divert, Trauma Divert, or Internal Disaster) fast, and lift it when the fix is in. Yellow and Red Alert are for when the ED is full, but watch the neighbors: when three hospitals are on capacity alerts at once, the region suspends them all. The full-capacity protocol sends admitted patients to inpatient hallways when the ED is packed.

Along the way: nursing ratios (an active resuscitation takes a nurse and a half), a new grad who isn't ready for Resus, staff morale and breaks, call-outs and sick staff, angry consultants, admin demands, AMA, 72-hour returns, equipment downtime, and a multiple-casualty bus crash: EMS asks what you can take, and the patients arrive with red, yellow, and green field tags.

**Charge nurse scores:** average wait (door to provider), patient management, staff satisfaction, patients who left without being seen, and EMS wall time. The shift report at 19:00 gives you up to 3 stars, then walks you through your three worst moments and the decision behind each, the numbers an ED director answers for (door to provider, length of stay, boarding, LWBS and AMA rates, door to balloon), patient experience, and staffing hours.

![A gray-zone call, results-pending chairs, the capacity sheet, and the M&M](docs/screenshots/judgment-calls.png)

## How a shift works: attending

1. **Pick up patients.** Rooms marked Needs a provider are waiting for a doctor. Tap one, then See this patient. See the sickest first. Leave someone too long and another provider picks them up.
2. **Write orders.** After your exam, pick tests (ECG, labs, X-ray, CT, ultrasound) and treatment (medications, fluids, antibiotics, oxygen, breathing support, intubation, epinephrine, naloxone, insulin, a vasopressor, atropine and pacing, blood pressure control, a thrombolytic, a reversal agent, blood, massive transfusion, laceration repair), then sign. The card does not list a plan before your exam: working out the orders is the job. Order what they need and nothing extra. Extra tests cost time and points, a CT costs the most, and some treatments hurt people who don't need them.
3. **Close the gaps.** If the workup can't make the diagnosis, add what's missing. A patient who isn't improving needs a treatment you didn't order, and twenty minutes untreated goes on the M&M list. Read the vital signs. Order a thrombolytic for a stroke over 185/110 without blood pressure control, and the nurse holds the drug and you lose points until the pressure is treated. The card shows last known well and when the window closes.
4. **Make the call.** Discharge, call the right consultant to admit, or transfer. Chest pain, fainting, and TIA come with a risk score for home, observation, or admit. Sending a sick patient home is the worst call you can make.
5. **The radio.** When a medic needs medical direction, it rings for you. Answer, read the call, approve or deny. Alert reports go to the charge nurse.
6. **Alerts.** Your orders and your speed decide the time goals: ECG in 10, CT in 25, needle in 60, balloon in 90. Activate massive transfusion for a trauma that's bleeding out, even before they arrive.

The attending's score counts patients seen, clean order sets, right calls, time goals, and medical direction. Patients waiting on your orders or your decision cost you. The shift report lists your patients and your worst moments, not the nursing numbers.

![Attending: pick the role, write orders, make the call, answer the radio](docs/screenshots/attending.png)

A shift takes about 30 minutes at 1x, with 2x to 4x for quiet stretches. It saves on your device so you can come back to it.

![Title screen, sending a medical-direction call to a doctor, a patient card, and the shift report](docs/screenshots/title-box-report.png)

## Medical direction packs (attending)

- **General** (default): common online medical control questions, not tied to one state.
- **Maryland (MIEMSS):** written to the 2026 Maryland Medical Protocols for EMS (effective July 1, 2026). A teaching tool, not a protocol reference. Follow your current protocols.

## Development

The game ships as one self-contained `index.html`, with the engine, UI, styles, and fonts inlined. The source is in `src/`:

- `engine.js`: the simulation (no DOM)
- `ui.js`: the phone-first interface
- `map.js`: the floor plan (SVG), built into `ui.js`
- `style.css`, `index.template.html`

The build also writes `sw.js`, a small service worker that keeps a copy of the game for offline play. Its cache name carries the version and a hash of `index.html`, so every build replaces the old copy.

```sh
npm install      # fonts used by the build
npm run build    # writes index.html
npm test         # rule checks (six suites, 278 checks; rules4 covers the attending, rules5 vitals, the short shift, and scenarios, rules6 stroke care, the new orders, crashes, the untreated bleed, and the bus crash)
npm run sim      # simulated shifts at several player speeds
npm run stress   # 188 shifts across every level and scenario: checks for stuck states and out-of-range vitals
python3 test/ui_test.py      # taps through every system in headless Chrome (Playwright)
python3 test/md_ui_test.py   # the attending: see, order, decide, the radio, the report
python3 test/map_test.py     # the floor plan on a sideways phone (93 checks): fits without dragging, rails, icons, name tags, sliding taps, the wall list, messages in the top strip, zoom and wrapped words, ambulances backing up, vitals, the Next button, Words, scenarios, the printed and kept report
python3 test/finger_test.py  # Orientation the way a real finger plays it: people moving, real time, touches that slide 12 px. MODE=md for the attending
python3 test/offline_test.py # serves the folder, installs the service worker, cuts the network, and reloads
python3 test/train_test.py   # plays the charge nurse Orientation on the floor plan, tapping only what the preceptor lights up
MODE=md python3 test/train_test.py   # the same for the attending Orientation
VIEW=list python3 test/train_test.py # either Orientation on the list board
```

![The list board on a laptop](docs/screenshots/desktop.png)

## Credits

Set in [Cardo](https://fonts.google.com/specimen/Cardo) by David Perry (SIL Open Font License 1.1), via Fontsource.
