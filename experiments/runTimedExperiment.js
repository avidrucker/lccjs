#!/usr/bin/env node

/**
 * @file runTimedExperiment.js
 * Safely runs an experiment program against `interpreter.js`, `lcc.js`, or the
 * oracle LCC with a hard timeout and bounded captured output. This is intended
 * for risky runs such as infinite-loop or debugger-entry experiments where
 * letting the child process stream unlimited output would overwhelm the shell.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

function expandTilde(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function printUsageAndExit() {
  console.error(
    'Usage: node experiments/runTimedExperiment.js ' +
    '--target <interpreter|lcc|oracle> [--timeout-ms 5000] [--max-output-chars 12000] ' +
    '[--input "line"] [--keep] <program.a|program.e>'
  );
  process.exit(1);
}

function parseArgs(argv) {
  const inputs = [];
  let keep = false;
  let target = '';
  let timeoutMs = 5000;
  let maxOutputChars = 12000;
  let tty = false;
  let programPath = '';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--target') {
      i++;
      target = argv[i] || '';
    } else if (arg === '--timeout-ms') {
      i++;
      timeoutMs = Number(argv[i]);
    } else if (arg === '--max-output-chars') {
      i++;
      maxOutputChars = Number(argv[i]);
    } else if (arg === '--tty') {
      tty = true;
    } else if (arg === '--input') {
      i++;
      if (i >= argv.length) {
        throw new Error('Missing value after --input');
      }
      inputs.push(argv[i]);
    } else if (arg === '--keep') {
      keep = true;
    } else if (!programPath) {
      programPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!target || !programPath || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    printUsageAndExit();
  }

  if (!Number.isFinite(maxOutputChars) || maxOutputChars <= 0) {
    throw new Error('--max-output-chars must be a positive number');
  }

  return { target, programPath, timeoutMs, maxOutputChars, inputs, keep, tty };
}

function capAppend(current, chunk, maxChars) {
  if (current.length >= maxChars) {
    return current;
  }

  const remaining = maxChars - current.length;
  if (chunk.length <= remaining) {
    return current + chunk;
  }

  return current + chunk.slice(0, remaining) + '\n[output truncated]\n';
}

function buildCommand(target, resolvedProgram, tmpDir) {
  const repoRoot = process.cwd();
  const oraclePath = expandTilde(process.env.LCC_ORACLE || '');

  if (target === 'interpreter') {
    const ext = path.extname(resolvedProgram).toLowerCase();
    if (ext !== '.e') {
      throw new Error('interpreter target expects a .e file');
    }

    return {
      command: process.execPath,
      args: [path.join(repoRoot, 'src/core/interpreter.js'), resolvedProgram],
      cwd: repoRoot,
      managedPaths: [],
    };
  }

  if (target === 'lcc') {
    const ext = path.extname(resolvedProgram).toLowerCase();
    if (ext !== '.a' && ext !== '.e' && ext !== '.bin' && ext !== '.hex' && ext !== '.o') {
      throw new Error('lcc target expects a known LCC input file');
    }

    return {
      command: process.execPath,
      args: [path.join(repoRoot, 'src/core/lcc.js'), resolvedProgram],
      cwd: repoRoot,
      managedPaths: [],
    };
  }

  if (target === 'oracle') {
    if (!oraclePath) {
      throw new Error('LCC_ORACLE is not set (see .env)');
    }

    if (!fs.existsSync(oraclePath)) {
      throw new Error(`LCC oracle not found: ${oraclePath}`);
    }

    const ext = path.extname(resolvedProgram).toLowerCase();
    if (ext !== '.a' && ext !== '.e') {
      throw new Error('oracle target expects a .a or .e file');
    }

    const base = path.basename(resolvedProgram, ext);
    const oracleBase = `${base}1${ext}`;
    const copiedProgram = path.join(tmpDir, oracleBase);

    fs.copyFileSync(resolvedProgram, copiedProgram);
    fs.writeFileSync(path.join(tmpDir, 'name.nnn'), 'TestUser\n');

    return {
      command: oraclePath,
      args: [oracleBase],
      cwd: tmpDir,
      managedPaths: [
        path.join(tmpDir, `${base}1.e`),
        path.join(tmpDir, `${base}1.lst`),
        path.join(tmpDir, `${base}1.bst`),
      ],
    };
  }

  throw new Error(`Unsupported target: ${target}`);
}

async function runWithTimeout(command, args, options) {
  const {
    cwd,
    timeoutMs,
    maxOutputChars,
    inputText,
    tty,
  } = options;

  let resolvedCommand = command;
  let resolvedArgs = args;

  if (tty) {
    const quoted = [command, ...args].map(part => `"${String(part).replace(/(["\\$`])/g, '\\$1')}"`).join(' ');
    resolvedCommand = 'script';
    resolvedArgs = ['-qec', quoted, '/dev/null'];
  }

  return await new Promise((resolve, reject) => {
    const child = spawn(resolvedCommand, resolvedArgs, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 250);
    }, timeoutMs);

    child.stdout.on('data', chunk => {
      stdout = capAppend(stdout, String(chunk), maxOutputChars);
    });

    child.stderr.on('data', chunk => {
      stderr = capAppend(stderr, String(chunk), maxOutputChars);
    });

    child.on('error', error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, timedOut });
    });

    if (inputText) {
      child.stdin.write(inputText);
    }
    child.stdin.end();
  });
}

async function main() {
  const { target, programPath, timeoutMs, maxOutputChars, inputs, keep, tty } = parseArgs(process.argv.slice(2));
  const resolvedProgram = path.resolve(process.cwd(), programPath);

  if (!fs.existsSync(resolvedProgram)) {
    throw new Error(`Program file not found: ${resolvedProgram}`);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-timed-experiment-'));
  const { command, args, cwd, managedPaths } = buildCommand(target, resolvedProgram, tmpDir);
  const inputText = inputs.length > 0 ? `${inputs.join('\n')}\n` : '';

  const result = await runWithTimeout(command, args, {
    cwd,
    timeoutMs,
    maxOutputChars,
    inputText,
    tty,
  });

  console.log(`Target: ${target}`);
  console.log(`Program: ${resolvedProgram}`);
  console.log(`Command: ${command} ${args.join(' ')}`);
  console.log(`Working directory: ${cwd}`);
  console.log(`Timeout (ms): ${timeoutMs}`);
  console.log(`TTY: ${tty ? 'yes' : 'no'}`);
  console.log(`Timed out: ${result.timedOut ? 'yes' : 'no'}`);
  console.log(`Exit code: ${result.code === null ? 'null' : result.code}`);
  console.log(`Signal: ${result.signal || 'none'}`);

  if (managedPaths.length > 0) {
    console.log('Artifacts:');
    for (const artifact of managedPaths) {
      console.log(`- ${artifact}: ${fs.existsSync(artifact) ? 'present' : 'missing'}`);
    }
  }

  if (result.stdout) {
    console.log('\n--- stdout ---');
    console.log(result.stdout);
  }

  if (result.stderr) {
    console.log('--- stderr ---');
    console.log(result.stderr);
  }

  if (!keep) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } else {
    console.log(`Temp dir kept: ${tmpDir}`);
  }

  process.exitCode = result.timedOut ? 124 : (result.code || 0);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
