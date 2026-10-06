import { describe, expect, it } from 'vitest';
import { type CardCode, makeDeck } from '@/games/core/cards';
import { createRng, shuffle } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import { IllegalMoveError } from '@/games/core/types';
import engine, {
  DEFAULT_POT_LIMIT,
  DEFAULT_STAKE_LIMIT,
  MAX_LOSS_UNITS,
  type TeenPattiMove,
  type TeenPattiOptions,
  type TeenPattiState,
  moveCost,
  seatName,
  teenPattiEngine,
} from './engine';
import { blindBets, opponentFloor, winChance } from './strategy';

// ------------------------------------------------------------------ helpers

const h = (s: string) => s.split(' ') as CardCode[];
const M = (type: TeenPattiMove['type']) => ({ type }) as TeenPattiMove;

/** A fresh table with chosen hands. Dealer = last seat, so seat 0 acts first unless overridden. */
function table(hands: string[], options: TeenPattiOptions = {}): TeenPattiState {
  const players = hands.length;
  const base = engine.setup(
    { players, options: { dealer: players - 1, ...options } },
    createRng('fixture'),
  );
  const dealt = hands.map(h);
  const used = new Set<string>(dealt.flat());
  return { ...base, hands: dealt, stock: makeDeck().filter((c) => !used.has(c)) };
}

function play(state: TeenPattiState, ...types: TeenPattiMove['type'][]): TeenPattiState {
  return types.reduce((s, t) => engine.applyMove(s, M(t)), state);
}

const keys = (moves: TeenPattiMove[]) => moves.map((m) => engine.moveKey(m));

const A_HIGH = 'AS 9D 4C';
const K_HIGH = 'KH QD 8C';
const PAIR_7 = '7S 7H KD';
/** Opponent hands that never clash with the special hands used below. */
const OPP1 = '3C 5D 9S';
const OPP2 = '4C 8C JD';

/** Play random bot moves from a seeded setup to reach a varied mid-game spot. */
function randomSpot(seed: number, players = 2 + (seed % 4)): TeenPattiState | null {
  let s = engine.setup({ players }, createRng(`spot-${seed}`));
  const rng = createRng(`spot-bots-${seed}`);
  const steps = seed % 9;
  for (let i = 0; i < steps && !engine.isOver(s); i++) {
    const p = engine.currentPlayer(s) ?? 0;
    s = engine.applyMove(s, engine.botMove(s, p, i % 2 ? 'easy' : 'normal', rng));
  }
  return engine.isOver(s) ? null : s;
}

// -------------------------------------------------------------------- setup

