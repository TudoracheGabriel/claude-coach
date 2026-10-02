import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { coach, stdin, strip, lines, tempHome, NOW } from './helpers.js';
import { prompt, assistant, toolResult, writeTranscript, appendTranscript } from './transcript.js';

const spike = (o) => /restate/i.test(o);

test('a jump between two prompts shows spike advice with its size', async () => {
  const home = tempHome();
  const file = writeTranscript(home, [
    prompt('p1', 'set up the project'),
    assistant(30_000),
    prompt('p2', 'read all the docs'),
    assistant(55_000, { tools: [['Read', { file_path: '/w/a.md' }]] }),
    toolResult('p2'),
    assistant(82_000),
  ]);
  const out = strip(await coach(stdin({ tokens: 82_000, promptId: 'p2', transcriptPath: file }), { home }));
  assert.ok(spike(out), out);
  assert.match(lines(out)[1], /52k/);
});

test('small growth between prompts gives no spike advice', async () => {
  const home = tempHome();
  const file = writeTranscript(home, [prompt('p1', 'a'), assistant(30_000), prompt('p2', 'b'), assistant(45_000)]);
  const out = strip(await coach(stdin({ tokens: 45_000, promptId: 'p2', transcriptPath: file }), { home }));
  assert.ok(!spike(out), out);
});

test('redraws within one prompt neither cause nor clear a spike', async () => {
  const home = tempHome();
  const file = writeTranscript(home, [prompt('p1', 'a'), assistant(30_000)]);
  const runs = [];
  const go = async (tokens, promptId, i) =>
    runs.push(spike(strip(await coach(stdin({ tokens, promptId, transcriptPath: file }), { home, now: NOW + i * 1000 }))));
  await go(30_000, 'p1', 0);
  await go(31_000, 'p1', 1);
  await go(32_000, 'p1', 2);
  appendTranscript(file, [prompt('p2', 'b'), assistant(80_000)]);
  await go(80_000, 'p2', 3);
  await go(80_000, 'p2', 4);
  await go(81_000, 'p2', 5);
  appendTranscript(file, [prompt('p3', 'c'), assistant(83_000)]);
  await go(83_000, 'p3', 6);
  assert.deepEqual(runs, [false, false, false, true, true, true, false]);
});

test('without a transcript, prompt_id changes alone drive spike detection', async () => {
  const home = tempHome();
  const runs = [];
  for (const [i, [tokens, promptId]] of [[30_000, 'p1'], [32_000, 'p1'], [75_000, 'p2'], [76_000, 'p2']].entries()) {
    runs.push(spike(strip(await coach(stdin({ tokens, promptId }), { home, now: NOW + i * 1000 }))));
  }
  assert.deepEqual(runs, [false, false, true, true]);
});

test('appended transcript is read incrementally and stays correct', async () => {
  const home = tempHome();
  const file = writeTranscript(home, [prompt('p1', 'a'), assistant(20_000)]);
  const noPromptId = (tokens) => {
    const s = stdin({ tokens, transcriptPath: file });
    delete s.prompt_id;
    return s;
  };
  assert.ok(!spike(strip(await coach(noPromptId(20_000), { home }))));
  appendTranscript(file, [prompt('p2', 'b'), assistant(70_000)]);
  const out = strip(await coach(noPromptId(70_000), { home, now: NOW + 1000 }));
  assert.ok(spike(out), out);
  assert.match(out, /50k/);
});

test('a transcript that shrank is re-read from the start', async () => {
  const home = tempHome();
  const file = writeTranscript(home, [
    prompt('p1', 'a'), assistant(20_000), prompt('p2', 'b'), assistant(25_000), prompt('p3', 'c'), assistant(28_000),
  ]);
  await coach(stdin({ tokens: 28_000, promptId: 'p3', transcriptPath: file }), { home });
  writeTranscript(home, [prompt('q1', 'x'), assistant(10_000), prompt('q2', 'y'), assistant(60_000)]);
  const out = strip(await coach(stdin({ tokens: 60_000, promptId: 'q2', transcriptPath: file }), { home, now: NOW + 1000 }));
  assert.ok(spike(out), out);
  assert.match(out, /50k/);
});

test('a missing transcript does not crash', async () => {
  const out = strip(await coach(stdin({ tokens: 40_000, transcriptPath: '/definitely/missing.jsonl' })));
  assert.match(out, /healthy/i);
});

test('a transcript with garbage lines is tolerated', async () => {
  const home = tempHome();
  const file = path.join(home, 't.jsonl');
  fs.writeFileSync(
    file,
    `not json\n${JSON.stringify(prompt('p1', 'a'))}\n{"type":"assistant","message":null}\n${JSON.stringify(assistant(30_000))}\n`,
  );
  const out = strip(await coach(stdin({ tokens: 30_000, transcriptPath: file }), { home }));
  assert.match(out, /healthy/i);
});

test('raw prompt text is never written to the home folder', async () => {
  const home = tempHome();
  const secret = 'zebra-unicorn-passphrase please refactor the payments module';
  const file = writeTranscript(`${home}-transcripts`, [prompt('p1', secret), assistant(160_000)]);
  await coach(stdin({ tokens: 160_000, promptId: 'p1', transcriptPath: file }), { home });
  const contents = [];
  const walk = (d) =>
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : contents.push(fs.readFileSync(path.join(d, e.name), 'utf8')),
    );
  walk(home);
  assert.ok(contents.length > 0);
  for (const c of contents) assert.ok(!c.includes('zebra-unicorn-passphrase please'), 'prompt text leaked into state');
});
