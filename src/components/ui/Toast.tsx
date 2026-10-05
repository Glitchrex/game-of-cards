'use client';
/**
 * Minimal toast system. `toast("Email copied!")` or
 * `toast({ message, tone: 'success' | 'info' | 'error', durationMs })`.
 */
import { AnimatePresence, motion } from 'motion/react';
import { create } from 'zustand';

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
    () => useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) })),
    opts.durationMs ?? 3200,
  );
}

const toneClass: Record<ToastTone, string> = {
  success: 'border-gold-300/60 bg-felt-800 text-cream',
  info: 'border-mist/40 bg-felt-800 text-cream',
  error: 'border-velvet-400/70 bg-velvet-700 text-cream',
};

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[90] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${toneClass[t.tone]}`}
            data-testid="toast"
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
