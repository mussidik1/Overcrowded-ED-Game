# Drift check, v0.33.0

**Verdict:** The code matches the v0.33 grading rules exactly: stars capped by patients seen at 30/24/18 on a full shift and 5/4/3 in the Rush, handed patients worsen after 45 min and move to another doctor after 60, and an uncalled diagnosis counts as a miss. But several documents still describe older behaviour or claim fixes the code doesn't deliver. Nothing found is Critical. Three are worth fixing before `main`: #1 (alert tags give the diagnosis away), #2 (MTP before arrival is now impossible) and #3 (the 12 px / 44 px claim).

Baseline at f2fa298: `npm test` passes with 800 "ok" lines and no FAIL. `npm run lint` is clean. A rebuild in a scratch copy is byte-identical to the committed `index.html`, `sw.js` and `3d/map3d.js`.

(One housekeeping note: a broken scratch script of mine briefly wrote `rn_side.png` and `rn_side0.png` into the repo root. I deleted them, and `git status` is clean.)

## Mismatches

1. **Medium. The alert tag gives the attending's diagnosis away.**
   - **Docs:** spec/02-SPEC.md REQ-07 AC5 (line 49) and README.md:57 both say an incoming alert "doesn't carry its diagnosis for the attending".
   - **Code:** in Playwright, Manic Monday as the attending, a handed walk-in `sepsisw` patient's card shows the tag "SEPSIS" and "WORKING: Sepsis alert" before any workup. The diagnosis it then asks for is "Sepsis", against Pyelonephritis, Kidney stone and Dehydration (`DDX.sepsisw`).
   - The same happens for STEMI: the alert is "stemi", the answer is "Anterior STEMI", and the distractors are Pericarditis, Dissection and PE.
   - `test/rules15.js:34-36` only checks `p.dxK`, not the visible alert label.
   - **Fix:** either hide the alert's type from the attending until the diagnosis is called (code), or narrow the claim to "doesn't mark the diagnosis known" (docs). This is the owner's call.

2. **Medium. MTP can no longer be started before arrival on the attending's regular shift.**
   - **Doc:** README.md:210 (attending step 6) says "Activate massive transfusion for a trauma that's bleeding out, even before they arrive."
   - **Code:** `mtpHid` (`src/ui.js:100`) hides `mtpBtn` until `p.dxK || p.bb`. The en-route card (`ui.js:1023`) has no order sheet. `ptSheet` clears every extra button for the attending (`ui.js:1013`, `if (MD()) { b.length = 0; ...}`).
   - Playwright confirms it: an en-route `mcired` patient on Full Moon Friday has no MTP control at all.
   - **Fix (docs):** "after you see them, MTP is an order on the sheet." Mark "even before they arrive" as Orientation, Lessons and charge nurse only.

3. **Medium. The 12 px text and 44 px controls claim is false on the main play surfaces.**
   - **Docs:** README.md:57 says "text is at least 12 px and controls about 44 px". docs/SMOKE.md:31 says "Sideways: the top strip buttons ... about 44 px and no text is too small". Spec REQ-19 says the same.
   - **Code:**
     - Sideways list board: the zone-jump chips in `#top` are 32 px tall (`.zc { height: 32px }`, `style.css:102`; measured 38–83 × 32).
     - Sideways flat floor plan: SVG text renders at 7.1 px (TRIAGE), 7.5 px (DOOR, HELIPAD, WAITING), 9.4 px (THE WALL) and 10.4 px (room numbers).
     - docs/audit/round13/STATUS.md already lists R4.13-06 and R4.13-07 as open, so the SMOKE step fails by design.
   - **Fix (docs):** drop or qualify the README claim, and mark the SMOKE line as a known exception until R4.13-06/07 are fixed.

4. **Medium. README's attending scoring paragraph is pre-v0.33.**
   - **Doc:** README.md:212 says "The attending's score counts patients seen, clean order sets, right calls, time goals, and medical direction ... The shift report lists your patients and your worst moments, not the nursing numbers."
   - **Code:** `gradeParts`/`mdScores` (`engine.js:849-853`) grade Clinical (own patients), Diagnoses, Radio and Legal. `overallStars` (`engine.js:868`) caps the stars by patients seen. The report shows the department as context ("The department today (not your grade)").
   - **Fix (docs):** rewrite it to match the v0.33 paragraph.

