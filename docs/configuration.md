# Configuration

Create `~/.claude/coach/config.json` (on Windows, `%USERPROFILE%\.claude\coach\config.json`). Every key is optional. Anything missing, malformed, or of the wrong type falls back to the default.

```json
{
  "detectors": {
    "ctx-pressure": { "enterTokens": 120000 },
    "drift": { "enabled": false },
    "rate-limit": { "enterPercent": 90, "cooldownMin": 60 }
  },
  "wrap": { "enabled": true, "timeoutMs": 150 },
  "git": { "timeoutMs": 300, "cacheSeconds": 5 }
}
```

Set `"wrap": { "enabled": false }` to stop showing your previous status line. `uninstall` still restores it regardless.

If you raise only an `enter…` level, its `exit…` level moves with it, so the on/off gap keeps its shape.

| Detector | Options (defaults) |
|---|---|
| `ctx-pressure` | `enterTokens` 150000, `exitTokens` 140000, `enterPercent` 85, `cooldownMin` 10 |
| `ctx-spike` | `enterTokens` 40000, `exitTokens` 35000, `cooldownMin` 0 |
| `cache-expiry` | `warnSeconds` 120, `minRecacheTokens` 20000, `cooldownMin` 0 |
| `rate-limit` | `enterPercent` 80, `exitPercent` 75, `cooldownMin` 30 |
| `read-heavy` | `enterCalls` 15, `exitCalls` 12, `turns` 5, `minReadShare` 0.6, `minTokens` 40000, `cooldownMin` 15 |
| `drift` | `maxOverlap` 0.15, `exitOverlap` 0.25, `minTokens` 60000, `minFeatures` 4, `minPriorPrompts` 2, `cooldownMin` 10 |
| `uncommitted` | `enterFiles` 10, `exitFiles` 8, `minTokens` 100000, `cooldownMin` 15 |

Every detector also takes `"enabled": false`.

## Wiring the status line by hand

If you'd rather not run `install`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node /absolute/path/to/claude-coach/bin/claude-coach.js",
    "refreshInterval": 15
  }
}
```

On Windows, write the path with forward slashes (`C:/Users/you/...`).

## What `install` actually does

1. Backs up `~/.claude/settings.json` to `~/.claude/coach/settings.backup.json`.
2. Copies the coach to `~/.claude/coach/app/`, so it keeps working after npx clears its cache.
3. Changes **only** the `statusLine` key, to `node "<home>/.claude/coach/app/bin/claude-coach.js"` with forward slashes (these work in both Git Bash and PowerShell). Also sets `refreshInterval: 15` so the cache countdown stays current while you think.
4. If you already had a status line (for example ccstatusline), keeps it. Its output is shown above the advice, fed the same input. If it takes longer than 150 ms, the coach shows its last finished output (refreshed in the background) or skips it, and the advice still prints.

Verified on Windows; should work the same on macOS/Linux (same Node APIs, no platform-specific code) but that hasn't been checked on a real machine yet.

## Uninstall

```bash
npx github:TudoracheGabriel/claude-coach uninstall
```

If you haven't changed `settings.json` since install, it's restored byte for byte. If you have, only the status line is put back and your other changes are kept. Uninstall removes the app copy and the session state. Your `config.json` and the advice log stay, so `report` keeps working.
