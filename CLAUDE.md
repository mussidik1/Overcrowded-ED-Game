# CLAUDE.md

Guidance for working in this repository: **Emergency Department: Code Black**, an ED shift survival game. It was called Overcrowded until v0.20, which is why the repo, the `oc-` storage keys, the `OC` global and the `overcrowded-` cache names still use the old name.

## What it is

The player runs one shift (07:00 to 19:00) in a 32-bed emergency department, on a phone first. There are two roles:

- **Charge nurse** (`mode: 'rn'`): runs the board. Registration, triage, beds, providers, EVS, consults, diverts, getting patients upstairs or transferred.
- **Attending** (`mode: 'md'`): sees patients, writes orders, picks the diagnosis, makes the disposition call, and answers EMS medical-direction radio calls.

Menu structure: **Play a shift** (Five-Minute Rush, Quiet Tuesday, Manic Monday, Full Moon Friday, plus scenarios, weather and class codes), **Learn** (Orientation with a scripted preceptor, and short per-condition Lessons), **Settings**. It is a teaching tool for nursing and EM classes. The README has the full player-facing description.

Live at https://edcodeblack.com (CNAME). Since v0.29.1, `.github/workflows/pages.yml` deploys it: on a push to `main` it checks the build, runs `npm test`, and publishes only the game files (`index.html`, `sw.js`, the manifest, icons, `apple-touch-icon.png`, `og.jpg`, `img/`, `3d/`, `CNAME`, `THIRD_PARTY_NOTICES.txt`, and `deploy.txt`, which names the commit and run so the live check knows it is testing this deployment). The source, tests, docs and this file stay off the website. A new file the game loads at runtime must be added to that workflow's package step. That site and `*.github.io` show a password gate during private testing (see "Backend" below). The repo is public (since Nov 25, 2026; it was private from Nov 18), so anyone can read the source and this file.

## Branches and releases

