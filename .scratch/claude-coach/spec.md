---
title: claude-coach — a Claude Code status line that tells you what to do next
labels: [ready-for-agent]
status: open
created: 2026-10-02
---

## Problem Statement

Claude Code can show context usage, cost, rate limits and prompt-cache state in its status line, but most developers — especially those new to Claude Code — don't know what to *do* with those numbers. "Context: 78%" means nothing actionable to a beginner. As a result they keep working in bloated sessions until answer quality drops and blame the model; start a new task inside a session full of unrelated context; flood the main context with file reads a subagent should have done; let the prompt cache expire mid-thought and pay to rebuild it; and hit their 5-hour rate limit mid-day without warning.

Existing community status lines (ccstatusline, claude-hud, admirito/claude-statusline, hybrid2102/statusline-for-claude-code, ilia-pluzhnikov/claude-code-statusline) are dashboards: they show numbers and at best colour them. None turns several signals into one concrete, explained next step, and none learns from the user's own history.

## Solution

A status line command that reads the session data Claude Code already sends it, plus the session transcript, and prints **one plain-language recommendation** — continue, `/compact` (with what to focus on), `/clear`, start a new session, delegate to a subagent, commit first, reply before the cache expires, or slow down before a rate limit.

- When the session is healthy, it stays quiet: a single short sentence.
- When something needs attention, it expands to two lines: a compact metrics line, then the advice plus *why*.
- It never nags: advice doesn't flicker on and off near thresholds, and advice the user already acted on doesn't come straight back.
- If the user already has a status line, it is kept and the advice is added beneath it.
- It runs entirely locally: no LLM calls, no network, zero tokens, fast enough that Claude Code never cancels it.
- A local `report` command lets a user (or a team trial) measure before/after impact from their own transcripts.

Audience: Pago developers first (internal demo), public open-source release later. Must work on macOS and Windows.

## User Stories

1. As a developer new to Claude Code, I want the status line to tell me in plain words what to do next, so that I don't have to interpret token percentages.
2. As a developer, I want a short, calm message when my session is healthy, so that the status line doesn't distract me when nothing is wrong.
3. As a developer, I want the status line to expand and explain *why* when it recommends an action, so that I trust the advice and learn the underlying practice.
4. As a developer, I want to be told when my context is heavy enough that answer quality is at risk, so that I run `/compact` before quality drops.
5. As a developer, I want the `/compact` recommendation to suggest what to focus the summary on, so that the compaction keeps what matters for my current task.
6. As a developer on a 1M-token context model, I want advice based on absolute token counts and not only on percentage, so that I'm warned at a sensible size rather than at 85% of a huge window.
7. As a developer, I want to be warned when a single step loaded a large amount of context, so that I restate key constraints the model may now handle less sharply.
8. As a developer, I want that spike warning to measure growth per prompt, not per screen redraw, so that it reflects what actually happened in my last turn.
9. As a developer who keeps reading files in the main session, I want to be told to delegate exploration to a subagent, so that my main context stays focused.
10. As a developer who just switched to an unrelated task, I want to be told to `/clear` first, so that leftover context doesn't degrade answers for the new task.
11. As a developer, I want topic-switch detection to be based on which files and terms I'm working with, so that it doesn't fire just because I phrased something differently.
12. As a developer with a warm prompt cache, I want to know when it's about to expire, so that I reply in time and avoid paying to rebuild it.
13. As a Pro/Max subscriber, I want to be warned when I'm near my 5-hour or weekly limit, including when it resets, so that I can lower effort or switch to a cheaper model for routine work.
14. As a developer with many uncommitted changes and a heavy context, I want to be told to commit first, so that I have a safe checkpoint before the next big change.
15. As a developer, I want the advice not to flicker when a value hovers around a threshold, so that the status line feels stable.
16. As a developer who just acted on a recommendation, I want it not to reappear immediately, so that the tool doesn't nag me.
17. As a developer, I want only the single most important recommendation shown, so that I'm never overwhelmed with several warnings at once.
18. As a developer running several Claude Code sessions in parallel, I want each session's advice to be based only on that session, so that sessions don't interfere with each other.
19. As a developer, I want the status line to keep working right after `/compact` or `/clear` and early in a session when some data is missing, so that it never breaks or shows nonsense.
20. As a developer, I want the status line never to show an error or stack trace, so that a bug in the tool never disrupts my work.
21. As a developer, I want the status line to be fast, so that Claude Code never cancels it and my UI never lags.
22. As a developer with a narrow terminal, I want the output to fit my terminal width, so that lines don't wrap into a mess.
23. As a developer who already uses another status line (e.g. ccstatusline), I want to keep it and get the advice added below it, so that I don't lose my dashboard.
24. As a developer whose existing status line is slow, I want the advice still to appear even if that command times out, so that the coach stays reliable.
25. As a developer, I want to install the tool with one command on macOS or Windows, so that setup takes seconds.
26. As a developer, I want the installer to back up my settings and change only the status line setting, so that nothing else in my configuration is touched.
27. As a developer, I want uninstall to restore my previous settings exactly, so that trying the tool is risk-free.
28. As a developer, I want to tune thresholds or switch off individual recommendations in a config file, so that the advice fits how I work.
29. As a privacy-conscious developer, I want the tool to make no network calls and never store my prompt text, so that my code and conversations stay on my machine.
30. As a cost-conscious team lead, I want the tool to use zero LLM tokens, so that it adds no cost.
31. As a developer, I want a `report` command that summarises my past sessions (how often I hit auto-compact, cache-rebuild cost, how often I followed advice), so that I can see whether the coach is helping.
32. As someone pitching this at work, I want before/after numbers from volunteers' local reports, so that I can show real impact without central telemetry.
33. As a skeptical colleague, I want the default thresholds to be backed by cited sources in the README, so that I trust the advice isn't arbitrary.
34. As a developer in a git repository, I want the tool to stay fast even in a large repo, so that git checks never slow the status line.
35. As a developer outside a git repository, I want the git-related advice simply not to appear, so that nothing breaks.
36. As a developer, I want state files from old sessions cleaned up automatically, so that the tool doesn't accumulate clutter.
37. As a future maintainer, I want new recommendations to be addable as independent units, so that extending the coach doesn't require rewriting the decision logic.
38. As a future Pago user, I want the design to allow a team-specific rule pack later (mapping advice to Pago commands and agents), so that the tool can speak our workflow without forking it.

