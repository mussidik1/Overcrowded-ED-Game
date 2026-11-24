# Reviewer 2: DevOps / Tooling & Quality

Branch `claude/sleepy-rubin-jot35n` (v0.29.1), working tree at `f763956`. Audit date Nov 23, 2026.

## 1. Verdict

**Only after major work.** The build is deterministic and the Node tests are fast, so this isn't a disaster. But the rest is not a project I'd sign:
- About 8,000 lines of untyped, unlinted, unformatted JavaScript, with lines up to 1,481 characters.
- No LICENSE and no human copyright holder.
- A backend whose schema and security rules exist only in a dashboard.
- CI that has never run on the branch it is supposed to protect.
- A deploy that publishes the whole private repo and doesn't wait for the tests.
- Credits that name an asset pack the project doesn't use.

The tooling is a pile of hand-rolled scripts held together by a 17 KB CLAUDE.md. The machine doesn't enforce any of it.

## 2. Score

**4 / 10.** It's below a competent hobbyist baseline on process (no lint, no types, no licence, no PR CI, an ungated deploy). The reproducible build and the deterministic test seeds keep it from scoring lower.

## 3. Findings (worst first)

### R2-01 · High · The whole private repo is published on edcodeblack.com
- **Location:** `gh run list` shows `pages-build-deployment` (the legacy "deploy from a branch" Pages build) running on every `main` push, e.g. run 45240789894. `gh run list -w "Deploy to Pages"` returns *"could not find any workflows named Deploy to Pages"*. `.nojekyll` sits at the root.
- **What's wrong:** Pages serves the root of `main`, so every tracked file is public, with no Jekyll exclusions: `src/engine.js`, `src/ui.js`, `test/`, `art/`, `docs/em-model/` and the README. The repo was made private on Nov 18, and that protects nothing. When this branch merges, `CLAUDE.md` joins them. It holds the owner's working rules, the gate-drop SQL and the Supabase layout. So does `docs/audit/`, which means these hostile reports and 22 MB of screenshots. The new `pages.yml` would fix this, but GitHub hasn't registered it. CLAUDE.md on this branch claims the opposite: "Since v0.29.1, `.github/workflows/pages.yml` deploys it."
- **Why it matters:** The owner thinks the source is private, and it isn't. The JS password gate hides a page whose source is one URL away.
- **Caveat:** I couldn't fetch edcodeblack.com from this container, so I inferred the live exposure from the Pages build type and the repo contents.
- **Fix:** Before merging this branch, set Settings → Pages → Source to "GitHub Actions" so `pages.yml` takes over. Then confirm that `/src/engine.js` and `/CLAUDE.md` return 404 on the live domain.
- **Effort:** S

### R2-02 · High · The deploy isn't gated on the tests
- **Location:** `gh run list`. "Merge v0.29.0" started `Tests` at 18:39:56Z and `pages-build-deployment` at 18:39:55Z, so they ran in parallel and the site went out before the tests finished. Also `.github/workflows/pages.yml:26-30`.
- **What's wrong:**
  - Today, `main` deploys whatever is pushed, whether the tests pass or not.
  - Once `pages.yml` is active, it gates only on `npm test`. It skips `npm run stress`, the Chrome UI job (about 12 minutes) and WebKit. A change that breaks the UI but passes the engine checks still ships.
  - The package step is a hand-written whitelist (`cp index.html sw.js … ; cp -r icons 3d`). Nothing loads `_site/` to prove the packaged site works, so a forgotten runtime file fails silently, in production.
- **Fix:** Put the deploy job behind the test jobs (`needs:` in one workflow, or `workflow_run` on `Tests` with `conclusion == success`). Add a smoke step that serves `_site/` and loads it headless, checking for no console errors and no 404s.
- **Effort:** S

### R2-03 · High · CI never runs on pull requests or on the working branch
- **Location:** `.github/workflows/tests.yml:8-11` (`on: push: branches: [main, 3d]`, `workflow_dispatch`). `gh run list -b claude/sleepy-rubin-jot35n` returns nothing.
- **What's wrong:**
  - There's no `pull_request` trigger and no trigger for other branches.
  - None of the v0.29.1 work under review has ever run in CI: the new Chrome UI job, the build-drift check, `stress` in CI, `rules10.js`, the CSP and `pages.yml`.
  - The `tests.yml` on `main` (`git show main:.github/workflows/tests.yml`) runs only `npm ci && npm run build && npm test` plus report-only WebKit. So the "committed build matches source" check and the Chrome UI suite have never executed anywhere.
