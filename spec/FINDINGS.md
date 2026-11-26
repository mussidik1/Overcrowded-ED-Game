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
