import { tokens as fmt } from './format.js';

export function renderHealthy(snap) {
  if (snap.tokens === null) return 'Coach: session healthy, no context used yet.';
  return `Coach: session healthy (${fmt(snap.tokens)} in context), keep going.`;
}

export function renderAdvice(advice) {
  return `${advice.action}: ${advice.reason}`;
}

export const FALLBACK = 'Coach: waiting for session data.';
