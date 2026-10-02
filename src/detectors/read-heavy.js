// Many Read/Grep/Glob calls in the main context over recent prompts: exploration a subagent
// could have done, leaving only its summary behind. Shown only once Claude has finished its
// turn: mid-turn the reading is Claude's doing and the user can't act on it.
function reading({ snap, transcript }, opts) {
  const recent = transcript.prompts.slice(-opts.turns);
  const reads = recent.reduce((n, p) => n + (p.reads ?? 0), 0);
  const others = recent.reduce((n, p) => n + (p.others ?? 0), 0);
  return { recent: recent.length, reads, share: reads + others ? reads / (reads + others) : 0, tokens: snap.tokens };
}

const plural = (n, word) => `${n === 1 ? 'your last' : `your last ${n}`} ${word}${n === 1 ? '' : 's'}`;

export const readHeavy = {
  id: 'read-heavy',
  detect(ctx, opts, active) {
    if (ctx.transcript.turnEnded === false) return null;
    const r = reading(ctx, opts);
    if (r.tokens !== null && r.tokens < opts.minTokens) return null;
    if (r.reads < (active ? opts.exitCalls : opts.enterCalls)) return null;
    if (r.share < opts.minReadShare) return null;
    return {
      action: 'Next time, ask Claude to explore with a subagent',
      urgency: 45,
      reason: `${r.reads} file reads/searches in ${plural(r.recent, 'prompt')} went into the main context; a subagent would return only a summary.`,
    };
  },
  afterTurn: true,
  source: 'code.claude.com/docs/en/best-practices#use-subagents-for-investigation; counts are heuristics',
  explain(ctx, opts) {
    const r = reading(ctx, opts);
    return {
      reading: `${r.reads} reads/searches in ${plural(r.recent, 'prompt')} (${Math.round(r.share * 100)}% reads)`,
      trigger: `≥${opts.enterCalls} & ≥${Math.round(opts.minReadShare * 100)}% reads & ≥${Math.round(opts.minTokens / 1000)}k ctx, after turn`,
    };
  },
};
