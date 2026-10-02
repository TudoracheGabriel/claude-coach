import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../src/run.js';
import { coach, stdin, strip, lines, tempHome, NOW } from './helpers.js';
import { prompt, assistant, toolResult, writeTranscript } from './transcript.js';

const SECRET = 'the launch codes are hunter2 and the plan is on the whiteboard';

function capturedFiles(home) {
  const dir = path.join(home, '.claude', 'coach', 'captures');
  return fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => path.join(dir, f)) : [];
}

async function captureRun(home, opts = {}) {
  const file = writeTranscript(`${home}-t`, [
    prompt('p1', SECRET),
    assistant(30_000, { tools: [['Read', { file_path: `${home}-t/src/app.ts` }]] }),
    toolResult('p1', `secret file body: ${SECRET}`),
    prompt('p2', 'more'),
    assistant(85_000, { text: `answer mentioning ${SECRET}` }),
  ]);
  const input = JSON.stringify(stdin({ tokens: 85_000, promptId: 'p2', transcriptPath: file }));
  return run(input, { home, now: NOW, columns: 200, ...opts });
}

test('capture switch saves a stdin fixture and a scrubbed transcript tail', async () => {
  const home = tempHome();
  await captureRun(home, { capture: true });
  const files = capturedFiles(home);
  assert.ok(files.some((f) => f.endsWith('.stdin.json')));
  assert.ok(files.some((f) => f.endsWith('.transcript.jsonl')));
  for (const f of files) assert.ok(!fs.readFileSync(f, 'utf8').includes('hunter2'), `${path.basename(f)} leaks text`);
});

test('capture can be switched on from the config file', async () => {
  const home = tempHome();
  fs.mkdirSync(path.join(home, '.claude', 'coach'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'coach', 'config.json'), JSON.stringify({ capture: true }));
  await captureRun(home);
  assert.equal(capturedFiles(home).length, 2);
});

test('capture is off by default', async () => {
  const home = tempHome();
  await captureRun(home);
  assert.equal(capturedFiles(home).length, 0);
});

test('a captured fixture replays to the same advice as the original', async () => {
  const home = tempHome();
  const original = strip(await captureRun(home, { capture: true }));
  const files = capturedFiles(home);
  const stdinFile = files.find((f) => f.endsWith('.stdin.json'));
  const tail = files.find((f) => f.endsWith('.transcript.jsonl'));
  const replayed = JSON.parse(fs.readFileSync(stdinFile, 'utf8'));
  replayed.transcript_path = tail;
  const out = strip(await coach(replayed));
  assert.match(original, /restate/i);
  assert.equal(lines(out)[1], lines(original)[1]);
});

// Real captures (CLAUDE_COACH_CAPTURE=1) dropped into test/fixtures/captured/ must replay cleanly.
const CAPTURED = fileURLToPath(new URL('./fixtures/captured/', import.meta.url));
const real = fs.existsSync(CAPTURED) ? fs.readdirSync(CAPTURED).filter((f) => f.endsWith('.stdin.json')) : [];
for (const name of real) {
  test(`real capture ${name} replays without errors`, async () => {
    const input = JSON.parse(fs.readFileSync(path.join(CAPTURED, name), 'utf8'));
    const tail = path.join(CAPTURED, name.replace('.stdin.json', '.transcript.jsonl'));
    input.transcript_path = fs.existsSync(tail) ? tail : null;
    for (const columns of [200, 60]) {
      const out = await coach(input, { columns });
      assert.ok(out.length > 0);
      assert.doesNotMatch(strip(out), /NaN|undefined|null|waiting for session data/);
      for (const l of out.split('\n')) assert.ok([...strip(l)].length <= columns);
    }
  });
}
