import fs from 'node:fs';

const MAX_PROMPTS = 30;
const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead']);

export function emptyTranscript(path = null) {
  return { path, offset: 0, current: null, compactions: 0, prompts: [] };
}

export function promptRecord(t, id) {
  let p = t.prompts.find((x) => x.id === id);
  if (!p) {
    p = { id, end: null, reads: 0, others: 0 };
    t.prompts.push(p);
    if (t.prompts.length > MAX_PROMPTS) t.prompts.splice(0, t.prompts.length - MAX_PROMPTS);
  }
  return p;
}

const contextTokens = (u) =>
  u && typeof u === 'object'
    ? (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0)
    : null;

function apply(t, e) {
  if (!e || typeof e !== 'object' || e.isSidechain) return;
  if (e.type === 'user' && typeof e.promptId === 'string') {
    promptRecord(t, e.promptId);
    t.current = e.promptId;
  } else if (e.type === 'assistant' && t.current) {
    const p = promptRecord(t, t.current);
    const tokens = contextTokens(e.message?.usage);
    if (tokens) p.end = tokens;
    const content = Array.isArray(e.message?.content) ? e.message.content : [];
    for (const block of content) {
      if (block?.type !== 'tool_use') continue;
      if (READ_TOOLS.has(block.name)) p.reads++;
      else p.others++;
    }
  } else if (e.type === 'system' && e.subtype === 'compact_boundary') {
    t.compactions++;
  }
}

// Only these entry types carry anything we use; checking the raw line first skips JSON.parse
// on the (often huge) attachment, snapshot and tool-result-only lines.
const INTERESTING = /"type":"(user|assistant|system)"/;

// Parses only the bytes appended since the last run. Starts over if the file is new or shrank.
export function readTranscript(path, previous) {
  let t = previous && previous.path === path ? previous : emptyTranscript(path);
  if (!path) return t;
  let fd;
  try {
    fd = fs.openSync(path, 'r');
  } catch {
    return t;
  }
  try {
    const size = fs.fstatSync(fd).size;
    if (size < t.offset) t = emptyTranscript(path);
    if (size === t.offset) return t;
    const buf = Buffer.allocUnsafe(size - t.offset);
    const read = fs.readSync(fd, buf, 0, buf.length, t.offset);
    const end = buf.lastIndexOf(0x0a, read - 1);
    if (end < 0) return t;
    for (const line of buf.toString('utf8', 0, end).split('\n')) {
      if (!INTERESTING.test(line)) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      apply(t, entry);
    }
    t.offset += end + 1;
    return t;
  } finally {
    fs.closeSync(fd);
  }
}
