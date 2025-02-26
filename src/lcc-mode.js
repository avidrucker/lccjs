// LCC mode for CodeMirror
// Based on the VS Code extension's syntax highlighting rules

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
  "use strict";

  CodeMirror.defineMode("lcc", function() {
    // Regular expressions for different token types
    const registers = /^(r[0-7]|fp|sp|lr)\b/;
    const instructions = /^(cea|brn|mov|add|ld|st|bl|call|jsr|blr|jsrr|and|ldr|str|cmp|not|push|pop|srl|sra|sll|rol|ror|mul|div|rem|or|xor|mvr|sext|sub|jmp|ret|mvi|lea|halt|nl|dout|udout|hout|aout|sout|din|hin|ain|sin|brz|bre|brnz|brne|brp|brlt|brgt|brc|brb|br|bral|m|r|s|bp)\b/i;
    const directives = /^(\.(word|zero|blkw|fill|string|asciz|stringz|space|start|global|globl|extern|org|orig))\b/;
    const labels = /^([a-zA-Z_$@][a-zA-Z0-9_$@]*:)/;
    const numbers = /^(0x[0-9a-f]+|0b[01]+|-?[0-9]+)\b/i;
    const comments = /^(;.*)/;

    return {
      startState: function() {
        return {
          context: 0
        };
      },

      token: function(stream, state) {
        if (stream.eatSpace()) return null;

        // Comments
        if (stream.match(comments)) {
          return "comment";
        }

        // Labels
        if (stream.match(labels)) {
          return "def";
        }

        // Instructions
        if (stream.match(instructions)) {
          return "keyword";
        }

        // Directives
        if (stream.match(directives)) {
          return "builtin";
        }

        // Registers
        if (stream.match(registers)) {
          return "variable-2";
        }

        // Numbers (hex, binary, decimal)
        if (stream.match(numbers)) {
          return "number";
        }

        // Strings
        if (stream.match(/^"([^"]|\\")*"/)) {
          return "string";
        }

        // Characters
        if (stream.match(/^'([^']|\\')*'/)) {
          return "string-2";
        }

        // Catch-all for other tokens
        stream.next();
        return null;
      }
    };
  });

  CodeMirror.defineMIME("text/x-lcc", "lcc");
});

