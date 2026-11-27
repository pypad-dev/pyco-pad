import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

// The builder is a single HTML file; its pure functions sit between BEGIN-PURE / END-PURE markers.
const html = readFileSync(new URL('../public/moodle-xml-builder.html', import.meta.url), 'utf8');
const block = html.slice(html.indexOf('// BEGIN-PURE'), html.indexOf('// END-PURE'));
const lib = new Function(
  `${block}; return { xmlEscape, cdata, mdToHtml, pycopadSnippet, validate, tagList, buildXml, padBase, splitPadSrc, versionChoices };`
)() as any;

const settings = { category: 'Week 1', tags: 'python', origin: 'https://pad.example/', strategy: 'default', format: 'monospaced' };
const q = (o: object = {}) => ({
  id: 'Q1', marks: 2, content: 'Print *hello*', model: '', feedback: '', starter: '', tags: '',
  wmin: '', wmax: '', attach: 0, required: true, mode: 'pycopad', lines: 10, ...o,
});

describe('escaping', () => {
  it('escapes XML special characters', () => {
    expect(lib.xmlEscape('a<b>&"c')).toBe('a&lt;b&gt;&amp;&quot;c');
  });
  it('splits ]]> inside CDATA', () => {
    expect(lib.cdata('a]]>b')).toBe('<![CDATA[a]]]]><![CDATA[>b]]>');
  });
});

describe('mdToHtml', () => {
  it('renders fenced code as a pre block with an inline font style', () => {
    const out = lib.mdToHtml('```\nx = 1 < 2\n```');
    expect(out).toContain('<pre style="');
    expect(out).toContain('x = 1 &lt; 2');
    expect(out).not.toContain('<style');
  });
  it('renders inline code with a font style, not a style element', () => {
    const out = lib.mdToHtml('use `len(x)` here');
    expect(out).toMatch(/<code style="font-family:[^"]*monospace[^"]*">len\(x\)<\/code>/);
  });
  it('passes Moodle MathJax delimiters through untouched', () => {
    const out = lib.mdToHtml('Solve \\(x^2 < 3\\) and *this*');
    expect(out).toContain('\\(x^2 &lt; 3\\)');
    expect(out).toContain('<em>this</em>');
  });
  it('does not apply Markdown inside math', () => {
    expect(lib.mdToHtml('$$a * b * c$$')).not.toContain('<em>');
  });
});

describe('validate', () => {
  it('accepts a good question', () => {
    expect(lib.validate([q()])).toEqual([]);
  });
  it('flags duplicate, missing id and empty content', () => {
    const p = lib.validate([q(), q(), q({ id: ' ', content: '' })]);
    expect(p.join('\n')).toMatch(/used twice/);
    expect(p.join('\n')).toMatch(/ID is required/);
    expect(p.join('\n')).toMatch(/content is empty/);
  });
  it('flags min words above max words', () => {
    expect(lib.validate([q({ wmin: 10, wmax: 5 })]).join()).toMatch(/minimum words/);
  });
});

describe('tagList', () => {
  it('merges file and question tags without case-insensitive repeats', () => {
    expect(lib.tagList(q({ tags: 'Python, loops\nloops' }), settings)).toEqual(['python', 'loops']);
  });
});

