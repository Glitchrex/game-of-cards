import { describe, expect, it } from 'vitest';
import { cardName, makeDeck, type CardCode } from '@/games/core/cards';
import { createRng, shuffle } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import { IllegalMoveError } from '@/games/core/types';
import {
  cardValue,
  DEFAULT_MAX_BATTLES,
  describeBattle,
  faceDownCount,
  lastWarDecided,
  lowestCount,
  MAX_BATTLES_LIMIT,
  resolveBattle,
  warEngine,
  warsWonBy,
  type WarMove,
  type WarState,
} from './engine';
import warEngineDefault from './engine';
import { deal52, flip, FLIP, playOut, records, stateWith, steadyHistory } from './test-helpers';

const setup = (seed: number | string, options?: Record<string, unknown>) =>
  warEngine.setup({ players: 2, options }, createRng(seed));

const sortedDeck = makeDeck().slice().sort();
const allCards = (s: WarState) => [...s.piles[0], ...s.piles[1]].sort();

/** A position one battle before the cap, with the given piles. */
const atCap = (s: WarState, history = steadyHistory(DEFAULT_MAX_BATTLES - 1, [26, 26])) => ({
  ...s,
  battles: DEFAULT_MAX_BATTLES - 1,
  history,
});

describe('war engine: setup', () => {
  it('is exported as the default export and has the right id', () => {
    expect(warEngineDefault).toBe(warEngine);
    expect(warEngine.id).toBe('war');
  });

  it('deals the whole deck, 26 cards each, with nothing left over', () => {
    const s = setup(1);
    expect(s.piles[0]).toHaveLength(26);
    expect(s.piles[1]).toHaveLength(26);
    expect(allCards(s)).toEqual(sortedDeck);
  });

  it('deals a shuffled deck one card at a time, starting with the learner', () => {
    const deck = shuffle(makeDeck(), createRng('deal-check'));
    const s = setup('deal-check');
    expect(s.piles[0]).toEqual(deck.filter((_, i) => i % 2 === 0));
    expect(s.piles[1]).toEqual(deck.filter((_, i) => i % 2 === 1));
  });

  it('starts with no battles, no history and the 60-battle cap', () => {
    const s = setup(2);
    expect(s).toMatchObject({
      battles: 0,
      maxBattles: 60,
      lastBattle: null,
      history: [],
      phase: 'play',
      winner: null,
      endReason: null,
    });
    expect(DEFAULT_MAX_BATTLES).toBe(60);
  });

  it('is deterministic: same seed, same deal; different seeds, different deals', () => {
    expect(setup(42)).toEqual(setup(42));
    expect(setup(42).piles).not.toEqual(setup(43).piles);
  });

  it('produces plain JSON state', () => {
    const s = setup(3);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('accepts a custom battle cap and ignores affordableUnits (no extra bets in War)', () => {
    expect(setup(4, { maxBattles: 10 }).maxBattles).toBe(10);
    expect(setup(4, { maxBattles: MAX_BATTLES_LIMIT }).maxBattles).toBe(MAX_BATTLES_LIMIT);
    expect(setup(4, { maxBattles: undefined }).maxBattles).toBe(DEFAULT_MAX_BATTLES);
    expect(setup(4, { unrelated: true }).maxBattles).toBe(DEFAULT_MAX_BATTLES);
    const broke = warEngine.setup({ players: 2, affordableUnits: 0 }, createRng(4));
    expect(broke).toEqual(setup(4));
  });

  it('rejects anything but two players and invalid battle caps', () => {
    for (const players of [1, 3, 4]) {
      expect(() => warEngine.setup({ players }, createRng(1))).toThrow(/exactly 2 players/);
    }
    for (const maxBattles of [0, -5, 2.5, MAX_BATTLES_LIMIT + 1, '60', true, Number.NaN]) {
      expect(() => setup(1, { maxBattles })).toThrow(/maxBattles/);
    }
  });
});

describe('war engine: turns and moves', () => {
  it('always lets the learner (seat 0) flip while the game runs', () => {
    const s = setup(5);
    expect(warEngine.currentPlayer(s)).toBe(0);
    expect(warEngine.legalMoves(s, 0)).toEqual([{ type: 'flip' }]);
    expect(warEngine.legalMoves(s, 1)).toEqual([]);
    expect(warEngine.isOver(s)).toBe(false);
  });

  it('has no current player and no legal moves once the game is over', () => {
    const over = flip(stateWith([['AS'], ['2C']]));
    expect(warEngine.isOver(over)).toBe(true);
    expect(warEngine.currentPlayer(over)).toBeNull();
    expect(warEngine.legalMoves(over, 0)).toEqual([]);
    expect(warEngine.legalMoves(over, 1)).toEqual([]);
  });

  it('gives the flip a stable key', () => {
    expect(warEngine.moveKey({ type: 'flip' })).toBe('flip');
    expect(warEngine.moveKey(warEngine.legalMoves(setup(6), 0)[0] as WarMove)).toBe('flip');
  });

  it('returns a fresh move object every time (callers may freeze or mutate them)', () => {
    const s = setup(7);
    const a = warEngine.legalMoves(s, 0)[0];
    const b = warEngine.legalMoves(s, 0)[0];
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

describe('war engine: checkMove explains every illegal move', () => {
  const s = setup(8);

  it('accepts the flip from the learner', () => {
    expect(warEngine.checkMove(s, 0, FLIP)).toEqual({ ok: true });
  });

  it("explains that the bot's seat never flips on its own", () => {
    const check = warEngine.checkMove(s, 1, FLIP);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe(
      "Player 1 never flips alone — in this game one Flip turns over both players' top cards together, and it's always your turn to press it.",
    );
  });

  it('rejects seats that do not exist', () => {
    for (const seat of [2, -1, 0.5]) {
      expect(warEngine.checkMove(s, seat, FLIP)).toEqual({
        ok: false,
        reason: 'War has just two players: you and Player 1.',
      });
    }
  });

  it('explains that flipping is the only move', () => {
    const bogus = [{ type: 'play', card: 'AS' }, { type: 'draw' }, {}, null, 'flip', 7];
    for (const move of bogus) {
      const check = warEngine.checkMove(s, 0, move as unknown as WarMove);
      expect(check.ok).toBe(false);
      expect(check.reason).toBe(
        "That isn't a War move. In War nobody chooses a card — the only thing you can do is flip the top card of your pile.",
      );
    }
  });

  it('explains that the game is over, for every way it can end', () => {
    const won = flip(deal52(['AS'], ['2C'], 51));
    expect(warEngine.checkMove(won, 0, FLIP).reason).toBe(
      'The game is over — you won all 52 cards.',
    );
    const lost = flip(deal52(['2C'], ['AS'], 1));
    expect(warEngine.checkMove(lost, 0, FLIP).reason).toBe(
      'The game is over — Player 1 won all 52 cards.',
    );
    const capped = flip(atCap(deal52(['AS'], ['2C'], 27)));
    expect(warEngine.checkMove(capped, 0, FLIP).reason).toBe(
      'The game is over — all 60 battles have been fought (you finished with 28 cards, Player 1 with 24 cards).',
    );
    const tied = flip(stateWith([['9H'], ['9C']]));
    expect(warEngine.checkMove(tied, 0, FLIP).reason).toBe(
      'The game is over — you both ran out of cards in the same war, so it ended in a tie.',
    );
    // The game-over reason wins over every other problem.
    expect(warEngine.checkMove(won, 1, { type: 'nope' } as unknown as WarMove).reason).toBe(
      'The game is over — you won all 52 cards.',
    );
  });

  it('makes applyMove throw IllegalMoveError with the same friendly reason', () => {
    const bogus = { type: 'draw' } as unknown as WarMove;
    expect(() => warEngine.applyMove(s, bogus)).toThrow(IllegalMoveError);
    expect(() => warEngine.applyMove(s, bogus)).toThrow(/only thing you can do is flip/);
    const over = flip(stateWith([['AS'], ['2C']]));
    expect(() => warEngine.applyMove(over, FLIP)).toThrow(IllegalMoveError);
    expect(() => warEngine.applyMove(over, FLIP)).toThrow('The game is already over.');
  });
});

describe('war engine: a battle', () => {
  it('gives both cards to the higher card, winner first, at the bottom of the pile', () => {
    const s = flip(
      stateWith([
        ['KH', '2C'],
        ['7C', '3D'],
      ]),
    );
    expect(s.piles).toEqual([['2C', 'KH', '7C'], ['3D']]);
    expect(s.battles).toBe(1);
    expect(s.phase).toBe('play');
    expect(s.lastBattle).toEqual({
      number: 1,
      rounds: [{ down: [[], []], up: ['KH', '7C'] }],
      winner: 0,
      decidedBy: 'higher-card',
      ranOut: [],
      won: ['KH', '7C'],
      wars: 0,
      counts: [3, 1],
    });
    expect(s.history).toEqual([{ winner: 0, wars: 0, cards: 2, counts: [3, 1] }]);
  });

  it("puts the bot's own card first when the bot wins", () => {
    const s = flip(
      stateWith([
        ['4H', '5S'],
        ['JD', '6C'],
      ]),
    );
    expect(s.piles).toEqual([['5S'], ['6C', 'JD', '4H']]);
    expect(s.lastBattle?.winner).toBe(1);
    expect(s.lastBattle?.won).toEqual(['JD', '4H']);
  });

  it('ranks Ace highest and 2 lowest', () => {
    expect(
      flip(
        stateWith([
          ['AS', '5S'],
          ['KS', '6S'],
        ]),
      ).lastBattle?.winner,
    ).toBe(0);
    expect(
      flip(
        stateWith([
          ['2H', '5S'],
          ['3C', '6S'],
        ]),
      ).lastBattle?.winner,
    ).toBe(1);
    expect(
      flip(
        stateWith([
          ['TD', '5S'],
          ['9D', '6S'],
        ]),
      ).lastBattle?.winner,
    ).toBe(0);
    expect(cardValue('AS')).toBeGreaterThan(cardValue('KS'));
    expect(cardValue('2S')).toBeLessThan(cardValue('3S'));
    const order = ['2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', 'TC', 'JC', 'QC', 'KC', 'AC'];
    const values = order.map((c) => cardValue(c as CardCode));
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size).toBe(13);
  });

  it('ignores suits: two cards of the same rank tie and start a war', () => {
    const s = flip(
      stateWith([
        ['9H', '2S', '3S', '4S', 'QS'],
        ['9C', '2D', '3D', '4D', '4C'],
      ]),
    );
    expect(s.lastBattle?.wars).toBe(1);
    expect(s.lastBattle?.rounds).toHaveLength(2);
  });

  it('keeps the rest of each pile in order and never changes the input state', () => {
    const before = deepFreeze(
      stateWith([
        ['KH', '2C', '3C'],
        ['7C', '3D', '4D'],
      ]),
    );
    const snapshot = JSON.stringify(before);
    const after = warEngine.applyMove(before, FLIP);
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(after.piles).toEqual([
      ['2C', '3C', 'KH', '7C'],
      ['3D', '4D'],
    ]);
    expect(after).not.toBe(before);
  });
});

describe('war engine: wars', () => {
  it('lays 3 face down and 1 face up; the higher face-up card takes all 10 cards', () => {
    const s = flip(
      stateWith([
        ['9H', '2S', '3S', '4S', 'QS', 'KC'],
        ['9C', '2D', '3D', '4D', '4C', 'KD'],
      ]),
    );
    const won = ['9H', '2S', '3S', '4S', 'QS', '9C', '2D', '3D', '4D', '4C'];
    expect(s.piles).toEqual([['KC', ...won], ['KD']]);
    expect(s.lastBattle).toEqual({
      number: 1,
      rounds: [
        { down: [[], []], up: ['9H', '9C'] },
        {
          down: [
            ['2S', '3S', '4S'],
            ['2D', '3D', '4D'],
          ],
          up: ['QS', '4C'],
        },
      ],
      winner: 0,
      decidedBy: 'higher-card',
      ranOut: [],
      won,
      wars: 1,
      counts: [11, 1],
    });
    // The whole war is one battle.
    expect(s.battles).toBe(1);
    expect(s.history).toEqual([{ winner: 0, wars: 1, cards: 10, counts: [11, 1] }]);
  });

  it("gives the war to the bot with the bot's cards first", () => {
    const s = flip(
      stateWith([
        ['9H', '2S', '3S', '4S', '5H', 'KC'],
        ['9C', '2D', '3D', '4D', 'JC', 'KD'],
      ]),
    );
    expect(s.piles).toEqual([
      ['KC'],
      ['KD', '9C', '2D', '3D', '4D', 'JC', '9H', '2S', '3S', '4S', '5H'],
    ]);
  });

  it('fights a double war when the face-up cards tie again (18 cards)', () => {
    const s = flip(
      stateWith([
        ['9H', '2S', '3S', '4S', 'QS', '5S', '6S', '7S', 'AS', 'KC'],
        ['9C', '2D', '3D', '4D', 'QD', '5D', '6D', '7D', '8D', 'KD'],
      ]),
    );
    expect(s.lastBattle?.wars).toBe(2);
    expect(s.lastBattle?.rounds.map((r) => r.up)).toEqual([
      ['9H', '9C'],
      ['QS', 'QD'],
      ['AS', '8D'],
    ]);
    expect(s.lastBattle?.won).toHaveLength(18);
    expect(s.piles[0]).toEqual([
      'KC',
      ...['9H', '2S', '3S', '4S', 'QS', '5S', '6S', '7S', 'AS'],
      ...['9C', '2D', '3D', '4D', 'QD', '5D', '6D', '7D', '8D'],
    ]);
    expect(s.battles).toBe(1);
  });

  it('lets a player with fewer than 4 cards use their last card as the face-up card', () => {
    // 2 cards left: 1 face down + 1 face up.
    const two = flip(
      stateWith([
        ['9H', 'AS', 'KH', 'QH', '2H', 'TH'],
        ['9C', '2D', 'AD'],
      ]),
    );
    expect(two.lastBattle?.rounds[1]).toEqual({
      down: [['AS', 'KH', 'QH'], ['2D']],
      up: ['2H', 'AD'],
    });
    expect(two.piles).toEqual([['TH'], ['9C', '2D', 'AD', '9H', 'AS', 'KH', 'QH', '2H']]);
    expect(two.phase).toBe('play');
    // 1 card left: nothing face down, the last card face up.
    const one = flip(
      stateWith([
        ['9H', '2S', '3S', '4S', '5S', '6S'],
        ['9C', 'KD'],
      ]),
    );
    expect(one.lastBattle?.rounds[1]).toEqual({
      down: [['2S', '3S', '4S'], []],
      up: ['5S', 'KD'],
    });
    expect(one.piles).toEqual([['6S'], ['9C', 'KD', '9H', '2S', '3S', '4S', '5S']]);
    // 3 cards left: 2 face down + 1 face up.
    const three = flip(
      stateWith([
        ['9H', '2S', '3S', '4S', '5S', '6S'],
        ['9C', '2D', '3D', 'AD'],
      ]),
    );
    expect(three.lastBattle?.rounds[1]?.down[1]).toEqual(['2D', '3D']);
    expect(three.lastBattle?.rounds[1]?.up[1]).toBe('AD');
    // The learner can be the short one too.
    const mine = flip(
      stateWith([
        ['9H', '2S', 'AS'],
        ['9C', '2D', '3D', '4D', '5D', '6D'],
      ]),
    );
    expect(mine.lastBattle?.rounds[1]).toEqual({
      down: [['2S'], ['2D', '3D', '4D']],
      up: ['AS', '5D'],
    });
    expect(mine.piles).toEqual([['9H', '2S', 'AS', '9C', '2D', '3D', '4D', '5D'], ['6D']]);
    expect(faceDownCount(1)).toBe(0);
    expect(faceDownCount(2)).toBe(1);
    expect(faceDownCount(3)).toBe(2);
    expect(faceDownCount(4)).toBe(3);
    expect(faceDownCount(30)).toBe(3);
  });

  it('makes a player with no cards left for a war lose — the other takes everything', () => {
    const s = flip(stateWith([['9H', '2S', '3S', '4S', '5S'], ['9C']]));
    expect(s.piles).toEqual([['2S', '3S', '4S', '5S', '9H', '9C'], []]);
    expect(s.lastBattle).toMatchObject({
      winner: 0,
      decidedBy: 'out-of-cards',
      ranOut: [1],
      wars: 1,
      won: ['9H', '9C'],
    });
    expect(s.lastBattle?.rounds).toHaveLength(1);
    expect(s).toMatchObject({ phase: 'over', winner: 0, endReason: 'all-cards' });

    const lost = flip(stateWith([['7H'], ['7S', '2C']]));
    expect(lost.piles).toEqual([[], ['2C', '7S', '7H']]);
    expect(lost.lastBattle).toMatchObject({ winner: 1, decidedBy: 'out-of-cards', ranOut: [0] });
    expect(lost).toMatchObject({ phase: 'over', winner: 1, endReason: 'all-cards' });
  });

  it('runs a short player out on the next tie of a war', () => {
    const s = flip(
      stateWith([
        ['9H', '2S', '3S', '4S', 'QS', 'KC'],
        ['9C', '5D', 'QD'],
      ]),
    );
    expect(s.lastBattle).toMatchObject({ winner: 0, decidedBy: 'out-of-cards', ranOut: [1] });
    expect(s.lastBattle?.wars).toBe(2);
    expect(s.lastBattle?.rounds[1]).toEqual({
      down: [['2S', '3S', '4S'], ['5D']],
      up: ['QS', 'QD'],
    });
    expect(s.piles).toEqual([['KC', '9H', '2S', '3S', '4S', 'QS', '9C', '5D', 'QD'], []]);
  });

  it('ends in a push when both players run out in the same war, each keeping their own cards', () => {
    const s = flip(stateWith([['9H'], ['9C']]));
    expect(s.piles).toEqual([['9H'], ['9C']]);
    expect(s).toMatchObject({ phase: 'over', winner: null, endReason: 'both-out' });
    expect(s.lastBattle).toMatchObject({
      winner: null,
      decidedBy: 'both-out',
      ranOut: [0, 1],
      won: [],
    });

    const uneven = flip(
      stateWith([
        ['9H', '2S', 'QS'],
        ['9C', 'QD'],
      ]),
    );
    expect(uneven.piles).toEqual([
      ['9H', '2S', 'QS'],
      ['9C', 'QD'],
    ]);
    expect(uneven.lastBattle?.wars).toBe(2);
    expect(uneven.endReason).toBe('both-out');
    const r = warEngine.result(uneven);
    expect(r).toMatchObject({
      winners: [],
      humanOutcome: 'push',
      humanNetUnits: 0,
      scores: [3, 2],
    });
  });

  it('can run a full 52-card war chain until both players are out', () => {
    // Every face-up card ties: 1 + 6 wars of 4 + a last single card = 26 cards each.
    const ups0 = ['2S', '3S', '4S', '5S', '6S', '7S', '8S', '9S'];
    const ups1 = ['2H', '3H', '4H', '5H', '6H', '7H', '8H', '9H'];
    const spare = makeDeck().filter((c) => !ups0.includes(c) && !ups1.includes(c));
    const pile = (ups: string[], from: number) => {
      const out: CardCode[] = [ups[0] as CardCode];
      for (let w = 1; w <= 6; w++) {
        out.push(...(spare.slice(from + (w - 1) * 3, from + w * 3) as CardCode[]));
        out.push(ups[w] as CardCode);
      }
      out.push(ups[7] as CardCode);
      return out;
    };
    const p0 = pile(ups0, 0);
    const p1 = pile(ups1, 18);
    expect(p0).toHaveLength(26);
    expect([...p0, ...p1].sort()).toEqual(sortedDeck);
    const s = flip(stateWith([p0, p1]));
    expect(s.endReason).toBe('both-out');
    expect(s.lastBattle?.wars).toBe(8);
    expect(s.lastBattle?.rounds).toHaveLength(8);
    expect(s.lastBattle?.rounds[7]?.down).toEqual([[], []]);
    expect(s.piles).toEqual([p0, p1]);
    expect(warEngine.result(s).humanOutcome).toBe('push');
    expect(warEngine.result(s).summary).toBe(
      "You both ran out of cards in the same war after 1 battle, so nobody could carry on — it's a tie and your stake comes back (a push).",
    );
  });

  it('resolveBattle is pure and refuses an empty pile', () => {
    const piles = deepFreeze([
      ['9H', '2S', '3S', '4S', 'QS'],
      ['9C', '2D', '3D', '4D', '4C'],
    ]) as [CardCode[], CardCode[]];
    const a = resolveBattle(piles);
    expect(resolveBattle(piles)).toEqual(a);
    expect(() => resolveBattle([[], ['2C']])).toThrow(/at least one card/);
    expect(() => resolveBattle([['2C'], []])).toThrow(/at least one card/);
  });
});

describe('war engine: end of the game', () => {
  it('ends as soon as one player holds all 52 cards, even before the cap', () => {
    const s = flip(
      deal52(['AS'], ['2C'], 51, { battles: 40, history: steadyHistory(40, [51, 1]) }),
    );
    expect(s.piles[0]).toHaveLength(52);
    expect(s.piles[1]).toHaveLength(0);
    expect(s).toMatchObject({ phase: 'over', winner: 0, endReason: 'all-cards', battles: 41 });
    const lost = flip(
      deal52(['2C'], ['AS'], 1, { battles: 12, history: steadyHistory(12, [1, 51]) }),
    );
    expect(lost).toMatchObject({ phase: 'over', winner: 1, endReason: 'all-cards' });
  });

  it('stops after battle 60 and gives the game to the bigger pile', () => {
    const before = atCap(deal52(['AS'], ['2C'], 27));
    expect(warEngine.isOver(before)).toBe(false);
    const s = flip(before);
    expect(s).toMatchObject({ phase: 'over', winner: 0, endReason: 'battle-cap', battles: 60 });
    expect([s.piles[0].length, s.piles[1].length]).toEqual([28, 24]);
    const lost = flip(atCap(deal52(['2C'], ['AS'], 25)));
    expect(lost).toMatchObject({ phase: 'over', winner: 1, endReason: 'battle-cap' });
  });

  it('is a push when the piles are equal after the last battle', () => {
    const s = flip(atCap(deal52(['AS'], ['2C'], 25)));
    expect([s.piles[0].length, s.piles[1].length]).toEqual([26, 26]);
    expect(s).toMatchObject({ phase: 'over', winner: null, endReason: 'battle-cap' });
  });

  it('keeps going before the cap', () => {
    const s = flip({ ...deal52(['AS'], ['2C'], 27), battles: 58 });
    expect(s.battles).toBe(59);
    expect(s.phase).toBe('play');
    expect(warEngine.currentPlayer(s)).toBe(0);
  });

  it('honours a custom cap and counts a war chain as one battle', () => {
    const s = setup(9, { maxBattles: 1 });
    const after = flip(s);
    expect(after.battles).toBe(1);
    expect(after.endReason === 'battle-cap' || after.endReason === 'all-cards').toBe(true);
    expect(after.phase).toBe('over');
    const capped = flip({
      ...stateWith([
        ['9H', '2S', '3S', '4S', 'QS', 'KC'],
        ['9C', '2D', '3D', '4D', '4C', 'KD'],
      ]),
      maxBattles: 1,
    });
    expect(capped).toMatchObject({ battles: 1, endReason: 'battle-cap', winner: 0 });
  });

  it('prefers "all cards" over the cap when both happen on the same battle', () => {
    const s = flip(atCap(deal52(['AS'], ['2C'], 51)));
    expect(s.endReason).toBe('all-cards');
    expect(s.battles).toBe(60);
  });

  it('always finishes within the cap from a real deal', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const states = playOut(setup(seed));
      const last = states[states.length - 1] as WarState;
      expect(last.battles).toBeLessThanOrEqual(60);
      expect(states).toHaveLength(last.battles + 1);
    }
  });
});

describe('war engine: result', () => {
  it('refuses to score an unfinished game', () => {
    expect(() => warEngine.result(setup(10))).toThrow(/before the game ended/);
  });

  it('pays +1 for a win, −1 for a loss and 0 for a push', () => {
    const win = warEngine.result(flip(deal52(['AS'], ['2C'], 51, { battles: 40 })));
    expect(win).toMatchObject({
      winners: [0],
      humanOutcome: 'win',
      humanNetUnits: 1,
      scores: [52, 0],
    });
    const loss = warEngine.result(flip(atCap(deal52(['2C'], ['AS'], 25))));
    expect(loss).toMatchObject({
      winners: [1],
      humanOutcome: 'loss',
      humanNetUnits: -1,
      scores: [24, 28],
    });
    const push = warEngine.result(flip(atCap(deal52(['AS'], ['2C'], 25))));
    expect(push).toMatchObject({
      winners: [],
      humanOutcome: 'push',
      humanNetUnits: 0,
      scores: [26, 26],
    });
  });

  it('summarises every kind of ending in one plain sentence', () => {
    const summary = (s: WarState) => warEngine.result(flip(s)).summary;
    expect(summary(deal52(['AS'], ['2C'], 51, { battles: 40 }))).toBe(
      'You won all 52 cards in 41 battles — total victory!',
    );
    expect(summary(deal52(['2C'], ['AS'], 1, { battles: 12 }))).toBe(
      'Player 1 won all 52 cards in 13 battles, so this game goes to them.',
    );
    expect(summary(deal52(['9H', '2S', '3S', '4S', '5S'], ['9C'], 51, { battles: 30 }))).toBe(
      'Player 1 ran out of cards in the middle of a war, so you won all 52 cards in 31 battles — total victory!',
    );
    expect(summary(deal52(['9H'], ['9C', '2D', '3D'], 1, { battles: 5 }))).toBe(
      'You ran out of cards in the middle of a war, so Player 1 took all 52 cards in 6 battles.',
    );
    expect(summary(atCap(deal52(['AS'], ['2C'], 27)))).toBe(
      "After 60 battles you held 28 cards to Player 1's 24, so you win!",
    );
    expect(summary(atCap(deal52(['2C'], ['AS'], 25)))).toBe(
      'After 60 battles Player 1 held 28 cards to your 24, so Player 1 wins this one.',
    );
    expect(summary(atCap(deal52(['AS'], ['2C'], 25)))).toBe(
      "After 60 battles you each held 26 cards — a perfect tie, so it's a push.",
    );
    expect(summary(stateWith([['9H'], ['9C']], { battles: 6 }))).toBe(
      "You both ran out of cards in the same war after 7 battles, so nobody could carry on — it's a tie and your stake comes back (a push).",
    );
  });

  describe('flags', () => {
    const flagsOf = (s: WarState) => warEngine.result(flip(s)).flags;
    /** 59 battles where the learner's pile dipped to `low` once, then recovered to 27. */
    const dipTo = (low: number) => {
      const counts = Array.from({ length: 59 }, (_, i): [number, number] =>
        i === 20 ? [low, 52 - low] : [27, 25],
      );
      return records(counts);
    };

    it('comeback: the learner fell to 16 cards or fewer and still won', () => {
      expect(flagsOf(atCap(deal52(['AS'], ['2C'], 27), dipTo(16))).comeback).toBe(true);
      expect(flagsOf(atCap(deal52(['AS'], ['2C'], 27), dipTo(5))).comeback).toBe(true);
      expect(flagsOf(atCap(deal52(['AS'], ['2C'], 27), dipTo(17))).comeback).toBe(false);
      // Low point reached but the game was lost: no comeback.
      expect(flagsOf(atCap(deal52(['2C'], ['AS'], 25), dipTo(10))).comeback).toBe(false);
      expect(lowestCount(atCap(deal52(['AS'], ['2C'], 27), dipTo(12)), 0)).toBe(12);
      expect(lowestCount(setup(1), 0)).toBe(26);
    });

    it('comeback looks at the pile size after every battle, including the latest one', () => {
      const fell = atCap(
        deal52(['AS'], ['2C'], 27),
        records([...Array.from({ length: 58 }, (): [number, number] => [27, 25]), [16, 36]]),
      );
      expect(flagsOf(fell).comeback).toBe(true);
    });

    it('closeFinish: at the cap, the piles differ by 4 cards or fewer', () => {
      expect(flagsOf(atCap(deal52(['AS'], ['2C'], 27))).closeFinish).toBe(true); // 28–24
      expect(flagsOf(atCap(deal52(['2C'], ['AS'], 25))).closeFinish).toBe(true); // 24–28
      expect(flagsOf(atCap(deal52(['AS'], ['2C'], 25))).closeFinish).toBe(true); // 26–26
      expect(flagsOf(atCap(deal52(['AS'], ['2C'], 28))).closeFinish).toBe(false); // 29–23
      expect(flagsOf(atCap(deal52(['2C'], ['AS'], 24))).closeFinish).toBe(false); // 23–29
      // Winning all the cards is never a close finish.
      expect(flagsOf(deal52(['AS'], ['2C'], 51))).toMatchObject({ closeFinish: false });
    });

    it('luckyLastCard: the final battle was a war the learner won, and it decided the game', () => {
      const war0 = ['9H', '2S', '3S', '4S', 'AS'] as CardCode[];
      const war1 = ['9C', '2D', '3D', '4D', '2C'] as CardCode[];
      const lost1 = ['9H', '2S', '3S', '4S', '2C'] as CardCode[];
      const won1 = ['9C', '2D', '3D', '4D', 'AS'] as CardCode[];
      // Won the last war and the game (27 + 5 = 32 vs 20); losing it would have been 22–30.
      expect(flagsOf(atCap(deal52(war0, war1, 27))).luckyLastCard).toBe(true);
      // Won the last war, but 35–17 was safe anyway (losing it would still be 30–22).
      expect(flagsOf(atCap(deal52(war0, war1, 35))).luckyLastCard).toBe(false);
      // The last battle was a plain battle.
      expect(flagsOf(atCap(deal52(['AS'], ['2C'], 27))).luckyLastCard).toBe(false);
      // The bot won the last war, although the learner still won on cards (33 − 5 = 28).
      expect(flagsOf(atCap(deal52(lost1, won1, 33))).luckyLastCard).toBe(false);
      // The learner won the last war but still lost on cards (17 + 5 = 22 vs 30).
      const behind = flagsOf(atCap(deal52(war0, war1, 17)));
      expect(behind.luckyLastCard).toBe(false);
      // Finishing off a bot that had a single card left was never in doubt.
      expect(flagsOf(deal52(['9H', '2S'], ['9C'], 51)).luckyLastCard).toBe(false);
      expect(lastWarDecided(flip(atCap(deal52(war0, war1, 31))))).toBe(true); // 36–16 vs 26–26
      expect(lastWarDecided(flip(atCap(deal52(war0, war1, 32))))).toBe(false); // 37–15 vs 27–25
      expect(lastWarDecided(flip(atCap(deal52(lost1, won1, 33))))).toBe(false);
    });

    it('never sets bigPot, perfect, bust or folded (War has no choices and a ±1 bet)', () => {
      for (const seed of [11, 12, 13]) {
        const last = playOut(setup(seed)).pop() as WarState;
        expect(warEngine.result(last).flags).toMatchObject({
          bigPot: false,
          perfect: false,
          bust: false,
          folded: false,
        });
      }
    });

    it('tags the ending and counts the wars the learner won', () => {
      const wars = records(
        Array.from({ length: 59 }, (): [number, number] => [27, 25]),
        (i) => (i === 3 || i === 9 || i === 15 ? (i === 15 ? 2 : 1) : 0),
        (i) => (i === 15 ? 1 : 0),
      );
      const s = atCap(deal52(['AS'], ['2C'], 27), wars);
      expect(warsWonBy(flip(s), 0)).toBe(2);
      expect(warsWonBy(flip(s), 1)).toBe(1);
      expect(flagsOf(s).tags).toEqual(['battle-cap', 'war-won', 'war-won:2', 'double-war']);
      expect(flagsOf(atCap(deal52(['AS'], ['2C'], 27))).tags).toEqual(['battle-cap']);
      expect(flagsOf(deal52(['AS'], ['2C'], 51)).tags).toEqual(['all-cards']);
      expect(flagsOf(stateWith([['9H'], ['9C']])).tags).toEqual(['both-out']);
      // The final battle's war counts as well.
      expect(flagsOf(deal52(['9H', '2S'], ['9C'], 51)).tags).toEqual([
        'all-cards',
        'war-won',
        'war-won:1',
      ]);
    });
  });
});

describe('war engine: determinism and purity', () => {
  it('plays the same game from the same seed', () => {
    const a = playOut(setup('same'));
    const b = playOut(setup('same'));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(warEngine.result(a[a.length - 1] as WarState)).toEqual(
      warEngine.result(b[b.length - 1] as WarState),
    );
  });

  it('never mutates a deep-frozen state through a whole game', () => {
    let s = deepFreeze(setup(14));
    while (!warEngine.isOver(s)) {
      const before = JSON.stringify(s);
      const next = warEngine.applyMove(s, FLIP);
      expect(JSON.stringify(s)).toBe(before);
      s = deepFreeze(next);
    }
    expect(() => warEngine.result(s)).not.toThrow();
  });

  it('keeps every card exactly once through a whole game', () => {
    for (const state of playOut(setup(15))) expect(allCards(state)).toEqual(sortedDeck);
  });
});

describe('war engine: bot', () => {
  it('always flips, at any difficulty, in every position of a game', () => {
    const rng = createRng('bot');
    for (const state of playOut(setup(16)).slice(0, -1)) {
      for (const difficulty of ['easy', 'normal'] as const) {
        const move = warEngine.botMove(state, 0, difficulty, rng);
        expect(move).toEqual({ type: 'flip' });
        expect(warEngine.checkMove(state, 0, move).ok).toBe(true);
      }
    }
  });

  it('flips in tricky spots: last card, last battle, a war it cannot finish', () => {
    const rng = createRng('tricky');
    const spots = [
      stateWith([['7H'], ['7S', '2C']]),
      atCap(deal52(['AS'], ['2C'], 27)),
      stateWith([['9H', '2S', '3S', '4S', '5S'], ['9C']]),
      stateWith([['9H'], ['9C']]),
    ];
    for (const s of spots) {
      const move = warEngine.botMove(s, 0, 'normal', rng);
      expect(warEngine.legalMoves(s, 0).map((m) => warEngine.moveKey(m))).toContain(
        warEngine.moveKey(move),
      );
      expect(() => warEngine.applyMove(s, move)).not.toThrow();
    }
  });

  it("refuses to move for a seat whose turn it isn't", () => {
    const rng = createRng('nope');
    expect(() => warEngine.botMove(setup(17), 1, 'normal', rng)).toThrow(/never flips alone/);
    const over = flip(stateWith([['AS'], ['2C']]));
    expect(() => warEngine.botMove(over, 0, 'easy', rng)).toThrow(/game is over/);
  });
});

describe('war engine: describeMove', () => {
  const say = (s: WarState) => warEngine.describeMove(s, 0, FLIP);

  it('describes a plain battle from the learner’s side', () => {
    expect(
      say(
        stateWith([
          ['KH', '2C'],
          ['7C', '3D'],
        ]),
      ),
    ).toBe(
      'You flipped the King of Hearts and Player 1 flipped the Seven of Clubs — your King is higher, so you win both cards.',
    );
    expect(
      say(
        stateWith([
          ['4H', '5S'],
          ['JD', '6C'],
        ]),
      ),
    ).toBe(
      "You flipped the Four of Hearts and Player 1 flipped the Jack of Diamonds — Player 1's Jack is higher, so Player 1 wins both cards.",
    );
  });

  it('describes a war without naming any face-down card', () => {
    const s = stateWith([
      ['9H', '2S', '3S', '4S', 'QS', 'KC'],
      ['9C', '2D', '3D', '4D', '4C', 'KD'],
    ]);
    const text = say(s);
    expect(text).toBe(
      "You flipped the Nine of Hearts and Player 1 flipped the Nine of Clubs — a tie, so it's War! You each laid 3 cards face down and flipped one more: your Queen of Spades against Player 1's Four of Clubs. Your Queen is higher, so you win the war and take all 10 cards.",
    );
    for (const hidden of ['2S', '3S', '4S', '2D', '3D', '4D'] as const) {
      expect(text).not.toContain(cardName(hidden));
    }
    const lost = say(
      stateWith([
        ['9H', '2S', '3S', '4S', '5H', 'KC'],
        ['9C', '2D', '3D', '4D', 'JC', 'KD'],
      ]),
    );
    expect(lost).toMatch(
      /Player 1's Jack is higher, so Player 1 wins the war and takes all 10 cards\.$/,
    );
  });

  it('describes a double war', () => {
    const text = say(
      stateWith([
        ['9H', '2S', '3S', '4S', 'QS', '5S', '6S', '7S', 'AS', 'KC'],
        ['9C', '2D', '3D', '4D', 'QD', '5D', '6D', '7D', '8D', 'KD'],
      ]),
    );
    expect(text).toContain(
      "your Queen of Spades against Player 1's Queen of Diamonds — another tie, so it's War again!",
    );
    expect(text).toMatch(/Your Ace is higher, so you win the war and take all 18 cards\.$/);
  });

  it('explains how a short pile is played', () => {
    expect(
      say(
        stateWith([
          ['9H', 'AS', 'KH', 'QH', '2H', 'TH'],
          ['9C', '2D', 'AD'],
        ]),
      ),
    ).toContain(
      "You laid 3 cards face down and flipped one more, and Player 1 had only 2 cards left, so they laid 1 face down and flipped their last card: your Two of Hearts against Player 1's Ace of Diamonds.",
    );
    expect(
      say(
        stateWith([
          ['9H', '2S', 'AS'],
          ['9C', '2D', '3D', '4D', '5D', '6D'],
        ]),
      ),
    ).toContain(
      'You had only 2 cards left, so you laid 1 face down and flipped your last card, and Player 1 laid 3 cards face down and flipped one more',
    );
    expect(
      say(
        stateWith([
          ['9H', '2S', '3S', '4S', '5S', '6S'],
          ['9C', 'KD'],
        ]),
      ),
    ).toContain('Player 1 had just one card left and flipped it');
  });

  it('announces running out of cards, the end of the game and the battle cap', () => {
    expect(say(deal52(['9H', '2S'], ['9C'], 51))).toBe(
      "You flipped the Nine of Hearts and Player 1 flipped the Nine of Clubs — a tie, so it's War! But Player 1 has no cards left to fight the war, so you take both cards. You now have all 52 cards — you win the game!",
    );
    expect(say(deal52(['7H'], ['7S', '2C'], 1))).toBe(
      "You flipped the Seven of Hearts and Player 1 flipped the Seven of Spades — a tie, so it's War! But you have no cards left to fight the war, so Player 1 takes both cards. Player 1 now has all 52 cards and wins the game.",
    );
    expect(say(stateWith([['9H'], ['9C']]))).toBe(
      "You flipped the Nine of Hearts and Player 1 flipped the Nine of Clubs — a tie, so it's War! But neither of you has a card left to fight with, so you each take your own cards back. The game ends in a tie.",
    );
    expect(say(atCap(deal52(['AS'], ['2C'], 27)))).toBe(
      'You flipped the Ace of Spades and Player 1 flipped the Two of Clubs — your Ace is higher, so you win both cards. That was battle 60, the last one: you have 28 cards and Player 1 has 24, so you win!',
    );
    expect(say(atCap(deal52(['AS'], ['2C'], 25)))).toMatch(/so it's a tie — a push\.$/);
    expect(say(atCap(deal52(['2C'], ['AS'], 25)))).toMatch(/so Player 1 wins\.$/);
  });

  it('does not change the state and explains illegal moves instead', () => {
    const s = deepFreeze(setup(18));
    const before = JSON.stringify(s);
    say(s);
    expect(JSON.stringify(s)).toBe(before);
    expect(warEngine.describeMove(s, 1, FLIP)).toMatch(/^Player 1 never flips alone/);
    const over = flip(stateWith([['AS'], ['2C']]));
    expect(say(over)).toMatch(/^The game is over/);
  });

  it('describeBattle names the round cards in order', () => {
    const outcome = resolveBattle([['KH'], ['7C']]);
    expect(describeBattle(outcome)).toBe(
      'You flipped the King of Hearts and Player 1 flipped the Seven of Clubs — your King is higher, so you win both cards.',
    );
  });
});

describe('war engine: coach', () => {
  it('explains the start of the game and suggests flipping', () => {
    const advice = warEngine.coach(setup(19), 0);
    expect(advice.situation).toBe(
      'The cards are dealt: you and Player 1 have 26 cards each, face down. Flip to start battle 1 of 60 — you each turn over your top card and the higher one wins both.',
    );
    expect(advice.suggestion).toEqual({ type: 'flip' });
    expect(warEngine.checkMove(setup(19), 0, advice.suggestion as WarMove).ok).toBe(true);
    expect(advice.why).toContain('War is pure luck');
    expect(advice.why).toContain("it's a war");
  });

  it('describes the last battle and the score so far', () => {
    const s = flip(
      stateWith([
        ['KH', '2C', '5C'],
        ['7C', '3D', '6D'],
      ]),
    );
    const advice = warEngine.coach(s, 0);
    expect(advice.situation).toBe(
      "Battle 2 of 60 is next. You have 4 cards and Player 1 has 2 cards. Last battle: your King beat Player 1's Seven.",
    );
    expect(advice.suggestion).toEqual(FLIP);
  });

  it('explains what just happened in a war', () => {
    const s = flip(
      stateWith([
        ['9H', '2S', '3S', '4S', 'QS', 'KC'],
        ['9C', '2D', '3D', '4D', '4C', 'KD'],
      ]),
    );
    const advice = warEngine.coach(s, 0);
    expect(advice.situation).toContain(
      "Last battle: a war! In the end your Queen beat Player 1's Four, so you took all 10 cards.",
    );
    expect(advice.why).toContain('That last battle was a war');
    const double = flip(
      stateWith([
        ['9H', '2S', '3S', '4S', 'QS', '5S', '6S', '7S', 'AS', 'KC'],
        ['9C', '2D', '3D', '4D', 'QD', '5D', '6D', '7D', '8D', 'KD'],
      ]),
    );
    expect(warEngine.coach(double, 0).situation).toContain('Last battle: a double war!');
  });

  it('encourages a learner who is low on cards, and warns when the cap is near', () => {
    const low = flip({ ...deal52(['2C'], ['AS'], 9), battles: 10 });
    expect(warEngine.coach(low, 0).why).toContain("You're low on cards");
    const ahead = flip({ ...deal52(['AS'], ['2C'], 45), battles: 10 });
    expect(warEngine.coach(ahead, 0).why).toContain("You're well ahead");
    const near = flip({ ...deal52(['AS'], ['2C'], 27), battles: 55 });
    expect(warEngine.coach(near, 0).situation).toContain(
      'Only 4 battles left — after battle 60, whoever holds more cards wins.',
    );
    const last = flip({ ...deal52(['AS'], ['2C'], 27), battles: 58 });
    expect(warEngine.coach(last, 0).situation).toContain(
      'This is the last battle — after it, whoever holds more cards wins.',
    );
  });

  it('gives the final summary and no suggestion once the game is over', () => {
    const over = flip(atCap(deal52(['AS'], ['2C'], 27)));
    const advice = warEngine.coach(over, 0);
    expect(advice.situation).toBe(warEngine.result(over).summary);
    expect(advice.suggestion).toBeUndefined();
  });

  it("never suggests a move for the bot's seat", () => {
    const advice = warEngine.coach(setup(20), 1);
    expect(advice.suggestion).toBeUndefined();
    expect(advice.situation).toContain('Player 1 never acts alone');
  });

  it('suggests a legal move in every position of a real game', () => {
    for (const s of playOut(setup(21)).slice(0, -1)) {
      const advice = warEngine.coach(s, 0);
      expect(warEngine.checkMove(s, 0, advice.suggestion as WarMove).ok).toBe(true);
      expect(advice.why?.length).toBeGreaterThan(20);
    }
  });
});
