#!/usr/bin/env bash
# run-pdd.sh — run the PDD puzzle scanner, taking its excludes from .pddignore.
#
# The pdd gem has no native ignore-file (only --exclude globs and
# --skip-gitignore), so this wrapper translates each non-comment line of
# .pddignore into a --exclude argument. Invoked by `npm run puzzles`.
#
# Path-robustness (#224): pdd-0.24.2 compiles each --exclude into a regexp from
# the ABSOLUTE source path (Sources#fetch → Glob#to_regexp), and Glob#to_regexp
# emits non-glob path chars *verbatim* — it never Regexp.escapes them. So a
# regex-special char in the repo's absolute path (e.g. the `+` that EnterWorktree
# puts in `.claude/worktrees/<fruit>+<slug>` dir names) turns every exclude regex
# into one that no longer matches its own path — silently disabling ALL excludes.
# pdd then scans docs/*.md and aborts on the first uppercase at_todo substring, even
# for a change with no puzzle markers. We sidestep it by scanning through a
# special-char-free symlink when the repo path is unsafe; if we can't build a
# safe path we fail loudly rather than mis-scan in silence.
set -euo pipefail

cd "$(dirname "$0")/.."   # repo root (this script lives in scripts/)
repo_abs="$PWD"

# Build the --exclude args from .pddignore (gitignore-style; '#' comments skipped).
args=(--file puzzles.xml --skip-gitignore)
if [[ -f .pddignore ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"                                   # drop trailing/whole-line comments
    line="$(printf '%s' "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"  # trim
    [[ -z "$line" ]] && continue
    args+=(--exclude "$line")
  done < .pddignore
fi

# Decide the --source path. The dangerous chars are the regex/glob metacharacters
# Glob#to_regexp does NOT safely escape when they appear literally in the path:
#   + ( ) [ ] ^ $ | { } * ? \   ('.' IS escaped by the gem, so it's safe.)
# Quoted case patterns match each char literally — portable, no grep-flavour
# dependency (the system grep may be ugrep, which parses bracket classes differently).
has_metachar() {
  local s=$1 c
  for c in '+' '(' ')' '[' ']' '{' '}' '^' '$' '|' '*' '?' '\'; do
    case "$s" in *"$c"*) return 0 ;; esac
  done
  return 1
}
source_dir="."
cleanup() { :; }

if has_metachar "$repo_abs"; then
  # Repo path would silently void every exclude. Scan via a safe-named symlink.
  tmp_root="$(mktemp -d)"
  safe_link="$tmp_root/repo"
  ln -sfn "$repo_abs" "$safe_link"
  # The symlink's own absolute path must itself be metachar-free, or we'd just
  # move the bug. (Could happen via a hostile TMPDIR.) Fail loudly if so.
  if has_metachar "$safe_link"; then
    echo "[run-pdd] ERROR: repo path ('$repo_abs') contains a regex-special char that" >&2
    echo "[run-pdd] disables all .pddignore excludes, and the temp dir ('$tmp_root')" >&2
    echo "[run-pdd] is no safer. Set TMPDIR to a path of only [A-Za-z0-9._/-], or run" >&2
    echo "[run-pdd] the scan from a checkout whose path has none of: + ( ) [ ] ^ \$ | { } * ? \\" >&2
    rm -rf "$tmp_root"
    exit 1
  fi
  source_dir="$safe_link"
  cleanup() { rm -rf "$tmp_root"; }
  echo "[run-pdd] note: repo path contains a regex-special char (#224); scanning via $safe_link" >&2
fi
trap cleanup EXIT

pdd --source "$source_dir" "${args[@]}"
