export const DEFAULTS = {
  detectors: {
    'ctx-pressure': { enabled: true, enterTokens: 150_000, exitTokens: 140_000, enterPercent: 85, cooldownMin: 10 },
    'ctx-spike': { enabled: true, enterTokens: 40_000, exitTokens: 35_000, cooldownMin: 0 },
    'cache-expiry': { enabled: true, warnSeconds: 120, minRecacheTokens: 20_000, cooldownMin: 0 },
    'rate-limit': { enabled: true, enterPercent: 80, exitPercent: 75, cooldownMin: 30 },
    drift: { enabled: true, maxOverlap: 0.15, exitOverlap: 0.25, minTokens: 60_000, minFeatures: 4, minPriorPrompts: 2, cooldownMin: 10 },
    uncommitted: { enabled: true, enterFiles: 10, exitFiles: 8, minTokens: 100_000, cooldownMin: 15 },
    'read-heavy': { enabled: true, enterCalls: 15, exitCalls: 12, turns: 5, minReadShare: 0.6, minTokens: 40_000, cooldownMin: 15 },
  },
  git: { timeoutMs: 300, cacheSeconds: 5 },
  wrap: { timeoutMs: 150 },
};
