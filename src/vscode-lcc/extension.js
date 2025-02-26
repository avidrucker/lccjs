const vscode = require("vscode");
const AssemblyLinter = require('./src/AssemblyLinter');
const fs = require("fs");
const path = require("path");
const { Location, Position, Range } = require('vscode');

function checkIfLineIsInLanguageRegex(languageDict, document, position) {
  const line = document.lineAt(position);
  const text = line.text;
  for (const patternName in languageDict) {
    let regexCheck = text.match(languageDict[patternName].regexParsed);
    if (regexCheck) {
      return true;
    }
  }
  return false;
}

function checkForInLanguageRegexJson(binLanguageDict, assemblyLanguageDict, document, position, simpleCheck = false) {
  const line = document.lineAt(position);
  
  const text = line.text;
  if(simpleCheck)
   console.log(text, position.e)
  if(!simpleCheck) {
    const firstSemiColon = text.indexOf(";");
    if (firstSemiColon !== -1 && firstSemiColon <= position.character) {
      return undefined;
    }
    if (text[position.e] == " ") return null;
  }
  let markdownString = new vscode.MarkdownString();
  markdownString.isTrusted = true;

  for (const patternName in binLanguageDict) {
    // if the following match is 16 then there's no spaces in the binary number. assume binary.
    let binaryNumberReg = text.match(/^ *([10]*)/)
    let binaryNumberReg4Group = text.match(/^ *([10]{4} [10]{4} [10]{4} [10]{4})/)

    if(binaryNumberReg4Group || (binaryNumberReg && binaryNumberReg[1].length == 16)) {
      if(patternName != "constant.numeric.binary.lcc") continue;
    }

    let regexCheck = text.replace(/ /g, "").match(binLanguageDict[patternName].regexParsed);
    
    if (regexCheck) {
      if(simpleCheck){
        console.log("valid")
        return true;
      }
      let matchObj = binLanguageDict[patternName];
      let header = "";
      if (matchObj.descriptive_name) {
        if (matchObj.Mnemonic) {
          header = `${matchObj.Mnemonic}(${matchObj.descriptive_name}): `;
        } else {
          header = `${matchObj.descriptive_name}: `;
        }
      }

      let description = matchObj.description ? matchObj.description + "\n" : "";
      let binaryFormat = matchObj.binary_format
        ? `Binary format: ${matchObj.binary_format}\n`
        : "";
      let flags = `Flags set: ${
        matchObj.flags_set ? matchObj.flags_set : "None"
      }`;
      let explaination = matchObj.explaination
        ? `\n${matchObj.explaination}\n`
        : "";
      let whatIsCalculated =
        matchObj.binary_format.indexOf("offset") > -1 ? "Offset" : "Value";

      let calculatedOffset = "";
      if (regexCheck && regexCheck[1]) {
        let decimalNumber = binaryStringToDecimal(regexCheck[1]);
        let lineText = "";
        if (whatIsCalculated === "Offset") {
          let validLines = 0;
          let i = 0;
          for (i = position.line; i < document.lineCount; i++) {
            if (
              checkForInLanguageRegexJson(
                binLanguageDict,
                assemblyLanguageDict,
                document,
                new vscode.Position(i, 0),
                true
              )
            ) {
              validLines++;
              if (validLines == decimalNumber + 2) {
                break;
              }
            }
          }
          let vscodeLineNumber =i;
          if (vscodeLineNumber >= document.lineCount) {
            // invalid line number
            lineText = `Offset pointing to vscode line ${vscodeLineNumber + 1} is out of bounds\n`;
          } else {
            let line = document.lineAt(vscodeLineNumber);
            lineText = `Offset pointing to vscode line ${vscodeLineNumber + 1}: \n${line.text.trim()}\n`;
          }
        }
        // if the decimal number is a printable character, convert it to a char
        let decimalToChar =
          decimalNumber >= 32 && decimalNumber <= 126
            ? String.fromCharCode(decimalNumber)
            : null;
        let decimalToCharStr = decimalToChar ? ` = '${decimalToChar}' =` : "";
        calculatedOffset = `${whatIsCalculated}: ${regexCheck[1].trim()} = ${decimalNumber}${decimalToCharStr} 0x${decimalNumber.toString(
          16
        )}\n${lineText}`;
      }
      markdownString.appendMarkdown(`\`\`\`lcc\n${header}${description}${binaryFormat}${calculatedOffset}${flags}${explaination}\n\`\`\``);
      return markdownString;
      //return `${header}${description}${binaryFormat}${calculatedOffset}${flags}${explaination}`;
    } 
    
  }
  for (const patternName in assemblyLanguageDict) {
    let regexCheck = text.match(assemblyLanguageDict[patternName].regexParsed);
    if (regexCheck) {
      if(simpleCheck){
        console.log("valid")
        return true;
      }
      let matchObj = assemblyLanguageDict[patternName];
      markdownString.appendMarkdown(`### ${matchObj.descriptive_name}\n\n`);
      markdownString.appendMarkdown(`  \n${matchObj.explaination}`);
      markdownString.appendMarkdown(`  \n**Binary info:**`);
      markdownString.appendCodeblock(`${matchObj.binary_format}\n${matchObj.description}`, "javascript");
      markdownString.appendMarkdown(`  \nflags set: ${matchObj.flags_set}`);
      return markdownString;
    }
  }

  return undefined;
}