describe('setup', () => {
  it('seats 3 players by default, posts a 1-boot boot each and starts everyone blind', () => {
    const s = engine.setup({ players: 3 }, createRng(1));
    expect(s.players).toBe(3);
    expect(s.hands).toHaveLength(3);
    for (const hand of s.hands) expect(hand).toHaveLength(3);
    expect(s.contributed).toEqual([1, 1, 1]);
    expect(s.pot).toBe(3);
    expect(s.stake).toBe(1);
    expect(s.seen).toEqual([false, false, false]);
    expect(s.packed).toEqual([false, false, false]);
    expect(s.stakeLimit).toBe(DEFAULT_STAKE_LIMIT);
    expect(s.potLimit).toBe(DEFAULT_POT_LIMIT);
    expect(s.history).toEqual([]);
    expect(s.outcome).toBeNull();
    expect(engine.currentPlayer(s)).toBe((s.dealer + 1) % 3);
    expect(engine.id).toBe('teen-patti');
    expect(teenPattiEngine).toBe(engine);
    expect(MAX_LOSS_UNITS).toBe(64);
  });

  it('uses all 52 cards exactly once (hands + undealt stock)', () => {
    for (const players of [2, 3, 4, 5]) {
      const s = engine.setup({ players }, createRng(`cards-${players}`));
      const all = [...s.hands.flat(), ...s.stock];
      expect(all).toHaveLength(52);
      expect(new Set(all).size).toBe(52);
      expect(s.stock).toHaveLength(52 - 3 * players);
      expect(s.pot).toBe(players);
    }
  });

  it('deals one card at a time starting on the dealer’s left', () => {
    const s = engine.setup({ players: 4 }, createRng('order'));
    const r = createRng('order');
    const dealer = r.int(4);
    const deck = shuffle(makeDeck(), r);
    expect(s.dealer).toBe(dealer);
    for (let round = 0; round < 3; round++) {
      for (let i = 1; i <= 4; i++) {
        expect(s.hands[(dealer + i) % 4]?.[round]).toBe(deck[round * 4 + i - 1]);
      }
    }
    expect(s.stock).toEqual(deck.slice(12));
  });

  it('chooses the dealer from the seed, or from options.dealer', () => {
    const dealers = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      dealers.add(engine.setup({ players: 4 }, createRng(seed)).dealer);
    }
    expect(dealers.size).toBe(4);
    const fixed = engine.setup({ players: 4, options: { dealer: 2 } }, createRng(9));
    expect(fixed.dealer).toBe(2);
    expect(engine.currentPlayer(fixed)).toBe(3);
  });

  it('is deterministic: same seed → same deal; different seeds → different deals', () => {
    const a = engine.setup({ players: 3 }, createRng('same'));
    const b = engine.setup({ players: 3 }, createRng('same'));
    const c = engine.setup({ players: 3 }, createRng('other'));
    expect(a).toEqual(b);
    expect(a.hands).not.toEqual(c.hands);
  });

  it('accepts the pot-limit and chaal-limit options', () => {
    const s = engine.setup({ players: 2, options: { potLimit: 16, stakeLimit: 4 } }, createRng(3));
    expect(s.potLimit).toBe(16);
    expect(s.stakeLimit).toBe(4);
  });

  it('rejects unsupported player counts and options', () => {
    for (const players of [1, 6, 2.5, 0]) {
      expect(() => engine.setup({ players }, createRng(1))).toThrow(RangeError);
    }
    const bad: TeenPattiOptions[] = [
      { dealer: 3 },
      { dealer: -1 },
      { dealer: 1.5 },
      { stakeLimit: 3 },
      { stakeLimit: 16 },
      { potLimit: 3 },
      { potLimit: 65 },
      { potLimit: 20.5 },
    ];
    for (const options of bad) {
      expect(() => engine.setup({ players: 3, options }, createRng(1))).toThrow(RangeError);
    }
  });

  it('produces plain JSON-serialisable state', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'see', 'chaal', 'pack');
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

// ------------------------------------------------------- turns & legal moves

describe('turn order and legal moves', () => {
  it('offers a blind player see, chaal, raise and pack (no show with 3 players)', () => {
    const s = table([A_HIGH, K_HIGH, PAIR_7]);
    expect(keys(engine.legalMoves(s, 0))).toEqual(['see', 'chaal', 'raise', 'pack']);
    expect(engine.legalMoves(s, 1)).toEqual([]);
    expect(engine.legalMoves(s, 2)).toEqual([]);
  });

  it('after seeing, the same player acts again (and cannot see twice)', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'see');
    expect(s.seen[0]).toBe(true);
    expect(engine.currentPlayer(s)).toBe(0);
    expect(keys(engine.legalMoves(s, 0))).toEqual(['chaal', 'raise', 'pack']);
    expect(s.pot).toBe(3);
    expect(s.contributed[0]).toBe(1);
  });

  it('passes the turn clockwise and skips packed players', () => {
    let s = table([A_HIGH, K_HIGH, PAIR_7, '2C 5D 9H']);
    s = play(s, 'chaal');
    expect(engine.currentPlayer(s)).toBe(1);
    s = play(s, 'pack');
    expect(engine.currentPlayer(s)).toBe(2);
    s = play(s, 'chaal', 'chaal');
    expect(engine.currentPlayer(s)).toBe(0);
    s = play(s, 'chaal');
    expect(engine.currentPlayer(s)).toBe(2); // seat 1 packed
  });

  it('offers show only when exactly two players are left', () => {
    let s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'chaal');
    expect(keys(engine.legalMoves(s, 1))).not.toContain('show');
    s = play(s, 'pack');
    expect(keys(engine.legalMoves(s, 2))).toEqual(['see', 'chaal', 'raise', 'show', 'pack']);
    const two = table([A_HIGH, K_HIGH]);
    expect(keys(engine.legalMoves(two, 0))).toContain('show');
  });

  it('removes raise once the stake reaches the 8-boot chaal limit', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'raise', 'raise', 'raise');
    expect(s.stake).toBe(8);
    expect(keys(engine.legalMoves(s, 0))).toEqual(['see', 'chaal', 'pack']);
  });

  it('respects a smaller stakeLimit option', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7], { stakeLimit: 2 }), 'raise');
    expect(s.stake).toBe(2);
    expect(keys(engine.legalMoves(s, 1))).not.toContain('raise');
  });

  it('currentPlayer is null exactly when the hand is over', () => {
    const s = play(table([A_HIGH, K_HIGH]), 'pack');
    expect(engine.isOver(s)).toBe(true);
    expect(engine.currentPlayer(s)).toBeNull();
    expect(engine.legalMoves(s, 0)).toEqual([]);
    expect(engine.legalMoves(s, 1)).toEqual([]);
  });

  it('moveKey is stable and unique per move', () => {
    const all = (['see', 'pack', 'chaal', 'raise', 'show'] as const).map(M);
    const k = keys(all);
    expect(new Set(k).size).toBe(5);
    expect(engine.moveKey({ type: 'chaal' })).toBe(engine.moveKey(M('chaal')));
  });
});

// ------------------------------------------------------------ bet amounts

describe('betting amounts', () => {
  it('a blind chaal pays the stake', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'chaal');
    expect(s.contributed).toEqual([2, 1, 1]);
    expect(s.pot).toBe(4);
    expect(s.stake).toBe(1);
  });

  it('a seen chaal pays twice the stake', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'see', 'chaal');
    expect(s.contributed).toEqual([3, 1, 1]);
    expect(s.pot).toBe(5);
    expect(s.stake).toBe(1);
  });

  it('a blind raise pays 2× the stake and doubles it', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'raise');
    expect(s.contributed).toEqual([3, 1, 1]);
    expect(s.stake).toBe(2);
    expect(s.pot).toBe(5);
  });

  it('a seen raise pays 4× the stake and doubles it', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'see', 'raise');
    expect(s.contributed).toEqual([5, 1, 1]);
    expect(s.stake).toBe(2);
    expect(s.pot).toBe(7);
  });

  it('later players pay at the new stake (blind = stake, seen = 2× stake)', () => {
    let s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'raise'); // stake 2
    s = play(s, 'chaal'); // seat 1 blind: 2
    s = play(s, 'see', 'chaal'); // seat 2 seen: 4
    expect(s.contributed).toEqual([3, 3, 5]);
    expect(s.pot).toBe(11);
  });

  it('the stake doubles 1 → 2 → 4 → 8 and then stops', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'raise', 'raise', 'raise');
    expect(s.history.map((a) => a.stake)).toEqual([2, 4, 8]);
    expect(s.contributed).toEqual([3, 5, 9]);
    expect(engine.checkMove(s, 0, M('raise')).ok).toBe(false);
  });

  it('moveCost reports what each move would cost the player', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'raise'); // stake 2, seat 1 blind
    expect(moveCost(s, 1, M('see'))).toBe(0);
    expect(moveCost(s, 1, M('pack'))).toBe(0);
    expect(moveCost(s, 1, M('chaal'))).toBe(2);
    expect(moveCost(s, 1, M('raise'))).toBe(4);
    const seen = play(s, 'see');
    expect(moveCost(seen, 1, M('chaal'))).toBe(4);
    expect(moveCost(seen, 1, M('raise'))).toBe(8);
  });

  it('keeps the pot equal to the sum of everyone’s contributions and records history', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'see', 'raise', 'chaal', 'pack', 'chaal');
    expect(s.pot).toBe(s.contributed.reduce((a, b) => a + b, 0));
    expect(s.history.map((a) => [a.player, a.type, a.amount, a.blind])).toEqual([
      [0, 'see', 0, true],
      [0, 'raise', 4, false],
      [1, 'chaal', 2, true],
      [2, 'pack', 0, true],
      [0, 'chaal', 4, false],
    ]);
  });
});

