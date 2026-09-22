# Changelog

All notable changes to `@voult/cli` are documented here.

## 0.1.1

- No functional changes — republished alongside the `@voult/sdk` rename.

## 0.1.0

Initial release.

- `voult init` — scaffolds `.env` and `.env.example` for `@voult/express`: prompts for base URL, client ID/secret, and session strategy; auto-generates `VOULT_SESSION_SECRET` for the cookie strategy; refuses to overwrite an existing `.env` without `--force`; never echoes the client secret back to the terminal.
- `voult --help` / `voult init --help`.
