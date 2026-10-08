'use client';
/**
 * The win celebration: a full-screen "movie poster" title reveal with confetti and
 * falling cards, a Jeet count-up, Share (poster PNG), Play again and the Awards shelf.
 */
import { animate, motion } from 'motion/react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { type WinTitle } from '@content/titles';
import { PlayingCard } from '@/components/cards';
import { type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { Button } from '@/components/ui/Button';
import { TrophyIcon } from '@/components/ui/icons';
import { CoinIcon, formatJeetDelta } from '@/components/ui/Jeet';
import { toast } from '@/components/ui/Toast';
import { siteConfig } from '@/config/site';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { OverlayShell } from './OverlayShell';
import { RatingPrompt } from './RatingPrompt';

export interface CelebrationProps {
  title: WinTitle;
  gameName: string;
  netJeet: number;
  onPlayAgain: () => void;
  onClose: () => void;
  /** Position of this award on the Awards shelf ("Award #3"). */
  awardIndex?: number;
  /** The engine's one-sentence account of the hand ("Your 20 beats the dealer's 18…"). */
  summary?: string;
  /** Shows the game rating prompt when given. */
  gameSlug?: string;
  open?: boolean;
}

/** Effects are removed after this long (ms). */
export const CELEBRATION_FX_MS = 3000;

/** The canvas poster renderer is only needed when the learner presses Share. */
const loadShareCard = () => import('@/lib/share-card');

const CONFETTI_COLOURS = [
  '#f5d77a',
  '#fff6d9',
  '#ecc153',
  '#e0566b',
  '#2b8f66',
  '#fbf6ea',
  '#1b5fc1',
];
const FALLING_CARDS: CardCode[] = ['AS', 'KH', 'QD', 'JC', 'AH', 'TS', 'KD', 'QC'];
const CONFETTI_COUNT = 30;

interface Piece {
  id: number;
  kind: 'confetti' | 'card';
  left: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  size: number;
  colour: string;
  round: boolean;
  code: CardCode;
}

/** Deterministic layout for ≤ 40 animated pieces (30 confetti + 8 cards). */
export function celebrationPieces(seed: string): Piece[] {
  const rng = createRng(`celebrate-${seed}`);
  const pieces: Piece[] = [];
  const total = CONFETTI_COUNT + FALLING_CARDS.length;
  for (let i = 0; i < total; i++) {
    const card = i >= CONFETTI_COUNT;
    pieces.push({
      id: i,
      kind: card ? 'card' : 'confetti',
      left: Math.round(rng.next() * 96 * 10) / 10,
      delay: Math.round(rng.next() * (card ? 0.7 : 0.5) * 100) / 100,
      duration: Math.round((card ? 1.8 : 1.5) * 100 + rng.next() * 70) / 100,
      drift: Math.round((rng.next() - 0.5) * (card ? 160 : 120)),
      spin: Math.round((rng.next() - 0.5) * (card ? 540 : 900)),
      size: Math.round(6 + rng.next() * 6),
      colour: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length] ?? '#f5d77a',
      round: rng.next() < 0.3,
      code:
        FALLING_CARDS[(i - CONFETTI_COUNT + FALLING_CARDS.length) % FALLING_CARDS.length] ?? 'AS',
    });
  }
  return pieces;
}

function ShareIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx={18} cy={5} r={2.6} stroke="currentColor" strokeWidth={2} />
      <circle cx={6} cy={12} r={2.6} stroke="currentColor" strokeWidth={2} />
      <circle cx={18} cy={19} r={2.6} stroke="currentColor" strokeWidth={2} />
      <path
        d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function StaticBurst() {
  const rays = Array.from({ length: 18 }, (_, i) => i * 20);
  return (
    <div
      aria-hidden="true"
      data-testid="celebration-burst"
      className="pointer-events-none fixed inset-0 flex items-center justify-center"
    >
      <svg viewBox="-100 -100 200 200" className="size-[min(140vw,900px)] opacity-60">
        <defs>
          <radialGradient id="celebration-burst-glow">
            <stop offset="0" stopColor="#fff6d9" stopOpacity="0.85" />
            <stop offset="0.35" stopColor="#f5d77a" stopOpacity="0.45" />
            <stop offset="1" stopColor="#f5d77a" stopOpacity="0" />
          </radialGradient>
        </defs>
        {rays.map((deg) => (
          <path
            key={deg}
            d="M0 0 L-6 -100 L6 -100 Z"
            fill="#f5d77a"
            fillOpacity="0.18"
            transform={`rotate(${deg})`}
          />
        ))}
        <circle r="60" fill="url(#celebration-burst-glow)" />
      </svg>
    </div>
  );
}

