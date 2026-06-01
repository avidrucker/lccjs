#!/usr/bin/env bash
# claim.sh — shim so npm can't swallow --as/--base flags (#315).
# `npm run claim 307 --as cherry` (no --) lets npm eat the flags before
# claim.js ever sees them. Invoking via bash passes all args straight to
# claim.js's own parseArgs — no -- required.
exec node "$(dirname "$0")/claim.js" "$@"
