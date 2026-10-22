import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, `npm run dev` serves the React app on its own port (5173) and
// proxies /api calls to the Express backend on :3000, so you don't need
// to deal with CORS while developing.
//
// In production, `npm run build` outputs static files to dist/ which the
// Express server serves directly (see backend/server.js) — at that point
// frontend and backend share one origin and the proxy isn't involved.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
