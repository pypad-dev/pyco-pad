// The pad's font size is set in points, as in Office: 11 pt by default, in 1 pt steps.
export const DEFAULT_FONT_SIZE_PT = 11;
export const MIN_FONT_SIZE_PT = 6;
export const MAX_FONT_SIZE_PT = 36;
export const FONT_SIZE_KEY = 'py_ide_font_size_pt';

/** CSS pixels in a point (96 px per inch, 72 pt per inch). */
export const ptToPx = (pt: number) => (pt * 4) / 3;

export const clampFontSize = (pt: number) => Math.min(MAX_FONT_SIZE_PT, Math.max(MIN_FONT_SIZE_PT, Math.round(pt)));

/** The size the user chose earlier, or the default. Only a deliberate choice is ever stored. */
export function readSavedFontSize(storage: Pick<Storage, 'getItem'>): number {
  try {
    const saved = parseFloat(storage.getItem(FONT_SIZE_KEY) ?? '');
    return Number.isFinite(saved) ? clampFontSize(saved) : DEFAULT_FONT_SIZE_PT;
  } catch {
    return DEFAULT_FONT_SIZE_PT;
  }
}
