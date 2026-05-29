#!/usr/bin/env bash
# Probe for #145: compare .lst / .bst report artifacts across the 2x2 matrix
#   { oracle LCC, lccjs } x { run on .a (assemble+interpret), run on .e (interpret) }
# Snapshots all 8 artifacts and diffs the oracle-vs-lccjs pairs.
#
# Usage:  experiments/debugger-report-parity-probe.sh [path/to/demo.a]
# Requires: LCC_ORACLE in .env (or env), node.
set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
ORACLE="${LCC_ORACLE:-$(grep -E '^LCC_ORACLE=' "$REPO/.env" 2>/dev/null | cut -d= -f2-)}"
DEMO="${1:-$REPO/textbook_demos/ch03-assembly-basics/demo-009-static-linked-list.a}"

[ -x "$ORACLE" ] || { echo "oracle not executable: $ORACLE"; exit 1; }
[ -f "$DEMO" ]   || { echo "demo not found: $DEMO"; exit 1; }

T="$(mktemp -d)"
echo "probe dir: $T"
echo "oracle:    $ORACLE"
echo "demo:      $DEMO"
printf 'TestUser\n' > "$T/name.nnn"

run() {  # run <label> <cwd> -- <cmd...>   (captures stdout+stderr+exit)
  local label="$1" cwd="$2"; shift 3
  ( cd "$cwd" && "$@" >"$T/$label.out" 2>&1; echo "$?" > "$T/$label.exit" )
  printf '  %-22s exit=%s\n' "$label" "$(cat "$T/$label.exit")"
}
snap() { [ -f "$T/d.$1" ] && cp "$T/d.$1" "$T/$2.$1" || echo "    (no d.$1 produced)"; }

echo "── ORACLE on .a ──"
cp "$DEMO" "$T/d.a"
run oracle_a "$T" -- "$ORACLE" d.a
snap e oa; snap lst oa; snap bst oa
cp "$T/oa.e" "$T/d.e" 2>/dev/null

echo "── ORACLE on .e ──"
rm -f "$T/d.lst" "$T/d.bst"
run oracle_e "$T" -- "$ORACLE" d.e
snap lst oe; snap bst oe

echo "── lccjs on .a (lcc.js) ──"
rm -f "$T"/d.e "$T"/d.lst "$T"/d.bst
cp "$DEMO" "$T/d.a"
run lccjs_a "$T" -- node "$REPO/src/core/lcc.js" d.a
snap e la; snap lst la; snap bst la

echo "── lccjs on .e (interpreter.js) ──"
rm -f "$T/d.lst" "$T/d.bst"
cp "$T/la.e" "$T/d.e" 2>/dev/null
run lccjs_e "$T" -- node "$REPO/src/core/interpreter.js" d.e
snap lst le; snap bst le

echo
echo "════════ artifact presence ════════"
for f in oa.lst oa.bst oe.lst oe.bst la.lst la.bst le.lst le.bst; do
  if [ -f "$T/$f" ]; then printf '  %-8s %6s bytes\n' "$f" "$(wc -c <"$T/$f")"; else printf '  %-8s MISSING\n' "$f"; fi
done

echo
echo "════════ diffs (oracle vs lccjs) ════════"
dpair() {  # dpair <human> <oracle-file> <lccjs-file>
  echo "──── $1 ────"
  if [ ! -f "$T/$2" ] || [ ! -f "$T/$3" ]; then echo "  (one side missing — see presence table)"; return; fi
  diff -u "$T/$2" "$T/$3" | sed -n '1,60p' || true
}
dpair "LST on .a   (oa.lst vs la.lst)" oa.lst la.lst
dpair "BST on .a   (oa.bst vs la.bst)" oa.bst la.bst
dpair "LST on .e   (oe.lst vs le.lst)" oe.lst le.lst
dpair "BST on .e   (oe.bst vs le.bst)" oe.bst le.bst

echo
echo "kept in: $T"
