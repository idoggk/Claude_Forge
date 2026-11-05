import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { goto, startApp } from './helpers';

async function openStepEvidence(page: Page, i: number) {
  const box = page.getByTestId(`step-${i}-evidence`);
  if ((await box.getAttribute('open')) === null) await box.locator('summary').first().click();
  return box;
}

async function recordRun(page: Page, cond: 'A' | 'B', passed: string, total: string) {
  await page.getByTestId('run-condition').selectOption({ label: cond === 'A' ? 'A - no Skill' : 'B - release-notes-checker' });
  await page.getByTestId('tests-passed').fill(passed);
  await page.getByTestId('tests-total').fill(total);
  await page.getByTestId('save-run').click();
  await expect(page.getByTestId('run-list')).toBeVisible();
}

test.describe('Round 4: playbook steps and AI Lab evidence', () => {
  test.beforeEach(async ({ page }) => { await startApp(page); });

  test('create an experiment from a step, record runs, see the link go stale, reassess, judge it, and save a versioned evaluation', async ({ page }) => {
    await goto(page, '/playbooks');
    await page.getByTestId('use-seed-release-notes').click();
    await expect(page.getByTestId('playbook-editor')).toBeVisible();
    await expect(page.getByTestId('maturity-card')).toContainText('Ready to test');

    // 1. start an experiment FROM step 3 (coverage check): the form says what it will be linked to
    let box = await openStepEvidence(page, 2);
    await expect(box).toContainText('No evidence linked');
    await box.getByTestId('new-exp-2').click();
    await expect(page).toHaveURL(/#\/battle-lab\?playbook=/);
    await expect(page.getByText('This experiment will be linked to a playbook step')).toBeVisible();
    await expect(page.getByTestId('exp-title')).toHaveValue(/Check coverage/);
    await page.getByTestId('exp-hypothesis').fill('With the Skill the coverage check catches missing numbers more often. I would change my mind if the ranges overlap.');
    await page.getByTestId('cond-skill-1').fill('release-notes-checker');
    await page.getByTestId('cond-diff-1').fill('release-notes-checker Skill enabled; nothing else differs');
    await page.getByTestId('create-experiment').click();
    await expect(page).toHaveURL(/#\/battle-lab\/exp_/);
    await expect(page.getByTestId('playbook-links-card')).toBeHidden(); // lives on the Setup tab

    // 2. the Lab shows the link; it is already stale because the experiment gained runs after linking
    await page.getByRole('tab', { name: 'Setup' }).click();
    await expect(page.getByTestId('playbook-links-card')).toContainText('Draft release notes');
    await expect(page.getByTestId('playbook-links-card')).toContainText('Not judged');
    await page.getByRole('tab', { name: 'Record runs' }).click();
    await recordRun(page, 'A', '6', '10');
    await recordRun(page, 'A', '7', '10');
    await recordRun(page, 'B', '9', '10');
    await recordRun(page, 'B', '10', '10');
    await page.getByRole('tab', { name: 'Setup' }).click();
    await expect(page.getByTestId('playbook-links-card')).toContainText('Stale: reassess in the playbook');

    // 3. back in the playbook: stale evidence is ignored and says why
    await page.getByTestId('playbook-links-card').getByRole('link', { name: 'Draft release notes from merged pull requests' }).click();
    box = await openStepEvidence(page, 2);
    await expect(box).toContainText('Needs reassessment');
    await expect(box).toContainText('This evidence is stale and is not counted');
    await expect(page.getByTestId('maturity-card')).toContainText('Ready to test');

    // 4. reassess, then judge against criteria written first. Everything is required before it counts.
    await box.getByRole('button', { name: /Reassess against the current step/ }).click();
    await expect(box).toContainText('Evidence linked, not yet judged');
    await expect(box.getByRole('button', { name: /Reassess/ })).toHaveCount(0);
    await box.getByText(/Is this evidence suitable/).click();
    await expect(box).toContainText('Criteria written before judging');
    await box.locator('[data-testid^="criteria-"]').fill('The check passes when the Skill condition finishes more tests than the baseline in every run.');
    await box.locator('[data-testid^="status-"]').selectOption('supports');
    await box.locator('[data-testid^="claimed-"]').selectOption('met');
    await box.locator('[data-testid^="note-"]').fill('Both Skill runs passed more tests than both baseline runs; ranges do not overlap.');
    await box.locator('[data-testid^="save-review-"]').click();
    // still not supported: limitations are missing, so the step is only "partly supported"
    await expect(box).toContainText('Partly supported');
    await expect(box).toContainText('Limitations stated');
    await box.locator('[data-testid^="lims-"]').fill('Two runs per condition on one fixture and one model; says nothing about other repositories.');
    await box.locator('[data-testid^="save-review-"]').click();
    await expect(box).toContainText('Supported by current evidence');

    // 5. maturity moves only as far as the evidence goes: one of five gated steps
    await expect(page.getByTestId('maturity-card')).toContainText('Partially evaluated');
    await expect(page.getByTestId('maturity-card')).toContainText('1 of 5 gated step');
    await expect(page.getByTestId('maturity-card')).toContainText('no maturity state changes your competency levels');

    // 6. a saved evaluation records version, observed results, interpretation, limitations and the next experiment
    await page.getByTestId('eval-label').fill('first look');
    await page.getByTestId('save-evaluation').click();
    await expect(page.getByTestId('evaluation-list')).toContainText('first look');
    await expect(page.getByTestId('evaluation-list')).toContainText('version 1');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('evaluation-list').getByRole('button', { name: 'Markdown' }).click()]);
    const md = await readFile((await dl.path())!, 'utf8');
    for (const h of ['## Observed evidence', '## Interpretation', '## Limitations', '## Next experiment']) expect(md).toContain(h);
    expect(md).toContain('Maturity: Partially evaluated');
    expect(md).toContain('Claude Forge ran nothing');

    // 7. editing the step makes the evidence stale again and the saved summary keeps its version
    await page.getByTestId('step-2-verification').fill('Every PR number appears exactly once and the script prints the count it checked.');
    await page.getByTestId('save-playbook').click();
    await expect(page.getByText('Unsaved changes')).toHaveCount(0);
    box = await openStepEvidence(page, 2);
    await expect(box).toContainText('Needs reassessment');
    await expect(box).toContainText('The step changed after this evidence was linked');
    await expect(page.getByTestId('maturity-card')).toContainText('Ready to test');
    await expect(page.getByTestId('evaluation-list')).toContainText('version 1');
  });

  test('a verified step stops counting as verified after its wording changes, until it is re-confirmed', async ({ page }) => {
    await goto(page, '/playbooks');
    await page.getByTestId('use-seed-release-notes').click();
    await page.getByTestId('step-0-status').selectOption('verified');
    await page.getByTestId('step-0-verified-note').fill('Ran the script on last week\'s data and the file validated.');
    await page.getByTestId('save-playbook').click();
    await expect(page.getByText('Unsaved changes')).toHaveCount(0);
    await expect(page.getByTestId('step-0').locator('.rounded-full').first()).toContainText('Verified');
    await expect(page.getByTestId('step-0')).not.toContainText('Verification outdated');
    await page.getByTestId('step-0-verification').fill('The file validates against the schema and contains at least one PR, and the count is logged.');
    await expect(page.getByTestId('step-0')).toContainText('Verification outdated');
    await page.getByTestId('save-playbook').click();
    await expect(page.getByText('Unsaved changes')).toHaveCount(0);
    await expect(page.getByTestId('step-0')).toContainText('This step changed after it was verified');
    await page.getByTestId('step-0-reconfirm').click();
    await page.getByTestId('save-playbook').click();
    await expect(page.getByText('Unsaved changes')).toHaveCount(0);
    await expect(page.getByTestId('step-0')).not.toContainText('Verification outdated');
    await expect(page.getByTestId('step-0').locator('.rounded-full').first()).toContainText('Verified');
  });

  test('the synthetic demo can never support a step, and a playbook with only fixture evidence is not called field-proven', async ({ page }) => {
    await goto(page, '/playbooks');
    await page.getByTestId('use-seed-release-notes').click();
    await expect(page.getByTestId('maturity-card')).not.toContainText('Applied to real work');
    // the demo is not a stored experiment, so the picker has nothing to offer
    const box = await openStepEvidence(page, 0);
    await expect(box.getByTestId('link-pick-0')).toBeDisabled();
    await expect(box).toContainText('No unlinked experiments yet');
  });
});

