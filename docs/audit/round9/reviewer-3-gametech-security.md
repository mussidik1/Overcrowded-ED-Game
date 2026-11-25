# Reviewer 3, round 9: game tech, security and privacy (the round-8 fixes)

Branch `claude/sleepy-rubin-jot35n`, v0.31.0, reviewed at `ba471b7`. Under review: `git diff 87c9c13..ba471b7 -- src supabase test tools .github build.js package.json CLAUDE.md README.md docs/SMOKE.md`, and the second migration `supabase/migrations/20261125120000_codeblack_round6.sql` as the owner will paste it (not live yet). Reviewed Nov 25, 2026.

I exported `ba471b7` with `git archive` into scratch and tested only that copy. Nothing here touched the live project, supabase.co or edcodeblack.com.

**How I tested.**
- **Database:** two throwaway PostgreSQL 16.15 clusters (one `en_US.UTF-8`, one `C`), each loaded in order: stubs, baseline, migration 1, migration 2.
- **Shipped suites, on the exported copy:** `npm run db:test` passed (210 ok, fingerprint matched). `npm test` passed (709 ok). `test/class_test.py` passed (95 ok).
- **Client:** the committed `index.html` in Chrome 153, through Playwright for Python, with every `**/rest/v1/**` call stubbed, held or aborted.
- **Scratch:** `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round9/r3/` holds:
  - `db/`: the SQL (`exhaust.sql`, `fullclaim.sql`, `perf*.sql`, the `clean_name_*.sql` pair);
  - `names/`: the name sweep;
  - `ui/`: the `probe*.py` scripts and their `.txt` output;
  - `shots/`: the screenshots.

## 0. Round-8 status

