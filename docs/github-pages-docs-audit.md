# TIL: Issue #1123 - Doc Section Curation for Public GitHub Pages Site

## Inventory of Currently Deployed Sections (per `scripts/build-site.js` `DOCS_SECTIONS`)

| Section | ~Pages | Source | Currently Deployed? |
|---------|--------|--------|---------------------|
| `guides` | 2 | `docs/guides/` (folder) | YES |
| `glossary` | 5 | `docs/glossary/` (folder) | YES |
| `parity` | 6 | Explicit file list | YES |
| `workflow` | 2 | Explicit file list | YES |
| `research` | ~100 | `docs/research/` (folder) | YES |
| `learnings` | ~130 | `docs/learnings/` (folder) | YES |

**Total: ~245 pages** deployed to public GitHub Pages site.

---

## Recommendations

### ✅ KEEP — User-facing educational content

| Section | Rationale |
|---------|-----------|
| `guides` (2 pages) | Teaches LCC features: `reveal-md-lcc-slides.md`, `lcc-code-blocks.md`. Public-appropriate, low count. |
| `glossary` (5 pages) | Reference for LCC/assembly terms: assembler.md, interpreter.md, linker.md, stats-analysis.md, README.md. Useful for users. |
| `parity` (6 pages) | Technical but relevant: `parity_deviations.md` + 5 cuh63 bug reports. Documents known divergences from oracle — valuable for power users/contributors. |

### ⚠️ CURATE — Selective inclusion from large internal sections

| Section | Total | Recommendation | Rationale |
|---------|-------|----------------|-----------|
| `research` | ~100 | **Keep ~10-15**, drop rest | Many are spike outputs/design docs for specific tickets. Keep: `lezer-grammar-lcc-assembly.md`, `mnemonic-descriptor-table.md`, `playground-e2e-test-strategy.md`, `codemirror-feature-inventory.md`, `web-ilcc-terminal-simulation.md`. Drop: ticket-specific spikes, old triage docs, internal audits. |
| `learnings` | ~130 | **Keep ~10-15**, drop rest | TILs are agent retrospectives with internal names (APPLE/BANANA/CHERRY), velocity protocol details, workflow minutiae. Keep synthesis/overview docs only: `README.md`, `til-synthesis-2026-06-01.md`, `til-synthesis-2026-06-04.md`, `2026-05-26-pdd-adoption.md`, `2026-05-25-lcc-oracle-e2e-bst-redundancy.md`. Drop per-agent daily entries. |

### ❌ EXCLUDE — Internal engineering/process artifacts

| Section | Pages | Rationale |
|---------|-------|-----------|
| `workflow` | 2 | `claude_workflow.md` (45KB) + `RULES.md` — internal multi-agent PDD process, fruit-agent identities, Yegor methodology. Not educational. |
| `agent-priorities/` | ~8 | Per-agent priority files (APPLE.md, BANANA.md, etc.) — purely internal coordination. |
| `logs/` | ~2 | Per-ticket work logs with agent names — internal. |
| `experiments/`, `textbook_demos/` | N/A | Not currently deployed but worth noting as non-candidates. |

---

## Implementation Approach

1. **Modify `DOCS_SECTIONS` in `scripts/build-site.js`** to:
   - Keep `guides`, `glossary`, `parity` as-is (folder/explicit lists)
   - Replace `research` folder with explicit file list of ~10 curated files
   - Replace `learnings` folder with explicit file list of ~10 curated files
   - Remove `workflow` entirely

2. **Expected result**: ~245 pages → ~35-40 pages (85% reduction), all user-facing.

3. **Follow-up ticket**: Implement file/directory whitelist/blacklist mechanism to make this maintainable going forward (per issue description).

---

## Human Decision Required

This is a `human-required` + `pair-work` ticket. Please review the keep/curate/exclude breakdown above and confirm:
- [ ] `guides` → KEEP all
- [ ] `glossary` → KEEP all
- [ ] `parity` → KEEP all
- [ ] `workflow` → EXCLUDE entirely
- [ ] `research` → CURATE (I'll provide explicit file list after your direction)
- [ ] `learnings` → CURATE (I'll provide explicit file list after your direction)

Once confirmed, I'll file the implementation ticket(s) with the exact `DOCS_SECTIONS` changes.