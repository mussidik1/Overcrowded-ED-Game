# Code Black: professional audit (Nov 24, 2026)

Branch `claude/sleepy-rubin-jot35n`, v0.29.1. Six hostile reviewers worked independently, then a Verifier re-checked every Critical and High finding in the code and the running game. This document merges their work. No code has been changed by the audit.

## 1. Executive summary

**The short answer: the game is a good idea built on a solid core, but it isn't ready to put in front of a class, and it isn't ready to hand to a professional developer.** It should be repaired, not rebuilt.

**What's good.**
- **The simulation.** It is deterministic: the same class code gives every student the same patients at the same times.
- **The tests.** 528 automatic checks run in about a minute.
- **The content.** 76 cases, 41 events and a medical-direction quiz is a real body of work.
- **What the reviewers liked.** The flat floor plan, the Next button, the M&M "worst moments" lines and the radio questions.

**What's wrong, in order of how much it matters:**

1. **Some answer keys teach the wrong thing.** The Verifier reproduced five of these in the engine:
   - Tenecteplase given after the 4.5-hour stroke window scores as a clean order set.
   - Metoclopramide counts as correct for a bowel obstruction.
   - Unstable A-fib is fixed with diltiazem and fluids, and there's no cardioversion.
   - Bicillin is listed under "Antibiotics by vein".
   - Nitroglycerin is a "wrong drug" in a heart attack.

   A student who learns from the score learns these mistakes. There are also 10 more confirmed High clinical problems: asthma, anaphylaxis, TXA, COPD, DKA potassium, risk scores, cardiac arrest, and no sources cited anywhere.
2. **Cardiac arrest is broken as a game and as a lesson.**
   - If your own patient arrests, there's no button to run the code, and CPR goes on until 19:00.
   - Untreated arrests never count as deaths, so the report can say "Everybody survived".
   - A code has no decisions in it. The outcome is a coin flip.
3. **Class results aren't safe.**
   - Anyone can post a fake score under any name to any class code.
   - Anyone with a code, or who guesses one, can read every student's name and score.
   - The database rules live only in the Supabase dashboard, so nobody can review them.
4. **The live website publishes the whole repo:** source, tests and tools. The new deploy workflow fixes this, but it only takes over once you switch **Settings > Pages > Source** to **GitHub Actions**. Until then, merging this branch would publish CLAUDE.md and these audit reports too.
5. **It breaks easily.**
   - One error anywhere stops the clock for good, with no message.
   - A class shift in progress is silently thrown away after any update.
   - On a phone, the password gate pushes its Play button off the screen, and the class-code sheet scrolls sideways and hides the code it just made.
6. **The attending game gives away its answers.** It shows "Still needed: X", prints the diagnosis on alert patients, and fixes a wrong diagnosis for you on the spot. The attending's stars mostly grade the computer-run department, not the player.
7. **It's hard for a developer to take over.**
   - The code is two huge files (4,500 and 2,850 lines).
   - Game content is mixed into the code across about 30 tables.
   - There's no type checking, no linter and no licence.

**What to do.** Fix the wrong answer keys and the arrest bugs first, with a clinician signing off the changed keys. Next, lock down class results and switch the Pages source. Then add the safety equipment developers expect (types, lint, CI on every push, a licence, crash handling, versioned saves). Only after that, restructure the code and polish the screens. Section 7 has the phase plan.

## 2. Scorecard

| Area | Reviewer | Score | Verdict | Confirmed Critical | Confirmed High |
|---|---|---|---|---|---|
| Clinical accuracy | R6 | 3/10 | No | 5 | 10 (+1 needs a clinician) |
| Architecture | R1 | 3/10 | Only after major work | 0 | 6 |
| Tooling, CI and legal | R2 | 4/10 | Only after major work | 0 | 4 |
| Game tech, security, privacy | R3 | 4/10 | No | 0 | 6 (incl. R3-08, upgraded) |
| UI/UX | R4 | 4/10 | No | 0 | 5 |
| Game design (player) | R5 | 4/10 | Only after major work | 0 | 4 |
| **Overall** | | **3.7/10** | **Not ready** | **5** | **36 (31 unique)** |

These are Verifier-corrected counts. Of 210 findings, 208 survive (2 rejected): 5 Critical, 36 High, 83 Medium, 57 Low, 27 Nitpick, with 17 duplicates across reviewers. Of the 53 Critical and High findings, the Verifier confirmed 50, rejected 2 and sent 1 to a clinician. It changed 15 severities: 14 down and 1 up.

## 3. Fix These First

| # | Fix | IDs | Why first | Effort |
|---|---|---|---|---|
| 1 | Switch Pages to the Actions workflow (an owner setting, about 1 minute) | R2-01 = R1-06 = R3-06 | The whole repo is public on the live site today. This must happen before this branch merges. | S |
| 2 | Enforce the 4.5-hour thrombolytic window, and score an out-of-window lytic as harm | R6-01 | Teaches that the stroke window is decoration | S |
| 3 | Rescore ACS: aspirin, nitroglycerin and heparin right; ketorolac wrong; morphine and beta-blocker per clinician | R6-08 | Core ACS pharmacology is scored backwards | S |
| 4 | Make metoclopramide contraindicated in bowel obstruction; move Bicillin to IM only | R6-05, R6-07 | Rewards contraindicated or fatal-route care | S |
| 5 | Unstable A-fib: add synchronized cardioversion, and stop fluids "fixing" instability | R6-06 | Missing the ACLS-required treatment | M |
| 6 | Arrest: a code for your own patient, untreated arrests become deaths, real ACLS decisions | R5-01, R5-02, R6-04 | A dead end in the most important case, and a report that hides deaths | S + S + L |
| 7 | Class results: insert through a validating, rate-limited RPC; results readable only by the instructor; schema and RLS in the repo | R3-01, R3-02, R2-07 = R1-05 = R3-03 | Forged scores, and students' names readable by anyone. Needs your approval for the database change. | L |
| 8 | Crash guard (pause, save, show a message) and keep a class shift across an update | R1-04 = R3-04, R3-08 | One error freezes the game; an update drops class work silently | S + M |
| 9 | Phone layout: gate Play button, class-code sheet overflow, show the new code | R4-01, R4-02 = R3-11, R4-03 | First screen and classroom flow broken on phones | S |
| 10 | Cite a source guideline and provider level on every case and drug, with a named clinical reviewer | R6-20 | Without it, no clinical claim can be checked and no CE body will accept it | L |

