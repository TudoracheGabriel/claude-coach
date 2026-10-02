import { normalize } from './normalize.js';
import { DEFAULTS } from './defaults.js';
import { loadState, saveState, collectGarbage } from './state.js';
import { readTranscript, promptRecord } from './transcript.js';
import { rank } from './rank.js';
import { ctxPressure } from './detectors/ctx-pressure.js';
import { ctxSpike } from './detectors/ctx-spike.js';
import { cacheExpiry } from './detectors/cache-expiry.js';
import { rateLimit } from './detectors/rate-limit.js';
import { readHeavy } from './detectors/read-heavy.js';
import { renderAdvice, renderHealthy, FALLBACK } from './render.js';

const DETECTORS = [ctxPressure, ctxSpike, cacheExpiry, rateLimit, readHeavy];

function parse(stdinText) {
  try {
    const input = JSON.parse(stdinText);
    return input && typeof input === 'object' && !Array.isArray(input) ? input : null;
  } catch {
    return null;
  }
}

function safeReadTranscript(path, previous) {
  try {
    return readTranscript(path, previous);
  } catch {
    return readTranscript(null, null);
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

  const transcript = safeReadTranscript(snap.transcriptPath, state.transcript);
  const promptId = snap.promptId ?? transcript.current;
  if (promptId && snap.tokens !== null) promptRecord(transcript, promptId).end = snap.tokens;
  state.transcript = transcript;

  const ctx = { snap, now, home, state, transcript };
  const advice = rank(DETECTORS, ctx, state, config);
  try {
    collectGarbage(home, snap.sessionId, state, now);
    saveState(home, snap.sessionId, state);
  } catch {}
  return advice ? renderAdvice(advice, snap, { now, columns }) : renderHealthy(snap, columns);
}
