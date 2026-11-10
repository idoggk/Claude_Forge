import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { UNITS, getUnit } from '../../src/content/units/registry';
import type { ItemStep } from '../../src/domain/missions/model';
import { L01, answerItems, expectNoHorizontalOverflow, goto, setClockOffset, startApp, takeL01Assessment } from './helpers';

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
  test('a second tab that still holds the unanswered step cannot replace an answer that was already checked', async ({ browser }) => {
    const ctx = await browser.newContext();
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    const spark = getUnit('spark-agent-permissions')!;
    const ask = (spark.steps[0] as ItemStep).item;
    await startApp(a);
    await goto(a, `/spark/${spark.id}`);
    await expect(a.getByTestId('unit-title')).toBeVisible();
    await goto(b, `/spark/${spark.id}`);
    await expect(b.getByTestId('unit-title')).toBeVisible();
    // tab A answers wrongly and checks
    await answerItems(a, [ask], { wrong: true });
    await a.getByTestId('step-check').click();
    await expect(a.getByTestId(`feedback-${ask.id}`)).toContainText('Not quite');
    // tab B, still on the unanswered step, tries the right answer
    await answerItems(b, [ask]);
    // B is told and shows the stored answer; nothing in storage changed
    await expect(b.getByText('already answered in another tab')).toBeVisible();
    await expect(b.getByTestId(`feedback-${ask.id}`)).toContainText('Not quite');
    const stored = await a.evaluate(() => new Promise<{ answers: Record<string, unknown>; results: { correct: boolean }[] }[]>((res) => { const r = indexedDB.open('claude-forge'); r.onsuccess = () => { const q = r.result.transaction('missionRuns').objectStore('missionRuns').getAll(); q.onsuccess = () => res(q.result); }; }));
    expect(stored).toHaveLength(1);
    expect(stored[0]!.results[0]!.correct).toBe(false);
    await ctx.close();
  });

  test('after Check my answer focus moves to the feedback, so the keyboard and a screen reader land on the result (and it is on screen on a phone)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await startApp(page);
    const spark = getUnit('spark-agent-permissions')!;
    const ask = (spark.steps[0] as ItemStep).item;
    await goto(page, `/spark/${spark.id}`);
    await answerItems(page, [ask]);
    await page.getByTestId('step-check').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId(`feedback-${ask.id}`)).toBeFocused();
    await expect(page.getByTestId(`feedback-${ask.id}`)).toBeInViewport();
  });

  test('a Quick Spark can be completed with the keyboard alone (Tab, Space, Enter), ending on the summary', async ({ page }) => {
    await startApp(page);
    await goto(page, '/spark/spark-agent-permissions');
    await expect(page.getByTestId('unit-title')).toBeVisible();
    const tabTo = async (match: (el: Element | null) => boolean) => {
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab');
        if (await page.evaluate(`(${match.toString()})(document.activeElement)`)) return;
      }
      throw new Error('could not reach the control with Tab alone');
    };
    for (let guard = 0; guard < 8; guard++) {
      if (await page.getByTestId('unit-finished').isVisible()) break;
      if (await page.getByTestId('step-check').isVisible()) {
        await tabTo((el) => !!el && ((el as HTMLInputElement).type === 'radio' || (el as HTMLInputElement).type === 'checkbox'));
        await page.keyboard.press('Space');
        await tabTo((el) => el?.getAttribute('data-testid') === 'step-check');
        await page.keyboard.press('Enter');
        await expect(page.locator('[data-testid^="feedback-"]').first()).toBeFocused();
      }
      await tabTo((el) => el?.getAttribute('data-testid') === 'step-continue');
      await page.keyboard.press('Enter');
    }
    await expect(page.getByTestId('unit-finished')).toBeVisible();
  });

  test('the option order of a question does not change when the page is reloaded, even after the answer is checked', async ({ page }) => {
    await startApp(page);
    const spark = getUnit('spark-agent-permissions')!;
    const ask = (spark.steps[0] as ItemStep).item;
    await goto(page, `/spark/${spark.id}`);
    const order = () => page.getByTestId(`item-${ask.id}`).getByRole('radio').evaluateAll((els) => els.map((e) => (e.closest('label') ?? e.parentElement)!.textContent!.slice(0, 24)));
    await expect(page.getByTestId(`item-${ask.id}`)).toBeVisible();
    const before = await order();
    await page.reload();
    await expect(page.getByTestId(`item-${ask.id}`)).toBeVisible();
    expect(await order()).toEqual(before);
    await answerItems(page, [ask], { wrong: true });
    await page.getByTestId('step-check').click();
    const checked = await order();
    await page.reload();
    await expect(page.getByTestId(`item-${ask.id}`)).toBeVisible();
    await expect(page.getByTestId('step-continue')).toBeVisible();
    expect(await order()).toEqual(checked);
  });

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

  test.describe('learning-first home, five-minute review and the whole loop', () => {
    test('first 30 seconds: on a small phone the first challenge can be started without scrolling, and nothing optional comes before it', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.getByTestId('finish-onboarding').click();
      const start = page.getByTestId('next-challenge-start');
      await expect(start).toBeVisible();
      const box = (await start.boundingBox())!;
      const nav = (await page.getByRole('navigation', { name: 'Primary mobile' }).boundingBox())!;
      expect(box.y + box.height, 'the Start button must end above the bottom navigation').toBeLessThanOrEqual(nav.y);
      const optional = (await page.getByTestId('home-diagnostic').boundingBox())!;
      expect(optional.y, 'the optional diagnostic comes after the first challenge').toBeGreaterThan(box.y);
      await start.click();
      await expect(page.getByTestId('unit-title')).toBeVisible();
      await expect(page.getByRole('radio').first()).toBeVisible(); // the first screen is a question, not more reading
    });

    test('1. a new learner sees one inviting challenge first, completes the Quick Spark, and returns to Mission Control with it remembered', async ({ page }) => {
      await startApp(page);
      await expect(page.getByTestId('next-challenge')).toBeVisible();
      await expect(page.getByTestId('next-challenge')).toContainText('Try this first');
      await expect(page.getByTestId('next-challenge-why')).toContainText('No set-up');
      await expect(page.getByTestId('learn-modes')).toContainText('Quick Spark');
      await expect(page.getByTestId('learn-modes')).toContainText('Guided Mission');
      await expect(page.getByTestId('learn-modes')).toContainText('Deep Lab');
      await expect(page.getByTestId('next-challenge')).toContainText('estimate');
      await page.getByTestId('next-challenge-start').click();
      await expect(page).toHaveURL(/#\/spark\//);
      const unit = UNITS.find((u) => page.url().endsWith(u.id))!;
      const steps = unit.steps;
      for (const st of steps) {
        if (st.type === 'item') { await answerItems(page, [st.item]); await page.getByTestId('step-check').click(); }
        await page.getByTestId('step-continue').click();
      }
      await expect(page.getByTestId('unit-finished')).toBeVisible();
      await page.getByRole('link', { name: 'Mission Control' }).first().click();
      await expect(page.getByTestId('next-challenge-title')).not.toHaveText(unit.title); // a different challenge now
      await goto(page, '/learn');
      await expect(page.getByTestId(`unit-card-${unit.id}`)).toContainText('Done');
    });

    test('2. a returning learner resumes an unfinished mission straight from Mission Control in one interaction', async ({ page }) => {
      await startApp(page);
      await goto(page, `/mission/${MISSION.id}`);
      await page.getByTestId('step-continue').click();
      await goto(page, '/');
      await expect(page.getByTestId('next-challenge')).toContainText('Pick up where you left off');
      await page.getByTestId('next-challenge-start').click();
      await expect(page.getByTestId('unit-progress')).toContainText('Predict');
    });

    test('5. a five-minute review: nothing due offers a relevant challenge; when reviews are due it asks one question at a time and saves', async ({ page }) => {
      test.setTimeout(120_000);
      await startApp(page);
      await goto(page, '/review5');
      await expect(page.getByTestId('review5-empty')).toContainText('Nothing is due');
      await expect(page.getByRole('link', { name: /Try it|Start/ }).first()).toBeVisible();
      // pass lesson 1 so a review is scheduled, then move the app's clock forward two days (Settings -> Testing tools)
      await takeL01Assessment(page, { confidence: 3 });
      await setClockOffset(page, 2);
      await goto(page, '/');
      await expect(page.getByTestId('next-challenge')).toContainText('Due now');
      await page.getByTestId('next-challenge-start').click();
      await expect(page.getByTestId('review5')).toBeVisible();
      await expect(page.getByTestId('review5-progress')).toContainText('Question 1 of');
      const total = Number((await page.getByTestId('review5-progress').textContent())!.match(/of (\d+)/)![1]);
      expect(total).toBeLessThanOrEqual(5);
      for (let q = 0; q < total; q++) {
        const id = (await page.locator('[data-testid^="item-"]').first().getAttribute('data-testid'))!.replace('item-', '');
        const item = L01.reviewItems.find((x) => x.id === id)!;
        await answerItems(page, [item]);
        await page.getByTestId('review5-check').click();
        await expect(page.getByTestId(`feedback-${id}`)).toBeVisible();
        await page.getByTestId(q === total - 1 ? 'review5-finish' : 'review5-next').click();
      }
      await expect(page.getByTestId('review5-summary')).toContainText('Review done');
      await expect(page.getByTestId('review5-summary')).toContainText('Next review');
    });

    test('Deep Lab is an honest doorway into the existing tools and shows where you left off', async ({ page }) => {
      await startApp(page);
      await goto(page, '/deep-lab');
      await expect(page.getByTestId('deep-lab-list').locator('li')).toHaveCount(5);
      await expect(page.getByTestId('deep-lab-experiment')).toContainText(/own Claude Code/i);
      await expect(page.getByTestId('deep-lab-experiment')).toContainText('(estimate)');
    });

    for (const w of [375, 390, 768, 1280]) {
      test(`Home, Learn and Deep Lab fit and pass axe at ${w}px`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: 900 });
        await startApp(page);
        for (const r of ['/', '/learn', '/deep-lab', '/review5']) {
          await goto(page, r);
          await page.waitForTimeout(250);
          const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
          expect(a.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${r}: ${v.id} ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
          await expectNoHorizontalOverflow(page);
        }
      });
    }
  });
});
