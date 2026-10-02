import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coach, stdin, lines, strip } from './helpers.js';

const visible = (l) => [...strip(l)].length;

test('risk advice expands to a metrics line then advice with why', async () => {
  const out = await coach(stdin({ tokens: 165_000 }));
  const [metrics, advice, ...rest] = lines(out);
  assert.equal(rest.length, 0);
  assert.match(metrics, /Opus/);
  assert.match(metrics, /165k\/200k/);
  assert.match(advice, /\/compact/);
  assert.match(advice, /165k tokens/);
});

test('advice is coloured with ANSI', async () => {
  const out = await coach(stdin({ tokens: 165_000 }));
  assert.match(out, /\x1b\[/);
});

test('every line fits COLUMNS=60', async () => {
  const input = stdin({
    tokens: 165_000,
    extra: {
      rate_limits: { five_hour: { used_percentage: 42, resets_at: 1_900_000_000 }, seven_day: { used_percentage: 12, resets_at: 1_900_000_000 } },
      effort: { level: 'xhigh' },
    },
  });
  const out = await coach(input, { columns: 60 });
  assert.equal(lines(out).length, 2);
  for (const l of out.split('\n')) assert.ok(visible(l) <= 60, `too wide (${visible(l)}): ${strip(l)}`);
});

test('healthy line also fits a narrow terminal', async () => {
  const out = await coach(stdin({ tokens: 40_000 }), { columns: 20 });
  assert.equal(lines(out).length, 1);
  assert.ok(visible(out) <= 20);
});

test('missing metrics are omitted, not shown as empty or zero', async () => {
  const out = await coach(stdin({ tokens: 165_000 }));
  const [metrics] = lines(out);
  assert.doesNotMatch(metrics, /5h|7d|cache|effort/);
  assert.doesNotMatch(metrics, /\b0%|undefined|null|NaN/);
});

test('available limits and cache show on the metrics line', async () => {
  const input = stdin({
    tokens: 165_000,
    extra: {
      rate_limits: { five_hour: { used_percentage: 42, resets_at: 1_900_000_000 } },
      prompt_cache: { warm: true, expires_at: 1_900_000_000, hit_ratio: 0.9 },
    },
  });
  const [metrics] = lines(await coach(input));
  assert.match(metrics, /5h 42%/);
  assert.match(metrics, /cache warm/);
  assert.doesNotMatch(metrics, /7d/);
});
