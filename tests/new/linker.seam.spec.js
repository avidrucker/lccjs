// linker.seam.spec.js
//
// Regression contract for the linker.js pure seam `linkObjectModules(buffers, options)`.
// Authored by #1224 (ARCHITECT, design-only); implemented by #1274 (DEV).
//
// Originally authored as `test.failing` specs (the design contract before the seam
// existed); #1274 implemented the seam and flipped them to ordinary `test` (per
// docs/project-gotchas.md §5: `test.failing` is for a confirmed gap with an open fix
// ticket — once fixed, the annotation is removed).
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
  test('links two in-memory .o buffers into a single .e executable buffer', () => {
    const moduleA = objectModule({ start: 0, code: [0x0000] });
    const moduleB = objectModule({ code: [0x0000] });

    const result = new Linker().linkObjectModules([moduleA, moduleB], {});

    // Mirrors assembler's createAssemblyResult shape: the produced binary is `outputBytes`.
    expect(result).toHaveProperty('outputBytes');
    expect(Buffer.isBuffer(result.outputBytes)).toBe(true);
    // A linked executable begins with the 'o' signature (see Linker.createExecutable).
    expect(result.outputBytes[0]).toBe(O_SIGNATURE);
  });

  test('throws LinkerError on a buffer with a bad object-module signature', () => {
    const notLinkable = Buffer.from([0x00, 0x43]); // first byte is not 'o'

    expect(() => new Linker().linkObjectModules([notLinkable], {})).toThrow(LinkerError);
  });
});
