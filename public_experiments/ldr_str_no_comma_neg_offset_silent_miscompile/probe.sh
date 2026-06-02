#!/usr/bin/env bash
# Audit of cuh63 6.3 LCC behavior: ldr/str with space-separated (no-comma)
# operands and a negative offset6 silently misassemble — the negative value
# is dropped and offset6 is encoded as 0, with no error or warning.
#
# This script runs the same inputs through both the OG cuh63 6.3 lcc binary
# and the LCC.js reimplementation, side-by-side, so the discrepancy is
# immediately visible.
#
# Usage:
#   LCC_ORACLE=/abs/path/to/cuh63/lcc ./probe.sh
#
# LCC_ORACLE can also be set in ../../.env.

HERE=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$HERE/../.." && pwd)
LCC_JS="$REPO_ROOT/src/cli/lcc.js"

if [ -z "${LCC_ORACLE:-}" ] && [ -f "$REPO_ROOT/.env" ]; then
  set -a; . "$REPO_ROOT/.env"; set +a
fi

if [ -z "${LCC_ORACLE:-}" ]; then
  echo "Error: LCC_ORACLE is not set. Either export it or put it in ../../.env" >&2
  exit 1
fi

TMP=$(mktemp -d)
cd "$TMP"
echo "TestUser" > name.nnn

probe_og() {
  local label="$1"; local src="$2"
  rm -f t.a t.lst t.bst t.e
  printf "%s\n" "$src" > t.a
  local out
  out=$(timeout 3 "$LCC_ORACLE" t.a </dev/null 2>&1) || true
  if echo "$out" | grep -q "^Error"; then
    printf "  %-38s  OG=REJECT\n" "$label"
  else
    local enc
    enc=$(grep -oP "^[0-9a-f]{4}\s+\K[0-9a-f]{4}" t.lst 2>/dev/null | head -1)
    printf "  %-38s  OG=%-6s\n" "$label" "${enc:-???}"
  fi
}

probe_js() {
  local label="$1"; local src="$2"
  rm -f t.a t.lst t.bst t.e
  printf "%s\n" "$src" > t.a
  local out
  out=$(timeout 3 node "$LCC_JS" t.a 2>&1) || true
  if echo "$out" | grep -qi "error"; then
    printf "  %-38s  JS=REJECT\n" "$label"
  else
    local enc
    enc=$(grep -oP "^[0-9a-f]{4}\s+\K[0-9a-f]{4}" t.lst 2>/dev/null | head -1)
    printf "  %-38s  JS=%-6s\n" "$label" "${enc:-???}"
  fi
}

probe_both() {
  local label="$1"; local src="$2"
  probe_og "$label" "$src"
  probe_js "$label" "$src"
  echo ""
}

heading() {
  echo
  echo "=== $1 ==="
}

# ─── ldr: comma syntax (control — should be correct in both) ────────────────
heading "ldr dr, sr, offset6  — comma syntax (control group)"
probe_both "ldr r1, fp, 0  (offset=0)"  "    ldr r1, fp, 0
    halt"
probe_both "ldr r1, fp, 1  (offset=+1)" "    ldr r1, fp, 1
    halt"
probe_both "ldr r1, fp, 31 (offset=+31, upper)" "    ldr r1, fp, 31
    halt"
probe_both "ldr r1, fp, -1  (offset=-1)"  "    ldr r1, fp, -1
    halt"
probe_both "ldr r1, fp, -2  (offset=-2)"  "    ldr r1, fp, -2
    halt"
probe_both "ldr r1, fp, -32 (offset=-32, lower)" "    ldr r1, fp, -32
    halt"

# ─── ldr: no-comma syntax — the bug ─────────────────────────────────────────
heading "ldr dr sr offset6  — no-comma syntax (OG BUG: negatives silently → 0)"
probe_both "ldr r1 fp 0  (offset=0)"   "    ldr r1 fp 0
    halt"
probe_both "ldr r1 fp 1  (offset=+1)"  "    ldr r1 fp 1
    halt"
probe_both "ldr r1 fp 31 (offset=+31)" "    ldr r1 fp 31
    halt"
probe_both "ldr r1 fp -1  (BUG: OG encodes as 0)" "    ldr r1 fp -1
    halt"
probe_both "ldr r1 fp -2  (BUG: OG encodes as 0)" "    ldr r1 fp -2
    halt"
probe_both "ldr r1 fp -32 (BUG: OG encodes as 0)" "    ldr r1 fp -32
    halt"

# ─── str: same bug, same pattern ─────────────────────────────────────────────
heading "str dr sr offset6  — str has identical behavior to ldr"
probe_both "str r1, fp, 0  (comma, control)" "    str r1, fp, 0
    halt"
probe_both "str r1, fp, -1 (comma, control)" "    str r1, fp, -1
    halt"
probe_both "str r1 fp 0    (no-comma, +0)" "    str r1 fp 0
    halt"
probe_both "str r1 fp -1   (BUG: OG encodes as 0)" "    str r1 fp -1
    halt"

# ─── scope: ld/st/lea (pcoffset9 — different parser path, no bug) ────────────
heading "ld/st/lea dr label  — pcoffset9 path, no-comma works fine in both"
probe_both "ld r0, x  (comma)"  "    ld r0, x
    halt
x: .word 0"
probe_both "ld r0 x   (no-comma)" "    ld r0 x
    halt
x: .word 0"
probe_both "st r0, x  (comma)"  "    st r0, x
    halt
x: .word 0"
probe_both "st r0 x   (no-comma)" "    st r0 x
    halt
x: .word 0"
probe_both "lea r0, x (comma)"  "    lea r0, x
    halt
x: .word 0"
probe_both "lea r0 x  (no-comma)" "    lea r0 x
    halt
x: .word 0"

# ─── label arithmetic: ld r0, x+1 / x-1 (works in both) ─────────────────────
heading "ld dr, label+/-N  — label arithmetic, works in both"
probe_both "ld r0, x    (base)" "    ld r0, x
    halt
x: .word 0
   .word 0"
probe_both "ld r0, x+1  (label+1)" "    ld r0, x+1
    halt
x: .word 0
   .word 0"
probe_both "ld r0, x-1  (label-1)" "    ld r0, x-1
    halt
x: .word 0
   .word 0"

cd /tmp; rm -rf "$TMP"
echo ""
echo "=== Done ==="
