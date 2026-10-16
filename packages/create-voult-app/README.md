# create-voult-app

A new app with [Voult](https://github.com/voult-dev/voult) sign-in already wired up: sign-up, password, Google/GitHub, magic links, passkeys, MFA, sessions and linked accounts, with no auth code to write.

```bash
npx create-voult-app my-app
cd my-app && npm run dev
```

It asks for a template and your app's Client ID and Secret (from the Voult dashboard), installs, and writes `.env`.

| Template | What you get |
|---|---|
| `express-react` (default) | Express + `@voult/express` server, Vite + React + `@voult/react` UI. http://localhost:5173 |
| `nextjs` | Next.js App Router + `@voult/next`: one auth route file, `requireSession()` on `/account`. http://localhost:3000 |
| `minimal` | Express + one HTML page, no build step. http://localhost:3000 |

```bash
npx create-voult-app my-app --template nextjs --client-id <id>   # secret: VOULT_CLIENT_SECRET=… or prompted
npx create-voult-app my-app --no-install                         # copy only
```

Works with npm, pnpm, yarn and bun (`pnpm create voult-app`, `yarn create voult-app`): it installs with whichever ran it. The target folder must be new or empty.

Afterwards, add the printed callback URL under **Callback URLs** in the dashboard and run `npm run doctor`.

Each release pins the `@voult/*` packages it was tested with (CI scaffolds and boots every template from the packed packages).