function CelebrationFx({ seed }: { seed: string }) {
  const [active, setActive] = useState(true);
  const pieces = useMemo(() => celebrationPieces(seed), [seed]);
  useEffect(() => {
    const id = window.setTimeout(() => setActive(false), CELEBRATION_FX_MS);
    return () => window.clearTimeout(id);
  }, []);
  if (!active) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="celebration-fx"
      className="pointer-events-none fixed inset-0 overflow-hidden"
    >
      {pieces.map((p) =>
        p.kind === 'card' ? (
          <motion.div
            key={p.id}
            className="absolute top-0"
            style={{ left: `${p.left}%` }}
            initial={{ y: '-25vh', x: 0, rotate: p.spin / 4, opacity: 1 }}
            animate={{ y: '115vh', x: p.drift, rotate: p.spin }}
            transition={{ duration: p.duration, delay: p.delay, ease: [0.35, 0.05, 0.6, 1] }}
          >
            <PlayingCard code={p.code} size="sm" decorative />
          </motion.div>
        ) : (
          <motion.span
            key={p.id}
            className="absolute top-0 block"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 1.6,
              backgroundColor: p.colour,
              borderRadius: p.round ? '9999px' : '2px',
            }}
            initial={{ y: '-8vh', x: 0, rotate: 0, opacity: 1 }}
            animate={{ y: '110vh', x: p.drift, rotate: p.spin, opacity: [1, 1, 0.85] }}
            transition={{ duration: p.duration, delay: p.delay, ease: [0.25, 0.1, 0.45, 1] }}
          />
        ),
      )}
    </div>
  );
}

/** Animated "+250" (instant under reduced motion). */
function useCountUp(target: number, enabled: boolean, delay: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controls = animate(0, target, {
      duration: 1.2,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [target, enabled, delay]);
  return enabled ? value : target;
}

function shareDate(): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
}

function fileName(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `game-of-cards-${slug || 'award'}.png`;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === 'AbortError'
  );
}

