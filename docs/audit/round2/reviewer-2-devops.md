# Reviewer 2, round 2: DevOps / Tooling, CI & Legal

Branch `claude/sleepy-rubin-jot35n` at `49aea94` (v0.30.0). `origin/3d` is at `5dce29f`, the same tree minus the round-2 brief. Reviewed Nov 24, 2026. The round-1 report is `docs/audit/reviewer-2-devops.md`.

## 0. Round-1 status

All 33 round-1 findings were rechecked against the code, CI and git.

| ID | R1 severity (Verifier) | Status | Evidence |
|---|---|---|---|
| R2-01 Whole repo published | High | Partly fixed (unverified) | The owner says the Pages source is now GitHub Actions. I couldn't confirm it: `gh api …/pages` returns 403 through the proxy, and nothing has been pushed to `main` since `c54d9c1`. The last deploy was the legacy `pages-build-deployment` (run 45240789894), so the whole v0.29.0 tree stays live until the next push to `main`. `pages.yml` has never run. See R2.2-06. |
| R2-02 Deploy not gated on tests | High | Still open | `pages.yml` is unchanged. It gates on `npm test` only (now with golden): no stress run, no Chrome UI job, no smoke test of `_site/`. `tests.yml` runs in parallel and is not a `needs:`. |
| R2-03 No CI on PRs or the working branch | High (Medium) | Still open | `tests.yml:7-10` is unchanged. The session branch has 0 runs. The v0.29.1 and v0.30.0 work first ran in CI at 11:52Z on Nov 24 (run 45388229307). That was after the release commit `f59708d` (11:44Z), so the release was cut before CI had ever seen its contents. |
| R2-04 No licence or copyright holder | High (Medium) | Still open | `ls LICENSE*` finds nothing. `package.json` has no `license` field. |
| R2-05 No types, lint or formatter | High | Worse | There's still no config. ESLint `recommended` (scratch install) still reports 87 problems. `engine.js` lines over 200 characters went from 368 to 386; the Phase 1 diff added 485 lines, 30 of them over 200 characters. |
| R2-06 Duplicate `LOOK` keys | Medium | Still open | The duplicate keys are still at `src/ui.js:1036-1039` and `1040/1045/1047/1051`. ESLint `no-dupe-keys` ×4. A one-line fix, untouched through a whole phase. |
| R2-07 Backend not in version control | High | Worse | There's still no SQL in the repo or its history. The release now ships a client written against an unapplied migration (the `ver` column; `ui.js:2398` retries without it on any 400). That migration lives only in notes: the brief says it is "not applied yet". |
| R2-08 Node 20 EOL, deprecated actions | Medium | Still open | `node-version: 20` everywhere. Run 45388229307 logs: "Node.js 20 is deprecated … forced to run on Node.js 24". |
| R2-09 WebKit red and ignored | Medium | Still open | `ci-results:webkit.txt` for `c54d9c1` still says `map3d_test FAIL / SOME FAILED`. v0.30.0 has **never** run in WebKit, the iPhone engine. The WebKit job runs only on `main` or by hand, and nobody dispatched it on `3d`. |
| R2-10 Write token everywhere, nothing pinned | Medium | Still open | `tests.yml:12-13` and the tag-pinned actions are unchanged. |
| R2-11 Python toolchain unpinned | Medium | Still open | `pip install playwright` is unpinned. There's no requirements file. |
| R2-12 Hand-rolled framework | Medium | Still open | The `npm test` `&&` chain grew to 12 commands. `golden.js` adds a 12th copy of the assert lambda (`inv`). The Python tests still have 237 `wait_for_timeout` calls against 4 auto-waits. |
| R2-13 Stress prints instead of asserting | Medium | Still open | `test/stress.js` is unchanged. Rerun here: exit 0 with "md hard … worst 3: FIRED, FIRED, FIRED" and no threshold. |
| R2-14 Build outputs and screenshots committed | Medium | Still open | The merge brings 22 MB of `docs/audit/screenshots/` onto `main`, and every CI checkout pulls it. |
| R2-15 Asset and data pipelines not reproducible | Medium | Still open | `art/`, `tools/` and `docs/em-model/parse.py` are untouched. |
| R2-16 KayKit credit | Medium | Still open | `README.md:254` and `src/ui.js:2599` still credit KayKit. |
| R2-17 ABEM document without a licence | Medium | Still open | Unchanged. |
| R2-18 Image licence gaps | Medium | Still open | `img/` and `build.js` are unchanged. The README still says the images are "from Wikimedia Commons". |
| R2-19 Notices stripped from bundle | Low | Still open | `grep -c Kapoulkine 3d/map3d.js` = 0. |
| R2-20 Dependency drift | Low | Still open | `npm outdated`: three 0.170.0 against 0.187.0. `npm audit`: 0 vulnerabilities. |
| R2-21 Config hardcoded | Low | Still open | `build.js` and the `CB` block are unchanged. |
| R2-22 Gate password in plaintext | Low | Won't fix | Owner decision (PRO_AUDIT §5). |
| R2-23 Docs disagree with reality | Low | Worse | `README.md:231-233` still says `npm install` and "six suites, 310 checks", and doesn't mention golden. `CLAUDE.md:150` says "~520" checks, but there are 587. A new README claim (`README.md:57`) is false; see R2.2-02. |
| R2-24 Informal versioning | Low | Still open | `git ls-remote --tags origin` is empty, so v0.30.0 is untagged. There's no CHANGELOG. CLAUDE.md:19 says the release history lives in the owner's claude.ai Project, not the repo. |
| R2-25 Code meaning depends on key order | Low | Partly fixed | The golden code fixtures now catch a `SCENS`/`PACKS` reorder within one version. There are still no explicit ids, and the fixtures are regenerated on every release (R2.2-01). |
| R2-26 Commit history quality | Low | Still open | All 7 new commits are authored by "Claude". See R2.2-14. |
| R2-27 SW timeout and precache | Low | Still open | The `sw.js` template is unchanged. |
| R2-28 CI waste, uneven coverage | Low | Still open | No caches. Weather is still never run by stress or golden. |
| R2-29 Dead files | Nitpick | Still open | Unchanged. |
| R2-30 Thin `.gitignore` | Nitpick | Still open | It has 3 entries. `_site/`, which the release verification itself creates, isn't ignored. |
| R2-31 Naming debt | Nitpick | Still open | Unchanged. |
| R2-32 `pages.yml` copies CNAME | Nitpick | Still open | `pages.yml:37`. |
| R2-33 Vacuous `if (p)` test | Nitpick | Worse | `rules.js:62` is unchanged. Phase 1 repeated the pattern at `rules11.js:84` and `:140`, and added a test that can never fail (R2.2-03). |

