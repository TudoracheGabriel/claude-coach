import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { coach, stdin, strip, lines, tempHome, NOW } from './helpers.js';

function repoWithDirtyFiles(n) {
  const dir = tempHome();
  execFileSync('git', ['init', '-q'], { cwd: dir });
  addFiles(dir, 0, n);
  return dir;
}

function addFiles(dir, from, to) {
  for (let i = from; i < to; i++) fs.writeFileSync(path.join(dir, `file${i}.txt`), `change ${i}`);
}

test('many uncommitted files with heavy context suggest committing first', async () => {
  const repo = repoWithDirtyFiles(12);
  const out = strip(await coach(stdin({ tokens: 120_000, cwd: repo })));
  assert.match(lines(out)[1], /commit/i);
  assert.match(lines(out)[1], /12 uncommitted files/);
});

test('few uncommitted files give no commit advice', async () => {
  const repo = repoWithDirtyFiles(3);
  assert.doesNotMatch(strip(await coach(stdin({ tokens: 120_000, cwd: repo }))), /commit/i);
});

test('light context gives no commit advice even with many dirty files', async () => {
  const repo = repoWithDirtyFiles(12);
  assert.doesNotMatch(strip(await coach(stdin({ tokens: 40_000, cwd: repo }))), /commit/i);
});

test('outside a git repository there is no git advice and no error', async () => {
  const dir = tempHome();
  const out = strip(await coach(stdin({ tokens: 120_000, cwd: dir })));
  assert.doesNotMatch(out, /commit|git|error/i);
  assert.match(out, /healthy/i);
});

test('git results are reused within the cache window', async () => {
  const repo = repoWithDirtyFiles(12);
  const home = tempHome();
  const at = (ms) => coach(stdin({ tokens: 120_000, cwd: repo }), { home, now: NOW + ms });
  assert.match(strip(await at(0)), /12 uncommitted/);
  addFiles(repo, 12, 17);
  assert.match(strip(await at(2_000)), /12 uncommitted/);
  assert.match(strip(await at(6_000)), /17 uncommitted/);
});

test('a git probe slower than its timeout is skipped', async () => {
  const repo = repoWithDirtyFiles(12);
  const home = tempHome();
  fs.mkdirSync(path.join(home, '.claude', 'coach'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'coach', 'config.json'), JSON.stringify({ git: { timeoutMs: 1 } }));
  const out = strip(await coach(stdin({ tokens: 120_000, cwd: repo }), { home }));
  assert.doesNotMatch(out, /commit/i);
});
