#!/usr/bin/env node
import os from 'node:os';
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

// Status line mode must never fail: any error becomes the fallback line and exit code 0.
// Loading the modules overlaps with reading stdin.
async function statusLine() {
  let out = FALLBACK;
  try {
    const [{ run }, input] = await Promise.all([import('../src/run.js'), readStdin()]);
    out = await run(input, {
      home: os.homedir(),
      now: Date.now(),
      columns: Number(process.env.COLUMNS) || 120,
      capture: process.env.CLAUDE_COACH_CAPTURE === '1',
    });
  } catch {
    out = FALLBACK;
  }
  process.stdout.write(out + '\n');
  process.exitCode = 0;
}

async function command(argv) {
  try {
    const { cli } = await import('../src/cli.js');
    const { code, output } = await cli(argv, { home: os.homedir(), now: Date.now() });
    process.stdout.write(output.endsWith('\n') ? output : output + '\n');
    process.exitCode = code;
  } catch (e) {
    process.stderr.write(`claude-coach ${argv[0]} failed: ${e instanceof Error ? e.message : e}\n`);
    process.exitCode = 1;
  }
}

const argv = process.argv.slice(2);
if (argv.length) command(argv);
else statusLine();
