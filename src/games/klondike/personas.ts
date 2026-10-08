/**
 * Klondike's characters (docs/DECISIONS.md D-09: original, invented personas).
 *
 * Klondike is solitaire: there are no bot seats, so `KLONDIKE_BOTS` is empty and the shell
 * says "Just you and the deck". The table still has a host — the house cashier who pays out
 * for every card the learner brings home — shown beside the Vegas readout on the felt.
 * Persona text is game content, so it lives here rather than in the UI dictionary.
 */
import { type BotPersona } from '@/games/core/module';

/**
 * Pinto Projectionist ran the midnight reels at the Moonbeam Talkies for forty years —
 * alone in the booth, one reel at a time, never missing a changeover. Now he keeps the
 * books at the solitaire table and pays out, card by card, for every one that goes home.
 */
export const PINTO_PROJECTIONIST: BotPersona = {
  name: 'Pinto Projectionist',
  tagline: 'Ran the midnight reels solo for forty years. Pays out for every card you bring home.',
  avatar: {
    bg: '#1d3f6e',
    skin: '#b97a4f',
    accessory: 'monocle',
    accent: '#f5d77a',
  },
};

/** Personas for the bot seats (index 0 would be seat 1). Klondike has none. */
export const KLONDIKE_BOTS: readonly BotPersona[] = [];
