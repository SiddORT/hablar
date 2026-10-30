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

test('Listening Moment and About HABLAR remain separate, ordered, and readable', async (t) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  t.after(() => page.close());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(appUrl, { waitUntil: 'networkidle' });

  const hero = page.locator('.hero');
  const listening = page.locator('#listening-moment');
  const about = page.locator('#about');
  await listening.getByRole('heading', { name: 'A moment to be heard' }).waitFor();
  assert.equal(await hero.evaluate((element) => element.nextElementSibling?.id), 'listening-moment');
  assert.equal(await listening.evaluate((element) => element.nextElementSibling?.id), 'about');
  assert.equal(await page.locator('[data-testid="link-about"]').getAttribute('href'), '#about');

  const listeningLines = [
    'Maybe you don’t need advice.',
    'Maybe you don’t need answers.',
    'Maybe you just need someone to listen.',
    'You don’t have to carry every thought alone!',
  ];
  assert.deepEqual(await listening.locator('.listening-moment__messages p').allTextContents(), listeningLines);
  assert.deepEqual(await listening.locator('.listening-moment__capsules li').allTextContents(), [
    'No labels',
    'No assumptions',
    'No judgment',
    'Just real conversations',
  ]);
  const closingSequence = await listening.locator(
    '.listening-moment__capsules, .listening-moment__coming-soon, .listening-moment__signoff',
  ).evaluateAll((elements) => elements.map((element) => {
    if (element.classList.contains('listening-moment__capsules')) return 'capsules';
    if (element.classList.contains('listening-moment__coming-soon')) return 'coming-soon';
    return 'signoff';
  }));
  assert.deepEqual(closingSequence, ['capsules', 'coming-soon', 'signoff']);
  const listeningText = await listening.innerText();
  assert.doesNotMatch(listeningText, /we are open|available now/i);
  assert.match(await page.locator('.ls-closing').innerText(), /HABLAR — Come as you are\.\s*Speak as you feel\./);
  await page.locator('[data-testid="link-about"]').click();
  assert.equal(new URL(page.url()).hash, '#about');

  const aboutCopy = await about.innerText();
  assert.match(aboutCopy, /About HABLAR/i);
  assert.equal((await about.locator('#about-heading').textContent()).trim(), 'A moment to be heard');
  assert.equal(
    (await about.locator('.ha-message--lead').textContent()).trim(),
    'In a world more connected than ever, millions of people still feel unheard. In such times, all you need is to be heard.',
  );
  assert.equal(
    (await about.locator('.ha-message--second').textContent()).trim(),
    'HABLAR offers a safe and anonymous space for you to speak out and express yourself freely.',
  );
  assert.equal(
    (await about.locator('.ha-message--third').textContent()).trim(),
    "Because the first step toward feeling better is knowing you're not alone in the journey.",
  );
  assert.equal(await about.locator('img, figure, .ha-art').count(), 0, 'About should be text-only');
  assert.equal(await about.locator('.ha-message').count(), 3);
  assert.deepEqual(
    await about.locator('.ha-message').evaluateAll((messages) => messages.map((message) =>
      getComputedStyle(message, '::before').content,
    )),
    ['none', 'none', 'none'],
    'About messages should not have generated number markers',
  );
  const desktopAboutBounds = await about.locator('.ha-copy').boundingBox();
  assert.ok(desktopAboutBounds);
  assert.ok(desktopAboutBounds.width > 700 && desktopAboutBounds.width < 900);
  assert.ok(desktopAboutBounds.x >= 0 && desktopAboutBounds.x + desktopAboutBounds.width <= 1280);

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const { viewportWidth, regions, elements, sectionScrollWidth, sectionClientWidth } = await listening.evaluate((element) => {
      const section = element.getBoundingClientRect();
      const measured = Array.from(element.querySelectorAll(
        '.listening-moment__heading, .listening-moment__messages p, .listening-moment__capsules li, .listening-moment__coming-soon, .listening-moment__signoff',
      ), (child) => {
        const rect = child.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          visible: getComputedStyle(child).visibility !== 'hidden' && Number(getComputedStyle(child).opacity) > 0,
        };
      });
      return {
        viewportWidth: document.documentElement.clientWidth,
        regions: { left: section.left, right: section.right, width: section.width },
        elements: measured,
        sectionScrollWidth: element.scrollWidth,
        sectionClientWidth: element.clientWidth,
      };
    });
    assert.ok(regions.width > 0);
    assert.equal(elements.length, 11);
    assert.ok(sectionScrollWidth <= sectionClientWidth, `Listening Moment should not overflow at ${width}px`);
    assert.ok(elements.every((element) =>
      element.width > 0 && element.height > 0 && element.left >= 0
      && element.right <= viewportWidth && element.visible),
    `Listening Moment should remain visible and fit at ${width}px with reduced motion`);

    const aboutLayout = await about.evaluate((element) => {
      const copy = element.querySelector('.ha-copy');
      const copyBounds = copy.getBoundingClientRect();
      const messages = Array.from(element.querySelectorAll('.ha-message'), (message) => {
        const bounds = message.getBoundingClientRect();
        return {
          left: bounds.left,
          right: bounds.right,
          width: bounds.width,
          height: bounds.height,
          visible: getComputedStyle(message).visibility !== 'hidden' && Number(getComputedStyle(message).opacity) > 0,
        };
      });
      return {
        viewportWidth: document.documentElement.clientWidth,
        sectionScrollWidth: element.scrollWidth,
        sectionClientWidth: element.clientWidth,
        copyBounds: { left: copyBounds.left, right: copyBounds.right, width: copyBounds.width },
        messages,
      };
    });
    assert.ok(aboutLayout.sectionScrollWidth <= aboutLayout.sectionClientWidth, `About should not overflow at ${width}px`);
    assert.ok(aboutLayout.copyBounds.width > 0 && aboutLayout.copyBounds.width < aboutLayout.viewportWidth);
    assert.ok(aboutLayout.copyBounds.left >= 0 && aboutLayout.copyBounds.right <= aboutLayout.viewportWidth);
    assert.equal(aboutLayout.messages.length, 3);
    assert.ok(aboutLayout.messages.every((message) =>
      message.width > 0 && message.height > 0 && message.left >= 0
      && message.right <= aboutLayout.viewportWidth && message.visible),
    `About copy should remain readable and fit at ${width}px`);
  }
});

