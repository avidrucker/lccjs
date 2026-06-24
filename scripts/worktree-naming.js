'use strict';

// worktree-naming.js — single source for the self-describing worktree/branch
// naming scheme ratified in #1460 (mirrors pmtools' canonical version exactly, so
// the eventual pmtools switch is a no-op). Tracker: #1461.
//
//   branch       = br-<agent>/<project>-<lang>-issue-<N>[-<theme>]
//   worktree dir = wt-<agent>-<project>-<lang>-issue-<N>
//
// Back-compat: the `br-`/`wt-` prefix and the `<project>-<lang>-` infix are
// OPTIONAL on parse, so legacy `<agent>/issue-<N>` branches and `<agent>-issue-<N>`
// worktree dirs still resolve. This module is pure (no git I/O) — directly
// unit-testable. #1464 adds parsing + the module; #1465 flips construction to the
// `mk*` helpers below.

// Canonical regexes — keep identical to pmtools.
const BRANCH_RE = /^(?:br-)?(?<agent>[a-z0-9]+)\/(?:(?<project>[a-z0-9]+)-(?<lang>[a-z0-9]+)-)?issue-(?<issue>\d+)(?:-(?<theme>.+))?$/;
const WORKTREE_RE = /^(?:wt-)?(?<agent>[a-z0-9]+)-(?:(?<project>[a-z0-9]+)-(?<lang>[a-z0-9]+)-)?issue-(?<issue>\d+)$/;

// languages[0] tag → short lang token (#1460 field-sourcing).
const LANG_TAGS = {
  javascript: 'js', typescript: 'ts', python: 'py', clojure: 'clj', ruby: 'rb', rust: 'rs', go: 'go',
};

function langToken(language) {
  if (!language) return 'x';
  const l = String(language).toLowerCase();
  return LANG_TAGS[l] || l;
}

// Resolve {project, lang} from a parsed orchestrate.json object. project = explicit
// `project` key, else the caller's repo-basename fallback, else 'repo'. lang =
// languages[0] via the tag map.
function projectLang(cfg, repoFallback) {
  const project = (cfg && cfg.project) || repoFallback || 'repo';
  const langs = cfg && Array.isArray(cfg.languages) ? cfg.languages : [];
  return { project, lang: langToken(langs[0]) };
}

function parseBranch(branch) {
  const m = branch && BRANCH_RE.exec(branch);
  if (!m) return null;
  const g = m.groups;
  return { agent: g.agent, project: g.project || null, lang: g.lang || null, issue: Number(g.issue), theme: g.theme || null };
}

function parseWorktreeDir(name) {
  const m = name && WORKTREE_RE.exec(name);
  if (!m) return null;
  const g = m.groups;
  return { agent: g.agent, project: g.project || null, lang: g.lang || null, issue: Number(g.issue) };
}

// Agent from a branch, `br-`-prefix tolerant. null when the branch carries no
// `<agent>/issue-<N>` (e.g. `main`, `<fruit>/session`).
function agentFromBranch(branch) {
  const p = parseBranch(branch);
  return p ? p.agent : null;
}

// Construct the NEW self-describing forms (consumed by #1465).
function mkBranch({ agent, project, lang, issue, theme }) {
  return `br-${agent}/${project}-${lang}-issue-${issue}${theme ? `-${theme}` : ''}`;
}
function mkWorktreeDirName({ agent, project, lang, issue }) {
  return `wt-${agent}-${project}-${lang}-issue-${issue}`;
}

// Worktree DIR name that mirrors an existing branch: a new `br-` branch maps to the
// `wt-…` form; a legacy branch maps to `<agent>-issue-<N>`. Used by close.js to
// reconstruct the worktree path from the branch.
function worktreeDirForBranch(branch) {
  const p = parseBranch(branch);
  if (!p) return null;
  if (branch.startsWith('br-') && p.project && p.lang) return mkWorktreeDirName(p);
  return `${p.agent}-issue-${p.issue}`;
}

module.exports = {
  BRANCH_RE, WORKTREE_RE, LANG_TAGS,
  langToken, projectLang,
  parseBranch, parseWorktreeDir, agentFromBranch,
  mkBranch, mkWorktreeDirName, worktreeDirForBranch,
};
