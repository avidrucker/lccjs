# TIL 2026-06-01 CHERRY — OG LCC piping support: yes for program I/O, no for source/binary streams

**Issue:** #433

## Summary table

| Operation | stdin=pipe | stdin=/dev/null | Verdict |
|-----------|------------|-----------------|---------|
| Read assembly source from stdin (no filename) | ❌ | ❌ | Not supported — requires filename arg |
| Write assembled `.e` binary to stdout (`-o /dev/stdout`) | ❌ | ❌ | Not supported — OG LCC appends `.e` to any `-o` arg |
| Capture all program output (pipe out) | ✅ | ✅ | Fully supported — everything to stdout |
| `din` — decimal input from pipe | ✅ (reads number) | ✅ (returns 0) | Works |
| `hin` — hex input from pipe | ✅ (reads value) | ✅ (returns 0) | Works |
| `sin` — string input from pipe | ✅ (reads string) | ❌ HANGS | Pipe works; `/dev/null` / EOF hangs |
| `ain` — ASCII char input from pipe | ✅ (reads char) | ✅ (returns 0xFF?) | Works |
| Multiple `din`/`hin` reads in sequence | ✅ | N/A | Newline-separated values all read |

## Key findings

### 1. OG LCC DOES support piped stdin for program I/O

`din`, `hin`, `sin`, and `ain` all read from `process.stdin` when stdin is a pipe. You can script OG LCC programs non-interactively:

```bash
# pipe two numbers as input to a program that reads them with din
printf "10\n20\n" | ~/cuh63/lcc test_add.e
# → 30

# pipe a string as input to a sin-reading program
echo "world" | ~/cuh63/lcc test_sin_proper.e
# → world

# pipe a character as ain input
printf "Z" | ~/cuh63/lcc test_ain.e
# → Z
```

### 2. `sin` hangs on EOF; `din`/`hin`/`ain` handle EOF gracefully

When stdin is `/dev/null` (or a closed pipe with no data):
- `din` returns 0
- `hin` returns 0
- `ain` returns 0xFF (garbage byte)
- `sin` **hangs indefinitely** — the C implementation appears to loop on `fgets` or `scanf` returning NULL/EOF rather than breaking

This means any unattended run of an OG LCC program that calls `sin` must have actual stdin data. `/dev/null` is not safe for `sin`.

### 3. OG LCC does NOT support source-from-stdin or binary-to-stdout

```bash
# No filename → interactive prompt asking for argv
~/cuh63/lcc < test.a
# "Enter command line arguments or hit Enter to quit" → treats piped source as arg string → fails

# -o /dev/stdout → appends ".e" internally → "Cannot open output file /dev/stdout.e"
~/cuh63/lcc test.a -o /dev/stdout
```

The toolchain is file-in / file-out for the assembler stage. Only the program's *runtime* I/O (traps) flows through stdin/stdout.

### 4. All output goes to stdout — no stderr separation

Both diagnostics (`Starting assembly pass 1...`, `====== Output`) and program-generated output (`dout`, `sout`, `aout`) go to the same stdout stream. There is no stderr output. This means you can pipe OG LCC's output to another command but you cannot separate the header/diagnostics from the program output with `2>/dev/null`.

```bash
# This works — pipes entire output (including diagnostics + program output)
~/cuh63/lcc test.a < /dev/null | grep "42"
# → 42
```

### 5. lccrun.sh BREAKS piped stdin — do not use it when piping program input

`scripts/lccrun.sh` runs its command with `setsid "$@" &` (background + new session). In bash scripts, background jobs (`&`) have stdin redirected to `/dev/null` when job control is inactive. This silently drops any piped stdin before the child process can read it.

**Do not use `lccrun.sh` when you need to pipe data into a program.** Call OG LCC directly with `timeout N lcc ...` for timed runs that also accept stdin:

```bash
printf "10\n20\n" | timeout 10 ~/cuh63/lcc test_add.e
```

## What this means for lccjs parity

Filed as a follow-up ARCHITECT ticket — see the filed issue for the decision scope.

The short version: OG LCC's piping behavior sets a clear bar that lccjs should match. The known gap is that lccjs's `din`/`sin` handlers have a bug when stdin is a closed pipe (empty-string retry loop → infinite loop), while OG LCC handles this by returning 0 (for `din`/`hin`) or hanging (for `sin`). Neither is perfect, but OG LCC's behavior is the parity target.
