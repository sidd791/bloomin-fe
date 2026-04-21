import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path"
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://187.77.135.46:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/tiktok-scraper': {
        target: 'http://72.61.162.137:8502',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tiktok-scraper/, ''),
        ws: true,
      },
      '/reddit-scraper': {
        target: 'http://187.127.96.93',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/reddit-scraper/, ''),
        ws: true,
      },
      '/landing-page': {
        target: 'http://187.124.217.143',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/landing-page/, ''),
        ws: true,
      },
    },
  },
})
