import { normalize } from './normalize.js';
import { DEFAULTS } from './defaults.js';
import { loadState, saveState, collectGarbage } from './state.js';
import { rank } from './rank.js';
import { ctxPressure } from './detectors/ctx-pressure.js';
import { cacheExpiry } from './detectors/cache-expiry.js';
import { rateLimit } from './detectors/rate-limit.js';
import { renderAdvice, renderHealthy, FALLBACK } from './render.js';

const DETECTORS = [ctxPressure, cacheExpiry, rateLimit];

function parse(stdinText) {
  try {
    const input = JSON.parse(stdinText);
    return input && typeof input === 'object' && !Array.isArray(input) ? input : null;
  } catch {
    return null;
  }
}

// Seam A: stdin text + environment in, status line text out. Never throws.
/** @param {string} stdinText @param {{ home: string, now?: number, columns?: number }} env */
export async function run(stdinText, env) {
  const { home, now = Date.now(), columns = 120 } = env;
  const input = parse(stdinText);
  if (!input) return FALLBACK;
  const snap = normalize(input);
  const config = DEFAULTS;
  const state = loadState(home, snap.sessionId);
  const ctx = { snap, now, home, state };
  const advice = rank(DETECTORS, ctx, state, config);
  try {
    collectGarbage(home, snap.sessionId, state, now);
    saveState(home, snap.sessionId, state);
  } catch {}
  return advice ? renderAdvice(advice, snap, { now, columns }) : renderHealthy(snap, columns);
}
