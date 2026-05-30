'use strict';

// Unit coverage for the derived-cluster soft-lock wired into puzzle-status.js (#237,
// design #222). The lock is DERIVED from a live worktree, never stored — so these
// tests drive the pure seam (loadClusters / clusterLockers / classify) with explicit
// in-progress sets rather than spawning worktrees.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadClusters, clusterLockers, classify } = require('../../scripts/puzzle-status.js');

let seq = 0;
function manifest(rows) {
  const f = path.join(os.tmpdir(), `clusters-${process.pid}-${seq++}.csv`);
  fs.writeFileSync(f, 'cluster,issue,blocked_by\n' + rows);
  const c = loadClusters(f);
  fs.unlinkSync(f);
  return c;
}

describe('puzzle-status derived-cluster soft-lock (#237)', () => {
  test('loadClusters parses cluster,issue and groups members', () => {
    const c = manifest('identity,194,223\nidentity,227,\ntooling,222,\n');
    expect(c.clusterOf.get(194)).toBe('identity');
    expect(c.clusterOf.get(222)).toBe('tooling');
    expect([...c.members.get('identity')].sort((a, b) => a - b)).toEqual([194, 227]);
  });

  test('loadClusters degrades to empty maps when the manifest is absent', () => {
    const c = loadClusters(path.join(os.tmpdir(), 'no-such-cluster-manifest.csv'));
    expect(c.clusterOf.size).toBe(0);
    expect(c.members.size).toBe(0);
  });

  test('clusterLockers reports an in-progress clustermate and excludes self / non-members', () => {
    const c = manifest('identity,194,\nidentity,227,\n');
    expect(clusterLockers(194, c, new Set([227]))).toEqual({ cluster: 'identity', mates: [227] });
    expect(clusterLockers(194, c, new Set([194]))).toBeNull(); // self isn't a lock on itself
    expect(clusterLockers(194, c, new Set())).toBeNull();      // nobody active
    expect(clusterLockers(999, c, new Set([227]))).toBeNull(); // not in any cluster
  });

  test('classify downgrades AVAILABLE → LOCKED when a clustermate is in progress', () => {
    const c = manifest('identity,194,\nidentity,227,\n');
    const issues = new Map([[194, { state: 'OPEN', blocked: false }], [227, { state: 'OPEN', blocked: false }]]);
    const marker = { issue: 194, keyword: 'todo' };

    const locked = classify(marker, new Map(), issues, c, new Set([227]));
    expect(locked.status).toBe('LOCKED');
    expect(locked.detail).toMatch(/#227/);

    const avail = classify(marker, new Map(), issues, c, new Set());
    expect(avail.status).toBe('AVAILABLE');
  });

  test('CLAIMED worktree and BLOCKED label take precedence over a cluster soft-lock', () => {
    const c = manifest('identity,194,\nidentity,227,\n');
    const marker = { issue: 194, keyword: 'todo' };

    const blocked = new Map([[194, { state: 'OPEN', blocked: true }]]);
    expect(classify(marker, new Map(), blocked, c, new Set([227])).status).toBe('BLOCKED');

    const wt = { path: '/x/apple-issue-194', branch: 'apple/issue-194', agent: 'apple' };
    const open = new Map([[194, { state: 'OPEN', blocked: false }]]);
    expect(classify(marker, new Map([[194, wt]]), open, c, new Set([194, 227])).status).toBe('CLAIMED');
  });

  test('no clusters arg → classify behaves exactly as before (backward compatible)', () => {
    const issues = new Map([[194, { state: 'OPEN', blocked: false }]]);
    const marker = { issue: 194, keyword: 'todo' };
    expect(classify(marker, new Map(), issues).status).toBe('AVAILABLE');
  });
});
