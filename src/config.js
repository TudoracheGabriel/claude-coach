import fs from 'node:fs';
import path from 'node:path';
import { DEFAULTS } from './defaults.js';
import { coachDir } from './state.js';

export const configPath = (home) => path.join(coachDir(home), 'config.json');

// A user value is taken only when it has the same type as the default it replaces.
function merge(defaults, user) {
  if (!user || typeof user !== 'object' || Array.isArray(user)) return defaults;
  const out = { ...defaults };
  for (const [k, v] of Object.entries(defaults)) {
    if (!(k in user)) continue;
    if (v && typeof v === 'object') out[k] = merge(v, user[k]);
    else if (typeof user[k] === typeof v && (typeof v !== 'number' || Number.isFinite(user[k]))) out[k] = user[k];
  }
  return out;
}

// When only the enter level is overridden, move the exit level with it so hysteresis keeps its shape.
function scaleExits(opts, defaults, user) {
  for (const key of Object.keys(opts)) {
    if (!key.startsWith('enter')) continue;
    const exit = `exit${key.slice(5)}`;
    if (!(exit in opts) || (user && exit in user) || opts[key] === defaults[key]) continue;
    const ratio = defaults[exit] / defaults[key];
    opts[exit] = Number.isInteger(defaults[exit]) ? Math.round(opts[key] * ratio) : opts[key] * ratio;
  }
  for (const [max, exit] of [['maxOverlap', 'exitOverlap']]) {
    if (max in opts && exit in opts && !(user && exit in user) && opts[max] !== defaults[max]) {
      opts[exit] = opts[max] * (defaults[exit] / defaults[max]);
    }
  }
  return opts;
}

export function loadConfig(home) {
  let user = null;
  try {
    user = JSON.parse(fs.readFileSync(configPath(home), 'utf8'));
  } catch {
    return DEFAULTS;
  }
  const config = merge(DEFAULTS, user);
  for (const id of Object.keys(config.detectors)) {
    scaleExits(config.detectors[id], DEFAULTS.detectors[id], user?.detectors?.[id]);
  }
  return config;
}
