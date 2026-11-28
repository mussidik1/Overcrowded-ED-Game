# Round 13 verification: Critical and High findings

All checks ran on a clean copy of commit 895bc15 (`git archive` into scratchpad `v13/`, with node_modules symlinked). The committed `index.html` was used and not rebuilt. Nothing in the repo was edited. My own scripts are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/mine/`. Seeds for the statistical items are `s*7919+11` and `s*7907+11`.

## 1. R1.13-01: a patient handed to the attending can never be seen
**CONFIRMED. Severity: Critical.** It happens on every med, hard and Rush attending shift. The player cannot avoid the penalty, and the room stays blocked all shift.
- **The card has no See button.** `src/ui.js:1020-1027` (`mdPrimary0`):
  - `!p.prov` is false.
  - `mine()` (ui.js:97) needs `p.mine`.
  - The Take over button needs `p.ev==='q'`, but a handed patient has `ev:'none'`.
  - `ACT.prov` (2892) opens `staffSheet` in attending mode, and `staffSheet` (1224) has no assign button when `MD()` is true.
  - The only UI calls to `E.assign` are `see`, `assign`, the map's prov-select (charge nurse only) and the tutorial autos.
- **The game shows it.** `mine/handed.py` (hard, list board) printed `handed p14 … Dr. Patel has this patient.` and `buttons: ['closeSheet:✕']`. The same card also shows "Provider: Not assigned yet".
- **Engine run** (`round13/r1/p1.js` pointed at the copy):
  - med 11 and 12: `handed 2 unseen 2 stillInRoom 2 … own {"clinical":75,…"legal":90}`
  - hard 11: `handed 4 unseen 4 stillInRoom 4`
  - hard 12: `handed 5 unseen 5 stillInRoom 4`
  - rush: `handed 2 unseen 2 stillInRoom 2`
  - easy: 0 handed, because `MD_LOAD.easy=0` (engine.js:872).

## 2. R1.13-02 / R3.13-01: the crash guard writes the half-done state back to the save
**CONFIRMED. Severity: High.** Both crash-card buttons do the opposite of what they promise, and the player can loop back into the same crash.
- **Code:**
  - `save()` (ui.js:3003) checks only `U.scene!=='game' || G.over`, not `crashed`.
  - The `pagehide` listener (3452) calls `save(true)` unconditionally.
  - `#crashDrop` (3337) runs `store('oc-save',null); location.reload()`.
- **Test:** `mine/crash.py` makes `OC.step` change `G` and then throw.
  - `crashReload … saved t before click 0.32 → after reload: save present True HALF_DONE in save True t 100.33`
  - `crashDrop … after reload: save present True HALF_DONE in save True t 100.33`
- **Duplicates:** R1.13-02 and R3.13-01 are the same finding.

## 3. R1.13-03 / R3.13-02 / R5.13-02: idle and radio-only attendings score well
**CONFIRMED. Severity: High.** The attending's grade rewards doing nothing. Calling this Critical would overstate it slightly: an idle attending ties a 70%-accurate one rather than clearly beating them.
- **Idle and radio-only results** (`mine/x.js`, 8 seeds; seen 0 in every run):

| Level | Idle attending: stars by seed (mean) | Radio-only attending: stars by seed (mean) |
|---|---|---|
| easy | 22222222 (2.00), avg 67 | 33333333 (3.00), avg 100 |
| med | 22221221 (1.75) | 33322332 (2.63) |
| hard | 11011111 (0.88) | 22122222 (1.88) |
| rush | 22122222 (1.88) | 33233333 (2.88) |

- **Why:** an idle easy shift's parts are `{"clinical":100,"dx":null,"radio":0,"legal":100}`.
- **Idle against a 70%-accurate attending, same seeds** (`mine/pair.js`, 10 seeds; slowdoc is `mdPlay`, acc 0.7):

| Level | Idle beats slowdoc | Tie | Slowdoc beats idle |
|---|---|---|---|
| easy | 4 | 3 | 3 |
| med | 3 | 5 | 2 |
| rush | 0 | 7 | 3 |

- **Means over 8 seeds** (`round13/r5/cmp.js`):
  - idle_md: easy 2.00, med 1.50, rush 2.00.
  - slowdoc: easy 2.00, med 1.50, rush 2.25.
  - In other words, idle ties an engaged 70% player on average, and radio-only beats them.
- **What holds of each claim:**
  - R3's "100/100 class score" holds for radio-only on easy.
  - R1's "the rules15 seed is lucky" holds: idle on med gives 1 star on only 2 of 8 seeds.

## 4. R1.13-04: a held wrong diagnosis is scored against "Cardiac arrest"
**CONFIRMED (the mechanism); NOT REPRODUCED in natural play. Severity: Medium.** The bug is real, but I could not make it happen in a normal shift.
- **Code:**
  - `dxPick` (engine.js:604) stores only `{right, pick}`.
  - `scoreDx` (608-617) reads `p.dx` when the score settles.
  - `toArrest` (3643) sets `p.dx='Cardiac arrest'`.
