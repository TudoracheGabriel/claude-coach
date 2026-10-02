# 12: Keep the user's existing status line

**What to build:** If the user already had a status line, install stores its command; on each run the coach executes it with the same stdin (≈150 ms timeout), prints its output first, then the advice. If it's too slow, its output is skipped and the advice still appears. Uninstall restores it.

**Blocked by:** 11

**Status:** ready-for-agent

- [ ] Given a previous command, install stores it and the coach prints its output above the advice.
- [ ] Given a previous command exceeding the timeout, its output is skipped and advice still prints.
- [ ] Given uninstall, the previous command is restored as the status line.
- [ ] Covered by Seam A (wrapped output) and Seam B (install/uninstall) tests.
