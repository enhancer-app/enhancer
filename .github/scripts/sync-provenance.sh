#!/usr/bin/env bash
set -euo pipefail

MASTER=$1
STABLE=$2
VERSION_LINE='^[-+][[:space:]]*"version": "[0-9]+\.[0-9]+\.[0-9]+",$'

fail() {
	echo "$1" >&2
	exit 1
}

changes() {
	git show -U0 --no-color --no-ext-diff --no-renames --format= "$1" | grep -vE '^(index |@@)' || true
}

for COMMIT in $(git rev-list "$MASTER..$STABLE"); do
	SHORT=${COMMIT:0:7}
	read -r -a PARENTS <<< "$(git rev-list --parents -n 1 "$COMMIT")"
	if [ "${#PARENTS[@]}" -gt 2 ]; then
		TREE=$(git merge-tree --write-tree --no-messages "${PARENTS[@]:1}") || fail "Merge $SHORT conflicts on its own."
		[ "$TREE" = "$(git rev-parse "$COMMIT^{tree}")" ] || fail "Merge $SHORT changes more than its parents."
		continue
	fi

	SOURCE=$(git log -1 --format=%B "$COMMIT" | sed -nE 's/^\(cherry picked from commit ([0-9a-f]{40})\)$/\1/p' | tail -n 1)
	if [ -n "$SOURCE" ]; then
		git cat-file -e "$SOURCE^{commit}" 2>/dev/null || fail "$SHORT is picked from unknown commit ${SOURCE:0:7}."
		git merge-base --is-ancestor "$SOURCE" "$MASTER" || fail "$SHORT is picked from ${SOURCE:0:7}, which is not on master."
		[ "$(changes "$COMMIT")" = "$(changes "$SOURCE")" ] || fail "$SHORT differs from its source ${SOURCE:0:7}."
		continue
	fi

	SUBJECT=$(git log -1 --format=%s "$COMMIT")
	if [[ "$SUBJECT" =~ ^release\(stable\):\ v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
		[ "$(git diff --numstat "$COMMIT^" "$COMMIT")" = "$(printf '1\t1\tpackage.json')" ] || fail "Version bump $SHORT changes more than one line."
		LINES=$(git diff -U0 --no-color "$COMMIT^" "$COMMIT" | grep -E '^[-+][^-+]' || true)
		[ "$(grep -cE "$VERSION_LINE" <<< "$LINES")" = 2 ] || fail "Version bump $SHORT changes more than the version."
		continue
	fi

	fail "$SHORT ($SUBJECT) is not on master."
done
