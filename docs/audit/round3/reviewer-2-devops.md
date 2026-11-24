# Reviewer 2, round 3: DevOps / Tooling, CI & Legal

Branch `claude/sleepy-rubin-jot35n` at `8357568` (v0.30.0). Since then the branch has only gained other reviewers' round-3 reports (`06b4b15`..`628ce24`, docs only). `origin/3d` is still at `5dce29f`, and `origin/main` at `c54d9c1` (v0.29.0). Reviewed Nov 24, 2026. Scratch: `scratchpad/round3/r2/`. A fresh clone was built byte-identical, and `npm test` passes there: 642 `ok` lines, exit 0, 41.6 s on a shared, heavily loaded machine.

## 0. Round-2 status

| ID | R2 sev | Status | Evidence |
|---|---|---|---|
| R2.2-01 Golden is a change detector | High | **Partly fixed** | **Fixed:** harmless edits now pass. These are an unused `G` key, swapped `G` keys, a copy edit, a toast reword, a `CODE_WHY` reword and a version bump (H01–03, H05, H07, H08 below), and the code fixtures are unsalted (`golden.js:74`). **Still open:** adding one unused counter to `freshStats()` fails all 13 shifts, and the only field in the diff is `stateHash` (H04). Shift diffs are still two hashes (`stateHash`, `arrivalsHash`), and `--update` still takes no reason. |
| R2.2-02 Golden blind to clinical rules | High | **Partly fixed** | **Fixed:** `codeKey`, `radioKey` and `hcg` now catch the round-2 adenosine and dissection mutations (C01, C02). README:57 and CLAUDE.md:160 were rewritten. **Still open:** 14 of 28 clinically wrong mutations still pass all 13 suites (§3). The open ones include `NEVER_WRONG` (C14), `SAME_CLASS_OK` (C15), weather (C04), and the hCG age band, which surfaces only as a care score of −1 inside a hash (C21). Golden still has no `CONTRA_IF` probes and runs no weather or MIEMSS shift. |
| R2.2-03 Vacuous test | Medium | **Partly fixed** | **Fixed:** `inStream` is exported and asserted (`rules11.js:157`). **Still open:** `rules11.js:84` (`if (p.right)`) and `:140` (`if (p)`) still skip silently, and `rules12.js:197` (`if (bay)`) adds a third. STATUS calls this "fixed". |
| R2.2-04 UI tests play a random shift | Medium | Deferred (Phase 4) | Not rechecked. For the record: `md_ui_test` passed once here with 34 `ok`. |
| R2.2-05 Merge gates unmet | Medium | Waived | The owner waived it. |
| R2.2-06 First deploy unguarded | Medium | **Partly fixed** | A post-deploy check now exists, but it passes against the old v0.29.0 site (R2.3-03). There's no pre-flight evidence of the Pages source and no written rollback (`grep -i rollback` finds nothing). STATUS calls this "fixed". |
| R2.2-07 Release steps hand-edited | Low | Still open | `package-lock.json:3` still says `0.17.0`. There's no tag, no test of the shipped `PAST_V`, and CLAUDE.md:19 is unchanged. A version bump no longer forces a golden update (H05), which helps. |
| R2.2-08 Save test same-version only | Low | **Partly fixed** | **Fixed:** attending round trips on 4 seeds, a save taken mid-code (`golden.js:93-107`), and a synthetic pre-v0.30 arrest (`rules12.js:128`). **Still open:** no real v0.29.0 save fixture. |
| R2.2-09 SMOKE can't be completed | Low | Still open | `SMOKE.md:3` is unchanged. The offline check still can't pass over `http://<LAN-IP>`. |
| R2.2-10 Game-run code odds untested | Low | Fixed (weakly) | C03 fails `rules12.js:180`. That line asserts the constant, though, not the outcome, which leaves R2.3-02 open. |
| R2.2-11 Phase 0 under-delivered | Low | Still open | Still 13 shifts, with no weather, MIEMSS or door-to-doc. PRO_AUDIT §7 isn't amended. |
| R2.2-12 golden.js defects | Nitpick | **Partly fixed** | **Fixed:** `bytesAt3h` is gone. **Still open:** `:141` still compares by the new index only, `:133` still writes the snapshot before the invariants at `:148-154`, and the suites still run serially. |
| R2.2-13 Commit hygiene | Nitpick | **Worse** | 41 commits now head for `main` (28 in round 2). 31 subjects lack the `vX.Y.Z:` prefix and 11 run over 72 characters. `7a2efc6` claims a `.gitignore` change it doesn't contain; a separate commit (`8357568`) had to finish it. |

