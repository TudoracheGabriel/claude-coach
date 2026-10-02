import { tokens as fmt } from '../format.js';

// Growth of the latest prompt over the previous one, or null when there aren't two to compare.
function lastDelta(transcript) {
  const prompts = transcript.prompts.filter((p) => p.end !== null);
  if (prompts.length < 2) return null;
  const latest = prompts[prompts.length - 1];
  if (latest.id !== transcript.prompts[transcript.prompts.length - 1].id) return null;
  return latest.end - prompts[prompts.length - 2].end;
}

// Growth per prompt, never per redraw: compares the latest prompt with the previous one.
export const ctxSpike = {
  id: 'ctx-spike',
  detect({ transcript }, opts, active) {
    const delta = lastDelta(transcript);
    if (delta === null || delta < (active ? opts.exitTokens : opts.enterTokens)) return null;
    return {
      action: 'Restate key constraints',
      urgency: 50,
      reason: `your last prompt added ${fmt(delta)} tokens; older details may now be handled less sharply.`,
    };
  },
  source: 'arxiv.org/abs/2307.03172 (Lost in the Middle); 40k is a heuristic',
  explain({ transcript }, opts) {
    const delta = lastDelta(transcript);
    return {
      reading: delta === null ? 'needs two prompts to compare' : `last prompt ${delta >= 0 ? '+' : '−'}${fmt(Math.abs(delta))} tokens`,
      trigger: `≥+${fmt(opts.enterTokens)} in one prompt`,
    };
  },
};
