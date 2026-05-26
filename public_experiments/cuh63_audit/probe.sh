#!/usr/bin/env bash
# Audit of cuh63 6.3 LCC behavior: a self-contained probe sweep used to
# verify which observed quirks are isolated regressions vs. global parser
# changes vs. documented behavior.
#
# Usage:
#   LCC_ORACLE=/abs/path/to/cuh63/lcc ./probe.sh
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

TMP=$(mktemp -d)
cd "$TMP"
echo "TestUser" > name.nnn

# All probes use a 3-second timeout so accidentally-looping programs
# can't hang the audit; every test program ends with `halt`.

probe() {
  local label="$1"; shift; local src="$1"; shift
  rm -f t.a t.e t.lst t.bst
  printf "%s\n" "$src" > t.a
  out=$(timeout 3 "$LCC_ORACLE" t.a </dev/null 2>&1) || true
  if echo "$out" | grep -q "Error"; then
    local err=$(echo "$out" | grep -v "^Error on line" | grep -v "^Starting" | grep -v "^[ \t]*$" | head -1)
    printf "  %-50s REJECT  %s\n" "$label" "$err"
  else
    local enc=$(grep -E "^[0-9a-f]{4}  [0-9a-f]" t.lst 2>/dev/null | head -1 | awk '{print $2}')
    printf "  %-50s ACCEPT  enc=%s\n" "$label" "$enc"
  fi
}

heading() {
  echo
  echo "=== $1 ==="
}

heading "mov dr, imm9 (pseudo for mvi; spec: 9-bit signed -256..+255)"
probe "mov r0, 0"                  "    mov r0, 0
    halt"
probe "mov r0, 255 (upper boundary)" "    mov r0, 255
    halt"
probe "mov r0, -1  (in spec, but rejected — REGRESSION)" "    mov r0, -1
    halt"
probe "mov r0, -15"                "    mov r0, -15
    halt"
probe "mov r0, -256 (lower boundary; in spec, rejected)" "    mov r0, -256
    halt"
probe "mov r0, 256  (out of range — should reject)" "    mov r0, 256
    halt"
probe "mov r0, -0xff (in spec via hex, also rejected)" "    mov r0, -0xff
    halt"

heading "mvi dr, imm9 (the underlying instruction — accepted)"
probe "mvi r0, -1"                 "    mvi r0, -1
    halt"
probe "mvi r0, -256"               "    mvi r0, -256
    halt"
probe "mvi r0, 255"                "    mvi r0, 255
    halt"
probe "mvi r0, 256 (correctly rejected)" "    mvi r0, 256
    halt"

heading "Other pseudo-instructions — verified intact"
probe "mov r1, r0 (register form → mvr)" "    mov r0, 5
    mov r1, r0
    halt"
probe "mvr r1, r0 (explicit underlying)" "    mov r0, 5
    mvr r1, r0
    halt"
probe "cea r0, 5 (pseudo for add dr, fp, imm5)" "    cea r0, 5
    halt"
probe "cea r0, -16 (lower boundary)" "    cea r0, -16
    halt"
probe "cea r0, 15  (upper boundary)" "    cea r0, 15
    halt"
probe "cea r0, 16  (correctly out of range)" "    cea r0, 16
    halt"

heading "imm5 boundaries on add/sub/and — verified intact"
probe "add r0, r0, -15"           "    add r0, r0, -15
    halt"
probe "add r0, r0, -16 (lower)"   "    add r0, r0, -16
    halt"
probe "add r0, r0, 15 (upper)"    "    add r0, r0, 15
    halt"
probe "add r0, r0, 16 (out)"      "    add r0, r0, 16
    halt"
probe "sub r0, r0, -16"           "    sub r0, r0, -16
    halt"
probe "and r0, r0, -1"            "    and r0, r0, -1
    halt"
probe "and r0, r0, -16"           "    and r0, r0, -16
    halt"

heading "Numeric literal forms — verified intact"
probe "decimal: mov r0, 15"       "    mov r0, 15
    halt"
probe "hex: mov r0, 0xff"         "    mov r0, 0xff
    halt"
probe "binary: mov r0, 0b1111"    "    mov r0, 0b1111
    halt"
probe "char: mov r0, 'A'"         "    mov r0, 'A'
    halt"
probe "unary +: mov r0, +0xff"    "    mov r0, +0xff
    halt"
probe "negative zero: mov r0, -0" "    mov r0, -0
    halt"

heading "Directive synonyms — verified intact (encodings match)"
probe ".string \"hi\""             "    .string \"hi\"
    halt"
probe ".stringz \"hi\""            "    .stringz \"hi\"
    halt"
probe ".asciz \"hi\""              "    .asciz \"hi\"
    halt"
probe ".word 42"                  "    .word 42
    halt"
probe ".fill 42"                  "    .fill 42
    halt"
probe ".zero 3"                   "    .zero 3
    halt"
probe ".space 3"                  "    .space 3
    halt"
probe ".blkw 3"                   "    .blkw 3
    halt"
probe ".global x"                 "    .global x
x: halt"
probe ".globl x"                  "    .globl x
x: halt"

heading "Undocumented / questionable behaviors observed"
probe ".orig 5 (undocumented synonym for .org)" \
"    .orig 5
foo: halt"
probe "two .start directives (silently accepts last)" \
"    .start b
    .start a
a: halt
b: halt"
probe ".start without target (correctly rejects)" \
"    .start"
probe "empty source (just a comment) — accepts"  "; nothing"

heading "Label arithmetic & '*' notation — verified intact"
probe "br main+1"                 "    br main+1
    halt
main: halt
    halt"
probe ".word * (current-address notation)" \
"loop: .word *
    halt"

cd /tmp; rm -rf "$TMP"
echo
echo "=== Done ==="
