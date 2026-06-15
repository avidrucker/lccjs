#!/usr/bin/env node
'use strict';
/*
 * preflight.js — guard task START the way close.js guards task END.
 * #1036 (child of #998). The task *end* is heavily guarded, so its steps don't get
 * skipped; the task *start* had no equivalent, so its steps did (the #652 / OPEN-state
 * / `git worktree list` "clear-but-failed" lapses). This moves those start-of-task
 * steps into a single point-of-action command.
 *
 *   npm run preflight <issue>   (= node scripts/preflight.js <issue>)
 *
 *   1. Stamps started_iso (`date '+%Y-%m-%dT%H:%M:%S%z'`) to a session scratch file
 *      ~/.lccjs/preflight-<issue>.iso, so the closing velocity row reads a REAL
 *      captured timestamp instead of a reconstructed one (#652).
 *   2. Runs the start-of-task reads an agent should do anyway — `git status`,
 *      `git worktree list`, `gh issue view <N> --comments`.
 *   2.5 Surfaces existing in-repo evidence (`docs/logs/<M>-*`, `docs/research/<M>-*`)
 *      for every #M the issue body/comments reference, so a captured work log
 *      gets read before a story is reconstructed from git/gh (#1131, ← #1122).
 *   3. Asserts the issue is OPEN; fails loudly (exit 1) otherwise.
 *
 * Additive to claim.js — it front-loads the reads that PRECEDE a claim; it does NOT
 * claim and does NOT touch claim.js/close.js (deliberately, to avoid colliding with
 * the in-flight claim.js work, #1013/#1017). Claiming stays out of scope.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Best-effort shell: return stdout on success; on failure return whatever was
// captured (stdout or stderr) so an offline `gh` degrades to a warning, never a throw.
function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return (e && (e.stdout || e.stderr)) || null;
  }
}

function out(s) { process.stdout.write(String(s).replace(/\n?$/, '\n')); }
function die(msg) { process.stderr.write(`[preflight] ✗ ${msg}\n`); process.exit(1); }
const indent = (s) => String(s || '').replace(/^/gm, '    ').replace(/\s+$/, '');

// Pure (#1036): decide the OPEN-state gate from a gh `state` string (or null when gh
// is unavailable). OPEN → proceed; anything else → block loudly; null/'' (offline) →
// warn-and-proceed, matching claim.js's best-effort, offline-first guards. No I/O —
// unit-testable.
function preflightIssueGate(state) {
  if (state == null || String(state).trim() === '') {
    return { ok: true, warn: 'issue state unknown (gh unavailable) — proceeding best-effort.' };
  }
  const s = String(state).trim().toUpperCase();
  if (s === 'OPEN') return { ok: true };
  return { ok: false, error: `issue is ${s}, not OPEN — nothing to start (raced a close? cf. #223). Pick another issue.` };
}

// Pure (#1131, follow-up to #1122): given issue text (body + comments) and a
// candidate file list, surface the in-repo evidence for every #N the issue
// references — the captured work log / research doc an investigator should read
// before reconstructing a story from git/gh (the #1122 failure). The repo names
// these files `<N>-slug.md` under docs/logs/ and docs/research/, so the match is
// ANCHORED to the basename prefix (`<N>-`): a substring match would make #76
// spuriously hit `1076-*.md`. No I/O — unit-testable like preflightIssueGate.
function preflightEvidence(text, fileList) {
  const refs = new Set();
  const re = /#(\d+)/g;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) refs.add(m[1]);

  const dirs = ['docs/logs/', 'docs/research/'];
  const hits = new Set();
  for (const f of Array.isArray(fileList) ? fileList : []) {
    const p = String(f).replace(/^\.\//, '');
    const dir = dirs.find((d) => p.startsWith(d));
    if (!dir) continue;
    const prefix = p.slice(dir.length).match(/^(\d+)-/);
    if (prefix && refs.has(prefix[1])) hits.add(p);
  }
  return Array.from(hits).sort();
}

// Best-effort, top-level listing of the two evidence dirs (relative paths, the
// shape preflightEvidence expects). Never throws — a missing dir just yields no
// candidates, like the offline gh handling.
function listEvidenceFiles() {
  const out = [];
  for (const d of ['docs/logs', 'docs/research']) {
    try { for (const name of fs.readdirSync(d)) out.push(`${d}/${name}`); }
    catch (_) { /* dir absent — best-effort */ }
  }
  return out;
}

