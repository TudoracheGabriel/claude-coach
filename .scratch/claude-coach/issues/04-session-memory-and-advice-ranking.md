# 04: Session memory + choosing the advice

**What to build:** Per-session state in the user's home folder (keyed by `session_id`, atomic writes) and a ranker that, when several detectors propose advice, shows only the most urgent one — without flickering near thresholds (separate enter/exit levels) and without repeating advice the user just acted on (cooldown). Parallel sessions never interfere; state older than 7 days is cleaned up.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Given two proposals, only the higher-urgency one is shown, with its reason.
- [ ] Given repeated runs with a value oscillating just around the threshold, the advice does not toggle on/off.
- [ ] Given advice X was shown and its condition cleared (user acted), when the condition returns within the cooldown, X is not shown again.
- [ ] Given two different `session_id`s sharing one home folder, each run uses only its own state.
- [ ] Given state files older than 7 days, they are deleted on a run.
- [ ] All verified through repeated Seam A runs against the same temporary home folder with an advancing clock.
