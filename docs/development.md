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

1. Biome linting
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

## Project Scripts

| Command                   | Description                      |
|---------------------------|----------------------------------|
| `bun run dev`             | Development mode with hot reload |
| `bun run build`           | Production build                 |
| `bun run pack`            | Create distribution packages     |
| `bun run typecheck`       | Run TypeScript type checking     |
| `bun run typecheck:watch` | Type checking in watch mode      |
| `bun run biome:ci`        | Run linting                      |

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **Framework:** Preact (React alternative)
- **Build Tool:** Vite
- **Linting:** Biome
- **Styling:** styled-components

## Code Style

The project uses [Biome](https://biomejs.dev) for linting and formatting. Configuration is in `biome.json`.

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
