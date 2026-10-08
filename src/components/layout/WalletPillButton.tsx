'use client';
/**
 * The hydrated header wallet button (loaded by <WalletPill/> once the persisted stores have
 * hydrated, so neither it nor the wallet dialog is part of the first-load JS): gold coin +
 * Jeet balance with a count-up on every change, a +/− flash, a coin burst on credits and a
 * pulsing "Udhaar" badge when the Daily Udhaar is claimable. Opens <WalletDialog/>, whose
 * code is fetched the first time it opens (warmed up on hover/focus).
 *
 * The count-up is a tiny requestAnimationFrame tween and the flash / coin burst are CSS and
 * Web Animations, so this chunk carries no animation library.
 */
import { cubicBezier, MotionGlobalConfig } from 'motion';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { useNow } from '@/components/ui/hooks';
import { CoinIcon, formatJeet, formatJeetDelta } from '@/components/ui/Jeet';
import { lazyComponent } from '@/components/ui/lazy';
import { usePresenceList } from '@/components/ui/presence';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { udhaarStatus, useWallet } from '@/store/wallet';
import { type WalletDialogProps } from './WalletDialog';

const walletDialog = lazyComponent<WalletDialogProps>(() =>
  import('./WalletDialog').then((mod) => mod.WalletDialog),
);
const warmUpDialog = () => {
  walletDialog.load().catch(() => {
    /* retried when the dialog opens */
  });
};

export interface WalletPillButtonProps {
  className?: string;
}

export function WalletPillButton({ className }: WalletPillButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PillButton onOpen={() => setOpen(true)} className={className} />
      <walletDialog.Render
        wanted={open}
        onLoadError={() => setOpen(false)}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

interface Flash {
  id: number;
  delta: number;
}

const NO_FLASH: readonly Flash[] = [];

const countEase = cubicBezier(0.16, 1, 0.3, 1);

/**
 * Tween a number from `from` to `to` over `seconds`, calling `onUpdate` every frame.
 * Honours `MotionGlobalConfig.skipAnimations` (tests). Returns a cancel function.
 */
function countTo(from: number, to: number, seconds: number, onUpdate: (v: number) => void) {
  if (MotionGlobalConfig.skipAnimations || typeof requestAnimationFrame !== 'function') {
    onUpdate(to);
    return () => {};
  }
  let raf = 0;
  const start = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / (seconds * 1000));
    onUpdate(from + (to - from) * countEase(p));
    if (p < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/** Fixed burst directions (deg): a ring that stays inside the 64 px header. */
const BURST = [0, 45, 90, 135, 180, 225, 270, 315] as const;

const BURST_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** A ring of little coins flying out of the wallet coin (Web Animations; decorative). */
function CoinBurst() {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const coins = ref.current?.children;
    if (!coins) return;
    const running: Animation[] = [];
    BURST.forEach((deg, i) => {
      const el = coins[i] as HTMLElement | undefined;
      if (!el || typeof el.animate !== 'function') return;
      const rad = (deg * Math.PI) / 180;
      const dist = 21 + (i % 2) * 5;
      const timing = { duration: 750, delay: (i % 4) * 25, fill: 'both' as const };
      running.push(
        el.animate(
          [
            { translate: '0px 0px', rotate: '0deg' },
            {
              translate: `${Math.cos(rad) * dist}px ${Math.sin(rad) * dist}px`,
              rotate: `${deg / 2}deg`,
            },
          ],
          { ...timing, easing: BURST_EASE },
        ),
        el.animate(
          [
            { opacity: 0, scale: 0.4, easing: BURST_EASE },
            { opacity: 1, scale: 1, easing: BURST_EASE },
            { opacity: 1, scale: 0.9, easing: BURST_EASE },
            { opacity: 0, scale: 0.5 },
          ],
          timing,
        ),
      );
    });
    return () => running.forEach((anim) => anim.cancel());
  }, []);
  return (
    <span ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {BURST.map((deg) => (
        <span key={deg} className="absolute top-1/2 left-1/2 -mt-[5px] -ml-[5px] opacity-0">
          <CoinIcon size={10} />
        </span>
      ))}
    </span>
  );
}

/** CSS enter/exit of the +/− flash under the pill (keyframes in globals.css). */
function flashAnimation(reduce: boolean, exiting: boolean): CSSProperties {
  return {
    transform: reduce ? 'none' : 'translateY(8px)',
    animation: `${exiting ? 'goc-pop-out' : 'goc-pop-in'} ${reduce ? 100 : 350}ms cubic-bezier(0.2, 0.9, 0.25, 1.15) both`,
    ['--goc-in-y' as string]: reduce ? '0px' : '-2px',
    ['--goc-in-scale' as string]: reduce ? 1 : 0.8,
    ['--goc-out-y' as string]: reduce ? '0px' : '8px',
    ['--goc-out-scale' as string]: 1,
  };
}

function PillButton({ onOpen, className }: { onOpen: () => void; className?: string }) {
  const balance = useWallet((s) => s.balance);
  const lastUdhaarAt = useWallet((s) => s.lastUdhaarAt);
  const now = useNow(30_000);
  const eligible = udhaarStatus(balance, lastUdhaarAt, now).eligible;
  const reduce = useReducedMotionPref();
  const reduceRef = useRef(reduce);
  const textRef = useRef<HTMLSpanElement>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const flashList = useMemo(() => (flash ? [flash] : NO_FLASH), [flash]);
  const flashes = usePresenceList(flashList, reduce ? 100 : 350);
  const [bursts, setBursts] = useState<number[]>([]);

  useEffect(() => {
    reduceRef.current = reduce;
  }, [reduce]);

  // The count-up writes the number straight into the DOM (no re-render per frame).
  useLayoutEffect(() => {
    let shown = useWallet.getState().balance;
    const show = (value: number) => {
      shown = value;
      if (textRef.current) textRef.current.textContent = formatJeet(value);
    };
    show(shown);
    let n = 0;
    let stop: (() => void) | undefined;
    const timers: number[] = [];
    const unsubscribe = useWallet.subscribe((s, prev) => {
      const delta = s.balance - prev.balance;
      if (delta === 0) return;
      stop?.();
      if (reduceRef.current) {
        show(s.balance);
      } else {
        const duration = Math.min(1.4, 0.4 + Math.log10(Math.abs(delta) + 1) * 0.25);
        stop = countTo(shown, s.balance, duration, show);
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
      stop?.();
      timers.forEach((x) => window.clearTimeout(x));
    };
  }, []);

  const amount = formatJeet(balance);
  const label = eligible
    ? t('wallet.pillLabelUdhaar', { amount })
    : t('wallet.pillLabel', { amount });

  return (
    <button
      type="button"
      onClick={onOpen}
      onPointerEnter={warmUpDialog}
      onFocus={warmUpDialog}
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
      <span
        ref={textRef}
        aria-hidden="true"
        className="tabular text-gold-100 min-w-[2ch] text-[0.9375rem] leading-none font-bold"
      />
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
      {flashes.map(({ item, exiting }) => (
        <span
          key={item.id}
          aria-hidden="true"
          style={flashAnimation(reduce, exiting)}
          className={cn(
            'tabular pointer-events-none absolute top-full right-1 rounded-full px-1.5 py-0.5 text-[0.6875rem] font-black shadow-lg',
            item.delta > 0 ? 'bg-felt-400 text-felt-950' : 'bg-velvet-500 text-cream',
          )}
        >
          {formatJeetDelta(item.delta)}
        </span>
      ))}
    </button>
  );
}