5. **Medium. In-game help never mentions the new attending rules.**
   - **Text:** `helpMD()` at `src/ui.js:1584-1597` ("Pick up patients", "Your scores"), the Orientation `top` step (`ui.js:1853`) and the first-shift card (`ui.js:2515`).
   - **Code:** none of these says the stars are capped by patients seen (30/24/18, Rush 5/4/3), that patients put on your list worsen after 45 min and leave after an hour, or that an uncalled diagnosis counts as a miss. The player learns the cap only on the end report (`ui.js:3245`).
   - The instructor note `CB_MDNOTE` (`ui.js:2253`) says "the score and stars are the attending's own: Clinical..., Diagnoses..., Radio..., Legal". It doesn't mention the cap.
   - **Fix (UI text):** add one line each to `helpMD` "Your scores" and "Pick up patients", and one clause to `CB_MDNOTE`.

6. **Medium. README contradicts CLAUDE.md on whether the repository is public.**
   - **Docs:** README.md:10 says "this repository is private since Nov 18, 2026". CLAUDE.md:14 says it has been public since Nov 25, 2026.
   - **Fix (README):** update line 10.

7. **Low. The Orientation descriptions in the README are stale.**
   - **Doc:** README.md:40-41 say "Charge nurse (67 steps) ... your five scores" and "Attending (37 steps): your five numbers (Wait, Score, Panel, To see, To do)".
   - **Code:** `STEPS` has 69 entries (`ui.js:1696-1818`) and teaches four scores (`ui.js:1724`). `STEPS_MD` has 40 entries (`ui.js:1845-1901`) and teaches four own scores (`ui.js:1853`). "Panel", "To see" and "To do" appear nowhere in `ui.js`.
   - **Fix (README).**

8. **Low. README's charge nurse scores are the old ones.**
   - **Doc:** README.md:199 says "Charge nurse scores: average wait, patient management, staff satisfaction, LWBS, EMS wall time".
   - **Code:** the four graded scores are Patients, Clinical, Admin and Staff (`engine.js:845`; How to play at `ui.js:1577`).
   - **Fix (README).**

9. **Low. Four initials separated by spaces are refused.**
   - **Doc:** spec REQ-16 AC1 (line 102) says "1 to 4 letters, with or without periods or spaces". The code comment at `ui.js:2147` cites "J S K M" as accepted.
   - **Code:** `cbSendable("J S K M")` and `cbSendable("J. S. K. M.")` both return false, because `cbClean`'s `CB_NAME` allows at most three words (`ui.js:2137`). "J.S.K.M.", "JSK" and "s k" pass. Lowercase run-together initials ("js", "jsk") and four capitals together ("JSKM") are refused, and the error text ("like S.K., J S or JS") doesn't say why.
   - **Fix (code):** count letters, not words, in `cbInitials`, or narrow the spec and the comment.

10. **Low. The spec's stale-code wording overstates what happens.**
    - **Doc:** spec REQ-15 AC2 (line 98) says "A code from another game version is refused as stale."
    - **Code:** only versions in `PAST_V = ['0.32.0']` (`ui.js:2084`) come back `stale`. A code from any other version is refused as mistyped by the checksum, about 63 in 64 times, and about 1 in 64 plays as a different shift (CLAUDE.md says this correctly).
    - **Fix (spec).**

11. **Low. The class-results note still says "any name".**
    - **Code:** `CB_NOTE` (`ui.js:2252`) says "anyone with the code can send a result under any name". The CSV headers are "Name" and "Same name". Since v0.33 the game sends initials only; README.md:182 was already changed to "any initials".
    - **Fix (UI text):** "any initials".

12. **Low. A handed patient's card contradicts itself.**
    - **Code:** a patient handed to the attending shows "Provider: Not assigned yet" (`ui.js:791`, which reads `p.ev === 'none'` with `p.loc === 'room'`), while the same card says "The charge nurse put them on your list" (seen in Playwright, Room 3).
    - **Fix (code):** say "On your list, not seen yet" when `p.prov === G.me && !p.mine`.

13. **Low. Stale counts and commands.**
    - CLAUDE.md:71-72 give about 4,900 and 3,200 lines; the files are 5,072 and 3,538.
    - CLAUDE.md:158 and README.md:240 say about 780 checks; there are 800 "ok" lines.
    - README.md:239 says `npm run build` "writes 3d/map3d.js and index.html"; it also writes `sw.js`.
    - **Fix (docs).**

14. **Low. SMOKE.md doesn't test the release's headline behaviours.**
    - There is no step for a patient put on your list (the toast, "On your list: see them", worsening, hand-off), for the "Patients you saw" star-cap line on the report, or for the crash card.
    - This means R2.13-02, marked fixed in STATUS, is only partly done.
    - **Fix (SMOKE):** add those three lines.

