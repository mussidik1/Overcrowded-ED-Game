# Reviewer 4: UI/UX (senior game UI/UX designer)

Audit of branch `claude/sleepy-rubin-jot35n` (v0.29.1), working tree, Nov 23 2026.
Extra screenshots and scripts: `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/r4/` (called `r4/` below).

## 1. Verdict

**No.** At a professional studio this UI would be sent back before it reached a usability lab. On the target device (a phone) the first screen a tester sees on the live site pushes its only button off the edge. The class-code sheet scrolls sideways and hides the code it just made. Messages cover the clock, the scores and the ringing radio. Most of the state that matters during a shift is printed at 6 to 9.5 px in a serif with a small x-height. Underneath there is a coherent ink-and-paper palette and a real attempt at phone-landscape layout. But the HUD hierarchy, the text sizes, the tap targets, colourblind safety and keyboard access all need a full design pass, not polish.

## 2. Score

**4 / 10.** Below a competent hobbyist on legibility and tap targets, roughly at that level on layout. Basic CSS layout bugs on core screens and a HUD that hides itself mean it can't score higher.

## 3. Findings (worst first)

### R4-01 · High · The password gate on a phone: Play button off-screen, title clipped
- **Where:** `phone-37-gate-cannot-reach-server.png`, `r4/p-gate.png`. `src/style.css:697` (`.gate { display: grid; place-items: center }`) with `.gate-card { width: min(420px, 100%) }`.
- **What:** At 390 px wide I measured the card at 420 px wide, starting at x=47, and the gate's scrollWidth at 514. The **Play** button sits at x=389–467, entirely outside a 390 px viewport. "Code Black" and the instruction and error lines are cut off on the right. The `100%` resolves against an auto grid track that grows to fit the content, so the card never shrinks.
- **Why it matters:** This is the first screen every tester sees on edcodeblack.com from a phone. The only action is invisible, so it works only if the player knows to press Enter or Go.
- **Fix:** `.gate { grid-template-columns: minmax(0, 1fr); }`, or `.gate-card { width: 100%; max-width: 420px; }`.
- **Effort:** S

### R4-02 · High · The Class code sheet overflows sideways on phones
- **Where:** `phone-04/05/06/07-*.png` (content cut on the right in 04/05; the sheet scrolled sideways and cut on the left in 06/07), `r4/p-classcode-made.png`. `src/style.css:1009` `.cc-box { display: grid }` with an implicit `auto` column. `.cc-lv` (`repeat(auto-fill, minmax(130px, 1fr))`) and the nested Class results box force the min-content width.
- **What:** I measured sheet scrollWidth 437 against clientWidth 393. The overflowing elements are the code input, **Start**, the hint line, the level grid, and the whole Class results box (right edges at 409–437 px). The sheet body scrolls horizontally, so a stray swipe shifts the whole form left and cuts off the start of every line ("ss code", "ay a code").
- **Why it matters:** This is the screen an instructor uses in front of a class.
- **Fix:** `.cc-box { grid-template-columns: minmax(0, 1fr); }`, and `overflow-x: hidden` on `.sheet-body` as a backstop. Take the Class results box out of the Make box (see R4-03).
- **Effort:** S

### R4-03 · High · Making a class code gives no visible result
- **Where:** `src/ui.js` `classHTML()` (around line 1976): `cbListHTML()` is rendered before `made`, both inside the "Make one" `.cc-box`. Shown in `phone-06-class-code-made.png` and `r4/pl-classcode-made.png`.
- **What:** After tapping **Manic Monday**, the new code `.cc-code` renders at top=864 on an 851 px tall phone, and at top=678 on a 390 px tall landscape phone. It sits below the instructor's Class results form, which is itself nested inside the Make box. Nothing scrolls, animates or announces it. The only visible change is the results input silently filling with the code.
- **Why it matters:** The instructor taps a shift and nothing seems to happen. That is the core teacher flow.
- **Fix:** Put the made code (with Copy, Share, Play it) directly under the level buttons and call `scrollIntoView` on it. Give it a short highlight. Make Class results its own top-level box, not nested.
- **Effort:** S–M