test('signup, safety boundary, closing line, and footer stay ordered on desktop and mobile', async (t) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  t.after(() => page.close());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(appUrl, { waitUntil: 'networkidle' });

  const expectedBoundary =
    'A clear, caring boundary: HABLAR is a human listening space, not professional mental-health care, therapy, diagnosis, or emergency support. If you are in immediate danger or need urgent help, contact your local emergency services or a trusted person nearby.';
  const expectedClosingLine = 'HABLAR — Come as you are. Speak as you feel.';

  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const orderedSections = await page.locator(
      '#launch-note, .boundary, .ls-closing, .footer',
    ).evaluateAll((elements) => elements.map((element) => {
      if (element.id === 'launch-note') return 'signup';
      if (element.classList.contains('boundary')) return 'boundary';
      if (element.classList.contains('ls-closing')) return 'closing';
      return 'footer';
    }));

    assert.deepEqual(orderedSections, ['signup', 'boundary', 'closing', 'footer']);
    assert.equal((await page.locator('.boundary p').innerText()).replace(/\s+/g, ' ').trim(), expectedBoundary);
    assert.equal((await page.locator('.ls-closing').innerText()).replace(/\s+/g, ' ').trim(), expectedClosingLine);
    await page.locator('#launch-note form').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#launch-note input[name="email"]').count(), 1);
    assert.equal(await page.locator('#launch-note input[name="phone"]').count(), 1);
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
  assert.equal(
    (await hero.locator('.hero-disclaimer p').first().textContent()).trim(),
    'Your identity would remain anonymous to the person you connect with.',
  );
  const interactionCopy = hero.locator('.hero-commitment-highlight');
  assert.equal((await interactionCopy.textContent()).trim(), 'Your First Interaction is on us.');
  assert.equal(
    await interactionCopy.evaluate((element) => getComputedStyle(element).color),
    'rgb(231, 51, 125)',
    'the interaction commitment should use the site pink accent',
  );

  const commitmentsBounds = await hero.locator('.hero-details').boundingBox();
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