**Counts:** Fixed 0. Partly fixed 2. Still open 26. Worse 4. Won't fix 1.

## 1. Verdict

**Only after major work.** Not one tooling, CI or legal finding from round 1 was fixed. The workflows, `.gitignore`, licence, credits, lint and types are byte-for-byte where they were. The one new piece of engineering, the golden "safety net", fails when you add an unused field to the state object or swap two keys. It also passes when refractory VF is scored as "adenosine 6 mg rapid push". It's sensitive to the wrong things and blind to the right ones. The release is about to deploy through a pipeline that has never run once, behind a Pages setting nobody can show me. Its own commit sets a clinician sign-off as a merge gate, and nobody has met it.

## 2. Score

**4 / 10.** Unchanged. The golden arrival and stream checks are real gains, but they're offset by a new snapshot that will be rubber-stamped, a new vacuous test, and zero progress on the foundation.

## 3. New findings (worst first)

### R2.2-01 · High · The golden snapshot is a change detector, not a safety net · [Phase 0, release]
- **Location:** `test/golden.js:50` (`stateHash: fnv(JSON.stringify(OC.G))`), `:19` (`arrivalsHash`), and `:66` (code fixtures salted with `VERSION`).
- **What's wrong:** It fails on changes that alter no behaviour. I mutated scratch copies of `src/engine.js` and ran every suite:

  | Mutation (no behaviour change) | Golden diffs | What the diff shows |
  |---|---|---|
  | Add an unused key `_x: 0` to the `G` literal (`engine.js:846`) | 13 of 13 shifts | Only `stateHash` |
  | Swap `pts: {}` and `order: []` in the `G` literal | 13 of 13 shifts | Only `stateHash` |
  | Copy edit: "results are back" to "results are in" (`engine.js:558`) | 4 shifts | Every metric identical. Only `stateHash` |
  | `package.json` 0.30.0 to 0.30.1 | 20 of 20 codes | New code strings |

