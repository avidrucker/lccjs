#!/usr/bin/env bash
# run_donut.sh — build + run the full base-LCC donut and diff vs frame_simple.txt (#1471).
# Links cordic.a + mul.a + render.a + donut.a, runs with the instruction cap lifted
# (-ms-1; the frame is ~8-10M instructions), and byte-diffs the 23x79 output against
# the committed golden. Exit 0 = the rendered frame matches.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
cd "$root"
LCC="node src/cli/lcc.js"
RUN="scripts/lccrun.sh"
D=experiments/donut
[ -f name.nnn ] || printf 'BANANA\n' > name.nnn

for m in cordic mul render donut; do $RUN $LCC $D/$m.a >/dev/null; done
$RUN $LCC $D/cordic.o $D/mul.o $D/render.o $D/donut.o -o $D/donut.e >/dev/null

# Run with the cap lifted; strip the interpreter banner/trailer.
$RUN 120 $LCC $D/donut.e -ms-1 2>/dev/null \
  | awk 'f{print} /=+ Output/{f=1}' > $D/donut_actual.txt
sed -i -e '${/^$/d}' $D/donut_actual.txt

if diff $D/frame_simple.txt $D/donut_actual.txt >/dev/null; then
  echo "PASS: rendered frame matches frame_simple.txt byte-for-byte."
  cat $D/donut_actual.txt
else
  echo "FAIL: rendered frame differs from frame_simple.txt:" >&2
  diff $D/frame_simple.txt $D/donut_actual.txt | head -40 >&2
  exit 1
fi