### R4-04 · High · Toasts cover the HUD, the scores and the ringing radio
- **Where:** `phone-21-rn-busy-midday.png` (clock and scores hidden behind two red toasts), `phone-31-md-radio-ringing.png` ("Medic 3 needs you on the line" and its button fully hidden), `tablet-21-rn-list-board.png`, `desktop-21-rn-list-board.png`, `r4/pl-flat-game.png` (no score pills visible at all on a landscape phone). Code: `src/style.css` `.toasts` (fixed `top: 8px`, `z-index: 100`); `src/ui.js:168–200` (`toastShow`, `msgover`); `body.mapmode .toasts` at `style.css:542`.
- **What:**
  - On the list board, up to two toasts sit on top of the sticky HUD and the Box bar for 3 s each (4.2 s for alerts), queued back to back.
  - On the floor plan, when the strip is narrow (`msgover`, which covers every phone), the message is laid over the four score pills.
  - The code comment says "the five scores … slide left, so the numbers stay on screen". There are four scores, and on a phone they don't stay on screen.
- **Why it matters:** The clock, the scores and the time-limited radio call are the critical HUD. Busy moments produce the most toasts and are exactly when the player needs that HUD.
- **Fix:** Give messages their own lane that never overlaps the HUD or the Box: below the sticky top on the list board, and a slot beside the scores on the floor plan. Hide the brand on narrow strips to make room. Never draw a message over `.boxbar` while the radio is ringing.
- **Effort:** M

### R4-05 · High · Four "waiting" counters on one screen, each with a different number
- **Where:** In my run (`r4/pr-game.png`, list board, 09:00) one screen showed:
  - the zone chip **Wait 6**
  - the lane header "**1 WAITING · 5 AT THE DOOR**"
  - the meter "**17 patients waiting**" (`renderMeter`, `ui.js:2253`)
  - the FAB "**13 Next**" (`ui.js:2245`)

  `tablet-21` shows the same thing: "Wait 19", "0 WAITING · 19 AT THE DOOR", "28 patients waiting" and "11 Next".
- **What:** Four counters with almost the same label count four different things. The meter counts "waiting on you", the FAB counts actionable items, the chip counts people in the waiting room, and the lane counts triaged versus at the door. None of them says what it counts.
- **Why it matters:** A HUD has to be readable at a glance. A player can't tell which number to manage, and a lay person can't learn it.
- **Fix:** Keep one queue number (merge the meter and Next into one control) and relabel the others ("Waiting room 6", "Unseen at door 5").
- **Effort:** M

### R4-06 · High · State-bearing text is far below legible size
- **Where:**
  - `src/style.css:133` `.ist` and `:202` `.tg` (9.5 px: NEEDS REG, NEEDS TRIAGE, NEEDS REPORT, XR/LAB/RX/CT/ECG, ISO), `.atag/.vip/.stat/.crash/.rettag/.mtag` (9.5 px), `.pv` (10 px).
  - Floor plan at 844×390: I measured 82% of SVG text rendering at 9 px or smaller, ESI digits at 8.2 px, and "TRIAGE" and "WAITING" at 7.3–7.8 px (`r4/s13.py`).
  - 3D floor: role tags about 7 px, room numbers and ESI dots about 4–5 px, zone pills about 6 px grey on grey (`r4/crop-3d.png` from `phone-land-20`, and `r4/crop-3d-desk.png`). Even at 1440×900 the 3D labels stay about 9 px (`desktop-20`).