async function createLabExperiment(page: Page) {
  await goto(page, '/battle-lab');
  await page.getByTestId('new-experiment').click();
  await page.getByTestId('exp-title').fill('Checker Skill vs none');
  await page.getByTestId('exp-hypothesis').fill('With the Skill more runs pass all tests. I would change my mind if ranges overlap.');
  await page.getByTestId('cond-skill-1').fill('release-notes-checker');
  await page.getByTestId('cond-diff-1').fill('release-notes-checker Skill enabled; nothing else differs');
  await page.getByTestId('create-experiment').click();
  await expect(page).toHaveURL(/#\/battle-lab\/exp_/);
}

test.describe('Round 4: AI Lab quality', () => {
  test.beforeEach(async ({ page }) => { await startApp(page); });

  test('a statement in pasted output is never a measurement; a recognised summary is parsed and applied only when you choose', async ({ page }) => {
    await createLabExperiment(page);
    await page.getByTestId('evidence-text').fill('I fixed it. All tests pass now.');
    await expect(page.getByTestId('found-in-text')).toContainText('Inferred');
    await expect(page.getByTestId('found-in-text')).toContainText('not test output');
    await expect(page.getByTestId('use-parsed-counts')).toHaveCount(0);
    await expect(page.getByTestId('tests-passed')).toHaveValue('');
    await page.getByTestId('evidence-text').fill('All tests pass!\n Tests  2 failed | 10 passed (12)\n');
    await expect(page.getByTestId('found-in-text')).toContainText('The text contradicts its own test summary');
    await expect(page.getByTestId('tests-passed')).toHaveValue(''); // still nothing applied
    await page.getByTestId('use-parsed-counts').click();
    await expect(page.getByTestId('tests-passed')).toHaveValue('10');
    await expect(page.getByTestId('tests-total')).toHaveValue('12');
  });

  test('failed attempts are kept and counted, and the report separates observed results, interpretation, limitations and next experiment', async ({ page }) => {
    await createLabExperiment(page);
    await recordRun(page, 'A', '6', '10');
    await recordRun(page, 'A', '7', '10');
    await recordRun(page, 'B', '9', '10');
    await page.getByRole('radio', { name: 'Failed' }).click();
    await page.getByTestId('run-condition').selectOption({ label: 'B - release-notes-checker' });
    await page.getByTestId('run-observations').fill('The model looped and I stopped it.');
    await page.getByTestId('save-run').click();
    await expect(page.getByTestId('run-list')).toContainText('Failed (kept)');
    await page.getByRole('tab', { name: 'Compare' }).click();
    await expect(page.getByTestId('comparison')).toContainText('1 failed, 0 abandoned (kept)');
    await expect(page.getByTestId('integrity-notes')).toContainText('Failed or abandoned attempts are kept and counted');
    await page.getByRole('tab', { name: 'Report & export' }).click();
    const [md] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-report').click()]);
    const report = await readFile((await md.path())!, 'utf8');
    for (const h of ['## Observed results', '## Interpretation', '## Limitations', '## Next experiment']) expect(report).toContain(h);
    expect(report).toContain('No significance test was computed');
  });

  test('an exported experiment imports only after a preview and confirmation, as a new experiment with user-imported values', async ({ page }) => {
    await createLabExperiment(page);
    await recordRun(page, 'A', '6', '10');
    await recordRun(page, 'B', '9', '10');
    await page.getByRole('tab', { name: 'Report & export' }).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-json').click()]);
    const buffer = await readFile((await dl.path())!);
    await goto(page, '/battle-lab');
    await page.getByTestId('import-experiment-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('nope') });
    await expect(page.getByText('Could not import that file')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByTestId('import-experiment-file').setInputFiles({ name: 'exp.json', mimeType: 'application/json', buffer });
    const preview = page.getByTestId('import-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('Nothing has been saved');
    await expect(preview).toContainText('Parsed');
    await expect(preview).toContainText('User-supplied');
    await expect(page.getByTestId('import-warnings')).toContainText('cannot verify any imported value');
    // nothing was saved yet
    await expect(page.getByTestId('experiment-list').locator('li')).toHaveCount(1);
    await page.getByTestId('confirm-import-experiment').click();
    await expect(page).toHaveURL(/#\/battle-lab\/exp_/);
    await expect(page.getByRole('heading', { level: 1, name: /\(imported\)/ })).toBeVisible();
    await expect(page.getByTestId('run-list')).toContainText('(user-imported)');
  });
});
