// Measures wall-clock time of the status line executable as Claude Code runs it: a fresh
// `node` process per refresh. Usage: node scripts/cold-start.js [runs]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/claude-coach.js', import.meta.url));
const runs = Number(process.argv[2]) || 30;
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-cold-'));
const input = JSON.stringify({
  session_id: 'cold-start',
  model: { id: 'claude-opus-5-5', display_name: 'Opus' },
  context_window: { context_window_size: 200000, used_percentage: 40, current_usage: { input_tokens: 10, cache_creation_input_tokens: 1000, cache_read_input_tokens: 79000 } },
});

const time = (args) => {
  const t0 = performance.now();
  spawnSync(process.execPath, args, { input, env: { ...process.env, HOME: home, USERPROFILE: home } });
  return performance.now() - t0;
};
const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return `p50 ${s[Math.floor(s.length / 2)].toFixed(0)} ms, p95 ${s[Math.ceil(s.length * 0.95) - 1].toFixed(0)} ms`;
};

const bare = Array.from({ length: runs }, () => time(['-e', '0']));
const coach = Array.from({ length: runs }, () => time([BIN]));
console.log(`${process.platform} node ${process.version}, ${runs} runs`);
console.log(`node -e 0      ${stats(bare)}`);
console.log(`claude-coach   ${stats(coach)}`);
