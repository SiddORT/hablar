export const landingTitle = 'HABLAR — A Human Listening Space, Coming Soon';
export const landingDescription = 'HABLAR is developing a human listening space. Discover our purpose and philosophy, read the Privacy Notice, and request one launch update.';

export const publicPaths = ['/', '/privacy'] as const;

export function normalizeSiteOrigin(value: string): string {
  if (!value.trim()) return '';
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('SITE_ORIGIN must be an absolute HTTPS origin.');
  }
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash || url.port ||
      url.hostname === 'localhost' || !url.hostname.includes('.') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) ||
      url.hostname.endsWith('.replit.dev') || url.hostname.endsWith('.repl.co')) {
    throw new Error('SITE_ORIGIN must be a public HTTPS origin, without a path, credentials, port, query, or preview host.');
  }
  return url.origin;
}

export function pageMetadata(path: string) {
  if (path === '/') return { title: landingTitle, description: landingDescription };
  if (path === '/privacy') {
    const title = 'Privacy Notice';
    return {
      title: `${title} | HABLAR`,
      description: 'How HABLAR’s current pre-launch website and optional launch-update form use the information you provide.',
    };
  }
  return { title: 'Page Not Found | HABLAR', description: 'This page could not be found. Return to the HABLAR pre-launch website.' };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!);
}

export function seoHead(path: string, origin: string) {
  const { title, description } = pageMetadata(path);
  const isPublic = publicPaths.some((publicPath) => publicPath === path);
  const canonical = origin && isPublic ? `${origin}${path}` : '';
  const meta = (attribute: string, key: string, content: string) =>
    `<meta data-hablar-seo ${attribute}="${key}" content="${escapeHtml(content)}" />`;
  const graph: Record<string, unknown>[] = [
    { '@type': 'Brand', name: 'HABLAR', description: 'A pre-launch project developing a human listening space.' },
    {
      '@type': 'WebSite', name: 'HABLAR', description: landingDescription, inLanguage: 'en',
      ...(origin ? { '@id': `${origin}/#website`, url: `${origin}/` } : {}),
    },
    ...(canonical ? [{
      '@type': 'WebPage', name: title, description, url: canonical,
      isPartOf: { '@id': `${origin}/#website` },
    }] : []),
  ];
  return [
    `<title data-hablar-seo>${escapeHtml(title)}</title>`,
    meta('name', 'description', description),
    meta('name', 'robots', canonical ? 'index, follow' : 'noindex, follow'),
    meta('property', 'og:title', title),
    meta('property', 'og:description', description),
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', 'HABLAR'),
    meta('name', 'twitter:card', 'summary'),
    meta('name', 'twitter:title', title),
    meta('name', 'twitter:description', description),
    ...(canonical ? [
      `<link data-hablar-seo rel="canonical" href="${escapeHtml(canonical)}" />`,
      meta('property', 'og:url', canonical),
      meta('name', 'twitter:url', canonical),
    ] : []),
    ...(isPublic ? [
      `<script data-hablar-seo type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org', '@graph': graph,
      }).replace(/</g, '\\u003c')}</script>`,
    ] : []),
  ].join('\n');
}

export function robotsText(origin: string) {
  return origin
    ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
}

export function sitemapXml(origin: string) {
  const entries = origin
    ? publicPaths.map((path) => `  <url><loc>${escapeHtml(`${origin}${path}`)}</loc></url>`).join('\n')
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}
