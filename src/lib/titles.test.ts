import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CHANCE_GAMES,
  CINEMA_INDEX,
  roasts,
  titles,
  type Cinema,
  type Roast,
  type RoastCondition,
  type TitleCondition,
  type WinTitle,
} from '@content/titles';
import { createRng, type Rng } from '@/games/core/rng';
import { type ResultFlags } from '@/games/core/types';
import { type StatsSnapshot } from '@/store/stats';
import {
  SELECTION_MARGIN,
  buildTitleContext,
  pickRoast,
  pickTip,
  pickTitle,
  roastConditionHolds,
  roastConditionWeight,
  roastPool,
  selectEntry,
  selectionPool,
  titleConditionHolds,
  titleConditionWeight,
  titlePool,
  type TitleContext,
} from './titles';

const TIER1_SLUGS = [
  'blackjack',
  'teen-patti',
  'andar-bahar',
  'indian-rummy',
  'texas-holdem',
  'baccarat',
  'hearts',
  'spades',
  'crazy-eights',
  'go-fish',
  'war',
  'klondike',
] as const;

const TITLE_SPECIALS = [
  'streak3',
  'comeback',
  'bigPot',
  'biggestWin',
  'closeFinish',
  'luckyLastCard',
  'perfect',
] as const satisfies readonly TitleCondition[];
const FIXED_TITLE_CONDITIONS = new Set<string>([
  ...TITLE_SPECIALS,
  'firstWin',
  'streak5',
  'generic',
]);
const ROAST_SPECIALS = [
  'bust',
  'folded',
  'bigLoss',
  'closeLoss',
  'streakBroken',
  'losingStreak3',
] as const satisfies readonly RoastCondition[];
const FIXED_ROAST_CONDITIONS = new Set<string>([...ROAST_SPECIALS, 'decisions', 'generic']);
/** Conditions that fit any result and must therefore be used on their own. */
const BASE_CONDITIONS = new Set<string>(['generic', 'decisions']);
const CINEMAS: Cinema[] = ['bollywood', 'hollywood', 'south'];

/**
 * Words and phrases that must never appear in a title, blurb, roast or film credit.
 * Matched case-insensitively on word boundaries. Game terms that merely look risky
 * (e.g. "blind" in Teen Patti / Hold'em, "high card", "Crazy Eights", "shoot the moon")
 * are deliberately not listed — the rule is about jokes aimed at people, not card
 * vocabulary.
 */
const BANNED_TERMS = [
  // appearance / body-shaming
  'fat',
  'fatty',
  'fatso',
  'obese',
  'chubby',
  'skinny',
  'ugly',
  'bald',
  'baldy',
  'pimple',
  'moti',
  'mota',
  'kaala',
  'kaali',
  'gora',
  'gori',
  'dark-skinned',
  'fair-skinned',
  'dwarf',
  'dwarfs',
  'midget',
  // gender / sexuality
  'girl',
  'girls',
  'girly',
  'sissy',
  'manly',
  'mard',
  'woman',
  'women',
  'ladies',
  'chick',
  'bitch',
  'slut',
  'gay',
  'homo',
  'chhakka',
  'hijra',
  'effeminate',
  'like a girl',
  // religion
  'religion',
  'religious',
  'hindu',
  'muslim',
  'christian',
  'sikh',
  'jain',
  'jewish',
  'buddhist',
  'allah',
  'bhagwan',
  'jesus',
  'god',
  'goddess',
  'deva',
  'devil',
  'mosque',
  'church',
  'temple',
  'pandit',
  'mullah',
  'kafir',
  'infidel',
  // caste
  'caste',
  'dalit',
  'brahmin',
  'thakur',
  'untouchable',
  'chamar',
  'bhangi',
  'shudra',
  'savarna',
  // region / language / nationality
  'madrasi',
  'bihari',
  'chinki',
  'paki',
  'firangi',
  'foreigner',
  'immigrant',
  'accent',
  'gawar',
  // disability / mental health
  'retard',
  'retarded',
  'cripple',
  'crippled',
  'lame',
  'spastic',
  'psycho',
  'insane',
  'lunatic',
  'mental',
  'pagal',
  'deaf',
  'dumb',
  'handicapped',
  'langda',
  'andha',
  'autistic',
  'schizo',
  'amnesia',
  // insults aimed at the person (roast the move, not the player)
  'stupid',
  'moron',
  'idiot',
  'loser',
  'losers',
  'worthless',
  'pathetic',
  'useless',
  'nalayak',
  'bewakoof',
  'ullu',
  // violence played for laughs
  'kill',
  'killed',
  'murder',
  'suicide',
  'blood',
  'bloody',
  'gun',
  // alcohol / drugs / gambling addiction / real money
  'drunk',
  'daaru',
  'sharab',
  'sharaab',
  'whisky',
  'whiskey',
  'vodka',
  'beer',
  'booze',
  'rum',
  'gin',
  'martini',
  'nasha',
  'cocaine',
  'weed',
  'stoned',
  'addict',
  'addiction',
  'real money',
  'cash',
  'rupee',
  'rupees',
  'paisa',
  'crore',
  'lakh',
  'dollar',
  'dollars',
  'loan shark',
  'mortgage',
  'credit card',
  'rent money',
  'salary',
  'bet your house',
];

/** Film credits that legitimately contain a listed word (the joke itself never does). */
const FILM_TITLE_EXCEPTIONS = new Set(['3 Idiots (2009)', 'Top Gun (1986)']);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const BANNED_PATTERNS = BANNED_TERMS.map(
  (term) => [term, new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i')] as const,
);

function snapshot(overrides: Partial<StatsSnapshot> = {}): StatsSnapshot {
  return {
    played: 10,
    wins: 5,
    losses: 5,
    pushes: 0,
    biggestWin: 500,
    currentStreak: 0,
    bestStreak: 2,
    gameWins: 1,
    gamePlayed: 2,
    ...overrides,
  };
}

/** Engines always set every boolean flag, so the default context does too. */
const NO_FLAGS: ResultFlags = {
  comeback: false,
  closeFinish: false,
  luckyLastCard: false,
  bigPot: false,
  perfect: false,
  bust: false,
  folded: false,
  tags: [],
};

function ctx(overrides: Partial<TitleContext> = {}): TitleContext {
  return {
    gameSlug: 'not-a-real-game',
    gameName: 'Mystery Game',
    netJeet: 10,
    stake: 10,
    flags: NO_FLAGS,
    statsBefore: snapshot(),
    isBiggestWin: false,
    ...overrides,
  };
}

const flags = (f: ResultFlags): ResultFlags => ({ ...NO_FLAGS, ...f });
const rngFn = (rng: Rng) => () => rng.next();
const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id);
const isBase = (e: { when: readonly string[] }) => e.when.every((c) => BASE_CONDITIONS.has(c));
const onlyGame = (slug: string) => (e: { when: readonly string[] }) =>
  e.when.length === 1 && e.when[0] === `game:${slug}`;
