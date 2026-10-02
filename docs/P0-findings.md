# P0 findings: real data and runtime

Status of issue 02 (real-data hardening). Last updated 2026-10-02.

## Input schema

Checked against the Claude Code status line docs (code.claude.com/docs/en/statusline) on 2026-10-02:

- `prompt_cache` needs Claude Code v2.1.251 or later. It has `warm`, `ttl` (`"5m"` / `"1h"`), `expires_at` (epoch seconds), `hit_ratio` and `recache_tokens_if_cold`. It is absent until the first API response.
- `rate_limits.*.resets_at` is in epoch seconds. Each window can be absent on its own, and Claude Code drops a window once it has reset.
- `prompt_id` needs v2.1.196 or later. It is absent until the first user input, so the coach falls back to the transcript's latest `promptId`.
- `context_window.current_usage` is `null` before the first API call and again right after `/compact`. `used_percentage` can be `null` early in a session.
- The status line re-runs when a warm cache reaches `expires_at`, but not before it. That is why `install` sets `refreshInterval: 15`: without it the "reply within Ns" countdown would rarely be visible.

## Transcript format (observed locally, Claude Code 2.1.280 to 2.1.286, Windows)

- Entry types seen: `user`, `assistant`, `system` (`stop_hook_summary`, `api_error`), `attachment`, `queue-operation`, `last-prompt`, `file-history-snapshot`, `file-history-delta`, `custom-title`, `agent-name`, `cost-state`, `mode`, `relocated`, `atis-latch`. The reader looks only at `user`, `assistant` and `system`, and skips everything else before parsing.
- `promptId` appears on prompt entries and also on `tool_result` user entries. Assistant entries carry no prompt id, so they are attributed to the latest prompt.
- Usage includes `cache_creation.ephemeral_1h_input_tokens`. These sessions used the 1-hour cache TTL, and `report` takes this into account.
- Subagent transcripts live in `<session>/subagents/`, not in the main file. `isSidechain: true` entries are still skipped defensively.
- No `compact_boundary` entry was present in the local history: these sessions used 1M windows (peak context 828k). The reader handles the documented shape `{type:"system", subtype:"compact_boundary", compactMetadata:{trigger, preTokens}}`, but it is not yet verified against a real one.

## Capturing real fixtures

1. Set `CLAUDE_COACH_CAPTURE=1` in the environment Claude Code starts from, or put `"capture": true` in `~/.claude/coach/config.json`.
2. Work for a few minutes. The coach writes at most one capture per session per minute to `~/.claude/coach/captures/`: `<time>-<session>.stdin.json` plus `<time>-<session>.transcript.jsonl` (the last 300 entries).
3. Scrubbing: every string is replaced by `[scrubbed N chars]` unless it sits under a structural key (ids, timestamps, tool names, model, file paths). Prose-like object keys are replaced too. The home folder and account name are replaced in paths.
4. Review the files, then copy them into `test/fixtures/captured/`. `test/capture.test.js` replays every pair found there, at 200 and at 60 columns.

Still to do: capture on Windows and on macOS and check the captures in. This was not done in this session. The auto-mode classifier refused to copy a real local transcript into the repo, even scrubbed, so this step is left to the owner.

## Node cold start (Windows 11, Node 22.13, `node scripts/cold-start.js 30`)

| | p50 | p95 |
|---|---|---|
| `node -e 0` (bare Node) | 61 ms | 69 ms |
| `claude-coach` (fresh process, small input) | 95 ms | 108 ms |

- The coach's own work, measured in-process, is about 7 ms per run, plus about 23 ms to load its ~20 ES modules (per-file overhead on Windows).
- The 100 ms budget in the spec is for the script's work (Seam A), and `test/perf.test.js` enforces it: under 100 ms first run on 5 MB, under 30 ms incremental. Whole-process p95 is a little over 100 ms, mostly Node's own startup.
- Mitigation if it matters: bundle `src/` into a single file at publish time (dev-only bundler, still zero runtime deps), saving most of the 23 ms of module loading. Node's compile cache (`module.enableCompileCache`) was tried and gave no gain.
- A wrapped previous status line runs in parallel with the coach's own work, under a 150 ms deadline. On this machine, Git Bash alone takes about 100 ms to start and the owner's existing jq-based status line about 680 ms. Slow commands therefore show their last finished output (up to 2 minutes old), refreshed in the background.

## Surfaces

| Surface | Renders the status line? |
|---|---|
| Terminal CLI (`claude` in Windows Terminal / macOS Terminal) | Documented: yes. Not yet checked with the coach. |
| IDE integrated terminal (VS Code / JetBrains) | Expected: yes (same CLI). Not yet checked. |
| Desktop app, Code tab | Unknown. Not yet checked. |

Checking these needs a person in front of each surface after `npx claude-coach install`.
