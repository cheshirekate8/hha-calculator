import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' keeps every asset URL relative, so the build works from a GitHub Pages
// project path (/hha-calculator/) as well as from a local file server.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
