# Phase 4: Foundation (Nov 26, 2026)

`docs/PRO_AUDIT.md` section 7, Phase 4. For the next release (v0.33.0); reviewed with that release's whole diff, per the owner's rule.

## Done

- **Crash guard (R1-04, R3-04).** `frame()` and every tap run inside `crash()`. An error stops the shift cleanly with "Something went
  wrong", says the shift is saved (the last good save: the half-done state isn't saved), and offers Reload, Copy details, and Start
  over without the save. `test/crash_test.py` makes the engine throw mid-shift.
- **Tutorial errors aren't swallowed (R1-04).** Each distinct error in a step's setup, text, auto, spot or done is logged once to
  `window.__coachErrs` and the console; `train_test.py` fails on any. Orientation in both roles and all 11 interactive lessons in both
  roles were swept: none.
- **Saves (R1-07, R3-09, R3-18).** `saveShape()` checks a save before it is offered or loaded, so a broken one can't trap the menu or
  freeze Resume; a save that loads but can't be drawn is removed with a message. `MIGRATE` is the hook for the next save format. A save
  over 3 MB is skipped with a message (a full hard shift is about 0.3 MB). R3-08 (a class shift across an update) was fixed in v0.30.0:
  the menu says why it can't continue.
- **3D floor (R5-06, R1-16, R3-05).** The 3D loop stops when 3D is off or the list board shows, and starts again when it's back. A lost
  WebGL context falls back to the flat map with a message. `test/map3d_life_test.py` checks both; `map3d_test.py` still passes.
- **CI on every push and pull request (R2-03).** Any branch, not only `main` and `3d`.
- **Lint (R2-05, R1-17).** ESLint 9, correctness rules only (no style rules, so nothing was reformatted), in CI as `npm run lint`.
  `tools/lint.js` splices `map.js` into `ui.js` as the build does. It found and this phase fixed: four imaging captions written twice
  (the short old caption silently won over the longer teaching one), three duplicate exports, and dead code in the engine, UI, floor plan
  and 3D floor.
- **Licence (R2-04).** All rights reserved (the owner's choice): `LICENSE`.
- **Credits and notices (R2-16, R2-18, R2-19).** The KayKit credit is gone (no KayKit asset was ever used). `img/CREDITS.md` is written
  from `img/credits.json` by `node tools/credits.js`, with a link to each licence, the Open-i source, and the changes made (resized, JPEG,
  two cropped; BY-SA pictures stay BY-SA). The About page links each licence. `THIRD_PARTY_NOTICES.txt` (three.js, meshoptimizer,
  Cardo's OFL, mesh2motion) ships with the site and is linked from About.
- **Stroke lesson (R6.12-11).** A card teaches the three exclusions (late, woke up with it, a blood thinner), no door-to-needle clock for
  them, and permissive pressure up to 220/120 unless a large-vessel stroke goes for clot removal; the summary card says it too.

## Left, with the reason

- **Prettier and `// @ts-check` with strict types (R2-05).** Prettier would rewrite every line of the dense source; strict types on a
  5,000-line untyped file is the Phase 5 rewrite. Both wait for Phase 5, which the owner deferred.
- **The ABEM EM Model copy (R2-17).** `docs/em-model/*.json` is a full parsed copy of ABEM's 2022 EM Model. It is not on the website, but
  the repo is public. Its licence isn't recorded. Needs the owner: confirm permission, or keep only the item codes the game uses.