- **Synthetic test** (`round13/r1/p3.js` pointed at the copy):
  - `dxLog [{"said":"Pericarditis","dx":"Cardiac arrest","must":true}]`
  - mm `called Pericarditis. It was Cardiac arrest`
  - `dxPick still set after arrest: Pericarditis`
- **Natural play** (`mine/nat_run.js`, `nat2.js`): med and hard, 6 seeds each, an attending who always calls wrong, with and without treatment.
  - Results: 361 and 142 wrong calls, 0 scored as "Cardiac arrest".
  - So R1's "common for an untreated STEMI" was not borne out.

## 5. R5.13-01: the true diagnosis is posted to the board log at the attending's call
**CONFIRMED. Severity: Critical.** It gives away the answer on every diagnosis, on every regular shift.
- **Code:** engine.js:3279 runs `note(\`${label(p)}: ${p.dx}. Your call.\`)` when the patient reaches `mddecide`. `renderLog` (ui.js:707) shows `G.log` in `#log`.
- **Engine test** (`mine/leak.js`): 4 of 4 wrong picks leaked within 0 minutes, while the patient was still in the room. For example: `said Pancreatitis truth Gastroenteritis … LOG at +0min: Room 7: Gastroenteritis. Your call.`
- **Game test** (`mine/pw2.py`, list board): `log ['Room 3: Hip fracture. Your call.', …]`, `log visible True`, `TRUE DX visible on page: True`. This held at 390x844 and at 1440x900.

## 6. R5.13-03: never answering a diagnosis leaves the Diagnoses part out of the grade
**CONFIRMED. Severity: High.**
- **Never calling** (`mine/x.js noDx`: perfect orders, no diagnosis picked; 4 seeds):

| Level | Stars | Parts |
|---|---|---|
| easy | 2222 | `{"clinical":32,"dx":null,"radio":100,"legal":100}` |
| med | 2222 | same pattern |
| hard | 2222 | same pattern |
| rush | 3333 | clinical 92, dx null |

- **Calling wrong every time** (`wrongDx`):
  - med: 1, 1, 0 stars.
  - rush: 2, 2, 2 stars.
  - So abstaining beats guessing wrong.
- **Against a 70%-accurate caller:** abstaining also beats slowdoc on med (2.0 vs 1.5). It does not beat a correct caller ("full" gets 3 stars everywhere). "Dominant strategy" is therefore overstated: it dominates weak or uncertain play, not correct play.
- **The verdict praises it.** `verdictOf` (ui.js:3149-3163) has no case for "no diagnosis called" when patients were seen. With 2 stars it reads "Solid shift. Your calls held up." With 3 stars (the Rush) it reads "Attending of the year…".

## 7. R5.13-04: handed patients get no notice, aren't taught, and ignoring them costs little
**CONFIRMED. Severity: High.** Much of it follows from item 1.
- **No toast.** The handover at engine.js:4653 calls `note()`, which only adds a log line. `toast()` (875) is not called.
- **Not taught.** `grep -i "your list\|handed" src/ui.js` finds nothing in Orientation or How to play.
- **One-off, capped penalty.** `unseenHanded` (3471-3476) applies −25 Clinical and +5 legal once. `MD_LOAD` caps handovers at 2 on med and the Rush, and 4 on hard.
- **Ignoring them pays about the same** (`round13/r5/ign.js`, 8 seeds; "seeing" is done through the engine, because the UI cannot do it):

| Level | Ignores handed patients | Sees them |
|---|---|---|
| med | 2.50 stars, 1.4 handed | 2.375 stars |
| hard | 2.125 stars, 2.6 handed | 2.25 stars, 22.9 handed |

- **Not deteriorating:** mostly true (see item 10), but bleeding cases still progress. In hard seed 4242, an unseen GI bleed arrested and died.
- **Not checked:** the floor-plan visual itself.
- **Duplicates:** overlaps items 1 and 10.

## 8. R5.13-05: the attending's Rush has no pace cap
**CONFIRMED. Severity: High.** Each idle Rush gives rank points in about a minute.
- **Code:** engine.js:860 has `paced = () => G.level === 'rush' && G.mode !== 'md'`, so the cap never applies to the attending.
- **Rush results:**
  - Idle: 22122222 (mean 1.88).
  - Radio-only: 33233333 (mean 2.88).
  - Never calling a diagnosis: 3333.
  - 70%-accurate (slowdoc): mean 2.25, and never above idle across 10 seeds (0 wins, 7 ties, 3 losses for idle).
- **Duplicates:** a sub-case of item 3.

