import type { Metadata } from 'next';
import { GameRouteHeader } from '@/components/learn/GameRouteHeader';
import { QuizRunner } from '@/components/learn/QuizRunner';
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
    title: t('learn.meta.quizTitle', { name: g.name }),
    description: t('learn.meta.quizDescription', { name: g.name }),
    path: `/games/${g.slug}/quiz`,
  }));
}

export default async function QuizPage({ params }: SlugParams) {
  const game = await requireGame(params);
  return (
    <RouteShell width="narrow" testId="quiz-page">
      <GameRouteHeader
        slug={game.slug}
        name={game.name}
        kicker={t('learn.header.quizKicker')}
        title={t('learn.header.quizTitle', { name: game.name })}
      />
      <QuizRunner
        className="mt-6 sm:mt-8"
        slug={game.slug}
        name={game.name}
        quiz={game.quiz}
        playable={game.tier === 1}
      />
    </RouteShell>
  );
}
