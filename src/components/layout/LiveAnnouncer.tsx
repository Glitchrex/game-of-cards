'use client';
/**
 * Screen-reader live regions. Call `announce("You drew the 7 of Clubs")` from
 * anywhere; the message is read politely (or assertively for important events).
 */
import { useEffect, useState } from 'react';
import { create } from 'zustand';

interface AnnouncerState {
  polite: string;
  assertive: string;
  n: number;
}

const useAnnouncer = create<AnnouncerState>(() => ({ polite: '', assertive: '', n: 0 }));

export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  // Toggling a zero-width suffix makes repeated identical messages re-announce.
  useAnnouncer.setState((s) => ({
    ...s,
    [priority]: message + (s.n % 2 ? '​' : ''),
    n: s.n + 1,
  }));
}

export function LiveAnnouncer() {
  const { polite, assertive } = useAnnouncer();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="sr-announcer">
        {polite}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertive}
      </div>
    </>
  );
}
