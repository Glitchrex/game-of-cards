/**
 * The Crazy Eights regulars — original characters (docs/DECISIONS.md D-09), one per bot
 * seat. The table seats up to four, so there are three of them: seat 1 is Jugnu, seat 2
 * Madame Matinee and seat 3 (four-player tables) Chacha Chakri.
 *
 * Persona text is game content, so it lives here rather than in the UI dictionary.
 */
import { type BotPersona } from '@/games/core/module';

/**
 * Jugnu ("firefly") juggles in the cinema foyer between shows — three oranges, two
 * torches and, when nobody is looking, a pack of cards. He loves a rank match that
 * flips the suit out from under you.
 */
export const JUGNU_JUGGLER: BotPersona = {
  name: 'Jugnu the Juggler',
  tagline: 'Keeps three suits in the air, then drops an Eight when you least expect it.',
  avatar: { bg: '#1b5fc1', skin: '#a8714a', accessory: 'shades', accent: '#f5d77a' },
};

/**
 * Madame Matinee has not missed a two o’clock show in forty years. She knits through
 * the trailers, counts every card that is played, and always names the suit she holds most.
 */
export const MADAME_MATINEE: BotPersona = {
  name: 'Madame Matinee',
  tagline: 'Never misses a two o’clock show — or a chance to switch the suit.',
  avatar: { bg: '#6b2a7a', skin: '#e9c3a0', accessory: 'bow', accent: '#f08a98' },
};

/**
 * Chacha Chakri sells paper pinwheels at the ticket window and spins the suit around the
 * table just as happily. He hums film songs while he waits for his turn.
 */
export const CHACHA_CHAKRI: BotPersona = {
  name: 'Chacha Chakri',
  tagline: 'Spins the suit like a Diwali pinwheel — round and round it goes!',
  avatar: { bg: '#b4841a', skin: '#8d5a3b', accessory: 'turban', accent: '#c22f47' },
};

/** Personas for the bot seats: index 0 is seat 1, index 1 seat 2, index 2 seat 3. */
export const CRAZY_EIGHTS_BOTS: readonly BotPersona[] = [
  JUGNU_JUGGLER,
  MADAME_MATINEE,
  CHACHA_CHAKRI,
];
