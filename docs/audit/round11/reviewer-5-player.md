# Reviewer 5, round 11: Hardcore gamer, game critic and classroom user

**Build reviewed: `e3fbeec` (v0.31.0), the release candidate.**
- Pinned with `git archive` into scratch and rebuilt there. `index.html`, `sw.js` and `3d/map3d.js` are byte-identical to the committed ones.
- **Server: the real, live, frozen migrations.** PostgreSQL 16, en_US.UTF-8: `stubs.sql`, the baseline, then both migrations in order. `applied.sha256` checks OK. `codeblack.fingerprint()` = `d6705b15e275614018b897e730e13fa4`, the same as `supabase/tests/fingerprint.json`.
- **Routing:** every `/rest/v1/rpc/*` call from the page ran the real functions as `anon`, with a fake `x-forwarded-for` per network:
  - campus NAT `198.51.100.20`;
  - instructor phone `2a02:26f0:1d:4::17`;
  - classmates in `2a02:26f0:1d::/48`;
  - a code-squatting student on `2a00:1450:4001:829::200e`.
  Everything else was aborted. Nothing reached supabase.co or edcodeblack.com.
- **Time travel:** the page clock moves forward N days and the class rows move back N days, so both clocks agree.
- **Scratch:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round11/r5/` (`py/*.py`, `js/*.js`, `*.out`).

**Not re-reported** (STATUS reasons or owner decisions):
- Bullets and full-width dots in names; `Jean‑Luc` (U+2011), `Ann‐Marie` (U+2010) and `O‘Brien` still refused.
- `taken` not counted; one campus bucket; the clipboard after Forget; `full` still offering "without results".
- The verdict naming counts rather than patients; the replace question's scroll.
- The Lows the round-10 STATUS deferred (R5.10-05, -06, -07, -09). Their status is below. I note where a round-10 fix widened one.

## 0. Round-10 status (my R5.10 findings)

| ID | Status | Evidence |
|---|---|---|
| R5.10-01 Medium: one Results check marks a planned code "ended" for good; key dropped while the class lives | **Partly fixed** | `s3r.out` and `s3d.out`: a Results check on days 14.25, 16, 20, 25 and 31 now leaves the row as "ended Dec 9 with no results, unless a student has sent one since… Results checks", with **Results** and **Turn results back on**. On day 40 the revived 1E6-G1H reads "results until Feb 3" after one tap. **Still open:** if nobody reads it after the revival, the device drops the key on **day 61** (`cbKeys`: `K.t + CB_KEEP`). The server still has a live class with 3 results until Feb 3 (`s3d.out`: "day 61 server: PHM-G89 made Jan 04 until Feb 03 (3) / row: (not listed)"). |
| R5.10-02 Medium: blank restart date on the code card | **Fixed** | `s3r.out`: "If none has by Dec 9, the class ends, but a student's first result before **Jan 8** starts it again". `Date.parse(R.exp)` at `ui.js:2176`. |
| R5.10-03 Medium: a botched lost code gets the perfect code's verdict and instructor line | **Partly fixed** | `s9r-wronglost.out`: adenosine in VF, then lost. `codeLost 0`; verdict "One of your own patients died. Read the M&M below."; M&M "died after a VF"; instructor row "saw 1 patient (1 of them died)". The by-the-book run keeps "after a code run by the book". **Still open, the "also" half:** at three stars a by-the-book loss still hides everything else. `vd.out`: `{dxWrong: 2, died: 1, codeLost: 1}` at 3★ gives only "A patient died after a code run by the book…", with no "Diagnoses to review". The brief's own case, a three-star shift with a wrong diagnosis, works only when no code was lost. |
| R5.10-04 Medium: a 5xx leaves the class with no code | **Fixed** | `s1r.out`: 503 and 500 each give "The server had a problem… / Try again / Use it without results", and Try again recovers. A 429 still offers only Try again. |
| R5.10-05 Low: an under-5-minute own arrest is in the table, but the verdict says all is well | **Still open** | `s9r-late2.out`: the table says "still in cardiac arrest at the end… 1". The verdict says "Solid shift". `mdArrestOpen 0`. |
| R5.10-06 Low: a code still running at the end vanishes | **Still open, and the gap is wider** | `s9r-run10.out`: `ev: 'doing'`, nothing anywhere. `end10.out`: an all-wrong code started 15 min before the end costs legal 0, plus 25-point M&M lines. The same code finished a minute earlier now costs **+10 legal and a 60-point "died after" line** (round-10 fix). |
| R5.10-07 Low: legal risk past 75% at the end, with no word | **Still open** | `s9r-late10lit.out`: "76% Legal risk · Performance improvement plan". |
| R5.10-08 Low: round-9 STATUS overclaims | **Fixed** | The bugs behind them are fixed, and round 10's STATUS doesn't repeat them. Round 10 has new overclaims of its own: **R5.11-03**. |
| R5.10-09 Nitpicks | **Still open** | `kb.out`: Enter on a level button still drops the focus to `BODY`. A refused delete still says "the server has deleted all its results" (`ui.js` cbDelGo). README:55 still leaves Bengali out of the joiner list. |

**Counts:** Fixed 3, Partly fixed 2, Still open 4, Worse 0.

## 1. Verdict

**Ship v0.31.0 to students: yes, after a one-line change to R5.11-01, or ship and fix it this week.** The classroom loop is now solid, against the real live SQL, on day 1 and at week 6. The live site is v0.30.0, and its Send and Class results have been broken since the first migration went live. Every day of waiting costs more than anything left on my list.

The one new Medium is in the attending's scoring. The round-10 fix to "by the book" uses a 3-game-minute threshold that the player is never told about and can't reasonably meet at 4×. A textbook code started about 2 real seconds late is now scored like a botched one.

What works:
- **Making codes on a projector:** a code in about 1.5 s. A 429 reads as busy, with the mobile-data hint. A 503, a 500, unreachable, a timeout and full each offer "Use it without results". Try again recovers after each.
- **Planned codes:** every row tells the truth after a Results check now.
  - A code made on Nov 25 and first used on day 14.25, 20 or 40 takes the result, and the instructor sees it.
  - A squatter's own key on day 45 gets `taken`.
  - Turn results back on during the hold gives the instructor a fresh 14 days (`hold.py`).
- **Students:**
  - 700 junk names from the NAT, then "Nadia" goes through (`junk.out`).
  - Arabic, Devanagari, Chinese, Vietnamese, apostrophe (U+2019) and hyphenated names all pass.
  - Bad Wi-Fi, a timeout, then a retry with a double tap are kept once.
  - Leaving unsent warns first.
- **The instructor:**
  - The troll is deleted with the ask in view.
  - Keep and Escape put the focus back on the ✕ or the Forget link that asked (`fdel.py`, `fesc.py`).
  - Forget puts the focus on the sheet (`kb.out`).
- **The attending:**
  - A lost by-the-book code, a botched one and an abandoned one are now told apart in the verdict, the M&M, the stats sent and the instructor's row.
- **Regular play is unchanged:**
  - `s10.out`: no RPC calls and no Send box; Menu leaves in one tap.
  - `npm test`: 720 ok, exit 0.
  - `class_test.py`: 107 ok, "No errors".

## 2. Score

**7/10.** Up from 6.5. Three of my four Mediums are closed with evidence, and the classroom works a month later. Points off:
- a new, unannounced, reaction-time cliff in the attending's code scoring;
- two STATUS claims that don't hold;
- the same handful of end-of-shift arrest Lows, now in their third round.

## 3. New findings, worst first

### R5.11-01 Medium: a textbook code started about 2 real seconds late at 4× (3.4 game minutes), then lost, is scored as a botched code: +10 legal risk, a 60-point M&M "died after" line, an ordinary death in the verdict and to the instructor. The 3-minute line is never shown before it is crossed.
- **Where:**
  - `engine.js:2276`: `const book = C.wait <= 3 && (!C.me || C.right >= n)`.
  - `engine.js:2278–2279`: `litAdd(10, …)` and `mm(60, …)` when `!book`.
  - `codeStart`, `engine.js:2204`: `wait = Math.round(G.t - ref)`. It starts the moment the player taps (no walk time: `js/wait.js`, "code started after 0.1 game min, C.wait 0").
  - The card, `ui.js:989`: "Every minute without a doctor lowers the odds."
  - The lesson, `ui.js:1919` (ca5): "Right calls and a fast start raise the odds".
  - Nothing slows or pauses the game when your own patient arrests. Speeds go up to 4×, `BASE` 0.4 game min per real second.
- **Reproduction (`js/late.js`, the real engine):** a Rush attending; your own NSTEMI patient arrests. Tap Run the code 3.4, 3.6 or 4 game minutes later: 2.1–2.5 real seconds at 4×, 8.5–10 s at 1×. Answer every rhythm check right; the patient dies.
  - `wait 4`, `codeLost null`, **legal +10**.
  - M&M: "**60** Mei K. died after a PEA / 3 of 3 rhythm checks right; the team got there 4 min after the arrest".
  - The verdict is the plain "One of your own patients died. Read the M&M below." The instructor's row is "(1 of them died)", with no "by the book" (compare `s9r-wronglost.out`).
  - For scale: abandoning the arrest altogether ends at legal 13 (`s9r-abandon.out`). The perfect-but-late code costs nearly the same as never showing up.
- **Why it matters:**
  - The ROSC odds lose only 5% per late minute (`engine.js:2250`), a gentle slope. The scoring is a cliff at one minute.
  - The player learns the rule only after the shift, in the Send box's fine print ("every rhythm check right, a doctor there within 3 minutes").
  - Clinically, nurses run CPR from the first second and a doctor arriving at minute 4 isn't negligence. Teaching "4 minutes = legal exposure" is wrong.
  - In class this hits the diligent student who was writing orders in another patient's sheet when the alarm sounded.
- **Fix (pick one):**
  1. Pause (or drop to 1×) when your own patient arrests, and count `wait` from when the Run the code card was first shown.
  2. Grade lateness the way the odds do: legal and M&M only past about 5–10 minutes, or scaled. Keep "by the book" to the rhythm checks.
  3. At least put "a doctor within 3 minutes" on the Run the code card and in lesson ca5.
- **Effort:** XS (disclosure) to S (pause or scaled).

### R5.11-02 Low: after Delete, keyboard focus drops to the page body, not to the results heading
- **Where:** `cbDelGo` sets `U.focusTo = '#cbHead'` (`ui.js:2786`), and `#cbHead` has `tabindex="-1"`. The focus still ends on `BODY`.
- **Reproduction (`py/fdel.py`, PC, real SQL, 4 results):**
  1. Focus a ✕ and press Enter. The focus goes to **Keep** (correct).
  2. Tab to **Delete** and press Enter.
  3. The focus is on `BODY` at +30 ms, +300 ms and +1.5 s. The row goes (3 left).
  4. The next Tab lands on the sheet's own ✕ close, not near the list.
  - The same happens by mouse (`s5.out`: "focus after delete: BODY").
- **Why it matters:** a screen reader announces nothing after a delete. A keyboard instructor deleting three trolls has to Tab back down through the whole sheet each time. The STATUS says this was fixed (R5.11-03).
- **Fix:** apply `focusTo` after the in-place row removal, or keep the heading in the DOM through `morph` and focus it in the RPC callback. Add a `class_test.py` check of `document.activeElement` after Delete.
- **Effort:** XS.

### R5.11-03 Low: round-10 STATUS overclaims
- "**Delete puts it on the results heading**": it lands on `BODY` (R5.11-02).
- "**An unused class past its 14 days was marked ended by one Results check (R5.10-01). It isn't**", filed under *Fixed*. The other half of R5.10-01, the device dropping the key at made + 60 days while a revived class lives to day 74, is neither fixed nor listed under *Left* (`s3d.out`, day 61).
- "**Lows… none is a correctness or privacy failure**": R5.10-06 is one. A code still running at the end, run all wrong, leaves no M&M line, no legal risk and nothing for the instructor. After this round's change, the same code finished a minute earlier costs +10 legal and a death.
- **Effort:** XS.

### R5.11-04 Nitpick: small things
- **The key's lifetime:** the device keeps a key `K.t + 60 d`, and `t` moves to the server's `created` only when someone opens Results or Turn results back on. A class revived on day 40 and read on day 41 keeps its key to day 101, two months past need. Keep it to `max(t, e) + 30 d`.
- **"Sent" on a revived code:** a student's own summary after a revival still says "deleted when the class ends, within 30 days of the class's first result". True, but the instructor's card on day 0 promised "Dec 25", and the class now ends on Feb 3. Only the instructor's row learns the new date, and only after a Results tap.
- **Server normalization:** `cb_class_new('HLD-0A1')` is accepted and stored as `H1D-0A1` (`hold.py`). The game never sends an L, so this is harmless; noted for the contract.

**Counts:** Critical 0, High 0, Medium 1, Low 2, Nitpick 1 (4 total).

## 4. Coverage

**Instructor (real taps, real SQL):**
- **`s1r.py`, projector:**
  - fast; busy (62 well-formed calls from the NAT);
  - 429, 503 and 500;
  - unreachable, then Use it without results;
  - a timeout past 8 s;
  - full (100,038 live classes);
  - Try again after each.
- **`s3r.py`, classroom PC over 61 days:**
  - Codes: a used class read on day 8; a used class never read; planned codes for day 14 +6 h, day 20 and day 40.
  - Each row's text and buttons on days 0, 8, 13, 14.25, 15, 20, 25, 31, 40, 45, 59 and 61, with Results taps.
  - A student squatting the code on day 45.
- **`s3d.py`:** a planned code checked on day 16, revived by three students on day 40, never reopened; days 45, 59 and 61.
- **`hold.py`:** Turn results back on during the hold, for an unused class and a used class never read.
- **`s5.py`, phone, 37 results:** row heights; deleting the troll; the focus after delete. The rest of `s5.py` (network and refused deletes, CSV) was blocked by my own reused-code data. The refused-delete path was read in code (`cbDelGo`) and was verified at round 10.
- **`fdel.py`, `fesc.py`, `kb.py`, keyboard only:**
  - Keep, Escape and Delete on a row; Delete all, then Keep.
  - The Forget ask and Escape; the replace-code ask and Escape.
  - The Tab ring stays inside the sheet.

**Students:**
- **`s2r.py` and `s2.py`, tablet and phone on the NAT:**
  - a real class shift;
  - U+2011, U+2010 and U+2018 names;
  - bad Wi-Fi, a timeout, then a retry with a double tap (one row per shift);
  - leaving unsent;
  - trolls (Cyrillic е, full-width, circled letters, maqaf, U+2027);
  - 13 real-world names in 10 scripts.
- **`junk.py`:** 700 junk names, then a real send; 16 more names straight into `cb_submit`.

**Attending:**
- **`s9r.py`, sideways phone, class code 062-83V, real `cb_submit` and instructor read, six variants:**
  - lost by the book;
  - all wrong, then lost;
  - abandoned;
  - 2 min before the end of a Rush;
  - 10 min before the end at legal 62%;
  - run 10 min before the end.
- **Node, the real engine:**
  - `end10.js`: ignored, run right and run wrong at 1, 3, 4.9, 5.1, 8 and 15 min before the end.
  - `wait.js`: walk time to a code.
  - `late.js`: a late perfect code.
- **`vd.py`:** verdict variants, including three stars with a wrong diagnosis.

**Regular play:**
- `s10.py`: Quiet Tuesday as charge nurse and a Rush as attending.
- `npm test` (scratch copy): 720 ok, exit 0.
- `class_test.py`: 107 ok, "No errors".

**Not covered:**
- Real Safari and Firefox, a real NAT, the live project, 3D, the gate.
- A stale v0.30.0 service worker. Read in code: `sw.js` is network-first, so an online phone gets v0.31.0 on its next load.

## 5. What I'd keep

- **The code on screen is always real.** It shows only once the server has it, and every failure a classmate can't cause still gives the class a playable shift with an honest warning.
- **The planned-code server logic:** revival on day 14, 20 or 40, the hold against squatters, the instructor's own Turn results back on. All of it works against the frozen SQL.
- **Saved-code rows that admit what the device doesn't know** ("unless a student has sent one since… Results checks") instead of guessing.
- **Sends kept exactly once**, whatever the Wi-Fi does, and junk sends that can't close the campus.
- **The attending's arrest outcomes are finally distinct:** by the book, botched, abandoned and left at the end each read differently to the student and to the instructor.
- **Focus handling on the confirms:** Keep and Escape return to the button that asked.
- **Regular play untouched**, and the build reproducible byte for byte.