function main(argv) {
  const issue = String(argv[0] || '').replace(/^#/, '');
  if (!/^\d+$/.test(issue)) die('usage: npm run preflight <issue-number>');

  const bar = '─'.repeat(58);
  out(bar); out(`  PREFLIGHT  ·  issue #${issue}`); out(bar);

  // 1) Stamp started_iso to the per-issue session scratch file (#652).
  const stamp = (sh(`date '+%Y-%m-%dT%H:%M:%S%z'`) || '').trim();
  const dir = path.join(os.homedir(), '.lccjs');
  const scratch = path.join(dir, `preflight-${issue}.iso`);
  try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(scratch, stamp + '\n'); } catch (_) {}
  out(`  started_iso   ${stamp || '(date unavailable)'}`);
  out(`  saved to      ${scratch}`);
  out(`  → use this exact value as the velocity row's started_iso at close time.`);
  out('');

  // 2) Start-of-task reads (the steps that get skipped without a guard).
  const status = sh('git status --short');
  out('  git status --short:');
  out(status && status.trim() ? indent(status) : '    (clean)');
  out('  git worktree list:');
  out(indent(sh('git worktree list')));
  out('');

  // gh's human `--comments` view emits nothing when piped (non-TTY); fetch JSON
  // instead so the issue body + comments are reliably visible, and reuse the same
  // call for the OPEN-state gate below (one round-trip, not two).
  let info = null;
  const raw = sh(`gh issue view ${issue} --json number,title,state,body,comments`);
  if (raw) { try { info = JSON.parse(raw); } catch (_) {} }
  let body = '';
  let comments = [];
  if (info) {
    body = info.body || '';
    comments = Array.isArray(info.comments) ? info.comments : [];
    out(`  #${info.number} [${info.state}] ${info.title}`);
    out('');
    out('  body:');
    out(indent(body && body.trim() ? body : '(no body)'));
    out(`  comments (${comments.length}):`);
    for (const c of comments) {
      const who = (c.author && c.author.login) || 'unknown';
      out(indent(`— @${who} (${c.createdAt || ''}):\n${(c.body || '').trim()}`));
    }
  } else {
    out(`  ⚠ gh issue view ${issue} unavailable (offline?) — skipping issue read.`);
  }
  out('');

  // 2.5) Surface existing in-repo evidence for referenced tickets (#1131). An
  // agent can otherwise run preflight, read the body, and reconstruct a story
  // from git/gh while a captured work log sits unread under docs/logs/ — the
  // #1122 failure. Scan body AND comments (cross-refs often live in comments).
  const refText = [body, ...comments.map((c) => c && c.body)].join('\n');
  const evidence = preflightEvidence(refText, listEvidenceFiles());
  out('  existing evidence — read these before writing findings:');
  if (evidence.length) {
    for (const p of evidence) out(`    • ${p}`);
  } else {
    out('    (none found for referenced tickets)');
  }
  out('');

  // 3) OPEN-state gate — the hard check (reuses the JSON state above).
  const gate = preflightIssueGate(info && info.state);
  if (gate.warn) out(`  ⚠ ${gate.warn}`);
  if (!gate.ok) die(gate.error);

  out(bar);
  out(`  PREFLIGHT OK  ·  #${issue} is OPEN  ·  started_iso stamped`);
  out(`  next: npm run claim -- ${issue} --as <fruit>`);
  out(bar);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { preflightIssueGate, preflightEvidence };
