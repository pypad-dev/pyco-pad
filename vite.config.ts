import { defineConfig } from 'vite';

// Every release is published in a folder of its own (/v1.0.0/, /v1.0/, /latest/...), so the built page refers to its files relative to itself.
export default defineConfig({
  base: './',
  // Two pages: the pad (index.html) and the code-image page, which is the pad's helper or, with an address, just the image
  build: { rollupOptions: { input: { main: 'index.html', codeImage: 'code-image.html' } } },
});
