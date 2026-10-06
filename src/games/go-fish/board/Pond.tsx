'use client';
/**
 * The middle of the Go Fish table: the pond (the face-down stock, scattered on a little
 * pool of water with its count), the big "GO FISH!" splash, and a speech bubble with the
 * latest ask — "Kanta Kaka asked you for Sevens · Go Fish!". Everything here is public:
 * the pond shows only card backs and the bubble only says what everyone heard.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { CardBack, cardCountText } from '@/components/cards';
import { cn } from '@/components/ui/cn';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { rankCountWords, rankPlural } from '../rules';
import { type LastAsk } from './shared';

/** How long the splash stays up (ms). Shorter than a bot's turn, so asks never pile up. */
export const SPLASH_MS = 1000;

/** Where the scattered backs lie in the pond: [x %, y %, rotation°]. */
const SCATTER: readonly (readonly [number, number, number])[] = [
  [50, 50, -6],
  [30, 44, -28],
  [70, 46, 22],
  [40, 62, 14],
  [61, 32, -14],
  [22, 60, 34],
  [79, 62, -30],
  [50, 28, 40],
  [35, 30, 9],
];

export function Pond({ count, shimmer }: { count: number; shimmer: boolean }) {
  const reduced = useReducedMotionPref();
  const shown = Math.min(count, SCATTER.length);
  const label =
    count === 0
      ? t('goFish.zone.pondEmpty')
      : t('goFish.zone.pond', { count: cardCountText(count) });
  return (
    <div
      role="img"
      aria-label={label}
      data-testid="gofish-pond"
      data-count={count}
      className="relative mx-auto aspect-[7/4] w-[min(16rem,62vw)] shrink-0"
    >
      {/* The water. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-[50%] border border-[#7fd3d0]/30 bg-[radial-gradient(ellipse_at_50%_40%,#1d7a86_0%,#0f4f5c_55%,#06262f_100%)] shadow-[inset_0_6px_18px_rgb(0_0_0/0.55),0_0_0_6px_rgb(245_215_122/0.08),0_14px_30px_-18px_rgb(0_0_0/0.95)]"
      />
      {!reduced && shimmer
        ? [0, 1].map((i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              className="absolute inset-[18%] rounded-[50%] border border-[#bff1ee]/25"
              animate={{ scale: [0.6, 1.25], opacity: [0.6, 0] }}
              transition={{ duration: 3.2, delay: i * 1.6, repeat: Infinity, ease: 'easeOut' }}
            />
          ))
        : null}
      <AnimatePresence initial={!reduced}>
        {SCATTER.slice(0, shown).map(([x, y, r], i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            className="absolute"
            style={{ left: `${x}%`, top: `${y}%`, zIndex: i }}
            initial={reduced ? false : { opacity: 0, scale: 0.4, x: '-50%', y: '-50%', rotate: 0 }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%', rotate: r }}
            exit={
              reduced
                ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, scale: 0.6, transition: { duration: 0.25 } }
            }
            transition={
              reduced
                ? { duration: 0 }
                : { delay: i * 0.04, type: 'spring', stiffness: 260, damping: 20 }
            }
          >
            <CardBack size="xs" style={{ width: 'clamp(26px, 7.4vw, 38px)' }} />
          </motion.span>
        ))}
      </AnimatePresence>
      <span
        aria-hidden="true"
        className={cn(
          'tabular absolute -bottom-2 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap shadow-[0_6px_14px_-8px_rgb(0_0_0/0.9)]',
          count > 0
            ? 'border-gold-300/50 bg-felt-950/90 text-gold-100'
            : 'border-mist/40 bg-felt-950/90 text-mist',
        )}
      >
        {t('goFish.pond.caption')}
        <span className="text-gold-300">·</span>
        {count > 0 ? t('goFish.pond.left', { n: count }) : t('goFish.pond.empty')}
      </span>
    </div>
  );
}

type SplashKind = 'fish' | 'wish' | 'catch' | 'dry';

function splashKind(ask: LastAsk): SplashKind {
  if (ask.got > 0) return 'catch';
  if (ask.dry) return 'dry';
  return ask.wish ? 'wish' : 'fish';
}

/**
 * The big friendly splash for the latest ask: "GO FISH!" (with a leaping fish), "Catch!
 * +2" or "Fished a wish!". Purely visual — the controller announces every move — and it
 * clears itself after SPLASH_MS (reduced motion: it simply appears and goes).
 */
export function Splash({ ask }: { ask: LastAsk | null }) {
  const reduced = useReducedMotionPref();
  const [gone, setGone] = useState<number | null>(null);
  const index = ask?.index ?? null;
  useEffect(() => {
    if (index === null) return;
    const id = window.setTimeout(() => setGone(index), SPLASH_MS);
    return () => window.clearTimeout(id);
  }, [index]);
  const visible = ask !== null && gone !== ask.index;
  const kind = ask ? splashKind(ask) : 'fish';
  const text =
    kind === 'catch'
      ? t('goFish.splash.catch', { n: ask?.got ?? 0 })
      : kind === 'wish'
        ? t('goFish.splash.wish')
        : kind === 'dry'
          ? t('goFish.splash.dry')
          : t('goFish.splash.fish');

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
    >
      <AnimatePresence>
        {visible ? (
          <motion.div
            key={ask.index}
            data-testid="gofish-splash"
            data-kind={kind}
            initial={reduced ? false : { scale: 0.3, rotate: -14, opacity: 0 }}
            animate={{ scale: 1, rotate: -6, opacity: 1 }}
            exit={
              reduced
                ? { opacity: 0, transition: { duration: 0 } }
                : { scale: 1.25, opacity: 0, transition: { duration: 0.22 } }
            }
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 16 }}
            className={cn(
              'relative flex items-center gap-2 rounded-2xl border-2 px-4 py-2 shadow-[0_18px_40px_-14px_rgb(0_0_0/0.95)]',
              kind === 'catch' || kind === 'wish'
                ? 'border-gold-100 text-ink bg-[linear-gradient(180deg,var(--color-gold-200),var(--color-gold-500))]'
                : 'text-ivory border-[#bff1ee]/80 bg-[linear-gradient(180deg,#1f8e9b,#0b4c5a)]',
            )}
          >
            {kind === 'catch' ? null : <LeapingFish reduced={reduced} />}
            <span className="font-display text-2xl leading-none font-black tracking-wide whitespace-nowrap uppercase drop-shadow-[0_2px_0_rgb(0_0_0/0.35)] sm:text-3xl">
              {text}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function LeapingFish({ reduced }: { reduced: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 40 24"
      className="h-6 w-10 shrink-0 sm:h-7 sm:w-12"
      initial={reduced ? false : { y: 10, rotate: 30 }}
      animate={{ y: 0, rotate: -10 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 12 }}
    >
      <path d="M4 12c6-9 18-10 26-2l6-6v16l-6-6c-8 8-20 7-26-2z" fill="#f5d77a" />
      <path d="M4 12c6-9 18-10 26-2" fill="none" stroke="#8a6312" strokeWidth={1.4} />
      <circle cx={11} cy={10} r={1.6} fill="#17161b" />
      <path d="M17 7c1 3 1 7 0 10" fill="none" stroke="#b4841a" strokeWidth={1.2} />
    </motion.svg>
  );
}

/** "Kanta Kaka asked you for Sevens · Go Fish!" — the latest ask, as everyone heard it. */
export function LastAskBubble({
  ask,
  nameOf,
  objectOf,
}: {
  ask: LastAsk | null;
  /** "Kanta Kaka" / "You". */
  nameOf: (seat: number) => string;
  /** "Kanta Kaka" / "you". */
  objectOf: (seat: number) => string;
}) {
  const reduced = useReducedMotionPref();
  if (!ask) return <div className="min-h-11" aria-hidden="true" />;
  const outcome =
    ask.got > 0
      ? t('goFish.last.caught', {
          target: nameOf(ask.target),
          cards: rankCountWords(ask.got, ask.rank),
        })
      : ask.dry
        ? t('goFish.last.dry')
        : ask.wish
          ? t('goFish.last.wish', { who: objectOf(ask.seat) })
          : t('goFish.last.fish');
  return (
    <motion.div
      key={ask.index}
      data-testid="gofish-last-ask"
      data-got={ask.got}
      data-seat={ask.seat}
      data-target={ask.target}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.25 }}
      className="border-gold-300/30 bg-felt-950/70 relative mx-auto flex min-h-11 max-w-[22rem] flex-col items-center justify-center rounded-2xl border px-3 py-1.5 text-center shadow-[0_8px_20px_-12px_rgb(0_0_0/0.9)]"
    >
      <span className="text-cream text-[0.8125rem] leading-snug font-semibold">
        {t('goFish.last.asked', {
          asker: nameOf(ask.seat),
          target: objectOf(ask.target),
          rank: rankPlural(ask.rank),
        })}
      </span>
      <span
        className={cn(
          'text-xs leading-snug font-bold',
          ask.got > 0 || ask.wish ? 'text-gold-300' : 'text-[#9fe3df]',
        )}
      >
        {outcome}
      </span>
    </motion.div>
  );
}
