/**
 * "Pick a game for me": ranks catalog games against three quick answers — how many
 * people are playing, what mood they're in and how much time they have — and explains
 * every pick in one friendly sentence.
 *
 * Pure and deterministic: the same games and answers always give the same ranking.
 *
 * Scoring (higher is better):
 *  - Players are a filter: only games whose min..max range overlaps the chosen bucket are
 *    returned (solo = 1, two = 2, small group = 3–4, big group = 5+). If *no* game fits,
 *    every game is returned with a penalty per missing seat, so the picker is never empty.
 *    +1 when the game's ideal player count falls inside the bucket.
 *  - Mood: +6 when it is the game's main mood (first listed), +5 for any other listed mood.
 *  - Time: up to +4 — full marks inside the bucket (quick ≤ 10 min, medium ≤ 25, long > 25),
 *    up to +3 for a near miss, fading to 0 when the length is 4× off. Never excludes a game.
 *  - Beginner-friendly: +0.4 per difficulty step below 5 (difficulty 1 → +1.6).
 *  - Tier 1 (playable vs a bot here): +1.5 when `preferPlayable` (default true).
 * Ties: Tier 1 first, then lower difficulty, then journey order, then slug.
 */
import { type CatalogGame } from '@/lib/content/catalog';
import { type Mood } from '@/lib/content/schema';

export type PlayersAnswer = 'solo' | 'two' | 'small-group' | 'big-group';
export type TimeAnswer = 'quick' | 'medium' | 'long';

export interface RecommendAnswers {
  players: PlayersAnswer;
  mood: Mood;
  time: TimeAnswer;
}

/**
 * The catalog fields the recommender reads. `recommendGames` accepts full `CatalogGame`s or
 * slim objects with just these fields (handy for keeping a client component's props small).
 */
export type RecommendableGame = Pick<
  CatalogGame,
  'slug' | 'tier' | 'players' | 'difficulty' | 'minutes' | 'moods' | 'order'
>;

export interface Recommendation<G extends RecommendableGame = CatalogGame> {
  game: G;
  /** Higher is better (rounded to 2 decimals). */
  score: number;
  /** e.g. "Perfect for 2 players, quick (about 5 minutes) and full of lucky moments." */
  reason: string;
}

export interface RecommendOptions {
  /** Give Tier 1 (playable vs bot) games a bonus. Default true. */
  preferPlayable?: boolean;
}

/** Seat counts each players answer stands for (inclusive; big group has no upper limit). */
export const PLAYER_BUCKETS: Readonly<Record<PlayersAnswer, { min: number; max: number }>> = {
  solo: { min: 1, max: 1 },
  two: { min: 2, max: 2 },
  'small-group': { min: 3, max: 4 },
  'big-group': { min: 5, max: Number.POSITIVE_INFINITY },
};

/** Minutes each time answer stands for: `after < minutes ≤ upTo`. */
export const TIME_BUCKETS: Readonly<Record<TimeAnswer, { after: number; upTo: number }>> = {
  quick: { after: 0, upTo: 10 },
  medium: { after: 10, upTo: 25 },
  long: { after: 25, upTo: Number.POSITIVE_INFINITY },
};

const TIME_ORDER: readonly TimeAnswer[] = ['quick', 'medium', 'long'];

const WEIGHTS = {
  moodPrimary: 6,
  moodSecondary: 5,
  time: 4,
  /** Share of the time score a near miss can still earn. */
  timeNearMiss: 0.75,
  idealPlayers: 1,
  perEasierStep: 0.4,
  tier1: 1.5,
  /** Penalty per missing/extra seat, only used when no game fits the players answer. */
  perSeatOff: 2,
} as const;

const MOOD_PHRASES: Readonly<Record<Mood, string>> = {
  chill: 'wonderfully relaxed',
  brainy: 'full of clever decisions',
  social: 'great for chatting and laughing together',
  lucky: 'full of lucky moments',
  competitive: 'packed with friendly rivalry',
};

/** Which time answer a game of this length belongs to. */
export function timeBucketOf(minutes: number): TimeAnswer {
  if (minutes <= TIME_BUCKETS.quick.upTo) return 'quick';
  if (minutes <= TIME_BUCKETS.medium.upTo) return 'medium';
  return 'long';
}

/** True when the game's player range overlaps the players answer. */
export function fitsPlayers(game: Pick<CatalogGame, 'players'>, players: PlayersAnswer): boolean {
  const bucket = PLAYER_BUCKETS[players];
  return game.players.min <= bucket.max && game.players.max >= bucket.min;
}

