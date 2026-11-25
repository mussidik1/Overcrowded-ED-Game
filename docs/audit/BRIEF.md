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

## Round 2 (Nov 24, 2026): re-review after Phase 0 and Phase 1, at v0.30.0
- Branch `claude/sleepy-rubin-jot35n` (also pushed to `3d`) is now **v0.30.0**. `main` (the live site) is still v0.29.0; this release has not shipped yet.
- The first round's results are in `docs/PRO_AUDIT.md` (synthesis), `docs/audit/reviewer-*.md` (the six reports) and `docs/audit/verification.md` (the Verifier). Read your own earlier report.
- What changed since the audit (`git diff 6edcc3d..HEAD`, `git log 6edcc3d..HEAD`):
  - **Phase 0, safety net:** `test/golden.js` + `test/golden.json` (seeded-shift fingerprints, class-sync checks, class codes, save round trip, answer keys; part of `npm test`), `docs/SMOKE.md`.
  - **Phase 1, Critical clinical fixes and arrests:** stroke lytic window (R6-01), metoclopramide in SBO (R6-05), unstable A-fib and synchronized cardioversion (R6-06), Bicillin IM-only menu (R6-07), ACS drug scoring (R6-08), ACLS code cards and ROSC odds (R6-04), your own patient's arrest (R5-01), no-team arrest deaths counted (R5-02), epinephrine in arrest (R6-03 data). New rule checks in `test/rules11.js`. Then fixes from three generic hostile reviews (mid-exam arrest, medical bleeds vs trauma, code odds, troponin rule, unknown onset, stream slots).
  - **Release:** version 0.30.0, README paragraph, CLAUDE.md updates, test fixes (`md_ui_test.py`, `imaging_test.py`).
- The screenshots in `docs/audit/screenshots/` were taken at v0.29.1. Take your own of anything that changed.
- The class-results database migration (a `ver` column and stats checks) is **not applied yet**; the client works with or without it.
- Rules are the same as round 1, except reports go to `docs/audit/round2/` and scratch to `scratchpad/round2/rN/`.

