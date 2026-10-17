import { defineConfig } from 'vite';

// Set VITE_BASE_PATH=/ for an account site or custom domain.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/mariokart-browser-game/',
  build: {
    rollupOptions: {
      output: { manualChunks: (id) => id.includes('node_modules/three/') ? 'three' : undefined },
    },
    chunkSizeWarningLimit: 650,
  },
});
