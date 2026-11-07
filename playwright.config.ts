import { defineConfig, devices } from '@playwright/test'
import { loadE2EEnv } from './e2e/env'

loadE2EEnv()

/**
 * End-to-end tests against a local API (http://localhost:4000) and the
 * production-style build of this app served on :3301 (same CSP meta tag
 * and headers as a real deploy). Set E2E_BASE_URL=http://localhost:3300 to
 * run against `pnpm dev` instead.
 *
 * Credentials come from e2e/.env (gitignored, see e2e/.env.example).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3301'
const useBuild = baseURL.endsWith(':3301')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // one staff session, single-use TOTP steps
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    timezoneId: 'Africa/Lagos',
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'admin',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json', ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
  webServer: useBuild
    ? { command: 'pnpm build:local && node scripts/serve-static.mjs', url: 'http://localhost:3301', reuseExistingServer: !process.env.CI, timeout: 180_000 }
    : undefined,
})
