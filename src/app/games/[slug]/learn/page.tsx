import type { Metadata } from 'next';
import { GameRouteHeader } from '@/components/learn/GameRouteHeader';
import { LessonPlayer } from '@/components/learn/LessonPlayer';
import { RouteShell } from '@/components/learn/RouteShell';
import {
  gamePageMetadata,
  gameStaticParams,
  requireGame,
  type SlugParams,
} from '@/components/learn/route-data';
import { t } from '@/lib/i18n';

export const dynamicParams = false;

export function generateStaticParams() {
  return gameStaticParams();
}

export function generateMetadata({ params }: SlugParams): Promise<Metadata> {
  return gamePageMetadata(params, (g) => ({
    title: t('learn.meta.learnTitle', { name: g.name }),
    description: t('learn.meta.learnDescription', { name: g.name }),
    path: `/games/${g.slug}/learn`,
  }));
}

export default async function LearnPage({ params }: SlugParams) {
  const game = await requireGame(params);
  return (
    <RouteShell testId="learn-page">
      <GameRouteHeader
        slug={game.slug}
        name={game.name}
        kicker={t('learn.header.learnKicker')}
        title={t('learn.header.learnTitle', { name: game.name })}
      />
      <LessonPlayer
        className="mt-6 sm:mt-8"
        game={{
          slug: game.slug,
          name: game.name,
          lesson: game.lesson.map((s) => ({
            title: s.title,
            body: s.body,
            ...(s.scene ? { scene: s.scene } : {}),
            ...(s.tip ? { tip: s.tip } : {}),
          })),
          glossary: game.glossary,
        }}
      />
    </RouteShell>
  );
}
