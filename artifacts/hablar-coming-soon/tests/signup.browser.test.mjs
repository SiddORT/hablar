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
  assert.equal(await listening.evaluate((element) => element.nextElementSibling?.id), 'our-services');
  assert.equal(await page.locator('#our-services').evaluate((element) => element.nextElementSibling?.id), 'purpose');
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
  assert.equal(await page.locator('.ls-closing').count(), 0);
  assert.match(await page.locator('.footer-brand > .brand-logo--footer + .footer-closing').innerText(), /HABLAR — Come as you are\.\s*Speak as you feel\./);
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

test('Our services preserves exact copy, reference layout, order, and responsive theme readability', async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  const section = page.getByRole('region', { name: 'Our services', exact: true });
  assert.equal(await section.count(), 1);
  assert.equal(await section.getByRole('heading', { name: 'Our services', level: 2 }).count(), 1);
  assert.deepEqual(await section.locator('p').allTextContents(), [
    'We offer a space where you can talk freely, navigating through your thoughts or a difficult moment. We’re here to listen - No labels; No assumptions; No judgment; Just real conversations; genuine support and a reminder that someone is here to hear you.',
    'We believe that being heard can make a difference. A conversation at HABLAR, at that very moment can bring in clarity, comfort, and a fresh perspective. It’s a reminder that you matter, your feelings matter, your thoughts matter.',
  ]);
  assert.deepEqual(await section.evaluate((element) => [
    element.previousElementSibling?.id, element.nextElementSibling?.id,
  ]), ['listening-moment', 'purpose']);
  assert.equal(await page.locator('#listening-moment .listening-moment__coming-soon').textContent(), 'We’re coming soon');
  assert.equal(await section.locator('img, svg, picture, video, canvas, i, [role="img"], a, button').count(), 0);
  const eyebrow = section.locator('.our-services__eyebrow');
  assert.equal((await eyebrow.textContent()).toUpperCase(), 'OUR SERVICES');
  assert.equal(await eyebrow.evaluate((element) => getComputedStyle(element).textTransform), 'uppercase');
  assert.equal(await section.locator('.our-services__decor').getAttribute('aria-hidden'), 'true');
  assert.equal(await section.locator('.our-services__decor').evaluate((element) =>
    getComputedStyle(element).pointerEvents), 'none');
  assert.equal(await section.locator('.our-services__rule, .our-services__divider').evaluateAll((elements) =>
    elements.every((element) => element.getAttribute('aria-hidden') === 'true')), true);
  assert.equal(await section.locator('p').count(), 2, 'copy must remain selectable paragraphs, not artwork');

  // Sweep each text size together and settle the visible section after resizing
  // so measurements reflect the current responsive styles, not the prior layout.
  for (const fontSize of ['16px', '32px']) {
    await page.evaluate(async (value) => {
      document.documentElement.style.fontSize = value;
      void document.documentElement.offsetHeight;
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, fontSize);
    for (const theme of [null, 'original', 'blue-green', 'soft-lavender', 'yellow-orange']) {
    await page.evaluate((value) => {
      if (value) document.documentElement.dataset.theme = value;
      else delete document.documentElement.dataset.theme;
    }, theme);
    for (const width of [1280, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const layout = await section.evaluate((element) => {
           const inner = element.querySelector('.our-services__inner');
          const bounds = inner.getBoundingClientRect();
          const style = getComputedStyle(element);
          const swatch = document.createElement('span');
          swatch.style.color = 'var(--theme-text)';
           swatch.style.backgroundColor = 'color-mix(in srgb, var(--theme-page) 92%, var(--theme-surface-warm))';
          element.append(swatch);
          const themeStyle = getComputedStyle(swatch);
           const usesTheme = style.color === themeStyle.color && style.backgroundColor === themeStyle.backgroundColor;
          swatch.remove();
           // Canvas normalizes CSS color formats, including color-mix() results.
           const canvas = document.createElement('canvas');
           canvas.width = canvas.height = 1;
           const ctx = canvas.getContext('2d', { willReadFrequently: true });
           const luminance = (color) => {
             ctx.fillStyle = color;
             ctx.fillRect(0, 0, 1, 1);
             const linear = Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).map((channel) => {
               const value = channel / 255;
               return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
             });
             return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
           };
           const background = luminance(style.backgroundColor);
           const headingStyle = getComputedStyle(element.querySelector('h2'));
           const paragraphStyle = getComputedStyle(element.querySelector('p'));
           const divider = element.querySelector('.our-services__divider');
           const dividerStyle = getComputedStyle(divider);
           const dividerBounds = divider.getBoundingClientRect();
           const paragraphs = element.querySelectorAll('p');
          return {
             rootFont: getComputedStyle(document.documentElement).fontSize,
            usesTheme,
            width: bounds.width,
            centered: Math.abs(bounds.left - (window.innerWidth - bounds.right)) < 1,
            fits: bounds.left >= 0 && bounds.right <= window.innerWidth
              && element.scrollWidth <= element.clientWidth,
             headingSize: parseFloat(headingStyle.fontSize),
             bodySize: parseFloat(paragraphStyle.fontSize),
             lineHeight: parseFloat(paragraphStyle.lineHeight),
             divider: dividerStyle.borderTopStyle === 'solid'
               && parseFloat(dividerStyle.borderTopWidth) === 1
               && Math.abs(dividerBounds.width - bounds.width) < 1
               && paragraphs[0].getBoundingClientRect().bottom < dividerBounds.top
               && dividerBounds.bottom < paragraphs[1].getBoundingClientRect().top,
             children: Array.from(inner.querySelectorAll('h2, p'), (child) => {
              const rect = child.getBoundingClientRect();
              const childStyle = getComputedStyle(child);
              const range = document.createRange();
              range.selectNodeContents(child);
              const text = range.getBoundingClientRect();
              return {
                top: rect.top, bottom: rect.bottom,
                box: { left: rect.left, right: rect.right, textLeft: text.left, textRight: text.right,
                  scrollWidth: child.scrollWidth, clientWidth: child.clientWidth,
                  scrollHeight: child.scrollHeight, clientHeight: child.clientHeight },
                readable: rect.height > 0 && child.scrollWidth <= child.clientWidth
                  && child.scrollHeight <= child.clientHeight + 1
                  && text.left >= rect.left - 1 && text.right <= rect.right + 1
                   && childStyle.textAlign === 'center'
                   && childStyle.userSelect !== 'none'
                  && childStyle.visibility === 'visible' && Number(childStyle.opacity) === 1,
                 contrast: (Math.max(luminance(childStyle.color), background) + .05)
                   / (Math.min(luminance(childStyle.color), background) + .05),
                 plain: childStyle.backgroundImage === 'none'
                  && childStyle.animationName === 'none'
                  && ['none', 'normal'].includes(getComputedStyle(child, '::before').content)
                  && ['none', 'normal'].includes(getComputedStyle(child, '::after').content),
              };
            }),
          };
        });
        const context = `${theme}, ${width}px, root text ${fontSize}`;
        assert.ok(layout.usesTheme && layout.centered && layout.fits, `${context}: ${JSON.stringify(layout)}`);
         if (width === 1024 && fontSize === '16px') {
           assert.ok(Math.abs(layout.width - 936) <= 8, `${context}: broad reference margins: ${JSON.stringify(layout)}`);
           assert.ok(layout.headingSize >= 44 && layout.headingSize <= 48, context);
           assert.ok(layout.bodySize >= 19 && layout.bodySize <= 21, context);
           assert.ok(layout.lineHeight >= 27 && layout.lineHeight <= 34, context);
         }
         assert.ok(layout.divider, `${context}: fine divider between paragraphs`);
        assert.ok(layout.children.every((child) => child.readable && child.plain), `${context}: ${JSON.stringify(layout)}`);
         assert.ok(layout.children.every((child) => child.contrast >= 4.5), `${context}: readable text contrast`);
        assert.ok(layout.children[0].bottom < layout.children[1].top, context);
        assert.ok(layout.children[1].bottom < layout.children[2].top, context);
      }
    }
  }
  await page.evaluate(() => {
    delete document.documentElement.dataset.theme;
    document.documentElement.style.fontSize = '16px';
  });
  if (process.env.SERVICES_SCREENSHOT_DIR) {
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    for (const width of [1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await section.screenshot({ path: path.join(process.env.SERVICES_SCREENSHOT_DIR, `services-${width}.png`) });
    }
  }
});

test('signup, safety boundary, and footer stay ordered with the closing line below the logo', async (t) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  t.after(() => page.close());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(appUrl, { waitUntil: 'networkidle' });

  const expectedBoundary =
    'A clear, caring boundary: HABLAR is a human listening space, not professional mental-health care, therapy, diagnosis, or emergency support services. If you are in immediate danger or need urgent help, or dealing with any of these issues contact your local emergency services or a trusted professional nearby.';
  const expectedClosingLine = 'HABLAR — Come as you are. Speak as you feel.';
  const introduction = page.locator('#launch-note .signup-panel > div').first();
  assert.equal(await introduction.locator('h2').textContent(), 'Hablar is a safe space for you.');
  assert.equal(await introduction.locator('p').textContent(), "A reminder that you're never truly alone");
  assert.equal(await introduction.locator('.section-kicker').count(), 0);
  assert.deepEqual(await introduction.locator('*').allTextContents(), [
    'Hablar is a safe space for you.',
    "A reminder that you're never truly alone",
  ]);
  assert.equal((await page.locator('#launch-note button[type="submit"]').textContent()).trim(), 'Register Now');
  await page.evaluate(() => document.fonts.ready);

  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const copyFits = await introduction.locator('h2, p').evaluateAll((elements) =>
      elements.every((element) => {
        const bounds = element.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(element);
        const text = range.getBoundingClientRect();
        const container = element.parentElement.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0
          && bounds.left >= 0 && bounds.right <= innerWidth
          && element.scrollWidth <= element.clientWidth
          && text.top >= container.top - 1 && text.bottom <= container.bottom + 1
          && text.left >= bounds.left - 1 && text.right <= bounds.right + 1;
      }),
    );
    assert.ok(copyFits, `signup introduction should fit without clipping at ${width}px`);
    const orderedSections = await page.locator(
      '#launch-note, .boundary, .footer',
    ).evaluateAll((elements) => elements.map((element) => {
      if (element.id === 'launch-note') return 'signup';
      if (element.classList.contains('boundary')) return 'boundary';
      return 'footer';
    }));

    assert.deepEqual(orderedSections, ['signup', 'boundary', 'footer']);
    assert.equal((await page.locator('.boundary p').innerText()).replace(/\s+/g, ' ').trim(), expectedBoundary);
    assert.equal(await page.locator('.ls-closing').count(), 0);
    assert.equal(await page.locator('.footer-closing').count(), 1);
    assert.equal((await page.locator('.footer-brand > .brand-logo--footer + .footer-closing').innerText()).replace(/\s+/g, ' ').trim(), expectedClosingLine);
    const closingLayout = await page.locator('.footer-closing').evaluate((line) => {
      const rect = line.getBoundingClientRect();
      const footer = line.closest('.footer');
      return {
        fits: rect.left >= 0 && rect.right <= innerWidth && line.scrollWidth <= line.clientWidth,
        adjacent: footer.previousElementSibling.classList.contains('boundary'),
        gap: footer.getBoundingClientRect().top - footer.previousElementSibling.getBoundingClientRect().bottom,
      };
    });
    assert.ok(closingLayout.fits);
    assert.ok(closingLayout.adjacent);
    assert.equal(closingLayout.gap, 0);
    await page.locator('#launch-note form').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#launch-note input[name="email"]').count(), 1);
    assert.equal(await page.locator('#launch-note input[name="phone"]').count(), 1);
  }
  await page.locator('.footer-links a').click();
  await page.locator('#legal-main').waitFor();
  assert.equal(await page.locator('.footer-closing').count(), 0);
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

test('return-to-top stays visible when sticky controls are hidden and works by keyboard', async (t) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
  t.after(() => page.close());
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['/', '/privacy']) {
      await page.goto(`${appUrl}${route}`, { waitUntil: 'networkidle' });
      const scrollport = page.locator('.app-scrollport');
      const button = page.getByRole('button', { name: 'Return to top' });
      await button.waitFor({ state: 'hidden' });
      if (route === '/') {
        await scrollport.evaluate((element) => {
          const section = document.querySelector('.listening-moment');
          const sectionTop = section.getBoundingClientRect().top - element.getBoundingClientRect().top;
          element.scrollTo({
            top: element.scrollTop + sectionTop - element.clientHeight * 0.25,
            behavior: 'instant',
          });
        });
        await page.waitForFunction(() =>
          document.querySelector('.launch-sticky-dock')?.classList.contains('is-content-section-visible'),
        );
        assert.equal(
          await page.locator('.instagram-sticky-cta').evaluate((element) => getComputedStyle(element).visibility),
          'hidden',
          'the sticky controls should be hidden over landing-page content',
        );
        await button.waitFor({ state: 'visible' });
      } else {
        await scrollport.evaluate((element) => {
          element.scrollTo({ top: Math.max(500, element.scrollHeight - element.clientHeight), behavior: 'instant' });
        });
        await button.waitFor({ state: 'visible' });
      }

      const bounds = await page.evaluate(() => {
        const buttonRect = document.querySelector('.return-top-button').getBoundingClientRect();
        const dockRect = document.querySelector('.launch-sticky-dock').getBoundingClientRect();
        return {
          button: { left: buttonRect.left, right: buttonRect.right, top: buttonRect.top, bottom: buttonRect.bottom },
          dock: { left: dockRect.left, right: dockRect.right, top: dockRect.top, bottom: dockRect.bottom },
          unobstructed: Boolean(document.elementFromPoint(buttonRect.left + buttonRect.width / 2, buttonRect.top + buttonRect.height / 2)
            ?.closest('.return-top-button')),
        };
      });
      const overlaps = bounds.button.left < bounds.dock.right
        && bounds.button.right > bounds.dock.left
        && bounds.button.top < bounds.dock.bottom
        && bounds.button.bottom > bounds.dock.top;
      assert.equal(overlaps, false, `return-to-top should not overlap sticky actions at ${width}px`);
      assert.ok(bounds.button.bottom <= bounds.dock.top - 10, `return-to-top must sit above sticky actions at ${width}px`);
      assert.ok(Math.abs(bounds.button.right - bounds.dock.right) < 1, `return-to-top must align with sticky actions at ${width}px`);
      assert.equal(bounds.unobstructed, true, `return-to-top must not be covered at ${width}px`);

      await page.evaluate(() => {
        const scrollport = document.querySelector('.app-scrollport');
        const originalScrollTo = scrollport.scrollTo.bind(scrollport);
        scrollport.scrollTo = (options) => {
          window.lastReturnTopScrollBehavior = options.behavior;
          originalScrollTo(options);
        };
      });
      await button.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('.app-scrollport').scrollTop < 2);
      assert.equal(await page.evaluate(() => window.lastReturnTopScrollBehavior), 'instant');
      assert.equal(await page.evaluate(() => document.activeElement.matches('.site-shell, #legal-main')), true);
    }
  }
});

