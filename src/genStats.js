// genStats.js

function generateBSTLSTContent(options) {
  const {
    isBST,
    interpreter, // May be undefined
    assembler, // May be undefined
    userName,
    inputFileName,
  } = options;

  let content = '';

  // Header
  content += `LCC.js Assemble/Link/Interpret/Debug Ver 0.1  ${new Date().toLocaleString('en-US', {
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

  // Only if headerLines exist
  if (assembler && assembler.headerLines && assembler.headerLines.length > 0) {
    for (let i = 0; i < assembler.headerLines.length; i++) {
      content += `${assembler.headerLines[i]}\n`;
    }
  } else if (interpreter && interpreter.headerLines && interpreter.headerLines.length > 0) {
    for (let i = 0; i < interpreter.headerLines.length; i++) {
      content += `${interpreter.headerLines[i]}\n`;
    }
  }

  content += 'C\n\n';

  // Output code
  if (assembler && assembler.listing) {
    content += 'Loc   Code           Source Code\n';

    // Output code with source code from assembler
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
          lineStr += ` ${sourceStr}`;
        }

        content += `${lineStr}\n`;

        locCtr++; // Increment location counter
      });
    });
  } else if (interpreter && interpreter.mem) {
    content += 'Loc   Code\n';

    // Output code from interpreter's memory
    for (let addr = 0; addr <= interpreter.memMax; addr++) {
      const locStr = addr.toString(16).padStart(4, '0');
      const word = interpreter.mem[addr];
      const wordStr = isBST
        ? word.toString(2).padStart(16, '0').replace(/(.{4})/g, '$1 ').trim()
        : word.toString(16).padStart(4, '0');
      content += `${locStr}  ${wordStr}\n`;
    }
  }

  // Output Output section and Program statistics if interpreter is provided
  if (interpreter) {
    content += '====================================================== Output\n';
    content += `${interpreter.output}\n`;

    content += '========================================== Program statistics\n';

    // Prepare the statistics
    const stats = [
      { label: 'Input file name', value: inputFileName },
      {
        label: 'Instructions executed',
        value: `${interpreter.instructionsExecuted.toString(16)} (hex)    ${interpreter.instructionsExecuted} (dec)`,
      },
      {
        label: 'Program size',
        value: `${(interpreter.memMax + 1).toString(16)} (hex)    ${interpreter.memMax + 1} (dec)`,
      },
      {
        label: 'Max stack size',
        value: `${interpreter.maxStackSize.toString(16)} (hex)    ${interpreter.maxStackSize} (dec)`,
      },
      {
        label: 'Load point',
        value: `${interpreter.loadPoint.toString(16)} (hex)    ${interpreter.loadPoint} (dec)`,
      }
    ];

    const maxStatLabelLength = Math.max(...stats.map((s) => s.label.length));

    stats.forEach((stat) => {
      const label = stat.label.padEnd(maxStatLabelLength + 4); // Add 4 spaces for padding
      content += `${label}=   ${stat.value}\n`;
    });
  }

  return content;
}

module.exports = {
  generateBSTLSTContent,
};