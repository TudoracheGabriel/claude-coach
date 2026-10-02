import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { coachDir } from './state.js';

const STALE_MS = 2 * 60_000;
const LOCK_MS = 10_000;

// Claude Code itself runs status line commands through Git Bash on Windows when it is installed.
function posixShell(env) {
  if (process.platform !== 'win32') return '/bin/sh';
  const candidates = [
    env.CLAUDE_CODE_GIT_BASH_PATH,
    'C:/Program Files/Git/bin/bash.exe',
    'C:/Program Files (x86)/Git/bin/bash.exe',
    env.LOCALAPPDATA && `${env.LOCALAPPDATA}/Programs/Git/bin/bash.exe`,
  ];
  return candidates.find((p) => p && fs.existsSync(p)) ?? null;
}

const fwd = (p) => p.replace(/\\/g, '/');

function readFresh(file, now) {
  try {
    if (now - fs.statSync(file).mtimeMs > STALE_MS) return null;
    const text = fs.readFileSync(file, 'utf8').replace(/\s+$/, '');
    return text || null;
  } catch {
    return null;
  }
}

// Runs the user's previous status line command with the same stdin. Output that arrives within
// the timeout is shown now. A slower command keeps running in the background and writes its
// output to a cache file, so later runs can show its last finished result instead of nothing.
// `now` is wall-clock time here: it is compared with file modification times.
export async function wrapped(command, stdinText, { home, sessionId, timeoutMs, env = process.env }) {
  const now = Date.now();
  const shell = posixShell(env);
  const dir = path.join(coachDir(home), 'wrap');
  const name = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const out = path.join(dir, `${name}.out`);
  const lock = path.join(dir, `${name}.lock`);
  const tmp = path.join(dir, `${name}.${process.pid}.tmp`);

  if (!shell) return foreground(command, stdinText, timeoutMs);

  try {
    fs.mkdirSync(dir, { recursive: true });
    if (now - fs.statSync(lock).mtimeMs < LOCK_MS) return readFresh(out, now);
  } catch {}

  try {
    fs.writeFileSync(lock, '');
    const script = `(${command}) > "$COACH_TMP" 2>/dev/null; mv -f "$COACH_TMP" "$COACH_OUT"; rm -f "$COACH_LOCK"`;
    const child = spawn(shell, ['-c', script], {
      detached: true,
      stdio: ['pipe', 'ignore', 'ignore'],
      windowsHide: true,
      env: { ...env, COACH_TMP: fwd(tmp), COACH_OUT: fwd(out), COACH_LOCK: fwd(lock) },
    });
    child.on('error', () => {});
    child.stdin.on('error', () => {});
    child.stdin.end(stdinText);
    const finished = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      child.on('exit', () => {
        clearTimeout(timer);
        resolve(true);
      });
      child.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
    child.unref();
    if (!finished) return readFresh(out, now);
    return readFresh(out, Date.now());
  } catch {
    return readFresh(out, now);
  }
}

function foreground(command, stdinText, timeoutMs) {
  return new Promise((resolve) => {
    let stdout = '';
    let done = false;
    const finish = (v) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    try {
      const child = spawn(command, { shell: true, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
      const timer = setTimeout(() => {
        child.kill();
        finish(null);
      }, timeoutMs);
      child.stdout.on('data', (c) => (stdout += c));
      child.on('error', () => finish(null));
      child.on('close', () => {
        clearTimeout(timer);
        finish(stdout.replace(/\s+$/, '') || null);
      });
      child.stdin.on('error', () => {});
      child.stdin.end(stdinText);
    } catch {
      finish(null);
    }
  });
}
