'use client';
/**
 * Lesson player: one concept per screen. Each step has an animated card scene
 * on a felt stage, a title, glossary-linked text and an optional tip. Back/Next
 * and the ←/→ keys move between steps; focus moves to the new step's heading.
 * The final screen links on to the example hand and the quiz.
 */
import { useEffect, useEffectEvent, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CardScene } from '@/components/cards/CardScene';
import { type SceneLike } from '@/components/cards/describe';
import { PlayingCard } from '@/components/cards/PlayingCard';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ClubIcon, DiamondIcon, HeartIcon, SpadeIcon } from '@/components/ui/icons';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { useProgress } from '@/store/progress';
import { GlossaryText } from './GlossaryText';
import { useFocusOnMount, useMarkStarted, useRecordWhen } from './hooks';
import { focusOwnsKeys, hasModifier } from './keys';
import { Kicker, TableStage, TipBubble } from './parts';
import { type GlossaryEntry } from './rich-text';

export interface LessonStepData {
  title: string;
  body: string;
  scene?: SceneLike;
  tip?: string;
}

export interface LessonGame {
  slug: string;
  name: string;
  lesson: readonly LessonStepData[];
  glossary: readonly GlossaryEntry[];
}

export interface LessonPlayerProps {
  game: LessonGame;
  className?: string;
}

const SUIT_ICONS = [SpadeIcon, HeartIcon, DiamondIcon, ClubIcon] as const;

/** Stage art for steps without a card scene: a spotlit scene number. */
function SceneSlate({ n }: { n: number }) {
  const Icon = SUIT_ICONS[(n - 1) % SUIT_ICONS.length] ?? SpadeIcon;
  return (
    <div aria-hidden="true" className="flex flex-col items-center gap-2 py-6">
      <Icon size={44} className="text-gold-300/70" />
      <span className="font-display text-foil text-6xl leading-none font-black tabular-nums sm:text-7xl">
        {n}
      </span>
      <span className="text-mist text-xs font-bold tracking-[0.3em] uppercase">
        {t('learn.lesson.stageFallback', { n })}
      </span>
    </div>
  );
}

function StepScreen({
  step,
  index,
  total,
  glossary,
  focusHeading,
}: {
  step: LessonStepData;
  index: number;
  total: number;
  glossary: readonly GlossaryEntry[];
  focusHeading: boolean;
}) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>(focusHeading);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-10">
      <TableStage className="min-h-[15rem] sm:min-h-[18rem]">
        {step.scene ? (
          <CardScene key={`${index}`} scene={step.scene} data-testid="lesson-scene" />
        ) : (
          <SceneSlate n={index + 1} />
        )}
      </TableStage>
      <div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-foil text-[1.75rem] leading-tight font-bold tracking-[-0.01em] outline-none sm:text-4xl"
        >
          <span className="sr-only">
            {t('learn.lesson.stepPrefix', { current: index + 1, total })}
          </span>{' '}
          {step.title}
        </h2>
        <GlossaryText
          text={step.body}
          glossary={glossary}
          className="text-cream/95 mt-3 max-w-prose text-base leading-relaxed sm:text-[1.0625rem]"
        />
        {step.tip ? <TipBubble label={t('learn.lesson.tip')}>{step.tip}</TipBubble> : null}
      </div>
    </div>
  );
}