const has =
  (c: string) =>
  (e: { when: readonly string[] }): boolean =>
    e.when.includes(c);

/**
 * The smallest context in which every condition of `when` holds. Without a game condition
 * it uses Go Fish: a Tier 1 game with its own lines (so base lines must still get a turn)
 * but no game + special combinations that would outrank the plain special lines.
 */
function contextFor(when: readonly string[], kind: 'title' | 'roast'): TitleContext {
  let gameSlug = 'go-fish';
  const f: ResultFlags = { ...NO_FLAGS, tags: [] };
  let stats = snapshot();
  let isBiggestWin = false;
  for (const c of when) {
    if (c.startsWith('game:')) gameSlug = c.slice(5);
    else if (c.startsWith('tag:')) f.tags = [...(f.tags ?? []), c.slice(4)];
    else if (c === 'firstWin') stats = { ...stats, wins: 0, currentStreak: 0 };
    else if (c === 'streak3') stats = { ...stats, currentStreak: 2 };
    else if (c === 'streak5') stats = { ...stats, currentStreak: 4 };
    else if (c === 'streakBroken') stats = { ...stats, currentStreak: 3 };
    else if (c === 'losingStreak3') stats = { ...stats, currentStreak: -2 };
    else if (c === 'biggestWin') isBiggestWin = true;
    else if (c === 'bigPot' || c === 'bigLoss') f.bigPot = true;
    else if (c === 'closeLoss') f.closeFinish = true;
    else if (c === 'comeback') f.comeback = true;
    else if (c === 'closeFinish') f.closeFinish = true;
    else if (c === 'luckyLastCard') f.luckyLastCard = true;
    else if (c === 'perfect') f.perfect = true;
    else if (c === 'bust') f.bust = true;
    else if (c === 'folded') f.folded = true;
  }
  return ctx({
    gameSlug,
    netJeet: kind === 'title' ? 10 : -10,
    flags: f,
    statsBefore: stats,
    isBiggestWin,
  });
}

function randomContext(rng: Rng): TitleContext {
  const slugs = [...TIER1_SLUGS, 'not-a-real-game'];
  const flag = () => rng.next() < 0.2;
  const tagPool = [
    'blackjack',
    'dealerBlackjack',
    'shootTheMoon',
    'opponentShotMoon',
    'bluff-win',
    'packed-best-hand',
    'folded-best-hand',
    'nil',
    'cleared',
  ];
  const tags = tagPool.filter(() => rng.next() < 0.12);
  const bigPot = rng.next();
  return ctx({
    gameSlug: rng.pick(slugs),
    netJeet: rng.int(201) - 100,
    stake: rng.pick([0, 1, 5, 10, 25]),
    flags: {
      comeback: flag(),
      closeFinish: flag(),
      luckyLastCard: flag(),
      // Mostly engine-decided, sometimes left undefined to exercise the fallback.
      bigPot: bigPot < 0.15 ? true : bigPot < 0.85 ? false : undefined,
      perfect: flag(),
      bust: flag(),
      folded: flag(),
      tags,
    },
    statsBefore: snapshot({ wins: rng.int(6), currentStreak: rng.int(11) - 5 }),
    isBiggestWin: flag(),
  });
}

const titleScore = (t: WinTitle) => t.when.reduce((s, c) => s + titleConditionWeight(c), 0);
const roastScore = (r: Roast) => r.when.reduce((s, c) => s + roastConditionWeight(c), 0);

const engineSource = (slug: string): string | null => {
  const file = fileURLToPath(new URL(`../games/${slug}/engine.ts`, import.meta.url));
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
};

// ─────────────────────────────────────────────────────────────────────────────

