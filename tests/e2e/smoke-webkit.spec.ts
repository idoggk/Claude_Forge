import { expect, test } from '@playwright/test';
import { goto, startApp } from './helpers';

/**
 * Cross-browser smoke test. Meant for the optional WebKit project (PW_WEBKIT=1); skipped on Chromium because every
 * other spec already covers that. It checks the things most likely to differ in Safari: IndexedDB persistence,
 * hash routing, the service worker registration path, and a Skill ZIP download.
 */
test.describe('WebKit smoke (optional)', () => {
  test.skip(!process.env.PW_WEBKIT, 'Set PW_WEBKIT=1 (and install WebKit) to run this.');

  test('onboarding, persistence across reload, the loop hub and a ZIP export work', async ({ page }) => {
    await startApp(page);
    await goto(page, '/loop');
    await expect(page.getByTestId('loop-steps-overview')).toContainText('Held-out test');
    await page.getByTestId('start-economy-balance-reviewer').click();
    await expect(page).toHaveURL(/#\/loop\/loop_/);
    await page.reload();
    await expect(page.getByTestId('step-title')).toBeVisible();
    await goto(page, '/workshop');
    await page.getByTestId('new-starter').click();
    await page.getByRole('tab', { name: 'Export & history' }).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-zip').click()]);
    expect(dl.suggestedFilename()).toMatch(/\.zip$/);
  });
});
