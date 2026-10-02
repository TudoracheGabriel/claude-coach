# 08: Topic-switch advice

**What to build:** Detect when the latest prompt starts an unrelated task — low overlap between its files/keywords and the session's rolling working set (paths, directories, top keywords) — and, above a context floor, recommend `/clear` before continuing.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Given a new prompt touching unrelated files and terms with context above the floor, /clear advice is shown.
- [ ] Given a rephrased prompt on the same files/terms, no topic-switch advice.
- [ ] Given context below the floor, no topic-switch advice (switching is cheap then).
- [ ] Only keywords and paths are stored, never raw prompt text.
- [ ] Covered by Seam A tests with transcript fixtures.
