import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

/** Web app manifest: installable, felt-green theme, the GoC marquee icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: siteConfig.description,
    // A stable app identity, so a future start_url change never forks installed copies.
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#062417',
    theme_color: '#062417',
    categories: ['education', 'games', 'entertainment'],
    lang: 'en',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
