/**
 * The three Hearts opponents — original characters (docs/DECISIONS.md D-09), regulars of
 * the Moonbeam Picture Palace's late-night card table. Persona text is game content, so it
 * lives here rather than in the UI dictionary.
 *
 * Seats play clockwise from the learner (seat 0, bottom): seat 1 sits on the learner's
 * left (and receives the learner's passed cards), seat 2 across, seat 3 on the right.
 */
import { type BotPersona } from '@/games/core/module';

/**
 * Auntie Bubbles sang the high notes for forty years of Moonbeam musicals without ever
 * appearing on screen. She still hums while she plays, and ducks under every trick the
 * way she ducked under the spotlight.
 */
export const AUNTIE_BUBBLES: BotPersona = {
  name: 'Auntie Bubbles',
  tagline: 'Retired playback singer. Hums sweetly while dodging every point.',
  avatar: {
    bg: '#5b2a86',
    skin: '#d9a57a',
    accessory: 'headphones',
    accent: '#f5d77a',
  },
};

/**
 * Colonel Kofta played the moustache-twirling villain in eleven matinee serials and never
 * once got the girl — so these days he refuses to take the Queen of Spades on principle.
 */
export const COLONEL_KOFTA: BotPersona = {
  name: 'Colonel Kofta',
  tagline: 'Matinee villain, eleven serials. Twirls his moustache at the Queen.',
  avatar: {
    bg: '#1d3f6e',
    skin: '#a8714b',
    accessory: 'monocle',
    accent: '#e8e2d0',
  },
};

/**
 * Tilly showed people to their seats with a torch for thirty winters. She notices every
 * card that leaves a hand, and sells toffees at the interval between tricks.
 */
export const USHERETTE_TILLY: BotPersona = {
  name: 'Usherette Tilly',
  tagline: 'Torch in hand, toffee in pocket. Remembers every card that falls.',
  avatar: {
    bg: '#0f5a4a',
    skin: '#f0c9a4',
    accessory: 'bow',
    accent: '#c22f47',
  },
};

/** Personas for the bot seats: index 0 is seat 1 (left), 1 is seat 2 (across), 2 is seat 3 (right). */
export const HEARTS_BOTS: readonly BotPersona[] = [AUNTIE_BUBBLES, COLONEL_KOFTA, USHERETTE_TILLY];
