import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

/** Crawl everything except the admin area and the JSON API. */
export default function robots(): MetadataRoute.Robots {
  const base = siteConfig.url.replace(/\/+$/, '');
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
