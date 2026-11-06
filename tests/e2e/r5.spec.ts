import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { expectNoHorizontalOverflow, goto, startApp } from './helpers';

async function startPrompts(page: Page) {
  await goto(page, '/pilot');
  await page.getByTestId('start-prompts').click();
  await page.getByTestId('p-title').fill('Examples in my commit prompt');
  await page.getByTestId('p-problem').fill('Write a commit message in my team style from a diff.');
  await page.getByTestId('p-criteria').fill('The message follows the house format and is accurate.');
  await page.getByTestId('p-baseline').fill('My current one-line instruction, pasted exactly.');
  await page.getByTestId('p-technique').fill('Few-shot examples');
  await page.getByTestId('p-improved').fill('The same instruction with three worked examples.');
  await page.getByTestId('p-difference').fill('Three worked examples added; nothing else changes.');
  await page.getByTestId('p-prompt').fill('Diff: <paste the same diff>. Write the commit message.');
  await page.getByTestId('p-hypothesis').fill('Examples raise the share in house style; if they are copied literally I will drop them.');
  await page.getByTestId('p-create').click();
  await expect(page.getByTestId('pilot-guide')).toBeVisible();
}

async function record(page: Page, label: 'A' | 'B', success: 'Yes' | 'No', rework: string) {
  const qr = page.getByTestId('quick-run');
  await qr.getByRole('radio', { name: new RegExp(`^${label}( \\(suggested next\\))?$`) }).click();
  await qr.getByRole('radio', { name: success, exact: true }).click();
  if (!(await qr.getByTestId('qr-rework').isVisible())) await qr.getByText('Optional measurements').click();
  await qr.getByTestId('qr-rework').fill(rework);
  await qr.getByTestId('qr-save').click();
  await expect(page.getByTestId('pilot-runs')).toBeVisible();
}

test.describe('Round 5: the guided first experiment', () => {
  test.beforeEach(async ({ page }) => { await startApp(page); });

  test('three starters, a plan that cannot be skipped, eight steps derived from the data, and a complete record', async ({ page }) => {
    await page.getByTestId('nav-pilot').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Run Your First Real AI Experiment' })).toBeVisible();
    await expect(page.getByTestId('pilot-starters').locator('li')).toHaveCount(3);
    for (const id of ['skill', 'workflow', 'prompts']) await expect(page.getByTestId(`starter-${id}`)).toBeVisible();

    // the plan is required: nothing is created from an empty form
    await page.getByTestId('start-prompts').click();
    await expect(page.getByTestId('p-problem')).toHaveValue('');
    await expect(page.getByTestId('p-problem')).toHaveAttribute('placeholder', /commit message/);
    await page.getByTestId('p-create').click();
    await expect(page.getByTestId('p-errors')).toContainText('Describe the task');
    await expect(page.getByTestId('p-errors')).toContainText('yes/no check');

    await startPrompts(page);
    await expect(page.getByTestId('pilot-progress')).toContainText('3 of 8 steps done');
    await expect(page.getByTestId('pilot-progress')).toContainText('next: Run it outside Forge');

    // what to copy and keep constant, with an alternating order
    await expect(page.getByTestId('step-run')).toContainText('Do this in your own Claude Code');
    await expect(page.getByTestId('step-run')).toContainText('Keep constant');
    await expect(page.getByTestId('run-order')).toHaveText('A → B → B → A → A → B');
    const [sheet] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-run-sheet').click()]);
    const md = await readFile((await sheet.path())!, 'utf8');
    expect(md).toContain('Diff: <paste the same diff>');
    expect(md).toContain('Forge does not run Claude');

    // recording: failed attempts are kept, blanks are unknown
    await record(page, 'A', 'No', '3');
    await expect(page.getByTestId('count-A')).toContainText('1 of 3');
    await record(page, 'B', 'Yes', '1');
    for (const [l, s, r] of [['B', 'Yes', '1'], ['A', 'No', '2'], ['A', 'No', '3'], ['B', 'Yes', '0']] as const) await record(page, l, s, r);
    await expect(page.getByTestId('count-A')).toContainText('3 of 3');
    await expect(page.getByTestId('count-B')).toContainText('3 of 3');
    await expect(page.getByTestId('pilot-progress')).toContainText('5 of 8 steps done');

    // evaluation shows ranges and says what it cannot show, then needs written limits
    // the step that is current opens by itself (progressive disclosure)
    await expect(page.getByTestId('step-evaluate')).toContainText('What this experiment cannot show');
    await expect(page.getByTestId('step-evaluate')).toContainText('Limited: three or more runs');
    await expect(page.getByTestId('step-evaluate')).not.toContainText(/winner|proves/i);
    await page.getByTestId('ev-limitations').fill('One task type, three diffs, scored by me, one model.');
    await page.getByTestId('ev-limitations').blur();
    await expect(page.getByTestId('pilot-progress')).toContainText('6 of 8 steps done');
    await page.getByTestId('ev-conclusion').fill('With examples the output matched the house style on all three diffs, but two copied the example wording.');
    await page.getByTestId('ev-conclusion').blur();
    await page.getByTestId('ev-next').fill('Try different examples on three new diffs.');
    await page.getByTestId('ev-next').blur();
    await expect(page.getByTestId('pilot-progress')).toContainText('8 of 8 steps done');
    await expect(page.getByTestId('pilot-complete')).toContainText('one task, one setup and your own scoring');
    await page.getByTestId('pilot-conclude').click();
    await expect(page.getByTestId('pilot-complete')).toContainText('Concluded');

    // it is an ordinary Lab experiment: same record, same report
    await page.getByRole('link', { name: 'Open in the Lab' }).click();
    await expect(page).toHaveURL(/#\/battle-lab\/exp_/);
    await page.getByRole('tab', { name: 'Report & export' }).click();
    await expect(page.getByTestId('report-preview')).toContainText('Observed results');
    await page.reload();
    await goto(page, '/pilot');
    await expect(page.getByTestId('pilot-list')).toContainText('8 of 8 steps');
  });

  test('accessible and usable on a phone: no serious axe violations and no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 850 });
    const audit = async (label: string) => {
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${label}: ${v.id} ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
      await expectNoHorizontalOverflow(page);
    };
    await goto(page, '/pilot');
    await audit('pilot landing');
    await page.getByTestId('start-skill').click();
    await audit('pilot start form');
    await goto(page, '/pilot');
    await startPrompts(page);
    await audit('pilot guide (step 4)');
    await record(page, 'A', 'No', '2');
    await audit('pilot guide with a run recorded');
  });
});
