import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: 'npx vite --port 4179 --strictPort',
    port: 4179,
    reuseExistingServer: true,
    timeout: 120000,
  },
  use: { baseURL: 'http://localhost:4179' },
});
