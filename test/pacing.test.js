import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coach, stdin, strip, lines, NOW } from './helpers.js';

const sec = (ms) => Math.floor(ms / 1000);
const cache = (expiresInMs, extra = {}) => ({
  prompt_cache: { warm: true, caching_observed: true, ttl: '5m', expires_at: sec(NOW + expiresInMs), hit_ratio: 0.9, recache_tokens_if_cold: 60_000, ...extra },
});

test('warm cache about to expire tells you how long you have to reply', async () => {
  const out = strip(await coach(stdin({ tokens: 60_000, extra: cache(90_000) })));
  assert.match(lines(out)[1], /reply within 1m30s/i);
  assert.match(lines(out)[1], /60k/);
});

test('warm cache with plenty of time left gives no cache advice', async () => {
  const out = strip(await coach(stdin({ tokens: 60_000, extra: cache(4 * 60_000) })));
  assert.doesNotMatch(out, /reply within/i);
});

test('cold or absent cache gives no cache advice', async () => {
  const cold = strip(await coach(stdin({ tokens: 60_000, extra: cache(60_000, { warm: false }) })));
  const absent = strip(await coach(stdin({ tokens: 60_000 })));
  assert.doesNotMatch(cold, /reply within/i);
  assert.doesNotMatch(absent, /reply within/i);
});

const limits = (five, seven) => ({
  rate_limits: {
    ...(five && { five_hour: { used_percentage: five, resets_at: sec(NOW + 90 * 60_000) } }),
    ...(seven && { seven_day: { used_percentage: seven, resets_at: sec(NOW + 3 * 24 * 3600_000) } }),
  },
});

const hhmm = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

test('five-hour limit at 80% warns with the local reset time', async () => {
  const out = strip(await coach(stdin({ tokens: 30_000, extra: limits(84, 10) })));
  const advice = lines(out)[1];
  assert.match(advice, /5-hour limit 84%/);
  assert.ok(advice.includes(hhmm(NOW + 90 * 60_000)), advice);
  assert.match(advice, /effort|cheaper model/i);
});

test('weekly limit at 80% warns too', async () => {
  const out = strip(await coach(stdin({ tokens: 30_000, extra: limits(20, 91) })));
  assert.match(lines(out)[1], /weekly limit 91%/);
});

test('limits below threshold or absent give no limit advice', async () => {
  assert.doesNotMatch(strip(await coach(stdin({ extra: limits(60, 50) }))), /limit/i);
  const absent = stdin();
  delete absent.rate_limits;
  assert.doesNotMatch(strip(await coach(absent)), /limit/i);
  assert.doesNotMatch(strip(await coach(stdin({ extra: { rate_limits: { five_hour: null } } }))), /limit/i);
});

test('with several advices only the most urgent is shown', async () => {
  const out = strip(await coach(stdin({ tokens: 155_000, extra: { ...cache(40_000), ...limits(82) } })));
  assert.equal(lines(out).length, 2);
  assert.match(lines(out)[1], /reply within 40s/i);
  assert.doesNotMatch(lines(out)[1], /\/compact|5-hour/);
});