## 9. R6.13-01: an undiagnosed bleeding patient's card names the hemorrhage and MTP
**CONFIRMED. Severity: High.** It gives away the answer for the `ectopic`, `aaa`, `mvc` and `mcired` cases.
- **Code, none of it gated for the attending:**
  - ui.js:980: `'<b>Hemorrhage. Activate MTP.</b>'`
  - ui.js:566: the chip "SHOCK: activate MTP" / "Bleeding: activate MTP"
  - ui.js:621: the `MTP` tag
  - ui.js:1017: `mtpBtn`
- **Case data:** `ectopic` (4893) and `aaa` (4857) have `bleed:'mtp', tr:['mtp']`.
- **Game test** (`mine/p1.py`, Manic Monday attending): `{'bleed':'mtp','tr':['mtp'],'dxK':False}`, then the screen shows `Hemorrhage. Activate MTP.`, `activate MTP` and `Activate massive transfusion` next to "See this patient".

## 10. R6.13-02: unseen handed critical patients stay stable, and an idle attending earns 2 stars
**CONFIRMED. Severity: High.**
- **Code:** the untreated-harm clock (engine.js:3740) requires `mdMine(p)`, so it never runs for a handed patient.
- **Vitals** (`round13/r6/c.js`, med seed 4242):
  - LVO stroke, ESI 1: `60:96/198/94 … 720:95/191/93` (HR/SBP/SpO2), so stable from 08:00 to 19:00.
  - Mesenteric ischemia: `120/123 → 125/128`.
- **Exception:** bleeding cases still progress. In hard seed 4242 the GI bleed arrested. `round13/r5/handed.js` shows severity drifting only from 1.0 to 1.45 for an NSTEMI and an anaphylaxis.
- **Idle stars:** as in item 3 (2 stars on easy on every seed).
- **Duplicates:** the stars part duplicates item 3, and the deterioration part duplicates item 7.

## 11. R4.13-01: the sideways list board leaves about 40 px of board
**CONFIRMED. Severity: High.** The list board cannot be played on a sideways phone. I'd keep High rather than Critical because the default floor plan, or holding the phone upright, avoids it.
- **Test:** `mine/land.py`, 844x390, touch and mobile, DPR 3, med shift, list view.
- **The pinned top block:**
  - `#top` is `position:sticky` and takes 0 to 264 px. It contains `#boxbar` (115-161), `#objs` (161-218) and `#zbar` (218-264).
  - `#dock` is fixed and takes 310 to 390 px.
- **Visible board strip** (from the bottom of `#zbar` to the top of `#dock`):
  - 46 px for both roles when the Box bar is one line.
  - 39 px (charge nurse) and 32 px (attending) when the Box bar or `#objs` is taller, as in my first, paused run.
- **What fills the strip:**
  - A toast (270-307).
  - `#needBtn` (256-300).
  - `#waitMeter` (272-316, once scrolled).
- **Scrolling to the bottom** (scrollY 1424 of 1814) leaves 0 room cards in the strip.
- **Screenshot** `mine/shots/land_rn_300.png`: only the top edges of room cards show, under a peds-alert toast and the "0 waiting" counter.

## Side observation (outside the list)
`mine/nat_run.js` hit a crash: `TypeError: Cannot read properties of undefined (reading 'tr')` at `treatGap` (engine.js:2052), called from `taskDone` reassess (1650), in hard, attending, seed 6*31+7, at t≈191.
- The test player there signs perfect workups and calls every diagnosis wrong.
- Not confirmed whether the test harness caused it. It is worth a look, because in the game the crash guard would stop the shift.

## Summary

| # | Finding | Verdict | Severity |
|---|---|---|---|
| 1 | R1.13-01: handed patient has no See button | CONFIRMED | Critical |
| 2 | R1.13-02 / R3.13-01: crash re-saves broken state | CONFIRMED | High |
| 3 | R1.13-03 / R3.13-02 / R5.13-02: idle and radio-only attendings score well | CONFIRMED (idle ties, not beats, a 70% attending on average) | High |
| 4 | R1.13-04: held diagnosis scored as "Cardiac arrest" | PARTIAL (mechanism real; 0 of 503 wrong calls in natural play) | Medium |
| 5 | R5.13-01: true diagnosis in the board log | CONFIRMED | Critical |
| 6 | R5.13-03: never diagnosing is left out of the grade and praised | CONFIRMED ("dominant" overstated: loses to correct calling) | High |
| 7 | R5.13-04: handed patients unnoticed, untaught, cheap to ignore | CONFIRMED (bleeds still deteriorate; overlaps 1 and 10) | High |
| 8 | R5.13-05: no pace cap on the attending's Rush | CONFIRMED (sub-case of 3) | High |
| 9 | R6.13-01: MTP and hemorrhage giveaway on the card | CONFIRMED | High |
| 10 | R6.13-02: unseen critical patients stay stable | CONFIRMED (bleeds excepted; duplicates 3 and 7) | High |
| 11 | R4.13-01: sideways list board shows 32 to 46 px | CONFIRMED | High |
