/**
 * Indian Rummy's bots — original characters (docs/DECISIONS.md D-09). The site plays the
 * game one-on-one, so `INDIAN_RUMMY_BOTS` is a single opponent; the rest of the roster is
 * ready for bigger tables (the engine and the Board support 2–6 seats: pass
 * `INDIAN_RUMMY_ROSTER.slice(0, players - 1)` as the bots).
 * Persona text is game content, so it lives here rather than in the UI dictionary.
 */
import { type BotPersona } from '@/games/core/module';

/**
 * Dadi Diamond has hosted the family's Diwali card party for sixty years. She sorts her
 * cards without looking, smiles at every discard, and has never once thrown away a joker.
 */
export const DADI_DIAMOND: BotPersona = {
  name: 'Dadi Diamond',
  tagline: 'Sixty Diwali card parties, and she has never thrown away a joker.',
  avatar: { bg: '#0f4c5c', skin: '#a8714f', accessory: 'bow', accent: '#e94f87' },
};

/** A retired ferry captain who watches the open pile the way he once watched the tide. */
export const CAPTAIN_CHUTNEY: BotPersona = {
  name: 'Captain Chutney',
  tagline: 'Retired ferry captain. Reads the open pile like a tide table.',
  avatar: { bg: '#1b3a6b', skin: '#d3a27a', accessory: 'cap', accent: '#f2c14e' },
};

/** Shuffles to a beat only he can hear, and drums the table when he is one card away. */
export const DJ_DHOLAK: BotPersona = {
  name: 'DJ Dholak',
  tagline: 'Shuffles to a beat only he can hear. Drums the table when he’s close.',
  avatar: { bg: '#3b1f5c', skin: '#8d5a3b', accessory: 'headphones', accent: '#40e0d0' },
};

/** Explains every one of his discards in detail. Nobody has ever asked him to. */
export const PROFESSOR_PATAKA: BotPersona = {
  name: 'Professor Pataka',
  tagline: 'Explains every discard in great detail. Nobody asked.',
  avatar: { bg: '#4a2c12', skin: '#e0b48c', accessory: 'monocle', accent: '#d4af37' },
};

/** Declares with a twirl, a bow and a paper crown she folded herself. */
export const RANI_RANGEELA: BotPersona = {
  name: 'Rani Rangeela',
  tagline: 'Declares with a twirl and a paper crown she folded herself.',
  avatar: { bg: '#7a1f3d', skin: '#c48a63', accessory: 'crown', accent: '#f5d77a' },
};

/** Every Indian Rummy character, in seat order (index 0 sits in seat 1). */
export const INDIAN_RUMMY_ROSTER: readonly BotPersona[] = [
  DADI_DIAMOND,
  CAPTAIN_CHUTNEY,
  DJ_DHOLAK,
  PROFESSOR_PATAKA,
  RANI_RANGEELA,
];

/** Personas for the bot seats of the default two-player table: index 0 is seat 1. */
export const INDIAN_RUMMY_BOTS: readonly BotPersona[] = [DADI_DIAMOND];
