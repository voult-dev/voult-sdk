#!/usr/bin/env node
import { createVoultApp } from '../src/index.js';

try {
  await createVoultApp(process.argv.slice(2));
} catch (err) {
  console.error(`\n${err.message}`);
  process.exit(1);
}
