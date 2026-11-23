# Reviewer 1: Senior Software Architect

Audit of branch `claude/sleepy-rubin-jot35n` (v0.29.1), Nov 23, 2026. Read-only. Scratch work is in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/r1/`.

## 1. Verdict

**Only after major work.** This is two god files (a 4,486-line, 383 KB engine and a 2,851-line, 330 KB UI, with a 949-line map file pasted into the UI's closure at build time) holding a game whose content is spread across about 30 parallel lookup tables. Those tables are keyed by case id and by exact display strings, and they are patched again 4,000 lines after they are defined. Modules talk to each other by regex-matching each other's English sentences, the save format has no migrations, the backend schema is not in the repo, and one exception anywhere in the step function freezes the game for good with no message. The deterministic, DOM-free simulation core is the only part I would keep as a base. Everything around it needs to be split into modules, typed and turned into data before I put my name on it.

## 2. Score

**3 / 10.** The simulation is deterministic, runs headless and is checked by 528 Node assertions, so it is not worthless. But the structure, content model, coupling and tooling are well below a competent hobbyist's TypeScript-and-modules baseline, and nowhere near a studio's.

## 3. Findings (worst first)

### R1-01 · High · No module system: two god files and a textual splice
- **Location:** `src/engine.js` (4,486 lines, 383 KB, 283 functions, one IIFE). `src/ui.js` (2,851 lines, 330 KB; 185 lines over 300 characters, the longest 1,481). `src/map.js`, which `build.js:17,22` inserts at `/*MAP*/` (`ui.js:2847`) inside the UI's IIFE.
- **What's wrong:** Nothing is a module. `map.js` has no imports. It reads `U`, `E`, `MD`, `ve`, `mapAct`, `esc` and others from the enclosing `ui.js` closure, so it cannot be loaded, linted or tested on its own, and an editor cannot resolve a single symbol in it. The engine's "sections" are comment banners, not boundaries: placement, scoring, litigation, vitals, transport, events, Orientation scripting, the autopilot and all content share one scope and one mutable `G`.
- **Why it matters:** Every change touches a 300 KB file. Nobody can own a subsystem, reviews are unreadable, and the dependency direction inside a file cannot be enforced.
- **Fix:** Use ES modules and bundle them with esbuild, which is already a dependency. Split the code into `core/rng`, `core/state`, `sim/{arrivals,placement,staff,transport,imaging,events,flow}`, `md/{orders,scoring,litigation}`, `content/` (data only), `ui/{hud,board,sheets,coach,report}`, `map2d/`, `map3d/`. `map2d` imports what it uses instead of sharing the UI's closure.
- **Effort:** L

### R1-02 · High · Game content is code, scattered across ~30 parallel tables in two formats, and patched again after definition
- **Location:** The legacy content is the tables at `engine.js:136-488` (`NEED`, `RES`, `POC_RES`, `RXOK`, `CONTRA`, `RXREQ`, `ALSO`, `DDX`) and `:603-661` (`CASES`). More lives in `VCASE` (~960), `EXAM` (1526), `ORD_WHY` (1584), `FIND_PLAIN` (1642), `RADIO_PLAIN` (1668), `DX_PLAIN` (1706), `RX`, `HARM`, `MUST`, `NODX`, `DXQ`, `VHOLD`, `HCG_CASES` (271), `REQ_AGE`, `SAME_CLASS_OK` (436) and `LESSON_CASE`. A second "compact" format arrives in `addCase()` at `engine.js:4222`. The v0.29 section then mutates the core tables in place: `Object.assign(LABS, …)`, `IMGS.scrotus = …`, `Object.assign(SPECS, …)`, `TREAT.ctube = …`, `ORDER_MENUS.find(m => m[0] === 'proc')[2].push('ctube')`, `Object.assign(DRUGS, …)`, `RXOK.dka = Object.assign(…)` (lines ~4262-4300).
- **What's wrong:**
  - One clinical case is defined across up to 20 places. Old cases and new cases use different shapes.
  - Data at line 120 (`tfall` → `con: 'nsurg'`; `SAME_CLASS_OK` → `midaz`, `levet`, `fosphen`) refers to entities that only exist after line 4262. The file works only because nothing reads those tables until the bottom of the file has run.
  - `CONTRA_IF` (`engine.js:422`) is "data" that contains a closure reading the global `G` and calling `vRaw`.
  - No case carries a source guideline or a provider level.
  - Content cannot be edited without editing JavaScript.
- **Why it matters:** It fails the owner's baseline (schema-checked data files, items tagged with source and level). Every new case risks silently colliding with or overriding something 4,000 lines away. A clinician or instructor cannot review or edit content.
- **Fix:** Put one JSON or YAML file per case under `content/cases/`, with a JSON Schema (or zod) that requires `source` and `level`. The build validates every file and generates the lookup indexes. Express conditional rules such as `CONTRA_IF` as data (`{drug:'tnk', unless:{sbp:{lt:90}}}`) that a tested function evaluates. Delete the post-hoc mutation block.
- **Effort:** L

### R1-03 · High · Stringly-typed coupling: display text used as keys and parsed back into data
- **Location and what's wrong:**
  - `engine.js:986-1001` (`vDoor`) regex-parses the case's prose `vit` field (`'HR 98, BP 142/88, sweating'`) back into numbers at runtime, every time vitals are computed.
  - `FIND_PLAIN` and `DX_PLAIN` are keyed by exact result and diagnosis sentences. I measured: of 127 named-test results in `RES`, **48 have no plain-words gloss**, so the "Plain words" teaching feature is silently absent for 38% of results. Each case also stores its findings twice, in `case.find` (by kind) and in `RES` (by test), and **75 of 120 `find` strings match no `RES` string** for the same case. Examples: flu has "Flu A positive" against "Influenza A positive"; pnalow has "Small right lower lobe infiltrate" against "Small right lower lobe pneumonia".
  - `dxPick` (`engine.js:541-544`) decides right or wrong by comparing the tapped button's display string with `dxName(p.ck)` or `p.dx`.
  - The UI regex-matches engine toast sentences to decide overhead audio pages (`ui.js:115-123`, `pageFor`). `map.js:25` (`WORDS_SHORT`) regex-matches status sentences to shorten them. `ui.js:748` hard-codes regex fallbacks for ECG wording.
  - `RADIO_PLAIN` and `RADIO_BTN` are tied to `SCEN` by **array index** (`engine.js:4479-4483`, comment: "Same order as the calls in SCEN"). Nothing checks this: insert one radio call and every later call shows the wrong plain-language text and button labels.
- **Why it matters:** Rewording a sentence changes behaviour or breaks a teaching feature without any error. This is the main way the project will rot as content grows.
- **Fix:** Give every finding, diagnosis, radio call and message an id. Store vitals as numbers. Keep glosses next to the finding they explain. Hooks emit typed events (`{type:'alertAtBay', alert:'stroke', unit}`) and the UI maps types to audio. Validate that every result has a gloss at build time.
- **Effort:** M–L

### R1-04 · High · No fault isolation: one exception freezes the shift for good, and tutorial errors are swallowed
- **Location:** `ui.js:2738-2754` (`frame`) has no try/catch around `E.step`/`render`, and `requestAnimationFrame(frame)` is its last line. The tutorial runner swallows every error: `coachSafe` (`ui.js:2028`), and the setup, text, auto and spot calls (`ui.js:2044, 2061, 2071, 2082, 2106`) each catch and return empty or false.
- **Evidence:** I wrapped `OC.step` to throw once in a live page. The game clock stopped at 07:02 and never moved again, with no message to the player (`throw.py` in my scratch folder).
- **Why it matters:** Any latent engine bug becomes a silent, permanent freeze mid-class. In the tutorial, a broken step shows blank text or never completes, and nobody finds out.
- **Fix:** Wrap each frame in try/catch. On error, pause, keep the last good save, show an error card with a "copy details" button and stop the loop cleanly. Remove the silent catches in the coach. Log and fail tutorial steps loudly in development builds.
- **Effort:** S

### R1-05 · High · The backend contract is not in version control
- **Location:** `ui.js:1982` (`CB` URL and key), the project URL repeated in the CSP at `build.js:31`, and `ui.js` `ACT.cbSend` (~line 2404): "Until the database has the column, the insert is refused (400), so send it again without".
- **What's wrong:** The `cb_results` table, its row-level security, `cb_class`, `cb_gate_on` and `cb_gate_check` live only in a Supabase project shared with another app. The client works around an unknown schema by retrying on any HTTP 400. The config is hard-coded in two files.
- **Why it matters:** The data layer cannot be reproduced, reviewed, rolled back or tested. The retry hides real validation failures, because any 400 triggers it.
- **Fix:** Add `supabase/migrations/*.sql` with the table, RLS and functions. Add one `config.js` that both the build and the UI read. Remove the 400 fallback once the column migration is committed and applied.
- **Effort:** M

### R1-06 · High · Deployment publishes the whole repository
- **Location:** The brief says Pages serves the repo root today. `.nojekyll` is committed. `.github/workflows/pages.yml` (the game-files-only deploy) exists but is not active.
- **What's wrong:** Under that setup, every tracked file is publicly fetchable at the custom domain, whatever the private repo setting or the JavaScript password gate: `CLAUDE.md` (owner rules, the launch SQL), `docs/audit/BRIEF.md`, `docs/audit/screenshots/` (22 MB), the tests and the source. I could not check the live site because the network blocks it. This follows from the configuration the brief describes. The docs also contradict each other: CLAUDE.md says that since v0.29.1 `pages.yml` deploys the site and keeps the source off it, while the brief says the workflow is not yet active and `main` (v0.29.0) is live. Whether the source is public depends on a repo setting that nothing in the repo records or checks.
- **Why it matters:** Internal documents and tooling are public on a site that is supposed to be in private testing, and the project's own docs cannot say which deploy mode is live.
- **Fix:** Switch Pages to "GitHub Actions" so `pages.yml` deploys only `_site/`. Add a post-deploy check that fetches `/CLAUDE.md` and fails if it is served.
- **Effort:** S

### R1-07 · High · Persistence has no schema versioning, no migrations and no validation, and saves grow without bound
- **Location:** `ui.js:2532-2546` (`save`, `readSave`, `resumeSave`), `engine.js:4460` (`OC.load`).
- **What's wrong:**
  - The only check is `G.v === 5`. A version mismatch is refused only for class-code shifts. Any other save from an older release loads straight into new code, and `OC.load` repairs only `G.spec`. The engine has accumulated about 32 lazy-default guards (`G.litStage = G.litStage || 0`, `S.altDrug = (S.altDrug || 0) + 1`, and so on) to survive this.
  - Orientation saves store `G.tr.step`, an index into the `STEPS` array. Insert a step and every resumed tutorial lands on a different step.
  - Loaded JSON is not validated, so a corrupt or tampered `oc-save` goes straight into `G`.
  - Discharged patients are never pruned. I measured `G` at 40 KB after `newGame` and **289 KB** at the end of a hard shift (148 patients). The whole object is `JSON.stringify`'d on the main thread every 15 s.
- **Fix:** Use a save envelope `{schema: n, game: version}` with a migration chain and a validator. Store step **ids**, not indexes. Move finished patients into summary stats.
- **Effort:** M

### R1-08 · Medium · Singleton global engine state and hidden global configuration
- **Location:** `engine.js:4` (`let G`). `engine.js:4477`: `root.OC = OC` runs under Node too. I confirmed that `globalThis.OC` is defined after `require`. `engine.js:39-41`: `CODE_V`/`CODE_PAST` are module globals that the UI sets through `setCodeVersion` (`ui.js:1965`).
- **What's wrong:** Only one simulation can exist per process. The class-code checksum differs between Node tests (no version set) and the browser (version set), so the tests do not exercise the code path players use.
- **Fix:** `createEngine({version, hooks})` returns an instance with its own state, and tests build their own instances.
- **Effort:** M

### R1-09 · Medium · The public API is the entire engine, including content tables and cheats, and the UI writes state directly
- **Location:** `engine.js:4459-4475` exports about 200 names: the mutable `DRUGS`, `CASES`, `RXOK`, `CONTRA` and `DDX` tables; internals such as `litAdd` and `needsTx`; and cheat hooks (`crashNow`, `fireEvent`, `trainCard`). `ui.js:2617-2618` writes `g().tr.lesson`, `g().tr.step` and `g().tr.need`. `ui.js:2742` writes `G.stats.realSec` and `spdSec`.
- **Why it matters:** There is no boundary, so any UI line can corrupt the simulation, and refactoring the engine means auditing 3,800 lines of UI.
- **Fix:** Expose a narrow command and query API (`dispatch(cmd)`, `select(query)`). Freeze the content. Put test hooks behind a debug build flag.
- **Effort:** M

### R1-10 · Medium · Game variants are if-branches threaded through every system
- **Location:** `engine.js` contains `G.pre` 61 times, `G.mode === 'md'`/`!== 'md'` 35 times and `G.train` 26 times. `care()` (`engine.js:~795-801`) routes points through a nested condition on mode, tag set and patient ownership.
- **Why it matters:** Each new mode or scenario multiplies the branches, and nobody can say what "physician mode" means without reading every system.
- **Fix:** Pass per-mode policy objects (scoring, AI, which tags count) into the systems.
- **Effort:** L

### R1-11 · Medium · Implicit state machines in magic strings, including a dead state
- **Location:** `p.dsp` takes about 25 string values, assigned all over `engine.js` and compared in `ui.js` and `map.js` (`'mddecide'` is compared 8 times in the UI). `BOARD_ST` (`engine.js:1156`) includes `'obsq'`, which is assigned nowhere in the codebase. `p.loc`, `p.rn`, `p.ev`, `p.re`, `p.reg`, `consult.st` and `treat[k].st` work the same way.
- **Why it matters:** One typo is a silent new state. No transition table means no one can check which transitions are legal.
- **Fix:** Use enums, or TypeScript union types, plus a transition function per machine. Delete `'obsq'`.
- **Effort:** M

### R1-12 · Medium · God functions
- **Location:**
  - `map.js:555` `mapRender`: 395 lines, about 39 KB in one function.
  - `engine.js:3663` `EV`: a 256-line object of event closures.
  - `engine.js:1760` `signOrders`: 99 dense lines that resolve tests, drugs, combinations, contraindications, same-class alternatives, scoring, logs and the lytic hold.
  - `engine.js:4066` `botStep`: 108 lines.
  - `engine.js:3212` `minuteTick`: 86 lines.
  - `ui.js:2342` `ACT`: 182 lines of inline lambdas.
- **Fix:** Break these into named, separately testable units. `signOrders` alone should be about five pure functions.
- **Effort:** M

### R1-13 · Medium · Knowledge duplicated across modules
- **Location and what's wrong:**
  - `ui.js:2663` `SC_TAGS` repeats the `SC_OF` lists at `engine.js:770-772` word for word.
  - `BEDSIDE` is identical in `map.js:38` and `map3d.js:32`.
  - The floor layout has four sources of truth: engine `ROOMS`, `map.js` `RM`, the `map3d.js` `YK` table plus hard-coded metre coordinates, and the Blender scripts with `3d/layout.json`.
  - `ui.js` `stLabel` hard-codes "Starts at 11:00" and "09:00", repeating `ROSTER` `start: 240` and `120`. `engine.js` `scheduled()` hard-codes the names "Dr. Nguyen and PA Brooks" and "Lee".
  - `LANG_SHORT` (UI) partly repeats `LANGS` (engine).
  - `cap` is defined in both files, and the UI's `mine` repeats the exported `mdMine`.
  - The hCG predicate is written inline in `signOrders` and again in `hcgDue`.
  - Image credits exist as both `img/CREDITS.md` and `img/credits.json`.
  - The stream-seed index map in `inStream` (`{rngA:1,…}[k] || 5`, `engine.js:57`) disagrees with `newGame`'s `rngS: seedOf(seed, 6)`.
- **Fix:** One source per fact, imported where needed.
- **Effort:** M

### R1-14 · Medium · Tutorial and lesson content is executable code inside the UI
- **Location:** `ui.js:1591-1946` (`STEPS`, `STEPS_MD`, `LESSONS`; `LESSONS` alone is about 20 KB). Steps carry `setup`, `done`, `auto` and `spot` closures with CSS selectors and engine calls. `CHAPTERS` (`ui.js:1947`) names step ids that are converted to indexes. A case lesson's pearl and pitfall live in the engine (`LESSON_CASE`), while lesson scripts live in the UI.
- **Why it matters:** An educator cannot write or fix a lesson, and a lesson's content is split between two files that have no contract between them.
- **Fix:** Use a declarative step schema (`{id, text, highlight:{kind:'room', id:'1'}, waitFor:{patient:'maria', reg:'quick'}}`) and a small interpreter, with content in data files.
- **Effort:** L

### R1-15 · Medium · The render loop rebuilds everything, including the hidden view, and forces layout
- **Location:** `ui.js:255-282`. Every 110 ms `render()` calls about 15 renderers, including `renderBoard` (`ui.js:580`), which redraws all 38 list-board tiles even while the map view is showing. `renderLanes` runs either way. After the DOM writes it reads `offsetHeight`, `offsetWidth` and `getComputedStyle` about 8 times per pass, plus `stripLayout()` reads. The HTML is built as strings and diffed by string equality (`setH`/`morph`), which is a hand-rolled VDOM.
- **Why it matters:** This is wasted main-thread time and battery on the phones the game targets.
- **Fix:** Render only the visible view, use dirty flags driven by engine events, and batch reads before writes. Or adopt a small renderer (lit-html or Preact) instead of keeping a home-grown one.
- **Effort:** M

### R1-16 · Medium · Switching the 3D floor off mid-shift does not stop it
- **Location:** `map3d.js:658-680` (`frame`), `map.js:521, 536` (`use3d`/`off3d`), `style.css:513`.
- **What's wrong:** three.js puts an inline `display: block` on its canvas, which overrides `#map > canvas.floor3d { display: none }`. `frame()` checks only that the container is connected and visible, not whether 3D is on. `off3d()` only removes a class. There is no `stop` or `dispose`, and the animation-frame loop is never cancelled.
- **Evidence:** In Chrome I turned 3D off during a shift and counted WebGL draw calls: **3,276 and 3,640 per 5 s after switching off** (`off3d2.py` in my scratch folder).
- **Why it matters:** The battery-saver path keeps burning the GPU until a reload.
- **Fix:** Add `OC3D.stop()` and `OC3D.dispose()` and cancel the frame loop when 3D is off. Toggle the canvas with a `hidden` attribute or an inline style, not CSS that loses to three.js.
- **Effort:** S

### R1-17 · Medium · No types, no lint, no formatter
- **Location:** The whole repo. There is no `tsconfig`, ESLint or Prettier config, and `package.json` has no lint or typecheck scripts. Lines run to 1,481 characters.
- **Why it matters:** The owner's baseline is TypeScript strict, ESLint and Prettier. With about 90 fields on a patient object (`makePatient`, `engine.js:~1090`) and string-keyed tables, types are the only way to catch R1-03, R1-11 and R1-13 at build time.
- **Fix:** Start with `// @ts-check` and `checkJs` plus JSDoc typedefs for `G`, Patient and Case, together with ESLint and Prettier. Then migrate to `.ts`.
- **Effort:** M for checkJs, L for full TypeScript.

### R1-18 · Medium · The tests are hand-rolled, seed-fragile, poke internals and leave the UI unit-untested
- **Location:** `test/rules.js` through `rules10.js` and `test/*_test.py`.
- **What's wrong:**
  - The same `assert` one-liner is copied into all 10 rules files, and the same `ok()` into 10 Python files.
  - Files are named by release (`rules7.js`), not by subject.
  - Many rule tests let the bot play randomly until a condition appears (`runUntil(…, 6000)` in `rules.js:11-19`), so they depend on the seed, which CLAUDE.md admits.
  - Tests write engine internals directly (`rules10.js:9-10`: `OC.G.train = null; OC.G.card = null; p.prov = …; p.ev = 'done'`).
  - `test/features.js` has zero assertions.
  - The Playwright scripts contain about 230 fixed `wait_for_timeout` sleeps (68 in `map_test.py`).
  - `ui.js` cannot be imported because it is an IIFE with DOM side effects at load, so it has no unit tests.
  - `showcase.py` and `showcase_v5.py` are screenshot generators living in `test/`.
  - `npm test` passes (528 ok, 16 s).
- **Fix:** Use Vitest with `describe`/`it` and fixture builders that construct patients directly instead of fishing for them in random shifts. Use the Playwright test runner with auto-waiting locators. Move the screenshot scripts to `tools/`.
- **Effort:** M

### R1-19 · Low · Dead code
- **Location:** `ui.js:939` `ORDER_TESTS`, `ui.js:978` `testsBlock`, `ui.js:2680` `starLine`. `map3d.js:18` `VINV`, `map3d.js:184` `GOLD` (a three.js material allocated and never used), `map3d.js:191` `LIFT3`, `map3d.js:210` `placeFor` (an identity function), `map3d.js:331` `cubLen`. The `'obsq'` state (R1-11).
- **Fix:** Delete. A lint rule (`no-unused-vars`) would have caught all of these.
- **Effort:** S

### R1-20 · Low · Test and host hooks ship to players
- **Location:** `window.OCUI` (`ui.js:2850`) exposes `U`, the camera and coach internals. `window.OC3D._view`, `_cam`, `_amb`, `_ambK`, `_ambStep` and `fps` are exposed (`map3d.js:768-770`). The `window.claude.hot` snapshot and hot-reload code sits in `boot` (`ui.js:2844-2849`). `lintCases()` runs at every page load in players' browsers (`engine.js:4458`), even though `build.js:14` already runs it.
- **Fix:** Use a debug build flag and tree-shake these out of the production bundle.
- **Effort:** S

### R1-21 · Low · Changelog kept in comments, and comments that are wrong
- **Location:** There are 143 `v0.x` stamps in the sources (engine 62, UI 33, map 19, map3d 16, CSS 13). File headers say "simulation engine v0.2" and "UI v0.2" at v0.29.1. The vitals section comment (`engine.js:~955`) says "nothing here changes how a shift plays out", but `CONTRA_IF`, `bpOkForLytic` and the oxygen-scoring branch in `signOrders` all read vitals.
- **Fix:** History belongs in git. Comments state current behaviour.
- **Effort:** S

### R1-22 · Low · The build is string-splicing, not bundling
- **Location:** `build.js:21-22` replaces `/*FONTS*/`, `/*STYLE*/`, `/*ENGINE*/`, `/*UI*/`, `/*MAP*/`, `/*IMGCREDIT*/{}` and the literal `'/*GAMEV*/'` inside JavaScript source. Nothing is minified, and every comment ships (index.html is 962 KB, 340 KB gzipped). The CSP step assumes exactly two inline scripts (`build.js:29`). esbuild is installed but used only for 3D.
- **What I checked:** A rebuild in a scratch copy produced byte-identical `index.html`, `sw.js` and `3d/map3d.js`, so the build is reproducible. It is crude, not broken.
- **Fix:** Have esbuild bundle the ES modules, with `define` for the version and an HTML plugin for inlining.
- **Effort:** S–M

### R1-23 · Low · Asset tooling has undeclared dependencies, assumes /tmp, and its README is stale
- **Location:**
  - `tools/opt3d.mjs:7` needs `@gltf-transform/*` and `meshoptimizer`, which are not in `package.json` ("npm i --no-save them in a scratch folder").
  - `tools/pack3d.js` uses paths relative to the current directory and defaults to `/tmp/artifact`.
  - `art/blender/README.md` builds scripts with `cat _head2.py exp_tail.py > exp.py`, depends on `/tmp/b` and a cloned third-party repo, and states "Nothing here is used by the game yet" and "about 9 MB". Both are false: 3D is the default floor, and `3d/` is 4.2 MB.
- **Fix:** Add a `tools/package.json` with the dependencies, use real Python imports, take output paths as arguments, and correct the README.
- **Effort:** S

### R1-24 · Low · Repo hygiene
- **Location:**
  - `docs/` is 25 MB (22 MB of audit PNGs, 3.4 MB of README screenshots) committed to git.
  - There is no `LICENSE` and no root `CREDITS.md`. Credits live in the README and in-game.
  - CI (`tests.yml`) runs only on pushes to `main` and `3d`, not on pull requests or other branches, so this branch has never run CI.
  - `package.json` has no `engines` field.
  - Package and storage names (`overcrowded-ed-game`, `oc-*`, `OC`) do not match the product.
- **Fix:** Use Git LFS or regenerate screenshots on demand, add a LICENSE and CREDITS.md, add `pull_request` and `branches: ['**']` triggers, and add `engines`.
- **Effort:** S

### R1-25 · Low · Content order is behaviour
- **Location:** `engine.js` `aiCard` (~1903) and `botStep` (4069): in physician mode the computer charge nurse always picks the **first** enabled choice on every event card. `chooseCard` routes `'lit'` and `'law'` through a hard-coded `else if` instead of the `EV` table (`engine.js:3579`).
- **Why it matters:** Reordering a card's choices silently changes how the AI plays.
- **Fix:** Give the AI an explicit `ai: true` choice or a scoring function per card. Register the litigation cards in `EV`.
- **Effort:** S

### R1-26 · Low · Event arguments packed as pipe-separated strings
- **Location:** The `ACT` handlers (`ui.js:2346-2420`) do `a.split('|')` on `data-arg` (`'pid|kind|key'`). `dxPick` passes a diagnosis display string through `data-arg` (`ui.js:2356`).
- **Fix:** Use typed `data-*` attributes or a lookup by id.
- **Effort:** S

### R1-27 · Nitpick · Magic sentinels
`1e9` meaning "never" appears 54 times in `engine.js`, and `-1e9` meaning "long ago" appears throughout `newGame`. Use `Infinity` or named constants.

### R1-28 · Nitpick · Naming
- Single-letter globals: `G`, `U`, `E`, `S`, `L`, `R`.
- Cryptic patient fields: `ck`, `rn`, `ev`, `re`, `dsp`, `bb`, `px`, `tq`, `dv`, `wx`, `mods`.
- Content fields `n`, `g`, `p`, `c`, `tx`, `m`. `DRUGS[k].p` means "plain description", while `p` is the patient in every function.
- `con`, `con2`, `con2x` and `consult2` coexist on one patient.

### R1-29 · Nitpick · Small things
- `ui.js:1955` turns a count into a word with `'Four short chapters…'.replace('Four', C.length === 3 ? 'Three' : 'Four')`.
- "Dr. Okafor" is both an ED attending (`engine.js:118`) and the vascular surgeon (`engine.js:4275`).
- `DRUGS` uses classes `'resus'` and `'fluid'` that are not in `DRUG_CLASS` (`engine.js:229-233`).
- `scheduled()` re-sorts `G.sched` on every 0.1-minute step.
- `CASES.find` runs linear lookups in 9 places.
- `style.css` is one 93 KB file with 29 `!important` and ad-hoc z-indexes from 0 to 3000.

### What to rewrite, what to refactor, what to tolerate
- **Rewrite:** the content layer (R1-02, R1-03, R1-14), the save and persistence layer (R1-07), and the UI render and composition layer (R1-01, R1-15). The UI's string-built, closure-shared design does not survive modularisation.
- **Refactor:** the engine into modules with an instance API (R1-01, R1-08, R1-09), mode policies (R1-10), state enums (R1-11), the god functions (R1-12), and the 3D lifecycle (R1-16).
- **Barely tolerable:** the PRNG and stream design, the plain-JSON state idea, the reproducible build, and the 3D module as a pure renderer fed a snapshot.

## 4. Coverage

**Reviewed:**
- `build.js`, `build3d.js`, `tools/opt3d.mjs`, `tools/pack3d.js`, `src/index.template.html`, `package.json`, `.gitignore`, both workflows and `art/blender/README.md`, in full.
- `src/engine.js`, read directly: lines 1-1540 (static data, orders and drugs, diagnosis and litigation, helpers, setup, the step function, arrivals, vitals, placement, EVS, providers), 1590-1970 (physician mode, `signOrders`, `mdDecide`, `aiTick`), the start of the events section, the start of `botStep`, 4215-4486 (`addCase`, the v0.29 additions, `lintCases`, the `OC` export).
- `src/ui.js`: helpers, sound, `render`/`layoutMode`, save and load, `frame`, `bind`, gate, boot, the `ACT` top half, class codes and backend, tutorial and chapter structure, and samples of `STEPS` and `LESSONS`.
- `src/map.js`: constants, `H3D`, the opening of `mapRender`.
- `src3d/map3d.js`: header, quality, lifecycle, `frame`, spots, the public API.
- `test/`: `rules.js`, `rules10.js`, `features.js`, `_browser.py`, `map3d_test.py` and the showcase script headers.
- Everything else by grep, metrics and scripts: function-size ranking, dead-code scan, state-literal inventory, lazy-init counts.

**Ran:**
- `npm test`: passes, 528 ok, 16 s.
- A rebuild in a scratch copy: byte-identical outputs.
- Headless shifts: `G` size 40 KB to 289 KB, `newGame` 206 ms, full hard shift 1.8 s, same seed gives the same arrivals, `globalThis.OC` leaks under Node.
- Content-consistency scripts: 48 of 127 results without a gloss, 75 of 120 `find`/`RES` mismatches.
- Two Playwright experiments: one exception freezes the loop; the 3D canvas keeps drawing after 3D is switched off.

**Not checked, and why:**
- I read many very long lines only up to about 170-330 characters, so their tails are unread.
- These engine sections were surveyed by grep, not read line by line: nurses, intake, transport/IFT, techs, RT, pharmacy, blood bank, imaging/consults, goals, flow/dispositions, returns, `minuteTick`, staff status, the Box, objectives, Orientation scripting, end of shift, most of `EV`.
- The rest of `ui.js` (most individual sheet and report renderers), the rest of `mapRender`, the rest of `map3d.js` (`apply`, `labels`, movers), `style.css` (metrics only), and the remaining Python tests and rules files (structure only).
- The live site and the Supabase schema: the network blocks both.
- The full Playwright and WebKit suites were not run. The screenshots are outside my area and were not reviewed.
- R1-06 is based on the brief's description of the Pages setup, not on observing the live site.

## 5. What I'd grudgingly keep
- The seeded mulberry32 PRNG with separate arrival and event streams kept in `G` (I confirmed same seed, same arrivals).
- An engine with no DOM that loads and runs headless in Node in 13 ms.
- The idea behind `addCase`/`lintCases`, failing at load on broken references. It belongs in a schema validator.
- The single plain-JSON state object, as a concept.
- The reproducible build and the CI step that checks the committed outputs match the source.
- The 3D module as a pure renderer driven by a snapshot (`OC3D.sync`), with taps routed back through the same action path.
- Delegated `data-act` to `ACT` tap dispatch, once the arguments are typed.
- `pages.yml`, once it is actually switched on.
