# Round 12, Reviewer 2 (DevOps, tooling, docs, legal): release review of v0.32.0

Branch `claude/sleepy-rubin-jot35n`, HEAD `a219993`. Diff reviewed: `git diff 0c999de..a219993 -- src test docs/clinical-sources.md README.md CLAUDE.md`, plus `package.json`, `sw.js`, `index.html`, `.github/`, `test/db_live.js` (commit `85a3d0d`), `spec/`, `docs/audit/verification.md`. No contact with supabase.co or edcodeblack.com.

## 1. Verdict

**Ship behind the gate only after R2.12-01 is fixed.** The release mechanics are correct: version, `PAST_V`, cache name, a reproducible build, green tests. The docs are not. The public README says a licensed clinician reviewed the clinical content. The game itself says in four places that no licensed clinician has. One of those two statements is false. For a medical teaching tool, a false review claim in public is the worst kind of docs error. Fixing it is a one-paragraph edit. The rest can wait for the next release.

## 2. Score: 6/10

The mechanics are clean. The docs are wrong in places, and the clinical-sources file looks authoritative but cites superseded guidelines and misspells an author.

## 3. Findings (worst first)

### R2.12-01 High: the README says a licensed clinician reviewed the content; the game says none has
- **Location:** `README.md:55` (v0.32.0 paragraph): "A licensed clinician reviewed the clinical content". It is contradicted by `src/ui.js:3016` (About: "**no licensed clinician has reviewed its clinical content yet**"), `src/ui.js:3105` (report note), `src/ui.js:2203` (`CB_NOTE`, the class results list), `src/ui.js:2318` (Lessons) and `CLAUDE.md:49` ("No licensed clinician has reviewed this content yet."). The same claim is in `docs/audit/BRIEF.md` (Round 12) and in `spec/FINDINGS.md` F-034.
- **Evidence the claim is overstated:** `docs/audit/verification.md` "Clinician's answers" records only three answers (R6-17, R6-08, R6-15), relayed by the owner, from a clinician who is not named. `docs/clinical-sources.md` has a blank **Confirmed** cell in every row except one, the owner's own `WORKUP` list. Nothing shows a review of "the clinical content" as a whole. The rest of this release's keys (asthma, anaphylaxis, TXA, COPD, CAP, shock, strokes, scores, workup) were decided by the owner, an EMS educator, not a licensed physician. The engine comment at `src/engine.js` above `WORKUP` says so.
- **Reproduce:** `grep -n -i "licensed clinician" README.md src/ui.js CLAUDE.md`
- **Why it matters:** the repo is public and the README is the player-facing description. Instructors will read "a licensed clinician reviewed the clinical content" and then see the game deny it. If a student repeats a wrong lesson, the README's claim is the one that creates liability.
- **Fix:** reword the README to match the evidence, for example: "A licensed clinician answered three open clinical questions (TIA disposition, morphine and beta-blockers in ACS, potassium in DKA); the owner, an EMS educator, decided the rest as clinical consultant. No licensed clinician has reviewed the clinical content as a whole." Apply the same wording to BRIEF and F-034. **Effort:** 10 minutes.

### R2.12-02 Medium: F-034 is marked "Fixed" on hearsay, which quietly removes the CTO's NO-GO for students
- **Location:** `spec/FINDINGS.md` F-034: "Fixed (Nov 25: a licensed clinician reviewed it, per the owner …)". `spec/STATUS.md`'s CTO memo says "With real students: NO-GO until a licensed clinician reviews the clinical content (F-034)."
- **Reproduce:** `git diff 0c999de..a219993 -- spec/FINDINGS.md`
- **Problem:** the condition that blocks use with students is now marked met. The evidence is three relayed answers, and the game's own notice still says it is not met. The next launch decision will read "Fixed".
- **Fix:** set F-034 to "Partly fixed (three questions answered)" and keep the condition open. **Effort:** 5 minutes.

