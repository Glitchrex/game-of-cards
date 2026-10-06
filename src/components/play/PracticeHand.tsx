'use client';
/**
 * The coached example hand for Tier 1 games: the REAL engine on a curated seed, with
 * legal moves glowing, the coach explaining every situation (and every illegal move),
 * and "What would a pro do?" on demand. No Jeet at stake.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertIcon, BookIcon, CardsIcon, SparkleIcon } from '@/components/ui/icons';
import { announce } from '@/components/layout/LiveAnnouncer';
import { type GameModule } from '@/games/core/module';
import { type GameConfig } from '@/games/core/types';
import { t } from '@/lib/i18n';
import { pickTip } from '@/lib/titles';
import { useHydrated } from '@/store/hydrate';
import { useProgress } from '@/store/progress';
import { BOT_DELAY_MS, useSettings } from '@/store/settings';
import { CoachPanel } from './CoachPanel';
import { MoveLog } from './MoveLog';
import { RatingPrompt } from './RatingPrompt';
import { seatPersonas, stripTipPrefix } from './personas';
import { TurnIndicator } from './Seat';
import { TableFrame, TableSkeleton } from './TableFrame';
import { HUMAN, learnerSituation, useGameController } from './useGameController';
import { useGameModule } from './useGameModule';

export interface PracticeHandProps {
  slug: string;
  gameName: string;
  /** The game's tips (content file); one is offered in the end-of-hand summary. */
  tips: string[];
}

export function PracticeHand({ slug, gameName, tips }: PracticeHandProps) {
  const { status, module: mod, retry } = useGameModule(slug);
  const hydrated = useHydrated();

  if (status === 'error') {
    return (
      <div data-testid="practice-hand" data-state="error" className="panel px-5 py-8 text-center">
        <AlertIcon size={28} className="text-velvet-300 mx-auto" />
        <p className="font-display text-gold-100 mt-3 text-xl font-bold">
          {t('play.shell.loadError')}
        </p>
        <p className="text-mist mt-1 text-sm">{t('play.shell.loadErrorHint')}</p>
        <Button className="mt-5" onClick={retry}>
          {t('play.shell.retry')}
        </Button>
      </div>
    );
  }
  if (!mod || !hydrated) {
    return (
      <div data-testid="practice-hand" data-state="loading">
        <TableSkeleton />
      </div>
    );
  }
  return <PracticeTable key={slug} mod={mod} slug={slug} gameName={gameName} tips={tips} />;
}

