import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Workspace preview build only — the real project is the Python backend at the root.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
});
