// Main application script
import { LccLinter, LccHoverProvider } from './lcc-mode.js';

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Wait for the editor to be initialized
  const checkEditor = setInterval(() => {
    if (window.editor) {
      clearInterval(checkEditor);
      initializeEditor();
      initializeCommandPalette();
      initializeFileOperations();
      initializeDownloadOptions();
      initializeLintingToggles();
      initializeThemeToggle();
      initializeTerminal();
      initializeHamburgerMenu();
    }
  }, 100);
});

// Initialize the CodeMirror editor with LCC mode
function initializeEditor() {
  // Get the editor instance from the global scope
  const editor = window.editor;
  
  if (!editor) {
    console.error('Editor not found');
    return;
  }
  
  // Set the mode to LCC
  editor.setOption('mode', 'lcc');
  
  // Initialize the linter
  const linter = new LccLinter(editor);
  window.lccLinter = linter;
  
  // Initialize the hover provider
  const hoverProvider = new LccHoverProvider(editor);
  window.lccHoverProvider = hoverProvider;
  
  // Run initial lint
  linter.lint();
  
  // Set up change event to trigger linting
  editor.on('change', () => {
    linter.lint();
  });
}

// Initialize the terminal interface
function initializeTerminal() {
  const terminal = document.getElementById('terminal');
  const terminalInput = document.getElementById('terminal-input');
  
  if (!terminal || !terminalInput) {
    console.error('Terminal elements not found');
    return;
  }
  
  // Focus the input when clicking on the terminal
  terminal.addEventListener('click', () => {
    terminalInput.focus();
  });
  
  // Handle input submission
  terminalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      const input = terminalInput.value;
      terminalInput.value = '';
      
      // Display the input in the terminal
      appendToTerminal(`> ${input}`, 'input');
      
      // Process the input
      processTerminalInput(input);
    }
  });
}

// Process terminal input
function processTerminalInput(input) {
  // Send the input to the worker
  if (window.worker) {
    window.worker.postMessage({
      type: 'stdin-fallback',
      payload: { input }
    });
  }
}

function appendToLastTerminalLine(text) {
  const terminal = document.getElementById('terminal');
  if (!terminal) return;

  // if there are no terminal-lines, create a new one
  if (terminal.childElementCount === 0) {
    terminal.appendChild(createTerminalLine(text));
    return;
  }

  const lastLine = terminal.lastElementChild;
  if (lastLine && lastLine.classList.contains('terminal-line')) {
    lastLine.textContent += text;
  }
}

function createTerminalLine(text, className = '') {
  const line = document.createElement('div');
  line.className = `terminal-line ${className}`;
  line.textContent = text;
  return line;
}

// Append text to the terminal
function appendToTerminal(text, className = '') {
  const terminal = document.getElementById('terminal');
  if (!terminal) return;
  
  if (className === 'input') {
    terminal.appendChild(createTerminalLine(text, className));
  } else if (text.includes('\n')) { 
    const lines = text.split('\n');
    appendToLastTerminalLine(lines.shift());

    lines.forEach(line => {
      terminal.appendChild(createTerminalLine(line, className));
      
    });
  } else {
    appendToLastTerminalLine(text);
  }

  terminal.scrollTop = terminal.scrollHeight;
}

// Initialize hamburger menu
function initializeHamburgerMenu() {
  const hamburgerBtn = document.getElementById('hamburger-menu-btn');
  const hamburgerMenu = document.getElementById('hamburger-menu');
  
  if (!hamburgerBtn || !hamburgerMenu) {
    console.error('Hamburger menu elements not found');
    return;
  }
  
  hamburgerBtn.addEventListener('click', () => {
    hamburgerMenu.classList.toggle('hidden');
  });
  
  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!hamburgerBtn.contains(e.target) && !hamburgerMenu.contains(e.target)) {
      hamburgerMenu.classList.add('hidden');
    }
  });
}