## 4. Rebuild or refactor?

**Refactor, step by step. Don't rebuild.**

Why not rebuild:
- The valuable parts are working and tested: the deterministic simulation, the separate random streams that keep a class in sync, 76 cases, 528 rule checks and the 188-shift stress run.
- A rewrite would throw that away and bring back bugs that are already fixed.
- None of the problems is in the core design. They are wrong data (the answer keys), missing guard rails (types, lint, crash handling, save versions), a backend with no rules in the repo, and two files that grew too big.

All of those can be fixed in place behind a safety net:
- **Phase 0 first:** golden-shift fingerprints, class-code fixtures and a save round-trip test, so every later change shows whether it altered a shift.
- **Then:** move the engine to ES modules and the content to schema-checked JSON, and add TypeScript one module at a time.
- **Keep the single-file `index.html` output:** offline play and the Claude artifact copy depend on it.

## 5. Decisions

**Design verdict: is it fun?** Not yet, but the game is in there.
- **The charge-nurse loop is engaging for about ten minutes.** Then it turns into "tap Next, tap the first button".
- **The difficulty is out of order.** The two-hour Rush is too easy; the Verifier found the three full shifts do get harder in the right order. The real gap is that playing well and playing carelessly score too close together.
- **The attending loop should be the stronger game.** Diagnosis under time pressure is a great core, but the game gives the answers away and grades the AI's work.

