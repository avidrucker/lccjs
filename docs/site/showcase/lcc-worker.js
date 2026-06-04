'use strict';
// Web Worker wrapper for the LCC browser playground.
//
// Load via:  new Worker('./lcc-worker.js')  from the showcase page.
// The worker imports lcc.bundle.js which sets self.lcc = { assemble, run }.
//
// Protocol (main → worker):
//   { type: 'run',    src: string, stdinLines: string[], maxSteps: number }
//   { type: 'resume', input: string }
//
// Protocol (worker → main):
//   { status: 'halted',            output: string }
//   { status: 'max-steps-reached', output: string }
//   { status: 'assembly-error',    message: string }
//   { status: 'error',             message: string }
//   { status: 'waiting-for-input', partialOutput: string, trapType: string }

const DEFAULT_MAX_STEPS = 50_000;

// Load the bundle so self.lcc is available.  Path is relative to the worker
// script location (docs/site/showcase/lcc-worker.js → docs/site/dist/).
try {
  importScripts('../dist/lcc.bundle.js');
} catch (_) {
  // bundle absent (e.g. file:// during local dev before #705 deploys it)
}

let resumeFn = null;

function handleResult(result) {
  if (result && result.status === 'waiting-for-input') {
    resumeFn = result.resume;
    self.postMessage({ status: 'waiting-for-input', partialOutput: result.partialOutput || '', trapType: result.trapType });
  } else if (result && result.maxStepsReached) {
    resumeFn = null;
    self.postMessage({ status: 'max-steps-reached', output: result.stdout });
  } else {
    resumeFn = null;
    self.postMessage({ status: 'halted', output: (result && result.stdout) || '' });
  }
}

self.onmessage = function (e) {
  const { type } = e.data || {};

  if (type === 'run') {
    resumeFn = null;
    const { src, stdinLines = [], maxSteps = DEFAULT_MAX_STEPS } = e.data;

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

    handleResult(api.run(asmResult.binary, { stdin: stdinLines, maxSteps, pauseOnInput: true }));

  } else if (type === 'resume') {
    if (!resumeFn) return;
    const fn = resumeFn;
    resumeFn = null;
    handleResult(fn(e.data.input || ''));
  }
};
