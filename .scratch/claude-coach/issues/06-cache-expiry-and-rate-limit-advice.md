# 06: Cache-expiry + rate-limit advice

**What to build:** Two pacing recommendations from stdin data: when the prompt cache is warm and about to expire, "reply within Ns or the next turn costs more"; when the five-hour or weekly rate limit is high, warn with the reset time and suggest lowering effort or using a cheaper model for routine work.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Given a warm cache expiring within ~2 minutes, cache advice with remaining seconds is shown.
- [ ] Given a cold or absent cache, no cache advice.
- [ ] Given five-hour or weekly usage ≥ ~80%, limit advice with the local reset time is shown.
- [ ] Given `rate_limits` absent (non-subscriber), no limit advice and no crash.
- [ ] Covered by Seam A tests with a controlled clock.
