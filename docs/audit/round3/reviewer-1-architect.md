# Reviewer 1, round 3: Senior Software Architect

Re-audit of the round-2 fixes on branch `claude/sleepy-rubin-jot35n` at v0.30.0 (HEAD `8357568`), Nov 24, 2026. Scope: `git log 49aea94..HEAD`, `git diff 49aea94..HEAD -- src test`. I changed nothing in the repo except this file. All work ran on a clone in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round3/r1/` (`repo/`, `tools/mutate.sh`, `tools/muts.txt`, `mut_results.txt`, `scripts/*.js`, `lintgap/`).

## 0. Round-2 status

| ID | R1.2 severity | Status | Evidence |
|---|---|---|---|
| R1.2-01 Golden can't protect anything | High | **Partly fixed** | New `codeKey`/`radioKey`/`hcg` snapshots now catch a flipped right answer or radio key (M01a, M01b, M02a, M07, M08 below), and code fixtures no longer change per version. But `stateHash` and `arrivalsHash` are still opaque hashes, `codeKey` stores only the right label of each card, as an unfilled template (`"{epi} mg"`), and MUTANT_UNCAUGHT_COUNT of MUTANT_TOTAL wrong clinical or scoring edits still pass every test (section 4). |
| R1.2-02 Order review split by a save | High | **Fixed** | `S.log` holds patient ids (`engine.js:1825-1826`); golden replays 4 attending seeds and a mid-code reload. The aliasing walker I asked for was not added (see R1.3-12). |
| R1.2-03 Events desync class shifts | High | Deferred (Phase 4) | Not re-checked. |
| R1.2-04 An abandoned code never ends | Medium | **Fixed, with a new defect** | `p.code.tLeft` (`engine.js:2247-2252`) ends it 20 min after the doctor leaves. The takeover path now mis-scores the odds (R1.3-05). |
| R1.2-05 Crash `drop` misses `p.treat` | Medium | **Partly fixed** | The delete is in `crashSetup` (`engine.js:3431`), but its only test never signs an order, so deleting the fix passes every test (M06a). `lyticWindowClosed` still cancels with its own `delete p.treat.tnk`; there is still no single "cancel order" function. |
| R1.2-06 `CONTRA_IF` closures over `G` | Medium | **Partly fixed** | Unknown onset now means one thing (`lyticWindowOk`, `engine.js:1168`). But round 2 added nine more closures (`engine.js:431-438`), one of which depends on click order (R1.3-02). The lint skip at `engine.js:4779`, `treatOkNow`'s inference and the false "never erases" comment on `addContraIf` are unchanged. |
| R1.2-07 ACLS key is unvalidated tuples | Medium | **Partly fixed** | `lintCode()` (`engine.js:4791`) checks the shape of what exists. Choices are still positional `[label, whyKey, 1?]` tuples keyed by index, scoring now reads a regex on the why-key names (R1.3-04), the lint misses what the code needs (R1.3-07), there is no `source` field, and `addCase` still can't declare an arrest cause. |
| R1.2-08 Vacuous `inStream` test | Medium | **Fixed** | `rules11.js:157` asserts `typeof OC.inStream === 'function' && threw`. The price: `inStream` is now on `window.OC` in production (R1.3-11). |
| R1.2-09 No save version or migration | Low | **Worse** | `G.v` is still 5. The heuristic added to `OC.load` cannot tell a v0.29 save from a v0.30 one and corrupts current saves (R1.3-01). |
| R1.2-10 Write-only state | Low | Still open | `p.code.n`, `md.codeRight`, `md.codeWrong`, `report.noTeam` and `report.lyticLate` are still read by nothing in `ui.js`. `p.traumatic` joined them: `codeRhythm` no longer reads it. |
| R1.2-11 Dead-state list retyped | Low | **Worse** | `ui.js:927` adds another inline `['family', 'morgue', 'morguing']`. `vitalsOf` gained `dead: true` (`engine.js:1110`) but still returns `arrest: true` for the dead, and the UI doesn't use `dead`. |
| R1.2-12 Tests drive unreachable states | Low | Still open | `rules12.js`'s header says "Every check drives the real game path … not a hand-built object". Lines 85, 87, 96 and 98 build objects by hand; lines 51, 68 and 171 `crashNow` roomed patients (in play, `crash()` only fires in triage or the waiting room, `engine.js:3545,3549`); 175 calls `harmCheck` directly; 122 calls `staffGone`; 197 is still a conditional `if (bay) assert(...)`. |
| R1.2-13 Stream slots in two places | Low | **Partly fixed** | The numbers now agree (`engine.js:59` and `873`), but they are still two tables. `regionTick` and `eventsTick` still share `rngE` (`3652`, `3921`), and the comment "every stream has its own slot" is still false. |
| R1.2-14 One procedure, seven tables | Low | **Worse** | A-fib cardioversion now lives in `TREAT` (305), `ORDER_MENUS` (500), `PROC` (503), `HARM` (1800), `afOnset`/`cardiovertOk` (1165-1166), a special case in `signOrders` (1893), a special case with an inline harm tuple in `harmCheck` (1942), `CRASH.afib` (3411), `CONTRA_IF`/`CONTRA_WHY` (`afib`), `ALSO.afib`, and in `ui.js` at 909 (onset row), 1010 (menu) and 1877 (the "48 hours" lesson text, with no shared constant). |
| R1.2-15 One global card slot | Low | **Worse** | `codePick` adds a fourth `G.card.mine = true` after `setCard` (`engine.js:2212`). The new `coderes` card works only because `chooseCard` silently ignores an `eid` with no handler. |
| R1.2-16 Determinism tested on V8 only | Low | Still open | No change. |
| R1.2-17 Display strings as state | Nitpick | Still open | `'Died in cardiac arrest: no code team'` still has no `DX_PLAIN` entry. `rules12.js` decides pass or fail by matching `p.dx` text five times. |
| R1.2-18 Small golden defects | Nitpick | Partly fixed | `bytesAt3h` is gone. `'error: ' + e.message` is still frozen as an expected answer (`golden.js:116`); `npm test` still chains with `&&`. |
| R1.2-19 Lazy counters, changelog comments | Nitpick | **Worse** | "Audit"/"Round 2"/finding-ID stamps in `engine.js` went from 16 to 27. The `(x || 0) + 1` counters remain. |
| R1.2-20 Docs describe tests wrongly | Nitpick | Partly fixed | CLAUDE.md now calls golden "a change detector". It still says "~520 ok lines"; `npm test` prints 642. The `rules12.js` header claim is false (R1.2-12). |
| R1.2-21 Markup in sim data | Nitpick | **Worse** | `codePick` now composes a whole result screen in the engine, with `**You:**`, `**The call:**` and `\n` (`engine.js:2209-2211`). |

**Counts:** Fixed 3 (02, 04, 08; 04 with a new defect), Partly fixed 7 (01, 05, 06, 07, 13, 18, 20), Still open 5 (10, 12, 16, 17, plus 03 deferred), Worse 6 (09, 11, 14, 15, 19, 21).

## 1. Verdict

VERDICT_PLACEHOLDER

## 2. Score

SCORE_PLACEHOLDER

## 3. New findings (worst first)

### R1.3-01 · High · The "old save" repair in `OC.load` fires on current saves: every reload resets a field cardiac arrest's clock and wipes its late penalty *(round 2, R3.2-02 / R1.2-09)*
- **Location:** `engine.js:4806` (`load`: `if (p.arrest && p.tArrest == null) p.tArrest = G.t`); `engine.js:696` and `1141` (case `arrest` is created with `arrest: true` and no `tArrest`); `2180` (`codeStart`: `wait = G.t - (tArrest ?? tArrive)`); `2251` (`arrestNoTeam` reference); every caller of `E.load` in `ui.js` (`resumeSave`, `boot2`); `rules12.js:128`.
- **What's wrong:** The repair assumes that an arrest with no `tArrest` must come from a v0.29 save. In v0.30 every **field cardiac arrest** (the `arrest` case, which arrives already pulseless) has no `tArrest`, and its clock runs from `tArrive`. So any load re-stamps it with the resume time. Loads happen after a tab kill, a reload, the 15-second autosave being resumed, and a hot reload. `scripts/fieldreload.js`:
  - Nobody runs the code. Unbroken, the patient dies of "no code team" **20.0** minutes after arriving. Saved at minute 15 and reloaded: **35.0** minutes.
  - A doctor takes the code at minute 11. `p.code.wait` is **11** unbroken and **0** after a reload, in **30 of 30** seeds. The late multiplier goes from 0.60 to 1.00, so a reload raises the odds of ROSC by two thirds.
  - This breaks the save-identity invariant the project leans on, and class fairness: a student who reloads gets a better code.
  - Golden's save round trips never have an untreated field arrest at the save point. `rules12.js:128` hand-deletes `tArrest` to fake an old save, so it certifies the heuristic.
  - This is the bug class R1.2-09 asked to close with a version number.
- **Fix:**
  - Stamp `tArrest` wherever an arrest begins, including `makePatient` for `c.arrest` (`tArrest = tArrive`).
  - Bump `G.v` to 6. Migrate only `g.v === 5`, and let `readSave` accept 5 and 6.
  - Add a golden round trip that saves with an untreated field arrest on the board.
- **Effort:** S

### R1.3-02 · High · "No aspirin after a lytic" depends on click order *(round 2, R6.2-17)*
- **Location:** `engine.js:433` (`asa: p => !!p.id && (p.tr || []).includes('tnk')`); `signOrders` `engine.js:1844-1850` (each drug is checked against `contraOf(p)` inside the loop; `p.tr` gets the new treatments only after the loop); `rules12.js:147-149`.
- **What's wrong:** The closure reads `p.tr`, and `signOrders` fills `p.tr` only after its harm check. `scripts/asa_tnk.js`, the same in-window stroke each time:

  | Orders | Harm |
  |---|---|
  | Tenecteplase, then aspirin in a later signing | 1 |
  | Tenecteplase and aspirin **on one order sheet** | **0**: aspirin is one "extra" (−3 instead of −20), logged as "Meds" with no reason |
  | Aspirin, then tenecteplase | 0 |

  The common mistake, both drugs on one sheet, is scored as a minor extra. The test covers only the sequential case. This is R1.2-06's root cause (closures over mutable game state) producing a wrong score.
- **Fix:**
  - Evaluate contraindications against the order set after signing (`p.tr` plus this signing's treatments), passed in explicitly. Better, make `CONTRA_IF` data rules evaluated by one function that takes that set.
  - Test all three orderings.
- **Effort:** S

### R1.3-03 · High · `CONTRA_WHY` is a parallel table with a per-drug fallback that teaches wrong reasons, and the "never name an unmade diagnosis" rule has no check *(round 2, R6.2-08)*
- **Location:** `engine.js:470-486` (`CONTRA_WHY_DRUG`, `CONTRA_WHY`, `contraWhy`); the `addCase` `contra` lists (`engine.js:4632-4738`), which carry no reasons; `rules12.js:73-75`.
- **What's wrong:** Reasons live in a table keyed by case, 3,000 lines from the case format, and only 14 cases have one. Every other case falls back to a reason written per drug, mostly for bleeding. `scripts/why.js` records what the harm message says before any diagnosis is named:

  | Case + drug | Message | Problem |
  |---|---|---|
  | Salicylate overdose + aspirin | "it adds to the bleeding risk" | Wrong reason: the harm is more salicylate |
  | Stroke with unknown onset + tenecteplase | "it is more than 4.5 hours since they were last known well" | False: the onset is unknown |
  | Sepsis + furosemide | "it drains volume from a septic patient" | Names the answer to the open diagnosis question (`DXQ.sepsisw = 'Sepsis'`). The patient may also carry a sepsis alert |
  | Hyperkalemia + potassium, TCA overdose + ondansetron | "it isn't safe for this patient (the case's lesson says why)" | No reason at all |

  CLAUDE.md says a reason "must never name a diagnosis the player hasn't made". Nothing enforces that. The only test asserts that the bowel-obstruction text avoids the word "obstruction"; it says "blockage" instead. Whether the salicylate line counts as Critical clinical teaching is R6's call.
- **Fix:**
  - Make the reason part of the contraindication record (`addCase({ contra: { asa: 'more salicylate on top of the overdose' } })`, and the same for `CONTRA_IF` rules).
  - Keep per-drug text only for true class facts.
  - Lint that every `CONTRA` and `CONTRA_IF` entry has a reason.
  - Test every reason against its case's `dx`, `DXQ` and `DDX` strings.
- **Effort:** M

### R1.3-04 · Medium · "VF that is never shocked" is decided by a regex on reason-key names *(round 2, R6.2-10)*
- **Location:** `engine.js:2201` (`if (/^shock/.test(ch[1])) p.code.shocked = true`, right answers only); `codeOutcome` (`if (C.me && C.r === 'vf' && !C.shocked) odds *= 0.1`); `CODE_Q.vf` and `kidvf`.
- **What's wrong:** Whether a shock was delivered is inferred from the name prefix of the *right* answer's reason key.
  - Adult VF (`scripts/shocked.js`): "Epinephrine 1 mg first, then shock", then "Amiodarone instead of a second shock", then "Shock, then amiodarone 300 mg IV" (right, key `amio`). That is two shocks, and `code.shocked` is **false**.
  - Child VF (`scripts/shocked2.js`): "Shock at 200 J", then "Shock, then epinephrine 1 mg IV", then "Shock at 128 J, then amiodarone" (right). That is three shocks, and `code.shocked` is **false**.
  - Both get the never-shocked odds (×0.1).
  - Renaming a reason key silently changes scoring (M18, section 4).
  - `rules12.js`'s own "VF with no shock" test picks "Epinephrine 1 mg first, then shock" as its no-shock answer, so the oracle encodes the bug.
- **Fix:** Put `shock: true` on every choice that delivers one, compute `shocked` from the choices picked, and lint that every VF card set has a shocking right answer.
- **Effort:** S

### R1.3-05 · Medium · A code taken over by a second doctor restarts, and the first team's minutes are charged as "no team" *(round 2, R3.2-01 / R1.2-04)*
- **Location:** `engine.js:2021-2027` (`codeTeam` now always calls `codeStart`); `2179-2184` (`wait = G.t - tArrest`); the comment at `2026`.
- **What's wrong:** `scripts/resume_wait.js`: Dr. Patel runs the code for 10 minutes and goes home, and Dr. Okafor takes over one minute later.
  - The result is a new `p.code` with step 0, right 0 and **wait 11**. The late multiplier is **0.60**; counting only the orphaned minute it would be 1.00.
  - The comment says "the minutes without a doctor count against the odds". The code counts every minute since the arrest, including the ten with a doctor running CPR.
  - The takeover also restarts the card sequence and a fresh 15-minute task.
  - This path is ordinary: providers leave at the end of mandated hours (`staffTick`, `staffGone(s, 'gone')`) and through `EV.sick`.
- **Fix:**
  - Keep `p.code` across teams.
  - Add the orphaned intervals (from `tLeft` to the resume) to `wait`, and keep `step` and `right`.
  - Give the new team the remaining task time.
  - Test the takeover odds.
- **Effort:** S

### R1.3-06 · Medium · `rxName` rewrites the medication history from live vitals *(round 2, R6.2-04)*
- **Location:** `engine.js:1793-1798`; `ui.js:698` ("Given: …") and `918` (the attending's Medications row); `trName` (`engine.js:1819`).
- **What's wrong:** `rxName` now filters the drugs given through `contraOf(p)`, which is what is contraindicated *at this moment*.
  - `scripts/rxname.js`: stable A-fib, diltiazem given, and the UI line is "Given: diltiazem". After the crash, the same finished order reads **"Given: symptom treatment"**. The drug that was given disappears from the chart exactly when the student needs to see it.
  - The fallback decides whether a phrase is safe by searching for drug display names inside free text (`RX[p.ck].includes(DRUGS[d].n.toLowerCase())`). That is R1-03 again.
- **Fix:**
  - Record what was given at the moment of administration (`p.given`) and print that.
  - Keep "don't suggest a contraindicated drug" in the hint path only (`missNow`/`trName`), driven by data, not text search.
- **Effort:** S

### R1.3-07 · Medium · `lintCode` checks the shape of what exists, not what the code needs, so broken data still crashes a shift *(round 2, R1.2-07)*
- **Location:** `engine.js:4791-4803`, compared with `codeCause` (`2151-2155`, which hard-codes the causes `'bleed'` and `'look'`), `codeSteps` (`2173`, which builds `'kid' + r`) and `codeFill` (`2167-2170`).
- **What's wrong:** Each of these broken copies (in `lintgap/`) loads cleanly:
  - **`CODE_CAUSE.look` deleted:** the first adult PEA or asystole code with no case cause throws inside `OC.step` ("reading 't'"). In the browser that is the R1-04 freeze.
  - **`CODE_Q.kidasys` deleted:** a child in asystole throws ("reading 'slice'").
  - **Placeholder typo `{epii}`:** the card shows "epinephrine {epii} mg".

  There are also no checks that:
  - `TRAUMA_CASES`, `LIMB_CASES`, `BLEED_SRC` and `CAUSE_OF` don't overlap (precedence in `codeRhythm`/`codeCause` decides silently);
  - `NONSHOCK_CAUSES` names real causes;
  - `CODE_NAME` covers every rhythm.

  The lint's own rhythm list (`['vf', 'pea', 'asys', 'trauma', 'limb']`) is yet another copy of the rhythm set.
- **Fix:**
  - Use one `RHYTHMS` table and one `CAUSES` table that `codeRhythm` and `codeCause` draw from.
  - Lint every card set `codeSteps` can build and every cause `codeCause` can return.
  - Check placeholders against the set `codeFill` knows, and check that the lists don't overlap.
- **Effort:** S

### R1.3-08 · MUT_SEV · The round-2 tests protect less than they claim; wrong clinical edits still pass *(round 2)*
- **Location:** `rules12.js:171-172`, `113-114`, `101-110`; `golden.js` (the `codeKey` and `midCode` sections).
- **What's wrong:**
  - **The R1.2-05 test is vacuous.** "An A-fib crash cancels the rate-control order, even a pending one" never signs an order before the crash, so `p.treat.meds` never exists. Deleting the fix passes everything (M06a). Deleting the A-fib `drop` rule entirely also passes everything (M06b). With M06b, unstable A-fib keeps "meds" required, and the hint after cardioversion asks for **"Medications (symptom treatment)"** (`scripts/dropgone.js`).
  - **The rhythm-gap test is a tautology.** It checks `gap >= OC.CODE_GAP - 0.2`, so `CODE_GAP = 0` still passes (M19).
  - **Golden doesn't pin doses.** `codeKey` snapshots template strings, so the pediatric dose arithmetic in `codeFill` is not covered (M15, M16, M17).
  - **`midCode.card` is true by construction.** It compares `G.card.eid` before and after a JSON round trip of `G`.
  - **Mutation results:** MUT_SUMMARY (full table in section 4).
- **Fix:**
  - Sign diltiazem before the crash and assert that it was pending.
  - Assert absolute gaps (at least 4 game minutes, not `CODE_GAP - 0.2`).
  - Snapshot *filled* cards for fixed reference patients (an infant, a 5-year-old, a 12-year-old, an adult), and add a PALS dose table test.
  - Probe the odds model with a table (each rhythm, wait 0/5/10, right 0/3, shocked or not).
- **Effort:** M

### R1.3-09 · Medium · New UI-to-engine coupling and duplication *(round 2)*
- **What's wrong:**
  - **A diagnosis tell.** `ui.js:909` branches on the hidden case key (`p.ck === 'afib'`), and only A-fib patients get an "Onset" row after the exam. That gives anyone who has seen it once the answer to `DXQ.afib` (the choices are A-fib, SVT, flutter and sinus tachycardia).
  - **Menu structure in two files.** `ui.js:1010` hard-codes `['synccv', 'tcp']` into the Resuscitation menu, and `ORDER_MENUS` (`engine.js:500`) already lists both under Procedures. The same chips now sit in two menus.
  - **A rule re-implemented.** `ui.js:952` builds the arrest countdown from `tArrest ?? tArrive` plus 20, a copy of `arrestNoTeam`'s rule. It already ignores `p.code.tLeft`, so it will drift.
  - **More copies:**
    - `ui.js:927` retypes the dead-state list (R1.2-11).
    - `staleClassNote` (`ui.js:2577`) re-encodes `readSave`'s version rule (`2576`).
    - `mixHash` (`engine.js:2186`) is a third hash next to `vhash` and `seedOf`. Its comment says the old hash was badly mixed, yet `vhash` still decides rhythm, A-fib onset, stroke BP and infant months.
- **Fix:**
  - Have the engine expose `isDead(p)`, `arrestDeadline(p)` and a generic `onsetOf(p)` (any case may have an onset).
  - Keep menu placement in `ORDER_MENUS` only, with an optional second menu per item.
  - Use one hash.
- **Effort:** S

### R1.3-10 · Low · The public surface grew again, with production mutators
- **What's wrong:**
  - `window.OC` went from 223 exports to **236**. The new ones include the mutators `inStream` (run any function on the arrival or event stream) and `staffGone` (send any staff member home), plus mutable `CODE_WHY`, `CAUSE_OF`, `CONTRA_WHY` and `CODE_BASE`.
  - `CODE_CAUSE` is listed twice in the `OC` literal (`engine.js:4820`).
  - `rules12.js:178` mutates `OC.CODE_Q` in place to test the lint.
- **Fix:** Use a separate test entry point (`module.exports.__test`) that isn't attached to `window`, and freeze content tables.
- **Effort:** S

### R1.3-11 · Low · Golden is still partly opaque, and round 2 made its own diff unreviewable
- **What's wrong:**
  - **One commit moved everything.** `eb88030` changed the `stateHash` definition *and* the behaviour in the same commit. All 13 `stateHash` values moved, and the only readable field that changed is `md/hard care`. The message says only "outcomes change with the code system", while CLAUDE.md requires naming the golden lines that moved.
  - **Stale comment.** `golden.js:18-19` says strings over 24 characters are blanked; the code does nothing of the kind.
  - **The aliasing walker was never added.** `scripts/alias.js` (16 shifts) finds:
    - static `RES` arrays aliased into `G` through `p.dres[k] = detResult(...)` (`engine.js:1877`, `265`): two patients and the content table share one array;
    - `G.report.returnList` entries aliasing `G.stats.returnList`.

    `G.report.md.log` now aliases `p.ordLog` the same way. These are harmless today only because nothing mutates them and finished shifts aren't resumed.
- **Fix:** Replace `stateHash` with the readable fingerprint R1.2-01 described, add the walker as an invariant, and change fingerprint definitions in commits of their own.
- **Effort:** S

### R1.3-12 · Low · Write-only fields and dead branches from round 2
- **What's wrong:**
  - `p.traumatic` is set (`engine.js:3522`) and read nowhere, since `codeRhythm` switched to `preAlert`. `rules12.js` still asserts on it.
  - `kgOf` reads `p.kg` (`2146`), which nothing ever sets.
  - `p.code.n` still duplicates `p.code.step`.
  - The `coderes` card's context `{ pid, ok }` is never read.
- **Fix:** Delete them, or use them.
- **Effort:** S

### R1.3-13 · Low · Growth and process
- **What's wrong:**
  - The round-2 fix is one 40-item commit (`eb88030`) mixing clinical, UI, architecture and tooling changes. It cannot be bisected or reverted in part.
  - `engine.js` grew from 4,668 to 4,833 lines (402 KB to 423 KB). Lines over 300 characters went from 84 to 95, and finding-ID stamps in comments from 16 to 27.
  - Comments are stacked on one line (`engine.js:57`: "// the same slots newGame seeds   // every stream has its own slot", where the second half is still false; the same at `451`).
- **Fix:** Use one commit per finding, put history in git, and delete the stamps.
- **Effort:** S

### R1.3-14 · Nitpick · Small inaccuracies
- `kgOf`'s comment says "APLS-style formulas". The formulas are the "Best Guess" method: `(m+9)/2`, `2(a+5)`, `4a`. R6 may want the source named.
- CLAUDE.md says "~520 ok lines"; `npm test` prints 642.
- `'Died in cardiac arrest: no code team'` still has no plain-words gloss.

## 4. Coverage

COVERAGE_PLACEHOLDER

## 5. What I'd keep

KEEP_PLACEHOLDER
