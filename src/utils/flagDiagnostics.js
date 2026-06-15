'use strict';

// Build one grouped warning line for a set of flags, or null if the set is empty.
// "Flag {-x} <singular>." for one flag; "Flags {-x, -y} <plural>." for several.
function groupLine(flags, singular, plural) {
  if (!flags.length) return null;
  const many = flags.length > 1;
  return `${many ? 'Flags' : 'Flag'} {${flags.join(', ')}} ${many ? plural : singular}.`;
}

// formatFlagDiagnostics({ unknown, unimplemented }) — build the warning line(s)
// for flags that are unknown or known-but-unimplemented. Pure; returns string[]
// (empty when both groups are empty). The unknown line comes first. Both
// categories are non-blocking warnings (the caller continues). See #1373.
function formatFlagDiagnostics({ unknown = [], unimplemented = [] } = {}) {
  return [
    groupLine(unknown, 'is not a known LCCjs flag', 'are not known LCCjs flags'),
    groupLine(unimplemented, 'has not yet been implemented', 'have not yet been implemented'),
  ].filter(Boolean);
}

module.exports = { formatFlagDiagnostics };
