// prepack: copy ../../templates into this package, pinning @voult/* to this checkout's versions.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleTemplates } from '../src/templates.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const versions = Object.fromEntries(
  fs.readdirSync(path.join(root, 'packages')).flatMap((dir) => {
    const file = path.join(root, 'packages', dir, 'package.json');
    if (!fs.existsSync(file)) return [];
    const { name, version } = JSON.parse(fs.readFileSync(file, 'utf8'));
    return [[name, version]];
  })
);
bundleTemplates(path.join(root, 'templates'), path.resolve(here, '../templates'), versions);
console.error(`bundled templates with ${Object.entries(versions).filter(([n]) => n.startsWith('@voult/')).map(([n, v]) => `${n}@${v}`).join(', ')}`);
