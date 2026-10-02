import { tokens as fmt } from '../format.js';

export const ctxPressure = {
  id: 'ctx-pressure',
  detect({ snap }, opts, active) {
    if (snap.tokens === null) return null;
    const minTokens = active ? opts.exitTokens : opts.enterTokens;
    const minPercent = active ? opts.enterPercent - 5 : opts.enterPercent;
    if (snap.tokens < minTokens && (snap.percent ?? 0) < minPercent) return null;
    const over = Math.max(0, snap.tokens - opts.enterTokens) / opts.enterTokens;
    return {
      action: 'Run /compact',
      urgency: Math.min(90, 60 + Math.round(over * 100)),
      reason: `${fmt(snap.tokens)} tokens in context; answers get less sharp in long contexts.`,
    };
  },
};
