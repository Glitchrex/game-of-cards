/**
 * The landing page (/): hero → "Now showing" posters → "How it works" → games from
 * around the world → closing CTA. Server component: everything static is rendered on the
 * server; only the DeckShowcase and the "Pick a game for me" trigger hydrate.
 */
import { siteConfig } from '@/config/site';
import { type CatalogGame } from '@/lib/content/catalog';
import { t } from '@/lib/i18n';
import { AroundTheWorld } from './AroundTheWorld';
import { ClosingCta } from './ClosingCta';
import { Hero } from './Hero';
import { HowItWorks } from './HowItWorks';
import { NowShowing } from './NowShowing';
import { toPickableGame } from './pick-data';

/** Most posters the "Now showing" row shows. */
export const MAX_FEATURED = 6;

/** Featured games (catalog order); falls back to the first few games if none are flagged. */
export function featuredGames<G extends Pick<CatalogGame, 'featured'>>(games: readonly G[]): G[] {
  const flagged = games.filter((g) => g.featured);
  return (flagged.length > 0 ? flagged : games).slice(0, MAX_FEATURED);
}

function WebsiteJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: `${siteConfig.url.replace(/\/+$/, '')}/`,
    description: t('landing.jsonLd.description'),
    inLanguage: 'en',
  };
  return (
    <script
      type="application/ld+json"
      // JSON-LD must be inline; "<" is escaped so the payload can never close the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

export interface LandingPageProps {
  games: readonly CatalogGame[];
}

export function LandingPage({ games }: LandingPageProps) {
  return (
    <>
      <WebsiteJsonLd />
      <Hero games={games.map(toPickableGame)} gameCount={games.length} />
      <NowShowing games={featuredGames(games)} totalCount={games.length} />
      <HowItWorks />
      <AroundTheWorld games={games} />
      <ClosingCta />
    </>
  );
}
