import { expect, test } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

/**
 * GitHub Pages serves a project site under /<repo>/. This serves the production build exactly like that (and nothing at the
 * root) and checks that asset URLs, hash routing, the manifest and the service worker all work from the sub-path.
 * It does NOT prove the real github.io site is live: only a successful deploy plus loading the real URL does.
 */
const PREFIX = '/Claude_Forge/';
const PORT = 4411;
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
let server: Server;

test.beforeAll(async () => {
  const root = resolve('dist');
  server = createServer((req, res) => {
    const u = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    if (!u.startsWith(PREFIX)) { res.writeHead(404); res.end('not under the project path'); return; }
    let f = join(root, u.slice(PREFIX.length) || 'index.html');
    if (f.endsWith('/')) f = join(f, 'index.html');
    if (!f.startsWith(root) || !existsSync(f)) { res.writeHead(404); res.end('missing'); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' });
    createReadStream(f).pipe(res);
  });
  await new Promise<void>((ok) => server.listen(PORT, '127.0.0.1', ok));
});
test.afterAll(async () => { await new Promise<void>((ok) => server.close(() => ok())); });

test('the build works from a GitHub Pages style sub-path: assets, routing, manifest, service worker', async ({ page }) => {
  const failed: string[] = [];
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`http://127.0.0.1:${PORT}${PREFIX}`);
  await expect(page).toHaveURL(/#\/onboarding/);
  const hero = page.locator('img[src$="assets/forge-home/hero-forge-wide.svg"]');
  await expect.poll(async () => hero.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  expect(await hero.evaluate((i: HTMLImageElement) => i.currentSrc)).toContain(`${PREFIX}assets/forge-home/hero-forge-wide.svg`);
  await page.getByTestId('finish-onboarding').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mission Control' })).toBeVisible();
  for (const [route, file] of [['/academy', 'academy.svg'], ['/explore', 'discovery.svg'], ['/battle-lab', 'battle-lab.svg'], ['/playbooks', 'workflows.svg'], ['/pilot', 'battle-lab.svg']] as const) {
    await page.goto(`http://127.0.0.1:${PORT}${PREFIX}#${route}`);
    const img = page.locator(`img[src$="assets/forge/${file}"]`).first();
    await expect(img).toBeVisible();
    await expect.poll(async () => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { message: `${file} loads from the sub-path` }).toBe(true);
  }
  // a deep hash route survives a reload (no server rewrite rules needed)
  await page.goto(`http://127.0.0.1:${PORT}${PREFIX}#/pilot`);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Run Your First Real AI Experiment' })).toBeVisible();
  // manifest and icon resolve under the sub-path
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();
  const m = await page.request.get(new URL(manifestHref!, page.url()).toString());
  expect(m.status()).toBe(200);
  // the service worker registers with the sub-path as its scope, not the origin root
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope ?? null);
  expect(scope).toBe(`http://127.0.0.1:${PORT}${PREFIX}`);
  expect(failed, 'no request failed').toEqual([]);
});
