import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cli } from '../src/cli.js';
import { tempHome } from './helpers.js';

const settingsFile = (home) => path.join(home, '.claude', 'settings.json');

function homeWithSettings(text) {
  const home = tempHome();
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(settingsFile(home), text);
  return home;
}

const ORIGINAL = '{\r\n    "theme": "dark",\r\n    "permissions": { "allow": ["Bash(npm test)"] },\r\n    "statusLine": { "type": "command", "command": "bash ~/.claude/old-status.sh", "padding": 1 },\r\n    "env": { "A": "1" }\r\n}\r\n';

const withoutStatusLine = (text) => {
  const { statusLine, ...rest } = JSON.parse(text);
  return rest;
};

test('install backs up settings and changes only the status line', async () => {
  const home = homeWithSettings(ORIGINAL);
  const r = await cli(['install'], { home });
  assert.equal(r.code, 0);
  const after = fs.readFileSync(settingsFile(home), 'utf8');
  assert.deepEqual(withoutStatusLine(after), withoutStatusLine(ORIGINAL));
  const { statusLine } = JSON.parse(after);
  assert.equal(statusLine.type, 'command');
  assert.match(statusLine.command, /^node ".*claude-coach\.js"$/);
  assert.doesNotMatch(statusLine.command, /\\/, 'forward slashes only, so Git Bash on Windows keeps the path');
  assert.equal(statusLine.padding, 1);
  assert.match(r.output, /backup/i);
  const backups = fs.readdirSync(path.join(home, '.claude', 'coach')).filter((f) => f.includes('backup'));
  assert.equal(backups.length, 1);
  assert.equal(fs.readFileSync(path.join(home, '.claude', 'coach', backups[0]), 'utf8'), ORIGINAL);
});

test('the installed command runs the coach', async () => {
  const home = homeWithSettings('{}');
  await cli(['install'], { home });
  const { command } = JSON.parse(fs.readFileSync(settingsFile(home), 'utf8')).statusLine;
  const script = /"(.*)"/.exec(command)[1];
  const r = spawnSync(process.execPath, [script], {
    input: JSON.stringify({ session_id: 's', context_window: { used_percentage: 10, context_window_size: 200000 } }),
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /healthy/i);
});

test('install without a settings file creates one with just the status line', async () => {
  const home = tempHome();
  const r = await cli(['install'], { home });
  assert.equal(r.code, 0);
  const settings = JSON.parse(fs.readFileSync(settingsFile(home), 'utf8'));
  assert.deepEqual(Object.keys(settings), ['statusLine']);
});

test('install then uninstall restores settings byte for byte', async () => {
  const home = homeWithSettings(ORIGINAL);
  await cli(['install'], { home });
  const r = await cli(['uninstall'], { home });
  assert.equal(r.code, 0);
  assert.equal(fs.readFileSync(settingsFile(home), 'utf8'), ORIGINAL);
});

test('installing twice keeps the original backup', async () => {
  const home = homeWithSettings(ORIGINAL);
  await cli(['install'], { home });
  await cli(['install'], { home });
  await cli(['uninstall'], { home });
  assert.equal(fs.readFileSync(settingsFile(home), 'utf8'), ORIGINAL);
});

test('uninstall after no settings file existed removes the created file', async () => {
  const home = tempHome();
  await cli(['install'], { home });
  await cli(['uninstall'], { home });
  assert.equal(fs.existsSync(settingsFile(home)), false);
});

test('uninstall keeps settings the user changed after install', async () => {
  const home = homeWithSettings(ORIGINAL);
  await cli(['install'], { home });
  const changed = JSON.parse(fs.readFileSync(settingsFile(home), 'utf8'));
  changed.model = 'opus';
  fs.writeFileSync(settingsFile(home), JSON.stringify(changed, null, 2));
  await cli(['uninstall'], { home });
  const after = JSON.parse(fs.readFileSync(settingsFile(home), 'utf8'));
  assert.equal(after.model, 'opus');
  assert.deepEqual(after.statusLine, JSON.parse(ORIGINAL).statusLine);
});

test('install refuses to touch a settings file it cannot parse', async () => {
  const broken = '{ "theme": "dark", ';
  const home = homeWithSettings(broken);
  const r = await cli(['install'], { home });
  assert.notEqual(r.code, 0);
  assert.equal(fs.readFileSync(settingsFile(home), 'utf8'), broken);
});

test('uninstall when not installed is a harmless no-op', async () => {
  const home = homeWithSettings(ORIGINAL);
  const r = await cli(['uninstall'], { home });
  assert.equal(r.code, 0);
  assert.equal(fs.readFileSync(settingsFile(home), 'utf8'), ORIGINAL);
});

test('unknown commands print usage', async () => {
  const r = await cli(['frobnicate'], { home: tempHome() });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /install/);
});
