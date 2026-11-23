// The three panel layouts share one frame, so the icons are the same size and only the divider differs.
const icon = (layout: string, divider: string) =>
  `<svg data-layout="${layout}" xmlns="http://www.w3.org/2000/svg" width="1.3em" height="1.3em" viewBox="0 0 24 24" ` +
  `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `<rect x="3" y="4" width="18" height="16" rx="2"/>${divider}</svg>`;

export const LAYOUT_ICONS = {
  sideBySide: icon('side-by-side', '<line x1="12" y1="4" x2="12" y2="20"/>'),
  stacked: icon('stacked', '<line x1="3" y1="12" x2="21" y2="12"/>'),
  codeOnly: icon('code-only', ''),
};
