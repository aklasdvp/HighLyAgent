import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// HighLyAgent Admin — LOCAL ONLY.
// Dev server binds to loopback: this dashboard must never be reachable from the network.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 8090,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
