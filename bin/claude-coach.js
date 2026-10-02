#!/usr/bin/env node
import os from 'node:os';
import { run } from '../src/run.js';
import { FALLBACK } from '../src/render.js';

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

async function statusLine() {
  let out = FALLBACK;
  try {
    const input = await readStdin();
    out = await run(input, {
      home: os.homedir(),
      now: Date.now(),
      columns: Number(process.env.COLUMNS) || 120,
    });
  } catch {
    out = FALLBACK;
  }
  process.stdout.write(out + '\n');
}

statusLine().finally(() => {
  process.exitCode = 0;
});