- **The diff can't be reviewed.** A failure prints two 8-hex hashes, so the reviewer can't tell what changed.
- **History shows the pattern:** `golden.json` was regenerated in 3 of the 4 commits after Phase 0 that touched `engine.js` or the version (`8c75f86`, `443497d`, `f59708d`). The release commit regenerated it only because the version salt moved 19 of 20 codes. Each such commit trains `npm run golden:update` as a reflex.
- **Why it matters:** PRO_AUDIT Phase 5 (ES modules, TypeScript) exists to restructure `G`, and that will move every `stateHash`. The only remedy offered is `golden:update`, which throws away the baseline at exactly the moment it's needed.
- **Fix:**
  - Delete `stateHash`.
  - Record behaviour as readable data: the arrival list as `ck@t` strings (not a hash), and per patient `{id, ck, dispo, dx, outcome, tDone}`.
  - Make the code fixtures `setCodeVersion('golden', [])` so they don't depend on the release. Test the version salting once, separately.
  - Make `--update` print a readable diff and refuse to run without `--reason "<text>"`.
- **Effort:** M

### R2.2-02 · High · Golden is blind to the clinical rules this release added, and the docs say the opposite · [Phase 0/1, release]
- **Location:** `test/golden.js:86-98`. The claims are at `README.md:57` ("now catches any change to a seeded shift, a class code, a save or an answer key") and `CLAUDE.md:160` ("A change that moves … an answer key fails it").
- **What's wrong:** These scratch mutations pass golden:

  | Mutation | rules1-11 | golden |
  |---|---|---|
  | Refractory VF right answer becomes "Adenosine 6 mg rapid push" (`engine.js:2018`) | pass | pass |
  | Dissection removed from `HCG_CASES` (`engine.js:273`) | pass | pass |
  | Game-run doctor code odds 0.6 to 0.95 (`engine.js:2091`, undoes the `443497d` fix) | pass | pass |
  | Snow walk-ins ×3.5 (`engine.js:2449`) | pass | pass |
  | Lytic window 270 to 360 min (`engine.js:1135`) | rules11 FAIL | pass |
  | Nitroglycerin contraindication SBP 90 to 60 (`engine.js:435`) | rules11 FAIL | pass |

- **Why it's blind:**
  - The `answers` section records `RXOK`, `ALSO` and `contraOf` for one randomly drawn patient at one moment.
  - It never evaluates `CONTRA_IF` at its boundaries.
  - It doesn't record `CODE_Q`.
  - The hCG requirement shows only when the seed happens to draw a woman of 12 to 55.
  - No shift runs with weather or the MIEMSS pack.
- **Why it matters:** The first mutation teaches a contraindicated drug in cardiac arrest, and `npm test`, CI and `pages.yml` would all pass it and deploy it.
- **Fix:**
  - Snapshot the answer-key tables as data: all `CODE_Q` cards with their right index, `HCG_CASES`, `REQ_AGE`, `RXREQ`, `NEVER_WRONG` and `SAME_CLASS_OK`.
  - Evaluate every `CONTRA_IF` entry at fixed probe states: LKW 269, 271 and unknown; SBP 89 and 91; troponin back or not; crashed or not.
  - Snapshot each case with fixed demographics (F30, M30, F60, M60).
  - Add weather and MIEMSS shifts.
  - Correct `README.md:57` and `CLAUDE.md:160` today.
- **Effort:** M

### R2.2-03 · Medium · A Phase 1 test that can never fail · [Phase 1]
- **Location:** `test/rules11.js:155-157`. `node -e` shows `typeof OC.inStream === 'undefined'`.
- **What's wrong:** `OC.inStream && OC.inStream('rngZ', …)` never runs. `assert(!OC.inStream || threw, …)` is therefore always true, and it prints "ok - an unknown random stream is refused". The guard it claims to test (`engine.js:58`, listed as a fix in `443497d`) is never exercised. Two more checks skip silently: `rules11.js:84` (`if (p.right)`) and `:140` (`if (p)`).
- **Why it matters:** An "ok" line that tests nothing is worse than no line. It inflates the 587 count and hides a gap in class-code sync protection.
- **Fix:** Export `inStream` (or a test hook) and assert `threw` unconditionally. Replace each `if (x) { assert… }` with `assert(x, …)` first. Add a grep check in CI that rejects `!OC.` guards inside asserts.
- **Effort:** S

