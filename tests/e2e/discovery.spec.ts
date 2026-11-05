import { expect, test } from '@playwright/test';
import { goto, startApp } from './helpers';

test.describe('Discovery', () => {
  test.beforeEach(async ({ page }) => { await startApp(page); await goto(page, '/discovery'); });

  test('9. searching finds the right Skill', async ({ page }) => {
    await page.getByTestId('catalog-search').fill('superpowers');
    await expect(page.getByTestId('result-count')).toHaveText(/1 of 23 entries/);
    await expect(page.getByTestId('entry-obra-superpowers')).toBeVisible();
    await page.getByTestId('catalog-search').fill('zzzznothing');
    await expect(page.getByText('No entries match')).toBeVisible();
    await page.getByTestId('clear-filters').click();
    await expect(page.getByTestId('result-count')).toHaveText(/23 of 23/);
  });

  test('10. filtering by integration type works', async ({ page }) => {
    await page.getByLabel('MCP server').check();
    await expect(page.getByTestId('result-count')).toHaveText(/2 of 23/);
    await expect(page.getByTestId('entry-playwright-mcp')).toBeVisible();
    await expect(page.getByTestId('entry-mcp-reference-servers')).toBeVisible();
    await expect(page.getByTestId('entry-obra-superpowers')).toHaveCount(0);
    await page.getByLabel('MCP server').uncheck();
    await page.getByLabel('Custom (proposed)').check();
    await expect(page.getByTestId('result-count')).toHaveText(/3 of 23/);
  });

  test('11. a detail page shows provenance, unknowns and installation with its source', async ({ page }) => {
    await page.getByTestId('open-entry-playwright-mcp').click();
    await expect(page.getByRole('heading', { level: 1, name: 'microsoft/playwright-mcp' })).toBeVisible();
    const prov = page.getByTestId('provenance');
    await expect(prov).toContainText('https://github.com/microsoft/playwright-mcp');
    await expect(prov).toContainText('2026-11-05');
    await expect(prov.getByText('Last commit').locator('..')).toContainText('unknown');
    await expect(page.getByTestId('install-info')).toContainText('claude mcp add playwright npx @playwright/mcp@latest');
    await expect(page.getByTestId('install-info')).toContainText('never executed by Claude Forge');
    await expect(page.getByTestId('missing-checks')).toContainText('Pin and record a tested version');
    const link = page.getByTestId('provenance').getByRole('link').first();
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('a proposed custom entry never shows an install command', async ({ page }) => {
    await goto(page, '/discovery/custom-merge-chain-debugger');
    await expect(page.getByText('No installation command is shown')).toBeVisible();
    await expect(page.getByTestId('provenance')).toContainText('None - this is a proposal');
  });

  test('12 & 13. adding to the Arsenal works, keeps trust steps separate, and survives a reload', async ({ page }) => {
    await goto(page, '/discovery/obra-superpowers');
    await page.getByTestId('add-evaluating').click();
    await expect(page.getByTestId('arsenal-status')).toHaveValue('evaluating');
    await page.getByLabel('Inspected').check();
    await page.getByLabel('Installed (declared)').check();
    await expect(page.getByText('Installed” is your statement, not a verified fact', { exact: false })).toBeVisible();
    await page.getByTestId('personal-relevance').selectOption('3');
    await page.getByTestId('personal-notes').fill('Read systematic-debugging first');
    await page.getByTestId('personal-notes').blur();

    // mastery cannot be claimed by clicking
    await page.getByTestId('arsenal-status').selectOption('mastered');
    await expect(page.getByText('Mastered needs evidence')).toBeVisible();
    await expect(page.getByTestId('arsenal-status')).toHaveValue('evaluating');

    await page.reload();
    await expect(page.getByTestId('arsenal-status')).toHaveValue('evaluating');
    await expect(page.getByLabel('Inspected')).toBeChecked();
    await expect(page.getByLabel('Approved')).not.toBeChecked();
    await expect(page.getByLabel('Installed (declared)')).toBeChecked();
    await expect(page.getByTestId('personal-notes')).toHaveValue('Read systematic-debugging first');
    await expect(page.getByTestId('personal-relevance')).toHaveValue('3');
    await goto(page, '/arsenal');
    await expect(page.getByTestId('arsenal-obra-superpowers')).toContainText('Project relevance (yours): 3');
    await expect(page.getByTestId('arsenal-obra-superpowers')).toContainText('installed (declared)');
    await expect(page.getByTestId('arsenal-obra-superpowers')).toContainText('not approved');
  });

  test('a user-added candidate is clearly local and unverified', async ({ page }) => {
    await page.getByTestId('add-candidate').click();
    await page.getByLabel('Name', { exact: true }).fill('some-random-skill');
    await page.getByLabel('Source link (https, optional)').fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Save candidate' }).click();
    await expect(page.getByText('Use a full https:// link')).toBeVisible();
    await page.getByLabel('Source link (https, optional)').fill('https://example.com/skill');
    await page.getByRole('button', { name: 'Save candidate' }).click();
    await expect(page.getByText('local · unverified')).toBeVisible();
    await page.getByRole('link', { name: 'some-random-skill' }).click();
    await expect(page.getByText('Local and unverified')).toBeVisible();
  });
});
