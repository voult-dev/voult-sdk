# Changelog

All notable changes to `@voult/cli` are documented here.

## 0.1.2

- **Fix:** `voult init` would silently exit after the `VOULT_CLIENT_SECRET` prompt without writing `.env`, or hang forever on the session-strategy prompt. Cause: the masked secret prompt took over raw stdin without releasing the shared readline interface used by the surrounding text prompts, and then left stdin paused — the next prompt's `rl.question()` had no way to ever receive input. `askSecret` now closes the shared interface before taking raw control and no longer leaves stdin paused afterward.

## 0.1.1

- No functional changes — republished alongside the `@voult/sdk` rename.

## 0.1.0

Initial release.

- `voult init` — scaffolds `.env` and `.env.example` for `@voult/express`: prompts for base URL, client ID/secret, and session strategy; auto-generates `VOULT_SESSION_SECRET` for the cookie strategy; refuses to overwrite an existing `.env` without `--force`; never echoes the client secret back to the terminal.
- `voult --help` / `voult init --help`.
