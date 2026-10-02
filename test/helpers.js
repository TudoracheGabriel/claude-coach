import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from '../src/run.js';

export const NOW = Date.UTC(2026, 9, 2, 12, 0, 0);

export function tempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'coach-home-'));
}

// Shaped after the documented Claude Code status line schema.
export function stdin({
  sessionId = 'session-a',
  promptId = 'prompt-1',
  tokens = 20_000,
  windowSize = 200_000,
  transcriptPath,
  cwd,
  extra = {},
} = /** @type {any} */ ({})) {
  const usage = tokens === null
    ? null
    : { input_tokens: 500, output_tokens: 800, cache_creation_input_tokens: 1500, cache_read_input_tokens: tokens - 2000 };
  return {
    cwd: cwd ?? '/work/project',
    session_id: sessionId,
    prompt_id: promptId,
    transcript_path: transcriptPath ?? '/nowhere/transcript.jsonl',
    model: { id: 'claude-opus-5-5', display_name: 'Opus' },
    workspace: { current_dir: cwd ?? '/work/project', project_dir: cwd ?? '/work/project' },
    version: '2.1.260',
    cost: { total_cost_usd: 0.5, total_duration_ms: 60_000 },
    context_window: {
      total_input_tokens: tokens ?? 0,
      total_output_tokens: 1200,
      context_window_size: windowSize,
      used_percentage: tokens === null ? null : Math.round((tokens / windowSize) * 100),
      remaining_percentage: tokens === null ? null : 100 - Math.round((tokens / windowSize) * 100),
      current_usage: usage,
    },
    exceeds_200k_tokens: (tokens ?? 0) > 200_000,
    ...extra,
  };
}

export async function coach(input, { home = undefined, now = NOW, columns = 200 } = {}) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  return run(text, { home: home ?? tempHome(), now, columns });
}

export const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
export const lines = (s) => strip(s).split('\n');
