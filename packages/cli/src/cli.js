import { runInit } from './init.js';
import { runDoctor } from './doctor.js';

const HELP = `voult — scaffold Voult auth config for a server app

Usage:
  voult init [--force]
  voult doctor [--json] [--callback-url <url>]

Commands:
  init      Write .env + .env.example for @voult/express (prompts for credentials)
  doctor    Check .env, API reachability, credentials, callback URL and providers

Options:
  --force   Overwrite an existing .env (init)
  --json    Machine-readable output; exit code 1 if any check fails (doctor)
  -h, --help   Show this help (or: voult doctor --help)
`;

/**
 * @param {string[]} argv process.argv.slice(2)
 * @param {object} [io] forwarded to the command; see init.js / doctor.js
 * @returns {Promise<{ ok: boolean } | undefined>} doctor's result (bin/voult.js sets the exit code)
 */
export async function runCli(argv, io = {}) {
  const [command, ...rest] = argv;

  if (command === 'doctor') {
    return runDoctor(rest, io);
  }

  if (!command || [command, ...rest].some((a) => a === '-h' || a === '--help')) {
    (io.log ?? console.log)(HELP);
    return;
  }

  if (command === 'init') {
    await runInit(rest, io);
    return;
  }

  throw new Error(`Unknown command "${command}". Run "voult --help" for usage.`);
}
