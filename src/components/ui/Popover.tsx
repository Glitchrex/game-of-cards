'use client';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useReducedMotionPref } from '@/lib/motion';
import { cn } from './cn';
import { usePresence } from './presence';

export interface PopoverProps {
  /** Content of the trigger button (text or icon). */
  trigger: ReactNode;
  /** Accessible name for icon-only triggers. */
  triggerLabel?: string;
  triggerClassName?: string;
  /** Popover body. Pass a function to receive `close()`. */
  children: ReactNode | ((api: { close: () => void }) => ReactNode);
  /** Optional heading inside the panel; when set the panel is a labelled dialog. */
  title?: ReactNode;
  /** Open when the trigger receives keyboard focus (glossary terms). Default false. */
  openOnFocus?: boolean;
  /** Close when focus leaves the trigger + panel. Default true. */
  closeOnBlur?: boolean;
  align?: 'start' | 'center' | 'end';
  side?: 'bottom' | 'top';
  /** Render the wrapper inline (for terms inside running text). */
  inline?: boolean;
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  panelClassName?: string;
}

const EDGE = 8;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** CSS enter/exit animation of the panel (keyframes in globals.css). */
function panelAnimation(reduce: boolean, side: 'bottom' | 'top', exiting: boolean): CSSProperties {
  const sign = side === 'bottom' ? -1 : 1;
  return {
    animation: `${exiting ? 'goc-pop-out' : 'goc-pop-in'} ${reduce ? 100 : 160}ms ${EASE} both`,
    ['--goc-in-y' as string]: reduce ? '0px' : `${sign * 6}px`,
    ['--goc-in-scale' as string]: reduce ? 1 : 0.97,
    ['--goc-out-y' as string]: reduce ? '0px' : `${sign * 4}px`,
    ['--goc-out-scale' as string]: reduce ? 1 : 0.98,
  };
}

/**
 * Click/focus popover anchored to its trigger. The trigger is a real <button>
 * with aria-expanded/aria-controls; Escape closes and returns focus, blurring
 * away or clicking outside closes. The panel is clamped to the viewport.
 */
export function Popover({
  trigger,
  triggerLabel,
  triggerClassName,
  children,
  title,
  openOnFocus = false,
  closeOnBlur = true,
  align = 'start',
  side = 'bottom',
  inline = false,
  open: controlledOpen,
  onOpenChange,
  className,
  panelClassName,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const panelId = useId();
  const titleId = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  const pointerDown = useRef(false);
  /** Set when the user explicitly opened a titled (dialog) popover: move focus into it. */
  const focusPanelOnOpen = useRef(false);
  const reduce = useReducedMotionPref();
  const presence = usePresence(open, reduce ? 100 : 160);

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange],
  );
  const close = useCallback(() => setOpen(false), [setOpen]);

  // Close on outside pointer down.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const w = wrapperRef.current;
      if (w && e.target instanceof Node && !w.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, setOpen]);

  // A titled popover is a (non-modal) dialog: when the user opens it on
  // purpose, move focus inside so Tab continues through its controls.
  useEffect(() => {
    if (!open || !focusPanelOnOpen.current) return;
    focusPanelOnOpen.current = false;
    panelRef.current?.focus({ preventScroll: true });
  }, [open]);

  // Keep the panel inside the viewport horizontally.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    panel.style.marginLeft = '0px';
    const rect = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    let shift = 0;
    if (rect.right > vw - EDGE) shift = vw - EDGE - rect.right;
    if (rect.left + shift < EDGE) shift = EDGE - rect.left;
    if (shift !== 0) panel.style.marginLeft = `${shift}px`;
  }, [open]);

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' && !open && side === 'bottom') {
      e.preventDefault();
      focusPanelOnOpen.current = Boolean(title);
      setOpen(true);
    }
  };

  const onWrapperKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  const onWrapperBlur = (e: FocusEvent<HTMLSpanElement>) => {
    if (!closeOnBlur || !open) return;
    const next = e.relatedTarget;
    if (next instanceof Node && wrapperRef.current?.contains(next)) return;
    // Focus moved to nothing (e.g. clicking empty space) — the pointerdown
    // handler decides; only close for real focus moves elsewhere.
    if (next === null) return;
    setOpen(false);
  };

  const body = typeof children === 'function' ? children({ close }) : children;

  const placement = cn(
    side === 'bottom' ? 'top-full mt-2 origin-top' : 'bottom-full mb-2 origin-bottom',
    align === 'start' && 'left-0',
    align === 'end' && 'right-0',
    align === 'center' && 'left-1/2 -translate-x-1/2',
  );

  return (
    <span
      ref={wrapperRef}
      className={cn('relative', inline ? 'inline' : 'inline-flex', className)}
      onKeyDown={onWrapperKeyDown}
      onBlur={onWrapperBlur}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={triggerLabel}
        aria-haspopup={title ? 'dialog' : undefined}
        onPointerDown={() => {
          pointerDown.current = true;
        }}
        onFocus={() => {
          if (openOnFocus && !pointerDown.current && !open) setOpen(true);
        }}
        onBlur={() => {
          pointerDown.current = false;
        }}
        onClick={() => {
          pointerDown.current = false;
          focusPanelOnOpen.current = !open && Boolean(title);
          setOpen(!open);
        }}
        onKeyDown={onTriggerKeyDown}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {presence.mounted ? (
        <span
          ref={panelRef}
          id={panelId}
          role={title ? 'dialog' : undefined}
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
          style={panelAnimation(reduce, side, presence.exiting)}
          className={cn(
            'border-gold-300/35 bg-felt-800 text-cream absolute z-50 block w-max max-w-[min(22rem,calc(100vw-1rem))] rounded-xl border p-4 text-left text-sm leading-relaxed font-normal normal-case shadow-[0_18px_40px_-12px_rgb(0_0_0/0.8),inset_0_1px_0_rgb(255_255_255/0.06)] outline-none',
            placement,
            panelClassName,
          )}
        >
          {title ? (
            <span
              id={titleId}
              className="font-display text-gold-100 mb-2 block text-lg leading-tight font-bold"
            >
              {title}
            </span>
          ) : null}
          {body}
        </span>
      ) : null}
    </span>
  );
}
