# 02: Real-data hardening

**What to build:** A debug-capture switch that saves the real stdin payload and a transcript tail (prompt text scrubbed) to a fixtures folder, so tests run against real Claude Code data from Windows and macOS. Uses the findings to harden input handling, and records which surfaces render the status line and how fast Node starts.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] With capture enabled, a real session produces a stdin fixture and a scrubbed transcript-tail fixture; no raw prompt text is stored.
- [ ] Seam A tests re-run green against the captured real fixtures (Windows; macOS when available).
- [ ] Any missing/null field seen in real data is handled without crashing.
- [ ] Node cold start on Windows measured and recorded; within the 100 ms budget or a mitigation is noted.
- [ ] Surfaces checked and documented: terminal CLI, an IDE terminal, desktop Code tab.
