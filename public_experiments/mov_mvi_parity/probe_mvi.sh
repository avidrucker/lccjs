#!/usr/bin/env bash
# Probe the underlying `mvi` instruction side-by-side with the `mov`
# pseudo-instruction. Per the LCC ISA summary that ships with cuh63,
#   "mov dr, imm9 is a pseudo-instruction translated to the machine
#    instruction corresponding to mvi dr, imm9."
# and `imm9` is a signed 9-bit field. So mov and mvi should accept the
# same -256..+255 range.
#
# Usage:
#   LCC_ORACLE=/abs/path/to/cuh63/lcc ./probe_mvi.sh
#
# LCC_ORACLE can also be set in ../../.env.

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

# spec boundary values + a few in/out of range
VALUES=(-257 -256 -255 -1 0 1 255 256 257)

TMP=$(mktemp -d)
echo "TestUser" > "$TMP/name.nnn"
cd "$TMP"

printf "%-8s | %-12s | %-12s | %-12s | %-12s\n" "value" "mov: OG" "mov: LCCjs" "mvi: OG" "mvi: LCCjs"
printf "%-8s-+-%-12s-+-%-12s-+-%-12s-+-%-12s\n" "--------" "------------" "------------" "------------" "------------"

for v in "${VALUES[@]}"; do
  for mnem in mov mvi; do
    cat > t.a <<EOF
    $mnem r0, $v
    halt
EOF

    rm -f t.e t.lst t.bst
    og_out=$("$LCC_ORACLE" t.a </dev/null 2>&1)
    if echo "$og_out" | grep -q "Error"; then
      eval "${mnem}_og=REJECT"
    else
      eval "${mnem}_og=ACCEPT"
    fi

    rm -f t.e t.lst t.bst
    js_out=$($LCCJS t.a </dev/null 2>&1)
    if echo "$js_out" | grep -qiE "^Error on line|^error"; then
      eval "${mnem}_js=REJECT"
    else
      eval "${mnem}_js=ACCEPT"
    fi
    rm -f t.e t.lst t.bst
  done

  printf "%-8s | %-12s | %-12s | %-12s | %-12s\n" "$v" "$mov_og" "$mov_js" "$mvi_og" "$mvi_js"
done

rm -rf "$TMP"