**Counts:** Fixed 1. Partly fixed 6. Still open 3. Worse 1. Deferred 1. Waived 1.

## 1. Verdict

**Merge only after the two pre-flight conditions in §4.** The safety net no longer cries wolf at harmless edits, and that's real progress. It's still blind exactly where round 2 put the newest and most dangerous content:
- **Children's resuscitation doses.** A 5× epinephrine dose, 10× shock energy, a doubled weight estimate and triple amiodarone all pass every suite.
- **The code outcome model.** Rewarding wrong code answers, making VF come back 95% of the time, or deleting the "how fast a doctor got there" penalty all pass.
- **One test passes on the exact regression it was written for:** `ok - rhythm checks come 0 game minutes apart (0, 0, 0)`.

The new live-site check verifies nothing about the release: it goes green against yesterday's site. And three commits about to land on `main` carry a symlink that deletes `node_modules` directories.

## 2. Score

**5 / 10** (round 2: 4). It's up one for the golden rework, the code-card and radio keys, the fixed `inStream` test and a deploy check that exists. It isn't up more, because half the clinical mutations still walk through, the round-2 PALS and ROSC code shipped without one numeric test, and nothing in the foundation (lint, licence, CI on branches) moved.

## 3. New findings (worst first)

### Mutation results (fresh clone, 36 mutations, each run against all 13 `npm test` suites)

Harness: `scratchpad/round3/r2/mutate.js`. Results: `mut1.log`, `mut2.log`, `mut/results.json`.

| Mutation (clinically wrong) | Caught by |
|---|---|
| C01 Refractory VF: the right answer becomes adenosine | golden (readable diff) |
| C02 Dissection removed from `HCG_CASES` | rules12, golden |
| C03 `CODE_AI_Q` 0.6 → 0.95 | rules12, golden |
| C05 Lytic window 270 → 360 | rules11, rules12 |
| C06 Nitroglycerin limit SBP 90 → 60 | rules11, rules12 |
| C07 Child epinephrine 0.01 → 0.1 mg/kg | rules12, **by luck**: the infant is 10 kg, so the 1 mg cap shows "1 mg" |
| C12 NSAIDs in chest pain always allowed | rules11, rules12, golden |
| C13 Ampicillin age 50 → 80 | rules10, golden |
| C17 Radio: nitroglycerin at BP 84 approved | golden |
| C18 Diltiazem allowed in crashed A-fib | rules11 |
| C20 No-team death 20 → 60 min | rules11, rules12, golden |
| C21 hCG age band 12–55 → 12–45 | golden only, as `care 2057 → 2056` plus a new hash |
| C24 Metoprolol allowed in shock | rules12 |
| C25 Unshocked VF penalty removed | rules12 |
| **C04** Snow walk-ins ×3.5 | **nothing** |
| **C07b** Child epinephrine 0.01 → 0.05 mg/kg (5×) | **nothing** |
| **C08** Child first shock 2 → 20 J/kg | **nothing** |
| **C09** Child weight estimate doubled (every PALS dose 2×) | **nothing** |
| **C19** Child amiodarone 5 → 15 mg/kg | **nothing** |
| **C28** PALS cards and weight doses up to age 17 | **nothing** |
| **C10** Result-card reason: "epinephrine 1 mg every minute" | **nothing** |
| **C11** A wrong answer rewritten to "Defibrillate at once" in VF | **nothing** |
| **C14** Ketorolac added to `NEVER_WRONG` | **nothing** |
| **C15** Benzodiazepine group removed from `SAME_CLASS_OK` | **nothing** |
| **C16** `CODE_BASE.ed.vf` 0.65 → 0.95 | **nothing** |
| **C26** "How fast a doctor got there" penalty removed | **nothing** |
| **C29** `CODE_GAP` 4 → 0 (every rhythm check at once) | **nothing** |
| **C33** A wrong code answer earns +4 care instead of −4 | **nothing** |

