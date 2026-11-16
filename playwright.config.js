import { defineConfig } from '@playwright/test';
const port = process.env.JAYDAAD_TEST_PORT || '4174';
export default defineConfig({ testDir: './test/e2e', fullyParallel: false, workers: 1,
  outputDir: process.env.JAYDAAD_TEST_OUTPUT || 'test-results',
  timeout: 45000, expect: { timeout: 10000 }, reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
  webServer: { command: 'node scripts/serve.js', url: `http://127.0.0.1:${port}`, reuseExistingServer: false,
    timeout: 60000, env: { PORT: port } } });
