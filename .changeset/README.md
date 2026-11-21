# Changesets

Every pull request with a change users can notice adds a changeset: a Markdown file that says how the change
bumps the version and how it reads in `CHANGELOG.md`.

```sh
bunx changeset          # pick patch or minor and write one sentence
bunx changeset --empty  # for a feat/fix PR that needs no changelog line
```

```md
---
"enhancer": minor
---

Group consecutive chat messages from the same user.
```

- `minor` for new features, `patch` for fixes and small improvements, `major` only for breaking changes.
- Write one short sentence for users, in English, in the imperative mood. Prefix it with `Twitch:` or `Kick:`
  when it applies to only one platform.
- The stable release bot runs `changeset version` on the changes ticked in the `release(stable)` PR. It bumps
  `package.json` to the highest level, writes the section in `CHANGELOG.md` and deletes the used changesets.

See `docs/development.md` → Releasing for the full flow.
