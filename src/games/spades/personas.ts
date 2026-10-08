/**
 * The three Spades players — original characters (docs/DECISIONS.md D-09), the crew of the
 * Roxy Royale's projection booth, who play Spades on an upturned film-can between reels.
 * Persona text is game content, so it lives here rather than in the UI dictionary.
 *
 * Seats play clockwise from the learner (seat 0, bottom): seat 1 sits on the learner's
 * left (an opponent), seat 2 across (the learner's partner), seat 3 on the right (the other
 * opponent).
 */
import { type BotPersona } from '@/games/core/module';

/**
 * Rafi did the falls, the leaps and the motorbike jumps for a hundred action reels, and
 * nobody ever saw his face. He plays the same way: he loves to swoop in late with a trump.
 */
export const STUNTMAN_RAFI: BotPersona = {
  name: 'Stuntman Rafi',
  tagline: 'Did every jump in a hundred action reels. Swoops in late with a trump.',
  avatar: {
    bg: '#7a2e14',
    skin: '#b47a50',
    accessory: 'shades',
    accent: '#1b1b1b',
  },
};

/**
 * Mausi Marigold sold every ticket at the Roxy's box office for thirty-five years, and
 * still counts out change faster than anyone. As your partner, she counts tricks the same
 * way — and she never forgets what you bid.
 */
export const MAUSI_MARIGOLD: BotPersona = {
  name: 'Mausi Marigold',
  tagline: 'Your partner. Box-office legend — counts tricks like ticket stubs.',
  avatar: {
    bg: '#8a5a0c',
    skin: '#d9a07a',
    accessory: 'flower',
    accent: '#f29f2a',
  },
};

/**
 * Lady Limelight ran the follow-spot for forty gala premieres, keeping the star lit no
 * matter where they wandered. At the card table nothing escapes her beam: she watches
 * every Spade that falls.
 */
export const LADY_LIMELIGHT: BotPersona = {
  name: 'Lady Limelight',
  tagline: 'Ran the follow-spot for forty premieres. Keeps every Spade in her beam.',
  avatar: {
    bg: '#2b2f6b',
    skin: '#f1cfae',
    accessory: 'crown',
    accent: '#c9d3ff',
  },
};

/**
 * Personas for the bot seats: index 0 is seat 1 (left, opponent), 1 is seat 2 (across, the
 * learner's partner), 2 is seat 3 (right, opponent).
 */
export const SPADES_BOTS: readonly BotPersona[] = [STUNTMAN_RAFI, MAUSI_MARIGOLD, LADY_LIMELIGHT];
