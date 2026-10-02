import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coach, stdin, lines, strip } from './helpers.js';

test('healthy session prints a single calm sentence', async () => {
  const out = await coach(stdin({ tokens: 40_000 }));
  assert.equal(lines(out).length, 1);
  assert.match(strip(out), /healthy/i);
  assert.doesNotMatch(strip(out), /\/compact/);
});

test('context at the pressure threshold recommends /compact', async () => {
  const out = await coach(stdin({ tokens: 150_000 }));
  assert.match(strip(out), /\/compact/);
});

test('1M window at 300k tokens (30%) still recommends /compact', async () => {
  const out = await coach(stdin({ tokens: 300_000, windowSize: 1_000_000 }));
  assert.match(strip(out), /\/compact/);
});

for (const [name, raw] of [['malformed', '{not json'], ['empty', ''], ['non-object', '42']]) {
  test(`${name} stdin prints a fallback line`, async () => {
    const out = await coach(raw);
    assert.equal(lines(out).length, 1);
    assert.ok(strip(out).length > 0);
  });
}

test('null usage fields early in a session do not crash', async () => {
  const input = stdin({ tokens: null });
  const out = await coach(input);
  assert.equal(lines(out).length, 1);
  assert.doesNotMatch(strip(out), /NaN|undefined|null/);
});

test('falls back to used_percentage when current_usage is null (after /compact)', async () => {
  const input = stdin({ tokens: 170_000 });
  input.context_window.current_usage = null;
  const out = await coach(input);
  assert.match(strip(out), /\/compact/);
});
