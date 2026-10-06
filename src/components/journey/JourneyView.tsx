'use client';
/**
 * The /journey page body: progress summary, a "Next up" ticket, the status legend
 * and the winding road map. Reads the persisted progress store after hydration;
 * before that the map renders neutral stops (still real links) and the summary
 * shows a skeleton.
 */
import { useId, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { MapIcon, SparkleIcon, TicketIcon, TrophyIcon } from '@/components/ui/icons';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { t } from '@/lib/i18n';
import { useHydrated } from '@/store/hydrate';
import { useProgress, type GameProgress, type LearnStatus } from '@/store/progress';
import {
  LEARN_STATUSES,
  nextStepFor,
  summarizeJourney,
  type GameSummary,
  type JourneySummary,
} from './journey-data';
import { JourneyMap } from './JourneyMap';
import { StatusBadge, StatusIcon, statusLabel } from './status';

export interface JourneyViewProps {
  /** Every game, in journey (content `order`) order. */
  games: readonly GameSummary[];
}

export function JourneyView({ games }: JourneyViewProps) {
  const hydrated = useHydrated();
  const progress = useProgress((s) => s.games);
  const summary = useMemo(() => summarizeJourney(games, progress), [games, progress]);

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <div className="grid items-stretch gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <SummaryPanel summary={hydrated ? summary : null} />
        <NextUpPanel games={games} summary={hydrated ? summary : null} progress={progress} />
      </div>
      <Legend />
      <section aria-labelledby="journey-map-heading">
        <h2 id="journey-map-heading" className="sr-only">
          {t('journey.map.label')}
        </h2>
        <JourneyMap
          games={games}
          statuses={hydrated ? summary.statuses : null}
          nextIndex={hydrated ? summary.nextIndex : -1}
        />
      </section>
    </div>
  );
}