- **What:** Cardo's x-height measured 0.44 em, against 0.53 for Arial. So 9.5 px Cardo reads like about 7.9 px of a UI sans, and the uppercase tags have 6.5 px caps.
- **Why it matters:** These tags carry the work queue: who needs registration, triage, report, which results are back. The owner chose one serif for everything. Its cost is that every size has to go up about 20% to read the same, and nobody made that adjustment.
- **Fix:**
  - Minimum 12 px (Cardo) for any text that carries state, with tags at 11 px and above in bold caps.
  - Replace the two-letter result tags with icons plus a count.
  - In 3D, scale label sprites with zoom and device pixel ratio, with a floor of 11 CSS px.
  - Add a text-size setting (see R4-13).
- **Effort:** M–L

### R4-07 · High · Touch targets well under 44×44 throughout the core loop
- **Where (measured in the running page, `r4/s3.py`, `r4/s4.py`, `r4/s8.py`):**

  | Element | Portrait 390×844 | Landscape 844×390 |
  |---|---|---|
  | HUD Divert, speed, bell, menu | 60/40×36 | 55/36/31/38×31 |
  | Score pills (they are buttons) | 33×30 | 71×31 |
  | Zone jump chips | 38×32 | — |
  | Beds chip | 115×27 | 86×18 |
  | Waiting meter | 89×35 | — |
  | Sheet close | 38×38 | — |
  | Zoom and legend | — | 38×38 |
  | Team | — | 77×34 |
  | Provider tiles in the rail | — | 34 tall (`style.css` `.mapmode.rails .pm` min-height) |
  | Staff on the flat floor | — | **21×21** |
  | Waiting-room patients on the flat floor | — | **17×19** |
  | Hall beds on the flat floor | — | 46×21 |
  | Preceptor buttons | 36 tall | 32 tall |
  | Menu "‹ Back" | 56×32 | — |
  | "How to play" / "About" links | 89/47×31 | — |

- **Why it matters:** The core actions are "tap a staff member, then tap a patient or room". On a sideways phone those targets are 17–21 px, under half the 44 px standard. Mis-taps in a timed game read as the game being unfair.
- **Fix:**
  - 44 px minimum on every HUD and dock control; it fits, because the landscape HUD is 38 px tall and can go to 44.
  - Invisible hit areas of at least 44 px around floor-plan figures and patients, like the `::after` trick already used on `.mzoom`.
  - At current zoom, snap a tap to the nearest actionable figure within about 22 px.
- **Effort:** M

### R4-08 · High · Colour carries meaning that disappears for colourblind players
- **Where:** Deuteranopia simulations `r4/cb-deut-list.png` (from `tablet-21`) and `r4/cb-deut-flat.png`.
- **What:**
  - ESI 2 (orange) and ESI 3 (yellow) badges and room side stripes become the same olive.
  - The order tags `.tg.need` (solid red) and `.tg.done` (solid green) are identical chips, and both become olive. With reduced motion their only other difference, the flash, is removed.
  - Also hue-only: score pill state (`.pill.good/.warn/.bad`), the waiting meter's green-to-red hue, Box *consult* (orange) against *notify* (red), clean (green) against critical (red) room borders, and score-card borders.
  - Registration magenta and APP teal both turn grey.
- **Why it matters:** About 8% of male players can't tell what is done from what is needed. That is the core read of the board.
- **Fix:** Give each state a second channel: shape (outlined for needed, solid with a check for done), an icon, or a pattern. Add a "!" glyph to bad pills. Use a different lamp icon for consult and notify. Offer a colourblind palette setting.
- **Effort:** M

