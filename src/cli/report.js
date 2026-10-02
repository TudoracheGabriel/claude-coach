import fs from 'node:fs';
import path from 'node:path';
import { readAdviceLog } from '../advice-log.js';
import { promptText, slashCommand } from '../features.js';
import { tokens as fmt } from '../format.js';

const DAY = 24 * 60 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const FOLLOW_TURNS = 3;
const NEW_SESSION_WINDOW = 10 * 60 * 1000;

// What counts as acting on each advice within the next few prompts.
const FOLLOWED = {
  'ctx-pressure': { commands: ['/compact', '/clear'], endsSession: true },
  drift: { commands: ['/clear'], endsSession: true },
  'rate-limit': { commands: ['/model', '/effort'] },
  'read-heavy': { tools: (t) => t.name === 'Agent' || t.name === 'Task' },
  uncommitted: { tools: (t) => t.name === 'Bash' && /\bgit\s+commit\b/.test(String(t.input?.command ?? '')) },
  'cache-expiry': { replyBeforeDeadline: true },
};

const contextTokens = (u) =>
  u && typeof u === 'object' ? (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0) : 0;

function transcriptFiles(home) {
  const root = path.join(home, '.claude', 'projects');
  const files = [];
  let projects = [];
  try {
    projects = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
  } catch {
    return files;
  }
  for (const p of projects) {
    try {
      for (const f of fs.readdirSync(path.join(root, p.name))) {
        if (f.endsWith('.jsonl')) files.push({ project: p.name, file: path.join(root, p.name, f), id: f.slice(0, -6) });
      }
    } catch {}
  }
  return files;
}

// One pass over a transcript: everything the report needs, nothing of the conversation text.
function summarize({ file, id, project }) {
  const s = { id, project, first: null, last: null, autoCompact: false, peak: 0, rebuild: 0, ttl1h: false, prompts: [], tools: [] };
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const seenMessages = new Set();
  let lastAssistantAt = null;
  let current = null;
  for (const line of text.split('\n')) {
    if (!line) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (!e || typeof e !== 'object' || e.isSidechain) continue;
    const at = Date.parse(e.timestamp);
    if (Number.isFinite(at)) {
      s.first = s.first === null ? at : Math.min(s.first, at);
      s.last = s.last === null ? at : Math.max(s.last, at);
    }
    if (e.type === 'system' && e.subtype === 'compact_boundary' && e.compactMetadata?.trigger === 'auto') s.autoCompact = true;
    if (e.type === 'user' && typeof e.promptId === 'string') {
      current = e.promptId;
      const t = e.isMeta || e.isCompactSummary ? null : promptText(e.message?.content);
      if (t && !s.prompts.some((p) => p.id === e.promptId)) s.prompts.push({ id: e.promptId, at, cmd: slashCommand(t) });
    }
    if (e.type === 'assistant' && e.message) {
      const usage = e.message.usage;
      s.peak = Math.max(s.peak, contextTokens(usage));
      if (usage?.cache_creation?.ephemeral_1h_input_tokens > 0) s.ttl1h = true;
      const msgId = e.message.id ?? e.uuid;
      if (!seenMessages.has(msgId) && Number.isFinite(at)) {
        seenMessages.add(msgId);
        const ttl = s.ttl1h ? ONE_HOUR : FIVE_MIN;
        if (lastAssistantAt !== null && at - lastAssistantAt > ttl) s.rebuild += usage?.cache_creation_input_tokens || 0;
        lastAssistantAt = at;
      }
      for (const b of Array.isArray(e.message.content) ? e.message.content : []) {
        if (b?.type === 'tool_use') s.tools.push({ promptId: current, at, name: b.name, input: b.input });
      }
    }
  }
  return s.first === null ? null : s;
}

function followed(entry, session, sessions) {
  const rule = FOLLOWED[entry.advice];
  if (!rule || !session) return null;
  let idx = session.prompts.findIndex((p) => p.id === entry.promptId);
  if (idx < 0) idx = session.prompts.findIndex((p) => p.at > entry.at) - 1;
  if (idx < -1) idx = session.prompts.length - 1;
  const next = session.prompts.slice(idx + 1, idx + 1 + FOLLOW_TURNS);
  if (rule.commands && next.some((p) => p.cmd && rule.commands.includes(p.cmd))) return true;
  if (rule.tools) {
    const window = new Set([session.prompts[idx]?.id, ...next.map((p) => p.id)]);
    if (session.tools.some((t) => window.has(t.promptId) && t.at >= entry.at && rule.tools(t))) return true;
  }
  if (rule.replyBeforeDeadline) return Boolean(next[0] && entry.deadline && next[0].at <= entry.deadline);
  if (rule.endsSession && next.length === 0) {
    return sessions.some((o) => o.project === session.project && o.id !== session.id && o.first >= session.last && o.first - session.last < NEW_SESSION_WINDOW);
  }
  return false;
}

const pct = (a, b) => `${a} / ${b} (${b ? Math.round((a / b) * 100) : 0}%)`;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const day = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function parseDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v ?? '')) return null;
  const t = Date.parse(`${v}T00:00:00`);
  return Number.isFinite(t) ? t : null;
}

export function report(home, argv, now) {
  const opts = { since: null, until: null };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (key !== 'since' && key !== 'until') return { code: 1, output: `Unknown option: ${argv[i]}\nUsage: claude-coach report [--since YYYY-MM-DD] [--until YYYY-MM-DD]` };
    const value = parseDate(argv[++i]);
    if (value === null) return { code: 1, output: `--${key} needs a date as YYYY-MM-DD` };
    opts[key] = value;
  }
  const since = opts.since ?? now - 14 * DAY;
  // --until names the last day included.
  const until = opts.until === null ? now + DAY : opts.until + DAY;

  const all = transcriptFiles(home).map(summarize).filter(Boolean);
  const sessions = all.filter((s) => s.first >= since && s.first < until);
  const range = `${day(since)} to ${day(Math.min(until - 1, now))}`;
  if (!sessions.length) return { code: 0, output: `No sessions found in ~/.claude/projects from ${range}.` };

  const byId = new Map(all.map((s) => [s.id, s]));
  const advice = readAdviceLog(home).filter((e) => e.at >= since && e.at < until && FOLLOWED[e.advice]);
  const verdicts = advice.map((e) => followed(e, byId.get(e.session), all)).filter((v) => v !== null);
  const rebuild = sessions.reduce((n, s) => n + s.rebuild, 0);
  const peaks = sessions.map((s) => s.peak);

  const rows = [
    ['Sessions reaching auto-compact', pct(sessions.filter((s) => s.autoCompact).length, sessions.length)],
    ['Cache rebuilt after expiry', `${fmt(Math.round(rebuild / sessions.length))} tokens per session (${fmt(rebuild)} total)`],
    ['Advice followed within 3 turns', verdicts.length ? pct(verdicts.filter(Boolean).length, verdicts.length) : 'no advice logged in this period'],
    ['Peak context', `median ${fmt(Math.round(median(peaks)))}, max ${fmt(Math.max(...peaks))}`],
  ];
  const width = Math.max(...rows.map(([k]) => k.length));
  const n = sessions.length;
  return {
    code: 0,
    output: [`claude-coach report, ${range} (${n} session${n === 1 ? '' : 's'})`, '', ...rows.map(([k, v]) => `${k.padEnd(width)}  ${v}`)].join('\n'),
  };
}
