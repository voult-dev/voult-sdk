# Voult SDK

Monorepo for Voult client packages.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| [`voult-sdk`](./packages/voult-sdk) | `packages/voult-sdk` | Official JavaScript SDK for the Voult Authentication API |
| [`@voult/express`](./packages/express) | `packages/express` | Mountable Express BFF for Voult auth |
| [`@voult/cli`](./packages/cli) | `packages/cli` | `voult init` — scaffolds `.env` for `@voult/express` |

## Development

```bash
npm install
npm test
```

Workspace scripts proxy to `voult-sdk`:

```bash
npm run test:unit
npm run test:integration
```

See [packages/voult-sdk/README.md](./packages/voult-sdk/README.md) for SDK usage and API reference.
