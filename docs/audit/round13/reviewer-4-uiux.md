# Round 13, Reviewer 4 (UI/UX and accessibility): v0.33.0

**What I tested.** The built `index.html` at 895bc15 and 76c553f, in Playwright Chromium:
- Upright phones at 390x844 and 360x740 (touch, DPR 2).
- Sideways phone at 844x390 (touch).
- Desktop at 1280x800.
- One 3D pass over a local http server, with supabase.co and edcodeblack.com blocked at the browser. No external contact.

Scripts and about 90 screenshots are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round13/r4/` (screenshots in `shots/`).

**Mid-review change.** Commit 899b893 landed while I was working, and there are uncommitted changes in `src/`. I re-checked the crash card against it (see R4.13-14). Line numbers below are from the current tree.

## 1. Verdict

**Not ready for `main` until R4.13-01 to R4.13-05 are fixed.**

The new screens mostly render cleanly. I found no sideways page scroll at any size, and every computed font is Cardo. Keyboard handling is better than in round 12: the pause menu, sheets and Escape all behave.

The problems are what the player is told:
- **Sideways list board:** it shows about 40 px of board, less than the 90 px the owner accepted.
- **Attending report:**
  - Its new department section looks like an empty heading.
  - It says The Box hurt a Clinical score that The Box no longer counts toward.
  - It contradicts itself about where the stars come from.
- **Hidden shift stars:** the report never shows the shift's overall stars, yet the new Rush pace line, the rank points and the bests all depend on them.
- **Waiting counters:** they disagree with each other, and the visible label ("Lobby") is not the accessible name.
- **12 px and 44 px goals:** the main surfaces still miss both.

## 2. Score

**5 / 10.**

## 3. Findings (worst first)

### R4.13-01 High: The sideways list board shows about 40 px of board (F-135, accepted at "about 90 px", is worse than reported)
- **Where:** the list board at 844x390.
  - The top block stays pinned: `#top`, `#boxbar`, `#objs` and `#zbar`, 264 to 271 px of the 390 px screen.
  - `#dock` is fixed at 80 px.
  - Toasts (`style.css:371`, `body.ingame:not(.mapmode) .toasts`) and the two floating counters (`#needBtn`, `#waitMeter`) sit in what is left.
- **What happens:** measured (scratch `float.py`), the visible board between the chip bar and the dock is **39 px for the charge nurse and 46 px for the attending**.
  - Scrolling to the bottom still shows no room. The 39 px strip shows the radio log, and a toast ("Pod A has 1 patient and no nurse…") covers it (`shots/844x390_rn_list_bottom.png`).
  - The Next button's top is clipped under the chip bar.
  - The attending's sideways list (`shots/844x390_md_map.png`) shows only the "Ambulance bay" header, overlapped by a faded "Next · The Box".
- **Reproduce:** set the board to list, hold the phone sideways, play any shift.
- **Why it matters:** the list board is the board recommended for upright phones and the fallback when 3D fails. Turned sideways it can't be played.
- **Rating of the accepted item:** High, not Medium.
- **Fix:**
  - In landscape list view, fold `#boxbar` and `#objs` into the 44 px strip the map mode already uses (`body.mapmode` rules at `style.css:551` onward).
  - Let `#zbar` scroll with the board.
  - Shrink the dock to one 44 px row.
  - Or, sideways, switch the list board to the floor plan with a one-line notice.
- **Effort:** M.

### R4.13-02 Medium: The attending report's "The department today (not your grade)" looks like an empty heading, and print drops it
- **Where:**
  - `src/ui.js:3235`: `<details class="dept"><summary>…</summary>`.
  - `src/style.css:1073`: `summary { display: flex }`.
  - `src/ui.js:2713`: `ACT.print` opens only `details.rep-more`.
- **What happens:**
  - `display:flex` removes the disclosure marker in Chromium. Unlike `.litbox summary::before` (`style.css:1159`), nothing replaces it.
  - At all four sizes the line reads as a bold heading followed by the rank line (`shots/390x844_md_report.png`). Nothing says it opens.
  - Print or save as PDF leaves it closed, so the department's four scores never reach the printout.
