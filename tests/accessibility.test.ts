// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('accessible names', () => {
  const doc = new DOMParser().parseFromString(read('../index.html'), 'text/html');

  it('the code box has a name and a description that exists', () => {
    const ta = doc.getElementById('editing')!;
    expect(ta.getAttribute('aria-label')).toBeTruthy();
    const described = doc.getElementById(ta.getAttribute('aria-describedby')!);
    expect(described?.textContent).toMatch(/Escape then Tab/);
  });

  it('every iframe the embed scripts create gets a title', () => {
    for (const file of ['pycopad-mdl-quiz.js', 'pycopad.js', 'lms-toggle-plugin.js']) {
      const src = read('../public/' + file);
      const at = src.indexOf("createElement('iframe')");
      expect(at, file).toBeGreaterThan(-1);
      expect(src.slice(at, at + 220), file).toContain("setAttribute('title'");
    }
  });
});