- **Fix:** Use `on: [push, pull_request]` with no branch filter, or at least `pull_request: branches: [main, 3d]`. Require the checks in branch protection.
- **Effort:** S

### R2-04 · High · No licence and no copyright holder
- **Location:**
  - Repo root: `ls LICENSE*` finds nothing.
  - `package.json` has no `license` field.
  - `grep -i copyright README.md src/` finds nothing.
  - `git log --format='%an <%ae>'`: all 89 human-side commits are by `Claude <noreply@anthropic.com>`.
- **What's wrong:**
  - The site calls itself "Free" (`index.template.html` meta description), but nothing grants any rights to it.
  - No human owner is named anywhere in the repo.
  - The repo ships CC BY-SA adaptations (resized and cropped images in `img/`). Those must go out under BY-SA, and no outbound licence statement exists.
- **Why it matters:** A school, a CE accreditor, an app store or a buyer will ask who owns this and under what licence, and today there's no answer. That blocks publishing and accreditation.
- **Fix:**
  - Add a `LICENSE` with an explicit copyright line naming the owner, and set `"license"` in `package.json`.
  - Add a NOTICE stating that `img/` files keep their own licences (BY-SA adaptations are released under BY-SA).
  - Add a human author or co-author line to commits.
- **Effort:** S

### R2-05 · High · No types, no linter, no formatter on 8,000+ lines
- **Location:**
  - No `tsconfig`, `.eslintrc`/`eslint.config.*`, `.prettierrc` or `.editorconfig`.
  - Zero JSDoc: `grep -c "@param\|@typedef\|@type"` returns 0 in all four source files.
  - Line lengths (awk count):

    | File | Lines over 200 chars | Longest line |
    |---|---|---|
    | `src/engine.js` | 368 | 726 |
    | `src/ui.js` | 451 | 1,481 |
    | `src/map.js` | 113 | 662 |

- **What's wrong:** The whole game state `G` and about 40 data tables (`DRUGS`, `RXOK`, `CASES`, …) are shaped only by convention. `module.exports = OC` exposes a mutable singleton with over 200 members. I ran ESLint `recommended` from a scratch copy, and it found 87 problems:
  - 4 duplicate object keys (see R2-06).
  - Dead code that nobody noticed: `ORDER_TESTS` and `testsBlock` (ui.js ~939/978), `starLine` (ui.js ~2680), `HELI`, and in `src3d/map3d.js` `VINV`, `ROOMX`, `lastPick`, `GOLD`, `LIFT3`, `placeFor`, `lerp`, `cubLen`.
  - 6 dead variables in the tests (rules2.js:34/37/93, rules6.js:20/147, rules9.js:62).

  `tsc --checkJs` reports 4 TS1117 errors (the same duplicate keys) plus 180 untyped-shape errors.
- **Why it matters:** Every bug class a linter catches for free is caught here only by a human noticing, and these numbers show that nobody did.
- **Fix:** Add ESLint flat config (`@eslint/js` recommended) and Prettier (printWidth 120), and run them in CI. Add `// @ts-check` with JSDoc typedefs for `G`, patient, staff and case, and move toward TypeScript `strict` starting with the engine data types.
- **Effort:** L (S to install and gate; L to make the codebase pass)

### R2-06 · Medium · Duplicate keys silently delete teaching text
- **Location:** `src/ui.js:1033-1036` versus `src/ui.js:1037, 1042, 1044, 1048`, in the `LOOK` table of the imaging viewer.
- **What's wrong:** `pelvis_normal`, `ctcs_normal`, `ctap_normal` and `mris_normal` are each defined twice. JavaScript keeps the last definition. So the detailed "what to look for" text added for those four normal studies never shows. For example, *"The fronts of the vertebrae line up in a smooth curve, and so do their backs. No step, no crack…"* is dead. Players get the older one-liner (*"Neck bones lined up, edges unbroken."*).
- **Why it matters:** It's a content regression in a teaching tool, and `no-dupe-keys` would have caught it on the first run.
- **Fix:** Delete lines 1037, 1042, 1044 and 1048, and add ESLint to CI (R2-05).
- **Effort:** S

