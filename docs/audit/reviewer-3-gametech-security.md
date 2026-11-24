# Reviewer 3: game tech, web app and security

Branch `claude/sleepy-rubin-jot35n`, v0.29.1, working tree clean. Reviewed on Nov 23, 2026.

## 1. Verdict

**No.** The single-player loop runs fine on a phone. The classroom features are what this project is sold on, and they are not safe to put in front of a class. Anyone can write class results to any code under any name, with the shipped public key and no limits. Anyone who has or guesses a code can read every classmate's name and score, and the "instructors" results box is shown to every student. Under that sits a frame loop with no error handling: one exception freezes the shift for good with no message. A lost WebGL context leaves a blank floor. And whether the backend's row-level security even exists can't be checked from this repo. I would not put my name on it until the class-results backend has been redesigned and the failure paths handled.

## 2. Score

**4 / 10.** The client is competent hobbyist work: seeded determinism, delegated input, a CSP with script hashes. The networked classroom layer is built on trust that a public endpoint can't provide, and nothing handles failure.

## 3. Findings (worst first)

### R3-01 · Critical · Anyone can forge, flood or impersonate class results
- **Location:** `src/ui.js:1982-1986` (`CB`, `cbFetch`), `src/ui.js:2386-2396` (`ACT.cbSend`).
- **What's wrong:**
  - The browser posts results straight to `POST /rest/v1/cb_results`, with the publishable key embedded in the page (`sb_publishable___VN24…`).
  - Every field is chosen by the client: `name`, `score`, `stars`, `real_sec`, `stats` (free-form JSON) and `code`.
  - `score` and `stars` come from `R.avg`/`R.care`, computed in the page. `window.OC.G` (the whole game state) and `window.OCUI` ship in production, so the report can be edited before sending.
  - Nothing ties a row to a person, a device or a shift that was actually played.
- **Verified:** I intercepted the request locally (no traffic reached Supabase). It is a plain JSON POST, e.g. `{"ver":"0.29.1","code":"KTA-80P","name":"…","role":"rn","level":"rush","score":90,"stars":3,"real_sec":0,"stats":{…}}`. Replaying it with any values takes one `curl` line. A shift advanced with `OC.step()` sent `real_sec: 0` and full marks.
- **Why it matters:** In a class, one student can post "Instructor" with 100 points and 3 stars, post 5,000 rows to the class code, or post an offensive name that shows up when the instructor projects the results table. The instructor has no delete, no moderation and no way to tell real rows from fake ones. I can't see server-side constraints or rate limits (the schema is not in the repo, see R3-03). Nothing on the client side limits any of this.
- **Fix:**
  - Revoke anon `INSERT` on `cb_results`.
  - Accept results only through a `SECURITY DEFINER` RPC (`cb_submit`) or an Edge Function that:
    - range-checks `score` (0–100), `stars` (0–3), `real_sec` and the name length (1–30, printable characters);
    - rejects `stats` over a small fixed shape;
    - rate-limits per IP and per code;
    - requires a per-class join secret that the instructor's code-creation step registers server-side.
  - Give instructors an owner token, issued when they create the class, that lists and deletes rows.
  - Accept that client scores can always be faked, and say so to instructors in the UI ("scores are self-reported").
- **Effort:** L.

### R3-02 · Critical · Students' names and scores are readable by anyone with, or guessing, a code
- **Location:** `src/ui.js:2000-2016` (`cbListHTML`), `src/ui.js:2398-2402` (`ACT.cbShow` → `rpc/cb_class`), `src/engine.js:25-53` (code layout).
- **What's wrong:**
  - `cb_class(p_code)` returns every row for a code. The code is the only credential, and the instructor gives it to the whole class by design.
  - The "Class results (instructors)" box is drawn inside every player's Class code sheet. Any student can read every classmate's name, score, stars, time played and walkouts.
  - The code space is tiny and enumerable. Each (role, level, scenario, pack) has only 131,072 seeds. The checksum is computed client-side, so `OC.classCode` produces all 131,072 valid default codes (Charge nurse, Manic Monday, no scenario, General pack) in 84 ms in Node (my script `r3/codes.js`). All configurations together give 10,485,760.
  - Codes collide. With a random 17-bit seed, the birthday odds that two instructors using the default setup share a code are 3.7% at 100 instructors, 29% at 300 and 61% at 500. Colliding classes see each other's students.
  - Rows never expire, so last term's class shows under a reused code.
