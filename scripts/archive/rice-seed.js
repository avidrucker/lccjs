#!/usr/bin/env node
/**
 * RETIRED (#997) — RICE was superseded by ICE in #956. Use `npm run ice:score`
 * (scripts/ice-score.js) instead. This file is kept here as a historical reference
 * only; its npm script (`rice:seed`) was removed from package.json.
 *
 * rice-seed.js — create the rice table in ~/.lccjs/lccjs.db and seed from
 * stats/rice-scores.csv.
 *
 * Idempotent with --force (drops and recreates the table). Without --force,
 * exits non-zero if rows already exist to prevent accidental re-seed.
 *
 * Usage:
 *   node scripts/rice-seed.js           # seed (fails if rows exist)
 *   node scripts/rice-seed.js --force   # drop + recreate + seed
 *   npm run rice:seed
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { DB_PATH } = require('./db-path');

const FORCE = process.argv.includes('--force');
const CSV   = path.join(__dirname, '..', 'stats', 'rice-scores.csv');

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS rice (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  issue          INTEGER NOT NULL,
  title          TEXT,
  type           TEXT,
  r              REAL,
  i              REAL,
  c_pct          REAL,
  e_hrs          REAL,
  rice_score     REAL,
  rice_rank      INTEGER,
  yegor_priority INTEGER,
  actionable     TEXT,
  labels         TEXT,
  notes          TEXT,
  scored_iso     TEXT,
  scored_by      TEXT,
  repo           TEXT DEFAULT 'lccjs'
);
`.trim();

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS rice_issue  ON rice (issue);`,
  `CREATE INDEX IF NOT EXISTS rice_rank   ON rice (rice_rank);`,
];

// Parse a single RFC 4180 CSV line.
function parseCSVLine(line) {
  const fields = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let val = '';
      i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { val += line[i++]; }
      }
      fields.push(val);
      if (line[i] === ',') i++;
    } else {
      const end = line.indexOf(',', i);
      if (end === -1) { fields.push(line.slice(i)); break; }
      fields.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return fields;
}

function toNum(s)  { if (s === '' || s == null) return null; const n = Number(s); return isNaN(n) ? null : n; }
function toStr(s)  { return (s === '' || s == null) ? null : s; }
function toInt(s)  { if (s === '' || s == null) return null; const n = parseInt(s, 10); return isNaN(n) ? null : n; }

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

if (FORCE) {
  db.exec('DROP TABLE IF EXISTS rice;');
  console.log('Dropped existing rice table (--force)');
} else {
  db.exec(CREATE_TABLE);
  const count = db.prepare('SELECT COUNT(*) as n FROM rice').get();
  if (count && count.n > 0) {
    console.error(`Error: rice table already has ${count.n} rows. Use --force to re-seed.`);
    process.exit(1);
  }
}

db.exec(CREATE_TABLE);
for (const idx of INDEXES) db.exec(idx);

// Read and parse the existing CSV
const lines = fs.readFileSync(CSV, 'utf8').split('\n').map(l => l.replace(/\r$/, '')).filter(Boolean);
let headerCols = null;
const rows = [];

for (const line of lines) {
  if (line.startsWith('#')) continue;
  const fields = parseCSVLine(line);
  if (!headerCols) { headerCols = fields; continue; }
  rows.push(fields);
}

// CSV header: issue,title,type,R,I,C_pct,E_hrs,rice_score,rice_rank,yegor_priority,actionable,labels,notes
// Some exports add extra columns (scored_iso, scored_by, repo) — handle both widths.
const h = headerCols;
const idx = (name) => h.findIndex(c => c.toLowerCase() === name.toLowerCase());

const iIssue   = idx('issue');
const iTitle   = idx('title');
const iType    = idx('type');
const iR       = idx('R') !== -1 ? idx('R') : idx('r');
const iI       = idx('I') !== -1 ? idx('I') : idx('i');
const iCpct    = idx('C_pct') !== -1 ? idx('C_pct') : idx('c_pct');
const iEhrs    = idx('E_hrs') !== -1 ? idx('E_hrs') : idx('e_hrs');
const iScore   = idx('rice_score');
const iRank    = idx('rice_rank');
const iYegor   = idx('yegor_priority');
const iAction  = idx('actionable');
const iLabels  = idx('labels');
const iNotes   = idx('notes');
const iIso     = idx('scored_iso');
const iBy      = idx('scored_by');
const iRepo    = idx('repo');

console.log(`Parsed ${rows.length} data rows from CSV`);

const insert = db.prepare(`
  INSERT INTO rice
    (issue, title, type, r, i, c_pct, e_hrs, rice_score, rice_rank,
     yegor_priority, actionable, labels, notes, scored_iso, scored_by, repo)
  VALUES
    (@issue, @title, @type, @r, @i, @c_pct, @e_hrs, @rice_score, @rice_rank,
     @yegor_priority, @actionable, @labels, @notes, @scored_iso, @scored_by, @repo)
`);

const insertMany = db.transaction((rs) => {
  for (const r of rs) {
    insert.run({
      issue:          toInt(r[iIssue]),
      title:          toStr(r[iTitle]),
      type:           toStr(r[iType]),
      r:              toNum(r[iR]),
      i:              toNum(r[iI]),
      c_pct:          toNum(r[iCpct]),
      e_hrs:          toNum(r[iEhrs]),
      rice_score:     toNum(r[iScore]),
      rice_rank:      toInt(r[iRank]),
      yegor_priority: toInt(r[iYegor]),
      actionable:     toStr(r[iAction]),
      labels:         toStr(r[iLabels]),
      notes:          toStr(r[iNotes]),
      // Use existing scored_iso/scored_by if the CSV has them; otherwise use backfill defaults.
      scored_iso:     iIso  !== -1 ? toStr(r[iIso])  : '2026-06-05T00:00:00-1000',
      scored_by:      iBy   !== -1 ? toStr(r[iBy])   : 'DRAGONFRUIT',
      repo:           iRepo !== -1 ? toStr(r[iRepo])  : 'lccjs',
    });
  }
});

insertMany(rows);

const final = db.prepare('SELECT COUNT(*) as n FROM rice').get();
console.log(`Seeded ${final.n} rows into ${DB_PATH}`);
db.close();