test('return-to-top does not flicker near its scroll threshold', async (t) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  t.after(() => page.close());
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(appUrl, { waitUntil: 'networkidle' });
    const scrollport = page.locator('.app-scrollport');
    const button = page.getByRole('button', { name: 'Return to top' });
    assert.equal(await button.isHidden(), true);

    const setScrollTop = async (top) => {
      await scrollport.evaluate((element, nextTop) => {
        element.scrollTop = nextTop;
      }, top);
      await page.waitForTimeout(30);
    };

    await setScrollTop(280);
    await button.waitFor({ state: 'visible' });
    for (const top of [210, 250, 205, 255]) {
      await setScrollTop(top);
      assert.equal(await button.isVisible(), true, `return-to-top should stay visible at ${top}px (${width}px viewport)`);
    }

    await setScrollTop(60);
    assert.equal(await button.isVisible(), true, 'the arrow must remain available while returning toward the top');
    await setScrollTop(4);
    await button.waitFor({ state: 'hidden' });
    for (const top of [40, 80, 115, 65]) {
      await setScrollTop(top);
      assert.equal(await button.isHidden(), true, `return-to-top should stay hidden at ${top}px (${width}px viewport)`);
    }

    await setScrollTop(130);
    await button.waitFor({ state: 'visible' });
  }
});

