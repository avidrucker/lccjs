#!/usr/bin/env node
/**
 * ice-score.js — ICE (Impact × Confidence / Ease) scoring for open GitHub issues.
 *
 * Scores are stored in the canonical lccjs SQLite DB (ice_scores table) and
 * exported to stats/ice-scores.csv + stats/ice-scores.md.
 *
 * Two override tiers sit above the ICE queue:
 *   priority:critical — do before everything else
 *   priority:elevated — do this sprint, before normal queue
 *
 * Scales:
 *   I (Impact):     3=massive · 2=high · 1=medium · 0.5=low · 0.25=minimal
 *   C (Confidence): 1.0=high  · 0.8=medium · 0.5=low
 *   E (Ease):       10=trivial · 7=easy · 5=moderate · 3=hard · 1=very hard
 *
 * Formula: ICE = I × C / E   tiebreaker: +1/(issue×1000)
 *
 * Usage:
 *   npm run ice:score                                    # interactive: score all unscored open issues
 *   npm run ice:score -- --issue 956                     # score/update a single issue interactively
 *   npm run ice:score -- '{"956":{"I":2,"C":0.8,"E":5}}' # batch (JSON positional arg)
 *   npm run ice:score -- --seed-from stats/rice-scores.csv  # one-time migration from RICE CSV
 *   npm run ice:score -- --set-tier elevated --issue 956    # apply tier label + audit comment
 *   npm run ice:score -- --dry-run                          # show plan, no writes or gh mutations
 *   npm run ice:score -- --export-only                      # re-export CSV + markdown from existing DB
 *   npm run ice:score -- --output path/to/table.md          # override the MARKDOWN path only
 *
 * Note: --output retargets the markdown table only. The CSV is always written to
 * stats/ice-scores.csv (the canonical, DB-derived export) regardless of --output.
 */
'use strict';

const { execSync }  = require('child_process');
const fs            = require('fs');
const path          = require('path');
const readline      = require('readline');
const Database      = require('better-sqlite3');
const { DB_PATH }   = require('./db-path');   // shared resolver (LCCJS_DB / lccjs.db) (#984)

// ── Paths ─────────────────────────────────────────────────────────────────────

const WORKTREE_ROOT = path.join(__dirname, '..');
const CSV_PATH  = path.join(WORKTREE_ROOT, 'stats', 'ice-scores.csv');
const MD_PATH   = path.join(WORKTREE_ROOT, 'stats', 'ice-scores.md');
const CSV_TMP   = CSV_PATH + '.tmp';
const MD_TMP    = MD_PATH  + '.tmp';

const CSV_COLS  = ['issue','title','type','I','C','E','ice_score','ice_rank',
                   'tier','yegor_priority','actionable','labels','notes','updated_iso'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function sh(cmd, allowFail = false) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    if (allowFail) return null;
    throw e;
  }
}

function die(msg) {
  console.error(`[ice-score] ✗ ${msg}`);
  process.exit(1);
}

function log(msg) {
  console.log(`[ice-score] ${msg}`);
}

function encodeField(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function encodeRow(obj) {
  return CSV_COLS.map(c => encodeField(obj[c])).join(',');
}

// ── Arg parsing ───────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const opts = {
  issue:      null,   // --issue N
  scores:     null,   // JSON string (positional or --scores)
  seedFrom:   null,   // --seed-from path
  setTier:    null,   // --set-tier critical|elevated
  who:        null,   // --who "name"
  why:        null,   // --why "reason"
  expiry:     null,   // --expiry "condition"
  output:     null,   // --output path (markdown)
  dryRun:     false,  // --dry-run
  exportOnly: false,  // --export-only
};

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--dry-run')     { opts.dryRun = true; continue; }
  if (a === '--export-only') { opts.exportOnly = true; continue; }
  if (a === '--issue')       { opts.issue = parseInt(argv[++i], 10); continue; }
  if (a === '--scores')      { opts.scores = argv[++i]; continue; }
  if (a === '--seed-from')   { opts.seedFrom = argv[++i]; continue; }
  if (a === '--set-tier')    { opts.setTier = argv[++i]; continue; }
  if (a === '--who')         { opts.who = argv[++i]; continue; }
  if (a === '--why')         { opts.why = argv[++i]; continue; }
  if (a === '--expiry')      { opts.expiry = argv[++i]; continue; }
  if (a === '--output')      { opts.output = argv[++i]; continue; }
  // Positional JSON (batch mode)
  if (!a.startsWith('--') && opts.scores == null) { opts.scores = a; continue; }
}

