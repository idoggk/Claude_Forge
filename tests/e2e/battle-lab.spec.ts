import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { goto, startApp } from './helpers';

async function createExperiment(page: Page) {
  await goto(page, '/battle-lab');
  await page.getByTestId('new-experiment').click();
  await page.getByTestId('exp-title').fill('Debugging Skill vs none on merge cascade');
  await page.getByTestId('exp-hypothesis').fill('With the Skill more runs pass all tests. I would change my mind if ranges overlap.');
  await page.getByTestId('cond-skill-1').fill('merge-chain-debugger');
  await page.getByTestId('cond-diff-1').fill('merge-chain-debugger Skill enabled; nothing else differs');
  await page.getByTestId('create-experiment').click();
  await expect(page).toHaveURL(/#\/battle-lab\/exp_/);
}

async function recordRun(page: Page, condLabel: 'A' | 'B', passed: string, total: string, extra: { runtime?: string; text?: string } = {}) {
  await page.getByTestId('run-condition').selectOption({ label: condLabel === 'A' ? 'A - no Skill' : 'B - merge-chain-debugger' });
  await page.getByTestId('tests-passed').fill(passed);
  await page.getByTestId('tests-total').fill(total);
  if (extra.runtime) await page.getByTestId('metric-runtimeSec').fill(extra.runtime);
  if (extra.text) { await page.getByTestId('evidence-text').fill(extra.text); await page.getByTestId('add-pasted').click(); }
  await page.getByTestId('save-run').click();
  await expect(page.getByTestId('run-list')).toBeVisible();
}

test.describe('Battle Lab', () => {
  test.beforeEach(async ({ page }) => { await startApp(page); });

  test('18-20. create an experiment, enter two conditions and add evidence', async ({ page }) => {
    await goto(page, '/battle-lab');
    await page.getByTestId('new-experiment').click();
    // validation: hypothesis and the stated difference are required before runs
    await page.getByTestId('exp-title').fill('x');
    await page.getByTestId('create-experiment').click();
    await expect(page.getByTestId('exp-errors')).toContainText('Write a hypothesis');
    await expect(page.getByTestId('exp-errors')).toContainText('state exactly what differs');
    await createExperiment(page);
    await recordRun(page, 'A', '6', '10', { runtime: '120', text: 'Claude fixed the 4-case only.' });
    await expect(page.getByTestId('run-list')).toContainText('A · run 1');
    await expect(page.getByTestId('run-list')).toContainText('6/10 (self-reported)');
    await expect(page.getByTestId('run-list')).toContainText('pasted-output');
    await expect(page.getByTestId('run-list')).toContainText('self-reported');
  });

  test('21 & 22. comparison is correct, and missing metrics stay unknown', async ({ page }) => {
    await createExperiment(page);
    await recordRun(page, 'A', '6', '10', { runtime: '120' });
    await recordRun(page, 'A', '7', '10');
    await recordRun(page, 'B', '9', '10');
    await recordRun(page, 'B', '10', '10');
    await page.getByRole('tab', { name: 'Compare' }).click();
    const cmp = page.getByTestId('comparison');
    await expect(cmp).toContainText('Weak: two runs per condition');
    const table = cmp.locator('table').first();
    await expect(table).toContainText('0.65 [0.60–0.70] n=2'); // A
    await expect(table).toContainText('0.95 [0.90–1.00] n=2'); // B
    await expect(table).toContainText('do not overlap');
    // runtime: A has 1 known + 1 missing; B has nothing -> unknown, never zero, and "not comparable"
    await expect(table).toContainText('120 [120–120] n=1');
    await expect(table).toContainText('unknown (2 missing)');
    await expect(table).toContainText('Not comparable');
    await expect(page.getByTestId('integrity-notes')).toContainText('self-reported');
    await expect(page.getByTestId('comparison-summary')).not.toContainText(/better than|superior|wins/i);
  });

  test('one run per condition is called out as anecdotal', async ({ page }) => {
    await createExperiment(page);
    await recordRun(page, 'A', '2', '10');
    await recordRun(page, 'B', '10', '10');
    await page.getByRole('tab', { name: 'Compare' }).click();
    await expect(page.getByTestId('comparison')).toContainText('Anecdotal: one run per condition');
    await expect(page.getByTestId('comparison')).toContainText('cannot show that a Skill is better');
  });

  test('23. the experiment survives a reload and can be reopened and edited', async ({ page }) => {
    await createExperiment(page);
    await recordRun(page, 'A', '6', '10');
    await recordRun(page, 'B', '9', '10');
    await page.getByRole('tab', { name: 'Compare' }).click();
    await page.getByTestId('exp-observations').fill('B fixed all four-piece cases.');
    await page.getByTestId('exp-observations').blur();
    await page.reload();
    await page.getByRole('tab', { name: 'Record runs' }).click();
    await expect(page.getByTestId('run-list')).toContainText('A · run 1');
    await expect(page.getByTestId('run-list')).toContainText('B · run 1');
    await page.getByRole('tab', { name: 'Compare' }).click();
    await expect(page.getByTestId('exp-observations')).toHaveValue('B fixed all four-piece cases.');
    // edit a run
    await page.getByRole('tab', { name: 'Record runs' }).click();
    await page.getByRole('button', { name: 'Edit' }).first().click();
    await page.getByTestId('tests-passed').fill('7');
    await page.getByTestId('save-run').click();
    await expect(page.getByTestId('run-list')).toContainText('7/10');
    // reopen from the list
    await goto(page, '/battle-lab');
    await expect(page.getByTestId('experiment-list')).toContainText('Debugging Skill vs none');
    await page.getByRole('link', { name: 'Debugging Skill vs none on merge cascade' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Debugging Skill');
  });

  test('24. the experiment exports as JSON and a Markdown report with honest labelling', async ({ page }) => {
    await createExperiment(page);
    await recordRun(page, 'A', '6', '10', { runtime: '100' });
    await recordRun(page, 'B', '9', '10');
    await page.getByRole('tab', { name: 'Report & export' }).click();
    const [json] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-json').click()]);
    const data = JSON.parse(readFileSync((await json.path())!, 'utf8'));
    expect(data.format).toBe('claude-forge-experiment');
    expect(data.version).toBe(1);
    expect(data.notice).toContain('self-reported');
    expect(data.experiment.runs).toHaveLength(2);
    expect(data.experiment.fixture.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(data.derivedComparison.sufficiency.level).toBe('anecdotal');
    const [md] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-report').click()]);
    const report = readFileSync((await md.path())!, 'utf8');
    expect(report).toContain('Claude Forge did not run Claude');
    expect(report).toContain('Evidence sufficiency');
    expect(report).toContain('unknown');
  });

  test('the synthetic demo is clearly labelled, read-only, and clonable without data', async ({ page }) => {
    await goto(page, '/battle-lab');
    await page.getByTestId('open-demo').click();
    await expect(page.getByText('SYNTHETIC DEMONSTRATION - no Claude execution occurred')).toBeVisible();
    await expect(page.getByTestId('comparison')).toContainText('Limited: three or more runs');
    // A's runtime was timed for 2 of 3 runs: the missing one is reported as missing, not averaged in as zero
    await expect(page.getByTestId('comparison')).toContainText('157.5 [140–175] n=2 · 1 missing');
    await page.getByRole('tab', { name: 'Record runs' }).click();
    await expect(page.getByText('The demo is read-only')).toBeVisible();
    await page.getByTestId('clone-demo').click();
    await expect(page).toHaveURL(/#\/battle-lab\/exp_/);
    await expect(page.getByText('SYNTHETIC DEMONSTRATION')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Compare' }).click();
    await expect(page.getByTestId('comparison')).toContainText('no recorded data');
  });

  test('a fixture pack downloads with its manifest', async ({ page }) => {
    await createExperiment(page);
    await page.getByRole('tab', { name: 'Setup' }).click();
    const [pack] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-pack').click()]);
    expect(pack.suggestedFilename()).toBe('forge-fixture-merge-cascade.zip');
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(readFileSync((await pack.path())!));
    const names = Object.keys(zip.files).sort();
    expect(names).toContain('forge-fixture-merge-cascade/MANIFEST.sha256');
    expect(names).toContain('forge-fixture-merge-cascade/board.ts');
    expect(names.some((n) => n.includes('reference'))).toBe(false); // the answer key is never in the pack
    const board = await zip.file('forge-fixture-merge-cascade/board.ts')!.async('string');
    expect(board).toContain('return group;');
  });
});
