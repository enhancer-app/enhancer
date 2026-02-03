# Architecture Overview

Enhancer is built with a modular, platform-agnostic architecture that allows features to be shared between Twitch and
Kick while maintaining platform-specific implementations.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Extension                         │
├─────────────────────────────────────────────────────────────┤
│  Content Script                                              │
│  ┌─────────────────┐         ┌─────────────────────────────┐│
│  │   Entry Point   │────────▶│       Platform              ││
│  │   (index.ts)    │         │   (Twitch/Kick)             ││
│  └─────────────────┘         └─────────────────────────────┘│
│                                          │                   │
│                              ┌───────────┴───────────┐       │
│                              ▼                       ▼       │
│                    ┌──────────────────┐  ┌───────────────────┐ │
│                    │     Modules      │  │   Shared Services │ │
│                    │                  │  │                   │ │
│                    │ • Chat Features  │  │ • Settings        │ │
│                    │ • UI Enhance   │  │ • Storage         │ │
│                    │ • Utilities    │  │ • Worker Bridge   │ │
│                    └──────────────────┘  └───────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Worker Bridge (DOM Element)                │  │
│  │     (Custom element for background communication)      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Service Worker (Background)                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Worker Background                     │  │
│  │     ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │  │
│  │     │  Settings   │  │  Watchtime  │  │  Message  │  │  │
│  │     │   Handler   │  │   Service   │  │  Handler  │  │  │
│  │     └─────────────┘  └─────────────┘  └───────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Entry Point (`src/index.ts`)

The main entry point detects which platform the user is on and initializes the appropriate platform instance:

```typescript
function getPlatform() {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.endsWith("twitch.tv")) return new TwitchPlatform();
    if (hostname.endsWith("kick.com")) return new KickPlatform();
    throw Error(`Unsupported host name ${hostname}`);
}
```

### 2. Platform System

Each platform (Twitch/Kick) extends the base `Platform` class:

```
src/platforms/
├── twitch/
│   ├── twitch.platform.ts    # Platform initialization
│   ├── twitch.module.ts      # Base module class
│   ├── twitch.utils.ts       # Platform utilities
│   ├── twitch.api.ts         # API wrappers
│   └── modules/              # Platform-specific features
└── kick/
    └── (same structure)
```

**Platform Lifecycle:**

1. `start()` - Initialize the platform
2. `initialize()` - Platform-specific setup (optional override)
3. `loadModules()` - Load and register all modules
4. Register appliers to activate modules

### 3. Module System

All features are implemented as **Modules**. Each module:

- Extends `Module<Events, Storage, Settings>`
- Defines its configuration in `config` property
- Can be enabled/disabled via settings
- Uses dependency injection for shared services

**Module Structure:**

```typescript
abstract class Module<Events, Storage, Settings> {
    abstract readonly config: ModuleConfig<Events>

    // Dependency injection
    constructor(
        protected readonly emitter: Emitter<Events>,
        private readonly storageRepository: StorageRepository<Storage>,
        private readonly settingsService: SettingsService<Settings>,
        private readonly utilsRepository: UtilsRepository,
        private readonly enhancerApi: EnhancerApi,
        private readonly workerService: WorkerService,
    ) {
    }

    async setup()     // Initialize logger
    async initialize() // Module-specific setup
}
```

**Base Module Classes:**

```
src/platforms/twitch/twitch.module.ts    # Twitch-specific modules
src/platforms/kick/kick.module.ts        # Kick-specific modules
```

### 4. Module Appliers

Modules don't activate themselves. Instead, **appliers** handle activation based on module configuration:

**SelectorModuleApplier** (`src/shared/module/applier/selector-module-applier.ts`)

- Waits for DOM elements matching a CSS selector
- Activates module when element appears
- Handles dynamic page changes (SPA navigation)

**EventModuleApplier** (`src/shared/module/applier/event-module-applier.ts`)

- Listens for custom events
- Activates modules in response to events

### 5. Shared Services

Located in `src/shared/`, these provide common functionality:

| Service             | Purpose                         | Location                      |
|---------------------|---------------------------------|-------------------------------|
| `Platform`          | Base platform class             | `shared/platform/platform.ts` |
| `Module`            | Base module class               | `shared/module/module.ts`     |
| `StorageRepository` | LocalStorage management         | `shared/storage/`             |
| `SettingsService`   | User settings persistence       | `shared/settings/`            |
| `WorkerService`     | Background worker communication | `shared/worker/`              |
| `EnhancerApi`       | API client for backend          | `shared/apis/`                |
| `UtilsRepository`   | Common utilities (React, DOM)   | `shared/utils/`               |

### 6. Worker System

Browser extensions have separate contexts for content scripts and background scripts. Enhancer uses a **custom DOM
element** (`<enhancer-bridge>`) as a communication bridge:

```
Content Script                    Service Worker
     │                                │
     │ CustomEvent("enhancer-message")│
     ├───────────────────────────────▶│
     │                                │
     │ CustomEvent("enhancer-response")│
     │◀───────────────────────────────┤
     │                                │
```

