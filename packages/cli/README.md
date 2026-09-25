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

## License

MIT
