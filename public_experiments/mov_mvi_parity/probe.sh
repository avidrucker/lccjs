#!/usr/bin/env bash
# Probe the mov-immediate range each tool accepts.
# Generates a one-instruction program for each value and reports accept/reject
# plus the encoding bytes LCCjs produces.
#
# Usage:
#   LCC_ORACLE=/abs/path/to/cuh63/lcc ./probe.sh
#
# LCC_ORACLE can also be set in ../../.env (this script will source it).

set -u
HERE=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$HERE/../.." && pwd)

if [ -z "${LCC_ORACLE:-}" ] && [ -f "$REPO_ROOT/.env" ]; then
  set -a; . "$REPO_ROOT/.env"; set +a
fi

if [ -z "${LCC_ORACLE:-}" ]; then
  echo "Error: LCC_ORACLE is not set. Either export it or put it in ../../.env" >&2
  exit 1
fi

LCCJS="node $REPO_ROOT/src/core/lcc.js"

VALUES=(-257 -256 -255 -128 -16 -15 -1 0 1 15 16 127 128 255 256 257 511 512)

# Run from a clean temp dir so we don't pollute scratch with per-value artifacts
TMP=$(mktemp -d)
echo "TestUser" > "$TMP/name.nnn"
cd "$TMP"

printf "%-8s | %-12s | %-12s | %s\n" "value" "OG cuh63 6.3" "LCCjs" "notes"
printf "%-8s-+-%-12s-+-%-12s-+-%s\n" "--------" "------------" "------------" "-----"

for v in "${VALUES[@]}"; do
  cat > t.a <<EOF
    mov r0, $v
    halt
EOF

  og_out=$("$LCC_ORACLE" t.a </dev/null 2>&1)
  if echo "$og_out" | grep -q "Error"; then
    og_status="REJECT"
  else
    og_status="ACCEPT"
  fi

  rm -f t.e t.lst t.bst

  js_out=$($LCCJS t.a </dev/null 2>&1)
  if echo "$js_out" | grep -qiE "^error|^Error on line"; then
    js_status="REJECT"
  else
    js_status="ACCEPT"
  fi

  enc=""
  if [ "$js_status" = "ACCEPT" ] && [ -f t.lst ]; then
    enc=$(grep -E "^0000" t.lst | awk '{print $2}')
  fi

  rm -f t.e t.lst t.bst

  printf "%-8s | %-12s | %-12s | LCCjs enc=%s\n" "$v" "$og_status" "$js_status" "$enc"
done

rm -rf "$TMP"