// --output overrides the MARKDOWN path only; the CSV path stays fixed (CSV_PATH).
const effectiveMdPath = opts.output || MD_PATH;

// ── DB bootstrap ──────────────────────────────────────────────────────────────

function openDb() {
  if (!fs.existsSync(DB_PATH)) die(`DB not found at ${DB_PATH} — run npm run velocity:seed first`);
  const db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS ice_scores (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      issue          INTEGER NOT NULL UNIQUE,
      title          TEXT,
      type           TEXT,
      I              REAL,
      C              REAL,
      E              REAL,
      ice_score      REAL,
      tier           TEXT DEFAULT '',
      yegor_priority INTEGER,
      actionable     TEXT DEFAULT 'Y',
      labels         TEXT,
      notes          TEXT,
      updated_iso    TEXT
    )
  `);
  return db;
}

// ── ICE computation ───────────────────────────────────────────────────────────

function computeIce(I, C, E) {
  return Math.round((I * C / E) * 10000) / 10000;
}

function finalScore(ice, issueNum) {
  return ice + 1 / (issueNum * 1000);
}

const TIER_ORDER = { critical: 0, elevated: 1, '': 2 };

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const tA = TIER_ORDER[a.tier || ''] ?? 2;
    const tB = TIER_ORDER[b.tier || ''] ?? 2;
    if (tA !== tB) return tA - tB;
    return finalScore(b.ice_score, b.issue) - finalScore(a.ice_score, a.issue);
  });
}

function rankRows(rows) {
  return sortRows(rows).map((r, i) => ({ ...r, ice_rank: i + 1 }));
}

// ── Export CSV ────────────────────────────────────────────────────────────────

function exportCsv(db, csvPath) {
  const rows = db.prepare('SELECT * FROM ice_scores').all();
  const ranked = rankRows(rows);
  const lines = [
    '# AUTO-GENERATED by scripts/ice-score.js — do not edit directly. Source: ' + DB_PATH,
    CSV_COLS.join(','),
    ...ranked.map(encodeRow),
  ];
  const tmp = csvPath + '.tmp';
  fs.writeFileSync(tmp, lines.join('\n') + '\n');
  fs.renameSync(tmp, csvPath);
  log(`Exported ${rows.length} rows → ${csvPath}`);
  return ranked;
}

// ── Export markdown ───────────────────────────────────────────────────────────

function formatIce(v) { return v == null ? '' : v.toFixed(4); }
function pad(s, n) { return String(s ?? '').padEnd(n); }

function exportMd(ranked, mdPath, totalOpen) {
  const now = new Date().toISOString().slice(0, 10);
  const scored = ranked.length;

  const rubric = `
## Rubric

| Dimension | Scale |
|---|---|
| **I (Impact)** | 3=massive · 2=high · 1=medium · 0.5=low · 0.25=minimal |
| **C (Confidence)** | 1.0=high · 0.8=medium · 0.5=low |
| **E (Ease)** | 10=trivial · 7=easy · 5=moderate · 3=hard · 1=very hard |

**Formula:** \`ICE = I × C / E\`
**Tiebreaker:** \`+ 1 / (issue × 1000)\` — earlier issues win ties but cannot flip a higher-scored ticket.

## Override tiers

Two tiers sit above the normal ICE queue:

| Tier | Label | Who can set | Meaning |
|---|---|---|---|
| Critical | \`priority:critical\` | Human only | Do before everything else — SLA breach, legal risk, blocking all agents |
| Elevated | \`priority:elevated\` | Human or PM agent | Do this sprint, before all normal-queue items |

**Audit trail required:** every time \`priority:critical\` or \`priority:elevated\` is applied, post a comment on the issue with:
- **Who** escalated it
- **Why** (one sentence)
- **Expiry** — stays elevated until when, or until what event?

Use: \`npm run ice:score -- --set-tier elevated --issue N\`
`.trimStart();

  const tableHeader = `| Rank | Issue | Title | I | C | E | ICE | Act |
|---|---|---|---|---|---|---|---|`;

  function tableRow(r) {
    const ice = formatIce(r.ice_score);
    return `| ${r.ice_rank} | #${r.issue} | ${r.title || ''} | ${r.I ?? ''} | ${r.C ?? ''} | ${r.E ?? ''} | ${ice} | ${r.actionable ?? ''} |`;
  }

  const critical = ranked.filter(r => r.tier === 'critical');
  const elevated = ranked.filter(r => r.tier === 'elevated');
  const normal   = ranked.filter(r => !r.tier);

  const sections = [];

  if (critical.length) {
    sections.push('## Critical  _(do before everything else)_\n\n' + tableHeader + '\n' + critical.map(tableRow).join('\n'));
  }
  if (elevated.length) {
    sections.push('## Elevated  _(this sprint, before normal queue)_\n\n' + tableHeader + '\n' + elevated.map(tableRow).join('\n'));
  }
  sections.push(
    `## Normal queue\n\n` + tableHeader + '\n' + (normal.length ? normal.map(tableRow).join('\n') : '_No scored issues in normal queue._')
  );

  const out = [
    `# ICE Scores — lccjs open issues`,
    `**Generated:** ${now}   **Issues scored:** ${scored}${totalOpen != null ? ' / ' + totalOpen + ' open' : ''}`,
    '',
    rubric,
    ...sections,
  ].join('\n\n');

  const tmp = mdPath + '.tmp';
  fs.writeFileSync(tmp, out + '\n');
  fs.renameSync(tmp, mdPath);
  log(`Markdown → ${mdPath}`);
}

