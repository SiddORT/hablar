import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import { normalizeSiteOrigin, pageMetadata, publicPaths, seoHead } from '../src/lib/seo.ts';

test('public origins are explicit HTTPS origins, never preview or request URLs', () => {
  assert.equal(normalizeSiteOrigin(''), '');
  assert.equal(normalizeSiteOrigin('https://hablar.example/'), 'https://hablar.example');
  for (const value of [
    'not a url', 'http://hablar.example', 'https://localhost', 'https://127.0.0.1',
    'https://preview.replit.dev', 'https://preview.repl.co', 'https://hablar.example/path',
    'https://hablar.example?x=1', 'https://hablar.example#hash',
    'https://user:password@hablar.example', 'https://hablar.example:8443',
  ]) assert.throws(() => normalizeSiteOrigin(value), /SITE_ORIGIN/);
});

test('unrecognized routes cannot inherit a homepage canonical or structured data', () => {
  const head = seoHead('/missing', 'https://hablar.example');
  assert.match(head, /noindex, follow/);
  assert.doesNotMatch(head, /rel="canonical"|application\/ld\+json/);
});

test('built and served public pages share accurate metadata and crawl files', async () => {
  const output = await mkdtemp(path.join(tmpdir(), 'hablar-seo-'));
  const configFile = fileURLToPath(new URL('../vite.config.ts', import.meta.url));
  const previous = { PORT: process.env.PORT, BASE_PATH: process.env.BASE_PATH, SITE_ORIGIN: process.env.SITE_ORIGIN, NODE_ENV: process.env.NODE_ENV };
  Object.assign(process.env, { PORT: '18081', BASE_PATH: '/', NODE_ENV: 'production' });
  try {
    for (const origin of ['https://hablar.example', '']) {
      process.env.SITE_ORIGIN = origin;
      const options = { configFile, logLevel: 'error', build: { outDir: output } };
      await build(options);
      const server = await preview({ ...options, preview: { port: 0, host: '127.0.0.1' } });
      try {
        const base = `http://127.0.0.1:${server.httpServer.address().port}`;
        for (const route of publicPaths) {
          const html = await readFile(path.join(output, route.slice(1), 'index.html'), 'utf8');
          const response = await fetch(`${base}${route}`);
          assert.equal(response.status, 200);
          assert.equal(await response.text(), html);
          assert.equal((html.match(/<title\b/g) || []).length, 1);
          const { title, description } = pageMetadata(route);
          assert.ok(html.includes(title.replace(/&/g, '&amp;')));
          const escape = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
          for (const [attribute, name, value] of [
            ['name', 'description', description],
            ['property', 'og:title', title],
            ['property', 'og:description', description],
            ['name', 'twitter:title', title],
            ['name', 'twitter:description', description],
          ]) {
            assert.ok(html.includes(`${attribute}="${name}" content="${escape(value)}"`));
          }
          const graph = JSON.parse(html.match(/type="application\/ld\+json">([^<]+)<\/script>/)[1])['@graph'];
          assert.equal(graph[0]['@type'], 'Brand');
          assert.equal(graph[1]['@type'], 'WebSite');
          assert.doesNotMatch(html, /built on Replit|Update this description|replit\.dev|repl\.co/);
          assert.doesNotMatch(JSON.stringify(graph), /MedicalBusiness|LocalBusiness|ContactPoint|AggregateRating|Offer|telephone|address/);
          if (origin) {
            assert.ok(html.includes(`rel="canonical" href="${origin}${route}"`));
            assert.ok(html.includes(`property="og:url" content="${origin}${route}"`));
            assert.ok(html.includes(`name="twitter:url" content="${origin}${route}"`));
            assert.match(html, /content="index, follow"/);
          } else {
            assert.doesNotMatch(html, /rel="canonical"|property="og:url"/);
            assert.match(html, /content="noindex, follow"/);
          }
        }
        const robots = await fetch(`${base}/robots.txt`);
        assert.equal(robots.status, 200);
        const robotsText = await robots.text();
        const sitemap = await fetch(`${base}/sitemap.xml`);
        assert.equal(sitemap.status, 200);
        assert.match(sitemap.headers.get('content-type'), /xml/);
        const xml = await sitemap.text();
        assert.match(xml, /xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/);
        if (origin) {
          assert.match(robotsText, /Allow: \//);
          assert.ok(robotsText.includes(`Sitemap: ${origin}/sitemap.xml`));
          assert.deepEqual([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]), publicPaths.map((route) => origin + route));
        } else {
          assert.match(robotsText, /Disallow: \//);
          assert.doesNotMatch(robotsText, /Sitemap:/);
          assert.doesNotMatch(xml, /<loc>/);
        }
      } finally {
        await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
      }
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(output, { recursive: true, force: true });
  }
});