| Mutation (harmless) | Result |
|---|---|
| H01 Unused `G` key · H02 swapped `G` keys · H03 copy edit · H05 version bump · H07 reason reword · H08 toast reword | all pass (good) |
| H04 Unused counter added to `freshStats()` | golden fails 13 of 13 shifts; the diff shows only `stateHash` |
| H06 "Shock now (defibrillate)" → "Defibrillate now" | golden fails (readable diff, fine) and **rules11 fails**: "VF: shock first" tests `startsWith('Shock')` |

### R2.3-01 · High · Children's resuscitation doses have no numeric test · [round-2 content]
- **Location:**
  - `src/engine.js:2145-2150` (`kgOf`), `:2167-2170` (`codeFill`: `{epi}`, `{amio}`, `{j2}`, `{j4}`) and `:2144` (`isKid`).
  - Tests: `test/rules12.js:84` (a regex for "0.something mg" and "not 1 mg") and `:88` (it checks the template text "2 J/kg", never the number).
  - Golden's `codeKey` (`golden.js:125`) records the raw templates, with `{epi}` unfilled.
- **Reproduction:** apply C07b, C08, C09, C19 or C28 from the table, and all 13 suites pass. C07 at 10× is caught only because the test infant weighs exactly 10 kg, so 0.1 × 10 hits the 1 mg cap. Make it 9× and it passes (C07b at 5× does).
- **Why it matters:** these are the doses printed on PALS cards that students are taught to pick. "Children get PALS doses by weight" is a headline claim of v0.30.0 (README:57). A 5× epinephrine dose or 10× shock energy for an infant would ship through `npm test`, CI and `pages.yml`. No clinician has reviewed it either (CLAUDE.md:48).
- **Fix:**
  - Add a table test: for fixed patients (3 mo, 11 mo, 2 y, 6 y, 12 y, 13 y), assert `kgOf` against the APLS formula, and assert the filled first VF, second VF and PEA cards for exact strings ("Shock at 20 J (2 J/kg)", "epinephrine 0.1 mg", "amiodarone 50 mg").
  - Snapshot the filled `codeSteps` for those patients in golden instead of the raw templates.
  - Assert `isKid` at ages 12 and 13.
- **Effort:** S

### R2.3-02 · Medium · No golden shift runs a code; the ROSC model and code scoring are untested; one test can't fail · [round-2 content]
- **Location:**
  - `golden.js:46-59`.
  - `engine.js:2217-2226` (`CODE_BASE`, `late`, the odds), `:2205` (`care(-4)` for a wrong answer) and `:2032` (`CODE_GAP`).
  - `rules12.js:114`, `:170` and `:180`.
- **Evidence:**
  - I replayed golden's 13 shifts with seed 424242 (`scratchpad/round3/r2/arrests.js`). They contain **2 arrests in total, both unrun "no team" deaths**, with 0 code cards, 0 ROSC and 0 attending-owned arrests.
  - `46033b8` changed arrest scoring (40 points and legal risk for an unrun arrest, ICU-only after ROSC, pod rooms for codes) and touched no golden line.
  - C16, C26 and C33 pass everything.
  - C29 passes with `ok - rhythm checks come 0 game minutes apart (0, 0, 0)`. The test compares the gap with `OC.CODE_GAP` itself, so the R3.2-04 regression ("not all at once") is unguarded.
  - `rules12.js:180` asserts the constant `CODE_AI_Q < 0.67`, not that a game-run code does worse than a well-run one.
