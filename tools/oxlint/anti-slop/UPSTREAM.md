# anti-slop provenance

- Source repository: https://github.com/dmmulroy/anti-slop
- Source path: `skills/install-anti-slop/assets/anti-slop/`
- Source commit: unknown. The local skill install (2026-10-02) recorded skill folder tree hash
  `89044d21c75a367eac1ddbaf208e650b1a7d5820`, which identifies the skill folder, not a commit.
- Recoverable pristine snapshot: repository commit `47671bd74e5ea69b1b81e4c0bf81415568fac93b`,
  directory `tools/oxlint/anti-slop/` excluding this repository-authored `UPSTREAM.md`.
  All 38 asset files were verified byte-for-byte against the installed skill on 2026-10-03.
- Asset manifest SHA-256: `21d01a815d0409087b8b52d8ba1b267ecd1ff8f111b9fe7d652776b065367a88`.
  Computed from sorted relative file paths (forward slashes), each followed by a newline,
  its lowercase file SHA-256, and a newline.
- Installed on: 2026-10-02 via `scripts/install.mjs` from the installed skill, unmodified.
- Installed path: `tools/oxlint/anti-slop/` (generic plugin `index.ts` registered; `effect/` copied but not registered).
- Plugin dependency: `@oxlint/plugins@1.82.0` (pinned to the repository's `oxlint` version).

## Intentional deviations

- None in plugin source.
- `.playwright-mcp/**` added to lint ignores in addition to the standard agent tooling directories.
- `no-runtime-typeof` retains error severity with `allowInTypeGuards: true` so explicit boundary
  validators can check primitive representations; runtime checks outside type guards remain errors.
