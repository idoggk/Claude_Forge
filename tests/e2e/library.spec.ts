import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { expectNoHorizontalOverflow, goto, startApp } from './helpers';

test.describe('My AI library', () => {
  test('empty state, a hypothesis, refused upgrades, an honest upgrade after a real challenge run, history and exports', async ({ page }) => {
    await startApp(page);
    await goto(page, '/library');
    await expect(page.getByText('No takeaways yet')).toBeVisible();

    await page.getByTestId('new-takeaway').first().click();
    await page.getByTestId('tk-title').fill('Examples fix my commit format');
    await page.getByTestId('tk-statement').fill('Three worked examples made the commit messages follow our format.');
    await page.getByTestId('tk-save').click();
    await expect(page.getByText('Takeaway saved').first()).toBeVisible();
    await expect(page).toHaveURL(/#\/library\/tk_/);

    // raising it without a reason or a reference is refused
    await page.getByTestId('tk-confidence').selectOption('applied-to-real-work');
    await page.getByTestId('tk-save').click();
    await expect(page.getByRole('alert')).toContainText('Say in your own words');
    await expect(page.getByRole('alert')).toContainText('transfer task you have completed');
    await page.getByTestId('tk-confidence').selectOption('evaluated-on-fixtures');
    await page.getByTestId('tk-note').fill('Judged on the fixed extraction cases.');
    await page.getByTestId('tk-save').click();
    await expect(page.getByRole('alert')).toContainText('Lab report or a challenge');

    // do the challenge for real, save the run, then reference it
    await goto(page, '/challenges/research');
    for (const o of ['quote-in-source', 'numbers-match', 'newer-source-exists', 'vendor-only-performance', 'scope-words']) await page.getByTestId(`opt-${o}`).check();
    await page.getByTestId('challenge-submit').click();
    await page.getByTestId('challenge-save').click();
    await expect(page.getByTestId('challenge-save')).toHaveText('Saved');
    await goto(page, '/library');
    await page.getByRole('link', { name: 'Open and edit' }).click();
    await page.getByTestId('tk-confidence').selectOption('evaluated-on-fixtures');
    await page.getByTestId('tk-note').fill('Judged on the fixed research cases.');
    await page.getByTestId('ref-kind').selectOption('challenge');
    await page.getByTestId('ref-id').selectOption('research');
    await page.getByTestId('ref-add').click();
    await expect(page.getByTestId('tk-refs-list')).toContainText('Research reliability');
    await page.getByTestId('tk-save').click();
    await expect(page.getByText('Takeaway saved').first()).toBeVisible();
    await expect(page.getByTestId('tk-history')).toContainText('Hypothesis → Evaluated on fixtures');

    // list shows the label and both exports carry it
    await goto(page, '/library');
    await expect(page.getByTestId('takeaway-list')).toContainText('Evaluated on fixtures');
    const [md] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-md').click()]);
    const text = await readFile((await md.path())!, 'utf8');
    expect(text).toContain('Evaluated on fixtures');
    expect(text).toContain('Challenge: Research reliability');
    const [js] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-json').click()]);
    const json = JSON.parse(await readFile((await js.path())!, 'utf8'));
    expect(json.takeaways[0].confidence).toBe('evaluated-on-fixtures');

    // lowering is always allowed
    await page.getByRole('link', { name: 'Open and edit' }).click();
    await page.getByTestId('tk-confidence').selectOption('hypothesis');
    await page.getByTestId('tk-save').click();
    await expect(page.getByText('Takeaway saved').first()).toBeVisible();
  });

  for (const w of [375, 1280]) {
    test(`no serious axe violations and no overflow at ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await startApp(page);
      await goto(page, '/library/new');
      await page.getByTestId('tk-title').fill('A takeaway');
      await page.getByTestId('tk-statement').fill('Something I learned.');
      await page.getByTestId('tk-save').click();
      for (const route of ['/library', page.url().split('#')[1]!]) {
        await goto(page, route);
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${route}: ${v.id} ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
        await expectNoHorizontalOverflow(page);
      }
    });
  }
});