// ── Label bootstrap ───────────────────────────────────────────────────────────

function ensureLabels(dryRun) {
  const raw = sh('gh label list --json name -q \'.[].name\'', true);
  if (raw == null) { log('warn: gh unavailable — skipping label check'); return; }
  const existing = new Set(raw.trim().split('\n').filter(Boolean));

  const needed = [
    { name: 'priority:critical', color: 'd73a4a', desc: 'Do before everything else — SLA breach, legal risk, blocking all agents' },
    { name: 'priority:elevated', color: 'e4790f', desc: 'Do this sprint, before all normal-queue items' },
  ];

  for (const { name, color, desc } of needed) {
    if (existing.has(name)) continue;
    if (dryRun) { log(`[dry-run] would create label: ${name}`); continue; }
    const result = sh(`gh label create "${name}" --color "${color}" --description "${desc}"`, true);
    if (result != null) log(`Created label: ${name}`);
    else log(`warn: failed to create label ${name}`);
  }
}

// ── Fetch open issues ─────────────────────────────────────────────────────────

function fetchOpenIssues() {
  const raw = sh('gh issue list --state open --limit 500 --json number,title,labels', true);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function detectTier(labels) {
  const names = (labels || []).map(l => l.name);
  if (names.includes('priority:critical')) return 'critical';
  if (names.includes('priority:elevated')) return 'elevated';
  return '';
}

function detectActionable(labels) {
  const names = (labels || []).map(l => l.name);
  if (names.includes('humans-only') || names.includes('deferred')) return 'N';
  return 'Y';
}

function detectSeverityHint(labels) {
  const names = (labels || []).map(l => l.name);
  if (names.includes('severity:critical')) return { hint: 'severity:critical → I=3', def: 3 };
  if (names.includes('severity:high'))     return { hint: 'severity:high → I=2', def: 2 };
  if (names.includes('severity:medium'))   return { hint: 'severity:medium → I=1', def: 1 };
  if (names.includes('severity:low'))      return { hint: 'severity:low → I=0.5', def: 0.5 };
  return { hint: '', def: 1 };
}

// ── RICE CSV seed (historical) ──────────────────────────────────────────────
// RICE was retired in favor of ICE (#956, #997). This one-time migration path
// reads the historical `stats/rice-scores.csv` so existing scores can be carried
// into the live `ice` table; it is the only remaining RICE touchpoint.

function easeFromEhrs(eHrs) {
  // Maps Yegor ≤60m effort bands to discrete Ease scale (10/7/5/3/1)
  const h = parseFloat(eHrs) || 0.5;
  if (h <= 0.10) return 10;
  if (h <= 0.25) return 7;
  if (h <= 0.50) return 5;
  if (h <= 0.75) return 3;
  return 1;
}

// RFC-4180-aware parser: round-trips encodeField/encodeRow above. A bare
// `line.split(',')` cannot — it splits quoted fields that contain commas (e.g.
// a `"decision,humans-only"` labels cell in rice-scores.csv) mid-value and
// shifts every later column. This state machine honors quoted fields, embedded
// commas, doubled-quote escapes (`""`), and embedded newlines; `#`-prefixed
// records and blank lines are skipped (preserving the previous behavior). (#964)
function parseRecords(text) {
  const records = [];
  let record = [];
  let field = '';
  let inQuotes = false;
  let atRecordStart = true;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }  // escaped quote
        else inQuotes = false;                           // closing quote
      } else {
        field += c;
      }
      continue;
    }

    // Outside quotes:
    if (atRecordStart && (c === '\n' || c === '\r')) continue;       // skip blank lines
    if (atRecordStart && c === '#') {                               // skip comment line
      while (i < text.length && text[i] !== '\n') i++;
      continue;                                                     // still at record start
    }
    atRecordStart = false;

    if (c === '"')      { inQuotes = true; }
    else if (c === ',') { record.push(field); field = ''; }
    else if (c === '\r') { /* tolerate CRLF */ }
    else if (c === '\n') {
      record.push(field); field = '';
      records.push(record); record = [];
      atRecordStart = true;
    } else {
      field += c;
    }
  }
  // Flush a final record that did not end with a newline.
  if (field !== '' || record.length) { record.push(field); records.push(record); }
  return records;
}

