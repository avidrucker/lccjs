// genStats.js

const fs = require('fs');
const path = require('path');

function generateBSTLSTContent(options) {
  const {
    isBST,
    interpreter,
    assembler,
    includeSourceCode,
    userName,
    inputFileName,
  } = options;

  let content = '';

  // Header
  content += `LCC Assemble/Link/Interpret/Debug Ver 0.1  ${new Date().toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })}\n`;
  content += `${userName}\n\n`;

  content += 'Header\n';
  content += 'o\n';
  content += 'C\n\n';

  if (includeSourceCode && assembler) {
    content += 'Loc   Code           Source Code\n';

    // Output listing with source code
    assembler.listing.forEach((entry) => {
      let locCtr = entry.locCtr;

      entry.codeWords.forEach((word, index) => {
        const locStr = locCtr.toString(16).padStart(4, '0');
        const wordStr = isBST
          ? word.toString(2).padStart(16, '0').replace(/(.{4})/g, '$1 ').trim()
          : word.toString(16).padStart(4, '0');

        let lineStr = `${locStr}  ${wordStr.padEnd(10)}`;

        if (index === 0) {
          const labelStr = entry.label ? `${entry.label}: ` : '';
          const mnemonicAndOperands = entry.mnemonic
            ? `${entry.mnemonic} ${entry.operands.join(', ')}`
            : '';
          const sourceStr = `${labelStr}${mnemonicAndOperands}`.trim();
          lineStr += `  ${sourceStr}`;
        }

        content += `${lineStr}\n`;

        locCtr++; // Increment location counter
      });
    });
  } else {
    content += 'Loc   Code\n';

    // Output code without source code
    for (let addr = 0; addr <= interpreter.memMax; addr++) {
      const word = interpreter.mem[addr];
      const locStr = addr.toString(16).padStart(4, '0');
      const wordStr = isBST
        ? word.toString(2).padStart(16, '0').replace(/(.{4})/g, '$1 ').trim()
        : word.toString(16).padStart(4, '0');
      content += `${locStr}  ${wordStr}\n`;
    }
  }

  // Output section
  content += '====================================================== Output\n';
  content += `${interpreter.output}\n`;

  // Program statistics
  content += '========================================== Program statistics\n';

  // Prepare the statistics
  const stats = [
    { label: 'Input file name', value: inputFileName },
    {
      label: 'Instructions executed',
      value: `${interpreter.instructionsExecuted.toString(16)} (hex)     ${interpreter.instructionsExecuted} (dec)`,
    },
    {
      label: 'Program size',
      value: `${interpreter.memMax + 1} (hex)     ${interpreter.memMax + 1} (dec)`,
    },
    {
      label: 'Max stack size',
      value: `${interpreter.maxStackSize.toString(16)} (hex)     ${interpreter.maxStackSize} (dec)`,
    },
  ];

  const maxStatLabelLength = Math.max(...stats.map((s) => s.label.length));

  stats.forEach((stat) => {
    const label = stat.label.padEnd(maxStatLabelLength + 4); // Add 4 spaces for padding
    content += `${label}=   ${stat.value}\n`;
  });

  return content;
}

module.exports = {
  generateBSTLSTContent,
};
