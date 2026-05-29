#!/usr/bin/env bash
# run-pdd.sh — run the PDD puzzle scanner, taking its excludes from .pddignore.
#
# The pdd gem has no native ignore-file (only --exclude globs and
# --skip-gitignore), so this wrapper translates each non-comment line of
# .pddignore into a --exclude argument. Invoked by `npm run puzzles`.
set -euo pipefail

cd "$(dirname "$0")/.."   # repo root (this script lives in scripts/)

args=(--source . --file puzzles.xml --skip-gitignore)

if [[ -f .pddignore ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"                                   # drop trailing/whole-line comments
    line="$(printf '%s' "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"  # trim
    [[ -z "$line" ]] && continue
    args+=(--exclude "$line")
  done < .pddignore
fi

exec pdd "${args[@]}"
