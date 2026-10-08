/**
 * The Teen Patti regulars: original characters who gather round the carpet every Diwali
 * night for "just one hand" (docs/DECISIONS.md D-09). Persona text is game content, so it
 * lives here rather than in the UI dictionary.
 *
 * The bots play by the engine's strategy (easy or normal), not by their taglines: the
 * personalities are flavour, never tells. Every name is unique across all games.
 */
import { type BotPersona } from '@/games/core/module';

/** The uncle who has hosted the Diwali card party for forty years and still plays blind. */
export const CHACHA_CHAALBAAZ: BotPersona = {
  name: 'Chacha Chaalbaaz',
  tagline: 'Diwali-party host since forever. Chaals blind with a grin that gives nothing away.',
  avatar: { bg: '#741628', skin: '#b97b52', accessory: 'turban', accent: '#f5d77a' },
};

/** Ran a travelling tent cinema; watches every bet the way she watched the last reel. */
export const BINDIYA_BIOSCOPE: BotPersona = {
  name: 'Bindiya Bioscope',
  tagline: 'Ran the travelling tent cinema. Watches every bet like the final reel.',
  avatar: { bg: '#0e4630', skin: '#e2b48c', accessory: 'flower', accent: '#c22f47' },
};

/** The cousin who arrives late, raises early and laughs either way. */
export const TINKU_TIKKA: BotPersona = {
  name: 'Tinku Tikka',
  tagline: 'The cousin who arrives late, raises early and laughs either way.',
  avatar: { bg: '#1b5fc1', skin: '#8d5a3b', accessory: 'cap', accent: '#f4ecd8' },
};

/** A folk-theatre star for whom every pack is a tragedy in three acts. */
export const NANI_NAUTANKI: BotPersona = {
  name: 'Nani Nautanki',
  tagline: 'Folk-theatre star. Every pack is a tragedy in three acts.',
  avatar: { bg: '#b4841a', skin: '#c98f62', accessory: 'shades', accent: '#3b2a6b' },
};

/**
 * Everyone who can sit at a Teen Patti table, by seat: index 0 is seat 1 (the learner's
 * left). Tables of up to five seats use the first `players − 1` of them.
 */
export const TEENPATTI_CAST: readonly BotPersona[] = [
  CHACHA_CHAALBAAZ,
  BINDIYA_BIOSCOPE,
  TINKU_TIKKA,
  NANI_NAUTANKI,
];

/** The personas for a table of `players` seats (seats 1 … players − 1). */
export function teenPattiBots(players: number): BotPersona[] {
  return TEENPATTI_CAST.slice(0, Math.max(0, players - 1));
}
