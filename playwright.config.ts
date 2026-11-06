import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// Use a pre-installed Chromium when the standard Playwright cache is missing
// (e.g. in locked-down CI containers). On a normal machine run
// `npx playwright install chromium` once and this falls through to the default.
const candidate = process.env.PW_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const executablePath = existsSync(candidate) && !existsSync(`${candidate}/`) ? candidate : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  // Without PW_WEBKIT the default run covers every spec on Chromium only; the webkit project (when enabled) runs only the smoke spec.
  testIgnore: process.env.PW_WEBKIT ? undefined : /smoke-webkit\.spec\.ts/,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, launchOptions: executablePath ? { executablePath, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] } } }, // --no-sandbox is Chromium-only; WebKit rejects it
    // Optional WebKit smoke project. It is OFF unless PW_WEBKIT=1, because WebKit is not part of the default install.
    // To try it: `npx playwright install webkit` then `npm run test:e2e:webkit`. Runs as the informational `webkit-smoke` CI job.
    ...(process.env.PW_WEBKIT ? [{ name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } } }] : []),
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
