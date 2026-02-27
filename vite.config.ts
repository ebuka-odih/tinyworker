import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  loadEnv(mode, '.', '');
  return {
    // Use relative asset paths so the app works behind a subpath reverse proxy (e.g. /tinyfinder/)
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Keep HMR toggle for AI Studio-like environments
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:4000',
          changeOrigin: true,
        },
        '/healthz': {
          target: 'http://127.0.0.1:4000',
          changeOrigin: true,
        },
      },
    },
  };
});
