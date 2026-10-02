import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { coach, stdin, strip, lines, tempHome } from './helpers.js';
import { prompt, assistant, toolResult, writeTranscript } from './transcript.js';

const CWD = '/work/shop';

function turn(id, text, files, tokens) {
  const entries = [prompt(id, text, { cwd: CWD })];
  for (const f of files) entries.push(assistant(tokens, { tools: [['Read', { file_path: `${CWD}/${f}` }]] }), toolResult(id));
  entries.push(assistant(tokens));
  return entries;
}

const history = [
  ...turn('p1', 'The checkout total is wrong when a coupon is applied', ['src/checkout/total.ts', 'src/checkout/coupon.ts'], 50_000),
  ...turn('p2', 'Make coupon rounding use cents in the checkout total', ['src/checkout/total.ts', 'src/checkout/rounding.ts'], 60_000),
  ...turn('p3', 'Add a checkout test for stacked coupon discounts', ['test/checkout/coupon.test.ts'], 70_000),
];

async function latest(text, files, tokens) {
  const home = tempHome();
  const file = writeTranscript(home, [...history, ...turn('p4', text, files, tokens)]);
  return strip(await coach(stdin({ tokens, promptId: 'p4', transcriptPath: file, cwd: CWD }), { home }));
}

test('an unrelated task with heavy context suggests /clear', async () => {
  const out = await latest('Write a GitHub Actions workflow that publishes the docs site nightly', ['.github/workflows/docs.yml', 'docs/site/config.json'], 80_000);
  assert.match(lines(out)[1], /\/clear/);
});

test('no /clear advice while Claude is still working on the new prompt', async () => {
  const home = tempHome();
  const unfinished = turn('p4', 'Write a GitHub Actions workflow that publishes the docs site nightly', ['.github/workflows/docs.yml', 'docs/site/config.json'], 80_000).slice(0, -1);
  const file = writeTranscript(home, [...history, ...unfinished]);
  const out = strip(await coach(stdin({ tokens: 80_000, promptId: 'p4', transcriptPath: file, cwd: CWD }), { home }));
  assert.doesNotMatch(out, /\/clear/);
});

test('a rephrased prompt on the same files and terms does not', async () => {
  const out = await latest('Coupon totals in checkout still look off, check rounding again', ['src/checkout/rounding.ts', 'src/checkout/total.ts'], 80_000);
  assert.doesNotMatch(out, /\/clear/);
});

test('below the context floor a topic switch is cheap and not flagged', async () => {
  const out = await latest('Write a GitHub Actions workflow that publishes the docs site nightly', ['.github/workflows/docs.yml'], 30_000);
  assert.doesNotMatch(out, /\/clear/);
});

test('only keywords and paths are stored, never the prompt text', async () => {
  const home = tempHome();
  const text = 'Write a GitHub Actions workflow that publishes the docs site nightly';
  const file = writeTranscript(`${home}-t`, [...history, ...turn('p4', text, ['.github/workflows/docs.yml'], 80_000)]);
  await coach(stdin({ tokens: 80_000, promptId: 'p4', transcriptPath: file, cwd: CWD }), { home });
  const dump = [];
  const walk = (d) =>
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : dump.push(fs.readFileSync(path.join(d, e.name), 'utf8')),
    );
  walk(home);
  const all = dump.join('\n');
  assert.ok(!all.includes('publishes the docs'));
  assert.ok(!all.includes('checkout total is wrong'));
});

test('the /compact advice suggests what to focus on, from the latest task', async () => {
  const home = tempHome();
  const file = writeTranscript(home, history);
  const out = strip(await coach(stdin({ tokens: 165_000, promptId: 'p3', transcriptPath: file, cwd: CWD }), { home }));
  assert.match(lines(out)[1], /\/compact focus on .*(coupon|checkout)/i);
});