function parseCsv(filePath) {
  const records = parseRecords(fs.readFileSync(filePath, 'utf8'));
  if (!records.length) return [];
  const headers = records[0].map(h => h.trim());
  return records.slice(1).map(cells => {
    const row = {};
    headers.forEach((h, i) => { row[h] = (cells[i] != null ? cells[i] : '').trim(); });
    return row;
  });
}

function seedFromRice(filePath) {
  if (!fs.existsSync(filePath)) die(`--seed-from: file not found: ${filePath}`);
  const rows = parseCsv(filePath);
  const map = new Map();
  for (const r of rows) {
    const issue = parseInt(r.issue, 10);
    if (!issue) continue;
    map.set(issue, {
      issue,
      title: r.title || '',
      type:  r.type  || '',
      I:     parseFloat(r.I) || null,
      C:     r.C_pct ? parseFloat(r.C_pct) / 100 : null,
      E:     r.E_hrs ? easeFromEhrs(r.E_hrs) : null,
      yegor_priority: parseInt(r.yegor_priority, 10) || null,
      actionable:     r.actionable || 'Y',
      labels:         r.labels     || '',
      notes:          r.notes      || '',
    });
  }
  log(`Seeded ${map.size} rows from ${filePath}`);
  return map;
}

// ── Interactive prompting ─────────────────────────────────────────────────────

function makeRl() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

async function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

const VALID_I = new Set([0.25, 0.5, 1, 2, 3]);
const VALID_C = new Set([0.5, 0.8, 1.0]);
const VALID_E = new Set([1, 3, 5, 7, 10]);

