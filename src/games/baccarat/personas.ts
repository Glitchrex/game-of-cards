/**
 * The Baccarat croupier — an original character (docs/DECISIONS.md D-09).
 *
 * The croupier never chooses anything: the engine gives her exactly one forced move at a
 * time (deal the next card), and the drawing rules decide where it goes. So her personality
 * lives in her name, tagline and avatar rather than in her play. Persona text is game
 * content, so it lives here rather than in the UI dictionary.
 */
import { type BotPersona } from '@/games/core/module';

/**
 * Chandni ("moonlight") played the piano under the screen of the Roxy Picture Palace for
 * every silent film it ever showed. When the talkies came she moved to the card room
 * upstairs, and she still deals the way she played: in strict tempo, never a wrong note —
 * Player, Banker, Player, Banker.
 */
export const CROUPIER_CHANDNI: BotPersona = {
  name: 'Croupier Chandni',
  tagline: 'Silent-film pianist turned croupier. Deals in strict tempo — never a wrong note.',
  avatar: {
    bg: '#1f2f5c',
    skin: '#b97f56',
    accessory: 'monocle',
    accent: '#f5d77a',
  },
};

/** Personas for the bot seats: index 0 is seat 1, the croupier. */
export const BACCARAT_BOTS: readonly BotPersona[] = [CROUPIER_CHANDNI];
