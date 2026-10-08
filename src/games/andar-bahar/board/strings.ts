/**
 * Andar Bahar table chrome (src/games/andar-bahar/Board.tsx): zone labels, the lanes, the
 * joker strip, the bet buttons and outcome stamps. Game rules, reasons and move descriptions
 * come from the engine; only UI text is here.
 *
 * Same shape as a namespace under src/lib/i18n/en/ (`export const <ns> = { … } as const`),
 * read through the typed `abt('andarBahar.…')` helper below, which fills `{name}`
 * placeholders exactly like `t()`. It can move to src/lib/i18n/en/andarBahar.ts (and `abt`
 * become `t`) as soon as the namespace is registered in src/lib/i18n/en/index.ts.
 */
export const andarBahar = {
  lane: {
    andar: 'Andar',
    bahar: 'Bahar',
    andarMeaning: 'Inside',
    baharMeaning: 'Outside',
    andarOdds: '0.9 to 1',
    baharOdds: '1 to 1',
    pays: 'Pays {odds}',
    empty: 'Cards land here',
    count: '{n}',
    countOne: '1 card',
    countMany: '{n} cards',
    next: 'Next card',
    label: '{side} ({meaning}), pays {pays}: {cards}.',
    labelEmpty: '{side} ({meaning}), pays {pays}: no cards yet.',
    yourBet: 'Your bet is on {side}.',
    winner: '{side} wins.',
  },
  joker: {
    title: 'Joker',
    hunt: 'Find another {rank}',
    huntSuit: 'any suit',
    label: 'Joker: {card}. The next {rank} to turn up — any suit — wins for its side.',
  },
  count: {
    label: 'Cards dealt',
    card: 'Card {n}',
    waiting: 'Bet first',
    sr: '{n} dealt so far.',
    srNone: 'No cards dealt yet.',
    match: 'Match on card {n}!',
  },
  next: {
    label: 'Next card goes to',
    andar: 'Andar',
    bahar: 'Bahar',
  },
  stock: {
    label: 'Face-down deck: {n}',
    caption: '{n} face down',
  },
  match: {
    stamp: 'Match!',
    sr: 'This card matches the joker.',
  },
  seat: {
    dealing: 'Dealing',
  },
  bet: {
    label: 'Place your bet',
    andar: 'Bet on Andar',
    bahar: 'Bet on Bahar',
    andarHint: 'Inside · pays 0.9 to 1',
    baharHint: 'Outside · pays 1 to 1',
    chosen: 'Your bet',
    chipSr: 'Your bet: one stake on {side}.',
    pick: 'Pro pick',
    keys: 'Keys',
    wait: '{name} is dealing — just watch where the match lands.',
    over: 'This deal is over.',
    suggested: 'The coach’s pick.',
    chosenSr: 'You bet on this side.',
  },
  move: {
    deal: 'Deal a card',
  },
  outcome: {
    label: 'Result:',
    win: 'You win',
    loss: 'You lose',
  },
} as const;

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** A key of the Andar Bahar dictionary, e.g. `'andarBahar.lane.andar'`. */
export type AndarBaharKey = Leaves<{ andarBahar: typeof andarBahar }>;

const PLACEHOLDER_RE = /\{([A-Za-z0-9_]+)\}/g;

/** Translate an Andar Bahar UI key and fill `{name}` placeholders (single pass, like `t()`). */
export function abt(key: AndarBaharKey, vars?: Record<string, string | number>): string {
  let node: unknown = { andarBahar };
  for (const part of key.split('.')) {
    node =
      node !== null && typeof node === 'object' && Object.hasOwn(node, part)
        ? (node as Record<string, unknown>)[part]
        : undefined;
  }
  const out = typeof node === 'string' ? node : key;
  if (!vars) return out;
  return out.replace(PLACEHOLDER_RE, (match, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match,
  );
}
