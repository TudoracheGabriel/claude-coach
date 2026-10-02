import { normalize } from './normalize.js';
import { loadConfig } from './config.js';
import { loadState, saveState, collectGarbage } from './state.js';
import { readTranscript, promptRecord } from './transcript.js';
import { rank } from './rank.js';
import { ctxPressure } from './detectors/ctx-pressure.js';
import { ctxSpike } from './detectors/ctx-spike.js';
import { cacheExpiry } from './detectors/cache-expiry.js';
import { rateLimit } from './detectors/rate-limit.js';
import { readHeavy } from './detectors/read-heavy.js';
import { drift } from './detectors/drift.js';
import { uncommitted } from './detectors/uncommitted.js';
import { gitDirty } from './git.js';
import { wrapped } from './wrap.js';
import { readInstall } from './cli/install.js';
import { logAdvice } from './advice-log.js';
import { capture } from './capture.js';
import { renderAdvice, renderHealthy, FALLBACK } from './render.js';

const DETECTORS = [ctxPressure, ctxSpike, cacheExpiry, rateLimit, readHeavy, drift, uncommitted];

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
/** @param {string} stdinText @param {{ home: string, now?: number, columns?: number, capture?: boolean }} env */
export async function run(stdinText, env) {
  const { home, now = Date.now(), columns = 120, capture: capturing = false } = env;
  const input = parse(stdinText);
  if (!input) return FALLBACK;
  const snap = normalize(input);
  const config = loadConfig(home);
  const state = loadState(home, snap.sessionId);
  const previousCommand = readInstall(home)?.previousStatusLine?.command;
  const above = typeof previousCommand === 'string' && previousCommand
    ? wrapped(previousCommand, stdinText, { home, sessionId: snap.sessionId, timeoutMs: config.wrap.timeoutMs }).catch(() => null)
    : Promise.resolve(null);

  const transcript = safeReadTranscript(snap.transcriptPath, state.transcript);
  const promptId = snap.promptId ?? transcript.current;
  if (promptId && snap.tokens !== null) promptRecord(transcript, promptId).end = snap.tokens;
  state.transcript = transcript;

  const commitOpts = config.detectors.uncommitted;
  const wantGit = commitOpts.enabled && snap.tokens !== null && snap.tokens >= commitOpts.minTokens;
  const git = { dirty: wantGit ? await gitDirty(state, snap.cwd, now, config.git) : null };

  const ctx = { snap, now, home, state, transcript, git };
  const advice = rank(DETECTORS, ctx, state, config);
  const shownId = advice?.id ?? null;
  if (shownId && shownId !== state.lastShown) {
    const deadline = shownId === 'cache-expiry' ? snap.cache?.expiresAt ?? null : null;
    logAdvice(home, { at: now, session: snap.sessionId, advice: shownId, promptId, ...(deadline && { deadline }) });
  }
  state.lastShown = shownId;
  try {
    if (capturing || config.capture) capture(home, stdinText, snap, state, now);
  } catch {}
  try {
    collectGarbage(home, snap.sessionId, state, now);
    saveState(home, snap.sessionId, state);
  } catch {}
  const coachText = advice ? renderAdvice(advice, snap, { now, columns }) : renderHealthy(snap, columns);
  const previous = await above;
  return previous ? `${previous}\n${coachText}` : coachText;
}
