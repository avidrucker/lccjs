#!/usr/bin/env node
/**
 * report.js — generate docs/velocity-report.md from velocity DB + GitHub API.
 *
 * Sections:
 *   1. Tickets closed per week (past 8 weeks, by agent)
 *   2. Tickets closed by agent (all-time + last 4 weeks)
 *   3. Tickets closed by role
 *   4. Human-gate queue (open issues with humans-only / human-decision-required /
 *      decision / waiting-on-external labels)
 *
 * Usage:
 *   node scripts/report.js
 *   npm run report
 */
'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');

const DB_PATH  = process.env.VELOCITY_DB || path.join(os.homedir(), '.lccjs', 'velocity.db');
const OUT_PATH = path.join(__dirname, '..', 'docs', 'velocity-report.md');

// YYYY-MM-DD of the Monday of the ISO week containing `date` (UTC-based).
function weekMon(date) {
  const d = new Date(date);
  if (isNaN(d)) return null;
  const day = d.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

// Returns 8 Monday YYYY-MM-DD strings, oldest first, ending with this week.
function past8Weeks() {
  const weeks = [];
  const base = new Date(weekMon(new Date()) + 'T00:00:00Z');
  for (let i = 7; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - i * 7);
    weeks.push(d.toISOString().slice(0, 10));
  }
  return weeks;
}

// Render a markdown pipe table. `headers` is string[], `rows` is (string|number)[][].
function mdTable(headers, rows) {
  const widths = headers.map((h, i) =>
    Math.max(String(h).length, ...rows.map(r => String(r[i] ?? '').length))
  );
  const pad = (v, w) => String(v ?? '').padEnd(w);
  const rowLine = cells => '| ' + cells.map((c, i) => pad(c, widths[i])).join(' | ') + ' |';
  const sep = '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |';
  return [rowLine(headers), sep, ...rows.map(rowLine)].join('\n');
}

// Fetch open issues for one label; returns parsed JSON array.
function fetchByLabel(label) {
  try {
    const out = execSync(
      `gh issue list --state open --label "${label}" --json number,title,labels,createdAt --limit 500`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return JSON.parse(out);
  } catch (_) {
    return null; // gh unavailable or label missing
  }
}

function run() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`DB not found at ${DB_PATH} — run npm run velocity:seed first`);
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });
  const rows = db.prepare(`
    SELECT ticket, title, role, agent, finished_iso, actual_min, h_min
    FROM velocity
    WHERE finished_iso IS NOT NULL AND finished_iso != ''
      AND (repo IS NULL OR repo = 'lccjs')
    ORDER BY id
  `).all();
  db.close();

  // ── Table 1: tickets closed per week (past 8 weeks) ──────────────────────────
  const weeks = past8Weeks();

  // Collect unique agents, sorted
  const agents = [...new Set(rows.map(r => r.agent).filter(Boolean))].sort();

  // weekStr → agentName → count
  const weekCounts = Object.fromEntries(weeks.map(w => [w, {}]));
  for (const r of rows) {
    const w = weekMon(r.finished_iso);
    if (w && weekCounts[w]) {
      weekCounts[w][r.agent] = (weekCounts[w][r.agent] || 0) + 1;
    }
  }

  const weekHeaders = ['Week (Mon)', ...agents, 'Total'];
  const weekRows = weeks.map(w => {
    const counts = agents.map(a => weekCounts[w][a] || 0);
    const total = counts.reduce((s, c) => s + c, 0);
    return [w, ...counts, total];
  });

  // ── Table 2: tickets closed by agent ─────────────────────────────────────────
  const weeks8 = weeks; // same 8-week window for context
  const cutoff4w = weeks[4]; // Monday 4 full weeks back

  const agentAll = {}, agent4w = {};
  for (const r of rows) {
    if (!r.agent) continue;
    agentAll[r.agent] = (agentAll[r.agent] || 0) + 1;
    const w = weekMon(r.finished_iso);
    if (w && w >= cutoff4w) {
      agent4w[r.agent] = (agent4w[r.agent] || 0) + 1;
    }
  }

  const agentHeaders = ['Agent', 'All time', 'Last 4 weeks'];
  const agentRows = Object.keys(agentAll).sort().map(a => [a, agentAll[a], agent4w[a] || 0]);
  const sumAll = Object.values(agentAll).reduce((s, c) => s + c, 0);
  const sum4w  = Object.values(agent4w).reduce((s, c) => s + c, 0);
  agentRows.push(['**Total**', sumAll, sum4w]);

  // ── Table 3: tickets closed by role ──────────────────────────────────────────
  const roleCount = {};
  for (const r of rows) {
    if (!r.role) continue;
    roleCount[r.role] = (roleCount[r.role] || 0) + 1;
  }
  const roleHeaders = ['Role', 'Count'];
  const roleRows = Object.entries(roleCount)
    .sort((a, b) => b[1] - a[1]) // descending by count
    .map(([role, count]) => [role, count]);

  // ── Human-gate queue ─────────────────────────────────────────────────────────
  const GATE_LABELS = ['humans-only', 'human-decision-required', 'decision', 'waiting-on-external'];
  let ghFailed = false;
  const seen = new Set();
  const gated = [];

  for (const label of GATE_LABELS) {
    const issues = fetchByLabel(label);
    if (issues === null) { ghFailed = true; break; }
    for (const i of issues) {
      if (!seen.has(i.number)) {
        seen.add(i.number);
        gated.push(i);
      }
    }
  }
  gated.sort((a, b) => a.number - b.number);

  // ── Assemble report ───────────────────────────────────────────────────────────
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  const lines = [
    '# Velocity Report',
    '',
    `_Generated ${now} by \`npm run report\`. Source: \`~/.lccjs/velocity.db\` + GitHub API._`,
    `_Gitignored — re-run to refresh._`,
    '',
    '## Tickets closed per week (past 8 weeks)',
    '',
    mdTable(weekHeaders, weekRows),
    '',
    '## Tickets closed by agent',
    '',
    mdTable(agentHeaders, agentRows),
    '',
    '## Tickets closed by role',
    '',
    mdTable(roleHeaders, roleRows),
    '',
    '## Human-gate queue',
    '',
    `_Labels: ${GATE_LABELS.map(l => '`' + l + '`').join(', ')}_`,
    '',
  ];

  if (ghFailed) {
    lines.push('_gh unavailable — could not fetch issue list._');
  } else if (gated.length === 0) {
    lines.push('_No open issues with human-gate labels._');
  } else {
    for (const i of gated) {
      const gateLabels = i.labels
        .map(l => l.name)
        .filter(n => GATE_LABELS.includes(n))
        .join(', ');
      lines.push(`- **#${i.number}** ${i.title} _(${gateLabels})_`);
    }
  }

  lines.push('');
  fs.writeFileSync(OUT_PATH, lines.join('\n'));
  console.log(`Report written → ${OUT_PATH}`);
}

run();
