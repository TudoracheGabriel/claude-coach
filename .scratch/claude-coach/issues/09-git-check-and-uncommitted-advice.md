# 09: Git check + uncommitted-changes advice

**What to build:** A fast git probe (dirty-file count, cached ~5 s, short timeout, silent outside a repo) and a recommendation to commit first when many files are uncommitted and context is heavy.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Given a real temporary repo with ≥ N dirty files and heavy context, commit advice with the file count is shown.
- [ ] Given a non-repo directory, no git advice and no error.
- [ ] Given repeated runs within the cache window, git is not re-invoked.
- [ ] Given git exceeding the timeout, the run completes without git data.
