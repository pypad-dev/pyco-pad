import { highlightPython } from './highlight';
import { cleanPaste } from './paste';
import { PanelLayout } from './layout';

// Above this size the colouring is skipped so a huge paste can never stall the page.
const MAX_HIGHLIGHT_CHARS = 200_000;
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class Editor {
  private editing: HTMLTextAreaElement;
  private highlighting: HTMLElement;
  private highlightingContent: HTMLElement;
  private lineNumbers: HTMLElement;
  private currentLineCount: number = 0;
  private tabLeavesEditor = false;
  private layout: PanelLayout;
  
  constructor() {
    this.editing = document.getElementById('editing') as HTMLTextAreaElement;
    this.highlighting = document.getElementById('highlighting') as HTMLElement;
    this.highlightingContent = document.getElementById('highlighting-content') as HTMLElement;
    this.lineNumbers = document.getElementById('line-numbers') as HTMLElement;
    
    this.setupListeners();
    this.layout = new PanelLayout(this.editing);
  }
  
  private setupListeners() {
    this.editing.addEventListener('input', () => {
      this.updateView(this.editing.value);
      this.syncScroll();
    });
    
    this.editing.addEventListener('scroll', () => {
      this.syncScroll();
    });
    
    this.editing.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.editing.addEventListener('blur', () => { this.tabLeavesEditor = false; });
    // Clicking the gutter or padding focuses the editor; focus never moves on hover.
    document.getElementById('custom-editor-container')?.addEventListener('click', () => this.editing.focus());
    this.editing.addEventListener('paste', (e) => this.handlePaste(e));

  }
  
  public getValue(): string {
    return this.editing.value;
  }
  
  public setValue(text: string) {
    this.editing.value = text;
    this.updateView(text);
  }
  
  public setReadOnly(readOnly: boolean) {
    this.editing.readOnly = readOnly;
  }
  
  /** Shows the panel in the layout it was last shown in. Returns true if it had been closed. */
  public revealOutput(): boolean {
    return this.layout.revealOutput();
  }

  public get isReadOnly(): boolean {
    return this.editing.readOnly;
  }
  
  public insertContent(content: string) {
    if (this.isReadOnly) return;
    const start = this.editing.selectionStart;
    const end = this.editing.selectionEnd;
    
    this.editing.value = 
      this.editing.value.substring(0, start) + 
      content + 
      this.editing.value.substring(end);
      
    this.editing.selectionStart = this.editing.selectionEnd = start + content.length;
    this.editing.focus();
    
    this.updateView(this.editing.value);
    this.editing.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  private updateView(text: string) {
    this.updateLineNumbers(text);
    this.render(text);
  }

  // Draws the highlight layer from the given text; never throws, so the textarea stays usable.
  private render(text: string) {
    let html: string;
    try {
      html = text.length > MAX_HIGHLIGHT_CHARS ? escapeHtml(text) : highlightPython(text);
    } catch (e) {
      console.warn('Highlighting failed, showing plain text:', e);
      html = escapeHtml(text);
    }
    // A trailing newline needs a character after it, or the layer is a line shorter than the textarea.
    this.highlightingContent.innerHTML = text.endsWith('\n') ? html + ' ' : html;
    this.syncScroll();
  }

  private syncScroll() {
    this.highlighting.scrollTop = this.editing.scrollTop;
    this.highlighting.scrollLeft = this.editing.scrollLeft;
    this.lineNumbers.scrollTop = this.editing.scrollTop;
  }
  
  private updateLineNumbers(text: string) {
    const lines = text.split('\n').length;
    if (lines !== this.currentLineCount) {
      let nums = '';
      for (let i = 1; i <= lines; i++) {
        nums += i + '\n';
      }
      this.lineNumbers.textContent = nums;
      this.currentLineCount = lines;
    }
  }

  // --- SMART TYPING HELPERS ---
  private insertTextAtCursor(text: string) {
    this.editing.focus();
    let done = false;
    try {
      done = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
    } catch {
      done = false;
    }
    if (!done) {
      const start = this.editing.selectionStart;
      const end = this.editing.selectionEnd;
      this.editing.setRangeText(text, start, end, 'end');
      this.editing.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  
  private deleteSelectedText() {
    this.editing.focus();
    if (typeof document.execCommand !== 'function' || !document.execCommand('delete', false, '')) {
      const start = this.editing.selectionStart;
      const end = this.editing.selectionEnd;
      this.editing.value = this.editing.value.substring(0, start) + this.editing.value.substring(end);
      this.editing.selectionStart = this.editing.selectionEnd = start;
      this.updateView(this.editing.value);
    }
  }
  
  private getLineIndent(text: string, index: number): string {
    const lineStart = text.lastIndexOf('\n', index - 1) + 1;
    let i = lineStart;
    while (i < text.length && (text[i] === ' ' || text[i] === '\t')) {
        i++;
    }
    return text.substring(lineStart, i);
  }
  
  private findMatchingBracket(text: string, closeIndex: number): number | null {
    const closeChar = text[closeIndex];
    const openChar = closeChar === ')' ? '(' : (closeChar === ']' ? '[' : '{');
    let depth = 1;
    for (let i = closeIndex - 1; i >= 0; i--) {
        const c = text[i];
        if (c === closeChar) depth++;
        else if (c === openChar) depth--;
        if (depth === 0) return i;
    }
    return null;
  }
  
  private analyzeLineBrackets(line: string) {
    let stack = [];
    let inString = false;
    let stringChar: string | null = null;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (inString) {
            if (char === stringChar && line[i - 1] !== '\\') inString = false;
            continue;
        }
        if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
            continue;
        }
        if (char === '#') break;

        if (['(', '[', '{'].includes(char)) {
            stack.push({ char, index: i });
        } else if ([']', ')', '}'].includes(char)) {
            if (stack.length > 0) {
                const last = stack[stack.length - 1];
                if ((char === ']' && last.char === '[') ||
                    (char === ')' && last.char === '(') ||
                    (char === '}' && last.char === '{')) {
                    stack.pop();
                }
            }
        }
    }
    return stack;
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (this.isReadOnly) return;

    // Tab indents. Escape then Tab, or Shift+Tab, moves focus on instead, so keyboard users are never trapped.
    if (e.key === "Escape") { this.tabLeavesEditor = true; return; }
    if (e.key === "Tab" && (e.shiftKey || this.tabLeavesEditor)) { this.tabLeavesEditor = false; return; }
    if (!["Shift", "Control", "Alt", "Meta"].includes(e.key)) this.tabLeavesEditor = false;
    
    const textarea = this.editing;
    const val = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (e.key === "Tab") {
        e.preventDefault();
        this.insertTextAtCursor("    ");
    }
    else if (e.key === "Backspace") {
        if (start === end && start > 0) {
            const lineStart = val.lastIndexOf('\n', start - 1) + 1;
            const textBeforeCursor = val.substring(lineStart, start);

            if (/^\s+$/.test(textBeforeCursor) && textBeforeCursor.length >= 4) {
                const fourCharsBefore = val.substring(start - 4, start);
                if (fourCharsBefore === "    ") {
                    e.preventDefault();
                    textarea.selectionStart = start - 4;
                    textarea.selectionEnd = start;
                    this.deleteSelectedText();
                }
            }
        }
    }
    else if (e.key === "Enter") {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
            e.preventDefault();
            document.getElementById('btn-run')?.click();
            return;
        }
        e.preventDefault();
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        const currentLine = val.substring(lineStart, start);
        const trimmed = currentLine.trimEnd();

        let nextIndent = "";
        const bracketStack = this.analyzeLineBrackets(currentLine);
        const lineWithoutComment = currentLine.split('#')[0].trimEnd();

        if (bracketStack.length > 0) {
            const lastOpen = bracketStack[bracketStack.length - 1];
            nextIndent = " ".repeat(lastOpen.index + 1);
        }
        else if (lineWithoutComment.endsWith(":")) {
            const beforeColon = lineWithoutComment.slice(0, -1).trimEnd();
            const lastCharBeforeColon = beforeColon.charAt(beforeColon.length - 1);
            if ([')', ']', '}'].includes(lastCharBeforeColon)) {
                const closeIndex = lineStart + currentLine.lastIndexOf(lastCharBeforeColon);
                const openIndex = this.findMatchingBracket(val, closeIndex);
                if (openIndex !== null) {
                    nextIndent = this.getLineIndent(val, openIndex) + "    ";
                } else {
                    nextIndent = this.getLineIndent(val, start) + "    ";
                }
            } else {
                nextIndent = this.getLineIndent(val, start) + "    ";
            }
        }
        else if ([')', ']', '}'].includes(trimmed.charAt(trimmed.length - 1))) {
            const lastChar = trimmed.charAt(trimmed.length - 1);
            const closeIndex = lineStart + currentLine.lastIndexOf(lastChar);
            const openIndex = this.findMatchingBracket(val, closeIndex);
            if (openIndex !== null) {
                nextIndent = this.getLineIndent(val, openIndex);
            } else {
                nextIndent = this.getLineIndent(val, start);
            }
        }
        else {
            nextIndent = this.getLineIndent(val, start);
        }

        const insertion = "\n" + nextIndent;
        this.insertTextAtCursor(insertion);

        requestAnimationFrame(() => {
            this.syncScroll();
        });
    }
  }

  private handlePaste(e: ClipboardEvent) {
    if (this.isReadOnly) return;

    // Plain text only: it is what a code editor wants, and it keeps indentation exactly as copied.
    // With no plain text on the clipboard, leave the paste to the browser.
    const raw = e.clipboardData?.getData('text/plain');
    if (!raw) return;
    e.preventDefault();

    const text = cleanPaste(raw);
    if (text) this.insertTextAtCursor(text);
  }
}
