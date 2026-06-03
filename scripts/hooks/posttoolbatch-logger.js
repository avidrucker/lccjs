#!/usr/bin/env node
// Temporary payload logger for #349 schema discovery.
// Run once, read /tmp/ptb-payload.json, then replace with serial-tool-guard.js.
// Remove PostToolBatch registration from settings.json when done.
const fs = require('fs');
const chunks = [];
process.stdin.on('data', d => chunks.push(d));
process.stdin.on('end', () => {
  const raw = Buffer.concat(chunks).toString('utf8');
  fs.writeFileSync('/tmp/ptb-payload.json', raw);
  process.exit(0);
});
