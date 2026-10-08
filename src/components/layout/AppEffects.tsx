'use client';
/**
 * Global side effects (renders nothing):
 * - mirrors settings.motion onto <html data-motion="reduce|full"> so the CSS
 *   reduced-motion overrides in globals.css apply ('system' removes it);
 * - unlocks WebAudio on the first user gesture (autoplay policies) — but only
 *   when sound is on. While muted no AudioContext is created at all, so a
 *   first tap never interrupts music the visitor is already playing (iOS);
 *   unmuting via the sound toggle unlocks audio inside that click instead.
 */
import { useEffect } from 'react';
import { unlockAudio } from '@/lib/sound';
import { useSettings } from '@/store/settings';

export function AppEffects() {
  const motion = useSettings((s) => s.motion);

  useEffect(() => {
    const root = document.documentElement;
    if (motion === 'system') delete root.dataset.motion;
    else root.dataset.motion = motion;
  }, [motion]);

  useEffect(() => {
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const unlock = () => {
      if (useSettings.getState().muted) return;
      unlockAudio();
      window.removeEventListener('pointerdown', unlock, opts);
      window.removeEventListener('keydown', unlock, opts);
    };
    window.addEventListener('pointerdown', unlock, opts);
    window.addEventListener('keydown', unlock, opts);
    return () => {
      window.removeEventListener('pointerdown', unlock, opts);
      window.removeEventListener('keydown', unlock, opts);
    };
  }, []);

  return null;
}