### R2.2-04 · Medium · The UI tests play a different random shift every run; the release "fix" loosened the assertion instead · [release]
- **Location:**
  - `src/ui.js:2619` seeds `newGame` with `Math.random()`.
  - `test/md_ui_test.py` starts by tapping the level button.
  - `5dce29f` widened `md_ui_test.py:110` to accept the gray-zone and `NODX` flows.
  - `:111` then checks the diagnosis UI only `if` the random patient has `dxq`.
- **Evidence:** I ran it 8 times from a fresh clone, and all 8 exited 0. The number of `ok` checks varied from 28 to 34. "You pick the diagnosis from four", "the right diagnosis counts", "accuracy and legal risk show", "Admit opens the consult list" and "made the right call" ran in only 5 of the 8 runs.
- **Why it matters:** A green Chrome job (run 45388229307) doesn't tell you whether the attending's core loop was tested. The commit itself admits the test "failed whenever it drew one of those".
- **Fix:**
  - Start with a fixed seed: a class code, or a `?seed=` test hook.
  - Put a known case in a room with `OC.trainPatient`.
  - Assert the diagnosis flow unconditionally.
  - Test the gray-zone and `NODX` flows in their own blocks.
  - Apply the same to `ui_test`, `map_test` and `events_test`.
- **Effort:** S

### R2.2-05 · Medium · The release's own merge gates are unmet and unrecorded · [release]
- **Location:**
  - `8c75f86` says: "Needs clinician sign-off before merge: the changed answer keys…"
  - PRO_AUDIT §7, Phase 1, says the same.
  - `test/rules11.js:70` asserts the unreviewed "neutral" morphine/metoprolol scoring as a passing check.
  - `docs/SMOKE.md:3` says "Anything that fails blocks the merge."
- **What's wrong:** Nothing in the repo records a clinician sign-off or a smoke run for v0.30.0. The "Release verification" block in `5dce29f` lists automated checks only. The release commit `f59708d` doesn't mention either gate.
- **Why it matters:** Gates that exist only as prose are skipped under deadline. This release already skipped them.
- **Fix:**
  - Add a release checklist (`docs/releases/v0.30.0.md` or a PR template) with signed lines: the clinician's name and date for the changed keys, the SMOKE device and date, and the WebKit run link.
  - Protect `main` (today: "Branch not protected") and merge through a PR that requires the checklist.
- **Effort:** S

### R2.2-06 · Medium · The merge is the first-ever run of the deploy pipeline, in production, with no pre-flight, post-check or rollback · [release]
- **Location:**
  - `mcp__github__actions_list list_workflows` shows only "Tests" and the legacy `pages-build-deployment`. "Deploy to Pages" doesn't exist yet: `pages.yml` isn't on `main` (`git show origin/main:.github/workflows/pages.yml` gives "exists on disk, but not in 'origin/main'").
  - `main` is unprotected.
- **What's wrong:**
  - **If the Pages source switch didn't take:** the legacy deploy publishes `CLAUDE.md`, `docs/PRO_AUDIT.md` and `docs/audit/` on the live domain. Those documents include step-by-step write-ups of the still-unfixed class-results holes (R3-01, R3-02).
  - **If the switch did take:** production gets an artefact that has never been served from `edcodeblack.com`, under the gate host check and the custom domain. I reproduced the package step in scratch and served it on localhost. It loaded with 0 responses at 400 or above, 0 console errors, the 3D canvas and the service worker. That proves nothing about the real host.
  - Neither path checks that `/CLAUDE.md` returns 404 afterwards, and neither documents a rollback.
- **Fix:**
  - Before merging, the owner confirms Settings → Pages shows "Source: GitHub Actions" (a screenshot in the release checklist).
  - Dispatch `tests.yml` on `3d` to get a WebKit run (`workflow_dispatch` exists on `main`).
  - Add a final `pages.yml` job that runs `curl -sf https://edcodeblack.com/` and checks for a 404 on `/CLAUDE.md`, `/src/engine.js` and `/docs/PRO_AUDIT.md`.
  - Write down the rollback: revert the merge and push, or re-run the previous successful deploy run.
