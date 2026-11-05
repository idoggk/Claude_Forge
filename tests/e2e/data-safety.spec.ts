import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { goto, startApp, takeL01Assessment } from './helpers';

const tmp = (name: string) => join(tmpdir(), `forge-e2e-${Date.now()}-${name}`);

test.describe('Data safety', () => {
  test.beforeEach(async ({ page }) => { await startApp(page); });

  test('25 & 26. a malformed import is rejected and existing data stays intact', async ({ page }) => {
    await takeL01Assessment(page);
    await goto(page, '/discovery/playwright-mcp');
    await page.getByTestId('add-interested').click();
    await expect(page.getByTestId('arsenal-status')).toHaveValue('interested');

    await goto(page, '/settings');
    for (const [name, content, expected] of [
      ['not-json.json', '{oops', 'not valid JSON'],
      ['wrong-format.json', JSON.stringify({ format: 'other', version: 1, data: {} }), 'Not a Claude Forge backup'],
      ['future.json', JSON.stringify({ format: 'claude-forge-backup', version: 99, data: {} }), 'Update the app before importing'],
      ['array.json', '[1,2,3]', 'expected a JSON object'],
    ] as const) {
      const path = tmp(name);
      writeFileSync(path, content);
      await page.getByTestId('import-file').setInputFiles(path);
      await expect(page.getByTestId('import-error')).toContainText(expected);
      await expect(page.getByTestId('do-import')).toHaveCount(0);
    }

    // nothing changed
    await goto(page, '/growth');
    await expect(page.getByTestId('attempt-history')).toContainText('Skill or Tool?');
    await expect(page.getByTestId('comp-mechanism-selection')).toContainText('Independent application');
    await goto(page, '/arsenal');
    await expect(page.getByTestId('arsenal-playwright-mcp')).toBeVisible();
  });

  test('a backup with some invalid records is previewed, refused as-is, and never corrupts existing data', async ({ page }) => {
    await takeL01Assessment(page);
    await goto(page, '/settings');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-backup').click()]);
    const backup = JSON.parse(readFileSync((await dl.path())!, 'utf8'));
    expect(backup.format).toBe('claude-forge-backup');
    expect(backup.version).toBe(1);
    backup.data.attempts[0].score = 'banana';
    const path = tmp('partial.json');
    writeFileSync(path, JSON.stringify(backup));
    await page.getByTestId('import-file').setInputFiles(path);
    await expect(page.getByTestId('import-preview')).toContainText('failed validation');
    await expect(page.getByTestId('invalid-list')).toContainText('attempts[0]');
    await expect(page.getByTestId('do-import')).toBeDisabled();
    await goto(page, '/growth');
    await expect(page.getByTestId('attempt-history')).toContainText('100%');
  });

  test('27. export → delete everything → restore preserves meaningful progress', async ({ page }) => {
    await takeL01Assessment(page, { confidence: 4 });
    await goto(page, '/discovery/obra-superpowers');
    await page.getByTestId('add-evaluating').click();
    await page.getByLabel('Inspected').check();

    await goto(page, '/settings');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-backup').click()]);
    const file = tmp('restore.json');
    writeFileSync(file, readFileSync((await dl.path())!));

    await page.getByLabel('Type DELETE to enable').fill('DELETE');
    await page.getByTestId('reset-all').click();
    await expect(page).toHaveURL(/#\/onboarding/);
    await goto(page, '/growth');
    await expect(page).toHaveURL(/#\/onboarding/);

    await goto(page, '/settings');
    await page.getByTestId('import-file').setInputFiles(file);
    await expect(page.getByTestId('import-preview')).toContainText('Every record passed validation');
    await page.getByTestId('do-import').click();
    await expect(page.getByTestId('import-done')).toContainText('Imported');

    await goto(page, '/growth');
    await expect(page.getByTestId('attempt-history')).toContainText('Skill or Tool?');
    await expect(page.getByTestId('comp-mechanism-selection')).toContainText('Independent application');
    await expect(page.getByTestId('calibration-summary')).toContainText('1');
    await goto(page, '/arsenal');
    await expect(page.getByTestId('arsenal-obra-superpowers')).toContainText('inspected');
    await goto(page, '/');
    await expect(page.getByTestId('mission-title')).toHaveText('Inside SKILL.md');
    await page.reload();
    await expect(page.getByTestId('mission-title')).toHaveText('Inside SKILL.md');
  });
});
