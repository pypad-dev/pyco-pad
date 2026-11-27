// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { decode, encode, imageHeight, readHash } from '../src/code-image/format';
import { LINE_HEIGHT, PADDING, THEME, draw, measureWidth, toLines } from '../src/code-image/render';
import { starterCode } from '../src/code-image/starter';

// What real Python's base64.urlsafe_b64encode gives for this text, with the padding removed: the helper in the pad must agree.
const SAMPLE = 'print("hi")\nfor x in range(3):\n    print(x, "\u00e9")';
const SAMPLE_BASE64 = 'cHJpbnQoImhpIikKZm9yIHggaW4gcmFuZ2UoMyk6CiAgICBwcmludCh4LCAiw6kiKQ';

describe('encoding the code', () => {
  it('matches Python base64url, with no padding', () => {
    expect(encode(SAMPLE)).toBe(SAMPLE_BASE64);
    expect(encode('a')).toBe('YQ');
    expect(encode('ab')).toBe('YWI');
    expect(encode('abc')).toBe('YWJj');
  });
  it('reads back anything it wrote, accents and emoji included', () => {
    for (const text of ['', SAMPLE, 'x = "\u20ac \ud83d\ude00"', '\t\n\n  '])
      expect(decode(encode(text))).toBe(text);
  });
  it('says so when the text cannot be read', () => {
    expect(decode('!!!')).toBeNull();
    expect(decode('_w')).toBeNull(); // a lone invalid UTF-8 byte
  });
});

describe('image height', () => {
  it('is the lines at 22.4px plus 20px above and below, rounded up, in whole numbers the Python helper repeats', () => {
    expect([1, 3, 10, 25].map(imageHeight)).toEqual([63, 108, 264, 600]);
    for (const n of [1, 2, 3, 7, 10, 33]) expect(imageHeight(n)).toBe(Math.ceil(n * LINE_HEIGHT + PADDING * 2 - 1e-9));
  });
});

describe('reading the address', () => {
  it('means "no image" for nothing, or for the pad\'s own forms', () => {
    for (const h of ['', '#', '#c=abc', '#b=abc']) expect(readHash(h)).toBeNull();
  });
  it('reads the code, trimming blank lines at the ends', () => {
    expect(readHash('#' + encode('\n\nx = 1\n'))).toEqual({ ok: true, code: 'x = 1', alt: '' });
  });
  it('reads a description for screen readers', () => {
    expect(readHash('#' + encode('x') + '&alt=A%20loop%20%C3%A9')).toEqual({ ok: true, code: 'x', alt: 'A loop \u00e9' });
  });
  it('rejects what is not an image address', () => {
    expect(readHash('#!!!')).toEqual({ ok: false });
    expect(readHash('#' + encode('x') + '&alt=%E0%A4%A')).toEqual({ ok: false });
    expect(readHash('#' + encode('x') + '&other=1')).toEqual({ ok: false });
  });
});

describe('colouring the code', () => {
  const plain = (lines: ReturnType<typeof toLines>) => lines.map((l) => l.map((s) => s.text).join('')).join('\n');

  it('keeps the text exactly, line by line', () => {
    expect(plain(toLines('x = 1\n\nprint("a < b")'))).toBe('x = 1\n\nprint("a < b")');
    expect(toLines('a\nb\nc')).toHaveLength(3);
  });
  it('colours as the pad does', () => {
    const [line] = toLines('def f(): return "s"  # c');
    const colour = (text: string) => line.find((s) => s.text === text)?.color;
    expect(colour('def')).toBe(THEME.keyword);
    expect(colour('return')).toBe(THEME.keyword);
    expect(colour('"s"')).toBe(THEME.string);
    expect(colour('# c')).toBe(THEME.comment);
  });
  it('splits a string that runs over several lines, keeping its colour on each', () => {
    const lines = toLines('"""a\nb"""');
    expect(lines).toHaveLength(2);
    expect(lines[0][0].color).toBe(THEME.string);
    expect(lines[1][0].color).toBe(THEME.string);
  });
  it('shows a tab as four spaces', () => {
    expect(plain(toLines('if x:\n\ty'))).toBe('if x:\n    y');
  });
});

function fakeSurface() {
  const calls: Array<[string, string | number, number, number]> = [];
  const ctx: any = {
    font: '', fillStyle: '', textBaseline: '',
    fillRect: (x: number, y: number, w: number, h: number) => calls.push(['rect', ctx.fillStyle, w, h]),
    fillText: (t: string, x: number, y: number) => calls.push([t, ctx.fillStyle, x, y]),
    measureText: (t: string) => ({ width: t.length * 8 }),
  };
  return { ctx, calls };
}

describe('drawing the code', () => {
  it('sizes the image to the longest line, with the padding either side', () => {
    expect(measureWidth(fakeSurface().ctx, toLines('ab\nabcd'))).toBe(4 * 8 + PADDING * 2);
    expect(measureWidth(fakeSurface().ctx, toLines(''))).toBe(PADDING * 2);
  });
  it('fills the background, then writes each piece after the one before, a line lower each time', () => {
    const { ctx, calls } = fakeSurface();
    draw(ctx, toLines('def x\ny'), 100, imageHeight(2));
    expect(calls[0]).toEqual(['rect', THEME.background, 100, imageHeight(2)]);
    expect(calls.slice(1)).toEqual([
      ['def', THEME.keyword, PADDING, PADDING],
      [' x', THEME.plain, PADDING + 3 * 8, PADDING],
      ['y', THEME.plain, PADDING, PADDING + LINE_HEIGHT],
    ]);
  });
});

describe('the helper the pad opens with', () => {
  const code = starterCode('https://example.test/v1.1.0');
  it('points the iframe at the folder the page was served from', () => {
    expect(code).toContain('SITE = "https://example.test/v1.1.0"');
    expect(code).toContain("'/code-image#'");
  });
  it('carries its own base64, because Skulpt has none, and the same height sum as the page', () => {
    expect(code).not.toMatch(/import base64/);
    expect(code).toContain('def base64url(data)');
    expect(code).toContain('(code.count("\\n") + 1) * 224 + 400) // 10');
  });
  it('has an example to try and ends by printing the iframe', () => {
    expect(code).toContain('for val in range(6)');
    expect(code.trimEnd().endsWith('print(code_image_iframe(CODE, ALT))')).toBe(true);
  });
});
