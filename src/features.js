// Turns prompt text and tool inputs into privacy-safe features: keywords and paths only.

const STOPWORDS = new Set(
  `about above after again against also always another anything because been before being below between both
  cant could does doing done down during each else even every from further have having here into just like
  look looks make many maybe more most much must need only other over please really same should since some
  still such sure take than that their them then there these they thing things this those through want were
  what when where which while with within without would your yours again check sorry thanks okay right
  also using used just very well into onto upon will shall can't don't isn't it's let's`.split(/\s+/),
);

const MAX_KEYWORDS = 12;
const MAX_FILES = 20;

export function promptText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  if (content.some((b) => b?.type === 'tool_result')) return null;
  const texts = content.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text);
  return texts.length ? texts.join('\n') : null;
}

export function slashCommand(text) {
  const m = /<command-name>\s*(\/[\w:-]+)\s*<\/command-name>/.exec(text);
  return m ? m[1] : null;
}

export function normalizePath(p, cwd) {
  let s = String(p).replace(/\\/g, '/').toLowerCase();
  const base = cwd ? String(cwd).replace(/\\/g, '/').toLowerCase().replace(/\/$/, '') : null;
  if (base && s.startsWith(base + '/')) s = s.slice(base.length + 1);
  return s.replace(/^\.\//, '');
}

const PATHISH = /(?:[\w.-]+\/)+[\w.-]+|[\w-]+\.[a-z][a-z0-9]{0,5}\b/gi;

export function keywords(text) {
  const clean = text.replace(/<[^>]+>/g, ' ').toLowerCase();
  const counts = new Map();
  for (const w of clean.match(/[a-z][a-z0-9_-]{3,}/g) ?? []) {
    if (STOPWORDS.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_KEYWORDS)
    .map(([w]) => w);
}

export function pathsInText(text, cwd) {
  return [...new Set((text.match(PATHISH) ?? []).map((p) => normalizePath(p, cwd)))];
}

export function addFiles(record, files) {
  const set = new Set(record.files ?? []);
  for (const f of files) if (set.size < MAX_FILES) set.add(f);
  record.files = [...set];
}

export function toolPaths(input, cwd) {
  if (!input || typeof input !== 'object') return [];
  return ['file_path', 'notebook_path', 'path']
    .map((k) => input[k])
    .filter((v) => typeof v === 'string' && v)
    .map((v) => normalizePath(v, cwd));
}

const stem = (f) => f.split('/').pop().split('.')[0];
const dir = (f) => (f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '.');

// The comparable feature set of one prompt: keywords, file stems, files and their directories.
export function featureSet(record) {
  const out = new Set();
  for (const k of record.kw ?? []) out.add(`k:${k}`);
  for (const f of record.files ?? []) {
    out.add(`f:${f}`);
    out.add(`d:${dir(f)}`);
    for (const part of stem(f).split(/[-_.]/)) if (part.length >= 4) out.add(`k:${part}`);
  }
  return out;
}
