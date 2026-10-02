# PRD — claude-coach (working name)

> A Claude Code status line that tells you **what to do next** instead of just showing numbers.

| | |
|---|---|
| Status | Draft v0.1 |
| Owner | Gabriel Tudorache |
| Date | 2026-10-02 |
| Repo | Personal GitHub (private first; public later) |
| Source | Grill session on `claude_status_line_project_log.md`; plan `~/.claude/plans/system-reminder-the-user-started-jiggly-octopus.md` |

---

## 1. Problem

Claude Code's status line can show context %, cost, rate limits and cache state. Most devs, especially new ones, don't know what to *do* with those numbers. So they:

- keep working in a bloated session until answers get worse, then blame the model;
- start a new task in a session full of unrelated context;
- fill the main context with file reads that a subagent could have handled;
- let the prompt cache expire mid-thought and pay to rebuild it;
- hit the 5-hour limit in the middle of the day.

Existing status lines ([ccstatusline](https://github.com/sirmalloc/ccstatusline), [claude-hud](https://github.com/jarrodwatts/claude-hud), [admirito/claude-statusline](https://github.com/admirito/claude-statusline), [hybrid2102/statusline-for-claude-code](https://github.com/hybrid2102/statusline-for-claude-code)) are dashboards. At best they color a bar. They don't turn several signals into one concrete next step.

## 2. Solution summary

A zero-dependency Node.js status line command. On every refresh it:

1. reads the session JSON that Claude Code sends on stdin;
2. reads only the new lines of the session transcript since the last run;
3. runs a set of independent **detectors**, each of which may propose an action with an urgency and a reason;
4. picks the single most urgent proposal, using **hysteresis and cooldowns** so the advice doesn't flicker or nag;
5. prints **one plain sentence** when the session is healthy, and expands to **two lines** (metrics, then advice and why) when it is not.

It makes no LLM calls and no network requests, and it costs zero tokens.

## 3. Users

| Persona | Need |
|---|---|
| **Primary: Pago dev, new to Claude Code** | Be told when to `/compact`, `/clear`, start fresh or delegate, without learning what the numbers mean. |
| **Secondary: experienced Claude Code user** | Keep their existing status line and get a nudge only when something matters. |
| **Later: public OSS users** | Install with one command on macOS or Windows. |

## 4. Goals and success metrics

Measured locally with the `report` command (R10) on volunteers: 2 weeks without the coach vs 2 weeks with it. No data leaves the machine.

| Goal | Metric | Target | Baseline | Window |
|---|---|---|---|---|
| Fewer bloated sessions | % of sessions that reach auto-compact | ≥ 30% relative drop | From pre-install `report` | 2 wk pre vs 2 wk post |
| Lower waste | Cost of rebuilding the cache after it expired, per session | ≥ 20% relative drop | From pre-install `report` | same |
| Advice is acted on | % of shown advice followed within 3 turns | ≥ 25% | n/a (new) | first 2 wk post |
| Doesn't slow anything down | Script runtime p95 | < 100 ms first run, < 30 ms incremental | n/a | CI perf test |
| Adoption at Pago | Devs with it installed | ≥ 5 volunteers | 0 | 1 month after v1 |

Targets are first guesses. They get revisited once the first baselines come in (see Open Questions).

## 5. Requirements

### Functional

| ID | Requirement | Priority |
|---|---|---|
| R1 | Read and normalize the stdin JSON, handling the null and missing fields Claude Code is known to send. | HIGH |
| R2 | Parse the transcript incrementally, with state kept per session. | HIGH |
| R3 | Detector engine plus ranker with hysteresis and cooldown. | HIGH |
| R4 | v1 detectors: ctx-pressure, ctx-spike, cache-expiry, rate-limit, healthy (P1); read-heavy, drift, uncommitted (P2). | HIGH / MEDIUM |
| R5 | Adaptive output: one sentence when healthy, two lines at yellow or red, fitted to `COLUMNS`. | HIGH |
| R6 | Wrap mode: run the user's existing status line command and append the advice. | MEDIUM |
| R7 | `npx <name> install` / `uninstall` on macOS and Windows. | MEDIUM |
| R8 | Config file to override thresholds and turn detectors off. | MEDIUM |
| R9 | Git state (dirty file count), cached and with a timeout. | MEDIUM |
| R10 | `report` command: local metrics from past transcripts. | MEDIUM |
| R11 | `calibrate` command: tune thresholds from your own history. | LOW (v2) |

#### Acceptance criteria

**R1: Input**
- Given `context_window.used_percentage` is null, when the script runs, then it falls back to `current_usage` tokens or shows healthy, and never crashes.
- Given malformed stdin, when the script runs, then it prints a fallback line and exits with code 0.
- Given a 1M context window, when tokens are 300k (30%), then the decision uses absolute tokens, not just the percentage.

**R2: Transcript**
- Given a state file with byte offset N, when the script runs, then it parses only the bytes after N and saves the new offset.
- Given the transcript is now smaller than the stored offset (rewrite or compact), when the script runs, then it resets the offset to 0 and rebuilds the aggregates.
- Given two sessions running in parallel, when both refresh, then each uses its own `~/.claude/coach/<session_id>.json` and neither overwrites the other's state.
- Given state files older than 7 days, when any run happens, then they are deleted.

**R3: Ranker**
- Given several detectors fire, when ranking, then the one with the highest urgency wins and its reason is shown.
- Given advice X was just shown and then dropped, when urgency hovers near the threshold, then X does not toggle on and off (the exit threshold is lower than the entry threshold).
- Given the user dismissed X by acting on it, when the same condition comes back within the cooldown, then X is not shown again.

**R4: Detectors** (each is a pure function, unit-tested with fixtures)
- ctx-pressure: given input tokens at or above the configured threshold (default cited in the README, e.g. 150k), then advise `/compact` with a focus hint taken from the latest task.
- ctx-spike: given tokens jumped by at least X between consecutive `prompt_id`s (not between redraws), then warn that older details may be fuzzy.
- cache-expiry: given `prompt_cache.warm` and `expires_at` minus now is at or below 120 s, then show "reply within Ns or pay to rebuild the cache".
- rate-limit: given `rate_limits.five_hour.used_percentage` at or above 80, then advise lowering effort or using a cheaper model, and show the reset time.
- read-heavy: given at least N Read/Grep/Glob calls in the main context over the last K turns, then advise delegating to a subagent.
- drift: given the latest prompt's files and keywords overlap the session's working set below the threshold, and context is above the floor, then advise `/clear`.
- uncommitted: given at least N dirty files and context above the floor, then advise committing first.
- healthy: given nothing else fires, then show one short encouraging line.

**R5: Output**
- Given a healthy session, then exactly one line is printed.
- Given urgency is yellow or red, then two lines are printed: metrics, then advice and why.
- Given `COLUMNS=60`, then no line is longer than 60 visible characters.

**R6: Wrap**
- Given an existing status line command, when the coach is installed, then the old command is saved and called with the same stdin, with its output kept above the advice.
- Given the wrapped command takes longer than 150 ms, then its output is skipped and the advice still prints.

**R7: Install**
- Given an existing `~/.claude/settings.json`, when installing, then a backup is written first and only `statusLine` changes.
- Given an uninstall, then `settings.json` is restored byte for byte.
- Works on Windows (PowerShell / Git Bash) and macOS.

**R10: Report**
- Given `~/.claude/projects/**/*.jsonl`, when `report --since <date>` runs, then it prints the §4 metrics, reads only local files, and makes no network calls.

### Non-functional

- **Performance:** p95 under 100 ms (first parse of a 5 MB transcript) and under 30 ms incrementally. Claude Code cancels a status line run that is still going when the next refresh arrives.
- **Zero deps, zero network, zero tokens.**
- **Robustness:** never throws to the terminal; on any error, print a fallback line.
- **Privacy:** the transcript is read locally only, and prompt text is never stored in state (only keywords and paths).
- **Portability:** Node 18+, macOS and Windows; paths through `os.homedir()` / `path`.

## 6. Scope

**In (v1):** R1–R10, English advice, generic (non-Pago) wording, CLI and IDE terminals.

**Out (v1):**
- Any LLM call or network request.
- Central telemetry.
- A Pago rule pack (the interface stays open for it).
- Interactive or clickable UI.
- Desktop app status bar, unless the spike shows it renders there.
- `calibrate` (planned for v2).

**Future:** `calibrate`, rule packs (Pago: map advice to `/android-handoff`, `/android-commit-changes` and the agents), localization, distribution through pago-shared-config.

## 7. Key decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Pago devs first, public later | The work pitch is the primary goal, and the design stays generic so it can go public. |
| D2 | Node.js, zero deps | Cross-platform, easy JSONL parsing, colleagues can tweak it. |
| D3 | Detectors plus ranker, not a single score | Each piece is explainable and testable, and adding rules is easy. |
| D4 | Absolute tokens as well as % | 50% of 1M is not 50% of 200k. |
| D5 | Per-turn deltas keyed by `prompt_id` | The status line redraws many times per turn. |
| D6 | Incremental transcript tail, state per session | Speed, and safety when sessions run in parallel. |
| D7 | Advice only when healthy, expand on risk | Quiet by default, and shows why when it matters. |
| D8 | Wrap the existing status line | Adoption without users losing their dashboard. |
| D9 | Thresholds cited in v1, mined from history in v2 | Credible from day one, personalized later. |
| D10 | Prove value with a local before/after `report` | Real numbers, with no telemetry and no privacy review. |
| D11 | Personal GitHub repo | Owner's choice. IP is still to be confirmed (Q1). |

## 8. Risks

| Risk | Mitigation |
|---|---|
| Advice is wrong or nags, and users turn it off | Hysteresis, cooldowns, config to turn detectors off, conservative defaults. |
| Transcript format changes between Claude Code versions | Defensive parser and fixture tests per version; on unknown lines, skip them, never crash. |
| Node cold start on Windows is too slow | Measure in the P0 spike; fall back to a lighter path if needed. |
| A close competitor (hybrid2102) adds the same features | The edge is detector breadth, the "why", and `report`. Ship fast. |
| IP ownership unclear | Resolve before publishing (Q1). |

## 9. Milestones

| Phase | Contents |
|---|---|
| P0 spike (½ day) | Capture real stdin and transcripts on Windows and macOS; confirm which surfaces render it; measure cold start. |
| P1 core | R1–R3, R5, P1 detectors, unit and golden tests. |
| P2 | P2 detectors, R6, R7, R8, R9. |
| P3 | R10, README with sources, npm publish (private/scoped first). |
| v2 | R11 `calibrate`, rule packs. |

## 10. Open questions

1. Does the employment contract have an IP clause for side projects? Check before pushing to personal GitHub.
2. Final name (`claude-coach`, `context-coach`, …) and whether the npm name is free.
3. Advice language: English only, or English and Romanian?
4. Threshold sources: are the Anthropic docs plus community norms (about 150k for `/compact`) enough for v1?
5. Is "advice followed" (the suggested command run within 3 turns) a good enough heuristic?
6. If time runs short, which P2 detector comes first: read-heavy (delegate) or drift?
7. Are the §4 targets realistic? Revisit once the baselines are in.
