/**
 * The Go Fish regulars — original characters (docs/DECISIONS.md D-09), one per bot seat.
 * The table seats up to five, so there are four of them: seat 1 is Machli Mira, seat 2
 * Kanta Kaka, seat 3 (four-player tables) Lighthouse Lata and seat 4 (five players)
 * Sardine Sunny.
 *
 * Persona text is game content, so it lives here rather than in the UI dictionary.
 */
import { type BotPersona } from '@/games/core/module';

/**
 * Mira ("machli" means fish) swims the morning laps at the lido behind the old Regal
 * cinema, then dries off in the front row of the matinee. She asks quickly, cheerfully and
 * often — and splashes about when she fishes her wish.
 */
export const MACHLI_MIRA: BotPersona = {
  name: 'Machli Mira',
  tagline: 'Swims laps before the matinee — and dives into the pond for every rank.',
  avatar: { bg: '#11706e', skin: '#c98f62', accessory: 'bow', accent: '#f08a98' },
};

/**
 * Kanta Kaka ("kanta" is a fish hook) rowed the river ferry for forty years. He keeps a
 * hook for every rank, listens to every question at the table and never forgets who said
 * "Go Fish".
 */
export const KANTA_KAKA: BotPersona = {
  name: 'Kanta Kaka',
  tagline: 'Old ferryman with a hook for every rank. “Got any Sevens, beta?”',
  avatar: { bg: '#1d4f7c', skin: '#8d5a3b', accessory: 'cap', accent: '#f5d77a' },
};

/**
 * Lata keeps the lighthouse at the end of the pier. Her beam sweeps the table: whoever
 * asks for a rank has just told her they hold it, and she'll come straight for it.
 */
export const LIGHTHOUSE_LATA: BotPersona = {
  name: 'Lighthouse Lata',
  tagline: 'Her beam sweeps the table — ask for a rank and she’ll remember it.',
  avatar: { bg: '#5b2a6f', skin: '#e9c3a0', accessory: 'monocle', accent: '#fbf6ea' },
};

/**
 * Sunny sells roasted peanuts in paper cones outside the ticket window and squeezes into
 * every queue, every photo and — given half a chance — every book on the table.
 */
export const SARDINE_SUNNY: BotPersona = {
  name: 'Sardine Sunny',
  tagline: 'Squeezes into every queue and every book. Packed like a tin of sardines!',
  avatar: { bg: '#b4841a', skin: '#a8714a', accessory: 'shades', accent: '#1b5fc1' },
};

/** Personas for the bot seats: index 0 is seat 1, index 1 seat 2, and so on. */
export const GO_FISH_BOTS: readonly BotPersona[] = [
  MACHLI_MIRA,
  KANTA_KAKA,
  LIGHTHOUSE_LATA,
  SARDINE_SUNNY,
];
