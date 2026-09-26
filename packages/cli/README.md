# @voult/cli

`voult init` — scaffolds `.env` for [`@voult/express`](../express) in under a minute.

## Install

```bash
npm install --save-dev @voult/cli
# or run it once without installing:
npx @voult/cli init
```

## Usage

```bash
npx voult init
```

Prompts for:

- `VOULT_CLIENT_ID` — from your App in the [Voult dashboard](https://www.voult.dev/dashboard)
- `VOULT_CLIENT_SECRET` — masked input, never echoed or logged
- Session strategy (`cookie` default, or `bearer`)

It does **not** ask for `VOULT_BASE_URL` — `@voult/express` already talks to the Voult API by default. Only add `VOULT_BASE_URL` to `.env` yourself if you need to point at something else (self-hosted, local dev against a non-default environment); `.env.example` lists it as an available key for exactly that.

Writes:

- `.env` — real values, `0600` permissions, never overwritten without `--force`
- `.env.example` — the same keys (including `VOULT_BASE_URL`, left empty) with empty values, safe to commit

It writes your choice as `VOULT_SESSION_STRATEGY` (read by `@voult/express` 0.1.2+). For the `cookie` strategy it also generates `VOULT_SESSION_SECRET` (32 random bytes) — you never have to pick one yourself.

```bash
voult init --force   # overwrite an existing .env
voult --help
```

## `voult doctor`

Checks a project's setup before the first sign-in: run it in the folder with your `.env`.

```bash
npx voult doctor                   # human-readable
npx voult doctor --json            # for CI; exit code 1 if anything fails
npx voult doctor --callback-url https://api.myapp.com/api/auth/oauth/callback
```

It loads `@voult/express` and `@voult/sdk` **from your project**, so `.env` is validated by the same code your
server runs. It never prints secret values.

| Check | Fails / warns when | Fix it shows |
|---|---|---|
| packages | `@voult/express` / `@voult/sdk` not installed | `npm install …` |
| env | `.env` doesn't validate (missing ID/secret, bad URL, unknown strategy) | the server's own error message |
| session-secret | cookie sessions and `VOULT_SESSION_SECRET` missing/short (fails in production, warns in dev) | `openssl rand -hex 32` |
| stray-env | `.env` still has `GOOGLE_*`, `GITHUB_*`, … (warning) | configure providers in the dashboard instead |
| reachable | `VOULT_BASE_URL` doesn't answer `/api/meta` | check the URL / network |
| version | your `@voult/sdk` is older than the API supports | `npm install @voult/sdk@latest` |
| credentials | the client ID/secret are rejected | copy them from the dashboard again |
| callback | your OAuth callback isn't on the app's allowlist (warns if the list is empty and you're on localhost) | the exact URL to add |
| https | production callback over plain http | https, `trust proxy`, or `VOULT_OAUTH_CALLBACK_URL` |
| providers | a provider is switched on without credentials (warns if none are on) | which provider page to fix |

The callback it checks is `VOULT_OAUTH_CALLBACK_URL`, else `--callback-url`, else
`http://localhost:$PORT/api/auth/oauth/callback` (PORT defaults to 3000).

Requires Node 20.12+.

## License

MIT