- Work happens on `3d`. It is merged into `main` with `--no-ff`, and `main` deploys to Pages through the workflow (tests first). (A Claude session may be told to use a different branch; follow that.)
- A release: bump `package.json` `version`, set `PAST_V` in `ui.js` to the version being replaced (one entry only: each entry makes typos more likely to read as stale), add a paragraph for it to the README, rebuild, run the tests, commit on `3d`, merge into `main`, push. **If the release has a new file in `supabase/migrations/`, the owner applies it to the live project first** (after the Tests workflow, its PostgreSQL 17 database job included, is green on `3d` at that commit; he pastes it from that commit), then its SHA-256 goes into `supabase/migrations/applied.sha256` (an applied migration is frozen: a change goes in a new file); the deploy checks the live database before it publishes and stops if the migration isn't there or one was skipped. The history of record is the status doc in the owner's claude.ai Project, not this repo. A private Claude artifact copy is also republished each release: `node tools/pack3d.js <dir>` makes it, and it needs the claude.ai artifact tools.
- WebKit CI results: `git fetch origin ci-results && git show FETCH_HEAD:webkit.txt`.
- **Before a merge into `main`:** the Tests workflow is green on `3d` at the exact commit being merged, and `docs/SMOKE.md` has been run on a phone. The deploy (`pages.yml`, from `main` only) re-runs the build check, `npm test`, stress, the database rules on a local PostgreSQL 17 and `class_test.py`, then checks the live database (`test/db_live.js`; it stops the release if the migration isn't applied), publishes, and checks the live site: `deploy.txt` names this run, the new version and cache name are in `index.html` and `sw.js` at the Pages address and at edcodeblack.com, and the source, docs and CLAUDE.md answer 404. `db_live.js` also stops the release if the live database's fingerprint doesn't match `supabase/tests/fingerprint.json`.
- **Rolling back:** `git revert -m 1 <merge commit>` on `main` and push: the deploy republishes the previous version. The database stays as it is (a live database ahead of the game passes the deploy's check). (A rollback to v0.30.0 restores that version's deploy workflow, which doesn't check the database.) For a v0.31.0-or-later deploy while Supabase itself is down, run the Deploy workflow by hand from `main` with **skip_db_check** ticked **and a reason**; it also skips the local PostgreSQL and class-results tests (they need outside package servers), which the Tests run on `3d` already passed. If the live-site check reports a published source file, roll back first, then check Settings > Pages (Source must be "GitHub Actions"; the custom domain edcodeblack.com).

## Working with the owner

The owner is a paramedic and EMS educator. He reads replies on the phone app.

- **Replies:** short, direct, declarative sentences. Put anything he'll copy and paste in one complete block, never in pieces.
- **Review rule (the owner's decisions: Nov 24, 2026, six reviewers, not nine; Nov 26, 2026, once per release, not per step):** once per release, on the release's whole diff, run the six audit reviewers (not after every step or batch of changes): R1 architecture, R2 tooling and legal, R3 game tech, security and privacy, R4 UI/UX, R5 player and game design, R6 clinical accuracy (roles and report format in `docs/audit/BRIEF.md` and `docs/PRO_AUDIT.md`). Brief each one as a hostile, nitpicky professional in that role who hates the project: assume it is broken, verify every claim in the code and the running game, and report everything down to Nitpick. Fix their serious findings before shipping to `main`. To save usage, a second agent re-checks only Critical and High findings, and the drift check and CTO memo (`spec/`) run only at a release. (This replaced the earlier rule of three extra reviewers prompted *"Pretend you are a senior software engineer, and you absolutely HATE this project. What would you critique about this project after a comprehensive review."*: don't run those as well.) Spawn other subagents only when he asks; this rule counts as asking. Run the "CEO agent" only when he says "run the CEO agent". Never use a subagent to get around a denied action.
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
- **Cardiac arrest is modeled on ACLS and PALS** (audit phase 1, reworked in round 2). The rhythm and the reversible cause follow the case (`CAUSE_OF`, `TRAUMA_CASES`, `LIMB_CASES`, `BLEED_SRC` in engine.js); otherwise they come from the patient id. Children under 13 get PALS cards with doses by an estimated weight (`kgOf`). When the attending runs the code, each rhythm check is a card `CODE_GAP` game minutes apart, followed by a result card. The answers, the rhythm and the minutes before a doctor got there set the ROSC odds (`CODE_BASE`; a game-run doctor scores `CODE_AI_Q`). `lintCode()` checks the card data at load. Your own patient's arrest shows **Run the code** with a countdown; another provider's patient gets a code at once; a code whose doctor leaves restarts its 20 minutes. An arrest nobody runs for 20 minutes is a death, and it counts. **No licensed clinician has reviewed this content yet.**
- **Clinical rules that depend on the moment use `CONTRA_IF`** (add with `addContraIf`, which merges): tenecteplase outside 4.5 hours of last known well (unknown onset counts as outside), nitroglycerin and opioids under SBP 90, metoprolol with signs of shock, NSAIDs in chest pain before the troponin, rate control in unstable A-fib (which needs synchronized cardioversion). `CONTRA_WHY` gives the reason the harm message shows; it must never name a diagnosis the player hasn't made.
- **ECGs are drawn, not photos** (v0.34, the owner, Nov 28, 2026: no licensing worries for a future Steam release). `ecgTrace` in engine.js is a heart-vector model: each wave is Gaussian bursts of one 3D vector and each lead reads it along its own axis, so the leads agree. The reading text (`p.find.ecg`) picks the pattern; `lintEcg()` fails at load if a reading has none, and `rules16.js` measures each pattern. On a regular attending shift every ECG (and an ambulance's 12-lead) needs the attending's signature: STEMI, No STEMI, or Repeat ECG on Arrival; scored when the patient leaves. Never show the written reading to the attending on a regular shift.
- **Same-class drug alternatives are neutral** ("works, but not the first choice"): they neither fill the slot nor score as wrong. Ondansetron and acetaminophen are never wrong.
- **Class codes stay six characters.** Since v0.29.1 the game version is folded into the check characters, so a code from another version is usually refused (about 63 in 64) instead of becoming a different shift.
- **Rejected:** pixel art or flat styles for 3D; Cloudflare Access or an email login for the gate; easier regular levels; routine work that runs itself; a CSP on the Claude artifact copy (it breaks the host); hardening the gate (it's deleted at launch). Renumbering rooms is left alone because Orientation, Lessons and tests name rooms by number.
- New clinical content follows `docs/em-model/PLAN.md`: critical and emergent conditions only, high-yield first, worked in chunks by body system, each case with a lesson. When a case adds a lesson, update the lesson count in `test/train_test.py`.

## How it ships

The game is **one self-contained `index.html`**. `build.js` inlines the engine, UI, floor plan, CSS and the Cardo fonts (base64) into it. Files outside it:

- `3d/map3d.js` plus `3d/*.glb`: the optional 3D floor, loaded on demand. It needs http(s), so it is off under `file://`.
- `sw.js`: a service worker for offline play, **generated by `build.js`**. Its cache name is `overcrowded-<version>-<hash of index.html>`.
- `manifest.webmanifest`, `icons/`, `apple-touch-icon.png`, `og.jpg`, `img/` (imaging pictures, credited in `img/credits.json`).

`build.js` also writes a Content Security Policy into the page, allowing the two inline scripts by sha256 hash. Inline event handlers (`onclick=` and the like) are blocked, so use the delegated listeners in `bind()`. `tools/pack3d.js` strips the CSP from the private Claude copy.

`index.html`, `sw.js` and `3d/map3d.js` are **build outputs that are committed**. After editing anything in `src/` or `src3d/`, run `npm run build` and commit the rebuilt files with the source. Never hand-edit those three files.

## Layout

```
src/engine.js            simulation, no DOM (~5,100 lines). Exposes window.OC, or module.exports under Node
src/ui.js                phone-first UI (~3,500 lines). Reads OC.G, calls OC actions. Exposes window.OCUI
src/backend.json         the Supabase address, publishable key and privacy contact (build.js puts them in the page and its CSP)
supabase/                the Code Black database: baseline, migrations (applied.sha256 freezes the applied ones), tests
src/map.js               SVG floor plan. Spliced into ui.js at /*MAP*/ at build time, not a separate file at runtime
src/style.css            all styles
src/index.template.html  page shell with /*FONTS*/ /*STYLE*/ /*ENGINE*/ /*UI*/ placeholders
src3d/map3d.js           3D floor (three.js). esbuild bundles it to 3d/map3d.js
build.js                 builds index.html and sw.js. Stops if engine.js or ui.js+map.js fails to parse
build3d.js               esbuild call for the 3D bundle
test/rules*.js           Node rule checks against src/engine.js (npm test); rules11.js and rules12.js hold the audit's clinical fixes, rules13.js the attending's numbers sent to the instructor, rules14.js the Phase 3 clinical content (v0.32), rules15.js the v0.33 grading, giveaway and save rules, rules16.js the v0.34 drawn ECGs (measured) and the ECG signature
test/golden.js           a change detector: seeded-shift behaviour fingerprints, class sync, class codes, save round trips, answer keys, code cards, drug rules, scripted codes
test/sim.js, stress.js   simulated shifts, and 188 shifts across every level and scenario
test/*_test.py           Playwright UI tests against the built index.html (test/_browser.py picks the browser)
art/blender/             Blender scripts that made the 3D models in 3d/
docs/em-model/           the plan and parsed item lists for adding conditions from the ABEM 2022 EM Model
docs/screenshots/        README images
tools/                   3D asset packing and optimisation scripts; name_ranges.py makes the server name rule's Unicode lists
test/db_live.js          the live database check the deploy runs before it publishes (not from a Claude container)
```

### Engine (`src/engine.js`)

- **All game state is one plain-JSON object, `G`** (`G.v === 5` is the save format). Saves (`localStorage['oc-save']`), resume and hot reload work by serialising `G`, so keep it JSON-safe: no functions, Maps or class instances in `G`.
- `OC.newGame(level, seed, opts)` starts a shift. `OC.step(dtMinutes)` advances it; the UI calls it in slices of 0.1 game minutes or less. `OC.botStep()` is an autopilot. It fills the board before the shift starts, runs the title-screen demo, and drives the tests.
- The UI talks to the engine only through the `OC` object at the bottom of the file, plus `OC.hooks` (`toast`, `sound`, `arrive`) for callbacks. To use a new engine function from the UI, add it to `OC`.
- The file is split into sections with `/* ---------- name ---------- */` headers: static data (LEVELS, SCENS, ZONES, ROOMS, ROSTER, SPECS), orders and drugs, diagnosis/accuracy/litigation, arrivals, vitals, placement, providers, physician mode, nurses, intake, transport, techs, RT, pharmacy, blood bank, imaging/consults, goals, dispositions, events, Orientation, end of shift, autopilot, and the v0.29 conditions.
- **New conditions are data.** v0.29 added a compact case format: one object per condition goes through `addCase()`, which files it into CASES, NEED, RES, EXAM, DDX, RXOK and the other tables. `addCase` checks each entry, and `lintCases()` checks every case (old ones too) once the file has loaded. Both throw, so broken data fails at load instead of during a shift. `test/rules10.js` then plays every case the textbook way and expects a clean score.
- **Drug scoring tables:** `RXOK` (right drugs), `RXREQ` (combinations: one drug from each group), `REQ_AGE` (required by age), `ALSO` (fine add-ons), `CONTRA` and `CONTRA_IF` (harm, and when), `NEVER_WRONG`, and `SAME_CLASS_OK` (classes where a same-class drug is "works, but not the first choice"). `HCG_CASES` lists the cases where women 12 to 55 need a pregnancy test.

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
2. The code packs 24 bits: role (1 bit), level (2: rush/easy/med/hard), scenario (3), radio-call pack (1), seed (17). A 6-bit checksum (`codeSum`, salted with the game version since v0.29.1; the UI sets it with `setCodeVersion(GAME_V, PAST_V)`) brings it to 30 bits, written as six Crockford-style base-32 characters shown as `ABC-DEF`. The alphabet has no I, L, O or U.
3. Students type the code, or receive it with Copy or Share. `readCode` uppercases it, reads O as 0 and I or L as 1, drops punctuation, and checks the checksum. About 63 of 64 mistyped codes are rejected before Start. A code that matches a version in `PAST_V` comes back with `stale` set: it can't be played, but the instructor can still read its class results. `codePlay` sets the role, scenario and pack from the code and starts the shift with its seed.

The bit layout depends on the **order of keys in `SCENS` and `PACKS`** (and `CODE_LV`). Reordering or inserting keys changes what existing codes mean. Only append. There are 3 bits for scenarios (up to 8) and 1 bit for packs (up to 2).

## The randomness (the game's "dice")

- `rnd()` is a mulberry32-style PRNG whose state lives in `G.rng`, so a saved game resumes on exactly the same sequence. `randi`, `pick`, `chance`, `expo` (exponential inter-arrival times) and `wpick` (weighted pick) build on it. **Never call `Math.random()` inside the engine**: it breaks saves, class codes and test reproducibility. (`ui.js` uses `Math.random()` for a new shift's or code's seed, list shuffles and audio noise: never for anything the engine decides.)
- **Separate streams** (since v0.20): `inStream('rngA' | 'rngE' | 'rngM' | 'rngL' | ..., fn)` swaps in a sub-generator derived from the shift seed by `seedOf(seed, k)`. Walk-in arrivals, EMS arrivals and random events each draw from their own stream, so two students on the same code get the same patients and events at the same times however differently they play. The exceptions are play-driven by design: return visits (bounce-backs from that player's own discharges), and EMS or events held back by diversion. `test/golden.js` checks the first two hours exactly and new walk-ins all shift. Outcomes and delays use the main stream and can differ between players. `sub(fn)` gives each spawned patient its own short sub-seed, so how many draws a patient's setup makes doesn't shift the next arrival.
- Arrival rates come from `LEVELS[level].walk/ems`, multiplied by `HOUR_MUL[hour]` and the weather. Orientation (`train`) turns off random arrivals and events completely.
- Some clinical facts deliberately come from the patient id, not the dice. For example, whether a stroke arrives over the thrombolytic BP limit.

When you add anything random that should be the same for every player on a code (a new event or arrival type), draw it inside the right `inStream`. Otherwise it desynchronises class shifts.

## Backend (small, optional)

Class results and the testing gate use **Supabase, the same project as Case Room**. The address, the publishable key (public by design) and an optional privacy contact are in `src/backend.json`; `build.js` puts them in the page (`CB` in `ui.js`) and the CSP. Since v0.31.0 the whole Code Black database is in `supabase/` (`supabase/README.md` explains it), and the results sit in a `codeblack` schema that the API doesn't expose. The functions are the only way in:

- `rpc/cb_class_new`: making a class code registers it with an **instructor key** (16 characters) that the game makes and keeps on that device (`oc-ckeys`, `{ v: 1, c: { code: { k, t, p, s, e, x, g } } }`: the key, when the server made the class, unconfirmed, shown, when it ends, ended, taken by another class). Repeating it is safe; a code another class has comes back `taken`, and the game makes another before showing it. A code shows only once the server has registered it (if the server can't be reached, or class results are full, the instructor may use it without results; not when the network is busy, which someone else can cause). The key stays hidden until the instructor taps Show key, and is masked when typed.
- `rpc/cb_submit`: a student sends their summary: initials (the game sends 1 to 4 letters since v0.33; the server still accepts a short name), score 0 to 100, stars, real time played, stats (`client_call.json` lists the keys), the version the shift was played on, and the result's own id (kept once however often it's retried). The name is never stored on the device.
- `rpc/cb_class_read`, `rpc/cb_class_delete`: the instructor's Class results list, and deleting one result or all. Both need the key. Copy table and Download CSV export it.
- `rpc/cb_health`: for the deploy's check and the daily watch (`db-watch.yml`): every migration recorded live, whether the clean-up runs, whether callers' addresses are read and public, how full the storage backstops and the held codes are, and a fingerprint of the database's functions, tables and clean-up job (`codeblack.fingerprint()`, which must match `supabase/tests/fingerprint.json`; `run.sh` prints a new one when the unapplied migration changes). No class data.
- `rpc/cb_gate_on`, `rpc/cb_gate_check`: the password gate, active only on `edcodeblack.com/.net` and `*.github.io` (`GATED`). The password is checked by bcrypt hash in the database, and a device that passed the gate once can play offline.

A class lasts 14 days until its first result, then 30 days from when it was made; then its results are deleted, and its code is held 30 more days with only its key's hash (so nobody else can take it; past 30,000 held codes a new code is refused as full, and none is released early). A class that ended with no result is started again by a student's first result during that hold, so a code made ahead of a class works up to 44 days after it was made, on the same game version. The device keeps a key 74 days from when its class was made (a class started again by a first result on day 44 lives to day 74). Rate limits are per network, per UTC hour and day, by a daily-salted hash of the address. Every call gives up after 8 seconds (`cbFetch`), and a failure says whether it was the network, a timeout or the server. Everything else runs offline in the browser.

- **Changing the database:** add a new file to `supabase/migrations/`, run `npm run db:test` (a throwaway local Postgres; also a CI job, on PostgreSQL 17 as live; while the newest migration is unapplied, it prints a new `supabase/tests/fingerprint.json` whenever the migration changes, to commit with it), and get the owner's approval before it goes to the live project (he pastes it into the SQL editor, or approves the tool call; the Supabase tool turns `\uXXXX` escapes into characters, so a migration with them must be pasted). **The database goes first, then the game:** the Pages deploy runs `test/db_live.js` before it publishes and stops if the live database doesn't have the release's migration (or a newer one). Each migration refuses to run over a newer one and records its own name in `codeblack.migrations`. Once applied, add its SHA-256 to `supabase/migrations/applied.sha256` (`run.sh` refuses an edited applied migration, or a new one that sorts before an applied one). A migration must keep the previous release's game and its `db_live.js` passing: add first, remove a release later. This container's network can't reach supabase.co, so that check runs in CI. `supabase/tests/client_call.json` is the contract: the calls the game makes, the errors each function gives, the keys of each answer, and the names both sides accept and refuse. Change it, `ui.js` and the SQL together.

## Running it

```sh
npm ci            # esbuild, three, @fontsource/cardo (the build needs node_modules for the fonts)
npm run build     # node build3d.js && node build.js -> 3d/map3d.js, index.html, sw.js
```

- **Quick play:** open `index.html` directly (`file://`). The 3D floor and the service worker are off there, and there's no gate.
- **Full features (3D, offline):** serve the folder, e.g. `python3 -m http.server 8000`, then open http://localhost:8000. No gate on localhost.

## Tests

```sh
npm test          # rules.js through rules16.js: engine rule checks in Node (~850 "ok" lines; any "FAIL:" sets exit 1)
                  #   then golden.js: behaviour fingerprints, stream sync, class codes, save round trips, answer keys
npm run golden:update   # rewrite test/golden.json after an intended change; say why in the commit
npm run lint      # ESLint, correctness rules only (eslint.config.js; tools/lint.js splices map.js into ui.js like the build)
npm run sim       # simulated shifts at several player speeds
npm run stress    # 188 shifts across every level and scenario: stuck states, out-of-range vitals
npm run db:test   # the Supabase migrations and their rules on a throwaway local Postgres (needs PostgreSQL 15+)
npm run db:live   # the live project's rules, from outside (not from a Claude cloud container: supabase.co is blocked)
```

The UI tests are Python Playwright scripts against the **built** `index.html`, so build first. In this cloud container Chromium is preinstalled; use `python3 -m pip install playwright` if the module is missing, and don't run `playwright install`. Common ones: `test/crash_test.py` (the crash guard and broken saves), `map3d_life_test.py` (the 3D loop and a lost WebGL context, served), `test/ui_test.py`, `md_ui_test.py`, `map_test.py`, `train_test.py` (env `MODE=md`, `LESSON=stroke`, `CHAPTER=2`, `VIEW=list`), `finger_test.py`, `class_test.py`, `offline_test.py`, `map3d_test.py`, `imaging_test.py`, `gate_test.py`, `events_test.py`, `about_test.py`. `BROWSER=webkit|firefox` switches engines and `CHROME_PATH` points at a local Chrome (see `test/_browser.py`). Screenshots go to `test/shots/` (gitignored).

Practical notes:
- **`test/golden.js` is a change detector, not a correctness check.** It records what the game does today: a change that moves a shift's outcomes, a class code's layout, a save round trip, an answer key (drug keys, radio calls, the pregnancy-test list), any code card's text, answers or reasons, the drug-scoring rule lists, or the outcome of 80 scripted codes fails it, with a readable diff for the content. If the change is intended, run `npm run golden:update` and say in the commit which golden lines moved and why. Whether the content is *right* is checked by the rule tests (`rules10.js` plays every case, `rules11.js` and `rules12.js` check the clinical rules and code cards). `docs/SMOKE.md` is the by-hand phone checklist before a merge into `main`.
- **Seed-dependent tests break when arrival timing changes.** If an old rule test fails after an engine change, check whether it relied on one specific random shift before assuming a real bug.
- `map3d_test.py` needs the folder served (`python3 -m http.server 8765`) and takes about 15 minutes with software GL.
- A full lesson sweep is `LESSON=<key> python3 test/train_test.py` for every key. Case lessons are named `c_<case>`.
- Imaging comes from Wikimedia and Open-i. Credit each picture in `img/credits.json`, and wait 4 to 12 seconds between fetches.

CI (`.github/workflows/tests.yml`): every push to any branch, and every pull request, builds, fails if the committed build doesn't match the source, then runs `npm run lint`, `npm test` and `npm run stress`, the database rules on a local Postgres, and the Chrome UI tests on Ubuntu. The WebKit UI suite runs on macOS for `main` or a manual run, and writes its results to `webkit.txt` on the `ci-results` branch. The repo is public, so these runners cost no Actions minutes; if it goes private again, macOS minutes count ten times against the monthly allowance (the WebKit job used up a month's 3,000 in Nov 2026).

## Conventions

- Player-facing text is plain, short English. Clinical terms get a plain gloss (the "Plain words" setting, `DX_PLAIN`, `FIND_PLAIN`, the Words glossary). Results read as findings, so the diagnosis stays the player's call.
- Each release adds tests for its new rules. Commit messages start `vX.Y.Z: ...`.
- **License:** all rights reserved (the owner's choice, Nov 26, 2026; `LICENSE`). Third-party licence texts are in `THIRD_PARTY_NOTICES.txt`; image credits are written from `img/credits.json` by `node tools/credits.js`.
- **Errors:** `frame()` and taps run inside a crash guard (`crash()` in ui.js): an error stops the shift with a message and keeps the last good save. Saves are checked by `saveShape()`; a new save format needs a `MIGRATE` entry. Tutorial step errors go to `window.__coachErrs`, and `train_test.py` fails on any.
