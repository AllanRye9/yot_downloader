import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../frontend_dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/video_info': 'http://localhost:5000',
      '/start_download': 'http://localhost:5000',
      '/status': 'http://localhost:5000',
      '/files': 'http://localhost:5000',
      '/downloads': 'http://localhost:5000',
      '/stream': 'http://localhost:5000',
      '/delete': 'http://localhost:5000',
      '/cancel': 'http://localhost:5000',
      '/cancel_all': 'http://localhost:5000',
      '/stats': 'http://localhost:5000',
      '/active_downloads': 'http://localhost:5000',
      '/start_playlist_download': 'http://localhost:5000',
      '/start_batch_download': 'http://localhost:5000',
      '/download_zip': 'http://localhost:5000',
      '/convert_file': 'http://localhost:5000',
      '/batch_convert': 'http://localhost:5000',
      '/trim': 'http://localhost:5000',
      '/crop': 'http://localhost:5000',
      '/watermark': 'http://localhost:5000',
      '/extract_clip': 'http://localhost:5000',
      '/merge': 'http://localhost:5000',
      '/job_status': 'http://localhost:5000',
      '/reviews': 'http://localhost:5000',
      '/admin': 'http://localhost:5000',
      '/const': 'http://localhost:5000',
      '/health': 'http://localhost:5000',
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
      },
    },
  },
})
