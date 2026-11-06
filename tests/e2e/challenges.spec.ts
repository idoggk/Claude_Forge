import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, goto, startApp } from './helpers';

const REF: Record<string, { opts: string[]; ans: Record<string, string> }> = {
  extraction: { opts: ['schema-types', 'quote-in-source', 'sum-check', 'ambiguous-date-guard', 'rederive-quantities', 'date-iso'], ans: { po: 'quote-in-source', harm: 'invent' } },
  research: { opts: ['quote-in-source', 'numbers-match', 'newer-source-exists', 'vendor-only-performance', 'scope-words'], ans: { numbers: 'number-drift', age: 'old-ok' } },
  agent: { opts: ['repeat-guard', 'error-handling', 'claim-needs-evidence', 'path-allowlist', 'step-budget'], ans: { evidence: 'tool' } },
  context: { opts: ['c-annual-new', 'c-monthly', 'c-process', 'say-unknown', 'order:newest-first'], ans: { inject: 'data-not-orders', keyword: 'nothing' } },
};

test.describe('Challenges', () => {
  test('the list shows four real challenges, each opens', async ({ page }) => {
    await startApp(page);
    await goto(page, '/challenges');
    await expect(page.getByTestId('challenge-list').locator('li')).toHaveCount(4);
    for (const id of Object.keys(REF)) {
      await page.getByTestId(`challenge-open-${id}`).click();
      await expect(page.getByTestId(`challenge-${id}`)).toBeVisible();
      await page.goBack();
    }
  });

  for (const [id, ref] of Object.entries(REF)) {
    test(`${id}: hints, reference, a wrong attempt, a passing attempt, and a saved run`, async ({ page }) => {
      await startApp(page);
      await goto(page, `/challenges/${id}`);
      await page.getByTestId('challenge-hint').click();
      await expect(page.getByTestId('challenge-hints').locator('li')).toHaveCount(1);
      await page.getByTestId('challenge-reference-toggle').click();
      await expect(page.getByTestId('challenge-reference')).toBeVisible();
      // an empty attempt is not a pass
      await page.getByTestId('challenge-submit').click();
      await expect(page.getByTestId('challenge-result')).toBeVisible();
      await expect(page.getByTestId('challenge-result')).toContainText('Not yet');
      // the reference attempt passes
      for (const o of ref.opts) await page.getByTestId(`opt-${o}`).check();
      for (const [q, a] of Object.entries(ref.ans)) await page.getByTestId(`ans-${q}-${a}`).check();
      await page.getByTestId('challenge-submit').click();
      await expect(page.getByTestId('challenge-result')).not.toContainText('Not yet');
      await page.getByTestId('challenge-save').click();
      await expect(page.getByTestId('challenge-save')).toHaveText('Saved');
      await goto(page, '/challenges');
      await expect(page.getByTestId(`challenge-card-${id}`)).toContainText('1 run');
      // practice never creates mastery evidence
      await goto(page, '/growth');
      await expect(page.getByTestId('attempt-history')).toHaveCount(0);
    });
  }

  test('selecting every validator is not a pass (extraction)', async ({ page }) => {
    await startApp(page);
    await goto(page, '/challenges/extraction');
    const boxes = page.getByTestId('group-validators').getByRole('checkbox');
    await expect(boxes.first()).toBeVisible();
    const n = await boxes.count();
    for (let i = 0; i < n; i++) await boxes.nth(i).check();
    await expect(page.getByText('Too many selected')).toBeVisible();
    await expect(page.getByTestId('challenge-submit')).toBeDisabled();
  });

  for (const w of [375, 1280]) {
    test(`no serious axe violations and no overflow at ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await startApp(page);
      for (const id of ['', ...Object.keys(REF)]) {
        await goto(page, `/challenges${id ? `/${id}` : ''}`);
        if (id) { await page.getByTestId('challenge-submit').click(); await page.getByTestId('challenge-reference-toggle').click(); await page.getByTestId('challenge-fixture').locator('summary').click(); }
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${id}: ${v.id} ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
        await expectNoHorizontalOverflow(page);
      }
    });
  }
});
