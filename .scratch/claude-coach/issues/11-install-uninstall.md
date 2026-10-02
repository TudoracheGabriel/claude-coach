# 11: install / uninstall

**What to build:** One-command setup on Windows and macOS: `install` backs up the user's settings, sets the status line to the coach and changes nothing else; `uninstall` restores the previous settings exactly. Introduces Seam B (CLI commands against a temporary home folder).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Given existing settings, install creates a backup and only the status line key changes.
- [ ] Given no settings file, install creates one with just the status line.
- [ ] Given install then uninstall, settings are byte-for-byte identical to the original.
- [ ] Works with Windows and macOS path conventions.
- [ ] Covered by Seam B tests.
