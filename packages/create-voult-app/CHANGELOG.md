# Changelog

## 0.1.0

First release.

- `npx create-voult-app [dir] [--template express-react|nextjs|minimal] [--client-id …] [--client-secret …] [--no-install]`: copies the template shipped in the package (no network fetch), names the project, installs with the package manager that ran it (npm, pnpm, yarn, bun), writes `.env` with `voult init --yes` (the secret passes through the environment, never the command line), and prints the next steps with the callback URL to allowlist.
- Refuses a folder that exists and isn't empty.
- Templates: `express-react` (Express + Vite/React, full UI), `nextjs` (App Router, full UI, `requireSession()`), `minimal` (Express + one HTML page). `@voult/*` versions are pinned at pack time to the ones released alongside.