### R2-07 · High · The backend isn't in version control
- **Location:** `src/ui.js:1979-1985` (`CB` URL and key; the comment claims RLS limits the key to insert plus read-by-code). `src/ui.js:2795-2819` (gate RPCs). The brief says it outright: "The database schema and RLS are not in the repo."
- **What's wrong:**
  - The `cb_results` table, its row-level security, `cb_class`, `cb_gate`, `cb_gate_on` and `cb_gate_check` exist only in the Supabase dashboard.
  - That project is shared with an unrelated app (Case Room).
  - The security claim in the comment can't be reviewed, diffed, rolled back or reproduced.
  - The table stores student names with their scores, and the repo has no retention or migration story.
  - On the key itself: `sb_publishable___VN24…` is Supabase's publishable key, which is public by design. It is not a leaked secret. I scanned the whole history (`git log --all -p`) for `sb_secret_`, `service_role`, JWTs (`eyJ…`), `ghp_`/`github_pat_`, `sk-`, `AKIA` and private-key headers, and found none. The only credential in history is that publishable key, in 2 places.
- **Why it matters:** The only server-side security in the product can't be audited, and its blast radius includes another app.
- **Fix:** Commit Supabase CLI migrations (`supabase/migrations/*.sql`) for the table, its RLS policies and the RPCs, with a test that checks the anonymous role can't select rows directly. Give the game its own project. Document data retention for student names.
- **Effort:** M

### R2-08 · Medium · CI runs on an end-of-life Node, with deprecated actions
- **Location:** `tests.yml:27,39,64` and `pages.yml:27`, all `node-version: 20`. `gh run view 45240784846` shows the annotation: *"Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4."*
- **What's wrong:**
  - Node 20 reached end of life on 2026-04-30.
  - Development happens on Node 22 (`node -v` here gives v22.23.5).
  - There's no `engines` field and no `.nvmrc`, so nothing ties local and CI together.
- **Fix:** Add `.nvmrc` with 22 (or 24), use `node-version-file: .nvmrc` in every workflow, add `"engines": {"node": ">=22"}`, and bump the actions to their current majors.
- **Effort:** S

### R2-09 · Medium · The WebKit job has been red on 10 straight `main` pushes, and nobody sees it
- **Location:** `tests.yml:68` (`continue-on-error: true`). `git show origin/ci-results:webkit.txt` gives "SOME FAILED" for every main commit from `2225703` (Nov 19) to `c54d9c1` (live). The failing check is `map3d_test`: *"a new ambulance drives in … its last move is in reverse ({'legs': 3, 'rev': [False, False, True] …})"*.
- **What's wrong:** This is a phone-first game, and Safari's engine is the iPhone engine. The only Safari signal has been red for four days and is still reported as green. The failing check itself is cosmetic, but the habit of ignoring a red job is the real defect.
- **Fix:** Either fix the ambulance-reverse path in WebKit, or quarantine that single assertion explicitly (skip it under WebKit, with an issue link). Then remove `continue-on-error` so the job can fail.
- **Effort:** S–M

### R2-10 · Medium · Every CI job gets a write token, and nothing is pinned
- **Location:** `tests.yml:13-14` sets `permissions: contents: write` at workflow level. Every `uses:` is a moving tag (`actions/checkout@v4`, `setup-python@v5`, `upload-pages-artifact@v3`, …). `pip install playwright` is unpinned (`tests.yml:47,72`).
- **What's wrong:** The `rules` and `chrome` jobs run `npm ci` and an unpinned `pip install` while holding a token that can push to the repo. Only the final step of the WebKit job needs write access. There's no Dependabot config to keep the tag-pinned actions current.
- **Fix:** Set top-level `permissions: contents: read` and give `contents: write` only to the `webkit` job. Pin actions by commit SHA. Add `.github/dependabot.yml` for `github-actions` and `npm`.
- **Effort:** S