async function promptIssue(rl, issue, existing) {
  console.log(`\n── Issue #${issue.number}: ${issue.title}`);
  const { hint, def: defI } = detectSeverityHint(issue.labels);
  if (hint) console.log(`   Severity: ${hint}`);

  const defActionable = detectActionable(issue.labels);

  const parseNum = (s, valid, def) => {
    const n = parseFloat(s);
    if (!s.trim() || isNaN(n)) return def;
    if (valid && !valid.has(n)) { console.log(`   (invalid; using ${def})`); return def; }
    return n;
  };

  const I = parseNum(await ask(rl, `  I [0.25/0.5/1/2/3, default ${defI}]: `), VALID_I, defI);
  const C = parseNum(await ask(rl, `  C [0.5/0.8/1.0, default 0.8]: `), VALID_C, 0.8);
  const E = parseNum(await ask(rl, `  E [1/3/5/7/10, default 5]: `), VALID_E, 5);

  const actRaw = await ask(rl, `  actionable? [Y/n, default ${defActionable}]: `);
  const actionable = actRaw.trim().toLowerCase() === 'n' ? 'N' : defActionable;

  const defType = existing?.type || '';
  const typeRaw = await ask(rl, `  type [bug/feature/research/docs/chore, default "${defType}"]: `);
  const type = typeRaw.trim() || defType;

  const defYegor = existing?.yegor_priority ?? '';
  const yegorRaw = await ask(rl, `  yegor_priority [0-10, default "${defYegor}"]: `);
  // Guard against `|| null` collapsing a valid priority of 0 to "unset".
  let yegor_priority;
  if (yegorRaw.trim()) {
    const n = parseInt(yegorRaw, 10);
    yegor_priority = Number.isNaN(n) ? null : n;
  } else {
    yegor_priority = defYegor === '' ? null : defYegor;
  }

  const defNotes = existing?.notes || '';
  const notesRaw = await ask(rl, `  notes [default "${defNotes}"]: `);
  const notes = notesRaw.trim() || defNotes;

  return { I, C, E, actionable, type, yegor_priority, notes };
}

// ── Set-tier path ─────────────────────────────────────────────────────────────

