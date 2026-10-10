# AGENTS.md — Enhancer Browser Extension

## Project Overview

Enhancer is a Manifest V3 browser extension that adds features to Twitch and Kick streaming platforms. It's built with TypeScript, Preact, styled-components, and uses Bun as the package manager with Vite as the build tool.

## Build & Run

| Command | Description |
|---------|-------------|
| `bun run dev` | Concurrent typecheck:watch + vite build --watch + dev server (port 3360) |
| `bun run build` | Production: oxlint + oxfmt check + typecheck + vite build (minified) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run typecheck:watch` | `tsc --noEmit --watch` |
| `bun run lint` | `oxlint ./src` |
| `bun run format` | `oxfmt ./src` |
| `bun run check` | `oxlint ./src` + `oxfmt --check ./src` |

Always run `bun run typecheck` and `bun run check` after making changes.

## Browser Compatibility Testing

To run Enhancer from `dist`, run `bun run pack`, reload Enhancer in `chrome://extensions`, and refresh the Twitch or Kick page. Repeat these steps after making changes to Enhancer so the browser uses the latest build.

For browser-visible changes, keep Enhancer enabled and test each third-party extension configuration separately:

- Twitch: current 7TV (3.x), legacy 7TV (1.x), BetterTTV, FrankerFaceZ, and no third-party extension.
- Kick: 7TV, NipahTV, and no third-party extension.

Disable the other third-party extensions for each test run so compatibility issues can be attributed correctly.

### Multi-CDP Browser Setup

If you use the Multi-CDP MCP for browser testing, follow its skill instructions and prepare the environment with the required extensions before testing. The environment and extension management tools below are specific to Multi-CDP.

#### Prepare the environment

1. Run `bun run pack` in the current worktree.
2. Check `cdp_environment_list` and reuse the environment bound to the current session when possible.
3. For a new environment, use a visible window and the configured template profile. Load the current worktree's build through `devExtensionPaths`:

   ```js
   cdp_environment_create({
       name: "<unique name for this task>",
       headless: false,
       fresh: false,
       devExtensionPaths: ["<absolute path to the current worktree's dist>"]
   })
   ```

   `fresh: false` uses the template profile, which is expected to contain the compatibility extensions. `fresh: true` starts without that template state and requires the extensions to be installed separately.

4. Call `cdp_extension_list` to confirm the installed extensions. Check for current 7TV (3.x), legacy 7TV (1.x), BetterTTV, FrankerFaceZ, and NipahTV as required by the test matrix above. Resolve IDs by name and version; do not hardcode IDs or assume an extension is present because it exists in another environment.
5. If a required extension is missing, load an available unpacked build with `install_extension({ path: "<absolute extension directory>" })`. Additional unpacked builds can also be supplied through `devExtensionPaths` when creating the environment. Use existing, verified paths; if no build is available, report the missing setup requirement.

#### Select and verify the test configuration

1. Keep the current worktree's Enhancer build enabled. Disable any other Enhancer installation inherited from the template so only one build is active.
2. Use `cdp_extension_set_enabled` to enable exactly one third-party extension and disable the others. For native testing, disable all third-party extensions. Never enable current and legacy 7TV together.
3. Fully reload the Twitch or Kick page after every extension configuration change. Existing tabs may retain injected code from disabled extensions.
4. After rebuilding Enhancer, call `cdp_extension_reload` for the tested build and reload the target page.
5. Confirm runtime activation through the extension's own UI, injected scripts, or modified chat. Check browser site access and the extension's per-site settings if initialization fails. Use a working live channel with active chat to verify chat integrations, then test the relevant VOD when needed.
6. Bring the target page to the foreground and use real pointer input for hover tests. JavaScript `dispatchEvent()` alone does not activate CSS `:hover`. If an element is missing from the accessibility snapshot, check the DOM and computed styles; `aria-hidden` or auto-hiding controls can prevent tool interaction even when the feature is visible.

An installed/enabled extension alone is not evidence of runtime activation. Report PASS only after confirming activation and testing the Enhancer feature. Report FAIL only for a reproduced feature regression with a verified setup. A missing extension, rejected build path, or failed browser setup is a BLOCKED test; describe the blocker and the checks already attempted.