### R2-11 · Medium · The Python test toolchain isn't declared or pinned
- **Location:** No `requirements*.txt`, `pyproject.toml` or lock file. CI runs `pip install playwright` and `python -m playwright install --with-deps chromium` (latest, every run). The README dev section (`README.md:229-246`) lists `python3 test/*.py` commands but never says to install Python, Playwright or a browser.
- **What's wrong:** About 18 UI test scripts depend on a toolchain that floats. A Playwright release can break CI with no change to the repo, and a new developer has to reverse-engineer the setup from `test/_browser.py`.
- **Fix:** Add `requirements-dev.txt` with `playwright==<x.y.z>`, install from it in CI, document `pip install -r requirements-dev.txt && python -m playwright install chromium`, and cache pip.
- **Effort:** S

### R2-12 · Medium · The test framework is hand-rolled and fragile
- **Location:**
  - The same `assert` lambda is pasted into 10 files (`test/rules.js:3`, `rules2.js:3`, … `rules10.js:5`).
  - The `npm test` script chains 10 commands with `&&`.
  - Python suites: 237 `wait_for_timeout` fixed sleeps against 4 auto-waiting calls (`grep -c` over `test/*.py`).
  - Scenario fishing: `test/rules2.js:45` loops seeds 33–40 hoping a hemorrhaging trauma patient arrives, and `rules.js:14` runs the autopilot up to 6,000 steps waiting for a patient to show up.
- **What's wrong:**
  - There's no runner, no isolation (every test shares the `OC`/`G` module singleton), no filtering and no reporter.
  - The `&&` chain stops at the first suite that exits 1, so later suites never report.
  - Fixed sleeps make the UI tests timing-dependent.
  - Rule tests depend on what emerges from a random shift instead of constructed fixtures. CLAUDE.md admits it: "Seed-dependent tests break when arrival timing changes."
- **Fix:** Move to `node:test` or Vitest with one `describe` per rule. Add fixture builders (`makePatient({case:'stemi', loc:'room', …})`) that set state directly. Replace sleeps with Playwright `expect(...).to_be_visible()` auto-waits.
- **Effort:** L

### R2-13 · Medium · Stress and sim tests mostly print instead of asserting
- **Location:** `test/stress.js:28-31` prints `avg done` and `worst 3` and fails only on out-of-range vitals (line 33). `test/features.js` has no assertion at all. Neither `sim.js` nor `features.js` runs in CI.
- **What's wrong:** The README (`README.md:233`) says stress "checks for stuck states". It doesn't: a department that discharges nobody all shift passes. I ran it here (41 s, exit 0). The printed worst case was `rn rush+mci seed5: done=12 … left=25`, and no threshold judges it.
- **Fix:** Assert minimums per level (done ≥ N, walkouts ≤ M, no patient stuck in one state for more than X minutes). Turn `features.js` into assertions or delete it. Run `sim.js` in CI, since its invariant `throw`s are real checks.
- **Effort:** S

### R2-14 · Medium · Build outputs and screenshots are committed and bloat the history
- **Location:** `git rev-list --objects --all` by path:

  | Path | Size in history | Versions |
  |---|---|---|
  | `index.html` | 31.7 MB | 44 |
  | `3d/map3d.js` | 8.0 MB | 13 |
  | `docs/audit/screenshots/` | 22 MB (145 PNGs) | |
  | `docs/screenshots/` | 3.4 MB | |

  `.git` is 44 MB. `index.html` has a 25,725-character line, and `3d/map3d.js` has a 234,933-character line.
- **What's wrong:** `pages.yml` already builds from source, which makes committing `index.html`, `sw.js` and `3d/map3d.js` redundant. The CI "drift check" exists only to police that redundancy. Every release adds about 1 MB of unreviewable diff, and any two branches that touch source conflict on the generated files. The screenshots are audit artefacts, not source, and today they are published on the site (R2-01).
- **Fix:** Once `pages.yml` is live, gitignore the three outputs and drop the drift check. Move screenshots to CI artefacts or Git LFS.
- **Effort:** M

