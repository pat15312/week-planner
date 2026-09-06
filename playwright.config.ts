import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173/week-planner/', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173/week-planner/', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'desktop-chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-webkit', use: { browserName: 'webkit', viewport: { width: 1440, height: 900 } } },
    { name: 'phone-chromium', use: { browserName: 'chromium', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
    { name: 'phone-webkit', use: { browserName: 'webkit', viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true } },
    { name: 'tablet-webkit', use: { browserName: 'webkit', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } },
    { name: 'tablet-chromium', use: { browserName: 'chromium', viewport: { width: 1024, height: 768 }, hasTouch: true } },
  ],
});