- **Why it matters:** README:57 promises that "your answers and how fast a doctor got there set the odds". Nothing checks either half.
- **Fix:**
  - Add a golden "code" section: for each rhythm × (all right, all wrong, game-run) × wait (0, 10 min), record the computed odds (expose a pure `codeOdds(p)`).
  - Assert `CODE_GAP >= 2` in absolute game minutes.
  - Assert that the score delta for a wrong answer is below 0.
  - Add one golden shift with arrests forced into the attending's own rooms.
- **Effort:** S

### R2.3-03 · Medium · The post-deploy check is version-blind and can only report a leak after it happens · [R2.2-06 fix]
- **Location:** `.github/workflows/pages.yml:58-76`.
- **Reproduction:**
  1. Build the package step from `origin/main` (v0.29.0) into `scratchpad/round3/r2/old/_site` and serve it.
  2. Run the step's script, extracted verbatim (`check.sh`), with `SITE=http://127.0.0.1:8772/`.
  3. The result is `ok` on all 12 lines and exit 0, while it serves v0.29.0 (`overcrowded-0.29.0-361b5c5fd4`).

  From the second Actions deploy on, the old site and the new one give identical status codes. A deploy that didn't propagate, or that published a stale artefact, goes green.
- **Also:**
  1. **It can't prevent anything.** The step runs after `deploy-pages`. If the Pages source is still "Deploy from a branch", the legacy build publishes `CLAUDE.md` and `docs/audit/` (including the round-2 write-ups of the unfixed class-results holes) first, and this step goes red afterwards.
  2. **It tests the wrong host.** It checks `steps.deployment.outputs.page_url`, not `https://edcodeblack.com`. If the custom domain setting were lost in the source switch, it would test `*.github.io` and pass. The `CNAME` file copied at `:37` is ignored for Actions deployments, so the artefact doesn't set the domain.
  3. **It can run for a long time.** curl has no `--max-time` and the job has no `timeout-minutes`. A full failure takes 12 × 30 × 10 s, which is at least 60 minutes.
  4. **No rollback is written down anywhere.**

  The gate doesn't break it (status codes are server-side, and the gate is client JS). The CDN is handled correctly by the `?nocache=` retries.
- **Fix:**
  - Export `sha256sum _site/sw.js _site/index.html` as build-job outputs, and in deploy compare them with `curl -s https://edcodeblack.com/sw.js | sha256sum`.
  - Pin the production URL.
  - Add `--max-time 15` and `timeout-minutes: 20`.
  - Add a rollback line to CLAUDE.md: re-run the previous green "Deploy to Pages" run, or revert the merge and push.
- **Effort:** S

### R2.3-04 · Medium · A `node_modules` symlink in three commits about to land on `main` deletes local installs · [history]
- **Location:** `eb88030`, `46033b8` and `d1da54a` track `node_modules` as `120000` → `/home/user/Overcrowded-ED-Game/node_modules`, which is the standard checkout path in the owner's cloud sessions. It's removed in `7a2efc6`.
- **Reproduction:**
  - In a fresh clone with a real `node_modules/x/f`, `git checkout eb88030` silently replaces the directory with the symlink. The directory was ignored, so git treats it as expendable.
  - In `scratchpad/round3/r2/symtest`, `npm ci` through a `node_modules` symlink **emptied the symlink's target directory**, and the marker file was gone.
  - Together: a future session that bisects v0.30.0 in a worktree and runs the documented `npm ci` wipes the main checkout's `node_modules`.
