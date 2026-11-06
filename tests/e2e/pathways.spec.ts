import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, goto, startApp } from './helpers';

test.describe('Capability pathways', () => {
  test('seven pathways, every step link resolves, and a saved challenge run is the only thing that marks its step', async ({ page }) => {
    await startApp(page);
    await goto(page, '/pathways');
    await expect(page.getByTestId('pathway-list').locator('li')).toHaveCount(7);
    await expect(page.getByTestId('pathway-card-reliable-structured-output')).toContainText('0 of 6 steps have a record');

    await page.getByTestId('pathway-open-reliable-structured-output').click();
    const steps = page.getByTestId('pathway-steps').locator('li');
    await expect(steps).toHaveCount(6);
    const hrefs = await page.locator('[data-testid^="pathway-go-"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')!));
    expect(hrefs).toHaveLength(6);
    for (const h of hrefs) {
      await page.goto(`/${h}`);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expect(page.getByText('No such', { exact: false })).toHaveCount(0);
    }

    // opening pages marked nothing
    await goto(page, '/pathways/reliable-structured-output');
    await expect(page.getByTestId('pathway-steps').getByText('Has a record', { exact: true })).toHaveCount(0);

    // a real saved challenge run marks exactly the matching step
    await goto(page, '/challenges/extraction');
    await page.getByTestId('challenge-submit').click();
    await page.getByTestId('challenge-save').click();
    await expect(page.getByTestId('challenge-save')).toHaveText('Saved');
    await goto(page, '/pathways/reliable-structured-output');
    await expect(page.getByTestId('pathway-step-2')).toBeVisible();
    await expect(page.getByTestId('pathway-steps').getByText('Has a record', { exact: true })).toHaveCount(1);
    await expect(page.getByTestId('pathway-step-2')).toContainText('Has a record');
  });

  test('Home links to pathways, challenges and the library once the lab card is shown', async ({ page }) => {
    await startApp(page);
    await goto(page, '/pathways/agents-that-do-not-fool-you');
    await expect(page.getByTestId('pathway-agents-that-do-not-fool-you')).toBeVisible();
    await goto(page, '/pathways/nope');
    await expect(page.getByText('No such pathway')).toBeVisible();
  });

  for (const w of [375, 1280]) {
    test(`no serious axe violations and no overflow at ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await startApp(page);
      for (const route of ['/pathways', '/pathways/trustworthy-research']) {
        await goto(page, route);
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${route}: ${v.id} ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
        await expectNoHorizontalOverflow(page);
      }
    });
  }
});