- **Why it matters:** These are student names tied to performance scores, readable by classmates and, with an unthrottled enumeration (about 131k RPCs for the default setup), by anyone on the internet. A nursing school would treat this as an education-records disclosure (FERPA-style).
- **Fix:**
  - Split the student code (join only: write to the class) from an instructor key (read and delete), issued server-side when the class is created and kept on the instructor's device.
  - Have `cb_class` require the instructor key.
  - Remove the results box from the student UI.
  - Store results with a created-at time and delete them after a term.
  - Rate-limit the RPC.
- **Effort:** L.

### R3-03 · High · The backend's security is unverifiable, and it is shared with another app
- **Location:** `src/ui.js:1979-1982` comment, CLAUDE.md "Backend".
- **What's wrong:**
  - The table, RLS policies and the four RPCs (`cb_results`, `cb_class`, `cb_gate_on`, `cb_gate_check`) live only in the Supabase dashboard. There are no migrations, no SQL, and no test that RLS denies anon `SELECT`/`UPDATE`/`DELETE` on `cb_results`.
  - The project and key are shared with the owner's other app, Case Room. Whatever anon access Case Room's tables allow is open to anyone holding this game's key, which is now in every copy of `index.html`.
  - The code comment says the key "can only add a result and read results for a code it names". Nothing in the repo shows that.
- **Why it matters:** One wrong policy in either app exposes both, and no reviewer, CI job or future maintainer can see it. I could not verify RLS at all; the brief puts the backend out of scope for traffic.
- **Fix:**
  - Put the schema, policies and functions in `supabase/migrations/` and review them.
  - Add a CI check (against a local `supabase start`) that anon can't read, update or delete `cb_results` directly.
  - Move this game to its own project or schema.
- **Effort:** M.

### R3-04 · High · One exception anywhere in the loop freezes the game permanently and silently
- **Location:** `src/ui.js:2738-2754` (`frame`). There is no `window.onerror` or `unhandledrejection` handler in `src/`.
- **What's wrong:** `frame()` calls `E.step`, `save`, `ambient` and `render` with no try/catch, and schedules the next `requestAnimationFrame` on its last line. An exception skips that line, so the loop dies.
- **Verified:** I patched `OC.step` to throw once. The clock stuck at 07:04 for good: `U.scene === 'game'`, not paused, no toast, no error screen (`r3/crash.py`, `r3/after_exception.png`). The board stays on screen and looks alive.
- **Why it matters:** The engine is 4,500 untyped lines, plus 2,850 lines of string-built UI. Any edge case a player hits mid-shift becomes a frozen game with no explanation. The last save can be up to 15 s old.
- **Fix:**
  - Call `requestAnimationFrame(frame)` first.
  - Wrap the body in try/catch. On error, save `G` to `oc-crash`, pause, and show a modal ("Something broke. Your shift is saved. Reload"), with Copy details.
  - Add a global `error` handler that does the same.
- **Effort:** S.

### R3-05 · High · A lost WebGL context leaves a blank floor with no recovery
- **Location:** `src3d/map3d.js:727-750` (`OC3D.init`), `src/map.js:520-535` (`use3d`). There is no `webglcontextlost` or `webglcontextrestored` listener in either file.
- **What's wrong and verified:** I forced `WEBGL_lose_context.loseContext()`. The map turned into a flat green rectangle: no rooms, no patients, no taps (`r3/ctxlost.png`). `#map` kept class `three`, so the SVG floor never came back. Only a reload fixes it.
- **Why it matters:** iOS Safari drops WebGL contexts under memory pressure and on backgrounding. 3D is on by default, and the target is phones. A player who switches apps mid-shift can come back to a dead board.
- **Fix:** In `init`, add `R.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); api.fail(); })`. That falls back to the SVG floor. On `webglcontextrestored`, rebuild, or offer 3D again.
- **Effort:** S.

