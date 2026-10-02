# anti-slop provenance

- Source repository: https://github.com/dmmulroy/anti-slop
- Source path: `skills/install-anti-slop/assets/anti-slop/`
- Source commit: unknown. The local skill install (2026-10-02) recorded skill folder tree hash
  `89044d21c75a367eac1ddbaf208e650b1a7d5820`, which identifies the skill folder, not a commit.
- Installed on: 2026-10-02 via `scripts/install.mjs` from the installed skill, unmodified.
- Installed path: `tools/oxlint/anti-slop/` (generic plugin `index.ts` registered; `effect/` copied but not registered).
- Plugin dependency: `@oxlint/plugins@1.82.0` (pinned to the repository's `oxlint` version).

## Intentional deviations

- None in plugin source.
- `.playwright-mcp/**` added to lint ignores in addition to the standard agent tooling directories.
