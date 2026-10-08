'use client';
import { motion } from 'motion/react';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useReducedMotionPref } from '@/lib/motion';
import { cn } from './cn';

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
  /** Optional count/badge shown after the label. */
  badge?: ReactNode;
  disabled?: boolean;
  /** `data-testid` for the tab button (role="tab"). */
  testId?: string;
}

export interface TabsProps {
  items: TabItem[];
  /** Accessible name of the tablist. */
  label: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** automatic = arrow keys select immediately; manual = arrows move focus, Enter/Space selects. */
  activation?: 'automatic' | 'manual';
  /** Keep inactive panels mounted (hidden) to preserve their state. */
  keepMounted?: boolean;
  className?: string;
  listClassName?: string;
  panelClassName?: string;
}

/** WAI-ARIA tabs: roving tabindex, ← → Home End, linked tab/tabpanel ids. */
export function Tabs({
  items,
  label,
  value,
  defaultValue,
  onValueChange,
  activation = 'automatic',
  keepMounted = false,
  className,
  listClassName,
  panelClassName,
}: TabsProps) {
  const baseId = useId();
  const enabled = items.filter((i) => !i.disabled);
  const [internal, setInternal] = useState(defaultValue ?? enabled[0]?.id ?? '');
  const selected = value ?? internal;
  // Exactly one tab is always reachable with Tab, even if `selected` names no enabled tab.
  const tabStop = enabled.some((i) => i.id === selected) ? selected : enabled[0]?.id;
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const reduce = useReducedMotionPref();

  const select = (id: string) => {
    if (value === undefined) setInternal(id);
    onValueChange?.(id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const idx = enabled.findIndex((i) => i.id === id);
    if (idx < 0) return;
    let target: TabItem | undefined;
    if (e.key === 'ArrowRight') target = enabled[(idx + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') target = enabled[(idx - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') target = enabled[0];
    else if (e.key === 'End') target = enabled[enabled.length - 1];
    else if ((e.key === 'Enter' || e.key === ' ') && activation === 'manual') {
      e.preventDefault();
      select(id);
      return;
    }
    if (!target) return;
    e.preventDefault();
    refs.current.get(target.id)?.focus();
    if (activation === 'automatic') select(target.id);
  };

  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="horizontal"
        className={cn(
          'border-gold-300/20 bg-felt-950/50 relative flex max-w-full [scrollbar-width:none] gap-1 overflow-x-auto rounded-xl border p-1',
          listClassName,
        )}
      >
        {items.map((item) => {
          const isSel = item.id === selected;
          return (
            <button
              key={item.id}
              ref={(el) => {
                if (el) refs.current.set(item.id, el);
                else refs.current.delete(item.id);
              }}
              id={tabId(item.id)}
              type="button"
              role="tab"
              aria-selected={isSel}
              aria-controls={panelId(item.id)}
              tabIndex={item.id === tabStop ? 0 : -1}
              disabled={item.disabled}
              data-testid={item.testId}
              onClick={() => select(item.id)}
              onKeyDown={(e) => onKeyDown(e, item.id)}
              className={cn(
                'relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-150 disabled:opacity-40',
                isSel ? 'text-ink' : 'text-mist hover:text-cream',
              )}
            >
              {isSel ? (
                <motion.span
                  layoutId={`${baseId}-indicator`}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-lg bg-[linear-gradient(180deg,var(--color-gold-200),var(--color-gold-400))] shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_4px_14px_-6px_rgb(236_193_83/0.8)]"
                  transition={
                    reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }
                  }
                />
              ) : null}
              <span className="relative">{item.label}</span>
              {item.badge !== undefined ? <span className="relative">{item.badge}</span> : null}
            </button>
          );
        })}
      </div>
      {items.map((item) => {
        const isSel = item.id === selected;
        if (!isSel && !keepMounted) return null;
        return (
          <div
            key={item.id}
            id={panelId(item.id)}
            role="tabpanel"
            aria-labelledby={tabId(item.id)}
            tabIndex={0}
            hidden={!isSel}
            className={cn('mt-4 rounded-lg', panelClassName)}
          >
            {item.content}
          </div>
        );
      })}
    </div>
  );
}