### R4-09 · Medium · Contrast failures from the CSS tokens (WCAG AA 4.5:1)
- **Where:** Computed from `src/style.css` tokens, and confirmed with computed styles in the page (`r4/audit.js`).

  | Element | Ratio |
  |---|---|
  | `--ink-3 #7A8493` on white (sheet `h4`, `.mc-who`, `.packs > span`, `.pk`, `.pr.idle`, `.scard > span`, `.scard small`, `.arr small`, `.qrow span`, `.o-grp`, `.lgh`, `.t-tip`, `.vna`, `.rep h4`) | 3.78 |
  | `--ink-3` on the board (`.ic-l` Register/Triage/Clerk, `.lane-row:empty`) | 3.39 |
  | ESI 2 badge, white on `#E9761A` | 2.97 |
  | ESI 4, white on `#2F9C55` (14 px bold, not "large") | 3.50 |
  | ESI "?", white on `#9AA3AF` | 2.55 |
  | Report stars `.scard > i` `#C99A06` | 2.59 |
  | Report stars `.rep .stars` `#E3A512` | 2.17 |
  | Menu `.lvl .best` (`--warn #C97F06`, the best-score stars) | 3.22 |
  | `--good` on the board ("0/8" zone loads) | 4.44 |
  | Swing-shift staff rows at opacity .62 (`.srow.pending`) | 2.83–3.06 |
  | Gate kicker `#C8243A` on `#1B2230` | 2.86 |

- **Fix:** `--ink-3` to `#5F6876` (about 5.3:1 on white). ESI 2 to `#C25A00` or dark text. ESI 4 to `#23803F`. ESI "?" to `#6B7480`. Stars to `#9A6B00`. Drop the opacity dimming and use `--ink-2` with a "later" tag instead.
- **Effort:** S

### R4-10 · Medium · The main call to action blinks almost all the time
- **Where:** `src/style.css:855` `body.ingame .needbtn.hot { animation: flash 1s infinite }` (opacity down to .35). It is set whenever the top item has priority below 3 (`ui.js:2245`), which is nearly always in a busy shift: the faded Next in `phone-16`, `phone-21`, `tablet-21` and `desktop-21`. At the captured frame I measured the text at **2.65–2.83:1**.
- **What:** It runs alongside the meter's shake (`.wmeter.crit`), the Box button's rock (`nudge`), `.tg.need` flashing, `.zh.zs-none` flashing and `.room.crit` pulsing. On a busy board, five or more things blink at once.
- **Why it matters:** When everything is urgent, nothing reads as urgent. The button that tells you what to do next is unreadable half the time.
- **Fix:** Pulse once when the top item changes, then stay static in solid red. Cap screen-wide urgent animation to one element at a time.
- **Effort:** S

### R4-11 · Medium · Portrait phones hit a blocking "Turn your phone sideways" screen by default, and it is see-through
- **Where:** `src/ui.js:8` (`view: 'map'` default). `src/style.css:772` (`.rotate`, `rgba(27,34,48,.96)`, z-index 120). `phone-13-portrait-turn-sideways-prompt.png` (the first-shift card shows through), `r4/p-orient-portrait.png` (the Orientation preceptor card and "Loading the 3D floor…" show through).
- **What:** A first-time player holding the phone upright taps Learn, then Orientation, and the first thing they get is a full-screen block, before the preceptor has said a word. The same happens on every first shift. The 4% transparency leaves the content behind faintly legible, so the screen looks broken.
- **Fix:** Default to the list board in portrait, and offer the floor plan when the phone turns. Make the overlay opaque. Raise `.modal-wrap` and `.coach` above it, or hide them while it shows.
- **Effort:** S

### R4-12 · Medium · Dialogs fail keyboard and screen-reader basics
- **Where:** `src/index.template.html` (`role="dialog" aria-modal="true"` on the sheet and modal). `src/ui.js:2785` (Escape only clears the selection or sheet). No `.focus()` anywhere except the gate (`ui.js:2809`). Measured with `r4/s7.py` and `r4/s9.py`.
- **What:**
  - Opening the pause menu left focus on the room button behind it ("in modal: false").
  - Tab from an open modal went to a board button behind it.
  - **Esc did not close the modal.**
  - On the title screen the demo board behind the blurred menu isn't inert: 18 tab stops pass through hidden HUD and board buttons before the first menu item. A screen reader reads the whole demo board first.
- **Fix:** Set `inert` on `.app` (and the title) while a sheet, modal, screen or rotate overlay is up. Move focus to the first control on open and restore it on close. Add Esc to close modals that have a safe default.
- **Effort:** M

