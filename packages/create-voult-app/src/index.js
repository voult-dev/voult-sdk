import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { parseArgs } from 'node:util';
import { RENAMES, TEMPLATES, copyTemplate, templatesDir } from './templates.js';

export { TEMPLATES } from './templates.js';

const HELP = `Create an app with Voult sign-in already wired up.

Usage:
  npx create-voult-app [dir] [options]

Options:
  -t, --template <name>    ${Object.keys(TEMPLATES).join(' | ')} (asked if omitted; default express-react)
  --client-id <id>         Your app's Client ID (Voult dashboard); writes .env with voult init
  --client-secret <secret> Its Client Secret. Or set VOULT_CLIENT_SECRET, which keeps it out of shell history
  --no-install             Copy the template only (no install, no .env)
  -h, --help               Show this help
`;

/** The package manager that ran us (npm_config_user_agent is "pnpm/9.1.0 npm/? node/…"). */
export function detectPackageManager(userAgent = process.env.npm_config_user_agent ?? '') {
  const name = userAgent.split('/')[0];
  return ['pnpm', 'yarn', 'bun'].includes(name) ? name : 'npm';
}

const VOULT_BIN = { npm: ['npx', ['voult']], pnpm: ['pnpm', ['exec', 'voult']], yarn: ['yarn', ['voult']], bun: ['bunx', ['voult']] };
// "pnpm run", not "pnpm": pnpm's built-in commands (doctor, …) win over package scripts of the same name.
const RUN_SCRIPT = { npm: 'npm run', pnpm: 'pnpm run', yarn: 'yarn', bun: 'bun run' };

function defaultAsk(question, fallback = '', { secret = false } = {}) {
  if (!process.stdin.isTTY) return Promise.resolve(fallback);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (secret) rl._writeToOutput = (text) => { if (text.includes(question)) process.stdout.write(text); };
  return new Promise((resolve) => {
    rl.question(`${question}${fallback ? ` (${fallback})` : ''}: `, (answer) => {
      if (secret) process.stdout.write('\n');
      rl.close();
      resolve(answer.trim() || fallback);
    });
  });
}

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9-_.]+/g, '-').replace(/^[-.]+|-+$/g, '') || 'voult-app';

/**
 * `npx create-voult-app my-app --template nextjs`. Side effects are injectable for tests.
 * @param {string[]} argv
 * @param {{ cwd?: string, log?: (s: string) => void, ask?: typeof defaultAsk,
 *   run?: (cmd: string, args: string[], opts: object) => { status: number | null },
 *   env?: Record<string, string | undefined>, packageManager?: string }} [io]
 */
export async function createVoultApp(argv, io = {}) {
  const log = io.log ?? console.log;
  const ask = io.ask ?? defaultAsk;
  const env = io.env ?? process.env;
  const run = io.run ?? ((cmd, args, opts) => spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts }));

  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      template: { type: 'string', short: 't' },
      'client-id': { type: 'string' },
      'client-secret': { type: 'string' },
      'no-install': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    log(HELP);
    return null;
  }

  const dir = positionals[0] ?? (await ask('Project folder', 'my-voult-app'));
  const target = path.resolve(io.cwd ?? process.cwd(), dir);
  if (fs.existsSync(target) && fs.readdirSync(target).length > 0) {
    throw new Error(`${dir} already exists and isn't empty. Pick a new folder name, or empty that folder first.`);
  }

  const template = values.template ?? (await ask(`Template: ${Object.keys(TEMPLATES).join(', ')}`, 'express-react'));
  if (!TEMPLATES[template]) {
    throw new Error(`Unknown template "${template}". Choose one of: ${Object.keys(TEMPLATES).join(', ')}.`);
  }

  // 1. Copy
  copyTemplate(path.join(templatesDir(), template), target);
  for (const [from, to] of Object.entries(RENAMES)) {
    if (fs.existsSync(path.join(target, from))) fs.renameSync(path.join(target, from), path.join(target, to));
  }
  const manifestPath = path.join(target, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.name = slug(path.basename(target));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  log(`\nCreated ${dir} from the ${template} template.`);

  // 2. Install, with the package manager that ran create-voult-app
  const packageManager = io.packageManager ?? detectPackageManager(env.npm_config_user_agent);
  const install = !values['no-install'];
  if (install) {
    log(`Installing with ${packageManager}…\n`);
    const result = run(packageManager, ['install'], { cwd: target });
    if (result.status !== 0) throw new Error(`${packageManager} install failed in ${dir}. Fix the error above, then run it again there.`);
  }

  // 3. .env through voult init (the secret goes through the environment, never the command line)
  let initialized = false;
  if (install) {
    const clientId = values['client-id'] ?? (await ask('Voult Client ID (Enter to skip; from your app in the Voult dashboard)', ''));
    const clientSecret = clientId ? values['client-secret'] ?? env.VOULT_CLIENT_SECRET ?? (await ask('Voult Client Secret', '', { secret: true })) : '';
    if (clientId && clientSecret) {
      const [cmd, prefix] = VOULT_BIN[packageManager];
      const result = run(cmd, [...prefix, 'init', '--yes', '--quiet', '--client-id', clientId], {
        cwd: target,
        env: { ...env, VOULT_CLIENT_SECRET: clientSecret },
      });
      initialized = result.status === 0;
    }
  }

  // 4. Next steps
  const { url, callback } = TEMPLATES[template];
  const runScript = RUN_SCRIPT[packageManager];
  const steps = [`  cd ${dir}`];
  if (!install) steps.push(`  ${packageManager} install`);
  if (!initialized) {
    const [cmd, prefix] = VOULT_BIN[packageManager];
    const init = [cmd, ...prefix, 'init'].join(' ');
    steps.push(`  ${init}${' '.repeat(Math.max(1, 26 - init.length))}# writes .env with your Client ID and Secret`);
  }
  steps.push(`  ${runScript} dev${' '.repeat(Math.max(1, 20 - runScript.length))}# ${url}`);
  log(`\nNext:\n${steps.join('\n')}\n`);
  log(`In the Voult dashboard, add this under Callback URLs (it also covers magic links):\n  ${callback}\n`);
  log(`Then check everything:\n  ${runScript} doctor\n`);

  return { target, template, packageManager, installed: install, initialized };
}
