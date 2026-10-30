import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let viteServer;
let browser;
let appUrl;

async function findFreePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  );
  return port;
}

before(async () => {
  const port = await findFreePort();
  appUrl = `http://127.0.0.1:${port}`;
  process.env.PORT = String(port);
  process.env.BASE_PATH = '/';
  process.env.SITE_ORIGIN = 'https://hablar.example';
  viteServer = await createServer({
    configFile: path.resolve(packageDir, 'vite.config.ts'),
    server: { host: '127.0.0.1', port, strictPort: true },
  });
  await viteServer.listen();

  const executablePath = process.env.CHROMIUM_PATH
    || execFileSync('which', ['chromium'], { encoding: 'utf8' }).trim();
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
});

after(async () => {
  await browser?.close();
  await viteServer?.close();
});

test('reveals once on entry and stays dismissed during in-site navigation', async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());

  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  const loader = page.getByTestId('site-loader');
  await loader.waitFor({ state: 'visible' });
  await loader.waitFor({ state: 'hidden', timeout: 2_500 });

  await page.getByRole('link', { name: 'Privacy Notice' }).first().click();
  await page.locator('#legal-main').waitFor();
  assert.equal(await page.getByTestId('site-loader').count(), 0);
});

test('failed logo requests dismiss the loader promptly', async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.route('**/brand/hablar-logo-transparent.png', (route) => route.abort());

  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('site-loader').waitFor({ state: 'hidden', timeout: 1_000 });
});

test('stalled logo requests cannot keep the loader open past its fallback', async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.route('**/brand/hablar-logo-transparent.png', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    await route.fulfill({ status: 200, contentType: 'image/png', body: '' });
  });

  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('site-loader').waitFor({ state: 'hidden', timeout: 2_400 });
});

test('reduced motion skips the animation and still dismisses quickly', async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

  const loader = page.getByTestId('site-loader');
  await loader.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('.site-loader__content--ready'));
  assert.equal(
    await page.locator('.site-loader__content').evaluate((element) => getComputedStyle(element).animationName),
    'none',
  );
  await loader.waitFor({ state: 'hidden', timeout: 1_000 });
});

test('keyboard focus dismisses the decorative overlay and mobile and desktop layouts fit', async (t) => {
  const keyboardPage = await browser.newPage();
  t.after(() => keyboardPage.close());
  await keyboardPage.goto(appUrl, { waitUntil: 'domcontentloaded' });
  const keyboardLoader = keyboardPage.getByTestId('site-loader');
  await keyboardLoader.waitFor({ state: 'visible' });
  await keyboardPage.keyboard.press('Tab');
  await keyboardLoader.waitFor({ state: 'hidden', timeout: 600 });
  assert.equal(await keyboardPage.evaluate(() => document.activeElement?.tagName), 'A');

  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    t.after(() => page.close());
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('site-loader').waitFor({ state: 'visible' });
    const bounds = await page.locator('.site-loader, .site-loader__mark').evaluateAll((elements) =>
      elements.map((element) => {
        const { left, right, top, bottom } = element.getBoundingClientRect();
        return { left, right, top, bottom };
      }),
    );
    assert.ok(bounds.every(({ left, right, top, bottom }) =>
      left >= 0 && right <= width && top >= 0 && bottom <= 844),
    `Loader should fit the ${width}px viewport`);
  }
});
