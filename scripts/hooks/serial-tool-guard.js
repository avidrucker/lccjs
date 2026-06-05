#!/usr/bin/env node
/**
 * PostToolBatch serial-tool-use guard — #349 (experiment)
 *
 * Fires after every tool batch; blocks the next model turn when a batch
 * contains a producer+consumer pair that creates a stale-read footgun.
 *
 * To enable, add to .claude/settings.json:
 *   {
 *     "hooks": {
 *       "PostToolBatch": [{
 *         "hooks": [{"type":"command",
 *                    "command":"node scripts/hooks/serial-tool-guard.js"}]
 *       }]
 *     }
 *   }
 *
 * Payload schema (verified from Claude Code docs, #349):
 *   stdin JSON: { tool_calls: Array<{
 *     tool_name:   string,   // "Bash", "Read", "Write", "Edit", …
 *     tool_input:  object,   // tool's input args (e.g. {command}, {file_path})
 *     tool_use_id: string,
 *     output:      string,   // tool's output/response (included in PostToolBatch)
 *     was_blocked: boolean,
 *     error:       string|null
 *   }> }
 *
 * Detection:
 *   1. ≥2 state-changing Bash calls in one batch
 *      (git write ops / gh write ops / npm run claim|close / rm)
 *   2. A Write or Edit + a sibling Read of the same file_path
 *      (written path consumed before the write is even committed to disk)
 *
 * Passes (no block):
 *   - Single-tool turns
 *   - Read-only batches (all Read / non-mutating Bash)
 *   - Exactly 1 state-changing Bash with other read-only calls
 *   - Parallel read-only gh calls (gh issue list/view, gh pr list/view) — safe to batch (#846)
 *   - Parallel read-only git calls (git status, git log, git diff, git worktree list) — safe to batch (#846)
 *
 * NOTE (#846): the original regex matched ALL `git ` and `gh ` prefixes, which incorrectly
 * blocked safe parallel research calls like `gh issue list` + `git worktree list`.
 * The regex now enumerates only genuinely state-mutating subcommands.
 */

// Write-path git subcommands (mutate local state or remote).
// Read-only git commands (status, log, diff, show, rev-parse, fetch, worktree list, branch -r, etc.)
// are intentionally excluded so parallel status/log calls don't trigger this guard.
const STATE_CHANGING_RE = /^\s*(git (commit|push|rebase|reset|merge|add |branch -[dD]|worktree (remove|prune)|checkout|cherry-pick|stash (pop|drop|apply))|gh (issue|pr|release|gist) (create|edit|close|comment|reopen|merge|review|delete)|npm run claim|npm run close|rm )/;

function isStateChangingBash(call) {
  if (call.tool_name !== 'Bash') return false;
  const cmd = call.tool_input?.command ?? '';
  return STATE_CHANGING_RE.test(cmd);
}

function writtenPaths(calls) {
  return calls
    .filter(c => c.tool_name === 'Write' || c.tool_name === 'Edit')
    .map(c => c.tool_input?.file_path)
    .filter(Boolean);
}

function readPaths(calls) {
  return calls
    .filter(c => c.tool_name === 'Read')
    .map(c => c.tool_input?.file_path)
    .filter(Boolean);
}

function detect(calls) {
  // Heuristic 1: ≥2 state-changing Bash calls
  const stateChanging = calls.filter(isStateChangingBash);
  if (stateChanging.length >= 2) {
    const cmds = stateChanging.map(c => JSON.stringify(c.tool_input?.command)).join(', ');
    return `Batched ≥2 state-changing Bash calls — stale-read footgun. Re-issue serially. Colliding calls: ${cmds}`;
  }

  // Heuristic 2: Write/Edit + sibling Read of the same path
  const written = new Set(writtenPaths(calls));
  const read = readPaths(calls);
  for (const p of read) {
    if (written.has(p)) {
      return `Batched Write/Edit + Read of the same path "${p}" — consumer will read stale content. Re-issue Read after Write resolves.`;
    }
  }

  return null;
}

const chunks = [];
process.stdin.on('data', d => chunks.push(d));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    process.exit(0); // unparseable — pass through
  }

  const calls = payload?.tool_calls ?? [];
  if (calls.length < 2) {
    process.exit(0); // single-tool turns: no producer-consumer possible
  }

  const reason = detect(calls);
  if (reason) {
    process.stdout.write(JSON.stringify({ decision: 'block', reason }));
    process.exit(0);
  }

  process.exit(0); // allow
});