function DoneScreen({
  slug,
  name,
  focusHeading,
  onRestart,
}: {
  slug: string;
  name: string;
  focusHeading: boolean;
  onRestart: () => void;
}) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>(focusHeading);
  return (
    <div className="border-gold-300/40 relative overflow-hidden rounded-[26px] border bg-[radial-gradient(80%_90%_at_50%_0%,rgb(245_215_122/0.16),transparent_70%)] px-5 pt-10 pb-8 text-center shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_24px_50px_-28px_rgb(0_0_0/0.9)] sm:px-10">
      <span
        aria-hidden="true"
        className="marquee-bulbs animate-bulb pointer-events-none absolute inset-x-8 top-0 h-3.5 opacity-70"
      />
      <span
        aria-hidden="true"
        className="marquee-bulbs animate-bulb pointer-events-none absolute inset-x-8 bottom-0 h-3.5 opacity-70"
      />
      <div aria-hidden="true" className="mx-auto flex w-fit items-end justify-center pb-2">
        {(['AS', 'KH', 'QD'] as const).map((code, i) => (
          <div
            key={code}
            className="-mx-2"
            style={{ transform: `rotate(${(i - 1) * 12}deg) translateY(${i === 1 ? -8 : 0}px)` }}
          >
            <PlayingCard code={code} size="sm" decorative />
          </div>
        ))}
      </div>
      <Kicker className="mt-5">{t('learn.lesson.doneKicker')}</Kicker>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-foil mx-auto mt-3 max-w-2xl text-[2rem] leading-[1.08] font-black tracking-[-0.02em] text-balance outline-none sm:text-5xl"
      >
        {t('learn.lesson.doneTitle', { name })}
      </h2>
      <p className="text-mist mx-auto mt-4 max-w-xl text-base leading-relaxed text-pretty">
        {t('learn.lesson.doneBody')}
      </p>
      <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <Button href={`/games/${slug}/try`} size="lg" data-testid="lesson-try">
          {t('learn.lesson.tryExample')}
        </Button>
        <Button
          href={`/games/${slug}/quiz`}
          size="lg"
          variant="secondary"
          data-testid="lesson-quiz"
        >
          {t('learn.lesson.takeQuiz')}
        </Button>
      </div>
      <button
        type="button"
        onClick={onRestart}
        className="text-mist hover:text-gold-200 mt-5 inline-flex min-h-11 items-center px-3 text-sm font-semibold underline underline-offset-4"
      >
        {t('learn.lesson.restart')}
      </button>
    </div>
  );
}

export function LessonPlayer({ game, className }: LessonPlayerProps) {
  const { slug, name, lesson, glossary } = game;
  const total = lesson.length;
  const reduced = useReducedMotionPref();
  const [nav, setNav] = useState({ step: 0, dir: 1, moved: false });
  const { step, dir, moved } = nav;
  const done = step >= total;

  useMarkStarted(slug);
  useRecordWhen(step >= total - 1, () => useProgress.getState().markLessonDone(slug));

  const go = (to: number) => {
    if (to < 0 || to > total || to === step) return;
    setNav({ step: to, dir: to > step ? 1 : -1, moved: true });
  };

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || hasModifier(e)) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (focusOwnsKeys(e.target)) return;
    e.preventDefault();
    go(step + (e.key === 'ArrowRight' ? 1 : -1));
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const variants = {
    enter: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: d * 40 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: d * -40 }),
  };

  const current = lesson[step];
  const stepText = done
    ? t('learn.lesson.complete')
    : t('learn.lesson.stepOf', { current: step + 1, total });

  return (
    <section className={className} aria-label={t('learn.header.learnTitle', { name })}>
      <div data-testid="lesson-progress" data-step={done ? total : step + 1} data-total={total}>
        <ProgressBar
          value={done ? total : step + 1}
          max={total}
          label={t('learn.lesson.progressLabel')}
          valueText={stepText}
          showLabel
        />
      </div>

      <div className="mt-6 sm:mt-8">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduced ? 0.12 : 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {done || !current ? (
              <DoneScreen
                slug={slug}
                name={name}
                focusHeading={moved}
                onRestart={() => setNav({ step: 0, dir: -1, moved: true })}
              />
            ) : (
              <StepScreen
                step={current}
                index={step}
                total={total}
                glossary={glossary}
                focusHeading={moved}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <nav
        aria-label={t('learn.lesson.navLabel')}
        className="border-gold-300/15 mt-8 flex items-center justify-between gap-3 border-t pt-5"
      >
        <Button
          variant="secondary"
          onClick={() => go(step - 1)}
          aria-disabled={step === 0 || undefined}
          data-testid="lesson-back"
          leadingIcon={<span>←</span>}
        >
          {t('learn.lesson.back')}
        </Button>
        {done ? null : (
          <Button
            onClick={() => go(step + 1)}
            data-testid="lesson-next"
            trailingIcon={<span>→</span>}
          >
            {step === total - 1 ? t('learn.lesson.finish') : t('learn.lesson.next')}
          </Button>
        )}
      </nav>
      <p className="text-mist mt-3 hidden text-center text-xs sm:block">
        {t('learn.lesson.keysHint')}
      </p>
    </section>
  );
}