### R3-06 · High · The public site publishes the repo, and this branch would publish CLAUDE.md and these audit reports
- **Location:** `.github/workflows/pages.yml`, `git ls-tree main`.
- **What's wrong:**
  - Today Pages serves the root of `main`: `src/`, `test/`, `tools/`, `art/`, `docs/`, README and `package.json` are all public at `edcodeblack.com/...`, although the repo is "private" (`.nojekyll` means nothing is filtered).
  - `pages.yml` fixes this only after a manual switch, Settings > Pages > Source = "GitHub Actions" (its own header comment). The brief says it isn't active.
  - CLAUDE.md on this branch states as fact that the workflow deploys the site, and that the source, docs and CLAUDE.md "stay off the website". That is unverified.
  - If this branch merges before the switch, `CLAUDE.md` (owner profile, launch SQL, project id) and `docs/audit/*.md`, including this file's exploit recipes, go live on the public site.
- **Why it matters:** It discloses information, and it publishes the attack notes for a backend that is still open.
- **Fix:**
  - Flip the Pages source to GitHub Actions before merging.
  - Add a CI step on `main` that fails if `CLAUDE.md` or `docs/` are reachable at the deployed URL.
  - Until then, keep audit reports off `main`.
- **Effort:** S.

### R3-07 · Medium · The password gate: plaintext shared secret, trivial bypass, and a blank screen on bad networks
- **Location:** `src/ui.js:2799-2820` (`gate`).
- **Verified with a mocked backend** (I routed `edcodeblack.com` and `supabase.co` locally, `r3/gate.py`):
  - The password is stored **in plaintext** in `localStorage['oc-gate']` and re-sent on every load. On `*.github.io` (which `GATED` includes), localStorage is shared by every project page on the owner's account, so any other app there can read the password.
  - **Bypass:** set `oc-gate` to any string and block `supabase.co`, and `.catch(open)` lets you in (case `kept_offline_bypass`: title shown, gate gone).
  - **Hang:** an authorized device on a network that hangs (captive portal, hospital Wi-Fi) shows an **empty overlay forever**. `cbFetch` has no timeout, and no form is drawn while the kept password is checked (case `kept_hanging`: `gate: true`, `gateText: ""`, nothing on screen).
  - `cb_gate_check` is an unauthenticated password oracle against a bcrypt hash in a database shared with Case Room. Each guess costs server CPU. I can't see any rate limit.
- **Why it matters:** The owner rejected hardening the gate, and I accept it is going away. But storing a shared password in plaintext, and a blank screen for legitimate testers, are bugs, not hardening.
- **Fix:**
  - Store a server-issued opaque token or a boolean, not the password.
  - Draw the form, or open after a 4 s timeout, while the kept check runs.
  - Add an `AbortController` timeout to `cbFetch` (see R3-14).
- **Effort:** S.

### R3-08 · Medium · A class shift in progress is silently discarded after an update
- **Location:** `src/ui.js:2541` (`readSave`), `sw.js` (network-first, `skipWaiting`, `clients.claim`).
- **What's wrong:**
  - `readSave` drops any class-code save whose `ver` differs from `GAME_V`. That includes every v0.29.0 save, which has no `ver` at all.
  - The service worker is network-first, so any reload while online picks up a new deploy.
  - Phones kill backgrounded tabs all the time. A student mid-shift who comes back after a deploy loses the "Resume your shift" button, with no message. The save is ignored, then overwritten by the next shift.
- **Why it matters:** It is data loss during the exact classroom use case the version-in-code change was meant to protect.
- **Fix:**
  - When `readSave` rejects a save for its version, tell the player ("Your class shift was saved on v0.29.0. The game updated, so it can't be resumed. Ask your instructor for a new code.").
  - Better: keep the build the class started on in the SW cache, and serve it while a class save exists.
- **Effort:** M.

