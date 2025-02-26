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
  }

  lint() {
    if (!this.editor) return;
    
    this.clearDiagnostics();
    
    // In a real implementation, we would check the code against rules
    // For now, we'll just clear any existing diagnostics
    this.diagnostics = [];
    
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
    this.hoverTimeout = null;
    this.hoverDelay = 500; // Delay in milliseconds before showing tooltip
    
    // Information from the VS Code extension
    this.assemblyInfo = {
      "add": {
        descriptive_name: "Add (Register)",
        description: "dr = sr1 + sr2",
        syntax: "add dr, sr1, sr2",
        explanation: "The ADD instruction performs an addition operation on the two source registers and stores the result in the destination register.",
        flags_set: "nzcv",
        binary_format: "0001 dr(3) sr1(3) 000 sr2"
      },
      "sub": {
        descriptive_name: "Subtract (Register)",
        description: "dr = sr1 - sr2",
        syntax: "sub dr, sr1, sr2",
        explanation: "The SUB instruction performs a subtraction operation on the two source registers and stores the result in the destination register.",
        flags_set: "nzcv",
        binary_format: "1011 dr(3) sr1(3) 000 sr2(3)"
      },
      "halt": {
        descriptive_name: "Halt",
        description: "stop the program",
        syntax: "halt",
        explanation: "The HALT instruction is used to stop the program. The program stops executing and the processor halts.",
        flags_set: "",
        binary_format: "1111 111 000000000"
      },
      "lea": {
        descriptive_name: "Load Effective Address",
        description: "dr = pc + pcoffset9",
        syntax: "lea dr, label",
        explanation: "The LEA instruction is used to load the effective address of a label into a register. The effective address is calculated by adding the Program Counter (PC) to the 9-bit offset field.",
        flags_set: "",
        binary_format: "1110 dr(3) pcoffset9[(1) (4) (4)]"
      },
      "sout": {
        descriptive_name: "String Out",
        description: "output the string value pointed at by the source register",
        syntax: "sout sr",
        explanation: "The SOUT instruction is used to output the string value pointed at by the source register. If no register is specified then the address r0 points to is displayed.",
        flags_set: "",
        binary_format: "1111 000 sr(3) 000000"
      },
      "sin": {
        descriptive_name: "String In",
        description: "input a string value into the source register",
        syntax: "sin sr",
        explanation: "The SIN instruction is used to input a string value into the source register. The value is read from the input device and stored in the source register.",
        flags_set: "",
        binary_format: "1111 000 sr(3) 000000"
      },
      "nl": {
        descriptive_name: "Newline",
        description: "print a newline",
        syntax: "nl",
        explanation: "The NL instruction is used to print a newline character to the output device.",
        flags_set: "",
        binary_format: "1111 000 000000001"
      },
      "m": {
        descriptive_name: "Memory Dump",
        description: "dump memory contents",
        syntax: "m",
        explanation: "The M instruction is used to dump the contents of memory for debugging purposes.",
        flags_set: "",
        binary_format: "1111 000 000000010"
      }
    };
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Add mousemove event listener to the editor wrapper
    this.editor.getWrapperElement().addEventListener('mousemove', this.handleMouseMove.bind(this));
    
    // Add mouseout event listener to hide the tooltip when the mouse leaves the editor
    this.editor.getWrapperElement().addEventListener('mouseout', this.handleMouseOut.bind(this));
  }
  
  handleMouseMove(event) {
    // Clear any existing timeout
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    
    // Get the position of the mouse in the editor
    const pos = this.editor.coordsChar({
      left: event.clientX,
      top: event.clientY
    });
    
    // Set a timeout to show the tooltip after a delay
    this.hoverTimeout = setTimeout(() => {
      this.showTooltip(pos, event);
    }, this.hoverDelay);
  }
  
  handleMouseOut() {
    // Clear any existing timeout
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    
    // Hide the tooltip
    this.hideTooltip();
  }
  
  showTooltip(pos, event) {
    // Get the token at the current position
    const token = this.editor.getTokenAt(pos);
    
    // If there's no token or it's not a keyword, return
    if (!token || token.type !== 'keyword') {
      this.hideTooltip();
      return;
    }
    
    // Get the instruction from the token
    const instruction = token.string.toLowerCase();
    
    // If there's no information for this instruction, return
    if (!this.assemblyInfo[instruction]) {
      this.hideTooltip();
      return;
    }
    
    // Get the information for this instruction
    const info = this.assemblyInfo[instruction];
    
    // Create the tooltip content
    const content = `
      <div class="hover-title">${info.descriptive_name}</div>
      <div class="hover-syntax">${info.syntax}</div>
      <div class="hover-description">${info.description}</div>
      <div class="hover-explanation">${info.explanation}</div>
      ${info.flags_set ? `<div class="hover-flags">Flags set: ${info.flags_set}</div>` : ''}
      <div class="hover-binary">Binary format: ${info.binary_format}</div>
    `;
    
    // Create or update the tooltip
    if (!this.tooltip) {
      this.tooltip = document.createElement('div');
      this.tooltip.className = 'tooltip';
      document.body.appendChild(this.tooltip);
    }
    
    // Set the tooltip content
    this.tooltip.innerHTML = content;
    
    // Position the tooltip
    const coords = this.editor.charCoords(pos, 'page');
    this.tooltip.style.top = `${coords.bottom + 5}px`;
    this.tooltip.style.left = `${coords.left}px`;
    
    // Show the tooltip
    this.tooltip.style.display = 'block';
  }
  
  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
  }
}

// Export the classes for use in main.js
export { LccLinter, LccHoverProvider };