- **Fix:**
  - Add `.rep details.dept summary::before { content: '▸' }` and `[open] … '▾'`, as `.litbox` does, or reuse `.rep-more` styling.
  - Open `details.dept` (and `.litbox details`) in `ACT.print`.
- **Effort:** S.

### R4.13-03 Medium: The attending report contradicts itself
- **Where:**
  - `src/ui.js:3215` (`SC_TAGS.clinical` includes `box` and `boxn`) and `:3228` (`why()` reads the department ledger), used by the attending's own Clinical card at `:3234`.
  - `src/engine.js:867`: for the attending, `box` is excluded from the Clinical score.
  - `src/ui.js:3155`: the verdict for an idle attending.
  - `litHTML` `:3219`: "Clinical accuracy".
- **What happens** (an attending who saw nobody, Manic Monday, `390x844_md_report.txt`):
  1. The Clinical card says "Your own patients · **Hurt most: The Box**". The Box doesn't count toward the attending's Clinical score; it has its own Radio calls card.
  2. "You saw no patients this shift: the stars come from the radio calls and **the department the computer ran**." Directly above, the section says "The department today (**not your grade**)". Since Phase 6 the second statement is the true one.
  3. "Clinical 75%" on the card and "**100%** Clinical accuracy" in the box below, with no explanation of the difference.
  4. Diagnoses shows "—" with ☆☆☆. The ungraded part looks like a zero-star failure, although `baseStars` leaves it out.
- **Fix:**
  - For the attending, build `why()` from the attending's own tags (exclude `box`/`boxn`), or drop Best/Hurt most from the attending's cards.
  - Change line 3155 to "…the stars come from your radio calls and legal risk."
  - Rename "Clinical accuracy" to "Diagnosis accuracy" (or remove it).
  - Show "not graded" instead of ☆☆☆ for a null part.
- **Effort:** S.

### R4.13-04 Medium: The shift's own stars are never shown, but the Rush pace line, the rank and the bests all use them
- **Where:**
  - `src/ui.js:3191` (`reportHTML`) and `scoreCardsHTML` `:3222` onward.
  - `R.stars` (`engine.js:4548`, `overallStars` `:861`) appears only in Share and in the Send line.
- **What happens:**
  - The Rush report says "In the Rush, **your stars** can't beat your pace". It then shows four cards (★★★ ★★☆ ★★★ ★★☆) and "+3 rank points" (`shots/390x844_rush_report.png`).
  - Nothing on the screen says the shift earned ★★★, or that a slow Rush was capped. A slow Rush could show three-star cards next to "+1 rank point".
  - The class report's Send small print says "score 85/100 · ★★☆" while the cards read 2, 2, 3, 2.
- **Fix:** add one line above the cards, for example "This shift: ★★☆ (the average of your four)" or "★★☆, capped by your pace". Point the pace sentence at it.
- **Effort:** S.

### R4.13-05 Medium: The waiting counters disagree, and "Lobby" is not its own accessible name
- **Where:**
  - `src/ui.js:483-484`: the chip counts `loc 'waiting' || 'triage'`. It shows "Lobby N" with `aria-label="N in the waiting room"`.
  - `:538-539`: the lane counts `waiting` and `G.triageQ` separately.
  - `:1252`: the intake sheet.
- **What happens** (390x844, `shots/390x844_rn_list.png`), all at the same moment:
  - The chip says **Lobby 1**, and a screen reader hears "1 in the waiting room".
  - The lane says "**0 in the waiting room · 1 at the door**".
  - The patient tagged TRIAGE NOW is drawn under the **Waiting room** heading.
- **Why it matters:**
  - The same person is counted three different ways.
  - "Lobby" appears nowhere else in Orientation, How to play or the Words list.
  - The visible label isn't part of the accessible name (WCAG 2.5.3), so a voice-control user saying "tap Lobby" fails.
- **Fix:**
  - Use one word, "Waiting".
  - Make the chip text and aria-label match the lane ("Waiting 1", label "Waiting: 0 in the waiting room, 1 at the door").
  - Title the lane "Door and waiting room".
- **Effort:** S.