- **Why it matters:** `3d` and `main` don't have these commits yet. After the `--no-ff` merge they're permanent, unless someone force-pushes `main`.
- **Fix (before pushing to `3d`):** `git filter-branch --index-filter 'git rm -q --cached --ignore-unmatch node_modules' 8619927..HEAD` on the session branch (or `git filter-repo --path node_modules --invert-paths --refs …`), then force-push the session branch only. Also stage explicit paths instead of `git add -A`; that habit committed the symlink and produced `7a2efc6`.
- **Effort:** S

### R2.3-05 · Medium · The code-card teaching text and wrong answers are unguarded, and the docs claim otherwise · [round-2 content, docs]
- **Location:**
  - `golden.js:125-127`, which records only each right answer's label.
  - `lintCode` (`engine.js:4791`), which checks structure only.
  - The claims: README:57 ("tests that replay … every answer key") and CLAUDE.md:160 ("an answer key (drug keys, code cards …) fails it").
- **Reproduction:**
  - C10 rewrites the result-card reason to teach "epinephrine 1 mg every minute until a pulse returns", and passes everything.
  - C11 turns a VF distractor into a correct action ("Defibrillate at once"), which is still scored wrong, and passes everything.
  - C14 (`NEVER_WRONG`) and C15 (`SAME_CLASS_OK`) change drug scoring and pass everything.
- **Why it matters:** the result card's "why" is the teaching. The "every answer key" claim is false for the parts students actually read.
- **Fix:**
  - Snapshot each filled `codeSteps` question in full (all four options, the flags and the `CODE_WHY` text), plus `NEVER_WRONG`, `SAME_CLASS_OK`, `REQ_AGE`, `RXREQ`, `CONTRA` and `CONTRA_IF` at probe states.
  - Until then, say "the right answer of every code card and radio call" in README:57 and CLAUDE.md:160.
- **Effort:** S

