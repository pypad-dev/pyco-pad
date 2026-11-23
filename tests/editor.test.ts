// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const FIXTURE = `
  <div id="main-container"><div id="editor-wrapper"><div id="custom-editor-container">
    <div id="line-numbers"></div>
    <pre id="highlighting"><code id="highlighting-content"></code></pre>
    <textarea id="editing"></textarea>
  </div></div><div id="resizer"></div><div id="output-wrapper"><div id="output"></div></div></div>
  <span id="layout-icon"></span><button id="btn-layout"></button>
  <button id="btn-hide-output"></button><button id="btn-run"></button>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const overlay = () => $('highlighting-content').textContent;
const expectedOverlay = (v: string) => (v.endsWith('\n') ? v + ' ' : v);

function paste(target: HTMLElement, plain: string) {
  const ev = new Event('paste', { bubbles: true, cancelable: true }) as any;
  ev.clipboardData = { getData: (t: string) => (t === 'text/plain' ? plain : '') };
  target.dispatchEvent(ev);
  return ev as Event;
}

async function makeEditor() {
  const { Editor } = await import('../src/editor');
  return new Editor();
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  document.body.innerHTML = FIXTURE;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (document as any).execCommand;
});

describe('Editor paste and highlight', () => {
  it('inserts pasted text with invisible characters removed and keeps the highlight layer identical', async () => {
    const editor = await makeEditor();
    const ta = $<HTMLTextAreaElement>('editing');
    editor.setValue('x = 1\n');
    ta.selectionStart = ta.selectionEnd = ta.value.length;
    paste(ta, 'y\u200b = 2\n');
    expect(ta.value).toBe('x = 1\ny = 2\n');
    expect(overlay()).toBe(expectedOverlay(ta.value));
  });

  it('uses the browser insertion when it works, without inserting twice', async () => {
    const editor = await makeEditor();
    const ta = $<HTMLTextAreaElement>('editing');
    (document as any).execCommand = (_c: string, _u: boolean, text: string) => {
      ta.value += text;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    };
    editor.setValue('a');
    paste(ta, 'b');
    expect(ta.value).toBe('ab');
    expect(overlay()).toBe('ab');
  });

  it('repeated pastes all land and stay visible', async () => {
    const editor = await makeEditor();
    const ta = $<HTMLTextAreaElement>('editing');
    editor.setValue('');
    for (let i = 0; i < 5; i++) paste(ta, 'x\n');
    expect(ta.value).toBe('x\nx\nx\nx\nx\n');
    expect(overlay()).toBe(expectedOverlay(ta.value));
  });

  it('leaves the paste to the browser when there is no plain text', async () => {
    await makeEditor();
    const ev = paste($<HTMLTextAreaElement>('editing'), '');
    expect(ev.defaultPrevented).toBe(false);
  });

  it('ignores pastes when read-only', async () => {
    const editor = await makeEditor();
    const ta = $<HTMLTextAreaElement>('editing');
    editor.setValue('keep');
    editor.setReadOnly(true);
    const ev = paste(ta, 'nope');
    expect(ev.defaultPrevented).toBe(false);
    expect(ta.value).toBe('keep');
  });

  it('shows plain text without colouring for a very large document', async () => {
    const editor = await makeEditor();
    editor.setValue('if x\n'.repeat(60_000));
    expect($('highlighting-content').querySelector('span')).toBeNull();
    expect(overlay()?.length).toBe(300_001);
  });
});

