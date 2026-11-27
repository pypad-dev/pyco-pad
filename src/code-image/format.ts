// What a code image's address carries: the code as URL-safe base64 (UTF-8, no padding), then an optional description for
// screen readers:  code-image#<base64>&alt=<percent-encoded text>.  The part after # never reaches a server.

const PAYLOAD = /^([A-Za-z0-9_-]+)(?:&alt=([^&]*))?$/;

/** The height of an image of this many lines, in whole pixels. Whole-number arithmetic, so the Python helper gets exactly the same. */
export function imageHeight(lines: number): number {
  return Math.floor((lines * 224 + 400 + 9) / 10); // lines of 22.4px, with 20px above and below, rounded up
}

/**
 * The folder a page is served from, without its file name, query or #. The site only answers https and a secure page blocks the
 * rest, so an http address is made https (a local test site keeps http).
 */
export function siteFolder(href: string): string {
  return href
    .replace(/[?#].*$/, '')
    .replace(/\/[^/]*$/, '')
    .replace(/^http:\/\/(?!(?:localhost|127\.0\.0\.1)[:/])/i, 'https://');
}

export function encode(code: string): string {
  let binary = '';
  new TextEncoder().encode(code).forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decode(data: string): string | null {
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

export type Payload = { ok: true; code: string; alt: string } | { ok: false };

/**
 * null when the address carries no image (nothing after #, or the pad's own #c= and #b= forms): the page then opens the
 * pad with the helper loaded. Otherwise the code and description, or { ok: false } if they cannot be read.
 */
export function readHash(hash: string): Payload | null {
  const text = hash.replace(/^#/, '');
  if (!text || /^[a-z]=/.test(text)) return null;
  const match = PAYLOAD.exec(text);
  const code = match ? decode(match[1]) : null;
  if (!match || code === null) return { ok: false };
  let alt = '';
  try {
    alt = decodeURIComponent(match[2] ?? '');
  } catch {
    return { ok: false };
  }
  return { ok: true, code: code.replace(/^\n+|\n+$/g, ''), alt };
}
