# 07: Delegate-to-subagent advice

**What to build:** When the main session has made many file read/search tool calls over recent turns, recommend delegating exploration to a subagent so the main context stays focused.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Given ≥ N read/search tool calls in the main context over the last K turns, delegate advice is shown with the count.
- [ ] Given tool calls inside subagents (sidechains), they are not counted.
- [ ] Given mostly edit/write activity, no delegate advice.
- [ ] Covered by Seam A tests with transcript fixtures.