### R3-09 · Medium · Saves have no real versioning; a bad save traps the player
- **Location:** `src/engine.js:4460` (`load(g)` only fills `G.spec`), `src/ui.js:2541-2546`.
- **What's wrong:**
  - `G.v` has been 5 since at least v0.20. Nine releases have added fields with no migration.
  - I made saves with the v0.20, v0.25, v0.26, v0.27, v0.28 and v0.29.0 builds and resumed them on v0.29.1. None crashed in 13 game minutes (`r3/oldsave.py`). That is luck, not design: an old patient object runs under new rules.
  - A malformed save with `G.v === 5` throws in render (`Cannot read properties of undefined (reading 'pxSum')`). The frozen leftover board of the title demo stays on screen (`r3/corrupt_resume.png`). After a reload, "Resume your shift" is offered again, forever.
- **Fix:**
  - Bump `G.v` whenever `G`'s shape changes, and write `migrate(G)` steps.
  - Wrap `E.load` plus the first render in try/catch. On failure, delete `oc-save` and toast "Your saved shift couldn't be opened".
- **Effort:** M.

### R3-10 · Medium · The service worker hangs on slow networks and doesn't cover what the game needs offline
- **Location:** `build.js:35-46` (generated `sw.js`).
- **What's wrong:**
  - **Network-first with no timeout,** for every GET, including the 962 KB page. When the network hangs instead of failing, the app doesn't open until the browser gives up. "Plays offline" only works when the device knows it is offline.
  - **The precache list** is `./`, `index.html`, the manifest and three icons. The 3D floor (`3d/map3d.js` plus about 4.2 MB of `.glb` files) and the imaging pictures are cached only if they happened to be fetched online. The 3D floor is the default view, so a first offline shift falls back to SVG without saying why.
  - **No versioned URL for `3d/map3d.js`.** An old page plus a new bundle (the HTTP cache, or a deploy between page load and first shift start) mixes two releases' `H3D` interfaces.
  - **No update UX:** `skipWaiting` and `clients.claim` with no "new version, reload" prompt. Combined with R3-08, that loses work.
- **Fix:**
  - Use stale-while-revalidate for the page, or network-first with a 3 s race against the cache.
  - Precache `3d/*` and `img/*` at install, or at least once per version after the first shift.
  - Load `3d/map3d.js?v=<stamp>`.
  - Post a message to the page when a new SW is waiting, and ask before reloading.
- **Effort:** M.

### R3-11 · Medium · The Class code sheet overflows sideways on every phone width
- **Location:** `src/ui.js:1974-1977`. The "Make one" `cc-box` is opened, then `cbListHTML()` and the made-code block are appended, and its `</div>` comes last, so the Class results box is **nested inside** the Make-one box.
- **Verified:** The sheet body's `scrollWidth` is 437 px at 320, 360 and 390 px viewports (`r3/cc.py`). The nested box's right edge is fixed at 437 px. Screenshots `phone-04-class-code-sheet.png` and `phone-07-class-results-empty.png` show the code input, the Start button and the third level button clipped, and the whole sheet scrolled sideways.
- **Why it matters:** The class code screen is the classroom entry point, and it is broken on the target device.
- **Fix:** Close the Make-one box before `cbListHTML()`. Add `min-width: 0` and `overflow-wrap: anywhere` to `.cc-box` children, and a UI test that asserts `scrollWidth <= clientWidth` for every sheet at 320 px.
- **Effort:** S.

### R3-12 · Medium · Keyboard and screen-reader access is broken in the main view
- **Location:** `src/map.js` (8 `<g role="button">` templates, 0 `tabindex` in the codebase), `src/index.template.html:83-84` (dialogs), `src/ui.js:2785-2788` (keyboard), `src/style.css:929`.
- **Verified** (`r3/focus.py`):
  - The floor plan has 80 `[data-act]` targets and **0 keyboard-focusable** ones.
  - On the title screen, Tab goes to the **hidden game HUD behind the menu** ("Divert", "1×", the bell, "83% Patients"…), not the menu.
  - Opening the first-shift modal or a patient sheet doesn't move focus into it (it stayed on `#pClin`). Tab from inside an `aria-modal` sheet left the sheet ("Trauma", outside `#sheetWrap`).
  - `morph()` replaces any top-level section whose markup changed. In one run, a focused sheet button was destroyed within about 1 s and focus fell to `<body>`. A second run kept focus, so it depends on what changes.
