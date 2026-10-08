'use client';
/**
 * Five-question quiz: one question per screen, big answer buttons (arrow keys
 * move between them, 1–4 or Enter answers), instant feedback with the right
 * answer marked by icon + text, then a score card with the best score.
 */
import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { announce } from '@/components/layout/LiveAnnouncer';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { cn } from '@/components/ui/cn';
import { CheckIcon, CloseIcon } from '@/components/ui/icons';
import { t, type TKey } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { useHydrated } from '@/store/hydrate';
import { useProgress } from '@/store/progress';
import { useFocusOnMount, useRecordWhen } from './hooks';
import { focusOwnsKeys, hasModifier } from './keys';
import { FeedbackNote, Kicker } from './parts';

export interface QuizQuestionData {
  question: string;
  options: readonly string[];
  answer: number;
  explanation: string;
}

export interface QuizRunnerProps {
  slug: string;
  name: string;
  quiz: readonly QuizQuestionData[];
  /** Show a "Play vs bot" link on the score card (Tier 1 games). */
  playable?: boolean;
  className?: string;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

/** The fun line for a score, by band. */
export function scoreBandKey(score: number, total: number): TKey {
  const ratio = total > 0 ? score / total : 0;
  if (ratio >= 1) return 'learn.quiz.band5';
  if (ratio >= 0.8) return 'learn.quiz.band4';
  if (ratio >= 0.6) return 'learn.quiz.band3';
  if (ratio >= 0.4) return 'learn.quiz.band2';
  return 'learn.quiz.band0';
}

interface QuestionProps {
  q: QuizQuestionData;
  index: number;
  total: number;
  chosen: number | null;
  focusHeading: boolean;
  onChoose: (option: number) => void;
  onNext: () => void;
}

function QuestionScreen({
  q,
  index,
  total,
  chosen,
  focusHeading,
  onChoose,
  onNext,
}: QuestionProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>(focusHeading);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const answered = chosen !== null;
  const correct = chosen === q.answer;
  const qId = `quiz-q-${index}`;
  const isLast = index === total - 1;

  // After answering, hand focus to "Next" so Enter keeps the quiz moving.
  useEffect(() => {
    if (answered) nextRef.current?.focus();
  }, [answered]);

  const moveFocus = (to: number) => {
    const n = q.options.length;
    const next = (to + n) % n;
    setFocusIndex(next);
    optionRefs.current[next]?.focus();
  };

  const onGroupKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const keys: Record<string, () => void> = {
      ArrowDown: () => moveFocus(focusIndex + 1),
      ArrowRight: () => moveFocus(focusIndex + 1),
      ArrowUp: () => moveFocus(focusIndex - 1),
      ArrowLeft: () => moveFocus(focusIndex - 1),
      Home: () => moveFocus(0),
      End: () => moveFocus(q.options.length - 1),
    };
    const action = keys[e.key];
    if (action) {
      e.preventDefault();
      action();
    }
  };

  return (
    <div>
      <h2
        ref={headingRef}
        id={qId}
        tabIndex={-1}
        className="font-display text-gold-100 text-[1.5rem] leading-snug font-bold text-balance outline-none sm:text-3xl"
      >
        <span className="sr-only">
          {t('learn.quiz.questionOf', { current: index + 1, total })}:
        </span>{' '}
        {q.question}
      </h2>

      <div
        role="group"
        aria-labelledby={qId}
        onKeyDown={onGroupKeyDown}
        className="mt-6 grid gap-3"
        data-quiz-options=""
      >
        {q.options.map((option, i) => {
          const isChosen = chosen === i;
          const isAnswer = i === q.answer;
          const showRight = answered && isAnswer;
          const showWrong = answered && isChosen && !isAnswer;
          let srState = '';
          if (showRight) srState = isChosen ? t('learn.quiz.srCorrect') : t('learn.quiz.srRight');
          else if (showWrong) srState = t('learn.quiz.srWrong');
          return (
            <button
              key={i}
              ref={(el) => {
                optionRefs.current[i] = el;
              }}
              type="button"
              tabIndex={i === focusIndex ? 0 : -1}
              aria-disabled={answered || undefined}
              data-testid={`quiz-option-${i}`}
              data-state={showRight ? 'correct' : showWrong ? 'wrong' : undefined}
              onFocus={() => setFocusIndex(i)}
              onClick={() => {
                if (!answered) onChoose(i);
              }}
              className={cn(
                'group/opt ease-snap relative flex min-h-16 w-full items-center gap-4 rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold transition-[transform,background-color,border-color,box-shadow] duration-150 sm:text-[1.0625rem]',
                !answered &&
                  'bg-parchment text-ink hover:border-gold-500 border-transparent shadow-[0_8px_18px_-12px_rgb(0_0_0/0.9)] hover:-translate-y-0.5 active:translate-y-0',
                showRight &&
                  'border-gold-300 bg-gold-300 text-ink shadow-[0_0_0_3px_rgb(245_215_122/0.35)]',
                showWrong && 'border-velvet-400 bg-velvet-700/60 text-cream',
                answered && !showRight && !showWrong && 'bg-felt-800/80 text-mist border-felt-600',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'inline-flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black',
                  !answered && 'border-ink/25 bg-ivory text-ink',
                  showRight && 'border-ink/30 bg-ivory text-ink',
                  showWrong && 'border-velvet-300 bg-velvet-500 text-cream',
                  answered && !showRight && !showWrong && 'border-felt-500 text-mist',
                )}
              >
                {showRight ? (
                  <CheckIcon size={18} />
                ) : showWrong ? (
                  <CloseIcon size={18} />
                ) : (
                  (LETTERS[i] ?? String(i + 1))
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="sr-only">{LETTERS[i] ?? i + 1}.</span> {option}
                {srState ? (
                  <>
                    {' '}
                    <span className="sr-only">— {srState}</span>
                  </>
                ) : null}
              </span>
              {showRight || showWrong ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-bold tracking-wide uppercase',
                    showRight ? 'bg-ink text-gold-200' : 'bg-velvet-300 text-ink',
                  )}
                >
                  {showRight
                    ? isChosen
                      ? t('learn.quiz.correctTitle')
                      : t('learn.quiz.correctAnswer')
                    : t('learn.quiz.yourAnswer')}
                </span>
              ) : (
                <kbd
                  aria-hidden="true"
                  className="border-ink/20 text-ink/60 hidden rounded-md border px-1.5 text-xs font-bold sm:inline"
                >
                  {i + 1}
                </kbd>
              )}
            </button>
          );
        })}
      </div>

