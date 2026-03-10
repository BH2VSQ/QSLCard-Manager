import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 7054,
    host: '0.0.0.0', // 监听所有网络接口，包括 IPv4
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:7055',
        changeOrigin: true,
      },
      '/temp': {
        target: 'http://localhost:7055',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
