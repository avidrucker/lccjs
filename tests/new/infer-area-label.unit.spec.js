'use strict';

const path = require('path');
const { inferArea } = require(path.join(__dirname, '..', '..', 'scripts', 'infer-area-label.js'));

// Inference is a heuristic, validated against a table of REAL recent issue
// titles (mirrors how #1012's mock-payload set was validated). The contract:
//   - a confident single lane when one area is the strict top scorer
//   - area:uncategorized when nothing matches OR the match is an ambiguous tie
//   - an existing area:* label is never overridden

describe('inferArea — real recent issue titles infer the right lane', () => {
  const CASES = [
    // [title, expectedArea]
    ['test(linker): update stale old-name strings in linker.unit.spec.js test titles', 'area:toolchain'],
    ['fix(interpreter): add defensive break/return after div/rem zero-divisor guard', 'area:toolchain'],
    ['BUG?: parseObjectModuleBuffer silently accepts an unterminated label — verify vs oracle', 'area:toolchain'],
    ['close.js scope audit shows phantom deletions when branch base is behind origin/main', 'area:process'],
    ['WRITER: skill portability hub doc (agentskills.io; Claude Code and Codex spokes)', 'area:process'],
    ['test(skills): verify puzzle-velocity Hermes skill end-to-end', 'area:process'],
    ['feat(skills): fruit-agent-orchestrate should route runtime-locked tickets', 'area:process'],
    ['feat: add dark mode toggle to the showcase playground', 'area:web'],
    ['docs(lccplus): document the .ap sleep directive for LCC+ programs', 'area:lcc-non-core'],
    ['textbook demo-034 restructuring may have dropped its teaching intent', 'area:education'],
    ['decomplect the interpreter god-object via a pure seam boundary', 'area:architecture'],
    ['SPIKE (ARC): assembler.js state-grouping/god-object — decomposition or defer', 'area:architecture'],
  ];

  test.each(CASES)('%s → %s', (title, expected) => {
    expect(inferArea(title, '', [])).toBe(expected);
  });
});

describe('inferArea — fallback and safety', () => {
  test('no rule matches → area:uncategorized (the unchanged floor)', () => {
    expect(inferArea('bump copyright year in the page footer', '', [])).toBe('area:uncategorized');
  });

  test('an ambiguous tie between two areas → area:uncategorized (conservative bias)', () => {
    // "assembler" (toolchain) and "skill" (process) each score 1 — a wrong lane
    // would hide the issue from the triage sweep, so stay uncategorized.
    expect(inferArea('assembler skill cleanup', '', [])).toBe('area:uncategorized');
  });

  test('a clear winner outscores a single competing keyword', () => {
    // architecture (decomplect, god-object, seam = 3) beats toolchain (interpreter = 1)
    expect(inferArea('decomplect the interpreter god-object via a seam', '', [])).toBe('area:architecture');
  });

  test('TIL tickets infer area:process (the #1244 claim-gate regression)', () => {
    expect(inferArea('TIL: worktree node_modules symlink footgun', '', [])).toBe('area:process');
  });
});

describe('inferArea — never overrides an existing area:* label', () => {
  test('object-form labels: content screams toolchain but area:web is kept', () => {
    expect(inferArea('fix interpreter assembler bug', '', [{ name: 'area:web' }])).toBe('area:web');
  });

  test('string-form labels are honored too', () => {
    expect(inferArea('anything at all', 'body', ['area:education'])).toBe('area:education');
  });

  test('non-area labels do not count as an existing lane', () => {
    expect(inferArea('plain text, no lane signal', '', ['bug', 'enhancement'])).toBe('area:uncategorized');
  });
});

describe('inferArea — acronym word boundaries (no substring false positives)', () => {
  test('\\bISA\\b does not fire inside an unrelated word', () => {
    // "revisal" contains "isa" but must NOT infer area:toolchain
    expect(inferArea('revisal of the onboarding prose', '', [])).toBe('area:uncategorized');
  });

  test('\\bISA\\b fires as a standalone token', () => {
    expect(inferArea('clarify the ISA opcode encoding table', '', [])).toBe('area:toolchain');
  });
});
