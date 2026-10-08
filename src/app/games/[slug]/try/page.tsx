import type { Metadata } from 'next';
import { GameRouteHeader } from '@/components/learn/GameRouteHeader';
import { RouteShell } from '@/components/learn/RouteShell';
import { ScriptedExample } from '@/components/learn/ScriptedExample';
import {
  gamePageMetadata,
  gameStaticParams,
  requireGame,
  type SlugParams,
} from '@/components/learn/route-data';
import { PracticeHand } from '@/components/play/PracticeHand';
import { t } from '@/lib/i18n';

export const dynamicParams = false;

export function generateStaticParams() {
  return gameStaticParams();
}

export function generateMetadata({ params }: SlugParams): Promise<Metadata> {
  return gamePageMetadata(params, (g) => ({
    title: t('learn.meta.tryTitle', { name: g.name }),
    description: t('learn.meta.tryDescription', { name: g.name }),
    path: `/games/${g.slug}/try`,
  }));
}

export default async function TryPage({ params }: SlugParams) {
  const game = await requireGame(params);
  const header = (
    <GameRouteHeader
      slug={game.slug}
      name={game.name}
      kicker={t('learn.header.tryKicker')}
      title={t('learn.header.tryTitle', { name: game.name })}
    />
  );

  if (game.tier === 1 || !game.example) {
    return (
      <RouteShell testId="try-page">
        {header}
        <div className="mt-6 sm:mt-8">
          <PracticeHand slug={game.slug} gameName={game.name} tips={game.tips} />
        </div>
      </RouteShell>
    );
  }

  return (
    <RouteShell testId="try-page">
      {header}
      <ScriptedExample
        className="mt-6 sm:mt-8"
        slug={game.slug}
        name={game.name}
        glossary={game.glossary}
        example={game.example}
        tips={game.tips}
      />
    </RouteShell>
  );
}
