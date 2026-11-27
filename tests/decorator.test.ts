// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const script = readFileSync('public/moodle-pre-decorator.js', 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));

function load() {
  document.body.innerHTML = '<div class="que"><div class="formulation"><pre>x = 1\nprint(x)</pre><iframe></iframe></div></div>';
  new Function(script)();
  return {
    button: [...document.querySelectorAll('div')].find((d) => d.textContent === 'Use') as HTMLElement,
    frame: document.querySelector('iframe') as HTMLIFrameElement,
  };
}

let copied: string[];
beforeEach(() => {
  copied = [];
  // jsdom has no innerText, which the script reads
  Object.defineProperty(HTMLElement.prototype, 'innerText', { get() { return this.textContent; }, configurable: true });
  // jsdom has no copy command: record what is selected in the temporary box when it is asked to copy
  (document as any).execCommand = vi.fn((command: string) => {
    if (command !== 'copy') return false;
    const box = document.activeElement as HTMLTextAreaElement;
    copied.push(box.value.slice(box.selectionStart, box.selectionEnd));
    return true;
  });
});
afterEach(() => {
  delete (HTMLElement.prototype as any).innerText;
  delete (document as any).execCommand;
  delete (navigator as any).clipboard;
  vi.restoreAllMocks();
});

describe('the Use button', () => {
  it('puts the code on the clipboard even when the page is not focused, and says so', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('Document is not focused')));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { button } = load();
    button.click();
    await flush();
    expect(copied).toEqual(['x = 1\nprint(x)\n']);
    expect(writeText).not.toHaveBeenCalled();
    expect(button.textContent).toBe('Copied!');
  });

  it('falls back to the clipboard call when the copy command is refused', async () => {
    (document as any).execCommand = () => false;
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { button } = load();
    button.click();
    await flush();
    expect(writeText).toHaveBeenCalledWith('x = 1\nprint(x)\n');
    expect(button.textContent).toBe('Copied!');
  });

  it('does not say "Copied!" when nothing could be copied', async () => {
    (document as any).execCommand = () => false;
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('no')) }, configurable: true });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { button } = load();
    button.click();
    await flush();
    expect(button.textContent).toBe('Not copied');
  });

  it('sends the code to the pad that has the cursor, and gives the focus back to it', async () => {
    const { button, frame } = load();
    frame.focus();
    const send = vi.fn();
    Object.defineProperty(frame, 'contentWindow', { value: { postMessage: send }, configurable: true });
    const focus = vi.spyOn(frame, 'focus');
    button.click();
    await flush();
    expect(send).toHaveBeenCalledWith({ type: 'INSERT_CONTENT', payload: { content: 'x = 1\nprint(x)\n' } }, '*');
    expect(focus).toHaveBeenCalled();
    expect(document.querySelectorAll('textarea')).toHaveLength(0); // the temporary box is gone
  });
});
