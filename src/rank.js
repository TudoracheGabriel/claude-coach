// Picks the single advice to show. Hysteresis lives in the detectors (they get `active`);
// cooldowns live here: advice that was shown and then cleared stays quiet for its cooldown.
export function rank(detectors, ctx, state, config) {
  const proposals = [];
  for (const d of detectors) {
    const opts = config.detectors[d.id];
    if (!opts || opts.enabled === false) continue;
    const active = state.firing.includes(d.id);
    let p = null;
    try {
      p = d.detect(ctx, opts, active);
    } catch {
      p = null;
    }
    if (!p) continue;
    const clearedAt = state.clearedAt[d.id];
    const cooldownMs = (opts.cooldownMin ?? 0) * 60_000;
    if (!active && clearedAt !== undefined && ctx.now - clearedAt < cooldownMs) continue;
    proposals.push({ id: d.id, ...p });
  }

  const firing = proposals.map((p) => p.id);
  for (const id of state.firing) {
    if (!firing.includes(id) && state.shownInEpisode.includes(id)) state.clearedAt[id] = ctx.now;
  }

  const winner = proposals.reduce((best, p) => (best && best.urgency >= p.urgency ? best : p), null);
  state.firing = firing;
  state.shownInEpisode = state.shownInEpisode.filter((id) => firing.includes(id));
  if (winner && !state.shownInEpisode.includes(winner.id)) state.shownInEpisode.push(winner.id);
  return winner;
}