### R2.3-06 · Medium · The merge sequence deploys code that CI has never seen · [release]
- **Location:**
  - CLAUDE.md:19 ("commit on `3d`, merge into `main`, push").
  - `pages.yml:33` (the gate is `npm test` only).
  - `tests.yml` (the stress and Chrome jobs aren't a `needs:` of the deploy).
- **Evidence:**
  - `origin/3d..HEAD` is 14 commits with 745 changed lines in `src/`, `test/`, `.github/` and `package.json`. The last Tests run is still `45388229307` on `5dce29f`, so `rules12.js`, the new golden, the new `pages.yml` step and the PALS and ROSC code have never run in CI.
  - If `3d` and `main` are pushed together, as the documented step reads, `pages.yml` deploys about 2 minutes after its `npm test` passes, while stress and the Chrome UI job are still running. A WebKit failure (the iPhone engine, first run on this merge) is report-only.
  - STATUS.md lists neither round-1 R2-02 nor R2.2-07 to R2.2-13.
- **Fix:**
  - Push `3d` alone and wait for a green Tests run on that exact SHA, then merge.
  - Write that order into CLAUDE.md:19.
  - Longer term, gate `pages.yml` on `workflow_run: Tests, conclusion success`.
- **Effort:** S

### R2.3-07 · Low · Rule tests keyed to wording fail harmless rewording · [tests]
- **Location:** `rules11.js:110` (`startsWith('Shock')`), and `rules12.js:43,48,92,93` (`/transfusion/`, `/decompress/`, `/all at once/`, `/drain/`, `/tenecteplase/` on answer labels).
- **Reproduction:** H06 ("Defibrillate now, then straight back to CPR") fails rules11 "VF: shock first".
- **Why it matters:** the test fails on copy, while C11 shows it passes on meaning. Assert against the reason keys (`c[1]`: `shock`, `hemctl`, `traumaFix`) instead.
- **Effort:** S

### R2.3-08 · Low · The docs touched this round are still wrong · [docs]
- **Location:**
  - `CLAUDE.md:150`: the edited line still says "~520 'ok -' lines", but there are 642.
  - `CLAUDE.md:14`: "Since v0.29.1, `pages.yml` deploys it". It has never run, and v0.29.1 never shipped.
  - `golden.js:18-19`: describes blanking strings over 24 characters, which the code no longer does.
  - `README.md:231-233` (untouched): still says `npm install` and "six suites, 310 checks".
- **Effort:** S

### R2.3-09 · Low · STATUS.md overstates and omits · [process]
- **Location:** `docs/audit/round2/STATUS.md`.
- **What's wrong:**
  - It marks R2.2-03 and R2.2-06 as "Fixed" though both are partial (§0).
  - Seven of the 13 R2.2 findings (07 to 13) appear nowhere: not fixed, not deferred, not waived.
  - R2.2-10 and R2.2-08 were fixed (in whole or in part) without being listed.
- **Fix:** list every ID with one status.
- **Effort:** S

### R2.3-10 · Nitpick · Small regressions · [code]
- `CODE_CAUSE` appears twice in the `OC` export literal (`engine.js:4820`; ESLint `no-dupe-keys`).
- Lines in `engine.js` over 200 characters went from 386 to 412. R2-05 is deferred, but it got worse.
- `.gitignore` still lacks `_site/`, which every reproduction of the package step creates.

## 4. Must block the merge into main

1. **A green Tests run on `3d` at the exact merge SHA** (rules, stress, Chrome UI) before `main` is touched. None of the 14 newest commits has been through CI, and `pages.yml` doesn't wait for stress or Chrome (R2.3-06).
2. **The owner confirms, right before merging, that Settings → Pages shows "Source: GitHub Actions" and "Custom domain: edcodeblack.com".** I couldn't confirm it: `gh api …/pages` returns 403 through the proxy, and the legacy `pages-build-deployment` workflow is still listed as active. If the source is wrong, the merge publishes `CLAUDE.md` and `docs/audit/` on the live domain, and the new check only goes red afterwards (R2.3-03).
3. **Strongly recommended, and only cheap now:** strip the `node_modules` symlink from `eb88030`, `46033b8` and `d1da54a` before pushing `3d` (R2.3-04).
4. **By CLAUDE.md's own six-reviewer rule**, R2.3-01 (High) is fixed or explicitly deferred by the owner before shipping to `main`. The fix is a short numeric table test.

## 5. Coverage

**Read in full:**
- `git diff 49aea94..8357568` for `test/`, `.github/`, `package.json`, `.gitignore`, README, CLAUDE.md and SMOKE.
- `test/golden.js`, `test/rules12.js`, the `rules11.js` diff, `golden.json` (structure), both workflows and STATUS.md.
- The code-card, PALS, ROSC, `CONTRA_IF` and `lintCode` sections of `engine.js`.

**Ran:**
- **Fresh clone:** `npm ci`, then the build (byte-identical, clean `git status`), then `npm test` (642 `ok`, exit 0).
- **Mutations:** 36 (28 clinical, 8 harmless), each against all 13 suites.
- **Arrest census:** of golden's 13 shifts.
- **Pages:** package step for v0.29.0 and v0.30.0, served locally, with the live-check script extracted verbatim and run against both.
- **History:** symlink checkout and `npm ci` reproductions in scratch only. I didn't run `npm ci` against the repo's real path.
- **Chrome UI:** `class_test` (20 ok), `gate_test` (6 ok) and `md_ui_test` (34 ok), all exit 0.
- **GitHub (read-only):** the workflow list and recent runs. There's no new run since `45388229307`, and "Deploy to Pages" doesn't exist yet.

**Couldn't check:**
- The Pages source and custom-domain settings (API 403).
- The live site (blocked).
- WebKit.
- `map3d_test`.
- The Supabase side.

Timings were taken on a machine shared with five other reviewers (load average 50–80), so they're upper bounds.
