import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { expectNoHorizontalOverflow, goto, startApp } from './helpers';

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

test.describe('Round 4: real-world transfer tasks', () => {
  test.beforeEach(async ({ page }) => { await startApp(page); });

  test('a plan is never a result: completion needs criteria, observations, evidence and a reflection, and the record exports as Markdown', async ({ page }) => {
    await goto(page, '/academy/lesson/L20-few-shot-prompting');
    await page.getByRole('tab', { name: /Apply/ }).click();
    await page.getByTestId('lesson-transfer').click();
    await expect(page).toHaveURL(/#\/transfer\?source=lesson/);
    await expect(page.getByTestId('tt-source-id')).toHaveValue('L20-few-shot-prompting');
    await page.getByTestId('tt-title').fill('Few-shot examples for my commit-message prompt');
    await page.getByTestId('tt-kind').selectOption('prompt-technique');
    await page.getByTestId('tt-create').click();
    await expect(page.getByTestId('transfer-editor')).toBeVisible();
    // placeholders guide but never pre-fill
    await expect(page.getByTestId('tt-f-problem')).toHaveValue('');
    await expect(page.getByTestId('tt-f-problem')).toHaveAttribute('placeholder', /recurring task/);
    // a full plan is still not complete
    await page.getByTestId('tt-f-target').fill('my-side-project (private)');
    await page.getByTestId('tt-f-problem').fill('Commit messages come out in five different styles.');
    await page.getByTestId('tt-f-current').fill('A one-line instruction with no examples.');
    await page.getByTestId('tt-f-proposed').fill('Add three examples and one deliberately wrong example labelled as such.');
    await page.getByTestId('tt-f-benefit').fill('Fewer rewrites.');
    await page.getByTestId('tt-f-criteria').fill('Nine of ten past diffs give the house style with no retry.');
    await page.getByTestId('tt-save').click();
    await expect(page.getByText('Unsaved changes')).toHaveCount(0);
    await expect(page.getByTestId('tt-complete')).toBeDisabled();
    await expect(page.getByTestId('tt-completion')).toContainText('Observations recorded');
    // observations + evidence + reflection unlock it
    await page.getByTestId('tt-f-observations').fill('On ten past diffs, seven matched the style. Two copied the wrong example. One was fine but long.');
    await page.getByTestId('tt-ev-text').fill('Commit abc1234 contains the updated prompt; results table in my notes.');
    await page.getByTestId('tt-ev-add').click();
    await expect(page.getByTestId('tt-complete')).toBeDisabled(); // still no reflection
    await page.getByTestId('tt-f-reflection').fill('Seven of ten is below my bar. The wrong example leaked into two outputs, so I would drop it or label it harder.');
    await page.getByTestId('tt-f-next').fill('Re-run with the negative example removed on a different ten diffs.');
    await page.getByTestId('tt-complete').click();
    await expect(page.getByTestId('tt-completion')).toContainText('Marked complete');
    await expect(page.getByTestId('tt-completion')).toContainText('your own declaration');
    await expect(page.getByTestId('tt-completion')).toContainText('does not change any competency level');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('tt-export').click()]);
    const md = await readFile((await dl.path())!, 'utf8');
    for (const h of ['## Problem', '## Current workflow', '## Proposed improved workflow', '## Expected benefit', '## Verification criteria', '## Risks', '## Observations', '## Evidence (author-described)', '## Reflection', '## Next improvement']) expect(md).toContain(h);
    expect(md).toContain('Claude Forge did not read the target project');
    // it survives a reload
    await page.reload();
    await expect(page.getByTestId('tt-f-title')).toHaveValue('Few-shot examples for my commit-message prompt');
    await expect(page.getByTestId('tt-completion')).toContainText('Marked complete');
  });

  test('a playbook-sourced task can record a self-reported real-work result on the playbook, which raises maturity to "Applied to real work" without touching fixture evidence', async ({ page }) => {
    await goto(page, '/playbooks');
    await page.getByTestId('use-seed-release-notes').click();
    const pbUrl = page.url();
    const pbId = pbUrl.split('/').pop()!;
    await goto(page, `/transfer?source=playbook&id=${pbId}`);
    await page.getByTestId('tt-title').fill('Use the release-notes playbook on the next real release');
    await page.getByTestId('tt-kind').selectOption('automation');
    await page.getByTestId('tt-create').click();
    await page.getByTestId('tt-f-criteria').fill('Every PR number appears exactly once in the draft, checked by the script.');
    await page.getByTestId('tt-f-observations').fill('Ran steps 1 to 4 on the 1.4 release. The coverage script found two missing PR numbers and the retry fixed one.');
    await page.getByTestId('tt-ev-text').fill('Release 1.4 draft and coverage script output kept in my notes.');
    await page.getByTestId('tt-ev-add').click();
    await page.getByTestId('tt-f-reflection').fill('The gate caught a real omission. One PR needed a manual edit, so the retry limit mattered.');
    await page.getByTestId('tt-complete').click();
    await expect(page.getByTestId('tt-completion')).toContainText('Marked complete');
    await page.getByTestId('tt-push-result').click();
    await expect(page.getByTestId('tt-push-result')).toContainText('Recorded');
    await goto(page, `/playbooks/${pbId}`);
    await expect(page.getByTestId('maturity-card')).toContainText('Applied to real work');
    await expect(page.getByTestId('maturity-card')).toContainText('Fixture evaluation is incomplete');
  });
});

