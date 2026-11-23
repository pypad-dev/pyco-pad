// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnswerPanel, type AnswerOptions } from '../src/answer-panel';
import { NOTES_MAX_CHARS } from '../src/answer-format';

const FIXTURE = `
  <button id="btn-notes" hidden></button><button id="btn-clear"></button><span id="panel-title">OUTPUT</span>
  <div id="output-wrapper"><div id="output"></div><div id="notes-pane" hidden><textarea id="notes"></textarea><div id="notes-count" hidden></div></div></div>
  <textarea id="editing"></textarea>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(options: AnswerOptions, closed = false) {
  document.body.innerHTML = FIXTURE;
  const code = $<HTMLTextAreaElement>('editing');
  let hidden = closed;
  const editor = {
    isReadOnly: false,
    getValue: () => code.value,
    setValue: (t: string) => { code.value = t; },
    setReadOnly: vi.fn(),
    insertContent: vi.fn(),
    revealOutput: () => { const was = hidden; hidden = false; return was; },
  };
  const runner = {
    savedOutput: () => Array.from($('output').children).filter((e) => !e.classList.contains('output-stale')).map((e) => e.textContent).join('').trim(),
    showSaved: (t: string) => { $('output').innerHTML = ''; if (t) { const s = document.createElement('span'); s.textContent = t; $('output').appendChild(s); } },
  };
  const panel = new AnswerPanel(editor, runner, options);
  const onChange = vi.fn();
  panel.onChange = onChange;
  const run = (printed: string) => { panel.beforeRun(); runner.showSaved(printed); };
  return { panel, editor, runner, code, onChange, run };
}

const BOTH = { notes: true, output: true };

describe('AnswerPanel saving', () => {
  it('saves only the code when both options are off', () => {
    const { panel, code } = setup({ notes: false, output: false });
    code.value = 'print(1)';
    $<HTMLTextAreaElement>('notes').value = 'hidden notes';
    expect(panel.getValue()).toBe('print(1)');
  });

  it('saves the code with the notes and the output after it', () => {
    const { panel, code, run } = setup(BOTH);
    code.value = 'print(1)';
    $<HTMLTextAreaElement>('notes').value = 'my plan';
    run('1');
    expect(panel.getValue()).toBe('print(1)\n\n# --- notes ---\n# my plan\n# --- end notes ---\n# --- output ---\n# 1\n# --- end output ---');
  });

  it('saves only what is switched on', () => {
    const a = setup({ notes: true, output: false });
    a.code.value = 'x';
    $<HTMLTextAreaElement>('notes').value = 'n';
    a.run('out');
    expect(a.panel.getValue()).toBe('x\n\n# --- notes ---\n# n\n# --- end notes ---');
    const b = setup({ notes: false, output: true });
    b.code.value = 'x';
    $<HTMLTextAreaElement>('notes').value = 'n';
    b.run('out');
    expect(b.panel.getValue()).toBe('x\n\n# --- output ---\n# out\n# --- end output ---');
  });

  it('marks the saved output as out of date once the code is edited', () => {
    const { panel, code, run } = setup(BOTH);
    code.value = 'print(1)';
    run('1');
    code.value = 'print(2)';
    expect(panel.getValue()).toContain('# --- output (code changed since it ran) ---');
    run('2');
    expect(panel.getValue()).toContain('# --- output ---');
  });
});

describe('AnswerPanel loading', () => {
  it('splits a saved answer into code, notes and output', () => {
    const { panel, code } = setup(BOTH);
    panel.setValue('print(1)\n\n# --- notes ---\n# my plan\n# --- end notes ---\n# --- output ---\n# 1\n# --- end output ---');
    expect(code.value).toBe('print(1)');
    expect($<HTMLTextAreaElement>('notes').value).toBe('my plan');
    expect($('output').textContent).toBe('1');
  });

  it('shows plain code as it is, and an answer with the options off as it is, markers included', () => {
    const a = setup(BOTH);
    a.panel.setValue('x = 1');
    expect(a.code.value).toBe('x = 1');
    const saved = 'x\n\n# --- notes ---\n# n\n# --- end notes ---';
    const b = setup({ notes: false, output: false });
    b.panel.setValue(saved);
    expect(b.code.value).toBe(saved);
  });

  it('warns when the saved output is out of date, and not when it is current', () => {
    const { panel } = setup(BOTH);
    panel.setValue('x\n\n# --- output (code changed since it ran) ---\n# 1\n# --- end output ---');
    expect($('output').querySelector('.output-stale')).not.toBeNull();
    panel.setValue('x\n\n# --- output ---\n# 1\n# --- end output ---');
    expect($('output').querySelector('.output-stale')).toBeNull();
  });

  it('does not ask for a save just because the answer loaded', async () => {
    const { panel, onChange } = setup(BOTH);
    panel.setValue('x\n\n# --- notes ---\n# n\n# --- end notes ---\n# --- output ---\n# 1\n# --- end output ---');
    await flush();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('AnswerPanel changes', () => {
  it('asks for a save when notes are typed or output appears', async () => {
    const { onChange, run } = setup(BOTH);
    $<HTMLTextAreaElement>('notes').value = 'n';
    $('notes').dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenCalledTimes(1);
    onChange.mockClear();
    run('hi');
    await flush();
    expect(onChange).toHaveBeenCalled();
  });

  it('shows and removes the warning as the code is edited after a run', () => {
    const { code, run } = setup(BOTH);
    code.value = 'a';
    run('out');
    expect($('output').querySelector('.output-stale')).toBeNull();
    code.value = 'ab';
    code.dispatchEvent(new Event('input'));
    expect($('output').querySelector('.output-stale')?.textContent).toBe('Code changed since this ran');
    code.value = 'a';
    code.dispatchEvent(new Event('input'));
    expect($('output').querySelector('.output-stale')).toBeNull();
  });

  it('keeps the warning out of the saved output', () => {
    const { panel, code, run } = setup(BOTH);
    code.value = 'a';
    run('out');
    code.value = 'ab';
    code.dispatchEvent(new Event('input'));
    expect(panel.getValue()).not.toContain('Code changed since this ran');
  });

  it('makes the notes read-only whenever the code is', () => {
    const { panel, editor } = setup(BOTH);
    panel.setReadOnly(true);
    expect($<HTMLTextAreaElement>('notes').readOnly).toBe(true);
    expect(editor.setReadOnly).toHaveBeenCalledWith(true);
    panel.setReadOnly(false);
    expect($<HTMLTextAreaElement>('notes').readOnly).toBe(false);
  });
});

describe('AnswerPanel views', () => {
  it('shows the notes icon only when notes are on', () => {
    setup({ notes: false, output: true });
    expect($('btn-notes').hidden).toBe(true);
    setup(BOTH);
    expect($('btn-notes').hidden).toBe(false);
  });

  it('toggles between notes and output with the one icon, and Run goes back to output', () => {
    const { run } = setup(BOTH);
    $('btn-notes').click();
    expect($('notes-pane').hidden).toBe(false);
    expect($('output').hidden).toBe(true);
    expect($('panel-title').textContent).toBe('NOTES');
    expect($('btn-clear').hidden).toBe(true);
    expect($('btn-notes').getAttribute('aria-pressed')).toBe('true');
    $('btn-notes').click();
    expect($('output').hidden).toBe(false);
    expect($('panel-title').textContent).toBe('OUTPUT');
    $('btn-notes').click();
    run('x');
    expect($('output').hidden).toBe(false);
    expect($('notes-pane').hidden).toBe(true);
    expect($('btn-notes').getAttribute('aria-pressed')).toBe('false');
  });

  it('opens the notes when the panel was closed, even if the notes were the last view shown', () => {
    const { editor } = setup(BOTH, true);
    $('btn-notes').click();
    expect($('notes-pane').hidden).toBe(false);
  });
});

function pasteInto(target: HTMLElement, plain: string) {
  const ev = new Event('paste', { bubbles: true, cancelable: true }) as any;
  ev.clipboardData = { getData: (t: string) => (t === 'text/plain' ? plain : '') };
  target.dispatchEvent(ev);
}

describe('AnswerPanel pasted notes', () => {
  it('removes invisible characters from pasted notes and keeps indentation', () => {
    setup(BOTH);
    const notes = $<HTMLTextAreaElement>('notes');
    pasteInto(notes, '    x\u200b = 1\n    y = 2');
    expect(notes.value).toBe('    x = 1\n    y = 2');
  });

  it('keeps the first line indented in the saved answer', () => {
    const { panel } = setup(BOTH);
    $<HTMLTextAreaElement>('notes').value = '\n\n    indented first line\nsecond';
    expect(panel.getValue()).toContain('# --- notes ---\n#     indented first line\n# second\n# --- end notes ---');
  });

  it('says so when a paste is too long, and adds only what fits', () => {
    setup(BOTH);
    const notes = $<HTMLTextAreaElement>('notes');
    pasteInto(notes, 'a'.repeat(NOTES_MAX_CHARS + 500));
    expect(notes.value).toHaveLength(NOTES_MAX_CHARS);
    expect($('notes-count').hidden).toBe(false);
    expect($('notes-count').textContent).toContain('too long');
    notes.value += '';
    notes.dispatchEvent(new Event('input'));
    expect($('notes-count').textContent).toContain('10,000 / 10,000');
  });

  it('shows a count only when the notes are nearly full', () => {
    setup(BOTH);
    const notes = $<HTMLTextAreaElement>('notes');
    notes.value = 'a'.repeat(100);
    notes.dispatchEvent(new Event('input'));
    expect($('notes-count').hidden).toBe(true);
    notes.value = 'a'.repeat(NOTES_MAX_CHARS * 0.95);
    notes.dispatchEvent(new Event('input'));
    expect($('notes-count').textContent).toBe('9,500 / 10,000 characters');
  });
});