**Worker Handlers:**

```
src/shared/worker/
├── worker.service.ts        # Client-side bridge
├── worker.background.ts     # Background script entry
├── worker.bridge.ts         # Bridge initialization
├── settings/                # Settings persistence
├── watchtime/               # Watchtime tracking
└── ping/                    # Keep-alive ping
```

### 7. Type System

Strong TypeScript typing throughout:

```
src/types/
├── platforms/               # Platform-specific types
│   ├── twitch/
│   └── kick/
└── shared/                  # Common types
    ├── module/
    ├── worker/
    └── ...
```

**Key Type Patterns:**

- `PlatformSettings` - User configuration types
- `PlatformEvents` - Event bus types
- `PlatformStorage` - LocalStorage key types
- `ModuleConfig` - Module configuration

## Module Examples

### Simple Module (Stream Latency Display)

```typescript
export default class StreamLatencyModule extends TwitchModule {
    readonly config: ModuleConfig<TwitchEvents> = {
        name: "stream-latency",
        appliers: [
            {
                type: "selector",
                selectors: ["[class*='stream-delay']"],
                callback: this.run.bind(this),
            },
        ],
    };

    async run(elements: Element[]) {
        // Add latency display
        const element = elements[0] as HTMLElement;
        element.textContent = "Latency: 2s";
    }
}
```

### Event-Based Module (Chat Features)

```typescript
export default class ChatAttachmentsModule extends TwitchModule {
    readonly config: ModuleConfig<TwitchEvents> = {
        name: "chat-attachments",
        appliers: [
            {
                type: "selector",
                selectors: [".chat-room"],
                callback: this.onContainerReady.bind(this),
            },
            {
                type: "event",
                event: "chat:message",
                callback: this.onChatMessage.bind(this),
            },
        ],
    };

    async onContainerReady(elements: Element[]) {
        // Container is ready
    }

    async onChatMessage(event: TwitchEvents["chat:message"]) {
        // Process chat message
    }
}
```

## Key Design Patterns

### 1. Dependency Injection

Services are injected into modules through the constructor, not created inside:

```typescript
constructor(
    protected
readonly
emitter: Emitter<Events>,
    private
readonly
storageRepository: StorageRepository<Storage>,
// ... other services
)
{
}
```

Benefits:

- Easy testing (mock dependencies)
- Clear dependencies
- No hidden globals

### 2. Platform Abstraction

Shared logic in base classes, platform-specific in overrides:

```typescript
// Shared base
abstract class Module<Events, Storage, Settings> {
    protected commonUtils() {
        return this.utilsRepository.commonUtils;
    }

    protected reactUtils() {
        return this.utilsRepository.reactUtils;
    }
}

// Platform-specific
abstract class TwitchModule extends Module<TwitchEvents,

...>
{
protected
    twitchUtils()
    {
        return /* Twitch-specific utils */
    }
}
```

### 3. Event-Driven Architecture

Components communicate via events, not direct calls:

```typescript
// Emit event
this.emitter.emit("chat:message", message);

// Listen for event
this.emitter.on("chat:message", (msg) => {
    // Handle message
});
```

### 4. Selector-Based Activation

Modules activate when DOM elements appear:

```typescript
readonly config = {
    name: "example-module",
    appliers: [
        {
            type: "selector",
            selectors: [".chat-scrollable-area__message-container"],
            callback: this.run.bind(this),
            // Module activates when this element appears
        },
    ],
}
```

## File Organization

```
src/
├── index.ts                 # Entry point
├── inject.ts                # Script injection
├── platforms/               # Platform implementations
│   ├── twitch/             # Twitch-specific code
│   └── kick/               # Kick-specific code
├── shared/                  # Shared components
│   ├── apis/               # API clients
│   ├── event/              # Event system
│   ├── logger/             # Logging
│   ├── module/             # Module system
│   ├── platform/           # Base platform
│   ├── queue/              # Async queue
│   ├── settings/           # Settings management
│   ├── storage/            # Storage utilities
│   ├── utils/              # Common utilities
│   └── worker/             # Worker bridge
├── types/                   # TypeScript types
│   ├── platforms/          # Platform types
│   └── shared/             # Shared types
└── test/                    # Tests
```

## Best Practices

1. **Always use selectors** - Don't assume elements exist on page load
2. **Check settings** - Respect user preferences with `isModuleEnabled()`
3. **Handle errors** - Wrap module code in try-catch
4. **Use logger** - Log module activity for debugging
5. **Clean up** - Remove event listeners and DOM changes on unload
6. **Type safety** - Define proper types for events, storage, and settings
7. **Platform agnostic** - Keep shared logic in base classes

## Adding a New Module

1. Create file in `src/platforms/{platform}/modules/{feature-name}/`
2. Extend `TwitchModule` or `KickModule`
3. Define `config` with name and appliers array (selector or event type)
4. Implement callback methods for each applier
5. Add to platform's `getModules()` array
6. Add types to appropriate `types/` directory
