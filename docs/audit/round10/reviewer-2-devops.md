# Reviewer 2, round 10: DevOps, tooling, CI and legal

Branch `claude/sleepy-rubin-jot35n` at `1ab6fa9` (v0.31.0). Reviewing the round-9 fixes (`git diff 0541eeb..1ab6fa9 -- src supabase test tools .github build.js package.json CLAUDE.md README.md docs/SMOKE.md`) and the second migration as the owner will paste it. Nov 25, 2026.

(Work in progress: this file is updated as the review goes.)

## Notes so far

- Migration 2 SHA-256 `37efafd6101cf750dead06f029c105a9f4aaf900c6942d54a3e890deeb8224d4`, 0 non-ASCII bytes, 0 CRs. Committed fingerprint `dcd21130a3b2c81b54b6a02804585d75`.
- R2.9-05a (`run.sh:38` greedy `sed`) is untouched.
- The runbook (`supabase/README.md:58`) says re-pasting the newest migration "re-creates every function": it does not re-create `norm_code`, `norm_key`, `key_hash`, `keyed_class` (migration 1 only).
- About and the Send box list "how quickly the sickest patients were seen": no such number is sent.
