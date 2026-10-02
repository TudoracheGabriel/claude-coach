import { tokens as fmt } from '../format.js';

// Growth per prompt, never per redraw: compares the latest prompt with the previous one.
export const ctxSpike = {
  id: 'ctx-spike',
  detect({ transcript }, opts, active) {
    const prompts = transcript.prompts.filter((p) => p.end !== null);
    if (prompts.length < 2) return null;
    const latest = prompts[prompts.length - 1];
    if (latest.id !== transcript.prompts[transcript.prompts.length - 1].id) return null;
    const delta = latest.end - prompts[prompts.length - 2].end;
    if (delta < (active ? opts.exitTokens : opts.enterTokens)) return null;
    return {
      action: 'Restate key constraints',
      urgency: 50,
      reason: `your last prompt added ${fmt(delta)} tokens; older details may now be handled less sharply.`,
    };
  },
};
