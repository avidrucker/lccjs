#!/usr/bin/env bash
# find-scripts.sh — enumerate scripting files in the project for human audit
# Usage: bash scripts/find-scripts.sh [ext]
#   ext (optional): filter to a single extension, e.g. sh, js, py

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

FILTER="${1:-}"
EXTENSIONS=(sh js py)

print_group() {
    local ext="$1"
    local files
    files=$(git ls-files | grep -E "\\.${ext}$" | sort || true)
    local count=0
    [ -n "$files" ] && count=$(echo "$files" | wc -l | tr -d ' ')

    local plural="s"
    [ "$count" -eq 1 ] && plural=""
    printf "\n── .%s (%d file%s) ────────────────────────────────\n" "$ext" "$count" "$plural"

    if [ -z "$files" ]; then
        echo "  (none)"
    else
        echo "$files" | sed 's/^/  /'
    fi
}

echo "Script inventory — $(date '+%Y-%m-%d')"
echo "(tracked files only; node_modules, .claude, generated artifacts excluded via .gitignore)"

if [ -n "$FILTER" ]; then
    print_group "$FILTER"
else
    for ext in "${EXTENSIONS[@]}"; do
        print_group "$ext"
    done
fi

echo ""
