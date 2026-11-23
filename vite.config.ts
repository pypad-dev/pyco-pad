import { defineConfig } from 'vite';

// Every release is published in a folder of its own (/v1.0.0/, /v1.0/, /latest/...), so the built page refers to its files relative to itself.
export default defineConfig({
  base: './',
});
