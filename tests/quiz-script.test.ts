// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

const source = readFileSync('public/pycopad-mdl-quiz.js', 'utf8');

// Runs the script as the browser does for a <script src=".../v1.1.0/pycopad-mdl-quiz.js"> in a question: the folder of its own address is the version it loads from
function run(attributes = '') {
  document.head.innerHTML = '';
  document.body.innerHTML = '<div class="que"><div class="formulation"><pre>x = 1</pre><div class="answer"><textarea name="q1:1_answer"></textarea></div></div></div>';
  const tag = document.createElement('script');
  tag.src = 'https://pad.example/v1.1.0/pycopad-mdl-quiz.js';
  tag.setAttribute('data-create-pad', '');
  for (const [name, value] of Object.entries(Object.fromEntries(attributes.split(' ').filter(Boolean).map((a) => a.split('='))))) tag.setAttribute(name, value);
  document.querySelector('.formulation')!.appendChild(tag);
  Object.defineProperty(document, 'currentScript', { value: tag, configurable: true });
  new Function(source)();
}

const loaded = () => [...document.head.querySelectorAll('script')].map((s) => s.getAttribute('src'));

beforeEach(() => {
  delete (window as any).__pycopadButtonsLoading;
  delete (window as any).__pythonIdeHeightListenerAttached;
  delete (window as any).LMS_WIDGET_MANAGER_URL;
  delete (window as any).LMSWidgetManager;
});

describe('the quiz script', () => {
  it('loads the Use buttons script from its own folder, so the same version', () => {
    run();
    expect(loaded()).toContain('https://pad.example/v1.1.0/moodle-pre-decorator.js');
    expect(loaded()).toContain('https://pad.example/v1.1.0/lms-widget-manager.iife.js');
  });

  it('loads it once, however many questions are on the page', () => {
    run();
    run();
    // (each run clears the head, so look at the flag the second run honoured)
    expect((window as any).__pycopadButtonsLoading).toBe(true);
  });
});
