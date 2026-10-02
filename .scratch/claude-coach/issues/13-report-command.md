# 13: report command

**What to build:** A local `report` command that reads past transcripts and prints the before/after metrics used to prove value: share of sessions reaching auto-compact, cache-rebuild cost per session, advice-followed rate (suggested command run within 3 turns), and peak context. No network.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Given fixture transcripts and a `--since` date, the report prints all four metrics.
- [ ] Given no transcripts in range, a clear "no data" message.
- [ ] No network calls; reads only local files.
- [ ] Covered by Seam B tests.