function Counter({
  label,
  value,
  total,
  tone,
  testId,
}: {
  label: string;
  value: number;
  total?: number;
  tone: 'gold' | 'cream';
  testId: string;
}) {
  return (
    <div className="border-gold-300/20 bg-felt-950/45 flex flex-col justify-between gap-1 rounded-xl border px-3 py-2.5 sm:px-4">
      <dt className="text-gold-300 text-[0.6875rem] font-bold tracking-[0.16em] uppercase">
        {label}
      </dt>
      <dd className="flex flex-wrap items-baseline gap-x-1.5">
        <span
          data-testid={testId}
          className={cn(
            'tabular text-3xl leading-none font-extrabold',
            tone === 'gold' ? 'text-gold-100' : 'text-cream',
          )}
        >
          {value}
        </span>
        {total !== undefined ? (
          <span className="text-mist text-sm font-semibold">
            {t('journey.summary.ofTotal', { total })}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function SummaryPanel({ summary }: { summary: JourneySummary | null }) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      aria-busy={summary ? undefined : true}
      className="panel relative overflow-hidden p-5 sm:p-6"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-[radial-gradient(closest-side,rgb(245_215_122/0.16),transparent)]"
      />
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="border-gold-300/40 bg-felt-950/60 text-gold-200 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border"
        >
          <MapIcon size={22} />
        </span>
        <h2 id={headingId} className="font-display text-gold-100 text-2xl leading-tight font-bold">
          {t('journey.summary.heading')}
        </h2>
      </div>
      {summary ? (
        <>
          <p
            data-testid="journey-summary"
            className="text-cream mt-3 text-base leading-snug font-semibold"
          >
            {t('journey.summary.text', {
              learned: summary.learned,
              mastered: summary.mastered,
              total: summary.total,
            })}
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            <Counter
              label={t('journey.summary.learned')}
              value={summary.learned}
              total={summary.total}
              tone="gold"
              testId="journey-count-learned"
            />
            <Counter
              label={t('journey.summary.mastered')}
              value={summary.mastered}
              total={summary.total}
              tone="gold"
              testId="journey-count-mastered"
            />
            <Counter
              label={t('journey.summary.started')}
              value={summary.inProgress}
              tone="cream"
              testId="journey-count-learning"
            />
          </dl>
          <ProgressBar
            className="mt-5"
            label={t('journey.summary.barLabel')}
            value={summary.learned}
            max={Math.max(1, summary.total)}
            valueText={t('journey.summary.barValue', {
              learned: summary.learned,
              total: summary.total,
            })}
            size="lg"
          />
        </>
      ) : (
        <div className="mt-3">
          <p className="sr-only">{t('journey.loading')}</p>
          <div aria-hidden="true" className="flex flex-col gap-3">
            <span className="bg-mist/15 h-5 w-4/5 animate-pulse rounded" />
            <span className="grid grid-cols-3 gap-2 sm:gap-3">
              {[0, 1, 2].map((i) => (
                <span key={i} className="bg-felt-950/50 h-[4.25rem] animate-pulse rounded-xl" />
              ))}
            </span>
            <span className="bg-felt-950/60 mt-2 h-3.5 animate-pulse rounded-full" />
          </div>
        </div>
      )}
    </section>
  );
}

interface NextUpPanelProps {
  games: readonly GameSummary[];
  summary: JourneySummary | null;
  progress: Readonly<Record<string, GameProgress | undefined>>;
}

function NextUpPanel({ games, summary, progress }: NextUpPanelProps) {
  const headingId = useId();
  const game = summary && summary.nextIndex >= 0 ? games[summary.nextIndex] : undefined;
  const status = summary && game ? summary.statuses[summary.nextIndex] : undefined;
  const allDone = summary !== null && summary.total > 0 && summary.nextIndex < 0;

  return (
    <section
      aria-labelledby={headingId}
      data-testid="journey-next"
      className="border-gold-300/55 relative overflow-hidden rounded-2xl border-2 bg-[radial-gradient(120%_120%_at_0%_0%,rgb(158_32_54/0.9),rgb(116_22_40/0.85)_40%,rgb(10_53_36/0.95))] p-5 shadow-[0_18px_40px_-22px_rgb(194_47_71/0.9)] sm:p-6"
    >
      {/* ticket-stub perforation and punched notches */}
      <span
        aria-hidden="true"
        className="border-gold-300/35 pointer-events-none absolute inset-y-4 right-20 hidden border-r-2 border-dashed sm:block"
      />
      <span
        aria-hidden="true"
        className="bg-felt-900 border-gold-300/55 pointer-events-none absolute top-1/2 -left-4 size-8 -translate-y-1/2 rounded-full border-2"
      />
      <span
        aria-hidden="true"
        className="bg-felt-900 border-gold-300/55 pointer-events-none absolute top-1/2 -right-4 size-8 -translate-y-1/2 rounded-full border-2"
      />
      <TicketIcon
        size={72}
        className="text-gold-300/25 pointer-events-none absolute right-1 bottom-2 hidden -rotate-12 sm:block"
      />

      <h2
        id={headingId}
        className="text-gold-300 flex items-center gap-2 text-xs font-bold tracking-[0.24em] uppercase"
      >
        <SparkleIcon size={14} />
        {t('journey.next.eyebrow')}
      </h2>

      {!summary ? (
        // Sized like the real ticket (name, reason, two buttons that stack on phones)
        // so the map below doesn't jump when progress loads.
        <div aria-hidden="true" className="mt-3 flex flex-col gap-3 sm:pr-24">
          <span className="bg-cream/15 h-9 w-2/3 animate-pulse rounded" />
          <span className="bg-cream/10 h-4 w-5/6 animate-pulse rounded" />
          <span className="flex flex-wrap gap-2">
            <span className="bg-cream/10 h-12 w-48 animate-pulse rounded-xl max-sm:w-full" />
            <span className="bg-cream/5 h-12 w-44 animate-pulse rounded-xl max-sm:w-full" />
          </span>
        </div>
      ) : allDone ? (
        <div className="mt-3 flex flex-col gap-4 sm:pr-24">
          <p className="font-display text-cream text-xl leading-snug font-bold italic">
            <TrophyIcon size={22} className="text-gold-200 mr-2 inline-block align-[-3px]" />
            {t('journey.next.allDone')}
          </p>
          <Button href="/games" className="self-start max-sm:w-full">
            {t('journey.next.allDoneCta')}
          </Button>
        </div>
      ) : game && status && status !== 'mastered' ? (
        <NextUpBody game={game} status={status} progress={progress[game.slug]} />
      ) : null}
    </section>
  );
}

function NextUpBody({
  game,
  status,
  progress,
}: {
  game: GameSummary;
  status: Exclude<LearnStatus, 'mastered'>;
  progress: GameProgress | undefined;
}) {
  const step = nextStepFor(game.slug, game.tier, progress);
  return (
    <div className="mt-2 flex flex-col gap-3 sm:pr-24">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p
          data-testid="journey-next-game"
          className="font-display text-foil text-[2rem] leading-[1.05] font-black tracking-[-0.01em] italic"
        >
          {game.name}
        </p>
        <StatusBadge status={status} />
      </div>
      <p className="text-cream/90 text-sm leading-relaxed">{t(`journey.next.why.${status}`)}</p>
      <div className="flex flex-wrap gap-2">
        <Button href={step.href} data-testid="journey-next-cta" className="max-sm:w-full">
          {t(`journey.next.steps.${step.id}`)}
        </Button>
        <Button href={`/games/${game.slug}`} variant="ghost" className="max-sm:w-full">
          {t('journey.next.hub', { name: game.name })}
        </Button>
      </div>
    </div>
  );
}

function Legend() {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-gold-300 text-xs font-bold tracking-[0.24em] uppercase">
        {t('journey.map.legend')}
      </h2>
      <ul role="list" className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {LEARN_STATUSES.map((status) => (
          <li
            key={status}
            className="border-gold-300/15 bg-felt-950/40 flex items-center gap-3 rounded-xl border px-3 py-2.5"
          >
            <span
              aria-hidden="true"
              className={cn(
                'inline-flex size-9 shrink-0 items-center justify-center rounded-full',
                LEGEND_CIRCLE[status],
              )}
            >
              <StatusIcon status={status} size={18} />
            </span>
            <span className="min-w-0">
              <span className="text-cream block text-sm font-bold">{statusLabel(status)}</span>
              <span className="text-mist block text-xs leading-snug">
                {t(`journey.statusHint.${status}`)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const LEGEND_CIRCLE: Record<LearnStatus, string> = {
  'not-started': 'border-2 border-dashed border-mist/40 bg-felt-900 text-mist/80',
  learning: 'border-[3px] border-gold-300 bg-felt-950 text-gold-200',
  learned:
    'border-2 border-gold-100/80 bg-[linear-gradient(180deg,var(--color-gold-200),var(--color-gold-400)_60%,var(--color-gold-500))] text-ink',
  mastered:
    'border-2 border-gold-100 bg-[radial-gradient(circle_at_35%_30%,var(--color-gold-100),var(--color-gold-300)_45%,var(--color-gold-600))] text-ink shadow-[0_0_14px_rgb(245_215_122/0.5)]',
};