### R4.13-06 Medium: Tap targets still under 44 px (beyond the accepted F-137 and F-141)
Measured with scratch `shift.py`, `sweep.py` and `orient.py`:
- **List-board pod nurse rows** (`.zh`, `style.css:183`): **366x22** and 336x22. This is the control How to play teaches ("Tap a pod header to move nurses").
- **Waiting room lane header:** 366x32.
- **Sideways (844x390):**
  - Pause menu items: 263x**42**.
  - Settings rows: 410x42.
  - Scenario and weather `<select>`: 274x**36**.
  - Medical direction pack buttons: 172x**40**.
  - Orientation "Exit": **36**x44.
  - The Box "Answer": 79x42.
  - The Box dot (`boxTap`): **14x16** (8x10 upright).
- **Upright:**
  - "Beds upstairs" inline link on the card: 73x**18**.
  - "What the words mean" in How to play: 284x38.
  - Card buttons "Update them on the plan" and "Assign a hold nurse…": 42 tall at 390.
  - Scenario and weather chips: 36 tall at every size.
- **Desktop map:** provider and staff chips 33–40 px.
- **Accepted items, rated:**
  - F-137 (sideways 2D floor): **Medium**. The 3D floor, the default, has room icons about 24x22 CSS px, estimated from `shots/844x390_3d.png`.
  - F-141: Low.
- **Fix:** add `min-height:44px` to `.zh`, `.lane-h`, `.mc-ch button`, `.t-set`, `.seg`, selects, `.coach-x` and the pack buttons, plus padding on the inline "Beds upstairs" link.
- **Effort:** S.

### R4.13-07 Medium: Text under 12 px on the main play surfaces (this release's goal)
- **Flat floor plan, sideways** (SVG, rendered size):
  - Room numbers 10.4 px, patient names 7.8 px, "DOOR" 7.5, pod ranges "1–4" 8.0, "THE WALL" 9.4, "TRIAGE" 7.1.
- **Desktop 1280 map:** name tags under chips 7.8 px; "Watch" and "Discharge" 10 px; "Clean" 10.4–11.8.
- **3D canvas labels:** an estimated 6–8 px (pod labels, room numbers in the icon badges).
- **List board patient name chip:** `.pn` (`style.css:887`, `font .9em`) is **11.7 px**. It also shows in Orientation.
- **Class code notice:** `.t-warn` 11.25 px (F-141, still present).
- **Fix:**
  - Set `.pn` to `max(12px, .9em)`.
  - For the maps, either scale labels to a 12 px minimum at the default zoom or write down the exemption the owner accepts. Today the release notes claim "no text under 12 px".
- **Effort:** M for the maps, S for the rest.

### R4.13-08 Medium: Two floating counters on the list board cover content, and How to play describes them wrong
- **Where:** `#waitMeter` (`ui.js:2599`, `style.css:1087`) and `#needBtn`.
- **What happens:**
  - On the list board both float over the rooms: "1 waiting on a next step" at the left and "1 Next · Room 2" at the right.
  - At 390 the Next button covers R2's status ("Clea…"). At 360 a toast covers the meter.
  - The board has no bottom padding, so the last rows and the radio log sit under them.
  - They show nearly the same number, and nothing explains the difference.
  - How to play (`ui.js:1573`) and Orientation's "top" step say "the meter **by the zoom buttons**". The list board has no zoom buttons.
- **Contrast:** the meter's white text on `hsl(hue 72% 40%)` (`ui.js:2611`) measures **2.9:1** in the green to yellow range (13 px text).
- **Fix:**
  - Merge the two counters into one control, or place both in the dock row.
  - Add `padding-bottom` to the board equal to their height.
  - Darken the meter (lightness 30% or less) or use dark text.
  - Change the help text to "the meter at the bottom".
- **Effort:** S–M.

### R4.13-09 Medium: The Send box says "Initials only… No names" but accepts names and threats (F-136, accepted)
- **Where:** `src/ui.js:2141` (`cbInitials` allows any 1 to 4 letters) and `:2142` (`CB_RUDE_I`).
- **What happens:** "JOHN", "KILL" and "A.B.C.D." pass and are sent. In my run the call was aborted at the browser, so the error was "Couldn't reach the server".
- **Why it's mine:** the copy promises "Initials only, No names", and the game breaks that promise.
- **Rating of the accepted item:** Medium (privacy copy and class safety).
- **Other problems in the box:**
  - The input's accessible name is "Send this to your instructor". The only cue that it wants initials is the placeholder, which disappears on the first keystroke.
  - `maxlength="12"` on a 4-letter field.
  - After a failed Send the report redraws and the focus falls to `BODY`, so a keyboard user loses their place.
  - The small print runs about 120 words at 13.5 px.
