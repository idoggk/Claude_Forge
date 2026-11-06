import { expect, test } from '@playwright/test';
import { DIAGNOSTIC } from '../../src/content/diagnostic';
import { answerItems, goto, startApp } from './helpers';

test.describe('Placement diagnostic and misconception feedback', () => {
  test.beforeEach(async ({ page }) => { await startApp(page); });

  test('the diagnostic gives a hint, explains misconceptions, is retakeable and never raises a level', async ({ page }) => {
    await goto(page, '/academy');
    await expect(page.getByTestId('diagnostic-card')).toContainText('Not sure where to start?');
    await page.getByTestId('open-diagnostic').click();
    await expect(page).toHaveURL(/#\/academy\/diagnostic/);

    // all wrong: a gap for every concept, authored misconception feedback on the answers that carry one
    await answerItems(page, DIAGNOSTIC.items, { wrong: true });
    await page.getByTestId('submit-answers').click();
    const result = page.getByTestId('diagnostic-result');
    await expect(result).toContainText('did not change your competency levels');
    await expect(page.getByTestId('diagnostic-gaps').locator('li')).toHaveCount(DIAGNOSTIC.items.length);
    await expect(result).toContainText('Beliefs worth checking');
    await expect(page.locator('[data-testid^="misconception-"]').first()).toBeVisible();

    // the corrective question is practice: wrong first, then right
    const card = page.locator('[data-testid^="misconception-"]').first();
    const id = (await card.getAttribute('data-testid'))!.replace('misconception-', '');
    await page.getByTestId(`try-${id}`).first().click();
    const corrective = page.getByTestId(`corrective-${id}`).first();
    await expect(corrective).toBeVisible();
    await corrective.getByRole('radio').first().check();
    await corrective.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByTestId(`corrective-result-${id}`).first()).toContainText(/Correct|Not quite/);

    // Mission Control and Growth still show no demonstrated skill
    await goto(page, '/growth');
    await expect(page.getByText('Independent application')).toHaveCount(0);
    await goto(page, '/');
    await expect(page.getByTestId('next-mission')).toBeVisible();

    // history is kept and the diagnostic can be retaken; a perfect retake has no gaps
    await goto(page, '/academy/diagnostic');
    await expect(page.getByTestId('diagnostic-history').locator('li')).toHaveCount(1);
    await answerItems(page, DIAGNOSTIC.items);
    await page.getByTestId('submit-answers').click();
    await expect(page.getByTestId('diagnostic-result')).toContainText('You answered every question correctly');
    await expect(page.getByTestId('diagnostic-result')).toContainText('assessments still decide');

    // Academy card reflects the latest result
    await goto(page, '/academy');
    await expect(page.getByTestId('diagnostic-card')).toContainText('Retake the diagnostic');
  });

  test('flagged gaps reorder the recommendation and say why', async ({ page }) => {
    await goto(page, '/academy/diagnostic');
    await answerItems(page, DIAGNOSTIC.items, { wrong: true });
    await page.getByTestId('submit-answers').click();
    await expect(page.getByTestId('diagnostic-result')).toBeVisible();
    await goto(page, '/');
    await expect(page.getByTestId('mission-reasons')).toContainText('placement diagnostic flagged');
    await expect(page.getByTestId('mission-reasons')).toContainText('hint rather than a measurement');
  });
});
