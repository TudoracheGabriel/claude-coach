import fs from 'node:fs';
import path from 'node:path';
import { coachDir } from './state.js';

const TAIL_LINES = 300;
const TAIL_BYTES = 4 * 1024 * 1024;
const MIN_INTERVAL_MS = 60_000;

// String values under these keys are structural (ids, names, paths, enums) and are kept.
// Every other string, which is where prompt text, code and answers live, is replaced.
const KEEP = new Set([
  'type', 'subtype', 'uuid', 'parentUuid', 'promptId', 'prompt_id', 'sessionId', 'session_id', 'timestamp', 'name', 'id',
  'tool_use_id', 'model', 'role', 'file_path', 'path', 'notebook_path', 'version', 'stop_reason', 'cwd', 'current_dir',
  'project_dir', 'transcript_path', 'gitBranch', 'trigger', 'level', 'entrypoint', 'userType', 'requestId', 'messageId',
  'operation', 'ttl', 'mode', 'speed', 'service_tier', 'display_name', 'subagent_type', 'permissionMode',
]);

// Replaces the home folder in every spelling Claude Code uses, including the
// dash-encoded project folder names under ~/.claude/projects.
function anonymize(s, home) {
  if (!home) return s;
  for (const form of [home, home.replace(/\\/g, '/'), home.replace(/\\/g, '\\\\'), home.replace(/[:\\/]/g, '-')]) {
    s = s.split(form).join('~');
  }
  // Any other spelling (e.g. Git Bash's /c/Users/name) still carries the account name.
  const user = home.split(/[\\/]/).filter(Boolean).pop();
  return user && user.length >= 3 ? s.split(user).join('user') : s;
}

export function scrub(value, home, key = '') {
  if (typeof value === 'string') return KEEP.has(key) ? anonymize(value, home) : `[scrubbed ${value.length} chars]`;
  if (Array.isArray(value)) return value.map((v) => scrub(v, home, key));
  if (value && typeof value === 'object') {
    const out = {};
    let n = 0;
    for (const [k, v] of Object.entries(value)) {
      // Keys are normally identifiers or paths; prose keys (e.g. question -> answer maps) are content.
      const prose = /\s/.test(k) && !/^(?:[a-zA-Z]:[\\/]|[~\\/])/.test(k);
      out[prose ? `[scrubbed key ${++n}]` : anonymize(k, home)] = scrub(v, home, k);
    }
    return out;
  }
  return value;
}

function tail(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - TAIL_BYTES);
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    const lines = buf.toString('utf8').split('\n').filter(Boolean);
    return (start > 0 ? lines.slice(1) : lines).slice(-TAIL_LINES);
  } finally {
    fs.closeSync(fd);
  }
}

// Saves this run's stdin and a scrubbed transcript tail as test fixtures. At most once a minute per session.
export function capture(home, stdinText, snap, state, now) {
  if (state.lastCaptureAt && now - state.lastCaptureAt < MIN_INTERVAL_MS) return;
  state.lastCaptureAt = now;
  const dir = path.join(coachDir(home), 'captures');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
  const base = path.join(dir, `${stamp}-${snap.sessionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}`);
  let input = null;
  try {
    input = JSON.parse(stdinText);
  } catch {}
  const stdinOut = input ? JSON.stringify(scrubStdin(input, home), null, 2) : JSON.stringify({ unparseable: stdinText.length });
  fs.writeFileSync(`${base}.stdin.json`, stdinOut);
  if (!snap.transcriptPath) return;
  try {
    const lines = tail(snap.transcriptPath).map((l) => {
      try {
        return JSON.stringify(scrub(JSON.parse(l), home));
      } catch {
        return JSON.stringify({ unparseable: l.length });
      }
    });
    fs.writeFileSync(`${base}.transcript.jsonl`, lines.join('\n') + '\n');
  } catch {}
}

// Stdin carries no conversation text, but names and repo details can be personal: keep numbers,
// booleans and structural strings, drop the rest.
function scrubStdin(input, home) {
  const keepAll = new Set(['context_window', 'rate_limits', 'prompt_cache', 'cost', 'effort', 'model', 'exceeds_200k_tokens', 'version']);
  const out = {};
  for (const [k, v] of Object.entries(input)) out[k] = keepAll.has(k) ? v : scrub(v, home, k);
  return out;
}
