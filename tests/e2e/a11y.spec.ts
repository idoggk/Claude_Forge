import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { DIAGNOSTIC } from '../../src/content/diagnostic';
import { DEV_PROPOSALS } from '../../src/fixtures/economy/mission';
import { answerItems, goto, startApp } from './helpers';

/**
 * Automated accessibility audit (axe-core): contrast, names, roles, landmarks, form labels.
 * Automated checks catch a subset of problems; keyboard and screen-reader behaviour is covered by other tests
 * and should still be spot-checked by hand.
 */
const ROUTES = ['/', '/explore', '/explore/reliable-workflows', '/playbooks', '/academy/opportunity-finder', '/academy/lesson/L12-context-engineering', '/loop', '/academy', '/academy/lesson/L01-skill-or-tool', '/academy/diagnostic', '/discovery', '/discovery/playwright-mcp', '/workshop', '/battle-lab', '/battle-lab/demo-merge-cascade', '/arsenal', '/growth', '/settings', '/more', '/search?q=skill'];

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`), 'serious/critical accessibility violations').toEqual([]);
}

for (const theme of ['dark', 'light'] as const) {
  test(`axe: no serious or critical violations on primary routes (${theme} theme)`, async ({ page }) => {
    await startApp(page);
    await goto(page, '/settings');
    await page.getByRole('radio', { name: theme === 'dark' ? 'Dark' : 'Light' }).click();
    for (const r of ROUTES) {
      await goto(page, r);
      await expect(page.locator('main h1, main h2').first()).toBeVisible();
      await page.waitForTimeout(200);
      await audit(page, `${theme} ${r}`);
    }
  });

  test(`axe: lesson stages, exercise results and editors (${theme} theme)`, async ({ page }) => {
    await startApp(page);
    await goto(page, '/settings');
    await page.getByRole('radio', { name: theme === 'dark' ? 'Dark' : 'Light' }).click();
    for (const id of ['L02-inside-skill-md', 'L04-skill-autopsy', 'L06-merge-chain-failure', 'L07-economy-inflation']) {
      await goto(page, `/academy/lesson/${id}`);
      for (const tab of [/2 · Practice/, /3 · Assess/, /4 · Apply/]) {
        await page.getByRole('tab', { name: tab }).click();
        await page.waitForTimeout(150);
        await audit(page, `${theme} ${id} ${tab}`);
      }
    }
    await goto(page, '/academy/lesson/L01-skill-or-tool');
    await page.getByRole('tab', { name: /2 · Practice/ }).click();
    await page.getByTestId('submit-answers').click();
    await expect(page.getByTestId('results')).toBeVisible();
    await audit(page, `${theme} graded results`);

    await goto(page, '/workshop');
    await page.getByTestId('new-starter').click();
    for (const tab of ['Basics', 'Instructions', 'Resources', 'Scenarios & Dojo', 'Trigger tuning', 'Validate', 'Quality review', 'Preview', 'Live test', 'Export & history']) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
      await page.waitForTimeout(120);
      await audit(page, `${theme} workshop ${tab}`);
    }
    await goto(page, '/battle-lab');
    await page.getByTestId('new-experiment').click();
    await audit(page, `${theme} new experiment`);
  });

  test(`axe: Improvement Loop steps, diagnostic results and misconception feedback (${theme} theme)`, async ({ page }) => {
    test.setTimeout(120_000);
    await startApp(page);
    await goto(page, '/settings');
    await page.getByRole('radio', { name: theme === 'dark' ? 'Dark' : 'Light' }).click();

    await goto(page, '/loop');
    await page.getByTestId('start-economy-balance-reviewer').click();
    await expect(page.getByTestId('step-title')).toBeVisible();
    await audit(page, `${theme} loop mission step`);
    await page.getByTestId('goto-baseline').click();
    await page.getByTestId(`open-dev-baseline-${DEV_PROPOSALS[0]!.id}`).click();
    await audit(page, `${theme} loop baseline case form`);
    for (const [i, p] of DEV_PROPOSALS.entries()) {
      if (i > 0) await page.getByTestId(`open-dev-baseline-${p.id}`).click();
      const box = page.getByTestId(`case-dev-baseline-${p.id}`);
      await box.getByRole('radio', { name: 'approve', exact: true }).click();
      await page.getByTestId(`save-${p.id}-baseline`).click();
      await expect(page.getByTestId(`save-${p.id}-baseline`)).toBeHidden();
      if (i === 0) await page.getByTestId(`open-dev-baseline-${p.id}`).waitFor();
    }
    await expect(page.getByTestId('create-skill')).toBeVisible();
    await audit(page, `${theme} loop build step`);
    await page.getByTestId('create-skill').click();
    await audit(page, `${theme} loop build step with draft`);

    await goto(page, '/academy/diagnostic');
    await answerItems(page, DIAGNOSTIC.items, { wrong: true });
    await page.getByTestId('submit-answers').click();
    await expect(page.getByTestId('diagnostic-result')).toBeVisible();
    const card = page.locator('[data-testid^="misconception-"]').first();
    const id = (await card.getAttribute('data-testid'))!.replace('misconception-', '');
    await page.getByTestId(`try-${id}`).first().click();
    await audit(page, `${theme} diagnostic result with misconception card`);
  });
}
