'use client';
/**
 * Minimal toast system. `toast("Email copied!")` or
 * `toast({ message, tone: 'success' | 'info' | 'error', durationMs })`.
 * Toasts render inside a polite live region so screen readers announce them.
 * Enter/exit and the glide of the remaining toasts are CSS / Web Animations (see
 * ./presence.ts), so the always-mounted Toaster adds almost nothing to first-load JS.
 */
import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { create } from 'zustand';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { cn } from './cn';
import { AlertIcon, CheckIcon, InfoIcon } from './icons';
import { usePresenceList } from './presence';

export type ToastTone = 'success' | 'info' | 'error';
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}
interface ToastState {
  items: ToastItem[];
}

const useToasts = create<ToastState>(() => ({ items: [] }));
let nextId = 1;

export function toast(
  input: string | { message: string; tone?: ToastTone; durationMs?: number },
): void {
  const opts = typeof input === 'string' ? { message: input } : input;
  const id = nextId++;
  const item: ToastItem = { id, message: opts.message, tone: opts.tone ?? 'success' };
  useToasts.setState((s) => ({ items: [...s.items.slice(-3), item] }));
  setTimeout(
    () => useToasts.setState((s) => ({ items: s.items.filter((x) => x.id !== id) })),
    opts.durationMs ?? 3200,
  );
}

/** Remove every visible toast (e.g. between tests or on a full reset). */
export function dismissAllToasts(): void {
  useToasts.setState({ items: [] });
}

const toneClass: Record<ToastTone, string> = {
  success: 'border-gold-300/60 bg-felt-800 text-cream',
  info: 'border-mist/40 bg-felt-800 text-cream',
  error: 'border-velvet-400/70 bg-velvet-700 text-cream',
};

const iconClass: Record<ToastTone, string> = {
  success: 'bg-gold-300 text-ink',
  info: 'bg-felt-600 text-cream',
  error: 'bg-velvet-400 text-ink',
};

function ToneIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'error') return <AlertIcon size={16} />;
  if (tone === 'info') return <InfoIcon size={16} />;
  return <CheckIcon size={16} />;
}

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** CSS enter/exit animation of one toast (keyframes in globals.css). */
function toastAnimation(reduce: boolean, exiting: boolean): CSSProperties {
  return {
    animation: `${exiting ? 'goc-pop-out' : 'goc-pop-in'} ${reduce ? 120 : 220}ms ${EASE} both`,
    ['--goc-in-y' as string]: reduce ? '0px' : '16px',
    ['--goc-in-scale' as string]: reduce ? 1 : 0.96,
    ['--goc-out-y' as string]: reduce ? '0px' : '8px',
    ['--goc-out-scale' as string]: reduce ? 1 : 0.98,
  };
}

/**
 * When toasts come and go, the others glide to their new place instead of jumping
 * (measure → invert → play with the Web Animations API).
 */
function useGlide(keys: string, reduce: boolean) {
  const listRef = useRef<HTMLDivElement>(null);
  const tops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const next = new Map<string, number>();
    for (const el of list.querySelectorAll<HTMLElement>('[data-toast-id]')) {
      const id = el.dataset.toastId ?? '';
      const top = el.getBoundingClientRect().top;
      next.set(id, top);
      const before = tops.current.get(id);
      if (before === undefined || reduce || typeof el.animate !== 'function') continue;
      const delta = before - top;
      if (Math.abs(delta) < 1) continue;
      el.animate([{ translate: `0 ${delta}px` }, { translate: '0 0' }], {
        duration: 220,
        easing: EASE,
        composite: 'add',
      });
    }
    tops.current = next;
  }, [keys, reduce]);
  return listRef;
}

export function Toaster() {
  const items = useToasts((s) => s.items);
  const reduce = useReducedMotionPref();
  const entries = usePresenceList(items, reduce ? 120 : 220);
  const listRef = useGlide(entries.map((e) => e.item.id).join(','), reduce);
  return (
    <div
      ref={listRef}
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      role="status"
      aria-live="polite"
      aria-atomic="false"
      aria-label={t('common.toast.region')}
    >
      {entries.map(({ item, exiting }) => (
        <div
          key={item.id}
          data-toast-id={item.id}
          style={toastAnimation(reduce, exiting)}
          className={cn(
            'pointer-events-auto relative flex max-w-[min(26rem,calc(100vw-2rem))] items-center gap-3 overflow-hidden rounded-xl border py-2.5 pr-4 pl-3 text-sm font-semibold shadow-[0_16px_40px_-14px_rgb(0_0_0/0.85)]',
            toneClass[item.tone],
          )}
          data-testid="toast"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(245_215_122/0.7),transparent)]"
          />
          <span
            aria-hidden="true"
            className={cn(
              'inline-flex size-7 shrink-0 items-center justify-center rounded-full',
              iconClass[item.tone],
            )}
          >
            <ToneIcon tone={item.tone} />
          </span>
          <span className="min-w-0 flex-1 py-1 leading-snug">{item.message}</span>
        </div>
      ))}
    </div>
  );
}