### R2-15 · Medium · The 3D asset and data pipelines can't be reproduced
- **Location:**
  - `art/blender/_head2.py:187` (`HUM = '/tmp/x-mesh2motion-app/static/assets/human/variations/'`), `:192` (`/tmp/b/anim/`), `:35` (`/tmp/b/screen.png`), `exp_tail.py:189` (`/tmp/b/glb`).
  - The upstream mesh2motion clone isn't pinned to a commit, and `pip install bpy` isn't pinned.
  - `tools/opt3d.mjs:7` and `art/blender/decompress.mjs` need `@gltf-transform/*` and `meshoptimizer`, which aren't in `package.json` ("npm i --no-save them in a scratch folder").
  - `docs/em-model/parse.py:2` reads `/tmp/emm.txt`.
  - `art/blender/README.md:3` says "Nothing here is used by the game yet". That's false: `3d/*.glb` comes from these scripts.
- **What's wrong:** Nobody, including the owner, can regenerate the shipped `.glb` files or the EM Model JSON from the repo.
- **Fix:**
  - Add `tools/package.json` with pinned `@gltf-transform/*` and `meshoptimizer`, plus `requirements-art.txt` pinning `bpy`.
  - Record the upstream SHA, and use paths relative to the repo.
  - Add a `make assets` script.
  - Fix the README.
- **Effort:** M

### R2-16 · Medium · The credits name an asset source the project doesn't use
- **Location:** `src/ui.js:2596` (in-game About) and `README.md:252`: "Furniture and cars from KayKit by Kay Lousberg (CC0)."
- **What's wrong:**
  - No KayKit file exists in the tree or anywhere in history (`git log --all -S KayKit` hits only the README and UI text).
  - `3d/dept_static.glb`, `room_*.glb` and `ambulance.glb` contain only Blender primitives (mesh names `Cube.469`, `Cylinder.084`).
  - `ambulance()`, `seat()`, `recliner()` and `tree()` are procedural (`art/blender/exp_tail.py:58-80`).
  - The credits were written from memory, not from a tracked manifest.
  - The CC0 status of the `psx-*` characters (`3d/people/raw/*.glb`, mesh names `Character_05`, `Character_26_Doctor`) rests on one sentence in the mesh2motion README ("The art assets … are all licensed under CC0"). There's no pinned snapshot, and I couldn't verify where those characters came from upstream.
- **Why it matters:** Credits a reviewer can't trace to a file are worthless when someone challenges a licence.
- **Fix:** Add `ASSETS.md` (or `assets.json`) with one row per shipped binary: source URL, upstream commit, licence, retrieval date, modifications. Generate the About credits from it, and remove the KayKit line.
- **Effort:** S

### R2-17 · Medium · A third-party document is republished without a recorded licence
- **Location:** `docs/em-model/em-model-2022-items.json` (185 KB, 1,331 items) and `scope-critical-emergent.json` (83 KB). `docs/em-model/PLAN.md:3` gives the source as "ABEM 2022 Model of the Clinical Practice of Emergency Medicine (his upload)."
- **What's wrong:** It's a full machine-parsed copy of another organisation's publication, with no licence or permission recorded. Through R2-01 it is publicly served on the game's domain. I couldn't verify the publication's licence from here.
- **Fix:** Confirm the licence and record it next to the file. If the licence doesn't allow redistribution, keep only the subset of item codes the game uses and keep it off the site.
- **Effort:** S

### R2-18 · Medium · Image licence compliance has gaps
- **Location:** `img/credits.json`, `img/CREDITS.md`, `build.js:21-22`, `README.md:100`.
- **What's wrong:**
  - The licence *names* are given, but there are no licence URLs. CC BY and BY-SA (3.0/4.0) attribution requires a link to the licence where reasonably practicable.
  - 11 of the 25 images are BY-SA and have been modified (resized, PNG converted to JPEG, `cthead_normal` and `cta_m1` cropped). Nothing declares those adaptations as released under BY-SA.
  - `CREDITS.md` says all images come "from Wikimedia Commons", but `cta_m1` comes from PubMed Central.
  - `README.md:100` says "Twenty pictures"; there are 25.
  - `credits.json` and `CREDITS.md` are two hand-maintained copies with no consistency check.
  - `build.js:21` swallows a malformed `credits.json` with `catch (e) { /* no pictures yet */ }` and ships a build with no credits. Only a UI test (`about_test.py:26`) would notice.
- **Fix:** Add `license_url` to each `credits.json` entry and generate `CREDITS.md` from it at build time. State that the BY-SA adaptations are BY-SA. Make `build.js` fail on a parse error.
- **Effort:** S

