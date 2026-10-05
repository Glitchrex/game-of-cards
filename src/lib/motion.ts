'use client';
import { useReducedMotion } from 'motion/react';
import { useSettings } from '@/store/settings';

/**
 * True when animations should be reduced: the in-app setting wins ("reduce" /
 * "full"); "system" follows the OS prefers-reduced-motion media query.
 */
export function useReducedMotionPref(): boolean {
  const pref = useSettings((s) => s.motion);
  const system = useReducedMotion() ?? false;
  if (pref === 'reduce') return true;
  if (pref === 'full') return false;
  return system;
}
