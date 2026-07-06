import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Use the library source directly so the demo works in dev without a
      // prebuilt dist/ and reflects source edits immediately.
      'react-halftone': fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
    },
  },
});
