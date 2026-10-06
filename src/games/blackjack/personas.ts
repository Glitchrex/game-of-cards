/**
 * The Blackjack dealer — an original character (docs/DECISIONS.md D-09).
 *
 * The dealer never chooses anything (the engine gives her exactly one forced move at a
 * time), so her personality lives in her name, tagline and avatar rather than in her play.
 * Persona text is game content, so it lives here rather than in the UI dictionary.
 */
import { type BotPersona } from '@/games/core/module';

/**
 * Sitara ("star") spent thirty years snapping the clapperboard on the sets of Moonbeam
 * Studios, calling out every scene and take. Retired, she runs the Blackjack table the same
 * way: every card lands with a snap, and the house rules never get a second take.
 */
export const DEALER_SITARA: BotPersona = {
  name: 'Dealer Sitara',
  tagline: 'Film-set clapper, retired. Every card lands with a snap — “Take one!”',
  avatar: {
    bg: '#741628',
    skin: '#c98f62',
    accessory: 'flower',
    accent: '#fbf6ea',
  },
};

/** Personas for the bot seats: index 0 is seat 1, the dealer. */
export const BLACKJACK_BOTS: readonly BotPersona[] = [DEALER_SITARA];
