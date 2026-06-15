# Teacher/Student Guide: `lcc --test` Assignment Test Runner

LCC.js includes a built-in assignment test runner for teachers and students to verify
assembly programs against expected input/output behavior — **no Jest, no extra deps,
just `lcc --test spec.json`**.

---

## Quick Start

```
# 1. Write your program (e.g., sort.a)
# 2. Create a test spec (sort.spec.json)
# 3. Run:  node src/cli/lcc.js --test sort.spec.json
```

**Exit codes (CI-friendly):**
- `0` — every test case passed
- `1` — one or more cases failed (output mismatch, timeout, exit-code mismatch)
- `2` — spec could not be run (malformed JSON, missing program file, format error)

---

## Spec Formats

The runner accepts **two formats**, auto-detected by **content** (not file extension):

| Format | Best for | Detection |
|--------|----------|-----------|
| **JSON** | Machine-generated specs, CI, `--record` replay | First non-whitespace char is `{` |
| **Fenced literal-block** | **Students hand-authoring** specs | Anything else (starts with `program:`) |

Both parse to the **same internal object**, so the runner core is format-agnostic.

---

### Format 1: JSON (interchange / machine)

```json
{
  "program": "sort.a",
  "tests": [
    {
      "name": "sorts three numbers",
      "input": "3 1 2\n",
      "expected_output": "1 2 3\n",
      "exit_code": 0,
      "timeout_sec": 10
    },
    {
      "name": "empty input",
      "input": "",
      "expected_output": "",
      "exit_code": 0
    }
  ]
}
```

**Fields:**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `program` | yes | string | Path to `.a` source, relative to **spec file's directory** |
| `tests` | yes | array | At least one test case |
| `tests[].name` | no | string | Human label (shown in output) |
| `tests[].input` | yes | string | **Literal stdin** — include trailing `\n` if the program expects it |
| `tests[].expected_output` | yes | string | **Expected stdout** — normalized (CRLF→LF, single trailing newline dropped) |
| `tests[].exit_code` | no | integer | If present, runner asserts exact exit code (default: no assertion) |
| `tests[].timeout_sec` | no | number | Max seconds per case (default: 10) |

---

### Format 2: Fenced Literal-Block (human-authoring / **recommended for students**)

Paste multi-line stdin/stdout **verbatim — no escaping, no quote/whitespace issues**.

```
program: sort.a

test: sorts three numbers
exit: 0
timeout: 10
--- input ---
3 1 2
--- expected ---
1 2 3
--- end ---

test: empty input
--- input ---
--- expected ---
--- end ---
```

**Grammar:**

| Line | Role |
|------|------|
| `program: <path>` | Required file header — resolved relative to spec file |
| `test: <name>` | Starts a case; `<name>` optional |
| `exit: <int>` | Optional case metadata |
| `timeout: <positive>` | Optional case metadata |
| `--- input ---` | Starts literal stdin block (verbatim, no escaping) |
| `--- expected ---` | Starts literal expected-stdout block |
| `--- end ---` | Closes the case |

**Rules:**
- Everything between delimiters is **literal** — newlines, spaces, prompts preserved
- Each content line contributes `line + "\n"` (so `3 1 2` → `"3 1 2\n"`)
- Empty block → empty string `""`
- Delimiters (`--- input ---`, etc.) are structural **only when alone on a line at column 0**
- An indented `  --- end ---` is literal content, not a delimiter

---

## How It Works (Key Behaviors Teachers Should Know)

### 1. Name prompt determinism (`name.nnn`)
LCC prompts for an author name on first run and writes `name.nnn` in the program directory.
The test runner **pre-seeds `TestUser\n`** into `name.nnn` before running cases so the
prompt never silently eats the first line of a case's stdin. **If a `name.nnn` already
exists, the runner leaves it alone** — students' names are preserved.

### 2. Output isolation
A default `lcc` run prints a toolchain banner before the program's own output:
```
Starting assembly pass 1...
...
====================================================== Output
<program stdout here>
```
The runner **slices after the `===... Output` marker** so `expected_output` only
needs the program's actual stdout, not the banner.

