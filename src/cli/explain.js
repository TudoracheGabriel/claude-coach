import { listStates } from '../state.js';
import { loadConfig } from '../config.js';
import { DETECTORS } from '../detectors/index.js';
import { emptyTranscript } from '../transcript.js';
import { level } from '../render.js';
import { tokens as fmt, clock } from '../format.js';

// Read-only: shows, for the newest (or named) session, what each rule saw on the last status
// line refresh, its trigger, and what happened to it. Writes nothing.
export function explain(home, argv, now) {
  const sessions = listStates(home).filter((s) => s.state.lastSnap && typeof s.state.lastRunAt === 'number');
  if (!sessions.length) return { code: 0, output: 'No coach sessions yet. Start Claude Code with the coach installed, then run this again.' };

  const wanted = argv[0];
  const pick = wanted
    ? sessions.find((s) => s.state.lastSnap.sessionId === wanted || s.file === wanted || s.state.lastSnap.sessionId?.startsWith(wanted))
    : sessions.reduce((a, b) => (b.state.lastRunAt > a.state.lastRunAt ? b : a));
  if (!pick) return { code: 1, output: `No coach session matching "${wanted}".` };

  const { state } = pick;
  const config = loadConfig(home);
  const snap = state.lastSnap;
  const transcript = state.transcript ?? emptyTranscript();
  const ctx = { snap, now: state.lastRunAt, transcript, git: { dirty: state.lastGitDirty ?? null } };

  const header = [
    `Session ${snap.sessionId}`,
    `last refresh ${clock(state.lastRunAt, now)}`,
    snap.model,
    snap.tokens === null ? null : `${fmt(snap.tokens)}/${fmt(snap.windowSize)}`,
  ].filter(Boolean).join(' · ');

  const rows = DETECTORS.map((d) => {
    const opts = config.detectors[d.id];
    const outcome = state.lastOutcomes?.[d.id] ?? { status: 'quiet' };
    let reading = '';
    let trigger = '';
    try {
      ({ reading, trigger } = d.explain(ctx, opts));
    } catch {}
    let status = outcome.status;
    if (status === 'shown') status = `SHOWN (${level(outcome.urgency ?? 0)})`;
    else if (status === 'fired') status = 'fired, outranked';
    else if (status === 'cooldown') status = `cooldown until ${clock(outcome.until, now)}`;
    else if (status === 'quiet' && d.afterTurn && transcript.turnEnded === false) status = 'quiet, waiting for turn end';
    return { id: d.id, reading, trigger: `trigger ${trigger}`, status, source: d.source };
  });

  const w = (k) => Math.max(...rows.map((r) => r[k].length));
  const lines = rows.map((r) => `${r.id.padEnd(w('id'))}  ${r.reading.padEnd(w('reading'))}  ${r.trigger.padEnd(w('trigger'))}  → ${r.status}`);
  const shown = rows.find((r) => r.status.startsWith('SHOWN'));
  const footer = [
    shown ? `Source for ${shown.id}: ${shown.source}` : 'No advice was shown: the session looked healthy.',
    'All rules and sources: README "What it recommends, and why". Thresholds: ~/.claude/coach/config.json',
  ];
  return { code: 0, output: [header, '', ...lines, '', ...footer].join('\n') };
}
