import { LAYOUT_ICONS } from './layout-icons';

// The stacked layout shows the output panel only as tall as it needs to be: all of a short output, or the most the
// code can spare for a long one. The rail beside the output holds OUTPUT, Clear and Close one above the other.
export const MIN_OUTPUT_PX = 80;
export const KEEP_CODE_LINES = 3;
// The notes view has no output to measure, so in the stacked layout it takes this share of the area, as far as the code allows.
export const NOTES_SHARE = 0.45;

export interface OutputSizing {
  /** Height the output text needs, padding included. */
  content: number;
  /** Least the panel may be, so the rail's three items always fit. */
  min: number;
  /** Height of the area holding both panels. */
  container: number;
  /** Height that must stay with the code: its lines, padding and the divider. */
  reserved: number;
}

export function outputPanelHeight({ content, min, container, reserved }: OutputSizing): number {
  const most = Math.max(min, container - reserved);
  return Math.min(container, Math.min(most, Math.max(min, content)));
}

type Mode = 0 | 1 | 2; // side by side, stacked, output closed

export class PanelLayout {
  private mode: Mode = 0;
  private lastVisible: Mode = 0;
  private userSized = false;
  private container = document.getElementById('main-container') as HTMLElement;
  private resizer = document.getElementById('resizer') as HTMLElement;
  private editorWrapper = document.getElementById('editor-wrapper') as HTMLElement;
  private outputWrapper = document.getElementById('output-wrapper') as HTMLElement;
  private output = document.getElementById('output');
  private layoutIcon = document.getElementById('layout-icon') as HTMLElement;

  constructor(private editing: HTMLTextAreaElement) {
    try {
      const saved = parseInt(localStorage.getItem('py_ide_layout') || '0', 10);
      if (saved === 0 || saved === 1 || saved === 2) this.mode = saved;
    } catch (e) {
      console.warn('Cannot read layout from localStorage:', e);
    }
    // The layout to return to when the output panel is shown again.
    this.lastVisible = this.mode === 2 ? 0 : this.mode;

    this.apply(this.mode);

    (document.getElementById('btn-layout') as HTMLButtonElement).addEventListener('click', () => this.apply(((this.mode + 1) % 3) as Mode));
    (document.getElementById('btn-hide-output') as HTMLButtonElement).addEventListener('click', () => this.apply(2));
    this.setupDragging();

    // The output changes when code runs or is cleared; the stacked panel follows its size.
    if (this.output) new MutationObserver(() => this.fitOutput()).observe(this.output, { childList: true, characterData: true, subtree: true });
    // Switching between the output and the notes changes what the panel is sized to.
    new MutationObserver(() => this.fitOutput()).observe(this.outputWrapper, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', () => this.fitOutput());
  }

  /** Shows the panel in the layout it was last shown in. Returns true if it had been closed, false if it was already visible. */
  revealOutput(): boolean {
    if (this.mode !== 2) return false;
    this.apply(this.lastVisible);
    return true;
  }

  private apply(mode: Mode) {
    this.mode = mode;
    if (mode !== 2) this.lastVisible = mode;
    this.userSized = false;
    try {
      localStorage.setItem('py_ide_layout', String(mode));
    } catch (e) {
      console.warn('Cannot save layout to localStorage:', e);
    }

    this.container.className = 'container';
    for (const el of [this.editorWrapper, this.outputWrapper]) {
      el.style.flex = '';
      el.style.height = '';
      el.style.width = '';
    }

    if (mode === 0) {
      this.container.classList.add('vertical-split');
      this.layoutIcon.innerHTML = LAYOUT_ICONS.sideBySide;
      this.resizer.style.display = 'block';
    } else if (mode === 1) {
      this.container.classList.add('horizontal-split');
      this.layoutIcon.innerHTML = LAYOUT_ICONS.stacked;
      this.resizer.style.display = 'block';
      // Start with the output closed up, then let it grow to its size: it appears from the bottom.
      this.outputWrapper.style.transition = 'none';
      this.editorWrapper.style.flex = '1 1 0px';
      this.outputWrapper.style.flex = '0 0 0px';
      void this.outputWrapper.offsetHeight;
      this.outputWrapper.style.transition = '';
      this.fitOutput();
    } else {
      this.container.classList.add('output-hidden');
      this.layoutIcon.innerHTML = LAYOUT_ICONS.codeOnly;
    }
  }

  private fitOutput() {
    if (this.mode !== 1 || this.userSized || !this.output) return;
    const containerHeight = this.container.clientHeight;
    if (!containerHeight) return;

    let content: number;
    if (this.outputWrapper.classList.contains('show-notes')) {
      content = containerHeight * NOTES_SHARE;
    } else {
      const outputStyle = getComputedStyle(this.output);
      const range = document.createRange();
      range.selectNodeContents(this.output);
      content = range.getBoundingClientRect().height + parseFloat(outputStyle.paddingTop) + parseFloat(outputStyle.paddingBottom);
    }

    const codeStyle = getComputedStyle(this.editing);
    const lineHeight = parseFloat(codeStyle.lineHeight) || 22;
    const codePadding = parseFloat(codeStyle.paddingTop) + parseFloat(codeStyle.paddingBottom);
    const reserved = KEEP_CODE_LINES * lineHeight + codePadding + this.resizer.offsetHeight;

    const height = outputPanelHeight({ content, min: MIN_OUTPUT_PX, container: containerHeight, reserved });
    this.editorWrapper.style.flex = '1 1 0px';
    this.outputWrapper.style.flex = `0 0 ${Math.round(height)}px`;
  }

  private setupDragging() {
    let isResizing = false;

    this.resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      this.resizer.classList.add('active');
      this.container.classList.add('dragging');
      document.body.style.cursor = this.mode === 0 ? 'col-resize' : 'row-resize';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing || this.mode === 2) return;
      const rect = this.container.getBoundingClientRect();
      const position = this.mode === 0 ? (e.clientX - rect.left) / rect.width : (e.clientY - rect.top) / rect.height;
      const percent = Math.min(90, Math.max(10, position * 100));
      // A size chosen by hand is kept until the layout changes.
      this.userSized = true;
      this.editorWrapper.style.flex = `1 1 ${percent}%`;
      this.outputWrapper.style.flex = `1 1 ${100 - percent}%`;
    });

    document.addEventListener('mouseup', () => {
      if (!isResizing) return;
      isResizing = false;
      this.resizer.classList.remove('active');
      this.container.classList.remove('dragging');
      document.body.style.cursor = 'default';
    });
  }
}
