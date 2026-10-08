'use client';
/**
 * Roving tabindex for a row of buttons (the seats you can ask, the rank groups in your
 * hand): the row is ONE tab stop, ←/→ (or ↑/↓) move between buttons, Home/End jump to the
 * ends, and Enter/Space press the focused button (they are real <button>s). When the
 * focused button disappears (you gave those cards away, or made a book) focus moves to
 * its neighbour instead of falling back to <body>.
 */
import { useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';

export interface Roving {
  /** 0 for the current tab stop, −1 for the rest. */
  tabIndexFor: (key: string) => number;
  /** Ref callback for the button with `key`. */
  refFor: (key: string) => (el: HTMLElement | null) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  onFocus: (e: FocusEvent<HTMLElement>) => void;
  onBlur: (e: FocusEvent<HTMLElement>) => void;
}

export function useRoving(keys: readonly string[]): Roving {
  const [focus, setFocus] = useState<{ key: string | null; index: number }>({
    key: null,
    index: 0,
  });
  const els = useRef(new Map<string, HTMLElement>());
  const container = useRef<HTMLElement | null>(null);
  const within = useRef(false);
  const found = focus.key === null ? -1 : keys.indexOf(focus.key);
  const current =
    keys.length === 0 ? -1 : found >= 0 ? found : Math.min(focus.index, keys.length - 1);
  const currentKey = current >= 0 ? (keys[current] ?? null) : null;
  const keyList = keys.join('|');

  // The focused button left the row: keep focus in the row, on its neighbour. (Removing
  // a focused element may or may not fire blur, so "focus fell to <body> while the last
  // focused key vanished" is the signal.)
  useLayoutEffect(() => {
    if (!within.current) return;
    const active = document.activeElement;
    const box = container.current;
    if (active && box?.contains(active) && active !== box) return;
    const lost = active === null || active === document.body;
    const el = currentKey === null ? undefined : els.current.get(currentKey);
    if (lost && found < 0 && el) el.focus();
    else within.current = false;
  }, [keyList, currentKey, found]);

  const focusAt = (i: number) => {
    const key = keys[i];
    if (key === undefined) return;
    setFocus({ key, index: i });
    els.current.get(key)?.focus();
  };

  return {
    tabIndexFor: (key) => (key === currentKey ? 0 : -1),
    refFor: (key) => (el) => {
      if (el) els.current.set(key, el);
      else els.current.delete(key);
    },
    onKeyDown: (e) => {
      if (keys.length === 0 || e.altKey || e.ctrlKey || e.metaKey) return;
      let next: number;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          next = Math.min(current + 1, keys.length - 1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          next = Math.max(current - 1, 0);
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = keys.length - 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      focusAt(next);
    },
    onFocus: (e) => {
      container.current = e.currentTarget;
      within.current = true;
      const holder = (e.target as HTMLElement).closest<HTMLElement>('[data-roving-key]');
      const key = holder?.dataset.rovingKey;
      if (key !== undefined) {
        const index = keys.indexOf(key);
        if (index >= 0) setFocus({ key, index });
      }
    },
    onBlur: (e) => {
      // Focus moved somewhere else on purpose (not lost to a removed button).
      const to = e.relatedTarget as Node | null;
      if (to !== null && !e.currentTarget.contains(to)) within.current = false;
    },
  };
}
