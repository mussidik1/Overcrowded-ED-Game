# Project brief for the reviewers (audit of Nov 23, 2026)

A neutral description, written by the lead before any review. Verify all of it yourself. Do not trust the README, CLAUDE.md or code comments.

## What it is
**Emergency Department: Code Black** (formerly "Overcrowded"). It's a single-player browser game: you run one 12-hour shift (07:00 to 19:00) in a 32-bed emergency department. There are two roles:
- **Charge nurse:** you run patient flow. Registration, triage, bed placement, assigning providers, EVS (room cleaning), consults, diversion, transfers.
- **Attending physician:** you see patients, order tests and drugs from menus, pick a diagnosis from four choices, decide the disposition, and answer EMS medical-direction radio calls (multiple choice).

It has an Orientation with a scripted preceptor, 30 short Lessons (9 guided, 21 case cards), four shift levels, scenarios, weather, and "class codes" so a class plays the same seeded shift. There's an end-of-shift report with scores and stars, a legal-risk meter that can get the attending fired, and an optional 3D floor (three.js) or a flat SVG floor plan or a list board.

**Audience:** nursing, paramedic and EM students and instructors, plus working clinicians. The owner is a paramedic and EMS educator who isn't a professional developer. The whole project was written by AI.

**Educational/medical?** Yes. It simulates clinical emergency care: diagnoses, vital signs, ECG findings, drugs and doses, contraindications, EMS medical direction, and triage (ESI). It scores clinical decisions and teaches conditions in lessons. So Reviewer 6 (clinical) runs.

## Tech stack and size
- Plain JavaScript (no TypeScript), no framework. One DOM-free engine file, one UI file, string-built HTML.
- `src/engine.js` is about 4,500 lines (377 KB): the simulation. It exposes `window.OC`, or `module.exports` under Node.
- `src/ui.js` is about 2,850 lines (326 KB): the phone-first UI. It exposes `window.OCUI`.
- `src/map.js` (about 950 lines, SVG floor) is spliced into ui.js at build time.
- `src3d/map3d.js` (about 775 lines) is the three.js floor, bundled by esbuild. The `.glb` models are in `3d/` and were made by the Blender scripts in `art/blender/`.
- `src/style.css` (about 1,100 lines) and `src/index.template.html`.
- `build.js` inlines everything, including base64 Cardo fonts, into one committed `index.html` (about 960 KB). It also writes `sw.js`, a service worker, and a Content Security Policy with script hashes. `build3d.js` writes `3d/map3d.js`. All three outputs are committed.
- Dependencies: `three@0.170`, `esbuild@0.28`, `@fontsource/cardo`. npm, with a committed `package-lock.json`. There's no lint, formatter, type checker or test framework.
- Tests:
  - `test/rules.js` to `rules10.js`: about 528 hand-rolled Node asserts against the engine (`npm test`).
  - `test/sim.js` and `test/stress.js`: simulated shifts.
  - About 18 Python Playwright scripts in `test/*_test.py` that tap through the built page.
- CI is `.github/workflows/tests.yml`: rules and stress on Ubuntu, a Chrome UI job, and a report-only WebKit job on macOS.
- Backend: Supabase project `ecpxhcqvgxizdadwumqt`, shared with the owner's other app "Case Room". It holds the `cb_results` class results table, the `cb_class` RPC, and a password gate (`cb_gate_on`, `cb_gate_check`). The publishable key is in `src/ui.js`. The database schema and RLS are not in the repo.
- Deploy: GitHub Pages from `main` at https://edcodeblack.com (CNAME). Today Pages serves the repo root. A new `.github/workflows/pages.yml` that publishes only the game files is written but not yet active. The live site shows a password gate during private testing; localhost and file:// do not.
- About 86 commits, all authored as "Claude". The repo is private.

## Branch state
- `main` (live) is v0.29.0.
- The working tree you're reviewing is branch `claude/sleepy-rubin-jot35n` at v0.29.1. It has fixes from earlier reviews: CSP, versioned class codes, clinical scoring changes, `lintCases`, `test/rules10.js`, and the deploy workflow. It's not merged yet.

## How to run and play
```sh
cd /home/user/Overcrowded-ED-Game
npm ci && npm run build            # writes 3d/map3d.js, index.html, sw.js
python3 -m http.server 8000        # then open http://localhost:8000 (3D floor needs http; file:// works with 3D off)
npm test                           # Node rule checks (about 1 minute)
```
- Playwright for Python is installed. Use `CHROME_PATH=/usr/bin/google-chrome`, and see `test/_browser.py`.
- Test hooks in the page:
  - `OCUI.start('med')` starts a Manic Monday shift. Set `OCUI.U.mode = 'md'` first for the attending.
  - `OCUI.start('train')` starts Orientation, and `OCUI.start('train', 'c_mpe')` starts a lesson.
  - `OC.step(minutes)` advances the sim, `OC.G` is the full state, and `OC.botStep({})` runs the autopilot.
- The outbound network is restricted: edcodeblack.com and supabase.co are unreachable from this container.

## Screenshots
`docs/audit/screenshots/` holds about 36 screens at each of four sizes: `phone` 390x844, `phone-land` 844x390, `tablet` 820x1180 and `desktop` 1440x900.
- Names are `<size>-<nn>-<screen>.png`.
- They cover: first visit/About, the menus, class codes (including the error and empty states), Lessons, How to play, the glossary and Settings.
- The charge-nurse shift: the first-shift card, early, midday, the patient card, Next, team, divert, list board, pause and the end-of-shift report.
- The attending: the order sheet, a diagnosis question, the radio call, the legal-risk call and the "fired" game-over.
- Orientation, a lesson card, and the password gate's "can't reach the server" error.
- They were generated by `test/audit_shots.py`, so you can rerun or extend it in your scratch space.

## Rules for reviewers
- **Read-only:** do not edit, create or delete any project file except your own report at `docs/audit/reviewer-N-<role>.md`.
- Put scratch scripts in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/`, in your own subfolder.
- Don't run `npm install` with new packages in the repo, and don't commit.
