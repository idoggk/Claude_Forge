import { expect, test } from '@playwright/test';
import { L01, answerItems, goto, reviewItemsOnPage, setClockOffset, startApp, takeL01Assessment } from './helpers';

test.describe('Learning', () => {
  test('1. first-time user opens the app and is guided to onboarding', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/#\/onboarding/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('using AI');
    await expect(page.getByText('does not sync between devices', { exact: false })).toBeVisible();
  });

  test('2. user completes onboarding and lands on a clear next mission', async ({ page }) => {
    await startApp(page, { interests: ['Game development workflows'] });
    await expect(page.getByTestId('next-mission')).toBeVisible();
    await expect(page.getByTestId('mission-title')).toHaveText('Skill or Tool?');
    await expect(page.getByTestId('mission-reasons')).toContainText('No prerequisites');
    await expect(page.getByTestId('primary-action')).toBeVisible();
  });

  test('3. user starts a lesson', async ({ page }) => {
    await startApp(page);
    await page.getByTestId('primary-action').click();
    await expect(page).toHaveURL(new RegExp(`/academy/lesson/${L01.id}`));
    await expect(page.getByRole('heading', { level: 1, name: 'Skill or Tool?' })).toBeVisible();
    await expect(page.getByText('The developer problem')).toBeVisible();
    await page.getByTestId('to-practice').click();
    await expect(page.getByTestId('item-l01-p1')).toBeVisible();
  });

  test('4. an incorrect answer gets specific feedback explaining why', async ({ page }) => {
    await startApp(page);
    await goto(page, `/academy/lesson/${L01.id}`);
    await page.getByRole('tab', { name: /2 · Practice/ }).click();
    await answerItems(page, L01.activity.items, { wrong: true });
    await page.getByTestId('submit-answers').click();
    const fb = page.getByTestId('feedback-l01-p2');
    await expect(fb).toBeVisible();
    await expect(fb).toContainText('Not quite');
    await expect(fb).toContainText('Correct: judgment stays in the Skill');
    await expect(page.getByTestId('result-score')).toHaveText('0%');
  });

  test('5. a correct attempt scores fully; hints are recorded and keep practice "guided"', async ({ page }) => {
    await startApp(page);
    await goto(page, `/academy/lesson/${L01.id}`);
    await page.getByRole('tab', { name: /2 · Practice/ }).click();
    await page.getByTestId('hint-l01-p2').click();
    await expect(page.getByText('Which mechanism runs "every time its event occurs"?')).toBeVisible();
    await answerItems(page, L01.activity.items);
    await page.getByTestId('submit-answers').click();
    await expect(page.getByTestId('result-score')).toHaveText('100%');
    await expect(page.getByTestId('level-changes')).toContainText('Guided application');
    await expect(page.getByTestId('lesson-progress')).toContainText('1 practice attempt(s)');
    // mastery did not jump to independent from guided practice
    await expect(page.getByTestId('level-changes')).not.toContainText('Independent application ↑');
    // the progress strip is derived from saved attempts, so it survives a reload
    await page.reload();
    await expect(page.getByTestId('lesson-progress')).toContainText('1 practice attempt(s)');
  });

  test('6. assessment captures confidence first, then calibration; progress survives a reload', async ({ page }) => {
    await startApp(page);
    await takeL01Assessment(page, { confidence: 5 });
    await expect(page.getByTestId('result-score')).toHaveText('100%');
    await expect(page.getByTestId('calibration')).toContainText('You predicted ~95%');
    await expect(page.getByTestId('level-changes')).toContainText('Independent application');
    await page.reload();
    await goto(page, '/growth');
    await expect(page.getByTestId('attempt-history')).toContainText('Skill or Tool?');
    await expect(page.getByTestId('comp-mechanism-selection')).toContainText('Independent application');
    await goto(page, `/academy/lesson/${L01.id}`);
    await page.getByRole('tab', { name: /3 · Assess/ }).click();
    await expect(page.getByTestId('assessment-history')).toContainText('100%');
  });

  test('7. a failed attempt shapes the next recommendation; passing moves on', async ({ page }) => {
    await startApp(page);
    await takeL01Assessment(page, { wrong: true, confidence: 5 });
    await expect(page.getByTestId('results')).toContainText('Not passed yet');
    await expect(page.getByTestId('calibration')).toContainText('overconfident');
    await goto(page, '/');
    await expect(page.getByTestId('mission-title')).toHaveText('Skill or Tool?');
    await expect(page.getByTestId('mission-reasons')).toContainText('missed: Mechanism selection');
    await expect(page.getByTestId('primary-action')).toHaveText(/Retry the assessment/);

    // a retake passes but counts as guided practice only: level 3 is not awarded on seen questions
    await takeL01Assessment(page, { confidence: 3 });
    await expect(page.getByTestId('level-changes')).toContainText('Guided application');
    await goto(page, '/');
    await expect(page.getByTestId('mission-title')).not.toHaveText('Skill or Tool?');
    await expect(page.getByTestId('mission-title')).toHaveText('Inside SKILL.md');
  });

  test('8. spaced review is scheduled, becomes due, is graded on fresh questions and reschedules', async ({ page }) => {
    await startApp(page);
    await takeL01Assessment(page);
    await expect(page.getByTestId('review-scheduled')).toContainText('Spaced review scheduled');
    await goto(page, '/');
    await expect(page.getByTestId('no-reviews')).toContainText('Next review');

    await setClockOffset(page, 2);
    await goto(page, '/');
    await expect(page.getByTestId('due-reviews')).toContainText('Skill or Tool?');
    await expect(page.getByTestId('mission-title')).toContainText('Review: Skill or Tool?');

    await page.getByTestId('primary-action').click();
    await expect(page).toHaveURL(/academy\/review\//);
    await expect(page.getByTestId('review-plan')).toContainText('Why these');
    await answerItems(page, await reviewItemsOnPage(page));
    await page.getByTestId('submit-answers').click();
    await expect(page.getByTestId('review-outcome')).toContainText('pass');
    await expect(page.getByTestId('review-outcome')).toContainText('Next review');

    await goto(page, '/');
    await expect(page.getByTestId('no-reviews')).toBeVisible();
    await goto(page, '/growth');
    await expect(page.getByTestId('review-queue')).toContainText('box 2/4');
  });
});
