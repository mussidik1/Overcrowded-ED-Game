# Reviewer 1, round 3: Senior Software Architect

Re-audit of the round-2 fixes on branch `claude/sleepy-rubin-jot35n` at v0.30.0 (HEAD `8357568`), Nov 24, 2026.
- **Scope:** `git log 49aea94..HEAD` and `git diff 49aea94..HEAD -- src test`.
- **Changes to the repo:** none, except this file.
- **Where the work ran:** a clone in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round3/r1/`:
  - `repo/`: the clone;
  - `tools/mutate.sh`, `tools/muts.txt`, `tools/muts2.txt` and `mut_results.txt`: the mutation runs;
  - `scripts/*.js`: the reproductions;
  - `lintgap/`: the broken-data copies.

## 0. Round-2 status

| ID | R1.2 severity | Status | Evidence |
|---|---|---|---|
| R1.2-01 Golden can't protect anything | High | **Partly fixed** | **Fixed part:** the new `codeKey`, `radioKey` and `hcg` snapshots catch a flipped right answer or radio key (M01a, M01b, M02a, M07, M08), and class-code fixtures no longer change every release. **Still broken:** `stateHash` and `arrivalsHash` are opaque hashes, and `codeKey` stores only each card's right label, as an unfilled template (`"{epi} mg"`). **23 of 40** wrong clinical or scoring edits still pass every test (R1.3-02, section 4). |
| R1.2-02 Order review split by a save | High | **Fixed** | `S.log` holds patient ids (`engine.js:1825-1826`). Golden replays 4 attending seeds and a mid-code reload, and it catches the old bug if reintroduced (M26). The aliasing walker was not added (R1.3-12). |
| R1.2-03 Events desync class shifts | High | Deferred (Phase 4) | Not re-checked. |
| R1.2-04 An abandoned code never ends | Medium | **Fixed, with a new defect** | `p.code.tLeft` (`engine.js:2247-2252`) ends the code 20 min after its doctor leaves. The takeover path now mis-scores the odds (R1.3-06). |
| R1.2-05 Crash `drop` misses `p.treat` | Medium | **Partly fixed** | The delete is in `crashSetup` (`engine.js:3432`). Its only test never signs an order, so deleting the fix passes every test (M06a), and so does deleting the whole drop rule (M06b). `lyticWindowClosed` still cancels with its own `delete p.treat.tnk` (`2002`). There is still no single "cancel order" function. |
| R1.2-06 `CONTRA_IF` closures over `G` | Medium | **Partly fixed** | **Fixed part:** unknown onset now means one thing (`lyticWindowOk`, `engine.js:1168`). **Still broken:** round 2 added six more rule closures and two helpers (`engine.js:431-441`), and one of them depends on click order (R1.3-03). The lint skip (`4779`), `treatOkNow`'s inference and the false "never erases" comment on `addContraIf` are unchanged. |
| R1.2-07 ACLS key is unvalidated tuples | Medium | **Partly fixed** | `lintCode()` (`engine.js:4791`) checks the shape of what exists. Remaining problems: <br>- Choices are still positional `[label, whyKey, 1?]` tuples keyed by index. <br>- Scoring now reads a regex on the reason-key names (R1.3-05). <br>- The lint misses what the code needs (R1.3-08). <br>- There is no `source` field. <br>- `addCase` still can't declare an arrest cause. |
| R1.2-08 Vacuous `inStream` test | Medium | **Fixed** | `rules11.js:157` asserts `typeof OC.inStream === 'function' && threw`. The price: `inStream` is now on `window.OC` in production (R1.3-10). |
| R1.2-09 No save version or migration | Low | **Worse** | `G.v` is still 5. The heuristic added to `OC.load` can't tell a v0.29 save from a v0.30 one, and it corrupts current saves (R1.3-01). |
| R1.2-10 Write-only state | Low | Still open | Nothing in `ui.js` reads `p.code.n`, `md.codeRight`, `md.codeWrong`, `report.noTeam` or `report.lyticLate`. `p.traumatic` has joined them, since `codeRhythm` no longer reads it. |
| R1.2-11 Dead-state list retyped | Low | **Worse** | `ui.js:927` adds another inline `['family', 'morgue', 'morguing']`. `vitalsOf` gained `dead: true` (`engine.js:1110`) but still returns `arrest: true` for the dead, and the UI doesn't use `dead`. |
| R1.2-12 Tests drive unreachable states | Low | Still open | `rules12.js`'s header says "Every check drives the real game path … not a hand-built object". In fact: <br>- Lines 85, 87, 96 and 98 build objects by hand. <br>- Lines 51, 68 and 171 `crashNow` patients already in a room; in play, `crash()` only fires in triage or the waiting room (`engine.js:3545,3549`). <br>- Line 175 calls `harmCheck` directly, and line 122 calls `staffGone`. <br>- Line 197 is still a conditional `if (bay) assert(...)`. |
| R1.2-13 Stream slots in two places | Low | **Partly fixed** | The numbers now agree (`engine.js:57` and `873`), but they are still two tables. `regionTick` and `eventsTick` still share `rngE` (`3652`, `3921`), so the comment "every stream has its own slot" is still false. |
| R1.2-14 One procedure, seven tables | Low | **Worse** | A-fib cardioversion now lives in 13 places: <br>- engine tables: `TREAT` (305), `ORDER_MENUS` (500), `PROC` (503), `HARM` (1800), `CRASH.afib` (3411), `CONTRA_IF`/`CONTRA_WHY` (`afib`) and `ALSO.afib`; <br>- engine functions: `afOnset`/`cardiovertOk` (1165-1166), a special case in `signOrders` (1893), and a special case with an inline harm tuple in `harmCheck` (1942); <br>- `ui.js`: the onset row (909), the menu (1010), and the "48 hours" lesson text (1877), which shares no constant with the engine. |
| R1.2-15 One global card slot | Low | **Worse** | `codePick` adds a fourth `G.card.mine = true` after `setCard` (`engine.js:2212`). The new `coderes` card works only because `chooseCard` silently ignores an `eid` with no handler. |
| R1.2-16 Determinism tested on V8 only | Low | Still open | No change. |
| R1.2-17 Display strings as state | Nitpick | Still open | `'Died in cardiac arrest: no code team'` still has no `DX_PLAIN` entry. `rules12.js` decides pass or fail by matching `p.dx` text five times. |
| R1.2-18 Small golden defects | Nitpick | Partly fixed | `bytesAt3h` is gone. `'error: ' + e.message` is still frozen as an expected answer (`golden.js:116`), and `npm test` still chains with `&&`. |
| R1.2-19 Lazy counters, changelog comments | Nitpick | **Worse** | "Audit"/"Round 2"/finding-ID stamps in `engine.js` went from 16 to 27. The `(x \|\| 0) + 1` counters remain. |
| R1.2-20 Docs describe tests wrongly | Nitpick | Partly fixed | CLAUDE.md now calls golden "a change detector". It still says "~520 ok lines"; `npm test` prints 642. The `rules12.js` header claim is false (R1.2-12). |
| R1.2-21 Markup in sim data | Nitpick | **Worse** | `codePick` now composes a whole result screen in the engine, with `**You:**`, `**The call:**` and `\n` (`engine.js:2209-2211`). |

**Counts:**
- Fixed: 3 (02, 04, 08). 04 came with a new defect.
- Partly fixed: 7 (01, 05, 06, 07, 13, 18, 20).
- Still open: 4 (10, 12, 16, 17).
- Worse: 6 (09, 11, 14, 15, 19, 21).
- Deferred: 1 (03).

## 1. Verdict

**Only after major work.**

What round 2 got right:
- It fixed the three defects I reproduced most concretely: the order log split by a save, the abandoned code, and the vacuous stream test.
- It finally snapshots the code-card and radio answer keys in readable form.

What it got wrong:
- The fixes were bolted onto the god file as more heuristics, more closures over mutable state and more parallel tables.
- Four of them created new defects:
  - a load "migration" that corrupts current-version saves (R1.3-01);
  - a contraindication whose result depends on click order (R1.3-03);
  - a reason table whose fallback teaches the wrong mechanism (R1.3-04);
  - a regex on reason-key names that decides ROSC odds (R1.3-05).
- Mutation testing still lets 23 of 40 wrong edits through the release gate. They include a 5× pediatric epinephrine dose, 3× pediatric amiodarone, double the pediatric shock energy, and deleting the unstable A-fib drop rule.
- Every structural metric got worse again: exports, lines, long lines, stamps and duplicated knowledge.

## 2. Score

**3 / 10.** Unchanged. The order-log and abandoned-code fixes are real, and the answer-key snapshots are a real improvement. That is cancelled out by four new defects introduced by the fixes themselves, a test net that still misses dose errors, and continued structural decay.

## 3. New findings (worst first)

### R1.3-01 · High · The "old save" repair in `OC.load` fires on current saves: every reload resets a field cardiac arrest's clock and wipes its late penalty *(round 2, R3.2-02 / R1.2-09)*
- **Location:**
  - `engine.js:4806`: `load` runs `if (p.arrest && p.tArrest == null) p.tArrest = G.t`.
  - `engine.js:696` and `1141`: the `arrest` case is created with `arrest: true` and no `tArrest`.
  - `2180`: `codeStart` computes `wait = G.t - (tArrest ?? tArrive)`.
  - `2251`: the `arrestNoTeam` reference time.
  - Every caller of `E.load` in `ui.js` (`resumeSave`, `boot2`).
  - `rules12.js:128`.
- **What's wrong:** The repair assumes that an arrest with no `tArrest` must come from a v0.29 save. But in v0.30, every **field cardiac arrest** (the `arrest` case, which arrives already pulseless) has no `tArrest`, and its clock runs from `tArrive`. So any load stamps it with the resume time. Loads happen after a tab kill, after a reload, when the 15-second autosave is resumed, and on a hot reload. `scripts/fieldreload.js` shows:
  - Nobody runs the code. Unbroken, the patient dies of "no code team" **20.0** minutes after arriving. Saved at minute 15 and reloaded, the death comes at **35.0** minutes.
  - A doctor takes the code at minute 11. `p.code.wait` is **11** unbroken and **0** after a reload, in **30 of 30** seeds. The late multiplier goes from 0.60 to 1.00, so a reload raises the odds of ROSC by two thirds.
- **Why it matters:**
  - It breaks the save-identity invariant the project relies on.
  - It breaks class fairness: a student who reloads gets a better code.
  - Golden's save round trips never have an untreated field arrest at the save point.
  - `rules12.js:128` deletes `tArrest` by hand to fake an old save, so it certifies the heuristic.
  - This is exactly the bug class R1.2-09 asked to close with a version number.
- **Fix:**
  - Stamp `tArrest` wherever an arrest begins, including in `makePatient` for `c.arrest` (`tArrest = tArrive`).
  - Bump `G.v` to 6. Migrate only when `g.v === 5`, and let `readSave` accept 5 and 6.
  - Add a golden round trip that saves with an untreated field arrest on the board.
- **Effort:** S

### R1.3-02 · High · The test net still passes wrong doses and wrong rules: 23 of 40 mutations survive, and several round-2 tests can't fail *(round 2)*
- **Location:** `rules12.js:171-172`, `113-114` and `101-110`; the `codeKey` and `midCode` sections of `golden.js`.
- **What's wrong:**
  - **The R1.2-05 test is vacuous.** "An A-fib crash cancels the rate-control order, even a pending one" never signs an order before the crash, so `p.treat.meds` never exists.
    - Deleting the fix passes everything (M06a).
    - Deleting the A-fib `drop` rule entirely also passes everything (M06b). The effect: unstable A-fib keeps "meds" required, and after cardioversion the hint asks for **"Medications (symptom treatment)"** (`scripts/dropgone.js`).
  - **The rhythm-gap test is a tautology.** It checks `gap >= OC.CODE_GAP - 0.2`, so setting `CODE_GAP = 0` still passes (M19).
  - **Golden doesn't pin doses.** `codeKey` snapshots template strings, so the arithmetic in `codeFill` is uncovered:
    - 5× pediatric epinephrine passes (M15b). 10× is caught only because the dose then hits the 1 mg cap and prints "1 mg".
    - 3× pediatric amiodarone passes (M16).
    - A 4 J/kg first shock passes (M17).
    - Changing the child cutoff from 13 to 18 years passes (M35).
    - Changing the weight formula passes (M14).
  - **The odds model is unpinned.** The ED VF base odds 0.65 → 0.95 (M03a), removing the late-team penalty (M04), and coronary arrests becoming 5% VF instead of 65% (M36) all pass. The one swap that is caught (field vs ED tables, M32) surfaces only as "golden streams/md/med changed", an opaque hash in the wrong section.
  - **Content mappings are unpinned.** A DKA arrest told "glucose 18, give dextrose" (M02b), a septic arrest told to give tenecteplase (M22), and a GI bleeder's exsanguination reaching "no clear cause" (M23) all pass.
  - **Three cosmetic key renames pass.** Lint passes too. The effect: a perfect VF code's ROSC rate drops from 27/36 to 4/36 (M18b; `scripts/perfectvf.js`).
  - **`midCode.card` is true by construction.** It compares `G.card.eid` before and after a JSON round trip of `G`.
- **Fix:**
  - Sign diltiazem before the crash, and assert that it was pending.
  - Assert absolute gaps (at least 4 game minutes), not `CODE_GAP - 0.2`.
  - Snapshot *filled* cards for fixed reference patients (an infant, a 2-year-old, a 5-year-old, a 12-year-old and an adult), and check doses against a PALS table: epinephrine 0.01 mg/kg up to 1 mg, amiodarone 5 mg/kg up to 300 mg, 2 then 4 J/kg.
  - Probe the odds model with a table: each rhythm × wait 0/5/10 × right 0/3 × shocked or not.
  - Pin the `CAUSE_OF`, `BLEED_SRC`, `TRAUMA_CASES` and `LIMB_CASES` mappings in `codeKey`.
- **Effort:** M

### R1.3-03 · High · "No aspirin after a lytic" depends on click order *(round 2, R6.2-17)*
- **Location:**
  - `engine.js:433`: the rule is `asa: p => !!p.id && (p.tr || []).includes('tnk')`.
  - `signOrders`, `engine.js:1844-1850`: each drug is checked against `contraOf(p)` inside the loop, but `p.tr` gets the new treatments only after the loop.
  - `rules12.js:147-149`.
- **What's wrong:** The closure reads `p.tr`, and `signOrders` fills `p.tr` only after its harm check. `scripts/asa_tnk.js`, the same in-window stroke each time:

  | Orders | Harm |
  |---|---|
  | Tenecteplase, then aspirin in a later signing | 1 |
  | Tenecteplase and aspirin **on one order sheet** | **0**: aspirin counts as one "extra" (−3 instead of −20), logged as "Meds" with no reason |
  | Aspirin, then tenecteplase | 0 |

  The common mistake, both drugs on one sheet, is scored as a minor extra, and the test covers only the sequential case. This is R1.2-06's root cause (closures over mutable game state) producing a wrong score.
- **Fix:**
  - Evaluate contraindications against the order set as it will be after signing (`p.tr` plus this signing's treatments), passed in explicitly. Better: make `CONTRA_IF` data rules evaluated by one function that takes that set.
  - Test all three orderings.
- **Effort:** S

### R1.3-04 · High · `CONTRA_WHY` is a parallel table with a per-drug fallback that teaches wrong reasons, and the "never name an unmade diagnosis" rule has no check *(round 2, R6.2-08)*
- **Location:** `engine.js:470-486` (`CONTRA_WHY_DRUG`, `CONTRA_WHY`, `contraWhy`); the `addCase` `contra` lists (`engine.js:4632-4738`), which carry no reasons; `rules12.js:73-75`.
- **What's wrong:** The reasons live in a table keyed by case, 3,000 lines from the case format, and only 18 cases have one (14 written out, 4 aliased). Every other case falls back to a reason written per drug, mostly about bleeding. `scripts/why.js` records what the harm message says before any diagnosis is named:

  | Case + drug | Message | Problem |
  |---|---|---|
  | Salicylate overdose + aspirin | "it adds to the bleeding risk" | Wrong reason: the harm is more salicylate |
  | Stroke with unknown onset + tenecteplase | "it is more than 4.5 hours since they were last known well" | False: the onset is unknown |
  | Sepsis + furosemide | "it drains volume from a septic patient" | Names the answer to the open diagnosis question (`DXQ.sepsisw = 'Sepsis'`). The patient may also carry a sepsis alert |
  | Hyperkalemia + potassium; TCA overdose + ondansetron | "it isn't safe for this patient (the case's lesson says why)" | No reason |

  CLAUDE.md says a reason "must never name a diagnosis the player hasn't made". Nothing enforces it:
  - A mutation that makes every fallback print the diagnosis passes (M38).
  - The only test asserts that the bowel-obstruction text avoids the word "obstruction"; it says "blockage" instead.

  Whether the salicylate line counts as Critical clinical teaching is R6's call.
- **Fix:**
  - Make the reason part of the contraindication record: `addCase({ contra: { asa: 'more salicylate on top of the overdose' } })`, and the same for `CONTRA_IF` rules.
  - Keep per-drug text only for true facts about a drug class.
  - Lint that every `CONTRA` and `CONTRA_IF` entry has a reason.
  - Test every reason against its case's `dx`, `DXQ` and `DDX` strings.
- **Effort:** M

### R1.3-05 · Medium · "VF that is never shocked" is decided by a regex on reason-key names *(round 2, R6.2-10)*
- **Location:** `engine.js:2201` (`if (/^shock/.test(ch[1])) p.code.shocked = true`, applied to right answers only); `codeOutcome` (`if (C.me && C.r === 'vf' && !C.shocked) odds *= 0.1`); `CODE_Q.vf` and `kidvf`.
- **What's wrong:** Whether a shock was delivered is inferred from the name prefix of the *right* answer's reason key.
  - **Adult VF** (`scripts/shocked.js`): the player picks "Epinephrine 1 mg first, then shock", then "Amiodarone instead of a second shock", then "Shock, then amiodarone 300 mg IV" (right, key `amio`). That is two shocks, and `code.shocked` is **false**.
  - **Child VF** (`scripts/shocked2.js`): the player picks "Shock at 200 J", then "Shock, then epinephrine 1 mg IV", then "Shock at 128 J, then amiodarone" (right). That is three shocks, and `code.shocked` is **false**.
  - Both get the never-shocked odds (×0.1).
  - Renaming three keys, which lint accepts, makes a perfect VF code almost never return (M18b).
  - `rules12.js`'s own "VF with no shock" test picks "Epinephrine 1 mg first, then shock" as its no-shock answer, so the test encodes the bug.
- **Fix:** Put `shock: true` on every choice that delivers one, compute `shocked` from the choices picked, and lint that every VF card set has a right answer that shocks.
- **Effort:** S

### R1.3-06 · Medium · A code taken over by a second doctor restarts, and the first team's minutes are charged as "no team" *(round 2, R3.2-01 / R1.2-04)*
- **Location:** `engine.js:2021-2027` (`codeTeam` now always calls `codeStart`); `2179-2184` (`wait = G.t - tArrest`); the comment at `2026`.
- **What's wrong:** In `scripts/resume_wait.js`, Dr. Patel runs the code for 10 minutes and goes home, and Dr. Okafor takes over one minute later.
  - The result is a new `p.code` with step 0, right 0 and **wait 11**. The late multiplier is **0.60**. Counting only the orphaned minute, it would be 1.00.
  - The comment says "the minutes without a doctor count against the odds". The code counts every minute since the arrest, including the ten with a doctor running CPR.
  - The takeover also restarts the card sequence and starts a fresh 15-minute task.
  - This path is ordinary: providers leave at the end of mandated hours (`staffTick` → `staffGone`) and through `EV.sick`.
- **Fix:**
  - Keep `p.code` across teams.
  - Add the orphaned intervals (`tLeft` to resume) to `wait`, and keep `step` and `right`.
  - Give the new team the remaining task time.
  - Test the takeover odds.
- **Effort:** S

### R1.3-07 · Medium · `rxName` rewrites the medication history from live vitals *(round 2, R6.2-04)*
- **Location:** `engine.js:1793-1798`; `ui.js:698` ("Given: …") and `918` (the attending's Medications row); `trName` (`engine.js:1819`).
- **What's wrong:** `rxName` now filters the drugs given through `contraOf(p)`, which is what is contraindicated *at this moment*.
  - `scripts/rxname.js`: stable A-fib, diltiazem given, and the UI line reads "Given: diltiazem". After the crash, the same finished order reads **"Given: symptom treatment"**. The drug that was actually given disappears from the chart exactly when the student needs to see it.
  - The fallback decides whether a phrase is safe by searching for drug display names inside free text (`RX[p.ck].includes(DRUGS[d].n.toLowerCase())`). That is R1-03 again.
- **Fix:**
  - Record what was given at the moment it was given (`p.given`), and print that.
  - Keep "don't suggest a contraindicated drug" in the hint path only (`missNow`/`trName`), driven by data instead of text search.
- **Effort:** S

### R1.3-08 · Medium · `lintCode` checks the shape of what exists, not what the code needs, so broken data still crashes a shift *(round 2, R1.2-07)*
- **Location:** `engine.js:4791-4803`, compared with `codeCause` (`2151-2155`, which hard-codes the causes `'bleed'` and `'look'`), `codeSteps` (`2173`, which builds the key `'kid' + r`) and `codeFill` (`2167-2170`).
- **What's wrong:** Each of these broken copies (in `lintgap/`) loads cleanly:
  - **`CODE_CAUSE.look` deleted:** the first adult PEA or asystole code with no case cause throws inside `OC.step` ("reading 't'"). In the browser that is the R1-04 freeze.
  - **`CODE_Q.kidasys` deleted:** a child in asystole throws ("reading 'slice'").
  - **A placeholder typo, `{epii}`:** the card shows "epinephrine {epii} mg".

  The lint also never checks that:
  - `TRAUMA_CASES`, `LIMB_CASES`, `BLEED_SRC` and `CAUSE_OF` don't overlap (precedence decides silently);
  - `NONSHOCK_CAUSES` names real causes;
  - `CODE_NAME` covers every rhythm.

  The lint's own rhythm list (`['vf', 'pea', 'asys', 'trauma', 'limb']`) is yet another copy of the rhythm set.
- **Fix:**
  - Use one `RHYTHMS` table and one `CAUSES` table that `codeRhythm` and `codeCause` draw from.
  - Lint every card set `codeSteps` can build and every cause `codeCause` can return.
  - Check placeholders against the set `codeFill` knows, and check that the case lists don't overlap.
- **Effort:** S

### R1.3-09 · Medium · New UI-to-engine coupling and duplication *(round 2)*
- **What's wrong:**
  - **A diagnosis tell.** `ui.js:909` branches on the hidden case key (`p.ck === 'afib'`), and only A-fib patients get an "Onset" row after the exam. Anyone who has seen it once knows the answer to `DXQ.afib` (the choices are A-fib, SVT, flutter and sinus tachycardia).
  - **Menu structure in two files.** `ui.js:1010` hard-codes `['synccv', 'tcp']` into the Resuscitation menu, while `ORDER_MENUS` (`engine.js:500`) already lists both under Procedures. The same chips now appear in two menus.
  - **A copied rule.** `ui.js:952` computes the arrest countdown as `tArrest ?? tArrive` plus 20, a copy of `arrestNoTeam`'s rule. It already ignores `p.code.tLeft`, so it will drift.
  - **More copies:**
    - `ui.js:927` retypes the dead-state list (R1.2-11).
    - `staleClassNote` (`ui.js:2577`) re-encodes `readSave`'s version rule (`2576`).
    - `mixHash` (`engine.js:2186`) is a third hash function, next to `vhash` and `seedOf`. Its comment says the old hash is badly mixed, yet `vhash` still decides rhythm, A-fib onset, stroke BP and infant age in months.
- **Fix:**
  - Have the engine expose `isDead(p)`, `arrestDeadline(p)` and a generic `onsetOf(p)` that any case may use.
  - Keep menu placement in `ORDER_MENUS` only, with an optional second menu per item.
  - Use one hash function.
- **Effort:** S

### R1.3-10 · Low · The public surface grew again, with production mutators
- **What's wrong:**
  - `window.OC` went from 223 exports to **236**.
  - The new exports include the mutators `inStream` (runs any function on the arrival or event stream) and `staffGone` (sends any staff member home).
  - They also include the mutable tables `CODE_WHY`, `CAUSE_OF`, `CONTRA_WHY` and `CODE_BASE`.
  - `CODE_CAUSE` is listed twice in the `OC` literal (`engine.js:4820`).
  - `rules12.js:178` mutates `OC.CODE_Q` in place to test the lint.
- **Fix:** Use a separate test entry point (for example `module.exports.__test`) that isn't attached to `window`, and freeze the content tables.
- **Effort:** S

### R1.3-11 · Low · Golden is still partly opaque, and round 2 made its own diff unreviewable
- **What's wrong:**
  - **One commit changed both the fingerprint and the behaviour.** `eb88030` changed how `stateHash` is computed *and* changed the game in the same commit. All 13 `stateHash` values moved; the only readable field that changed is `md/hard care`. The commit message says only "outcomes change with the code system", but CLAUDE.md requires naming the golden lines that moved.
  - **Two caught mutations show up in the wrong place.** M32 and M33 change the code odds, and golden reports them only as "streams/md/med changed".
  - **A stale comment.** `golden.js:18-19` says strings over 24 characters are blanked. The code does no such thing.
  - **The aliasing walker was never added.** `scripts/alias.js` (16 shifts) finds:
    - static `RES` arrays aliased into `G` through `p.dres[k] = detResult(...)` (`engine.js:1877`, `265`), so two patients and the content table share one array;
    - `G.report.returnList` entries aliasing `G.stats.returnList`.

    `G.report.md.log` now aliases `p.ordLog` the same way. These are harmless today only because nothing mutates them and finished shifts are never resumed.
- **Fix:**
  - Replace `stateHash` with the readable fingerprint described in R1.2-01.
  - Add the walker as an invariant.
  - Change fingerprint definitions in commits of their own.
- **Effort:** S

### R1.3-12 · Low · Write-only fields and dead branches from round 2
- **What's wrong:**
  - `p.traumatic` is set (`engine.js:3522`) and read nowhere, yet `rules12.js:41` still asserts on it.
  - `kgOf` reads `p.kg` (`2146`), which nothing ever sets.
  - `p.code.n` still duplicates `p.code.step`.
  - The `coderes` card's context `{ pid, ok }` is never read.
- **Fix:** Delete them, or use them.
- **Effort:** S

### R1.3-13 · Low · Growth and process
- **What's wrong:**
  - The round-2 fix landed as one 40-item commit (`eb88030`) that mixes clinical, UI, architecture and tooling changes. It can't be bisected or reverted in part.
  - `engine.js` went from 4,668 to 4,833 lines (402 KB to 423 KB).
  - Lines over 300 characters went from 84 to 95.
  - Finding-ID stamps went from 16 to 27.
  - Comments are stacked on one line. At `engine.js:57`: "// the same slots newGame seeds   // every stream has its own slot", where the second half is still false. The same pattern is at `451`.
- **Fix:** Use one commit per finding, let git hold the history, and delete the stamps.
- **Effort:** S

### R1.3-14 · Nitpick · Small inaccuracies
- `kgOf`'s comment says "APLS-style formulas", but the formulas are the "Best Guess" method (`(m+9)/2`, `2(a+5)`, `4a`). R6 may want the source named.
- CLAUDE.md says "~520 ok lines"; `npm test` prints 642.
- `'Died in cardiac arrest: no code team'` still has no plain-words gloss.

## 4. Coverage

**Read in full:**
- `git diff 49aea94..HEAD` for `src/engine.js`, `src/ui.js`, `src/map.js` and every test file.
- `test/rules12.js` and `test/golden.js`.
- The current code of everything named in the brief:
  - the `CODE_*` tables, `codeFill`, `CAUSE_OF` and the case lists;
  - `codeRhythm`, `codeCause`, `codeSteps`, `codeStart`, `codeCard`, `codePick`, `codeDue`, `codeOutcome` and `arrestNoTeam`;
  - `lintCode`, `addContraIf`, `CONTRA_WHY`/`contraWhy` and `rxName`;
  - `logOrders`/`orderLogOf`, `OC.load`, `crashSetup`, `lyticWindowOk`, `afOnset`/`cardiovertOk` and `mixHash`.
- Their collaborators:
  - `taskStart`, `taskDone`, `provTick`, `assign`, `unassign`, `orphanPatients`, `staffGone`, `staffTick` and `toArrest`;
  - the crash triggers, `hemorrhageTick`, `rphTick`/`verified` and `rnTick`;
  - `chooseCard`, `aiCard`, `mdPlay`'s card branch, `contraOf`, `treatOkNow`, the classification loop in `signOrders`, `detResult` and the `lintCases` skip;
  - in `ui.js`: `readSave`, `staleClassNote`, `ptSheet`, `mdPrimary0`, `orderMenus`, `needList` and `reportHTML`.

**Ran:**
- `npm test` on the clone: passes, 642 ok, 48 s.
- A scratch `npm run build`: byte-identical to the committed `index.html`, `sw.js` and `3d/map3d.js`.
- 40 mutations, each through all 13 test files (`tools/mutate.sh`, `mut_results.txt`). "Golden" means `golden.js` failed.

| Mutation | Result |
|---|---|
| M01a Trauma card 2: cardioversion made right | Caught (rules12, golden `codeKey`) |
| M01b Trauma card 2: amiodarone made right | Caught (rules12, golden `codeKey`) |
| M02a Potassium 7.9: insulin drip made right | Caught (rules12, golden) |
| M02b DKA arrest cause becomes "glucose 18, dextrose" | **Not caught** |
| M03a ED VF base odds 0.65 → 0.95 | **Not caught** |
| M03b ED asystole odds 0.25 → 0.44 | **Not caught** |
| M04 Late-team penalty removed | **Not caught** |
| M05a `HARM.cardiovert` chance set to 0 | **Not caught** |
| M06a The R1.2-05 fix line deleted | **Not caught** |
| M06b The A-fib crash `drop` rule deleted | **Not caught** |
| M07 MIEMSS radio key flipped | Caught (golden `radioKey`) |
| M08 National "nitro at 84/52" radio key flipped | Caught (golden `radioKey`) |
| M09 Lytic window 270 → 360 min | Caught (rules11, rules12) |
| M10 Unknown stroke onset allowed | Caught (rules11, rules12) |
| M12a Metoprolol HR cutoff 110 → 150 | **Not caught** |
| M12b Metoprolol SBP cutoff 100 → 80 | **Not caught** |
| M13 Hydromorphone SBP cutoff 90 → 60 | **Not caught** |
| M14 Child weight 4×age → 5×age | **Not caught** |
| M15 Pediatric epinephrine 10× | Caught (rules12), only because the dose hits the 1 mg cap |
| M15b Pediatric epinephrine 5× | **Not caught** |
| M16 Pediatric amiodarone 5 → 15 mg/kg | **Not caught** |
| M17 First pediatric shock 2 → 4 J/kg | **Not caught** |
| M18b Three reason keys renamed (lint passes; perfect-VF ROSC 27/36 → 4/36) | **Not caught** |
| M19 `CODE_GAP` 4 → 0 | **Not caught** |
| M21 Never-shocked ×0.1 removed | Caught (rules12) |
| M22 Septic arrest cause becomes "clot: tenecteplase" | **Not caught** |
| M23 GI bleed removed from `BLEED_SRC` | **Not caught** |
| M25 `rxName` contraindication filter removed | Caught (rules12) |
| M26 Order log back to shared objects | Caught (rules6, golden attending save) |
| M27 Load migration removed | Caught (rules12) |
| M28 `tLeft` fix reverted | Caught (rules12) |
| M30 A-fib onset up to 81 h, still "fair to shock" | **Not caught** |
| M31 A-fib anticoagulation removed from `ALSO` | Caught (golden `answers/afib`) |
| M32 Field and ED odds tables swapped | Caught only as "golden streams/md/med changed" |
| M33 RT bonus ×1.1 → ×2 | Caught only as "golden streams/md/med changed" |
| M35 Child cutoff 13 → 18 years | **Not caught** |
| M36 Coronary-arrest VF share 65% → 5% | **Not caught** |
| M38 Every harm-reason fallback names the diagnosis | **Not caught** |
| M43 Child VF card 1's reason key → `epiFirst` (wrong explanation, shock not counted) | **Not caught** |
| M44 Aspirin always harm in stroke | Caught (golden `answers` only; rules12 passes) |

Of the 7 round-2 mutations that escaped, 3 are now caught: trauma card 2, the potassium answer and the MIEMSS key. 4 still escape: the VF odds, the late penalty, `HARM.cardiovert` and the drop rule.

**Reproductions** (each in `scripts/`):
- `fieldreload.js`: R1.3-01.
- `asa_tnk.js`: R1.3-03.
- `why.js`: R1.3-04.
- `shocked.js`, `shocked2.js` and `perfectvf.js`: R1.3-05.
- `resume_wait.js`: R1.3-06.
- `rxname.js`: R1.3-07.
- `dropgone.js`: M06b's effect.
- `alias.js`: R1.3-11.
- `lintgap/run.js` with three broken engine copies: R1.3-08.

**Not checked, and why:**
- I didn't run the Python UI suites, `npm run stress` or the WebKit job. The machine's load average was over 60 from parallel reviewers.
- I didn't open the two new lessons in a browser.
- R1.2-03 is deferred to Phase 4.
- The clinical correctness of the doses, odds and reasons is R6's area. I tested only whether the tests would notice a change.
- The Supabase side was not checked.

## 5. What I'd keep

- `S.log` as patient ids, and golden's attending save round trips (they caught M26).
- The readable `codeKey`, `radioKey` and `hcg` snapshots. They are the first part of golden that tells a reviewer *what* moved.
- Code fixtures computed without the version salt.
- `tLeft` as the idea of an explicit "the code stopped" time. It needs to become a proper state (running, orphaned, done), not a timestamp patch.
- `lintCode` as a fail-at-load hook, once it validates what the code requires.
- The deterministic, DOM-free engine and the reproducible build. Every reproduction above is a few lines of Node against it.
