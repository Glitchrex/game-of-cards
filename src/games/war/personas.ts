/**
 * War's opponent — an original character (docs/DECISIONS.md D-09).
 *
 * War has no decisions, so the bot never "thinks": its personality lives in its name,
 * tagline and avatar. Persona text is game content, so it lives here rather than in the
 * UI dictionary.
 */
import { type BotPersona } from '@/games/core/module';

/**
 * Bhaskar played the bugle in the Royal Talkies brass band, sounding the fanfare before
 * every newsreel. He still can't help himself: every tie at the War table gets a full
 * "Ta-ra-ra-RAA!" before the cards go down.
 */
export const BUGLE_BHASKAR: BotPersona = {
  name: 'Bugle Bhaskar',
  tagline: 'Retired brass-band bugler. Every tie gets a fanfare — “Ta-ra-ra-RAA, it’s WAR!”',
  avatar: {
    bg: '#1b3f7a',
    skin: '#a8734f',
    accessory: 'cap',
    accent: '#f5d77a',
  },
};

/** Personas for the bot seats: index 0 is seat 1, the only opponent. */
export const WAR_BOTS: readonly BotPersona[] = [BUGLE_BHASKAR];
