// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const script = readFileSync('public/moodle-pre-decorator.js', 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));
const CODE = 'x = 1\nprint(x)\n';

function load(extra = '') {
  document.body.innerHTML = `<div class="que"><div class="formulation"><pre>x = 1\nprint(x)</pre><iframe></iframe>${extra}</div></div>`;
  new Function(script)();
  return {
    button: [...document.querySelectorAll('div')].find((d) => d.textContent === 'Use') as HTMLElement,
    frame: document.querySelector('iframe') as HTMLIFrameElement,
  };
}

// What the browser does for a copy command, as far as jsdom allows: when the copy command runs it fires the copy event, and the command
// itself succeeds only if "works" says so (with the text in the focused box, as a real copy would take it)
let onCopyCommand: () => boolean;
let eventText: string[];
let boxText: string[];
beforeEach(() => {
  eventText = [];
  boxText = [];
  Object.defineProperty(HTMLElement.prototype, 'innerText', { get() { return this.textContent; }, configurable: true });
  (document as any).execCommand = vi.fn((command: string) => (command === 'copy' ? onCopyCommand() : false));
  document.getSelection = () => ({ rangeCount: 0, selectAllChildren() {}, removeAllRanges() {}, addRange() {} }) as any;
  // method 1 succeeds when the copy event is fired and our handler takes it
  onCopyCommand = () => {
    const event = new Event('copy', { bubbles: true, cancelable: true }) as any;
    event.clipboardData = { setData: (_type: string, text: string) => eventText.push(text) };
    document.dispatchEvent(event);
    return true;
  };
});
afterEach(() => {
  delete (HTMLElement.prototype as any).innerText;
  delete (document as any).execCommand;
  delete (navigator as any).clipboard;
  vi.restoreAllMocks();
});

const setClipboardApi = (writeText: (text: string) => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

describe('the Use button copies', () => {
  it('through the copy event, so no box is needed and the focus stays where it is', async () => {
    const { button, frame } = load();
    frame.focus();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    button.click();
    await flush();
    expect(eventText).toEqual([CODE]);
    expect(button.textContent).toBe('Copied!');
    expect(focus).not.toHaveBeenCalled();
  });

  it('from a temporary box when the copy event is not handled, and gives the focus back', async () => {
    onCopyCommand = () => {
      const box = document.activeElement as HTMLTextAreaElement;
      if (box && box.tagName === 'TEXTAREA') {
        boxText.push(box.value.slice(box.selectionStart, box.selectionEnd));
        return true;
      }
      return false; // the first try: no copy event, nothing focused
    };
    const { button, frame } = load();
    const focus = vi.spyOn(frame, 'focus');
    frame.focus();
    focus.mockClear();
    button.click();
    await flush();
    expect(boxText).toEqual([CODE]);
    expect(button.textContent).toBe('Copied!');
    expect(focus).toHaveBeenCalled();
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
  });

  it('through the clipboard call when neither copy command works', async () => {
    onCopyCommand = () => false;
    const writeText = vi.fn(() => Promise.resolve());
    setClipboardApi(writeText);
    const { button } = load();
    button.click();
    await flush();
    expect(writeText).toHaveBeenCalledWith(CODE);
    expect(button.textContent).toBe('Copied!');
  });

  it('and says "Not copied" when nothing worked, not "Copied!"', async () => {
    onCopyCommand = () => false;
    setClipboardApi(() => Promise.reject(new Error('Document is not focused')));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { button } = load();
    button.click();
    await flush();
    expect(button.textContent).toBe('Not copied');
  });

  it('on a page with no clipboard call at all (not https)', async () => {
    onCopyCommand = () => false;
    const { button } = load();
    button.click();
    await flush();
    expect(button.textContent).toBe('Not copied');
  });
});

describe('the Use button inserts', () => {
  it('into the pad that has the cursor, as well as copying', async () => {
    const { button, frame } = load();
    frame.focus();
    const send = vi.fn();
    Object.defineProperty(frame, 'contentWindow', { value: { postMessage: send }, configurable: true });
    button.click();
    await flush();
    expect(send).toHaveBeenCalledWith({ type: 'INSERT_CONTENT', payload: { content: CODE } }, '*');
    expect(eventText).toEqual([CODE]);
  });
});

describe('switching the buttons off', () => {
  it('leaves a question alone when its script says data-use-buttons="false"', () => {
    const { button } = load('<div class="python-ide-embed" data-use-buttons="false"></div>');
    expect(button).toBeUndefined();
  });
});

describe('locking the question text', () => {
  const block = (flag: string) =>
    `<div class="que"><div class="qtext"><p>Some text</p><pre>x = 1</pre></div>${flag}<iframe></iframe><textarea id="answer"></textarea></div>`;
  const run = (html: string) => {
    document.body.innerHTML = html;
    new Function(script)();
  };
  const fire = (target: Element, type: string) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };

  it('stops selecting, copying and the right-click menu in the question text when the flag is set', () => {
    run(block('<div class="python-ide-embed" data-lock-text="true"></div>'));
    const text = document.querySelector('.qtext') as HTMLElement;
    expect(text.style.userSelect).toBe('none');
    for (const type of ['copy', 'cut', 'contextmenu', 'dragstart', 'selectstart']) expect(fire(text.querySelector('p')!, type)).toBe(true);
  });

  it('leaves the answer box and the pad alone', () => {
    run(block('<div class="python-ide-embed" data-lock-text="true"></div>'));
    expect(fire(document.getElementById('answer')!, 'copy')).toBe(false);
    expect(fire(document.querySelector('iframe')!, 'contextmenu')).toBe(false);
  });

  it('does nothing without the flag', () => {
    run(block('<div class="python-ide-embed"></div>'));
    expect((document.querySelector('.qtext') as HTMLElement).style.userSelect).toBe('');
    expect(fire(document.querySelector('.qtext p')!, 'copy')).toBe(false);
  });

  it('works with the Use buttons off, and the other way round', () => {
    run(block('<div class="python-ide-embed" data-lock-text="true" data-use-buttons="false"></div>'));
    expect(document.querySelectorAll('.moodle-pre-wrapper')).toHaveLength(0);
    expect((document.querySelector('.qtext') as HTMLElement).style.userSelect).toBe('none');
  });

  it('does not stop the Use button copying the block', async () => {
    run(block('<div class="python-ide-embed" data-lock-text="true"></div>'));
    const button = [...document.querySelectorAll('div')].find((d) => d.textContent === 'Use') as HTMLElement;
    button.click();
    await flush();
    expect(eventText).toEqual(['x = 1\n']);
    expect(button.textContent).toBe('Copied!');
  });
});