// ------------------------------------------------------ pack / last standing

describe('packing and the last player standing', () => {
  it('heads-up: packing hands the pot to the other player', () => {
    const s = play(table([A_HIGH, K_HIGH]), 'pack');
    expect(s.outcome).toEqual({
      kind: 'last-standing',
      winners: [1],
      payouts: [0, 2],
      showdown: [],
      asker: null,
    });
    const r = engine.result(s);
    expect(r.winners).toEqual([1]);
    expect(r.humanOutcome).toBe('loss');
    expect(r.humanNetUnits).toBe(-1);
    expect(r.scores).toEqual([-1, 1]);
    expect(r.flags.folded).toBe(true);
    expect(r.summary).toBe('You packed, so Player 1 won the 2-boot pot.');
  });

  it('the last player left wins the whole pot', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'chaal', 'pack', 'pack');
    expect(s.outcome?.winners).toEqual([0]);
    expect(s.outcome?.payouts).toEqual([4, 0, 0]);
    const r = engine.result(s);
    expect(r.humanOutcome).toBe('win');
    expect(r.humanNetUnits).toBe(2);
    expect(r.summary).toBe('Everyone else packed, so you won the 4-boot pot.');
  });

  it('a packed learner still sees how the bots finish', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'pack', 'chaal', 'pack');
    expect(s.outcome?.winners).toEqual([1]);
    const r = engine.result(s);
    expect(r.humanNetUnits).toBe(-1);
    expect(r.summary).toBe(
      'You packed, and once everyone else had packed too, Player 1 won the 4-boot pot.',
    );
  });
});

// ------------------------------------------------------------------- show

describe('show', () => {
  it('costs a blind chaal for a blind asker and compares hands', () => {
    const s = play(table([A_HIGH, K_HIGH]), 'show');
    expect(s.contributed).toEqual([2, 1]);
    expect(s.outcome).toEqual({
      kind: 'show',
      winners: [0],
      payouts: [3, 0],
      showdown: [0, 1],
      asker: 0,
    });
    expect(engine.result(s).humanNetUnits).toBe(1);
  });

  it('costs a seen chaal (2× stake) for a seen asker', () => {
    const s = play(table([A_HIGH, K_HIGH]), 'see', 'show');
    expect(s.contributed).toEqual([3, 1]);
    expect(s.pot).toBe(4);
  });

  it('the better hand wins even when the other player asked', () => {
    const s = play(table([PAIR_7, A_HIGH]), 'chaal', 'see', 'show');
    expect(s.outcome?.winners).toEqual([0]);
    expect(s.outcome?.asker).toBe(1);
    const r = engine.result(s);
    expect(r.humanNetUnits).toBe(3); // pot 2 + 1 + 2 = 5, put in 2
    expect(r.summary).toBe(
      "Player 1 asked for a show: your Pair of Sevens beat Player 1's High card, Ace, so you won the 5-boot pot.",
    );
  });

  it('equal hands: the player who asked for the show loses', () => {
    const asked = play(table(['AS KD 9C', 'AH KC 9D']), 'show');
    expect(asked.outcome?.winners).toEqual([1]);
    const r = engine.result(asked);
    expect(r.humanOutcome).toBe('loss');
    expect(r.flags.bust).toBe(true);
    expect(r.flags.closeFinish).toBe(true);
    expect(r.summary).toMatch(/exactly equal .* so the asker lost and Player 1 won/);

    const theyAsked = play(table(['AS KD 9C', 'AH KC 9D']), 'chaal', 'show');
    expect(theyAsked.outcome?.winners).toEqual([0]);
    expect(engine.result(theyAsked).humanNetUnits).toBe(2);
  });

  it('is not allowed with three players still in', () => {
    const s = table([A_HIGH, K_HIGH, PAIR_7]);
    expect(engine.checkMove(s, 0, M('show')).ok).toBe(false);
    expect(() => engine.applyMove(s, M('show'))).toThrow(IllegalMoveError);
  });

  it('becomes available after a pack leaves two players', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'pack', 'show');
    expect(s.outcome?.kind).toBe('show');
    expect(s.outcome?.showdown).toEqual([1, 2]);
    expect(s.outcome?.winners).toEqual([2]);
  });
});

// -------------------------------------------------------------- pot limit

