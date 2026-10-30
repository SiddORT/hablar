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

test('visible header artwork aligns with unchanged hero text across responsive breakpoints', async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('site-loader').waitFor({ state: 'hidden' });
  await page.evaluate(() => document.fonts.ready);

  // Measure the actual PNG alpha bounds, not its transparent image box.
  const artwork = await page.locator('.topbar .brand-mini img').evaluate(async (image) => {
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let left = canvas.width;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < left; x++) {
        if (data[(y * canvas.width + x) * 4 + 3] > 0) left = x;
      }
    }
    return { leftFraction: left / canvas.width };
  });

  for (const width of [320, 360, 361, 390, 640, 680, 681, 768, 850, 851, 980, 981, 1304, 1305, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const layout = await page.evaluate(({ leftFraction }) => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
      const image = rect('.topbar .brand-mini img');
      const heading = rect('.hero h1');
      const lede = rect('.hero-lede');
      const header = rect('.topbar');
      const controls = [...document.querySelectorAll('.topbar a, .topbar select')]
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom,
            fitsContent: element.scrollWidth <= element.clientWidth + 1,
          };
        });
      return {
        visibleLogoLeft: image.left + image.width * leftFraction,
        logoWidth: image.width,
        headingLeft: heading.left,
        ledeLeft: lede.left,
        headerTop: header.top,
        headerBottom: header.bottom,
        controls,
        viewportWidth: document.querySelector('.site-shell').clientWidth,
        scrollWidth: document.querySelector('.app-scrollport').scrollWidth,
      };
    }, artwork);
    const expectedHeroLeft = width <= 680 ? 20
      : (layout.viewportWidth - Math.min(1240, layout.viewportWidth - 64)) / 2
        + layout.viewportWidth * (width <= 850 ? .04 : .052);
    assert.ok(Math.abs(layout.headingLeft - expectedHeroLeft) < 1, `Hero must not move at ${width}px`);
    assert.ok(Math.abs(layout.visibleLogoLeft - layout.headingLeft) < 1, `Visible logo aligns with heading at ${width}px`);
    assert.ok(Math.abs(layout.visibleLogoLeft - layout.ledeLeft) < 1, `Visible logo aligns with supporting text at ${width}px`);
    assert.equal(layout.logoWidth, width <= 680 ? 66 : 84, `Logo size is preserved at ${width}px`);
    assert.ok(layout.scrollWidth <= layout.viewportWidth, `No horizontal scrolling at ${width}px`);
    for (const control of layout.controls) {
      assert.ok(control.left >= 0 && control.right <= layout.viewportWidth + 1
        && control.top >= layout.headerTop && control.bottom <= layout.headerBottom + 1
        && control.fitsContent, `Header control fits at ${width}px`);
    }
    for (let index = 1; index < layout.controls.length; index++) {
      const first = layout.controls[index - 1];
      const second = layout.controls[index];
      assert.ok(first.right <= second.left || first.bottom <= second.top,
        `Header controls do not overlap at ${width}px`);
    }
    assert.equal(await page.locator('.nav-cta').textContent(), "Interested? Let's talk");
  }
  await page.locator('.nav-cta').click();
  assert.equal(new URL(page.url()).hash, '#launch-note');
  await page.locator('.app-scrollport').evaluate((element) => element.scrollTo({ top: 0, behavior: 'instant' }));
  await page.getByTestId('link-about').click();
  assert.equal(new URL(page.url()).hash, '#about');
});
