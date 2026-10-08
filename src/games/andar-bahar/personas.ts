/**
 * The Andar Bahar dealer — an original character (docs/DECISIONS.md D-09).
 *
 * The dealer never chooses anything (the engine gives her exactly one forced move per card),
 * so her personality lives in her name, tagline and avatar rather than in her play. Persona
 * text is game content, so it lives here rather than in the UI dictionary. Every name is
 * unique across all games.
 */
import { type BotPersona } from '@/games/core/module';

/**
 * Jamuna ran the card tent at the Sonepur mela for twenty-five winters, and the crowds
 * nicknamed her "Jhatpat" — in a flash — because nobody ever saw a slower deal. Inside,
 * outside, inside, outside: her bangles keep the beat and the shout goes up at the match.
 */
export const JHATPAT_JAMUNA: BotPersona = {
  name: 'Jhatpat Jamuna',
  tagline: 'Mela card-tent legend. Inside, outside, inside — her bangles keep the beat.',
  avatar: {
    bg: '#0d3b5e',
    skin: '#a86d45',
    accessory: 'bow',
    accent: '#f5d77a',
  },
};

/** Personas for the bot seats: index 0 is seat 1, the dealer. */
export const ANDARBAHAR_BOTS: readonly BotPersona[] = [JHATPAT_JAMUNA];
