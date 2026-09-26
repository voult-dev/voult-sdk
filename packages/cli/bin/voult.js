#!/usr/bin/env node
import { runCli } from '../src/cli.js';

runCli(process.argv.slice(2)).then((result) => {
  if (result && result.ok === false) process.exitCode = 1;
}).catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
