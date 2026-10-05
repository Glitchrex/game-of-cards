'use client';
import { useReducedMotion } from 'motion/react';
import { useIsClient } from '@/components/ui/hooks';
import { useSettings } from '@/store/settings';

/**
 * True when animations should be reduced: the in-app setting wins ("reduce" /
 * "full"); "system" follows the OS prefers-reduced-motion media query.
 * Returns false during SSR and the hydration render so server and client markup
 * match; the real preference applies right after mount.
 */
export function useReducedMotionPref(): boolean {
  const pref = useSettings((s) => s.motion);
  const system = useReducedMotion() ?? false;
  const isClient = useIsClient();
  if (!isClient) return false;
  if (pref === 'reduce') return true;
  if (pref === 'full') return false;
  return system;
}
