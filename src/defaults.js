export const DEFAULTS = {
  detectors: {
    'ctx-pressure': { enabled: true, enterTokens: 150_000, exitTokens: 140_000, enterPercent: 85, cooldownMin: 10 },
    'cache-expiry': { enabled: true, warnSeconds: 120, minRecacheTokens: 20_000, cooldownMin: 0 },
    'rate-limit': { enabled: true, enterPercent: 80, exitPercent: 75, cooldownMin: 30 },
  },
};
