import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production' || process.env.NODE_ENV === 'production';
  const apiUrl = process.env.VITE_API_BASE_URL || 'https://gitrepoa-1.onrender.com/api/v1';

  return {
    plugins: [react()],
    base: '/',
    define: {
      __API_BASE_URL__: JSON.stringify(apiUrl),
      __APP_NAME__: JSON.stringify('VaultKe'),
      __APP_VERSION__: JSON.stringify('1.0.0'),
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: !isProduction,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
          },
        },
      },
    },
    server: {
      port: 3000,
      open: true,
    },
    preview: {
      port: 3000,
    },
  };
});
