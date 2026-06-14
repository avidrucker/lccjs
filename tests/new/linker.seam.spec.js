// linker.seam.spec.js
//
// Design contract for the linker.js pure seam `linkObjectModules(buffers, options)`.
// Authored by #1224 (ARCHITECT, design-only); implemented by #1274 (DEV, blocked-by #1224).
//
// These use `test.failing` deliberately (docs/project-gotchas.md §5): the seam is a
// confirmed gap with an open fix ticket (#1274), so the tests RUN, document the intended
// contract, and report green while the method is unimplemented (the call throws TypeError).
// When #1274 lands, the assertions pass — which flips `test.failing` to a FAILURE, the
// signal to delete the `.failing` annotations and keep these as ordinary regression tests.
//
// No `fs` mocking: the seam consumes Buffers and returns a Buffer. Passing buffers directly
// is the contract — an implementation that reached for `fs` here would be visibly wrong.

const Linker = require('../../src/core/linker');
const { LinkerError } = require('../../src/utils/errors');

// Build a minimal valid .o object-module buffer, matching the on-disk format parsed by
// Linker.parseObjectModuleBuffer: 'o' signature, optional 'S' start entry, 'C' header
// terminator, then little-endian code words. (See the byte layout pinned in
// linker.unit.spec.js → readObjectModule.)
function objectModule({ start, code = [] }) {
  const parts = [Buffer.from('o', 'ascii')];
  if (start !== undefined) {
    const s = Buffer.alloc(3);
    s.write('S', 0, 'ascii');
    s.writeUInt16LE(start, 1);
    parts.push(s);
  }
  parts.push(Buffer.from('C', 'ascii'));
  const codeBuf = Buffer.alloc(code.length * 2);
  code.forEach((word, i) => codeBuf.writeUInt16LE(word & 0xffff, i * 2));
  parts.push(codeBuf);
  return Buffer.concat(parts);
}

const O_SIGNATURE = 'o'.charCodeAt(0); // 0x6f — first byte of a linked .e executable

describe('linker pure seam: linkObjectModules(buffers, options) — design contract (#1224 → #1274)', () => {
  test.failing('links two in-memory .o buffers into a single .e executable buffer', () => {
    const moduleA = objectModule({ start: 0, code: [0x0000] });
    const moduleB = objectModule({ code: [0x0000] });

    const result = new Linker().linkObjectModules([moduleA, moduleB], {});

    // Mirrors assembler's createAssemblyResult shape: the produced binary is `outputBytes`.
    expect(result).toHaveProperty('outputBytes');
    expect(Buffer.isBuffer(result.outputBytes)).toBe(true);
    // A linked executable begins with the 'o' signature (see Linker.createExecutable).
    expect(result.outputBytes[0]).toBe(O_SIGNATURE);
  });

  test.failing('throws LinkerError on a buffer with a bad object-module signature', () => {
    const notLinkable = Buffer.from([0x00, 0x43]); // first byte is not 'o'

    expect(() => new Linker().linkObjectModules([notLinkable], {})).toThrow(LinkerError);
  });
});
