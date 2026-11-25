# Round 10: what was fixed (Nov 25, 2026)

Round 10 reviewed the round-9 fixes at `1ab6fa9`. Scores: R1 6, R2 8, R3 6, R4 6, R5 6.5, R6 5. Every Critical, High and
Medium finding (1 High, 16 Medium) was re-run by a second, independent agent; all reproduced. The second migration is still
unapplied, so its fixes went into it directly, and `supabase/tests/fingerprint.json` was regenerated.

## Needs the owner

- **The GitHub checks on `3d`** at this commit (the round-9 commit `1ab6fa9` passed on PostgreSQL 17.12, en_US, with the
  committed fingerprint).
- **Then apply the second migration**, pasted from the green commit; check `select public.cb_health();` shows its name and
  the `fp` in `supabase/tests/fingerprint.json`; add its SHA-256 to `applied.sha256`.

## Fixed

- **Lost codes were all labelled as run well (R6.10-01 High, R5.10-03, R6.10-02).** Only a code run by the book counts as
  "after a code run by the book": every rhythm check right and a doctor there within 3 minutes, or, for a code another doctor
  ran, no delay. A code run with wrong calls or late is a death like any other: an M&M line and +10 legal risk. An own
  patient whose code another doctor ran at once and lost counts as by the book. The list, CSV, summary, verdict, Send box and
  About use the new label.
- **An arrival in cardiac arrest escaped the end-of-shift penalty (R1.10-02, R3.10-02).** Its age counts from the door,
  the same clock as the 20-minute no-team rule.
- **The held-code cap released real codes (R1.10-01, R3.10-01).** Past 30,000 held, the most recently ended go first (a
  flood ends after the real classes it would push out), never the code being registered, and the end is re-checked after
  the row lock, so a class a student just revived stays. `privacy_test.sql` checks a planned code survives a 30,001-code
  flood and its key still turns it back on.
- **The fingerprint would change on PostgreSQL 18 (R1.10-03).** NOT NULL rows in `pg_constraint` are left out (the
  columns already cover them).
- **The planned-code date was blank (R4.10-01, R5.10-02).** The server's date string is parsed first.
- **An unused class past its 14 days was marked ended by one Results check (R5.10-01).** It isn't: a student's first result
  can start it again. Its row offers Results and Turn results back on.
- **Refresh after the class ended dropped the copy on screen (R4.10-02).** Refresh is hidden then.
- **Keyboard focus after confirms (R4.10-03, R3.10-03).** A delete or forget question takes the focus on its Keep button;
  Keep and Escape put it back on the button that asked; Delete puts it on the results heading; Forget on the sheet. It never
  lands on another student's ✕ or another class's Show key.
- **The key box zoomed iOS (R4.10-04).** 16 px; a wide 19-character key still fits at 390 and 360.
- **A server outage left the class with no code (R4.10-05, R5.10-04).** A 5xx offers "Use it without results" again; a 429,
  which a classmate can cause, doesn't.
- **GitHub's Node 20 warning:** checkout v5, setup-node v5, setup-python v6.

## Left, with the reason

- **Lows and nitpicks** (R1 5/1, R2 5/12, R3 6/9, R4 7/18, R5 4/1, R6 3/1) are in the reports; none is a correctness or
  privacy failure. They wait for the next pass.
- **A flood of live classes reads `classes 0.3` until it turns held 14 days later (R1.10-01):** the cap now releases the
  flood first, so the warning gap matters less.
