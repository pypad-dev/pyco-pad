import { describe, expect, it } from 'vitest';
import { cleanPaste } from '../src/paste';

const ch = (code: number) => String.fromCharCode(code);

describe('cleanPaste', () => {
  it('removes control characters but keeps tabs, newlines and carriage returns', () => {
    expect(cleanPaste(`a${ch(0)}b${ch(7)}c${ch(0x7f)}${ch(0x85)}\td\r\ne\n`)).toBe('abc\td\r\ne\n');
  });
  it('removes zero-width, direction and byte-order marks and soft hyphens', () => {
    expect(cleanPaste(`pr${ch(0x200b)}int${ch(0xfeff)}(1)${ch(0x202e)}${ch(0x2066)}${ch(0xad)}${ch(0x2060)}${ch(0x200e)}`)).toBe('print(1)');
  });
  it('keeps zero-width joiners so emoji in strings survive', () => {
    const family = `"a${ch(0x200d)}b${ch(0x200c)}c"`;
    expect(cleanPaste(family)).toBe(family);
  });
  it('changes nothing else', () => {
    const code = `def f(a):\n\treturn "\u201chi\u201d" + a${ch(0xa0)}# \u00e9\u00a0ok\n    x = 1\r\n`;
    expect(cleanPaste(code)).toBe(code);
  });
});
