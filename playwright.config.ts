import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    port: 4173,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
})
