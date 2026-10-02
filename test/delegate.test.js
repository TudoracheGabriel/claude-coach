import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coach, stdin, strip, lines, tempHome } from './helpers.js';
import { prompt, assistant, toolResult, writeTranscript } from './transcript.js';

// One prompt per element; each prompt makes the given tool calls in the main chain.
function session(promptsTools, { sidechain = false } = {}) {
  const entries = [];
  let tokens = 40_000;
  promptsTools.forEach((tools, i) => {
    entries.push(prompt(`p${i}`, `step ${i}`));
    for (const t of tools) {
      tokens += 1500;
      entries.push(assistant(tokens, { tools: [t], sidechain }), toolResult(`p${i}`));
    }
  });
  return { entries, tokens };
}

const read = (n) => ['Read', { file_path: `/w/src/file${n}.ts` }];
const grep = ['Grep', { pattern: 'TODO' }];
const glob = ['Glob', { pattern: '**/*.ts' }];
const edit = (n) => ['Edit', { file_path: `/w/src/file${n}.ts` }];

async function runWith(entries, tokens) {
  const home = tempHome();
  const file = writeTranscript(home, entries);
  return strip(await coach(stdin({ tokens, transcriptPath: file, promptId: null }), { home }));
}

test('many read/search calls in recent prompts suggest delegating to a subagent', async () => {
  const { entries, tokens } = session([
    [read(1), read(2), grep, read(3)],
    [glob, read(4), read(5), read(6), grep],
    [read(7), read(8), grep, read(9), glob, read(10)],
  ]);
  const out = await runWith(entries, tokens);
  assert.match(lines(out)[1], /subagent/i);
  assert.match(lines(out)[1], /15 read\/search calls/);
});

test('read calls inside subagents (sidechains) are not counted', async () => {
  const main = session([[read(1), read(2)]]);
  const side = session([[read(3), read(4), grep, read(5), glob, read(6), read(7), read(8), grep, read(9), glob, read(10), read(11), read(12), grep, read(13)]], { sidechain: true });
  const entries = [...main.entries, ...side.entries.filter((e) => e.type === 'assistant')];
  const out = await runWith(entries, main.tokens + 1000);
  assert.doesNotMatch(out, /subagent/i);
});

test('mostly edit/write activity does not suggest delegating', async () => {
  const tools = [];
  for (let i = 0; i < 15; i++) tools.push(read(i), edit(i), edit(i + 100));
  const { entries, tokens } = session([tools.slice(0, 15), tools.slice(15, 30), tools.slice(30)]);
  const out = await runWith(entries, tokens);
  assert.doesNotMatch(out, /subagent/i);
});

test('reads spread over prompts older than the recent window are not counted', async () => {
  const { entries, tokens } = session([
    [read(1), read(2), read(3), read(4), read(5), read(6), read(7), read(8), read(9), read(10), read(11), read(12), read(13), read(14), read(15)],
    [edit(1)], [edit(2)], [edit(3)], [edit(4)], [edit(5)],
  ]);
  const out = await runWith(entries, tokens);
  assert.doesNotMatch(out, /subagent/i);
});
