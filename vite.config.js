import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  plugins: [
    react(),
  ],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://127.0.0.1:3001',
      '/functions': 'http://127.0.0.1:3001'
    }
  }
});
