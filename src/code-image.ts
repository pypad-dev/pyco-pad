import { encode, readHash, siteFolder } from './code-image/format';
import { paint, toLines } from './code-image/render';
import { starterCode } from './code-image/starter';

// code-image#<code> is just the image, to embed in an iframe. Without it, this opens the pad with the helper loaded.
const payload = readHash(location.hash);

if (payload === null) {
  location.replace('./#b=' + encode(starterCode(siteFolder(location.href))));
} else if (!payload.ok) {
  const message = document.getElementById('message') as HTMLElement;
  message.textContent = 'This code image cannot be read.';
  message.hidden = false;
} else {
  const canvas = document.getElementById('image') as HTMLCanvasElement;
  paint(canvas, toLines(payload.code));
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', payload.alt || 'Code, shown as an image');
  canvas.hidden = false;
}

window.addEventListener('hashchange', () => location.reload());
