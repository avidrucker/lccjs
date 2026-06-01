# ilcc gap matrix — lccjs vs Charlie's interactive_lccjs

*Research for #389. Inspected 2026-06-01 APPLE.*
*Sources: `src/interactive/ilcc.js` + `iinterpreter.js` (lccjs, 471 lines);*
*`src/interactive/ilcc.js` + `iinterpreter.js` (Charlie, 2405 lines).*

---

## 1. Interactive REPL command surface

| Command | lccjs | Charlie | Notes |
|---------|:-----:|:-------:|-------|
| `h` — help | ✅ | ✅ | |
| `q` — quit | ✅ | ✅ | |
| `{N}` — step forward N | ✅ | ✅ | |
| `{-N}` — step backward N | ✅ | ✅ | both use snapshot log |
| `<enter>` — repeat last step | ✅ | ✅ | |
| `0` — redisplay without stepping | ✅ | ✅ | |
| `a{hex}` — memory base address | ✅ | ✅ | |
| `m{N}` — memory row count | ✅ | ✅ | |
| `s{anchor}` — stack anchor (register or hex) | ✅ | ✅ | both support register-follow and static-hex |
| `c{N}` — code snippet row count | ❌ | ✅ | lccjs has `displayCodeSnippet()` but no `c` command to configure it |
| `l{layout}` — multi-column pane layout | ❌ | ✅ | Charlie: up to 3 columns, panes r/c/m/o; **major UX gap** |

## 2. Display panes

| Pane | lccjs | Charlie |
|------|:-----:|:-------:|
| Register pane | ✅ | ✅ |
| Memory display | ✅ | ✅ |
| Code snippet (source context) | partial (hardcoded 3-row context) | ✅ (configurable via `c{N}`) |
| Stack view | ✅ | ✅ |
| Output pane (separate scrollable region) | ❌ | ✅ (`o` pane in layout) |
| Multi-column layout | ❌ | ✅ (up to 3 columns, `l` command) |

## 3. CLI flags

| Flag | lccjs | Charlie | Description |
|------|:-----:|:-------:|-------------|
| `-e` | ✅ | ✅ | efficient mode (forward-only, disables snapshot) |
| `-c` | ✅ | ✅ | colorblind mode |
| `-d` | ✅ | ✅ | debug mode |
| `-l{hex}` | ✅ | ✅ | load point |
| `-n` | ❌ | ✅ | disable interactive / batch run |
| `-m` | ❌ | ✅ | memory dump at end of run |
| `-r` | ❌ | ✅ | register dump at end of run |
| `-f` | ❌ | ✅ | full line display |
| `-x` | ❌ | ✅ | 4-digit hex output |
| `-t` | ❌ | ✅ | trace mode |
| `-i{N}` | ❌ | ✅ | instruction cap (Charlie default: 50000) |
| `-o` | ❌ | ✅ | specify output file name |

## 4. File format support (interactive)

| Format | lccjs | Charlie |
|--------|:-----:|:-------:|
| `.a` (assemble+run) | ✅ | ✅ |
| `.e` (run direct) | ✅ | ✅ |
| `.bin` (binary machine code) | ❌ | ✅ |
| `.hex` (hex machine code) | ❌ | ✅ |
| `.o` (object module) | ❌ | ❌ |
| `.ap` / `.ep` (LCC+) | ❌ | ❌ |

## 5. Step granularity / history

| Feature | lccjs | Charlie |
|---------|:-----:|:-------:|
| Single-step forward | ✅ | ✅ |
| Multi-step forward (`{N}`) | ✅ | ✅ |
| Backward stepping (`{-N}`) | ✅ | ✅ |
| Last-step memory (repeat on `<enter>`) | ✅ | ✅ |
| Efficient mode (disable snapshot, forward-only) | ✅ | ✅ |

## Gap summary — what Charlie has that lccjs lacks

**Severity: medium** (visible UX impact, missing capability):
- Multi-column pane layout (`l` command + output pane `o`)
- `.bin` / `.hex` file format support

**Severity: low** (useful, not blocking):
- `c{N}` code snippet row configurability
- `-n` non-interactive batch mode
- `-i{N}` instruction cap / auto-halt limit
- `-m` / `-r` end-of-run memory + register dumps
- `-f` full line display, `-x` 4-digit hex, `-t` trace mode

## What lccjs has that Charlie lacks

None identified — lccjs is a functional subset of Charlie's interactive feature set.

## Child tickets filed

- #394 — `l` pane layout + output pane for ilcc (severity:medium)
- #395 — `.bin`/`.hex` input support for ilcc (severity:medium)
- #396 — `c{N}` code snippet row configurability (severity:low)
- #397 — `-n`/`-m`/`-r`/`-i`/`-f`/`-x` CLI flag parity for ilcc (severity:low)
