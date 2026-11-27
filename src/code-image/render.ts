import { highlightPython } from '../highlight';
import { imageHeight } from './format';

// Draws code onto a canvas, coloured like the pad, so there is no text on the page to select or copy.
export const FONT = "14px Consolas, Monaco, 'Courier New', monospace";
export const LINE_HEIGHT = 22.4;
export const PADDING = 20;

export const THEME: Record<string, string> = {
  background: '#1e1e1e',
  plain: '#d4d4d4',
  keyword: '#569cd6',
  string: '#ce9178',
  fstring: '#f44747',
  comment: '#6a9955',
  number: '#b5cea8',
  decorator: '#c586c0',
};

export interface Segment {
  text: string;
  color: string;
}

/** The code as lines of coloured pieces, from the pad's own highlighter. */
export function toLines(code: string): Segment[][] {
  const root = new DOMParser().parseFromString('<body>' + highlightPython(code) + '</body>', 'text/html').body;
  const lines: Segment[][] = [[]];
  const walk = (node: Node, color: string) => {
    if (node.nodeType === Node.TEXT_NODE) {
      (node.textContent ?? '').split('\n').forEach((part, i) => {
        if (i > 0) lines.push([]);
        if (part) lines[lines.length - 1].push({ text: part.replace(/\t/g, '    '), color });
      });
    } else if (node instanceof HTMLElement) {
      const token = [...node.classList].find((c) => c.startsWith('token-'));
      const next = node.style.color ? THEME.plain : token ? (THEME[token.slice(6)] ?? color) : color;
      node.childNodes.forEach((child) => walk(child, next));
    }
  };
  root.childNodes.forEach((child) => walk(child, THEME.plain));
  return lines;
}

type Surface = Pick<CanvasRenderingContext2D, 'font' | 'fillStyle' | 'textBaseline' | 'fillRect' | 'fillText' | 'measureText'>;

/** The width the longest line needs, with the padding either side. */
export function measureWidth(ctx: Surface, lines: Segment[][]): number {
  ctx.font = FONT;
  const widest = Math.max(0, ...lines.map((line) => line.reduce((sum, s) => sum + ctx.measureText(s.text).width, 0)));
  return Math.ceil(widest + PADDING * 2);
}

export function draw(ctx: Surface, lines: Segment[][], width: number, height: number) {
  ctx.fillStyle = THEME.background;
  ctx.fillRect(0, 0, width, height);
  ctx.font = FONT;
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => {
    let x = PADDING;
    const y = PADDING + i * LINE_HEIGHT;
    for (const { text, color } of line) {
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      x += ctx.measureText(text).width;
    }
  });
}

/** Sizes the canvas to the code (sharp on high-density screens) and draws it. */
export function paint(canvas: HTMLCanvasElement, lines: Segment[][]) {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const width = measureWidth(ctx, lines);
  const height = imageHeight(lines.length);
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.scale(ratio, ratio);
  draw(ctx, lines, width, height);
}