- **Also:**
  - Escape doesn't close `U.modal`.
  - `body.ingame { touch-action: pan-x pan-y }` blocks pinch-zoom in a shift.
  - Every font size is a hard `px` value, as small as 10 px, so the browser's text-size setting is ignored.
- **Fix:**
  - Give the title overlay `inert` on `.app` while the menu is up, and `inert` behind sheets and modals.
  - Move focus into dialogs on open and restore it on close.
  - Give map targets `tabindex="0"` plus Enter/Space handling, or document the list board as the accessible view and make it the default when a keyboard is detected.
  - Keep the focused element's identity across `morph` (skip replacing a node that contains `document.activeElement`).
  - Use `rem` font sizes.
- **Effort:** M.

### R3-13 · Medium · Results can be submitted twice, and the retry logic resends on any 400
- **Location:** `src/ui.js:1987-1995` (`cbSendHTML`), `src/ui.js:2386-2396` (`ACT.cbSend`).
- **What's wrong and verified** (`r3/send2.py`, mocked backend):
  - The Send button stays enabled while "Sending…" is shown, and `cbSend` has no in-flight guard.
  - `U.cbSent` lives only in memory. After a reload, "last report" offers Send again, and the same result was posted a **second time** (2 identical POSTs).
  - There is no idempotency key.
  - The fallback resends without `ver` on **any** HTTP 400, not only an unknown column, so a constraint violation is sent twice.
- **Fix:**
  - Disable the button while sending.
  - Persist `sent` with the report (`oc-last-report`).
  - Send a client-generated `uuid` with a unique constraint.
  - Read the PostgREST error code (`PGRST204`) before retrying.
- **Effort:** S.

### R3-14 · Medium · No network call has a timeout
- **Location:** `src/ui.js:1983-1986` (`cbFetch`), used by the gate, Send and Show.
- **What's wrong:** A hanging connection shows "Sending…", "Checking…" or "Loading…" forever, or a blank gate (R3-07). The player never sees the error messages that are already written.
- **Fix:** `AbortSignal.timeout(8000)` on every fetch, falling back to a manual `AbortController` on older Safari.
- **Effort:** S.

### R3-15 · Medium · Privacy disclosure is wrong and incomplete for a school setting
- **Location:** `src/ui.js:2595` (About), `src/ui.js:1992-1993` (Send box).
- **What's wrong:**
  - The text says Send "shares your name and score with that class". In fact it goes to anyone with, or guessing, the code (R3-02), into a database shared with another product, kept forever, with no way to delete it and no contact.
  - The name box has `autocomplete="given-name"`, which invites the browser to fill in a real name.
  - On gated hosts, every page load calls Supabase (`cb_gate_on` or `cb_gate_check`), which logs the visitor's IP and user agent. That isn't mentioned.
  - The plaintext gate password sits in localStorage (R3-07).
  - Nothing says who controls the data.
- **Why it matters:** An instructor can't truthfully tell students or a program director where their names go. That will block adoption at schools.
- **Fix:**
  - Rewrite the Privacy section: what is sent, to whom, who can read it, how long it is kept, how to get it deleted, and a contact.
  - Set `autocomplete="off"` on the name box.
  - Add a retention job on `cb_results`.
- **Effort:** S (text), M (retention).

### R3-16 · Low · Render cost: a full redraw every 110 ms, including behind the menu and for hidden views
- **Location:** `src/ui.js:2738-2754`, `src/ui.js:255-275`.
- **What's wrong:**
  - `render()` runs unconditionally at about 9 Hz in every scene. On the title screen, a demo shift also steps the engine and runs `botStep` twice a second.
  - In map view, `renderBoard` and `renderLanes` still build the hidden list board.
  - Every render forces layout (`offsetHeight`, `getComputedStyle`) to set CSS variables.
- **Measured** (desktop CPU, `r3/perf.py`): 2.4–9.2 ms per render, and 1,560–2,980 DOM nodes over a shift. Under 4× CPU throttle at 4× game speed, the 2D floor held 52–58 fps with a few 50–130 ms long tasks per 10 s (`r3/perf2.py`). So it plays, but it drains battery doing nothing behind a menu.
- **Fix:**
  - Pause the demo and the render cadence when the page isn't visible or the title isn't animating.
  - Skip hidden views.
  - Set `--topH` and `--dockH` from a `ResizeObserver` instead of on every frame.
