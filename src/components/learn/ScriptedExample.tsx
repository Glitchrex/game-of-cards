'use client';
/**
 * Tier 2 "Try" experience: a scripted, clickable example hand. Each step shows
 * the table (a card scene that re-animates as the hand evolves) and the coach's
 * narration. At decision points the learner must pick an option: a wrong pick
 * explains why and lets them try again; the right pick unlocks Continue. A
 * "What would a pro do?" button reveals the pro hint.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CardScene } from '@/components/cards/CardScene';
import { type SceneLike } from '@/components/cards/describe';
import { PlayingCard } from '@/components/cards/PlayingCard';
import { announce } from '@/components/layout/LiveAnnouncer';
import { CoachPanel } from '@/components/play/CoachPanel';
import { stripTipPrefix } from '@/components/play/personas';
import { RatingPrompt } from '@/components/play/RatingPrompt';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { cn } from '@/components/ui/cn';
import { CheckIcon, CloseIcon, SparkleIcon } from '@/components/ui/icons';
import { isCardCode } from '@/games/core/cards';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { useProgress } from '@/store/progress';
import { GlossaryText } from './GlossaryText';
import { useFocusOnMount, useMarkStarted, useRecordWhen } from './hooks';
import { FeedbackNote, Kicker, TableStage, TipBubble } from './parts';
import { type GlossaryEntry } from './rich-text';

export interface ScriptedOptionData {
  label: string;
  card?: string;
  correct: boolean;
  feedback: string;
}

export interface ScriptedStepData {
  narration: string;
  scene: SceneLike;
  decision?: {
    prompt: string;
    options: readonly ScriptedOptionData[];
    proHint: string;
  };
}

export interface ScriptedExampleData {
  intro: string;
  steps: readonly ScriptedStepData[];
  outro: string;
}

export interface ScriptedExampleProps {
  slug: string;
  name: string;
  glossary: readonly GlossaryEntry[];
  example: ScriptedExampleData;
  tips: readonly string[];
  className?: string;
}

/** Per-step decision state, kept so Back shows a solved step as solved. */
interface DecisionState {
  /** Wrong options already tried. */
  tried: number[];
  /** The correct option once found. */
  solved: number | null;
  /** The most recent pick (drives the feedback). */
  last: number | null;
  pro: boolean;
}

const EMPTY_DECISION: DecisionState = { tried: [], solved: null, last: null, pro: false };

/** Screen index: -1 = intro, 0..n-1 = steps, n = outro. */
interface Nav {
  screen: number;
  dir: number;
  moved: boolean;
}

