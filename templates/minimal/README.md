# My Voult app (minimal)

One Express server and one HTML page, no build step: password sign-in and sign-up, Google/GitHub, and the MFA code prompt, all through `@voult/express` at `/api/auth`.

```bash
npm run dev        # http://localhost:3000
```

No `.env` yet? `npx voult init`. Add `http://localhost:3000/api/auth/oauth/callback` under **Callback URLs** in the Voult dashboard, then `npm run doctor`.

`server.js` is the whole backend; `public/index.html` is the whole frontend. Every other route the router serves (MFA setup, sessions, passkeys, magic links, …) is listed in the [route reference](https://github.com/voult-dev/voult/blob/main/docs/integration/QUICK_START.md#route-reference). For a full UI, start from the `express-react` or `nextjs` template instead.
