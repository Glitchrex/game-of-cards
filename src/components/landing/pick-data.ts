/**
 * Data shared by the landing page (server) and the "Pick a game for me" dialog (client).
 * Server-safe: no React, no catalog import at runtime (types only), so the dialog chunk
 * never pulls the content files into the browser.
 */
import { type CatalogGame } from '@/lib/content/catalog';
import { type Mood } from '@/lib/content/schema';
import { type PlayersAnswer, type RecommendableGame, type TimeAnswer } from '@/lib/recommend';

/**
 * The slim, serialisable game record the client dialog receives: what the recommender
 * scores plus what the result card shows.
 */
export interface PickableGame extends RecommendableGame {
  name: string;
  hook: string;
  country: string;
  countryCode: string;
}

/** Props of the lazily loaded dialog (declared here so the trigger never imports its module). */
export interface PickAGameDialogProps {
  open: boolean;
  onClose: () => void;
  games: readonly PickableGame[];
}

/** Strip a catalog entry down to what the dialog needs (keeps the page payload small). */
export function toPickableGame(game: CatalogGame): PickableGame {
  return {
    slug: game.slug,
    name: game.name,
    tier: game.tier,
    players: { ...game.players },
    difficulty: game.difficulty,
    minutes: game.minutes,
    moods: [...game.moods],
    order: game.order,
    hook: game.hook,
    country: game.origin.country,
    countryCode: game.origin.countryCode,
  };
}

export const PLAYERS_ANSWERS = [
  'solo',
  'two',
  'small-group',
  'big-group',
] as const satisfies readonly PlayersAnswer[];
export const MOOD_ANSWERS = [
  'chill',
  'brainy',
  'social',
  'lucky',
  'competitive',
] as const satisfies readonly Mood[];
export const TIME_ANSWERS = ['quick', 'medium', 'long'] as const satisfies readonly TimeAnswer[];

/** Where "Start learning" goes: the 60-second primer, then a coached Blackjack hand. */
export const START_HREF = '/basics?next=/games/blackjack/try';

/** Jeet every new visitor starts with (mirrors `STARTING_BALANCE` in the wallet store). */
export const START_JEET = 1000;

/** "1–4" / "2" */
export function playerRange(players: { min: number; max: number }): string {
  return players.min === players.max ? `${players.min}` : `${players.min}–${players.max}`;
}

/**
 * Flag emoji for an ISO 3166-1 alpha-2 code (regional-indicator pair). "UN" (worldwide)
 * and anything malformed get a globe instead.
 */
export function flagEmoji(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (code === 'UN' || !/^[A-Z]{2}$/.test(code)) return '🌍';
  return String.fromCodePoint(...Array.from(code, (c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
