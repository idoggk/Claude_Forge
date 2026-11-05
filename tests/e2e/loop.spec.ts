import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { DEV_PROPOSALS, HELDOUT_PROPOSALS, truthFor } from '../../src/fixtures/economy/mission';
import { goto, startApp } from './helpers';

const truth = (id: string) => truthFor([...DEV_PROPOSALS, ...HELDOUT_PROPOSALS].find((p) => p.id === id)!).verdict;
type V = 'approve' | 'revise' | 'reject';

async function record(page: Page, phase: 'dev' | 'heldout', cond: 'baseline' | 'v1' | 'v2', caseId: string, verdict: V, opts: { checklist?: string[] | null; activated?: 'Yes' | 'No'; last?: boolean } = {}) {
  await page.getByTestId(`open-${phase}-${cond}-${caseId}`).click();
  const box = page.getByTestId(`case-${phase}-${cond}-${caseId}`);
  await box.getByRole('radio', { name: verdict, exact: true }).click();
  if (opts.checklist) {
    await box.getByRole('radio', { name: 'I checked the answer' }).click();
    for (const label of opts.checklist) await box.getByLabel(label, { exact: false }).check();
  }
  if (opts.activated) await box.getByRole('radio', { name: opts.activated, exact: true }).click();
  await page.getByTestId(`save-${caseId}-${cond}`).click();
  await expect(page.getByTestId(`save-${caseId}-${cond}`)).toBeHidden();
  // the last run of a step moves the loop to the next step, so its own row is no longer on screen
  if (!opts.last) await expect(box.getByText(`recorded: ${verdict}`)).toBeVisible();
}

const CITES = 'Cited specific stage numbers';

