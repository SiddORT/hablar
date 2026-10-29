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
let port;

async function findFreePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port: freePort } = server.address();
  await new Promise((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  );
  return freePort;
}

before(async () => {
  port = await findFreePort();
  appUrl = `http://127.0.0.1:${port}`;
  process.env.PORT = String(port);
  process.env.BASE_PATH = '/';
  process.env.SITE_ORIGIN = 'https://hablar.example';
  viteServer = await createServer({
    configFile: path.resolve(packageDir, 'vite.config.ts'),
    server: { host: '127.0.0.1', port, strictPort: true },
  });
  await viteServer.listen();

  const executablePath = process.env.CHROMIUM_PATH || execFileSync('which', ['chromium'], { encoding: 'utf8' }).trim();
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

async function openSignup(response = {
  status: 201,
  body: { message: 'Thanks. Your contact has been recorded for one launch update.' },
}) {
  const page = await browser.newPage();
  const requests = [];
  await page.route('**/api/waitlist', async (route) => {
    requests.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({
      status: response.status,
      contentType: 'application/json',
      body: JSON.stringify(response.body),
    });
  });
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  const form = page.locator('#launch-note form');
  await form.scrollIntoViewIfNeeded();
  return { page, form, requests };
}

test('About section uses the planned narrative and smiling mascot at desktop and mobile widths', async (t) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  t.after(() => page.close());
  await page.goto(appUrl, { waitUntil: 'networkidle' });

  const about = page.locator('#about');
  await assert.doesNotReject(() => about.getByRole('heading', {
    name: 'You deserve to feel heard. Even when words are hard to find.',
  }).waitFor());
  await assert.doesNotReject(() => about.getByRole('img', {
    name: 'Smiling HABLAR mascot illustration',
  }).waitFor());
  assert.doesNotMatch(await about.innerText(), /More connected than ever|Still, so many feel unheard|A little room to be heard/i);
  assert.equal(await about.locator('img').count(), 0);
  assert.match(await about.locator('.hr-mascot-art').evaluate((element) => getComputedStyle(element).backgroundImage), /hablar-mascot-grid\.png/);

  const themes = ['original', 'blue-green', 'soft-lavender', 'yellow-orange'];
  for (const theme of themes) {
    await page.locator('#hablar-theme').selectOption(theme);
    const sectionColor = await about.evaluate((element) => getComputedStyle(element).color);
    const headingColor = await about.locator('#about-heading').evaluate((element) => getComputedStyle(element).color);
    assert.notEqual(sectionColor, 'rgba(0, 0, 0, 0)');
    assert.notEqual(headingColor, 'rgba(0, 0, 0, 0)');
  }

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const { sectionWidth, contentRight, viewportWidth, mascotWidth } = await about.evaluate((element) => {
      const section = element.getBoundingClientRect();
      const mascot = element.querySelector('.hr-mascot-art').getBoundingClientRect();
      return {
        sectionWidth: section.width,
        contentRight: Math.max(section.right, mascot.right),
        viewportWidth: document.documentElement.clientWidth,
        mascotWidth: mascot.width,
      };
    });
    assert.ok(sectionWidth > 0);
    assert.ok(mascotWidth > 0);
    assert.ok(contentRight <= viewportWidth, `About section overflows at ${width}px`);
  }
});

async function enableRequiredConsents(page, { consent = true, termsAccepted = true } = {}) {
  if (consent) await page.locator('input[name="consent"]').check();
  if (termsAccepted) await page.locator('input[name="termsAccepted"]').check();
}

async function statusText(page, expected) {
  const status = page.locator('.form-status');
  await status.waitFor({ state: 'visible' });
  await page.waitForFunction(
    ({ expectedText }) => document.querySelector('.form-status')?.textContent?.includes(expectedText),
    { expectedText: expected },
  );
  return (await status.textContent()).trim();
}

test('hero story and interaction commitment use the requested wording and accent', async (t) => {
  const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
  t.after(() => page.close());
  await page.goto(appUrl, { waitUntil: 'networkidle' });

  const hero = page.locator('.hero');
  assert.equal(
    (await hero.locator('.hero-lede').textContent()).trim(),
    'Because every story deserves a space, every person deserves to be heard, and sometimes, one heartfelt conversation can make a difference.',
  );
  const heroText = await hero.innerText();
  for (const removedCopy of [
    'Save me a seat',
    'Get to know us',
    'No fixing. No labels. Just a human being, listening.',
  ]) {
    assert.equal(heroText.includes(removedCopy), false, `hero should not include "${removedCopy}"`);
  }
  assert.equal(await hero.locator('.hero-commitments li').nth(0).textContent(), 'Your identity would remain anonymous to the person you connect with.');
  const interactionCopy = hero.locator('.hero-commitment-highlight');
  assert.equal(await interactionCopy.textContent(), 'your first interaction is on us');
  assert.equal(
    await interactionCopy.evaluate((element) => getComputedStyle(element).color),
    'rgb(231, 51, 125)',
    'the interaction commitment should use the site pink accent',
  );

  await page.locator('#hablar-theme').selectOption('soft-lavender');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'soft-lavender');
  const commitmentsBounds = await hero.locator('.hero-commitments').boundingBox();
  assert.ok(commitmentsBounds);
  assert.ok(
    commitmentsBounds.x >= 0 && commitmentsBounds.x + commitmentsBounds.width <= 360,
    'hero commitments should fit a narrow viewport',
  );
});

