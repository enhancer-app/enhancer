# Development Guide

This guide covers how to set up your development environment, build the extension, and contribute to Enhancer.

## Prerequisites

- [Bun](https://bun.sh) - JavaScript runtime and package manager
- [Git](https://git-scm.com) - Version control

## Setup

1. Clone the repository:

```bash
git clone https://github.com/enhancer-app/enhancer.git
cd enhancer
```

2. Install dependencies:

```bash
bun install
```

## Development Mode

Run the extension in development mode with hot reload:

```bash
bun run dev
```

This will:

- Watch TypeScript files for changes
- Automatically rebuild on file changes
- Run a local Vite server for extension assets

### Loading the Extension

After building:

**Chrome/Edge/Brave:**

1. Open `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist/` directory from this project

**Firefox:**

1. Open `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select any file in the `dist/` directory

> **Note:** If using Chrome with `bun run dev`, you may need to allow Local Network Access.
> See [Chrome Local Network Access](images/chrome-local-network-access.png).

## Production Build

Create an optimized production build:

```bash
bun run build
```

This runs:

1. Oxlint linting and oxfmt format check
2. TypeScript type checking
3. Vite production build

The built extension will be in the `dist/` directory.

## Packaging

Create distribution archives for the extension:

```bash
bun run pack
```

This command:

1. Runs the production build
2. Creates `dist/build-{version}.zip` - The built extension ready for upload to browser stores
3. Creates `dist/source-{version}.zip` - Source code archive (excluding node_modules, .git, and other ignored
   directories)

`bun run pack:canary` builds **Enhancer Canary** instead: its own name, icons from `branding/canary/`, a separate
Firefox ID and the version `{package.json version}.{CANARY_BUILD}`.

## Releasing

Enhancer has two release channels, each on its own branch:

| Branch   | Channel                  | How it is released                                          |
|----------|--------------------------|-------------------------------------------------------------|
| `master` | development              | Feature PRs are merged here (squash)                        |
| `canary` | Enhancer Canary          | Merge the bot PR `release(canary): vX.Y.Z.N` (master → canary) |
| `stable` | Enhancer                 | Merge the bot PR `release(stable): vX.Y.Z` (release-next → stable) |

- **Stable release:** tick patch, minor or major in the `release(stable)` PR and merge it.
- **Hotfix:** open a PR from a branch based on `stable` into `stable`. The bot then opens a `release(stable)` PR
  from `release-hotfix` with a patch bump. Merging it releases the hotfix.
- **Sync:** after every stable release or hotfix the bot opens `chore(sync): merge stable into master`. Merge it
  before the next stable release PR is updated.

Always use **Create a merge commit** for PRs into `stable` and `canary`, and for the sync PR. Squash and rebase give
the same changes new commit hashes, and the branches then drift apart. The rulesets on `stable` and `canary` only
allow merge commits.

One-time setup: `bun run release:setup-branches`, then `bun run release:setup-secrets`. Both channels publish
from one store account, so they share the `release` environment; `release-announce` only deploys from `stable`.
Extension IDs are public and live in `manifest.config.ts` and the release workflows.

## Project Scripts

| Command                   | Description                      |
|---------------------------|----------------------------------|
| `bun run dev`             | Development mode with hot reload |
| `bun run build`           | Production build                 |
| `bun run pack`            | Create distribution packages     |
| `bun run pack:canary`     | Create Canary packages           |
| `bun run typecheck`       | Run TypeScript type checking     |
| `bun run typecheck:watch` | Type checking in watch mode      |
| `bun run lint`            | Run oxlint                       |
| `bun run lint:fix`        | Run oxlint with autofixes        |
| `bun run format`          | Format sources with oxfmt        |
| `bun run format:check`    | Check formatting with oxfmt      |
| `bun run check`           | Run lint + format check          |

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **Framework:** Preact (React alternative)
- **Build Tool:** Vite
- **Linting:** Oxlint
- **Formatting:** oxfmt
- **Styling:** styled-components

## Code Style

The project uses [Oxlint](https://oxc.rs/docs/guide/usage/linter) for linting and
[oxfmt](https://oxc.rs/docs/guide/usage/formatter) for formatting. Configuration is in `.oxlintrc.json` and
`.oxfmtrc.json`.

Pre-commit hooks (via Husky) automatically run linting on staged files.

## Troubleshooting

### Extension not loading changes

- Make sure you're using the `dist/` directory, not the project root
- Try removing the extension and re-adding it
- Check the browser console for errors

### Build errors

- Ensure you're using Bun (not npm/yarn/pnpm)
- Delete `dist/` and `node_modules/` and run `bun install` again
- Check that your Node.js version is compatible with Bun

### Development mode connection issues

- The extension uses a custom bridge element for worker communication
- Make sure no other extensions are interfering
- Try refreshing the page after rebuilding

## Next Steps

- Read about the [architecture](architecture.md) to understand how the code is organized