- **Effort:** S

### R2.2-07 · Low · The release steps are hand-edited and incomplete · [release]
- **Location:**
  - `CLAUDE.md:19` lists the steps.
  - `package-lock.json:3,9` says `"version": "0.17.0"`.
  - `src/ui.js:1967` holds `PAST_V = ['']`; `test/rules7.js:55` uses `['', '0.29.0']`.
- **What's wrong:**
  - The documented steps omit `golden:update`, which every release now requires (R2.2-01). They also omit SMOKE, stress, the UI tests and WebKit.
  - The lockfile's root version is 13 releases stale, because `package.json` is bumped by hand rather than with `npm version`.
  - No test reads the `PAST_V` the UI actually ships. The tests use their own lists.
  - There's no tag.
- **Fix:** Add an `npm run release <x.y.z>` script. It should:
  - run `npm version <x.y.z> --no-git-tag-version`, which updates both files;
  - write `PAST_V` from the previous tag;
  - build, test and tag.

  Also add a test that parses `ui.js` and checks that `PAST_V` matches the last tag's version.
- **Effort:** S

### R2.2-08 · Low · The save test is same-version only, with one charge-nurse shift · [Phase 0]
- **Location:**
  - `test/golden.js:76-84`.
  - `src/ui.js:2544` resumes non-class saves across versions.
  - `engine.js:4642`: `OC.load` migrates only `spec`.
- **What's wrong:** The real release risk is a v0.29.0 save loaded into v0.30.0, and nothing in the repo tests it. I tested it myself: 50 mid-shift v0.29.0 saves (rn and md, hard, 3 of them with an arrest in progress) played to 19:00 on v0.30.0 with no exceptions or stuck arrests. Twenty saves taken mid code card resumed identically. So it holds today by luck, not by test.
- **Fix:** Commit `test/fixtures/save-<prev>.json` each release, and assert that it loads and plays to 19:00. Add an attending save taken mid-code.
- **Effort:** S

### R2.2-09 · Low · `docs/SMOKE.md` can't be completed as written · [Phase 0]
- **Location:** `docs/SMOKE.md:3` and `:42`, and `src/ui.js:2838`.
- **What's wrong:** "Open it from the phone over the local network" with `python3 -m http.server` gives an `http://<LAN-IP>` page. That isn't a secure context, so `navigator.serviceWorker` is absent and the "Airplane mode, then reload" check can't pass. "Or use the deployed preview" refers to a preview that doesn't exist: only `main` deploys.
- **Fix:** Document an HTTPS route (a mkcert certificate with any static server), or add a preview deploy for `3d`.
- **Effort:** S

### R2.2-10 · Low · A claimed hostile-review fix has no test · [Phase 1]
- **Location:** `engine.js:2091`, and `443497d` ("Running the code well yourself now beats handing it off").
- **What's wrong:** Changing the game-run doctor's `0.6` to `0.95` passes every suite, including `rules11` (its `codeRate` only compares right answers with wrong ones).
- **Fix:** Assert in `rules11` that a game-run code's ROSC rate is below the rate for the player with all answers right.
- **Effort:** S

### R2.2-11 · Low · Phase 0 delivered less than its own spec · [Phase 0]
- **Location:** PRO_AUDIT §7, Phase 0, compared with `test/golden.js`.
- **What's wrong:**

  | The spec asked for | Delivered |
  |---|---|
  | "Each level × scenario × role" (40 combinations) | 13: no attending × ct/mci/short, no weather, no MIEMSS pack |
  | Fingerprint of the "arrival list … door-to-doc median" | A hash, and no door-to-doc |
  | "The scored result of the textbook order set" | The key data, not the score |
  | Branch `audit/phase-0` | Committed on the session branch |

- **Fix:** Close the gap, or amend the plan to say what was descoped and why.
- **Effort:** S

