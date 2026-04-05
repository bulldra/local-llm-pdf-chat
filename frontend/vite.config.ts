import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/pdf-render': {
        target: 'http://localhost:5174',
        rewrite: (path) => path.replace(/^\/pdf-render/, ''),
        changeOrigin: true,
      },
    },
  },
})
