'use client';
/**
 * The game hub's journey buttons: Learn → Try → Play (Tier 1) → Quiz, each a
 * big ticket-stub link with a completion tick from the learner's progress.
 */
import Link from 'next/link';
import { type ComponentType } from 'react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import {
  BookIcon,
  CardsIcon,
  CheckIcon,
  TrophyIcon,
  TicketIcon,
  type IconProps,
} from '@/components/ui/icons';
import { t, type TKey } from '@/lib/i18n';
import { useHydrated } from '@/store/hydrate';
import { emptyProgress, statusOf, useProgress } from '@/store/progress';

export interface HubJourneyProps {
  slug: string;
  name: string;
  tier: 1 | 2;
  className?: string;
}

interface StepDef {
  id: 'learn' | 'try' | 'play' | 'quiz';
  href: string;
  title: TKey;
  hint: TKey;
  Icon: ComponentType<IconProps>;
}

export function HubJourney({ slug, name, tier, className }: HubJourneyProps) {
  const hydrated = useHydrated();
  const stored = useProgress((s) => s.games[slug]);
  const p = stored ?? emptyProgress();
  const status = statusOf(stored, tier);

  const steps: StepDef[] = [
    {
      id: 'learn',
      href: `/games/${slug}/learn`,
      title: 'catalog.hub.learn',
      hint: 'catalog.hub.learnHint',
      Icon: BookIcon,
    },
    {
      id: 'try',
      href: `/games/${slug}/try`,
      title: 'catalog.hub.try',
      hint: 'catalog.hub.tryHint',
      Icon: CardsIcon,
    },
    ...(tier === 1
      ? [
          {
            id: 'play' as const,
            href: `/games/${slug}/play`,
            title: 'catalog.hub.play' as const,
            hint: 'catalog.hub.playHint' as const,
            Icon: TicketIcon,
          },
        ]
      : []),
    {
      id: 'quiz',
      href: `/games/${slug}/quiz`,
      title: 'catalog.hub.quiz',
      hint: 'catalog.hub.quizHint',
      Icon: TrophyIcon,
    },
  ];

  const isDone = (id: StepDef['id']) => {
    if (!hydrated) return false;
    if (id === 'learn') return p.lessonDone;
    if (id === 'try') return p.exampleDone;
    if (id === 'play') return p.wins > 0;
    return (p.quizBest ?? 0) >= 3;
  };

  // Spotlight the first unfinished step ("Learn" until progress has loaded).
  const upNext = hydrated ? steps.find((s) => !isDone(s.id))?.id : 'learn';

  const meta = (id: StepDef['id']): string | null => {
    if (!hydrated) return null;
    if (id === 'quiz' && p.quizBest !== null)
      return t('catalog.hub.quizBest', { best: p.quizBest });
    if (id === 'play' && p.wins > 0) {
      return p.wins === 1 ? t('catalog.hub.winsOne') : t('catalog.hub.wins', { count: p.wins });
    }
    return null;
  };

  return (
    <section aria-labelledby="journey-heading" className={className} data-testid="hub-journey">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="journey-heading"
            className="font-display text-gold-100 text-2xl leading-tight font-bold sm:text-3xl"
          >
            {t('catalog.hub.journeyTitle', { name })}
          </h2>
          <p className="text-mist mt-1 text-sm">{t('catalog.hub.journeyIntro')}</p>
        </div>
        <div className="min-h-6">
          {hydrated ? (
            <Badge
              tone={status === 'mastered' ? 'velvet' : status === 'learned' ? 'gold' : 'mist'}
              data-testid="hub-status"
              data-status={status}
            >
              {t('catalog.card.statusLabel', { status: t(`catalog.card.status.${status}`) })}
            </Badge>
          ) : null}
        </div>
      </div>
      <ol
        className={cn(
          'mt-5 grid grid-cols-2 gap-3 sm:gap-4',
          steps.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
        )}
      >
        {steps.map((step, i) => {
          const done = isDone(step.id);
          const extra = meta(step.id);
          return (
            <li key={step.id} className="flex">
              <Link
                href={step.href}
                data-testid={`hub-${step.id}`}
                data-done={done || undefined}
                data-next={step.id === upNext || undefined}
                className={cn(
                  'group/step ease-glide relative flex w-full flex-col gap-2 overflow-hidden rounded-2xl border p-4 transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 sm:p-5',
                  step.id === upNext
                    ? 'border-gold-300/70 bg-[linear-gradient(180deg,rgb(245_215_122/0.16),rgb(245_215_122/0.04))] shadow-[0_14px_30px_-20px_rgb(245_215_122/0.6)]'
                    : 'border-gold-300/30 bg-felt-800/80 hover:border-gold-300/60',
                )}
              >
                {/* min-h fits the "Done" pill, so the row doesn't grow when progress loads. */}
                <span className="flex min-h-5 items-center justify-between gap-2">
                  <span className="text-gold-300 text-[0.6875rem] font-bold tracking-[0.18em] uppercase">
                    {t('catalog.hub.stepNumber', { n: i + 1 })}
                  </span>
                  {done ? (
                    <span className="bg-gold-300 text-ink inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-bold">
                      <CheckIcon size={12} />
                      {t('catalog.hub.done')}
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2.5">
                  <step.Icon size={24} className="text-gold-200 shrink-0" />
                  <span className="font-display text-cream group-hover/step:text-gold-100 text-xl leading-tight font-bold sm:text-2xl">
                    {t(step.title)}
                  </span>
                </span>
                <span className="text-mist text-sm leading-snug">{t(step.hint)}</span>
                {extra ? (
                  <span className="text-gold-200 text-xs font-bold tabular-nums">{extra}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
