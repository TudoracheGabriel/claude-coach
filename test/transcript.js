import fs from 'node:fs';
import path from 'node:path';

// Builds transcript JSONL entries in the shape Claude Code writes them.
let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
const base = (extra) => ({
  uuid: uuid(),
  sessionId: 'session-a',
  timestamp: new Date(Date.UTC(2026, 9, 2, 10, 0, 0) + seq * 1000).toISOString(),
  ...extra,
});

export function prompt(promptId, text, extra = {}) {
  return base({ type: 'user', isSidechain: false, promptId, message: { role: 'user', content: text }, ...extra });
}

export function command(promptId, name, extra = {}) {
  return prompt(
    promptId,
    `<command-name>${name}</command-name>\n<command-message>${name.slice(1)}</command-message>\n<command-args></command-args>`,
    extra,
  );
}

// stop_reason defaults to what Claude Code records: 'tool_use' while working, 'end_turn' when done.
export function assistant(contextTokens, { tools = [], sidechain = false, text = 'ok', at = undefined, cacheWrite = 1000, stop = undefined } = {}) {
  const content = tools.length
    ? tools.map(([name, input]) => ({ type: 'tool_use', id: `toolu_${uuid()}`, name, input }))
    : [{ type: 'text', text }];
  return base({
    type: 'assistant',
    isSidechain: sidechain,
    ...(at !== undefined && { timestamp: new Date(at).toISOString() }),
    message: {
      model: 'claude-opus-5-5',
      role: 'assistant',
      content,
      stop_reason: stop ?? (tools.length ? 'tool_use' : 'end_turn'),
      usage: {
        input_tokens: 2,
        cache_creation_input_tokens: cacheWrite,
        cache_read_input_tokens: contextTokens - cacheWrite - 2,
        output_tokens: 150,
      },
    },
  });
}

export function toolResult(promptId, text = 'file contents') {
  return base({
    type: 'user',
    isSidechain: false,
    promptId,
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: text }] },
  });
}

export function compactBoundary(trigger = 'auto', preTokens = 160_000) {
  return base({ type: 'system', subtype: 'compact_boundary', content: 'Conversation compacted', compactMetadata: { trigger, preTokens } });
}

export const jsonl = (entries) => entries.map((e) => JSON.stringify(e)).join('\n') + '\n';

export function writeTranscript(dir, entries, name = 'transcript.jsonl') {
  const file = path.join(dir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, jsonl(entries));
  return file;
}

export function appendTranscript(file, entries) {
  fs.appendFileSync(file, jsonl(entries));
}
