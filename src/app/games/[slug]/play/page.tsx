import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GameRouteHeader } from '@/components/learn/GameRouteHeader';
import { RouteShell } from '@/components/learn/RouteShell';
import { siteConfig } from '@/config/site';
import { TIER1_SLUGS } from '@/games/registry.generated';
import { getGame, type CatalogGame } from '@/lib/content/catalog';
import { t } from '@/lib/i18n';
import { parsePlayParams, type SearchParams } from './params';
import { PlayClient } from './PlayClient';

interface PlayPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}

/** Only Tier 1 games (with an engine + board) have a play page. */
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return TIER1_SLUGS.map((slug) => ({ slug }));
}

function playableGame(slug: string): CatalogGame | null {
  if (!TIER1_SLUGS.includes(slug)) return null;
  return getGame(slug) ?? null;
}

export async function generateMetadata({
  params,
}: Pick<PlayPageProps, 'params'>): Promise<Metadata> {
  const { slug } = await params;
  const game = playableGame(slug);
  if (!game) return {};
  const title = t('play.meta.title', { name: game.name });
  const description = t('play.meta.description', { name: game.name });
  const path = `/games/${game.slug}/play`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: 'website', siteName: siteConfig.name },
  };
}

export default async function PlayPage({ params, searchParams }: PlayPageProps) {
  const { slug } = await params;
  const game = playableGame(slug);
  if (!game) notFound();
  const { seed, difficulty } = parsePlayParams(await searchParams);

  return (
    <RouteShell testId="play-page">
      <GameRouteHeader
        slug={game.slug}
        name={game.name}
        kicker={t('play.page.kicker')}
        title={t('play.page.heading', { name: game.name })}
      />
      <p className="text-cream/90 mt-3 max-w-2xl text-base leading-relaxed">
        {t('play.page.intro')}
      </p>
      <div className="mt-6 sm:mt-8">
        <PlayClient
          slug={game.slug}
          gameName={game.name}
          tips={game.tips}
          seed={seed}
          difficulty={difficulty}
        />
      </div>
    </RouteShell>
  );
}
