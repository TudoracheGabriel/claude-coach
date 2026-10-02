import { ctxPressure } from './ctx-pressure.js';
import { ctxSpike } from './ctx-spike.js';
import { cacheExpiry } from './cache-expiry.js';
import { rateLimit } from './rate-limit.js';
import { readHeavy } from './read-heavy.js';
import { drift } from './drift.js';
import { uncommitted } from './uncommitted.js';

// Order breaks urgency ties: earlier wins.
export const DETECTORS = [ctxPressure, ctxSpike, cacheExpiry, rateLimit, readHeavy, drift, uncommitted];
