# 05: Incremental transcript reading + context-spike advice

**What to build:** The coach reads the session transcript incrementally (only bytes appended since last run, restarting if the file shrank) and keeps per-prompt token history keyed by `prompt_id`. New advice: when context jumps sharply between consecutive prompts (not between redraws), warn that older details may be handled less sharply and suggest restating key constraints.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Given a transcript appended between runs, only the new part is parsed and results stay correct.
- [ ] Given a transcript that shrank, parsing restarts from the beginning without error.
- [ ] Given a jump ≥ threshold between two `prompt_id`s, spike advice is shown with the size of the jump.
- [ ] Given many redraws within one prompt, no spike advice is triggered by redraws alone.
- [ ] Given a missing transcript file, no crash.
- [ ] Performance: p95 < 100 ms first run on a ~5 MB transcript, < 30 ms incremental.
- [ ] Raw prompt text is never written to state.