### R2.2-12 · Nitpick · Small defects in golden.js · [Phase 0]
- `:83` `bytesAt3h: saved.length > 0` is always true.
- `:111` compares only the new codes, so a shortened fixture list passes.
- `:102-104` writes the snapshot before the invariants at `:117-121` run, so `--update` happily records `sameEarlyArrivals: false`.
- It re-runs the 71-case loop that `rules10` already runs.
- `npm test` went from 12.9 s in round 1 to about 30-41 s here (34 s in CI), and still runs serially.
- **Effort:** S

### R2.2-13 · Nitpick · Commit hygiene in the pending merge · [release]
- The merge puts 28 commits on `main`, including "(in progress)" commits (`dd77c4f`, `14f543b`, `d373da3`) and a WIP commit (`2190173`).
- 8 subjects run over 72 characters.
- The Phase 0 and 1 commits break CLAUDE.md's own rule "Commit messages start `vX.Y.Z:`" (`1aa61ea`, `8c75f86`, `add7286`, `443497d`).
- `5dce29f` bundles a test fix with an unrelated change to the process rules.
- **Fix:** Squash the WIP commits before merging, and keep one topic per commit.
- **Effort:** S

## 4. Coverage

**What I reviewed and ran:**
- **Read in full:** `git diff 6edcc3d..HEAD` (all 14 files), `test/golden.js`, `test/golden.json` (structure, plus the history of every update), `test/rules11.js`, `docs/SMOKE.md`, both workflows, the `package.json` and `package-lock.json` headers, the README dev and credits sections, and the CLAUDE.md release, test and CI sections.
- **Fresh clone, timed:** clone, `npm ci` and build took 5.5 s with a warm cache and 7.2 s with a cold `--cache`. The build is byte-identical (`git status` clean). `npm test`: 587 ok, exit 0, 30-41 s. `npm run stress`: exit 0, 47 s. `md_ui_test`: 8 runs with system Chrome. So the JS side takes well under 5 minutes. The README still doesn't document the Python and Playwright setup.
- **Mutation testing:** 17 mutations of scratch copies of `engine.js` or `package.json`, each run against all 12 suites. Results are in R2.2-01, R2.2-02 and R2.2-10.
- **Cross-version save test:** v0.29.0 engine saves (from `origin/main`) loaded into v0.30.0, plus 20 saves taken mid code card.
- **Package step:** `pages.yml`'s package step reproduced and served, then loaded headless in Chrome.
- **Scans:** ESLint `recommended` (scratch install, 87 problems), line lengths, `npm audit` and `npm outdated`.
- **Secrets:** a scan of all history (`git log --all -p`) for `sb_secret_`, `service_role`, JWTs, `ghp_`/`github_pat_`, `sk-`, `AKIA`, private-key headers, Slack and Google keys. Nothing found apart from my own round-1 report's mention of the word "service_role". The only key is the publishable `sb_publishable___VN24…`, which is public by design and protected only by RLS that isn't in the repo. The only email in history is `noreply@anthropic.com`.
- **GitHub (read-only):** workflows, runs on `3d` and the legacy Pages runs, the jobs and full logs of run 45388229307 (rules, Chrome and stress all green; WebKit skipped), branches (none protected), and `ci-results:webkit.txt`.

**What I couldn't check:**
- The Pages source setting (the API returns 403 through the proxy) and the live site (blocked).
- The WebKit UI suite: no WebKit browser here, and I didn't run `playwright install`.
- `map3d_test` locally (CI ran it green).
- The Supabase schema, RLS and the pending migration (not in the repo).
- The licence status of the mesh2motion upstream and the ABEM model (unchanged since round 1).

**Process note:** All scratch work stayed under `scratchpad/round2/r2/`. The repo working tree is untouched apart from this report. `git fetch origin ci-results` updated `FETCH_HEAD` only.

## 5. What I'd grudgingly keep

- The stream-sync invariants in `golden.js:117-121`. They're real checks, and the two play styles do diverge (rn/med: 50 against 15 discharged).
- Arrival-rate changes fail golden on all 13 shifts (the `HOUR_MUL` mutation).
- Golden fails loudly when its snapshot is missing (`golden.js:101`).
- The deterministic build: byte-identical from a cold clone.
- `npm audit` shows 0 vulnerabilities with three dev dependencies.
- No secrets anywhere in history.
- The package step publishes only runtime files, and the packaged site loads cleanly.
