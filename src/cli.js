import { install, uninstall } from './cli/install.js';
import { report } from './cli/report.js';

const USAGE = `Usage: claude-coach [command]

  (no command)   status line mode: reads Claude Code session JSON on stdin
  install        set claude-coach as your Claude Code status line (keeps your old one)
  uninstall      restore your previous settings
  report [--since YYYY-MM-DD] [--until YYYY-MM-DD]
                 local before/after metrics from your past sessions (default: last 14 days)
`;

// Seam B: argv + home in, exit code and text out.
/** @param {string[]} argv @param {{ home: string, now?: number }} env */
export async function cli(argv, env) {
  const [command] = argv;
  switch (command) {
    case 'install':
      return install(env.home);
    case 'uninstall':
      return uninstall(env.home);
    case 'report':
      return report(env.home, argv.slice(1), env.now ?? Date.now());
    case 'help':
    case '--help':
    case '-h':
      return { code: 0, output: USAGE };
    default:
      return { code: 1, output: `Unknown command: ${command}\n\n${USAGE}` };
  }
}
