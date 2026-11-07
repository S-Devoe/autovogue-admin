import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts so unit tests don't load the Start plugin.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'], setupFiles: ['src/test/setup.ts'] },
})
