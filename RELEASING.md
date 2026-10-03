# Releasing

Every package in this repo is published by CI, from a git tag, with [npm provenance](https://docs.npmjs.com/generating-provenance-statements). Nobody runs `npm publish` from a laptop except in the [emergency fallback](#manual-fallback-last-resort).

## Releasing a package

1. **Bump** `version` in `packages/<pkg>/package.json`. Prereleases (`0.3.0-beta.0`) publish under the `next` dist-tag; everything else becomes `latest`.
2. **CHANGELOG**: add a `## <version>` section to `packages/<pkg>/CHANGELOG.md`. The release fails without it.
3. **Commit and merge** to `main`. CI (`test.yml`) must be green.
4. **Tag and push** from that commit:

   ```bash
   git tag @voult/express@0.3.0
   git push origin @voult/express@0.3.0
   ```

   For `create-voult-app`, tag `create-voult-app@<version>`. One tag = one package. To release two packages, push two tags. Release dependencies first (e.g. `@voult/sdk` before `@voult/express`).

5. Watch the **release** workflow in GitHub Actions. When it finishes, the npm page shows the version with a "Provenance" badge linking back to the commit and workflow run.

### What the workflow checks (`.github/workflows/release.yml`)

`npm ci`, then `node scripts/check-release.mjs <tag>`, which fails the release if:

- the tag isn't `@voult/<pkg>@<semver>` or `create-voult-app@<semver>`, or no workspace has that name
- `package.json` `version` ≠ the tag's version
- `npm pack --dry-run` would ship a `.env*` file or anything under `test/`, `tests/`, `__tests__/` or named `*.test.*` / `*.spec.*`
- `CHANGELOG.md` has no `## <version>` heading

Then it runs the package's tests and `npm publish --provenance --access public --tag <latest|next>`. Auth is [npm trusted publishing](https://docs.npmjs.com/trusted-publishers) (GitHub OIDC): there's no `NPM_TOKEN` secret to leak or rotate.

Run the same check locally before tagging: `node scripts/check-release.mjs @voult/express@0.3.0`.

### A release failed

Nothing was published if any step before `npm publish` failed. Fix it on `main`, then move the tag:

```bash
git tag -d @voult/express@0.3.0 && git push origin :refs/tags/@voult/express@0.3.0
git tag @voult/express@0.3.0 && git push origin @voult/express@0.3.0
```

If `npm publish` itself succeeded, that version is published for good (npm never allows republishing a version). Bump to the next patch instead.

## One-time setup

Done once per account/package. Keep this list in sync with reality.

### npm organisation (`@voult`)

- [ ] The `@voult` scope belongs to the npm **org** `voult` (check: `npm org ls voult`). If it's a personal scope, convert it at npmjs.com → your avatar → *Organizations*.
- [ ] 2FA on for the owner (npmjs.com → *Account* → *Two-Factor Authentication*), and the org requires it (*Organization* → *Settings* → *Require 2FA*).
- [ ] **Single owner (`devolabode`), so account recovery is the safeguard:** 2FA recovery codes saved in a password manager, a second 2FA method (security key or a second authenticator device), and the account email on a domain/mailbox you won't lose. Losing the account means losing every package.
- [ ] When a second maintainer joins: `npm org set voult <user> owner`, and `npm owner add <user> <pkg>` for the unscoped `create-voult-app` (unscoped names don't belong to the org, so owners are added by hand).

### Per package: trusted publisher

npm only lets you configure trusted publishing for a package that already exists. For each package (`@voult/sdk`, `@voult/express`, `@voult/react`, `@voult/cli`, `@voult/core`, `@voult/next`, `create-voult-app`):

1. npmjs.com → the package → *Settings* → *Trusted Publisher* → **GitHub Actions**:
   - Organization or user: `voult-dev`
   - Repository: `voult-sdk`
   - Workflow filename: `release.yml`
   - Environment: `npm`
2. Same page, *Publishing access*: **Require two-factor authentication and disallow tokens**. From then on, only the workflow (or an owner typing a 2FA code) can publish.

### GitHub environment `npm`

In `voult-dev/voult-sdk` → *Settings* → *Environments* → `npm` (the first run creates it if it's missing):

- *Deployment branches and tags* → **Selected branches and tags** → add the tag rules `@voult/*@*` and `create-voult-app@*`.
- Optional: *Required reviewers*, so every publish waits for a second person's approval.

### Reserving new names (placeholders)

`@voult/core`, `@voult/next` and `create-voult-app` must exist on npm before their trusted publisher can be configured, and before someone else takes the unscoped `create-voult-app`. Their first version is an empty `0.0.0`, published once by an owner and deprecated straight away:

```bash
for name in @voult/core @voult/next create-voult-app; do
  dir=$(mktemp -d) && cd "$dir"
  printf '{ "name": "%s", "version": "0.0.0", "description": "Placeholder: not released yet", "license": "MIT", "repository": { "type": "git", "url": "git+https://github.com/voult-dev/voult-sdk.git" } }\n' "$name" > package.json
  echo "Not released yet. See https://github.com/voult-dev/voult-sdk" > README.md
  npm publish --access public && npm deprecate "$name@0.0.0" "not released yet"
  cd - > /dev/null
done
```

`npm publish` asks for your 2FA code. Then configure the trusted publisher for each (above). Every version after `0.0.0` comes from the workflow.

## Manual fallback (last resort)

Use this only when CI can't publish (GitHub Actions or npm OIDC down) **and** the release can't wait. A laptop publish can't carry provenance, so:

```bash
cd packages/<pkg>
node ../../scripts/check-release.mjs @voult/<pkg>@<version>
npm test
npm publish --access public --tag latest
git tag @voult/<pkg>@<version> && git push origin @voult/<pkg>@<version>
```

`npm publish` asks for your 2FA code (use `--tag next` for a prerelease). Pushing the tag starts the workflow, which fails at `npm publish` because the version exists. That's expected: cancel the run.

Then add a line to that version's CHANGELOG entry: `Published manually (no provenance): <reason>.` The target is **zero** manual publishes.
