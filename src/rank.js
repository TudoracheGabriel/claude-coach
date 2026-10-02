// Picks the single advice to show. Hysteresis lives in the detectors (they get `active`);
// cooldowns live here: advice that was shown and then cleared stays quiet for its cooldown.
// Also returns each detector's outcome, for `explain`.
export function rank(detectors, ctx, state, config) {
  const proposals = [];
  const outcomes = {};
  for (const d of detectors) {
    const opts = config.detectors[d.id];
    if (!opts || opts.enabled === false) {
      outcomes[d.id] = { status: 'disabled' };
      continue;
    }
    const active = state.firing.includes(d.id);
    let p = null;
    try {
      p = d.detect(ctx, opts, active);
    } catch {
      p = null;
    }
    if (!p) {
      outcomes[d.id] = { status: 'quiet', active };
      continue;
    }
    const clearedAt = state.clearedAt[d.id];
    const cooldownMs = (opts.cooldownMin ?? 0) * 60_000;
    if (!active && clearedAt !== undefined && ctx.now - clearedAt < cooldownMs) {
      outcomes[d.id] = { status: 'cooldown', until: clearedAt + cooldownMs, proposal: p };
      continue;
    }
    proposals.push({ id: d.id, ...p });
    outcomes[d.id] = { status: 'fired', proposal: p };
  }

  const firing = proposals.map((p) => p.id);
  for (const id of state.firing) {
    if (!firing.includes(id) && state.shownInEpisode.includes(id)) state.clearedAt[id] = ctx.now;
  }

  const winner = proposals.reduce((best, p) => (best && best.urgency >= p.urgency ? best : p), null);
  if (winner) outcomes[winner.id].status = 'shown';
  state.firing = firing;
  state.shownInEpisode = state.shownInEpisode.filter((id) => firing.includes(id));
  if (winner && !state.shownInEpisode.includes(winner.id)) state.shownInEpisode.push(winner.id);
  return { winner, outcomes };
}
