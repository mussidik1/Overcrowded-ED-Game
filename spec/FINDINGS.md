# Findings register

The spec pipeline was adopted at v0.31.0, after audit rounds 1 to 11 had already run (`docs/audit/`). This register carries the
v0.31.0 findings forward: every Critical, High and Medium finding from rounds 6 to 11, which reviewed v0.31.0, plus the risks
accepted for the release. Lows and nitpicks stay in each round's reports and STATUS. Earlier rounds (v0.30.0) are in
`docs/PRO_AUDIT.md` and `docs/audit/round2`–`round5`.

Statuses: Open, Fixed, Accepted-Risk (needs the owner's sign-off before release).

## Rounds 6 to 8 (summaries; details in `docs/audit/round6/STATUS.md` to `round8/STATUS.md`)

| ID | Stage | Sev | Finding | Status | Resolution |
|---|---|---|---|---|---|
| F-001 | Review r6 | High | The deploy would fail on its first run (R2.6-01, R3.6-01) | Fixed | Pages settings read again; build job |
| F-002 | Review r6 | High | Enter in the key box froze Class results (R4.6-01) | Fixed | the redraw keeps only the focused box |
| F-003 | Review r6 | Medium | A typed key left for the next person (R5.6-01) | Fixed | form cleared on reopen |
| F-004 | Review r6 | Medium | Rate limits split by time zone (R3.6-05) | Fixed | UTC everywhere (migration 2) |
| F-005 | Review r6 | Medium | An applied migration could be edited (R2.6-03) | Fixed | `applied.sha256` freeze |
| F-006 | Review r7 | High | The key box had no room to type (R4.7-01, R5.7-01) | Fixed | layout and test |
| F-007 | Review r7 | Medium | An ended class's code could be taken over (R1.7-08) | Fixed | codes held 30 days (migration 2) |
| F-008 | Review r7 | Medium | The attending's own dead not counted (R1.7-01, R6.7-01) | Fixed | engine end-of-shift count |
| F-009 | Review r8 | High | The other-device form wider than its card on phones (R4.8-01) | Fixed | grid rule; class_test |
| F-010 | Review r8 | Medium | A stale draft of the migration could pass the deploy (R1.8-01) | Fixed | `codeblack.fingerprint()` |
| F-011 | Review r8 | Medium | Results could go to whoever registers a code first (R3.8-01) | Fixed | fallback only when unreachable or full |
| F-012 | Review r8 | Medium | Deaths and unrun arrests missed at the end (R6.8-01, R5.8-03) | Fixed | engine |

## Round 9 (`docs/audit/round9/STATUS.md`)

| ID | Stage | Sev | Finding | Status | Resolution |
|---|---|---|---|---|---|
| F-013 | Review r9 | High | Required drugs filed as "Also reasonable" (R6.9-01) | Fixed | `partOk`; rules10 check |
| F-014 | Review r9 | Medium | Unrun-arrest penalty ignored age and firing (R6.9-02, R5.9-02) | Fixed | 5-minute rule; no reasons after firing |
| F-015 | Review r9 | Medium | A lost code read as the student's failure (R6.9-03) | Fixed | `codeLost` (refined in F-031) |
| F-016 | Review r9 | Medium | A contraindicated set scored "clean" (R1.9-01) | Fixed | engine; rules13 |
| F-017 | Review r9 | Medium | The fingerprint couldn't say what differed (R1.9-02) | Fixed | `fingerprint_parts()` |
| F-018 | Review r9 | Medium | Held codes had no cap or monitor (R3.9-01) | Fixed | cap (refined in F-029), `held` in health |
| F-019 | Review r9 | Medium | Orders to review hid unsafe drugs past 12 (R4.9-01) | Fixed | unsafe first, never cut |
| F-020 | Review r9 | Medium | The shown key didn't fit at 390 and 360 (R4.9-02) | Fixed | layout; class_test |
| F-021 | Review r9 | Medium | Class sheet failed keyboard users (R4.9-03) | Fixed | focus, name, Tab trap |
| F-022 | Review r9 | Medium | A planned code stopped at 14 days (R5.9-01) | Fixed | revival by first result |

## Round 10 (`docs/audit/round10/STATUS.md`)

| ID | Stage | Sev | Finding | Status | Resolution |
|---|---|---|---|---|---|
| F-023 | Review r10 | High | Every lost code labelled as run well (R6.10-01) | Fixed | refined again in F-031 |
| F-024 | Review r10 | Medium | An arrival in arrest escaped the end penalty (R1.10-02) | Fixed | clock from the door |
| F-025 | Review r10 | Medium | The cap released real classes' codes (R1.10-01, R3.10-01) | Fixed | superseded by F-029 |
| F-026 | Review r10 | Medium | The fingerprint would change on PostgreSQL 18 (R1.10-03) | Fixed | NOT NULL rows left out |
| F-027 | Review r10 | Medium | Planned-code date blank; unused class marked ended; Refresh dropped the copy; focus to the wrong row; iOS zoom; outage gave no code (R4.10-01..05, R5.10-01..04, R3.10-03) | Fixed | UI |

## Round 11, the release review (`docs/audit/round11/STATUS.md`)

| ID | Stage | Sev | Finding | Status | Resolution |
|---|---|---|---|---|---|
| F-028 | Review r11 | High | A late hand-off erased an unrun arrest (R6.11-01) | Fixed | blame for any late code on an own patient |
| F-029 | Review r11 | Medium | A flood made before a planned code could free and take it (R1.11-01, R2.11-01, R3.11-01) | Fixed | migration 3: no early release; `full` past 30,000 held |
| F-030 | Review r11 | Medium | The fingerprint ignored spaces inside strings (R1.11-02) | Fixed | migration 3: exact bodies; live `clean_name` checked exact |
| F-031 | Review r11 | Medium | "By the book" given to codes the student didn't run; 3 minutes too short (R6.11-03, R5.11-01) | Fixed | own code only, within 5 min; `handed` counted apart |
| F-032 | Review r11 | Medium | An old arrest started in the last seconds escaped (R6.11-02) | Fixed | `codeLate` |
| F-033 | Review r11 | Medium | Focus fell to the page after a delete answered (R4.11-01) | Fixed | focus to the heading |

## Accepted risks for v0.31.0 (need the owner's sign-off)

| ID | Sev | Risk | Status | Why |
|---|---|---|---|---|
| F-034 | High | No licensed clinician has reviewed the clinical content (R6, every round) | Partly (Nov 25: a licensed clinician answered three open questions, relayed by the owner; the owner decided the rest as clinical consultant; no full review, so the in-game notice stays; answers in `docs/audit/verification.md`) | Owner: "Clinician will look later". The game says so in About, the Lessons and the results list. The gate keeps it to testers. |
| F-035 | Medium | "Use it without results" when the service is full: whoever registers that code later gets what students send (R3.9-02) | Accepted-Risk (owner, Nov 25, 2026) | The off text tells the instructor to ask students not to Send. The robust fix (a results-off code) is for a later release. |
| F-036 | Medium (treat as High) | The WebKit (Safari engine) UI tests haven't run on v0.31.0, and their last result (v0.30.0, `815e279`) is red: `map3d_test` failed the ambulance-reverse check | Accepted-Risk (owner, Nov 25, 2026) | They run on the merge into `main` (report only); the phone check covers iOS by hand. Or run the job by hand on `3d` first (macOS minutes). |
| F-037 | Low | Validation before limits holds only for malformed calls (R3.9-06.2) | Accepted-Risk | A well-formed fake code still spends a network's code limit; the limits are per network. |
| F-038 | Low | Lows and nitpicks in the round 9–11 reports | Accepted-Risk | None is a correctness or privacy failure; queued for the next pass. |

## Stage 16 drift check (Nov 25, 2026)

| ID | Stage | Sev | Finding | Status | Resolution |
|---|---|---|---|---|---|
| F-039 | 16 | High | supabase/README said a send to a dead or wrong-version code is refused before it counts; only malformed calls are | Fixed | text corrected |
| F-040 | 16 | Medium | Rollback text: v0.30.0's deploy has no database check and no skip_db_check | Fixed | RELEASE.md and CLAUDE.md corrected |
| F-041 | 16 | Medium | The device dropped a key at 60 days while a class started again on day 44 lives to day 74 | Fixed | key kept 74 days |
| F-042 | 16 | Medium | A late code still running at the end cost no points, though the notes said so | Fixed | care -20 added |
| F-043 | 16 | Low | "left in cardiac arrest" sent counts only unrun arrests of 5+ min | Fixed | wording says so in the Send box, About and README |
| F-044 | 16 | Low | A code at exactly 5 minutes counted in time when lost but late at the end | Fixed | late is > 5 min |
| F-045 | 16 | Low | The sheet's close button was 38 px | Fixed | 44 px |
| F-046 | 16 | Low | The Send box didn't name role and shift | Fixed | added |
| F-047 | 16 | Low | The wrong-key message left out the restart; RELEASE named a stale commit | Fixed | text corrected |

## Stage 15a round 1 (Nov 26, 2026, v0.32.0; `spec/QA-REPORT.md`)

| ID | Stage | Sev | Finding | Status | Resolution |
|---|---|---|---|---|---|
| F-048 | 15a | Medium | QA-1: Gate card is 420 px wide: Play and the title are off-screen on every phone (index.html .gate-card) | Fixed (to be confirmed by QA) | gate card in a fixed track; gate_test checks 320, 360, 390 |
| F-049 | 15a | Medium | QA-2: Privacy: a full name ("John Smith") passes validation and is sent with a result | Fixed (to be confirmed by QA) | owner: one first name, initials, or first name + initial; class_test |
| F-050 | 15a | Medium | QA-3: Cardiac arrest and fast-heart-rhythm lessons are text only, though REQ-14 lists them as played | Fixed (to be confirmed by QA) | the Lessons screen and spec REQ-14 say 9 played, 2 read-through (spec error) |
| F-051 | 15a | Medium | QA-4: A malformed but parseable save is offered as Resume and leaves a dead board throwing every frame | Fixed (to be confirmed by QA) | saveShape() before Resume; crash_test |
| F-052 | 15a | Medium | QA-5: Accessibility: modals don't take focus; the hidden board behind the menu and modals is reachable by keyboard | Fixed in part (to be confirmed by QA) | the board is inert behind menus, reports and cards; an opening card takes the focus |
| F-053 | 15a | Low | QA-6: Escape doesn't close the pause menu | Fixed (to be confirmed by QA) | Escape closes pause; crash_test |
| F-054 | 15a | Medium | QA-7: Clinical notice incomplete: Lessons and class results carry only the no-clinician half; Orientation has neither | Fixed (to be confirmed by QA) | teaching-game notice on Learn, Lessons, the Orientation row and class results |
| F-055 | 15a | Low | QA-8: "Sign with no orders" is enabled but always refused, and the refusal hints that something is needed | Open | refusing an empty first sheet is the existing design; older rule tests rely on it. Kept as a Low |
| F-056 | 15a | Low | QA-9: Code-card reason names bleeding for tenecteplase in a DKA arrest (the patient is dry, not bleeding) | Fixed (to be confirmed by QA) | own reason for the dry (hypovolaemic) arrest card |
| F-057 | 15a | Medium | QA-10: Tenecteplase with no indication isn't flagged as harm at signing; the report says "Unsafe orders 1" without naming it; insulin before the potassium gets no comment | Fixed (to be confirmed by QA) | an unneeded risky treatment is named at signing and in the review; rules15 |
| F-058 | 15a | Low | QA-11: The radio-call pack isn't in Settings, only on Play a shift for the attending | Fixed (spec error) | the radio pack is on Play a shift by design; spec REQ-03 corrected |
| F-059 | 15a | Medium | QA-12: Text under 12 px carries state and tap targets are under 44 px during a shift | Fixed in part (to be confirmed by QA) | no text under 12 px; menus, list board, coach buttons, rail chips, Next, Team, Beds, zoom and (owner, Nov 26) the sideways top strip are 44 px; upright score pills are narrower than 44 px |
| F-060 | 15a | Low | QA-13: A code pasted with spaces is cut off by maxlength=9 and refused | Fixed (to be confirmed by QA) | code box takes 20 characters; readCode drops spaces |
| F-061 | 15a | Low | QA-14: With results off, text refers to Show key and Copy key buttons that aren't shown | Fixed (to be confirmed by QA) | wording |
| F-062 | 15a | Low | QA-15: The arrival toast covers the "tap a green room" placement prompt | Open |  |
| F-063 | 15a | Low | QA-16: Upright list board: waiting-room card text clipped, a pill overlaps R1, the opening toast covers the clock | Open |  |
| F-064 | 15a | Low | QA-17: Browser or Android back mid-shift leaves the app instead of closing the open sheet (save kept) | Fixed (to be confirmed by QA) | back button closes the open sheet or opens pause; crash_test |
| F-065 | 15a | Low | QA-18: A double tap on a level's Start passes through and opens a patient card on the new board | Fixed (to be confirmed by QA) | taps on the board are ignored for 0.6 s after Start |
| F-066 | 15a | Low | QA-19: Profanity is accepted as a student name and would show on the instructor's list | Fixed (to be confirmed by QA) | owner: a small profanity check in the game; class_test |
| F-067 | 15a | Low | QA-20: The patient card's Complaint field is empty after an arrest | Fixed (to be confirmed by QA) | an arrest never leaves the complaint blank |
| F-068 | 15a | Low | QA-21: "without iv fluids" in the M&M: IV should be capitalised | Fixed (to be confirmed by QA) | abbreviations kept in sentences (IV fluids) |
| F-069 | 15a | Low | QA-22: 3D files are cached only after a shift is played online (first-visit offline gets the flat map) | Open |  |

## Stage 15a round 2 (Nov 27, 2026, v0.33.0 candidate; `spec/QA-REPORT.md`)

| ID | Stage | Sev | Finding | Status | Resolution |
|---|---|---|---|---|---|
| F-070 | 15a | High | QA2-1: A regular attending shift gives the diagnosis away: the decision heading reads "Your call · <true diagnosis>" under the attending's wrong pick, and Accuracy and Legal change at the pick | Fixed (to be confirmed by QA) | the heading shows the attending's own call; the diagnosis scores when the patient leaves or the shift ends; live accuracy and the workup line wait for the report |
| F-071 | 15a | Medium | QA2-2: On a shift, the second-consult refusal and the phone-admit refusal name the right service or disposition; "I don't think they need us" hints none is needed | Fixed (to be confirmed by QA) | second-consult, phone-admit and no-consult refusals name nothing on a shift |
| F-072 | 15a | Medium | QA2-3: The syncope risk score is a random number with no parts; diagnosis labels ("Syncope, high risk", "Chest pain, low risk") name the risk band before the call | Fixed (to be confirmed by QA) | Canadian Syncope Risk Score built from listed parts; diagnoses renamed "Syncope" and "Chest pain" (owner) |
| F-073 | 15a | Medium | QA2-4: Keyboard: map rooms can't take focus; the patient card doesn't take focus; focus isn't returned after a dialog; Tab leaves dialogs; focus lost on menu change | Fixed (to be confirmed by QA) | map rooms focusable (Enter/Space); a keyboard-opened sheet takes focus; focus returns on close; Tab stays inside a card; focus follows menu changes |
| F-074 | 15a | Medium | QA2-5: The Lessons list doesn't mark which lessons are played, read-through or case cards | Fixed (to be confirmed by QA) | each lesson labelled On a patient, Read-through or Case cards |
| F-075 | 15a | Low | QA2-6: Floating waiting and Next buttons cover room labels and (attending) score pills on the phone list board | Fixed (to be confirmed by QA) | the floating counter stays below the scores; the list board leaves room for it |
| F-076 | 15a | Low | QA2-7: Small targets and text: sideways map tokens 14-21 px, play-menu chips 36 px, list jump chips 32 px, desktop map text 8.6-11 px | Open |  |
| F-077 | 15a | Low | QA2-8: Stacked arrival toasts cover the wall, door and waiting area on the sideways map | Fixed (to be confirmed by QA) | arrival cards show one at a time, in turn, on a sideways phone |
| F-078 | 15a | Low | QA2-9: With results off, the saved-code row points to Show key and Copy key buttons that aren't there | Fixed (to be confirmed by QA) | the key text shows only when the key buttons do |
| F-079 | 15a | Low | QA2-10: The attending's Radio pill reads 0% before any call (should read a dash) | Open |  |
| F-080 | 15a | Low | QA2-11: The served build says v0.32.0; the spec says v0.33.0 candidate | Fixed (to be confirmed by QA) | version 0.33.0 |
| F-081 | 15a | Low | QA2-12: The gate password is stored in plain text (informational; the owner chose not to harden the gate) | Accepted (owner, gate) |  |

## Stage 15a round 3 (Nov 27, 2026, v0.33.0 candidate; `spec/QA-REPORT.md`)

| ID | Stage | Sev | Finding | Status | Resolution |
|---|---|---|---|---|---|
| F-082 | 15a | Medium | QA3-1: Harm reasons name an undiagnosed condition: PE tenecteplase ("a stable clot") and overdose lorazepam ("on top of an overdose") | Fixed (to be confirmed by QA) | PE tenecteplase, overdose lorazepam and stroke blood-thinner reasons reworded; rules12 checks more condition words |
| F-083 | 15a | Medium | QA3-2: The hemorrhagic-shock toast ("in hemorrhagic shock. Activate the massive transfusion protocol!") gives the attending the answer on a shift | Fixed (to be confirmed by QA) | the attending hears the signs (falling pressure, racing heart, pale and sweaty); rules15 |
| F-084 | 15a | Medium | QA3-3: Tab leaves an open patient sheet for the top bar and the board | Fixed (to be confirmed by QA) | Tab stays inside an open patient sheet (and the preceptor card beside it); crash_test |
| F-085 | 15a | Medium | QA3-4: Closing the pause menu (Escape or Resume) leaves focus on the page body | Fixed (to be confirmed by QA) | closing pause returns the focus to the Menu button; crash_test |
| F-086 | 15a | Low | QA3-5: The attending's M&M lists unassigned patients' events | Fixed (to be confirmed by QA) | the attending M&M counts only own patients for hemorrhagic shock |
| F-087 | 15a | Low | QA3-6: "0 orders signed" when the only order is an unsafe drug | Fixed (to be confirmed by QA) | the signed count includes every drug on the sheet |
| F-088 | 15a | Low | QA3-7: The radio medical-direction question and result cards carry no teaching-game notice (keeps Clinical safety at 9) | Fixed (to be confirmed by QA) | the teaching-game notice on the radio question and result cards |
| F-089 | 15a | Low | QA3-8: Scenario and weather chips 36 px; list jump chips 32 px at 360 px; 11-12 px text in two places | Open |  |
| F-090 | 15a | Low | QA3-9: The phone back button leaves the game from the menus (outside a shift) | Fixed (to be confirmed by QA) | Back on the menus returns to the main menu first |
| F-091 | 15a | Low | QA3-10: "Dr. Who" passes the name rule (title read as initials); the three-word message's example is refused | Fixed (to be confirmed by QA) | initials are single letters ("S.", "J.D.", "JS"), so "Dr." is not; the message example is "Ana M."; class_test |
| F-092 | 15a | Low | QA3-11: The gate stores the password in plain text and opens offline on any stored value (owner chose not to harden the gate) | Accepted (owner, gate) |  |
| F-093 | 15a | Low | QA3-12: Harm feedback at signing may be lost in a busy message stream (not confirmed) | Open |  |
| F-094 | 15a | Low | QA3-13: The 360 px list board is crowded: Next, the counter and messages overlap tiles | Open |  |

## Stage 15a round 4 (Nov 27, 2026, v0.33.0 candidate; `spec/QA-REPORT.md`)

| ID | Stage | Sev | Finding | Status | Resolution |
|---|---|---|---|---|---|
| F-095 | 15a | Medium | QA4-1: Toasts (z-index 100) cover decision-card and radio-card text on the list board (cards z-index 95) | Fixed (to be confirmed by QA) | messages go under an open card (z-index 90 while a card is open) |
| F-096 | 15a | Medium | QA4-2: Attending Orientation step and How to play still teach Patients, Clinical, Admin, Staff instead of Clinical, Diagnoses, Radio, Legal | Fixed (to be confirmed by QA) | attending Orientation and How to play teach Clinical, Diagnoses, Radio, Legal |
| F-097 | 15a | Medium | QA4-3: An idle attending Rush with every radio call missed reads "Nothing went badly wrong this shift" in the M&M | Fixed (to be confirmed by QA) | a missed radio call is an M&M line for the attending; rules15 |
| F-098 | 15a | Medium | QA4-4: The attending report credits patients the game handed over and examined (Patients you saw 2, time-goal and disposition points) when the player did nothing | Fixed (to be confirmed by QA) | handed-over patients wait on the list (no credit, no exam) until See this patient; rules15 |
| F-099 | 15a | Low | QA4-5: A signed order set with an unsafe drug is confirmed in a green toast | Fixed (to be confirmed by QA) | an unsafe order set is confirmed in red |
| F-100 | 15a | Low | QA4-6: The department section on the attending report has no disclosure marker; "Clinical accuracy" beside a different "Clinical" score | Open |  |
| F-101 | 15a | Low | QA4-7: Score pills lose their labels while a message shows in the top bar | Open |  |
| F-102 | 15a | Low | QA4-8: Small targets and text: 36 px chips, 31 px Find a doctor, 32 px jump tabs, 22 px zone header, 21 px map tokens, 8.6 px desktop staff names, 11.25 px Class code notice | Open |  |
| F-103 | 15a | Low | QA4-9: Order-menu badges overlap the arrows; the sheet close button overlaps the first order row | Open |  |
| F-104 | 15a | Low | QA4-10: The name filter refuses "Dick" and accepts "Hitler" | Fixed (to be confirmed by QA) | "Dick" accepted (a real first name); "Hitler" refused; class_test |
| F-105 | 15a | Low | QA4-11: No teaching-game notice on How to play, the glossary, or in-shift charge-nurse patient cards (keeps Clinical safety at 9) | Fixed (to be confirmed by QA) | the notice on How to play, the glossary and patient cards |
| F-106 | 15a | Low | QA4-12: A card shows "ECG: Sinus tach" with HR 83; "interpreter in 0m" | Open |  |
| F-107 | 15a | Low | QA4-13: Playing a class code leaves its role and scenario on the menu with no notice | Open |  |
| F-108 | 15a | Low | QA4-14: Gate password in plain text (owner chose not to harden the gate) | Accepted (owner, gate) |  |

## Stage 15a round 5 (Nov 27, 2026, v0.33.0 candidate; `spec/QA-REPORT.md`)

| ID | Stage | Sev | Finding | Status | Resolution |
|---|---|---|---|---|---|
| F-109 | 15a | Medium | QA5-1: Full names pass the first-name rule: BOB JONES, JO SMITH (capitals read as initials), Ana.Smith, AnaSmith | Fixed (to be confirmed by QA) | owner: initials only, 1 to 4 letters (no full name can pass); class_test |
| F-110 | 15a | Medium | QA5-2: The profanity check refuses real names by substring: Yoshito, Yoshitaka, Ashita, Shitara, Fagan | Fixed (to be confirmed by QA) | the rude-word check now matches whole initials only, so real names aren't refused |
| F-111 | 15a | Medium | QA5-3: The attending's report credits disposition points with no dispositions (staff actions land in the attending's ledger); Clinical counts radio calls with no patients seen | Fixed (to be confirmed by QA) | staff and charge-nurse actions don't score for the attending; radio calls stay out of the attending's Clinical; rules15 |
| F-112 | 15a | Medium | QA5-4: The bleed-neglect messages tell the attending the diagnosis and treatment ("in hemorrhagic shock. They need fluids and blood now.") | Fixed (to be confirmed by QA) | the bleed-neglect messages give the signs only on the attending's shift |
| F-113 | 15a | Medium | QA5-5: The syncope score (and HEART) counts a normal troponin that was never ordered | Fixed (to be confirmed by QA) | a troponin not drawn shows as not drawn; HEART says it needs one |
| F-114 | 15a | Low | QA5-6: Missing space after the notice on the Class code sheet | Fixed (to be confirmed by QA) | space added |
| F-115 | 15a | Low | QA5-7: Text under 12 px: Class code notice 11.25 px, list-board patient names 11.7 px at 360 px, tiny 3D labels sideways | Open |  |
| F-116 | 15a | Low | QA5-8: Targets under 44 px: list pod headers 22 px, sideways Waiting-room bar 16 px, About credit links | Open |  |
| F-117 | 15a | Low | QA5-9: 360 px crowding: vitals pill clipped; the meter overlaps provider chips | Open |  |
| F-118 | 15a | Low | QA5-10: Focus falls to the page after the shift-intro card; the page body is a Tab stop | Open |  |
| F-119 | 15a | Low | QA5-11: The Orientation step counter jumps from 16 to 19 of 27 | Open |  |
| F-120 | 15a | Low | QA5-12: "1 Diagnoses" (grammar) | Fixed (to be confirmed by QA) | the pill reads "Dx called" |
| F-121 | 15a | Low | QA5-13: Gate password in plain text (owner chose not to harden the gate) | Accepted (owner, gate) |  |