describe('pot limit', () => {
  it('caps the bet at 64 boots and shows everyone left (default limit)', () => {
    let s = table([A_HIGH, K_HIGH, PAIR_7]);
    s = play(s, 'see', 'raise', 'see', 'raise', 'see', 'raise'); // pot 31, stake 8
    expect(s.pot).toBe(31);
    expect(engine.checkMove(s, 0, M('raise')).ok).toBe(false);
    s = play(s, 'chaal', 'chaal'); // 47, 63
    expect(s.pot).toBe(63);
    expect(engine.isOver(s)).toBe(false);
    expect(moveCost(s, 2, M('chaal'))).toBe(1);
    s = play(s, 'chaal'); // would be 16, capped to 1
    expect(s.pot).toBe(64);
    expect(s.contributed).toEqual([21, 25, 18]);
    expect(s.history[s.history.length - 1]).toMatchObject({ amount: 1, capped: true, pot: 64 });
    expect(s.outcome).toEqual({
      kind: 'pot-limit',
      winners: [2],
      payouts: [0, 0, 64],
      showdown: [0, 1, 2],
      asker: null,
    });
    const r = engine.result(s);
    expect(r.humanNetUnits).toBe(-21);
    expect(r.scores).toEqual([-21, -25, 46]);
    expect(r.flags.bigPot).toBe(true);
    expect(r.flags.closeFinish).toBe(false);
    expect(r.flags.tags).toContain('pot-limit');
    expect(r.summary).toBe(
      "The pot reached the 64-boot limit, so everyone left showed: Player 2's Pair of Sevens was best and Player 2 won the 64-boot pot.",
    );
  });

  it('a bet that lands exactly on the limit is paid in full and forces the show', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7], { potLimit: 9 }), 'see', 'raise', 'chaal');
    expect(s.pot).toBe(9);
    expect(s.contributed).toEqual([5, 3, 1]);
    expect(s.outcome?.kind).toBe('pot-limit');
    expect(s.outcome?.showdown).toEqual([0, 1, 2]);
  });

  it('a bet that would pass the limit is capped', () => {
    const s = play(
      table([A_HIGH, K_HIGH, PAIR_7], { potLimit: 10 }),
      'see',
      'raise',
      'chaal',
      'chaal',
    );
    expect(s.pot).toBe(10);
    expect(s.contributed).toEqual([5, 3, 2]);
    expect(s.outcome?.winners).toEqual([2]);
  });

  it('packed players are not part of the pot-limit show', () => {
    const s = play(
      table([A_HIGH, PAIR_7, K_HIGH], { potLimit: 6 }),
      'chaal',
      'pack',
      'chaal',
      'chaal',
    );
    expect(s.outcome?.showdown).toEqual([0, 2]);
    expect(s.outcome?.winners).toEqual([0]);
    const r = engine.result(s);
    expect(r.flags.comeback).toBe(true); // Player 1 packed a better hand
    expect(r.flags.tags).not.toContain('bluff-win');
  });

  it('splits the pot between equal best hands; the odd boot goes to the first winner left of the dealer', () => {
    const hands = ['AS KH 9D', 'AH KD 9C', '5C 3D 2H'];
    const s = play(table(hands, { potLimit: 7 }), 'chaal', 'chaal', 'chaal', 'chaal');
    expect(s.pot).toBe(7);
    expect(s.outcome?.winners).toEqual([0, 1]);
    expect(s.outcome?.payouts).toEqual([4, 3, 0]);
    const r = engine.result(s);
    expect(r.humanNetUnits).toBe(1);
    expect(r.flags.tags).toContain('split-pot');
    expect(r.summary).toMatch(
      /you and Player 1 tied with High card, Ace, so the 7-boot pot was split/,
    );

    // Dealer 0: seat 1 is first to the dealer's left and gets the odd boot.
    const t = play(table(hands, { potLimit: 7, dealer: 0 }), 'chaal', 'chaal', 'chaal', 'chaal');
    expect(t.contributed).toEqual([2, 3, 2]);
    expect(t.outcome?.payouts).toEqual([3, 4, 0]);
  });

  it('an exact split of an even pot can be a push', () => {
    const s = play(table(['AS KD 9C', 'AH KC 9D'], { potLimit: 4 }), 'chaal', 'chaal');
    expect(s.outcome?.payouts).toEqual([2, 2]);
    const r = engine.result(s);
    expect(r.humanOutcome).toBe('push');
    expect(r.humanNetUnits).toBe(0);
    expect(r.winners).toEqual([0, 1]);
  });

  it('a show that reaches the limit keeps the show rule (equal hands → asker loses)', () => {
    const s = play(table(['AS KD 9C', 'AH KC 9D'], { potLimit: 4 }), 'chaal', 'show');
    expect(s.pot).toBe(4);
    expect(s.outcome?.kind).toBe('show');
    expect(s.outcome?.winners).toEqual([0]);
    expect(s.outcome?.payouts).toEqual([4, 0]);
  });
});

// ------------------------------------------------------------- checkMove

