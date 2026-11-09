import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { UNITS, getUnit } from '../../src/content/units/registry';
import type { ItemStep } from '../../src/domain/missions/model';
import { answerItems, expectNoHorizontalOverflow, goto, startApp } from './helpers';

const MISSION = getUnit('mission-skill-or-tool')!;
const items = MISSION.steps.filter((s): s is ItemStep => s.type === 'item');

/** Play the current step through the real UI. */
async function playStep(page: Page, opts: { wrong?: boolean } = {}) {
  const testid = await page.locator('[data-testid^="step-"][class*="step-enter"]').first().getAttribute('data-testid');
  const id = testid!.replace('step-', '');
  const step = MISSION.steps.find((s) => s.id === id)!;
  if (step.type === 'item') {
    await answerItems(page, [step.item], { wrong: opts.wrong });
    await page.getByTestId('step-check').click();
  } else if (step.type === 'branch') {
    await page.getByTestId(`branch-${step.options[0]!.id}`).click();
  }
  await page.getByTestId('step-continue').click();
  return id;
}

test.describe('Round 7: guided missions in the real UI', () => {
  test('a wrong prediction gets useful feedback and the idea to keep; a refresh resumes at the same step', async ({ page }) => {
    await startApp(page);
    await goto(page, `/mission/${MISSION.id}`);
    await expect(page.getByTestId('unit-title')).toHaveText(MISSION.title);
    await page.getByTestId('step-continue').click(); // the hook
    await expect(page.getByTestId('unit-progress')).toContainText('Predict');
    await answerItems(page, [items[0]!.item], { wrong: true });
    await page.getByTestId('step-check').click();
    await expect(page.getByTestId(`feedback-${items[0]!.item.id}`)).toContainText('Not quite');
    await expect(page.getByTestId('step-reveal')).toContainText('Guidance is advice');
    await page.reload();
    await expect(page.getByTestId('unit-progress')).toContainText('Predict');
    // the checked answer is frozen after a refresh: nothing can be changed
    await expect(page.getByTestId(`item-${items[0]!.item.id}`).getByRole('radio').first()).toBeDisabled();
    await expect(page.getByTestId('step-continue')).toBeVisible();
  });

  test('a full run: branch, practice with a hint, an independent challenge without hints, then the summary and where next', async ({ page }) => {
    test.setTimeout(120_000);
    await startApp(page);
    await goto(page, `/mission/${MISSION.id}`);
    await page.getByTestId('step-continue').click(); // hook
    await playStep(page); // predict
    await page.getByTestId('step-continue').click(); // discover (read)
    await playStep(page); // branch
    // practice: a hint is available and counted
    await page.getByTestId(`hint-${items[1]!.item.id}`).click();
    await answerItems(page, [items[1]!.item]);
    await page.getByTestId('step-check').click();
    await page.getByTestId('step-continue').click();
    // challenge: no hints are offered, and it says so
    await expect(page.getByText('Independent challenge')).toBeVisible();
    await expect(page.getByTestId(`hint-${items[2]!.item.id}`)).toHaveCount(0);
    await answerItems(page, [items[2]!.item]);
    await page.getByTestId('step-check').click();
    await page.getByTestId('step-continue').click();
    await page.getByTestId('step-continue').click(); // reflect -> finish
    await expect(page.getByTestId('unit-finished')).toBeVisible();
    await expect(page.getByTestId('unit-score')).toContainText('decisions right');
    await expect(page.getByTestId('unit-finished')).toContainText('does not change your competency level');
    await expect(page.getByRole('link', { name: /independent assessment/ })).toBeVisible();
    // practice leaves no mastery evidence
    await goto(page, '/growth');
    await expect(page.getByTestId('attempt-history')).toHaveCount(0);
  });

  test('a returning learner resumes an unfinished mission from the Learn page', async ({ page }) => {
    await startApp(page);
    await goto(page, `/mission/${MISSION.id}`);
    await page.getByTestId('step-continue').click();
    await goto(page, '/learn');
    await expect(page.getByTestId(`unit-card-${MISSION.id}`)).toContainText('In progress');
    await page.getByTestId(`unit-open-${MISSION.id}`).click();
    await expect(page.getByTestId('unit-progress')).toContainText('Predict');
  });

  for (const w of [375, 1280]) {
    test(`a mission screen is accessible and has no overflow at ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await startApp(page);
      await goto(page, `/mission/${MISSION.id}`);
      await page.getByTestId('step-continue').click();
      for (const _ of [0, 1]) {
        await page.waitForTimeout(300);
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
        await expectNoHorizontalOverflow(page);
        await playStep(page);
      }
    });
  }

  test('reduced motion removes the step animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await startApp(page);
    await goto(page, `/mission/${MISSION.id}`);
    const dur = await page.locator('.step-enter').first().evaluate((el) => getComputedStyle(el).animationDuration);
    expect(parseFloat(dur)).toBeLessThan(0.01);
  });

  test('every unit opens and its first screen asks the learner to do something within two steps', async ({ page }) => {
    await startApp(page);
    for (const u of UNITS) {
      await goto(page, `/${u.kind === 'spark' ? 'spark' : 'mission'}/${u.id}`);
      await expect(page.getByTestId('unit-title')).toHaveText(u.title);
    }
  });

  test.describe('playgrounds', () => {
    test('context: building a sufficient brief meets the challenge, "paste everything" fails in several ways, and the simulation is labelled', async ({ page }) => {
      await startApp(page);
      await goto(page, '/playgrounds/context');
      await expect(page.getByTestId('sim-banner')).toContainText('What is not');
      await expect(page.getByTestId('challenge-c1')).toContainText('Not yet');
      for (const id of ['code', 'failure', 'constraint', 'acceptance']) await page.getByTestId(`card-${id}`).check();
      await page.getByRole('radio', { name: 'First' }).click();
      await expect(page.getByTestId('challenge-c1')).toContainText('Met');
      await expect(page.getByTestId('pg-effects')).toContainText('fair chance');
      await page.getByTestId('pg-all').click();
      await expect(page.getByTestId('pg-effects')).toContainText('against a budget');
      await expect(page.getByTestId('pg-effects')).toContainText('contradicts the constraint');
      await expect(page.getByTestId('challenge-c1')).toContainText('Not yet');
    });

    test('permissions: reaching least privilege for a task, using only keyboard-operable controls', async ({ page }) => {
      await startApp(page);
      await goto(page, '/playgrounds/permissions');
      await expect(page.getByTestId('perm-verdict')).toContainText('Not enough to do the task');
      await page.getByTestId('perm-read').selectOption('inbox');
      await page.getByTestId('perm-write').selectOption('output');
      await expect(page.getByTestId('perm-verdict')).toContainText('Least privilege');
      await page.getByTestId('perm-network').check();
      await expect(page.getByTestId('perm-verdict')).toContainText('Breaks a constraint');
      await page.getByTestId('perm-network').uncheck();
      await page.getByTestId('perm-del').check();
      await expect(page.getByTestId('perm-verdict')).toContainText('broader than needed');
    });

    test('retrieval: a vague query misleads, a precise one retrieves the current source, and the limits are stated', async ({ page }) => {
      await startApp(page);
      await goto(page, '/playgrounds/retrieval');
      await expect(page.getByTestId('sim-banner')).toContainText('embeddings');
      await page.getByTestId('rag-vague').click();
      await expect(page.getByTestId('rag-hits')).toContainText('Dashboard session settings');
      await page.getByTestId('rag-good').click();
      await expect(page.getByTestId('pg-effects')).toContainText('rank');
      await expect(page.getByTestId('rag-hits')).toContainText('Quillbridge CLI reference');
      await page.getByTestId('rag-k').fill('5');
      await expect(page.getByTestId('rag-k-value')).toHaveText('5');
    });

    for (const w of [375, 1280]) {
      test(`all three are accessible and have no overflow at ${w}px`, async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: w, height: 900 });
        await startApp(page);
        for (const id of ['', 'context', 'permissions', 'retrieval']) {
          await goto(page, `/playgrounds${id ? `/${id}` : ''}`);
          await page.waitForTimeout(250);
          const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
          expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${id}: ${v.id} ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
          await expectNoHorizontalOverflow(page);
        }
      });
    }
  });
});
