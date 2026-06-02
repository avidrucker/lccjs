#!/usr/bin/env bash
# close.sh — manual-invocation wrapper for close.js when calling from the main
# checkout (not a worktree). Passes --branch so close.js knows which worktree
# to operate on without needing to be launched from inside it.
#
# NOTE: `npm run close` no longer goes through this shim (#434). The package.json
# "close" entry now invokes `node scripts/close.js` directly, which avoids the
# npm-process getcwd failure that occurred when npm's CWD (the worktree) was
# deleted after teardown. The bash getcwd fix (#379) is preserved here for
# manual use but is no longer on the npm hot path.
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