test.describe('Round 4: accessibility and small screens on the new surfaces', () => {
  for (const width of [375, 1280]) {
    test(`evidence panel, transfer editor and import preview have no serious axe violations and no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 850 });
      await startApp(page);
      const audit = async (label: string) => {
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(bad.map((v) => `${label}: ${v.id} ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
        await expectNoHorizontalOverflow(page);
      };
      // playbook with a linked, judged experiment
      await goto(page, '/playbooks');
      await page.getByTestId('use-seed-release-notes').click();
      let box = await openStepEvidence(page, 2);
      await box.getByTestId('new-exp-2').click();
      await page.getByTestId('exp-hypothesis').fill('With the Skill more runs pass all tests. I would change my mind if ranges overlap.');
      await page.getByTestId('cond-skill-1').fill('release-notes-checker');
      await page.getByTestId('cond-diff-1').fill('release-notes-checker Skill enabled; nothing else differs');
      await page.getByTestId('create-experiment').click();
      await expect(page).toHaveURL(/#\/battle-lab\/exp_/);
      await recordRun(page, 'A', '6', '10');
      await recordRun(page, 'A', '7', '10');
      await recordRun(page, 'B', '9', '10');
      await recordRun(page, 'B', '10', '10');
      await audit('experiment record tab');
      await page.getByRole('tab', { name: 'Setup' }).click();
      await audit('experiment setup with playbook links');
      await page.getByTestId('playbook-links-card').getByRole('link').first().click();
      box = await openStepEvidence(page, 2);
      await expect(box).toContainText('This evidence is stale');
      await audit('playbook with stale evidence open');
      await box.getByRole('button', { name: /Reassess against the current step/ }).click();
      await box.getByText(/Is this evidence suitable/).click();
      await audit('playbook with review form open');
      await page.getByTestId('save-evaluation').click();
      await expect(page.getByTestId('evaluation-list')).toBeVisible();
      await audit('evaluation card');
      // transfer editor
      await goto(page, '/transfer');
      await page.getByTestId('tt-create').click();
      await expect(page.getByTestId('transfer-editor')).toBeVisible();
      await audit('transfer editor');
      // import preview
      await goto(page, '/battle-lab');
      await page.getByTestId('import-experiment-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('nope') });
      await expect(page.getByText('Could not import that file')).toBeVisible();
      await audit('import error');
    });
  }
});
