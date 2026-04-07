import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    preprocessorOptions: {
      // You’re using .scss, so set it here
      scss: {
        api: 'modern-compiler', // or 'modern'
      },
      // If you ever use indented .sass files too:
      sass: {
        api: 'modern-compiler', // or 'modern'
      },
    },
  }
});
