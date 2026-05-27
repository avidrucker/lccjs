# Research: aidanod3/web_ilcc (WebLCC)

**Date:** 2026-05-27  
**Repo:** https://github.com/aidanod3/web_ilcc  
**Authors:** Aidan O'Donnell (aidanod3) and team — SUNY New Paltz Assembly course project  
**Purpose:** Identify which features/patterns from this web IDE could be brought into `lccjs`.

---

## What is web_ilcc?

A web-based LCC IDE and autograder built for the SUNY New Paltz assembly language course. It has two main goals:

1. **Web IDE** — In-browser LCC assembly editor, runner, and step debugger (React + CodeMirror)
2. **Autograder** — Automated student submission grading against expected output (FastAPI)

Both paths use the same JavaScript LCC emulator core.

---

## Repository Structure

```
web_ilcc/
├── package.json                         # Root workspace; starts both servers concurrently
├── weblcc/                              # React 18 + Vite 7 frontend
│   └── src/
│       ├── App.jsx                      # Router: / → /ilcc (IDE), /autograder
│       ├── pages/
│       │   ├── Ilcc.jsx                 # ~3,037 lines — in-browser IDE + debugger
│       │   └── Autograder.jsx
│       ├── components/
│       └── hooks/
├── backend/
│   ├── weblcc-backend/
│   │   ├── server.js                    # Express 4 — trace session API + /api/run
│   │   └── package.json
│   ├── autograder-backend/
│   │   ├── main.py                      # FastAPI — runs student code, compares output
│   │   └── test_api.py
│   └── emulator/
│       └── src/core/                    # Copy of LCC.js emulator
│           ├── assembler.js
│           ├── interpreter.js
│           ├── linker.js
│           └── lcc.js
└── docs/
    └── system-architecture.png
```

**Tech stack:**
- Frontend: React 18, Vite 7, CodeMirror 6, react-resizable-panels, react-router-dom
- Backend API: Node.js, Express 4
- Autograder: Python 3, FastAPI, uvicorn
- Testing: Jest

---

## Features That Exist and Work

### 1. Stateful Trace Session API (`backend/weblcc-backend/server.js`)

**The most valuable pattern for lccjs.** Exposes a REST API for step-by-step debugging:

| Endpoint | Description |
|---|---|
| `POST /api/run` | Assemble + execute source, return stdout/stderr/exitCode |
| `POST /api/trace/sessions` | Create a debug session (assemble + load into interpreter) |
| `GET /api/trace/sessions/:id/state` | Read current machine state snapshot |
| `POST /api/trace/sessions/:id/step` | Execute N instructions (1–500 max), return snapshot |
| `POST /api/trace/sessions/:id/continue` | Run to halt (max 20,000 steps) |
| `POST /api/trace/sessions/:id/reset` | Reinitialize interpreter to initial state |
| `DELETE /api/trace/sessions/:id` | Cleanup session |
| `POST /api/trace` | (Deprecated) Full trace array return |

**Session lifecycle:**
- Sessions stored in in-memory `Map` with 30-minute TTL; swept every 5 minutes
- Session create: assembles source → loads into interpreter → builds address map from listing
- Each step returns a **machine state snapshot** (see below)

**Machine state snapshot fields:**
```json
{
  "lineNumber": 3,
  "sourceLine": "  mvi r0, 5",
  "nextLine": "  dout",
  "pc": 4,
  "ir": 61442,
  "mnemonic": "HALT",
  "registers": {
    "r0": 5, "r1": 0, "r2": 0, "r3": 0, "r4": 0,
    "fp": 0, "sp": 0, "lr": 0
  },
  "flags": { "N": 0, "Z": 0, "P": 0, "C": 0, "V": 0 },
  "stack": [...],       // 16 words around SP
  "memory": [...],      // 32 cells centered on SP or configurable address
  "decodedInstruction": { ... }
}
```

**Key insight: PC → source-line map.** When a session is created, the server builds an `addressMap` from the assembler's listing output — mapping each PC address to its source line. This is exactly what `lccjs` needs for the `-t` trace flag (see scope ticket #77).

### 2. In-Browser LCC VM (`weblcc/src/pages/Ilcc.jsx`, ~3,037 lines)

Implements the full LCC pipeline client-side:
- `buildContext()` — parse and assemble source
- `createMachine()` / `cloneMachine()` — initialize VM state
- `stepMachine()` — execute one instruction
- `explainInstructionLine()` — human-readable instruction explanation

Features:
- Breakpoints (click line gutter → toggle)
- Timeline playback (step history navigation)
- Terminal I/O (simulated stdin via UI)
- Dark/light theme system with color tokens
- Resizable split-pane layout (react-resizable-panels)

**Notable:** The frontend duplicates emulator logic vs. the backend server. Divergence risk — changes to the emulator must be applied in both places.

### 3. Autograder (`backend/autograder-backend/main.py`)

