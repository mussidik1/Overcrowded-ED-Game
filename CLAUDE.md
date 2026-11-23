# CLAUDE.md

Guidance for working in this repository: **Emergency Department: Code Black**, an ED shift survival game. It was called Overcrowded until v0.20, which is why the repo, the `oc-` storage keys, the `OC` global and the `overcrowded-` cache names still use the old name.

## What it is

The player runs one shift (07:00 to 19:00) in a 32-bed emergency department, on a phone first. There are two roles:

- **Charge nurse** (`mode: 'rn'`): runs the board. Registration, triage, beds, providers, EVS, consults, diverts, getting patients upstairs or transferred.
- **Attending** (`mode: 'md'`): sees patients, writes orders, picks the diagnosis, makes the disposition call, and answers EMS medical-direction radio calls.

Menu structure: **Play a shift** (Five-Minute Rush, Quiet Tuesday, Manic Monday, Full Moon Friday, plus scenarios, weather and class codes), **Learn** (Orientation with a scripted preceptor, and short per-condition Lessons), **Settings**. It is a teaching tool for nursing and EM classes. The README has the full player-facing description.

Live at https://edcodeblack.com (CNAME; GitHub Pages serves the repo root). That site and `*.github.io` show a password gate during private testing (see "Backend" below). The repo is private.

## Branches and releases

- Work happens on `3d`. It is merged into `main` with `--no-ff`, and `main` deploys to Pages. (A Claude session may be told to use a different branch; follow that.)
- A release: bump `package.json` `version`, add a paragraph for it to the README, rebuild, run the tests, commit on `3d`, merge into `main`, push. The history of record is the status doc in the owner's claude.ai Project, not this repo. A private Claude artifact copy is also republished each release: `node tools/pack3d.js <dir>` makes it, and it needs the claude.ai artifact tools.
- WebKit CI results: `git fetch origin ci-results && git show FETCH_HEAD:webkit.txt`.

## Working with the owner

The owner is a paramedic and EMS educator. He reads replies on the phone app.