### R2.12-03 Medium: the commits and the README say arrivals and the charge nurse's game are unchanged; golden.json shows otherwise
- **Location:** commit `bcd9f58` ("shift fingerprints (scores follow the new keys; **arrivals unchanged**)"). The same wording is in `ea07997` and `30fcc6f`. `README.md:55`: "The charge nurse's game and patient arrivals are unchanged."
- **Reproduce:** `git diff 0c999de..bcd9f58 -- test/golden.json`. In the charge nurse shifts, `"rn/easy/none"` arrivals go from 91 to 85 (and the `arrivalsHash` changes), `rn/hard/none` from 134 to 125, `rn/med/none` from 111 to 110. Discharges, admits, `left`, `care` and `wait` change in every `rn/*` fingerprint. (`arrivals()` in `test/golden.js` counts EMS and return visits, which depend on play. The AI doctors now follow the new answer keys, so the charge nurse's shift plays out differently.)
- **Problem:** CLAUDE.md requires each commit to say which golden lines moved and why. The stated reason is false for the `rn/*` rows. The walk-in streams are unchanged (`sameEarlyArrivals` and `sameWalkIns` stay true), but that is not what the commits or the README say.
- **Fix:** README: "New walk-ins are unchanged; the charge nurse's shifts play out a little differently because the game's doctors follow the new treatment keys." Record the correction in the next commit message. **Effort:** 10 minutes.

### R2.12-04 Medium: `docs/clinical-sources.md` cites superseded guideline editions as the source
- **Location:** `docs/clinical-sources.md`.
  - Cardiac arrest row: "AHA Guidelines for CPR and ECC, 2020, with the 2023 focused updates". The AHA published the 2025 Guidelines for CPR and ECC in October 2025. That edition was a year old at this release.
  - Stroke row: "AHA/ASA guideline … 2019". The project's own code (`strokeSetup` comment, `src/engine.js`) mentions "the 2026 update's imaging-selected late window". The source doc ignores an update the engine knows about. The 2019 guideline also does not support tenecteplase as the general first-line thrombolytic, which is what the game teaches.
  - COPD "GOLD report, 2024" and asthma "GINA report, 2024": both have later annual editions.
- **Reproduce:** `grep -n "2020, with the 2023\|2019 |\|GOLD report\|GINA report" docs/clinical-sources.md`. Compare with `grep -n "2026 update" src/engine.js`.
- **Fix:** cite the current editions. Where the game deliberately follows an older edition, say so in the row. **Effort:** 30 minutes, plus a clinician check that the code cards still match the 2025 ECC guidance.

### R2.12-05 Medium: the live database check can no longer detect a forged-header bypass when the edge refuses the probe
- **Location:** `test/db_live.js` (commit `85a3d0d`, already on `main`). If all 31 probes come back as an HTML 403, the check passes with "they never reach the database". It then retries without any forged header.
- **Problem:** the probe sends all four headers together (`X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`, `True-Client-IP`). Cloudflare plausibly refuses because of `CF-Connecting-IP` or `True-Client-IP`. A forgery with only `X-Forwarded-For` or `X-Real-IP` would then never be tested, and those are exactly the headers the SQL falls back to (`20261125120000_codeblack_round6.sql:73-74`). The original guarantee ("the limit holds however a caller dresses up its address") is now asserted, not checked. The pass condition is also broad: any 403 whose body starts with `<!doctype html` counts as an edge refusal, whatever caused it.
- **Reproduce:** read `test/db_live.js` around `const probe = async forge`. Only two code paths exist (all four headers together, or none). No path forges a single header.
- **Fix:** when the edge refuses the full set, run the probe again with `X-Forwarded-For` and `X-Real-IP` only, and require `busy` on call 31. **Effort:** 20 minutes. Needs CI (supabase.co is blocked here).

### R2.12-06 Low: the Canadian Syncope Risk Score author is misspelled
- **Location:** `docs/clinical-sources.md`, "Thiruganesan et al., 2016". The first author is Thiruganasambandamoorthy V (CMAJ, 2016).
- **Reproduce:** `grep -n Thirug docs/clinical-sources.md`
- **Fix:** correct the name and add the journal. **Effort:** 2 minutes.

### R2.12-07 Low: the "Confirmed" column is self-confirmation, and it omits the one real clinician input
- **Location:** `docs/clinical-sources.md`. The only "yes" is the `WORKUP` row, which the owner both wrote and confirmed. Its Level is "Physician", but the owner is a paramedic. The rows the licensed clinician did answer (TIA, DKA, ACS) are blank. Those rows also cite "clinician's answer of Nov 25, 2026" as a source, which nobody can verify.
- **Fix:** split the column into "Confirmed by (role)" and "Date". Mark TIA, DKA and ACS as partly confirmed by the licensed clinician (on the questions answered). Label the WORKUP row "EMS educator (owner)". **Effort:** 10 minutes.

### R2.12-08 Low: README overstates the risk scores
- **Location:** `README.md:55`: "HEART, CURB-65 and ABCD2 are built from the patient's own age, vitals and exam". In `grayScore` (`src/engine.js`), BUN, HEART history, HEART risk factors and diabetes come from `chance`/`randi`. The code comment admits it: "Parts the card doesn't show … come from the dice". The Canadian Syncope Risk Score is still a bare `randi` with no parts.
- **Fix:** add "(lab values and history the card doesn't show are drawn at random)". **Effort:** 2 minutes.

### R2.12-09 Low: CLAUDE.md is stale after this release
- **Location:** `CLAUDE.md` Tests: "rules.js through rules13.js … (~700 "ok" lines)". `npm test` now runs `rules14.js` and prints 751 ok lines. The Layout line for `test/rules*.js` doesn't mention `rules14.js` (Phase 3 checks). The `CONTRA_IF` list under "Decisions" leaves out the new rule (tenecteplase is harm on a blood thinner, `p.anticoag`). The "No licensed clinician" line at `CLAUDE.md:49` now contradicts the README (see R2.12-01).
- **Reproduce:** `npm test | grep -c '^ok'` gives 751.
- **Fix:** update those three lines. **Effort:** 5 minutes.

### R2.12-10 Low: CI has never run this release candidate
- **Location:** `.github/workflows/tests.yml` runs on pushes to `main` and `3d` only. Release branch `claude/sleepy-rubin-jot35n` has had no run, so the Chrome UI suite, the build-match check and the database job have not run on v0.32.0. CI config is unchanged in this release and is otherwise sufficient: `npm test` picks up `rules14.js` through `package.json`.
- **Mitigation already in the process:** the release rule requires Tests to be green on `3d` at the merged commit. I ran a subset here (below).
- **Fix:** none needed if the `3d` gate is honoured. Don't skip it this time (the phone check was skipped for v0.31.0, per `spec/STATUS.md` Stage 15).

### R2.12-11 Low (already there): the public repo has no LICENSE and no non-affiliation statement
- **Location:** repo root (no `LICENSE*`). `docs/clinical-sources.md` and the README name AHA, ACC, ASA, IDSA, GINA, GOLD, ADA, ESC and ATLS, and say "modeled on the AHA algorithms" and "ACLS/PALS". Nothing says the game isn't affiliated with or endorsed by those bodies. ACLS and PALS are AHA course names, and GINA and GOLD restrict reuse of their reports.
- **Fix:** add a line: "Named guidelines are cited for reference; the game is not affiliated with or endorsed by their publishers." Decide on a license (or "all rights reserved") for the public source. **Effort:** 10 minutes, plus the owner's decision.

### R2.12-12 Nitpick: the ESI source attribution
- `docs/clinical-sources.md`: "Emergency Severity Index handbook, version 5 (AHRQ / ENA)". Version 5 (2023) is published by ENA. AHRQ published version 4 and earlier.

### R2.12-13 Nitpick: the second plain probe in db_live.js can cross the hour
- The "wait if minute >= 55" guard runs once, before the first probe. With an edge refusal, 62 calls run in sequence. If the first probe starts at 54:59 and the calls are slow, the plain probe can cross into the next hour and fail for the wrong reason. Re-check the minute before the second probe.

## 4. Coverage

- **Release mechanics:** `package.json` is 0.32.0. `PAST_V = ['0.31.0']` (one entry, per CLAUDE.md). The `sw.js` cache name is `overcrowded-0.32.0-c2a9cf7772`. A clean `git archive a219993` build in scratch (`build3d.js` and `build.js`) gives `index.html`, `sw.js` and `3d/map3d.js` byte-identical to the committed files.
- **Tests run:** `npm test`, exit 0, 751 ok lines, no FAIL. `npm run stress`, exit 0, "vitals stayed in range in every run". `python3 test/md_ui_test.py`, No errors. `MODE=md LESSON=stroke python3 test/train_test.py`, No errors. `node --check` on `src/*.js`, `test/*.js` and `build.js`: all parse.
- **Git:** read each commit message from `0c999de` to `a219993`. Golden moves are explained in `bcd9f58`, `ea07997` and `30fcc6f`, but the "arrivals unchanged" claim is false for the `rn/*` rows (R2.12-03).
- **README v0.32.0 paragraph vs code:** the WORKUP complaint groups, the stroke mix (62/15/12/11, 300 to 600 min), the card's Onset and Home meds lines, RXOK/RXREQ/ALSO/`tr` for asthma, anaphylaxis, TXA, COPD, CAP, shock and DKA, TIA `ok: ['obs']`, and stale v0.31.0 codes all match. The review claim (R2.12-01), the charge nurse claim (R2.12-03) and the score claim (R2.12-08) do not.
- **CLAUDE.md:** the changed review rule matches the owner's instruction ("review per release not per step"). Stale lines are in R2.12-09.
- **db_live.js:** `85a3d0d` is identical on both sides of the range. Reviewed against the SQL header fallback (R2.12-05, 13).
- **CI:** `.github/` is unchanged in the range. `tests.yml` triggers and `pages.yml`'s `npm test` read (R2.12-10).
- **Not done:** the live database and site (forbidden here), the WebKit suite, the full lesson sweep, `db:test`.
