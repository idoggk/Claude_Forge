import { expect, test } from '@playwright/test';
import { goto, startApp } from './helpers';

test.describe('Platform behaviour', () => {
  test('theme and motion settings persist across reloads', async ({ page }) => {
    await startApp(page);
    await goto(page, '/settings');
    await page.getByRole('radio', { name: 'Light' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('radio', { name: 'Reduce' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('keyboard: skip link, Ctrl+K search, and arrow keys across tabs', async ({ page }) => {
    await startApp(page);
    await page.reload(); // a fresh page so the first Tab lands on the first focusable element
    await expect(page.getByRole('heading', { level: 1, name: 'Mission Control' })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
    await page.keyboard.press('Control+k');
    await expect(page).toHaveURL(/#\/search/);
    await goto(page, '/academy/lesson/L01-skill-or-tool');
    await page.getByRole('tab', { name: /1 · Learn/ }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: /2 · Practice/ })).toBeFocused();
    await expect(page.getByRole('tab', { name: /2 · Practice/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('global search spans lessons, catalog and your Skills', async ({ page }) => {
    await startApp(page);
    await page.getByRole('searchbox', { name: /Search lessons/ }).or(page.getByPlaceholder('Search lessons, catalog, your Skills')).first().fill('debugging');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('search-results')).toContainText('Debug a Merge-Chain Failure');
    await expect(page.getByTestId('search-results')).toContainText('obra/superpowers');
    await page.getByTestId('search-input').fill('qqqqzzzz');
    await expect(page.getByText('Nothing matches')).toBeVisible();
  });

  test('works offline after the first load (service worker)', async ({ page, context }) => {
    await startApp(page);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload(); // the worker now controls the page
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Mission Control' })).toBeVisible();
    await goto(page, '/academy');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Five tracks');
    await context.setOffline(false);
  });

  test('every external link in the catalog is https, noopener and opens in a new tab', async ({ page }) => {
    await startApp(page);
    for (const id of ['anthropics-skills', 'obra-superpowers', 'getsentry-skills', 'vercel-agent-skills', 'playwright-mcp', 'mcp-reference-servers', 'skill-creator-plugin', 'anthropics-claude-code-repo']) {
      await goto(page, `/discovery/${id}`);
      const links = page.locator('main a[href^="http"]');
      await expect(links.first()).toBeVisible();
      const n = await links.count();
      expect(n).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        const a = links.nth(i);
        expect(await a.getAttribute('href')).toMatch(/^https:\/\//);
        expect(await a.getAttribute('rel')).toMatch(/noopener/);
        expect(await a.getAttribute('target')).toBe('_blank');
      }
    }
  });

  test('catalog content is rendered as text, never as HTML', async ({ page }) => {
    await startApp(page);
    await goto(page, '/discovery');
    await page.getByTestId('add-candidate').click();
    await page.getByLabel('Name', { exact: true }).fill('<img src=x onerror="window.__pwned=1">');
    await page.getByRole('button', { name: 'Save candidate' }).click();
    await page.getByRole('link', { name: /<img src=x/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('<img src=x');
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  });
});
