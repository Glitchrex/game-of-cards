'use client';
/**
 * Header wallet: gold coin + Jeet balance with a count-up on every change,
 * a +/− flash, a coin burst on credits and a pulsing "Udhaar" badge when the
 * Daily Udhaar is claimable. Opens <WalletDialog/>. Renders a skeleton until
 * the persisted stores have hydrated.
 */
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type AnimationPlaybackControls,
} from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { useNow } from '@/components/ui/hooks';
import { CoinIcon, formatJeet, formatJeetDelta } from '@/components/ui/Jeet';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { useHydrated } from '@/store/hydrate';
import { udhaarStatus, useWallet } from '@/store/wallet';
import { WalletDialog } from './WalletDialog';

export interface WalletPillProps {
  className?: string;
}

export function WalletPill({ className }: WalletPillProps) {
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  if (!hydrated) {
    return (
      <span
        data-testid="wallet-skeleton"
        className={cn(
          'border-gold-300/20 bg-felt-950/40 inline-flex h-11 w-[6.25rem] shrink-0 items-center gap-2 rounded-full border pr-3 pl-1.5',
          className,
        )}
      >
        <span aria-hidden="true" className="bg-gold-300/20 size-7 animate-pulse rounded-full" />
        <span aria-hidden="true" className="bg-gold-300/15 h-3 flex-1 animate-pulse rounded" />
        <span className="sr-only">{t('wallet.loading')}</span>
      </span>
    );
  }
  return (
    <>
      <PillButton onOpen={() => setOpen(true)} className={className} />
      <WalletDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

interface Flash {
  id: number;
  delta: number;
}

/** Fixed burst directions (deg): a ring that stays inside the 64 px header. */
const BURST = [0, 45, 90, 135, 180, 225, 270, 315] as const;

function CoinBurst() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {BURST.map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const dist = 21 + (i % 2) * 5;
        return (
          <motion.span
            key={deg}
            className="absolute top-1/2 left-1/2 -mt-[5px] -ml-[5px]"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: 0 }}
            animate={{
              x: Math.cos(rad) * dist,
              y: Math.sin(rad) * dist,
              opacity: [0, 1, 1, 0],
              scale: [0.4, 1, 0.9, 0.5],
              rotate: deg / 2,
            }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: (i % 4) * 0.025 }}
          >
            <CoinIcon size={10} />
          </motion.span>
        );
      })}
    </span>
  );
}

function PillButton({ onOpen, className }: { onOpen: () => void; className?: string }) {
  const balance = useWallet((s) => s.balance);
  const lastUdhaarAt = useWallet((s) => s.lastUdhaarAt);
  const now = useNow(30_000);
  const eligible = udhaarStatus(balance, lastUdhaarAt, now).eligible;
  const reduce = useReducedMotionPref();
  const reduceRef = useRef(reduce);
  const shown = useMotionValue(balance);
  const text = useTransform(shown, (v) => formatJeet(v));
  const [flash, setFlash] = useState<Flash | null>(null);
  const [bursts, setBursts] = useState<number[]>([]);

  useEffect(() => {
    reduceRef.current = reduce;
  }, [reduce]);

  useEffect(() => {
    let n = 0;
    let anim: AnimationPlaybackControls | undefined;
    const timers: number[] = [];
    shown.set(useWallet.getState().balance);
    const unsubscribe = useWallet.subscribe((s, prev) => {
      const delta = s.balance - prev.balance;
      if (delta === 0) return;
      anim?.stop();
      if (reduceRef.current) {
        shown.set(s.balance);
      } else {
        const duration = Math.min(1.4, 0.4 + Math.log10(Math.abs(delta) + 1) * 0.25);
        anim = animate(shown, s.balance, { duration, ease: [0.16, 1, 0.3, 1] });
      }
      const id = ++n;
      setFlash({ id, delta });
      timers.push(window.setTimeout(() => setFlash((f) => (f?.id === id ? null : f)), 1600));
      if (delta > 0 && !reduceRef.current) {
        setBursts((b) => [...b, id]);
        timers.push(window.setTimeout(() => setBursts((b) => b.filter((x) => x !== id)), 1000));
      }
    });
    return () => {
      unsubscribe();
      anim?.stop();
      timers.forEach((x) => window.clearTimeout(x));
    };
  }, [shown]);

  const amount = formatJeet(balance);
  const label = eligible
    ? t('wallet.pillLabelUdhaar', { amount })
    : t('wallet.pillLabel', { amount });

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      aria-haspopup="dialog"
      data-testid="wallet-pill"
      className={cn(
        'group hover:border-gold-300/80 relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border bg-[linear-gradient(180deg,rgb(3_17_11/0.75),rgb(10_53_36/0.75))] pr-3 pl-1 shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_4px_14px_-8px_rgb(0_0_0/0.8)] transition-[border-color,box-shadow,background-color] duration-300 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_0_0_3px_rgb(245_215_122/0.12)]',
        flash
          ? flash.delta > 0
            ? 'border-felt-400 shadow-[0_0_0_3px_rgb(43_143_102/0.45),0_0_18px_rgb(43_143_102/0.5)]'
            : 'border-velvet-400 shadow-[0_0_0_3px_rgb(194_47_71/0.4),0_0_18px_rgb(194_47_71/0.45)]'
          : 'border-gold-300/45',
        className,
      )}
    >
      <span className="relative inline-flex size-8 items-center justify-center">
        <CoinIcon
          size={28}
          className="ease-snap drop-shadow-[0_2px_4px_rgb(0_0_0/0.45)] transition-transform duration-300 group-hover:-rotate-12 group-active:scale-90"
        />
        {bursts.map((id) => (
          <CoinBurst key={id} />
        ))}
      </span>
      <motion.span
        aria-hidden="true"
        className="tabular text-gold-100 min-w-[2ch] text-[0.9375rem] leading-none font-bold"
      >
        {text}
      </motion.span>
      {eligible ? (
        <Badge
          tone="velvet"
          size="sm"
          pulse
          className="ml-0.5 max-[389px]:px-1 max-[389px]:text-[0.625rem]"
          aria-hidden="true"
        >
          {t('wallet.udhaar.badge')}
        </Badge>
      ) : null}
      <AnimatePresence>
        {flash ? (
          <motion.span
            key={flash.id}
            aria-hidden="true"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -2, scale: 0.8 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 8, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.1 : 0.35, ease: [0.2, 0.9, 0.25, 1.15] }}
            className={cn(
              'tabular pointer-events-none absolute top-full right-1 rounded-full px-1.5 py-0.5 text-[0.6875rem] font-black shadow-lg',
              flash.delta > 0 ? 'bg-felt-400 text-felt-950' : 'bg-velvet-500 text-cream',
            )}
          >
            {formatJeetDelta(flash.delta)}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </button>
  );
}
