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
  source: 'docs.claude.com/en/docs/build-with-claude/prompt-caching (TTL, write vs read price)',
  explain({ snap, now }, opts) {
    const c = snap.cache;
    let reading = 'no cache data';
    if (c && !c.warm) reading = 'cache cold';
    else if (c && c.expiresAt !== null) reading = `cache warm, ${duration(Math.max(0, c.expiresAt - now))} left`;
    else if (c) reading = 'cache warm';
    if (c?.recacheTokens != null) reading += `, rebuild ${fmt(c.recacheTokens)}`;
    return { reading, trigger: `≤${duration(opts.warnSeconds * 1000)} left & rebuild ≥${fmt(opts.minRecacheTokens)}` };
  },
};