function binaryStringToDecimal(binaryString) {
  let binaryNumber = binaryString.replace(/\s/g, "");
  let isNegative = binaryNumber[0] === "1";
  let decimalNumber;

  if (isNegative) {
    // Flip the bits
    binaryNumber = binaryNumber
      .split("")
      .map((bit) => (bit === "1" ? "0" : "1"))
      .join("");
    // Add 1
    decimalNumber = parseInt(binaryNumber, 2) + 1;
    // Make the number negative
    decimalNumber = -decimalNumber;
  } else {
    decimalNumber = parseInt(binaryNumber, 2);
  }

  return decimalNumber;
}

function loadRegexJson(languageDict, context, jsonFilePathStr, isBinaryData = true) {
  const jsonFilePath = path.join(context.extensionPath, jsonFilePathStr);

  // Load the JSON file
  const fullRegexData = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));

  if(!isBinaryData){
    const assemblyRegex = fullRegexData["repository"]["assembly"]["patterns"];
    for (const pattern of assemblyRegex) {
      // iterate over array
      languageDict[pattern.name] = pattern;
      languageDict[pattern.name].regexParsed = new RegExp(
        languageDict[pattern.name].match
      ); // cache the regex
      languageDict[pattern.name].isAssembly = true;
    }
  } else {
    const binaryRegex = fullRegexData["repository"]["binary"]["patterns"];
    for (const pattern of binaryRegex) {
      // iterate over array
      languageDict[pattern.name] = pattern;
      let firstSpace = false;
      let str = languageDict[pattern.name].match; // ignoreSpacesInBinaryRegexString 
      str = str.replace(/ /g, function (match) {
        if (!firstSpace) {
          firstSpace = true;
          return match;
        } else {
          return "";
        }
      });
      languageDict[pattern.name].regexParsed = new RegExp(
        str //languageDict[pattern.name].match
      ); // cache the regex
      languageDict[pattern.name].isAssembly = false;
    }
  }

  
}

function activate(context) {
  const binLanguageDict = {};
  const assemblyLanguageDict = {};
  loadRegexJson(binLanguageDict, context, path.join('syntaxes', 'lcc.tmLanguage.json'));
  loadRegexJson(assemblyLanguageDict, context, path.join('syntaxes', 'lcc.tmLanguage.json'), false);

  const linter = new AssemblyLinter();

  // Lint all open assembly documents
  vscode.workspace.textDocuments.forEach(linter.lintDocument, linter);

  // Lint assembly documents when they are opened or changed
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(linter.lintDocument, linter));
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => linter.lintDocument(event.document)));

  // Dispose of the linter when the extension is deactivated
  context.subscriptions.push({
      dispose: () => linter.dispose()
  });

  context.subscriptions.push(
    vscode.languages.registerHoverProvider("lcc", {
      provideHover(document, position, token) {
        let markdown = undefined;
        // quite possible the dumbest way to do this
        if(path.extname(document.uri.fsPath) == '.a') { 
           markdown = checkForInLanguageRegexJson(
            {},
            assemblyLanguageDict,
            document,
            position
          );
        } else if(path.extname(document.uri.fsPath) == '.bin') {
          markdown = checkForInLanguageRegexJson(
            binLanguageDict,
            {},
            document,
            position
          );
        } else {
          markdown = checkForInLanguageRegexJson(
            binLanguageDict,
            assemblyLanguageDict,
            document,
            position
          );
        }
        if (markdown) {
          return new vscode.Hover(
            markdown//new vscode.MarkdownString("```lcc\n" + info + "\n```")
          );
        }
      },
    })
  );

  // add the ability to go to the label definition
  context.subscriptions.push(vscode.languages.registerDefinitionProvider({ scheme: 'file', language: 'lcc' }, new LabelDefinitionProvider()));

  // add the ability to toggle the linter warnings/errors
  context.subscriptions.push(vscode.commands.registerCommand('lcc.toggleErrorLinting', () => {
    linter.toggleErrorUnderlining()
    linter.clearDiagnostics();
    // delay the linting so that the underlining can be toggled
    setTimeout(() => {
      vscode.workspace.textDocuments.forEach(linter.lintDocument, linter);
    }, 200);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('lcc.toggleWarningLinting', () => {
    linter.toggleWarningUnderlining()
    linter.clearDiagnostics();
    setTimeout(() => {
      vscode.workspace.textDocuments.forEach(linter.lintDocument, linter);
    }, 200);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('lcc.toggleInformationLinting', () => {
    linter.toggleInformationUnderlining()
    linter.clearDiagnostics();
    setTimeout(() => {
      vscode.workspace.textDocuments.forEach(linter.lintDocument, linter);
    }, 200);
  }));
}

// class that enables the ability to go to the label definition
class LabelDefinitionProvider {
    provideDefinition(document, position, token) {
      const wordRange = document.getWordRangeAtPosition(position);
      const word = document.getText(wordRange);
      const text = document.getText();
      const lines = text.split('\n');
      const regex = /^([a-zA-Z_$@][a-zA-Z0-9_$@]*):?[\\s]*|^[\s]+([a-zA-Z_$@][a-zA-Z0-9_$@]*):[\s]*/;

      for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const match = line.match(regex);
          if (match && (match[1] === word || match[2] === word)) {
              const start = new Position(i, 0);
              const end = new Position(i, line.length);
              const range = new Range(start, end);
              return new Location(document.uri, range);
          }
      }

      return null;
  }
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
