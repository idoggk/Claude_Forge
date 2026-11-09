import AxeBuilder from '@axe-core/playwright';
import { COMPETENCIES } from '../../src/domain/curriculum/competencies';
import { expect, test, type Page } from '@playwright/test';
import { LESSONS } from '../../src/content/lessons/index';
import { TRACKS } from '../../src/domain/curriculum/competencies';
import { expectNoHorizontalOverflow, goto, startApp, takeL01Assessment } from './helpers';

const WIDTHS = [375, 390, 768, 1280, 1440];
const SHOTS = process.env.HOME_SHOTS; // optional: save screenshots of every state and width for review
const planned = TRACKS.reduce((a, t) => a + t.topics.filter((x) => !x.lessonId).length, 0);

async function shot(page: Page, name: string) { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); }

async function audit(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${label}: ${v.id} ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
}

test.describe('Home: first-time user', () => {
  test('onboarding is a compact branded hero with a clear explanation, a prominent start action, the four paths and optional profile', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/onboarding/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Become genuinely good at using AI');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const intro = page.getByTestId('home-hero');
    await expect(intro).toContainText(`${LESSONS.length} lessons exist today across ${TRACKS.length} tracks`);
    await expect(intro).toContainText(`${planned} more topics are planned`);
    await expect(page.getByTestId('onboard-diagnostic')).toBeVisible();
    // four paths, each with a REAL lesson count and no progress or percentage yet; no links before onboarding is finished
    const paths = page.getByTestId('home-paths');
    await expect(paths.locator('li[data-testid^="path-"]')).toHaveCount(4);
    let total = 0;
    for (const id of ['ai-engineering', 'game-development', 'agents-automation', 'research-verification']) {
      const t = await page.getByTestId(`path-count-${id}`).textContent();
      expect(t, id).toMatch(/^\d+ lessons? available$/);
      total += Number(t!.match(/^(\d+)/)![1]);
    }
    expect(total).toBe(LESSONS.length);
    await expect(paths.getByRole('progressbar')).toHaveCount(0);
    await expect(paths.getByRole('link')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(/\d+\s?%/);
    await expect(page.getByTestId('path-ai-engineering')).toContainText('more topics planned');
    // profile and interests are optional and below
    await expect(page.getByText('Optional: tune your plan')).toBeVisible();
    await expect(page.getByLabel('Game development workflows')).not.toBeChecked();
  });

  test('"Take the diagnostic" saves the (empty) profile and opens the diagnostic; the app does not bounce back to onboarding', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Game development workflows').check();
    await page.getByTestId('onboard-diagnostic').click();
    await expect(page).toHaveURL(/#\/academy\/diagnostic/);
    await goto(page, '/');
    await expect(page.getByRole('heading', { level: 1, name: 'Mission Control' })).toBeVisible();
  });

  test('the first-run Home explains the product with real numbers, offers the diagnostic and the first mission, and shows no invented progress', async ({ page }) => {
    await startApp(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Mission Control' })).toBeVisible();
    await expect(page.getByTestId('home-intro')).toContainText(`${LESSONS.length} lessons across ${TRACKS.length} tracks`);
    await expect(page.getByTestId('home-diagnostic')).toBeVisible();
    await expect(page.getByTestId('next-mission')).toBeVisible();
    await expect(page.getByTestId('mission-title')).toHaveText('Skill or Tool?');
    await expect(page.getByTestId('home-paths').locator('li[data-testid^="path-"]')).toHaveCount(4);
    await expect(page.getByTestId('home-paths').getByRole('progressbar')).toHaveCount(0);
    // empty panels are hidden, not shown as zeros
    await expect(page.getByTestId('home-competency')).toHaveCount(0);
    await expect(page.getByTestId('home-goals')).toHaveCount(0);
    await expect(page.getByTestId('due-reviews')).toHaveCount(0);
    await expect(page.getByTestId('home-lab')).toContainText('Run your first real AI experiment');
    await expect(page.locator('main')).not.toContainText(/\d+\s?%/);
    await page.getByTestId('home-lab').getByRole('link', { name: 'Run your first real AI experiment' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Run Your First Real AI Experiment' })).toBeVisible();
  });
});

test.describe('Home: returning user', () => {
  test('shows the next mission with its reasons, reviews, goals, verified progress with denominators, path progress and quick access, all from stored data', async ({ page }) => {
    await startApp(page);
    await takeL01Assessment(page, { confidence: 4 });
    await goto(page, '/');
    await expect(page.getByTestId('home-status')).toContainText(`1 of ${LESSONS.length} lessons passed`);
    await expect(page.getByTestId('next-mission')).toBeVisible();
    await expect(page.getByTestId('mission-reasons')).toBeVisible();
    await expect(page.getByTestId('primary-action')).toBeVisible();
    // reviews and goals are present for a returning user
    await expect(page.getByTestId('no-reviews')).toContainText('Next review');
    await expect(page.getByTestId('home-goals')).toContainText('No goals yet');
    // path progress is a count of real lessons with its denominator, and the bar agrees
    const eng = page.getByTestId('path-count-ai-engineering');
    await expect(eng).toHaveText(/^1 of \d+ lessons passed/);
    const denominator = Number((await eng.textContent())!.match(/of (\d+)/)![1]);
    const bar = page.getByTestId('path-ai-engineering').getByRole('progressbar');
    await expect(bar).toHaveAttribute('aria-valuenow', '1');
    await expect(bar).toHaveAttribute('aria-valuemax', String(denominator));
    await expect(page.getByTestId('path-count-game-development')).toHaveText(/^0 of \d+ lessons passed/);
    // verified competency progress states its denominator and only lists competencies with evidence
    await expect(page.getByTestId('home-competency-count')).toHaveText(new RegExp(`^\\d+ of ${COMPETENCIES.length} competencies have graded evidence`));
    await expect(page.getByTestId('home-competency')).toContainText('Mechanism selection');
    // quick access
    for (const name of ['Skill Workshop', 'Playbooks', 'Real-world tasks', 'AI Lab']) await expect(page.getByTestId('home-lab').getByRole('link', { name: new RegExp(name) }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('home-status')).toContainText(`1 of ${LESSONS.length} lessons passed`);
  });

  test('a path card opens a real lesson, and the existing navigation still works', async ({ page }) => {
    await startApp(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByTestId('path-open-game-development').click();
    await expect(page).toHaveURL(/#\/academy\/lesson\/L0[67]/);
    for (const [id, h] of [['nav-explore', 'AI Capability Map'], ['nav-playbooks', 'AI Workflow Playbooks'], ['nav-battle-lab', 'Compare workflows with evidence']] as const) {
      await page.getByTestId(id).click();
      await expect(page.getByRole('heading', { level: 1, name: h })).toBeVisible();
    }
  });
});

test.describe('Home: artwork, layout and accessibility', () => {
  test('artwork is decorative, loads from the configured base path, is hidden on phones and never downloaded there', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await startApp(page);
    const hero = page.locator('img[src$="assets/forge-home/hero-forge-wide.svg"]');
    await expect(hero).toBeVisible();
    for (const img of await page.locator('img[src*="assets/forge-home/"]').all()) {
      await expect(img).toHaveAttribute('alt', '');
      await expect(img).toHaveAttribute('aria-hidden', 'true');
      await expect(img).toHaveAttribute('tabindex', '-1');
    }
    await page.locator('[data-testid="path-open-ai-engineering"]').scrollIntoViewIfNeeded();
    for (const f of ['track-ai-engineering', 'track-game-development', 'track-agents-automation', 'track-research', 'track-ai-lab']) {
      await page.locator(`img[src$="assets/forge-home/${f}.svg"]`).scrollIntoViewIfNeeded();
      await expect.poll(async () => page.locator(`img[src$="assets/forge-home/${f}.svg"]`).evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { message: f }).toBe(true);
    }
    // a phone neither shows nor fetches the page art
    const phone = await page.context().newPage();
    const requested: string[] = [];
    phone.on('request', (r) => { if (r.url().includes('assets/forge-home/')) requested.push(r.url()); });
    await phone.setViewportSize({ width: 375, height: 800 });
    await phone.goto('/');
    await phone.waitForTimeout(800);
    await phone.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await phone.waitForTimeout(500);
    expect(requested, 'no home art is requested on a phone').toEqual([]);
    await phone.close();
  });

  for (const state of ['first-time', 'returning'] as const) {
    for (const width of WIDTHS) {
      test(`${state}: no horizontal overflow, readable hero and an early primary action at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: width < 800 ? 800 : 900 });
        if (state === 'first-time') await page.goto('/');
        else { await startApp(page); await takeL01Assessment(page, { confidence: 4 }); await goto(page, '/'); }
        await expect(page.getByTestId('home-hero')).toBeVisible();
        await expectNoHorizontalOverflow(page);
        const art = page.locator('img[src$="hero-forge-wide.svg"]');
        if (width < 768) await expect(art).toBeHidden(); else await expect(art).toBeVisible();
        // the first thing to do is visible without scrolling
        const first = state === 'first-time' ? page.getByTestId('onboard-diagnostic') : page.getByTestId('next-challenge-start');
        const box = (await first.boundingBox())!;
        expect(box.y + box.height, `primary action is within the first screen at ${width}px`).toBeLessThanOrEqual(width < 800 ? 1500 : 900);
        await shot(page, `${state}-${width}`);
        if (state === 'returning') {
          await page.getByTestId('home-paths').scrollIntoViewIfNeeded();
          await expectNoHorizontalOverflow(page);
          await page.getByTestId('home-lab').scrollIntoViewIfNeeded();
          await expectNoHorizontalOverflow(page);
        }
      });
    }
  }

  for (const theme of ['dark', 'light'] as const) {
    test(`axe: no serious or critical violations on first-time and returning Home in the ${theme} theme at desktop and phone widths`, async ({ page }) => {
      await startApp(page);
      await goto(page, '/settings');
      await page.getByRole('radio', { name: theme === 'dark' ? 'Dark' : 'Light' }).click();
      for (const width of [1280, 375]) {
        await page.setViewportSize({ width, height: 850 });
        await goto(page, '/');
        await expect(page.getByTestId('home-hero')).toBeVisible();
        await audit(page, `first-run ${theme} ${width}`);
      }
      await takeL01Assessment(page, { confidence: 4 });
      for (const width of [1280, 375]) {
        await page.setViewportSize({ width, height: 850 });
        await goto(page, '/');
        await expect(page.getByTestId('home-status')).toBeVisible();
        await audit(page, `returning ${theme} ${width}`);
        await shot(page, `returning-${theme}-${width}`);
      }
    });
  }
});