describe('content/titles.ts', () => {
  const entries = [...titles, ...roasts];

  it('has plenty of win titles and roasts', () => {
    expect(titles.length).toBeGreaterThanOrEqual(80);
    expect(roasts.length).toBeGreaterThanOrEqual(80);
  });

  it('uses unique, kebab-case ids across titles and roasts', () => {
    const all = ids(entries);
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(id).toMatch(/^[tr]-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    for (const t of titles) expect(t.id.startsWith('t-')).toBe(true);
    for (const r of roasts) expect(r.id.startsWith('r-')).toBe(true);
  });

  it('keeps every line short enough for the poster and the roast card', () => {
    for (const t of titles) {
      expect(t.text.length, t.id).toBeGreaterThan(0);
      expect(t.text.length, t.id).toBeLessThanOrEqual(40);
      expect(t.blurb.length, t.id).toBeGreaterThan(0);
      expect(t.blurb.length, t.id).toBeLessThanOrEqual(100);
      expect(t.blurb, t.id).toBe(t.blurb.trim());
    }
    for (const r of roasts) {
      expect(r.text.length, r.id).toBeGreaterThan(0);
      expect(r.text.length, r.id).toBeLessThanOrEqual(120);
    }
    for (const e of entries) expect(e.text, e.id).toBe(e.text.trim());
  });

  it('credits a film with its year, and uses no film more than three times', () => {
    const uses = new Map<string, number>();
    for (const e of entries) {
      expect(e.film, e.id).toMatch(/^\S.*\(\d{4}\)$/);
      expect(e.film.length, e.id).toBeLessThanOrEqual(60);
      uses.set(e.film, (uses.get(e.film) ?? 0) + 1);
    }
    const overused = [...uses].filter(([, n]) => n > 3);
    expect(overused).toEqual([]);
  });

  it('never repeats the same text twice', () => {
    const texts = entries.map((e) => e.text.toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('only uses known conditions; base conditions stand alone; no duplicates', () => {
    const slugs = new Set<string>(TIER1_SLUGS);
    const check = (id: string, when: readonly string[], fixed: Set<string>) => {
      expect(when.length, id).toBeGreaterThan(0);
      expect(new Set(when).size, id).toBe(when.length);
      if (when.some((c) => BASE_CONDITIONS.has(c))) expect(when, id).toHaveLength(1);
      for (const c of when) {
        if (c.startsWith('game:')) expect(slugs.has(c.slice(5)), `${id}: ${c}`).toBe(true);
        else if (!c.startsWith('tag:')) expect(fixed.has(c), `${id}: ${c}`).toBe(true);
      }
    };
    for (const t of titles) check(t.id, t.when, FIXED_TITLE_CONDITIONS);
    for (const r of roasts) check(r.id, r.when, FIXED_ROAST_CONDITIONS);
  });

  it("pairs every tag with its game, and the tag is one that game's engine emits", () => {
    const checked: string[] = [];
    for (const e of entries) {
      const when: readonly string[] = e.when;
      const tags = when.filter((c) => c.startsWith('tag:')).map((c) => c.slice(4));
      if (tags.length === 0) continue;
      const games = when.filter((c) => c.startsWith('game:')).map((c) => c.slice(5));
      expect(games, e.id).toHaveLength(1);
      const slug = games[0] ?? '';
      const source = engineSource(slug);
      expect(source, `${e.id}: src/games/${slug}/engine.ts`).not.toBeNull();
      for (const tag of tags) {
        expect(source?.includes(`'${tag}'`), `${e.id}: engine never emits '${tag}'`).toBe(true);
        checked.push(`${slug}:${tag}`);
      }
    }
    expect(new Set(checked)).toEqual(
      new Set([
        'blackjack:blackjack',
        'blackjack:dealerBlackjack',
        'hearts:shootTheMoon',
        'hearts:opponentShotMoon',
        'teen-patti:bluff-win',
        'teen-patti:packed-best-hand',
        'texas-holdem:bluff-win',
        'texas-holdem:folded-best-hand',
        'spades:nil',
      ]),
    );
  });

  it('maps every entry (and nothing else) to a cinema bucket in CINEMA_INDEX', () => {
    const all = ids(entries).sort();
    expect(Object.keys(CINEMA_INDEX).sort()).toEqual(all);
    for (const id of all) expect(CINEMAS).toContain(CINEMA_INDEX[id]);
  });

  it('balances Bollywood, Hollywood and South Indian cinema (28–40 % each per list)', () => {
    for (const list of [titles, roasts] as const) {
      for (const cinema of CINEMAS) {
        const share = list.filter((e) => CINEMA_INDEX[e.id] === cinema).length / list.length;
        expect(share, cinema).toBeGreaterThanOrEqual(0.28);
        expect(share, cinema).toBeLessThanOrEqual(0.4);
      }
    }
  });

  it('contains no banned words (appearance, gender, religion, caste, region, disability, slurs, violence, vices, money)', () => {
    const offences: string[] = [];
    for (const e of entries) {
      const fields = [e.text, 'blurb' in e ? e.blurb : ''];
      if (!FILM_TITLE_EXCEPTIONS.has(e.film)) fields.push(e.film);
      for (const field of fields) {
        for (const [term, pattern] of BANNED_PATTERNS) {
          if (pattern.test(field)) offences.push(`${e.id}: "${term}" in "${field}"`);
        }
      }
    }
    expect(offences).toEqual([]);
  });

  it.each(TIER1_SLUGS)('%s has ≥ 3 own titles and roasts, one from each cinema', (slug) => {
    for (const list of [titles, roasts] as const) {
      const own = list.filter(onlyGame(slug));
      expect(own.length).toBeGreaterThanOrEqual(3);
      expect(new Set(own.map((e) => CINEMA_INDEX[e.id]))).toEqual(new Set(CINEMAS));
    }
  });

  it('has ≥ 3 lines from ≥ 2 cinemas for every special title and roast condition', () => {
    const titleConds: TitleCondition[] = [...TITLE_SPECIALS, 'firstWin', 'streak5'];
    for (const c of titleConds) {
      const lines = titles.filter((t) => t.when.length === 1 && t.when[0] === c);
      expect(lines.length, c).toBeGreaterThanOrEqual(3);
      expect(new Set(lines.map((t) => CINEMA_INDEX[t.id])).size, c).toBeGreaterThanOrEqual(2);
    }
    for (const c of ROAST_SPECIALS) {
      const lines = roasts.filter((r) => r.when.length === 1 && r.when[0] === c);
      expect(lines.length, c).toBeGreaterThanOrEqual(3);
      expect(new Set(lines.map((r) => CINEMA_INDEX[r.id])).size, c).toBeGreaterThanOrEqual(2);
    }
  });

  it('has a deep base pool: ≥ 15 base lines per list, ≥ 6 roasts that fit pure-chance games', () => {
    expect(titles.filter(isBase).length).toBeGreaterThanOrEqual(15);
    expect(roasts.filter(isBase).length).toBeGreaterThanOrEqual(15);
    expect(roasts.filter(has('generic')).length).toBeGreaterThanOrEqual(6);
    for (const slug of CHANCE_GAMES) expect(TIER1_SLUGS as readonly string[]).toContain(slug);
  });

  it('includes the signature lines from the brief', () => {
    const titleByText = (text: string) => titles.find((t) => t.text === text);
    expect(titleByText('Baazigar of the Table')?.when).toContain('comeback');
    expect(titleByText('Don of the Deck')?.when).toContain('streak3');
    expect(titleByText('The Wolf of Card Street')?.when).toContain('biggestWin');
    expect(titleByText('Sultan of Spades')?.when).toContain('game:spades');
    expect(titleByText('Mogambo Khush Hua')?.when).toContain('bigPot');
    expect(titleByText("Ocean's Eleventh Hand")?.when).toContain('luckyLastCard');
    expect(titleByText('Ek Tha Tiger, Ab Hai Champion')?.when).toContain('firstWin');
    const roastTexts = roasts.map((r) => r.text);
    expect(roastTexts).toContain("Picture abhi baaki hai... but your chips aren't.");
    expect(roastTexts).toContain(
      'You played like the villain who explains his plan and still loses.',
    );
    expect(roastTexts).toContain('Even Devdas made better decisions.');
    expect(roastTexts.some((t) => t.startsWith('That move belongs in a deleted scene'))).toBe(true);
    expect(roastTexts).toContain("Houston, we have a problem. It's your strategy.");
  });
});

describe('titleConditionHolds', () => {
  it('firstWin only when there were no wins before', () => {
    expect(titleConditionHolds('firstWin', ctx({ statsBefore: snapshot({ wins: 0 }) }))).toBe(true);
    expect(titleConditionHolds('firstWin', ctx({ statsBefore: snapshot({ wins: 1 }) }))).toBe(
      false,
    );
  });

  it('streak3 / streak5 count this win on top of the previous streak', () => {
    const at = (currentStreak: number) => ctx({ statsBefore: snapshot({ currentStreak }) });
    expect(titleConditionHolds('streak3', at(1))).toBe(false);
    expect(titleConditionHolds('streak3', at(2))).toBe(true);
    expect(titleConditionHolds('streak3', at(-4))).toBe(false); // a win after losses = streak 1
    expect(titleConditionHolds('streak5', at(3))).toBe(false);
    expect(titleConditionHolds('streak5', at(4))).toBe(true);
    expect(titleConditionHolds('streak3', at(9))).toBe(true);
  });

  it('reads comeback, closeFinish, luckyLastCard and perfect from the flags', () => {
    for (const c of ['comeback', 'closeFinish', 'luckyLastCard', 'perfect'] as const) {
      expect(titleConditionHolds(c, ctx({ flags: { [c]: true } }))).toBe(true);
      expect(titleConditionHolds(c, ctx({ flags: { [c]: false } }))).toBe(false);
      expect(titleConditionHolds(c, ctx({ flags: {} }))).toBe(false);
    }
  });

  it("bigPot trusts the engine's flag; ≥ 3 stakes is only the fallback for a missing flag", () => {
    expect(titleConditionHolds('bigPot', ctx({ flags: { bigPot: true }, netJeet: 1 }))).toBe(true);
    // Hold'em: +30 chips at 1 Jeet a chip is not a big pot for that engine (it needs 30+
    // chips), so the flag says false even though it is "3 stakes".
    const holdem = ctx({
      gameSlug: 'texas-holdem',
      stake: 1,
      netJeet: 3,
      flags: { bigPot: false },
    });
    expect(titleConditionHolds('bigPot', holdem)).toBe(false);
    expect(titleConditionHolds('bigPot', ctx({ flags: {}, stake: 10, netJeet: 30 }))).toBe(true);
    expect(titleConditionHolds('bigPot', ctx({ flags: {}, stake: 10, netJeet: 29 }))).toBe(false);
    expect(titleConditionHolds('bigPot', ctx({ flags: {}, stake: 0, netJeet: 0 }))).toBe(false);
  });

  it('biggestWin needs a new record that is not the very first win', () => {
    expect(titleConditionHolds('biggestWin', ctx({ isBiggestWin: true }))).toBe(true);
    expect(titleConditionHolds('biggestWin', ctx({ isBiggestWin: false }))).toBe(false);
    const first = ctx({ isBiggestWin: true, statsBefore: snapshot({ wins: 0 }) });
    expect(titleConditionHolds('biggestWin', first)).toBe(false);
  });

  it('game:<slug>, tag:<tag> and generic', () => {
    const c = ctx({ gameSlug: 'hearts', flags: { tags: ['shootTheMoon'] } });
    expect(titleConditionHolds('game:hearts', c)).toBe(true);
    expect(titleConditionHolds('game:spades', c)).toBe(false);
    expect(titleConditionHolds('tag:shootTheMoon', c)).toBe(true);
    expect(titleConditionHolds('tag:blackjack', c)).toBe(false);
    expect(titleConditionHolds('tag:blackjack', ctx({ flags: {} }))).toBe(false);
    expect(titleConditionHolds('generic', c)).toBe(true);
  });
});

describe('roastConditionHolds', () => {
  it('bust and folded come from the flags', () => {
    expect(roastConditionHolds('bust', ctx({ flags: { bust: true } }))).toBe(true);
    expect(roastConditionHolds('bust', ctx())).toBe(false);
    expect(roastConditionHolds('folded', ctx({ flags: { folded: true } }))).toBe(true);
    expect(roastConditionHolds('folded', ctx())).toBe(false);
  });

  it("bigLoss trusts the engine's bigPot flag, falling back to losing ≥ 3 stakes", () => {
    expect(roastConditionHolds('bigLoss', ctx({ netJeet: -1, flags: { bigPot: true } }))).toBe(
      true,
    );
    // Indian Rummy: −30 points at 1 Jeet a point is an ordinary loss for that engine.
    const rummy = ctx({ stake: 1, netJeet: -30, flags: { bigPot: false } });
    expect(roastConditionHolds('bigLoss', rummy)).toBe(false);
    expect(roastConditionHolds('bigLoss', ctx({ flags: {}, stake: 10, netJeet: -30 }))).toBe(true);
    expect(roastConditionHolds('bigLoss', ctx({ flags: {}, stake: 10, netJeet: -29 }))).toBe(false);
    expect(roastConditionHolds('bigLoss', ctx({ flags: {}, stake: 0, netJeet: 0 }))).toBe(false);
  });

  it('closeLoss reads closeFinish', () => {
    expect(roastConditionHolds('closeLoss', ctx({ flags: { closeFinish: true } }))).toBe(true);
    expect(roastConditionHolds('closeLoss', ctx())).toBe(false);
  });

  it('streakBroken after ≥ 2 wins, losingStreak3 after ≥ 2 losses', () => {
    const at = (currentStreak: number) => ctx({ statsBefore: snapshot({ currentStreak }) });
    expect(roastConditionHolds('streakBroken', at(2))).toBe(true);
    expect(roastConditionHolds('streakBroken', at(1))).toBe(false);
    expect(roastConditionHolds('losingStreak3', at(-2))).toBe(true);
    expect(roastConditionHolds('losingStreak3', at(-1))).toBe(false);
    expect(roastConditionHolds('losingStreak3', at(3))).toBe(false);
  });

  it('decisions holds for every game except the pure-chance ones', () => {
    for (const slug of TIER1_SLUGS) {
      const expected = !(CHANCE_GAMES as readonly string[]).includes(slug);
      expect(roastConditionHolds('decisions', ctx({ gameSlug: slug })), slug).toBe(expected);
    }
    expect(CHANCE_GAMES).toEqual(expect.arrayContaining(['war', 'andar-bahar', 'baccarat']));
    expect(roastConditionHolds('decisions', ctx({ gameSlug: 'some-future-game' }))).toBe(true);
  });

  it('game:<slug>, tag:<tag> and generic', () => {
    const c = ctx({ gameSlug: 'spades', flags: { tags: ['nil'] } });
    expect(roastConditionHolds('game:spades', c)).toBe(true);
    expect(roastConditionHolds('game:hearts', c)).toBe(false);
    expect(roastConditionHolds('tag:nil', c)).toBe(true);
    expect(roastConditionHolds('generic', c)).toBe(true);
  });
});

describe('condition weights', () => {
  const m = SELECTION_MARGIN;
  const tw = titleConditionWeight;
  const rw = roastConditionWeight;

  it('form the documented tiers for titles', () => {
    const base = tw('generic');
    const game = tw('game:war');
    const tag = tw('tag:blackjack');
    // Ordinary win: the game's lines and the generic lines share the pool…
    expect(game - base).toBeLessThanOrEqual(m);
    expect(game).toBeGreaterThan(base);
    for (const c of TITLE_SPECIALS) {
      // …a special moment brings its own lines plus the game's lines, and drops generic.
      expect(tw(c), c).toBeGreaterThan(game);
      expect(tw(c) - game, c).toBeLessThanOrEqual(m);
      expect(tw(c) - base, c).toBeGreaterThan(m);
    }
    expect(tag).toBeGreaterThan(game);
    expect(tag - base).toBeGreaterThan(m);
    // A fifth straight win outranks every single special (including streak3)…
    for (const c of TITLE_SPECIALS) expect(tw('streak5') - tw(c), c).toBeGreaterThan(m);
    // …a game + special/tag combination outranks streak5…
    expect(game + tag - tw('streak5')).toBeGreaterThan(m);
    for (const c of TITLE_SPECIALS) expect(game + tw(c) - tw('streak5'), c).toBeGreaterThan(m);
    // …and a first win outranks everything, so it always gets a first-win line.
    expect(tw('firstWin') - (game + Math.max(tag, ...TITLE_SPECIALS.map(tw)))).toBeGreaterThan(m);
  });

  it('form the same tiers for roasts', () => {
    const base = rw('generic');
    const game = rw('game:war');
    expect(rw('decisions')).toBe(base);
    expect(game - base).toBeLessThanOrEqual(m);
    expect(game).toBeGreaterThan(base);
    for (const c of ROAST_SPECIALS) {
      expect(rw(c), c).toBeGreaterThan(game);
      expect(rw(c) - game, c).toBeLessThanOrEqual(m);
      expect(rw(c) - base, c).toBeGreaterThan(m);
    }
    // A game-specific version of a special (game + special, e.g. a Blackjack bust) beats the
    // plain special by `game` points, which is more than the margin.
    expect(game).toBeGreaterThan(m);
    expect(rw('tag:nil')).toBe(rw('bust'));
  });
});

describe('pickTitle', () => {
  const draws = (c: TitleContext, n = 300, seed = 1) => {
    const random = rngFn(createRng(seed));
    const out: WinTitle[] = [];
    let last: string | null = null;
    for (let i = 0; i < n; i++) {
      const t = pickTitle(c, last, random);
      out.push(t);
      last = t.id;
    }
    return out;
  };

  it('a first win always gets a firstWin title, even with other flags and tags set', () => {
    for (const c of [
      ctx({
        gameSlug: 'blackjack',
        statsBefore: snapshot({ wins: 0, currentStreak: 0 }),
        flags: flags({ comeback: true, bigPot: true, perfect: true, tags: ['blackjack'] }),
        isBiggestWin: true,
      }),
      ctx({
        gameSlug: 'klondike',
        statsBefore: snapshot({ wins: 0, currentStreak: -3 }),
        flags: flags({ perfect: true, tags: ['cleared'] }),
      }),
    ]) {
      const picked = draws(c);
      for (const t of picked) expect(t.when).toEqual(['firstWin']);
      expect(new Set(ids(picked)).size).toBeGreaterThan(2);
    }
  });

  it('a third straight win gets a streak3 title (plus the game’s own lines in a game)', () => {
    const plain = titlePool(ctx({ statsBefore: snapshot({ currentStreak: 2 }) }), null);
    expect(plain.length).toBeGreaterThanOrEqual(3);
    for (const t of plain) expect(t.when).toEqual(['streak3']);
    const inGame = titlePool(
      ctx({ gameSlug: 'war', statsBefore: snapshot({ currentStreak: 2 }) }),
      null,
    );
    expect(new Set(inGame.map((t) => t.when.join('+')))).toEqual(new Set(['streak3', 'game:war']));
  });

  it('a fifth straight win gets a streak5 title (beats streak3, comebacks and game titles)', () => {
    const c = ctx({
      gameSlug: 'war',
      flags: flags({ comeback: true }),
      statsBefore: snapshot({ currentStreak: 7 }),
    });
    for (const t of draws(c)) expect(t.when).toEqual(['streak5']);
  });

  it('an ordinary win mixes the game’s own lines with the generic ones — and nothing else', () => {
    for (const slug of TIER1_SLUGS) {
      const pool = titlePool(ctx({ gameSlug: slug }), null);
      const own = pool.filter(onlyGame(slug));
      expect(own.length, slug).toBe(titles.filter(onlyGame(slug)).length);
      expect(pool.filter(isBase).length, slug).toBe(titles.filter(isBase).length);
      expect(own.length + pool.filter(isBase).length, slug).toBe(pool.length);
      const seen = draws(ctx({ gameSlug: slug }), 400, slug.length);
      expect(seen.some(onlyGame(slug)), slug).toBe(true);
      expect(seen.some(isBase), slug).toBe(true);
    }
    for (const t of draws(ctx({ gameSlug: 'not-a-real-game' })))
      expect(t.when).toEqual(['generic']);
  });

  it('a special moment shows its own lines plus the game’s, never the generic ones', () => {
    const c = ctx({ gameSlug: 'teen-patti', flags: flags({ comeback: true }) });
    const kinds = new Set(draws(c, 400).map((t) => t.when.join('+')));
    expect(kinds).toEqual(new Set(['comeback', 'game:teen-patti']));
  });

  it('engine moments win outright: natural Blackjack, shooting the moon, bluffs, nil, Klondike clear', () => {
    const cases: [TitleContext, string][] = [
      [
        ctx({ gameSlug: 'blackjack', flags: flags({ perfect: true, tags: ['blackjack'] }) }),
        'tag:blackjack',
      ],
      [
        ctx({
          gameSlug: 'hearts',
          flags: flags({ perfect: true, bigPot: true, tags: ['shootTheMoon', 'cleanHand'] }),
        }),
        'tag:shootTheMoon',
      ],
      [
        ctx({ gameSlug: 'teen-patti', flags: flags({ comeback: true, tags: ['bluff-win'] }) }),
        'tag:bluff-win',
      ],
      [
        ctx({ gameSlug: 'texas-holdem', flags: flags({ bigPot: true, tags: ['bluff-win'] }) }),
        'tag:bluff-win',
      ],
      [ctx({ gameSlug: 'spades', flags: flags({ perfect: true, tags: ['nil'] }) }), 'tag:nil'],
      [
        ctx({
          gameSlug: 'klondike',
          flags: flags({ perfect: true, comeback: true, tags: ['cleared'] }),
          statsBefore: snapshot({ currentStreak: 6 }),
        }),
        'perfect',
      ],
    ];
    for (const [c, marker] of cases) {
      const pool = titlePool(c, null);
      for (const t of pool) {
        expect(t.when, marker).toContain(`game:${c.gameSlug}`);
        expect(t.when, marker).toContain(marker);
      }
    }
  });

  it('a Klondike win that is not a full clear never claims all 52 cards went home', () => {
    const partial = ctx({ gameSlug: 'klondike', flags: flags({ tags: ['resigned'] }) });
    for (const t of titlePool(partial, null)) expect(t.when).not.toContain('perfect');
  });

  it('only ever returns titles whose conditions all hold, within the top-score margin', () => {
    const rng = createRng('title-context');
    const random = rngFn(rng);
    for (let i = 0; i < 2000; i++) {
      const c = randomContext(rng);
      const t = pickTitle(c, null, random);
      expect(t.when.every((cond) => titleConditionHolds(cond, c))).toBe(true);
      const eligible = titles.filter((x) => x.when.every((cond) => titleConditionHolds(cond, c)));
      const best = Math.max(...eligible.map(titleScore));
      expect(titleScore(t)).toBeGreaterThanOrEqual(best - SELECTION_MARGIN);
    }
  });

  it('can show every single title in some context (no dead content)', () => {
    for (const t of titles) {
      expect(ids(titlePool(contextFor(t.when, 'title'), null)), t.id).toContain(t.id);
    }
  });

  it('is deterministic for the same random sequence', () => {
    const c = ctx({ gameSlug: 'baccarat', flags: flags({ bigPot: true }) });
    const run = () => ids(draws(c, 50, 42));
    expect(run()).toEqual(run());
  });

  it('copes with random() returning the edges of its range (and junk)', () => {
    const c = ctx({ gameSlug: 'war' });
    const pool = titlePool(c, null);
    expect(pickTitle(c, null, () => 0).id).toBe(pool[0]?.id);
    expect(pickTitle(c, null, () => 0.9999999).id).toBe(pool[pool.length - 1]?.id);
    expect(pickTitle(c, null, () => 1).id).toBe(pool[pool.length - 1]?.id);
    expect(pickTitle(c, null, () => -5).id).toBe(pool[0]?.id);
    expect(pickTitle(c, null, () => Number.NaN).id).toBe(pool[0]?.id);
  });
});

describe('pickRoast', () => {
  const draws = (c: TitleContext, n = 300, seed = 7) => {
    const random = rngFn(createRng(seed));
    const out: Roast[] = [];
    let last: string | null = null;
    for (let i = 0; i < n; i++) {
      const r = pickRoast(c, last, random);
      out.push(r);
      last = r.id;
    }
    return out;
  };
  const loss = (overrides: Partial<TitleContext>) => ctx({ netJeet: -10, ...overrides });
  const kinds = (pool: readonly Roast[]) => new Set(pool.map((r) => r.when.join('+')));

  it('a Blackjack bust gets a Blackjack-bust line (even when it also ends a streak)', () => {
    const c = loss({
      gameSlug: 'blackjack',
      flags: flags({ bust: true }),
      statsBefore: snapshot({ currentStreak: 3 }),
    });
    expect(kinds(roastPool(c, null))).toEqual(new Set(['game:blackjack+bust']));
  });

  it('taking the Queen of Spades in a lost Hearts hand gets a Queen line', () => {
    const c = loss({ gameSlug: 'hearts', flags: flags({ bust: true, tags: ['queenOfSpades'] }) });
    expect(kinds(roastPool(c, null))).toEqual(new Set(['game:hearts+bust']));
  });

  it('other self-inflicted knockouts mix the universal bust lines with the game’s own', () => {
    for (const slug of ['indian-rummy', 'spades', 'teen-patti', 'texas-holdem']) {
      const c = loss({ gameSlug: slug, flags: flags({ bust: true }) });
      expect(kinds(roastPool(c, null)), slug).toEqual(new Set(['bust', `game:${slug}`]));
    }
  });

  it('folding mixes folded lines with the game’s own; folding the best hand gets its own line', () => {
    for (const slug of ['teen-patti', 'texas-holdem', 'indian-rummy', 'klondike']) {
      const c = loss({ gameSlug: slug, flags: flags({ folded: true }) });
      expect(kinds(roastPool(c, null)), slug).toEqual(new Set(['folded', `game:${slug}`]));
    }
    const packed = loss({
      gameSlug: 'teen-patti',
      flags: flags({ folded: true, tags: ['packed-best-hand'] }),
    });
    expect(kinds(roastPool(packed, null))).toEqual(
      new Set(['game:teen-patti+tag:packed-best-hand']),
    );
    const folded = loss({
      gameSlug: 'texas-holdem',
      flags: flags({ folded: true, tags: ['folded-best-hand'] }),
    });
    expect(kinds(roastPool(folded, null))).toEqual(
      new Set(['game:texas-holdem+tag:folded-best-hand']),
    );
  });

  it('losses the learner could not influence get a sympathetic, specific line', () => {
    const dealer = loss({ gameSlug: 'blackjack', flags: flags({ tags: ['dealerBlackjack'] }) });
    expect(kinds(roastPool(dealer, null))).toEqual(new Set(['game:blackjack+tag:dealerBlackjack']));
    const moon = loss({ gameSlug: 'hearts', flags: flags({ tags: ['opponentShotMoon'] }) });
    expect(kinds(roastPool(moon, null))).toEqual(new Set(['game:hearts+tag:opponentShotMoon']));
  });

  it('folded, bigLoss, closeLoss, streakBroken and losingStreak3 each get their roast', () => {
    const cases: [RoastCondition, TitleContext][] = [
      ['bust', loss({ flags: flags({ bust: true }) })],
      ['folded', loss({ flags: flags({ folded: true }) })],
      ['bigLoss', loss({ netJeet: -50, stake: 10, flags: { bust: false } })],
      ['bigLoss', loss({ flags: flags({ bigPot: true }) })],
      ['closeLoss', loss({ flags: flags({ closeFinish: true }) })],
      ['streakBroken', loss({ statsBefore: snapshot({ currentStreak: 4 }) })],
      ['losingStreak3', loss({ statsBefore: snapshot({ currentStreak: -2 }) })],
    ];
    for (const [cond, c] of cases) {
      for (const r of draws(c, 100)) expect(r.when, cond).toEqual([cond]);
    }
  });

  it('an ordinary loss mixes the game’s own lines with the base lines', () => {
    for (const slug of TIER1_SLUGS) {
      const pool = roastPool(loss({ gameSlug: slug }), null);
      const own = pool.filter(onlyGame(slug));
      expect(own.length, slug).toBe(roasts.filter(onlyGame(slug)).length);
      expect(own.length + pool.filter(isBase).length, slug).toBe(pool.length);
      expect(pool.filter(isBase).length, slug).toBeGreaterThanOrEqual(6);
    }
    for (const r of draws(loss({}))) expect(isBase(r)).toBe(true);
  });

  it('never blames a decision in a pure-chance game like War', () => {
    for (const slug of CHANCE_GAMES) {
      const pool = roastPool(loss({ gameSlug: slug }), null);
      expect(pool.some(has('decisions')), slug).toBe(false);
      expect(pool.some(has('generic')), slug).toBe(true);
      for (const r of draws(loss({ gameSlug: slug }), 300, slug.length)) {
        expect(r.when, slug).not.toContain('decisions');
      }
    }
    expect(roastPool(loss({ gameSlug: 'blackjack' }), null).some(has('decisions'))).toBe(true);
  });

  it('can show every single roast in some context (no dead content)', () => {
    for (const r of roasts) {
      expect(ids(roastPool(contextFor(r.when, 'roast'), null)), r.id).toContain(r.id);
    }
    // The universal lines also reach pure-chance games.
    for (const r of roasts.filter(has('generic'))) {
      expect(ids(roastPool(loss({ gameSlug: 'war' }), null)), r.id).toContain(r.id);
    }
  });

  it('only ever returns roasts whose conditions all hold, within the top-score margin', () => {
    const rng = createRng('roast-context');
    const random = rngFn(rng);
    for (let i = 0; i < 2000; i++) {
      const c = randomContext(rng);
      const r = pickRoast(c, null, random);
      expect(r.when.every((cond) => roastConditionHolds(cond, c))).toBe(true);
      const eligible = roasts.filter((x) => x.when.every((cond) => roastConditionHolds(cond, c)));
      const best = Math.max(...eligible.map(roastScore));
      expect(roastScore(r)).toBeGreaterThanOrEqual(best - SELECTION_MARGIN);
    }
  });
});

describe('never the same line twice in a row', () => {
  const EDGES = [0, 0.2, 0.5, 0.8, 0.9999999, 1];
  const titleContexts = () => [
    ...titles.map((t) => contextFor(t.when, 'title')),
    ...Array.from({ length: 150 }, (_, i) => randomContext(createRng(`t-${i}`))),
  ];
  const roastContexts = () => [
    ...roasts.map((r) => contextFor(r.when, 'roast')),
    ...Array.from({ length: 150 }, (_, i) => randomContext(createRng(`r-${i}`))),
  ];

  it('titles: for every context, whichever eligible title was shown last is never picked again', () => {
    let checks = 0;
    for (const c of titleContexts()) {
      const eligible = titles.filter((t) => t.when.every((cond) => titleConditionHolds(cond, c)));
      for (const last of eligible) {
        const pool = titlePool(c, last.id);
        expect(pool.length).toBeGreaterThan(0);
        expect(ids(pool)).not.toContain(last.id);
        for (const r of EDGES) {
          const t = pickTitle(c, last.id, () => r);
          expect(t.id).not.toBe(last.id);
          expect(t.when.every((cond) => titleConditionHolds(cond, c))).toBe(true);
          checks++;
        }
      }
    }
    expect(checks).toBeGreaterThan(10_000);
  });

  it('roasts: for every context, whichever eligible roast was shown last is never picked again', () => {
    let checks = 0;
    for (const c of roastContexts()) {
      const eligible = roasts.filter((r) => r.when.every((cond) => roastConditionHolds(cond, c)));
      for (const last of eligible) {
        const pool = roastPool(c, last.id);
        expect(pool.length).toBeGreaterThan(0);
        expect(ids(pool)).not.toContain(last.id);
        for (const r of EDGES) {
          const roast = pickRoast(c, last.id, () => r);
          expect(roast.id).not.toBe(last.id);
          expect(roast.when.every((cond) => roastConditionHolds(cond, c))).toBe(true);
          checks++;
        }
      }
    }
    expect(checks).toBeGreaterThan(10_000);
  });

  it('10,000 sequential picks over random contexts never repeat a title or roast', () => {
    const rng = createRng('no-repeat');
    const random = rngFn(rng);
    let lastTitle: string | null = null;
    let lastRoast: string | null = null;
    for (let i = 0; i < 10_000; i++) {
      const t = pickTitle(randomContext(rng), lastTitle, random);
      expect(t.id).not.toBe(lastTitle);
      lastTitle = t.id;
      const r = pickRoast(randomContext(rng), lastRoast, random);
      expect(r.id).not.toBe(lastRoast);
      lastRoast = r.id;
    }
  });

  it('a one-line top tier alternates with the next tier instead of repeating (10,000 picks)', () => {
    const packed = ctx({
      gameSlug: 'teen-patti',
      netJeet: -10,
      flags: flags({ folded: true, tags: ['packed-best-hand'] }),
    });
    const [top] = roastPool(packed, null);
    expect(roastPool(packed, null)).toHaveLength(1);
    const random = rngFn(createRng('packed'));
    let last: string | null = null;
    let topCount = 0;
    for (let i = 0; i < 10_000; i++) {
      const r = pickRoast(packed, last, random);
      expect(r.id).not.toBe(last);
      if (r.id === top?.id) topCount++;
      last = r.id;
    }
    expect(topCount).toBe(5_000); // exactly every other pick
  });

  it('even an adversarial random() that always returns 0 cannot force a repeat', () => {
    const c = ctx({ gameSlug: 'hearts', flags: flags({ tags: ['shootTheMoon'] }) });
    let last: string | null = null;
    const seen: string[] = [];
    for (let i = 0; i < 100; i++) {
      const t = pickTitle(c, last, () => 0);
      expect(t.id).not.toBe(last);
      seen.push(t.id);
      last = t.id;
    }
    expect(new Set(seen).size).toBe(2); // the first two moon titles, alternating
  });
});

describe('selectionPool / selectEntry', () => {
  type E = { id: string; when: ('a' | 'b' | 'never')[] };
  const entries: E[] = [
    { id: 'x', when: ['never'] },
    { id: 'p', when: ['a'] },
    { id: 'y', when: ['never', 'a'] },
    { id: 'q', when: ['b'] },
    { id: 'z', when: ['never'] },
  ];
  const holds = (c: E['when'][number]) => c !== 'never';
  const weight = () => 10;

  it('alternates between the only two eligible entries over 10,000 picks', () => {
    const random = rngFn(createRng('two'));
    let last: string | null = null;
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const e: E = selectEntry(entries, holds, weight, last, random);
      expect(e.id).not.toBe(last);
      expect(['p', 'q']).toContain(e.id);
      seen.add(e.id);
      last = e.id;
    }
    expect(seen).toEqual(new Set(['p', 'q']));
  });

  it('falls back to the next best tier when the top entry was shown last', () => {
    const tiered: E[] = [
      { id: 'top', when: ['a', 'b'] },
      { id: 'low', when: ['a'] },
    ];
    const heavy = () => SELECTION_MARGIN * 2; // 'top' scores 40, 'low' 20: outside the margin
    expect(ids(selectionPool(tiered, holds, heavy, null))).toEqual(['top']);
    expect(ids(selectionPool(tiered, holds, heavy, 'top'))).toEqual(['low']);
    for (const r of [0, 0.5, 0.99]) {
      expect(selectEntry(tiered, holds, heavy, null, () => r).id).toBe('top');
      expect(selectEntry(tiered, holds, heavy, 'top', () => r).id).toBe('low');
    }
    // Within the margin (inclusive) both tiers share the pool, in source order.
    const edge = () => SELECTION_MARGIN;
    expect(ids(selectionPool(tiered, holds, edge, null))).toEqual(['top', 'low']);
  });

  it('degenerate pools: repeats a lone eligible entry rather than showing a misfit', () => {
    const lone: E[] = [
      { id: 'only', when: ['a'] },
      { id: 'misfit', when: ['never'] },
    ];
    expect(selectEntry(lone, holds, weight, 'only', () => 0).id).toBe('only');
    const none: E[] = [
      { id: 'm1', when: ['never'] },
      { id: 'm2', when: ['never'] },
    ];
    expect(ids(selectionPool(none, holds, weight, 'm1'))).toEqual(['m2']);
    expect(() => selectEntry([] as E[], holds, weight, null)).toThrow(RangeError);
  });
});

describe('pickTip', () => {
  const tips = ['Count to 21 slowly.', 'Stand on hard 17.', 'Split Aces and 8s.', 'Never insure.'];

  it('rotates through every tip without back-to-back repeats', () => {
    const random = rngFn(createRng('tips'));
    let last: string | null = null;
    const firstCycle: string[] = [];
    for (let i = 0; i < 1000; i++) {
      const tip = pickTip(tips, last, random);
      expect(tips).toContain(tip);
      expect(tip).not.toBe(last);
      if (i < tips.length) firstCycle.push(tip);
      last = tip;
    }
    expect(new Set(firstCycle).size).toBe(tips.length);
  });

  it('starts at a random tip when there is no (or an unknown) last tip', () => {
    expect(pickTip(tips, null, () => 0)).toBe(tips[0]);
    expect(pickTip(tips, null, () => 0.99)).toBe(tips[3]);
    expect(pickTip(tips, 'a tip from another game', () => 0.5)).toBe(tips[2]);
  });

  it('moves to the next tip in order and wraps around', () => {
    expect(pickTip(tips, tips[1] ?? null)).toBe(tips[2]);
    expect(pickTip(tips, tips[3] ?? null)).toBe(tips[0]);
  });

  it('handles duplicates, single tips and empty lists', () => {
    expect(pickTip(['A', 'A', 'B'], 'A')).toBe('B');
    expect(pickTip(['Same', 'Same'], 'Same')).toBe('Same');
    expect(pickTip(['Only tip'], 'Only tip')).toBe('Only tip');
    expect(pickTip(['Only tip'], null)).toBe('Only tip');
    expect(pickTip([], null)).toBe('');
  });
});

describe('buildTitleContext', () => {
  it('derives netJeet and isBiggestWin consistently with the wallet settlement', () => {
    const base = {
      gameSlug: 'blackjack',
      gameName: 'Blackjack',
      stake: 25,
      flags: { tags: ['blackjack'] },
      statsBefore: snapshot({ biggestWin: 30 }),
    };
    const natural = buildTitleContext({ ...base, humanNetUnits: 1.5 });
    expect(natural.netJeet).toBe(38); // round(37.5), same as settle()
    expect(natural.isBiggestWin).toBe(true);
    expect(natural.flags.tags).toEqual(['blackjack']);
    expect(natural.gameName).toBe('Blackjack');
    const small = buildTitleContext({ ...base, humanNetUnits: 1 });
    expect(small.netJeet).toBe(25);
    expect(small.isBiggestWin).toBe(false);
    const loss = buildTitleContext({
      ...base,
      humanNetUnits: -1,
      statsBefore: snapshot({ biggestWin: 0 }),
    });
    expect(loss.netJeet).toBe(-25);
    expect(loss.isBiggestWin).toBe(false);
    expect(buildTitleContext({ ...base, humanNetUnits: Number.NaN }).netJeet).toBe(0);
  });

  it('feeds pickTitle end to end: a natural Blackjack gets a natural-Blackjack title', () => {
    const c = buildTitleContext({
      gameSlug: 'blackjack',
      gameName: 'Blackjack',
      humanNetUnits: 1.5,
      stake: 10,
      flags: flags({ perfect: true, tags: ['blackjack'] }),
      statsBefore: snapshot({ biggestWin: 1000 }),
    });
    expect(pickTitle(c, null, () => 0.5).when).toEqual(['game:blackjack', 'tag:blackjack']);
  });
});