test('return-to-top is hidden until scrolling and works by keyboard on landing and legal pages', async (t) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  t.after(() => page.close());

  for (const route of ['/', '/privacy', '/terms']) {
    await page.goto(`${appUrl}${route}`, { waitUntil: 'networkidle' });
    const scrollport = page.locator('.app-scrollport');
    const button = page.getByRole('button', { name: 'Return to top' });
    await button.waitFor({ state: 'hidden' });
    await scrollport.evaluate((element) => {
      element.scrollTo({ top: Math.max(500, element.scrollHeight - element.clientHeight), behavior: 'instant' });
    });
    await button.waitFor({ state: 'visible' });

    const bounds = await page.evaluate(() => {
      const buttonRect = document.querySelector('.return-top-button').getBoundingClientRect();
      const dockRect = document.querySelector('.launch-sticky-dock').getBoundingClientRect();
      return {
        button: { left: buttonRect.left, right: buttonRect.right, top: buttonRect.top, bottom: buttonRect.bottom },
        dock: { left: dockRect.left, right: dockRect.right, top: dockRect.top, bottom: dockRect.bottom },
      };
    });
    const overlaps = bounds.button.left < bounds.dock.right
      && bounds.button.right > bounds.dock.left
      && bounds.button.top < bounds.dock.bottom
      && bounds.button.bottom > bounds.dock.top;
    assert.equal(overlaps, false, 'return-to-top should not overlap the sticky actions');

    await button.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.app-scrollport').scrollTop < 2);
    assert.equal(await page.evaluate(() => document.activeElement.matches('.site-shell, #legal-main')), true);
  }
});

test('browser form validates contact details and both consent checkboxes', async (t) => {
  const { page, form, requests } = await openSignup();
  t.after(() => page.close());

  await form.locator('button[type="submit"]').click();
  assert.match(await statusText(page, 'Add an email address or phone number'), /Add an email address or phone number/);

  await page.locator('#email').fill('not-an-email');
  await form.locator('button[type="submit"]').click();
  assert.match(await statusText(page, 'Please check the email address format'), /Please check the email address format/);

  await page.locator('#email').fill('');
  await page.locator('#phone').fill('letters');
  await form.locator('button[type="submit"]').click();
  assert.match(await statusText(page, 'Use numbers and phone formatting only'), /Use numbers and phone formatting only/);

  await page.locator('#phone').fill('9876543210');
  await form.locator('button[type="submit"]').click();
  assert.match(await statusText(page, 'Please consent to the one-time launch update'), /Please consent to the one-time launch update/);

  await page.locator('input[name="consent"]').check();
  await form.locator('button[type="submit"]').click();
  assert.match(await statusText(page, 'Please agree to the Terms & Conditions'), /Please agree to the Terms & Conditions/);
  assert.equal(requests.length, 0);
});

test('browser form sends email signup and shows the success acknowledgment', async (t) => {
  const { page, form, requests } = await openSignup();
  t.after(() => page.close());
  await page.locator('#email').fill('person@example.com');
  await enableRequiredConsents(page);
  await form.locator('button[type="submit"]').click();

  assert.match(await statusText(page, 'contact has been recorded'), /contact has been recorded/);
  assert.deepEqual(requests, [{
    email: 'person@example.com',
    phone: null,
    consent: true,
    termsAccepted: true,
  }]);
  assert.equal(await page.locator('#email').inputValue(), '');
});

test('browser form sends phone-only signup with country prefix and shows success', async (t) => {
  const { page, form, requests } = await openSignup();
  t.after(() => page.close());
  await page.locator('#phone').fill('98765 43210');
  await enableRequiredConsents(page);
  await form.locator('button[type="submit"]').click();

  assert.match(await statusText(page, 'contact has been recorded'), /contact has been recorded/);
  assert.deepEqual(requests, [{
    email: null,
    phone: '+919876543210',
    consent: true,
    termsAccepted: true,
  }]);
  assert.equal(await page.locator('#phone').inputValue(), '');
});

test('browser form makes API failures visible to visitors', async (t) => {
  const { page, form, requests } = await openSignup({
    status: 503,
    body: { detail: 'Signup is temporarily unavailable.' },
  });
  t.after(() => page.close());
  await page.locator('#email').fill('person@example.com');
  await enableRequiredConsents(page);
  await form.locator('button[type="submit"]').click();

  const message = await statusText(page, 'Signup is temporarily unavailable');
  assert.match(message, /Signup is temporarily unavailable/);
  assert.equal(requests.length, 1);
});