describe('checkMove reasons', () => {
  const s3 = table([A_HIGH, K_HIGH, PAIR_7]);

  it('explains that it is someone else’s turn', () => {
    const after = play(s3, 'chaal');
    expect(engine.checkMove(after, 0, M('chaal'))).toEqual({
      ok: false,
      reason: "It's Player 1's turn, not yours.",
    });
    expect(engine.checkMove(s3, 2, M('chaal'))).toEqual({
      ok: false,
      reason: "It's your turn, not Player 2's.",
    });
  });

  it('explains when you can look at your cards', () => {
    const after = play(s3, 'chaal');
    expect(engine.checkMove(after, 0, M('see')).reason).toBe(
      "You can look at your cards when it's your turn — right now it's Player 1's turn.",
    );
  });

  it('explains that you have already seen your cards', () => {
    const seen = play(s3, 'see');
    expect(engine.checkMove(seen, 0, M('see')).reason).toBe(
      "You've already seen your cards. Now you can chaal for 2 boots, raise for 4 boots or pack.",
    );
  });

  it('explains the chaal limit', () => {
    const capped = play(s3, 'raise', 'raise', 'raise');
    expect(engine.checkMove(capped, 0, M('raise')).reason).toBe(
      'The stake is already 8 boots — the most it can be (the chaal limit) — so nobody can raise any more. You can still chaal for 8 boots.',
    );
  });

  it('explains when a show is allowed', () => {
    expect(engine.checkMove(s3, 0, M('show')).reason).toBe(
      'You can only ask for a show when just two players are left, and right now 3 players are still in. You can see your cards (free), chaal for 1 boot, raise for 2 boots or pack instead.',
    );
  });

  it('explains that a packed player is out', () => {
    const packed = play(s3, 'pack');
    expect(engine.checkMove(packed, 0, M('chaal')).reason).toBe(
      "You've already packed, so you're out of this hand — sit back and watch how it ends.",
    );
    const botPacked = play(s3, 'chaal', 'pack');
    expect(engine.checkMove(botPacked, 1, M('chaal')).reason).toBe(
      'Player 1 has already packed and is out of this hand.',
    );
  });

  it('explains that the hand is over', () => {
    const over = play(table([A_HIGH, K_HIGH]), 'pack');
    expect(engine.checkMove(over, 1, M('chaal'))).toEqual({
      ok: false,
      reason: 'The hand is over — there are no more moves to make.',
    });
  });

  it('rejects things that are not Teen Patti moves', () => {
    const bogus = { type: 'hit' } as unknown as TeenPattiMove;
    expect(engine.checkMove(s3, 0, bogus).reason).toMatch(/isn't a Teen Patti move/);
    expect(engine.checkMove(s3, 0, null as unknown as TeenPattiMove).ok).toBe(false);
    expect(engine.checkMove(s3, 7, M('chaal')).reason).toBe('There is no seat 7 at this table.');
  });

  it('accepts every move in legalMoves', () => {
    for (let seed = 0; seed < 60; seed++) {
      const s = randomSpot(seed);
      if (!s) continue;
      const p = engine.currentPlayer(s) ?? 0;
      for (const m of engine.legalMoves(s, p)) expect(engine.checkMove(s, p, m).ok).toBe(true);
      for (const t of ['see', 'chaal', 'raise', 'show', 'pack'] as const) {
        const legal = keys(engine.legalMoves(s, p)).includes(t);
        const check = engine.checkMove(s, p, M(t));
        expect(check.ok).toBe(legal);
        if (!legal) expect(check.reason?.length).toBeGreaterThan(20);
      }
    }
  });

  it('applyMove throws IllegalMoveError for every illegal move', () => {
    const seen = play(s3, 'see');
    expect(() => engine.applyMove(seen, M('see'))).toThrow(IllegalMoveError);
    expect(() => engine.applyMove(play(s3, 'raise', 'raise', 'raise'), M('raise'))).toThrow(
      IllegalMoveError,
    );
    expect(() => engine.applyMove(s3, M('show'))).toThrow(IllegalMoveError);
    const over = play(table([A_HIGH, K_HIGH]), 'pack');
    expect(() => engine.applyMove(over, M('chaal'))).toThrow(IllegalMoveError);
    expect(() => engine.applyMove(s3, { type: 'hit' } as unknown as TeenPattiMove)).toThrow(
      IllegalMoveError,
    );
  });
});

// ---------------------------------------------------------- result & flags

describe('result and flags', () => {
  it('result() before the end throws', () => {
    expect(() => engine.result(table([A_HIGH, K_HIGH]))).toThrow();
  });

  it('scores are every seat’s net boots and sum to zero', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'see', 'raise', 'chaal', 'pack', 'show');
    const r = engine.result(s);
    expect(r.scores?.reduce((a, b) => a + b, 0)).toBe(0);
    expect(r.scores?.[0]).toBe(r.humanNetUnits);
  });

  it('folded: the learner packed', () => {
    expect(engine.result(play(table([A_HIGH, K_HIGH]), 'pack')).flags.folded).toBe(true);
    expect(engine.result(play(table([A_HIGH, K_HIGH]), 'show')).flags.folded).toBe(false);
  });

  it('bigPot: won or lost at least 8 boots', () => {
    const small = engine.result(play(table([A_HIGH, K_HIGH]), 'show'));
    expect(small.flags.bigPot).toBe(false);
    // Seen raise (4) + seen chaal (4): 1 + 4 + 4 = 9 boots in; opponent matches.
    const big = play(table([PAIR_7, A_HIGH]), 'see', 'raise', 'see', 'chaal', 'chaal', 'show');
    const r = engine.result(big);
    expect(r.humanNetUnits).toBeGreaterThanOrEqual(8);
    expect(r.flags.bigPot).toBe(true);
  });

  it('closeFinish: a show decided by the high card or a kicker', () => {
    const highCard = engine.result(play(table([A_HIGH, K_HIGH]), 'show'));
    expect(highCard.flags.closeFinish).toBe(true);
    expect(highCard.flags.luckyLastCard).toBe(false);
    const kicker = engine.result(play(table(['7S 7H KD', '7D 7C QS']), 'show'));
    expect(kicker.flags.closeFinish).toBe(true);
    const byCategory = engine.result(play(table([PAIR_7, A_HIGH]), 'show'));
    expect(byCategory.flags.closeFinish).toBe(false);
    const byPairRank = engine.result(play(table(['KS KH 2D', 'QS QH AD']), 'show'));
    expect(byPairRank.flags.closeFinish).toBe(false);
    // Losing a close show counts too.
    const closeLoss = engine.result(play(table([K_HIGH, A_HIGH]), 'show'));
    expect(closeLoss.flags.closeFinish).toBe(true);
    // A learner who packed was not part of the finish.
    const packed = engine.result(play(table([A_HIGH, K_HIGH, '2C 5D 9H']), 'pack', 'show'));
    expect(packed.flags.closeFinish).toBe(false);
  });

  it('luckyLastCard: won a show decided by the very last card', () => {
    const r = engine.result(play(table(['AS KD 9C', 'AH KC 7D']), 'show'));
    expect(r.humanOutcome).toBe('win');
    expect(r.flags.luckyLastCard).toBe(true);
    const lost = engine.result(play(table(['AH KC 7D', 'AS KD 9C']), 'show'));
    expect(lost.flags.luckyLastCard).toBe(false);
  });

  it('perfect: winning with a Trail (tagged "trail")', () => {
    const r = engine.result(play(table(['KS KH KD', 'AS AH QD']), 'see', 'show'));
    expect(r.humanOutcome).toBe('win');
    expect(r.flags.perfect).toBe(true);
    expect(r.flags.tags).toContain('trail');
    const notWon = engine.result(play(table(['KS KH KD', 'AS AH QD']), 'pack'));
    expect(notWon.flags.perfect).toBe(false);
    expect(notWon.flags.tags).toEqual(expect.arrayContaining(['trail', 'packed-best-hand']));
  });

  it('tags a pure sequence', () => {
    const r = engine.result(play(table(['QH KH AH', 'AS AD QD']), 'show'));
    expect(r.flags.tags).toContain('pure-sequence');
    expect(r.flags.tags).toContain('show');
  });

  it('blind-win, bluff-win and comeback: won without seeing while a packed player held better', () => {
    const s = play(table(['2C 4D 7H', 'AS AH KD']), 'raise', 'see', 'pack');
    const r = engine.result(s);
    expect(r.humanOutcome).toBe('win');
    expect(r.humanNetUnits).toBe(1);
    expect(r.flags.comeback).toBe(true);
    expect(r.flags.tags).toEqual(expect.arrayContaining(['blind-win', 'bluff-win']));
  });

  it('no comeback or blind-win when the learner simply had the best hand after seeing', () => {
    const r = engine.result(play(table([PAIR_7, A_HIGH]), 'see', 'chaal', 'pack'));
    expect(r.humanOutcome).toBe('win');
    expect(r.flags.comeback).toBe(false);
    expect(r.flags.tags).not.toContain('blind-win');
    expect(r.flags.tags).not.toContain('bluff-win');
  });

  it('bust: only when the learner asked for the show and lost it', () => {
    expect(engine.result(play(table([K_HIGH, A_HIGH]), 'show')).flags.bust).toBe(true);
    expect(engine.result(play(table([K_HIGH, A_HIGH]), 'chaal', 'show')).flags.bust).toBe(false);
  });

  it('net units never exceed the 64-boot escrow', () => {
    for (let seed = 0; seed < 200; seed++) {
      let s = engine.setup({ players: 2 + (seed % 4) }, createRng(`net-${seed}`));
      const rng = createRng(`net-bots-${seed}`);
      while (!engine.isOver(s)) {
        const p = engine.currentPlayer(s) ?? 0;
        s = engine.applyMove(s, engine.botMove(s, p, 'normal', rng));
      }
      const r = engine.result(s);
      expect(r.humanNetUnits).toBeGreaterThanOrEqual(-MAX_LOSS_UNITS);
      expect(r.humanNetUnits).toBeLessThanOrEqual(MAX_LOSS_UNITS);
    }
  });
});