## Round 4 (Nov 24, 2026): Phase 2, security and privacy, at v0.31.0
- Branch `claude/sleepy-rubin-jot35n` is **v0.31.0** at `c941ede` ("Phase 2, private class results"). `main` (the live site) is v0.30.0. Nothing here is released, and the new database migration is **not applied** to the live project: until the owner approves it, the live database is what `supabase/migrations/20261124000000_codeblack_baseline.sql` records.
- What changed: `git diff 101e07a..c941ede` and the commit message of `c941ede`. In short:
  - **Database, now in the repo:** `supabase/README.md` explains it. The baseline file records the live Code Black objects. `20261124120000_codeblack_private_results.sql` moves results into a private `codeblack` schema reached only through four `SECURITY DEFINER` functions (`cb_class_new`, `cb_submit`, `cb_class_read`, `cb_class_delete`), with an instructor key per code, 30-day deletion by pg_cron, and per-network rate limits by an HMAC of the address.
  - **Tests for it:** `npm run db:test` (`supabase/tests/run.sh`) builds a throwaway local Postgres 16 in this container (it switches to the `postgres` user when run as root), applies the migrations (the last one twice) and runs `supabase/tests/privacy_test.sql` (119 checks). A new CI job runs it. `test/db_live.js` checks the live project from outside and runs in the Pages deploy; it can't run here (this container's network refuses supabase.co).
  - **Game:** `src/ui.js` (the class code sheet, `cbRegister`, `cbRegHTML`, `cbSendHTML`, `cbListHTML`, `cbFetch` with an 8-second timeout, the `cbSend`/`cbShow`/`cbDel*`/`codeMake`/`codeReg`/`codeKeyCopy` actions, the About page's Privacy section), `src/style.css`, `test/class_test.py` (rewritten for the new flow; it stubs the server).
  - **CI and deploy:** `.github/workflows/tests.yml` (the database job), `.github/workflows/pages.yml` (the live database check; the live-site check's site list and grep).
  - **Docs:** CLAUDE.md's Backend section, README v0.31.0, `docs/SMOKE.md`'s class code section.
- Phase 2's scope in `docs/PRO_AUDIT.md`: R3-01, R3-02, R3-03 (= R1-05, R2-07), R3-13, R3-14, R3-15. R4-02 and R4-03 were fixed on the same screen. **Not in this phase, by the owner's earlier decisions:** a separate Supabase project for the game (the free plan allows two; Case Room shares this one), and hardening the password gate (it is deleted at launch). R2-01/R1-06/R3-06 (Pages from Actions) shipped in v0.30.0.
- **Do not contact supabase.co or edcodeblack.com**, and do not apply anything to the live database. Use the local Postgres: `npm run db:test`, or run `supabase/tests/run.sh` pieces by hand against your own throwaway cluster (`/usr/lib/postgresql/16/bin`).
- Rules are the same as round 1, except reports go to `docs/audit/round4/` and scratch to `scratchpad/round4/rN/`.

## Round 5 (Nov 24, 2026): the round-4 fixes to Phase 2, at v0.31.0
- Branch `claude/sleepy-rubin-jot35n` at `46a0b03` ("Phase 2, round-4 review fixes"). Still unreleased, and the migration is still **not applied** to the live project.
- Read `docs/audit/round4/STATUS.md` first: what was fixed, what is partly fixed and why, what moved to later phases, and what waits for the owner (a privacy contact, the attending's scoring). Don't re-report moved or owner-decision items unless the fix made them worse.
- What changed: `git diff ce11887..46a0b03` (the round-4 reports themselves are docs only). In short: the migration was rewritten (counters, client-made keys, `cb_health`, stats rebuilt, names, versions, deletes by result id); the baseline moved to `supabase/baseline/`; `supabase/tests/client_call.json` is a contract checked by the SQL tests and `test/class_test.py`; the class-results UI in `src/ui.js` was rewritten (hidden key, saved-codes list, list layout, export, Send box); `src/backend.json` holds the backend config; the deploy checks the live database before publishing.
- `npm run db:test` runs the database checks (about 150) on a throwaway local Postgres 16 here; CI uses 17. `python3 test/class_test.py` runs the class flow with the server stubbed (60 checks).
- **Do not contact supabase.co or edcodeblack.com**, and do not apply anything to the live database.
- Rules are the same as round 1, except reports go to `docs/audit/round5/` and scratch to `scratchpad/round5/rN/`.

## Round 6 (Nov 24, 2026): the round-5 fixes, at v0.31.0, with the migration live
- Branch `claude/sleepy-rubin-jot35n` at the commit this section was added in (`git log -1 -- docs/audit/BRIEF.md`). Still unreleased (`main` is v0.30.0).
- **The migration is now applied to the live project** (Nov 24, the owner approved it) and was verified there. The live v0.30.0 site's Send and Class results now fail until v0.31.0 ships; that is the documented "database first" window.
- Read `docs/audit/round5/STATUS.md` first. Owner decisions since round 5: six reviewers, not nine; the privacy contact is on hold; another review round (this one).
- What changed since round 5: `git diff 7cb5613..HEAD -- src supabase test .github build.js` (the round-5 reports are docs only). In short: device keys kept 30 days, unconfirmed registrations, the deploy gate (live may be ahead, probe bucket, skip_db_check), the migration (version answers unknown, smaller backstops, 14-day unused codes, names with marks and no Unicode numbers, attending stats, cb_hits cleared, newer-migration guard), the contract (answers and names), the typing fix in `morph()`, the results list (unranked, inline confirms, Forget, Close results, exports with caveats), the Send box, toasts, CI permissions and limits.
- `npm run db:test` runs about 160 database checks locally; `python3 test/class_test.py` runs 67 checks with the server stubbed.
- **Do not contact supabase.co or edcodeblack.com**, and do not change the live database.
- Rules are the same as round 1, except reports go to `docs/audit/round6/` and scratch to `scratchpad/round6/rN/`.


## Round 7 (Nov 24, 2026): the round-6 fixes, at v0.31.0, with a second migration not yet live
- Branch `claude/sleepy-rubin-jot35n` at the commit this section was added in (`git log -1 -- docs/audit/BRIEF.md`). Still unreleased (`main` is v0.30.0).
- The first migration (`20261124120000_codeblack_private_results`) is live and frozen (`supabase/migrations/applied.sha256`). **The second, `20261125120000_codeblack_round6.sql`, is not applied yet**: the owner approves it after this round. Review it before it goes live.
- Read `docs/audit/round6/STATUS.md` first (fixed, partly fixed with reasons, owner decisions).
- What changed since round 6: `git diff 6328cdf..HEAD -- src supabase test tools .github build.js CLAUDE.md README.md docs/SMOKE.md` (the round-6 reports are docs only). In short: the deploy workflow (pages: read, main only, database and class tests before publishing, version-then-404), db_live.js diagnoses and the skipped-migration check, the second migration (UTC limits and salt, daily limits, cb_health fields, the whole-address public check, the name rule's invisible characters and middle dots, created dates, arrival order, new stats keys, fast capped), the frozen-migration check in run.sh, tools/name_ranges.py, the recursive `morph()`, the code shown only after `ok`, the ask before replacing a code on screen, Set up results in its row, ended classes, the masked key box and the reset on reopen, in-flight answers dropped after Forget or Close, paste of Copy key's line, the results list and export wording and columns, the Send box, About's Privacy as a list, three engine counters (contraindicated drugs, unneeded risky treatments and the attending's own deaths; no random draws).
- `npm run db:test` runs about 190 database checks; `python3 test/class_test.py` about 86 checks with the server stubbed, typing key by key.
- **Do not contact supabase.co or edcodeblack.com**, and do not change the live database.
- Rules are the same as round 1, except reports go to `docs/audit/round7/` and scratch to `scratchpad/round7/rN/`.

## Round 8 (Nov 24, 2026): the round-7 fixes, at v0.31.0, second migration still not live
- Branch `claude/sleepy-rubin-jot35n` at the commit this section was added in (`git log -1 -- docs/audit/BRIEF.md`). Still unreleased (`main` is v0.30.0).
- The first migration is live and frozen. **The second, `20261125120000_codeblack_round6.sql`, is still not applied** and was changed again in round 7 (it isn't frozen until applied). Review it as the version the owner will paste.
- Read `docs/audit/round7/STATUS.md` first (fixed, partly fixed with reasons, owner decisions).
- What changed since round 7: `git diff 18a71f9..HEAD -- src supabase test tools .github build.js package.json CLAUDE.md README.md docs/SMOKE.md .gitattributes` (the round-7 reports are docs only). In short: the key box width; the migration (escapes only, /48 limits, global-unicast public check, script-limited joiners, tsheg and chillus, ended classes' codes held 30 days for their own key, the clean-up job rescheduled and turned on, lock timeout, scen dropped, coarse fill); the engine (own dead counted at the end of the shift, unneeded orders counted when ordered; test/rules13.js); the UI ("Use it without results" for any failure, lost codes struck through, Forget clears a copied key, red errors, row delete errors, per-row Set up results, the redraw by identity and button focus, the Send box near the top, wording); the deploy (contract job, emergency skip with a reason, pinned Playwright, branch guard, cache-name check, 404 retries, cron failure, applied.sha256 vs live, alternating-zone probe; db-watch.yml); run.sh (strict freeze, odd files, predecessor refusal, re-run over data).
- `npm test` now includes `test/rules13.js`; `npm run db:test` runs about 207 checks; `python3 test/class_test.py` about 91.
- **Do not contact supabase.co or edcodeblack.com**, and do not change the live database.
- Rules are the same as round 1, except reports go to `docs/audit/round8/` and scratch to `scratchpad/round8/rN/`.

## Round 9 (Nov 25, 2026): the round-8 fixes, at v0.31.0, second migration still not live
- Branch `claude/sleepy-rubin-jot35n` at the commit this section was added in (`git log -1 -- docs/audit/BRIEF.md`). Still unreleased (`main` is v0.30.0).
- The first migration is live and frozen. **The second, `20261125120000_codeblack_round6.sql`, is still not applied** and changed again in round 8. `supabase/tests/fingerprint.txt` is the md5 of the functions it makes (`codeblack.fingerprint()`).
- Read `docs/audit/round8/STATUS.md` first (fixed, partly fixed with reasons, owner decisions).
- What changed since round 8 began: `git diff 87c9c13..HEAD -- src supabase test tools .github build.js package.json CLAUDE.md README.md docs/SMOKE.md` (the round-8 reports are docs only). In short: the fingerprint; live-class backstop; validation before limits and "taken" before "full"; every ended code held 30 days; /48 health limit; `mdArrestOpen`; names (U+2027, maqaf, Bengali joiner); the form width; "Use it without results" for unreachable or full only; deaths counted whenever the patient arrived; the unrun-arrest penalty; verdict wording; the order review's unsafe drugs; the device keeping keys 60 days; the deploy's `deploy.txt` marker; the daily watch opening an issue.
- **Do not contact supabase.co or edcodeblack.com**, and do not change the live database.
- Rules are the same as round 1, except reports go to `docs/audit/round9/` and scratch to `scratchpad/round9/rN/`.

## Round 10 (Nov 25, 2026): the round-9 fixes, at v0.31.0, second migration still not live
- Branch `claude/sleepy-rubin-jot35n` at the commit this section was added in (`git log -1 -- docs/audit/BRIEF.md`). Still unreleased (`main` is v0.30.0).
- The first migration is live and frozen. **The second, `20261125120000_codeblack_round6.sql`, is still not applied** and changed again in round 9. `supabase/tests/fingerprint.json` (it replaced `fingerprint.txt`) is what it makes, object by object (`codeblack.fingerprint_parts()`), and the md5 over all of it (`codeblack.fingerprint()`).
- Read `docs/audit/round9/STATUS.md` first (fixed, partly fixed with reasons, owner decisions).
- What changed since round 9 began: `git diff 0541eeb..HEAD -- src supabase test tools .github build.js package.json CLAUDE.md README.md docs/SMOKE.md` (the round-9 reports are docs only). In short: required drugs in combinations no longer "Also reasonable"; lost codes told apart from deaths without a code (`codeLost`, `mdCodeLost`); the end-of-shift arrest penalty (5 minutes, not after a firing) and legal stage (`litStage`); clean order sets; the fingerprint per object, in the C collation, whitespace collapsed not removed, the fresh test project in another locale; a 30,000 cap on held codes and `held` in `cb_health`; a planned code started again by its first result during the hold; `cb_submit` validating before it counts; new database tests (the backstop, junk sends, the /48 health limit); the saved-code row's states; Orders to review; the key box on narrow phones; keyboard focus in the class sheet; HTTP errors and the "without results" fallback; verdict wording; the daily watch's single issue; db_live's skip before file reads.
- `npm test` includes new `rules13.js` checks; `npm run db:test` runs about 230 checks; `python3 test/class_test.py` about 107.
- **Do not contact supabase.co or edcodeblack.com**, and do not change the live database.
- Rules are the same as round 1, except reports go to `docs/audit/round10/` and scratch to `scratchpad/round10/rN/`.

## Round 11 (Nov 25, 2026): the release review of v0.31.0, second migration now live
- Branch `claude/sleepy-rubin-jot35n` and `3d` at `e3fbeec` (Tests green there). `main` is still v0.30.0; this is the commit to be released.
- **Both migrations are now applied to the live project and frozen** (`supabase/migrations/applied.sha256`). A finding in a migration now needs a new migration file. The live fingerprint matches `supabase/tests/fingerprint.json`.
- Read `docs/audit/round10/STATUS.md` first.
- What changed since round 10 began: `git diff 1ab6fa9..e3fbeec -- src supabase test tools .github build.js package.json CLAUDE.md README.md docs/SMOKE.md`. Review the release as a whole too: would you ship v0.31.0 to students today?
- **Do not contact supabase.co or edcodeblack.com**, and do not change the live database.
- Reports go to `docs/audit/round11/`, scratch to `scratchpad/round11/rN/`.
