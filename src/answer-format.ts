// The saved Moodle answer is the student's code, then optional notes and output as comment blocks at the end:
//
//   print("hi")
//
//   # --- notes ---
//   # plan: loop first
//   # --- end notes ---
//   # --- output ---
//   # hi
//   # --- end output ---
//
// Every line in a block starts with "# ", so no content can look like a marker, and the whole answer is still valid
// Python. A block counts only at the very end of the text and in this order; anything else is all code, so a
// damaged answer is never lost, just left for the student to tidy.

export interface Answer {
  code: string;
  notes: string;
  output: string;
  /** The code was edited after the output was produced. */
  stale: boolean;
}

export const OUTPUT_MAX_LINES = 40;
export const OUTPUT_MAX_CHARS = 2000;
export const NOTES_MAX_CHARS = 10000;
const OMITTED = '[earlier output not saved]';

const STALE_TEXT = ' (code changed since it ran)';
const NOTES_START = '# --- notes ---';
const NOTES_END = '# --- end notes ---';
const OUTPUT_START = '# --- output ---';
const OUTPUT_START_STALE = `# --- output${STALE_TEXT} ---`;
const OUTPUT_END = '# --- end output ---';

const prefix = (text: string) => text.split('\n').map((l) => (l ? '# ' + l : '#')).join('\n');
const unprefix = (line: string) => (line === '#' ? '' : line.slice(2));
const isPrefixed = (line: string) => line === '#' || line.startsWith('# ');

/** Keeps the end of the output, which is where a program's last words and any error are. */
export function curtailOutput(output: string): string {
  let text = output.replace(/\r\n?/g, '\n').trim();
  let cut = false;
  const lines = text.split('\n');
  if (lines.length > OUTPUT_MAX_LINES) {
    text = lines.slice(-OUTPUT_MAX_LINES).join('\n');
    cut = true;
  }
  if (text.length > OUTPUT_MAX_CHARS) {
    text = text.slice(-OUTPUT_MAX_CHARS);
    cut = true;
  }
  return cut ? OMITTED + '\n' + text : text;
}

// Blank lines at either end go, and trailing spaces; the first line keeps its indentation.
const tidyNotes = (notes: string) => notes.replace(/^(?:[ \t]*\r?\n)+/, '').replace(/\s+$/, '');

export function pack({ code, notes, output, stale }: Answer): string {
  const blocks: string[] = [];
  const note = tidyNotes(notes);
  if (note) blocks.push(`${NOTES_START}\n${prefix(note)}\n${NOTES_END}`);
  if (output.trim()) blocks.push(`${stale ? OUTPUT_START_STALE : OUTPUT_START}\n${prefix(curtailOutput(output))}\n${OUTPUT_END}`);
  if (!blocks.length) return code;
  return code.replace(/\s+$/, '') + '\n\n' + blocks.join('\n');
}

// Takes the block that ends at the last line, if there is one, and returns its text and the lines before it.
function takeBlock(lines: string[], starts: string[], end: string): { body: string; rest: string[]; start: string } | null {
  if (lines[lines.length - 1] !== end) return null;
  for (let i = lines.length - 2; i >= 0; i--) {
    if (starts.includes(lines[i])) {
      return { body: lines.slice(i + 1, -1).map(unprefix).join('\n'), rest: lines.slice(0, i), start: lines[i] };
    }
    if (!isPrefixed(lines[i])) return null;
  }
  return null;
}

export function unpack(text: string): Answer {
  const whole: Answer = { code: text, notes: '', output: '', stale: false };
  let lines = text.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length && !lines[lines.length - 1].trim()) lines = lines.slice(0, -1);

  let output = '';
  let stale = false;
  const out = takeBlock(lines, [OUTPUT_START, OUTPUT_START_STALE], OUTPUT_END);
  if (out) {
    output = out.body;
    stale = out.start === OUTPUT_START_STALE;
    lines = out.rest;
  }
  let notes = '';
  const note = takeBlock(lines, [NOTES_START], NOTES_END);
  if (note) {
    notes = note.body;
    lines = note.rest;
  }
  if (!out && !note) return whole;
  while (lines.length && !lines[lines.length - 1].trim()) lines = lines.slice(0, -1);
  return { code: lines.join('\n'), notes, output, stale };
}