async function setTier(db, issueNum, tier, opts, dryRun) {
  if (!['critical', 'elevated'].includes(tier)) die('--set-tier must be "critical" or "elevated"');

  let { who, why, expiry } = opts;
  if (!who || !why || !expiry) {
    const rl = makeRl();
    if (!who)    who    = await ask(rl, 'Who is escalating? ');
    if (!why)    why    = await ask(rl, 'Why (one sentence)? ');
    if (!expiry) expiry = await ask(rl, 'Expiry (until when/what event)? ');
    rl.close();
  }

  const comment = `**Priority escalation — ${tier}**\n- **Who:** ${who}\n- **Why:** ${why}\n- **Expiry:** ${expiry}`;

  // Remove opposite tier label if present
  const oppositeTier = tier === 'critical' ? 'elevated' : 'critical';

  if (dryRun) {
    log(`[dry-run] would apply label priority:${tier} to #${issueNum}`);
    log(`[dry-run] would remove label priority:${oppositeTier} from #${issueNum} (if present)`);
    log(`[dry-run] would post comment:\n${comment}`);
  } else {
    // Both the label and the audit comment are mandatory (see "Audit trail required"
    // in the rubric). If either gh write fails — gh offline, auth expired, or the
    // priority:* label was never created — we must NOT record the tier in the DB and
    // must NOT claim success: doing so leaves the DB asserting an escalation that has
    // no label and no audit trail (#963). The opposite-tier *remove* stays
    // best-effort — it legitimately no-ops when that label isn't on the issue.
    const addOk = sh(`gh issue edit ${issueNum} --add-label "priority:${tier}"`, true);
    sh(`gh issue edit ${issueNum} --remove-label "priority:${oppositeTier}"`, true);
    const bodyEscaped = comment.replace(/'/g, "'\\''");
    const commentOk = sh(`gh issue comment ${issueNum} --body '${bodyEscaped}'`, true);

    if (addOk == null || commentOk == null) {
      const failed = [
        addOk == null     ? `label priority:${tier}` : null,
        commentOk == null ? 'audit comment'          : null,
      ].filter(Boolean).join(' and ');
      die(`gh write failed (${failed}) for #${issueNum} — tier NOT recorded. ` +
          `An escalation requires both the label and the mandatory audit comment; ` +
          `the DB was left unchanged. Re-run when gh is available.`);
    }
    log(`Applied priority:${tier} to #${issueNum} with audit comment`);
  }

  // Update DB (only reached in dry-run or after both gh writes succeeded)
  const existing = db.prepare('SELECT * FROM ice_scores WHERE issue = ?').get(issueNum);
  const now = new Date().toISOString();
  if (existing) {
    if (!dryRun) db.prepare('UPDATE ice_scores SET tier = ?, updated_iso = ? WHERE issue = ?').run(tier, now, issueNum);
  } else {
    log(`warn: #${issueNum} not yet scored — tier stored without ICE values`);
    if (!dryRun) {
      db.prepare(
        'INSERT OR REPLACE INTO ice_scores (issue, tier, updated_iso) VALUES (?, ?, ?)'
      ).run(issueNum, tier, now);
    }
  }
}

// ── Upsert rows to DB ─────────────────────────────────────────────────────────

function upsertRows(db, rows, dryRun) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO ice_scores
      (issue, title, type, I, C, E, ice_score, tier, yegor_priority, actionable, labels, notes, updated_iso)
    VALUES
      (@issue, @title, @type, @I, @C, @E, @ice_score, @tier, @yegor_priority, @actionable, @labels, @notes, @updated_iso)
  `);
  const now = new Date().toISOString();
  let count = 0;
  for (const r of rows) {
    const row = {
      issue:          r.issue,
      title:          r.title          ?? null,
      type:           r.type           ?? null,
      I:              r.I              ?? null,
      C:              r.C              ?? null,
      E:              r.E              ?? null,
      ice_score:      (r.I != null && r.C != null && r.E != null) ? computeIce(r.I, r.C, r.E) : null,
      tier:           r.tier           ?? '',
      yegor_priority: r.yegor_priority ?? null,
      actionable:     r.actionable     ?? 'Y',
      labels:         r.labels         ?? null,
      notes:          r.notes          ?? null,
      updated_iso:    now,
    };
    if (dryRun) {
      const ice = row.ice_score != null ? row.ice_score.toFixed(4) : '?';
      log(`[dry-run] #${row.issue}: I=${row.I} C=${row.C} E=${row.E} → ICE=${ice}`);
    } else {
      stmt.run(row);
    }
    count++;
  }
  return count;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = opts.dryRun;

  if (dryRun) log('dry-run mode — no writes or gh mutations');

  // 1. Label bootstrap
  ensureLabels(dryRun);

  // 2. Open DB
  const db = openDb();

  // 3. --set-tier path (independent of scoring)
  if (opts.setTier) {
    if (!opts.issue) die('--set-tier requires --issue N');
    await setTier(db, opts.issue, opts.setTier, opts, dryRun);
    if (!dryRun) {
      const ranked = exportCsv(db, CSV_PATH);
      exportMd(ranked, effectiveMdPath, null);
    }
    db.close();
    return;
  }

  // 4. --export-only: just re-export from DB
  if (opts.exportOnly) {
    const ranked = exportCsv(db, CSV_PATH);
    exportMd(ranked, effectiveMdPath, null);
    db.close();
    return;
  }

  // 5. Load existing DB rows
  const dbRows = db.prepare('SELECT * FROM ice_scores').all();
  const scored  = new Map(dbRows.map(r => [r.issue, r]));

  // 6. Determine work set ────────────────────────────────────────────────────
  let workRows = [];    // rows to score/upsert

  if (opts.scores) {
    // Batch mode: JSON positional/flag
    let batchObj;
    try { batchObj = JSON.parse(opts.scores); } catch (e) { die(`Invalid JSON: ${e.message}`); }

    const openIssues = fetchOpenIssues();
    const issueMap   = openIssues ? new Map(openIssues.map(i => [i.number, i])) : new Map();

    for (const [numStr, fields] of Object.entries(batchObj)) {
      const num   = parseInt(numStr, 10);
      const ghIssue = issueMap.get(num);
      const prev  = scored.get(num) || {};
      workRows.push({
        issue:          num,
        title:          ghIssue?.title ?? prev.title ?? null,
        type:           fields.type           ?? prev.type           ?? null,
        I:              fields.I              ?? prev.I              ?? null,
        C:              fields.C              ?? prev.C              ?? null,
        E:              fields.E              ?? prev.E              ?? null,
        tier:           (ghIssue ? detectTier(ghIssue.labels) : null) ?? prev.tier ?? '',
        yegor_priority: fields.yegor_priority ?? prev.yegor_priority ?? null,
        actionable:     fields.actionable     ?? (ghIssue ? detectActionable(ghIssue.labels) : null) ?? prev.actionable ?? 'Y',
        labels:         ghIssue ? (ghIssue.labels || []).map(l => l.name).join(';') : (prev.labels ?? null),
        notes:          fields.notes          ?? prev.notes          ?? null,
      });
    }

  } else if (opts.seedFrom) {
    // Migration mode: seed from rice-scores.csv
    const riceMap = seedFromRice(opts.seedFrom);
    const openIssues = fetchOpenIssues();
    const issueMap   = openIssues ? new Map(openIssues.map(i => [i.number, i])) : new Map();

    for (const [num, r] of riceMap) {
      if (opts.issue && num !== opts.issue) continue;  // single-issue filter
      const ghIssue = issueMap.get(num);
      const prev = scored.get(num) || {};
      workRows.push({
        issue:          num,
        title:          ghIssue?.title ?? r.title ?? prev.title ?? null,
        type:           r.type           ?? prev.type           ?? null,
        I:              r.I              ?? prev.I              ?? null,
        C:              r.C              ?? prev.C              ?? null,
        E:              r.E              ?? prev.E              ?? null,
        tier:           (ghIssue ? detectTier(ghIssue.labels) : null) ?? prev.tier ?? '',
        yegor_priority: r.yegor_priority ?? prev.yegor_priority ?? null,
        actionable:     r.actionable     ?? (ghIssue ? detectActionable(ghIssue.labels) : null) ?? prev.actionable ?? 'Y',
        labels:         ghIssue ? (ghIssue.labels || []).map(l => l.name).join(';') : (r.labels ?? prev.labels ?? null),
        notes:          r.notes          ?? prev.notes          ?? null,
      });
    }

  } else {
    // Interactive mode: prompt for unscored open issues
    const openIssues = fetchOpenIssues();
    if (!openIssues) die('gh unavailable — cannot fetch open issues. Use --scores for batch mode.');

    const targets = opts.issue
      ? openIssues.filter(i => i.number === opts.issue)
      : openIssues.filter(i => !scored.has(i.number));

    if (!targets.length) {
      log(opts.issue
        ? `Issue #${opts.issue} not found in open issues (already closed, or wrong number).`
        : 'All open issues are already scored. Use --issue N to re-score one, or --export-only to refresh output.');
    } else {
      const rl = makeRl();
      for (const issue of targets) {
        const prev = scored.get(issue.number);
        const fields = await promptIssue(rl, issue, prev);
        workRows.push({
          issue:  issue.number,
          title:  issue.title,
          tier:   detectTier(issue.labels),
          labels: (issue.labels || []).map(l => l.name).join(';'),
          ...fields,
        });
      }
      rl.close();
    }
  }

  // 7. Also sync tier for already-scored issues from live gh labels
  if (!opts.seedFrom && !opts.scores) {
    const openIssues = fetchOpenIssues();
    if (openIssues) {
      for (const gi of openIssues) {
        const existing = scored.get(gi.number);
        if (!existing) continue;
        const liveTier = detectTier(gi.labels);
        if (liveTier !== (existing.tier || '')) {
          workRows.push({ ...existing, tier: liveTier });
        }
      }
    }
  }

  // 8. Upsert + export
  const count = upsertRows(db, workRows, dryRun);
  if (count > 0) log(`Scored/updated ${count} issue(s)`);

  if (!dryRun) {
    const ranked = exportCsv(db, CSV_PATH);
    exportMd(ranked, effectiveMdPath, null);
  } else {
    // Dry-run: show what the current DB would produce
    const existing = db.prepare('SELECT * FROM ice_scores').all();
    if (existing.length) {
      const ranked = rankRows(existing);
      log(`[dry-run] current DB has ${existing.length} scored issues; top 5:`);
      rankRows(existing).slice(0, 5).forEach(r =>
        log(`  #${r.issue} (${r.tier || 'normal'}) ICE=${formatIce(r.ice_score)} "${r.title || ''}"`));
    }
  }

  db.close();
}

// Pure, side-effect-free helpers are exported for unit testing (#965). Importing
// this module must NOT run the pipeline — main() is gated on direct invocation so
// that `require('./ice-score.js')` only loads the functions (no DB open, no gh
// calls, no file writes).
module.exports = {
  computeIce,
  finalScore,
  sortRows,
  rankRows,
  easeFromEhrs,
  parseRecords,
  parseCsv,
  encodeField,
  encodeRow,
};

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
