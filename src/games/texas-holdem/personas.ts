/**
 * The Hold'em regulars: original characters from the staff of the old Roxy Talkies, who
 * meet after the late show for one hand of poker (docs/DECISIONS.md D-09). Persona text is
 * game content, so it lives here rather than in the UI dictionary.
 *
 * The bots play by the engine's strategy (easy or normal), not by their taglines: the
 * personalities are flavour, never tells. Keep every name unique across all games.
 */
import { type BotPersona } from '@/games/core/module';

/** Played the interval organ for forty years; plays poker the way he played the organ. */
export const MAESTRO_MOTI: BotPersona = {
  name: 'Maestro Moti',
  tagline: 'Retired interval organist. Hums a little tune before every raise.',
  avatar: { bg: '#3b2a6b', skin: '#b97b52', accessory: 'beret', accent: '#c22f47' },
};

/** Ran the box-office till; knows the size of every pot to the chip. */
export const LAKSHMI_LEDGER: BotPersona = {
  name: 'Lakshmi Ledger',
  tagline: 'Box-office cashier. Counts the pot before you can blink.',
  avatar: { bg: '#0e4630', skin: '#d9a77c', accessory: 'monocle', accent: '#f5d77a' },
};

/** The snack-bar kid who just wants to see what the flop brings. */
export const BUNTY_POPCORN: BotPersona = {
  name: 'Bunty Popcorn',
  tagline: 'Snack-bar champ. Calls a lot — he just loves seeing the flop.',
  avatar: { bg: '#b4841a', skin: '#8d5a3b', accessory: 'cap', accent: '#c4122f' },
};

/** A silent-film star who never says a word at the table. */
export const DUCHESS_DOLLY: BotPersona = {
  name: 'Duchess Dolly',
  tagline: 'Silent-film star. Never says a word, never shows a card she needn’t.',
  avatar: { bg: '#741628', skin: '#f0c9a4', accessory: 'crown', accent: '#fbe8a6' },
};

/** Tears the tickets for the late show, and is always in a hurry to get to the interval. */
export const ROCKET_RAGHAV: BotPersona = {
  name: 'Rocket Raghav',
  tagline: 'Late-show ticket-tearer. Shoves all-in like the interval bell just rang.',
  avatar: { bg: '#1b5fc1', skin: '#a8714a', accessory: 'headphones', accent: '#f4ecd8' },
};

/**
 * Everyone who can sit at a Hold'em table, by seat: index 0 is seat 1 (the learner's left).
 * Tables of up to six seats use the first `players − 1` of them.
 */
export const HOLDEM_CAST: readonly BotPersona[] = [
  MAESTRO_MOTI,
  LAKSHMI_LEDGER,
  BUNTY_POPCORN,
  DUCHESS_DOLLY,
  ROCKET_RAGHAV,
];

/** The personas for a table of `players` seats (seats 1 … players − 1). */
export function holdemBots(players: number): BotPersona[] {
  return HOLDEM_CAST.slice(0, Math.max(0, players - 1));
}
