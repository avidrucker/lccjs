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
  
  // Set up hover events for context information
  const editorElement = editor.getWrapperElement();
  
  editorElement.addEventListener('mouseover', (e) => {
    const pos = editor.coordsChar({
      left: e.clientX,
      top: e.clientY
    });
    
    const token = editor.getTokenAt(pos);
    if (token && token.type) {
      // Show hover information based on token type
      hoverProvider.showHoverForToken(token, pos, e);
    }
  });
  
  editorElement.addEventListener('mouseout', () => {
    hoverProvider.hideHover();
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

// Append text to the terminal
function appendToTerminal(text, className = '') {
  const terminal = document.getElementById('terminal');
  if (!terminal) return;
  
  const line = document.createElement('div');
  line.className = className ? `terminal-line ${className}` : 'terminal-line';
  line.textContent = text;
  
  terminal.appendChild(line);
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
  
  // Define available commands
  const commands = [
    { id: 'run', name: 'Run Program', action: () => document.getElementById('btn-run').click() },
    { id: 'clear', name: 'Clear Output', action: () => document.getElementById('btn-clear').click() },
    { id: 'toggle-error', name: 'Toggle Error Checking', action: () => document.getElementById('btn-toggle-error').click() },
    { id: 'toggle-warning', name: 'Toggle Warning Checking', action: () => document.getElementById('btn-toggle-warning').click() },
    { id: 'toggle-info', name: 'Toggle Info Checking', action: () => document.getElementById('btn-toggle-info').click() },
    { id: 'toggle-theme', name: 'Toggle Dark Mode', action: () => document.getElementById('btn-theme-toggle').click() },
    { id: 'open-file', name: 'Open File', action: () => document.getElementById('btn-open').click() },
    { id: 'save-file', name: 'Save File', action: () => document.getElementById('btn-save').click() },
    { id: 'download-bin', name: 'Download as Binary (.bin)', action: () => downloadFile('bin') },
    { id: 'download-a', name: 'Download as Assembly (.a)', action: () => downloadFile('a') },
    { id: 'download-lst', name: 'Download as Listing (.lst)', action: () => downloadFile('lst') },
    { id: 'download-bst', name: 'Download as Binary Listing (.bst)', action: () => downloadFile('bst') }
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
  document.getElementById('btn-command-palette').addEventListener('click', () => {
    commandPaletteInput.value = '';
    commandPaletteInput.dispatchEvent(new Event('input'));
  });
}

// Initialize file operations (open, save)
function initializeFileOperations() {
  // New file button
  document.getElementById('btn-new').addEventListener('click', () => {
    if (confirm('Create a new file? Any unsaved changes will be lost.')) {
      window.editor.setValue('');
    }
  });
  
  document.getElementById('btn-new-mobile').addEventListener('click', () => {
    if (confirm('Create a new file? Any unsaved changes will be lost.')) {
      window.editor.setValue('');
      document.getElementById('mobile-menu').classList.add('hidden');
    }
  });
  
  // Open file button
  document.getElementById('btn-open').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });
  
  document.getElementById('btn-open-mobile').addEventListener('click', () => {
    document.getElementById('file-input').click();
    document.getElementById('mobile-menu').classList.add('hidden');
  });
  
  // File input change handler
  document.getElementById('file-input').addEventListener('change', (event) => {
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
  document.getElementById('btn-save').addEventListener('click', () => {
    downloadFile('a');
  });
  
  document.getElementById('btn-save-mobile').addEventListener('click', () => {
    downloadFile('a');
    document.getElementById('mobile-menu').classList.add('hidden');
  });
}

// Initialize download options
function initializeDownloadOptions() {
  // Download button
  document.getElementById('btn-download').addEventListener('click', () => {
    const downloadMenu = document.getElementById('download-menu');
    downloadMenu.classList.toggle('hidden');
  });
  
  // Download format buttons
  document.querySelectorAll('#download-menu [data-format]').forEach(button => {
    button.addEventListener('click', () => {
      const format = button.getAttribute('data-format');
      downloadFile(format);
      document.getElementById('download-menu').classList.add('hidden');
    });
  });
  
  // Mobile download button
  document.getElementById('btn-download-mobile').addEventListener('click', () => {
    downloadFile('a');
    document.getElementById('mobile-menu').classList.add('hidden');
  });
}

// Download file with the specified format
function downloadFile(format) {
  const code = window.editor.getValue();
  const asTxt = document.getElementById('download-as-txt').checked;
  
  // In a real implementation, we would process the code based on the format
  // For now, we'll just download the raw code with the selected extension
  const blob = new Blob([code], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `program.${asTxt ? 'txt' : format}`;
  a.click();
  URL.revokeObjectURL(url);
}

// Initialize linting toggle buttons
function initializeLintingToggles() {
  document.getElementById('btn-toggle-error').addEventListener('click', function() {
    this.classList.toggle('opacity-50');
    window.lccLinter.toggleErrorChecking();
  });
  
  document.getElementById('btn-toggle-warning').addEventListener('click', function() {
    this.classList.toggle('opacity-50');
    window.lccLinter.toggleWarningChecking();
  });
  
  document.getElementById('btn-toggle-info').addEventListener('click', function() {
    this.classList.toggle('opacity-50');
    window.lccLinter.toggleInfoChecking();
  });
}

// Initialize theme toggle
function initializeThemeToggle() {
  // Dark mode is initialized in index.html
  
  // Toggle dark mode
  document.getElementById('btn-theme-toggle').addEventListener('click', function() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('darkMode', isDark);
    this.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    
    // Update CodeMirror theme
    if (isDark) {
      window.editor.setOption('theme', 'lcc-dark');
    } else {
      window.editor.setOption('theme', 'lcc-light');
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
      document.getElementById('error-output').textContent += `Error loading demo: ${error.message}\n`;
    });
}

// Initialize demo selector
document.getElementById('select-demo').addEventListener('change', function() {
  const demoFile = this.value;
  if (demoFile) {
    loadDemo(demoFile);
  }
});

// Export functions for global use
window.loadDemo = loadDemo;
window.downloadFile = downloadFile;
