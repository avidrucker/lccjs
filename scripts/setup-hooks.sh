#!/usr/bin/env bash
# Install all lccjs git hooks from scripts/git-hooks/ into .git/hooks/.
# Safe to re-run — uses symlinks so hooks stay current as the repo evolves.
# Works from both a regular clone and a git worktree.

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
GIT_COMMON="$(git rev-parse --git-common-dir)"
# git-common-dir is relative in a normal clone; make it absolute.
if [[ "$GIT_COMMON" != /* ]]; then
  GIT_COMMON="$REPO_ROOT/$GIT_COMMON"
fi

# Main repo root is one level up from the common .git dir.
MAIN_ROOT="$(dirname "$GIT_COMMON")"
HOOKS_SRC="$MAIN_ROOT/scripts/git-hooks"
HOOKS_DEST="$GIT_COMMON/hooks"

for hook in "$HOOKS_SRC"/*; do
  name="$(basename "$hook")"
  # Relative symlink: .git/hooks/<name> -> ../../scripts/git-hooks/<name>
  ln -sf "../../scripts/git-hooks/$name" "$HOOKS_DEST/$name"
  echo "[setup] installed $name"
done

echo "[setup] done — run 'git commit --no-verify' to bypass any hook if needed."
