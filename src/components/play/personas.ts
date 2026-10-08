/**
 * Persona helpers shared by the play shell, the practice hand and game Boards.
 *
 * `GameModule.bots[i]` is the persona for seat i + 1. Boards receive
 * `BoardProps.personas` indexed BY SEAT (index 0 = the learner, see `YOU_PERSONA`),
 * so `personas[seat]` always works — build that array with `seatPersonas(module.bots)`.
 */
import { type BotPersona } from '@/games/core/module';
import { type PlayerId } from '@/games/core/types';
import { t } from '@/lib/i18n';

/** The learner's own seat (index 0 of BoardProps.personas). */
export const YOU_PERSONA: BotPersona = {
  name: t('play.seat.you'),
  tagline: t('play.seat.youTagline'),
  avatar: { bg: '#8a6312', skin: '#e9b98f', accessory: 'none', accent: '#f5d77a' },
};

/** The friendly table-side coach drawn in the Coach panel. */
export const COACH_PERSONA: BotPersona = {
  name: t('play.avatar.coach'),
  tagline: t('play.coach.eyebrow'),
  avatar: { bg: '#13593d', skin: '#c98f62', accessory: 'cap', accent: '#c22f47' },
};

/** BoardProps.personas: `[YOU_PERSONA, ...bots]`, so index = seat. */
export function seatPersonas(bots: readonly BotPersona[]): BotPersona[] {
  return [YOU_PERSONA, ...bots];
}

/** Persona for a seat given `module.bots` (seat 0 = the learner). */
export function personaForSeat(bots: readonly BotPersona[], seat: PlayerId): BotPersona | null {
  if (seat === 0) return YOU_PERSONA;
  return bots[seat - 1] ?? null;
}

/** "Mona", "Mona and Raju", "Mona, Raju and Zoya". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Content tips are written as "Tip: …"; the Tip card already says "Tip". */
export function stripTipPrefix(tip: string): string {
  const rest = tip.replace(/^\s*tip\s*[:—-]\s*/i, '');
  return rest === tip ? tip : rest.charAt(0).toUpperCase() + rest.slice(1);
}
