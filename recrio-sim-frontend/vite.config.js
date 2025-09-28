// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // REST endpoints
      '/sessions': { target: 'http://localhost:5000', changeOrigin: true },
      '/api':      { target: 'http://localhost:5000', changeOrigin: true },

      // Socket.IO (the WebSocket upgrade path)
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true
      },
    }
  }
})
