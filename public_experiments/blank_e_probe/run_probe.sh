#!/usr/bin/env bash
# Probe: which OG LCC assembly errors leave a blank .e on disk?
# oracle requires: cwd = dir containing the file, arg = basename only, name.nnn present

ORACLE="$HOME/Documents/Study/Assembly/cuh63/lcc"

run_case() {
  local name="$1"
  local src="$2"
  local tmp
  tmp=$(mktemp -d)

  # oracle naming convention: base1.a -> base1.e/lst/bst
  echo "$src" > "$tmp/${name}1.a"
  echo "TestUser" > "$tmp/name.nnn"

  echo "=== $name ==="
  local stdout stderr exit_code
  stdout=$(cd "$tmp" && "$ORACLE" "${name}1.a" 2>/tmp/oracle_stderr_$$) || true
  exit_code=$?
  stderr=$(cat /tmp/oracle_stderr_$$ 2>/dev/null || true)

  echo "exit=$exit_code"
  [ -n "$stdout" ] && echo "stdout: $stdout"
  [ -n "$stderr" ] && echo "stderr: $stderr"

  for ext in e o lst bst; do
    if [ -f "$tmp/${name}1.$ext" ]; then
      local size hex
      size=$(wc -c < "$tmp/${name}1.$ext")
      hex=$(xxd -l 8 "$tmp/${name}1.$ext" 2>/dev/null | head -1)
      echo "  .${ext}: ${size}B  hex=$hex"
    else
      echo "  .${ext}: (not written)"
    fi
  done

  rm -rf "$tmp"
  echo ""
}

# 0. Valid program (control)
run_case "valid" "    halt"

# 1. Undefined label
run_case "undef_label" "    br cheese
    halt"

# 2. No-comma negative immediate (the #257 case)
run_case "nocomma_neg_imm5" "    add r0 r0 -1
    halt"

# 3. No-comma negative immediate for ldr (imm6)
run_case "nocomma_neg_ldr" "    ldr r0 r1 -2
    halt"

# 4. Out-of-range positive immediate (imm5 max is 15)
run_case "range_add_imm5_pos" "    add r0 r0 99
    halt"

# 5. Out-of-range immediate for br (imm9 > 255)
run_case "range_br_pos" "    br 999
    halt"

# 6. Bad directive
run_case "bad_directive" "    .foobar
    halt"

# 7. Multiply defined label
run_case "dup_label" "foo: halt
foo: halt"

# 8. Bad register name
run_case "bad_register" "    add r9 r0 1
    halt"

# 9. Missing operand
run_case "missing_operand" "    add
    halt"

rm -f /tmp/oracle_stderr_$$
