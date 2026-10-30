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
  const purpose = page.locator('#purpose');
  assert.equal(await listening.evaluate((element) => element.nextElementSibling?.id), 'purpose');
  assert.equal(await purpose.evaluate((element) => element.nextElementSibling?.id), 'about');
  assert.equal(await page.locator('[data-testid="link-about"]').getAttribute('href'), '#about');

  const listeningLines = [
    'Not everything you carry is visible',
    'Sometimes you just need someone to hear you out.',
  ];
  assert.deepEqual(
    await listening.locator('.listening-moment__message-card p').allTextContents(),
    listeningLines,
  );
  assert.deepEqual(await listening.locator('.listening-moment__capsules li').allTextContents(), [
    'No labels',
    'No assumptions',
    'No judgment',
    'Just real conversations',
  ]);
  const listeningSequence = await listening.locator(
    '.listening-moment__heading, .listening-moment__message-card, .listening-moment__capsules, .listening-moment__coming-soon, .listening-moment__signoff',
  ).evaluateAll((elements) => elements.map((element) => {
    if (element.classList.contains('listening-moment__heading')) return 'heading';
    if (element.classList.contains('listening-moment__message-card')) return 'message-card';
    if (element.classList.contains('listening-moment__capsules')) return 'capsules';
    if (element.classList.contains('listening-moment__coming-soon')) return 'coming-soon';
    return 'signoff';
  }));
  assert.deepEqual(listeningSequence, [
    'heading', 'message-card', 'message-card', 'signoff', 'capsules', 'coming-soon',
  ]);
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
  const illustration = about.locator('.ha-art');
  assert.equal(await illustration.count(), 1, 'About should include its abstract conversation illustration');
  assert.equal(await illustration.getAttribute('aria-hidden'), 'true', 'the illustration should be decorative');
  assert.equal(await illustration.locator('svg.ha-art__bubble').count(), 1, 'the illustration should include an outlined chat bubble');
  assert.equal(await illustration.locator('.ha-art__form').count(), 3, 'the chat bubble should sit among pastel abstract forms');
  assert.equal(
    (await about.locator('.ha-message--lead').innerText()).replace(/\s+/g, ' ').trim(),
    'In a world more connected than ever, millions of people still feel unheard. In such times, all you need is to be heard.',
    'emphasis must not change the lead copy',
  );
  assert.deepEqual(
    await about.locator('.ha-emphasis').allTextContents(),
    ['feel unheard', 'be heard'],
    'the requested phrases should carry the restrained emphasis',
  );
  assert.equal(await about.locator('.ha-message').count(), 3);
  assert.deepEqual(
    await about.locator('.ha-message--second, .ha-message--third').evaluateAll((messages) =>
      messages.map((message) => getComputedStyle(message).borderTopStyle),
    ),
    ['solid', 'solid'],
    'supporting paragraphs should be separated by thin dividers',
  );
  assert.deepEqual(
    await about.locator('.ha-message').evaluateAll((messages) => messages.map((message) =>
      getComputedStyle(message, '::before').content,
    )),
    ['none', 'none', 'none'],
    'About messages should not have generated number markers',
  );
  const desktopAboutLayout = await about.evaluate((element) => {
    const copy = element.querySelector('.ha-copy').getBoundingClientRect();
    const art = element.querySelector('.ha-art').getBoundingClientRect();
    return {
      copy: { x: copy.x, right: copy.right, width: copy.width },
      art: { x: art.x, right: art.right, width: art.width },
    };
  });
  assert.ok(desktopAboutLayout.copy.width > 400 && desktopAboutLayout.copy.width < 700);
  assert.ok(desktopAboutLayout.art.width > 280);
  assert.ok(desktopAboutLayout.copy.x >= 0 && desktopAboutLayout.art.right <= 1280);
  assert.ok(desktopAboutLayout.copy.right <= desktopAboutLayout.art.x, 'desktop About content should use two non-overlapping columns');

  for (const theme of [null, 'blue-green', 'soft-lavender', 'yellow-orange']) {
    await page.evaluate((nextTheme) => {
      if (nextTheme) document.documentElement.dataset.theme = nextTheme;
      else delete document.documentElement.dataset.theme;
    }, theme);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const { viewportWidth, elements, cards, sectionScrollWidth, sectionClientWidth } = await listening.evaluate((element) => {
        const measured = Array.from(element.querySelectorAll(
          '.listening-moment__heading, .listening-moment__message-card, .listening-moment__capsules li, .listening-moment__coming-soon, .listening-moment__signoff',
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
        const cardBounds = Array.from(element.querySelectorAll('.listening-moment__message-card'), (card) => {
          const rect = card.getBoundingClientRect();
          const style = getComputedStyle(card);
          const parseColor = (value) => {
            const srgb = value.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
            if (srgb) return srgb.slice(1).map((channel) => Number(channel) * 255);
            const oklab = value.match(/oklab\(\s*([-.\d]+)\s+([-.\d]+)\s+([-.\d]+)/);
            if (oklab) {
              const [lightness, axisA, axisB] = oklab.slice(1).map(Number);
              const lRoot = lightness + 0.3963377774 * axisA + 0.2158037573 * axisB;
              const mRoot = lightness - 0.1055613458 * axisA - 0.0638541728 * axisB;
              const sRoot = lightness - 0.0894841775 * axisA - 1.291485548 * axisB;
              const l = lRoot ** 3;
              const m = mRoot ** 3;
              const s = sRoot ** 3;
              const linear = [
                4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
              ];
              return linear.map((channel) => {
                const encoded = channel <= 0.0031308
                  ? 12.92 * channel
                  : 1.055 * Math.max(0, channel) ** (1 / 2.4) - 0.055;
                return Math.min(255, Math.max(0, encoded * 255));
              });
            }
            return value.match(/[\d.]+/g).slice(0, 3).map(Number);
          };
          const channels = parseColor(style.color);
          const background = parseColor(style.backgroundColor);
          const luminance = ([red, green, blue]) => {
            const linear = [red, green, blue].map((channel) => {
              const normalized = channel / 255;
              return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
            });
            return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
          };
          const textLuminance = luminance(channels);
          const backgroundLuminance = luminance(background);
          return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            backgroundColor: style.backgroundColor,
            contrast: (Math.max(textLuminance, backgroundLuminance) + 0.05)
              / (Math.min(textLuminance, backgroundLuminance) + 0.05),
          };
        });
        return {
          viewportWidth: document.documentElement.clientWidth,
          elements: measured,
          cards: cardBounds,
          sectionScrollWidth: element.scrollWidth,
          sectionClientWidth: element.clientWidth,
        };
      });
      assert.equal(elements.length, 9);
      assert.equal(cards.length, 2);
      assert.ok(sectionScrollWidth <= sectionClientWidth, `Listening Moment should not overflow at ${width}px`);
      assert.ok(elements.every((element) =>
        element.width > 0 && element.height > 0 && element.left >= 0
        && element.right <= viewportWidth && element.visible),
      `Listening Moment should remain visible and fit at ${width}px with reduced motion`);
      assert.notEqual(cards[0].backgroundColor, cards[1].backgroundColor, `cards should be distinct in ${theme ?? 'default'} theme`);
      assert.ok(
        cards.every((card) => card.contrast >= 4.5),
        `card text should remain legible in ${theme ?? 'default'} theme: ${JSON.stringify(cards)}`,
      );
      if (width <= 760) {
        assert.ok(cards[0].bottom <= cards[1].top, `message cards should stack without overlap at ${width}px`);
      } else {
        assert.ok(cards[0].right <= cards[1].left, `message cards should sit side by side without overlap at ${width}px`);
      }
    }
  }

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const aboutLayout = await about.evaluate((element) => {
      const copy = element.querySelector('.ha-copy');
      const copyBounds = copy.getBoundingClientRect();
      const artBounds = element.querySelector('.ha-art').getBoundingClientRect();
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
        copyBounds: {
          left: copyBounds.left,
          right: copyBounds.right,
          top: copyBounds.top,
          bottom: copyBounds.bottom,
          width: copyBounds.width,
        },
        artBounds: {
          left: artBounds.left,
          right: artBounds.right,
          top: artBounds.top,
          bottom: artBounds.bottom,
          width: artBounds.width,
          height: artBounds.height,
        },
        messages,
      };
    });
    assert.ok(
      aboutLayout.sectionScrollWidth <= aboutLayout.sectionClientWidth,
      `About should not overflow at ${width}px: ${aboutLayout.sectionScrollWidth}/${aboutLayout.sectionClientWidth}`,
    );
    assert.ok(aboutLayout.copyBounds.width > 0 && aboutLayout.copyBounds.width < aboutLayout.viewportWidth);
    assert.ok(aboutLayout.copyBounds.left >= 0 && aboutLayout.copyBounds.right <= aboutLayout.viewportWidth);
    assert.equal(aboutLayout.messages.length, 3);
    assert.ok(aboutLayout.messages.every((message) =>
      message.width > 0 && message.height > 0 && message.left >= 0
      && message.right <= aboutLayout.viewportWidth && message.visible),
    `About copy should remain readable and fit at ${width}px`);
    assert.ok(aboutLayout.artBounds.width > 0 && aboutLayout.artBounds.height > 0);
    assert.ok(aboutLayout.artBounds.left >= 0 && aboutLayout.artBounds.right <= aboutLayout.viewportWidth);
    assert.ok(aboutLayout.copyBounds.bottom <= aboutLayout.artBounds.top, `About illustration should stack beneath copy without overlap at ${width}px`);
  }
});

