'use client';
/**
 * Minimal toast system. `toast("Email copied!")` or
 * `toast({ message, tone: 'success' | 'info' | 'error', durationMs })`.
 * Toasts render inside a polite live region so screen readers announce them.
 */
import { AnimatePresence, motion } from 'motion/react';
import { create } from 'zustand';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { cn } from './cn';
import { AlertIcon, CheckIcon, InfoIcon } from './icons';

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

export function Toaster() {
  const items = useToasts((s) => s.items);
  const reduce = useReducedMotionPref();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      role="status"
      aria-live="polite"
      aria-atomic="false"
      aria-label={t('common.toast.region')}
    >
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout={!reduce}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: reduce ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
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
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
