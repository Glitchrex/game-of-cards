'use client';
/**
 * "Pick a game for me": three quick questions (players → mood → time), one per screen
 * with big tappable answers, then the recommender's top pick as a result card with
 * "Learn it" / "Try it", two runner-ups and "Start over".
 *
 * Loaded lazily by <PickAGame/> so none of this is in the landing page's first bundle.
 *
 * Keyboard & screen readers: the Dialog traps focus and restores it to the opener;
 * every screen change moves focus to that screen's heading, and the pick is announced.
 */
import { motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { announce } from '@/components/layout/LiveAnnouncer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import { BookIcon, CardsIcon, ChevronRightIcon } from '@/components/ui/icons';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { type Mood } from '@/lib/content/schema';
import { t, type TKey } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import {
  recommendGames,
  type PlayersAnswer,
  type RecommendAnswers,
  type Recommendation,
  type TimeAnswer,
} from '@/lib/recommend';
import {
  MOOD_ANSWERS,
  PLAYERS_ANSWERS,
  TIME_ANSWERS,
  flagEmoji,
  playerRange,
  type PickAGameDialogProps,
  type PickableGame,
} from './pick-data';
import { MOOD_ICONS, PLAYERS_ICONS, TIME_ICONS } from './pick-icons';

type QuestionId = keyof RecommendAnswers;
type AnswerValue = PlayersAnswer | Mood | TimeAnswer;

interface Question {
  id: QuestionId;
  options: readonly AnswerValue[];
  icons: Readonly<Record<string, ReactNode>>;
}

const QUESTIONS: readonly Question[] = [
  { id: 'players', options: PLAYERS_ANSWERS, icons: PLAYERS_ICONS },
  { id: 'mood', options: MOOD_ANSWERS, icons: MOOD_ICONS },
  { id: 'time', options: TIME_ANSWERS, icons: TIME_ICONS },
];
const TOTAL = QUESTIONS.length;
const RUNNERS_UP = 2;

/**
 * Each new screen settles in with a quick fade and a slight zoom (DESIGN: standard
 * 250–350 ms). Scale only, never a slide: a translated child would briefly overflow the
 * dialog's scrolling body and flash a scrollbar. The first screen of an opening doesn't
 * animate (the panel itself is springing in), and reduced motion swaps screens instantly.
 */
function ScreenTransition({ animate, children }: { animate: boolean; children: ReactNode }) {
  if (!animate) return <div>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformOrigin: '50% 0' }}
    >
      {children}
    </motion.div>
  );
}

/** Copy for one answer, e.g. landing.pick.mood.lucky.label → "Feeling lucky". */
function answerText(q: QuestionId, value: AnswerValue, part: 'label' | 'hint'): string {
  return t(`landing.pick.${q}.${value}.${part}` as TKey);
}

function isComplete(a: Partial<RecommendAnswers>): a is RecommendAnswers {
  return a.players !== undefined && a.mood !== undefined && a.time !== undefined;
}

export function PickAGameDialog({ open, onClose, games }: PickAGameDialogProps) {
  /** 0..2 = questions, 3 = result. */
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<RecommendAnswers>>({});
  /** False until the visitor moves past the first screen of this opening. */
  const [moved, setMoved] = useState(false);
  const reduce = useReducedMotionPref();
  // Every fresh opening starts from question 1 (reset while rendering, not in an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setStep(0);
      setAnswers({});
      setMoved(false);
    }
  }

  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    // The Dialog focuses the first heading itself when it opens.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const picks = useMemo<Recommendation<PickableGame>[]>(
    () => (isComplete(answers) ? recommendGames(games, answers) : []),
    [games, answers],
  );

  const choose = (q: QuestionId, value: AnswerValue) => {
    const next = { ...answers, [q]: value } as Partial<RecommendAnswers>;
    setAnswers(next);
    setMoved(true);
    setStep((s) => Math.min(TOTAL, s + 1));
    if (isComplete(next) && step === TOTAL - 1) {
      const top = recommendGames(games, next)[0];
      announce(
        top
          ? t('landing.pick.result.announce', { name: top.game.name, reason: top.reason })
          : t('landing.pick.empty.title'),
      );
    }
  };

  const restart = () => {
    setAnswers({});
    setMoved(true);
    setStep(0);
  };

  const back = () => {
    setMoved(true);
    setStep((s) => Math.max(0, s - 1));
  };

  const question = QUESTIONS[step];
  const onResult = step >= TOTAL;
  const progressText = onResult
    ? t('landing.pick.resultProgress')
    : t('landing.pick.progress', { n: step + 1, total: TOTAL });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('landing.pick.title')}
      eyebrow={onResult ? t('landing.pick.resultEyebrow') : t('landing.pick.eyebrow')}
      description={onResult ? undefined : t('landing.pick.description')}
      initialFocusRef={headingRef}
      size="md"
    >
      <div data-testid="pick-dialog" data-step={onResult ? 'result' : question?.id}>
        <div className="mb-5">
          <p aria-hidden="true" className="text-mist mb-1.5 text-[0.8125rem] font-semibold">
            {progressText}
          </p>
          <ProgressBar
            value={Math.min(step + 1, TOTAL)}
            max={TOTAL}
            label={t('landing.pick.progressLabel')}
            valueText={progressText}
            size="sm"
          />
        </div>
        <ScreenTransition key={question?.id ?? 'result'} animate={moved && !reduce}>
          {question ? (
            <QuestionScreen
              question={question}
              selected={answers[question.id]}
              headingRef={headingRef}
              onChoose={(v) => choose(question.id, v)}
              onBack={step > 0 ? back : undefined}
            />
          ) : (
            <ResultScreen picks={picks} headingRef={headingRef} onRestart={restart} />
          )}
        </ScreenTransition>
      </div>
    </Dialog>
  );
}