- **Effort:** M.

### R3-17 · Low · The 3D floor is heavy for "battery saver"
- **Location:** `src3d/map3d.js`.
- **Measured:** At quality `low`, a shift's first frame is 720,213 triangles and 361 draw calls (`OC3D.info()`). Starting a shift downloads 4.23 MB of 3D assets (bundle plus about 30 `.glb` files). `layout.json` is requested twice (a HEAD probe, then a GET, at `src3d/map3d.js:44` and `:162`).
- **Fix:**
  - Merge the static room meshes (instancing or `BatchedMesh`).
  - Load the people models lazily, by who is on shift.
  - Drop the HEAD probe.
- **Effort:** M.

### R3-18 · Low · The save grows without limit and is serialized on the main thread
- **Location:** `src/ui.js:2532-2539`.
- **Measured:** `JSON.stringify({G})` grows linearly from 25–45 KB to 208–224 KB by 19:00. `G.pts` is 189–208 KB of that, because departed patients are never pruned. It runs every 15 s and on `pagehide`. That costs about 0.8 ms for 67 KB at 4× throttle, so about 3 ms at the end of a shift. Not a problem today, and it gets worse with every field added.
- **Fix:** Move departed patients' report data into a compact `G.done` summary and drop their full objects.
- **Effort:** M.

### R3-19 · Low · Production ships test and cheat hooks
- **Location:** `src/engine.js:4460` (`OC`, 215 members, including `G`, `load`, `step`, `litAdd`, `botStep`), the end of `src/ui.js` (`window.OCUI` with `U`, `start`, camera and coach internals).
- **Why it matters:** Any student can open the console and run `OC.botStep` for a perfect shift, or edit `OC.G`. It is irrelevant offline, and it feeds R3-01 online.
- **Fix:** Expose `OC` and `OCUI` only when `?test=1` or under `file://`/localhost.
- **Effort:** S.

### R3-20 · Low · CSP limits
- **Location:** `build.js:31-34`, `src/index.template.html:5`.
- **What's wrong:**
  - The CSP is a `<meta>`, so `frame-ancestors` can't be set. GitHub Pages sends no `X-Frame-Options`, so any site can frame the game, including the gate's password form.
  - `style-src 'unsafe-inline'`.
  - `esc()` (`src/ui.js:12`) doesn't escape `'`. I found no single-quoted attribute sinks today, so it is a trap rather than a hole.
  - The About credit links put `credits.json` URLs into `href` with no scheme check (`src/ui.js:2589`). The data is build-time, and the CSP blocks `javascript:`, so the risk is low.
- **Fix:**
  - A frame-busting check (`if (top !== self)` show a "open in its own tab" card) until a host with headers is used.
  - Escape `'` in `esc`.
  - Allow only `https:` in credit URLs at build time.
- **Effort:** S.

### R3-21 · Low · The bundle isn't minified, and the fonts can't be cached
- **Location:** `build.js`.
- **What's wrong:** 813 KB of unminified engine and UI with every comment (340 KB gzipped for the page). 72 KB of base64 Cardo is re-downloaded with every release, because it is inlined into the HTML that changes every release.
- **Fix:** Minify the two inline scripts with esbuild (already a dependency). Serve the fonts as separate cache-forever files and precache them in the SW.
- **Effort:** S.

### R3-22 · Low · The PWA manifest is incomplete
- **Location:** `manifest.webmanifest`, `src/ui.js:2833-2836`.
- **What's wrong:**
  - No `id`, no `description`, no `purpose: "maskable"` icon (Android crops the icon).
  - `display: "fullscreen"` with no `display_override` fallback.
  - The manifest, apple-touch-icon and favicon `<link>`s are injected by JS after boot instead of being in the HTML, so crawlers, link previews and anything that doesn't run JS see no icon.
- **Fix:** Put the links in the template. Add `id`, `description` and a maskable 512 icon.
- **Effort:** S.