export function Celebration({
  title,
  gameName,
  netJeet,
  onPlayAgain,
  onClose,
  awardIndex,
  summary,
  gameSlug,
  open = true,
}: CelebrationProps) {
  const reduce = useReducedMotionPref();
  const titleId = useId();
  const blurbId = useId();
  const playAgainRef = useRef<HTMLButtonElement>(null);
  const [sharing, setSharing] = useState(false);
  const alive = useRef(true);
  const shown = useCountUp(netJeet, !reduce && open, 0.9);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const { createShareImage, shareOrDownload } = await loadShareCard();
      const blob = await createShareImage({
        title: title.text,
        film: title.film,
        blurb: title.blurb,
        gameName,
        jeet: netJeet,
        dateLabel: shareDate(),
        siteUrl: siteConfig.url,
      });
      const how = await shareOrDownload(
        blob,
        fileName(title.text),
        t('play.celebration.shareText', { title: title.text, game: gameName }),
      );
      toast(how === 'shared' ? t('play.celebration.shared') : t('play.celebration.downloaded'));
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Share card failed', error);
        toast({ message: t('play.celebration.shareFailed'), tone: 'error' });
      }
    } finally {
      if (alive.current) setSharing(false);
    }
  };

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } }
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  const titleClass =
    'font-display px-[0.08em] pb-[0.14em] text-[clamp(2.4rem,10vw,4.6rem)] leading-[0.95] font-black tracking-[-0.02em] italic';

  return (
    <OverlayShell
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={blurbId}
      initialFocusRef={playAgainRef}
      tone="spotlight"
      closeLabel={t('play.celebration.close')}
      data-testid="celebration"
      fx={reduce ? <StaticBurst /> : <CelebrationFx seed={title.id} />}
    >
      <div className="border-gold-300/70 relative overflow-hidden rounded-[28px] border-2 bg-[radial-gradient(120%_80%_at_50%_0%,var(--color-felt-600),var(--color-felt-800)_55%,var(--color-felt-950))] px-5 pt-12 pb-6 text-center shadow-[0_40px_90px_-30px_rgb(0_0_0/0.95),0_0_60px_-20px_rgb(245_215_122/0.5)] sm:px-10 sm:pt-14 sm:pb-8">
        <span
          aria-hidden="true"
          className="marquee-bulbs animate-bulb pointer-events-none absolute inset-x-5 top-2 h-3.5"
        />
        <span
          aria-hidden="true"
          className="marquee-bulbs animate-bulb pointer-events-none absolute inset-x-5 bottom-2 h-3.5 [animation-delay:1.2s]"
        />
        <span
          aria-hidden="true"
          className="border-gold-300/30 pointer-events-none absolute inset-x-3 inset-y-6 rounded-[18px] border sm:inset-6"
        />

        <motion.p
          {...rise(0.1)}
          className="text-gold-300 relative flex items-center justify-center gap-3 text-[0.6875rem] font-bold tracking-[0.34em] uppercase sm:text-xs"
        >
          <span aria-hidden="true" className="bg-gold-500/70 h-px w-6 sm:w-10" />
          <span>{t('play.celebration.presents')}</span>
          <span aria-hidden="true" className="bg-gold-500/70 h-px w-6 sm:w-10" />
        </motion.p>

        <motion.div
          className="relative mt-4"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.92 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          transition={
            reduce ? { duration: 0.15 } : { duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }
          }
        >
          <h2 id={titleId} data-testid="win-title" className={`text-foil ${titleClass}`}>
            {title.text}
          </h2>
          {reduce ? null : (
            <motion.span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 block text-transparent ${titleClass}`}
              style={{
                backgroundImage:
                  'linear-gradient(100deg, transparent 38%, rgb(255 255 255 / 0.9) 50%, transparent 62%)',
                backgroundSize: '260% 100%',
                backgroundRepeat: 'no-repeat',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
              }}
              initial={{ backgroundPosition: '160% 0%' }}
              animate={{ backgroundPosition: '-60% 0%' }}
              transition={{ delay: 1.1, duration: 1.3, ease: 'easeInOut' }}
            >
              {title.text}
            </motion.span>
          )}
        </motion.div>

        <motion.p {...rise(0.75)} className="font-display text-cream relative mt-4 text-lg italic">
          {t('play.celebration.inspired', { film: title.film })}
        </motion.p>
        <motion.p
          {...rise(0.85)}
          id={blurbId}
          className="text-mist relative mx-auto mt-2 max-w-md text-[0.9375rem] leading-relaxed"
        >
          {title.blurb}
        </motion.p>

        <motion.div {...rise(0.95)} className="relative mt-6">
          <p
            className="flex items-center justify-center gap-2.5"
            data-testid="celebration-jeet"
            data-amount={netJeet}
          >
            <CoinIcon size={36} className="drop-shadow-[0_4px_10px_rgb(236_193_83/0.55)]" />
            <span
              aria-hidden="true"
              className="tabular font-display text-gold-200 text-5xl font-black sm:text-6xl"
            >
              {formatJeetDelta(shown)}
            </span>
            <span aria-hidden="true" className="text-gold-300 self-end pb-1.5 text-lg font-bold">
              {t('wallet.currency')}
            </span>
            <span className="sr-only">
              {formatJeetDelta(netJeet)} {t('wallet.currency')}
            </span>
          </p>
          <p className="text-gold-300/90 mt-1 text-xs font-bold tracking-[0.2em] uppercase">
            {t('play.celebration.wonAt', { game: gameName })}
          </p>
          {summary ? (
            <p
              data-testid="celebration-summary"
              className="text-cream/90 mx-auto mt-3 max-w-md text-sm leading-relaxed"
            >
              <span className="sr-only">{t('play.celebration.happened')}: </span>
              {summary}
            </p>
          ) : null}
          {awardIndex !== undefined ? (
            <p className="text-cream mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">
              <TrophyIcon size={16} className="text-gold-300" />
              {t('play.celebration.award', { n: awardIndex })}
            </p>
          ) : null}
        </motion.div>

        <motion.div
          {...rise(1.05)}
          className="relative mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center"
        >
          <Button ref={playAgainRef} onClick={onPlayAgain} data-testid="play-again">
            {t('play.celebration.playAgain')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void share()}
            loading={sharing}
            loadingLabel={t('play.celebration.sharing')}
            data-testid="share-button"
            leadingIcon={<ShareIcon />}
          >
            {t('play.celebration.share')}
          </Button>
          <Button variant="ghost" href="/stats" leadingIcon={<TrophyIcon size={18} />}>
            {t('play.celebration.shelf')}
          </Button>
        </motion.div>

        {gameSlug ? (
          <motion.div {...rise(1.2)} className="relative mt-6">
            <RatingPrompt gameSlug={gameSlug} context="game" />
          </motion.div>
        ) : null}
      </div>
    </OverlayShell>
  );
}
