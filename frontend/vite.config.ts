import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  root: './',
  build: {
    outDir: 'dist-frontend',
    emptyOutDir: true
  },
  server: {
    port: 5175,
    host: true,
    proxy: {
      '/api/auth': {
        target: 'http://localhost:5004',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:5005',
        changeOrigin: true
      },
      '/trade-api': {
        target: 'http://localhost:5007',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/trade-api/, '/api')
      },
      '/fund-api': {
        target: 'http://localhost:5006',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fund-api/, '')
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
