# Changelog

All notable changes to `@voult/cli` are documented here.

## 0.2.2

- No code changes. Published manually (no provenance) before the release pipeline was set up.

## 0.2.1

- `voult init` now links to the dashboard of the Voult it targets (`https://staging.voult.dev/dashboard` during the preview, or `$VOULT_BASE_URL/dashboard`). 0.2.0 linked `www.voult.dev/dashboard`, which is the landing site and returns 404.

## 0.2.0

- **New: `voult doctor`** checks packages, `.env`, session secret, leftover provider variables, API reachability, SDK version, credentials, the OAuth callback allowlist, https in production, and provider setup. Each problem comes with a fix. `--json` for CI, `--callback-url` to check a specific callback; exit code 1 when anything fails. Never prints secrets.
- Doctor validates `.env` with the project's own `@voult/express` (`loadConfigFromEnv`) and talks to Voult with the project's `@voult/sdk` (0.2.0+ for the API checks; older SDKs are reported, not crashed on).
- `voult init` writes `VOULT_OAUTH_CALLBACK_URL` into `.env.example` (optional) and suggests running `voult doctor` afterwards.
- **Requires Node 20.12+** (uses `util.parseEnv`; Node 18 is end-of-life).

## 0.1.6

- `voult init` now writes the chosen session strategy as `VOULT_SESSION_STRATEGY`. Before, picking `bearer` only skipped the session secret — `@voult/express` still ran in cookie mode. Needs `@voult/express` 0.1.2+.

## 0.1.5

- **Fix:** `voult init --help` ran init (prompting and writing `.env`) instead of printing help. `-h`/`--help` anywhere in the args now prints help and exits.
- **Fix:** `voult init` accepted a blank Client ID/Secret and wrote a `.env` that only failed later at server startup. It now refuses and writes nothing.
- Added the MIT `LICENSE` file to the published package.

## 0.1.3

- **`voult init` no longer asks for `VOULT_BASE_URL` at all.** `@voult/express` already falls back to the Voult API's default URL when it's unset, so the question was redundant — and its "default" duplicated a value that also lives in `@voult/sdk`, where the two could silently drift apart (which is exactly what caused the previous bug on this line, below). Integrators only need to set `VOULT_BASE_URL` themselves for self-hosted/local-dev setups; it's still listed (empty) in `.env.example` for that.
- Fixed the printed "smoke test" curl commands, which pointed at `VOULT_BASE_URL` (the Voult API itself) instead of the integrator's own local BFF server (`http://localhost:3000`, matching the `@voult/express` snippet printed just above them) — copy-pasting them as shown would bypass the server you just mounted the router on.
- Superseded: the previous entry below (defaulting the prompt to `https://staging.voult.dev`) — the prompt is gone entirely now, so there's nothing left to default. The underlying pre-launch default still lives in `@voult/sdk`'s `DEFAULT_BASE_URL` and still needs to flip at launch (`docs/phases/PHASE_21_LAUNCH.md`).

## 0.1.2

- **Fix:** `voult init` would silently exit after the `VOULT_CLIENT_SECRET` prompt without writing `.env`, or hang forever on the session-strategy prompt. Cause: the masked secret prompt took over raw stdin without releasing the shared readline interface used by the surrounding text prompts, and then left stdin paused — the next prompt's `rl.question()` had no way to ever receive input. `askSecret` now closes the shared interface before taking raw control and no longer leaves stdin paused afterward.

## 0.1.1

- No functional changes — republished alongside the `@voult/sdk` rename.

## 0.1.0

Initial release.

- `voult init` — scaffolds `.env` and `.env.example` for `@voult/express`: prompts for base URL, client ID/secret, and session strategy; auto-generates `VOULT_SESSION_SECRET` for the cookie strategy; refuses to overwrite an existing `.env` without `--force`; never echoes the client secret back to the terminal.
- `voult --help` / `voult init --help`.
