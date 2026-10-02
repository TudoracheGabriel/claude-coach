import { clock } from '../format.js';

export const rateLimit = {
  id: 'rate-limit',
  detect({ snap, now }, opts, active) {
    const min = active ? opts.exitPercent : opts.enterPercent;
    const windows = [
      ['5-hour', snap.limits.fiveHour],
      ['weekly', snap.limits.sevenDay],
    ].filter(([, w]) => w && w.usedPercentage >= min);
    if (!windows.length) return null;
    const [name, w] = windows.reduce((a, b) => (b[1].usedPercentage > a[1].usedPercentage ? b : a));
    const pct = Math.round(w.usedPercentage);
    const resets = w.resetsAt === null ? '' : `, resets ${clock(w.resetsAt, now)}`;
    return {
      action: 'Lower /effort or use a cheaper /model for routine work',
      urgency: Math.min(85, 55 + Math.max(0, pct - opts.enterPercent) * 1.5),
      reason: `${name} limit ${pct}% used${resets}.`,
    };
  },
};
