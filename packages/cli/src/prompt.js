import fs from 'node:fs';
import readlinePromises from 'node:readline/promises';

let sharedRl;
let pipedLines; // lazily populated queue for non-TTY stdin (piped input, CI, etc.)

function getSharedInterface() {
  if (!sharedRl) {
    sharedRl = readlinePromises.createInterface({ input: process.stdin, output: process.stdout });
  }
  return sharedRl;
}

/**
 * Node's readline drops buffered lines after the first `question()` resolves when stdin
 * isn't a TTY (piped input): the whole chunk arrives before any question is pending, so
 * only the first line's 'line' event has a listener. Read everything up front instead.
 */
function nextPipedLine() {
  if (pipedLines === undefined) {
    let raw = '';
    try {
      raw = fs.readFileSync(0, 'utf8');
    } catch {
      raw = '';
    }
    pipedLines = raw.split('\n');
  }
  return pipedLines.length ? pipedLines.shift().trim() : '';
}

/** Close the shared interactive interface once the CLI is done prompting. Safe to call unconditionally. */
export function closePrompts() {
  sharedRl?.close();
  sharedRl = undefined;
}

/**
 * Ask a plain question, with an optional default. Reads interactively from a TTY,
 * or from a pre-read line queue when stdin is piped (non-interactive).
 * @param {string} question
 * @param {{ default?: string }} [options]
 * @returns {Promise<string>}
 */
export async function ask(question, options = {}) {
  const suffix = options.default ? ` (${options.default})` : '';
  if (!process.stdin.isTTY) {
    process.stdout.write(`${question}${suffix}: \n`);
    return nextPipedLine() || options.default || '';
  }

  const rl = getSharedInterface();
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || options.default || '';
}

/**
 * Ask for a secret without echoing it to the terminal. Falls back to the same
 * piped-line queue as `ask()` when stdin isn't an interactive TTY.
 * @param {string} question
 * @returns {Promise<string>}
 */
export function askSecret(question) {
  if (!process.stdin.isTTY) {
    return ask(question);
  }

  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(`${question}: `);

    let input = '';
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
    };

    function onData(chunk) {
      const char = chunk.toString('utf8');
      switch (char) {
        case '\r':
        case '\n':
          cleanup();
          process.stdout.write('\n');
          resolve(input);
          break;
        case '': // Ctrl+C
          cleanup();
          reject(new Error('Cancelled'));
          break;
        case '': // Backspace
        case '\b':
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          input += char;
          process.stdout.write('*');
          break;
      }
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
  });
}