### R4-13 · Medium · No text scaling: pinch zoom is off in play and every size is in px
- **Where:** `src/style.css:929` `body.ingame { touch-action: pan-x pan-y; }`. Every font size is in px (body at `style.css:25`). There is no text-size setting in Settings or the pause menu.
- **What:** Low-vision players can't pinch-zoom the 9.5 px list-board tags (the floor has its own zoom; the list board has none). Browser text-size preferences don't apply.
- **Fix:** Convert sizes to `rem`. Add a Settings option for text size (100/115/130%). Allow pinch zoom on the list board.
- **Effort:** M

### R4-14 · Medium · Arrival cards sit on the part of the floor you need next
- **Where:** `phone-land-20-rn-busy-midday.png`, `r4/pl-flat-game.png`, `desktop-20-rn-busy-midday.png`. `.arrivals` in `style.css` (bottom left, `pointer-events: none`).
- **What:** Three stacked "New: …" cards cover the door, triage and the waiting chairs. That is where the charge nurse taps a new arrival. Taps go through, but the player taps blind.
- **Fix:** Show arrivals as a one-line ticker in the left rail or in the message lane (R4-04), or as a counter badge on the waiting area. At most one card, kept clear of the triage and waiting zones.
- **Effort:** S–M

### R4-15 · Medium · The "fired" game-over screen gives wrong and contradictory information
- **Where:** `src/ui.js:2677` (`<small>${R.fail ? 'They walked out' : 'Average morale'}</small>`) and `:2707` (`Nothing went badly wrong this shift. Take the win.`). `phone-34-md-fired-game-over.png`, `phone-land-33`.
- **What:** When the attending is fired (`R.fail === 'fired'`), the Staff card still says "They walked out", the copy for a different failure. The M&M section says "Take the win" under the heading "Your group let you go". The score cards keep their green and gold borders and three stars. Nothing about the layout or colour says "failure".
- **Fix:** Use `R.fail === 'staff'` for the walkout text. Suppress the "Take the win" line whenever `R.fail` is set. Give the fail screens a distinct header band and colour, and lead with the cause and the litigation log.
- **Effort:** S

### R4-16 · Medium · The end-of-shift report has a muddled score hierarchy and an orphaned card
- **Where:** `desktop-23`, `phone-land-23`, `phone-24/25`. `style.css:1020` `.scards { repeat(auto-fit, minmax(140px, 1fr)) }`.
- **What:**
  - Four score cards wrap 3 + 1 at the 520 px card width (desktop and landscape), leaving Staff alone on a second row.
  - In a bad shift all four have red borders, so the borders carry no information.
  - Two scoring systems sit side by side with no on-screen explanation of how they relate: percentage cards with stars, then a points ledger where "Wall time −3823" dwarfs every other row (`phone-25`).
  - Zero stars render as hollow ☆ at 2.2–2.6:1, which reads as blank.
  - On a 1440 px screen the report is a 520 px column with the rest of the screen dimmed (`desktop-23`).
- **Fix:** A fixed 2×2 (or 4×1 when wide) grid. One headline result (stars plus a single score), then a breakdown that says how points become percentages. Show zero stars as "0 / 3" text. Widen the report to two columns on desktop.
- **Effort:** M

### R4-17 · Medium · Play a shift: the options come after the button that uses them
- **Where:** `phone-03-menu-play-a-shift.png`, `r4/p-play-bottom.png`. `src/ui.js` `titleHTML()` `U.tm === 'play'` branch.
- **What:**
  - Tapping a level starts the shift at once.
  - The Scenario and Weather pickers sit below the level list, below the fold on a portrait phone (Weather is cut off in `phone-03`), so most players never see them before starting.
  - The segmented controls wrap badly: "Short-staffed" and "Thunderstorms" each sit alone on a full-width second row.
- **Fix:** Put the modifiers above the levels, or have a level tap open a short confirm card with the modifiers and Start. Use a 2-column grid for the segments, or a select on narrow screens (the landscape layout already has one).
- **Effort:** S