- Student submits source code + expected output
- FastAPI writes to `/tmp/code.a` → runs `node lcc.js /tmp/code.a` (5-second timeout)
- Compares actual vs expected stdout
- Returns `{ success, actual_output, match, errors }`

**Known limitations:**
- Only supports `.a` files (TODO in code for `.bin`/`.hex`)
- `/tmp/code.a` is a shared path — NOT safe for concurrent submissions
- Python backend noted as deprecated in issue #25; Node.js replacement implied

---

## Open Issues (19 total)

### High Priority
| # | Title | Summary |
|---|---|---|
| #26 | SAML SSO via passport-saml | Protect dashboard behind SUNY New Paltz Azure AD SSO; JWT in httpOnly cookie |
| #27 | Student lab workflow | Upload → select lab/question → check → submit → download Brightspace zip |
| #28 | TA grading dashboard | CRUD assignments, submissions table, diff view, bulk zip; all behind SSO |

### Low Priority
| # | Title | Summary |
|---|---|---|
| #24 | Shared nav + pop-out panels + UX | Navbar, draggable floating windows, multi-file tabs, toasts, tooltips |
| #25 | Update docs + README | `.env.example`, `API.md`, `ARCHITECTURE.md`; deprecate Python autograder |

### Research
| # | Title |
|---|---|
| #29 | Which code editor for syntax highlighting? (CodeMirror 6 vs Monaco vs Ace) |
| #30 | Pop-in/pop-out panel implementation approach |
| #31 | File storage strategy for submission zips |

### Ideas (no assignees)
| # | Title |
|---|---|
| #33 | Debugger breakpoints (click gutter, run-to-breakpoint) |
| #34 | Real-time collaborative editing (Yjs) |
| #35 | Export debug session as animated GIF/video |
| #36 | Bulk lab import from Solutions.zip |

---

## What web_ilcc Does Better / Differently Than lccjs

| Area | web_ilcc | lccjs |
|---|---|---|
| Step debugger API | ✅ REST API with sessions, step, continue, reset | ❌ No API (CLI only) |
| PC→source-line map | ✅ Built from listing output in session create | ❌ Missing (needed for `-t` trace, issue #77) |
| Web IDE | ✅ React IDE with CodeMirror, breakpoints, timeline | ❌ CLI only |
| Autograder | ✅ FastAPI endpoint comparing output | ❌ None |
| Machine state snapshots | ✅ Per-step JSON: registers, flags, stack, memory | ❌ None |
| Input buffering | ✅ Client passes `input` string on step/continue | ✅ `inputBuffer` in `executeBuffer()` |
| Concurrent safety | ❌ `/tmp/code.a` collision risk | ✅ In-memory (no temp files) |
| Oracle parity | ❌ No oracle tests | ✅ Direct oracle binary e2e tests |
| `.bst`/`.lst` generation | ✅ Yes | ✅ Yes |

---

## Key Patterns / Techniques Worth Borrowing

### A. PC → Source-Line Map Construction

The most actionable insight from web_ilcc for lccjs:

When a trace session is created, the server parses the assembler's listing (`.lst`) output to build an `addressMap`:
```
address (number) → { sourceLine, lineNumber }
```

This lets the trace API return human-readable source text for each PC location. This is exactly the mechanism needed for lccjs's `-t` flag (scope ticket #77). Instead of parsing the .lst file (which doesn't exist before execution in lccjs), lccjs should have the assembler produce this map directly during pass 2.

### B. Machine State Snapshot Schema

The snapshot schema (registers + flags + stack + memory + decoded instruction + source line) is a well-designed, complete representation of interpreter state. If lccjs ever needs a debug API or REPL, this schema is a good starting point.

### C. Concurrent-Safe Execution

web_ilcc's `/api/run` spawns a child process (no shared in-process state), while trace endpoints use in-process interpreter with session IDs. lccjs's `executeBuffer()` API is naturally stateless per call, which would translate cleanly into a concurrent-safe `/api/run` equivalent.

---

## What web_ilcc Has That lccjs Might NOT Need

- SAML/SSO authentication — university-specific, not needed for Charlie's use case
- Brightspace zip download — institution-specific grading workflow
- React frontend — out of scope for lccjs (lccjs is a CLI tool)
- Python autograder — superseded by Node.js approach anyway
- Real-time collaboration — nice idea, far-future

---

## Summary Assessment

**web_ilcc is a downstream integration project**, not a development of new LCC features per se. Its most valuable contribution is:
1. **The PC→source-line map construction pattern** (directly actionable for lccjs `-t` flag)
2. **The step session API design** (useful if lccjs ever grows a programmatic debug API)
3. **The machine state snapshot schema** (comprehensive and well thought-out)

The web frontend, autograder, and SSO work are institution-specific and don't need to flow back into lccjs.

---

## See Also

- [`docs/research/ilcc-interactive_lccjs.md`](ilcc-interactive_lccjs.md) — Charlie's interactive debugger (higher priority for lccjs)
- Issue #77 — `-t` trace flag scope ticket (PC→source-line map needed)
- Issue #69 — Symbolic debugger parity scope ticket
