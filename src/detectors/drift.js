import { featureSet } from '../features.js';

// The latest prompt shares little with the session's working set (files, directories, keywords).
export const drift = {
  id: 'drift',
  detect({ snap, transcript }, opts, active) {
    if (snap.tokens === null || snap.tokens < opts.minTokens) return null;
    const prompts = transcript.prompts.filter((p) => !p.cmd);
    if (prompts.length < opts.minPriorPrompts + 1) return null;
    const latest = featureSet(prompts[prompts.length - 1]);
    if (latest.size < opts.minFeatures) return null;
    const working = new Set();
    for (const p of prompts.slice(-11, -1)) for (const f of featureSet(p)) working.add(f);
    if (working.size < opts.minFeatures) return null;
    let shared = 0;
    for (const f of latest) if (working.has(f)) shared++;
    const overlap = shared / latest.size;
    if (overlap >= (active ? opts.exitOverlap : opts.maxOverlap)) return null;
    return {
      action: 'New task? Run /clear first',
      urgency: 55,
      reason: 'this prompt shares almost nothing with the earlier work; leftover context can muddy the answers.',
    };
  },
};
