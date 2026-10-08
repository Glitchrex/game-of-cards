'use client';
import { useEffect, useRef } from 'react';
import { useHydrated } from '@/store/hydrate';
import { useProgress } from '@/store/progress';

/**
 * Returns a ref that receives focus when the element mounts, if `enabled`.
 * Used to move focus to a new step's heading so screen readers announce it.
 */
export function useFocusOnMount<T extends HTMLElement>(enabled: boolean) {
  const ref = useRef<T>(null);
  // Only the value at mount matters: a new step remounts its heading.
  const enabledAtMount = useRef(enabled);
  useEffect(() => {
    if (enabledAtMount.current) ref.current?.focus();
  }, []);
  return ref;
}

/** Marks a game as started once the persisted progress store has hydrated. */
export function useMarkStarted(slug: string) {
  const hydrated = useHydrated();
  useEffect(() => {
    if (hydrated) useProgress.getState().markStarted(slug);
  }, [hydrated, slug]);
}

/**
 * Runs `record` once `when` becomes true and the progress store has hydrated
 * (writing before hydration would be overwritten by the persisted state).
 * Re-arms whenever `when` goes back to false.
 */
export function useRecordWhen(when: boolean, record: () => void) {
  const hydrated = useHydrated();
  const done = useRef(false);
  const recordRef = useRef(record);
  useEffect(() => {
    recordRef.current = record;
  });
  useEffect(() => {
    if (!when) {
      done.current = false;
      return;
    }
    if (!hydrated || done.current) return;
    done.current = true;
    recordRef.current();
  }, [when, hydrated]);
}
