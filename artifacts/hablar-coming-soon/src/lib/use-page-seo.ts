import { useEffect } from 'react';
import { seoHead } from './seo';

declare const __SITE_ORIGIN__: string;

export function usePageSeo(location: string) {
  useEffect(() => {
    const route = location.split(/[?#]/)[0].replace(/\/$/, '') || '/';
    document.head.querySelectorAll('[data-hablar-seo]').forEach((element) => element.remove());
    document.head.insertAdjacentHTML('beforeend', seoHead(route, __SITE_ORIGIN__));
  }, [location]);
}
