'use client';
import { useIsClient, useMediaQuery } from '@/components/ui/hooks';
import { useSettings } from '@/store/settings';

/**
 * True when animations should be reduced: the in-app setting wins ("reduce" /
 * "full"); "system" follows the OS prefers-reduced-motion media query.
 * Returns false during SSR and the hydration render so server and client markup
 * match; the real preference applies right after mount.
 */
export function useReducedMotionPref(): boolean {
  const pref = useSettings((s) => s.motion);
  // A plain media query (not motion's hook) keeps the animation library out of first-load JS.
  const system = useMediaQuery('(prefers-reduced-motion: reduce)');
  const isClient = useIsClient();
  if (!isClient) return false;
  if (pref === 'reduce') return true;
  if (pref === 'full') return false;
  return system;
}
