import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tempHome } from './helpers.js';

const BIN = fileURLToPath(new URL('../bin/claude-coach.js', import.meta.url));

function exec(input, env = {}) {
  const home = tempHome();
  return spawnSync(process.execPath, [BIN], {
    input,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home, ...env },
  });
}

test('executable exits 0 with a fallback line on malformed stdin', () => {
  const r = exec('garbage{');
  assert.equal(r.status, 0);
  assert.ok(r.stdout.trim().length > 0);
  assert.equal(r.stderr, '');
});

test('executable prints advice for valid stdin', () => {
  const r = exec(JSON.stringify({ session_id: 's', context_window: { context_window_size: 200000, used_percentage: 90 } }));
  assert.equal(r.status, 0);
  assert.match(r.stdout, /\/compact/);
});