## Implementation Decisions

**Runtime and packaging**
- Node.js (18+), zero runtime dependencies, single entry command. Distributed as an npm package with `npx <name> install` / `uninstall`. Repo lives on the owner's personal GitHub (private first).
- Works on macOS and Windows; all paths resolved through the user's home directory and platform path handling.

**Inputs (verified against Claude Code status line docs, 2026-10-02)**
- Status line runs on session start/resume, each assistant message, `/compact` completion, permission-mode changes, rate-limit resets, prompt-cache expiry, and an optional refresh interval. Updates are debounced at 300 ms, and an in-flight run is **cancelled** when a new update arrives — hence the hard performance budget.
- Fields used: `session_id`, `prompt_id`, `transcript_path`, `model.id`, `effort.level`, `context_window` (`used_percentage`, `context_window_size`, `current_usage`, totals), `exceeds_200k_tokens`, `prompt_cache` (warm, hit ratio, expiry), `rate_limits` (five-hour, seven-day, with reset times), `cost`, `workspace`. `COLUMNS` from the environment for width.
- Must tolerate: `used_percentage` null early in a session; `current_usage` null after `/compact`; `rate_limits` absent for non-subscribers; malformed or empty stdin.

**Modules**
- **Core run** — the single entry seam: takes the stdin JSON plus `{ home, now, columns }`, returns the text to print and persists session state under `home`. The executable is a thin wrapper that reads stdin, calls it, prints, and always exits successfully with a fallback line on any error.
- **Input normaliser** — turns raw stdin into a stable snapshot, resolving nulls, and computing absolute token counts so 200k and 1M windows are handled consistently.
- **Session state store** — one state file per `session_id` under a coach folder in the user's home. Atomic writes. Holds transcript byte offset, rolling aggregates, per-prompt token history, last advice shown, cooldowns, cached git result. Files older than 7 days are garbage-collected.
- **Transcript reader** — incremental tail parse from the stored byte offset; resets to zero if the file shrank. Extracts per-turn usage, tool-call counts by tool (Read/Grep/Glob vs others), files touched, user-prompt keywords (keywords only — raw prompt text is never persisted), and compaction markers.
- **Git probe** — dirty-file count, cached in state for ~5 s, short timeout, silently absent outside a repo.
- **Detectors** — independent units, each mapping the snapshot + state to either nothing or a proposal `{ id, action, urgency 0–100, reason }`. v1 set:
  - *ctx-pressure* — absolute input tokens (with % as secondary); recommends `/compact` with a focus hint. Default threshold cited (≈150k, community norm + Anthropic guidance).
  - *ctx-spike* — token jump between consecutive `prompt_id`s (never between redraws).
  - *cache-expiry* — warm cache with expiry within ~2 minutes.
  - *rate-limit* — five-hour or weekly usage ≥ ~80%, includes reset time.
  - *read-heavy* — many read/search tool calls in the main context over recent turns → delegate to a subagent.
  - *drift* — low overlap between the latest prompt's files/keywords and the session's rolling working set, above a context floor → `/clear`.
  - *uncommitted* — many dirty files plus heavy context → commit first.
  - *healthy* — default when nothing else fires.
