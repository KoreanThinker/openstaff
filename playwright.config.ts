import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  retries: 1,
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'on-first-retry'
  }
})
