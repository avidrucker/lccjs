#!/usr/bin/env bash
# close.sh — pre-root the shell before invoking close.js (#360).
#
# When `npm run close N` is called from inside a worktree, the shell's CWD is
# the worktree path. close.js removes that directory during teardown, leaving
# the parent shell in a deleted CWD. On exit, bash tries to resolve its CWD
# and fails with:
#   pwd: error retrieving current directory: getcwd: cannot access parent directories
# causing npm to surface exit code 1 even though the close succeeded.
#
# Fix: cd to the main repo root *before* Node runs, so the shell's CWD is
# already valid when Node exits and the worktree is gone.
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"

# Resolve the main repo root from the common git dir.
# --path-format=absolute (git ≥2.31) gives us an absolute path directly.
# Fallback: make the relative path absolute manually.
if git_common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null); then
  :
else
  git_common=$(git rev-parse --git-common-dir)
  [[ "$git_common" = /* ]] || git_common="$(realpath "$(pwd)/$git_common")"
fi
main_root=$(dirname "$git_common")

cd "$main_root"
exec node "$script_dir/close.js" "$@"
