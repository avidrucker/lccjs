#!/usr/bin/env bash
# run_mul_test.sh — TDD harness for mul_q14 (#1470).
# Assembles mul.a + mul_test.a, links, runs, and diffs program output against the
# C golden (mul_golden.txt). Exit 0 = all vectors match.
#
# Toggling: comment out a "=== TEST k ===" block in mul_test.a to skip that vector
# (drop its line from mul_golden.txt, or regenerate: ./gen_mul_vectors golden > mul_golden.txt).
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
cd "$root"

LCC="node src/cli/lcc.js"
RUN="scripts/lccrun.sh"
[ -f name.nnn ] || printf 'BANANA\n' > name.nnn

$RUN $LCC experiments/donut/mul.a      >/dev/null
$RUN $LCC experiments/donut/mul_test.a >/dev/null
$RUN $LCC experiments/donut/mul.o experiments/donut/mul_test.o \
        -o experiments/donut/mul_test.e >/dev/null

$RUN node src/core/interpreter.js experiments/donut/mul_test.e 2>/dev/null \
  | awk 'f{print} /=+ Output/{f=1}' | sed '/^$/d' > experiments/donut/mul_actual.txt

if diff -u experiments/donut/mul_golden.txt experiments/donut/mul_actual.txt; then
  echo "PASS: all mul_q14 vectors match the C golden."
else
  echo "FAIL: mul_q14 output drifted from the golden (see diff above)." >&2
  exit 1
fi