test('floating controls keep stable visibility while scrolling both pages', async (t) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
  t.after(() => page.close());
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const landingTargets = [
    '.hero',
    '.listening-moment',
    '.hablar-refresh',
    '.ls-pm',
    '#purpose',
    '#about',
    '#feelings',
    '#launch-note',
    '.boundary',
    '.footer',
  ];
  const legalTargets = ['#legal-main h1', '#legal-main h2', '#legal-main p', '#legal-main li'];

  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['/', '/privacy']) {
      await page.goto(`${appUrl}${route}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(450);
      const scrollport = page.locator('.app-scrollport');
      const selectors = route === '/' ? landingTargets : legalTargets;
      const targets = await page.evaluate((targetSelectors) => {
        const scrollportElement = document.querySelector('.app-scrollport');
        return targetSelectors
          .map((selector) => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
              selector,
              scrollTop: Math.max(
                0,
                Math.min(
                  scrollportElement.scrollHeight - scrollportElement.clientHeight,
                  scrollportElement.scrollTop + rect.top - scrollportElement.getBoundingClientRect().top
                    - scrollportElement.clientHeight * 0.2,
                ),
              ),
            };
          })
          .filter(Boolean);
      }, selectors);
      const snapshots = new Map();

      for (const target of [...targets, ...targets.slice().reverse()]) {
        await scrollport.evaluate((element, top) => element.scrollTo({ top, behavior: 'instant' }), target.scrollTop);
        await page.waitForTimeout(400);
        const frames = await page.evaluate(async () => {
          for (let index = 0; index < 3; index += 1) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          const readSnapshot = () => {
            const dock = document.querySelector('.launch-sticky-dock');
            const launch = document.querySelector('.launch-sticky-cta');
            const instagram = document.querySelector('.instagram-sticky-cta');
            const returnTop = document.querySelector('.return-top-button');
            const bounds = (element) => {
              const rect = element.getBoundingClientRect();
              return [rect.left, rect.top, rect.right, rect.bottom].map((value) => Math.round(value * 10) / 10);
            };
            return {
              dockClasses: dock.className,
              launchVisibility: getComputedStyle(launch).visibility,
              launchTabIndex: launch.tabIndex,
              launchPointerEvents: getComputedStyle(launch).pointerEvents,
              instagramVisibility: getComputedStyle(instagram).visibility,
              instagramTabIndex: instagram.tabIndex,
              instagramPointerEvents: getComputedStyle(instagram).pointerEvents,
              launchBounds: bounds(launch),
              instagramBounds: bounds(instagram),
              returnTopHidden: returnTop.hidden,
            };
          };
          const samples = [];
          for (let index = 0; index < 4; index += 1) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
            samples.push(readSnapshot());
          }
          return samples;
        });

        assert.ok(
          frames.every((frame) => JSON.stringify(frame) === JSON.stringify(frames[0])),
          `floating controls should settle without flicker at ${route} ${target.selector} (${width}px): ${JSON.stringify(frames)}`,
        );
        assert.equal(
          frames[0].launchTabIndex,
          frames[0].launchVisibility === 'visible' ? 0 : -1,
          `launch action keyboard access should follow visibility at ${route} ${target.selector} (${width}px)`,
        );
        assert.equal(
          frames[0].instagramTabIndex,
          frames[0].instagramVisibility === 'visible' ? 0 : -1,
          `Instagram action keyboard access should follow visibility at ${route} ${target.selector} (${width}px)`,
        );
        const expectedPointerEvents = frames[0].dockClasses.includes('is-content-section-visible') ? 'none' : 'auto';
        assert.equal(frames[0].launchPointerEvents, expectedPointerEvents);
        assert.equal(frames[0].instagramPointerEvents, expectedPointerEvents);
        const previousSnapshot = snapshots.get(target.selector);
        if (previousSnapshot && route !== '/') {
          assert.deepEqual(
            frames[0],
            previousSnapshot,
            `floating controls should return to the same state at ${route} ${target.selector} (${width}px)`,
          );
        } else {
          snapshots.set(target.selector, frames[0]);
        }
      }

      if (route === '/') {
        await scrollport.evaluate((element) => {
          const signup = document.querySelector('#launch-note');
          const top = element.scrollTop + signup.getBoundingClientRect().top
            - element.getBoundingClientRect().top - element.clientHeight * 0.2;
          element.scrollTo({ top, behavior: 'instant' });
        });
        await page.waitForFunction(() =>
          document.querySelector('.launch-sticky-dock')?.classList.contains('is-launch-hidden'),
        );
        assert.equal(
          await page.locator('.launch-sticky-cta').evaluate((element) => getComputedStyle(element).visibility),
          'hidden',
          `launch action should stay hidden over signup at ${width}px`,
        );
      }
    }
  }
});

test('floating actions return on upward scroll and the up arrow stays available until the top', async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(appUrl, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    await page.locator('.app-scrollport').evaluate((element) => {
      const section = document.querySelector('.listening-moment');
      element.scrollTo({
        top: element.scrollTop + section.getBoundingClientRect().top
          - element.getBoundingClientRect().top - element.clientHeight * 0.25,
        behavior: 'instant',
      });
    });
    await page.waitForFunction(() => document.querySelector('.launch-sticky-dock').getAttribute('aria-hidden') === 'true');
    await page.locator('.app-scrollport').evaluate((element) => element.scrollBy({ top: -80, behavior: 'instant' }));
    await page.waitForFunction(() => document.querySelector('.launch-sticky-dock').getAttribute('aria-hidden') === 'false');
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.instagram-sticky-cta').isVisible(), true, 'actions must stay visible after pausing an upward scroll');
    assert.equal(await page.locator('.launch-sticky-cta').isVisible(), true);
    await page.locator('.app-scrollport').evaluate((element) => element.scrollTo({ top: 100, behavior: 'instant' }));
    const arrow = page.getByRole('button', { name: 'Return to top' });
    await arrow.waitFor({ state: 'visible' });
    await arrow.click();
    await page.waitForFunction(() => document.querySelector('.app-scrollport').scrollTop <= 8);
    await arrow.waitFor({ state: 'hidden' });
  }
});

test('floating dock stays anchored and does not toggle during continuous normal-motion wheel scrolling', async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(appUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.mouse.move(width / 2, 400);
    for (const direction of [1, -1]) {
      await page.waitForTimeout(500);
      const start = await page.locator('.launch-sticky-dock').evaluate((dock) => ({
        top: dock.getBoundingClientRect().top,
        visible: dock.getAttribute('aria-hidden') !== 'true',
      }));
      for (let step = 0; step < 50; step += 1) {
        await page.mouse.wheel(0, direction * 180);
        await page.waitForTimeout(40);
        const sample = await page.evaluate(() => {
          const scrollport = document.querySelector('.app-scrollport');
          const dock = document.querySelector('.launch-sticky-dock');
          return {
            top: dock.getBoundingClientRect().top,
            visible: dock.getAttribute('aria-hidden') !== 'true',
            scrollTop: scrollport.scrollTop,
            maxScroll: scrollport.scrollHeight - scrollport.clientHeight,
          };
        });
        assert.ok(Math.abs(sample.top - start.top) < 1, `dock must not jump at ${width}px`);
        assert.equal(sample.visible, direction === -1 ? true : start.visible, `dock should stay stable downward and remain visible upward at ${width}px`);
        if ((direction === 1 && sample.scrollTop >= sample.maxScroll - 1)
          || (direction === -1 && sample.scrollTop <= 1)) break;
      }
    }
    await page.waitForTimeout(500);
    const before = await page.locator('.launch-sticky-dock').evaluate((dock) => dock.getBoundingClientRect().top);
    await page.locator('.app-scrollport').evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(500);
    const after = await page.locator('.launch-sticky-dock').evaluate((dock) => dock.getBoundingClientRect().top);
    assert.ok(Math.abs(after - before) < 1, 'signup visibility must not move the dock to the top');
    const footerCovered = await page.evaluate(() => {
      const dock = document.querySelector('.launch-sticky-dock');
      if (getComputedStyle(dock).visibility === 'hidden') return false;
      const rect = dock.getBoundingClientRect();
      return Array.from(document.querySelectorAll('.footer p, .footer a')).some((element) => {
        const text = element.getBoundingClientRect();
        return text.left < rect.right && text.right > rect.left && text.top < rect.bottom && text.bottom > rect.top;
      });
    });
    assert.equal(footerCovered, false, 'settled controls must not cover footer text');
    await page.locator('.app-scrollport').evaluate((element) => element.scrollTo({ top: 500, behavior: 'instant' }));
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Return to top' }).hover();
    await page.mouse.wheel(0, 160);
    await page.waitForFunction(() => document.querySelector('.app-scrollport').scrollTop > 500);
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
