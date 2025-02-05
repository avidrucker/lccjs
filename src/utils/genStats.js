// genStats.js

export function generateBSTLSTContent(options) {
  const {
    isBST,
    interpreter, // May be undefined
    assembler, // May be undefined
    userName,
    inputFileName,
    includeComments
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
    if (!options.includeComments) {
      content += 'Loc   Code           Source Code\n';
    } else {
      content += 'Loc   Code\n';
    }
  
    assembler.listing.forEach((entry) => {
      const codeWords = entry.codeWords;
      const macWord = entry.macWord;
  
      if (codeWords && codeWords.length > 0) {
        let locCtr = entry.locCtr;
  
        codeWords.forEach((word, index) => {
          const wordStr = isBST
            ? word.toString(2).padStart(16, '0').replace(/(.{4})/g, '$1 ').trim()
            : word.toString(16).padStart(4, '0');
  
          let lineStr = `${locCtr.toString(16).padStart(4, '0')}  ${wordStr.padEnd(10)}`;
  
          if (index === 0) {
            // Include source code
            lineStr += ` ${entry.sourceLine}`;
          }
  
          content += `${lineStr}\n`;
  
          locCtr++;
        });
      } else if (codeWords && codeWords.length === 0) {
        // No code words, do not include the source line
        let lineStr = `                    ${entry.sourceLine}`;
        content += `${lineStr}\n`;
      } else if (macWord !== '') {
        // Machine word exists (for .bin files)
        const wordStr = isBST
          ? macWord.toString(2).padStart(16, '0').replace(/(.{4})/g, '$1 ').trim()
          : macWord.toString(16).padStart(4, '0');
  
        // Build a line with "Loc" and the code word in hex (or bin), plus optional "; comment"
        let lineStr = `${entry.locCtr.toString(16).padStart(4, '0')}  ${wordStr}`;
        if (includeComments && entry.comment) {
          lineStr += ` ; ${entry.comment}`;
        }
        
        content += lineStr + '\n';
      }
    });
  } else if (interpreter && interpreter.mem) {
    content += 'Loc   Code\n';

    // Output code from interpreter's memory
    for (let addr = interpreter.loadPoint; addr <= interpreter.memMax; addr++) {
      const locStr = addr.toString(16).padStart(4, '0');
      const word = interpreter.initialMem[addr];
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
        value: `${(interpreter.memMax - interpreter.loadPoint + 1).toString(16)} (hex)    ${interpreter.memMax + 1} (dec)`,
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

export default {
  generateBSTLSTContent,
};