### R4-18 · Medium · Layout doesn't adapt well across phone, tablet and desktop
- **Where:** `tablet-14-rn-shift-start.png`, `tablet-27`, `desktop-14`, `desktop-21`, `desktop-27`; `r4/s11.py`.
- **What:**
  - **Phone portrait, list board:** the sticky top is 239 px and the dock 80 px, so **38% of an 844 px screen is fixed chrome** before the Next button and meter float over what's left.
  - **Tablet portrait, floor plan:** the floor is fitted to width, leaving about 60% of the screen as empty grey above and below. The score labels are truncated to "Pati…", "Cl…", "A…" at 820 px.
  - **Desktop 1440:** each score pill is about 235 px wide with a 12 px label, each provider tile in the dock about 330 px wide for "Okafor / Free", and the list board's side panel lists the four providers twice (tiles, then the "Providers (tap a badge…)" list).
- **Fix:**
  - Phone portrait: collapse the brand and the Box into one 44 px bar and hide the zone bar on scroll.
  - Tablet portrait: use a 3D camera framing for portrait, or a vertical floor layout.
  - Desktop: cap pill and tile widths and use the space for a persistent patient-detail panel.
- **Effort:** M

### R4-19 · Medium · Hidden horizontal scrolling with no affordance
- **Where:** `style.css` `.lane-row`, `.zbar`, `.objs`, `.istaff`, `.dock-prov` all set `scrollbar-width: none` / `::-webkit-scrollbar { display: none }`. Shown in `phone-15` ("TRIAGI / IN LINI" cut off, the "D" chip half shown, E/Hall/FT/Chairs off-screen) and `tablet-21` (the fourth ambulance cut off).
- **What:** Nothing shows that more ambulances, waiting patients or zone chips are off to the side.
- **Fix:** Edge fade masks, plus a "+N" count chip at the clipped edge.
- **Effort:** S

### R4-20 · Medium · Mixed art direction, and icon glyphs Cardo doesn't have
- **Where:** `style.css:145–146` (rotated magnets), `.room` asymmetric radii, `.ghosts` graffiti (`index.template.html`), the low-poly 3D floor, OS emoji avatars (👨 👩 👴 in `.m-em` / `.ph-em`). UI symbols: I measured that the embedded Cardo Latin subset is **missing ✕ ▸ ▾ ★ ☆ ✓ → ≥** (`r4/s12.py`), and they fall back to whatever system font each device has.
- **What:** A whiteboard-and-marker 2D layer, realistic low-poly 3D, system emoji faces whose look changes by OS, and close, disclosure, star and check glyphs drawn in random fallback fonts. Nothing ties these together, which is why it reads as a developer build. It also breaks the owner's own "every font is Cardo" rule for every ✕, ★ and ✓.
- **Fix:** One SVG icon set for close, chevrons, stars, checks and the patient avatars (simple tinted silhouettes by age and sex). Either commit to the whiteboard look in 3D labels and chips, or drop the rotation and ghost scribbles.
- **Effort:** M

### R4-21 · Medium · The pause menu is a flat stack of identical buttons
- **Where:** `phone-23-rn-pause-menu.png`. `src/ui.js:2168`.
- **What:**
  - Nine to eleven buttons share one style, with actions (Resume, Restart, Main menu), help, and settings toggles shown as state text ("Sound: on", "Plain words: on", "3D floor: on") mixed together.
  - Resume isn't visually primary.
  - Restart relies on a label change to "Tap again to restart" inside the same-looking button.
  - On phones, toasts stay visible above the modal (`phone-23`: "Missed radio call…" overlaps the menu header).
- **Fix:** Make Resume the large primary button. Put Restart and Main menu in a secondary row, with Restart styled as destructive. Group the settings under a "Settings" heading as real toggles. Clear or hide toasts while paused.
- **Effort:** S

