#!/usr/bin/env bash
# run_cordic_test.sh — TDD harness for length_cordic (#1469).
#
# Assembles cordic.a + cordic_test.a, links them, runs the executable, and diffs
# the program output against the C-generated golden (cordic_golden.txt).
# Exit 0 = all vectors match; non-zero = a vector regressed.
#
# Toggling validation: comment out a "=== TEST k ===" block in cordic_test.a to
# skip that vector (and drop its line from cordic_golden.txt, or regenerate it
# with: ./gen_cordic_vectors golden > cordic_golden.txt).
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"          # experiments/donut
root="$(cd "$here/../.." && pwd)"              # repo (worktree) root
cd "$root"

LCC="node src/cli/lcc.js"
RUN="scripts/lccrun.sh"

# lcc.js needs a name.nnn author cache to run non-interactively.
[ -f name.nnn ] || printf 'BANANA\n' > name.nnn

$RUN $LCC experiments/donut/cordic.a       >/dev/null
$RUN $LCC experiments/donut/cordic_test.a  >/dev/null
$RUN $LCC experiments/donut/cordic.o experiments/donut/cordic_test.o \
        -o experiments/donut/cordic_test.e >/dev/null

# Strip the interpreter's banner/trailer; keep only the program's own stdout.
$RUN node src/core/interpreter.js experiments/donut/cordic_test.e 2>/dev/null \
  | awk 'f{print} /=+ Output/{f=1}' | sed '/^$/d' > experiments/donut/cordic_actual.txt

if diff -u experiments/donut/cordic_golden.txt experiments/donut/cordic_actual.txt; then
  echo "PASS: all length_cordic vectors match the C golden."
else
  echo "FAIL: length_cordic output drifted from the golden (see diff above)." >&2
  exit 1
fi
