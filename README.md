# Voult SDK

Monorepo for Voult client packages.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| [`voult-sdk`](./packages/voult-sdk) | `packages/voult-sdk` | Official JavaScript SDK for the Voult Authentication API |
| [`express`](./packages/express) | `packages/express` | Express BFF (scaffold) |

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
