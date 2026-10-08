'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { cn } from './cn';
import { CloseIcon } from './icons';
import { useModal } from './modal';
import { Portal } from './Portal';

export type DialogSize = 'sm' | 'md' | 'lg';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Visible heading; also the dialog's accessible name. */
  title: ReactNode;
  /** Optional supporting line under the title (wired to aria-describedby). */
  description?: ReactNode;
  /** Small uppercase "presents" line above the title. */
  eyebrow?: ReactNode;
  children?: ReactNode;
  /** Sticky action row at the bottom of the panel. */
  footer?: ReactNode;
  size?: DialogSize;
  /** Element to focus on open. Defaults to the panel itself. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Escape / backdrop click close the dialog (default true). */
  dismissible?: boolean;
  hideCloseButton?: boolean;
  role?: 'dialog' | 'alertdialog';
  className?: string;
}

const widths: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

/**
 * Accessible modal dialog: aria-modal, labelled by its title, focus trapped
 * inside, Escape closes, focus returns to the opener, page scroll locked.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  eyebrow,
  children,
  footer,
  size = 'md',
  initialFocusRef,
  dismissible = true,
  hideCloseButton = false,
  role = 'dialog',
  className,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const reduce = useReducedMotionPref();
  const { onKeyDown, onBackdropClick } = useModal({
    open,
    onClose,
    panelRef,
    initialFocusRef,
    dismissible,
  });

  const panelMotion = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12 },
      }
    : {
        initial: { opacity: 0, y: 24, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 12, scale: 0.98 },
        transition: { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.8 },
      };

  return (
    <Portal>
      <AnimatePresence>
        {open ? (
          <div
            key="dialog"
            className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6"
          >
            <motion.div
              aria-hidden="true"
              className="bg-felt-950/80 absolute inset-0 backdrop-blur-[3px]"
              style={{
                backgroundImage:
                  'radial-gradient(80% 60% at 50% 40%, rgb(14 70 48 / 0.35), transparent 70%)',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0.12 : 0.2 }}
              onClick={onBackdropClick}
            />
            <motion.div
              ref={panelRef}
              role={role}
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descId : undefined}
              tabIndex={-1}
              onKeyDown={onKeyDown}
              {...panelMotion}
              className={cn(
                'border-gold-300/30 bg-felt-800 text-cream relative flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl border shadow-[0_30px_80px_-20px_rgb(0_0_0/0.85),inset_0_1px_0_rgb(255_255_255/0.07)] outline-none sm:max-h-[calc(100dvh-3rem)]',
                widths[size],
                className,
              )}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--color-gold-300),transparent)]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,rgb(245_215_122/0.09),transparent_60%)]"
              />
              <header className="relative flex items-start gap-3 px-5 pt-5 pb-3 sm:px-7 sm:pt-6">
                <div className="min-w-0 flex-1">
                  {eyebrow ? (
                    <p className="text-gold-300 mb-1 text-[0.6875rem] font-bold tracking-[0.22em] uppercase">
                      {eyebrow}
                    </p>
                  ) : null}
                  <h2
                    id={titleId}
                    className="font-display text-gold-100 text-2xl leading-tight font-bold sm:text-[1.75rem]"
                  >
                    {title}
                  </h2>
                  {description ? (
                    <p id={descId} className="text-mist mt-1.5 text-[0.9375rem] leading-relaxed">
                      {description}
                    </p>
                  ) : null}
                </div>
                {hideCloseButton ? null : (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={t('common.close')}
                    className="text-mist hover:text-gold-200 -mt-1 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/[0.08]"
                  >
                    <CloseIcon size={22} />
                  </button>
                )}
              </header>
              <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-7 sm:pb-7">
                {children}
              </div>
              {footer ? (
                <footer className="border-gold-300/15 bg-felt-900/60 relative flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3.5 sm:px-7">
                  {footer}
                </footer>
              ) : null}
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </Portal>
  );
}
