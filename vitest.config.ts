import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/**/*.ts',
        'src/slabFEMEngine/**/*.ts',
        'src/rebar/**/*.ts',
        'src/structural/**/*.ts',
      ],
      exclude: [
        'src/lib/printPlugin.ts',
        'src/lib/capacitorDownload.ts',
        'src/lib/indexedDbStore.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
});
