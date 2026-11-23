import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FONT_SIZE_PT, FONT_SIZE_KEY, MAX_FONT_SIZE_PT, MIN_FONT_SIZE_PT,
  clampFontSize, ptToPx, readSavedFontSize,
} from '../src/font-size';

const store = (items: Record<string, string>) => ({ getItem: (k: string) => items[k] ?? null });

describe('font size in points', () => {
  it('defaults to 11 pt, which is 14.67 px', () => {
    expect(DEFAULT_FONT_SIZE_PT).toBe(11);
    expect(ptToPx(11)).toBeCloseTo(14.667, 2);
    expect(ptToPx(12)).toBe(16);
  });

  it('uses the default when nothing is saved', () => {
    expect(readSavedFontSize(store({}))).toBe(11);
  });

  it('reads a saved size', () => {
    expect(readSavedFontSize(store({ [FONT_SIZE_KEY]: '14' }))).toBe(14);
  });

  it('ignores the old em-based preference, which every browser stored without being asked', () => {
    expect(readSavedFontSize(store({ py_ide_font_size_em: '1' }))).toBe(11);
    expect(readSavedFontSize(store({ py_ide_font_size_em: '1.4' }))).toBe(11);
  });

  it('falls back to the default for junk', () => {
    expect(readSavedFontSize(store({ [FONT_SIZE_KEY]: 'big' }))).toBe(11);
    expect(readSavedFontSize(store({ [FONT_SIZE_KEY]: '' }))).toBe(11);
  });

  it('keeps a saved size inside the allowed range', () => {
    expect(readSavedFontSize(store({ [FONT_SIZE_KEY]: '2' }))).toBe(MIN_FONT_SIZE_PT);
    expect(readSavedFontSize(store({ [FONT_SIZE_KEY]: '200' }))).toBe(MAX_FONT_SIZE_PT);
  });

  it('survives storage that throws', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); } };
    expect(readSavedFontSize(blocked)).toBe(11);
  });

  it('steps in whole points and stops at the limits', () => {
    expect(clampFontSize(11 + 1)).toBe(12);
    expect(clampFontSize(MIN_FONT_SIZE_PT - 1)).toBe(MIN_FONT_SIZE_PT);
    expect(clampFontSize(MAX_FONT_SIZE_PT + 1)).toBe(MAX_FONT_SIZE_PT);
    expect(clampFontSize(10.6)).toBe(11);
  });
});
