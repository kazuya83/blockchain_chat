import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(here, 'src') },
  },
  server: {
    port: 3100,
    proxy: {
      // 開発中は同一オリジンで backend を叩く。Cookie のセッションがそのまま乗る。
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4100',
        changeOrigin: true,
      },
    },
  },
});
