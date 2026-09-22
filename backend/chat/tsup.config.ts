import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/router.ts'],
  format: ['esm'],
  outDir: 'dist',
  target: 'node24',
  splitting: false,
  bundle: true,
  external: ['@prisma/client', '@prisma/adapter-mariadb'],
});
