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

- **Changesets:** every `feat`, `fix` or `perf` PR adds a changeset with `bunx changeset` (CI checks it). It
  says whether the change is `patch`, `minor` or `major` and holds one sentence for `CHANGELOG.md`. Use
  `bunx changeset --empty` when users will not notice the change. See `.changeset/README.md`.
- **Stable release:** merge the `release(stable)` PR. The PR lists every change that is not on `stable` yet, all
  ticked by default, with the level of its changeset. Untick a change to keep it out of the release:
  - leaving out only the newest changes keeps the original commits;
  - leaving out a change in the middle cherry-picks the ticked ones onto `stable`, so they get new hashes there;
  - if a ticked change depends on an unticked one, the bot explains it in the PR and keeps the PR as a draft.

  The bot then runs `changeset version` on the release branch. The highest level among the ticked changesets sets
  the version (a patch release when there are none), the used changesets are deleted, and their lines are added to
  `CHANGELOG.md`. The PR shows the new version and the changelog section. Never edit `CHANGELOG.md` by hand.
- **Hotfix:** merge the fix into `master` like any other change. In the `release(stable)` PR, untick every other
  change. The bot cherry-picks only the fix and its changeset onto `stable`.
- **Sync:** after every stable release the bot opens `chore(sync): merge stable into master` and the
  `enhancer-release` app merges it with a merge commit on its own. Do not merge it by hand.
  - The bot only does this when every commit on `stable` that is not on `master` is a cherry-pick of a `master`
    commit with the same changes, a `release(stable): vX.Y.Z` commit that only changes the version, adds lines to
    `CHANGELOG.md` and deletes used changesets, or a merge that adds nothing. Conflicts from cherry-picks are then
    resolved to `master`'s side, so merging the PR only changes the version, `CHANGELOG.md` and the released
    changesets. The workflow checks all of this again before merging.
  - Otherwise the workflow comments on the PR. Resolve the conflicts on `sync-stable` if needed (merge `master`
    into it, never touch `stable`), review the branch and add the `merge-sync` label. The label path only merges
    a single merge of the current `stable`; a conflict resolution cannot be verified, so review it first. If the
    labelled run fails, remove and re-add the label after the bot rebuilds the branch.

Never open PRs into `stable` or `canary` yourself; they only take the bot PRs above. The `master-merge-method`
ruleset only allows squash on `master`; only the `enhancer-release` app can bypass it. GitHub rejects the app's
merge commit unless its bypass is `always`, so its key only lives in environments that deploy from protected
branches.

The bot branches `release-stable`, `release-hotfix` and `sync-stable` are protected by the `release-bot-branches`
ruleset: only the `enhancer-release` app and maintainers can create, push to or delete them. The bot pushes and
opens its PRs as the app, so the real CI runs on them. When a maintainer pushes a conflict resolution to
`sync-stable`, the workflow comments with `git show --remerge-diff`, which shows only what was changed by hand.
`release-merge-method` only allows merge commits on `stable` and `canary`, and nobody can bypass it. A review
bypass therefore cannot pick the wrong method. Squash or rebase on a release branch would give the same changes
new commit hashes, and the branches would drift apart. The `release-tags` ruleset and immutable releases keep
`v*` and `canary-*` tags and release assets from being created, moved, deleted or replaced by anyone but the
release workflows (which create releases as the app) and maintainers. Release PRs into `stable` and `canary` need an
approval from `enhancer-admins`, release workflows started by hand check that the actor is admin or maintain, and
the bot ignores release PR ticks unless a maintainer or the bot saved them.

One-time setup: create the `enhancer-release` GitHub App (contents, pull requests and workflows write) and install
it on this repository only, run `bun run release:setup-branches`, then store the app's client ID in the
`RELEASE_APP_CLIENT_ID` repository variable and its private key in the `RELEASE_APP_PRIVATE_KEY` secret of both
the `release-sync` and `release-bot` environments (never as a repository secret: every workflow could read it).
Finally run `bun run release:setup-secrets`. Both channels publish from one store account, so they share the
`release` environment; `release-announce` only deploys from `stable`, `release-sync` only from `master`, and
`release-bot` only from `master`, `stable` and `canary`. Canary changelogs go to a separate Discord channel: store
its webhook as `DISCORD_CHANGELOG_WEBHOOK` in the `release-announce-canary` environment, which only deploys from
`canary`.

Stable release notes and the stable Discord changelog use the version's section of `CHANGELOG.md`. Each line links
the pull request that added the changeset; cherry-picked commits are traced back to it through their `cherry picked
from commit` line. A stable release without changesets lists its pull requests instead. Canary release notes list
the pull requests merged since the previous Canary, and its Discord changelog lists the changesets added since then.
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