### R4-22 · Low · The score pill grid has five columns for four pills
- **Where:** `style.css:65` `.pills { grid-template-columns: repeat(5, minmax(0, 1fr)) }`. In `phone-15` the fourth pill ends at about 305 px, leaving an empty fifth slot.
- **Fix:** `repeat(4, …)`, and fix the stale "five scores" comments in `ui.js:162` and `style.css:525`.
- **Effort:** S

### R4-23 · Low · Floating controls overlap board content
- **Where:** `phone-15`, `phone-27` and `desktop-21`: the waiting meter sits on R1's label (`renderMeter`, `ui.js:2261`, `r.top + 8, r.left + 8`). The Next FAB covers R4 (`phone-15`) and the "Pod B" header (`desktop-21`).
- **Fix:** Reserve a gutter for floating controls, or dock the meter into the zone bar.
- **Effort:** S

### R4-24 · Low · The lessons list is a 2,247 px scroll with no structure beyond headings
- **Where:** `r4/p-lessons.png`, `r4/p-lessons-bottom.png`.
- **What:** 30 identical buttons with nothing to tell guided lessons from case cards, no length shown, and no progress summary at the top. "Pulmonary embolism" and "Massive PE" sit next to each other with near-identical blurbs.
- **Fix:** Show a progress header (n of 30), a type tag (Guided or Case) and a length on each row, plus a filter by body system.
- **Effort:** S–M

### R4-25 · Low · Toast and preceptor live regions will flood a screen reader
- **Where:** `index.template.html` `#toasts aria-live="polite"` and `#coach aria-live="polite"`. The toast pump fires a message every 1.5 s in a burst (`ui.js:190`).
- **Fix:** Announce only alert and bad messages, and summarise bursts.
- **Effort:** S

### R4-26 · Low · Duplicate text in the Team sheet
- **Where:** `phone-19-rn-team-sheet.png`: "Bea / Triage / Triage" (the zone line and the status line both say Triage).
- **Fix:** Drop the status line when it repeats the assignment.
- **Effort:** S

### R4-27 · Low · Background graffiti sits behind board content
- **Where:** `index.template.html` `.ghosts` ("call ortho!!", "NO hallway beds!!", "rm 6 → 4W ✓"). `style.css:40` (28 px italic, alpha .055). Visible behind the rooms in `phone-31` and `tablet-21`.
- **What:** Decorative text at 1.11:1 runs through room tiles and lane labels. It adds noise exactly where the eye scans.
- **Fix:** Remove it in play, or confine it to the title screen.
- **Effort:** S

### R4-28 · Low · An empty class-results state with no guidance
- **Where:** `src/ui.js` `cbListHTML()`. An empty result shows only "CODE · 0 results".
- **Fix:** "No results yet. Students send theirs from the end-of-shift summary (Send to class)."
- **Effort:** S

### R4-29 · Nitpick · The 500 and 600 font weights don't exist
- **Where:** `build.js:9–11` embeds Cardo 400, 700 and 400 italic only, but the CSS uses `font-weight: 500/600` throughout (`.who`, `.lane-i`, `.zr`, `.toast` 600, `.brand small`, and others). 600 renders as 700 and 500 as 400, so the intended mid-weight level collapses.
- **Fix:** Use only 400 and 700 in the CSS.
- **Effort:** S

### R4-30 · Nitpick · Rotated magnets blur text
- **Where:** `style.css:145–146` (`rotate(-.6deg)` / `rotate(.5deg)` on every waiting-room and bay card).
- **What:** Sub-degree rotation antialiases text on 1× and 2× screens and makes it soft.
- **Fix:** Drop the rotation, or rotate only a background layer.
- **Effort:** S

### R4-31 · Nitpick · The legal-risk call is a modal with one choice
- **Where:** `phone-33-md-legal-risk-admin-call.png`: one button, "Walk them through it".
- **Fix:** Make it a notification with an OK, or give it real choices.
- **Effort:** S