function IntroCard({
  name,
  intro,
  glossary,
  focusHeading,
  onStart,
}: {
  name: string;
  intro: string;
  glossary: readonly GlossaryEntry[];
  focusHeading: boolean;
  onStart: () => void;
}) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>(focusHeading);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-10">
      <TableStage className="min-h-[14rem] sm:min-h-[17rem]">
        <div aria-hidden="true" className="flex items-end justify-center py-4">
          {(['QS', 'JH', 'AD', 'KC'] as const).map((code, i) => (
            <div
              key={code}
              className="-mx-2.5"
              style={{
                transform: `rotate(${(i - 1.5) * 10}deg) translateY(${Math.abs(i - 1.5) * 6}px)`,
              }}
            >
              <PlayingCard code={code} size="md" faceDown={i === 0} decorative />
            </div>
          ))}
        </div>
      </TableStage>
      <div>
        <Kicker>{t('learn.example.introKicker')}</Kicker>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-foil mt-3 text-[1.875rem] leading-[1.08] font-black tracking-[-0.02em] text-balance outline-none sm:text-[2.6rem]"
        >
          {t('learn.example.introTitle', { name })}
        </h2>
        <GlossaryText
          text={intro}
          glossary={glossary}
          className="text-cream/95 mt-4 max-w-prose text-base leading-relaxed"
        />
        <h3 className="text-gold-200 mt-6 text-sm font-bold tracking-[0.14em] uppercase">
          {t('learn.example.howTitle')}
        </h3>
        <ol className="text-mist mt-2 space-y-2 text-[0.9375rem] leading-relaxed">
          {(['how1', 'how2', 'how3'] as const).map((k, i) => (
            <li key={k} className="flex gap-3">
              <span
                aria-hidden="true"
                className="border-gold-300/50 text-gold-200 inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
              >
                {i + 1}
              </span>
              <span>{t(`learn.example.${k}`)}</span>
            </li>
          ))}
        </ol>
        <div className="mt-7">
          <Button
            size="lg"
            onClick={onStart}
            data-testid="example-continue"
            trailingIcon={<span>→</span>}
          >
            {t('learn.example.start')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function OptionButton({
  option,
  index,
  state,
  onPick,
}: {
  option: ScriptedOptionData;
  index: number;
  state: 'idle' | 'tried' | 'solved' | 'locked';
  onPick: (i: number) => void;
}) {
  const card = option.card && isCardCode(option.card) ? option.card : null;
  const inactive = state !== 'idle';
  return (
    <button
      type="button"
      data-testid={`example-option-${index}`}
      data-state={state}
      aria-disabled={inactive || undefined}
      onClick={() => {
        if (!inactive) onPick(index);
      }}
      className={cn(
        'ease-snap flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left text-[0.9375rem] font-semibold transition-[transform,background-color,border-color] duration-150',
        state === 'idle' &&
          'bg-parchment text-ink hover:border-gold-500 border-transparent hover:-translate-y-0.5',
        state === 'tried' && 'border-velvet-400/80 bg-velvet-700/40 text-cream/90',
        state === 'solved' &&
          'border-gold-300 bg-gold-300 text-ink shadow-[0_0_0_3px_rgb(245_215_122/0.3)]',
        state === 'locked' && 'border-felt-600 bg-felt-800/70 text-mist',
      )}
    >
      {card ? (
        <span className="shrink-0">
          <PlayingCard code={card} size="xs" decorative />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        {option.label}
        {state === 'tried' ? (
          <>
            {' '}
            <span className="sr-only">— {t('learn.example.tried')}</span>
          </>
        ) : null}
        {state === 'solved' ? (
          <>
            {' '}
            <span className="sr-only">— {t('learn.example.chosen')}</span>
          </>
        ) : null}
      </span>
      {state === 'tried' ? <CloseIcon size={20} className="text-velvet-300 shrink-0" /> : null}
      {state === 'solved' ? <CheckIcon size={20} className="shrink-0" /> : null}
    </button>
  );
}

function StepView({
  step,
  index,
  total,
  glossary,
  decision,
  focusHeading,
  onDecision,
  onBack,
  onContinue,
}: {
  step: ScriptedStepData;
  index: number;
  total: number;
  glossary: readonly GlossaryEntry[];
  decision: DecisionState;
  focusHeading: boolean;
  onDecision: (next: DecisionState) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>(focusHeading);
  const continueRef = useRef<HTMLButtonElement>(null);
  const promptId = useId();
  const proId = useId();
  const d = step.decision;
  const canContinue = !d || decision.solved !== null;
  const isLast = index === total - 1;
  const justSolved = useRef(false);

  useEffect(() => {
    if (justSolved.current && decision.solved !== null) {
      justSolved.current = false;
      continueRef.current?.focus();
    }
  }, [decision.solved]);

  const pick = (i: number) => {
    if (!d) return;
    const option = d.options[i];
    if (!option) return;
    if (option.correct) {
      justSolved.current = true;
      onDecision({ ...decision, solved: i, last: i });
      announce(`${t('learn.example.rightTitle')} ${option.feedback}`);
    } else {
      onDecision({
        ...decision,
        tried: decision.tried.includes(i) ? decision.tried : [...decision.tried, i],
        last: i,
      });
      announce(
        `${t('learn.example.wrongTitle')} ${option.feedback} ${t('learn.example.tryAgain')}`,
      );
    }
  };

  const lastOption = d && decision.last !== null ? d.options[decision.last] : undefined;
  const lastRight = Boolean(lastOption?.correct);

  const decisionUi = d ? (
    <div className="mt-1">
      <p
        id={promptId}
        className="text-gold-100 flex items-center gap-2 text-base leading-snug font-bold"
      >
        <span className="bg-gold-300 text-ink rounded-full px-2 py-0.5 text-[0.6875rem] font-black tracking-wider uppercase">
          {t('learn.example.yourCall')}
        </span>
        <span>{d.prompt}</span>
      </p>
      <div role="group" aria-labelledby={promptId} className="mt-3 grid gap-2">
        {d.options.map((option, i) => {
          let state: 'idle' | 'tried' | 'solved' | 'locked' = 'idle';
          if (decision.solved === i) state = 'solved';
          else if (decision.tried.includes(i)) state = 'tried';
          else if (decision.solved !== null) state = 'locked';
          return <OptionButton key={i} option={option} index={i} state={state} onPick={pick} />;
        })}
      </div>

      {lastOption ? (
        <FeedbackNote
          key={decision.last}
          tone={lastRight ? 'right' : 'wrong'}
          title={lastRight ? t('learn.example.rightTitle') : t('learn.example.wrongTitle')}
          testId="example-feedback"
          className="mt-4"
        >
          <p>{lastOption.feedback}</p>
          {lastRight ? null : (
            <p className="text-gold-200 mt-1 font-semibold">{t('learn.example.tryAgain')}</p>
          )}
        </FeedbackNote>
      ) : null}

      <div className="mt-4">
        <button
          type="button"
          data-testid="example-pro-hint"
          aria-expanded={decision.pro}
          aria-controls={decision.pro ? proId : undefined}
          onClick={() => onDecision({ ...decision, pro: !decision.pro })}
          className="text-gold-200 hover:text-gold-100 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-bold underline decoration-dotted underline-offset-4"
        >
          <SparkleIcon size={16} />
          {decision.pro ? t('learn.example.proHintHide') : t('learn.example.proHint')}
        </button>
        {decision.pro ? (
          <div
            id={proId}
            data-testid="example-pro-hint-text"
            className="border-gold-300/40 bg-felt-950/50 mt-1 rounded-xl border px-3.5 py-3 text-[0.9375rem] leading-relaxed"
          >
            <strong className="text-gold-200">{t('learn.example.proHintTitle')}: </strong>
            <span className="text-cream">{d.proHint}</span>
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

  // Navigation sits outside the coach panel: the panel can be collapsed on phones.
  const nav = (
    <nav
      aria-label={t('learn.example.navLabel')}
      className="border-gold-300/15 mt-6 flex items-center justify-between gap-3 border-t pt-5"
    >
      <Button
        variant="secondary"
        onClick={onBack}
        data-testid="example-back"
        leadingIcon={<span>←</span>}
      >
        {t('learn.example.back')}
      </Button>
      {canContinue ? (
        <Button
          ref={continueRef}
          onClick={onContinue}
          data-testid="example-continue"
          trailingIcon={<span>→</span>}
        >
          {isLast ? t('learn.example.finish') : t('learn.example.continue')}
        </Button>
      ) : (
        <p className="text-mist text-right text-sm font-semibold" data-testid="example-must-choose">
          {t('learn.example.mustChoose')}
        </p>
      )}
    </nav>
  );

  return (
    <div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-gold-300 mb-3 text-xs font-bold tracking-[0.22em] uppercase outline-none"
          >
            {t('learn.example.stepHeading', { current: index + 1, total })}
            {d ? (
              <>
                {' '}
                <span className="text-gold-100">· {t('learn.example.yourCall')}</span>
              </>
            ) : null}
          </h2>
          <TableStage
            label={t('learn.example.tableLabel')}
            className="min-h-[16rem] sm:min-h-[20rem]"
          >
            <CardScene key={`step-${index}`} scene={step.scene} data-testid="example-scene" />
          </TableStage>
        </div>
        <CoachPanel
          // The panel clips its overflow; glossary popovers in the narration must not be cut off.
          className="overflow-visible!"
          title={t('learn.example.coachTitle')}
          situation={
            <GlossaryText
              inline
              text={step.narration}
              glossary={glossary}
              className="text-[0.9375rem] leading-relaxed sm:text-base"
            />
          }
        >
          {decisionUi}
        </CoachPanel>
      </div>
      {nav}
    </div>
  );
}

function OutroCard({
  slug,
  outro,
  glossary,
  tip,
  focusHeading,
  onBack,
  onReplay,
}: {
  slug: string;
  outro: string;
  glossary: readonly GlossaryEntry[];
  tip: string | undefined;
  focusHeading: boolean;
  onBack: () => void;
  onReplay: () => void;
}) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>(focusHeading);
  return (
    <div className="border-gold-300/40 relative rounded-[26px] border bg-[radial-gradient(80%_90%_at_50%_0%,rgb(245_215_122/0.16),transparent_70%)] px-5 pt-10 pb-8 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_24px_50px_-28px_rgb(0_0_0/0.9)] sm:px-10">
      <span
        aria-hidden="true"
        className="marquee-bulbs animate-bulb pointer-events-none absolute inset-x-8 top-0 h-3.5 opacity-70"
      />
      <div className="mx-auto max-w-2xl text-center">
        <Kicker>{t('learn.example.outroKicker')}</Kicker>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-foil mt-3 text-[2rem] leading-[1.08] font-black tracking-[-0.02em] outline-none sm:text-5xl"
          data-testid="example-outro"
        >
          {t('learn.example.outroTitle')}
        </h2>
        <GlossaryText
          text={outro}
          glossary={glossary}
          className="text-cream/95 mt-4 text-base leading-relaxed text-pretty"
        />
      </div>
      {tip ? (
        <div className="mx-auto max-w-xl">
          <TipBubble label={t('learn.example.rememberTitle')}>{tip}</TipBubble>
        </div>
      ) : null}
      <div className="mx-auto mt-7 flex max-w-md justify-center">
        <RatingPrompt gameSlug={slug} context="lesson" className="w-full" />
      </div>
      <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <Button href={`/games/${slug}/quiz`} size="lg" data-testid="example-quiz">
          {t('learn.example.takeQuiz')}
        </Button>
        <Button href={`/games/${slug}/learn`} size="lg" variant="secondary">
          {t('learn.example.reviewLesson')}
        </Button>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} leadingIcon={<span>←</span>}>
          {t('learn.example.back')}
        </Button>
        <Button variant="ghost" size="sm" onClick={onReplay}>
          {t('learn.example.replay')}
        </Button>
      </div>
    </div>
  );
}

export function ScriptedExample({
  slug,
  name,
  glossary,
  example,
  tips,
  className,
}: ScriptedExampleProps) {
  const reduced = useReducedMotionPref();
  const total = example.steps.length;
  const [nav, setNav] = useState<Nav>({ screen: -1, dir: 1, moved: false });
  const [decisions, setDecisions] = useState<Record<number, DecisionState>>({});
  const { screen, dir, moved } = nav;
  const done = screen >= total;

  useMarkStarted(slug);
  useRecordWhen(done, () => useProgress.getState().markExampleDone(slug));

  const go = (to: number) => {
    const target = Math.max(-1, Math.min(total, to));
    if (target === screen) return;
    setNav({ screen: target, dir: target > screen ? 1 : -1, moved: true });
  };

  const replay = () => {
    setDecisions({});
    setNav({ screen: -1, dir: -1, moved: true });
  };

  const variants = {
    enter: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: d * 36 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: d * -36 }),
  };

  const step = screen >= 0 ? example.steps[screen] : undefined;
  const progressValue = screen < 0 ? 0 : Math.min(screen + 1, total);
  // Content tips often start with "Tip:"; the outro already labels them "Remember".
  const tip = tips[0] ? stripTipPrefix(tips[0]) : undefined;

  let body;
  if (screen < 0) {
    body = (
      <IntroCard
        name={name}
        intro={example.intro}
        glossary={glossary}
        focusHeading={moved}
        onStart={() => go(0)}
      />
    );
  } else if (done || !step) {
    body = (
      <OutroCard
        slug={slug}
        outro={example.outro}
        glossary={glossary}
        tip={tip}
        focusHeading={moved}
        onBack={() => go(total - 1)}
        onReplay={replay}
      />
    );
  } else {
    body = (
      <StepView
        step={step}
        index={screen}
        total={total}
        glossary={glossary}
        decision={decisions[screen] ?? EMPTY_DECISION}
        focusHeading={moved}
        onDecision={(next) => setDecisions((prev) => ({ ...prev, [screen]: next }))}
        onBack={() => go(screen - 1)}
        onContinue={() => go(screen + 1)}
      />
    );
  }

  return (
    <section className={className} aria-label={t('learn.header.tryTitle', { name })}>
      <div data-testid="example-progress" data-step={progressValue} data-total={total}>
        <ProgressBar
          value={progressValue}
          max={total}
          label={t('learn.example.progressLabel')}
          valueText={
            screen < 0
              ? t('learn.example.introKicker')
              : done
                ? t('learn.example.outroKicker')
                : t('learn.example.stepOf', { current: progressValue, total })
          }
          showLabel
        />
      </div>
      <div className="mt-6 sm:mt-8">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={screen}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduced ? 0.12 : 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {body}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
