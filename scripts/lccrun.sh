#!/usr/bin/env bash
# lccrun.sh — timeout runner for lccjs tool invocations.
#
# Usage:  scripts/lccrun.sh [<timeout_secs>] <cmd> [args...]
#
#   timeout_secs  wall-clock limit in seconds (default: 30).
#
# If the command finishes before the timeout, stdout/stderr flow through and
# the script exits with the command's own exit code.
#
# If the timeout elapses, the entire process group is killed (SIGTERM then
# SIGKILL after 2 s) and the script exits 124 with a message on stderr.
# The process group (not just the top PID) is killed so that any children
# spawned by the node process are also reaped.
#
# Example:
#   scripts/lccrun.sh 10 node src/core/lcc.js myprogram.a
#   scripts/lccrun.sh node src/core/lcc.js myprogram.a   # uses 30s default

set -uo pipefail

DEFAULT_TIMEOUT=30

usage() {
  printf 'Usage: lccrun.sh [<timeout_secs>] <cmd> [args...]\n' >&2
  printf '  timeout_secs  wall-clock limit in seconds (default: %d)\n' \
    "$DEFAULT_TIMEOUT" >&2
  exit 1
}

[[ $# -eq 0 ]] && usage

if [[ "$1" =~ ^[0-9]+$ ]]; then
  TIMEOUT="$1"
  shift
else
  TIMEOUT="$DEFAULT_TIMEOUT"
fi

[[ $# -eq 0 ]] && usage

# Temp flag: watchdog writes "1" here when it fires so the parent can
# distinguish a timeout kill from a normal non-zero exit.
FLAG=$(mktemp)
trap 'rm -f "$FLAG"' EXIT

# setsid puts the child in a new session → new process group (PGID = child PID).
# kill -- -PGID then reaches all descendants, not only the top-level node PID.
setsid "$@" &
CHILD_PID=$!
CHILD_PGID="$CHILD_PID"

# Background watchdog: fires after TIMEOUT seconds if the child is still alive.
(
  sleep "$TIMEOUT"
  if kill -0 "$CHILD_PID" 2>/dev/null; then
    printf 'lccrun: timeout after %ds — killing process group (pgid=%d)\n' \
      "$TIMEOUT" "$CHILD_PGID" >&2
    printf '1' > "$FLAG"
    kill -TERM -- -"$CHILD_PGID" 2>/dev/null || true
    sleep 2
    kill -KILL -- -"$CHILD_PGID" 2>/dev/null || true
  fi
) &
WATCHDOG_PID=$!

wait "$CHILD_PID"
CHILD_EXIT=$?

# Child finished — cancel the watchdog.
kill "$WATCHDOG_PID" 2>/dev/null || true
wait "$WATCHDOG_PID" 2>/dev/null || true

if [[ -s "$FLAG" ]]; then
  exit 124
fi

exit "$CHILD_EXIT"