test.describe('Skill Improvement Loop', () => {
  test('the whole loop, end to end, through the real UI', async ({ page }) => {
    test.setTimeout(180_000);
    await startApp(page);

    // ---- hub
    await page.getByTestId('nav-loop').click();
    await expect(page).toHaveURL(/#\/loop$/);
    await expect(page.getByTestId('loop-steps-overview')).toContainText('Held-out test');
    await expect(page.getByText('No loops yet')).toBeVisible();
    await page.getByTestId('start-economy-balance-reviewer').click();
    await expect(page).toHaveURL(/#\/loop\/loop_/);
    const loopUrl = page.url();

    // ---- 1. mission
    await expect(page.getByTestId('step-title')).toHaveText('Economy Balance Reviewer');
    await expect(page.getByTestId('step-test')).toBeDisabled();
    await page.getByTestId('goto-baseline').click();

    // ---- 2. baseline (a lazy reviewer who always says "approve")
    await expect(page.getByTestId('step-title')).toContainText('Baseline');
    await expect(page.getByTestId('download-economy-balance-review')).toBeVisible();
    for (const [i, p] of DEV_PROPOSALS.entries()) await record(page, 'dev', 'baseline', p.id, 'approve', { checklist: p.id === 'dev-1' ? [CITES] : [], last: i === DEV_PROPOSALS.length - 1 });
    // finishing the last baseline run moves the loop forward on its own
    await expect(page.getByTestId('step-title')).toContainText('Build the Skill');
    await expect(page.getByTestId('baseline-observations')).toContainText('Ran the simulation');
    await expect(page.getByTestId('baseline-observations')).toContainText('0 of 4 baseline answers');

    // ---- 3. build: draft, Workshop round trip, freeze
    await expect(page.getByTestId('freeze-v1')).toHaveCount(0);
    await page.getByTestId('create-skill').click();
    await expect(page.getByTestId('freeze-v1')).toBeEnabled();
    await page.getByTestId('open-workshop').click();
    await expect(page).toHaveURL(/#\/workshop\/skill_.*\?loop=loop_/);
    await expect(page.getByTestId('loop-banner')).toContainText('You are building v1');
    await page.getByTestId('back-to-loop').click();
    await page.getByTestId('freeze-v1').click();
    await expect(page.getByTestId('step-title')).toContainText('Test Skill v1');

    // ---- 4. test v1 (3 of 4 correct; the Skill did not activate once; never ran the simulation)
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-v1').click()]);
    expect(dl.suggestedFilename()).toBe('economy-balance-reviewer-v1.zip');
    const v1Verdicts: Record<string, V> = { 'dev-1': 'approve', 'dev-2': 'reject', 'dev-3': 'revise', 'dev-4': 'revise' };
    for (const [i, p] of DEV_PROPOSALS.entries()) await record(page, 'dev', 'v1', p.id, v1Verdicts[p.id]!, { checklist: [CITES], activated: p.id === 'dev-4' ? 'No' : 'Yes', last: i === DEV_PROPOSALS.length - 1 });

    // ---- 5. evaluate: nothing graded until asked
    await expect(page.getByTestId('step-title')).toContainText('Evaluate');
    await expect(page.getByTestId('eval-reading')).toHaveCount(0);
    await page.getByTestId('grade-dev').click();
    await expect(page.getByTestId('eval-reading')).toContainText('3 of 4');
    await expect(page.getByTestId('eval-reading')).toContainText('2 of 4');
    await expect(page.getByTestId('eval-reading')).toContainText('not proof');
    const signals = page.getByTestId('failure-signals');
    await expect(signals).toContainText('Missing verification instructions');
    await expect(signals).toContainText('did not activate in 1 of 4');
    await expect(page.getByTestId('match-summary')).toContainText('mismatch');
    await page.getByTestId('goto-improve').click();

    // ---- 6. improve: gate refuses until there is a hypothesis AND a real change
    await expect(page.getByTestId('save-improvement')).toBeDisabled();
    await page.getByTestId('pattern-missing-verification').check();
    await page.getByTestId('hypothesis').fill('Claude never ran the simulation. Making the run a required first step should raise verdict accuracy.');
    await page.getByTestId('expected-change').fill('More held-out verdicts match the simulation');
    await expect(page.getByTestId('requirements')).toContainText('actually differs from v1');
    await expect(page.getByTestId('save-improvement')).toBeDisabled();
    await page.getByTestId('open-workshop').click();
    await page.getByRole('tab', { name: 'Instructions' }).click();
    const ta = page.getByTestId('skill-instructions');
    await ta.fill((await ta.inputValue()) + '\n5. Before any verdict run `npx tsx run.ts <proposal-id>` and quote the stage numbers you rely on.');
    await expect(page.getByTestId('save-state')).toContainText('Saved');
    await expect(page.getByTestId('loop-banner')).toContainText('v1 is frozen');
    await page.getByTestId('back-to-loop').click();
    // the half-written hypothesis survived the trip
    await expect(page.getByTestId('hypothesis')).toHaveValue(/Claude never ran the simulation/);
    await expect(page.getByTestId('skill-diff')).toContainText('+1');
    await expect(page.getByTestId('save-improvement')).toBeEnabled();
    await page.getByTestId('save-improvement').click();
    // the saved revision stays on screen so you can read the diff, then you choose to continue
    await expect(page.getByTestId('step-title')).toContainText('Improvement saved');
    await expect(page.getByTestId('skill-diff')).toContainText('v1');
    await page.getByTestId('goto-heldout').click();
    await expect(page.getByTestId('step-title')).toContainText('Held-out');

    // ---- 7. held-out: record, refuse early reveal, then reveal and lock
    const hv1: Record<string, V> = { 'held-1': 'approve', 'held-2': 'approve', 'held-3': 'revise' };
    for (const p of HELDOUT_PROPOSALS) await record(page, 'heldout', 'v1', p.id, hv1[p.id]!, { activated: 'Yes' });
    await page.getByRole('button', { name: 'Reveal ground truth and lock runs' }).click();
    await page.getByRole('button', { name: 'Yes, reveal and lock' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'missing held-out cases' })).toBeVisible();
    for (const p of HELDOUT_PROPOSALS) await record(page, 'heldout', 'v2', p.id, truth(p.id), { activated: 'Yes' });
    await page.getByRole('button', { name: 'Reveal ground truth and lock runs' }).click();
    await page.getByRole('button', { name: 'Yes, reveal and lock' }).click();
    await expect(page.getByTestId('heldout-reading').first()).toBeVisible();
    await expect(page.getByTestId('panel-heldout')).toContainText('1 more held-out case');
    await expect(page.getByTestId('panel-heldout')).toContainText('not evidence of a general improvement');
    await expect(page.getByTestId('match-summary')).toContainText(/simulation says/i);

    // ---- 8. graduate
    await page.getByTestId('goto-graduate').click();
    await expect(page.getByTestId('graduate')).toBeDisabled();
    await page.getByTestId('reflection-lessons').fill('A broad description made the Skill skip sometimes, and without a required simulation run the verdicts drifted.');
    await page.getByTestId('reflection-application').fill('For One More Merge I will require the economy simulation output on every balance change and keep a verdict record.');
    await page.getByTestId('graduate').click();
    await expect(page.getByTestId('panel-graduate').getByText('Loop graduated')).toBeVisible();
    const [md] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-loop-md').click()]);
    const mdText = readFileSync((await md.path())!, 'utf8');
    for (const must of ['## 1. The problem', '## 5. Hypothesis and revision', '## 6. Held-out test', '## 7. Limitations', 'Missing verification instructions', 'self-reported']) expect(mdText).toContain(must);
    expect(mdText).not.toMatch(/undefined|NaN/);
    const [js] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-loop-json').click()]);
    expect(JSON.parse(readFileSync((await js.path())!, 'utf8')).format).toBe('claude-forge-skill-improvement-report');
    const [zip] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-final').click()]);
    expect(zip.suggestedFilename()).toBe('economy-balance-reviewer-final.zip');

    // ---- Battle Lab shows the loop's experiments as part of the loop, and will not let them be deleted from there
    await goto(page, '/battle-lab');
    const list = page.getByTestId('experiment-list');
    await expect(list).toContainText('Improvement Loop · development');
    await expect(list).toContainText('Improvement Loop · held-out');
    await expect(list.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    await list.getByRole('link', { name: /development set/ }).click();
    await expect(page.getByTestId('loop-experiment-banner')).toContainText('cannot be edited here');
    await expect(page.getByTestId('loop-experiment-banner')).toContainText('Part of a Skill Improvement Loop');

    // ---- everything survives a reload; Mission Control points at the loop hub
    await page.goto(loopUrl);
    await page.reload();
    for (const s of ['mission', 'baseline', 'build', 'test', 'evaluate', 'improve', 'heldout', 'graduate']) await expect(page.getByTestId(`step-${s}`)).toHaveAttribute('data-status', 'done');
    await goto(page, '/');
    await expect(page.getByTestId('loop-card')).toContainText('1 graduated');
  });

  test('a user can delete a loop; the Skill draft they built is kept', async ({ page }) => {
    await startApp(page);
    await goto(page, '/loop');
    await page.getByTestId('start-economy-balance-reviewer').click();
    await page.getByTestId('goto-baseline').click();
    for (const [i, p] of DEV_PROPOSALS.entries()) await record(page, 'dev', 'baseline', p.id, 'approve', { last: i === DEV_PROPOSALS.length - 1 });
    await page.getByTestId('create-skill').click();
    await page.getByRole('button', { name: 'Delete loop', exact: true }).click();
    await page.getByRole('button', { name: 'Delete loop and its experiments' }).click();
    await expect(page).toHaveURL(/#\/loop$/);
    await expect(page.getByText('No loops yet')).toBeVisible();
    await goto(page, '/workshop');
    await expect(page.getByText('economy-balance-reviewer').first()).toBeVisible();
    await goto(page, '/battle-lab');
    await expect(page.getByTestId('experiment-list')).toHaveCount(0);
  });
});
