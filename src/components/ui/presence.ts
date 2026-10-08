'use client';
/**
 * Tiny enter/exit helpers for CSS-animated overlays (popovers, toasts): keep an element
 * mounted for `exitMs` after it is removed so its exit animation can play. Used instead of
 * an animation library by components that are on screen on every first load.
 */
import { useEffect, useRef, useState } from 'react';

/** `mounted` stays true for `exitMs` after `show` turns false (`exiting` during that time). */
export function usePresence(show: boolean, exitMs: number): { mounted: boolean; exiting: boolean } {
  const [mounted, setMounted] = useState(show);
  const [prevShow, setPrevShow] = useState(show);
  if (show !== prevShow) {
    setPrevShow(show);
    if (show) setMounted(true);
  }
  const exiting = mounted && !show;
  useEffect(() => {
    if (!exiting) return;
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [exiting, exitMs]);
  return { mounted: mounted || show, exiting };
}

export interface PresenceEntry<T> {
  item: T;
  /** Removed from the source list; still rendered while its exit animation plays. */
  exiting: boolean;
}

/**
 * The list to render for `items` (keyed by `id`): current items in order, plus removed ones
 * kept in place for `exitMs` while they animate out. New items are appended in order.
 */
export function usePresenceList<T extends { id: number | string }>(
  items: readonly T[],
  exitMs: number,
): PresenceEntry<T>[] {
  const [entries, setEntries] = useState<PresenceEntry<T>[]>(() =>
    items.map((item) => ({ item, exiting: false })),
  );
  const [prevItems, setPrevItems] = useState(items);
  const timers = useRef(new Map<T['id'], number>());

  if (items !== prevItems) {
    setPrevItems(items);
    const byId = new Map(items.map((item) => [item.id, item]));
    const next: PresenceEntry<T>[] = entries.map((entry) => {
      const current = byId.get(entry.item.id);
      return current ? { item: current, exiting: false } : { item: entry.item, exiting: true };
    });
    const known = new Set(entries.map((entry) => entry.item.id));
    for (const item of items) {
      if (!known.has(item.id)) next.push({ item, exiting: false });
    }
    setEntries(next);
  }

  // One removal timer per exiting entry (cancelled if the item comes back).
  useEffect(() => {
    const pending = timers.current;
    const exitingIds = new Set(entries.filter((e) => e.exiting).map((e) => e.item.id));
    for (const [id, timer] of pending) {
      if (!exitingIds.has(id)) {
        window.clearTimeout(timer);
        pending.delete(id);
      }
    }
    for (const id of exitingIds) {
      if (pending.has(id)) continue;
      pending.set(
        id,
        window.setTimeout(() => {
          pending.delete(id);
          setEntries((list) => list.filter((e) => !(e.exiting && e.item.id === id)));
        }, exitMs),
      );
    }
  }, [entries, exitMs]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) window.clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return entries;
}
