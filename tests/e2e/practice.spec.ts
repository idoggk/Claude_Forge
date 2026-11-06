import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { LESSONS } from '../../src/content/lessons/index';
import { MIXED_EXERCISES } from '../../src/content/interleaved';
import { answerItems, expectNoHorizontalOverflow, goto, startApp } from './helpers';

const L21 = LESSONS.find((l) => l.id === 'L21-prompt-injection-trust-boundaries')!;

test.describe('Practice that fits you', () => {
  test('a new learner sees honest emptiness, then a mixed exercise is gradable and saved as practice only', async ({ page }) => {
    await startApp(page);
    await goto(page, '/practice');
    await expect(page.getByText('Nothing to suggest yet')).toBeVisible();
    await expect(page.getByTestId('mixed-list').locator('li')).toHaveCount(MIXED_EXERCISES.length);
    const ex = MIXED_EXERCISES[0]!;
    await page.getByTestId(`mixed-open-${ex.id}`).click();
    await answerItems(page, [ex.item]);
    await page.getByTestId('mixed-submit').click();
    await expect(page.getByTestId(`feedback-${ex.item.id}`)).toContainText('Every part is right');
    await page.getByTestId('mixed-save').click();
    await expect(page.getByTestId('mixed-save')).toHaveText('Saved');
    await goto(page, '/practice');
    await expect(page.getByTestId(`mixed-${ex.id}`)).toContainText('1 run');
    await goto(page, '/growth');
    await expect(page.getByTestId('attempt-history')).toHaveCount(0); // practice never creates mastery evidence
  });

  test('a confident wrong assessment produces a foundation review with the evidence and the improvement criterion', async ({ page }) => {
    test.setTimeout(120_000);
    await startApp(page);
    await goto(page, `/academy/lesson/${L21.id}`);
    await page.getByRole('tab', { name: /3 · Assess/ }).click();
    await page.getByTestId('confidence-5').click();
    await page.getByTestId('start-assessment').click();
    await answerItems(page, L21.assessment.items, { wrong: true });
    await page.getByTestId('submit-answers').click();
    await expect(page.getByTestId('results')).toBeVisible();
    await goto(page, '/practice');
    const first = page.getByTestId('adaptive-list').locator('li').first();
    await expect(first).toContainText('Foundation review');
    await expect(first).toContainText('Why this');
    await expect(first).toContainText('Your evidence');
    await expect(first).toContainText('confidence 5 of 5');
    await expect(first).toContainText('What would count as improvement');
    await goto(page, '/');
    await expect(page.getByTestId('home-adaptive')).toContainText('Foundation review');
  });

  for (const w of [375, 1280]) {
    test(`accessible and without overflow at ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await startApp(page);
      for (const route of ['/practice', `/practice/${MIXED_EXERCISES[1]!.id}`]) {
        await goto(page, route);
        await page.waitForTimeout(300);
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${route}: ${v.id} ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
        await expectNoHorizontalOverflow(page);
      }
    });
  }
});
