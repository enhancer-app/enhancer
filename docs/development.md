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
| `stable` | Enhancer                 | Merge the bot PR `release(stable): vX.Y.Z` (release-stable → stable) |

- **Stable release:** tick patch, minor or major in the `release(stable)` PR and merge it. The PR lists every
  change that is not on `stable` yet, all ticked by default. Untick a change to keep it out of the release:
  - leaving out only the newest changes keeps the original commits;
  - leaving out a change in the middle cherry-picks the ticked ones onto `stable`, so they get new hashes there;
  - if a ticked change depends on an unticked one, the bot explains it in the PR and keeps the PR as a draft.
- **Hotfix:** merge the fix into `master` like any other change. In the `release(stable)` PR, untick every other
  change and tick patch. The bot cherry-picks only the fix onto `stable`.
- **Sync:** after every stable release the bot opens `chore(sync): merge stable into master` and the
  `enhancer-release` app merges it with a merge commit on its own. Do not merge it by hand.
  - The bot only does this when every commit on `stable` that is not on `master` is a cherry-pick of a `master`
    commit with the same changes, a `release(stable): vX.Y.Z` commit that only changes the version, or a merge
    that adds nothing. Conflicts from cherry-picks are then resolved to `master`'s side, so merging the PR only
    changes the version in `package.json`. The workflow checks all of this again before merging.
  - Otherwise the workflow comments on the PR. Resolve the conflicts on `sync-stable` if needed (merge `master`
    into it, never touch `stable`), review the branch and add the `merge-sync` label. The label path only merges
    a single merge of the current `stable`; a conflict resolution cannot be verified, so review it first. If the
    labelled run fails, remove and re-add the label after the bot rebuilds the branch.

Never open PRs into `stable` or `canary` yourself; they only take the bot PRs above. The `master-merge-method`
ruleset only allows squash on `master`; only the `enhancer-release` app can bypass it. GitHub rejects the app's
merge commit unless its bypass is `always`, so its key only lives in the `release-sync` environment.
`release-merge-method` only allows merge commits on `stable` and `canary`, and nobody can bypass it. A review
bypass therefore cannot pick the wrong method. Squash or rebase on a release branch would give the same changes
new commit hashes, and the branches would drift apart. The `release-tags` ruleset and immutable releases keep
`v*` and `canary-*` tags and release assets from being moved, deleted or replaced.

One-time setup: create the `enhancer-release` GitHub App (contents, pull requests and workflows write) and install
it on this repository only, run `bun run release:setup-branches`, then store the app's client ID in the
`RELEASE_APP_CLIENT_ID` repository variable and its private key in the `RELEASE_APP_PRIVATE_KEY` secret of the
`release-sync` environment (never as a repository secret: every workflow could read it). Finally run
`bun run release:setup-secrets`. Both channels publish from one store account, so they share the `release`
environment; `release-announce` only deploys from `stable` and `release-sync` only from `master`. Canary
changelogs go to a separate Discord channel: store its webhook as `DISCORD_CHANGELOG_WEBHOOK` in the
`release-announce-canary` environment, which only deploys from `canary`.

Release notes and Discord changelogs list the pull requests merged into `master` since the previous tag of the same
channel. Cherry-picked commits are traced back to their original pull request through their `cherry picked from
commit` line, so a release with unticked changes still lists them correctly.
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