function QuestionScreen({
  question,
  selected,
  headingRef,
  onChoose,
  onBack,
}: {
  question: Question;
  selected: AnswerValue | undefined;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onChoose: (value: AnswerValue) => void;
  onBack?: () => void;
}) {
  const headingId = `pick-q-${question.id}`;
  return (
    <div role="group" aria-labelledby={headingId}>
      <h3
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-gold-100 text-[1.625rem] leading-tight font-bold outline-none sm:text-3xl"
      >
        {t(`landing.pick.questions.${question.id}`)}
      </h3>
      <ul
        className={cn(
          'mt-4 grid grid-cols-2 gap-2.5 sm:gap-3',
          question.options.length % 2 === 1 && '[&>li:last-child]:col-span-2',
          question.options.length === 3 && 'sm:grid-cols-3 sm:[&>li:last-child]:col-span-1',
        )}
      >
        {question.options.map((value) => {
          const isSelected = selected === value;
          return (
            <li key={value}>
              <button
                type="button"
                data-testid={`pick-answer-${value}`}
                aria-pressed={isSelected}
                onClick={(e) => {
                  // Answering moves straight on, so the second click of a double-click would
                  // land on the next question's answer in the same spot. Ignore it.
                  if (e.detail > 1) return;
                  onChoose(value);
                }}
                className={cn(
                  'group ease-snap flex h-full min-h-[6.25rem] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border px-3 py-3 text-center transition-[transform,background-color,border-color,box-shadow] duration-150 active:scale-[0.98]',
                  isSelected
                    ? 'border-gold-200 bg-gold-300 text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.55),0_8px_22px_-10px_rgb(236_193_83/0.9)]'
                    : 'border-gold-300/30 bg-felt-900/70 text-cream hover:border-gold-300/80 hover:bg-felt-700/70 hover:shadow-[0_10px_24px_-14px_rgb(245_215_122/0.6)]',
                )}
              >
                <span
                  className={cn(
                    'inline-flex transition-transform duration-150 group-hover:-translate-y-0.5',
                    isSelected ? 'text-ink' : 'text-gold-300',
                  )}
                >
                  {question.icons[value]}
                </span>
                <span className="text-base leading-tight font-bold">
                  {answerText(question.id, value, 'label')}
                </span>{' '}
                <span
                  className={cn(
                    'text-[0.8125rem] leading-snug',
                    isSelected ? 'text-ink/80' : 'text-mist',
                  )}
                >
                  {answerText(question.id, value, 'hint')}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {onBack ? (
        <div className="mt-4">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="pick-back">
            <span aria-hidden="true">←</span> {t('landing.pick.back')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Facts({ game }: { game: PickableGame }) {
  const items = [
    game.players.max === 1
      ? t('landing.pick.result.playersOne')
      : t('landing.pick.result.players', { range: playerRange(game.players) }),
    t('landing.pick.result.minutes', { minutes: game.minutes }),
    t('landing.pick.result.difficulty', { level: game.difficulty }),
  ];
  return (
    <ul className="text-mist mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="bg-gold-400 size-1.5 rounded-full" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function ResultScreen({
  picks,
  headingRef,
  onRestart,
}: {
  picks: readonly Recommendation<PickableGame>[];
  headingRef: RefObject<HTMLHeadingElement | null>;
  onRestart: () => void;
}) {
  const top = picks[0];
  if (!top) {
    return (
      <div className="py-2 text-center" data-testid="pick-empty">
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-gold-100 text-2xl font-bold outline-none"
        >
          {t('landing.pick.empty.title')}
        </h3>
        <p className="text-mist mt-2">{t('landing.pick.empty.body')}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button href="/games">{t('landing.pick.empty.browse')}</Button>
          <Button variant="ghost" onClick={onRestart} data-testid="pick-restart">
            {t('landing.pick.restart')}
          </Button>
        </div>
      </div>
    );
  }
  const { game, reason } = top;
  const runnersUp = picks.slice(1, 1 + RUNNERS_UP);
  return (
    <div>
      <article
        data-testid="pick-result"
        data-slug={game.slug}
        aria-labelledby="pick-result-name"
        className="border-gold-300/45 relative overflow-hidden rounded-2xl border bg-[linear-gradient(160deg,rgb(116_22_40/0.55),rgb(3_17_11/0.85)_60%)] p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_18px_40px_-24px_rgb(0_0_0/0.9)] sm:p-6"
      >
        <div
          aria-hidden="true"
          className="marquee-bulbs pointer-events-none absolute inset-x-4 top-1.5 h-2 opacity-70"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-[radial-gradient(closest-side,rgb(245_215_122/0.22),transparent)]"
        />
        <p className="text-gold-300 relative mt-1 text-[0.6875rem] font-bold tracking-[0.22em] uppercase">
          {t('landing.pick.result.heading')}
        </p>
        <h3
          id="pick-result-name"
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-foil relative mt-1 text-4xl leading-[1.05] font-black tracking-[-0.01em] outline-none sm:text-5xl"
        >
          {game.name}
        </h3>
        <div className="relative mt-2 flex flex-wrap items-center gap-2">
          <span className="text-cream text-sm font-semibold">
            <span aria-hidden="true">{flagEmoji(game.countryCode)} </span>
            {game.country}
          </span>
          {game.tier === 1 ? (
            <Badge tone="gold" size="sm">
              {t('landing.pick.result.playable')}
            </Badge>
          ) : null}
        </div>
        <p className="text-cream relative mt-4 text-base leading-relaxed font-medium">{reason}</p>
        <p className="text-mist relative mt-2 text-[0.9375rem] leading-relaxed">{game.hook}</p>
        <Facts game={game} />
        <div className="relative mt-5 grid grid-cols-1 gap-2.5 min-[22.5rem]:grid-cols-2">
          <Button
            href={`/games/${game.slug}/learn`}
            data-testid="pick-learn"
            aria-label={t('landing.pick.result.learnLabel', { name: game.name })}
            leadingIcon={<BookIcon size={18} />}
            fullWidth
          >
            {t('landing.pick.result.learn')}
          </Button>
          <Button
            href={`/games/${game.slug}/try`}
            variant="secondary"
            data-testid="pick-try"
            aria-label={t('landing.pick.result.tryLabel', { name: game.name })}
            leadingIcon={<CardsIcon size={18} />}
            fullWidth
          >
            {t('landing.pick.result.try')}
          </Button>
        </div>
      </article>

      {runnersUp.length > 0 ? (
        <div className="mt-5">
          <p id="pick-runners-up" className="text-mist text-sm font-semibold">
            {t('landing.pick.result.runnersUp')}
          </p>
          <ul aria-labelledby="pick-runners-up" className="mt-2 flex flex-wrap gap-2">
            {runnersUp.map(({ game: g }) => (
              <li key={g.slug}>
                <Link
                  href={`/games/${g.slug}`}
                  data-testid={`pick-runner-up-${g.slug}`}
                  className="border-felt-500 bg-felt-900/80 text-cream hover:border-gold-300/70 hover:text-gold-100 ease-snap inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-[border-color,color,transform] duration-150 active:scale-[0.97]"
                >
                  <span aria-hidden="true">{flagEmoji(g.countryCode)}</span>
                  {g.name}
                  <ChevronRightIcon size={16} className="text-gold-300 -mr-1" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-gold-300/15 mt-5 flex justify-end border-t pt-3">
        <Button variant="ghost" size="sm" onClick={onRestart} data-testid="pick-restart">
          {t('landing.pick.restart')}
        </Button>
      </div>
    </div>
  );
}
