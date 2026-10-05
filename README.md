# claude-coach

> 🚧 Work in progress — rough edges expected, feedback welcome.

A [Claude Code](https://code.claude.com) status line that tells you **what to do next**, not just how many tokens you've burned.

Most of the time it's quiet:

```
Session healthy (42k in context), keep going.
```

When something actually needs attention, it says so — and why:

```
Opus · 162k/200k (81%) · cache warm 4m · 5h 34%
▲ Run /compact focus on checkout, coupon — 162k tokens in context; answers get less sharp in long contexts.
```

Runs 100% locally. No network calls, no LLM calls, no tokens spent.

## Who this is for

Anyone using Claude Code for real work who wants a nudge before context rot, a cold cache, or a rate-limit wall ruins their session — without babysitting a dashboard of raw numbers.

## What it watches for

| It tells you to... | When | Why |
|---|---|---|
| **Run `/compact`** | Context is getting large (≥150k tokens or ≥85% of the window) | Answer quality drops as context fills up |
| **Restate key constraints** | A huge chunk of new content just got added to context | Early instructions get buried and used less reliably |
| **Reply soon** | The prompt cache is about to expire | Letting it expire means paying full price to rebuild it |
| **Lower `/effort` or switch `/model`** | You're close to your rate limit | Lets you pace the rest of the session instead of getting cut off |
| **Use a subagent next time** | You've been doing a lot of exploratory reads in the main thread | Exploration fills up context that a subagent would keep separate |
| **Run `/clear`** | The new prompt looks unrelated to what you were just doing | Leftover context from a different task drags quality down |
| **Commit first** | Lots of uncommitted files and a big change coming | Gives you a safe point to roll back to |

Only the single most urgent tip is ever shown, and it won't nag — each one has a cooldown and backs off once you act on it. Every threshold is a tunable default (see [Configuration](#configuration)); the reasoning and sources behind each one are in [`docs/advice-rationale.md`](docs/advice-rationale.md).

## Install

Requires Node.js 18+ and an existing Claude Code install.

```bash
npx github:TudoracheGabriel/claude-coach install
```

This backs up your `~/.claude/settings.json`, wires the coach in as your status line, and keeps any status line you already had (shown above the advice line). Restart Claude Code to see it.

To uninstall:

```bash
npx github:TudoracheGabriel/claude-coach uninstall
```

Your previous `settings.json` is restored byte for byte if untouched since install.

## Usage

Once installed, it just runs — nothing to do day to day. Two extra commands if you're curious:

```bash
# why did (or didn't) the status line show advice just now?
npx github:TudoracheGabriel/claude-coach explain [session-id]

# how much is it actually helping, over the last N days?
npx github:TudoracheGabriel/claude-coach report --since 2026-09-01
```

<details>
<summary>Configuration</summary>

Create `~/.claude/coach/config.json` to tune thresholds. Every key is optional and falls back to a sane default:

```json
{
  "detectors": {
    "ctx-pressure": { "enterTokens": 120000 },
    "drift": { "enabled": false },
    "rate-limit": { "enterPercent": 90, "cooldownMin": 60 }
  },
  "wrap": { "enabled": true, "timeoutMs": 150 }
}
```

Every detector also takes `"enabled": false`. Full list of detectors and their options: [`docs/configuration.md`](docs/configuration.md).

</details>

<details>
<summary>Privacy</summary>

- No network calls, ever — `report` only reads local transcripts.
- No LLM calls, zero tokens spent.
- No prompt text stored. Per-session state keeps token counts, file paths, and up to 12 keywords per prompt, auto-deleted after 7 days.

</details>

## Development

```bash
npm install
npm test
npm run typecheck
```

Zero runtime dependencies. To add a new piece of advice, add a detector in `src/detectors/`, its defaults in `src/defaults.js`, and a test.

## License

Source is public for transparency and so `npx github:...` works, but no license is granted — all rights reserved. See [LICENSE](LICENSE).