To make it fun:
- Take the hints off regular levels (this fits your rule: teach in Orientation, don't make the levels easier).
- Grade the attending on the attending's own decisions.
- Make arrests a real decision point.
- Add some progression.

**Clinical safety verdict: not safe for unsupervised student use, and not ready for CE credit.**
- **Five confirmed Critical answer keys reward wrong or contraindicated care.** Students learn from the score.
- **No item cites a source, and no clinician has signed it off.**

After Phases 1 and 3 (Critical and High clinical fixes, each with a test) and a clinician's sign-off on the changed answer keys, it would be fit for **instructor-supervised classroom use**. CE use also needs R6-20 closed: sources, objectives and a named reviewer on record. Until then, the About page's "A game, not a protocol" disclaimer should stay. It is necessary but not enough.

**Where findings meet your design rules.** These need your call, not mine:
- **Cardo everywhere (your rule) vs. legibility (R4-06).** Keep Cardo and raise the minimum sizes. These are compatible.
- **Hardening the gate (R3-07, R2-22).** You rejected this because the gate is deleted at launch. Marked won't-fix.
- **Hints in regular levels (R5-05).** Removing them from regular levels follows your "teach in Orientation" rule.
- **The charge nurse's Box (R5-20 calls it busywork) vs. "the player directs the work".** Your call.
- **The baseline standard (TypeScript, Vite) vs. the single-file build.** Both are kept: Vite can output one file.
- **R6-17 (TIA discharge) and the side questions in R6-08 and R6-15.** These need a clinician's answer. The exact questions are in `docs/audit/verification.md`.

## 6. Reports

- [Project brief](audit/BRIEF.md)
- [R1: Architecture](audit/reviewer-1-architect.md)
- [R2: Tooling, CI and legal](audit/reviewer-2-devops.md)
- [R3: Game tech, security and privacy](audit/reviewer-3-gametech-security.md)
- [R4: UI/UX](audit/reviewer-4-uiux.md)
- [R5: Player and game design](audit/reviewer-5-player.md)
- [R6: Clinical accuracy](audit/reviewer-6-clinical.md)
- [Verification](audit/verification.md)
- [Screenshots](audit/screenshots/): 145 screens at 390×844, 844×390, 820×1180 and 1440×900, made by `test/audit_shots.py`

## 7. Migration plan

Each phase runs on its own branch off `claude/sleepy-rubin-jot35n` (or `3d`), ends with `npm test`, `npm run stress`, the Chrome UI suite and the smoke checklist, and is one or more commits that list the finding IDs they close. Nothing merges to `main` until the phase is green.

### Phase 0: Safety net (before any change)
- **Branch:** `audit/phase-0`.
- **Characterization tests** (`test/golden.js`): for each level × scenario × role, run the autopilot on a fixed seed and record a fingerprint of the result (arrival list, deaths, LWBS, door-to-doc median, score, stars). Commit the fingerprints. Any later change that moves them must say why in the commit.
- **Class-code fixtures:** 20 codes with their decoded fields, for the current version.
- **Save round trip:** save mid-shift, reload, step 60 minutes, compare with an unbroken run.
- **Answer-key snapshot:** for every case, the scored result of the textbook order set (already in `rules10.js`; freeze its output).
- **Smoke checklist** (`docs/SMOKE.md`), run by hand on a phone before each merge: first visit and About; menu; start each role; place a patient; sign orders; diagnose; dispose; radio call; pause and resume; end-of-shift report; class code make and join; Orientation chapter 1; one lesson; 3D on and off; offline reload.

### Phase 1: Critical clinical content
R6-01, R6-05, R6-06, R6-07, R6-08 (the five confirmed Critical items), plus arrests: R6-04 (no resuscitation decisions) and the dead ends R5-01 and R5-02 (a patient in arrest who never resolves teaches nothing and hides deaths). Correct the rejected R6-03 epinephrine data while rebuilding arrests. Each fix gets a rule test that fails before and passes after. Clinician sign-off on the changed answer keys before merge.

### Phase 2: Security and privacy (needs owner approval for each database change)
R3-01, R3-02, R3-03 / R2-07 / R1-05 (put the schema, RLS and functions in `supabase/migrations/`), R2-01 / R1-06 / R3-06 (switch Pages to the Actions workflow), R3-15 (privacy notice), R3-13, R3-14. Class results: insert through an RPC that validates and rate-limits; `cb_class` only for the instructor who made the code (an instructor key shown once at code creation), first names or initials only, results expire after 30 days.

### Phase 3: High clinical content
R6-09, R6-11 to R6-16, R6-18, R6-20 (confirmed), R6-17 once a clinician answers the Verifier's question, and R6-02 (every stroke arrives inside the window; Medium, but in the same code as R6-01). Add a `source` (guideline and year) and `level` (EMT, paramedic, RN, physician) to every case and drug as part of each fix, so R6-20 closes as the content is touched.

### Phase 4: Foundation
- R2-03: CI on every push and pull request, every branch.
- R2-04: LICENSE (owner chooses), CREDITS.md, fix R2-16 to R2-19.
- R2-05 / R1-17: ESLint + Prettier, then `// @ts-check` with JSDoc types and `tsc --noEmit` (strict) in CI.
- R1-04 = R3-04: guard the frame loop; on an exception, pause, save, and show "Something went wrong. Your shift is saved." with a reload button.
- R1-07 / R3-09 / R3-18: save schema version, migrations, validation, size cap. R3-08: a class shift survives an update (migrate it instead of dropping it, or tell the player).
- R3-05: handle `webglcontextlost` (fall back to the flat map).
- R5-06 / R1-16: stop the 3D loop when 3D is off.

### Phase 5: Structure
R1-01, R1-02, R1-03 and the Medium architecture items. Move to ES modules bundled by Vite (esbuild underneath, already used), keeping the single-file `index.html` output through `vite-plugin-singlefile` so offline play and the Claude artifact copy still work. Content moves to `src/content/*.json` checked by a JSON Schema at build and test time. Convert files to TypeScript one module at a time, behind the Phase 0 fingerprints.

### Phase 6: UX and game design
R4-01 to R4-08, R5-03, R5-04, R5-05, then the Medium UX and design items. Owner decisions are needed where these meet his design rules (see section 5).

### Phase 7: Medium, Low and docs
The remaining confirmed findings, then the handoff documents in section 9.

### Phase 8: Re-audit
Run the same six reviewers and the Verifier against the result, and compare scores.

## 8. Target end state

```
.
├── src/
│   ├── core/          rng, state, save (versioned), clock
│   ├── sim/           arrivals, placement, staff, transport, imaging, events, flow
│   ├── md/            orders, scoring, diagnosis, litigation, radio
│   ├── content/       cases/*.json, drugs.json, tests.json, radio/*.json, lessons/*.json  (data only)
│   ├── ui/            hud, board, sheets, coach, report, menus
│   ├── map2d/         SVG floor
│   ├── map3d/         three.js floor (lazy-loaded)
│   └── main.ts
├── public/            icons, manifest, og.jpg, img/, 3d/*.glb, CNAME
├── schemas/           case.schema.json, drug.schema.json, radio.schema.json
├── supabase/migrations/   tables, RLS, functions (the gate deleted at launch)
├── tests/
│   ├── unit/          Vitest: engine rules, scoring, codes, saves
│   ├── content/       every case scored the textbook way; schema checks; every item has a source
│   ├── golden/        seeded-shift fingerprints
│   └── e2e/           Playwright: 1–2 smoke tests (start a shift as each role; class code)
├── docs/              ARCHITECTURE, CLINICAL_CONTENT, UI_STYLE_GUIDE, SMOKE, audit/
├── art/blender/, tools/
├── .github/workflows/ ci.yml (lint, typecheck, test, build on push and PR), pages.yml (deploy main)
├── README.md, CONTRIBUTING.md, LICENSE, CREDITS.md, CLAUDE.md, .env.example
└── package.json, package-lock.json, tsconfig.json, eslint.config.js, .prettierrc, vite.config.ts
```

**Tooling:** Node 22 LTS, npm with lockfile, TypeScript strict, Vite (single-file output), ESLint (typescript-eslint) + Prettier, Vitest, Playwright, Ajv for content schemas, Dependabot for npm and Actions.

**npm scripts:**
| Script | Does |
|---|---|
| `dev` | Vite dev server with hot reload |
| `build` | type-check, validate content, bundle to `dist/` (single `index.html` + `sw.js` + assets) |
| `lint` / `format` | ESLint / Prettier check |
| `typecheck` | `tsc --noEmit` |
| `test` | Vitest: unit, content, golden |
| `test:e2e` | Playwright smoke tests |
| `stress` | the 188-shift stress run |
| `content:check` | schema and source checks on `src/content/` |

**CI:** `ci.yml` on every push and pull request: install, lint, typecheck, test, content check, build, e2e smoke on Chrome; WebKit weekly and on release. `pages.yml` deploys `dist/` from `main` only after `ci.yml` passes. Actions pinned by SHA, `permissions: contents: read` by default, Node from `.nvmrc`.

**UI style guide (summary; full version in `docs/UI_STYLE_GUIDE.md`):**
- **Type:** Cardo (owner's rule). Minimum 14 px for body text, 12 px for labels, never below 11 px; 16 px for anything the player must read under time pressure. Use the weights the font has (400, 700).
- **Touch:** every target at least 44 × 44 CSS px, with 8 px between targets.
- **Colour:** the existing ink-and-paper tokens, adjusted to WCAG AA (4.5:1 for text, 3:1 for large text and UI parts). Never colour alone: pair with a shape, letter or icon (ESI number in the circle, an icon for isolation, a pattern for dirty rooms).
- **Motion:** respect `prefers-reduced-motion`; no blinking calls to action; toasts never cover the clock, the scores or the radio.
- **Layout:** test at 390×844, 844×390, 820×1180 and 1440×900; no sideways scroll; safe-area insets.
- **Text:** plain words, key words in bold, every term and acronym explained once (owner's rule).
- **Dialogs:** focus moves in and returns, Escape closes, labelled for screen readers.

## 9. Handoff documents to create

| File | Contents |
|---|---|
| `README.md` | What it is, who it's for, how to play, how to run locally, the disclaimer, links to the docs below |
| `docs/ARCHITECTURE.md` | Modules and their direction of dependency, the state object and save format, the RNG streams, how content becomes a shift, the build |
| `CONTRIBUTING.md` | Branches, Conventional Commits, how to add a case (schema, source, lesson, test), the release steps, the hostile-review rule |
| `LICENSE` | Owner's choice (for example, MIT for code and CC BY-NC for content); the owner as copyright holder |
| `CREDITS.md` | Every third-party asset with source, author, licence and link (3D models, fonts, images, three.js), matching what actually ships |
| `.env.example` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (public by design), `VITE_GATED_HOSTS` |
| `docs/UI_STYLE_GUIDE.md` | The rules in section 8, with examples and the colour tokens |
| `CLAUDE.md` | Updated for the new layout, scripts and CI |
| `docs/CLINICAL_CONTENT.md` | Every case and drug with its source guideline and year, provider level, the reviewer and date, the scoring rules, and how to report a clinical error |
| `docs/SMOKE.md` | The manual smoke checklist from Phase 0 |

## 10. All findings

Verifier-corrected severity; "Not verified" means Medium or below, which the Verifier skimmed but did not reproduce. Duplicates point to the ID kept as primary. Effort: S under a day, M a few days, L a week or more. Details, locations and fixes are in each reviewer's report.

| ID | Severity | Area | Finding | Effort | Verification | Duplicate |
|---|---|---|---|---|---|---|
| R6-01 | Critical | Clinical | The thrombolytic time window is never enforced | S | Confirmed |  |
| R6-05 | Critical | Clinical | Metoclopramide is scored as a correct drug for small bowel obstruction | S | Confirmed |  |
| R6-06 | Critical | Clinical | Unstable A-fib with RVR "crashes" and is fixed with fluids; no cardioversion exists | M | Confirmed |  |
| R6-07 | Critical | Clinical | Benzathine penicillin G is filed under "Antibiotics by vein" | S | Confirmed |  |
| R6-08 | Critical | Clinical | ACS pharmacology is scored backwards | S | Confirmed |  |
| R1-01 | High | Architecture | No module system: two god files and a textual splice | L | Confirmed |  |
| R1-02 | High | Architecture | Game content is code, scattered across ~30 parallel tables in two formats, and patched again after definition | L | Confirmed |  |
| R1-03 | High | Architecture | Stringly-typed coupling: display text used as keys and parsed back into data | M | Confirmed |  |
| R1-04 | High | Architecture | No fault isolation: one exception freezes the shift for good, and tutorial errors are swallowed | S | Confirmed |  |
| R1-05 | High | Architecture | The backend contract is not in version control | M | Confirmed | same as R2-07 |
| R1-06 | High | Architecture | Deployment publishes the whole repository | S | Confirmed | same as R2-01 |
| R2-01 | High | Tooling & legal | The whole private repo is published on edcodeblack.com | S | Confirmed |  |
| R2-02 | High | Tooling & legal | The deploy isn't gated on the tests | S | Confirmed |  |
| R2-05 | High | Tooling & legal | No types, no linter, no formatter on 8,000+ lines | L | Confirmed |  |
| R2-07 | High | Tooling & legal | The backend isn't in version control | M | Confirmed |  |
| R3-01 | High | Security & tech | Anyone can forge, flood or impersonate class results | L | Confirmed (Critical→High) |  |
| R3-02 | High | Security & tech | Students' names and scores are readable by anyone with, or guessing, a code | L | Confirmed (Critical→High) |  |
| R3-03 | High | Security & tech | The backend's security is unverifiable, and it is shared with another app | M | Confirmed | same as R2-07 |
| R3-04 | High | Security & tech | One exception anywhere in the loop freezes the game permanently and silently | S | Confirmed | same as R1-04 |
| R3-06 | High | Security & tech | The public site publishes the repo, and this branch would publish CLAUDE.md and these audit reports | S | Confirmed | same as R2-01 |
| R3-08 | High | Security & tech | A class shift in progress is silently discarded after an update | M | Upgraded by Verifier (Medium→High) |  |
| R4-01 | High | UI/UX | The password gate on a phone: Play button off-screen, title clipped | S | Confirmed |  |
| R4-02 | High | UI/UX | The Class code sheet overflows sideways on phones | S | Confirmed |  |
| R4-03 | High | UI/UX | Making a class code gives no visible result | S | Confirmed |  |
| R4-06 | High | UI/UX | State-bearing text is far below legible size | M | Confirmed |  |
| R4-07 | High | UI/UX | Touch targets well under 44×44 throughout the core loop | M | Confirmed |  |
| R5-01 | High | Game design | your own patient who arrests can never have a code run. CPR goes on until the shift ends. | S | Confirmed |  |
| R5-02 | High | Game design | patients who arrest and never get a team stay in arrest forever. The summary says everyone survived. | S | Confirmed |  |
| R5-03 | High | Game design | the attending's grade is mostly the AI's work. "Solid shift" with 28% clinical and 1 of 3 diagnoses right. | M | Confirmed |  |
| R5-05 | High | Game design | the attending game gives away its own answers. | M | Confirmed |  |
| R6-04 | High | Clinical | The cardiac-arrest case contains no resuscitation decisions; the outcome is a coin flip | L | Confirmed (Critical→High) |  |
| R6-09 | High | Clinical | Severe asthma: magnesium alone, with no systemic steroid, earns a clean order set | S | Confirmed |  |
| R6-11 | High | Clinical | Anaphylaxis: antihistamine plus steroid is required, fluids and bronchodilator are extras, and a crash isn't treated with repeat epinephrine | S | Confirmed |  |
| R6-12 | High | Clinical | Tranexamic acid in hemorrhagic shock is scored as an unneeded order | S | Confirmed |  |
| R6-13 | High | Clinical | COPD exacerbation on BiPAP: antibiotics scored as extras, steroids only "reasonable" | S | Confirmed |  |
| R6-14 | High | Clinical | Antibiotic and vasopressor choices accepted as monotherapy where guidelines require combinations | S | Confirmed |  |
| R6-15 | High | Clinical | DKA: the insulin drip isn't held for the potassium result, and the tutorial teaches ordering them together | M | Confirmed |  |
| R6-16 | High | Clinical | Gray-zone risk scores are random numbers that contradict the patient's own findings | M | Confirmed |  |
| R6-17 | High | Clinical | TIA with ABCD2 ≤3 is graded "home" as the right call | M | Needs Clinician Confirmation |  |
| R6-18 | High | Clinical | Orders are graded in hindsight against a hidden final diagnosis, and the exam line gives that diagnosis away | L | Confirmed |  |
| R6-20 | High | Clinical | No clinical source is cited anywhere; there are no objectives and no reviewer | L | Confirmed |  |
| R1-07 | Medium | Architecture | Persistence has no schema versioning, no migrations and no validation, and saves grow without bound | M | Confirmed (High→Medium) |  |
| R1-08 | Medium | Architecture | Singleton global engine state and hidden global configuration | M | Not verified (Medium or below) |  |
| R1-09 | Medium | Architecture | The public API is the entire engine, including content tables and cheats, and the UI writes state directly | M | Not verified (Medium or below) |  |
| R1-10 | Medium | Architecture | Game variants are if-branches threaded through every system | L | Not verified (Medium or below) |  |
| R1-11 | Medium | Architecture | Implicit state machines in magic strings, including a dead state | M | Not verified (Medium or below) |  |
| R1-12 | Medium | Architecture | God functions | M | Not verified (Medium or below) |  |
| R1-13 | Medium | Architecture | Knowledge duplicated across modules | M | Not verified (Medium or below) |  |
| R1-14 | Medium | Architecture | Tutorial and lesson content is executable code inside the UI | L | Not verified (Medium or below) |  |
| R1-15 | Medium | Architecture | The render loop rebuilds everything, including the hidden view, and forces layout | M | Not verified (Medium or below) |  |
| R1-16 | Medium | Architecture | Switching the 3D floor off mid-shift does not stop it | S | Not verified (Medium or below) | same as R5-06 |
| R1-17 | Medium | Architecture | No types, no lint, no formatter | M | Not verified (Medium or below) | same as R2-05 |
| R1-18 | Medium | Architecture | The tests are hand-rolled, seed-fragile, poke internals and leave the UI unit-untested | M | Not verified (Medium or below) |  |
| R2-03 | Medium | Tooling & legal | CI never runs on pull requests or on the working branch | S | Confirmed (High→Medium) |  |
| R2-04 | Medium | Tooling & legal | No licence and no copyright holder | S | Confirmed (High→Medium) |  |
| R2-06 | Medium | Tooling & legal | Duplicate keys silently delete teaching text | S | Not verified (Medium or below) |  |
| R2-08 | Medium | Tooling & legal | CI runs on an end-of-life Node, with deprecated actions | S | Not verified (Medium or below) |  |
| R2-09 | Medium | Tooling & legal | The WebKit job has been red on 10 straight `main` pushes, and nobody sees it | S | Not verified (Medium or below) |  |
| R2-10 | Medium | Tooling & legal | Every CI job gets a write token, and nothing is pinned | S | Not verified (Medium or below) |  |
| R2-11 | Medium | Tooling & legal | The Python test toolchain isn't declared or pinned | S | Not verified (Medium or below) |  |
| R2-12 | Medium | Tooling & legal | The test framework is hand-rolled and fragile | L | Not verified (Medium or below) |  |
| R2-13 | Medium | Tooling & legal | Stress and sim tests mostly print instead of asserting | S | Not verified (Medium or below) |  |
| R2-14 | Medium | Tooling & legal | Build outputs and screenshots are committed and bloat the history | M | Not verified (Medium or below) |  |
| R2-15 | Medium | Tooling & legal | The 3D asset and data pipelines can't be reproduced | M | Not verified (Medium or below) |  |
| R2-16 | Medium | Tooling & legal | The credits name an asset source the project doesn't use | S | Not verified (Medium or below) |  |
| R2-17 | Medium | Tooling & legal | A third-party document is republished without a recorded licence | S | Not verified (Medium or below) |  |
| R2-18 | Medium | Tooling & legal | Image licence compliance has gaps | S | Not verified (Medium or below) |  |
| R3-05 | Medium | Security & tech | A lost WebGL context leaves a blank floor with no recovery | S | Confirmed (High→Medium) |  |
| R3-07 | Medium | Security & tech | The password gate: plaintext shared secret, trivial bypass, and a blank screen on bad networks | S | Not verified (Medium or below) | same as R2-22 |
| R3-09 | Medium | Security & tech | Saves have no real versioning; a bad save traps the player | M | Not verified (Medium or below) | same as R1-07 |
| R3-10 | Medium | Security & tech | The service worker hangs on slow networks and doesn't cover what the game needs offline | M | Not verified (Medium or below) |  |
| R3-11 | Medium | Security & tech | The Class code sheet overflows sideways on every phone width | S | Not verified (Medium or below) | same as R4-02 |
| R3-12 | Medium | Security & tech | Keyboard and screen-reader access is broken in the main view | M | Not verified (Medium or below) |  |
| R3-13 | Medium | Security & tech | Results can be submitted twice, and the retry logic resends on any 400 | S | Not verified (Medium or below) |  |
| R3-14 | Medium | Security & tech | No network call has a timeout | S | Not verified (Medium or below) |  |
| R3-15 | Medium | Security & tech | Privacy disclosure is wrong and incomplete for a school setting | S | Not verified (Medium or below) |  |
| R4-04 | Medium | UI/UX | Toasts cover the HUD, the scores and the ringing radio | M | Confirmed (High→Medium) |  |
| R4-05 | Medium | UI/UX | Four "waiting" counters on one screen, each with a different number | M | Confirmed (High→Medium) |  |
| R4-08 | Medium | UI/UX | Colour carries meaning that disappears for colourblind players | M | Confirmed (High→Medium) |  |
| R4-09 | Medium | UI/UX | Contrast failures from the CSS tokens (WCAG AA 4.5:1) | S | Not verified (Medium or below) |  |
| R4-10 | Medium | UI/UX | The main call to action blinks almost all the time | S | Not verified (Medium or below) |  |
| R4-11 | Medium | UI/UX | Portrait phones hit a blocking "Turn your phone sideways" screen by default, and it is see-through | S | Not verified (Medium or below) |  |
| R4-12 | Medium | UI/UX | Dialogs fail keyboard and screen-reader basics | M | Not verified (Medium or below) | same as R3-12 |
| R4-13 | Medium | UI/UX | No text scaling: pinch zoom is off in play and every size is in px | M | Not verified (Medium or below) |  |
| R4-14 | Medium | UI/UX | Arrival cards sit on the part of the floor you need next | S | Not verified (Medium or below) |  |
| R4-15 | Medium | UI/UX | The "fired" game-over screen gives wrong and contradictory information | S | Not verified (Medium or below) |  |
| R4-16 | Medium | UI/UX | The end-of-shift report has a muddled score hierarchy and an orphaned card | M | Not verified (Medium or below) |  |
| R4-17 | Medium | UI/UX | Play a shift: the options come after the button that uses them | S | Not verified (Medium or below) |  |
| R4-18 | Medium | UI/UX | Layout doesn't adapt well across phone, tablet and desktop | M | Not verified (Medium or below) |  |
| R4-19 | Medium | UI/UX | Hidden horizontal scrolling with no affordance | S | Not verified (Medium or below) |  |
| R4-20 | Medium | UI/UX | Mixed art direction, and icon glyphs Cardo doesn't have | M | Not verified (Medium or below) |  |
| R4-21 | Medium | UI/UX | The pause menu is a flat stack of identical buttons | S | Not verified (Medium or below) |  |
| R5-04 | Medium | Game design | the difficulty curve is backwards for the charge nurse and flat for the attending. | M | Confirmed (High→Medium) |  |
| R5-06 | Medium | Game design | turning the 3D floor off doesn't stop it rendering. | S | Confirmed (High→Medium) |  |
| R5-07 | Medium | Game design | leaving Orientation through "Main menu" throws away your progress, even though the menu says it's saved. | S | Not verified (Medium or below) |  |
| R5-08 | Medium | Game design | "Sign with no orders" refuses to sign with no orders. | S | Not verified (Medium or below) |  |
| R5-09 | Medium | Game design | pausing hides the board. There's no way to stop the clock and plan. | M | Not verified (Medium or below) |  |
| R5-10 | Medium | Game design | the order menus are an ever-growing accordion that keeps its state across patients, with the clock running. | M | Not verified (Medium or below) |  |
| R5-11 | Medium | Game design | repeated taps on a wrong consult are each charged in full, with no debounce. | S | Not verified (Medium or below) |  |
| R5-12 | Medium | Game design | medical-direction penalties ignore how dangerous the order is. | S | Not verified (Medium or below) |  |
| R5-13 | Medium | Game design | the medical-direction pool is small enough to memorise in two shifts. | L | Not verified (Medium or below) |  |
| R5-14 | Medium | Game design | Lessons don't make you recall anything, and Orientation is 69 steps on rails. | M | Not verified (Medium or below) |  |
| R5-15 | Medium | Game design | there is almost no progression or reward loop. | L | Not verified (Medium or below) |  |
| R5-16 | Medium | Game design | pantoprazole for an upper GI bleed is scored "Not needed", despite the drug's own description. | S | Not verified (Medium or below) | same as R6-28 |
| R5-17 | Medium | Game design | toasts cover the HUD on the upright list board. | S | Not verified (Medium or below) | same as R4-04 |
| R6-02 | Medium | Clinical | Walk-in strokes never show last known well; every stroke is generated eligible | M | Confirmed (Critical→Medium) |  |
| R6-19 | Medium | Clinical | The order sheet has no doses, routes or weights | L | Confirmed (High→Medium) |  |
| R6-21 | Medium | Clinical | Behavioral health and overdose require a urine tox screen | S | Not verified (Medium or below) |  |
| R6-22 | Medium | Clinical | Local anesthetic scored as wrong | S | Not verified (Medium or below) |  |
| R6-23 | Medium | Clinical | No tetanus prophylaxis exists | S | Not verified (Medium or below) |  |
| R6-24 | Medium | Clinical | Fixed 0.5 mg IM epinephrine for anaphylaxis patients from age 12 | S | Not verified (Medium or below) |  |
| R6-25 | Medium | Clinical | TMP-SMX scored as the wrong drug for uncomplicated cystitis | S | Not verified (Medium or below) |  |
| R6-26 | Medium | Clinical | Migraine is scored against the evidence | S | Not verified (Medium or below) |  |
| R6-27 | Medium | Clinical | IV fluids required for kidney stone and alcohol intoxication; CT required for every stone; no tamsulosin | S | Not verified (Medium or below) |  |
| R6-28 | Medium | Clinical | Upper GI bleed: PPI and octreotide scored as extras | S | Not verified (Medium or below) |  |
| R6-29 | Medium | Clinical | Primary spontaneous pneumothorax: chest tube mandatory | M | Not verified (Medium or below) |  |
| R6-30 | Medium | Clinical | BPPV ("VIP" event): meclizine is the only right drug, and labs are required | S | Not verified (Medium or below) |  |
| R6-31 | Medium | Clinical | "Thiamine before sugar in heavy drinkers" | S | Not verified (Medium or below) |  |
| R6-32 | Medium | Clinical | Stroke workup requires a BMP; only glucose is required before a lytic | S | Not verified (Medium or below) |  |
| R6-33 | Medium | Clinical | No NIHSS, no deficit severity, no thrombectomy selection | M | Not verified (Medium or below) |  |
| R6-34 | Medium | Clinical | Lab values have no units | S | Not verified (Medium or below) |  |
| R6-35 | Medium | Clinical | Triage is never practiced; ESI is assigned automatically | M | Not verified (Medium or below) |  |
| R6-36 | Medium | Clinical | Missing standard ACS and stroke secondary-prevention drugs | S | Not verified (Medium or below) |  |
| R6-37 | Medium | Clinical | PALS and pediatric content is too thin for the stated audience | L | Not verified (Medium or below) |  |
| R1-19 | Low | Architecture | Dead code | S | Not verified (Medium or below) |  |
| R1-20 | Low | Architecture | Test and host hooks ship to players | S | Not verified (Medium or below) |  |
| R1-21 | Low | Architecture | Changelog kept in comments, and comments that are wrong | S | Not verified (Medium or below) |  |
| R1-22 | Low | Architecture | The build is string-splicing, not bundling | S | Not verified (Medium or below) |  |
| R1-23 | Low | Architecture | Asset tooling has undeclared dependencies, assumes /tmp, and its README is stale | S | Not verified (Medium or below) |  |
| R1-24 | Low | Architecture | Repo hygiene | S | Not verified (Medium or below) |  |
| R1-25 | Low | Architecture | Content order is behaviour | S | Not verified (Medium or below) | same as R2-25 |
| R1-26 | Low | Architecture | Event arguments packed as pipe-separated strings | S | Not verified (Medium or below) |  |
| R2-19 | Low | Tooling & legal | Third-party notices are dropped from the shipped bundle | S | Not verified (Medium or below) |  |
| R2-20 | Low | Tooling & legal | Dependencies drift and nothing updates them | S | Not verified (Medium or below) |  |
| R2-21 | Low | Tooling & legal | Configuration is hardcoded and duplicated | S | Not verified (Medium or below) |  |
| R2-22 | Low | Tooling & legal | The gate password is stored in plaintext | S | Not verified (Medium or below) |  |
| R2-23 | Low | Tooling & legal | package.json, README and CLAUDE.md disagree with reality | S | Not verified (Medium or below) |  |
| R2-24 | Low | Tooling & legal | Versioning is informal | S | Not verified (Medium or below) |  |
| R2-25 | Low | Tooling & legal | Class-code meaning depends on object key order | S | Not verified (Medium or below) |  |
| R2-26 | Low | Tooling & legal | Commit history is low quality | S | Not verified (Medium or below) |  |
| R2-27 | Low | Tooling & legal | The service worker has no timeout and an incomplete precache | S | Not verified (Medium or below) |  |
| R2-28 | Low | Tooling & legal | CI wastes time and coverage is uneven | S | Not verified (Medium or below) |  |
| R3-16 | Low | Security & tech | Render cost: a full redraw every 110 ms, including behind the menu and for hidden views | M | Not verified (Medium or below) |  |
| R3-17 | Low | Security & tech | The 3D floor is heavy for "battery saver" | M | Not verified (Medium or below) |  |
| R3-18 | Low | Security & tech | The save grows without limit and is serialized on the main thread | M | Not verified (Medium or below) | same as R1-07 |
| R3-19 | Low | Security & tech | Production ships test and cheat hooks | S | Not verified (Medium or below) | same as R1-20 |
| R3-20 | Low | Security & tech | CSP limits | S | Not verified (Medium or below) |  |
| R3-21 | Low | Security & tech | The bundle isn't minified, and the fonts can't be cached | S | Not verified (Medium or below) |  |
| R3-22 | Low | Security & tech | The PWA manifest is incomplete | S | Not verified (Medium or below) |  |
| R3-23 | Low | Security & tech | Time steps clamp silently on slow devices | S | Not verified (Medium or below) |  |
| R4-22 | Low | UI/UX | The score pill grid has five columns for four pills | S | Not verified (Medium or below) |  |
| R4-23 | Low | UI/UX | Floating controls overlap board content | S | Not verified (Medium or below) |  |
| R4-24 | Low | UI/UX | The lessons list is a 2,247 px scroll with no structure beyond headings | S | Not verified (Medium or below) |  |
| R4-25 | Low | UI/UX | Toast and preceptor live regions will flood a screen reader | S | Not verified (Medium or below) |  |
| R4-26 | Low | UI/UX | Duplicate text in the Team sheet | S | Not verified (Medium or below) |  |
| R4-27 | Low | UI/UX | Background graffiti sits behind board content | S | Not verified (Medium or below) |  |
| R4-28 | Low | UI/UX | An empty class-results state with no guidance | S | Not verified (Medium or below) |  |
| R5-18 | Low | Game design | patient-experience scores and exam text are frozen and break immersion. | S | Not verified (Medium or below) |  |
| R5-19 | Low | Game design | every shift with call-outs opens with the same staffing card before you've seen a patient. | S | Not verified (Medium or below) |  |
| R5-20 | Low | Game design | the charge nurse's Box is busywork. | S | Not verified (Medium or below) |  |
| R5-21 | Low | Game design | the score ledger is dominated by one line, so it can't guide the player. | S | Not verified (Medium or below) |  |
| R5-22 | Low | Game design | two different Dr. Okafors. | S | Not verified (Medium or below) |  |
| R5-23 | Low | Game design | "Sign 5 orders" signs 4. | S | Not verified (Medium or below) |  |
| R5-24 | Low | Game design | the coach card and the patient card disagree on vitals. | S | Not verified (Medium or below) |  |
| R5-25 | Low | Game design | the default 3D floor doesn't show room numbers at phone size, though Orientation says "Tap Room 1". | S | Not verified (Medium or below) |  |
| R5-26 | Low | Game design | zero-star results show as three orange star outlines on the menu. | S | Not verified (Medium or below) |  |
| R5-27 | Low | Game design | "Learn: Done ✓" after Orientation, with 28 of 30 lessons untouched. | S | Not verified (Medium or below) |  |
| R6-38 | Low | Clinical | "Pain you can press on is the chest wall" | S | Not verified (Medium or below) |  |
| R6-39 | Low | Clinical | Antivirals filed as antibiotics | S | Not verified (Medium or below) |  |
| R6-40 | Low | Clinical | TIA defined as "a stroke that clears up on its own" | S | Not verified (Medium or below) |  |
| R6-41 | Low | Clinical | Charcoal accepted 6 h after an acetaminophen ingestion | S | Not verified (Medium or below) |  |
| R6-42 | Low | Clinical | Naloxone "0.4 to 2 mg IV or IN" | S | Not verified (Medium or below) |  |
| R6-43 | Low | Clinical | Ceftriaxone "once a day … meningitis" | S | Not verified (Medium or below) |  |
| R6-44 | Low | Clinical | Severe asthma discharged after a 60-minute watch; asthma crash adds BiPAP | S | Not verified (Medium or below) |  |
| R6-45 | Low | Clinical | No alteplase; tenecteplase used for PE without saying it is off-label | S | Not verified (Medium or below) |  |
| R6-46 | Low | Clinical | Heart-attack lesson text names aspirin only; the preceptor also lights heparin; the summary omits anticoagulation | S | Not verified (Medium or below) |  |
| R6-47 | Low | Clinical | SAH case has no nimodipine | S | Not verified (Medium or below) |  |
| R6-48 | Low | Clinical | TCA overdose: an IV fluid bolus is scored as an extra | S | Not verified (Medium or below) |  |
| R6-49 | Low | Clinical | Cases locked to one sex reinforce stereotypes; the AAA pearl says "older man" while the case can be female | S | Not verified (Medium or below) |  |
| R6-50 | Low | Clinical | Needle decompression site and landmarks not taught | S | Not verified (Medium or below) |  |
| R6-51 | Low | Clinical | MIEMSS sepsis call orders an "epinephrine infusion" while the ED engine teaches norepinephrine as first vasopressor | S | Not verified (Medium or below) |  |
| R1-27 | Nitpick | Architecture | Magic sentinels | S | Not verified (Medium or below) |  |
| R1-28 | Nitpick | Architecture | Naming | S | Not verified (Medium or below) |  |
| R1-29 | Nitpick | Architecture | Small things | S | Not verified (Medium or below) |  |
| R2-29 | Nitpick | Tooling & legal | Dead and duplicate files | S | Not verified (Medium or below) |  |
| R2-30 | Nitpick | Tooling & legal | `.gitignore` is too thin | S | Not verified (Medium or below) |  |
| R2-31 | Nitpick | Tooling & legal | Naming debt from the rename | M | Not verified (Medium or below) |  |
| R2-32 | Nitpick | Tooling & legal | `pages.yml` copies `CNAME` | S | Not verified (Medium or below) |  |
| R2-33 | Nitpick | Tooling & legal | One test block can pass vacuously | S | Not verified (Medium or below) |  |
| R3-24 | Nitpick | Security & tech | - Dead hosting code ships to production: `window.claude.hot` snapshot and ready hooks (`src/ui.js:2844-2848`). | S | Not verified (Medium or below) |  |
| R4-29 | Nitpick | UI/UX | The 500 and 600 font weights don't exist | S | Not verified (Medium or below) |  |
| R4-30 | Nitpick | UI/UX | Rotated magnets blur text | S | Not verified (Medium or below) |  |
| R4-31 | Nitpick | UI/UX | The legal-risk call is a modal with one choice | S | Not verified (Medium or below) |  |
| R4-32 | Nitpick | UI/UX | Tutorial copy is baked into a HUD panel | S | Not verified (Medium or below) |  |
| R4-33 | Nitpick | UI/UX | The waiting meter is green at one or two waiting patients | S | Not verified (Medium or below) |  |
| R4-34 | Nitpick | UI/UX | The disabled Start button is a pale wash | S | Not verified (Medium or below) |  |
| R5-28 | Nitpick | Game design | the first-visit About page puts Start below the fold on a sideways phone. | S | Not verified (Medium or below) |  |
| R5-29 | Nitpick | Game design | the returning player's title screen has no hook. | S | Not verified (Medium or below) |  |
| R5-30 | Nitpick | Game design | an ambiguous list on a lesson card. | S | Not verified (Medium or below) |  |
| R5-31 | Nitpick | Game design | the joke verdict reads as cruel over child deaths. | S | Not verified (Medium or below) |  |
| R6-52 | Nitpick | Clinical | Point-of-care glucose and BMP glucose disagree in the same visit | S | Not verified (Medium or below) |  |
| R6-53 | Nitpick | Clinical | Cellulitis ORD_WHY says IV, but oral cephalexin is accepted | S | Not verified (Medium or below) |  |
| R6-54 | Nitpick | Clinical | Ottawa ankle rules reduced to "tender on the bone" | S | Not verified (Medium or below) |  |
| R6-55 | Nitpick | Clinical | Temperatures in °F only | S | Not verified (Medium or below) |  |
| R6-56 | Nitpick | Clinical | Duplicate keys in the imaging "Look for" table overwrite the better descriptions | S | Not verified (Medium or below) | same as R2-06 |
| R6-57 | Nitpick | Clinical | "Heart block: the beat slows to 30 or 40" | S | Not verified (Medium or below) |  |
| R6-58 | Nitpick | Clinical | Glossary "Thrombolytic: a drug that dissolves the clot in a stroke" | S | Not verified (Medium or below) |  |
| R6-59 | Nitpick | Clinical | "Prochlorperazine: first choice for migraine" | S | Not verified (Medium or below) |  |

## 11. Rejected findings

The Verifier rejected these two. They are left out of the table above.

| ID | Reviewer's severity | Finding | Why rejected |
|---|---|---|---|
| R6-03 | Critical | Epinephrine 1 mg IV in VF arrest is scored as an extra and triggers "harm" | The answer-key data is as described, but no player can reach it. An arrest is run as a `code` task that ends in `codeOutcome` with no order sheet. A player's own patient in arrest is refused at signing. The reviewer called `awaitOrders` by hand. The data should still be corrected when R6-04 rebuilds arrests. |
| R6-10 | High | Opioid re-sedation "crash" adds only oxygen | Crashes only happen to ESI 2 patients waiting in triage or the waiting room. The overdose case is ESI 1, so it never crashes in play. It was reached only through the `crashNow` test hook. The same applies to the crash part of R6-11; the rest of R6-11 stands. |
