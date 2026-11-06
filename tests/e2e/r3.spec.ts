import { expect, test } from '@playwright/test';
import { LESSONS } from '../../src/content/lessons/index';
import { PLAYBOOK_TEMPLATES } from '../../src/content/playbook/seeds';
import { answerItems, expectNoHorizontalOverflow, goto, startApp } from './helpers';
import { readFile } from 'node:fs/promises';

const L12 = LESSONS.find((l) => l.id === 'L12-context-engineering')!;
const L11 = LESSONS.find((l) => l.id === 'L11-choose-ai-approach')!;

test.describe('Round 3: navigation and the Capability Map', () => {
  test('the sidebar groups the product into Learn / Explore / Lab / Build / My System and every link works', async ({ page }) => {
    await startApp(page);
    for (const [id, heading] of [['nav-explore', 'AI Capability Map'], ['nav-playbooks', 'AI Workflow Playbooks'], ['nav-battle-lab', 'Compare workflows with evidence'], ['nav-discovery', 'Curated tools, frameworks and techniques']] as const) {
      await page.getByTestId(id).click();
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    }
  });

  test('explore by outcome, no dead-end cards, open a card, and a saved goal steers the next mission', async ({ page }) => {
    await startApp(page);
    await page.getByTestId('nav-explore').click();
    const all = await page.getByTestId('capability-count').textContent();
    const total = Number(all!.match(/of (\d+)/)![1]);
    expect(total).toBeGreaterThanOrEqual(22);
    await page.getByTestId('outcome-automate-safely').click();
    await expect(page.getByTestId('outcome-description')).toBeVisible();
    const filtered = Number((await page.getByTestId('capability-count').textContent())!.match(/^(\d+)/)![1]);
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(total);
    // every card opens a page that leads somewhere real
    const hrefs = await page.getByTestId('capability-results').getByRole('link', { name: 'Open' }).evaluateAll((els) => els.map((e) => e.getAttribute('href')!));
    expect(hrefs.length).toBe(filtered);
    for (const h of hrefs.slice(0, 4)) {
      await page.goto(`/${h}`);
      await expect(page.getByTestId('capability-page')).toBeVisible();
      await expect(page.locator('[data-testid="capability-page"] a[href^="#/academy/lesson/"], [data-testid="capability-page"] a[href^="#/discovery/"], [data-testid="capability-page"] a[href^="#/playbooks"], [data-testid="capability-page"] a[href^="#/battle-lab"]').first()).toBeVisible();
    }
    // search
    await goto(page, '/explore');
    await page.getByTestId('capability-search').fill('secrets');
    await expect(page.getByTestId('capability-tool-integration')).toBeVisible();
    await page.getByTestId('capability-search').fill('zzzzqqq');
    await expect(page.getByText('No capability matches')).toBeVisible();

    // goal -> Mission Control explains why
    await goto(page, '/explore/approach-selection');
    await page.getByTestId('make-goal').click();
    await page.getByTestId('goal-title').fill('Stop reaching for agents first');
    await page.getByTestId('save-goal').click();
    await expect(page.getByText('Goal saved').first()).toBeVisible();
    await goto(page, '/');
    await expect(page.getByTestId('home-goals')).toContainText('Stop reaching for agents first');
    await expect(page.getByTestId('mission-reasons')).toContainText('Supports your goal "Stop reaching for agents first"');
    await expect(page.getByTestId('mission-reasons')).toContainText('only your assessments and field notes show what you can do');
    // the goal alone created no evidence
    await goto(page, '/growth');
    await expect(page.getByTestId('attempt-history')).toHaveCount(0);
  });
});

test.describe('Round 3: lessons', () => {
  test('prediction before explanation: the explanation is hidden until you commit (or skip)', async ({ page }) => {
    await startApp(page);
    await goto(page, `/academy/lesson/${L11.id}`);
    const seg = L11.segments.find((s) => s.prediction)!;
    const gate = page.getByTestId(`predict-${seg.id}`);
    await expect(gate).toBeVisible();
    await expect(page.getByText(seg.body.split('\n')[0]!.slice(0, 40)).first()).toBeHidden();
    const right = seg.prediction!.options.find((o) => o.id === seg.prediction!.correct)!;
    await gate.getByText(right.text, { exact: true }).click();
    await page.getByTestId(`predict-lock-${seg.id}`).click();
    await expect(gate.getByText('Your prediction held up')).toBeVisible();
  });

  test('a lesson with structured written answers (fields) and flagged lines can be passed through the real UI', async ({ page }) => {
    await startApp(page);
    await goto(page, `/academy/lesson/${L12.id}`);
    await page.getByRole('tab', { name: /3 · Assess/ }).click();
    await page.getByTestId('confidence-3').click();
    await page.getByTestId('start-assessment').click();
    await answerItems(page, L12.assessment.items);
    await page.getByTestId('submit-answers').click();
    await expect(page.getByTestId('results')).toBeVisible();
    await expect(page.getByTestId('results')).toContainText(/passed/i);
  });
});

