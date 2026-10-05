/**
 * Button styles shared by the primer. Primary/secondary reuse the house Button
 * classes (gold foil, ≥ 44 px targets, visible focus from globals.css); the chip
 * is the primer's own small toggle.
 */
import { buttonClasses } from '@/components/ui/Button';

export const primaryButton = buttonClasses({ variant: 'primary', size: 'md' });

export const finishButton = buttonClasses({ variant: 'primary', size: 'lg' });

export const secondaryButton = buttonClasses({ variant: 'secondary', size: 'md' });

export const chipButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition active:translate-y-px';
