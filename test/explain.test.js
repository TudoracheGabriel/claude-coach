import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cli } from '../src/cli.js';
import { coach, stdin, strip, tempHome, NOW } from './helpers.js';
import { prompt, assistant, toolResult, writeTranscript } from './transcript.js';

const MIN = 60_000;
const row = (out, id) => out.split('\n').find((l) => l.startsWith(id)) ?? '';

test('explain shows each rule with its reading, trigger and outcome', async () => {
  const home = tempHome();
  await coach(stdin({ tokens: 160_000, sessionId: 'sess-x' }), { home });
  const r = await cli(['explain'], { home, now: NOW });
  assert.equal(r.code, 0);
  assert.match(r.output, /sess-x/);
  assert.match(row(r.output, 'ctx-pressure'), /160k tokens.*≥150k.*SHOWN/);
  assert.match(row(r.output, 'rate-limit'), /no limits reported.*quiet/);
  assert.match(row(r.output, 'cache-expiry'), /no cache data.*quiet/);
  assert.match(r.output, /compaction-threshold/, 'cites the source of the shown rule');
});

test('explain marks a rule that fired but lost to a more urgent one', async () => {
  const home = tempHome();
  const sec = (ms) => Math.floor(ms / 1000);
  const extra = { prompt_cache: { warm: true, expires_at: sec(NOW + 40_000), recache_tokens_if_cold: 60_000 } };
  await coach(stdin({ tokens: 155_000, extra }), { home, now: NOW });
  const r = await cli(['explain'], { home, now: NOW });
  assert.match(row(r.output, 'cache-expiry'), /SHOWN/);
  assert.match(row(r.output, 'ctx-pressure'), /outranked/);
});

test('explain shows a rule in cooldown and until when', async () => {
  const home = tempHome();
  await coach(stdin({ tokens: 160_000 }), { home, now: NOW });
  await coach(stdin({ tokens: 40_000 }), { home, now: NOW + MIN });
  await coach(stdin({ tokens: 155_000 }), { home, now: NOW + 3 * MIN });
  const r = await cli(['explain'], { home, now: NOW + 3 * MIN });
  assert.match(row(r.output, 'ctx-pressure'), /cooldown until \d\d:\d\d/);
});

test('explain says when a rule waits for Claude to finish its turn', async () => {
  const home = tempHome();
  const reads = Array.from({ length: 16 }, (_, i) => ['Read', { file_path: `/w/f${i}.ts` }]);
  const file = writeTranscript(home, [prompt('p1', 'explore'), ...reads.flatMap((t, i) => [assistant(60_000 + i, { tools: [t] }), toolResult('p1')])]);
  await coach(stdin({ tokens: 60_000, promptId: 'p1', transcriptPath: file }), { home });
  const r = await cli(['explain'], { home, now: NOW });
  assert.match(row(r.output, 'read-heavy'), /16 reads\/searches.*waiting for turn end/);
});

test('explain can target a named session and is read-only', async () => {
  const home = tempHome();
  await coach(stdin({ tokens: 160_000, sessionId: 'one' }), { home, now: NOW });
  await coach(stdin({ tokens: 20_000, sessionId: 'two' }), { home, now: NOW + 1000 });
  const named = await cli(['explain', 'one'], { home, now: NOW });
  assert.match(row(named.output, 'ctx-pressure'), /SHOWN/);
  const latest = await cli(['explain'], { home, now: NOW });
  assert.match(latest.output, /\btwo\b/);
  const after = strip(await coach(stdin({ tokens: 145_000, sessionId: 'one' }), { home, now: NOW + 2000 }));
  assert.match(after, /\/compact/, 'explain did not disturb session state');
});

test('explain with no sessions says so', async () => {
  const r = await cli(['explain'], { home: tempHome(), now: NOW });
  assert.equal(r.code, 0);
  assert.match(r.output, /no coach sessions/i);
});

test('explain for an unknown session id fails clearly', async () => {
  const home = tempHome();
  await coach(stdin({ tokens: 20_000, sessionId: 'one' }), { home });
  const r = await cli(['explain', 'nope'], { home, now: NOW });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /nope/);
});
