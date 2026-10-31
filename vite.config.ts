import { defineConfig } from 'vite';

export default defineConfig({
  base: '/tools/fhir-validator/',
  // The page's security policy blocks every connection, including the dev server's reload socket.
  server: { hmr: false },
  build: {
    target: 'es2022',
    // The polyfill preloads with fetch(), which the same policy forbids.
    modulePreload: { polyfill: false },
    // One bundle on purpose: splitting it would mean network requests after the page has loaded.
    chunkSizeWarningLimit: 1000,
  },
});