function PracticeTable({
  mod,
  slug,
  gameName,
  tips,
}: {
  mod: GameModule;
  slug: string;
  gameName: string;
  tips: string[];
}) {
  const botSpeed = useSettings((s) => s.botSpeed);
  const config = useMemo<GameConfig>(
    () => ({ ...mod.defaultConfig, ...mod.practice.config }),
    [mod.defaultConfig, mod.practice.config],
  );
  const [round, setRound] = useState(0);
  const [tip, setTip] = useState<string | null>(null);
  /** The tip shown after the previous hand, so "Try another" rotates through the list. */
  const lastTip = useRef<string | null>(null);
  const summaryRef = useRef<HTMLHeadingElement>(null);
  const tableRef = useRef<HTMLElement>(null);
  const summaryId = useId();

  const onOver = useCallback(() => {
    useProgress.getState().markExampleDone(slug);
    const next = pickTip(tips, lastTip.current) || null;
    lastTip.current = next;
    setTip(next);
  }, [slug, tips]);

  const c = useGameController({
    module: mod,
    config,
    seed: mod.practice.seed,
    difficulty: 'normal',
    botDelayMs: BOT_DELAY_MS[botSpeed],
    coachMode: true,
    onOver,
  });
  const personas = useMemo(() => seatPersonas(mod.bots), [mod.bots]);
  const Board = mod.Board;
  const humanMoved = c.log.some((e) => e.player === HUMAN);
  // While a bot plays, the coach keeps narrating from the learner's seat.
  const watching = c.thinking !== null;
  const view = useMemo(
    () => (watching ? learnerSituation(mod, c.state) : null),
    [watching, mod, c.state],
  );

  useEffect(() => {
    useProgress.getState().markStarted(slug);
  }, [slug]);

  useEffect(() => {
    if (c.over) summaryRef.current?.focus();
  }, [c.over]);

  // A new practice hand: the clicked button is gone, so start the learner at the table.
  useEffect(() => {
    if (round > 0) tableRef.current?.focus();
  }, [round]);

  const another = () => {
    const next = round + 1;
    setRound(next);
    setTip(null);
    c.restart(mod.practice.seed + next);
    announce(t('play.practice.restarted'));
  };

  const situation = c.over ? (
    <p>{c.result?.summary}</p>
  ) : (
    <div className="flex flex-col gap-2">
      {humanMoved ? null : <p data-testid="practice-intro">{mod.practice.intro}</p>}
      {c.advice ? (
        <p className={humanMoved ? undefined : 'text-mist'}>{c.advice.situation}</p>
      ) : c.thinking !== null ? (
        <>
          {view ? <p>{view}</p> : null}
          <p className="text-mist">
            {t(c.botForced ? 'play.practice.watching' : 'play.practice.waiting', {
              name: c.nameOf(c.thinking),
            })}
          </p>
        </>
      ) : null}
    </div>
  );

  const canHint = !c.over && c.advice !== null && c.advice.suggestion !== undefined;
  const autoplay = () => {
    if (c.advice?.suggestion !== undefined) c.attempt(c.advice.suggestion);
  };
  const hint =
    c.suggestedKey !== null && c.advice ? (c.advice.why ?? t('play.practice.hintFallback')) : null;

  return (
    <div
      data-testid="practice-hand"
      data-state={c.over ? 'over' : 'playing'}
      className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
    >
      <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
        <TableFrame
          ref={tableRef}
          tabIndex={-1}
          label={t('play.practice.region', { name: gameName })}
          header={
            <p className="font-display text-gold-100 text-xl leading-tight font-bold sm:text-2xl">
              {gameName}
            </p>
          }
          aside={
            <span
              data-testid="practice-ribbon"
              className="border-gold-200/70 text-ink inline-flex min-h-8 items-center gap-1.5 rounded-full border bg-[linear-gradient(180deg,var(--color-gold-200),var(--color-gold-400))] px-3 text-xs font-bold tracking-wide shadow-[0_6px_16px_-8px_rgb(245_215_122/0.9)]"
            >
              <SparkleIcon size={14} />
              {t('play.practice.ribbon')}
            </span>
          }
          status={
            <TurnIndicator
              yourTurn={c.current === HUMAN && !c.over}
              thinkingName={c.thinking !== null ? c.nameOf(c.thinking) : null}
              forced={c.botForced}
              over={c.over}
            />
          }
        >
          <Board
            state={c.state}
            human={HUMAN}
            legalMoves={c.legal}
            onMove={c.attempt}
            busy={c.busy}
            thinking={c.thinking}
            coachMode
            highlight={c.highlight}
            suggestedKey={c.suggestedKey}
            personas={personas}
            over={c.over}
          />
        </TableFrame>

        {c.over ? (
          <section
            aria-labelledby={summaryId}
            data-testid="practice-summary"
            className="panel relative overflow-hidden px-5 py-5 sm:px-6"
          >
            <span
              aria-hidden="true"
              className="marquee-bulbs animate-bulb pointer-events-none absolute inset-x-6 top-0 h-3.5 opacity-60"
            />
            <p className="text-gold-300 text-[0.6875rem] font-bold tracking-[0.22em] uppercase">
              {t('play.practice.summaryEyebrow')}
            </p>
            <h2
              id={summaryId}
              ref={summaryRef}
              tabIndex={-1}
              className="font-display text-foil mt-1 text-2xl font-bold outline-none sm:text-3xl"
            >
              {c.result?.humanOutcome === 'loss'
                ? t('play.practice.summaryTitleLoss')
                : c.result?.humanOutcome === 'push'
                  ? t('play.practice.summaryTitlePush')
                  : t('play.practice.summaryTitle')}
            </h2>
            <p className="text-cream mt-2 text-base leading-relaxed" data-testid="practice-result">
              {c.result?.summary}
            </p>
            {tip ? (
              <div
                data-testid="practice-tip"
                className="border-gold-300/40 bg-gold-300/10 mt-4 rounded-xl border px-3.5 py-3"
              >
                <p className="text-gold-200 text-xs font-bold tracking-[0.16em] uppercase">
                  {t('play.practice.tipTitle')}
                </p>
                <p className="text-cream mt-1 text-sm leading-relaxed">{stripTipPrefix(tip)}</p>
              </div>
            ) : null}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button href={`/games/${slug}/play`} leadingIcon={<CardsIcon size={20} />}>
                {t('play.practice.playForJeet')}
              </Button>
              <Button variant="secondary" onClick={another} data-testid="practice-again">
                {t('play.practice.another')}
              </Button>
              <Button
                variant="ghost"
                href={`/games/${slug}/quiz`}
                leadingIcon={<BookIcon size={18} />}
              >
                {t('play.practice.quiz')}
              </Button>
            </div>
            <RatingPrompt gameSlug={slug} context="lesson" className="mt-5" />
          </section>
        ) : null}
      </div>

      {/* Mobile: right under the table (never over the action buttons). Desktop: side column. */}
      <CoachPanel
        className="lg:col-start-2 lg:row-span-2 lg:row-start-1"
        situation={situation}
        error={c.lastError}
        errorKey={c.errorSeq}
        onHint={canHint ? c.showHint : undefined}
        onAutoplay={canHint ? autoplay : undefined}
        hintRevealed={hint}
      />

      <MoveLog log={c.log} recent={5} className="lg:col-start-1" />
    </div>
  );
}
