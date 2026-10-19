# Changelog

## 0.1.4

- Templates come with `@voult/cli` 0.3.0: `voult doctor --production` before deploying (the template READMEs say so) and `voult upgrade` to move to newer Voult packages later (new "Updating Voult" section in each README).

## 0.1.3

- **Fix: the pnpm next steps said `pnpm doctor`**, which runs pnpm's own built-in `doctor`, not the template's Voult check. They now say `pnpm run doctor` (and `pnpm run dev`).

## 0.1.2

- **Fix: `pnpm create voult-app` with `express-react` failed on pnpm 12** (`ERR_PNPM_IGNORED_BUILDS: esbuild`): pnpm 12 blocks install scripts unless allowed, and esbuild (Vite's bundler) has one. The template now ships a `pnpm-workspace.yaml` allowing it (`allowBuilds`); npm and yarn ignore the file.
- The "run voult init" hint uses the package manager that ran it (`pnpm exec voult init`, `yarn voult init`, `bunx voult init`).

## 0.1.1

- `express-react` is organised as `backend/` (`server.js`, `auth.js` with the auth routes, `api.js` for your own routes) and `frontend/` (`src/pages/` for your app, `src/auth/` for the auth UI). Still one package: one install, one `npm run dev`, one origin.
- All templates show users only errors they can fix; anything else is logged and shown as "Something went wrong" (the real error also appears while `npm run dev` runs). Passkey failures in the browser get plain words.
- `.env.example` lists the 3 required keys, with the optional ones commented out.
- Pins `@voult/express` 0.4, `@voult/next` 0.2, `@voult/sdk` 0.2.2, `@voult/cli` 0.2.5.

## 0.1.0

First release.

- `npx create-voult-app [dir] [--template express-react|nextjs|minimal] [--client-id …] [--client-secret …] [--no-install]`: copies the template shipped in the package (no network fetch), names the project, installs with the package manager that ran it (npm, pnpm, yarn, bun), writes `.env` with `voult init --yes` (the secret passes through the environment, never the command line), and prints the next steps with the callback URL to allowlist.
- Refuses a folder that exists and isn't empty.
- Templates: `express-react` (Express + Vite/React, full UI), `nextjs` (App Router, full UI, `requireSession()`), `minimal` (Express + one HTML page). `@voult/*` versions are pinned at pack time to the ones released alongside.