- **Ranker** — selects the single highest-urgency proposal; applies hysteresis (separate enter/exit thresholds) and per-advice cooldowns, both persisted in session state.
- **Renderer** — healthy: one sentence; yellow/red: two lines (metrics, then advice + why). ANSI colour; every line fits `COLUMNS`.
- **Wrapper** — if a previous status line command was configured, runs it with the same stdin under a ~150 ms timeout and prints its output above the advice; on timeout, skips it.
- **Config** — optional user config file overriding thresholds and disabling detectors.
- **CLI commands** — `install` (back up settings, store the previous status line command, set ours), `uninstall` (restore byte-for-byte), `report` (local metrics across past transcripts: share of sessions reaching auto-compact, cache-rebuild cost, advice-followed rate, peak context).

**Delivery phases**
- P0 spike: capture real stdin + transcripts on Windows and macOS; confirm which surfaces render the status line (CLI and IDE terminals confirmed in scope; desktop app to be checked); measure Node cold start on Windows.
- P1: core run, normaliser, state, transcript reader, ranker, renderer; detectors ctx-pressure, ctx-spike, cache-expiry, rate-limit, healthy.
- P2: read-heavy, drift, uncommitted, git probe, wrapper, install/uninstall, config.
- P3: report command, README with cited threshold sources, npm publish.
- v2 (out of scope here): `calibrate`, rule packs.

## Testing Decisions

- **Good tests assert external behaviour only**: given stdin JSON, a transcript, a home folder and a clock, what text is printed and what settings file results. No assertions on internal helpers, detector internals or state-file layout; renaming an internal function must never break a test.
- **Seam A — status line run.** All status line behaviour is tested by calling the core run function with recorded stdin JSON fixtures, transcript fixture files and a temporary home folder, then asserting on the returned text. This single seam covers every detector, the ranker, rendering, width fitting and incremental transcript reading:
  - Detectors: one fixture scenario per detector proving its advice appears (and doesn't when below threshold).
  - Ranker: sequences of runs against the same home folder with advancing clock and changing input, proving hysteresis (no flicker), cooldown (no immediate repeat) and single-winner selection.
  - Incremental parse: append to the transcript between runs; shrink it to prove reset.
  - Robustness: malformed stdin, missing transcript, null fields, post-`/compact` input, two `session_id`s sharing a home folder.
  - Git: a real temporary git repository with dirty files; a non-repo directory.
  - Wrapper: a fixture "previous command" that prints quickly, and one that exceeds the timeout.
  - Performance: p95 under 100 ms for a first run against a ~5 MB transcript and under 30 ms for incremental runs, on Windows and macOS.
- **Seam B — CLI commands.** `install`, `uninstall` and `report` run against a temporary home folder: settings before/after (backup created, only the status line key changed, previous command stored, uninstall restores byte-for-byte), and report output from fixture transcripts.
- **Golden fixtures** come from the P0 spike: real stdin payloads and real transcripts (scrubbed of prompt text), checked in.
- **Test runner**: Node's built-in test runner — no dependencies.
- **Prior art**: none in this repo (greenfield). Fixture shapes follow the verified Claude Code status line schema and the observed transcript JSONL format (`user`/`assistant` entries, `tool_use` blocks, per-message `usage` with cache read/creation tokens, `promptId` on user entries).

## Out of Scope

- Any LLM call, network request, or central telemetry.
- A Pago-specific rule pack (the detector/advice design keeps the door open for it).
- `calibrate` (tuning thresholds from local history) — planned for v2.
- Interactive or clickable status line UI, and any manual expand/collapse toggle (expansion is automatic by risk level).
- Rendering in surfaces other than terminal CLI and IDE terminals, unless the P0 spike shows they work for free.
- Localisation (English only in v1).
- Hooks-based fallback that injects advice into the conversation (would consume tokens).

## Further Notes

- **Prior art is closer than first assumed.** hybrid2102/statusline-for-claude-code ("push harder or slow down") and admirito/claude-statusline ("quiet until attention") are the nearest competitors; agentmessaging/claude-plugin PR #31 recommends `/compact` from 150k tokens. Differentiators to protect: plain-sentence advice with *why*; the delegate, drift, cache-timing and commit detectors; anti-nag ranking; local `report`.
- **Success metrics** (measured with `report`, two weeks before vs. two weeks after, volunteers only): ≥30% relative drop in sessions reaching auto-compact; ≥20% drop in cache-rebuild cost per session; ≥25% advice-followed rate; ≥5 Pago volunteers within a month. Targets are first guesses to be revisited once baselines exist.
- **Open questions**: employment-contract IP clause before publishing on personal GitHub; final package name and npm availability; English-only vs. English+Romanian advice; whether cited docs + community norms suffice for v1 thresholds; whether "suggested command run within 3 turns" is an acceptable advice-followed heuristic; which P2 detector comes first if time-boxed (read-heavy vs. drift).
- An earlier hand-written PRD exists at `docs/PRD.md`; this spec supersedes it as the source for `/to-tickets`.
