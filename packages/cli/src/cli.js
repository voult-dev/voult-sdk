import { runInit } from './init.js';

const HELP = `voult — scaffold Voult auth config for a server app

Usage:
  voult init [--force]

Commands:
  init      Write .env + .env.example for @voult/express (prompts for credentials)

Options:
  --force   Overwrite an existing .env
  -h, --help   Show this help
`;

/**
 * @param {string[]} argv process.argv.slice(2)
 * @param {object} [io] forwarded to runInit; see init.js
 */
export async function runCli(argv, io = {}) {
  const [command, ...rest] = argv;

  if (!command || command === '-h' || command === '--help') {
    (io.log ?? console.log)(HELP);
    return;
  }

  if (command === 'init') {
    await runInit(rest, io);
    return;
  }

  throw new Error(`Unknown command "${command}". Run "voult --help" for usage.`);
}
