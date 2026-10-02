import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { coach, stdin, strip, tempHome, NOW } from './helpers.js';

function homeWithConfig(content) {
  const home = tempHome();
  fs.mkdirSync(path.join(home, '.claude', 'coach'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'coach', 'config.json'), typeof content === 'string' ? content : JSON.stringify(content));
  return home;
}

test('an overridden threshold changes when advice triggers', async () => {
  const home = homeWithConfig({ detectors: { 'ctx-pressure': { enterTokens: 100_000 } } });
  assert.match(strip(await coach(stdin({ tokens: 110_000 }), { home })), /\/compact/);
  assert.doesNotMatch(strip(await coach(stdin({ tokens: 110_000 }))), /\/compact/);
});

test('a raised threshold keeps hysteresis consistent', async () => {
  const home = homeWithConfig({ detectors: { 'ctx-pressure': { enterTokens: 300_000 } } });
  const at = (tokens, i) => coach(stdin({ tokens, windowSize: 1_000_000 }), { home, now: NOW + i * 1000 });
  assert.doesNotMatch(strip(await at(200_000, 0)), /\/compact/);
  assert.match(strip(await at(310_000, 1)), /\/compact/);
  assert.match(strip(await at(295_000, 2)), /\/compact/);
});

test('a disabled recommendation never appears', async () => {
  const home = homeWithConfig({ detectors: { 'ctx-pressure': { enabled: false } } });
  assert.doesNotMatch(strip(await coach(stdin({ tokens: 190_000 }), { home })), /\/compact/);
});

test('a malformed config falls back to defaults', async () => {
  const home = homeWithConfig('{ "detectors": ');
  assert.match(strip(await coach(stdin({ tokens: 160_000 }), { home })), /\/compact/);
});

test('wrong value types in config are ignored', async () => {
  const home = homeWithConfig({ detectors: { 'ctx-pressure': { enterTokens: 'lots', enabled: 'nope' }, bogus: 1 } });
  assert.match(strip(await coach(stdin({ tokens: 160_000 }), { home })), /\/compact/);
  assert.doesNotMatch(strip(await coach(stdin({ tokens: 120_000 }), { home })), /\/compact/);
});
