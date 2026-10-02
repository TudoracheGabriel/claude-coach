// Many Read/Grep/Glob calls in the main context over recent prompts: exploration a subagent
// could have done, leaving only its summary behind.
export const readHeavy = {
  id: 'read-heavy',
  detect({ snap, transcript }, opts, active) {
    if (snap.tokens !== null && snap.tokens < opts.minTokens) return null;
    const recent = transcript.prompts.slice(-opts.turns);
    const reads = recent.reduce((n, p) => n + (p.reads ?? 0), 0);
    const others = recent.reduce((n, p) => n + (p.others ?? 0), 0);
    if (reads < (active ? opts.exitCalls : opts.enterCalls)) return null;
    if (reads / (reads + others) < opts.minReadShare) return null;
    return {
      action: 'Delegate exploration to a subagent',
      urgency: 45,
      reason: `${reads} read/search calls in your last ${recent.length} prompts fill the main context; a subagent returns just the summary.`,
    };
  },
};
