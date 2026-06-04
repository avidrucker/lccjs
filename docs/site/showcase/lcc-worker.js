'use strict';
// Web Worker wrapper for the LCC browser playground.
//
// Load via:  new Worker('./lcc-worker.js')  from the showcase page.
// The worker imports lcc.bundle.js which sets self.lcc = { assemble, run }.
//
// Protocol (main → worker):
//   { type: 'run', src: string, stdinLines: string[], maxSteps: number }
//
// Protocol (worker → main):
//   { status: 'halted',           output: string }
//   { status: 'max-steps-reached', output: string }
//   { status: 'assembly-error',   message: string }
//   { status: 'error',            message: string }
//
// pauseOnInput handshake (#694/#702): stubbed — pre-supplied stdinLines are
// consumed by executeBuffer; programs exhausting stdin will receive an empty
// string on subsequent reads (interpreter default).  Full interactive pause
// will be wired once #702 lands.

const DEFAULT_MAX_STEPS = 50_000;

// Load the bundle so self.lcc is available.  Path is relative to the worker
// script location (docs/site/showcase/lcc-worker.js → docs/site/dist/).
try {
  importScripts('../dist/lcc.bundle.js');
} catch (_) {
  // bundle absent (e.g. file:// during local dev before #705 deploys it)
}

self.onmessage = function (e) {
  const { type, src, stdinLines = [], maxSteps = DEFAULT_MAX_STEPS } = e.data || {};

  if (type !== 'run') return;

  const api = self.lcc;
  if (!api || typeof api.assemble !== 'function') {
    self.postMessage({ status: 'error', message: 'lcc bundle not loaded in worker' });
    return;
  }

  const asmResult = api.assemble(src);
  if (!asmResult.ok) {
    self.postMessage({ status: 'assembly-error', message: asmResult.errors });
    return;
  }

  const runResult = api.run(asmResult.binary, { stdin: stdinLines, maxSteps });

  if (runResult.maxStepsReached) {
    self.postMessage({ status: 'max-steps-reached', output: runResult.stdout });
  } else {
    self.postMessage({ status: 'halted', output: runResult.stdout });
  }
};
