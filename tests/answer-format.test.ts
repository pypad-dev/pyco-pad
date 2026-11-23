import { describe, expect, it } from 'vitest';
import { OUTPUT_MAX_CHARS, OUTPUT_MAX_LINES, curtailOutput, pack, unpack } from '../src/answer-format';

const A = { code: 'print("hi")', notes: '', output: '', stale: false };

describe('pack', () => {
  it('writes only the code when there is nothing else, so plain answers are untouched', () => {
    expect(pack(A)).toBe('print("hi")');
    expect(pack({ ...A, code: 'x = 1\n\n' })).toBe('x = 1\n\n');
  });

  it('writes notes and output as commented blocks after the code', () => {
    expect(pack({ ...A, notes: 'plan: loop', output: 'hi' })).toBe(
      'print("hi")\n\n# --- notes ---\n# plan: loop\n# --- end notes ---\n# --- output ---\n# hi\n# --- end output ---'
    );
  });

  it('marks output that is out of date, and writes blank lines as a bare #', () => {
    const text = pack({ ...A, output: 'a\n\nb', stale: true });
    expect(text).toContain('# --- output (code changed since it ran) ---\n# a\n#\n# b\n');
  });

  it('is valid Python: every added line is a comment', () => {
    const text = pack({ ...A, notes: 'a\n\n"""b"""', output: "c'''" });
    const added = text.split('\n').slice(2);
    expect(added.every((l) => l.startsWith('#'))).toBe(true);
  });
});

describe('notes tidying', () => {
  it('keeps the first line indented and drops blank lines at the ends', () => {
    expect(pack({ ...A, notes: '\n  \n    indented\nnext  \n\n' })).toContain('# --- notes ---\n#     indented\n# next\n# --- end notes ---');
  });
  it('writes no block for notes that are only blank', () => {
    expect(pack({ ...A, notes: ' \n\t\n' })).toBe('print("hi")');
  });
});

describe('unpack', () => {
  it('reads back what pack wrote, including awkward text', () => {
    const answer = { code: 'for i in range(3):\n    print(i)', notes: 'line one\n\n  indented\n# --- end notes ---', output: '0\n1\n"""\n# --- output ---\n2', stale: false };
    expect(unpack(pack(answer))).toEqual(answer);
  });

  it('reads the stale flag', () => {
    expect(unpack(pack({ ...A, output: 'x', stale: true })).stale).toBe(true);
    expect(unpack(pack({ ...A, output: 'x', stale: false })).stale).toBe(false);
  });

  it('reads notes alone and output alone', () => {
    expect(unpack(pack({ ...A, notes: 'n' }))).toEqual({ ...A, notes: 'n' });
    expect(unpack(pack({ ...A, output: 'o' }))).toEqual({ ...A, output: 'o' });
  });

  it('returns plain code untouched', () => {
    const t = 'x = 1\n# a comment\n';
    expect(unpack(t)).toEqual({ code: t, notes: '', output: '', stale: false });
  });

  it('accepts Windows line endings and trailing blank lines from Moodle', () => {
    const text = pack({ ...A, notes: 'n', output: 'o' }).replace(/\n/g, '\r\n') + '\r\n\r\n';
    expect(unpack(text)).toEqual({ ...A, notes: 'n', output: 'o' });
  });

  it('keeps everything as code when a block is damaged', () => {
    const damaged = [
      'x = 1\n\n# --- notes ---\n# a',                                       // never closed
      'x = 1\n\n# --- notes ---\nno prefix\n# --- end notes ---',              // body line is not a comment
      'x = 1\n# --- end notes ---',                                           // no start
      'x = 1\n\n# --- output ---\n# o\n# --- end output ---\ny = 2',         // not at the end
      '# --- notes ---\n# a\n# --- end notes ---\n# --- end output ---',      // end with no start
    ];
    for (const t of damaged) expect(unpack(t)).toEqual({ code: t, notes: '', output: '', stale: false });
  });

  it('leaves notes in the code when they come after the output', () => {
    const t = 'x\n\n# --- output ---\n# o\n# --- end output ---\n# --- notes ---\n# n\n# --- end notes ---';
    const got = unpack(t);
    expect(got.notes).toBe('n');
    expect(got.output).toBe('');
    expect(got.code).toContain('# --- output ---');
  });
});

describe('curtailOutput', () => {
  it('keeps short output as it is', () => {
    expect(curtailOutput('a\nb\n')).toBe('a\nb');
  });

  it('keeps the last lines of a long output and says that the start was left out', () => {
    const long = Array.from({ length: 100 }, (_, i) => 'line ' + i).join('\n');
    const got = curtailOutput(long).split('\n');
    expect(got[0]).toBe('[earlier output not saved]');
    expect(got).toHaveLength(OUTPUT_MAX_LINES + 1);
    expect(got[got.length - 1]).toBe('line 99');
  });

  it('keeps the end of a single enormous line', () => {
    const got = curtailOutput('x'.repeat(OUTPUT_MAX_CHARS * 3) + 'END');
    expect(got.endsWith('END')).toBe(true);
    expect(got.length).toBeLessThanOrEqual(OUTPUT_MAX_CHARS + 40);
  });
});
