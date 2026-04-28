# SDK DEVELOPMENT PLAN

```bash
SDK DEVELOPMENT
│
├── 1. Understand Real SDKs
│   ├── Study Stripe (API design clarity)
│   ├── Study Firebase (auth patterns)
│   └── Study Clerk (DX + abstraction)
│       ├── Naming conventions
│       ├── Simplicity of API
│       └── Hidden complexity
│
├── 2. JS Library Fundamentals
│   ├── ES Modules (import/export)
│   ├── File structure
│   ├── Separation of concerns
│   └── Bundling (Vite / Rollup)
│
├── 3. API Client Layer
│   ├── Fetch wrapper
│   ├── Header injection (appId, tokens)
│   ├── Error normalization
│   └── Clean request interface
│
├── 4. OAuth Flow (CRITICAL)
│   ├── Google Identity Services
│   ├── google.accounts.id.initialize
│   ├── id_token (credential)
│   └── Callback handling
│
├── 5. Session Management
│   ├── Store tokens (localStorage)
│   ├── Restore session
│   ├── Clear session (logout)
│   └── (Later) Auto refresh
│
└── 6. Packaging & Distribution (LAST)
    ├── Build step (Vite/Rollup)
    ├── Output formats (ESM, CJS)
    └── npm publish