### R4-32 · Nitpick · Tutorial copy is baked into a HUD panel
- **Where:** Every patient card (`phone-17`, `phone-28`): "Experience 85% · no update yet / *how they feel about the visit; an update raises it*".
- **Fix:** Teach it once in Orientation or the legend, not on every card.
- **Effort:** S

### R4-33 · Nitpick · The waiting meter is green at one or two waiting patients
- **Where:** `ui.js:2259` (hue 130 when n ≤ 2).
- **What:** Green reads as "good" while patients are waiting on you.
- **Fix:** Neutral grey at low counts, then amber, then red.
- **Effort:** S

### R4-34 · Nitpick · The disabled Start button is a pale wash
- **Where:** `phone-04` and `phone-05`. The disabled **Start** is the accent colour at opacity .45 (white text measures 2.0–2.5:1), with no reason given beside it beyond the hint line.
- **Fix:** A neutral grey disabled style, with the hint ("Enter all 6 characters") next to the button.
- **Effort:** S

## 4. Coverage

**Reviewed:**
- All of `src/style.css` (1,109 lines).
- The UI-facing parts of `src/ui.js`: toasts, sound, the title and menus, class codes, the pause, first-shift and modal markup, the report, the waiting meter, the Next button, keyboard handling and the gate.
- `src/index.template.html`, and the `src/map.js` text sizes and reduced-motion handling.
- `build.js`, for the embedded font faces.
- Every phone (37) and phone-land (36) audit screenshot, plus the key tablet and desktop screenshots (14, 20, 21, 23, 27, and others).

**Ran the game myself** in headless Chrome at 390×844, 844×390, 820×1180 and 1440×900:
- Measured every visible interactive element's size and computed text contrast across the title, menus, list board, flat floor plan, patient card, Team sheet and pause menu.
- Measured the gate and class-code overflow, made-code placement, rendered SVG text sizes, Cardo's x-height and glyph coverage, focus and Escape behaviour, tab order, and the fixed chrome share on a phone.
- Ran deuteranopia simulations.
- Scripts and shots are in `r4/`.

**Could not check, or checked only partly:**
- **Real devices:** no iOS Safari, Android Chrome or physical touch. Size findings are CSS px from emulation, so real thumbs will do worse, not better.
- **WebKit or Firefox:** not run.
- **Screen reader:** no VoiceOver or NVDA session. The accessibility findings come from DOM, focus and ARIA inspection only.
- **Audio:** I can't listen. Sound feedback was judged from code. All SFX are short synth beeps (`ui.js:125–135`), there is no volume control (on/off only), and `sfx('tap')` is wired to only 5 actions, so most taps are silent.
- **3D floor tap targets:** canvas picks can't be measured from the DOM, so they were judged from screenshots only.
- **The radio modal:** it shows no countdown once answered. I did not confirm whether the game clock pauses during it.

**About the audit screenshots themselves:**
- `*-01-first-visit-about.png` doesn't show the About page, because `showTitle()` skips it when `navigator.webdriver` is true (`ui.js:2602`).
- `*-08` to `*-12` (Learn, Lessons, How to play's background, Words, Settings) all show the main menu, because `audit_shots.py` calls `OCUI.showTitle()`, which resets `U.tm` to `'main'`.
- I recaptured these myself (`r4/p-about.png`, `p-learn.png`, `p-lessons.png`, `p-words.png`, `p-settings.png`, and the `pl-*` equivalents). The lead should not rely on those audit frames.

## 5. What I'd grudgingly keep
- The ink-and-paper colour tokens on `:root`: one palette, applied consistently.
- The phone-landscape side-rail layout (intake left, providers right, floor between): the right structure.
- The order sheet's collapsible category groups with plain-language sublabels.
- The 2×2 diagnosis buttons and the large-button medical-direction choices: big, clear and readable.
- The reduced-motion handling in the CSS and in `map.js` (`NOMOTION`), which stops the walking figures as well as the CSS animations.
- The Words glossary with search: the right tool for a lay audience.
- The aria-labels on the HUD icon buttons and floor-plan targets: a start.
