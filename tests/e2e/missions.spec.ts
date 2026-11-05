import { expect, test, type Page } from '@playwright/test';
import { DEV_CHANGES, truthFor as detTruth } from '../../src/fixtures/determinism/mission';
import { goto, startApp } from './helpers';

async function record(page: Page, caseId: string, cond: 'baseline' | 'v1', verdict: string, last = false) {
  await page.getByTestId(`open-dev-${cond}-${caseId}`).click();
  const box = page.getByTestId(`case-dev-${cond}-${caseId}`);
  await box.getByRole('radio', { name: verdict, exact: true }).click();
  if (cond === 'v1') await box.getByRole('radio', { name: 'Yes', exact: true }).click();
  await page.getByTestId(`save-${caseId}-${cond}`).click();
  await expect(page.getByTestId(`save-${caseId}-${cond}`)).toBeHidden();
  if (!last) await expect(box.getByText(`recorded: ${verdict}`)).toBeVisible();
}

test.describe('The four Improvement Loop missions', () => {
  test.beforeEach(async ({ page }) => { await startApp(page); await goto(page, '/loop'); });

  test('the hub lists all four missions; only the economy mission is the flagship', async ({ page }) => {
    for (const id of ['economy-balance-reviewer', 'phaser-performance-investigator', 'deterministic-simulation-reviewer', 'multi-agent-integration-auditor']) await expect(page.getByTestId(`mission-${id}`)).toBeVisible();
    await expect(page.getByTestId('mission-economy-balance-reviewer')).toContainText('Flagship');
    await expect(page.getByTestId('mission-phaser-performance-investigator')).not.toContainText('Flagship');
    await expect(page.getByTestId('mission-phaser-performance-investigator')).toContainText('Embergate cost-model fixture');
    await expect(page.getByTestId('mission-multi-agent-integration-auditor')).toContainText('Fabricated handoff packets');
  });

  test('Phaser Performance Investigator: its own vocabulary, no FPS promise, pack download, root-cause options', async ({ page }) => {
    await page.getByTestId('start-phaser-performance-investigator').click();
    await expect(page.getByTestId('step-title')).toHaveText('Phaser Performance Investigator');
    await expect(page.getByTestId('panel-mission')).toContainText('never by timing anything');
    await expect(page.getByTestId('panel-mission')).toContainText('does not measure frame time or FPS');
    await page.getByTestId('goto-baseline').click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-phaser-perf-dev').click()]);
    expect(dl.suggestedFilename()).toBe('forge-fixture-phaser-perf-dev.zip');
    await page.getByTestId('open-dev-baseline-scene-1').click();
    const box = page.getByTestId('case-dev-baseline-scene-1');
    await expect(box).toContainText('ROOT CAUSE: allocation | collision | draw-calls | display-list | update-logic | mixed');
    for (const o of ['allocation', 'collision', 'draw calls', 'display list', 'update logic', 'mixed', 'no usable root cause']) await expect(box.getByRole('radio', { name: o, exact: true })).toBeVisible();
    await expect(box.getByText('Task prompt')).toBeVisible();
    await expect(box).toContainText('scene-1');
  });

  test('Integration Auditor: decision options and packet wording', async ({ page }) => {
    await page.getByTestId('start-multi-agent-integration-auditor').click();
    await page.getByTestId('goto-baseline').click();
    await expect(page.getByTestId('panel-baseline')).toContainText('Handoff packet from');
    await page.getByTestId('open-dev-baseline-int-1').click();
    const box = page.getByTestId('case-dev-baseline-int-1');
    for (const o of ['merge', 'revise', 'block', 'no usable decision']) await expect(box.getByRole('radio', { name: o, exact: true })).toBeVisible();
    await expect(box).toContainText('packet-int-1/');
  });

  test('Deterministic Simulation Reviewer: baseline, freeze, test and grade, with its own wording throughout', async ({ page }) => {
    test.setTimeout(90_000);
    await page.getByTestId('start-deterministic-simulation-reviewer').click();
    await page.getByTestId('goto-baseline').click();
    const wrong = (id: string) => (detTruth(id)!.verdict === 'approve' ? 'reject' : 'approve');
    for (const [i, c] of DEV_CHANGES.entries()) await record(page, c.id, 'baseline', wrong(c.id), i === DEV_CHANGES.length - 1);
    await page.getByTestId('create-skill').click();
    await page.getByTestId('freeze-v1').click();
    await expect(page.getByTestId('step-title')).toContainText('Test Skill v1');
    for (const [i, c] of DEV_CHANGES.entries()) await record(page, c.id, 'v1', detTruth(c.id)!.verdict, i === DEV_CHANGES.length - 1);
    await page.getByTestId('grade-dev').click();
    await expect(page.getByTestId('eval-reading')).toContainText('verdicts matched the determinism harness');
    await expect(page.getByTestId('eval-reading')).toContainText('4 of 4');
    await expect(page.getByTestId('match-summary')).toContainText('determinism harness says');
    await expect(page.getByTestId('match-summary')).toContainText('mismatch');
  });
});
