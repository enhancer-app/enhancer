#!/usr/bin/env bash
set -euo pipefail

brave=""
for candidate in \
  "${BRAVE_PATH:-}" \
  "/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe" \
  "/c/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe"; do
  if [[ -n "$candidate" && -f "$candidate" ]]; then
    brave="$candidate"
    break
  fi
done

if [[ -z "$brave" ]]; then
  printf 'Brave nie zostal znaleziony. Ustaw BRAVE_PATH na sciezke do brave.exe.\n' >&2
  exit 1
fi

exec "$brave" \
  --remote-debugging-port=9222 \
  --remote-debugging-address=127.0.0.1 \
  --no-first-run \
  --no-default-browser-check \
  "$@"
