// Removes characters that have no place in Python source: control characters, zero-width and
// direction marks, the byte-order mark and soft hyphens. They are invisible, so a student can't
// see why the code fails. Nothing else is changed. Tabs, spaces, quotes and line endings stay as copied.
// Zero-width joiners (\u200c, \u200d) stay because emoji in strings need them.
const INVISIBLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u00ad\u200b\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g;

export function cleanPaste(text: string): string {
  return text.replace(INVISIBLE, '');
}
