import { install, uninstall } from './cli/install.js';

const USAGE = `Usage: claude-coach [command]

  (no command)   status line mode: reads Claude Code session JSON on stdin
  install        set claude-coach as your Claude Code status line (keeps your old one)
  uninstall      restore your previous settings
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
    case 'help':
    case '--help':
    case '-h':
      return { code: 0, output: USAGE };
    default:
      return { code: 1, output: `Unknown command: ${command}\n\n${USAGE}` };
  }
}
