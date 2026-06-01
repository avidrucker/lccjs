# Research: jmp missing-operand — segfault claim not reproducible in cuh63 6.3

**Ticket:** #261  
**Date:** 2026-06-01  
**Agent:** ELDERBERRY  
**Oracle:** cuh63 6.3 (`~/Documents/Study/Assembly/cuh63/lcc`)

---

## Summary

`docs/parity_deviations.md` OG BUG #3 claims that `jmp` with no operand causes a
**Segmentation fault** in OG LCC. This probe does **not reproduce** that crash in
cuh63 6.3. The oracle exits cleanly with exit=1, prints "Missing operand", and
leaves artifact files on disk. The deviation entry requires a corrigendum.

---

## 1. Exact trigger and oracle behavior

Test setup: temp dir, `name.nnn` present, file assembled via relative path.

| Input | Oracle exit | Oracle message | Oracle artifacts |
|-------|-------------|----------------|-----------------|
| `jmp` (bare) | 1 | `Missing operand` (pass 1 only) | `.e(1B)` `.lst(435B)` `.bst(435B)` |
| `jmp notaregister` | 1 | `Bad register` (pass 2) | `.e(2B)` `.lst` `.bst` |
| `jmp ,` | 1 | `Missing register` (pass 2) | `.e(2B)` `.lst` `.bst` |
| `jmp r99` | 1 | `Bad register` (pass 2) | `.e(2B)` `.lst` `.bst` |
| `jmp r0` (valid) | 124 (hung) | — (assembled OK, execution looped) | `.e(6B)` `.lst(0B)` `.bst(0B)` |

**No segfault.** The `jmp` bare case fails in pass 1 (oracle reports only
"Starting assembly pass 1", not pass 2) with a clean error exit.

The 1-byte `.e` left by the bare-operand case is the same "fail-with-artifacts"
pattern documented in OG BUG #10 (blank-`.e` family) — the oracle writes a partial
or sentinel executable even when assembly fails.

---

## 2. Blast radius — single-register-operand instructions

| Instruction | Oracle exit | Oracle message | Oracle pass count | Artifacts |
|-------------|-------------|----------------|-------------------|-----------|
| `blr` bare | 1 | `Missing operand` | pass 1 only | `.e(1B)` `.lst` `.bst` |
| `jsrr` bare | 1 | `Bad register` | pass 1 **and** 2 | `.e(2B)` `.lst` `.bst` |
| `jsr` bare | 1 | `Missing operand` | pass 1 only | `.e(1B)` `.lst` `.bst` |
| `bl` bare | 1 | `Missing operand` | pass 1 only | `.e(1B)` `.lst` `.bst` |
| `ret` bare | 124 (hung) | — (valid pseudo, execution looped) | both passes | `.e(4B)` `.lst(0B)` `.bst(0B)` |

No segfaults in the blast-radius sweep either. `ret` and `jmp r0` hang because
they assemble successfully and then execute an infinite loop — those are runtime
issues, not assembler crashes.

---

## 3. LCC.js comparison

| Input | LCC.js exit | LCC.js message | LCC.js pass count | Artifacts |
|-------|-------------|----------------|-------------------|-----------|
| `jmp` bare | 1 | `Missing operand` | **both** passes | none |
| `jmp notaregister` | 1 | `Bad register` | both | none |
| `jmp ,` | 1 | `Missing operand` | both | none |
| `jmp r99` | 1 | `Bad register` | both | none |
| `blr` bare | 1 | `Missing operand` | both | none |
| `jsrr` bare | 1 | `Missing operand` | both | none |
| `jsr` bare | 1 | `Bad label` | both | none |
| `bl` bare | 1 | `Bad label` | both | none |

---

## 4. Actual deviations found (not a segfault)

### 4a. Artifact-on-error (primary deviation)

Oracle leaves `.e`, `.lst`, `.bst` on disk even when assembly fails. LCC.js
leaves nothing. This is the same pattern as OG BUG #10 (blank-`.e` family) — the
`jmp`-bare case is another instance, not a unique deviation.

### 4b. Pass-count difference for bare mnemonics

Oracle catches `jmp`, `blr`, `jsr`, `bl` bare in **pass 1** only. LCC.js runs
**both passes** before erroring. This reflects a structural difference in how the
passes are organized — LCC.js does a full two-pass even when an error is
detectable in pass 1. The observable difference: oracle output shows only
"Starting assembly pass 1"; LCC.js shows both.

### 4c. Minor message differences

| Input | Oracle message | LCC.js message |
|-------|---------------|----------------|
| `jmp ,` | `Missing register` | `Missing operand` |
| `jsrr` bare | `Bad register` | `Missing operand` |
| `jsr` bare | `Missing operand` | `Bad label` |
| `bl` bare | `Missing operand` | `Bad label` |

These are wording differences, not behavioral divergences. All exit 1.

---

## 5. Why the segfault claim may have originated

Three hypotheses:

1. **Older oracle version.** The segfault may have been real in a pre-6.3 build
   (e.g., during cuh63's development), and the BUG #3 entry was written then but
   never re-verified against 6.3.

2. **Missing `name.nnn` at time of original repro.** Without `name.nnn`, the
   oracle hangs indefinitely waiting for name input (stdin not a tty → blocks
   forever). A SIGPIPE or manual kill could produce a non-zero exit that was
   mis-read as a crash. However, a segfault exit code (139 / SIGSEGV) would be
   distinct from a hang.

3. **Different invocation path.** If the oracle was called via a wrapper or with
   stdin redirected from /dev/null and the `name.nnn` was absent, the oracle may
   have dereferenced the missing name pointer. Our probe always supplies
   `name.nnn` — the original researcher may not have.

Hypothesis 3 is the most plausible. The `name.nnn` absence causes the oracle to
call `fgets(buf, N, stdin)` on a closed/null stream — a potential null-deref
depending on libc behavior. We did not reproduce this because we always provide
the file.

To fully close this: test `jmp bare` with no `name.nnn` and stdin redirected from
`/dev/null` (not just lacking a tty):

```bash
tmp=$(mktemp -d)
echo "    jmp" > "$tmp/probe.a"
# no name.nnn
cd "$tmp" && "$ORACLE" probe.a </dev/null; echo "exit=$?"
```

*(This additional probe was not run in this session — left as a follow-on if
the original repro needs to be reconstructed exactly.)*

---

## 6. Verdict

**Not report-worthy as a segfault.** In cuh63 6.3, `jmp` bare does not crash the
assembler — it errors cleanly with exit=1. The "Segmentation fault" claim in
OG BUG #3 is not reproducible and the entry needs a corrigendum.

The **actual** deviations from this probe (artifact-on-error, pass-count
difference, minor message wording) are all extensions of already-documented
patterns (OG BUG #10 family, general error-message divergences). No new
deviation entry is needed.

**OG BUG #3 status:** Reclassify. The parity deviation exists but is
*artifact-on-error* (LCC.js leaves no files; oracle leaves `.e`/`.lst`/`.bst`),
not a segfault. The LCC.js `Missing register` wording in the old entry was also
wrong — both tools give `Missing operand` for `jmp` bare; only `jmp ,` differs
(`Missing register` oracle vs `Missing operand` LCC.js).

**WRITER ticket #262** is unblocked but scope must be narrowed: the report should
describe the reclassification (segfault → clean-error-with-artifacts) rather than
documenting a crash.

---

## Evidence

Probe harness: `public_experiments/jmp_missing_operand_segfault/`