// Initialize the command palette functionality
function initializeCommandPalette() {
  const commandPalette = document.getElementById('command-palette');
  const commandPaletteInput = document.getElementById('command-palette-input');
  const commandPaletteResults = document.getElementById('command-palette-results');
  
  if (!commandPalette || !commandPaletteInput || !commandPaletteResults) {
    console.error('Command palette elements not found');
    return;
  }
  
  // Define available commands
  const commands = [
    { id: 'run', name: 'Run Program', action: () => document.getElementById('btn-run').click() },
    { id: 'clear', name: 'Clear Terminal', action: () => document.getElementById('btn-clear').click() },
    { id: 'toggle-error', name: 'Toggle Error Checking', action: () => document.getElementById('btn-toggle-error').click() },
    { id: 'toggle-warning', name: 'Toggle Warning Checking', action: () => document.getElementById('btn-toggle-warning').click() },
    { id: 'toggle-info', name: 'Toggle Info Checking', action: () => document.getElementById('btn-toggle-info').click() },
    { id: 'toggle-theme', name: 'Toggle Dark Mode', action: () => document.getElementById('btn-theme-toggle').click() },
    { id: 'open-file', name: 'Open File', action: () => document.getElementById('btn-open').click() },
    { id: 'save-file', name: 'Save File', action: () => document.getElementById('btn-save').click() },
    { id: 'load-demo', name: 'Load Demo', action: () => document.getElementById('btn-load-demo').click() }
  ];
  
  // Handle input in the command palette
  commandPaletteInput.addEventListener('input', () => {
    const query = commandPaletteInput.value.toLowerCase();
    const filteredCommands = commands.filter(cmd => 
      cmd.name.toLowerCase().includes(query)
    );
    
    commandPaletteResults.innerHTML = '';
    
    filteredCommands.forEach(cmd => {
      const item = document.createElement('div');
      item.className = 'command-palette-item';
      item.textContent = cmd.name;
      item.addEventListener('click', () => {
        cmd.action();
        commandPalette.classList.add('hidden');
        commandPaletteInput.value = '';
      });
      commandPaletteResults.appendChild(item);
    });
  });
  
  // Handle keyboard navigation in the command palette
  commandPaletteInput.addEventListener('keydown', (event) => {
    const items = commandPaletteResults.querySelectorAll('.command-palette-item');
    const activeItem = commandPaletteResults.querySelector('.command-palette-item.active');
    let activeIndex = Array.from(items).indexOf(activeItem);
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (activeIndex < items.length - 1) {
          if (activeItem) activeItem.classList.remove('active');
          items[activeIndex + 1].classList.add('active');
          items[activeIndex + 1].scrollIntoView({ block: 'nearest' });
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (activeIndex > 0) {
          if (activeItem) activeItem.classList.remove('active');
          items[activeIndex - 1].classList.add('active');
          items[activeIndex - 1].scrollIntoView({ block: 'nearest' });
        }
        break;
      case 'Enter':
        event.preventDefault();
        if (activeItem) {
          activeItem.click();
        } else if (items.length > 0) {
          items[0].click();
        }
        break;
      case 'Escape':
        event.preventDefault();
        commandPalette.classList.add('hidden');
        break;
    }
  });
  
  // Show all commands when the command palette is opened
  const commandPaletteBtn = document.getElementById('btn-command-palette');
  if (commandPaletteBtn) {
    commandPaletteBtn.addEventListener('click', () => {
      commandPaletteInput.value = '';
      commandPaletteInput.dispatchEvent(new Event('input'));
    });
  }
}

// Initialize file operations (open, save)
function initializeFileOperations() {
  const btnNew = document.getElementById('btn-new');
  const btnOpen = document.getElementById('btn-open');
  const btnSave = document.getElementById('btn-save');
  const fileInput = document.getElementById('file-input');
  
  if (!btnNew || !btnOpen || !btnSave || !fileInput) {
    console.error('File operation elements not found');
    return;
  }
  
  // New file button
  btnNew.addEventListener('click', () => {
    if (confirm('Create a new file? Any unsaved changes will be lost.')) {
      window.editor.setValue('');
    }
  });
  
  // Open file button
  btnOpen.addEventListener('click', () => {
    fileInput.click();
  });
  
  // File input change handler
  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        window.editor.setValue(e.target.result);
      };
      reader.readAsText(file);
    }
  });
  
  // Save file button
  btnSave.addEventListener('click', () => {
    downloadFile('a');
  });
  
  // Mobile buttons
  const btnNewMobile = document.getElementById('btn-load-demo-mobile');
  if (btnNewMobile) {
    btnNewMobile.addEventListener('click', () => {
      loadDemo('demoA.a');
      document.getElementById('hamburger-menu').classList.add('hidden');
    });
  }
}

