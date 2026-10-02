import { tokens as fmt } from '../format.js';

export const ctxPressure = {
  id: 'ctx-pressure',
  detect({ snap }, opts) {
    if (snap.tokens === null) return null;
    if (snap.tokens < opts.enterTokens) return null;
    return {
      action: 'Run /compact',
      urgency: 60,
      reason: `${fmt(snap.tokens)} tokens in context; answers get less sharp in long contexts.`,
    };
  },
};
