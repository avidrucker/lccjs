'use strict';

// Flags that LCCjs knowingly handles differently from LCC (the original
// source-of-truth implementation that LCCjs mirrors). Each maps to a per-flag,
// user-facing explanation of why the flag is a no-op here. Messages say "LCC"
// (not "oracle"/"OG") so users don't need internal vocabulary; the full
// rationale and the terminology lives in docs/parity_deviations.md. See #1371.
const FLAG_DEVIATIONS = {
  '-f': 'has no effect: LCCjs never truncates .lst/.bst listing lines (a deliberate difference from LCC).',
};

// Build one grouped warning line for a set of flags, or null if the set is empty.
// "Flag {-x} <singular>." for one flag; "Flags {-x, -y} <plural>." for several.
function groupLine(flags, singular, plural) {
  if (!flags.length) return null;
  const many = flags.length > 1;
  return `${many ? 'Flags' : 'Flag'} {${flags.join(', ')}} ${many ? plural : singular}.`;
}

// formatFlagDiagnostics({ unknown, unimplemented, deviated }) — build the
// warning line(s) for flags that are unknown, known-but-unimplemented, or a
// documented LCCjs deviation. Pure; returns string[] (empty when nothing
// applies). Order: unknown, unimplemented, then per-flag deviation lines. All
// categories are non-blocking warnings (the caller continues). See #1373/#1371.
function formatFlagDiagnostics({ unknown = [], unimplemented = [], deviated = [] } = {}) {
  const lines = [
    groupLine(unknown, 'is not a known LCCjs flag', 'are not known LCCjs flags'),
    groupLine(unimplemented, 'has not yet been implemented', 'have not yet been implemented'),
  ];
  for (const flag of deviated) {
    if (FLAG_DEVIATIONS[flag]) lines.push(`Flag {${flag}} ${FLAG_DEVIATIONS[flag]}`);
  }
  return lines.filter(Boolean);
}

module.exports = { formatFlagDiagnostics, FLAG_DEVIATIONS };
