import { tokens as fmt, duration } from './format.js';

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';

export const FALLBACK = 'Coach: waiting for session data.';

const ANSI = /\x1b\[[0-9;]*m/g;

// Truncates to `columns` visible characters; ANSI codes don't count towards the width.
export function fit(line, columns) {
  const plain = line.replace(ANSI, '');
  const chars = [...plain];
  if (chars.length <= columns) return line;
  const keep = Math.max(0, columns - 1);
  let out = '';
  let seen = 0;
  for (const part of line.split(/(\x1b\[[0-9;]*m)/)) {
    if (part.startsWith('\x1b[')) {
      out += part;
      continue;
    }
    const take = [...part].slice(0, Math.max(0, keep - seen));
    out += take.join('');
    seen += take.length;
  }
  return out + (columns > 0 ? '…' : '') + (line.includes('\x1b[') ? RESET : '');
}

function metrics(snap, now) {
  const parts = [];
  if (snap.model) parts.push(snap.model);
  if (snap.tokens !== null) parts.push(`${fmt(snap.tokens)}/${fmt(snap.windowSize)} (${Math.round(snap.percent)}%)`);
  if (snap.cache?.warm) {
    const left = snap.cache.expiresAt === null ? null : snap.cache.expiresAt - now;
    parts.push(left !== null && left > 0 ? `cache warm ${duration(left)}` : 'cache warm');
  }
  if (snap.limits.fiveHour) parts.push(`5h ${Math.round(snap.limits.fiveHour.usedPercentage)}%`);
  if (snap.limits.sevenDay) parts.push(`7d ${Math.round(snap.limits.sevenDay.usedPercentage)}%`);
  if (snap.effort) parts.push(`effort ${snap.effort}`);
  return parts.join(' · ');
}

export function renderHealthy(snap, columns) {
  const text = snap.tokens === null
    ? 'Session healthy, keep going.'
    : `Session healthy (${fmt(snap.tokens)} in context), keep going.`;
  return fit(`${GREEN}${text}${RESET}`, columns);
}

// Three levels: a calm tip (< 50), a warning (50-69) and urgent (>= 70).
export const level = (urgency) => (urgency >= 70 ? 'urgent' : urgency >= 50 ? 'warn' : 'tip');

export function renderAdvice(advice, snap, { now, columns }) {
  const top = fit(`${DIM}${metrics(snap, now)}${RESET}`, columns);
  const head = {
    tip: `${CYAN}Tip: ${advice.action}${RESET}`,
    warn: `${YELLOW}▲ ${advice.action}${RESET}`,
    urgent: `${RED}▲ ${advice.action}${RESET}`,
  }[level(advice.urgency)];
  const bottom = fit(`${head} — ${advice.reason}`, columns);
  return `${top}\n${bottom}`;
}
