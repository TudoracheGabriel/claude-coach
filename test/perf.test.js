import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { coach, stdin, tempHome, NOW } from './helpers.js';
import { prompt, assistant, toolResult, jsonl, appendTranscript } from './transcript.js';

const p95 = (xs) => [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1];

function bigTranscript(file, bytes) {
  const chunk = [];
  let i = 0;
  let size = 0;
  const filler = 'x'.repeat(3000);
  while (size < bytes) {
    const id = `p${i}`;
    const entries = [
      prompt(id, `please look at module ${i} and fix the parser`),
      assistant(20_000 + i * 50, { tools: [['Read', { file_path: `/w/src/m${i % 40}.ts` }], ['Grep', { pattern: 'parse' }]] }),
      toolResult(id, filler),
      { type: 'attachment', attachment: { type: 'file', content: filler } },
      assistant(21_000 + i * 50, { tools: [['Edit', { file_path: `/w/src/m${i % 40}.ts` }]] }),
      toolResult(id, filler),
      assistant(22_000 + i * 50),
    ];
    const text = jsonl(entries);
    chunk.push(text);
    size += Buffer.byteLength(text);
    i++;
  }
  fs.writeFileSync(file, chunk.join(''));
  return i;
}

test('first run on a ~5 MB transcript stays under 100 ms (p95)', async () => {
  const dir = tempHome();
  const file = `${dir}/big.jsonl`;
  bigTranscript(file, 5 * 1024 * 1024);
  const times = [];
  for (let r = 0; r < 12; r++) {
    const home = tempHome();
    const t0 = performance.now();
    await coach(stdin({ tokens: 60_000, transcriptPath: file, cwd: dir }), { home });
    times.push(performance.now() - t0);
  }
  assert.ok(p95(times) < 100, `p95 ${p95(times).toFixed(1)} ms`);
});

test('incremental runs stay under 30 ms (p95)', async () => {
  const dir = tempHome();
  const file = `${dir}/big.jsonl`;
  const n = bigTranscript(file, 5 * 1024 * 1024);
  const home = tempHome();
  await coach(stdin({ tokens: 60_000, transcriptPath: file, cwd: dir }), { home });
  const times = [];
  for (let r = 0; r < 25; r++) {
    appendTranscript(file, [prompt(`q${r}`, 'next step'), assistant(60_000 + r * 100, { tools: [['Read', { file_path: `/w/x${r}.ts` }]] })]);
    const t0 = performance.now();
    await coach(stdin({ tokens: 60_000 + r * 100, transcriptPath: file, cwd: dir, promptId: `q${r}` }), { home, now: NOW + r * 1000 });
    times.push(performance.now() - t0);
  }
  assert.ok(n > 100);
  assert.ok(p95(times) < 30, `p95 ${p95(times).toFixed(1)} ms`);
});
