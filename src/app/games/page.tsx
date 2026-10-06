import type { Metadata } from 'next';
import { CatalogBrowser } from '@/components/catalog/CatalogBrowser';
import { buildCatalogIndex } from '@/components/catalog/catalog-index';
import { siteConfig } from '@/config/site';
import { getAllGames } from '@/lib/content/catalog';
import { t } from '@/lib/i18n';

const title = t('catalog.meta.title');
const description = t('catalog.meta.description');
/** The site-wide share image (src/app/opengraph-image.tsx). Setting `openGraph` here
 *  replaces the inherited Open Graph data, so the image is listed explicitly. */
const shareImage = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: t('landing.og.alt', { name: siteConfig.name, tagline: siteConfig.tagline }),
};

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/games' },
  openGraph: {
    title,
    description,
    url: '/games',
    type: 'website',
    siteName: siteConfig.name,
    images: [shareImage],
  },
  twitter: { card: 'summary_large_image', title, description, images: [shareImage] },
};

export default function GamesPage() {
  const index = buildCatalogIndex(getAllGames());
  return (
    <div className="relative overflow-x-clip">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(60%_70%_at_50%_0%,rgb(245_215_122/0.13),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 -left-40 h-[28rem] w-80 rotate-12 bg-[radial-gradient(closest-side,rgb(158_32_54/0.28),transparent)] max-md:hidden"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 -right-40 h-[28rem] w-80 -rotate-12 bg-[radial-gradient(closest-side,rgb(158_32_54/0.28),transparent)] max-md:hidden"
      />
      <div className="relative mx-auto max-w-[1200px] px-4 pt-10 pb-16 sm:px-6 sm:pt-14 lg:px-8">
        <header className="mx-auto max-w-2xl text-center">
          <p className="border-gold-300/40 bg-felt-950/50 text-gold-300 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold tracking-[0.24em] uppercase">
            <span aria-hidden="true" className="animate-bulb bg-gold-300 size-1.5 rounded-full" />
            {t('catalog.page.eyebrow')}
          </p>
          <h1 className="font-display text-foil mt-4 text-[2.5rem] leading-[1.05] font-black tracking-[-0.02em] text-balance sm:text-6xl">
            {t('catalog.page.title')}
          </h1>
          <p className="text-mist mt-4 text-base leading-relaxed text-pretty sm:text-lg">
            {t('catalog.page.intro')}
          </p>
        </header>
        <div className="mt-10 sm:mt-12">
          <CatalogBrowser index={index} />
        </div>
      </div>
    </div>
  );
}
