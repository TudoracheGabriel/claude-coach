# Advice rationale

Full detail behind each piece of advice in the [README](../README.md#what-it-watches-for): exact trigger/exit levels, cooldowns, and sources.

Advice comes at three levels: a cyan `Tip:` (urgency < 50, something to do differently next time), a yellow `▲` warning (50–69), and a red `▲` (≥ 70, act now). Tips about *how* the work is being done (delegating, `/clear`) only appear after Claude finishes its turn, when it's your move. Advice never flickers near a threshold — each one has separate on/off levels — and goes quiet for a cooldown period once you act on it.

| Advice | Shown when (default) | Why | Source |
|---|---|---|---|
| **Run /compact** (with a focus hint from your latest task) | ≥ 150k tokens in context (absolute, so 1M windows aren't warned only at 850k), or ≥ 85% of the window. Off again below 140k. | Answer quality drops as context grows. | 150k is the default trigger of Anthropic's own [compaction at a token threshold](https://platform.claude.com/docs/en/build-with-claude/compaction-threshold). Claude Code docs: "performance degrades as it fills" ([best practices](https://code.claude.com/docs/en/best-practices)). See also [context rot](https://research.trychroma.com/context-rot) (Chroma, 18 models) and [Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) (Anthropic). |
| **Restate key constraints** | One prompt added ≥ 40k tokens compared with the previous prompt (measured per `prompt_id`, never per redraw) | A big load of fresh content pushes earlier instructions further back, and models use mid-context information less reliably. | [Lost in the Middle](https://arxiv.org/abs/2307.03172) (Liu et al., 2023). [Context rot](https://research.trychroma.com/context-rot). The 40k value (20% of a 200k window) is our heuristic. |
| **Reply within Ns** | The prompt cache is warm and expires within 120 s, and the next turn would re-cache ≥ 20k tokens | After expiry, the next turn writes the whole prefix to the cache again: 1.25× (5-minute TTL) or 2× (1-hour TTL) the input price, instead of 0.1× for a cache read. | [Prompt caching](https://docs.claude.com/en/docs/build-with-claude/prompt-caching) (TTL and pricing). Claude Code [status line `prompt_cache` fields](https://code.claude.com/docs/en/statusline). |
| **Lower /effort or use a cheaper /model** | The 5-hour or weekly limit is ≥ 80% used (off again below 75%). Shows the local reset time. | Gives you time to pace the rest of the window instead of being cut off mid-task. | Claude Code [status line `rate_limits`](https://code.claude.com/docs/en/statusline). The 80% level is a common warning point; tune it in config. |
| **Tip: Next time, ask Claude to explore with a subagent** | After Claude finishes its turn: ≥ 15 Read/Grep/Glob calls in the main conversation over the last 5 prompts, reads are ≥ 60% of tool calls, and context is ≥ 40k | Exploration fills the main context. A subagent explores in its own window and returns only a summary. | Claude Code [best practices: use subagents for investigation](https://code.claude.com/docs/en/best-practices#use-subagents-for-investigation). Anthropic: subagents return "a condensed, distilled summary (often 1,000-2,000 tokens)" ([context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)). The thresholds are our heuristic. |
| **New task? Run /clear first** | After Claude finishes its turn: the latest prompt's files, folders and keywords overlap the session's recent working set by < 15%, and context is ≥ 60k | Leftover context from an unrelated task reduces quality ("the kitchen sink session"). | Claude Code [best practices: avoid common failure patterns](https://code.claude.com/docs/en/best-practices#avoid-common-failure-patterns). Overlap and floor are our heuristic. |
| **Commit first** | ≥ 10 uncommitted files and context ≥ 100k (git checked at most every 5 s, 300 ms timeout) | A commit is a safe point before the next big change. Claude Code checkpoints don't cover Bash changes and are "not a replacement for version control". | Claude Code [checkpointing](https://code.claude.com/docs/en/checkpointing#not-a-replacement-for-version-control). Thresholds are our heuristic. |

Values marked as heuristics are first guesses. Change them in `~/.claude/coach/config.json` (see [configuration](configuration.md)), and use `report` to check whether they help.

## `explain`

```bash
npx github:TudoracheGabriel/claude-coach explain [session-id]
```

Shows, for your latest session (or the one you name), what each rule saw on the last refresh, its trigger level, and what happened to it:

```
Session bba579c3-… · last refresh 14:05 · Sonnet 5 · 127k/1M

ctx-pressure  127k tokens (13% of 1M)                 trigger ≥150k or ≥85%, off below 140k   → quiet
ctx-spike     last prompt +12k tokens                 trigger ≥+40k in one prompt             → quiet
cache-expiry  cache warm, 59m left, rebuild 127k      trigger ≤2m left & rebuild ≥20k          → quiet
rate-limit    5h 2%, 7d 21%                           trigger ≥80%, off below 75%              → quiet
read-heavy    15 reads/searches in your last prompt   trigger ≥15 & ≥60% reads & ≥40k ctx…    → SHOWN (tip)
…
Source for read-heavy: code.claude.com/docs/en/best-practices#use-subagents-for-investigation
```

Possible outcomes: `SHOWN`, `fired, outranked` (a more urgent advice won), `cooldown until HH:MM` (you acted on it recently), `quiet, waiting for turn end`, `quiet`, `disabled`. `explain` only reads; it never changes what the status line shows.

## `report`

```bash
npx github:TudoracheGabriel/claude-coach report --since 2026-09-01 [--until 2026-09-15]
```

Reads your local transcripts in `~/.claude/projects/` (default: the last 14 days) and prints:

```
claude-coach report, 2026-09-18 to 2026-10-02 (23 sessions)

Sessions reaching auto-compact  4 / 23 (17%)
Cache rebuilt after expiry      41k tokens per session (950k total)
Advice followed within 3 turns  9 / 26 (35%)
Peak context                    median 92k, max 188k
```

- **Cache rebuilt after expiry**: cache-write tokens on turns that came after a pause longer than the cache TTL (5 minutes, or 1 hour when the session used 1-hour caching).
- **Advice followed**: the coach logs each advice when it first appears (`~/.claude/coach/advice.jsonl`: ids and timestamps only). A piece of advice counts as followed if, within the next 3 prompts, you ran the suggested command (`/compact`, `/clear`, `/model`, `/effort`), used a subagent, ran `git commit`, or replied before the cache expired. For `/clear`, a new session in the same project within 10 minutes also counts.

To try it on a team: run `report` before installing (baseline), then again two weeks later. Each person runs it on their own machine; no data leaves it.

## How it works

Every status line refresh runs `node bin/claude-coach.js`:

1. Normalises the session JSON from stdin. It tolerates the null and missing fields Claude Code sends early in a session and right after `/compact`.
2. Reads only the bytes appended to the transcript since the last run, and starts over if the file shrank.
3. Runs independent detectors (`src/detectors/`). Each one returns nothing or `{ action, urgency, reason }`.
4. Picks the most urgent advice, applying on/off levels and cooldowns kept in per-session state.
5. Prints one line (healthy) or two (metrics, then advice), each fitted to `COLUMNS`.

If anything fails, it prints a fallback line and exits 0 — it never shows a stack trace.

Each run is about 7 ms of work, plus Node startup (about 60 ms on Windows). Tests enforce a p95 under 100 ms for a first run on a 5 MB transcript and under 30 ms for an incremental run. Measured numbers are in [P0-findings.md](P0-findings.md).
