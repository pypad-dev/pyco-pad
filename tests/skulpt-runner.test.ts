// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const FIXTURE = `
  <button id="btn-clear"></button><input type="checkbox" id="chk-safe-mode" />
  <div id="output"></div>`;

const $ = (id: string) => document.getElementById(id) as HTMLElement;
// jsdom has no innerText layout, so the runner's innerText assignments are plain properties.
const outputText = () => Array.from($('output').children).map((c) => (c as any).innerText ?? c.textContent).join('');
let failWith: string | null;

async function makeRunner() {
  const { SkulptRunner } = await import('../src/skulpt-runner');
  return new SkulptRunner();
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  document.body.innerHTML = FIXTURE;
  failWith = null;
  (globalThis as any).Sk = {
    configure: ({ output }: any) => { (globalThis as any).__out = output; },
    python3: {},
    importMainWithBody: () => { if (failWith) throw failWith; (globalThis as any).__out('hello\n'); return {}; },
    misceval: { asyncToPromise: (fn: () => unknown) => Promise.resolve().then(fn) },
  };
});
afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as any).Sk;
});

describe('SkulptRunner output', () => {
  it('clears the output at once and leaves it empty briefly before the result appears', async () => {
    const runner = await makeRunner();
    $('output').innerHTML = '<span>old output</span>';
    runner.runCode('print("hello")');
    expect(outputText()).toBe('');
    await vi.advanceTimersByTimeAsync(100);
    expect(outputText()).toBe(''); // still empty part-way through the pause
    await vi.advanceTimersByTimeAsync(100);
    expect(outputText()).toContain('hello');
  });

  it('shows the same pause again when the identical program is rerun', async () => {
    const runner = await makeRunner();
    runner.runCode('print("hello")');
    await vi.advanceTimersByTimeAsync(300);
    expect(outputText()).toContain('hello');
    runner.runCode('print("hello")');
    expect(outputText()).toBe('');
    await vi.advanceTimersByTimeAsync(300);
    expect(outputText()).toContain('hello');
  });

  it('reports how long the run took', async () => {
    const runner = await makeRunner();
    runner.runCode('print("hello")');
    await vi.advanceTimersByTimeAsync(300);
    expect(outputText()).toMatch(/>>> Finished successfully in \d+ ms\./);
  });

  it('shows an error from the program', async () => {
    failWith = 'NameError: x';
    const runner = await makeRunner();
    runner.runCode('x');
    await vi.advanceTimersByTimeAsync(300);
    expect(outputText()).toContain('NameError: x');
  });

  it('says so when the engine has not loaded', async () => {
    delete (globalThis as any).Sk;
    const runner = await makeRunner();
    runner.runCode('print(1)');
    expect(outputText()).toContain('still loading');
  });
});
