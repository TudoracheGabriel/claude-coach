import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coach, stdin, strip, tempHome, NOW } from './helpers.js';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

async function sequence(home, steps, { sessionId = 'session-a', start = NOW } = {}) {
  const outs = [];
  for (const [i, s] of steps.entries()) {
    const t = typeof s === 'number' ? { tokens: s, at: start + i * 5000 } : s;
    outs.push(strip(await coach(stdin({ tokens: t.tokens, sessionId: t.sessionId ?? sessionId }), { home, now: t.at ?? start + i * 5000 })));
  }
  return outs;
}

const advises = (o) => /\/compact/.test(o);

test('advice does not flicker while tokens hover around the threshold', async () => {
  const outs = await sequence(tempHome(), [152_000, 148_000, 151_000, 146_000, 149_500]);
  assert.deepEqual(outs.map(advises), [true, true, true, true, true]);
});

test('advice clears once tokens fall well below the threshold', async () => {
  const outs = await sequence(tempHome(), [152_000, 120_000]);
  assert.deepEqual(outs.map(advises), [true, false]);
});

test('below threshold without prior advice stays healthy', async () => {
  const outs = await sequence(tempHome(), [148_000, 149_000]);
  assert.deepEqual(outs.map(advises), [false, false]);
});

test('advice acted on does not come straight back within the cooldown', async () => {
  const home = tempHome();
  const outs = await sequence(home, [
    { tokens: 160_000, at: NOW },
    { tokens: 40_000, at: NOW + MIN },
    { tokens: 155_000, at: NOW + 3 * MIN },
    { tokens: 156_000, at: NOW + 20 * MIN },
  ]);
  assert.deepEqual(outs.map(advises), [true, false, false, true]);
});

test('parallel sessions sharing a home keep separate state', async () => {
  const home = tempHome();
  const outs = await sequence(home, [
    { tokens: 160_000, sessionId: 'session-a' },
    { tokens: 145_000, sessionId: 'session-b' },
    { tokens: 145_000, sessionId: 'session-a' },
  ]);
  assert.deepEqual(outs.map(advises), [true, false, true]);
});

test('state older than 7 days is cleaned up by any run', async () => {
  const home = tempHome();
  const real = Date.now();
  await sequence(home, [{ tokens: 160_000, sessionId: 'old', at: real }]);
  await sequence(home, [{ tokens: 10_000, sessionId: 'other', at: real + 8 * DAY }]);
  const [out] = await sequence(home, [{ tokens: 145_000, sessionId: 'old', at: real + 8 * DAY + MIN }]);
  assert.equal(advises(out), false, 'old session state should have been forgotten');
});
