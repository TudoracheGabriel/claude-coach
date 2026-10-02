import { featureSet } from '../features.js';

// Share of the latest prompt's features (files, directories, keywords) found in the session's
// recent working set, or null when there is too little to compare.
function overlap(transcript, opts) {
  const prompts = transcript.prompts.filter((p) => !p.cmd);
  if (prompts.length < opts.minPriorPrompts + 1) return null;
  const latest = featureSet(prompts[prompts.length - 1]);
  if (latest.size < opts.minFeatures) return null;
  const working = new Set();
  for (const p of prompts.slice(-11, -1)) for (const f of featureSet(p)) working.add(f);
  if (working.size < opts.minFeatures) return null;
  let shared = 0;
  for (const f of latest) if (working.has(f)) shared++;
  return shared / latest.size;
}

// The latest prompt shares little with the earlier work. Shown only once Claude has finished its turn.
export const drift = {
  id: 'drift',
  detect({ snap, transcript }, opts, active) {
    if (transcript.turnEnded === false) return null;
    if (snap.tokens === null || snap.tokens < opts.minTokens) return null;
    const o = overlap(transcript, opts);
    if (o === null || o >= (active ? opts.exitOverlap : opts.maxOverlap)) return null;
    return {
      action: 'New task? Run /clear first',
      urgency: 55,
      reason: 'this prompt shares almost nothing with the earlier work; leftover context can muddy the answers.',
    };
  },
  afterTurn: true,
  source: 'code.claude.com/docs/en/best-practices#avoid-common-failure-patterns; overlap measure is a heuristic',
  explain({ transcript }, opts) {
    const o = overlap(transcript, opts);
    return {
      reading: o === null ? 'not enough prompts/files to compare' : `${Math.round(o * 100)}% overlap with earlier work`,
      trigger: `<${Math.round(opts.maxOverlap * 100)}% & ≥${Math.round(opts.minTokens / 1000)}k ctx, after turn`,
    };
  },
};
