'use strict';

const fs = require('fs');
const Assembler = require('../../src/core/assembler');
const LCC = require('../../src/cli/lcc');
const { installMockFileSystem } = require('../helpers/virtualFs');

jest.mock('fs');

function assembleToBytes(source, fileName) {
  const asm = new Assembler();
  const result = asm.assembleSource(source, { inputFileName: fileName });
  return result.outputBytes;
}

describe('LCC verbose integration: --verbose flag wiring through lcc.js', () => {
  let state;

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
  });

  afterAll(() => {
    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
    console.info.mockRestore();
    process.stdout.write.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    state = installMockFileSystem(fs);
  });

  test('lcc.js --verbose over a bad link emits [linker] prefix in stderr', () => {
    const src = `
        .extern ghost
        ld r0, ghost
        halt
    `;
    state.files['bad.o'] = assembleToBytes(src, 'bad.a');

    const lcc = new LCC();
    expect(() => lcc.main(['bad.o', '--verbose'])).not.toThrow();

    const linkerErrCall = console.error.mock.calls.find(
      c => c[0] && c[0].includes('[linker]')
    );
    expect(linkerErrCall).toBeDefined();
    expect(linkerErrCall[0]).toContain('ghost is an undefined external reference');
  });
});
