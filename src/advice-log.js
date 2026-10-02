import fs from 'node:fs';
import path from 'node:path';
import { coachDir } from './state.js';

const MAX_BYTES = 2 * 1024 * 1024;
const KEEP_LINES = 2000;

export const adviceLogPath = (home) => path.join(coachDir(home), 'advice.jsonl');

// One line each time a different advice starts being shown. Used only by `report`.
export function logAdvice(home, entry) {
  const file = adviceLogPath(home);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(entry) + '\n');
    if (fs.statSync(file).size > MAX_BYTES) {
      const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
      fs.writeFileSync(file, lines.slice(-KEEP_LINES).join('\n') + '\n');
    }
  } catch {}
}

export function readAdviceLog(home) {
  try {
    return fs
      .readFileSync(adviceLogPath(home), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter((e) => e && typeof e.session === 'string' && typeof e.advice === 'string' && typeof e.at === 'number');
  } catch {
    return [];
  }
}
