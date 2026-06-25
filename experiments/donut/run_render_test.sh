#!/usr/bin/env bash
# run_render_test.sh — TDD harness for render_pixel (#1471).
# Assembles cordic.a + mul.a + render.a + render_test.a, links all four, runs, and
# diffs glyph output against render_golden.txt (donut_gen scanglyph). Exit 0 = pass.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
cd "$root"
LCC="node src/cli/lcc.js"
RUN="scripts/lccrun.sh"
D=experiments/donut
[ -f name.nnn ] || printf 'BANANA\n' > name.nnn

for m in cordic mul render render_test; do
  $RUN $LCC $D/$m.a >/dev/null
done
$RUN $LCC $D/cordic.o $D/mul.o $D/render.o $D/render_test.o -o $D/render_test.e >/dev/null

$RUN node src/core/interpreter.js $D/render_test.e 2>/dev/null \
  | awk 'f{print} /=+ Output/{f=1}' > $D/render_actual.txt
# trim a possible trailing blank line from the banner-stripped capture
sed -i -e '${/^$/d}' $D/render_actual.txt

if diff -u $D/render_golden.txt $D/render_actual.txt; then
  echo "PASS: all render_pixel glyphs match the C golden (full ramp)."
else
  echo "FAIL: render_pixel output drifted from the golden (see diff above)." >&2
  exit 1
fi