15. **Low. docs/clinical-sources.md doesn't list every case its rules cover.**
    - The Canadian Syncope Risk Score row lists only `syncope`; the score also applies to `synchigh`.
    - The hemorrhagic shock row lists `mvc` and `moto`; `mcired` and the `mciyel` crash also use those rules.
    - **Fix (doc).**

16. **Low. One risk score's diagnosis still gives the risk away.**
    - **Doc:** README.md:57 says "Syncope" and "Chest pain" replace "the names that gave the risk away".
    - **Code:** the gray-zone case `pnalow` still has the diagnosis "Pneumonia, low risk" (`CASES`).
    - **Fix:** rename it (code), or note the exception (README).

17. **Nitpick.** `supabase/tests/client_call.json`'s example `cb_submit` uses `"p_name": "Sam"`, a first name, while the game sends initials only. The server accepts both, so this is cosmetic.

## Claims checked and found consistent

- **Star caps and rates:** `SEEN_FOR = { shift: [30, 24, 18], rush: [5, 4, 3] }` (`engine.js:864`), applied in `overallStars` (but not in Orientation or Lessons). The report shows the cap (`ui.js:3242-3245`).
- **Engaged attendings reach three stars:** an engaged autopilot attending saw 42–51 patients on a full shift and 7–8 in the Rush, with 3 stars every time.
- **Patients put on your list:** they go only to ESI 1–2 patients, at `MD_LOAD` easy 0, med 2, hard 4, rush 2 (`engine.js:4680`), so Quiet Tuesday is excluded, as documented. The toast at hand-over is there.
- **Waiting costs:** after 45 min unseen they get visibly worse with a penalty; after 60 min they leave the list, count as unseen, and another provider takes them at once (checked over 3 seeds on hard). A patient put on the list in the last 30 minutes counts as a sign-out (`engine.js:3484`).
- **See this patient and Next:** a patient on your list can be seen, and the Next chip reads "On your list: see them".
- **Uncalled diagnosis:** `noCall` scores it as "no diagnosis called" when the patient leaves and at shift end (`engine.js:3490`, `:4550`). The result settles when the patient leaves; the card says "The results and how they do will tell". The log says "results are in. Your call" (`engine.js:3290`), and the diagnosis is kept with the call (R1.13-04).
- **No answers on a regular shift:** the list of missing orders shows only in Orientation and Lessons with Plain words on (`gapHint`). A wrong consultant doesn't name the right one (`engine.js:3182-3184`). Harm reasons:
  - `sbo.reglan`, `ibu/ketor` and stroke `heparin` use the R6.13-09 wording.
  - On a blood thinner, the stroke tenecteplase reason names the anticoagulant (`engine.js:493`).
  - The stroke lesson's k8b/k9 match `lyticWindowOk`: 270 min, checked at order time.
- **MTP for the attending:** before the diagnosis or MTP, the attending sees signs, not MTP, on the card, the tag and the chip (`ui.js:571`, `626`, `985`). The bot activates MTP only for other doctors' patients (`engine.js:4656`).
- **Crash guard:** `save()` returns after a crash (`ui.js:3017`). The page behind the crash card is made inert and Tab is trapped (`ui.js:3351-3357`). `career()` validates its stored record. `ACT.print` opens `details.dept`. The Box is left out of the attending's "Hurt most".
- **Initials:** S.K., JS, JSK and A are accepted; rude words, numbers and names are refused with a reason. The name is never written to localStorage. The About/Privacy list matches the `cbArgs` payload, and its retention text matches CLAUDE.md.
- **Class codes:** the bit layout round-trips, `SCENS` has 5 keys and `PACKS` 2, a mistyped code is refused, and `PAST_V = ['0.32.0']`.
- **Career rank:** 2 points a star, 1 in the Rush (`ui.js:3304`). The rank names match the spec.
- **Lessons:** the Lessons screen says 9 played and 2 read-through; `train_test.py` expects 32.
- **Clinical rules:** `CONTRA_IF` matches CLAUDE.md (nitroglycerin, opioids and metoprolol in ACS; NSAIDs before the troponin in `cwp`; rate control in crashing A-fib; tenecteplase in stroke, including on an anticoagulant). `NEVER_WRONG = ondan, apap`. TIA ABCD2 0–3 is home or observation (`engine.js:1282`). LYTIC_BP is 185/110. ARREST_NO_TEAM is 20 and CODE_GAP is 2.
- **SMOKE strings:** every string the SMOKE steps rely on exists in `ui.js`: "Class results are on", "Show key", "Keep my shift", "Resume your shift", "Open with an instructor key", "A code made on another device", "Run the code", "Start the shift", Download CSV and Copy table.
- **Deploy package:** `pages.yml` publishes `img/CREDITS.md` (the README links to it), and the build outputs match the source.
