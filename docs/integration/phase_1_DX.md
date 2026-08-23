# Phase 1 Implementation Guide — DX Quick Wins

**Phase DoD:** [PHASE_01_DX_QUICK_WINS.md](../phases/PHASE_01_DX_QUICK_WINS.md)  
**Architecture / deep dive:** [dx/PHASE_1_QUICK_WINS.md](../dx/PHASE_1_QUICK_WINS.md)  
**Estimate:** 2–4 weeks  

This guide is the **ordered work plan**. Complete each step’s verification before starting the next.

---

## North star (what “done” feels like)

```bash
npm install @voult/express voult-sdk
npx voult init
# mount createVoultRouter() once
# register → login → me → refresh → logout works in a demo app
```

Integrator writes **< 20 lines**. Time to first login from docs alone: **< 15 minutes**.

---



## Repos you will touch


| Repo               | Path (org layout)                            | Role in Phase 1                                    |
| ------------------ | -------------------------------------------- | -------------------------------------------------- |
| `voult`            | this repo                                    | Staging API, optional `GET /api/meta`, docs        |
| `voult-sdk`        | `../voult-sdk`                               | Publishable client; peer dep of `@voult/express`   |
| `voult_playground` | `../voult_playground`                        | Behavioral spec → then **consumer** of the package |
| `@voult/express`   | new (`packages/express` or `voult-packages`) | Mountable BFF                                      |
| `@voult/cli`       | new                                          | `voult init`                                       |
| `voult-demo`       | new (or playground)                          | Proves packages without copying BFF                |


---



## Prerequisites (do first)

- [x] Staging API healthy: password register / login / logout (smoke on `staging.voult.dev`)
- [x] Developer portal: you can create an App and copy `clientId` + `clientSecret`
- [x] Local clones of `voult`, `voult-sdk`, `voult_playground` on `main` (or agreed branches)
- [ ] npm org access for `@voult/*` (or decide GitHub Packages for `0.1.0`)
- [ ] Read [dx/PHASE_1_QUICK_WINS.md](../dx/PHASE_1_QUICK_WINS.md) §3 (architecture: extract, per-request client, cookie vs bearer)

**Gate:** You can log in on staging and have a sandbox App’s credentials in a password manager — not committed anywhere.

---



## Step 0 — Lock package names and layout (½ day)

Decide and write down (do not rename mid-phase):


| Package     | Name                        | First version                    |
| ----------- | --------------------------- | -------------------------------- |
| Express BFF | `@voult/express`            | `0.1.0`                          |
| CLI         | `@voult/cli` (bin: `voult`) | `0.1.0`                          |
| SDK         | `voult-sdk` (existing)      | publish current / bump as needed |


**Layout options (pick one):**

