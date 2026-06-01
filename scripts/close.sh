#!/usr/bin/env bash
# close.sh — shim so the parent shell's CWD stays valid after worktree teardown (#360).
#
# When `npm run close N` is called from inside a worktree, close.js removes the
# worktree directory. The intermediate shell process (this script) is then left
# with a deleted CWD. On exit, getcwd() fails, printing:
#   pwd: error retrieving current directory: getcwd: cannot access parent directories
# and causing npm to exit 1 — even though the close itself succeeded.
#
# Fix: run close.js from the current (worktree) CWD so it can detect the
# branch and drive all git operations correctly; then cd to the main repo root
# AFTER close.js exits. chdir() to an absolute path succeeds on Linux even
# from a deleted CWD, so this process exits cleanly with a valid working dir.
#
# NOTE: do NOT use `exec node ...` here — exec replaces this process and leaves
# no opportunity to cd after teardown. A regular fork+wait is required.

script_dir="$(cd "$(dirname "$0")" && pwd)"

# Resolve the main repo root now, before the worktree is removed.
# --path-format=absolute (git ≥2.31) gives an absolute path directly.
# Fallback: make the relative common-dir path absolute manually.
if git_common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null); then
  :
else
  git_common=$(git rev-parse --git-common-dir)
  [[ "$git_common" = /* ]] || git_common="$(realpath "$(pwd)/$git_common")"
fi
main_root=$(dirname "$git_common")

# Run close.js from the worktree CWD — close.js uses currentBranch() to
# identify the worktree and must operate from the right git context.
node "$script_dir/close.js" "$@"
close_exit=$?

# Post-teardown: cd to a valid directory before this process exits.
# chdir() to an absolute path works even when the current dir has been deleted.
cd "$main_root" 2>/dev/null || true

exit "$close_exit"
