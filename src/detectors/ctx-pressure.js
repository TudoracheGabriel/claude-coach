import { tokens as fmt } from '../format.js';

function focusHint(transcript) {
  const latest = [...(transcript?.prompts ?? [])].reverse().find((p) => !p.cmd && (p.kw?.length || p.files?.length));
  if (!latest) return '';
  const terms = [...(latest.kw ?? []).slice(0, 2), ...(latest.files ?? []).slice(0, 1).map((f) => f.split('/').pop())];
  return terms.length ? ` focus on ${terms.join(', ')}` : '';
}

export const ctxPressure = {
  id: 'ctx-pressure',
  detect({ snap, transcript }, opts, active) {
    if (snap.tokens === null) return null;
    const minTokens = active ? opts.exitTokens : opts.enterTokens;
    const minPercent = active ? opts.enterPercent - 5 : opts.enterPercent;
    if (snap.tokens < minTokens && (snap.percent ?? 0) < minPercent) return null;
    const over = Math.max(0, snap.tokens - opts.enterTokens) / opts.enterTokens;
    return {
      action: `Run /compact${focusHint(transcript)}`,
      urgency: Math.min(90, 60 + Math.round(over * 100)),
      reason: `${fmt(snap.tokens)} tokens in context; answers get less sharp in long contexts.`,
    };
  },
  source: 'platform.claude.com/docs/en/build-with-claude/compaction-threshold (150k default)',
  explain({ snap }, opts) {
    return {
      reading: snap.tokens === null ? 'no usage yet' : `${fmt(snap.tokens)} tokens (${Math.round(snap.percent)}% of ${fmt(snap.windowSize)})`,
      trigger: `≥${fmt(opts.enterTokens)} or ≥${opts.enterPercent}%, off below ${fmt(opts.exitTokens)}`,
    };
  },
};
