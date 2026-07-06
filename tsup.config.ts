import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'core/index': 'src/core/index.ts',
    'node/index': 'src/node/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // React is a peer; sharp is an optional peer only used by the node entry.
  external: ['react', 'react-dom', 'sharp'],
});