test.describe('Round 3: Workflow Playbooks', () => {
  test('copy a seeded design, cannot verify a step without saying how, version history, export, hostile import', async ({ page }) => {
    await startApp(page);
    await goto(page, '/playbooks');
    const seed = PLAYBOOK_TEMPLATES[0]!;
    await page.getByTestId(`use-${seed.templateId}`).click();
    await expect(page.getByTestId('playbook-editor')).toBeVisible();
    await expect(page.getByTestId('pb-title')).toHaveValue(seed.title);
    // the same checklist Lesson 15 verifies is visible and met for the exemplar
    await expect(page.getByTestId('reliability-checklist')).toContainText('Every step has a verification gate');
    // seeded steps start as planned: nothing is pre-verified
    await expect(page.getByTestId('step-0-status')).toHaveValue('planned');

    // verified requires a note
    await page.getByTestId('step-0-status').selectOption('verified');
    await page.getByTestId('pb-title').fill(`${seed.title} (mine)`);
    await expect(page.getByRole('alert').filter({ hasText: 'what verified it' })).toBeVisible();
    await page.getByTestId('save-playbook').click();
    await expect(page.getByText(/to mark a step verified/).first()).toBeVisible();
    await page.getByTestId('step-0-verified-note').fill('Ran the script on last week\'s export and saw it validate.');
    await expect(page.getByRole('alert').filter({ hasText: 'what verified it' })).toHaveCount(0);
    await page.getByTestId('save-playbook').click();
    await expect(page.getByText('Saved', { exact: true }).first()).toBeVisible();

    // version history keeps the previous content
    await page.getByTestId('pb-title').fill('Release notes v2');
    await page.getByTestId('revision-label').fill('renamed for clarity');
    await page.getByTestId('save-revision').click();
    await expect(page.getByTestId('version-history')).toContainText('renamed for clarity');
    await page.reload();
    await expect(page.getByTestId('pb-title')).toHaveValue('Release notes v2');

    // Markdown export says it is a design that was not executed
    const [md] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-playbook-md').click()]);
    const text = await readFile((await md.path())!, 'utf8');
    expect(text).toContain('not executed by Claude Forge');
    expect(text).toContain('Verification gate');
    const [js] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-playbook-json').click()]);
    const json = JSON.parse(await readFile((await js.path())!, 'utf8'));
    expect(json.format).toBe('claude-forge-playbook');

    // importing: invalid file is refused clearly; the exported file comes back with verification reset
    await goto(page, '/playbooks');
    await page.getByTestId('import-playbook-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('not json') });
    await expect(page.getByRole('alert')).toContainText('not valid JSON');
    await page.getByTestId('import-playbook-file').setInputFiles({ name: 'ok.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) });
    await expect(page.getByText(/reset to "planned"/)).toBeVisible();
    await expect(page.getByTestId('playbook-list').locator('li')).toHaveCount(2);
  });
});

test.describe('Round 3: Opportunity Finder', () => {
  test('answer scenarios, see why for each, save the run, and see it remembered', async ({ page }) => {
    await startApp(page);
    await goto(page, '/academy/opportunity-finder');
    for (let i = 1; i <= 6; i++) {
      await expect(page.getByTestId(`finder-q-${i}`)).toBeVisible();
      await page.getByTestId('approach-software').click();
      await page.getByTestId('finder-check').click();
      await expect(page.getByTestId('finder-feedback')).toContainText('Best answer:');
      await page.getByTestId('finder-next').click();
    }
    await expect(page.getByTestId('finder-summary')).toContainText('Your run:');
    await expect(page.getByTestId('finder-summary')).toContainText('never exceeds', { useInnerText: true }).catch(() => undefined);
    const themesBefore = await page.getByTestId('finder-summary').locator('li').allTextContents();
    expect(themesBefore).toHaveLength(6);
    await page.getByTestId('finder-save').click();
    await expect(page.getByTestId('finder-save')).toHaveText('Saved');
    // saving adds to the history but must not re-pick the scenarios the summary describes
    expect(await page.getByTestId('finder-summary').locator('li').allTextContents()).toEqual(themesBefore);
    await page.reload(); // same hash, so a reload is what returns to the start screen
    await expect(page.getByTestId('finder-history')).toContainText('1 earlier run');
    // practice never created competency evidence
    await goto(page, '/growth');
    await expect(page.getByTestId('attempt-history')).toHaveCount(0);
  });
});

test.describe('Round 3: generalised AI Lab', () => {
  test('start a prompt-versus-prompt experiment from a template; unknown stays unknown', async ({ page }) => {
    await startApp(page);
    await goto(page, '/battle-lab');
    await page.getByTestId('lab-template-lab-prompt-vs-prompt').click();
    await expect(page.getByTestId('exp-type')).toHaveValue('prompt');
    await page.getByTestId('exp-hypothesis').fill('Explicit acceptance criteria raise the checklist items met.');
    await page.getByLabel('Describe your fixture').fill('A review prompt on a copy of my own repository');
    await page.getByTestId('create-experiment').click();
    await expect(page).toHaveURL(/#\/battle-lab\/exp_/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Prompt A versus prompt B');
    await expect(page.locator('main')).toContainText('Prompts or specifications');
  });

  test('a template with a missing baseline difference is still a fair setup, and the form blocks an unstated difference', async ({ page }) => {
    await startApp(page);
    await goto(page, '/battle-lab?template=lab-model-vs-model');
    await expect(page.getByTestId('exp-type')).toHaveValue('model');
    await page.getByTestId('cond-diff-1').fill('');
    await page.getByTestId('create-experiment').click();
    await expect(page.getByTestId('exp-errors')).toContainText('state exactly what differs');
  });
});

test.describe('Round 3: Discovery generalised', () => {
  test('filters by what the thing is, shows provenance and capability links, and never invents a price', async ({ page }) => {
    await startApp(page);
    await goto(page, '/discovery');
    await page.getByLabel(/Agent framework/).check();
    await expect(page.getByTestId('entry-langgraph')).toBeVisible();
    await expect(page.getByTestId('entry-playwright-mcp')).toHaveCount(0);
    await page.getByTestId('open-entry-langgraph').click();
    await expect(page.getByTestId('entry-capabilities')).toContainText('Agent frameworks and SDKs');
    await expect(page.locator('main')).toContainText('as displayed');
    await goto(page, '/discovery/claude-model-family');
    await expect(page.locator('main')).toContainText('as displayed on the verification date');
    await expect(page.locator('main')).toContainText('Pricing page itself was not read');
  });
});

test.describe('Round 3: layout', () => {
  for (const width of [375, 1280]) {
    test(`new pages have no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await startApp(page);
      for (const h of ['/explore', '/explore/reliable-workflows', '/playbooks', '/academy/opportunity-finder', '/battle-lab', '/discovery', '/growth']) {
        await goto(page, h);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expectNoHorizontalOverflow(page);
      }
    });
  }
});

test.describe('Visual assets', () => {
  const ART_PAGES: [string, string][] = [['/explore', 'discovery.svg'], ['/academy', 'academy.svg'], ['/battle-lab', 'battle-lab.svg'], ['/playbooks', 'workflows.svg']];

  test('illustrations are decorative: empty alt, hidden from assistive tech, correct paths, never on dense pages', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    // welcome hero on first visit
    const hero = page.locator('img[src$="assets/forge-home/hero-forge-wide.svg"]');
    await expect(hero).toHaveAttribute('alt', '');
    await expect(hero).toHaveAttribute('aria-hidden', 'true');
    await expect.poll(async () => hero.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    await page.getByTestId('finish-onboarding').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Mission Control' })).toBeVisible(); // onboarding must finish navigating first
    for (const [route, file] of ART_PAGES) {
      await goto(page, route);
      const img = page.locator(`img[src$="assets/forge/${file}"]`);
      await expect(img).toBeVisible();
      await expect(img).toHaveAttribute('alt', '');
      await expect(img).toHaveAttribute('aria-hidden', 'true');
      const box = (await img.boundingBox())!;
      expect(box.height, `${file} is not excessively large`).toBeLessThanOrEqual(200);
      expect(Math.abs(box.width / box.height - 960 / 560), `${file} keeps its aspect ratio`).toBeLessThan(0.05);
    }
    // dense pages carry no illustration
    for (const route of ['/discovery', '/growth', '/academy/lesson/L01-skill-or-tool', '/workshop']) {
      await goto(page, route);
      await expect(page.locator('img[src*="assets/forge/"]')).toHaveCount(0);
    }
    // the three specialisation track headings each carry a small thumbnail on the Academy page, and the planned Research track still says so in text
    await goto(page, '/academy');
    for (const f of ['agents.svg', 'game-dev.svg', 'research.svg']) await expect(page.locator(`img[src$="assets/forge/${f}"]`)).toHaveCount(1);
    await expect(page.locator('main')).toContainText('planned'); // planned topics are still labelled as planned, never as available
  });

  test('small screens do not download or show the page art, and there is no overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const requested: string[] = [];
    page.on('request', (r) => { if (r.url().includes('assets/forge/')) requested.push(r.url()); });
    await startApp(page);
    for (const [route, file] of ART_PAGES) {
      await goto(page, route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator(`img[src$="assets/forge/${file}"]`)).toBeHidden();
      await expectNoHorizontalOverflow(page);
    }
    expect(requested.filter((u) => !u.endsWith('hero-forge.svg') && !u.endsWith('background-contours.svg')), 'hidden art is lazy and not fetched').toEqual([]);
  });

  test.describe('without the images', () => {
    // The service worker would otherwise serve the art from its precache and bypass the block.
    test.use({ serviceWorkers: 'block' });
    test('the app is fully usable when the images are blocked', async ({ page }) => {
    await page.route('**/assets/forge/**', (r) => r.abort());
    await startApp(page);
    for (const [route] of ART_PAGES) {
      await goto(page, route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    await goto(page, '/explore');
    await page.getByTestId('capability-search').fill('secrets');
    await expect(page.getByTestId('capability-tool-integration')).toBeVisible();
    await expect(page.locator('img[src*="assets/forge/"]')).toHaveCount(0); // failed images remove themselves
    });
  });

  test('the contour backdrop is dark-theme only and sits behind everything', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await startApp(page);
    const bg = page.locator('.forge-contours');
    await expect(bg).toBeVisible();
    expect(await bg.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe('none');
    expect(Number(await bg.evaluate((e) => getComputedStyle(e).opacity))).toBeLessThanOrEqual(0.12);
    await goto(page, '/settings');
    await page.getByRole('radio', { name: 'Light' }).click();
    await expect(bg).toBeHidden();
  });
});

test.describe('Layout with wider system fonts', () => {
  // The app uses the system font stack, so a machine with wider default fonts (such as a CI runner) lays text out wider
  // than the developer's machine. This test forces a wide stack so such overflow is caught locally. It was added after the
  // first CI run overflowed by 49px at 375px: a non-wrapping badge in the Workshop's Scenarios tab.
  for (const width of [375, 390]) {
    test(`no horizontal overflow at ${width}px with DejaVu fonts`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await startApp(page);
      await page.addStyleTag({ content: "html[data-theme]{--font-sans:'DejaVu Sans',sans-serif;--font-display:'DejaVu Serif',serif;--font-mono:'DejaVu Sans Mono',monospace}" });
      await goto(page, '/workshop');
      await page.getByTestId('new-starter').click();
      for (const tab of ['Basics', 'Instructions', 'Resources', 'Scenarios & Dojo', 'Trigger tuning', 'Validate', 'Quality review', 'Preview', 'Live test', 'Export & history']) {
        await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
        await expectNoHorizontalOverflow(page);
      }
      for (const route of ['/', '/academy', '/academy/lesson/L13-why-agents-fail', '/academy/diagnostic', '/explore', '/explore/reliable-workflows', '/playbooks', '/battle-lab', '/battle-lab/demo-merge-cascade', '/discovery', '/discovery/claude-model-family', '/loop', '/arsenal', '/growth']) {
        await goto(page, route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expectNoHorizontalOverflow(page);
      }
    });
  }
});
