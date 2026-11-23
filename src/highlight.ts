const KEYWORDS =
  'def|class|import|from|return|if|else|elif|while|for|in|print|try|except|raise|' +
  'True|False|None|as|with|finally|yield|lambda|pass|break|continue|and|or|not|is|self|' +
  'async|await|global|nonlocal|del|assert';

// Triple-quoted strings run to the closing quotes or the end of the text; single-quoted
// strings stop at the end of the line so an unclosed quote cannot colour the rest of the file.
const quoted = (q: string) =>
  `${q}${q}${q}[\\s\\S]*?(?:${q}${q}${q}|$)|${q}(?:[^${q}\\\\\\n]|\\\\[\\s\\S])*(?:${q}|(?=\\n|$))`;

const TOKEN = new RegExp(
  [
    '(#[^\\n]*)',
    `((?:\\b[rRbBuUfF]{1,2})?(?:${quoted('"')}|${quoted("'")}))`,
    `\\b(${KEYWORDS})\\b`,
    '(\\b(?:0[xX][\\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\\d[\\d_]*(?:\\.[\\d_]*)?(?:[eE][+-]?\\d+)?[jJ]?))',
    '(@\\w+)',
  ].join('|'),
  'g'
);

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const span = (cls: string, s: string) => `<span class="token-${cls}">${escapeHtml(s)}</span>`;

// Splits an f-string into literal text and {expressions}; "{{" and "}}" stay literal.
function fstring(s: string): string {
  let out = '';
  let lit = '';
  const flush = () => {
    if (lit) out += span('fstring', lit);
    lit = '';
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ((c === '{' || c === '}') && s[i + 1] === c) {
      lit += c + c;
      i++;
    } else if (c === '{') {
      let depth = 1;
      let j = i + 1;
      for (; j < s.length && depth > 0; j++) {
        if (s[j] === '{') depth++;
        else if (s[j] === '}') depth--;
      }
      if (depth > 0) {
        lit += s.slice(i);
        break;
      }
      flush();
      out += `<span style="color: #d4d4d4;">{${highlightPython(s.slice(i + 1, j - 1))}}</span>`;
      i = j - 1;
    } else {
      lit += c;
    }
  }
  flush();
  return out;
}

export function highlightPython(code: string): string {
  let out = '';
  let last = 0;
  for (const m of code.matchAll(TOKEN)) {
    out += escapeHtml(code.slice(last, m.index));
    last = m.index + m[0].length;
    const [text, comment, string, keyword, number, decorator] = m;
    if (comment) out += span('comment', text);
    else if (string) out += /^[rRbBuU]*[fF]/.test(string) ? fstring(string) : span('string', text);
    else if (keyword) out += span('keyword', text);
    else if (number) out += span('number', text);
    else if (decorator) out += span('decorator', text);
  }
  return out + escapeHtml(code.slice(last));
}
