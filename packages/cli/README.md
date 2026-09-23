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

- `VOULT_BASE_URL` (defaults to `https://staging.voult.dev` — pre-launch; will become the real production URL at launch)
- `VOULT_CLIENT_ID` — from your App in the [Voult dashboard](https://www.voult.dev/dashboard)
- `VOULT_CLIENT_SECRET` — masked input, never echoed or logged
- Session strategy (`cookie` default, or `bearer`)

Writes:

- `.env` — real values, `0600` permissions, never overwritten without `--force`
- `.env.example` — the same keys with empty values, safe to commit

For the `cookie` strategy it also generates `VOULT_SESSION_SECRET` (32 random bytes) — you never have to pick one yourself.

```bash
voult init --force   # overwrite an existing .env
voult --help
```

## License

MIT
