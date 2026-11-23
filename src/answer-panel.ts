import { NOTES_MAX_CHARS, pack, unpack } from './answer-format';
import { cleanPaste } from './paste';

export interface AnswerOptions {
  /** The notes view and its toolbar icon; notes are saved with the answer. */
  notes: boolean;
  /** The last output is saved with the answer. */
  output: boolean;
}

interface CodeEditor {
  readonly isReadOnly: boolean;
  getValue(): string;
  setValue(text: string): void;
  setReadOnly(readOnly: boolean): void;
  insertContent(text: string): void;
  /** Opens the panel if it was closed; true when it had to. */
  revealOutput(): boolean;
}

interface OutputSource {
  savedOutput(): string;
  showSaved(text: string): void;
}

const $ = (id: string) => document.getElementById(id) as HTMLElement;

// Gives the student a notes view in the output panel and decides what is saved with the code (see answer-format.ts).
// It stands in for the editor wherever the host sync saves and loads the answer.
export class AnswerPanel {
  onChange: () => void = () => {};
  private notes = $('notes') as HTMLTextAreaElement;
  private showingNotes = false;
  private ranCode: string | null = null;
  private last = '';
  private cutOff = false;

  constructor(private editor: CodeEditor, private runner: OutputSource, private options: AnswerOptions) {
    const canvas = $('output');
    this.notes.maxLength = NOTES_MAX_CHARS;
    $('btn-notes').hidden = !options.notes;

    $('btn-notes').addEventListener('click', () => {
      const opened = this.editor.revealOutput();
      this.show(opened || !this.showingNotes ? 'notes' : 'output');
    });
    this.notes.addEventListener('input', () => {
      this.cutOff = false;
      this.showCount();
      this.changed();
    });
    this.notes.addEventListener('paste', (e) => this.pasteNotes(e));
    $('editing').addEventListener('input', () => this.refreshStale());
    new MutationObserver(() => this.changed()).observe(canvas, { childList: true, characterData: true, subtree: true });
  }

  get isReadOnly(): boolean {
    return this.editor.isReadOnly;
  }

  setReadOnly(readOnly: boolean) {
    this.editor.setReadOnly(readOnly);
    this.notes.readOnly = readOnly;
  }

  insertContent(text: string) {
    this.editor.insertContent(text);
  }

  /** What is saved: the code, with the notes and output after it when those are switched on. */
  getValue(): string {
    this.last = this.current();
    return this.last;
  }

  setValue(text: string) {
    if (!this.options.notes && !this.options.output) {
      this.editor.setValue(text);
      return;
    }
    const answer = unpack(text);
    this.editor.setValue(answer.code);
    this.notes.value = this.options.notes ? answer.notes : '';
    this.runner.showSaved(this.options.output ? answer.output : '');
    this.showCount();
    this.ranCode = answer.stale ? null : answer.code;
    this.refreshStale();
    this.last = this.current();
  }

  /** Call when Run is pressed: the output is the one thing to look at. */
  beforeRun() {
    this.editor.revealOutput();
    this.show('output');
    this.ranCode = this.editor.getValue();
  }

  // Pasted notes lose invisible characters, as pasted code does, and are never cut off silently.
  private pasteNotes(e: ClipboardEvent) {
    if (this.notes.readOnly) return;
    const raw = e.clipboardData?.getData('text/plain');
    if (!raw) return;
    e.preventDefault();
    const clean = cleanPaste(raw);
    const { selectionStart: start, selectionEnd: end, value } = this.notes;
    const text = clean.slice(0, Math.max(0, NOTES_MAX_CHARS - (value.length - (end - start))));
    if (text) {
      let done = false;
      try {
        done = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
      } catch {
        done = false;
      }
      if (!done) {
        this.notes.setRangeText(text, start, end, 'end');
        this.notes.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    this.cutOff = text.length < clean.length;
    this.showCount();
  }

  // Says nothing until the notes are nearly full or a paste was cut short.
  private showCount() {
    const el = $('notes-count');
    const length = this.notes.value.length;
    if (this.cutOff) {
      el.textContent = 'That paste was too long. The end of it was not added.';
    } else if (length >= NOTES_MAX_CHARS * 0.9) {
      el.textContent = `${length.toLocaleString('en')} / ${NOTES_MAX_CHARS.toLocaleString('en')} characters`;
    } else {
      el.textContent = '';
    }
    el.hidden = !el.textContent;
  }

  private current(): string {
    return pack({
      code: this.editor.getValue(),
      notes: this.options.notes ? this.notes.value : '',
      output: this.options.output ? this.runner.savedOutput() : '',
      stale: this.isStale(),
    });
  }

  private isStale(): boolean {
    return this.runner.savedOutput() !== '' && this.ranCode !== this.editor.getValue();
  }

  private changed() {
    if (this.current() !== this.last) this.onChange();
  }

  private show(view: 'output' | 'notes') {
    this.showingNotes = view === 'notes';
    $('output-wrapper').classList.toggle('show-notes', this.showingNotes);
    $('output').hidden = this.showingNotes;
    $('notes-pane').hidden = !this.showingNotes;
    $('btn-clear').hidden = this.showingNotes;
    $('panel-title').textContent = this.showingNotes ? 'NOTES' : 'OUTPUT';
    $('btn-notes').setAttribute('aria-pressed', String(this.showingNotes));
    if (this.showingNotes) this.notes.focus();
  }

  // A note at the top of the output says when it no longer matches the code.
  private refreshStale() {
    if (!this.options.output) return;
    const output = $('output');
    const notice = output.querySelector('.output-stale');
    const stale = this.isStale();
    if (stale && !notice) {
      const el = document.createElement('div');
      el.className = 'output-stale';
      el.textContent = 'Code changed since this ran';
      output.prepend(el);
    } else if (!stale && notice) {
      notice.remove();
    }
  }
}
