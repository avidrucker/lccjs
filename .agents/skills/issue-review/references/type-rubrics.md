# Type-Specific Issue Rubrics

Apply only the section matching the issue type identified in `SKILL.md`.

## `bug`

Required checks:

- Reproduction steps: exact commands or sequence to trigger the bug.
- Observed behavior: error text, wrong output, silence, or other actual result.
- Expected behavior: the correct behavior or output.
- Affected files: where the defective logic likely lives.

Recommended checks:

- Environment details when relevant.
- Regression link or suspected introducing change.
- Minimal reproducer.
- Fix constraints or known forbidden approaches.

Diagnostic questions:

- Without reproduction steps: "What sequence triggers this?"
- Without observed behavior: "What does the failure actually look like?"
- Without expected behavior: "What should happen instead?"
- Without affected files: "Where should the agent start looking?"

Red flags:

- Symptoms with no reproduction path.
- "Fix the bug" with no bug description.
- Expected behavior is only "it should work."

## `dev`

Required checks:

- Have/Should-have framing: current state and desired state are distinct.
- Acceptance criteria: verifiable close conditions.
- Affected files named.
- Role tag or label clearly identifies implementation work.

Recommended checks:

- H/C or time estimate.
- Dependency chain such as "Blocks #N" or "Blocked by #N".
- Out-of-scope section.
- No unresolved architecture decision left to the implementor.

Diagnostic questions:

- Without acceptance criteria: "How do I know when this is done?"
- Without file names: "Which files should I modify?"
- Without scope boundary: "Does this include docs, tests, or follow-up cleanup?"
- Without dependencies: "Is there anything I need to finish first?"

Red flags:

- Subjective acceptance criteria.
- Independent code, docs, and rename deliverables bundled together.
- No stated paths for a multi-file change.

## `research`

Required checks:

- Research questions: numbered, distinct, individually answerable.
- Expected output format: issue comment, named doc path, table, or other artifact.
- Termination condition: when enough research is enough.

Recommended checks:

- Known unknowns.
- Starting references, paths, URLs, or prior issues.
- Follow-up ticket scope.
- Time box.

Diagnostic questions:

- Without research questions: "What specifically am I trying to find out?"
- Without output format: "Where do I put findings?"
- Without termination condition: "When is the investigation complete?"
- Without starting points: "Where do I begin looking?"

Red flags:

- Research issue includes implementation instructions.
- "Figure out X" with no specific questions.
- Architectural research has no durable artifact path.

## `architect`

Required checks:

- Design questions: distinct and answerable.
- Constraints: existing interfaces, ISA limits, runtime constraints, or project rules.
- Deliverable type and path.
- Design-only boundary if code changes are out of scope.

Recommended checks:

- Evaluation criteria for choosing an option.
- Candidate options or starting directions.
- Rejection format for alternatives.
- Follow-up linkage to implementation tickets.

Diagnostic questions:

- Without evaluation criteria: "How do I judge the better design?"
- Without constraints: "What limits must the design respect?"
- Without deliverable path: "Where does the design artifact go?"
- Without design-only boundary: "Should I implement too?"

Red flags:

- Architecture ticket also says to implement.
- No evaluation criteria.
- Deliverable format undefined.

## `docs`

Required checks:

- Target files named.
- Content description: topics, sections, or examples.
- Audience: agent, maintainer, learner, user, etc.
- Insertion point for additions.

Recommended checks:

- Tone or style constraints.
- Existing example or template to model.
- Accuracy source.
- Related docs to cross-reference.

Diagnostic questions:

- Without target file: "Which file am I writing to?"
- Without content description: "What should the section cover?"
- Without insertion point: "Where does this go?"
- Without accuracy source: "What is the ground truth?"

Red flags:

- "Update the docs" with no path.
- "Write about X" with no insertion point.
- Docs issue also requires production code changes.

## `refactor`

Required checks:

- Source location: exact file and optional lines.
- Target location: same file, new file, deleted path, or renamed symbol.
- Behavioral contract: what must remain true.
- Motivation: duplication, vestigial code, architecture, naming, etc.

Recommended checks:

- Safety check such as tests, grep, or manual verification.
- Reference cleanup scope.
- Dependency chain.

Diagnostic questions:

- Without source location: "Which code am I refactoring?"
- Without target location: "Where does it go?"
- Without behavioral contract: "How do I know behavior did not change?"
- Without reference cleanup: "Do docs or comments need updates?"

Red flags:

- Refactor adds behavior.
- No safety check.
- Motivation missing.

## `test`

Required checks:

- What to test: function, module, behavior, or bug.
- Test type: unit, integration, oracle/e2e, or research.
- Expected behavior to assert.
- Test file location.

Recommended checks:

- Edge cases.
- Fixtures or sample inputs.
- Coverage target.
- Oracle dependency if relevant.

Diagnostic questions:

- Without target: "Which behavior am I testing?"
- Without expected behavior: "What should the assertion be?"
- Without file location: "Where should the test go?"
- Without edge cases: "Which boundaries matter?"

Red flags:

- "Add more tests" with no target.
- Test ticket also changes production code.
- Oracle test filed without checking oracle availability.

## Compound Issue Detection

Flag an issue as compound when:

- a title combines role tags and the roles have independent deliverables
- the body contains unrelated Should-have sections
- acceptance criteria include independent conditions that can pass or fail separately

When flagging a compound issue, name the bundled deliverables and recommend concrete split tickets. If one deliverable depends on the other, mark the dependency instead of keeping both in one issue.
