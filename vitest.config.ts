import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/interfaces.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/types': resolve(__dirname, './src/types'),
      '@/analytics': resolve(__dirname, './src/analytics'),
      '@/engagement': resolve(__dirname, './src/engagement'),
      '@/compliance': resolve(__dirname, './src/compliance'),
      '@/api': resolve(__dirname, './src/api'),
    },
  },
});