import fs from 'node:fs';
import path from 'node:path';

const VERSION = 1;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const GC_EVERY_MS = 60 * 60 * 1000;

export const coachDir = (home) => path.join(home, '.claude', 'coach');
const sessionsDir = (home) => path.join(coachDir(home), 'sessions');
const safeName = (id) => id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);

export function fresh() {
  return { v: VERSION, isNew: true, lastGcAt: 0, firing: [], shownInEpisode: [], clearedAt: {}, lastShown: null };
}

export function loadState(home, sessionId) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(sessionsDir(home), `${safeName(sessionId)}.json`), 'utf8'));
    if (raw && raw.v === VERSION) return { ...fresh(), ...raw, isNew: false };
  } catch {}
  return fresh();
}

// Atomic: write a temp file then rename over the old one, so a cancelled run never leaves half a file.
export function saveState(home, sessionId, state) {
  const dir = sessionsDir(home);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${safeName(sessionId)}.json`);
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  const { isNew, ...persisted } = state;
  fs.writeFileSync(tmp, JSON.stringify(persisted));
  try {
    fs.renameSync(tmp, file);
  } catch {
    fs.rmSync(tmp, { force: true });
  }
}

export function collectGarbage(home, sessionId, state, now) {
  if (!state.isNew && now - state.lastGcAt < GC_EVERY_MS) return;
  state.lastGcAt = now;
  const own = safeName(sessionId);
  for (const dir of [sessionsDir(home), path.join(coachDir(home), 'wrap')]) {
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (name.startsWith(`${own}.`)) continue;
      const file = path.join(dir, name);
      try {
        if (now - fs.statSync(file).mtimeMs > MAX_AGE_MS) fs.rmSync(file, { force: true });
      } catch {}
    }
  }
}