describe('Editor when highlighting fails', () => {
  it('falls back to escaped plain text instead of leaving the layer stale', async () => {
    vi.doMock('../src/highlight', () => ({ highlightPython: () => { throw new Error('boom'); } }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const editor = await makeEditor();
    const ta = $<HTMLTextAreaElement>('editing');
    editor.setValue('a < b');
    expect(overlay()).toBe('a < b');
    paste(ta, 'x');
    expect(overlay()).toBe(ta.value);
    vi.doUnmock('../src/highlight');
  });
});

describe('Editor output panel', () => {
  const container = () => $('main-container');
  const click = (id: string) => $(id).click();

  it('cycles side by side, stacked, hidden with the Layout button', async () => {
    await makeEditor();
    expect(container().classList.contains('vertical-split')).toBe(true);
    click('btn-layout');
    expect(container().classList.contains('horizontal-split')).toBe(true);
    click('btn-layout');
    expect(container().classList.contains('output-hidden')).toBe(true);
    click('btn-layout');
    expect(container().classList.contains('vertical-split')).toBe(true);
  });

  it('reveals the panel for a run, in the last layout, and does nothing when already visible', async () => {
    const editor = await makeEditor();
    editor.revealOutput();
    expect(container().classList.contains('vertical-split')).toBe(true);
    click('btn-layout');
    click('btn-hide-output');
    editor.revealOutput();
    expect(container().classList.contains('horizontal-split')).toBe(true);
    editor.revealOutput();
    expect(container().classList.contains('horizontal-split')).toBe(true);
  });

  it('falls back to the side-by-side layout when it starts hidden', async () => {
    localStorage.setItem('py_ide_layout', '2');
    const editor = await makeEditor();
    expect(container().classList.contains('output-hidden')).toBe(true);
    editor.revealOutput();
    expect(container().classList.contains('vertical-split')).toBe(true);
  });

  it('shows a matching icon for each layout', async () => {
    await makeEditor();
    const icon = () => $('layout-icon').querySelector('svg')!.getAttribute('data-layout');
    expect(icon()).toBe('side-by-side');
    click('btn-layout');
    expect(icon()).toBe('stacked');
    click('btn-layout');
    expect(icon()).toBe('code-only');
    click('btn-layout');
    expect(icon()).toBe('side-by-side');
  });

  it('gives every layout icon the same size', async () => {
    const { LAYOUT_ICONS } = await import('../src/layout-icons');
    const sizes = Object.values(LAYOUT_ICONS).map((svg) => svg.match(/width="([^"]+)" height="([^"]+)" viewBox="([^"]+)"/)!.slice(1).join('|'));
    expect(new Set(sizes).size).toBe(1);
  });
});

describe('Editor keyboard focus', () => {
  const key = (target: HTMLElement, k: string, init: KeyboardEventInit = {}) => {
    const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(ev);
    return ev;
  };

  it('Tab inserts four spaces and does not move focus', async () => {
    const editor = await makeEditor();
    const ta = $<HTMLTextAreaElement>('editing');
    editor.setValue('');
    const ev = key(ta, 'Tab');
    expect(ev.defaultPrevented).toBe(true);
    expect(ta.value).toBe('    ');
  });

  it('Escape then Tab leaves the editor without inserting anything', async () => {
    const editor = await makeEditor();
    const ta = $<HTMLTextAreaElement>('editing');
    editor.setValue('x');
    key(ta, 'Escape');
    const ev = key(ta, 'Tab');
    expect(ev.defaultPrevented).toBe(false);
    expect(ta.value).toBe('x');
  });

  it('only the next Tab after Escape leaves; the one after indents again', async () => {
    const editor = await makeEditor();
    const ta = $<HTMLTextAreaElement>('editing');
    editor.setValue('');
    key(ta, 'Escape');
    key(ta, 'Tab');
    const ev = key(ta, 'Tab');
    expect(ev.defaultPrevented).toBe(true);
    expect(ta.value).toBe('    ');
  });

  it('typing something else after Escape cancels it', async () => {
    const editor = await makeEditor();
    const ta = $<HTMLTextAreaElement>('editing');
    editor.setValue('');
    key(ta, 'Escape');
    key(ta, 'a');
    expect(key(ta, 'Tab').defaultPrevented).toBe(true);
  });

  it('a modifier key between Escape and Tab does not cancel it', async () => {
    const editor = await makeEditor();
    const ta = $<HTMLTextAreaElement>('editing');
    editor.setValue('');
    key(ta, 'Escape');
    key(ta, 'Shift');
    expect(key(ta, 'Tab').defaultPrevented).toBe(false);
  });

  it('losing focus cancels a pending Escape', async () => {
    const editor = await makeEditor();
    const ta = $<HTMLTextAreaElement>('editing');
    editor.setValue('');
    key(ta, 'Escape');
    ta.dispatchEvent(new Event('blur'));
    expect(key(ta, 'Tab').defaultPrevented).toBe(true);
  });

  it('Shift+Tab always moves focus backwards', async () => {
    const editor = await makeEditor();
    const ta = $<HTMLTextAreaElement>('editing');
    editor.setValue('');
    const ev = key(ta, 'Tab', { shiftKey: true });
    expect(ev.defaultPrevented).toBe(false);
    expect(ta.value).toBe('');
  });

  it('Tab is left alone in a read-only editor', async () => {
    const editor = await makeEditor();
    const ta = $<HTMLTextAreaElement>('editing');
    editor.setReadOnly(true);
    expect(key(ta, 'Tab').defaultPrevented).toBe(false);
  });

  it('moving the mouse over the editor does not take focus', async () => {
    await makeEditor();
    const other = document.createElement('input');
    document.body.appendChild(other);
    other.focus();
    $('editor-wrapper').dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(document.activeElement).toBe(other);
  });

  it('clicking the gutter focuses the editor', async () => {
    await makeEditor();
    $('line-numbers').click();
    expect(document.activeElement).toBe($('editing'));
  });
});