- **Replies:** short, direct, declarative sentences. Put anything he'll copy and paste in one complete block, never in pieces.
- **Hostile review rule:** after any change bigger than a bug fix, run three subagents, each with exactly this prompt: *"Pretend you are a senior software engineer, and you absolutely HATE this project. What would you critique about this project after a comprehensive review."* Fix their serious findings before shipping. Spawn other subagents only when he asks; this rule counts as asking. Run the "CEO agent" only when he says "run the CEO agent". Never use a subagent to get around a denied action.
- **Privacy:** never send his email to an external service without his explicit approval. The gate password stays out of the repo (it's in his status doc).
- **Gate:** stays on until he says "launch". Launch is one SQL line: `update public.cb_gate set gate_on = false where id = 1;`
- **Database changes** to the Supabase project need his approval each time.
- **Third-party files:** read them before publishing them anywhere.

## Design rules (his, from feedback)

- Every font is **Cardo**.
- **Not Maryland-centric.** The General radio pack is the default; the MIEMSS pack is opt-in. Capacity alerts have neutral names ("ED Full", "No Monitored Beds").
- **The player directs the work.** Nothing that should be a player decision happens on its own: EVS, provider assignment, registration, triage, transport, IFT, diversion, gray-zone dispositions.
- Two roles. EMS medical direction belongs to the attending only. For the charge nurse, an EMS call is a notification or gets routed to a physician.
- Teach in Orientation and the Lessons. Don't make the regular levels easier.
- A lay person must be able to learn from the tutorial: explain every term and acronym without cutting the complexity. Prompts use few words with key words in bold.
- It must stay fun and credible for working charge nurses and attendings.
- The board is a sideways floor plan, 3D by default; the list board stays as an option. 3D defaults to battery-saver detail at pixel ratio 2 (ratio 1 was blurry on a 3x iPhone).

## Decisions worth knowing

- **The hospital has neurosurgery** (it takes trauma) but **no cardiac surgery**: dissections transfer out, and cardiothoracic is a phone consult.
- **Same-class drug alternatives are neutral** ("works, but not the first choice"): they neither fill the slot nor score as wrong. Ondansetron and acetaminophen are never wrong.
- **Class codes stay six characters.** A version check folded into the check characters (planned for v0.29.1 as `codeStale`) refuses codes from another version, instead of making the code longer.
- **Rejected:** pixel art or flat styles for 3D; Cloudflare Access or an email login for the gate; easier regular levels; routine work that runs itself; a CSP on the Claude artifact copy (it breaks the host); hardening the gate (it's deleted at launch). Renumbering rooms is left alone because Orientation, Lessons and tests name rooms by number.
- New clinical content follows `docs/em-model/PLAN.md`: critical and emergent conditions only, high-yield first, worked in chunks by body system, each case with a lesson. When a case adds a lesson, update the lesson count in `test/train_test.py`.

## How it ships

The game is **one self-contained `index.html`**. `build.js` inlines the engine, UI, floor plan, CSS and the Cardo fonts (base64) into it. Files outside it:

- `3d/map3d.js` plus `3d/*.glb`: the optional 3D floor, loaded on demand. It needs http(s), so it is off under `file://`.
- `sw.js`: a service worker for offline play, **generated by `build.js`**. Its cache name is `overcrowded-<version>-<hash of index.html>`.
- `manifest.webmanifest`, `icons/`, `apple-touch-icon.png`, `og.jpg`, `img/` (imaging pictures, credited in `img/credits.json`).

`index.html`, `sw.js` and `3d/map3d.js` are **build outputs that are committed**. After editing anything in `src/` or `src3d/`, run `npm run build` and commit the rebuilt files with the source. Never hand-edit those three files.

## Layout

```
src/engine.js            simulation, no DOM (~4,400 lines). Exposes window.OC, or module.exports under Node
src/ui.js                phone-first UI (~2,800 lines). Reads OC.G, calls OC actions. Exposes window.OCUI
src/map.js               SVG floor plan. Spliced into ui.js at /*MAP*/ at build time, not a separate file at runtime
src/style.css            all styles
src/index.template.html  page shell with /*FONTS*/ /*STYLE*/ /*ENGINE*/ /*UI*/ placeholders
src3d/map3d.js           3D floor (three.js). esbuild bundles it to 3d/map3d.js
build.js                 builds index.html and sw.js. Stops if engine.js or ui.js+map.js fails to parse
build3d.js               esbuild call for the 3D bundle
test/rules*.js           Node rule checks against src/engine.js (npm test)
test/sim.js, stress.js   simulated shifts, and 188 shifts across every level and scenario
test/*_test.py           Playwright UI tests against the built index.html (test/_browser.py picks the browser)
art/blender/             Blender scripts that made the 3D models in 3d/
docs/em-model/           the plan and parsed item lists for adding conditions from the ABEM 2022 EM Model
docs/screenshots/        README images
tools/                   3D asset packing and optimisation scripts
```

### Engine (`src/engine.js`)

- **All game state is one plain-JSON object, `G`** (`G.v === 5` is the save format). Saves (`localStorage['oc-save']`), resume and hot reload work by serialising `G`, so keep it JSON-safe: no functions, Maps or class instances in `G`.
- `OC.newGame(level, seed, opts)` starts a shift. `OC.step(dtMinutes)` advances it; the UI calls it in slices of 0.1 game minutes or less. `OC.botStep()` is an autopilot. It fills the board before the shift starts, runs the title-screen demo, and drives the tests.
- The UI talks to the engine only through the `OC` object at the bottom of the file, plus `OC.hooks` (`toast`, `sound`, `arrive`) for callbacks. To use a new engine function from the UI, add it to `OC`.
- The file is split into sections with `/* ---------- name ---------- */` headers: static data (LEVELS, SCENS, ZONES, ROOMS, ROSTER, SPECS), orders and drugs, diagnosis/accuracy/litigation, arrivals, vitals, placement, providers, physician mode, nurses, intake, transport, techs, RT, pharmacy, blood bank, imaging/consults, goals, dispositions, events, Orientation, end of shift, autopilot, and the v0.29 conditions.
- **New conditions are data.** v0.29 added a compact case format: one object per condition goes through `addCase()`, which files it into CASES, NEED, RES, EXAM, DDX, RXOK and the other tables. `addCase` checks each entry when the file loads (unknown drugs, tests or specialists, missing text, a `ddx` without exactly three wrong choices) and throws, so a broken case fails at load instead of during a shift.

### UI (`src/ui.js`)

- `U` holds UI state (scene, role, view, speed, the open sheet or modal, and so on). `render()` redraws from `OC.G` and `U` about every 110 ms in the `frame()` loop.
- Taps are delegated: elements carry `data-act="name" data-arg="..."`, and `bind()` sends them to the `ACT` table. To add a button, add a `data-act` and an `ACT` entry.
- Time scale: `BASE = 0.4` game minutes per real second at 1×, so a 12-hour shift is about 30 minutes; speeds go 1× to 4×.
- Two board views: the floor plan (`map.js`, SVG, with an optional 3D floor from `src3d/`) and a list board (`U.view = 'list'`). `map.js` hands the 3D floor a snapshot of the department every frame and receives its taps.
- Settings persist in `localStorage` under `oc-*` keys.
- `GAME_V` is injected from `package.json`'s `version` at build time. Bump `version` for every release, because class codes are only guaranteed to match on the same version.

## Class codes: how a class joins the same shift

This game has **no QR join and no dice**. Those are in the separate Case Room project. Here, an instructor gives the class a typed code, and every random draw comes from a seeded generator, so the same code always produces the same shift.

**Making and joining a code** (`engine.js`: `classCode`, `readCode`; `ui.js`: the Class code screen, `ACT.codeMake` and `ACT.codePlay`):

1. The instructor opens Play a shift, then Class code, and picks a shift. `codeMake` calls `OC.classCode({ mode, level, scen, pack, seed })` with a random 17-bit seed.
2. The code packs 24 bits: role (1 bit), level (2: rush/easy/med/hard), scenario (3), radio-call pack (1), seed (17). A 6-bit checksum (`codeSum`) brings it to 30 bits, written as six Crockford-style base-32 characters shown as `ABC-DEF`. The alphabet has no I, L, O or U.
3. Students type the code, or receive it with Copy or Share. `readCode` uppercases it, reads O as 0 and I or L as 1, drops punctuation, and checks the checksum. About 63 of 64 mistyped codes are rejected before Start. `codePlay` sets the role, scenario and pack from the code and starts the shift with its seed.

The bit layout depends on the **order of keys in `SCENS` and `PACKS`** (and `CODE_LV`). Reordering or inserting keys changes what existing codes mean. Only append. There are 3 bits for scenarios (up to 8) and 1 bit for packs (up to 2).

## The randomness (the game's "dice")

- `rnd()` is a mulberry32-style PRNG whose state lives in `G.rng`, so a saved game resumes on exactly the same sequence. `randi`, `pick`, `chance`, `expo` (exponential inter-arrival times) and `wpick` (weighted pick) build on it. **Never call `Math.random()` inside the engine**: it breaks saves, class codes and test reproducibility. (`ui.js` uses `Math.random()` only to choose a new code's seed.)
- **Separate streams** (since v0.20): `inStream('rngA' | 'rngE' | 'rngM' | 'rngL' | ..., fn)` swaps in a sub-generator derived from the shift seed by `seedOf(seed, k)`. Walk-in arrivals, EMS arrivals and random events each draw from their own stream, so two students on the same code get the same patients and events at the same times however differently they play. Outcomes and delays use the main stream and can differ between players. `sub(fn)` gives each spawned patient its own short sub-seed, so how many draws a patient's setup makes doesn't shift the next arrival.
- Arrival rates come from `LEVELS[level].walk/ems`, multiplied by `HOUR_MUL[hour]` and the weather. Orientation (`train`) turns off random arrivals and events completely.
- Some clinical facts deliberately come from the patient id, not the dice. For example, whether a stroke arrives over the thrombolytic BP limit.

When you add anything random that should be the same for every player on a code (a new event or arrival type), draw it inside the right `inStream`. Otherwise it desynchronises class shifts.

## Backend (small, optional)

Class results and the testing gate use **Supabase, the same project as Case Room** (`CB` in `ui.js`; the key there is the publishable one, which is meant to be public):

- `POST /rest/v1/cb_results`: a student sends their summary for a code (name, score, stars, real time played, a few stats).
- `rpc/cb_class`: the instructor's "Class results" table for a code.
- `rpc/cb_gate_on`, `rpc/cb_gate_check`: the password gate, active only on `edcodeblack.com/.net` and `*.github.io` (`GATED`). The password is checked by bcrypt hash in the database, and a device that passed the gate once can play offline.

The table, row-level security and functions live in the Supabase project, not in this repo. Everything else runs offline in the browser.

## Running it

```sh
npm ci            # esbuild, three, @fontsource/cardo (the build needs node_modules for the fonts)
npm run build     # node build3d.js && node build.js -> 3d/map3d.js, index.html, sw.js
```

- **Quick play:** open `index.html` directly (`file://`). The 3D floor and the service worker are off there, and there's no gate.
- **Full features (3D, offline):** serve the folder, e.g. `python3 -m http.server 8000`, then open http://localhost:8000. No gate on localhost.

## Tests

```sh
npm test          # rules.js through rules9.js: engine rule checks in Node (~490 "ok -" lines; any "FAIL:" sets exit 1)
npm run sim       # simulated shifts at several player speeds
npm run stress    # 188 shifts across every level and scenario: stuck states, out-of-range vitals
```

The UI tests are Python Playwright scripts against the **built** `index.html`, so build first. In this cloud container Chromium is preinstalled; use `python3 -m pip install playwright` if the module is missing, and don't run `playwright install`. Common ones: `test/ui_test.py`, `md_ui_test.py`, `map_test.py`, `train_test.py` (env `MODE=md`, `LESSON=stroke`, `CHAPTER=2`, `VIEW=list`), `finger_test.py`, `class_test.py`, `offline_test.py`, `map3d_test.py`, `imaging_test.py`, `gate_test.py`, `events_test.py`, `about_test.py`. `BROWSER=webkit|firefox` switches engines and `CHROME_PATH` points at a local Chrome (see `test/_browser.py`). Screenshots go to `test/shots/` (gitignored).

Practical notes:
- **Seed-dependent tests break when arrival timing changes.** If an old rule test fails after an engine change, check whether it relied on one specific random shift before assuming a real bug.
- `map3d_test.py` needs the folder served (`python3 -m http.server 8765`) and takes about 15 minutes with software GL.
- A full lesson sweep is `LESSON=<key> python3 test/train_test.py` for every key. Case lessons are named `c_<case>`.
- Imaging comes from Wikimedia and Open-i. Credit each picture in `img/credits.json`, and wait 4 to 12 seconds between fetches.

CI (`.github/workflows/tests.yml`): every push to `main` or `3d` runs `npm ci && npm run build && npm test` on Ubuntu. The WebKit UI suite runs on macOS only for `main` or a manual run, and writes its results to `webkit.txt` on the `ci-results` branch.

## Conventions

- Player-facing text is plain, short English. Clinical terms get a plain gloss (the "Plain words" setting, `DX_PLAIN`, `FIND_PLAIN`, the Words glossary). Results read as findings, so the diagnosis stays the player's call.
- Each release adds tests for its new rules. Commit messages start `vX.Y.Z: ...`.