### R3-23 · Low · Time steps clamp silently on slow devices
- **Location:** `src/ui.js:2739`.
- **What's wrong:** `dt` is capped at 0.25 s per frame. Below 4 fps, game time and the "real time played" figure sent to the instructor both run slow, with no indication. A frame-loop stall, such as a GC pause or a 3D shader compile, steals time from the shift.
- **Fix:** Carry over the excess `dt` up to a cap (an accumulator), or pause and say so.
- **Effort:** S.

### R3-24 · Nitpick
- Dead hosting code ships to production: `window.claude.hot` snapshot and ready hooks (`src/ui.js:2844-2848`).
- `cbFetch` sends `Prefer: return=minimal` to RPC calls, where it means nothing.
- `ambient()` and `radioBurst()` use `Math.random()`. That is harmless, but it contradicts the "only for the code seed" rule in the project docs.
- The cache name and storage keys still use the old name (`overcrowded-`, `oc-`). Every storage key is unprefixed by app on a shared origin (R3-07).
- `sw.js` precaches both `./` and `index.html`: two copies of a 1 MB page per version.
- `layout.json` HEAD plus GET (R3-17) is listed here as well because it is also just sloppy.
- `build.js` checks for exactly 2 inline scripts with a regex over the whole HTML. A `<script>` string inside any lesson text would break the CSP hash count.
- `.ghosts` decorative text sits in the DOM for every visitor with `aria-hidden`. That is fine, but it ships inline `style=` attributes the CSP has to allow.

## 4. Coverage

**Read in full or in the relevant parts:**
- `build.js`, `build3d.js`, the generated `sw.js`, `manifest.webmanifest`, `src/index.template.html` and the built head of `index.html`.
- Both workflows and `package.json`.
- `src/ui.js`: loop, save and resume, bind and input, gate, class codes and results, About, report.
- The `src/engine.js` header (RNG, class codes, streams) and the `OC` export.
- `src/map.js`: the 3D loader and `mapRender` entry.
- `src3d/map3d.js`: init, frame loop, quality, input, public API.

**Ran, all locally with the backend mocked or blocked** (scripts in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/r3/`):
- A rebuild in a scratch copy: byte-identical outputs.
- `npm test` in the scratch copy: 528 ok, 0 FAIL.
- Load, render and heap measurements across a 12-hour shift in both roles.
- Real-time play under 4× CPU throttle.
- Exception injection, a corrupted save, and resuming saves from six older releases.
- The gate under four network conditions.
- Class-result send and duplicate send.
- Code-space enumeration and collision math.
- Keyboard and focus probes, phone-width overflow of the class sheet.
- The 3D floor under SwiftShader: draw calls, triangles, list view, forced context loss.
- Screenshots `phone-01`, `phone-04` and `phone-07` reviewed.

**Couldn't check:**
- **The Supabase schema, RLS, rate limits and RPC bodies:** not in the repo, and traffic to the project is off-limits. Every backend claim above is from client code; R3-01 and R3-02 assume no server-side checks, because none are visible.
- **Whether the Pages source has been switched to GitHub Actions.**
- **Real iOS or Android devices, real GPU 3D performance, long-session 3D memory.** Only SwiftShader, briefly.
- **The live site's response headers.**
- **WebKit and Firefox.**
- **A full lesson sweep.**

**Network incident during my run:** one early Playwright run used page-level routing while the page's service worker was active. The browser then tried to connect to `ecpxhcqvgxizdadwumqt.supabase.co` and `edcodeblack.com`, and the container's egress proxy refused both (HTTP 403), so nothing reached either host. All later runs blocked service workers and routed at the context level.

## 5. What I'd grudgingly keep

- The seeded RNG with separate arrival, EMS and event streams, so a class code reproduces the shift.
- One JSON-safe `G` object as the whole state.
- The build stops if the engine fails to load, if a script doesn't parse, or if the inline-script count is wrong. CI checks that the committed build matches the source.
- A hash-based CSP that blocks inline handlers, so the escaped HTML strings have a second line of defence.
- `esc()` applied consistently to database-sourced fields, with numbers coerced in `cbListHTML`.
- Saving on `visibilitychange` and `pagehide`, with pause on hide.
- The 3D renderer stops drawing when its container has no size (measured: 0 draw calls in list view).
