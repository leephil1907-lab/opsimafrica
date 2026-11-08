import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    watch: { ignored: ['**/.cache/**', '**/data/**', '**/backups/**', '**/artifacts/**'] },
  },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: {
          three: [
            'three',
            'three/addons/controls/OrbitControls.js',
            'three/addons/webxr/XRHandModelFactory.js',
          ],
        },
      },
    },
  },
});
