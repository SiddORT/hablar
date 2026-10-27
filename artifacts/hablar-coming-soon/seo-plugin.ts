import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';
import { publicPaths, robotsText, seoHead, sitemapXml } from './src/lib/seo';

const start = '<!-- hablar-seo:start -->';
const end = '<!-- hablar-seo:end -->';

function replaceHead(html: string, route: string, origin: string) {
  const before = html.indexOf(start);
  const after = html.indexOf(end);
  if (before < 0 || after < before) throw new Error('HABLAR SEO head markers are missing.');
  return `${html.slice(0, before)}${start}\n${seoHead(route, origin)}\n${html.slice(after)}`;
}

export function seoPlugin(origin: string, base: string): Plugin {
  const routeFromUrl = (url: string) => {
    const pathname = new URL(url, 'https://local.invalid').pathname;
    const prefix = base.replace(/\/$/, '');
    const route = prefix && pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
    return route === '/index.html' ? '/' : route.replace(/\/$/, '') || '/';
  };
  return {
    name: 'hablar-seo',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        return replaceHead(html, routeFromUrl(context.originalUrl || context.path), origin);
      },
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const route = routeFromUrl(request.url || '/');
        if (route !== '/robots.txt' && route !== '/sitemap.xml') return next();
        response.setHeader('Content-Type', route === '/robots.txt' ? 'text/plain; charset=utf-8' : 'application/xml; charset=utf-8');
        response.end(route === '/robots.txt' ? robotsText(origin) : sitemapXml(origin));
      });
    },
    configurePreviewServer(server) {
      // Vite's SPA fallback otherwise returns the home head for extensionless
      // legal URLs, even when the route's index.html exists on disk.
      server.middlewares.use((request, _response, next) => {
        const route = routeFromUrl(request.url || '/');
        if (route === '/privacy' || route === '/terms') {
          request.url = `${base.replace(/\/$/, '')}${route}/index.html`;
        }
        next();
      });
    },
    async writeBundle(options) {
      if (!options.dir) throw new Error('HABLAR SEO requires a build output directory.');
      const html = await readFile(path.join(options.dir, 'index.html'), 'utf8');
      await Promise.all([
        writeFile(path.join(options.dir, 'robots.txt'), robotsText(origin)),
        writeFile(path.join(options.dir, 'sitemap.xml'), sitemapXml(origin)),
        ...publicPaths.filter((route) => route !== '/').map(async (route) => {
          const directory = path.join(options.dir!, route.slice(1));
          await mkdir(directory, { recursive: true });
          await writeFile(path.join(directory, 'index.html'), replaceHead(html, route, origin));
        }),
      ]);
    },
  };
}