- **Fix:**
  - Label it "Your initials (1 to 4 letters)".
  - Set `maxlength` to 8.
  - Restore the focus to `#cbName` or the Send button after a redraw.
  - Block common 4-letter names and words, or limit initials to 3 letters with optional dots.
- **Effort:** S.

### R4.13-10 Low: The replace-saved-shift question is a dialog in name only
- **Where:** `src/ui.js:3121-3128` (`replaceHTML`, `start`).
- **What happens** (all four sizes, `replace.py`):
  - It has `role="alertdialog"` but no `aria-modal` and no focus containment. Tab moves on to the role buttons, Resume and Learn.
  - **Escape does nothing.** It should mean "Keep my shift".
  - It never names the new shift ("Starting a new shift replaces your saved one (…)").
  - It throws the player from Play back to the main menu.
  - The question is never cleared. Opening Play and coming back shows it again for a choice the player has abandoned.
  - The two buttons stack left-aligned at different widths (`shots/390x844_replace.png`).
- **Fix:**
  - Name the new shift ("Start Manic Monday?").
  - Map Escape and Back to Keep.
  - Clear `U.replaceAsk` on `tmenu`.
  - Trap Tab inside the note, or render it in `#modalWrap`.
- **Effort:** S.

### R4.13-11 Low: The "Turn your phone sideways" overlay isn't modal
- **Where:** `#rotate` (`index.template.html:98`). The `.app` is not made inert while it shows.
- **What happens:**
  - Upright on the floor plan, Tab reaches "Use the list board instead", then the wait meter, then the board hidden behind the overlay (Divert, speed, Events).
  - Escape does nothing.
  - The overlay offers no way to the menu (pause or main menu) except switching the board.
  - Orientation's coach card sits under it, still focusable.
- **Fix:**
  - Make `.app` inert while `ROT.matches && U.view === 'map'`.
  - Add a "Menu" button to the overlay.
- **Effort:** S.

### R4.13-12 Low: Lessons sheet copy and kind labels
- **Where:** `src/ui.js:2353-2356`.
- **What happens:**
  - The intro is about 90 words. "**Nine of the first lessons** put you on a patient" is wrong: the nine "On a patient" lessons are spread through the body-system list, not first.
  - "Giving medical direction" (`radio`) is labelled **On a patient**, but it happens on the radio.
  - The blurbs use unglossed jargon in a list meant for lay players: "STEMI alert", "Door to balloon", "the H's and T's", "Massive PE" (next to a spelled-out "Pulmonary embolism").
- **Fix:**
  - Write a two-sentence intro: "Three kinds: on a patient (about 2 minutes), read-through, and case cards (5 cards). Teaching only; not reviewed by a clinician."
  - Add a "On the radio" kind.
  - Gloss the blurbs.
- **Effort:** S.

### R4.13-13 Low: How to play doesn't match the list board or upright layout
- **Where:** `src/ui.js:1555-1593`.
- **What happens:**
  - "The meter **by the zoom buttons**": none on the list board.
  - "The **Beds** chip, **top right**": upright on the list board it is on the left, under the Box bar.
  - "unit secretary (**UC**, **on the left**)": on the list board it is in the intake row.
  - The attending's "Alerts. Time goals: ECG in 10, CT in 25, **needle** in 60, **balloon** in 90": unglossed.
- **Fix:** make these view-aware, as the intake line already is (`fp ? … : …`), and gloss the terms.
- **Effort:** S.

### R4.13-14 Low (fixed during review): Crash card overwrote the good save and wasn't modal (verified fixed at 899b893)
- **At 895bc15 and 76c553f:**
  - Reload's `pagehide` ran `save(true)` after a crash. Scratch `crash2.py`: the stored save went from t=0.6 to the corrupted t=555.5, including the injected broken patient.
  - Tab left the card for the stopped game (Divert, speed, Pause), and `.app` was not inert.
