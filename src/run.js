import { normalize } from './normalize.js';
import { DEFAULTS } from './defaults.js';
import { ctxPressure } from './detectors/ctx-pressure.js';
import { renderAdvice, renderHealthy, FALLBACK } from './render.js';

const DETECTORS = [ctxPressure];

// Seam A: stdin text + environment in, status line text out. Never throws.
/** @param {string} stdinText @param {{ home: string, now?: number, columns?: number }} env */
export async function run(stdinText, env) {
  const { home, now = Date.now(), columns = 120 } = env;
  let input;
  try {
    input = JSON.parse(stdinText);
  } catch {
    return FALLBACK;
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return FALLBACK;
  const snap = normalize(input);
  const ctx = { snap, now, home, columns };
  const proposals = [];
  for (const d of DETECTORS) {
    const opts = DEFAULTS.detectors[d.id];
    const p = d.detect(ctx, opts);
    if (p) proposals.push({ id: d.id, ...p });
  }
  proposals.sort((a, b) => b.urgency - a.urgency);
  return proposals.length ? renderAdvice(proposals[0]) : renderHealthy(snap);
}
