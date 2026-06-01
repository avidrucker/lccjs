#!/usr/bin/env bash
# close.sh — shim so npm's process CWD stays valid after worktree teardown (#379).
#
# Root cause: `npm run close N` launches bash with CWD = the worktree (where
# package.json lives). After close.js removes the worktree, bash's CWD is a
# deleted directory. On exit, bash calls getcwd(), fails, and prints:
#   pwd: error retrieving current directory: getcwd: cannot access parent directories
# causing npm to exit 1 — even though the close itself succeeded.
#
# Fix: capture the branch name now (while still in the worktree CWD), then cd
# to main root BEFORE invoking node. Bash's CWD is main root for the entire
# duration of the node run and at exit — getcwd() never sees the deleted path.
# close.js receives --branch so it can chdir back into the worktree for its git
# operations without needing to be launched from there. (#379)
#
# NOTE: do NOT use `exec node ...` here — exec replaces this process and closes
# the bash context that holds the post-teardown chdir; a regular fork+wait is
# required for the cd-before-exit pattern to work.

set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"

# Resolve the main repo root before any cd.
# --path-format=absolute (git ≥2.31) gives an absolute path directly.
# Fallback: make the relative common-dir path absolute manually.
if git_common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null); then
  :
else
  git_common=$(git rev-parse --git-common-dir)
  [[ "$git_common" = /* ]] || git_common="$(realpath "$(pwd)/$git_common")"
fi
main_root=$(dirname "$git_common")

# Capture branch now, before cd'ing away from the worktree CWD.
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')

# Move to main root BEFORE invoking node. This ensures bash's CWD is a
# directory that survives teardown, eliminating the getcwd error. (#379)
cd "$main_root"

node "$script_dir/close.js" "$@" --branch "$branch"
