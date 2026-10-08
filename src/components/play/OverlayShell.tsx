'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, type ReactNode, type RefObject } from 'react';
import { cn } from '@/components/ui/cn';
import { CloseIcon } from '@/components/ui/icons';
import { useModal } from '@/components/ui/modal';
import { Portal } from '@/components/ui/Portal';
import { useReducedMotionPref } from '@/lib/motion';

export type OverlayTone = 'spotlight' | 'velvet' | 'calm';

export interface OverlayShellProps {
  open: boolean;
  onClose: () => void;
  /** id of the visible heading that names the dialog. */
  labelledBy: string;
  describedBy?: string;
  /** Element to focus on open (defaults to the panel). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  tone: OverlayTone;
  closeLabel: string;
  /** Decorative full-screen effects layer (confetti, curtains…). */
  fx?: ReactNode;
  children: ReactNode;
  panelClassName?: string;
  'data-testid': string;
}

const BACKDROPS: Record<OverlayTone, string> = {
  spotlight:
    'bg-felt-950/92 bg-[radial-gradient(60%_50%_at_50%_30%,rgb(245_215_122/0.22),transparent_70%),radial-gradient(120%_90%_at_50%_100%,rgb(14_70_48/0.7),transparent_70%)]',
  velvet:
    'bg-[#1d0710]/92 bg-[repeating-linear-gradient(90deg,rgb(116_22_40/0.55)_0_28px,rgb(61_11_22/0.55)_28px_56px),radial-gradient(60%_45%_at_50%_35%,rgb(245_215_122/0.14),transparent_70%)]',
  calm: 'bg-felt-950/88 bg-[radial-gradient(60%_50%_at_50%_35%,rgb(43_143_102/0.25),transparent_70%)]',
};

/**
 * Full-screen result overlay (Portal + useModal): aria-modal dialog, focus trapped,
 * Escape closes, focus restored, page scroll locked, the rest of the page inert.
 * The content scrolls on short screens.
 */
export function OverlayShell({
  open,
  onClose,
  labelledBy,
  describedBy,
  initialFocusRef,
  tone,
  closeLabel,
  fx,
  children,
  panelClassName,
  'data-testid': testId,
}: OverlayShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionPref();
  const { onKeyDown } = useModal({ open, onClose, panelRef, initialFocusRef });

  return (
    <Portal>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="overlay"
            className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.3 }}
          >
            <div
              aria-hidden="true"
              className={cn('fixed inset-0 backdrop-blur-[3px]', BACKDROPS[tone])}
            />
            {fx}
            <div className="relative flex min-h-full items-center justify-center px-3 py-6 sm:p-8">
              <motion.div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                aria-describedby={describedBy}
                tabIndex={-1}
                onKeyDown={onKeyDown}
                data-testid={testId}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 36, scale: 0.95 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
                transition={
                  reduce
                    ? { duration: 0.12 }
                    : { type: 'spring', stiffness: 260, damping: 26, mass: 0.9 }
                }
                className={cn('relative w-full max-w-xl outline-none', panelClassName)}
              >
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={closeLabel}
                  className="text-mist hover:text-gold-100 bg-felt-950/60 border-gold-300/25 absolute top-3 right-3 z-10 inline-flex size-11 items-center justify-center rounded-full border transition-colors hover:bg-white/[0.08] sm:-top-4 sm:-right-4"
                >
                  <CloseIcon size={22} />
                </button>
                {children}
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Portal>
  );
}
