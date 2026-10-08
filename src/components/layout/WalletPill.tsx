'use client';
/**
 * Header wallet. Renders a skeleton until the persisted stores have hydrated; then the
 * balance button (<WalletPillButton/>: count-up, +/− flash, coin burst, Udhaar badge,
 * wallet dialog). The button's code is fetched once the page has finished loading (when
 * the browser is idle), so it stays out of the first-load JS and off the critical path.
 */
import { useEffect, useState, type ComponentType } from 'react';
import { cn } from '@/components/ui/cn';
import { t } from '@/lib/i18n';
import { useHydrated } from '@/store/hydrate';
import { type WalletPillButtonProps } from './WalletPillButton';

export interface WalletPillProps {
  className?: string;
}

type ButtonComponent = ComponentType<WalletPillButtonProps>;

let buttonPromise: Promise<ButtonComponent> | null = null;
let loadedButton: ButtonComponent | null = null;
/** Fetch the button chunk once; a failed fetch is forgotten so a later mount retries. */
function loadButton(): Promise<ButtonComponent> {
  buttonPromise ??= import('./WalletPillButton').then(
    (mod) => {
      loadedButton = mod.WalletPillButton;
      return mod.WalletPillButton;
    },
    (err: unknown) => {
      buttonPromise = null;
      throw err;
    },
  );
  return buttonPromise;
}

/** Run `fn` once the page has loaded and the browser is idle. Returns a cancel function. */
function afterPageLoad(fn: () => void): () => void {
  let idle = 0;
  let timer = 0;
  const schedule = () => {
    if (typeof window.requestIdleCallback === 'function') {
      idle = window.requestIdleCallback(fn, { timeout: 1500 });
    } else {
      timer = window.setTimeout(fn, 1);
    }
  };
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
  return () => {
    window.removeEventListener('load', schedule);
    if (idle) window.cancelIdleCallback(idle);
    if (timer) window.clearTimeout(timer);
  };
}

export function WalletPill({ className }: WalletPillProps) {
  const hydrated = useHydrated();
  const [Button, setButton] = useState<ButtonComponent | null>(() => loadedButton);

  useEffect(() => {
    if (Button) return;
    let cancelled = false;
    const fetchButton = () => {
      loadButton().then(
        (C) => {
          if (!cancelled) setButton(() => C);
        },
        () => {
          /* offline: keep the skeleton; the next mount (e.g. after navigation) retries */
        },
      );
    };
    const cancelWait = afterPageLoad(fetchButton);
    return () => {
      cancelled = true;
      cancelWait();
    };
  }, [Button]);

  if (!hydrated || !Button) {
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
  return <Button className={className} />;
}