## Directory Structure

```
src/
  index.ts                    # Main-world entry point (injected into page via <script> tag)
  inject.ts                   # Content script that creates the <script> tag
  platforms/
    twitch/                   # All Twitch-specific code
      twitch.platform.ts      # Platform orchestration, module registration
      twitch.module.ts        # TwitchModule base class (adds twitchUtils, twitchApi)
      twitch.constants.ts     # Default settings, asset paths
      modules/                # Twitch feature modules (~23 modules)
    kick/                     # All Kick-specific code (mirrors twitch/ structure)
  shared/
    apis/                     # EnhancerApi — external backend API client
    components/               # Reusable Preact UI components
    event/                    # EventEmitterFactory (wraps nanoevents)
    logger/                   # Colored console Logger
    module/                   # Module base class + applier pattern
      applier/                # SelectorModuleApplier, EventModuleApplier
      helpers/                # SettingsHelper (shared settings UI logic)
    platform/                 # Platform base class
    settings/                 # SettingsCache — local cache with broadcast sync
    storage/                  # StorageRepository (localStorage wrapper)
    utils/                    # CommonUtils, ReactUtils, UtilsRepository
    worker/                   # Worker architecture (bridge, background, databases, handlers)
      database/               # Abstract Database base class (IndexedDB)
      settings/               # SettingsDatabase + UpdateSettingsHandler
      watchtime/              # WatchtimeDatabase + WatchtimeAccumulator + handlers
  types/                      # All type definitions (never co-located with implementation)
    platforms/
      common.events.ts        # Shared event signatures (extension:start, settings-refresh, etc.)
      twitch/                 # TwitchEvents, TwitchSettings, TwitchStorage, TwitchApiTypes
      kick/                   # KickEvents, KickSettings, KickStorage, KickApiTypes
    shared/
      module/                 # ModuleConfig, ModuleApplierConfig (discriminated union)
      worker/                 # WorkerApiActions, WorkerBroadcast, payload/response types
      components/             # SettingCategory, SettingDefinition, SettingsProps
```

## Architecture: Three-Layer Communication

The extension spans three JavaScript contexts that share the DOM but have separate JS environments:

```
MAIN WORLD (index.ts / Platform)
    ↕ CustomEvents on <enhancer-bridge> DOM element
CONTENT SCRIPT (worker.bridge.ts)
    ↕ chrome.runtime.sendMessage / chrome.runtime.onMessage
BACKGROUND SCRIPT (worker.background.ts)
    ↕ IndexedDB (SettingsDatabase, WatchtimeDatabase)
```

### How it works

1. **Main world** (`index.ts`): Creates `WorkerService` which creates a `<enhancer-bridge>` DOM element. Sends messages via `enhancer-message` CustomEvents, receives responses via `enhancer-response` CustomEvents.

2. **Content script** (`worker.bridge.ts`): Uses MutationObserver to find `<enhancer-bridge>`, forwards CustomEvents to/from `chrome.runtime.sendMessage`. Dispatches `enhancer-bridge-ready` when connected.

3. **Background script** (`worker.background.ts`): Routes messages to `MessageHandler` instances via `HandlerRegistry`. Manages IndexedDB databases and the `WatchtimeAccumulator`.

### Critical: Bridge Readiness

`WorkerService.start()` awaits a `enhancer-bridge-ready` CustomEvent from the bridge before resolving. This gates `settingsCache.initialize()` so the first message is never lost. Never remove this readiness check.

### Adding a new worker action

1. Define the action type and payload/response in `src/types/shared/worker/worker.types.ts` (`WorkerApiActions`)
2. Create a handler class extending `MessageHandler` in `src/shared/worker/`
3. Register it in `HandlerRegistry`
4. Call `workerService.send("actionName", payload)` from the main world

## Module System

Every feature is a module. Modules extend `Module<Events, Storage, Settings>` (or platform-specific `TwitchModule` / `KickModule`).

### Module lifecycle

1. **Construction** — receives dependencies via constructor (emitter, settings cache, utils, etc.)
2. `setup()` — creates scoped Logger (`module:{name}`)
3. `initialize()` — override for one-time init (optional, sync or async)
4. **Appliers applied** — selector appliers start polling, event appliers subscribe