### R2-19 · Low · Third-party notices are dropped from the shipped bundle
- **Location:** `build3d.js` (`legalComments: 'eof'`). `grep -c Kapoulkine 3d/map3d.js` gives 0. The bundled `node_modules/three/examples/jsm/libs/meshopt_decoder.module.js:1-2` carries "MIT License. Copyright (C) 2016-2022, by Arseny Kapoulkine" as `//` comments, which esbuild strips. Only three.js's `@license` survives at the end of the file.
- **What's wrong:**
  - meshoptimizer's MIT notice isn't in the shipped copy, and the MIT licence requires it.
  - The Cardo fonts are base64-embedded in `index.html` with no OFL text alongside. OFL §2 requires the copyright notice and licence with each copy. The woff2 name table may satisfy that, but I didn't verify it.
- **Fix:** Generate a `THIRD_PARTY_NOTICES.txt` (three, meshoptimizer, Cardo/OFL), ship it in `_site`, and link it from About.
- **Effort:** S

### R2-20 · Low · Dependencies drift and nothing updates them
- **Location:** `npm outdated` lists `three 0.170.0` (wanted 0.170.0, latest 0.187.0). `package.json:15` has `"three": "^0.170.0"`.
- **What's wrong:** A caret on a 0.x version pins the minor, so this never moves. It is 17 releases behind, with no Renovate or Dependabot. `npm audit` reports 0 vulnerabilities today, and that's luck, not process.
- **Fix:** Add Dependabot for npm, and schedule three.js upgrades with the 3D test.
- **Effort:** S

