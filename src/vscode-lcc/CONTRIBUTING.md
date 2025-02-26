# Contributing to LCC-Tools for VSCode

Requirements: VS Code is required to debug and test this extension.

## How to download extension locally from GitHub

You *could* simply clone the official repo...

```bash
git clone https://github.com/lettucegoblin/vscode-lcc.git
```

However, we recommend instead that you first fork this repo and clone your own fork. This will look something like:

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/vscode-lcc.git
```

## Major Areas of Interest

So far, we have focused work on this extension to enable syntax highlighting, error detection, and surfacing of useful/relevant information (e.g. mouse hovers). Syntax highlighting is handled mainly in `lcc.tmLanguage.json`. Error detection is handled mainly in `rules.json` (the specific errors themselves) and `AssemblyLinter.js` (the logic to search for and display errors). Hovers are handled mainly in `extension.js`. Check out our issues to see where there might be interest in developing new features. We are also open to suggestions!

## How to start testing extension locally

1. Disable LCC-Tools extension if you have it installed already
    a. Click on the Extensions icon on the left sidebar (shortcut Ctrl+Shift+X)
    b. Type LCC in the search bar
    c. Under LCC-Tools by Lettuce, first click on the gear icon, then select "Disable", and then lastly click on the "Restart Extensions" button that appears to the left of the gear icon

2. Open the extension code locally
    a. Fork and clone the "vscode-lcc" repo (you only need to do this once)
    b. Make sure your "main" branch is up-to-date with the latest "main" branch here: https://github.com/lettucegoblin/vscode-lcc (this is recommended to do each time)
    c. Navigate to where you have cloned the "vscode-lcc" repo
    d. Open with VSCode either via the command line with `code .` or from VSCode itself with "Open Folder"

3. Run and debug locally via VS Code
    a. Click on the "Run and Debug" icon on the left sidebar (shotcut Ctrl+Shift+D)
    b. Click on the green triangle icon "Start Debugging" button at the top of the sidebar. A new VSCode window will open up.
    c. In the newly opened VSCode window, navigate to a file with Machine Code or Assembly code to inspect how the extension is behaving.
    d. After making any changes to the extension code (ideally on a new test branch), either press the green circular arrow "Restart" icon (Ctrl+Shift+F5) or, if this icon is not showing as it sometimes does, simply press the red "Stop" icon and press the green "Start" button again

4. Commit changes often with clear commit messages. Starting your commit messages with "fix" (for bugs) or "feat" (for new features), for example, will help make your commit messages clearer.

5. When you are ready, merge your changes with your main branch, push your changes to your remote fork, and open a pull request against the main branch at https://github.com/lettucegoblin/vscode-lcc

Please do open new issues as you encounter them, or open a discussion thread to ask us any questions that aren't directly related to a specific issue, feature request, or enhancement request.