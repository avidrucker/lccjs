#!/usr/bin/env node
/*
 * cluster-triage-proto.js — PROTOTYPE for #233 (design: ARC #222, derived-cluster availability).
 *
 * NOT wired into scripts/puzzle-status.js or the puzzle-triage skill. This is throwaway
 * substrate to validate the derive-and-render model before the real integration (tracked
 * by #222's follow-up puzzles).
 *
 * The whole point: you never STORE "unavailable" — you derive it from cheap inputs.
 *
 *   inputs (all cheap):
 *     - docs/puzzle-clusters.csv        cluster membership + blocked_by edges   (ZERO network)
 *     - git worktree list --porcelain   the IN-PROGRESS set (<fruit>/issue-<N>) (ZERO network)
 *     - gh issue list --state all       ONE batch call for open/closed state    (best-effort)
 *
 *   derive:
 *     unavailable(i) = blocked_by an OPEN issue
 *                      OR shares a cluster with an IN-PROGRESS member   (the soft wip-lock)
 *
 * Because the soft lock comes from a live worktree, it cannot outlive the work that
 * justifies it — no stored label, no orphaned-lock reconciler.
 *
 * Usage:  node scripts/cluster-triage-proto.js
 */
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function sh(cmd, allowFail = false) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    if (allowFail) return '';
    throw e;
  }
}

// --- 1. cluster manifest (zero network) ------------------------------------
function readManifest(file) {
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').slice(1); // drop header
  const members = {};   // cluster -> Set(issue)
  const clusterOf = {}; // issue   -> cluster
  const blockedBy = {}; // issue   -> [blocker, ...]
  for (const line of lines) {
    if (!line.trim()) continue;
    const [cluster, issue, dep] = line.split(',').map((s) => (s || '').trim());
    if (!cluster || !issue) continue;
    (members[cluster] = members[cluster] || new Set()).add(issue);
    clusterOf[issue] = cluster;
    if (dep) (blockedBy[issue] = blockedBy[issue] || []).push(dep);
  }
  return { members, clusterOf, blockedBy };
}

// --- 2. in-progress set from live worktrees (zero network) -----------------
function inProgressIssues() {
  const set = new Set();
  const out = sh('git worktree list --porcelain', true);
  for (const m of out.matchAll(/branch refs\/heads\/(\S+)/g)) {
    const mm = m[1].match(/issue-(\d+)/);
    if (mm) set.add(mm[1]);
  }
  return set;
}

// --- 3. issue open/closed state: ONE batch gh call (best-effort) -----------
function issueStates() {
  const json = sh('gh issue list --state all --limit 500 --json number,state', true);
  const map = {};
  if (!json) return { map, live: false };
  try {
    for (const it of JSON.parse(json)) map[String(it.number)] = it.state; // "OPEN" | "CLOSED"
  } catch (_) { return { map, live: false }; }
  return { map, live: true };
}
const isOpen = (states, i) => (i in states.map ? states.map[i] === 'OPEN' : null); // null = unknown

// --- derive + render -------------------------------------------------------
function main() {
  const root = sh('git rev-parse --show-toplevel');
  const man = readManifest(path.join(root, 'docs', 'puzzle-clusters.csv'));
  const inprog = inProgressIssues();
  const states = issueStates();

  // a cluster is "hot" iff it has an in-progress member
  const hot = {};
  for (const [cluster, set] of Object.entries(man.members)) {
    const active = [...set].filter((i) => inprog.has(i));
    if (active.length) hot[cluster] = active.sort((a, b) => a - b);
  }

  function classify(issue) {
    if (isOpen(states, issue) === false) return { k: 'closed' };
    if (inprog.has(issue)) return { k: 'inprogress' };
    const blockers = (man.blockedBy[issue] || []).filter((b) => isOpen(states, b) === true);
    if (blockers.length) return { k: 'blocked', by: blockers };
    const c = man.clusterOf[issue];
    if (c && hot[c]) return { k: 'locked', by: hot[c] };
    if (isOpen(states, issue) === null) return { k: 'unknown' };
    return { k: 'avail' };
  }

  const num = (a, b) => Number(a) - Number(b);
  const hashed = (arr) => arr.map((i) => '#' + i).join(' ');
  const out = [];
  out.push(`derived-cluster triage  ·  PROTOTYPE #233  ·  design #222`);
  out.push(`in-progress: ${hashed([...inprog].sort(num)) || '(none)'}   ·   issue-state: ${states.live ? 'live (gh)' : 'UNKNOWN (gh unavailable)'}`);
  out.push('');

  for (const cluster of Object.keys(man.members).sort()) {
    const active = hot[cluster];
    const head = active
      ? `🔒 soft-locked by ${hashed(active)}`
      : `🟢 idle (no clustermate in progress)`;
    out.push(`CLUSTER ${cluster}   ${head}`);
    const closed = [];
    for (const issue of [...man.members[cluster]].sort(num)) {
      const c = classify(issue);
      if (c.k === 'closed') { closed.push(issue); continue; }
      if (c.k === 'inprogress') out.push(`   🔵 #${issue}  in progress`);
      else if (c.k === 'locked') out.push(`   🔒 #${issue}  unavailable — clustermate ${hashed(c.by)} in progress`);
      else if (c.k === 'blocked') out.push(`   ⚪ #${issue}  blocked — waiting on OPEN ${hashed(c.by)}`);
      else if (c.k === 'unknown') out.push(`   ❔ #${issue}  (state unknown)`);
      else {
        // available; annotate any now-cleared blocked_by edges for transparency
        const cleared = (man.blockedBy[issue] || []).filter((b) => isOpen(states, b) === false);
        out.push(`   🟢 #${issue}  available${cleared.length ? `  (blocked-by ${hashed(cleared)} → closed ✓)` : ''}`);
      }
    }
    if (closed.length) out.push(`   ·  ${hashed(closed.sort(num))}  closed`);
    out.push('');
  }

  // in-progress issues that aren't in any cluster — surfaced so triage is complete
  const unclusteredActive = [...inprog].filter((i) => !man.clusterOf[i]).sort(num);
  if (unclusteredActive.length) {
    out.push('UNCLUSTERED in-progress');
    for (const i of unclusteredActive) out.push(`   🔵 #${i}  in progress`);
    out.push('');
  }

  out.push('(unclustered, non-active issues are all individually available — out of prototype scope.)');
  process.stdout.write(out.join('\n') + '\n');
}

main();
