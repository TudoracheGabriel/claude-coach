# 03: Two-line expansion + terminal width

**What to build:** When the advice signals risk (yellow/red), the output expands to two lines: a compact metrics line (model, context tokens, cache, limits as available) and the advice with its "why". Healthy stays a single sentence. All lines fit the terminal width given by `COLUMNS`, with ANSI colour.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Given a healthy session, exactly one line is printed.
- [ ] Given a risk-level advice, two lines are printed: metrics, then advice + why.
- [ ] Given `COLUMNS=60`, no line exceeds 60 visible characters (ANSI codes excluded).
- [ ] Missing metrics (e.g. no rate limits) are omitted from the metrics line, not shown as empty/zero.
- [ ] Covered by Seam A tests.
