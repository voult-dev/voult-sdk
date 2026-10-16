import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TEMPLATES = {
  'express-react': { label: 'Express + React (Vite): full UI', url: 'http://localhost:5173', callback: 'http://localhost:5173/api/auth/oauth/callback' },
  nextjs: { label: 'Next.js App Router: full UI', url: 'http://localhost:3000', callback: 'http://localhost:3000/api/auth/oauth/callback' },
  minimal: { label: 'Express + one HTML page, no build step', url: 'http://localhost:3000', callback: 'http://localhost:3000/api/auth/oauth/callback' },
};

// npm strips .gitignore from tarballs, and the release check refuses .env* files: templates
// store them under these names and the scaffolder renames them.
export const RENAMES = { _gitignore: '.gitignore', '_env.example': '.env.example' };

const SKIP = new Set(['node_modules', 'dist', '.next', '.env', 'package-lock.json']);

/** The templates shipped in this package, or the monorepo's when running from a checkout. */
export function templatesDir() {
  const shipped = fileURLToPath(new URL('../templates/', import.meta.url));
  return fs.existsSync(shipped) ? shipped : fileURLToPath(new URL('../../../templates/', import.meta.url));
}

/** Copy a template, leaving out build output and local files a developer may have created. */
export function copyTemplate(from, to) {
  fs.cpSync(from, to, { recursive: true, filter: (src) => !SKIP.has(path.basename(src)) });
}

/**
 * At pack time: copy the monorepo's templates into the package and pin every `@voult/*`
 * dependency to the version being released from this checkout, so a create-voult-app release
 * scaffolds exactly the packages it was tested with.
 * @param {string} from  monorepo templates/
 * @param {string} to    packages/create-voult-app/templates/
 * @param {Record<string, string>} versions  package name → version
 */
export function bundleTemplates(from, to, versions) {
  fs.rmSync(to, { recursive: true, force: true });
  for (const name of fs.readdirSync(from)) {
    if (!TEMPLATES[name]) continue;
    copyTemplate(path.join(from, name), path.join(to, name));
    const manifestPath = path.join(to, name, 'package.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const field of ['dependencies', 'devDependencies']) {
      for (const dep of Object.keys(manifest[field] ?? {})) {
        if (dep.startsWith('@voult/')) {
          if (!versions[dep]) throw new Error(`${name}: no workspace package ${dep} to pin`);
          manifest[field][dep] = `^${versions[dep]}`;
        }
      }
    }
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}