| Item | Status | Evidence |
|---|---|---|
| R3.8-01 "Use it without results" could be forced (busy, full), then the code claimed | **Partly fixed** | Busy no longer offers it (`probe1` C0). The off text now says "whoever registers this code first gets what students send". Invalid calls don't count, and "taken" comes before "full". But "full" and every HTTP status still offer it, and "full" clears with each expiry (R3.9-02). |
| R3.8-02 held codes counted against the backstop; `cb_health` 150× dearer | **Fixed, but the fix opens R3.9-01** | The backstop counts only live classes. With 100,000 live and 214,000 held, `cb_health` takes 6–8 ms, against 133–190 ms in round 8. `health48` exists. But held codes now have no cap and no monitor (R3.9-01), and `overdue` isn't indexed once results are large (R3.9-04). |
| R3.8-03 the key box drops focus when its class changes | **Still open** | `probe2` K1–K2: Show on, wrong key, Enter. Focus goes to `BODY` and the next letter is lost. `morphSame` is unchanged. STATUS doesn't mention it. |
| R3.8-04 row and screen disagree | **Partly fixed** | The `ok` half is fixed (`class_test`). The `taken` half is still open (`probe1` A2, `a2-row-taken-made-shareable.png`): the row says "Another class has 630-84H". The box above isn't struck through, keeps Copy and Play, and still says "Try again sets results up for this same code". Copy puts the code on the clipboard (A3), and the key stays stored. |
| R3.8-05 the focus hand-off picks the wrong button | **Partly fixed** | Refresh keeps focus (`probe2` R1). The row's Set up results still drops focus to `BODY` while saving and after the answer (`probe3` R2–R3): its replacement is disabled. |
| R3.8-06 the key was forgotten as the class ended | **Fixed** | `CB_KEEP` is 60 days. Keys 35 and 50 days old are listed, and Turn results back on is reachable (`probe3` E, E2). R3.9-05 covers the row's wording. |
| R3.8-07 Forget overwrites the clipboard | **Still open** | `keyForgetGo` (ui.js 2682) still does `copyText(' ')`. STATUS only narrows the claim. |
| R3.8-08 a key pasted into Play a code shows half of it | **Still open** | `probe2` P1: the box shows `ABCD-EFGH`. STATUS doesn't mention it. |
| R3.8-09 nitpicks | **Partly fixed** | Fixed: 1 (comment), 3 ("live classes"), 6 (an own retry isn't `full`), 7 (the watch says "about half"), 11 (the watch opens an issue). Partly fixed: 2 (`CLAUDE.md` only). Still open: 4, 5, 8, 9, 10. |

**Totals:** 2 fixed, 4 partly fixed, 3 still open, 0 worse. One fix (R3.8-02) creates a new Medium, R3.9-01.

**STATUS overclaims:**
- "Use it without results … when class results are full (then nobody can register a code)" is false. A slot opens with every expiry (R3.9-02).
- "a stale or edited paste can't pass" overstates the fingerprint (R3.9-03).
- "a class past its end says 'class ended' with Turn results back on" is half right. The row offers Results until a read is refused (R3.9-05).
- `overdue` "counted from indexes" holds only while `results` is small (R3.9-04).
- R3.8-03, R3.8-08, the `taken` half of R3.8-04 and the disabled half of R3.8-05 are neither fixed nor listed under "left, with the reason".

## 1. Verdict

**Not ready to paste the migration as it stands. There are no Critical or High findings, but there is one new Medium on the server side, and it is cheapest to fix before the migration is frozen.**

- **R3.9-01 (availability, Medium).** Round 8 took held codes out of the backstop and gave them no cap and no monitor. So an attacker can now take every code of a setup, all 131,072 of them, for example charge nurse, Quiet Tuesday, no scenario.
  - The live count stays at 31,073, so `cb_health` reports the classes backstop at 0.3, and nothing is overdue.
  - The deploy and the daily watch see nothing.
  - Every instructor who makes a code for that setup gets "No class code was made. Every code tried was taken", with no way forward.
  - In round 8, held codes counted, so at most 76% of a setup could be taken, about 25% of attempts failed, and the backstop showed full. I ran the whole chain on the local database.

Everything else holds up:
- The busy hijack is closed.
- Held codes behave as designed: nobody can read, delete or send to one, another key gets `taken`, the own key revives an empty class, and the hold ends at 30 days.
- The name rules agree exactly across 15 positions.
- The fingerprint doesn't depend on the database's collation.
- The end-of-shift arrest count can't double-count the no-team death.
- No new template literal is injectable.

What's left on the client is round-8 Lows that STATUS doesn't mention.

## 2. Score

**7 / 10** (round 8: 7). The R3.8-01 fix is real, and so are the held-code rules. But the R3.8-02 fix moved the attack to a quieter place, and four round-8 Lows came back unchanged and unlisted.

## 3. New findings, worst first

### R3.9-01 · Medium · Held codes have no cap and no monitor: one setup's whole code space can be taken, silently, and nobody can make a code for it

**Location:**
- In the migration's `cb_class_new`, line 243: `full` counts only `expires_at > now()`.
- `tidy`, line 210: every ended code is held 30 days.
- `cb_health`, line 382: `classes` counts live rows only, and nothing reports held codes.
- `src/ui.js`, `cbRegister` 2133–2135: five draws, then `st: 'none'`, "Every code tried was taken", with neither Try again nor a fallback.
- `cbDraw` 2119: 17-bit seeds, so 131,072 codes per setup.

**Reproduction** (`db/exhaust.sql`, PostgreSQL 16, about 12 minutes):
1. With the engine, list all 131,072 codes for one setup: `classCode({mode:'rn', level:'easy', scen:'none', pack:'national', seed: 0..131071})`, version 0.31.0. The output is `db/setup_codes.txt`.
2. Day 0: `cb_class_new(code, 'ATTACKERKEY00001', '0.31.0')` for the first 100,000. All 100,000 answer `ok`.
3. Shift every row 15 days back to model time passing. These classes have now ended, unused, and are held.
4. Day 15: register the remaining 31,072. 31,072 answer `ok`, and 0 answer `full`.
5. The state: 131,072 rows, 31,072 live, `cb_health` `classes` = **0.3**, `overdue` = **0**. Total size 32 MB.
6. An instructor on another address draws five random codes of that setup. All five answer `{"error":"taken"}`. A code of another setup answers `ok`.
7. The client (`probe4`, `t-every-code-taken.png`): five `taken` answers, then "No class code was made. Every code tried was taken. Try again in a minute." There's no Try again, no fallback, and no code.

**Cost:**
- About 131,072 registrations: 655 IPv4 address-days at 200 a day, or 131 IPv6 /48-days at 1,000 a day.
- Each call is under 1 KB, so a rotating residential proxy covers it for a few dollars.
- Keeping it up takes about 131,072 every 44 days, roughly 3,000 a day: 15 IPv4 addresses, or 3 /48s.
- Over 44 days the table holds about 100,000 live and 214,000 held codes, enough to blank about two setups completely.

**Why it's new:** at `87c9c13`, every row counted against `reltuples > 100000`. So at most 100,000 of a setup's 131,072 codes could be taken (76%): 0.76⁵, about 25% of attempts failed, and everyone else saw `full`, which the watch reports. Now attempts fail 100% of the time, and no alarm fires.

**Fix (pick one or combine):**
1. Count every row, live and held, against one backstop. If the hold must stay, cap held codes separately (for example 30,000), and when the cap is reached, delete the oldest held codes instead of holding new ones.
2. Hold only codes whose class received a result. An unused code has nothing to take over, and the hold was added for planned, posted codes, which students will send to. Junk codes would then end at day 14, and covering a setup would need one result per code, which also fills the visible results backstop.
3. Either way, add `held` to `cb_health`, and have the watch fail when it passes a threshold. Make `taken` count on its own bucket per network, so a run of `taken` answers shows up.
4. Client: after five `taken` answers, say plainly that this setup's codes are unavailable right now and to pick another shift or scenario. Don't offer the fallback: the code belongs to someone else.

**Effort:** S–M.

### R3.9-02 · Low · "Use it without results" is still offered for failures other people can cause: `full` clears with each expiry, and every HTTP status counts as "unreachable"

**Location:**
- `src/ui.js` 2037: the button shows when `R.net || R.full`.
- 2141: the `catch` sets `net: true` for every rejection, including `fail('http', status)` and `fail('bad')`.
- `codeNoRes` 2654–2657: the comment says "the server couldn't be reached".
- In the migration, line 243: `full` holds only while `count(live) > 100000`.

**Reproduction:**
- **Full** (`db/fullclaim.sql`):
  1. With 100,002 live classes, the instructor (`203.0.113.50`) gets `{"error":"full"}` for `TCH-002`. The game offers the fallback, and the code goes on the projector.
  2. The two soonest classes reach their end, leaving 100,000 live.
  3. An attacker (`198.51.100.9`) registers `TCH-002` and gets `ok`.
  4. A classmate's `cb_submit(... 'Maria G.' ...)` answers `ok`.
  5. The attacker's `cb_class_read` returns `Maria G., score 81`.
  6. The instructor's Try again answers `taken`. The client then strikes the code through, but only once tapped.

  Under a sustained fill, a slot opens with every expiry, and whoever is polling the projected code gets it, usually the one who filled.
- **HTTP** (`probe1` B, C):
  - A stubbed 500, 429, 400 or 404 from `cb_class_new` each shows "Use it without results". A 429 reads "The server had a problem".
  - Busy, then Try again answered 503, offers it for the same code.
  - `class_test.py` writes a 503 into the plan as a fallback case.

**Impact:**
- A 429 or 503 from the platform in front of the database (rate limiting, DDoS protection) is the same kind of answer as `busy`, which round 8 removed because a classmate can cause it.
- I couldn't test whether the Supabase or Cloudflare front end will 429 a single abusive address, so this half is by reading.
- The off text now warns plainly, which is why this is Low.

**Fix:**
- Set `net` only for `kind === 'network' || kind === 'timeout'`. Show HTTP errors as server errors, without the fallback, and treat a 429 as busy.
- For `full`, say that the code can be claimed by anyone once results free up.
- Correct STATUS ("nobody can register a code").
- The robust fix remains a "results off" code variant (round 8, R3.8-01, option 4).

**Effort:** S.

### R3.9-03 · Low · The fingerprint ignores whitespace inside string literals and everything but function text: an edited paste can pass

**Location:** `codeblack.fingerprint()`, migration lines 345–355:
- It hashes `regexp_replace(prosrc, '\s+', '', 'g')`, `regprocedure`, `proconfig` and `prosecdef` only.
- `test/db_live.js` treats a match as "exactly what the repo's migrations make".

**Reproduction** (`db/clean_name_*.sql`, en cluster):
1. Take `pg_get_functiondef('codeblack.clean_name(text)')` and change `'\s+', ' ', 'g'` to `'\s+', '', 'g'` (one space inside a literal). The two definitions are identical once whitespace is removed.
2. Apply it. `fingerprint()` stays `ba875605562fd90e2834ae94141f2373`, but `clean_name('Maria G')` now returns `MariaG`.
3. Restore it, and the fingerprint is unchanged again.

The same blindness covers:
- the word-separator space in the name regex `( [[:alpha:]]…`, and `'(^| )['`;
- return types (`regprocedure` has none), volatility and strictness;
- grants, tables, check constraints (`rate_kind_check` with `health48`, `results_stats_check`), indexes and the cron job.

**Checked and fine:** the ordering is collation-independent. Catalog `prosrc` is `COLLATE "C"`, which wins over the database default, so `C` and `en_US.UTF-8` clusters agree.

**Fix:**
- Normalise only line endings and trailing blanks: `regexp_replace(prosrc, '[ \t]*\r?\n', E'\n', 'g')`.
- Add `prorettype::regtype`, `provolatile`, `proisstrict` and `proacl`.
- Add a second hash over `pg_get_constraintdef` and `pg_get_indexdef` for the `codeblack` tables, and over `cron.job` where `jobname = 'codeblack-tidy'`.
- Or narrow the STATUS claim to "functions' text, signatures and settings".

**Effort:** S.

### R3.9-04 · Low · With a large `results` table, `overdue` is two parallel sequential scans, and every registration merge-joins all results

**Location:**
- `cb_health`, lines 376–378: the comment says "indexed counts over held codes only, not one scan".
- `cb_class_new`, line 237: the clean-up `exists (select 1 from results …) limit 500`.

**Reproduction** (`db/perf2.sql`, `db/perf3.sql`): 100,000 live classes, 214,000 held (50,000 of them after results) and 300,000 results.
- `cb_health(false)` takes 44–48 ms.
- `EXPLAIN`: a Parallel Seq Scan on `classes` plus a Parallel Hash over all 300,000 results, with 2 workers.
- `cb_class_new` takes 37–47 ms per call. It is a Merge Semi Join reading all 300,000 `results_pkey` entries, even when no ended class has results, which is the normal state after `tidy`.
- With an empty `results`, both take 4–8 ms. Rate limits cap the abuse, hence Low.

**Fix:**
- Keep a `had_results boolean` on `classes`, set by `cb_submit`, with a partial index on `(expires_at) where had_results`.
- Drive both queries from it: `overdue` = held classes past 30 days 2 hours, plus ended `had_results` classes still with a result.

**Effort:** S.

### R3.9-05 · Low · The ended row prints a deletion date it doesn't know, and offers Results, not Turn results back on

**Location:** `src/ui.js` 2194, the `when` branch `K.e < now && K.t + CB_LIFE < now`. `K.e` is updated only on registration and on a successful read (2131, 2668, 2728).

**Reproduction** (`probe3` E):
1. Store a key made 35 days ago whose last known end was day 14.
2. The row says "class ended: **results deleted Nov 4**", with **Results** as its main button.
3. Only after Results answers `key` does it show Turn results back on (E2).

**Impact:**
- If a student sent a result after the instructor's last read, the class ran to day 30 and its results were deleted then. The row's date is up to 16 days early.
- STATUS (R5.8-04) says the row offers Turn results back on, but it takes a refused read first.

**Fix:**
- Say "class ended" without a date when `K.e - K.t < 20 days`, or give the latest possible date (`K.t + 30 days`).
- Show Turn results back on directly once `K.t + CB_LIFE < now`.

**Effort:** S.

### R3.9-06 · Nitpicks
1. **A refused delete always says the class ended.** Any answer that isn't `busy` reads "Nothing was deleted. The class has ended: its results have been deleted." That includes `{"error":"invalid"}` and an empty `{}`, for a live class whose results are still there (`probe3` D). Only `key` marks the key ended.
2. **Validation before limits doesn't help the classroom case.** Server-side `norm_code` checks only the format, so any 6-character string is a valid code. A classmate still spends the network's 60 an hour, or 200 a day, with well-formed junk; the comment "junk calls can't spend a network's limits" holds only for malformed calls. `cb_submit` still counts before it validates, which is inconsistent.
3. **Docs on the fallback.** `supabase/README.md` 32 ("if the server can't be reached at all") and the README v0.31.0 paragraph ("if the server can't") still omit `full`. Only `CLAUDE.md` was updated.
4. **Size estimates.** The README says about 15 MB for live classes and "about 30 MB more" held. I measured 131,073 rows at 32 MB including indexes, about 0.25 KB a row. That puts 100,000 live at about 24 MB and 214,000 held at about 52 MB. Still far under 500 MB.
5. **Legal risk past the firing line.** The end-of-shift arrest penalty can push legal risk past 75 without firing. Two own arrests open at the end, from legal risk 70, give a report with legal risk 99, `fail: null` and 2 stars (`arrest_probe.js`). Mid-shift, the first +15 would have fired the attending. There's no double count with the no-team death: `arrestNoTeam` clears `p.arrest` (case 1: died 1, `arrestOpen` 0, one legal-risk line).
6. **The daily watch's issues.** `db-watch.yml` opens a new issue on every failing day, with no deduplication. It also opens one when checkout or setup fails, with the title "The live database check failed".
7. **`deploy.txt`.** It publishes the private repo's commit SHA and run id on the public site. It's harmless, but it isn't needed: a random nonce would do.
8. **`rules13.js`.** `h0 += OC.G.mm ? 0 : 0` is dead code, and `comp >= 0 && comp <= 20` can barely fail.
9. **Busy in a row.** A row's Set up results answered `busy` shows `CB_BUSY` without the mobile-data advice that the main path got.
10. **Still open from R3.8-09:** a gateway 429 reads "The server had a problem" (4); Copy key copies code and key together (5); a revive racing `tidy` at the boundary (8); the off box ignores `R.saved` (9); `cbNameWhy`'s hidden-character message comes before the word count (10).

## 4. Coverage

**Read:**
- The whole round-8 diff: `ui.js`, `engine.js`, `style.css`, `build.js`, the migration, `run.sh`, `privacy_test.sql`, `client_call.json`, `fingerprint.txt`, `db_live.js`, `pages.yml`, `tests.yml`, `db-watch.yml`, `rules13.js`, `class_test.py` and the docs.
- From `ui.js`: `morph`, `morphSame` and the nth hand-off; `cbRegister`, `codeNoRes`, `codeRegSaved`, the `cbDel` failure path, `cbKeys` with `CB_KEEP`, and `cbListHTML`'s `when` branches.
- From the engine: `endShift`'s `deadHere` and `arrestOpen`, `arrestNoTeam`, `codeOutcome`, `leave` with `tDied`, `litAdd` and `litCheck`.
- Every added template literal. Each server-sourced value goes through `esc()` or `cbNum()`, so there is no XSS.

**Ran on PostgreSQL 16:**
- The fingerprint in a `C` and an `en_US.UTF-8` cluster: identical, and why.
- A whitespace edit inside a literal leaves the fingerprint unchanged.
- `cb_health` and `cb_class_new` timings: empty, 100,000 live plus 214,000 held, and with 300,000 results.
- A forced `full`, cleared by expiry, then the code claimed and a result read.
- Held-code rules: read, delete and submit refused; another key gets `taken`; the own key revives an empty class; `tidy` ends the hold.
- The setup exhaustion above.
- `clean_name` over every code point in 15 positions (new: end of word, Bengali `র` + ZWJ + ch, ch + ZWJ + virama, `র` + ch + ZWJ + virama, doubled characters), compared with the client. The server accepts nothing the client refuses. The client accepts more only for whitespace (it folds that into a space before sending) and for code points unassigned in 15.1.
- All 1,303,789 distinct client outputs through `clean_name`. The 80,801 refused each contain a code point newer than Unicode 15.1.

**Ran in Chrome:**
- The fallback for abort, 500, 429, 400 and 404, and for busy then 503.
- Off, then the row answered `taken`.
- Show plus a wrong key.
- A key pasted into Play a code.
- The Refresh hand-off, and the row's Set up results hand-off.
- Ended rows 35 and 50 days old.
- Refused deletes with `invalid`, `{}` and `key`.
- Five `taken` answers.

**Ran in Node:** the no-team death against `arrestOpen`, and legal risk at the end.

**Couldn't check:**
- The live gateway: whether Supabase or Cloudflare returns 429 or 503 to one abusive address, the live glibc, and the anon `statement_timeout`.
- GitHub Actions itself: the issue the watch opens, and the PostgreSQL 17 job.
- Safari, Firefox and real phones.

## 5. What I'd keep

- **The held-code rules.** They are exactly right: no student data, no read or delete, `taken` for anyone else, an empty revive for the owner, and a clean end at 30 days.
- **The fingerprint idea.** It catches a stale draft, its order can't vary by collation, and `db_live.js` checks it only when the live migration is the repo's newest, so a rollback isn't blocked.
- **Validation before limits, and "taken" before "full".** Both are the right order, even if R3.9-01 and nitpick 2 limit what they buy.
- **The name rule pair.** It is still exact after three new characters, across 15 positions and 1.3 million outputs.
- **The live-only count.** It is an index-only scan with no heap fetches: 15 ms at 100,000 rows.
- **`arrestOpen`.** No double count with the no-team death, and a code card pauses the game, so a code can't be frozen to dodge it.
- **No fallback for busy, and a plain off text.** The round-8 hijack through a classmate's loop is closed.
