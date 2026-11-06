import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { LESSONS } from '../../src/content/lessons/index';
import { answerItems, expectNoHorizontalOverflow, goto, startApp } from './helpers';

const L25 = LESSONS.find((l) => l.id === 'L25-agent-permissions-least-privilege')!;
const L26 = LESSONS.find((l) => l.id === 'L26-hooks-guardrails-deterministic-gates')!;
const L27 = LESSONS.find((l) => l.id === 'L27-research-reliability')!;
const L28 = LESSONS.find((l) => l.id === 'L28-ai-workflow-architecture')!;

async function startAssessment(page: Page, lessonId: string) {
  await goto(page, `/academy/lesson/${lessonId}`);
  await page.getByRole('tab', { name: /3 · Assess/ }).click();
  await page.getByTestId('confidence-3').click();
  await page.getByTestId('start-assessment').click();
}

test.describe('Round 6: new assessment formats in real lessons', () => {
  for (const lesson of [L25, L26, L27, L28]) {
    test(`${lesson.id}: a perfect run through the real UI passes, with scenario, diagnosis and construction items`, async ({ page }) => {
      test.setTimeout(120_000);
      await startApp(page);
      await startAssessment(page, lesson.id);
      await answerItems(page, lesson.assessment.items);
      await page.getByTestId('submit-answers').click();
      await expect(page.getByTestId('results')).toBeVisible();
      await expect(page.getByTestId('result-score')).toHaveText('100%');
      await expect(page.getByTestId('results')).not.toContainText('Not passed yet');
    });

    test(`${lesson.id}: wrong answers do not pass, and the construction explains which parts are missing`, async ({ page }) => {
      test.setTimeout(120_000);
      await startApp(page);
      await startAssessment(page, lesson.id);
      await answerItems(page, lesson.assessment.items, { wrong: true });
      await page.getByTestId('submit-answers').click();
      await expect(page.getByTestId('results')).toContainText('Not passed yet');
      const construct = lesson.assessment.items.find((i) => i.kind === 'construct')!;
      await expect(page.getByTestId(`feedback-${construct.id}`)).toContainText('cannot tell you whether your design is good');
      await expect(page.getByTestId(`rubric-${construct.id}`)).toBeVisible();
    });
  }

  test('a scenario shows its constraints before the choices, and the construction box is labelled', async ({ page }) => {
    await startApp(page);
    await startAssessment(page, L25.id);
    await expect(page.getByTestId('constraints-l25-a1').locator('li')).toHaveCount(4);
    await expect(page.getByLabel('Your JSON')).toBeVisible();
  });

  for (const w of [375, 1280]) {
    for (const theme of ['dark', 'light'] as const) {
      test(`accessible and without overflow at ${w}px in the ${theme} theme`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width: w, height: 900 });
        await startApp(page);
        await goto(page, '/settings');
        await page.getByRole('radio', { name: theme === 'dark' ? 'Dark' : 'Light' }).click();
        await startAssessment(page, L25.id);
        await answerItems(page, L25.assessment.items);
        await page.waitForTimeout(400);
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
        await expectNoHorizontalOverflow(page);
        await page.getByTestId('submit-answers').click();
        await expect(page.getByTestId('results')).toBeVisible();
        await page.waitForTimeout(400);
        const r2 = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(r2.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `results: ${v.id} ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
        await expectNoHorizontalOverflow(page);
      });
    }
  }
});
