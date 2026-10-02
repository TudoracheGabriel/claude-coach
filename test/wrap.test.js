import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { cli } from '../src/cli.js';
import { coach, stdin, strip, lines, tempHome, NOW } from './helpers.js';


const FIXTURE = fileURLToPath(new URL('./fixtures/old-status.js', import.meta.url)).replace(/\\/g, '/');
const oldCommand = (delayMs = 0) => `node "${FIXTURE}" ${delayMs}`;

async function installedOver(command, wrapTimeoutMs) {
  const home = tempHome();
  fs.mkdirSync(path.join(home, '.claude', 'coach'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ statusLine: { type: 'command', command } }));
  if (wrapTimeoutMs) fs.writeFileSync(path.join(home, '.claude', 'coach', 'config.json'), JSON.stringify({ wrap: { timeoutMs: wrapTimeoutMs } }));
  const r = await cli(['install'], { home });
  assert.equal(r.code, 0);
  return home;
}

test('the previous status line prints above the advice, fed the same stdin', async () => {
  const home = await installedOver(oldCommand(), 5000);
  const out = strip(await coach(stdin({ tokens: 160_000, sessionId: 'sess-42' }), { home }));
  const [first, ...rest] = lines(out);
  assert.equal(first, 'OLD-LINE session=sess-42');
  assert.equal(rest.length, 2);
  assert.match(rest[1], /\/compact/);
});

test('a healthy session shows the previous status line plus the one-line advice', async () => {
  const home = await installedOver(oldCommand(), 5000);
  const out = lines(await coach(stdin({ tokens: 20_000 }), { home }));
  assert.equal(out.length, 2);
  assert.match(out[0], /OLD-LINE/);
  assert.match(out[1], /healthy/i);
});

test('a previous command slower than the timeout is skipped and advice still prints', async () => {
  const home = await installedOver(oldCommand(3000), 200);
  const started = Date.now();
  const out = strip(await coach(stdin({ tokens: 160_000 }), { home }));
  assert.ok(Date.now() - started < 1500, 'did not wait for the slow command');
  assert.doesNotMatch(out, /OLD-LINE/);
  assert.match(out, /\/compact/);
});

test('a slow previous command still shows its last finished output on later runs', async () => {
  const home = await installedOver(oldCommand(400), 100);
  const first = strip(await coach(stdin({ tokens: 20_000, sessionId: 's1' }), { home, now: NOW }));
  assert.doesNotMatch(first, /OLD-LINE/);
  await sleep(1500);
  const later = strip(await coach(stdin({ tokens: 20_000, sessionId: 's1' }), { home, now: NOW + 2000 }));
  assert.match(lines(later)[0], /OLD-LINE session=s1/);
});

test('a failing previous command is ignored', async () => {
  const home = await installedOver('definitely-not-a-real-command-xyz', 3000);
  const out = lines(await coach(stdin({ tokens: 20_000 }), { home }));
  assert.equal(out.length, 1);
  assert.match(out[0], /healthy/i);
});

test('uninstall restores the previous status line command', async () => {
  const home = await installedOver(oldCommand(), 5000);
  await cli(['uninstall'], { home });
  const settings = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'));
  assert.equal(settings.statusLine.command, oldCommand());
});
