export function tokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

export function duration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 && m < 5 ? `${m}m${String(s % 60).padStart(2, '0')}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h${String(m % 60).padStart(2, '0')}m` : `${h}h`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Local wall-clock time; adds the weekday when it is not within the next 24 hours.
export function clock(at, now) {
  const d = new Date(at);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return at - now < 24 * 3600_000 ? hm : `${DAYS[d.getDay()]} ${hm}`;
}