### Module config

```typescript
config: TwitchModuleConfig = {
    name: "my-module",
    appliers: [
        {
            type: "selector",
            selectors: [".some-element"],
            callback: this.run.bind(this),
            key: "my-module-main",
            once: true,
        },
        {
            type: "event",
            event: "extension:start",
            callback: this.run.bind(this),
            key: "my-module-start",
        },
    ],
    enabled: () => this.settings().someFeatureEnabled,
};
```

### Applier types

- **Selector applier** (`type: "selector"`): A `MutationObserver` triggers a full run when elements are added outside the platform's `ignoredMutationSelectors` (chat lists), at most every 500 ms (2 s in hidden tabs). Appliers without `once` also run every 1 s, and every applier runs at least every 5 s and after settings change. Supports `once` (run once per element), `cooldown`, `validateUrl`, `useParent`. Tracks processed elements via `enhanced` DOM attributes.
- **Event applier** (`type: "event"`): Subscribes to a nanoevents event. Event must be defined in the platform's Events type.

### Creating a new module

1. Create the file in `src/platforms/{twitch,kick}/modules/`
2. Extend `TwitchModule` or `KickModule`
3. Define `config` with name and appliers
4. Override `initialize()` if needed
5. Register the module in the platform's `getModules()` method

## Platform System

`Platform` is the base class that orchestrates the extension lifecycle. The `start()` sequence is:

1. `tryInitializeEnhancerApi()` — retries up to 5 times with 5s delay
2. `await workerApi.start()` — creates bridge element, waits for bridge readiness
3. `await settingsCache.initialize()` — fetches settings from background
4. `await initialize()` — platform-specific init
5. `await loadModules()` — registers and applies all modules

Platforms are instantiated in `src/index.ts` based on `window.location.hostname`.

## Settings System

### Reading settings

```typescript
const settings = this.settings(); // Sync, returns settings object directly
```

The settings are cached locally after `settingsCache.initialize()`. Reads are always synchronous.

### Writing settings

```typescript
await this.updateSettings(settings);        // Replace entire settings object
await this.updateSetting("key", value);     // Update a single key
```

### Settings flow

1. Module calls `updateSettings()` or `updateSetting()` on `SettingsCache`
2. `SettingsCache` sends `updateSettings` action to background via `WorkerService`
3. `UpdateSettingsHandler` persists to IndexedDB, then **broadcasts** to all tabs via `chrome.tabs.sendMessage`
4. `SettingsCache` in every tab receives the broadcast, updates its cache, emits `extension:settings-refresh`
5. Modules react to the event or re-read `settings()` on next invocation

### Settings UI

Settings modules use `SettingsHelper` which centralizes the Preact settings overlay, signal management, and keyboard shortcuts. Platform settings modules define `SETTING_DEFINITIONS` (typed union of toggle/number/input/select/radio/array/file/text) and `SETTINGS_CATEGORIES`.

## Event System

Uses `nanoevents` (v9). The `Platform` creates a single typed `Emitter<TEvents>` shared across all modules.

### Common events (all platforms)

- `extension:start` — fired after all modules are loaded
- `extension:settings-open` — opens the settings overlay
- `extension:settings-refresh` — fired when settings are updated (local or broadcast)
- `extension:watchtime-refresh` — watchtime data changed
- `extension:joined-channel` — joined a chat channel

### Per-setting events

Auto-generated via mapped types. Emitted when a specific setting key changes:

- Twitch: `twitch:settings:{key}` (e.g., `twitch:settings:chatImagesEnabled`)
- Kick: `kick:settings:{key}` (e.g., `kick:settings:streamLatencyEnabled`)

### Emitting events

```typescript
this.emitter.emit("twitch:settings:chatImagesEnabled", value);
```

## Database Layer

### Abstract `Database` class

`src/shared/worker/database/database.ts` provides:
- `initialize()` — opens IndexedDB with version handling
- `request<T>(storeName, mode, fn)` — generic transaction wrapper
- `forEachCursor<T>(storeName, indexName, range, direction, callback)` — paginated cursor iteration

Subclasses define `dbName`, `dbVersion`, and `onUpgrade()`.

