import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

let server;
let browser;
let appUrl;
before(async () => {
  const listener = net.createServer().listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  process.env.PORT = String(port);
  process.env.BASE_PATH = '/';
  server = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    server: { host: '127.0.0.1', port, strictPort: true },
  });
  await server.listen();
  appUrl = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || execFileSync('which', ['chromium'], { encoding: 'utf8' }).trim(),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const sections = ['.hero', '#listening-moment', '#our-services', '#purpose', '#about', '#feelings', '#launch-note'];
async function settle(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('landing spacing stays compact without clipping responsive content or animated cards', async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.site-loader').waitFor({ state: 'detached' });

  for (const fontSize of [16, 32]) {
    await page.evaluate((size) => { document.documentElement.style.fontSize = `${size}px`; }, fontSize);
    const textSpacing = fontSize === 32 ? await page.addStyleTag({ content: `
      .hero p, .hero h1, .hero li, #listening-moment p, #listening-moment li,
      #our-services p, #purpose p, #purpose h3, #about p, #launch-note p, #launch-note label {
        line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important;
      }
    ` }) : null;
    for (const width of [1440, 1024, 850, 768, 680, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const selector of sections) {
        await settle(page, selector);
        const layout = await page.locator(selector).evaluate((section) => {
          const bounds = section.getBoundingClientRect();
          const style = getComputedStyle(section);
          const next = section.nextElementSibling?.getBoundingClientRect();
          return {
            top: parseFloat(style.paddingTop), bottom: parseFloat(style.paddingBottom),
            gap: next ? next.top - bounds.bottom : 0,
            fits: section.scrollWidth <= section.clientWidth + 1,
            childrenFit: [...section.querySelectorAll('p, h1, h2, h3, li, input, button, .ha-art-frame, .signup-panel')].every((child) => {
              const rect = child.getBoundingClientRect();
              return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1;
            }),
          };
        });
        const context = `${selector}, ${width}px, root ${fontSize}px: ${JSON.stringify(layout)}`;
        if (selector !== '#our-services') {
          assert.ok(layout.top <= 76 && layout.bottom <= 76, context);
        }
        assert.ok(layout.gap >= -1 && layout.gap <= 1, context);
        assert.ok(layout.fits && layout.childrenFit, context);
      }
      // Tall viewports must not add an empty band to the content-sized hero.
      const height = await page.locator('.hero').evaluate((e) => e.offsetHeight);
      await page.setViewportSize({ width, height: 1400 });
      await settle(page, '.hero');
      assert.equal(await page.locator('.hero').evaluate((e) => e.offsetHeight), height);
      await page.setViewportSize({ width, height: 1000 });

      await settle(page, '#purpose');
      for (const card of await page.locator('.pm-card').all()) {
        await card.locator('.pm-front .pm-cue').focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(50);
        assert.equal(await card.locator('.pm-back').getAttribute('aria-hidden'), 'false',
          `flip opens at ${width}px / ${fontSize}px`);
        assert.ok(await card.locator('.pm-back').evaluate((face) => {
          const bounds = face.getBoundingClientRect();
          // Decorative pseudo-circles intentionally extend beyond the face.
          return [...face.children].every((child) => {
              const rect = child.getBoundingClientRect();
              return rect.top >= bounds.top && rect.bottom <= bounds.bottom;
            });
        }), `flip back fits at ${width}px / ${fontSize}px`);
        await card.locator('.pm-back .pm-cue').focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(50);
      }
      await settle(page, '#feelings');
      assert.ok(await page.locator('.emotion-card').evaluateAll((cards) =>
        cards.every((card) => getComputedStyle(card).animationName === 'none')));
    }
    await textSpacing?.evaluate((element) => element.remove());
  }

  await page.evaluate(() => { document.documentElement.style.fontSize = '16px'; });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await settle(page, '#feelings');
    // Sample every phase of the staggered float cycle, preserving each delay.
    for (let time = 0; time <= 6800; time += 200) {
      const clear = await page.locator('#feelings').evaluate((section, currentTime) => {
        for (const card of section.querySelectorAll('.emotion-card')) {
          const animation = card.getAnimations()[0];
          animation.pause();
          animation.currentTime = currentTime;
        }
        const bounds = section.getBoundingClientRect();
        const copy = section.querySelector('.emotion-center').getBoundingClientRect();
        const cards = [...section.querySelectorAll('.emotion-card')].map((e) => e.getBoundingClientRect());
        const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        return cards.every((card, i) => card.left >= bounds.left && card.right <= bounds.right
          && card.top >= bounds.top && card.bottom <= bounds.bottom && !overlaps(card, copy)
          && cards.every((other, j) => i === j || !overlaps(card, other)));
      }, time);
      assert.ok(clear, `mascot clearance at ${width}px, phase ${time}ms`);
    }
  }
});

test('shorter landing keeps navigation anchors and floating signup controls usable', async (t) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  t.after(() => page.close());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.site-loader').waitFor({ state: 'detached' });
  for (const [link, target] of [
    ['.nav-links a[href="#about"]', '#about'],
    ['.nav-links a[href="#our-services"]', '#our-services'],
    ['.nav-links a[href="#purpose"]', '#purpose'],
    ['.nav-cta', '#launch-note'],
  ]) {
    await page.locator(link).click();
    await page.waitForFunction((selector) => Math.abs(document.querySelector(selector).getBoundingClientRect().top) < 2, target);
  }
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(appUrl, { waitUntil: 'networkidle' });
    await page.locator('.site-loader').waitFor({ state: 'detached' });
    await settle(page, '#purpose');
    await page.locator('.app-scrollport').evaluate((element) => element.scrollBy({ top: -80, behavior: 'instant' }));
    await page.waitForFunction(() => document.querySelector('.launch-sticky-dock').getAttribute('aria-hidden') === 'false');
    await page.locator('.launch-sticky-cta').click();
    await page.waitForFunction(() => Math.abs(document.querySelector('#launch-note').getBoundingClientRect().top) < 2);
    await page.waitForFunction(() => document.querySelector('.launch-sticky-dock').classList.contains('is-launch-hidden'));
    assert.equal(await page.locator('#email').isVisible(), true);
    await page.getByRole('button', { name: 'Return to top' }).click();
    await page.waitForFunction(() => document.querySelector('.app-scrollport').scrollTop <= 8);
  }
});