// Initialize download options
function initializeDownloadOptions() {
  // Download format buttons
  document.querySelectorAll('.download-format-btn').forEach(button => {
    button.addEventListener('click', () => {
      const format = button.getAttribute('data-format');
      downloadFile(format);
      document.getElementById('hamburger-menu').classList.add('hidden');
    });
  });
}

// Download file with the specified format
function downloadFile(format) {
  //const code = window.editor.getValue();
  const asTxt = document.getElementById('download-as-txt').checked;

  switch (format) {
    case 'a':
      var code = JSON.parse(localStorage['fsWrapper'])['program.a'];
      break;
    case 'bst':
      var code = JSON.parse(localStorage['fsWrapper'])['program.bst'];
      break;
    case 'lst':
      var code = JSON.parse(localStorage['fsWrapper'])['program.lst'];
      break;
    case 'e':
      var code = JSON.parse(localStorage['fsWrapper'])['program.e'];
      break;
    case 'nnn':
      var code = JSON.parse(localStorage['fsWrapper'])['name.nnn'];
      break;
    default:
      // error
      console.error('Invalid download format:', format);
      return;
  }
  

  const blob = new Blob([code], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `program.${format}${asTxt ? '.txt' : ''}`;
  a.click();
  URL.revokeObjectURL(url);
}

// Initialize linting toggle buttons
function initializeLintingToggles() {
  const btnToggleError = document.getElementById('btn-toggle-error');
  const btnToggleWarning = document.getElementById('btn-toggle-warning');
  const btnToggleInfo = document.getElementById('btn-toggle-info');
  
  if (!btnToggleError || !btnToggleWarning || !btnToggleInfo) {
    console.error('Linting toggle elements not found');
    return;
  }
  
  btnToggleError.addEventListener('click', function() {
    this.classList.toggle('opacity-50');
    if (window.lccLinter) {
      window.lccLinter.toggleErrorChecking();
    }
  });
  
  btnToggleWarning.addEventListener('click', function() {
    this.classList.toggle('opacity-50');
    if (window.lccLinter) {
      window.lccLinter.toggleWarningChecking();
    }
  });
  
  btnToggleInfo.addEventListener('click', function() {
    this.classList.toggle('opacity-50');
    if (window.lccLinter) {
      window.lccLinter.toggleInfoChecking();
    }
  });
}

// Initialize theme toggle
function initializeThemeToggle() {
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  
  if (!btnThemeToggle) {
    console.error('Theme toggle element not found');
    return;
  }
  
  // Toggle dark mode
  btnThemeToggle.addEventListener('click', function() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('darkMode', isDark);
    this.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    
    // Update CodeMirror theme
    if (window.editor) {
      window.editor.setOption('theme', isDark ? 'lcc-dark' : 'lcc-light');
    }
  });
}

// Load demo files
function loadDemo(demoFile) {
  fetch(`demos/${demoFile}`)
    .then(response => response.text())
    .then(code => {
      window.editor.setValue(code);
    })
    .catch(error => {
      console.error('Error loading demo:', error);
      appendToTerminal(`Error loading demo: ${error.message}`, 'text-red-500');
    });
}

// Initialize demo selector
const btnLoadDemo = document.getElementById('btn-load-demo');
if (btnLoadDemo) {
  btnLoadDemo.addEventListener('click', () => {
    loadDemo('demoA.a');
  });
}

// Export functions for global use
window.loadDemo = loadDemo;
window.downloadFile = downloadFile;
window.appendToTerminal = appendToTerminal;