// ------------------------------------------------------------ describeMove

describe('describeMove', () => {
  const s3 = table([A_HIGH, K_HIGH, PAIR_7]);

  it('uses "You" for seat 0 and "Player N" for the others', () => {
    expect(engine.describeMove(s3, 0, M('chaal'))).toBe('You chaal blind for 1 boot.');
    const s = play(s3, 'chaal');
    expect(engine.describeMove(s, 1, M('chaal'))).toBe('Player 1 chaals blind for 1 boot.');
    expect(engine.describeMove(s, 1, M('pack'))).toBe('Player 1 packs.');
    expect(engine.describeMove(s3, 0, M('raise'))).toBe(
      'You raise blind and put in 2 boots — the stake is now 2 boots.',
    );
    const seen = play(s, 'see');
    expect(engine.describeMove(seen, 1, M('raise'))).toBe(
      'Player 1 raises and puts in 4 boots — the stake is now 2 boots.',
    );
    expect(engine.describeMove(seen, 1, M('chaal'))).toBe('Player 1 chaals for 2 boots.');
    expect(seatName(0)).toBe('You');
    expect(seatName(3)).toBe('Player 3');
  });

  it('never reveals a bot’s cards when it looks at them', () => {
    const s = play(s3, 'chaal');
    const text = engine.describeMove(s, 1, M('see'));
    expect(text).toBe('Player 1 looks at their cards.');
  });

  it('tells the learner their own cards when they look', () => {
    expect(engine.describeMove(s3, 0, M('see'))).toBe(
      'You look at your cards: Ace of Spades, Nine of Diamonds and Four of Clubs — High card, Ace.',
    );
  });

  it('announces how a show ends', () => {
    expect(engine.describeMove(table([A_HIGH, K_HIGH]), 0, M('show'))).toBe(
      "You ask for a show and pay 1 boot. Your High card, Ace beats Player 1's High card, King, so you win the 3-boot pot.",
    );
    const tie = table(['AS KD 9C', 'AH KC 9D']);
    expect(engine.describeMove(tie, 0, M('show'))).toMatch(
      /exactly equal .* the player who asked for the show loses and Player 1 wins the 3-boot pot\.$/,
    );
  });

  it('announces the last player standing', () => {
    expect(engine.describeMove(table([A_HIGH, K_HIGH]), 0, M('pack'))).toBe(
      'You pack. Only Player 1 is left, so Player 1 wins the 2-boot pot.',
    );
    const s = play(s3, 'chaal', 'pack');
    expect(engine.describeMove(s, 2, M('pack'))).toBe(
      'Player 2 packs. Only you are left, so you win the 4-boot pot.',
    );
  });

  it('announces the pot limit', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7], { potLimit: 10 }), 'see', 'raise', 'chaal');
    expect(engine.describeMove(s, 2, M('chaal'))).toBe(
      "Player 2 chaals blind for 1 boot. That brings the pot to the 10-boot limit, so everyone still in shows their cards. Player 2's Pair of Sevens is the best hand, so Player 2 wins the 10-boot pot.",
    );
  });

  it('describes an attempted illegal move with the reason', () => {
    expect(engine.describeMove(s3, 0, M('show'))).toMatch(
      /^Not allowed: You can only ask for a show/,
    );
  });
});

// ------------------------------------------------------------------- coach