- **At 899b893:** both fixed, matching R3.13-01 and R3.13-03. The save is kept, everything behind the card is inert, and Tab cycles Reload, Copy details, Start over.
- **Still open:**
  - "send them with the class code" doesn't say to whom ("to your instructor").
  - "Start over without the save" is destructive, has no confirmation and looks like Copy details.
  - The card has no dimmed backdrop behind it (`shots/844x390_crash.png`).
- **Effort:** S.

### R4.13-15 Low: Contrast failures
Measured by scratch `contrast.py`:
- ESI 2 badge, white on `#E9761A`: **2.97:1** (14 px). The ESI number is critical information.
- Empty pod jump chips (`.zc.zs-empty`): 3.78:1.
- Dock subtitles "Free" and "Eval 4" at 12 px: 4.42:1.
- The wait meter: 2.9:1 (see R4.13-08).

**Fix:** dark text on the ESI 2 orange (as ESI 3 already has, `style.css:161`), and darken `--ink-3` for the chips and subtitles. **Effort:** S.

### R4.13-16 Low: First-shift card leaves the focus on the page (F-142, accepted; confirmed)
- **What happens:** after "Start the shift" (Enter), `document.activeElement` is `BODY` at 390x844 and 844x390. Rated Low.
- **Fix:** move the focus to `#btnPause` or the first board control when a modal closes and no opener remains (`ui.js:2513-2516`).
- **Effort:** S.

### R4.13-17 Low: Score pills lose their labels whenever a message shows (QA4-7, still present)
- **What happens:**
  - Sideways and at 1280 the strip shows "85% 100% 100% 79%" with no names while any toast is up, and a toast is up most of the time.
  - At 1280 there is plenty of room.
  - The 3D strip uses "Pts/Clin" while the other views use full names.
- **Fix:** keep the labels at widths of 1000 px or more. Use one set of abbreviations, glossed in Words.
- **Effort:** S.

### R4.13-18 Nitpick: Rank line wording
- The report says "Rank: New grad, **3 to** Staff nurse". The menu says "6 **points** to Staff nurse".
- An attending who saw nobody still gets "+4 rank points" (F-134, accepted).
- **Fix:** add "points" in `ui.js:3191`.

### R4.13-19 Nitpick: Layout leftovers
- **Sideways pause menu:** labels are top-aligned inside 42 px buttons, not centred. The ☰ button behind the scrim shows as an empty gold box (`shots/844x390_rn_pause.png`).
- **Translucent sticky header (list board):** rooms ("C2", "C3") and radio-log text show through behind the Beds chip and the jump chips (`shots/360x740_rn_list_bottom.png`).
- **Whiteboard graffiti:** "call ortho!!" and "EVS x4112" show behind the list board's lane headers.
- **1280 floor plan overlaps:**
  - The MD, PA and RN chips cover patient names in rooms 2 and 19 ("…egistering").
  - Chips at the wall overlap "Medic 13".
- **"Code Black":** the app title wraps onto two lines at 360.

### R4.13-20 Nitpick: Unglossed short forms on new or changed surfaces
- "M&M · Your three worst moments" (report).
- "Dx called" (attending HUD).
- "Eval 19" (dock).
- "Lobby" (see R4.13-05).
- Each needs a Words entry or plain text under Plain words.

## 4. What passed
- **Pause menu:** takes the focus, traps Tab, Escape closes it and returns the focus to ☰.
- **Patient sheet:** opened from a room by Enter, it takes the focus, traps Tab, and Escape returns the focus to the room.
- **Layout:** no sideways page scroll at 360, 390, 844 or 1280 on any screen I measured.
- **Fonts:** all computed fonts are Cardo.
- **Rush pace line:** reads clearly. Its numbers match `PACE`.
- **Teaching notice:** present on the patient card, How to play, the report and Lessons.
- **Lessons kind labels:** render on every lesson (32: 9 On a patient, 2 Read-through, 21 Case cards).
- **Send box errors:** empty, a digit and spaced names give the right message with `aria-invalid` set.
- **Crash card (at 899b893):** focus, inert background and Tab cycling all correct.
