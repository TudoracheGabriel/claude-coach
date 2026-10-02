# 01: Tracer bullet — one advice end-to-end

**What to build:** The thinnest working coach. Claude Code pipes session JSON to the command; the command prints one plain sentence: a calm "healthy" line when input tokens are below the context-pressure threshold, or "run /compact" advice when above. Wired by hand into `settings.json`, it visibly changes in a real session. Introduces Seam A: the core run function taking stdin JSON + `{ home, now, columns }` and returning the text; the executable is a thin wrapper.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Given stdin with input tokens below threshold, when run, then a single healthy sentence is printed.
- [ ] Given stdin with input tokens at/above threshold (default ≈150k absolute), when run, then a /compact recommendation is printed.
- [ ] Given a 1M-window model at 300k tokens (30%), when run, then the decision uses absolute tokens (advice is /compact, not healthy).
- [ ] Given malformed or empty stdin, when run, then a fallback line is printed and the process exits 0.
- [ ] Given `used_percentage` / `current_usage` null, when run, then no crash and a sensible line is printed.
- [ ] Seam A tests cover all of the above using fixtures built from the documented status line schema; Node built-in test runner, zero deps.
- [ ] README snippet shows the manual `settings.json` wiring; verified once in a real Claude Code session.
