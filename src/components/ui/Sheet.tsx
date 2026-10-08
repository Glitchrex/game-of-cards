'use client';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { cn } from './cn';
import { useMediaQuery } from './hooks';
import { CloseIcon } from './icons';
import { useModal } from './modal';
import { Portal } from './Portal';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Visible heading; also the sheet's accessible name. */
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Which edge the panel slides from on tablet/desktop (≥ 768 px). Mobile is always bottom. */
  side?: 'right' | 'left';
  initialFocusRef?: RefObject<HTMLElement | null>;
  dismissible?: boolean;
  className?: string;
}

const DESKTOP = '(min-width: 768px)';

/**
 * Bottom sheet on phones, side panel on larger screens. Same accessibility
 * contract as <Dialog/>: aria-modal, focus trap, Escape, focus restore,
 * scroll lock. On phones the grab handle can be dragged down to dismiss.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  eyebrow,
  children,
  footer,
  side = 'right',
  initialFocusRef,
  dismissible = true,
  className,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const reduce = useReducedMotionPref();
  const desktop = useMediaQuery(DESKTOP);
  const drag = useDragControls();
  const { onKeyDown, onBackdropClick } = useModal({
    open,
    onClose,
    panelRef,
    initialFocusRef,
    dismissible,
  });

  const hidden = desktop ? { x: side === 'right' ? '100%' : '-100%', y: 0 } : { y: '100%', x: 0 };
  const panelMotion = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12 },
      }
    : {
        initial: hidden,
        animate: { x: 0, y: 0 },
        exit: hidden,
        transition: { type: 'spring' as const, stiffness: 380, damping: 38, mass: 0.9 },
      };

  return (
    <Portal>
      <AnimatePresence>
        {open ? (
          <div key="sheet" className="fixed inset-0 z-[80]">
            <motion.div
              aria-hidden="true"
              className="bg-felt-950/75 absolute inset-0 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0.12 : 0.22 }}
              onClick={onBackdropClick}
            />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descId : undefined}
              tabIndex={-1}
              onKeyDown={onKeyDown}
              {...panelMotion}
              drag={!desktop && dismissible ? 'y' : false}
              dragControls={drag}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.7 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 110 || info.velocity.y > 700) onClose();
              }}
              className={cn(
                'border-gold-300/30 bg-felt-800 text-cream absolute flex flex-col overflow-hidden shadow-[0_-24px_60px_-20px_rgb(0_0_0/0.8)] outline-none',
                'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-[1.75rem] border-t',
                'md:inset-y-0 md:max-h-none md:w-[min(440px,100vw)] md:border-t-0',
                side === 'right'
                  ? 'md:right-0 md:left-auto md:rounded-none md:rounded-l-[1.75rem] md:border-l'
                  : 'md:right-auto md:left-0 md:rounded-none md:rounded-r-[1.75rem] md:border-r',
                className,
              )}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_50%_at_50%_0%,rgb(245_215_122/0.08),transparent_65%)]"
              />
              <div
                aria-hidden="true"
                onPointerDown={(e) => drag.start(e)}
                className="relative flex h-6 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing md:hidden"
              >
                <span className="bg-gold-300/40 h-1.5 w-12 rounded-full" />
              </div>
              <header className="relative flex items-start gap-3 px-5 pt-1 pb-3 md:px-7 md:pt-7">
                <div className="min-w-0 flex-1">
                  {eyebrow ? (
                    <p className="text-gold-300 mb-1 text-[0.6875rem] font-bold tracking-[0.22em] uppercase">
                      {eyebrow}
                    </p>
                  ) : null}
                  <h2
                    id={titleId}
                    className="font-display text-gold-100 text-2xl leading-tight font-bold"
                  >
                    {title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t('common.close')}
                  className="text-mist hover:text-gold-200 -mt-1 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/[0.08]"
                >
                  <CloseIcon size={22} />
                </button>
              </header>
              <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-7 md:pb-7">
                {description ? (
                  <p id={descId} className="text-mist mb-5 text-[0.9375rem] leading-relaxed">
                    {description}
                  </p>
                ) : null}
                {children}
              </div>
              {footer ? (
                <footer className="border-gold-300/15 bg-felt-900/60 relative flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] md:px-7">
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
