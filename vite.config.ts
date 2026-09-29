import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom/client'], ethereum: ['viem'] } } },
  },
});