describe('coach', () => {
  it('blind on the first round: suggests a cheap blind chaal', () => {
    const advice = engine.coach(table([A_HIGH, K_HIGH, PAIR_7]), 0);
    expect(advice.situation).toMatch(/playing blind/);
    expect(advice.situation).toMatch(/The stake is 1 boot, so a blind chaal costs 1 boot/);
    expect(advice.situation).toMatch(
      /You can see your cards \(free\), chaal for 1 boot, raise for 2 boots or pack\./,
    );
    expect(advice.suggestion).toEqual({ type: 'chaal' });
    expect(advice.why).toMatch(/half price/);
  });

  it('never uses the blind learner’s hidden cards', () => {
    const a = engine.coach(table(['KS KH KD', OPP1, OPP2]), 0);
    const b = engine.coach(table(['5C 3D 2H', OPP1, OPP2]), 0);
    expect(a).toEqual(b);
  });

  it('after a blind round: suggests looking at the cards', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'chaal', 'chaal', 'chaal');
    expect(blindBets(s, 0)).toBe(1);
    expect(engine.coach(s, 0).suggestion).toEqual({ type: 'see' });
  });

  it('with a big stake while blind: suggests seeing first', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7], { dealer: 0 }), 'raise', 'raise');
    expect(s.stake).toBe(4);
    const advice = engine.coach(s, 0);
    expect(advice.suggestion).toEqual({ type: 'see' });
    expect(advice.why).toMatch(/4 boots/);
  });

  it('seen with a Trail: suggests raising', () => {
    const advice = engine.coach(play(table(['KS KH KD', OPP1, OPP2]), 'see'), 0);
    expect(advice.situation).toMatch(/Trail of Kings/);
    expect(advice.suggestion).toEqual({ type: 'raise' });
  });

  it('heads-up with a decent hand against a blind player: suggests a show', () => {
    const advice = engine.coach(play(table(['AS KD 9C', K_HIGH]), 'see'), 0);
    expect(advice.suggestion).toEqual({ type: 'show' });
    expect(advice.why).toMatch(/show/);
  });

  it('a weak hand facing seen raises: suggests packing', () => {
    const s = play(
      table(['TS 7D 2C', K_HIGH, PAIR_7]),
      'chaal',
      'see',
      'raise',
      'see',
      'raise',
      'see',
    );
    expect(engine.currentPlayer(s)).toBe(0);
    const advice = engine.coach(s, 0);
    expect(advice.suggestion).toEqual({ type: 'pack' });
    expect(advice.why).toMatch(/Pack/);
  });

  it('always suggests a legal move on the learner’s turn', () => {
    for (let seed = 0; seed < 120; seed++) {
      const s = randomSpot(seed);
      if (!s) continue;
      const p = engine.currentPlayer(s) ?? 0;
      const advice = engine.coach(s, p);
      expect(keys(engine.legalMoves(s, p))).toContain(
        engine.moveKey(advice.suggestion as TeenPattiMove),
      );
      expect(advice.why?.length).toBeGreaterThan(10);
    }
  });

  it('when it is not your turn, or you packed, or it is over: no suggestion', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'chaal');
    const waiting = engine.coach(s, 0);
    expect(waiting.situation).toMatch(/^It's Player 1's turn\./);
    expect(waiting.suggestion).toBeUndefined();
    const packed = engine.coach(play(table([A_HIGH, K_HIGH, PAIR_7]), 'pack'), 0);
    expect(packed.situation).toMatch(/You've packed/);
    expect(packed.suggestion).toBeUndefined();
    const over = play(table([A_HIGH, K_HIGH]), 'pack');
    expect(engine.coach(over, 0)).toEqual({ situation: engine.result(over).summary });
  });
});

// -------------------------------------------------------------------- bots

