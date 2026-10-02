import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { cli } from '../src/cli.js';
import { coach, stdin, tempHome, NOW } from './helpers.js';
import { prompt, command, assistant, compactBoundary, toolResult, writeTranscript, appendTranscript } from './transcript.js';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const project = (home) => path.join(home, '.claude', 'projects', 'C--work-shop');
const ts = (ms) => ({ timestamp: new Date(ms).toISOString() });

// Session A: reaches auto-compact, peaks at 160k, rebuilds 50k of cache after a 10-minute pause,
// and follows the /compact advice it was shown.
async function sessionA(home) {
  const t0 = NOW - 2 * DAY;
  const file = writeTranscript(project(home), [
    prompt('a1', 'fix the coupon rounding', ts(t0)),
    assistant(90_000, { at: t0 + MIN }),
    prompt('a2', 'now the totals', ts(t0 + 2 * MIN)),
    assistant(160_000, { at: t0 + 3 * MIN }),
  ], 'session-a.jsonl');
  await coach(stdin({ sessionId: 'session-a', tokens: 160_000, promptId: 'a2', transcriptPath: file }), { home, now: t0 + 3 * MIN });
  appendTranscript(file, [
    command('a3', '/compact', ts(t0 + 4 * MIN)),
    compactBoundary('auto', 160_000),
    prompt('a4', 'continue', ts(t0 + 14 * MIN)),
    assistant(40_000, { at: t0 + 15 * MIN, cacheWrite: 50_000 }),
  ]);
}

// Session B: peaks at 80k, is told to delegate and doesn't.
async function sessionB(home) {
  const t0 = NOW - DAY;
  const reads = Array.from({ length: 16 }, (_, i) => ['Read', { file_path: `/w/f${i}.ts` }]);
  const file = writeTranscript(project(home), [
    prompt('b1', 'explore the repo', ts(t0)),
    ...reads.flatMap((r, i) => [assistant(50_000 + i * 1000, { tools: [r], at: t0 + i * 1000 }), toolResult('b1')]),
    assistant(80_000, { at: t0 + 30_000 }),
  ], 'session-b.jsonl');
  await coach(stdin({ sessionId: 'session-b', tokens: 80_000, promptId: 'b1', transcriptPath: file }), { home, now: t0 + 30_000 });
  appendTranscript(file, [prompt('b2', 'keep going', ts(t0 + MIN)), assistant(80_000, { at: t0 + 2 * MIN })]);
}

// Session C: before the report window.
function sessionC(home) {
  const t0 = NOW - 30 * DAY;
  writeTranscript(project(home), [prompt('c1', 'old', ts(t0)), compactBoundary('auto'), assistant(190_000, { at: t0 + MIN })], 'session-c.jsonl');
}

test('report prints all four metrics for sessions since a date', async () => {
  const home = tempHome();
  await sessionA(home);
  await sessionB(home);
  sessionC(home);
  const r = await cli(['report', '--since', new Date(NOW - 7 * DAY).toISOString().slice(0, 10)], { home, now: NOW });
  assert.equal(r.code, 0);
  assert.match(r.output, /2 sessions/);
  assert.match(r.output, /auto-compact\s+1 \/ 2 \(50%\)/i);
  assert.match(r.output, /cache rebuilt.*25k tokens per session/i);
  assert.match(r.output, /advice followed.*1 \/ 2 \(50%\)/i);
  assert.match(r.output, /peak context.*median 120k.*max 160k/i);
});

test('report without --since covers the last 14 days', async () => {
  const home = tempHome();
  await sessionA(home);
  sessionC(home);
  const r = await cli(['report'], { home, now: NOW });
  assert.match(r.output, /1 session\b/);
});

test('report with no transcripts in range says there is no data', async () => {
  const home = tempHome();
  sessionC(home);
  const r = await cli(['report', '--since', '2026-09-30'], { home, now: NOW });
  assert.equal(r.code, 0);
  assert.match(r.output, /no sessions/i);
});

test('report with no projects folder at all says there is no data', async () => {
  const r = await cli(['report'], { home: tempHome(), now: NOW });
  assert.equal(r.code, 0);
  assert.match(r.output, /no sessions/i);
});

test('report rejects an invalid date', async () => {
  const r = await cli(['report', '--since', 'last tuesday'], { home: tempHome(), now: NOW });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /YYYY-MM-DD/);
});
