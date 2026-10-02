import { tokens as fmt, duration } from '../format.js';

export const cacheExpiry = {
  id: 'cache-expiry',
  detect({ snap, now }, opts) {
    const c = snap.cache;
    if (!c || !c.warm || c.expiresAt === null) return null;
    const left = c.expiresAt - now;
    if (left <= 0 || left > opts.warnSeconds * 1000) return null;
    if (c.recacheTokens !== null && c.recacheTokens < opts.minRecacheTokens) return null;
    const cost = c.recacheTokens === null ? 'the whole context' : `${fmt(c.recacheTokens)} tokens`;
    return {
      action: `Reply within ${duration(left)}`,
      urgency: 75,
      reason: `the prompt cache then expires and the next turn re-caches ${cost}.`,
    };
  },
};
