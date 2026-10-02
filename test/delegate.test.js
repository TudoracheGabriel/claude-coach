import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coach, stdin, strip, lines, tempHome } from './helpers.js';
import { prompt, assistant, toolResult, writeTranscript } from './transcript.js';

// One prompt per element; each prompt makes the given tool calls in the main chain and then
// Claude finishes its turn, unless `midTurn` leaves the last prompt still being worked on.
function session(promptsTools, { sidechain = false, midTurn = false } = {}) {
  const entries = [];
  let tokens = 40_000;
  promptsTools.forEach((tools, i) => {
    entries.push(prompt(`p${i}`, `step ${i}`));
    for (const t of tools) {
      tokens += 1500;
      entries.push(assistant(tokens, { tools: [t], sidechain }), toolResult(`p${i}`));
    }
    if (!(midTurn && i === promptsTools.length - 1)) entries.push(assistant(tokens, { sidechain }));
  });
  return { entries, tokens };
}

test('no delegate tip while Claude is still working on the prompt', async () => {
  const many = [read(1), read(2), grep, read(3), glob, read(4), read(5), read(6), grep, read(7), read(8), grep, read(9), glob, read(10)];
  const { entries, tokens } = session([many], { midTurn: true });
  const out = await runWith(entries, tokens);
  assert.doesNotMatch(out, /subagent/i);
});

test('once the turn ends the delegate advice is a calm tip about next time', async () => {
  const many = [read(1), read(2), grep, read(3), glob, read(4), read(5), read(6), grep, read(7), read(8), grep, read(9), glob, read(10)];
  const { entries, tokens } = session([many]);
  const raw = await coach(stdin({ tokens, transcriptPath: writeTranscript(tempHome(), entries), promptId: null }));
  const advice = lines(raw)[1];
  assert.match(advice, /^Tip: Next time, ask Claude to explore with a subagent/);
  assert.doesNotMatch(advice, /▲/);
  assert.match(advice, /15 file reads\/searches in your last prompt/);
  assert.doesNotMatch(raw, /\x1b\[33m|\x1b\[31m/, 'tips are not yellow or red');
});

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
  assert.match(lines(out)[1], /15 file reads\/searches in your last 3 prompts/);
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
