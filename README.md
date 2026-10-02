# claude-coach

A Claude Code status line that tells you what to do next.

## Manual wiring

Add this to `~/.claude/settings.json` (use forward slashes on Windows):

```json
{
  "statusLine": {
    "type": "command",
    "command": "node /absolute/path/to/claude-coach/bin/claude-coach.js"
  }
}
```