1. **Monorepo packages/** under a `voult-packages` repo (recommended if you want workspace `file:` links)
2. **Separate repos** `voult-express`, `voult-cli`

**Tasks:**

- [ ] Create empty package scaffolds + LICENSE + README stubs
- [ ] Add `.npmignore` / `files` so `.env` and secrets never land in the tarball
- [ ] Document publish target (npmjs vs GitHub Packages) in each README

**Verify:**

```bash
npm pack --dry-run   # inside each package — no .env, no keys
```

---



## Step 1 — Publish (or prepare) `voult-sdk` (1–2 days)

`@voult/express` must depend on a **resolvable** SDK, not only a sibling `file:` path for external integrators.

**Tasks:**

- [x] Confirm `voult-sdk` `exports` / ESM entry work from a clean install
- [x] Run unit + integration tests
- [x] Tag and publish (or `npm pack` + local verdaccio for private dry-run)
- [x] Note the exact version string `@voult/express` will peer-depend on (e.g. `>=0.0.3`)

**Verify:**

```bash
mkdir /tmp/sdk-smoke && cd /tmp/sdk-smoke
npm init -y
npm install voult-sdk@<published-or-packed>
node -e "import('voult-sdk').then(m => console.log(Object.keys(m)))"
```

**Gate:** A stranger machine can `npm install voult-sdk` and import `VoultClient`.

---



## Step 2 — Scaffold `@voult/express` (1 day)

**Tasks:**

- [ ] `package.json`: name `@voult/express`, `peerDependencies` on `express` + `voult-sdk`, dep on `cookie-parser` (if cookie strategy)
- [ ] Public surface only:

```js
export { createVoultRouter } from './router.js';
export { createVoultMiddleware } from './middleware.js'; // optional thin helper
export { loadConfigFromEnv } from './config.js';
```

- [x] Vitest (or Jest) + supertest harness
- [x] Prefer TypeScript for public types even if runtime is JS (integrators need autocomplete)

**Canonical env names** (implement in Step 3):

```bash
VOULT_BASE_URL=
VOULT_CLIENT_ID=
VOULT_CLIENT_SECRET=
VOULT_SESSION_SECRET=   # cookie strategy
VOULT_APP_URL=          # optional
```

Legacy aliases (`CLIENT_ID`, etc.) → one-time deprecation `warn` at startup. Details: [deep dive §Step 2](../dx/PHASE_1_QUICK_WINS.md#step-2--implement-loadconfigfromenv).

**Verify:** Package builds; empty router mounts on Express without throwing when config is valid.

---



## Step 3 — `loadConfigFromEnv()` + actionable errors (½–1 day)

**Tasks:**

- [ ] Implement validator with **fix-oriented** messages (where to find Client ID, when secret is required)
- [ ] Support `overrides` for tests and advanced integrators
- [ ] Default `session.strategy` to `'cookie'`
- [ ] Reject cookie strategy without `VOULT_SESSION_SECRET` in production

**Verify (unit tests):**


| Case                              | Expected                    |
| --------------------------------- | --------------------------- |
| Missing `VOULT_CLIENT_ID`         | Throws with dashboard hint  |
| Missing `VOULT_CLIENT_SECRET`     | Throws                      |
| Invalid `VOULT_BASE_URL`          | Throws                      |
| Cookie + no session secret (prod) | Throws                      |
| Legacy `CLIENT_ID` set            | Works + deprecation warning |


**Gate:** Bad `.env` fails fast with a message a junior engineer can act on.

---



## Step 4 — Extract password BFF from Playground (3–5 days)

**Source of truth (copy behavior, then delete duplication later):**

```text
voult_playground/backend/src/
├── routes/api.js                 → createVoultRouter()
├── utils/voultTokens.js          → cookie persist / clear
├── middleware/syncVoultClient.js → adapt to per-request client
├── middleware/requireAuth.js
├── middleware/errorHandler.js    → normalizeVoultError()
└── utils/catchAsync.js
```

**Do not extract yet:** `oauthFlow.js` (Phase 2), playground-only sanitize (optional plugin).

### 4a — Per-request `VoultClient` (required)

No global singleton. Every request:

1. `new VoultClient(config)`
2. Apply session from cookies **or** `Authorization: Bearer`
3. Attach as `req.voult`
4. Persist tokens **before** response headers are sent (never `res.on('finish')` for `Set-Cookie`)



### 4b — Phase 1 route map (minimum)

Wire these first (mirror playground paths under whatever mount the integrator chooses, e.g. `/api/auth`):


| Method | Path                    | Notes                                    |
| ------ | ----------------------- | ---------------------------------------- |
| GET    | `/session`              | Current session bootstrap                |
| POST   | `/register`             | Email + password                         |
| POST   | `/username-register`    | Optional but keep parity                 |
| POST   | `/email-login`          |                                          |
| POST   | `/username-login`       |                                          |
| POST   | `/logout`               | Invalidates / clears                     |
| POST   | `/sessions/refresh`     | Rotation                                 |
| GET    | `/user/me`              |                                          |
| PATCH  | `/user/me`              | Optional P1                              |
| POST   | `/user/forgot-password` |                                          |
| POST   | `/user/reset-password`  |                                          |
| GET    | `/user/verify-email`    |                                          |
| POST   | `/mfa/verify`           | Keep if playground already depends on it |
| GET    | `/mfa/status`           |                                          |


Full table + MFA/session extras: [deep dive §Step 3](../dx/PHASE_1_QUICK_WINS.md#step-3--extract-createvoultrouter).

### 4c — Session strategies


| Strategy | Integrator               | Default |
| -------- | ------------------------ | ------- |
| `cookie` | `credentials: 'include'` | **Yes** |
| `bearer` | Client stores tokens     | Opt-in  |


**Verify (package integration tests against local or staging API):**

- [ ] Register → authenticated session
- [ ] Login → cookies (or tokens) set
- [ ] `GET .../user/me` → 200
- [ ] Refresh → new refresh token persisted
- [ ] Logout → subsequent `/me` is 401
- [ ] Missing auth on protected route → 401 with normalized error shape

**Gate:** Package tests green without importing playground source files.

---



## Step 5 — Build `@voult/cli` `init` (2–3 days)

**Binary:** `voult` → command `init`.

**Flow:**

1. Detect `package.json` / Express
2. Prompt: base URL, client id/secret, session strategy, framework
3. Write `.env` (no overwrite without `--force`)
4. Write `.env.example` (keys only)
5. Auto-generate `VOULT_SESSION_SECRET` for cookie strategy
6. Optionally append a minimal `server` snippet
7. Print curl smoke commands

**Tasks:**

- [ ] Scaffold `@voult/cli` with `bin` field
- [ ] Use `@inquirer/prompts` (or equivalent)
- [ ] Never print secrets back to the terminal after input
- [ ] `voult init --help` documents flags (`--force`, non-interactive later)

**Verify:**

```bash
mkdir /tmp/voult-init-smoke && cd /tmp/voult-init-smoke
npm init -y
npm install express @voult/express voult-sdk @voult/cli
npx voult init
# fill staging credentials
# mount router, npm start, curl register + login
```

**Gate:** Cold folder → working password login without reading playground source.

---



## Step 6 — Migrate Playground to consume `@voult/express` (2–3 days)

Playground becomes a **customer** of the package, not the place integrators copy from.

**Tasks:**

- [ ] Depend on `@voult/express` (`workspace:*` or `file:` / published version)
- [ ] Replace core of `backend/src/routes/api.js` with `createVoultRouter({ ... })`
- [ ] Keep playground-only routes/plugins local (sanitize, provider-visibility, OAuth until Phase 2)
- [ ] Switch `.env` to canonical `VOULT_*` names
- [ ] Delete duplicated token/middleware files only after parity tests pass
- [ ] Run full playground test suite

**Verify:**

```bash
cd voult_playground
npm test
# Manual: register / login / me / refresh / logout in UI
```

**Gate:** Zero duplicated BFF route handlers for password auth; playground CI green.

> **Forward link:** Phase **3** turns this package-consuming Playground into `create-voult-app` templates. After Step 6, treat Playground as the future template source — avoid adding copy-paste integrator docs.

---



## Step 7 — Demo app (required DoD) (1–2 days)

Create `voult-demo` (Express) **or** document Playground-as-demo if it uses **only** packages (no vendored BFF).

**Checklist (tick all):**

- [ ] `npx voult init` against **staging** credentials
- [ ] Register EndUser
- [ ] Email verify path understood (document if staging email is mocked)
- [ ] Login → session cookie or bearer tokens
- [ ] `GET /me` (or BFF equivalent)
- [ ] Refresh rotation
- [ ] Logout invalidates session
- [ ] Any failure filed as a **DX bug**, not “demo user error”

**Verify:** A second engineer (or you on a clean machine) follows only the quick-start and hits login in **< 15 minutes**.

---



## Step 8 — Docs & README links (1 day)

**Tasks:**

- [ ] Add `docs/integration/QUICK_START.md` — create App → `voult init` → mount router → curl/fetch → troubleshoot
- [ ] Update `voult` root README: “Integrate in 10 minutes” → quick-start
- [ ] Update [AUTH_ONLY_FEATURE_GUIDE.md](../integration/AUTH_ONLY_FEATURE_GUIDE.md): replace “copy BFF” with `@voult/express`
- [ ] Update `voult-sdk` README: recommend `@voult/express` for server apps
- [ ] Update `voult_playground` README: “reference consumer of `@voult/express`”

**Gate:** Main README path does not require opening playground `api.js`.

---



## Step 9 — Publish `@voult/express` + `@voult/cli` (1 day)

**Publish checklist:**

- [ ] CI green (unit + integration)
- [ ] README with install + 15-line example
- [ ] CHANGELOG `0.1.0`
- [ ] `npm pack` audit — no secrets, no `.env`
- [ ] Peer dependency ranges documented
- [ ] Publish `@voult/express@0.1.0`
- [ ] Publish `@voult/cli@0.1.0`
- [ ] Demo app switched from `file:` to published versions and re-smoked on staging

**Optional (API):** `GET /api/meta` `{ version, features, minSdkVersion }` — nice for later `voult doctor` (Phase 2). Not blocking.

---



## Definition of Done (copy from phase — all required)

- [ ] `@voult/express` published (`0.1.0`+)
- [ ] `@voult/cli` `init` works
- [ ] Env schema validated on BFF startup
- [ ] Playground uses `@voult/express`
- [ ] Password flows green in CI **and** demo app
- [ ] Publish checklist passed
- [ ] Quick-start linked from main README

When all boxes are checked → tick Phase **1** in [Obsidian PROGRESS](../obsidian/PROGRESS.md) → start [Phase 2 implementation](../phases/PHASE_02_DX_OAUTH_AND_FRONTEND.md) (OAuth + frontend).

---



## Suggested calendar


| Week  | Focus                                                      |
| ----- | ---------------------------------------------------------- |
| **1** | Steps 0–3 — packages, SDK publish, config, router skeleton |
| **2** | Step 4 — extract routes + session; package tests           |
| **3** | Steps 5–6 — CLI + playground migration                     |
| **4** | Steps 7–9 — demo, docs, publish, DoD sign-off              |


Compress if two engineers: one owns `@voult/express` + playground; one owns CLI + demo + docs.

---



## Troubleshooting while implementing


| Symptom                            | Likely cause                                  | Fix                                                                  |
| ---------------------------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| Cookies never stick                | Persist after headers sent                    | Set cookies in wrapper before `res.json` / redirect                  |
| Race / wrong user session          | Global `VoultClient`                          | Per-request client only                                              |
| Integrator copies playground again | Docs still say “copy api.js”                  | Ship quick-start; update AUTH_ONLY guide                             |
| `npm install @voult/express` fails | SDK not published / wrong peer                | Publish SDK first; align versions                                    |
| Staging works, demo fails          | Wrong base URL or client secret               | `voult init` + print effective `VOULT_BASE_URL` at boot (non-secret) |
| CSRF confusion on API routes       | Mixing developer portal CSRF with EndUser API | API BFF uses client credentials — no portal CSRF                     |


---



## Out of scope (defer)

- Hosted OAuth / `@voult/react` → **Phase 2**
- `voult doctor`, Next adapter, version negotiation → **Phase 2–3**
- Design system / main UI → **Phases 4–5**

---



## Related


| Doc                                                                              | Why                            |
| -------------------------------------------------------------------------------- | ------------------------------ |
| [phases/PHASE_01](../phases/PHASE_01_DX_QUICK_WINS.md)                           | Official DoD                   |
| [dx/PHASE_1_QUICK_WINS](../dx/PHASE_1_QUICK_WINS.md)                             | Architecture, route map, risks |
| [integration/AUTH_ONLY_FEATURE_GUIDE](../integration/AUTH_ONLY_FEATURE_GUIDE.md) | Integrator mental model        |
| [implementation/README](./README.md)                                             | Index of execution guides      |


