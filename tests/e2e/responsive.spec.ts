import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, goto, startApp } from './helpers';

const WIDTHS = [375, 390, 768, 1280, 1440];
const ROUTES = [
  '/', '/academy', '/academy/lesson/L01-skill-or-tool', '/academy/lesson/L04-skill-autopsy', '/academy/lesson/L06-merge-chain-failure', '/academy/lesson/L07-economy-inflation',
  '/academy/lesson/L19-structured-outputs-tool-calling', '/academy/lesson/L22-retrieval-augmented-generation', '/playbooks', '/transfer', '/explore',
  '/loop', '/discovery', '/discovery/playwright-mcp', '/workshop', '/battle-lab', '/battle-lab/demo-merge-cascade', '/arsenal', '/growth', '/settings', '/search?q=skill', '/more',
  // Round 5 and 6 surfaces
  '/pilot', '/challenges', '/challenges/agent', '/pathways', '/pathways/trustworthy-research', '/library', '/library/new', '/practice', '/practice/mixed-injection-mcp',
  '/academy/lesson/L25-agent-permissions-least-privilege', '/academy/lesson/L26-hooks-guardrails-deterministic-gates',
];

for (const width of WIDTHS) {
  test.describe(`viewport ${width}px`, () => {
    test.use({ viewport: { width, height: width < 800 ? 800 : 900 } });

    test(`no horizontal overflow on any primary route`, async ({ page }) => {
      await startApp(page);
      for (const r of ROUTES) {
        await goto(page, r);
        await expect(page.locator('main h1, main h2').first()).toBeVisible();
        await page.waitForTimeout(150);
        await expectNoHorizontalOverflow(page);
      }
    });

    test('navigation adapts: bottom bar on small screens, sidebar on large ones', async ({ page }) => {
      await startApp(page);
      if (width < 1024) {
        await expect(page.getByRole('navigation', { name: 'Primary mobile' })).toBeVisible();
        await expect(page.getByRole('navigation', { name: 'Primary', exact: true })).toBeHidden();
        const boxes = await page.getByRole('navigation', { name: 'Primary mobile' }).getByRole('link').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
        for (const b of boxes) { expect(b.height).toBeGreaterThanOrEqual(44); expect(b.width).toBeGreaterThanOrEqual(44); }
        await page.getByTestId('mnav-more').click();
        await expect(page.getByRole('heading', { level: 1, name: 'More' })).toBeVisible();
        await page.getByTestId('more-workshop').click();
        await expect(page.getByRole('heading', { level: 1, name: 'Build a Skill you can trust' })).toBeVisible();
      } else {
        await expect(page.getByRole('navigation', { name: 'Primary', exact: true })).toBeVisible();
        await expect(page.getByRole('navigation', { name: 'Primary mobile' })).toBeHidden();
        await page.getByTestId('nav-battle-lab').click();
        await expect(page.getByRole('heading', { level: 1, name: 'Compare workflows with evidence' })).toBeVisible();
      }
    });
  });
}

for (const width of [375, 390, 768, 1280]) {
  test.describe(`deep pages at ${width}px`, () => {
    test.use({ viewport: { width, height: 850 } });

    test('lesson stages, Workshop editor tabs and experiment tabs never overflow horizontally', async ({ page }) => {
      await startApp(page);
      for (const id of ['L02-inside-skill-md', 'L04-skill-autopsy', 'L06-merge-chain-failure', 'L07-economy-inflation', 'L09-reviewer-vs-builder']) {
        await goto(page, `/academy/lesson/${id}`);
        for (const tab of [/1 · Learn/, /2 · Practice/, /3 · Assess/, /4 · Apply/]) {
          await page.getByRole('tab', { name: tab }).click();
          await page.waitForTimeout(120);
          await expectNoHorizontalOverflow(page);
        }
        await page.getByRole('tab', { name: /3 · Assess/ }).click();
        await page.getByTestId('confidence-3').click();
        await page.getByTestId('start-assessment').click();
        await expectNoHorizontalOverflow(page);
      }

      await goto(page, '/workshop');
      await page.getByTestId('new-starter').click();
      for (const tab of ['Basics', 'Instructions', 'Resources', 'Scenarios & Dojo', 'Trigger tuning', 'Validate', 'Quality review', 'Preview', 'Live test', 'Export & history']) {
        await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
        await page.waitForTimeout(120);
        await expectNoHorizontalOverflow(page);
      }

      // Improvement Loop: stepper, mission briefing, baseline case form, and a comparison-free Build step
      await goto(page, '/loop');
      await expectNoHorizontalOverflow(page);
      await page.getByTestId('start-economy-balance-reviewer').click();
      await expectNoHorizontalOverflow(page);
      await page.getByTestId('goto-baseline').click();
      await page.getByTestId('open-dev-baseline-dev-1').click();
      await expectNoHorizontalOverflow(page);
      await goto(page, '/academy/diagnostic');
      await expectNoHorizontalOverflow(page);
      await goto(page, '/workshop');
      await expectNoHorizontalOverflow(page);

      await goto(page, '/battle-lab');
      await page.getByTestId('new-experiment').click();
      await expectNoHorizontalOverflow(page);
      await page.getByTestId('exp-title').fill('Overflow check');
      await page.getByTestId('exp-hypothesis').fill('h');
      await page.getByTestId('cond-skill-1').fill('s');
      await page.getByTestId('cond-diff-1').fill('d');
      await page.getByTestId('create-experiment').click();
      for (const tab of ['Setup', 'Record runs', 'Compare', 'Report & export']) {
        await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
        await page.waitForTimeout(120);
        await expectNoHorizontalOverflow(page);
      }
      for (const id of ['anthropics-skills', 'obra-superpowers', 'mcp-reference-servers', 'custom-merge-chain-debugger']) {
        await goto(page, `/discovery/${id}`);
        await expect(page.getByTestId('provenance')).toBeVisible();
        await expectNoHorizontalOverflow(page);
      }
    });
  });
}

test.describe('experiment views stack on mobile', () => {
  test.use({ viewport: { width: 375, height: 800 } });
  test('comparison cards replace the wide table', async ({ page }) => {
    await startApp(page);
    await goto(page, '/battle-lab/demo-merge-cascade');
    await expect(page.getByTestId('comparison').locator('table').first()).toBeHidden();
    await expect(page.getByTestId('comparison').locator('li').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
