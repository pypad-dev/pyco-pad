import { describe, expect, it } from 'vitest';
import { highlightPython as h } from '../src/highlight';

const tok = (cls: string, s: string) => `<span class="token-${cls}">${s}</span>`;

describe('highlightPython', () => {
  it('colours keywords, numbers and comments', () => {
    expect(h('return 1 # done')).toBe(`${tok('keyword', 'return')} ${tok('number', '1')} ${tok('comment', '# done')}`);
  });

  it('keeps a triple-quoted string together across lines', () => {
    const out = h('"""if x\nreturn"""');
    expect(out).toBe(tok('string', '"""if x\nreturn"""'));
  });

  it('stops an unclosed quote at the end of the line', () => {
    const out = h("x = 'abc\nif y: pass");
    expect(out).toContain(tok('string', "'abc"));
    expect(out).toContain(tok('keyword', 'if'));
  });

  it('does not treat # inside a string as a comment', () => {
    expect(h('"# no" # yes')).toBe(`${tok('string', '"# no"')} ${tok('comment', '# yes')}`);
  });

  it('handles escaped quotes', () => {
    expect(h('"a\\"b"')).toBe(tok('string', '"a\\"b"'));
  });

  it.each(['3.14', '0xFF', '1e5', '1_000', '2j', '0b101'])('treats %s as one number', (n) => {
    expect(h(n)).toBe(tok('number', n));
  });

  it.each(['r"\\d+"', "b'x'", 'rb"y"', "u'z'"])('recognises the string prefix in %s', (s) => {
    expect(h(s)).toBe(tok('string', s.replace(/</g, '&lt;')));
  });

  it('highlights f-string expressions and leaves {{ }} literal', () => {
    const out = h('f"hi {a+1} {{lit}}"');
    expect(out).toContain(`<span style="color: #d4d4d4;">{a+${tok('number', '1')}}</span>`);
    expect(out).toContain('{{lit}}');
  });

  it('handles nested braces in an f-string expression', () => {
    expect(h('f"{x:>{w}}"')).toContain('{x:&gt;{w}}');
  });

  it('escapes HTML', () => {
    expect(h('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d');
  });

  it('does not match keywords inside identifiers', () => {
    expect(h('my_if = elif_x + x1')).toBe('my_if = elif_x + x1');
  });

  it('recognises async keywords and decorators', () => {
    expect(h('@cache\nasync def f(): await g()')).toContain(tok('decorator', '@cache'));
    expect(h('await g()')).toContain(tok('keyword', 'await'));
  });

  it('never loses or adds visible characters', () => {
    const src = 'def f(a, b=2):\n    """doc <b>"""\n    s = f"{a} & {b}" # c\n    return \'x\' + "y\n';
    const text = h(src).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    expect(text).toBe(src);
  });
});
