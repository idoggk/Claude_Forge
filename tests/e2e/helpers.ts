import { expect, type Locator, type Page } from '@playwright/test';
import { LESSONS } from '../../src/content/lessons/index';
import type { Item } from '../../src/domain/curriculum/types';

export const L01 = LESSONS.find((l) => l.id === 'L01-skill-or-tool')!;

/** Open the app and finish onboarding. */
export async function startApp(page: Page, opts: { interests?: string[] } = {}) {
  await page.goto('/');
  await expect(page).toHaveURL(/#\/onboarding/);
  for (const i of opts.interests ?? []) await page.getByLabel(i).check();
  await page.getByTestId('finish-onboarding').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mission Control' })).toBeVisible();
}

export async function goto(page: Page, hash: string) {
  await page.goto(`/#${hash}`);
}

const item = (page: Page, id: string): Locator => page.getByTestId(`item-${id}`);

/** Perform the answers a learner would give, through the real UI. wrong=true picks deliberately wrong answers. */
export async function answerItems(page: Page, items: Item[], opts: { wrong?: boolean } = {}) {
  for (const it of items) {
    const box = item(page, it.id);
    switch (it.kind) {
      case 'single': {
        const target = opts.wrong ? it.options.find((o) => o.id !== it.correct)! : it.options.find((o) => o.id === it.correct)!;
        await box.getByText(target.text, { exact: true }).click();
        break;
      }
      case 'multi': {
        const ids = opts.wrong ? [it.options.find((o) => !it.correct.includes(o.id))!.id] : it.correct;
        for (const id of ids) await box.getByText(it.options.find((o) => o.id === id)!.text, { exact: true }).click();
        break;
      }
      case 'classify':
        for (const e of it.entries) {
          const cat = opts.wrong ? it.categories.find((c) => c.id !== e.correct)! : it.categories.find((c) => c.id === e.correct)!;
          await box.getByLabel(e.text, { exact: true }).selectOption(cat.id);
        }
        break;
      case 'order': {
        const want = (opts.wrong ? [...it.steps].reverse() : it.steps).map((s) => s.text);
        for (let target = 0; target < want.length; target++) {
          const texts = await box.locator('ol > li > span.flex-1').allTextContents();
          let pos = texts.indexOf(want[target]!);
          while (pos > target) {
            await box.getByRole('button', { name: `Move step ${pos + 1} up` }).click();
            pos--;
          }
        }
        break;
      }
      case 'numeric': {
        const v = typeof it.answer === 'function' ? it.answer() : it.answer;
        await box.getByLabel('Your answer').fill(opts.wrong ? '987654' : String(v));
        break;
      }
      case 'keywords':
        await box.getByLabel('Your answer').fill(opts.wrong ? 'no idea' : it.groups.map((g) => `we need ${g.anyOf[0]} here because it matters`).join(' and also '));
        break;
      case 'fields':
        for (const f of it.fields) await box.getByLabel(f.label, { exact: true }).fill(opts.wrong ? 'no idea' : f.groups.map((g) => `we need ${g.anyOf[0]} here because it matters`).join(' and also '));
        break;
      case 'flaglines': {
        const lines = opts.wrong ? [] : it.targets.map((t) => t.line);
        for (const n of lines) await box.getByRole('button', { name: new RegExp(`^${n}(\\s|$)`) }).click();
        break;
      }
      case 'case':
        for (const p of it.parts) {
          const opt = opts.wrong ? p.options.find((o) => o.id !== p.correct)! : p.options.find((o) => o.id === p.correct)!;
          await box.getByTestId(`part-${it.id}-${p.id}`).getByText(opt.text, { exact: true }).click();
        }
        break;
      case 'construct':
        await box.getByLabel(/^Your (JSON|draft)/).fill(opts.wrong ? '{}' : it.reference);
        break;
      default:
        break;
    }
  }
}

/** Open Lesson 1 and take the assessment. */
export async function takeL01Assessment(page: Page, opts: { wrong?: boolean; confidence?: number } = {}) {
  await goto(page, `/academy/lesson/${L01.id}`);
  await page.getByRole('tab', { name: /3 · Assess/ }).click();
  await page.getByTestId(`confidence-${opts.confidence ?? 3}`).click();
  await page.getByTestId('start-assessment').click();
  await answerItems(page, L01.assessment.items, opts);
  await page.getByTestId('submit-answers').click();
  await expect(page.getByTestId('results')).toBeVisible();
}

/** The review items currently on screen. Sessions are planned from the learner's history, so read them, do not recompute. */
export async function reviewItemsOnPage(page: Page): Promise<Item[]> {
  await expect(page.locator('[data-testid^="item-"]').first()).toBeVisible();
  const ids = await page.locator('[data-testid^="item-"]').evaluateAll((els) => els.map((e) => (e.getAttribute('data-testid') ?? '').replace(/^item-/, '')));
  const pool = new Map(LESSONS.flatMap((l) => l.reviewItems).map((i) => [i.id, i] as const));
  return ids.map((id) => pool.get(id)!).filter(Boolean);
}

export async function setClockOffset(page: Page, days: number) {
  await goto(page, '/settings');
  await page.getByTestId('clock-offset').fill(String(days));
  await page.getByTestId('apply-offset').click();
}

/** Assert there is no horizontal page overflow. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(1);
}