describe('buildXml', () => {
  const xml = lib.buildXml([q({ starter: 'x = 1\n', model: 'print(1)', tags: 'loops', wmin: 5, attach: 2 })], settings);

  it('is well-formed with a category and an essay question', () => {
    expect(xml).toContain('<text>$course$/Week 1</text>');
    expect(xml).toContain('<question type="essay">');
    expect(xml.trim().endsWith('</quiz>')).toBe(true);
  });
  it('writes id, marks, answer size and format', () => {
    expect(xml).toContain('<idnumber>Q1</idnumber>');
    expect(xml).toContain('<defaultgrade>2.0000000</defaultgrade>');
    expect(xml).toContain('<responsefieldlines>10</responsefieldlines>');
    expect(xml).toContain('<responseformat>monospaced</responseformat>');
  });
  it('adds the pad script only in codepad mode, with the trailing slash trimmed', () => {
    expect(xml).toContain('src="https://pad.example/pycopad-mdl-quiz.js" data-create-pad');
    expect(lib.buildXml([q({ mode: 'text' })], settings)).not.toContain('data-create-pad');
  });
  it('writes starter code, tags, word limits and attachments', () => {
    expect(xml).toContain('<responsetemplate format="plain_text"><text><![CDATA[x = 1\n]]>');
    expect(xml).toContain('<tag><text>python</text></tag><tag><text>loops</text></tag>');
    expect(xml).toContain('<minwordlimit>5</minwordlimit>');
    expect(xml).toContain('<maxwordlimit></maxwordlimit>');
    expect(xml).toContain('<attachments>2</attachments>');
  });
  it('omits the category block when none is set', () => {
    expect(lib.buildXml([q()], { ...settings, category: ' ' })).not.toContain('type="category"');
  });
  it('parses as XML with CDATA content intact', () => {
    const xml = lib.buildXml([q({ content: 'a ]]> b <c>' })], settings);
    const doc = new (new JSDOM('').window.DOMParser)().parseFromString(xml, 'text/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelectorAll('question[type="essay"]')).toHaveLength(1);
    expect(doc.querySelector('questiontext > text')!.textContent).toContain('a ]]&gt; b &lt;c&gt;');
  });
});

describe('pad options', () => {
  it('leaves the script tag plain when no option is on', () => {
    const xml = lib.buildXml([q()], settings);
    expect(xml).not.toContain('data-notes');
    expect(xml).not.toContain('data-save-output');
  });

  it('writes the notes and saved-output options onto the script tag', () => {
    expect(lib.buildXml([q({ notes: true })], settings)).toContain('data-notes="true"');
    const xml = lib.buildXml([q({ saveOutput: true })], settings);
    expect(xml).toContain('data-save-output="true"');
    expect(xml).not.toContain('data-notes');
  });

  it('gives the shared sample snippet no options', () => {
    expect(lib.pycopadSnippet(settings)).not.toContain('data-notes');
  });
});

describe('versions', () => {
  it('loads the quiz script from the chosen release folder', () => {
    expect(lib.pycopadSnippet({ ...settings, version: 'v1.0' })).toContain('src="https://pad.example/v1.0/pycopad-mdl-quiz.js"');
    expect(lib.pycopadSnippet({ ...settings, version: '/v1.0.0/' })).toContain('src="https://pad.example/v1.0.0/pycopad-mdl-quiz.js"');
    expect(lib.buildXml([q()], { ...settings, version: 'latest' })).toContain('src="https://pad.example/latest/pycopad-mdl-quiz.js"');
  });
  it('no version is the original site at the root (questions from before versions)', () => {
    expect(lib.padBase({ origin: 'https://pad.example/', version: '' })).toBe('https://pad.example');
    expect(lib.padBase({ origin: 'https://pad.example/' })).toBe('https://pad.example');
  });
  it('reads the site and the release folder back from a script address', () => {
    expect(lib.splitPadSrc('https://pad.example/v1.0/pycopad-mdl-quiz.js')).toEqual({ origin: 'https://pad.example', version: 'v1.0' });
    expect(lib.splitPadSrc('https://pad.example/v1.2.3-rc.4/pycopad-mdl-quiz.js')).toEqual({ origin: 'https://pad.example', version: 'v1.2.3-rc.4' });
    expect(lib.splitPadSrc('https://pad.example/latest/pycopad-mdl-quiz.js')).toEqual({ origin: 'https://pad.example', version: 'latest' });
    expect(lib.splitPadSrc('https://pad.example/pycopad-mdl-quiz.js')).toEqual({ origin: 'https://pad.example', version: '' });
    expect(lib.splitPadSrc('https://host.example/pads/v1/pycopad-mdl-quiz.js')).toEqual({ origin: 'https://host.example/pads', version: 'v1' });
    expect(lib.splitPadSrc('not a url')).toEqual({ origin: '', version: '' });
  });
  it('offers each minor (newest first, recommended), latest, then every exact version', () => {
    const v = lib.versionChoices({ releases: ['v1.1.0-rc.1', 'v1.0.2', 'v1.0.1', 'v0.9.0'] });
    expect(v.recommended).toBe('v1.0');
    expect(v.choices).toEqual(['v1.0', 'v0.9', 'latest', 'v1.1.0-rc.1', 'v1.0.2', 'v1.0.1', 'v0.9.0']);
  });
  it('with no list of releases (none yet, or the site cannot be reached), the site root', () => {
    expect(lib.versionChoices(null)).toEqual({ recommended: '', choices: [] });
  });
});

describe('code images in the question text', () => {
  const frame = '<iframe src="https://pad.example/v1.1/code-image#Zm9yIHg&alt=A%20loop" title="Code (image)" width="100%" height="152" style="border:0"></iframe>';

  it('lets a code image through as an iframe, not as text', () => {
    const html = lib.mdToHtml('What does this print?\n\n' + frame + '\n\nThen explain.');
    expect(html).toContain('<iframe src="https://pad.example/v1.1/code-image#Zm9yIHg&amp;alt=A%20loop" title="Code (image)" width="100%" height="152" style="border:0"></iframe>');
    expect(html).not.toContain('&lt;iframe');
    expect(html).toContain('<p>What does this print?</p>');
    expect(html).toContain('<p>Then explain.</p>');
  });

  it('rebuilds the tag, so extra attributes are dropped', () => {
    const html = lib.mdToHtml('<iframe src="https://pad.example/code-image#abc" onload="alert(1)" height="90" srcdoc="x"></iframe>');
    expect(html).toBe('<iframe src="https://pad.example/code-image#abc" title="Code (image)" width="100%" height="90" style="border:0"></iframe>');
  });

  it('still escapes any other iframe or HTML', () => {
    for (const raw of [
      '<iframe src="https://evil.example/page"></iframe>',
      '<iframe src="https://pad.example/code-image?x=1"></iframe>',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<script>alert(1)</script>',
      'text <iframe src="https://pad.example/code-image#abc"></iframe> inside a sentence',
    ]) {
      const html = lib.mdToHtml(raw);
      expect(html).not.toMatch(/<iframe|<script/);
    }
  });

  it('is written into the exported question text', () => {
    expect(lib.buildXml([q({ content: frame })], settings)).toContain('<iframe src="https://pad.example/v1.1/code-image#Zm9yIHg&amp;alt=A%20loop"');
  });
});

describe('Use buttons option', () => {
  it('adds nothing when it is off', () => {
    expect(lib.buildXml([q()], settings)).not.toContain('moodle-pre-decorator');
  });

  it('adds the decorator script after the pad script, from the same folder', () => {
    const xml = lib.buildXml([q({ useButtons: true })], { ...settings, version: 'v1.1' });
    const pad = xml.indexOf('v1.1/pycopad-mdl-quiz.js');
    const decorator = xml.indexOf('<script src="https://pad.example/v1.1/moodle-pre-decorator.js"></script>');
    expect(pad).toBeGreaterThan(-1);
    expect(decorator).toBeGreaterThan(pad);
  });

  it('works without the pad too, since the button also copies', () => {
    const xml = lib.buildXml([q({ mode: 'text', useButtons: true })], settings);
    expect(xml).toContain('moodle-pre-decorator.js');
    expect(xml).not.toContain('pycopad-mdl-quiz.js');
  });
});
