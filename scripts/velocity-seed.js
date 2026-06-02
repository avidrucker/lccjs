#!/usr/bin/env node
/**
 * velocity-seed.js — seed ~/.lccjs/velocity.db from docs/puzzle-velocity.csv.
 *
 * Run after docs/puzzle-velocity.csv has been repaired (#276). Idempotent
 * with --force (drops and recreates the table). Without --force, exits non-zero
 * if the table already has rows to prevent accidental re-seed.
 *
 * Usage:
 *   node scripts/velocity-seed.js           # seed (fails if rows exist)
 *   node scripts/velocity-seed.js --force   # drop + recreate + seed
 */
'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const readline = require('readline');
const Database = require('better-sqlite3');

const FORCE   = process.argv.includes('--force');
const DB_DIR  = path.join(os.homedir(), '.lccjs');
const DB_PATH = path.join(DB_DIR, 'velocity.db');
const CSV     = path.join(__dirname, '..', 'docs', 'puzzle-velocity.csv');

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS velocity (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket        INTEGER,
  title         TEXT,
  role          TEXT,
  h_min         REAL,
  c_min         REAL,
  actual_min    REAL,
  delta_h_min   REAL,
  delta_c_min   REAL,
  started_iso   TEXT,
  finished_iso  TEXT,
  closed_commit TEXT,
  notes         TEXT,
  agent         TEXT,
  model         TEXT,
  repo          TEXT DEFAULT 'lccjs'
);
`.trim();

// Parse a single CSV line respecting RFC 4180 quote-doubling.
// Handles quoted fields (including embedded commas and "" escapes).
function parseCSVLine(line) {
  const fields = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field
      let val = '';
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          val += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++; // skip closing quote
          break;
        } else {
          val += line[i++];
        }
      }
      fields.push(val);
      if (line[i] === ',') i++; // skip delimiter
    } else {
      // Unquoted field
      const end = line.indexOf(',', i);
      if (end === -1) {
        fields.push(line.slice(i));
        break;
      }
      fields.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return fields;
}

// Convert empty string to null; parse numbers where expected.
function toNum(s) {
  if (s === '' || s == null) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}
function toStr(s) {
  return (s === '' || s == null) ? null : s;
}

async function main() {
  // Ensure ~/.lccjs/ exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    console.log(`Created ${DB_DIR}`);
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  if (FORCE) {
    db.exec('DROP TABLE IF EXISTS velocity;');
    console.log('Dropped existing velocity table (--force)');
  } else {
    db.exec(CREATE_TABLE);
    const count = db.prepare('SELECT COUNT(*) as n FROM velocity').get();
    if (count && count.n > 0) {
      console.error(`Error: velocity table already has ${count.n} rows. Use --force to re-seed.`);
      process.exit(1);
    }
  }

  db.exec(CREATE_TABLE);

  // Read and parse CSV
  const lines = fs.readFileSync(CSV, 'utf8').split('\n').filter(Boolean);
  let headerCols = null;
  const rows = [];

  for (const line of lines) {
    if (line.startsWith('#')) continue; // comment header
    const fields = parseCSVLine(line);
    if (!headerCols) {
      headerCols = fields; // first non-comment line is the column header
      continue;
    }
    rows.push(fields);
  }

  console.log(`Parsed ${rows.length} data rows from CSV (${headerCols.length} columns)`);

  // CSV columns (0-indexed): id,ticket,title,role,h_min,c_min,actual_min,
  //   delta_h_min,delta_c_min,started_iso,finished_iso,closed_commit,notes,agent,model,repo
  const insert = db.prepare(`
    INSERT INTO velocity
      (ticket, title, role, h_min, c_min, actual_min, delta_h_min, delta_c_min,
       started_iso, finished_iso, closed_commit, notes, agent, model, repo)
    VALUES
      (@ticket, @title, @role, @h_min, @c_min, @actual_min, @delta_h_min, @delta_c_min,
       @started_iso, @finished_iso, @closed_commit, @notes, @agent, @model, @repo)
  `);

  const insertMany = db.transaction((rows) => {
    for (const r of rows) {
      insert.run({
        ticket:       toNum(r[1]),
        title:        toStr(r[2]),
        role:         toStr(r[3]),
        h_min:        toNum(r[4]),
        c_min:        toNum(r[5]),
        actual_min:   toNum(r[6]),
        delta_h_min:  toNum(r[7]),
        delta_c_min:  toNum(r[8]),
        started_iso:  toStr(r[9]),
        finished_iso: toStr(r[10]),
        closed_commit:toStr(r[11]),
        notes:        toStr(r[12]),
        agent:        toStr(r[13]),
        model:        toStr(r[14] ?? ''),
        repo:         toStr(r[15] ?? '') || 'lccjs',
      });
    }
  });

  insertMany(rows);

  const final = db.prepare('SELECT COUNT(*) as n FROM velocity').get();
  console.log(`Seeded ${final.n} rows into ${DB_PATH}`);
  db.close();
}

main().catch(err => { console.error(err.message); process.exit(1); });
