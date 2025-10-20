// tests/helpers/hex.js
function toHex(u8) {
  return Array.from(u8, b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
}

function hexdump(u8, width = 16) {
  let out = [];
  for (let i = 0; i < u8.length; i += width) {
    const slice = u8.slice(i, i + width);
    const hex = Array.from(slice, b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    const ascii = Array.from(slice, b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('');
    out.push(`${i.toString(16).padStart(6,'0')}: ${hex.padEnd(width*3-1,' ')}  ${ascii}`);
  }
  return out.join('\n');
}

// simple byte-by-byte diff (git-ish flavor, minimal)
function diffHex(actual, expected) {
  const a = toHex(actual).split(' ');
  const e = toHex(expected).split(' ');
  const lines = [];
  const len = Math.max(a.length, e.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? '  ';
    const ei = e[i] ?? '  ';
    const mark = ai === ei ? ' ' : '!';
    lines.push(`${mark} ${i.toString(16).padStart(6,'0')}: ${ai}  ${ei}`);
  }
  return lines.join('\n');
}

module.exports = { toHex, hexdump, diffHex };
