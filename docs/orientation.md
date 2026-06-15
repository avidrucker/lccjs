# LCCjs Orientation

Two-minute orientation for new contributors: what the repo contains, how its components relate, and which command to reach for.

---

## Architecture Diagram

LCCjs ships two parallel toolchains. The file extension you start with determines which one applies.

```mermaid
graph TD
    subgraph CoreTC["Core LCC toolchain"]
        A[".a source"] --> Asm["assembler.js\nsrc/core/assembler.js"]
        Asm --> O[".o object module"]
        Asm --> E[".e executable"]
        O --> Lnk["linker.js\nsrc/core/linker.js"]
        Lnk --> E
        E --> Int["interpreter.js\nsrc/core/interpreter.js"]
    end

    subgraph PlusTC["LCC+ toolchain"]
        AP[".ap source"] --> AsmP["assemblerplus.js\nsrc/plus/assemblerplus.js\n(extends Assembler)"]
        AsmP --> EP[".ep executable"]
        EP --> IntP["interpreterplus.js\nsrc/plus/interpreterplus.js\n(extends Interpreter)"]
    end

    subgraph EntryPts["Entry points"]
        CLI["src/cli/lcc.js"] -->|"assemble / link / run"| Asm
        CLI -->|link| Lnk
        CLI -->|run| Int
        PLUS["src/plus/lccplus.js"] -->|"assemble+run"| AsmP
        PLUS --> IntP
        ILCC["src/interactive/ilcc.js"] --> IInt["iinterpreter.js\nsrc/interactive/iinterpreter.js"]
        IInt --> Int
    end

    subgraph Utils["Shared utilities — src/utils/"]
        U["errors.js · fileArtifacts.js\nreportArtifacts.js · hexDisplay.js · ..."]
    end

    subgraph TestLayers["Test layers — tests/new/"]
        T1["*.unit.spec.js\n(fast, no I/O)"]
        T2["*.integration.spec.js\n(in-memory pipelines)"]
        T3["*.oracle.e2e.spec.js\n(needs LCC_ORACLE in .env)"]
        T4["interpreterplus.e2e.spec.js\nlccplus.unit.spec.js\n(LCC+ e2e)"]
    end

    CoreTC & PlusTC -.->|"use"| Utils
    EntryPts -.->|"use"| Utils
```

### Key directories at a glance

| Directory | Contents |
|---|---|
| `src/core/` | Assembler, linker, interpreter — the pure in-memory APIs |
| `src/plus/` | AssemblerPlus + InterpreterPlus (subclass core), `lccplus.js` CLI |
| `src/cli/` | `lcc.js` — orchestration only (option parsing, assemble/link/run dispatch) |
| `src/interactive/` | `-i` step-debugger (`ilcc.js` + `iinterpreter.js`) |
| `src/utils/` | Shared concerns: typed errors, artifact naming, hex display, report generation |
| `src/browser/` | Webpack bundle API (`api.js`, `lcc-worker.js`, `lcc-injector.js`) |
| `src/extra/` | Optional tools: `disassembler.js`, `linkerStepsPrinter.js` |
| `tests/new/` | All test suites (unit, integration, oracle e2e, LCC+ e2e) |
| `plusdemos/` | Playable `.ap` demo programs (snake, flappy bird, tic-tac-toe, …) |

---

## User-Flow Decision Tree

```mermaid
flowchart TD
    Start([What do you want to do?])

    Start --> Setup["First-time setup\nnpm install && npm run setup"]
    Start --> HasFile{What file type\ndo you have?}
    Start --> Testing{Run which tests?}
    Start --> Demo["Play a demo game\nnode src/plus/lccplus.js plusdemos/&lt;game&gt;.ap"]
    Start --> Slides["Build reveal-md slides\nsee docs/guides/reveal-md-lcc-slides.md"]

    HasFile -->|".a source"| AsmQ{Assemble only\nor also run?}
    HasFile -->|".ap source (LCC+)"| RunAP["node src/plus/lccplus.js &lt;file&gt;.ap"]
    HasFile -->|".e pre-built binary"| RunE["node src/cli/lcc.js &lt;file&gt;.e"]
    HasFile -->|".o object files to link"| Link["node src/core/linker.js m1.o m2.o"]

    AsmQ -->|"Assemble + run"| AsmRun["node src/cli/lcc.js &lt;file&gt;.a"]
    AsmQ -->|"Assemble only"| AsmOnly["node src/core/assembler.js &lt;file&gt;.a"]
    AsmQ -->|"Step-debug interactively"| Debug["node src/interactive/ilcc.js &lt;file&gt;"]

    Testing -->|"Primary suite"| TestPrim["npm test"]
    Testing -->|"Full suite (includes slow tests)"| TestAll["npm run test:all"]
    Testing -->|"Oracle parity"| TestOracle["Set LCC_ORACLE in .env\nnpm run test:oracle"]
```

### Quick-reference command table

| Goal | Command |
|---|---|
| First-time setup | `npm install && npm run setup` |
| Assemble + run a `.a` file | `node src/cli/lcc.js <file>.a` |
| Assemble only | `node src/core/assembler.js <file>.a` |
| Run a pre-built `.e` binary | `node src/cli/lcc.js <file>.e` |
| Link object files | `node src/core/linker.js m1.o m2.o` |
| Assemble + run a `.ap` file (LCC+) | `node src/plus/lccplus.js <file>.ap` |
| Step-debug interactively (TUI) | `node src/cli/lcc.js -i <file>` (or `ilcc.js <file>`) |
| Step-debug, OG/textbook style | `node src/cli/lcc.js -d <file>.e` |
| Learn the two debuggers (`-d` vs `-i`) | see `docs/guides/debuggers.md` |
| Play a demo game | `node src/plus/lccplus.js plusdemos/<game>.ap` |
| Run primary test suite | `npm test` |
| Run full test suite (slow) | `npm run test:all` |
| Run oracle parity tests | set `LCC_ORACLE` in `.env`, then `npm run test:oracle` |
| Create reveal-md slides with live LCC code blocks | see `docs/guides/reveal-md-lcc-slides.md` |
