# Test Fixture: Decision — Choose Serialization Format for LCC+ State

**Labels:** `humans-only` `decision` `area:architecture` `area:plus`
**Test purpose:** Fixture for `guide-human-decision` Hermes skill end-to-end verification (#1079, unblocked by #1376)

---

## Context

We need to persist LCC+ interpreter state for checkpoint/restore functionality. The LCC+ interpreter (`InterpreterPlus`) maintains memory, registers, program counter, key queue, random seed, and screen manipulation state. A checkpoint/restore mechanism would allow saving and resuming long-running `.ap` programs (games, simulations) across sessions.

This decision affects:
- `.ep` file format (may need extension for metadata)
- Runtime dependencies (zero-dep rule is non-negotiable per `CLAUDE.md`)
- Performance of checkpoint/restore operations
- Human readability for debugging

---

## Decision Points

### 1. Serialization Format

**Question:** What binary format should encode the interpreter state for checkpoint files?

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A: JSON** | Plain JSON with typed fields | Human-readable, zero dep, easy debugging | Larger files, slower parse/write, no binary data (base64 for memory) |
| **B: MessagePack** | Compact binary JSON-like | Smaller, faster, schema-less | Requires `msgpackr` or similar dep (violates zero-dep rule) |
| **C: Custom binary** | Hand-rolled 16-bit word stream (LCC-native) | Zero dep, fastest, matches ISA word size, compact | Not human-readable, custom parser needed, versioning complexity |

**Constraint:** Zero runtime dependencies (CLAUDE.md). Option B is disqualified unless a <200 LOC hand-rolled MessagePack subset is acceptable.

---

### 2. Checkpoint Granularity

**Question:** How much state to capture per checkpoint?

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A: Full memory dump** | Entire 64K memory + all registers + PC + seed + queues every N steps | Simple, exact restore | Large (64KB + overhead), slow for frequent checkpoints |
| **B: Diff-based incremental** | Base snapshot + only changed memory words + register deltas | Smaller for small changes, faster writes | Complex implementation, must track dirtied addresses, base snapshot still large |
| **C: Key-register only** | Only r0–r7, PC, SP, seed, keyQueue, screenManipulated flag | Tiny (≈100 bytes), instant | Cannot restore arbitrary memory state (heap, stack, program data) |

**Trade-off:** Option C only works for programs that don't use heap/stack (pure register machines). Most `.ap` programs use memory for data.

---

### 3. Restore Validation

**Question:** How to verify a restored checkpoint matches the saved state?

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A: Hash comparison** | SHA-256 of full memory + register state at save; verify on restore | Detects any corruption/bit-rot | Requires hash implementation (Web Crypto API in browser, crypto module in Node — adds code) |
| **B: Step-count verification** | Record step counter at save; on restore, run N steps and compare PC/memory at checkpoints | No extra deps, catches execution divergence | Only detects divergence after N steps, not immediate |
| **C: No validation (trust)** | Assume restore works; if corrupted, program crashes visibly | Zero overhead, simplest | Silent corruption possible, debugging harder |

---

## Related Issues / Context

- Parent verification: #1079
- Tracker: #1065 (8 Hermes skill conversions)
- Runtime: Hermes-only — `guide-human-decision` skill uses `skill_view()`, `terminal` + `gh`
- Zero-dep rule: `CLAUDE.md` §1

---

## Test Metadata

This fixture is consumed by the `guide-human-decision` Hermes skill during its end-to-end verification (#1079). The skill should:

1. Load this fixture as the "issue body"
2. Surface **3 separate decision points** (not bundled)
3. Accept simulated human decisions for each
4. Post rulings as comments, file implementation tickets for chosen options
5. Verify the workflow completes without errors

**Expected decision point count: 3**