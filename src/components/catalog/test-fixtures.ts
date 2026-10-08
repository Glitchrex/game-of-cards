/**
 * Test fixtures: small, valid CatalogGame objects for catalog and learn tests.
 * Parsed with the real Zod schema so they always match the content contract.
 */
import { type CatalogGame } from '@/lib/content/catalog';
import { GameContentSchema, type GameContentInput } from '@/lib/content/schema';

export interface FixtureSpec {
  slug: string;
  name: string;
  aka?: string[];
  country?: string;
  countryCode?: string;
  region?: GameContentInput['origin']['region'];
  type?: GameContentInput['type'];
  players?: [number, number];
  difficulty?: number;
  moods?: GameContentInput['moods'];
  hook?: string;
  tier?: 1 | 2;
  order?: number;
  example?: GameContentInput['example'];
}

export function fixtureGame(spec: FixtureSpec): CatalogGame {
  const raw: GameContentInput = {
    slug: spec.slug,
    name: spec.name,
    ...(spec.aka ? { aka: spec.aka } : {}),
    origin: {
      country: spec.country ?? 'Worldwide',
      countryCode: spec.countryCode ?? 'UN',
      region: spec.region ?? 'global',
    },
    type: spec.type ?? 'trick-taking',
    players: { min: spec.players?.[0] ?? 2, max: spec.players?.[1] ?? 4 },
    deck: 'One standard 52-card deck',
    difficulty: spec.difficulty ?? 2,
    length: '10–15 minutes',
    minutes: 15,
    moods: spec.moods ?? ['social'],
    hook: spec.hook ?? `The ${spec.name} hook line`,
    history: 'A long and **interesting** history with a [[trick]] or two.',
    order: spec.order ?? 10,
    variantTaught: 'The standard rules.',
    variants: 'Plenty of house rules exist.',
    glossary: [
      { term: 'trick', definition: 'One card from each player, won by the highest.' },
      { term: 'trump', definition: 'The boss suit that beats all the others.' },
      { term: 'deal', definition: 'Handing out the cards.' },
    ],
    lesson: Array.from({ length: 5 }, (_, i) => ({
      title: `Lesson step ${i + 1}`,
      body: `Body of step ${i + 1} about the [[deal]].`,
    })),
    mistakes: ['Mistake one', 'Mistake two', 'Mistake three'],
    tips: ['Tip one', 'Tip two', 'Tip three'],
    quiz: Array.from({ length: 5 }, (_, i) => ({
      question: `Question ${i + 1}?`,
      options: ['A', 'B', 'C', 'D'],
      answer: i % 4,
      explanation: `Because ${i + 1}.`,
    })),
    seo: {
      description: `Learn ${spec.name} step by step with animated lessons, a coached hand and a quiz.`,
    },
    ...(spec.example ? { example: spec.example } : {}),
  };
  return { ...GameContentSchema.parse(raw), tier: spec.tier ?? 2 };
}

/** A varied little catalog covering every facet. */
export const FIXTURE_GAMES: CatalogGame[] = [
  fixtureGame({
    slug: 'teen-patti',
    name: 'Teen Patti',
    aka: ['3 Patti', 'Flash'],
    country: 'India',
    countryCode: 'IN',
    region: 'south-asia',
    type: 'comparing',
    players: [2, 5],
    difficulty: 2,
    moods: ['social', 'lucky'],
    hook: 'Three cards, one pot and a lot of nerve',
    tier: 1,
    order: 1,
  }),
  fixtureGame({
    slug: 'hearts',
    name: 'Hearts',
    country: 'United States',
    countryCode: 'US',
    region: 'north-america',
    type: 'trick-taking',
    players: [4, 4],
    difficulty: 3,
    moods: ['brainy', 'competitive'],
    hook: 'Dodge every Heart and the Queen of Spades',
    tier: 1,
    order: 2,
  }),
  fixtureGame({
    slug: 'klondike',
    name: 'Klondike Solitaire',
    country: 'Worldwide',
    countryCode: 'UN',
    region: 'global',
    type: 'solitaire',
    players: [1, 1],
    difficulty: 2,
    moods: ['chill'],
    hook: 'Uncover every hidden card and send all 52 home',
    tier: 1,
    order: 3,
  }),
  fixtureGame({
    slug: 'scopa',
    name: 'Scopa',
    country: 'Italy',
    countryCode: 'IT',
    region: 'europe',
    type: 'fishing',
    players: [2, 4],
    difficulty: 3,
    moods: ['social', 'brainy'],
    hook: 'Sweep the table and shout Scopa',
    order: 4,
  }),
  fixtureGame({
    slug: 'tien-len',
    name: 'Tiến Lên',
    aka: ['Thirteen'],
    country: 'Vietnam',
    countryCode: 'VN',
    region: 'southeast-asia',
    type: 'shedding',
    players: [2, 4],
    difficulty: 3,
    moods: ['competitive', 'social'],
    hook: 'Race to empty your hand — the 2♠ rules them all',
    order: 5,
  }),
  fixtureGame({
    slug: 'canasta',
    name: 'Canasta',
    country: 'Uruguay',
    countryCode: 'UY',
    region: 'latin-america',
    type: 'rummy',
    players: [2, 6],
    difficulty: 4,
    moods: ['social'],
    hook: 'Build seven-card canastas with your partner',
    order: 6,
  }),
  fixtureGame({
    slug: 'skat',
    name: 'Skat',
    country: 'Germany',
    countryCode: 'DE',
    region: 'europe',
    type: 'trick-taking',
    players: [3, 3],
    difficulty: 5,
    moods: ['brainy', 'competitive'],
    hook: 'One bold player against two',
    order: 7,
  }),
];