describe('bots', () => {
  it('always choose a legal move, including in tricky spots', () => {
    const spots: TeenPattiState[] = [
      // stake at the chaal limit, blind
      play(table([A_HIGH, K_HIGH, PAIR_7]), 'raise', 'raise', 'raise'),
      // heads-up, seen, stake at the limit
      play(table([A_HIGH, K_HIGH]), 'see', 'raise', 'see', 'raise', 'raise'),
      // one boot below the pot limit
      play(table([A_HIGH, K_HIGH, PAIR_7], { potLimit: 10 }), 'see', 'raise', 'chaal'),
      // two left after a pack, blind vs seen
      play(table([A_HIGH, K_HIGH, PAIR_7]), 'see', 'raise', 'pack'),
    ];
    for (let seed = 0; seed < 150; seed++) {
      const s = randomSpot(seed);
      if (s) spots.push(s);
    }
    for (const s of spots) {
      const p = engine.currentPlayer(s) ?? 0;
      const legal = keys(engine.legalMoves(s, p));
      for (let i = 0; i < 30; i++) {
        for (const d of ['easy', 'normal'] as const) {
          expect(legal).toContain(engine.moveKey(engine.botMove(s, p, d, createRng(`b-${i}`))));
        }
      }
    }
  });

  it('refuse to move out of turn', () => {
    const s = table([A_HIGH, K_HIGH, PAIR_7]);
    expect(() => engine.botMove(s, 1, 'normal', createRng(1))).toThrow();
  });

  it('do not peek while blind: the decision ignores their own hidden cards', () => {
    for (let seed = 0; seed < 150; seed++) {
      const s = randomSpot(seed);
      if (!s) continue;
      const p = engine.currentPlayer(s) ?? 0;
      if (s.seen[p]) continue;
      const swapped = s.hands.map((hand, i) => (i === p ? s.stock.slice(0, 3) : hand));
      const t = { ...s, hands: swapped, stock: [...s.stock.slice(3), ...(s.hands[p] ?? [])] };
      for (const d of ['easy', 'normal'] as const) {
        const a = engine.botMove(s, p, d, createRng(`peek-${seed}`));
        const b = engine.botMove(t, p, d, createRng(`peek-${seed}`));
        expect(a).toEqual(b);
      }
    }
  });

  it('never look at opponents’ cards', () => {
    for (let seed = 0; seed < 150; seed++) {
      const s = randomSpot(seed);
      if (!s) continue;
      const p = engine.currentPlayer(s) ?? 0;
      // Give every opponent a Trail of Aces / the stock: the bot must not notice.
      const fresh = shuffle(
        makeDeck().filter((c) => !(s.hands[p] ?? []).includes(c)),
        createRng(`shuffle-${seed}`),
      );
      const hands = s.hands.map((hand, i) => (i === p ? hand : fresh.slice(i * 3, i * 3 + 3)));
      const used = new Set<string>(hands.flat());
      const t = { ...s, hands, stock: makeDeck().filter((c) => !used.has(c)) };
      for (const d of ['easy', 'normal'] as const) {
        const a = engine.botMove(s, p, d, createRng(`opp-${seed}`));
        const b = engine.botMove(t, p, d, createRng(`opp-${seed}`));
        expect(a).toEqual(b);
      }
      expect(engine.coach(s, p)).toEqual(engine.coach(t, p));
    }
  });

  it('easy never packs a pair or better (and so never packs a Trail)', () => {
    for (const hand of ['KS KH KD', 'QH KH AH', '4S 5H 6D', 'AH 9H 4H', '2S 2H 3D']) {
      const s = play(table([hand, OPP1, OPP2], { dealer: 0 }), 'raise', 'raise', 'see');
      for (let i = 0; i < 100; i++) {
        expect(engine.botMove(s, 0, 'easy', createRng(`easy-${i}`)).type).not.toBe('pack');
      }
    }
  });

  it('normal raises a Trail when it can and never packs it', () => {
    const s = play(table(['AS AH AD', K_HIGH, PAIR_7]), 'see');
    for (let i = 0; i < 100; i++) {
      expect(engine.botMove(s, 0, 'normal', createRng(`trail-${i}`)).type).toBe('raise');
    }
    const capped = play(table(['AS AH AD', K_HIGH]), 'see', 'raise', 'raise', 'chaal', 'raise');
    expect(capped.stake).toBe(8);
    expect(engine.currentPlayer(capped)).toBe(0);
    for (let i = 0; i < 50; i++) {
      expect(engine.botMove(capped, 0, 'normal', createRng(`trail-cap-${i}`)).type).not.toBe(
        'pack',
      );
    }
  });

  it('normal packs a weak hand facing seen raises', () => {
    const s = play(
      table(['TS 7D 2C', K_HIGH, PAIR_7]),
      'chaal',
      'see',
      'raise',
      'see',
      'raise',
      'see',
    );
    for (let i = 0; i < 100; i++) {
      expect(engine.botMove(s, 0, 'normal', createRng(`weak-${i}`)).type).toBe('pack');
    }
  });

  it('normal plays blind for a round or two, then sees', () => {
    let saw = 0;
    let firstRoundBlind = 0;
    for (let i = 0; i < 200; i++) {
      const s = table([A_HIGH, K_HIGH, PAIR_7]);
      const first = engine.botMove(s, 0, 'normal', createRng(`blind-${i}`));
      if (first.type === 'chaal' || first.type === 'raise') firstRoundBlind++;
      const third = play(s, 'chaal', 'chaal', 'chaal', 'chaal', 'chaal', 'chaal');
      expect(blindBets(third, 0)).toBe(2);
      if (engine.botMove(third, 0, 'normal', createRng(`blind-${i}`)).type === 'see') saw++;
    }
    expect(firstRoundBlind).toBe(200);
    expect(saw).toBe(200);
  });

  it('reads opponents only from their public betting', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'chaal', 'see', 'raise');
    expect(opponentFloor(s, 0)).toBe(0); // still blind
    expect(opponentFloor(s, 1)).toBeCloseTo(0.45); // seen and raised
    expect(opponentFloor(s, 2)).toBe(0);
    const seen = play(s, 'see');
    const w = winChance(seen, 2);
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThan(1);
  });

  it('decide quickly (well under 30 ms per decision)', () => {
    const states: TeenPattiState[] = [];
    for (let seed = 0; seed < 300; seed++) {
      const s = randomSpot(seed);
      if (s) states.push(s);
    }
    const rng = createRng('speed');
    engine.botMove(
      states[0] as TeenPattiState,
      engine.currentPlayer(states[0] as TeenPattiState) ?? 0,
      'normal',
      rng,
    );
    const t0 = performance.now();
    for (const s of states) engine.botMove(s, engine.currentPlayer(s) ?? 0, 'normal', rng);
    const avg = (performance.now() - t0) / states.length;
    expect(avg).toBeLessThan(3);
  });
});

// ----------------------------------------------------- purity & determinism

describe('purity and determinism', () => {
  it('applyMove never mutates its (deep-frozen) input', () => {
    const cases: [TeenPattiState, TeenPattiMove['type']][] = [
      [table([A_HIGH, K_HIGH, PAIR_7]), 'see'],
      [table([A_HIGH, K_HIGH, PAIR_7]), 'chaal'],
      [table([A_HIGH, K_HIGH, PAIR_7]), 'raise'],
      [table([A_HIGH, K_HIGH, PAIR_7]), 'pack'],
      [table([A_HIGH, K_HIGH]), 'show'],
      [table([A_HIGH, K_HIGH]), 'pack'],
      [play(table([A_HIGH, K_HIGH, PAIR_7], { potLimit: 8 }), 'see', 'raise'), 'chaal'],
    ];
    for (const [state, type] of cases) {
      const before = JSON.stringify(state);
      deepFreeze(state);
      const next = engine.applyMove(state, M(type));
      expect(JSON.stringify(state)).toBe(before);
      expect(next).not.toBe(state);
      // describe / coach / legalMoves / botMove are read-only too.
      const p = engine.currentPlayer(state) ?? 0;
      engine.describeMove(state, p, M(type));
      engine.coach(state, p);
      engine.botMove(state, p, 'normal', createRng(1));
      expect(JSON.stringify(state)).toBe(before);
    }
  });

  it('the same seeds replay the same game', () => {
    const run = (seed: string) => {
      let s = engine.setup({ players: 4 }, createRng(seed));
      const rng = createRng(`${seed}-bots`);
      while (!engine.isOver(s)) {
        const p = engine.currentPlayer(s) ?? 0;
        s = engine.applyMove(s, engine.botMove(s, p, p % 2 ? 'easy' : 'normal', rng));
      }
      return s;
    };
    expect(run('replay')).toEqual(run('replay'));
    expect(run('replay').history).not.toEqual(run('another').history);
  });
});