/** How many seats the game's range is away from the bucket (0 when it fits). */
function seatsOff(game: Pick<CatalogGame, 'players'>, players: PlayersAnswer): number {
  const bucket = PLAYER_BUCKETS[players];
  if (game.players.max < bucket.min) return bucket.min - game.players.max;
  if (game.players.min > bucket.max) return game.players.min - bucket.max;
  return 0;
}

/** 0..1: 1 inside the bucket, up to `timeNearMiss` just outside, 0 when 4× off. */
function timeFit(minutes: number, time: TimeAnswer): number {
  const { after, upTo } = TIME_BUCKETS[time];
  if (minutes > after && minutes <= upTo) return 1;
  const ratio = minutes > upTo ? minutes / upTo : after / Math.max(minutes, 0.1);
  return WEIGHTS.timeNearMiss * Math.max(0, 1 - Math.log2(ratio) / 2);
}

function idealInBucket(game: RecommendableGame, players: PlayersAnswer): boolean {
  const ideal = game.players.ideal;
  if (ideal === undefined) return false;
  const bucket = PLAYER_BUCKETS[players];
  return ideal >= bucket.min && ideal <= bucket.max;
}

const span = (lo: number, hi: number) => (lo === hi ? `${lo}` : `${lo}–${hi}`);

function playersPhrase(game: RecommendableGame, players: PlayersAnswer, fits: boolean): string {
  const { min, max } = game.players;
  if (!fits) return max === 1 ? 'Best played solo' : `Best with ${span(min, max)} players`;
  const lead = idealInBucket(game, players) ? 'Perfect for' : 'Great for';
  if (players === 'solo') return `${lead} playing solo`;
  const bucket = PLAYER_BUCKETS[players];
  return `${lead} ${span(Math.max(min, bucket.min), Math.min(max, bucket.max))} players`;
}

function timePhrase(minutes: number, wanted: TimeAnswer): string {
  const about = `about ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const actual = timeBucketOf(minutes);
  if (actual === wanted) {
    if (actual === 'quick') return `quick (${about})`;
    if (actual === 'medium') return `just the right length (${about})`;
    return `a nice long game (${about})`;
  }
  return TIME_ORDER.indexOf(actual) < TIME_ORDER.indexOf(wanted)
    ? `a little quicker than you asked (${about})`
    : `a bit longer than you asked (${about})`;
}

function moodPhrase(game: RecommendableGame, mood: Mood): string {
  if (game.moods.includes(mood)) return MOOD_PHRASES[mood];
  const main = game.moods[0];
  return main ? MOOD_PHRASES[main] : 'a great way to learn something new';
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Rank games for the "Pick a game for me" answers, best first. Returns every game that fits
 * the players answer (or every game, penalised, if none fits). Never mutates `games`.
 */
export function recommendGames<G extends RecommendableGame = CatalogGame>(
  games: readonly G[],
  answers: RecommendAnswers,
  opts: RecommendOptions = {},
): Recommendation<G>[] {
  const preferPlayable = opts.preferPlayable ?? true;
  const anyFits = games.some((g) => fitsPlayers(g, answers.players));

  const scored: Recommendation<G>[] = [];
  for (const game of games) {
    const fits = fitsPlayers(game, answers.players);
    if (anyFits && !fits) continue;

    let score = 0;
    const moodIndex = game.moods.indexOf(answers.mood);
    if (moodIndex === 0) score += WEIGHTS.moodPrimary;
    else if (moodIndex > 0) score += WEIGHTS.moodSecondary;
    score += WEIGHTS.time * timeFit(game.minutes, answers.time);
    if (idealInBucket(game, answers.players)) score += WEIGHTS.idealPlayers;
    score += WEIGHTS.perEasierStep * (5 - game.difficulty);
    if (preferPlayable && game.tier === 1) score += WEIGHTS.tier1;
    if (!fits) score -= WEIGHTS.perSeatOff * seatsOff(game, answers.players);

    const reason =
      `${playersPhrase(game, answers.players, fits)}, ` +
      `${timePhrase(game.minutes, answers.time)} and ${moodPhrase(game, answers.mood)}.`;
    scored.push({ game, score: round2(score), reason });
  }

  return scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.game.tier - b.game.tier ||
      a.game.difficulty - b.game.difficulty ||
      a.game.order - b.game.order ||
      (a.game.slug < b.game.slug ? -1 : a.game.slug > b.game.slug ? 1 : 0),
  );
}