      {!answered ? (
        <p className="text-mist mt-4 hidden text-xs sm:block">
          {t('learn.quiz.keysHint', { max: q.options.length })}
        </p>
      ) : null}

      {answered ? (
        <div className="mt-6">
          <FeedbackNote
            tone={correct ? 'right' : 'wrong'}
            title={correct ? t('learn.quiz.correctTitle') : t('learn.quiz.wrongTitle')}
            testId="quiz-feedback"
          >
            {correct ? null : (
              <p className="font-semibold">
                {t('learn.quiz.correctAnswerIs', { answer: q.options[q.answer] ?? '' })}
              </p>
            )}
            <p>{q.explanation}</p>
          </FeedbackNote>
          <div className="mt-5 flex justify-end">
            <Button
              ref={nextRef}
              onClick={onNext}
              size="lg"
              data-testid="quiz-next"
              trailingIcon={<span>→</span>}
            >
              {isLast ? t('learn.quiz.seeScore') : t('learn.quiz.next')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScoreCard({
  slug,
  score,
  total,
  results,
  previousBest,
  playable,
  onRetry,
}: {
  slug: string;
  score: number;
  total: number;
  results: readonly boolean[];
  previousBest: number | null | undefined;
  playable: boolean;
  onRetry: () => void;
}) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>(true);
  const hydrated = useHydrated();
  const best = useProgress((s) => s.games[slug]?.quizBest ?? null);
  const isNewBest = previousBest !== undefined && score > (previousBest ?? -1) && score > 0;
  return (
    <div className="border-gold-300/40 relative overflow-hidden rounded-[26px] border bg-[radial-gradient(90%_80%_at_50%_0%,rgb(245_215_122/0.18),transparent_70%)] px-5 pt-10 pb-8 text-center shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_24px_50px_-28px_rgb(0_0_0/0.9)] sm:px-10">
      <span
        aria-hidden="true"
        className="marquee-bulbs animate-bulb pointer-events-none absolute inset-x-8 top-0 h-3.5 opacity-70"
      />
      <Kicker>{t('learn.quiz.resultKicker')}</Kicker>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-gold-100 mt-3 text-2xl font-bold outline-none sm:text-3xl"
      >
        {t('learn.quiz.resultTitle')}
        <span className="sr-only">:</span>{' '}
        <span className="sr-only">{t('learn.quiz.resultSr', { score, total })}</span>
      </h2>
      <p
        aria-hidden="true"
        data-testid="quiz-score"
        className="font-display text-foil mt-2 text-7xl leading-none font-black tracking-[-0.03em] tabular-nums sm:text-8xl"
      >
        {score}/{total}
      </p>
      <p className="text-cream mx-auto mt-4 max-w-md text-lg leading-relaxed text-pretty">
        {t(scoreBandKey(score, total))}
      </p>

      <p className="text-mist mt-3 min-h-6 text-sm font-semibold" data-testid="quiz-best">
        {hydrated && best !== null ? (
          <>
            {isNewBest ? <span className="text-gold-200">{t('learn.quiz.newBest')} </span> : null}
            {t('learn.quiz.best', { best, total })}
          </>
        ) : null}
      </p>

      <div className="mt-5">
        <h3 className="sr-only">{t('learn.quiz.review')}</h3>
        <ol className="flex items-center justify-center gap-2">
          {results.map((ok, i) => (
            <li key={i}>
              <span
                className={cn(
                  'inline-flex size-9 items-center justify-center rounded-full border-2',
                  ok
                    ? 'border-gold-200 bg-gold-300 text-ink'
                    : 'border-velvet-400 bg-velvet-700/60 text-cream',
                )}
              >
                {ok ? <CheckIcon size={16} /> : <CloseIcon size={16} />}
                <span className="sr-only">
                  {t('learn.quiz.reviewItem', {
                    n: i + 1,
                    result: ok ? t('learn.quiz.reviewRight') : t('learn.quiz.reviewWrong'),
                  })}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <Button onClick={onRetry} size="lg" data-testid="quiz-retry">
          {t('learn.quiz.retry')}
        </Button>
      </div>
      <nav
        aria-label={t('learn.quiz.nextSteps')}
        className="border-gold-300/15 mt-6 flex flex-wrap justify-center gap-2 border-t pt-5"
      >
        <Button href={`/games/${slug}/learn`} variant="ghost" size="sm">
          {t('learn.quiz.learn')}
        </Button>
        <Button href={`/games/${slug}/try`} variant="ghost" size="sm">
          {t('learn.quiz.try')}
        </Button>
        {playable ? (
          <Button href={`/games/${slug}/play`} variant="secondary" size="sm">
            {t('learn.quiz.play')}
          </Button>
        ) : null}
      </nav>
    </div>
  );
}

interface QuizState {
  index: number;
  chosen: number | null;
  results: boolean[];
  finished: boolean;
  moved: boolean;
  attempt: number;
}

const START: QuizState = {
  index: 0,
  chosen: null,
  results: [],
  finished: false,
  moved: false,
  attempt: 0,
};

export function QuizRunner({ slug, name, quiz, playable = false, className }: QuizRunnerProps) {
  const reduced = useReducedMotionPref();
  const [s, setS] = useState<QuizState>(START);
  const total = quiz.length;
  const q = quiz[s.index];
  const score = s.results.filter(Boolean).length;
  const [previousBest, setPreviousBest] = useState<number | null | undefined>(undefined);

  useRecordWhen(s.finished, () => {
    const progress = useProgress.getState();
    setPreviousBest(progress.games[slug]?.quizBest ?? null);
    progress.recordQuiz(slug, score);
  });

  const choose = (option: number) => {
    if (!q || s.chosen !== null) return;
    const ok = option === q.answer;
    // Ignore a second pick that lands before the first one re-renders (double tap).
    setS((prev) =>
      prev.chosen !== null ? prev : { ...prev, chosen: option, results: [...prev.results, ok] },
    );
    const answerText = q.options[q.answer] ?? '';
    announce(
      ok
        ? `${t('learn.quiz.correctTitle')} ${q.explanation}`
        : `${t('learn.quiz.wrongTitle')} ${t('learn.quiz.correctAnswerIs', { answer: answerText })} ${q.explanation}`,
    );
  };

  const next = () => {
    if (s.chosen === null) return;
    // Advance only from the question this click belongs to: a double click (or a click on
    // the outgoing button during its exit animation) must not skip the next question.
    const from = s.index;
    setS((prev) => {
      if (prev.finished || prev.index !== from || prev.chosen === null) return prev;
      if (prev.index >= total - 1) return { ...prev, finished: true, moved: true };
      return { ...prev, index: prev.index + 1, chosen: null, moved: true };
    });
  };

  const retry = () => {
    setPreviousBest(undefined);
    setS((prev) => ({ ...START, moved: true, attempt: prev.attempt + 1 }));
  };

  // Digit shortcuts: 1–4 answer the current question from anywhere on the page.
  const onKey = useEffectEvent((e: globalThis.KeyboardEvent) => {
    if (e.defaultPrevented || hasModifier(e) || s.finished || s.chosen !== null || !q) return;
    if (!/^[1-9]$/.test(e.key)) return;
    const target = e.target;
    const inOptions = target instanceof HTMLElement && target.closest('[data-quiz-options]');
    if (!inOptions && focusOwnsKeys(target)) return;
    const option = Number(e.key) - 1;
    if (option >= q.options.length) return;
    e.preventDefault();
    choose(option);
  });

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const screenKey = s.finished ? `done-${s.attempt}` : `q-${s.attempt}-${s.index}`;
  const progressValue = s.finished ? total : s.index + (s.chosen !== null ? 1 : 0);

  return (
    <section className={className} aria-label={t('learn.header.quizTitle', { name })}>
      <ProgressBar
        value={progressValue}
        max={total}
        label={t('learn.quiz.progressLabel')}
        valueText={
          s.finished
            ? t('learn.quiz.resultSr', { score, total })
            : t('learn.quiz.questionOf', { current: s.index + 1, total })
        }
        showLabel
      />
      <div className="mt-6 sm:mt-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screenKey}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: reduced ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {s.finished ? (
              <ScoreCard
                slug={slug}
                score={score}
                total={total}
                results={s.results}
                previousBest={previousBest}
                playable={playable}
                onRetry={retry}
              />
            ) : q ? (
              <QuestionScreen
                q={q}
                index={s.index}
                total={total}
                chosen={s.chosen}
                focusHeading={s.moved}
                onChoose={choose}
                onNext={next}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