test('signup, safety boundary, closing line, and footer stay ordered on desktop and mobile', async (t) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  t.after(() => page.close());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(appUrl, { waitUntil: 'networkidle' });

  const expectedBoundary =
    'A clear, caring boundary: HABLAR is a human listening space, not professional mental-health care, therapy, diagnosis, or emergency support services. If you are in immediate danger or need urgent help, or dealing with any of these issues contact your local emergency services or a trusted professional nearby.';
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

  for (const route of ['/', '/privacy']) {
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

test('Privacy Notice is complete and the removed Terms page stays unavailable', async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(`${appUrl}/privacy`, { waitUntil: 'networkidle' });

  const notice = page.locator('#legal-main');
  await notice.getByRole('heading', { name: 'Privacy Notice', level: 1 }).waitFor();
  const copy = await notice.innerText();
  assert.match(copy, /HABLAR is the company name used in this notice/);
  assert.match(copy, /optional form to request one launch update/);
  assert.doesNotMatch(copy, /Replit|configured to run|requests and grievances|working privacy-request channel/);
  assert.doesNotMatch(copy, /Outstanding owner and legal review|Important details still need owner and legal review/);
  assert.equal(await notice.locator('#requests').count(), 0);

  const sections = notice.locator('article > section');
  assert.equal(await sections.count(), 9);
  const anchors = await notice.locator('.legal-toc a').evaluateAll((links) =>
    links.map((link) => ({ href: link.getAttribute('href'), exists: !!document.querySelector(link.getAttribute('href')) })),
  );
  assert.equal(anchors.length, 9);
  assert.ok(anchors.every((anchor) => anchor.href?.startsWith('#') && anchor.exists));
  assert.match((await sections.nth(8).locator('h2').textContent()).trim(), /^9\. Notice updates and future service$/);
  assert.equal(await page.locator('a[href="/terms"]').count(), 0);

  await page.goto(`${appUrl}/terms`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '404 Page Not Found' }).waitFor();
  assert.equal(await page.locator('.legal-page').count(), 0);
  assert.equal(await page.getByRole('heading', { name: 'Terms & Conditions' }).count(), 0);
});

test('landing page has no Terms page links and keeps the agreement required inline', async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(appUrl, { waitUntil: 'networkidle' });

  assert.equal(await page.locator('a[href="/terms"]').count(), 0);
  assert.equal(await page.locator('a').filter({ hasText: /Terms & Conditions/i }).count(), 0);
  const agreement = page.locator('input[name="termsAccepted"]');
  assert.equal(await agreement.getAttribute('required'), '');
  assert.match(await page.locator('label').filter({ has: agreement }).innerText(), /request for one launch update.*not yet available.*no launch date is promised/i);
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
  assert.match(await statusText(page, 'Please accept the signup agreement'), /Please accept the signup agreement/);
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
