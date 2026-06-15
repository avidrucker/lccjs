'use strict';
// Unit tests for scripts/rules-render.js — the RULES.json → RULES.md generator (#1318).
// Covers the lean-Hybrid render contract (banner + verbatim preamble/footer + numbered
// ACTIVE-only list), the version-bump-on-text-change logic, and a freshness guard that
// the committed RULES.md actually matches what the source renders.

const fs = require('fs');
const path = require('path');
const { syncVersions, renderMd, BANNER } = require('../../scripts/rules-render');
const { textSha, rulesetSha } = require('../../scripts/rules-id');

const ROOT = path.join(__dirname, '..', '..');

function fixtureDoc() {
  const rules = [
    { id: 'crimson-otter', legacy_id: 'R001', version: 1, status: 'active', text: 'Rule one.' },
    { id: 'azure-lynx', legacy_id: 'R002', version: 3, status: 'active', text: 'Rule two.' },
    { id: 'jade-ibex', legacy_id: 'R003', version: 1, status: 'relocated', relocated_to: 'docs/x.md', text: 'Relocated rule.' },
  ];
  for (const r of rules) r.text_sha = textSha(r.text);
  return { preamble: '# RULES\n\nintro\n\n---', footer: '---\n\n## footnote', ruleset_sha: rulesetSha(rules), rules };
}

describe('renderMd()', () => {
  test('starts with the do-not-edit banner', () => {
    expect(renderMd(fixtureDoc()).startsWith(BANNER)).toBe(true);
  });

  test('banner is HTML comment(s) with the #1203 verbatim loud line first', () => {
    expect(BANNER.startsWith("<!-- AUTOGEN'D FILE, DO NOT EDIT MANUALLY/DIRECTLY -->")).toBe(true);
    expect(BANNER.endsWith('-->')).toBe(true);
    expect(BANNER).toMatch(/rules:render/);
  });

  test('numbers only active rules, in order, lean (text only)', () => {
    const md = renderMd(fixtureDoc());
    expect(md).toContain('1. Rule one.');
    expect(md).toContain('2. Rule two.');
    // relocated rule is excluded from the numbered list
    expect(md).not.toContain('Relocated rule.');
    expect(md).not.toContain('3. ');
  });

  test('passes preamble and footer through verbatim', () => {
    const md = renderMd(fixtureDoc());
    expect(md).toContain('# RULES\n\nintro\n\n---');
    expect(md).toContain('---\n\n## footnote');
  });

  test('ends with a single trailing newline', () => {
    const md = renderMd(fixtureDoc());
    expect(md.endsWith('## footnote\n')).toBe(true);
    expect(md.endsWith('\n\n')).toBe(false);
  });

  test('is deterministic', () => {
    expect(renderMd(fixtureDoc())).toBe(renderMd(fixtureDoc()));
  });
});

describe('syncVersions()', () => {
  test('is a no-op when every text_sha already matches', () => {
    const doc = fixtureDoc();
    const before = JSON.parse(JSON.stringify(doc));
    expect(syncVersions(doc)).toBe(false);
    expect(doc.rules.map((r) => r.version)).toEqual(before.rules.map((r) => r.version));
    expect(doc.ruleset_sha).toBe(before.ruleset_sha);
  });

  test('bumps version + text_sha when a rule text changes', () => {
    const doc = fixtureDoc();
    doc.rules[0].text = 'Rule one, revised.';
    expect(syncVersions(doc)).toBe(true);
    expect(doc.rules[0].version).toBe(2); // 1 -> 2
    expect(doc.rules[0].text_sha).toBe(textSha('Rule one, revised.'));
    expect(doc.ruleset_sha).toBe(rulesetSha(doc.rules));
  });

  test('does NOT bump when only metadata (not text) changes', () => {
    const doc = fixtureDoc();
    doc.rules[1].comment = 'new rationale';
    doc.rules[1].category = 'workflow';
    expect(syncVersions(doc)).toBe(false);
    expect(doc.rules[1].version).toBe(3);
  });
});

describe('committed artifact freshness', () => {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'RULES.json'), 'utf8'));

  test('RULES.json version metadata is in sync with rule text (not stale)', () => {
    expect(syncVersions(JSON.parse(JSON.stringify(doc)))).toBe(false);
  });

  test('committed RULES.md matches what RULES.json renders', () => {
    const committed = fs.readFileSync(path.join(ROOT, 'RULES.md'), 'utf8');
    expect(renderMd(doc)).toBe(committed);
  });
});
