import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // The same build works at the site root and under a GitHub Pages project path.
  base: './',
  build: {
    rolldownOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        live: fileURLToPath(new URL('./live.html', import.meta.url))
      }
    }
  }
});
