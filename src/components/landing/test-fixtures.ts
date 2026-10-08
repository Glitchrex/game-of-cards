/**
 * Schema-valid catalog entries for landing / SEO tests (built through the real Zod
 * schema, modelled on real games). Test-only.
 */
import { type CatalogGame } from '@/lib/content/catalog';
import {
  GameContentSchema,
  type GameContentInput,
  type Mood,
  type Region,
} from '@/lib/content/schema';

interface Spec {
  slug: string;
  name: string;
  tier: 1 | 2;
  players: [number, number, number?];
  difficulty: number;
  minutes: number;
  moods: Mood[];
  order: number;
  region: Region;
  country: string;
  countryCode: string;
  featured?: boolean;
  /** Cards shown in the first lesson scene. */
  cards?: string[];
}

function fixtureGame(s: Spec): CatalogGame {
  const [min, max, ideal] = s.players;
  const raw: GameContentInput = {
    slug: s.slug,
    name: s.name,
    origin: { country: s.country, countryCode: s.countryCode, region: s.region },
    type: 'shedding',
    players: { min, max, ...(ideal === undefined ? {} : { ideal }) },
    deck: 'Standard 52-card deck',
    difficulty: s.difficulty,
    length: `${s.minutes} minutes`,
    minutes: s.minutes,
    moods: s.moods,
    hook: `${s.name} in one line: a fun game worth learning.`,
    history: 'It has a long and colourful history.',
    featured: s.featured ?? false,
    order: s.order,
    variantTaught: 'Standard rules.',
    variants: 'Many house rules exist.',
    glossary: [
      { term: 'trick', definition: 'One card from each player.' },
      { term: 'trump', definition: 'A suit that beats the others.' },
      { term: 'meld', definition: 'A set or run of cards.' },
    ],
    lesson: Array.from({ length: 5 }, (_, i) => ({
      title: `Step ${i + 1}`,
      body: 'Here is how it works.',
      ...(i === 1 && s.cards
        ? { scene: { zones: [{ id: 'hand', cards: s.cards, layout: 'fan' as const }] } }
        : {}),
    })),
    mistakes: ['One', 'Two', 'Three'],
    tips: ['One', 'Two', 'Three'],
    quiz: Array.from({ length: 5 }, () => ({
      question: 'Which is right?',
      options: ['A', 'B', 'C', 'D'],
      answer: 0,
      explanation: 'Because A.',
    })),
    seo: {
      description: `Learn ${s.name} step by step with an animated lesson and a coached practice hand.`,
    },
  };
  return { ...GameContentSchema.parse(raw), tier: s.tier };
}

export const FIXTURE_GAMES: readonly CatalogGame[] = Object.freeze([
  fixtureGame({
    slug: 'blackjack',
    name: 'Blackjack',
    tier: 1,
    players: [1, 7, 1],
    difficulty: 2,
    minutes: 2,
    moods: ['lucky', 'brainy', 'chill'],
    order: 40,
    region: 'global',
    country: 'Worldwide',
    countryCode: 'UN',
    featured: true,
    cards: ['AS', 'KH', 'X1', 'AS', '7D'],
  }),
  fixtureGame({
    slug: 'teen-patti',
    name: 'Teen Patti',
    tier: 1,
    players: [3, 6, 4],
    difficulty: 2,
    minutes: 10,
    moods: ['lucky', 'social'],
    order: 20,
    region: 'south-asia',
    country: 'India',
    countryCode: 'IN',
    featured: true,
  }),
  fixtureGame({
    slug: 'hearts',
    name: 'Hearts',
    tier: 1,
    players: [4, 4, 4],
    difficulty: 2,
    minutes: 20,
    moods: ['brainy', 'competitive'],
    order: 60,
    region: 'north-america',
    country: 'United States',
    countryCode: 'US',
    featured: true,
  }),
  fixtureGame({
    slug: 'gin-rummy',
    name: 'Gin Rummy',
    tier: 2,
    players: [2, 2, 2],
    difficulty: 2,
    minutes: 15,
    moods: ['brainy', 'chill'],
    order: 70,
    region: 'north-america',
    country: 'United States',
    countryCode: 'US',
  }),
  fixtureGame({
    slug: 'scopa',
    name: 'Scopa',
    tier: 2,
    players: [2, 4, 2],
    difficulty: 2,
    minutes: 20,
    moods: ['social', 'brainy'],
    order: 80,
    region: 'europe',
    country: 'Italy',
    countryCode: 'IT',
  }),
  fixtureGame({
    slug: 'war',
    name: 'War',
    tier: 1,
    players: [2, 2, 2],
    difficulty: 1,
    minutes: 10,
    moods: ['lucky', 'chill'],
    order: 10,
    region: 'global',
    country: 'Worldwide',
    countryCode: 'UN',
  }),
  fixtureGame({
    slug: 'bridge',
    name: 'Bridge',
    tier: 2,
    players: [4, 4, 4],
    difficulty: 5,
    minutes: 60,
    moods: ['brainy', 'competitive'],
    order: 200,
    region: 'europe',
    country: 'England (UK)',
    countryCode: 'GB',
  }),
]);