### Databases

- **SettingsDatabase** (`enhancer_settings`): Stores per-platform settings. Has in-memory cache. Accepts default settings via constructor.
- **WatchtimeDatabase** (`enhancer_watchtime`): Stores per-channel watchtime. Uses migrator for schema evolution.

### WatchtimeAccumulator

Tracks watched channels in a `Set`. Every 5 seconds, adds 5 seconds of watchtime for each tracked channel. Handlers talk to the database directly — no service layers.

## TypeScript Conventions

### Path aliases

```typescript
"$types/*"   → "./src/types/*"
"$shared/*"  → "./src/shared/*"
"$twitch/*"  → "./src/platforms/twitch/*"
"$kick/*"    → "./src/platforms/kick/*"
```

React/ReactDOM are aliased to Preact compat:
```typescript
"react"     → "preact/compat"
"react-dom" → "preact/compat"
```

### Compile-time constants

Injected by Vite via `define`:
- `__version__` — from `package.json` version
- `__environment__` — `"development"` or `"production"`

### Type organization

- All types live under `src/types/` — never co-located with implementation
- Three-tier: `types/shared/` (cross-cutting), `types/platforms/twitch/`, `types/platforms/kick/`
- Generic parameter pattern: `Module<Events, Storage, Settings>` flows through the entire hierarchy
- Heavy use of mapped types and discriminated unions

## Styling Conventions

- **Library:** `styled-components` v6 with Preact compat
- **Pattern:** Styled components are module-level `const` variables, co-located in the same file
- **Rendering:** Preact `render()` mounts components into DOM elements found by selector appliers

### Color palette

| Role | Value |
|------|-------|
| Primary accent | `#9147ff` |
| Background | `#0d0d0d` |
| Borders | `#232323` |
| Muted text | `#565656` |
| Error/danger | `#ff4757` |
| Text | `white`, `#ccc` |

Modules targeting Twitch can use Twitch's CSS custom properties (`--border-radius-medium`, `--color-background-button-text-hover`, etc.).

## Lint & Formatting

- **Linter:** Oxlint 1.x (`.oxlintrc.json`)
- **Formatter:** oxfmt (`.oxfmtrc.json`)
- **Line width:** 120, tabs, LF
- **Pre-commit:** Husky + lint-staged runs `oxlint --fix` then `oxfmt` on staged files
- **CI:** `bun run build` runs `bun run check` before typecheck; `ci-lint.yml` autofixes PRs

Categories: `correctness` errors, `suspicious` warnings. Key rules off: `typescript/no-explicit-any`,
`react/react-in-jsx-scope`, `react-hooks/exhaustive-deps`, `eslint/no-underscore-dangle`,
`unicorn/consistent-function-scoping`. `eslint/no-unused-vars` ignores `_`-prefixed identifiers.

## Critical Rules

1. **Never remove the bridge readiness gate.** `WorkerService.start()` must await `enhancer-bridge-ready` before `settingsCache.initialize()` sends the first message.
2. **Settings reads are synchronous.** Always call `this.settings()` — it returns from local cache. Never send a worker message to read settings.
3. **Settings writes broadcast to all tabs.** Use `this.updateSettings()` or `this.updateSetting()` — the cache updates optimistically and the broadcast handles cross-tab sync.
4. **No pass-through service layers.** Handlers in the background script talk to databases directly. The `WatchtimeAccumulator` encapsulates accumulation logic.
5. **Separate IndexedDB databases.** Settings and watchtime have separate databases with a shared `Database` base class.
6. **All types go in `src/types/`.** Never co-locate type definitions with implementation files.
7. **No comments in code.** Unless explicitly requested.
8. **Module access to settings cache.** Use `this.settings()` for the settings object, `this.settingsCache()` when you need the cache instance (e.g., for `SettingsHelper`).
9. **Extension contexts.** `index.ts` runs in the main world, `worker.bridge.ts` runs as a content script (isolated world). They share the DOM but have separate JS contexts. CustomEvents on DOM elements are visible across worlds.
10. **The `enabled` callback on ModuleConfig is synchronous.** It's checked on every selector applier poll cycle (up to once per second). Keep it fast.
