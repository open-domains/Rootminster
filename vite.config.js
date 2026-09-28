import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  build: {
    // Emit hidden source maps only for the CI sourcemap-upload job. Ordinary
    // production builds should not leave source files in dist.
    sourcemap: process.env.UPLOAD_SOURCEMAPS === 'true' ? 'hidden' : false,
  },
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
