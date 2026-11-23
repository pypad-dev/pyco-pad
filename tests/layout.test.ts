import { describe, expect, it } from 'vitest';
import { KEEP_CODE_LINES, MIN_OUTPUT_PX, outputPanelHeight } from '../src/layout';

// A 300 px area, code lines of 22 px with 24 px padding and a 3 px divider.
const base = { min: MIN_OUTPUT_PX, container: 300, reserved: KEEP_CODE_LINES * 22 + 24 + 3 };

describe('outputPanelHeight', () => {
  it('shows all of a short output, but never less than the rail needs', () => {
    expect(outputPanelHeight({ ...base, content: 40 })).toBe(MIN_OUTPUT_PX);
  });

  it('fits an output that is taller than the minimum', () => {
    expect(outputPanelHeight({ ...base, content: 150 })).toBe(150);
  });

  it('leaves three lines of code when the output is long', () => {
    const most = 300 - (3 * 22 + 24 + 3);
    expect(outputPanelHeight({ ...base, content: 5000 })).toBe(most);
    expect(300 - most).toBe(93);
  });

  it('is the minimum when the area is too small to spare more', () => {
    expect(outputPanelHeight({ min: 80, container: 150, reserved: 93, content: 5000 })).toBe(80);
  });

  it('never exceeds the area', () => {
    expect(outputPanelHeight({ min: 80, container: 60, reserved: 93, content: 5000 })).toBe(60);
  });

  it('grows with the content between the limits', () => {
    const sizes = [100, 120, 140, 160].map((content) => outputPanelHeight({ ...base, content }));
    expect(sizes).toEqual([100, 120, 140, 160]);
  });
});
