# Round 13 (v0.33.0 release review): status

Six reviewers on `git diff 78916ef..895bc15`, Nov 27, 2026. A second agent checked every Critical and High finding at 895bc15
(`verification.md`).

| Reviewer | Score | Report |
|---|---|---|
| R1 architecture | 4/10 | `reviewer-1-architecture.md` |
| R2 tooling, docs, legal | 7/10 | `reviewer-2-devops.md` |
| R3 game tech, security, privacy | 5/10 | `reviewer-3-gametech-security.md` |
| R4 UI/UX | 5/10 | `reviewer-4-uiux.md` |
| R5 player and game design | 4/10 | `reviewer-5-player-design.md` |
| R6 clinical | 5/10 | `reviewer-6-clinical.md` |

## Critical and High: all confirmed, all fixed

| Finding | Verified | Fix |
|---|---|---|
| R1.13-01 Handed patient can't be seen | Critical | See this patient on the card; Next chip "On your list: see them"; rules15 check |
| R5.13-01 True diagnosis posted to the log at the call | Critical | The log says "results are in. Your call" on the attending's shift; played-through rules15 check |
| R1.13-02 / R3.13-01 Crash re-saves the broken state | High | `save()` returns after a crash; crash_test reads the save after Reload and Start over |
| R1.13-03 / R3.13-02 / R5.13-02 / R5.13-05 / R6.13-02 (stars) Idle or radio-only attending scores well | High | Clinical is left out with no patient seen; stars capped by patients seen (shift 30/15/6, Rush 6/3/1); rules15: idle and radio-only get 0 stars on every level |
| R5.13-03 Never calling a diagnosis is left out | High | An uncalled diagnosis counts as a miss when the patient leaves or the shift ends ("no diagnosis called") |
| R5.13-04 / R6.13-02 Handed patients unnoticed, never worse, cheap to ignore (F-134) | High | Toast at hand-over; after 45 min unseen the sickest get visibly worse (with a penalty); after an hour they go to another doctor and count as unseen; the autopilot sees them; a late hand-over (last 30 min) is a sign-out |
| R6.13-01 Card names the hemorrhage and MTP before the diagnosis | High | The attending sees signs ("pale and sweaty, heart racing, pressure falling"), no MTP chip, tag or button until the diagnosis is known; MTP stays an order |
| R4.13-01 Sideways list board shows ~40 px (F-135) | High | Sideways on the list board the top block scrolls with the board and Menu stays pinned: about 318 px of board, 10 rooms |
| R1.13-04 Held call scored against "Cardiac arrest" | Medium (mechanism only) | The diagnosis is kept with the call |

## Mediums fixed

R1.13-05 / R3.13-07 (end-of-shift settlement after a firing), R1.13-07 / R3.13-05 (instructor note), R2.13-01, R2.13-02, R2.13-05 (docs),
R3.13-03 (crash card keyboard), R3.13-04 / R4.13-09 (initials only, really), R3.13-06 (bad stored rank or bests), R4.13-02, R4.13-03,
R4.13-04, R4.13-05 (report and Waiting chip), R6.13-04 (stroke exclusions), R6.13-05 (CSRS labels), R6.13-09 (harm reasons).

## Open, for the owner (not fixed in this release)

- R2.13-03 events_test flake; R2.13-04 lint rules for the engine.
- R4.13-06, R4.13-07 tap targets and 12 px text on the maps (F-137, F-141).
- R4.13-08 the two floating counters on the list board.
- R5.13-06 to R5.13-11 grading balance, rank weighting, diagnosis-review reasons, case mix (F-143).
- R6.13-03 "no sign it's needed" wording; R6.13-06 case mix; R6.13-07 gray-zone grading.
- All Lows and Nitpicks.