// LCC Linter for CodeMirror
class LccLinter {
  constructor(editor) {
    this.editor = editor;
    this.diagnostics = [];
    this.enableErrorChecking = true;
    this.enableWarningChecking = true;
    this.enableInfoChecking = true;
    
    // Rules from the VS Code extension
    this.rules = [
      // Sample rules - these would be expanded based on the VS Code extension's rules
      {
        name: "bad register for out mnemonics",
        pattern: /(?:dout|aout|hout|sout)[\\t ]+((?:\"[^\"\\n\\r\\\\]*(?:\\\\.[^\"\\n\\r\\\\]*)*\"|[^\\t ;]+\"|\"[^\\t ;]+))/,
        validPattern: /^(fp|sp|lr|r[0-7]|^$)$/,
        message: "out mnemonics must be followed by a valid register or nothing, but got {follower}",
        severity: "error"
      },
      {
        name: "bad 2nd operand for mov",
        pattern: /mov[\\t ]+\\w+[, \\t]+((?:\"[^\"\\n\\r\\\\]*(?:\\\\.[^\"\\n\\r\\\\]*)*\"|[^\\t ;]+\"|\"[^\\t ;]+))/,
        validPattern: /^(fp|sp|lr|r[0-7]|-?\\d+|0x[a-fA-F0-9]+|'\\\\?.')$/,
        message: "The 2nd operand of 'mov' must be a valid register, an integer, a hexadecimal number, or a single quote encapsulated char, but got {follower}",
        severity: "error"
      }
      // Additional rules would be added here
    ];
  }

  lint() {
    if (!this.editor) return;
    
    this.clearDiagnostics();
    
    const doc = this.editor.getDoc();
    const content = doc.getValue();
    const lines = content.split('\n');
    
    this.diagnostics = [];
    
    // Check each line against the rules
    lines.forEach((line, lineIndex) => {
      // Skip comment lines
      if (line.trim().startsWith(';')) return;
      
      this.rules.forEach(rule => {
        const match = line.match(rule.pattern);
        if (match && match[1]) {
          const follower = match[1];
          if (!rule.validPattern.test(follower)) {
            const message = rule.message.replace('{follower}', follower);
            const severity = rule.severity.toLowerCase();
            
            // Check if this type of diagnostic is enabled
            if ((severity === 'error' && this.enableErrorChecking) ||
                (severity === 'warning' && this.enableWarningChecking) ||
                (severity === 'information' && this.enableInfoChecking)) {
              
              // Find the position of the match in the line
              const start = line.indexOf(follower);
              const end = start + follower.length;
              
              this.diagnostics.push({
                from: CodeMirror.Pos(lineIndex, start),
                to: CodeMirror.Pos(lineIndex, end),
                message: message,
                severity: severity
              });
            }
          }
        }
      });
    });
    
    this.displayDiagnostics();
  }

  clearDiagnostics() {
    this.editor.operation(() => {
      this.editor.getAllMarks().forEach(mark => mark.clear());
    });
  }

  displayDiagnostics() {
    this.editor.operation(() => {
      this.diagnostics.forEach(diagnostic => {
        const marker = this.editor.markText(
          diagnostic.from,
          diagnostic.to,
          {
            className: `diagnostic diagnostic-${diagnostic.severity}`,
            title: diagnostic.message
          }
        );
      });
    });
  }

  toggleErrorChecking() {
    this.enableErrorChecking = !this.enableErrorChecking;
    this.lint();
  }

  toggleWarningChecking() {
    this.enableWarningChecking = !this.enableWarningChecking;
    this.lint();
  }

  toggleInfoChecking() {
    this.enableInfoChecking = !this.enableInfoChecking;
    this.lint();
  }
}

// Hover information provider for LCC
class LccHoverProvider {
  constructor(editor) {
    this.editor = editor;
    this.tooltip = null;
    
    // Information from the VS Code extension
    this.assemblyInfo = {
      // Sample instruction info - would be expanded based on the VS Code extension
      "add": {
        descriptive_name: "Add (Register)",
        description: "dr = sr1 + sr2",
        syntax: "add dr, sr1, sr2",
        explanation: "The ADD instruction performs an addition operation on the two source registers and stores the result in the destination register.",
        flags_set: "nzcv",
        binary_format: "0001 dr(3) sr1(3) 000 sr2"
      },
      "mov": {
        descriptive_name: "Move Register",
        description: "dr = sr",
        syntax: "mov dr, sr",
        explanation: "The MVR instruction is used to move a value from memory into a register.",
        flags_set: "",
        binary_format: "1010 dr(3) sr(3) 0 01100"
      }
      // Additional instructions would be added here
    };
    
    this.binaryInfo = {
      // Sample binary pattern info - would be expanded based on the VS Code extension
      "0001": {
        descriptive_name: "Add (Register)",
        description: "dr = sr1 + sr2",
        explanation: "The ADD instruction performs an addition operation on the two source registers and stores the result in the destination register.",
        flags_set: "nzcv",
        binary_format: "0001 dr(3) sr1(3) 000 sr2"
      }
      // Additional binary patterns would be added here
    };
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    this.editor.getWrapperElement().addEventListener('mouseover', this.handleMouseOver.bind(this));
    this.editor.getWrapperElement().addEventListener('mouseout', this.handleMouseOut.bind(this));
  }
  
  handleMouseOver(event) {
    const pos = this.editor.coordsChar({left: event.clientX, top: event.clientY});
    const token = this.editor.getTokenAt(pos);
    
    if (token && token.type) {
      // Get the current line
      const line = this.editor.getLine(pos.line);
      
      // Check if we're hovering over an instruction
      if (token.type === 'keyword') {
        const instruction = token.string.toLowerCase();
        const info = this.assemblyInfo[instruction];
        
        if (info) {
          this.showTooltip(event, this.formatInstructionInfo(info));
        }
      }
      // Check if we're hovering over a number
      else if (token.type === 'number') {
        const number = token.string;
        this.showTooltip(event, this.formatNumberInfo(number));
      }
      // Check if we're hovering over a binary pattern (for machine code view)
      else if (line.trim().match(/^[01]{4} [01]{4} [01]{4} [01]{4}/)) {
        const binaryPattern = line.trim().substring(0, 4);
        const info = this.binaryInfo[binaryPattern];
        
        if (info) {
          this.showTooltip(event, this.formatInstructionInfo(info));
        }
      }
    }
  }
  
  handleMouseOut(event) {
    this.hideTooltip();
  }
  
  showTooltip(event, content) {
    this.hideTooltip();
    
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tooltip';
    this.tooltip.innerHTML = content;
    document.body.appendChild(this.tooltip);
    
    // Position the tooltip
    const rect = this.editor.getWrapperElement().getBoundingClientRect();
    this.tooltip.style.left = `${event.clientX}px`;
    this.tooltip.style.top = `${event.clientY + 20}px`;
    
    // Ensure the tooltip is within the viewport
    const tooltipRect = this.tooltip.getBoundingClientRect();
    if (tooltipRect.right > window.innerWidth) {
      this.tooltip.style.left = `${window.innerWidth - tooltipRect.width - 10}px`;
    }
    if (tooltipRect.bottom > window.innerHeight) {
      this.tooltip.style.top = `${event.clientY - tooltipRect.height - 10}px`;
    }
  }
  
  hideTooltip() {
    if (this.tooltip) {
      document.body.removeChild(this.tooltip);
      this.tooltip = null;
    }
  }
  
  formatInstructionInfo(info) {
    return `
      <div class="font-bold">${info.descriptive_name}</div>
      <div class="mt-1"><span class="font-semibold">Syntax:</span> ${info.syntax}</div>
      <div class="mt-1"><span class="font-semibold">Description:</span> ${info.description}</div>
      <div class="mt-1"><span class="font-semibold">Binary Format:</span> ${info.binary_format}</div>
      ${info.flags_set ? `<div class="mt-1"><span class="font-semibold">Flags Set:</span> ${info.flags_set}</div>` : ''}
      <div class="mt-2">${info.explanation}</div>
    `;
  }
  
  formatNumberInfo(number) {
    let decimal, hex, binary;
    
    if (number.startsWith('0x')) {
      // Hexadecimal
      hex = number;
      decimal = parseInt(number, 16);
      binary = decimal.toString(2).padStart(16, '0');
    } else if (number.startsWith('0b')) {
      // Binary
      binary = number.substring(2);
      decimal = parseInt(binary, 2);
      hex = '0x' + decimal.toString(16);
    } else {
      // Decimal
      decimal = parseInt(number);
      hex = '0x' + decimal.toString(16);
      binary = decimal.toString(2).padStart(16, '0');
    }
    
    // Format binary for readability
    const formattedBinary = `${binary.substring(0, 4)} ${binary.substring(4, 8)} ${binary.substring(8, 12)} ${binary.substring(12, 16)}`;
    
    // Check if it's a printable ASCII character
    let asciiChar = '';
    if (decimal >= 32 && decimal <= 126) {
      asciiChar = `<div class="mt-1"><span class="font-semibold">ASCII:</span> '${String.fromCharCode(decimal)}'</div>`;
    }
    
    return `
      <div class="font-bold">Number Conversion</div>
      <div class="mt-1"><span class="font-semibold">Decimal:</span> ${decimal}</div>
      <div class="mt-1"><span class="font-semibold">Hexadecimal:</span> ${hex}</div>
      <div class="mt-1"><span class="font-semibold">Binary:</span> ${formattedBinary}</div>
      ${asciiChar}
    `;
  }
}

// Export the classes for use in the main application
export { LccLinter, LccHoverProvider };