### 3. Output normalization
Before comparing, both actual and expected are normalized:
- CRLF (`\r\n`) → LF (`\n`)
- **Single trailing newline dropped** — so `"1 2 3\n"` equals `"1 2 3"`

Extra/internal blank lines stay significant.

### 4. Fresh assembly per case
Each test case **re-assembles and re-executes from scratch** — no state bleeds
between cases. The program file is read fresh each time.

### 5. Timeout handling
Default: 10 seconds per case. Set `timeout_sec` per case or in fenced format.
On timeout, runner prints: `FAIL  <name>  (timed out after 10s)`

---

## Example: Complete Teacher/Student Workflow

### Teacher creates `examples/sort.a`:
```asm
; Sort three numbers from stdin
SIN R1          ; read first
SIN R2          ; read second
SIN R3          ; read third
; ... bubble sort logic ...
SOUT R1
SOUT R2
SOUT R3
HLT
```

### Teacher creates `examples/sort.spec.json`:
```json
{
  "program": "sort.a",
  "tests": [
    {
      "name": "descending to ascending",
      "input": "3 1 2\n",
      "expected_output": "1 2 3\n"
    },
    {
      "name": "already sorted",
      "input": "1 2 3\n",
      "expected_output": "1 2 3\n"
    },
    {
      "name": "duplicates",
      "input": "2 2 1\n",
      "expected_output": "1 2 2\n"
    }
  ]
}
```

### Student runs (from repo root):
```bash
node src/cli/lcc.js --test examples/sort.spec.json
```

### Output:
```
PASS  descending to ascending
PASS  already sorted
PASS  duplicates
3 passed, 0 failed
```
Exit code: `0` ✅

### If a case fails:
```
PASS  descending to ascending
FAIL  already sorted  (output mismatch)
      first diff at line 1:
        expected: "1 2 3"
        actual:   "3 2 1"
PASS  duplicates
2 passed, 1 failed
```
Exit code: `1` ❌

---

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Missing trailing `\n` in `input` | Program hangs on `SIN` | Add `\n` to each `input` string |
| Expected output includes banner | Mismatch on `Starting assembly...` | Only include program's stdout (after `=== Output`) |
| `name.nnn` already exists with student's name | Tests pass (runner preserves it) | No action needed — this is correct |
| Spec path wrong | Exit 2: `Test-runner program not found` | `program` is relative to **spec file's directory**, not CWD |
| Fenced delimiter collision | Parser error on `--- end ---` | Use longer fence (future) or ensure output doesn't contain exact delimiter line |
| JSON escaping pain | `\"` `\\` `\n` in expected_output | Use fenced format instead — literal blocks |

---

## CI Integration

```yaml
# .github/workflows/test-assignments.yml
- name: Run assignment tests
  run: |
    node src/cli/lcc.js --test assignments/lab1/sort.spec.json
    node src/cli/lcc.js --test assignments/lab2/stack.spec.json
  # Exit codes: 0=all pass, 1=some fail, 2=spec error
```

---

## File Locations

| What | Where |
|------|-------|
| Spec loader (JSON + fenced) | `src/testrunner/specLoader.js` |
| Runner core (spawns, classifies) | `src/testrunner/runner.js` |
| CLI `--test` surface | `src/cli/lcc.js` lines 208–317, 409–421 |
| E2E tests | `tests/new/lcc.test-mode.e2e.spec.js` |
| Format research | `docs/research/1103-spec-format-recommendation.md` |

---

## For Students: Which Format Should I Use?

**Use the fenced format.** It's designed for you:
- Paste program runs directly — no escaping
- Readable in any text editor
- No JSON syntax errors

**Use JSON when:**
- Generating specs programmatically (future `--record`)
- CI pipelines that consume machine output
- You prefer JSON and don't mind escaping

---

*Generated from `lcc --test` implementation (issues #1044, #1090–#1094).*