### R2-21 · Low · Configuration is hardcoded and duplicated
- **Location:** The Supabase URL appears in `src/ui.js:1982` and again in the CSP at `build.js:33`. The gated hostnames are hardcoded at `src/ui.js:2799`.
- **What's wrong:** There's no env or config layer. Pointing a staging build at another project means editing two source files and rebuilding. The publishable key being in source is acceptable (it's public by design). The duplication isn't.
- **Fix:** Use one `config.json` or `process.env` read in `build.js`, injected into both the UI and the CSP.
- **Effort:** S

### R2-22 · Low · The gate password is stored in plaintext
- **Location:** `src/ui.js:2813` (`store('oc-gate', v)`) and `:2818` (re-sent on every load).
- **What's wrong:** The shared tester password sits in `localStorage` in clear text on every tester device. The gate is temporary, but people reuse passwords.
- **Fix:** Have `cb_gate_check` return an opaque token and store that.
- **Effort:** S

### R2-23 · Low · package.json, README and CLAUDE.md disagree with reality
- **Location:**
  - `package.json` has no `engines` and no `license`, and lacks `lint`, `typecheck`, `test:ui` and `serve` scripts. Its 10-command `test` script has to be edited for every new suite.
  - `README.md:229` says `npm install` (not `npm ci`), and line 230 says "six suites, 310 checks". The real count is 10 suites and 528 `ok -` lines (measured).
  - CLAUDE.md says pages.yml is the live deploy (false, R2-01) and gives "~520" checks.
- **Fix:** Use a glob test runner, fix the README, and make the docs state only what CI verifies.
- **Effort:** S

### R2-24 · Low · Versioning is informal
- **Location:** `git tag` is empty across about 30 releases. Release notes are paragraphs inside a 51 KB `README.md`, with no CHANGELOG. `src/ui.js:1960-1965` has `GAME_V` salting class codes and `PAST_V = ['']` edited by hand each release.
- **What's wrong:**
  - You can't check out or diff a release.
  - Any version bump, even a docs-only one, invalidates every outstanding class code, because the salt is the package version rather than an arrival-model version.
  - `PAST_V` depends on a manual release step (CLAUDE.md), and no test checks that it was updated.
- **Fix:** Tag releases (`v0.29.1`), add `CHANGELOG.md`, and salt codes with a separate `ARRIVAL_MODEL_V` that changes only when arrivals change. Derive `PAST_V` from it.
- **Effort:** S–M

### R2-25 · Low · Class-code meaning depends on object key order
- **Location:** `src/engine.js:27,49` (`Object.keys(SCENS).indexOf`, `Object.keys(PACKS)[…]`). The `rules7.js:38` round-trip test can't detect a reorder.
- **What's wrong:** Reordering or inserting a key silently changes what a code means. Only a comment ("Only append") guards it. The version salt reduces the damage across releases, but not within one.
- **Fix:** Give `SCENS` and `PACKS` explicit numeric `id` fields, and add a golden test: a fixed code string must decode to a fixed `{mode, level, scen, pack, seed}`.
- **Effort:** S

### R2-26 · Low · Commit history is low quality
- **Location:** `git log`.
- **What's wrong:**
  - All 89 commits are authored by `Claude <noreply@anthropic.com>`, so no accountable human appears.
  - Conventions are mixed: `vX.Y.Z:`, `docs(audit):`, `test(audit):`, `CI:`, `Tests:`, `README:`, `Custom domain:`.
  - WIP commits sit in `main`'s history (`e19e7eb WIP v0.28: …`, `2190173 v0.29.1 (WIP, before review): …`).
  - Subjects run up to 313 characters.
  - There are 22 merges named "Merge branch '3d'".
  - 37 bot commits live on `ci-results` in the same repo.
- **Fix:** Adopt Conventional Commits with commitlint in CI, squash WIP before merging, add a human co-author, and keep CI results in Actions artefacts or job summaries.
- **Effort:** S

### R2-27 · Low · The service worker has no timeout and an incomplete precache
- **Location:** `sw.js:11-13` (generated by `build.js:43-48`). The `FILES` precache list is at `sw.js:3`.
- **What's wrong:** It's network-first with no timeout, so on a weak signal ("lie-fi") a navigation hangs until the browser's own fetch timeout before falling back to the cache. That's the classroom-Wi-Fi case. The precache leaves out `img/*.jpg`, `og.jpg` and `3d/`, so imaging pictures are missing offline unless a player has viewed them before.
- **Fix:** Race `fetch` against a timeout of about 3 s, and precache `img/*.jpg`.
- **Effort:** S

### R2-28 · Low · CI wastes time and coverage is uneven
- **Location:** `tests.yml`.
- **What's wrong:**
  - There's no `cache: npm` on `setup-node` and no pip cache, and `playwright install --with-deps` runs every time.
  - The build runs separately in each job.
  - `finger_test.py` runs in WebKit but not Chrome.
  - Stress covers only some role/level/scenario combinations: there's no `md` run with `ct`, `mci` or `short`, and no weather (`stress.js:5-6`). The README calls that "every level and scenario".
- **Fix:** Add caches, build once and upload the artefact, use a test matrix, and widen the stress matrix.
- **Effort:** S

### R2-29 · Nitpick · Dead and duplicate files
- **Location:** `test/showcase.py`, `test/showcase_v5.py`, `test/features.js` (no script runs them), `art/3d-preview/index.html` (needs `node_modules` plus an external folder), and `test/audit_shots.py` (audit tooling mixed in with the tests). `art/blender/exp_tail.py` and `dept2_tail.py` duplicate about 80 lines (`make_variant` … `tree`).
- **Fix:** Delete the dead files, or move them to `tools/`. Extract the shared Blender helpers into `_head2.py`.
- **Effort:** S

### R2-30 · Nitpick · `.gitignore` is too thin
- **Location:** `.gitignore` has three entries.
- **What's wrong:** It doesn't cover `.DS_Store`, `*.log`, `.env*`, `.venv/`, `_site/` (which `pages.yml` creates), `coverage/` or `test-results/`.
- **Fix:** Add those entries.
- **Effort:** S

### R2-31 · Nitpick · Naming debt from the rename
- **Location:** The package name is `overcrowded-ed-game`, along with the `OC` global, `oc-*` storage keys and `overcrowded-*` cache names, for a product renamed at v0.20.
- **Fix:** Plan the migration (storage-key shim) or document the decision in one place.
- **Effort:** M

### R2-32 · Nitpick · `pages.yml` copies `CNAME`
- **Location:** `pages.yml:36`.
- **What's wrong:** With Actions-based Pages, the custom domain is a repository setting. A `CNAME` file in the artefact is ignored, so it's noise and a false signal.
- **Fix:** Drop it.
- **Effort:** S

### R2-33 · Nitpick · One test block can pass vacuously
- **Location:** `test/rules.js:61-62`. `runUntil(...)` then `if (p) { … }`, with no `assert(p, …)` first, unlike the other guarded blocks.
- **What's wrong:** If no suitable patient appears, the EVS-before-placement checks don't run at all, and the suite still passes.
- **Fix:** Add `assert(p, 'found a waiting ESI 2-3 patient')`.
- **Effort:** S

## 4. Coverage

**What I reviewed and ran:**
- **Read in full:** `package.json`, `package-lock.json` (all 30 packages with their licences), `.gitignore`, `build.js`, `build3d.js`, `sw.js`, `manifest.webmanifest`, `CNAME`, both workflows, `tools/pack3d.js`, `tools/opt3d.mjs` (header and imports), all of `art/blender/` (README, imports and functions), `docs/em-model/` (PLAN, parse.py, JSON headers), `img/CREDITS.md`, `img/credits.json`, `test/_browser.py`, `test/stress.js`, `test/sim.js`, `test/features.js`, `test/gate_test.py`, and the head of `test/rules.js`.
- **Read in part:** `src/ui.js` (credits, backend, gate, version and code sections), `src/engine.js` (PRNG, class codes, SCENS/PACKS, export surface), and the GLB metadata of all 3D models.
- **Fresh clone, timed:** `git clone` + `npm ci` + `npm run build` took 4.3 s wall (with a warm npm cache). The build is **byte-identical** to the committed outputs (`git status` clean). `npm test` took 12.9 s, exit 0, 528 ok lines. `npm run stress` took 41 s, exit 0. So a new developer can get the JS side running in well under 5 minutes. The Python UI tests need an undocumented Playwright and browser install (R2-11).
- **UI tests run from the clone with system Chrome:** `ui_test` (46 s), `class_test`, `gate_test`, `offline_test` and `about_test` all passed.
- **Audits:** `npm audit` found 0 vulnerabilities. `npm outdated` flagged three.js.
- **Scratch analysis** (installed only under the scratch folder, not the repo):
  - ESLint 9 recommended found 87 issues.
  - `tsc --checkJs` gave the error profile above.
  - c8 coverage of `src/engine.js` under `npm test`: 96.4% lines, 87.5% branches, 93.6% functions. Line coverage overstates on 700-character lines, and most of it comes from autopilot shifts rather than targeted assertions.
- **Git history:**
  - Credential and email scans over `git log --all -p`: no secrets, and no emails beyond `noreply@anthropic.com`.
  - Deleted files and blob sizes by path.
  - Commit messages and authorship.
  - The `ci-results` branch: WebKit result history.
- **`gh`:** run list, run view, and the branch check for runs on this branch.

**What I couldn't check:**
- The live site. edcodeblack.com and supabase.co are blocked, so the R2-01 exposure is inferred from the Pages build type.
- The Supabase schema and RLS (not in the repo, and no access).
- Pages settings and branch protection. The GitHub API path was refused by the proxy.
- The upstream origin of the mesh2motion `psx-*` characters beyond its README statement.
- The ABEM EM Model licence.
- Whether the woff2 name tables carry the OFL notice.
- `map3d_test.py` (about 15 min with software GL). I used the CI WebKit result for it instead.
- `md_ui_test`, `map_test`, `train_test`, `finger_test`, `imaging_test` and `events_test` locally.

**Process note:** My own `awk` command in a history listing used `>` inside a `print`. awk treated it as output redirection and created about 50 stray files in the repo root, named after commit subjects. I found them with `git status` and removed exactly those untracked root files. Nothing else was touched: `git status` was clean afterwards except for this report.

## 5. What I'd grudgingly keep
- `package-lock.json` with `npm ci`: three dependencies, 0 vulnerabilities, a clean install.
- The deterministic build: a fresh clone rebuilds `index.html`, `sw.js` and `3d/map3d.js` byte-for-byte.
- `build.js` fails the build when the engine throws at load or a script doesn't parse.
- Seeded PRNG streams (`inStream`/`seedOf`): they make the engine testable without mocks.
- `gate_test.py` stubs the network instead of hitting the real database.
- Only the publishable Supabase key is in the code, with no real secret anywhere in history.
- The CSP generated with script hashes at build time.
