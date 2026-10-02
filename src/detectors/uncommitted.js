import { tokens as fmt } from '../format.js';

export const uncommitted = {
  id: 'uncommitted',
  detect({ snap, git }, opts, active) {
    if (git.dirty === null || snap.tokens === null || snap.tokens < opts.minTokens) return null;
    if (git.dirty < (active ? opts.exitFiles : opts.enterFiles)) return null;
    return {
      action: 'Commit first',
      urgency: 50,
      reason: `${git.dirty} uncommitted files and ${fmt(snap.tokens)} tokens of context; a checkpoint makes the next big change safe to undo.`,
    };
  },
  source: 'code.claude.com/docs/en/checkpointing#not-a-replacement-for-version-control; counts are heuristics',
  explain({ git }, opts) {
    return {
      reading: git.dirty === null ? 'not checked (light context, or not a git repo)' : `${git.dirty} uncommitted files`,
      trigger: `≥${opts.enterFiles} files & ≥${fmt(opts.minTokens)} ctx`,
    };
  },
};
