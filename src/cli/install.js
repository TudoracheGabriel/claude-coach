import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { coachDir } from '../state.js';

const PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const REFRESH_SECONDS = 15;

const settingsPath = (home) => path.join(home, '.claude', 'settings.json');
const installPath = (home) => path.join(coachDir(home), 'install.json');
const backupPath = (home) => path.join(coachDir(home), 'settings.backup.json');
const appDir = (home) => path.join(coachDir(home), 'app');

export function readInstall(home) {
  try {
    return JSON.parse(fs.readFileSync(installPath(home), 'utf8'));
  } catch {
    return null;
  }
}

function readSettings(home) {
  let text;
  try {
    text = fs.readFileSync(settingsPath(home), 'utf8');
  } catch {
    return { exists: false, text: null, value: {} };
  }
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('settings.json is not a JSON object');
  return { exists: true, text, value };
}

function writeSettings(home, value, like) {
  const eol = like && like.includes('\r\n') ? '\r\n' : '\n';
  const text = JSON.stringify(value, null, 2).replace(/\n/g, eol) + eol;
  fs.mkdirSync(path.dirname(settingsPath(home)), { recursive: true });
  fs.writeFileSync(settingsPath(home), text);
}

// Copies the running package into the coach folder so the status line keeps working
// after npx clears its cache.
function copyApp(home) {
  const dest = appDir(home);
  const script = path.join(dest, 'bin', 'claude-coach.js').replace(/\\/g, '/');
  if (path.resolve(PACKAGE_ROOT) === path.resolve(dest)) return script;
  fs.rmSync(dest, { recursive: true, force: true });
  for (const part of ['bin', 'src', 'package.json']) {
    fs.cpSync(path.join(PACKAGE_ROOT, part), path.join(dest, part), { recursive: true });
  }
  return script;
}

// Our own command, as written by install or run through npx: never wrap the coach inside itself.
const OUR_COMMAND = /(?:[\\/]bin[\\/]claude-coach\.js"?|(?:^|\s)(?:npx\s+(?:-y\s+)?)?claude-coach)\s*$/;
const isOurs = (statusLine) => typeof statusLine?.command === 'string' && OUR_COMMAND.test(statusLine.command.trim());

export function install(home) {
  let settings;
  try {
    settings = readSettings(home);
  } catch (e) {
    return { code: 1, output: `Could not read ${settingsPath(home)} (${e.message}). Nothing was changed.` };
  }
  const previous = readInstall(home);
  fs.mkdirSync(coachDir(home), { recursive: true });

  if (!previous) {
    if (settings.exists) fs.writeFileSync(backupPath(home), settings.text);
    const prior = isOurs(settings.value.statusLine) ? null : settings.value.statusLine ?? null;
    fs.writeFileSync(installPath(home), JSON.stringify({ settingsExisted: settings.exists, previousStatusLine: prior }, null, 2));
  }

  const script = copyApp(home);
  const prior = (previous ?? readInstall(home))?.previousStatusLine;
  const statusLine = { type: 'command', command: `node "${script}"` };
  if (typeof prior?.padding === 'number') statusLine.padding = prior.padding;
  statusLine.refreshInterval = Math.min(REFRESH_SECONDS, typeof prior?.refreshInterval === 'number' ? prior.refreshInterval : REFRESH_SECONDS);
  writeSettings(home, { ...settings.value, statusLine }, settings.text);

  const lines = [`claude-coach installed. Status line: ${statusLine.command}`];
  if (!previous && settings.exists) lines.push(`Settings backup: ${backupPath(home)}`);
  if (prior?.command) lines.push(`Your previous status line (${prior.command}) is kept and shown above the advice.`);
  if (previous) lines.push('Already installed: refreshed the app files, kept the original backup.');
  return { code: 0, output: lines.join('\n') };
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const without = (obj, key) => {
  const { [key]: _, ...rest } = obj;
  return rest;
};

export function uninstall(home) {
  const record = readInstall(home);
  if (!record) return { code: 0, output: 'claude-coach is not installed; nothing to do.' };
  let settings;
  try {
    settings = readSettings(home);
  } catch (e) {
    return { code: 1, output: `Could not read ${settingsPath(home)} (${e.message}). Nothing was changed.` };
  }

  let backupText = null;
  try {
    backupText = fs.readFileSync(backupPath(home), 'utf8');
  } catch {}

  let note = 'Settings restored exactly as they were before install.';
  if (backupText !== null && sameJson(without(settings.value, 'statusLine'), without(JSON.parse(backupText), 'statusLine'))) {
    fs.writeFileSync(settingsPath(home), backupText);
  } else if (!record.settingsExisted && Object.keys(without(settings.value, 'statusLine')).length === 0) {
    fs.rmSync(settingsPath(home), { force: true });
  } else {
    const restored = record.previousStatusLine
      ? { ...settings.value, statusLine: record.previousStatusLine }
      : without(settings.value, 'statusLine');
    writeSettings(home, restored, settings.text);
    note = 'Settings changed since install, so only the status line was restored; your other changes are kept.';
  }

  for (const p of [appDir(home), path.join(coachDir(home), 'sessions'), installPath(home), backupPath(home)]) {
    fs.rmSync(p, { recursive: true, force: true });
  }
  return { code: 0, output: `claude-coach uninstalled. ${note}` };
}
