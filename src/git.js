import { execFile } from 'node:child_process';

function dirtyCount(cwd, timeoutMs) {
  return new Promise((resolve) => {
    try {
      execFile(
        'git',
        ['--no-optional-locks', 'status', '--porcelain'],
        { cwd, timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
        (err, stdout) => resolve(err ? null : stdout.split('\n').filter(Boolean).length),
      );
    } catch {
      resolve(null);
    }
  });
}

// Dirty-file count, cached in session state. null outside a repo, on timeout, or without git.
export async function gitDirty(state, cwd, now, opts) {
  const cached = state.git;
  if (cached && cached.cwd === cwd && now - cached.at >= 0 && now - cached.at < opts.cacheSeconds * 1000) return cached.dirty;
  const dirty = cwd ? await dirtyCount(cwd, opts.timeoutMs) : null;
  state.git = { cwd, at: now, dirty };
  return dirty;
}
