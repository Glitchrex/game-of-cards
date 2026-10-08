import { describe, expect, it } from 'vitest';
import { makeDeck, SUITS, type CardCode, type Suit } from '@/games/core/cards';
import { rngFromState, shuffle, type Rng } from '@/games/core/rng';
import { simulate } from '@/games/core/simulate';
import type { Difficulty, GameConfig, GameResult, PlayerId } from '@/games/core/types';
import {
  crazyEightsEngine,
  MAX_RESHUFFLES,
  type CrazyEightsMove,
  type CrazyEightsState,
} from './engine';

const DECK_SORTED = makeDeck().slice().sort().join(',');

// ---------------------------------------------------------------- independent rules
// Deliberately NOT imported from the engine, so the simulation re-derives everything.

const rankOf = (c: string) => c[0];
const suitOf = (c: string) => c[1] as Suit;
const isEight = (c: string) => rankOf(c) === '8';
const value = (c: string): number => {
  const r = rankOf(c);
  if (r === '8') return 50;
  if (r === 'T' || r === 'J' || r === 'Q' || r === 'K') return 10;
  if (r === 'A') return 1;
  return Number(r);
};
const total = (cards: readonly string[]) => cards.reduce((a, c) => a + value(c), 0);
const fits = (card: string, top: string, suit: Suit) =>
  isEight(card) || suitOf(card) === suit || (!isEight(top) && rankOf(card) === rankOf(top));
const dealtSize = (players: number) => (players === 2 ? 7 : 5);
/** Display order of a hand: by suit (♠ ♥ ♣ ♦), then rank with the Ace low. */
const byDisplayOrder = (a: string, b: string) =>
  'SHCD'.indexOf(a[1]!) - 'SHCD'.indexOf(b[1]!) ||
  'A23456789TJQK'.indexOf(a[0]!) - 'A23456789TJQK'.indexOf(b[0]!);

/** Every card is in exactly one place at every step. */
function checkConservation(s: CrazyEightsState): void {
  const all = [...s.hands.flat(), ...s.stock, ...s.discard];
  if (all.length !== 52 || [...all].sort().join(',') !== DECK_SORTED) {
    throw new Error(`card conservation broken (${all.length} cards)`);
  }
}

/** The bookkeeping fields agree with the public history. */
function checkStructure(s: CrazyEightsState, firstPlayer: PlayerId): void {
  const top = s.discard[s.discard.length - 1];
  if (!top) throw new Error('empty discard pile');
  const plays = s.log.filter((e) => e.type === 'play');
  const lastPlay = plays[plays.length - 1];
  if (lastPlay) {
    if (lastPlay.card !== top) throw new Error('top card is not the last card played');
    if (lastPlay.suit !== s.activeSuit) throw new Error('active suit differs from the last play');
    if (!isEight(top) && s.activeSuit !== suitOf(top)) throw new Error('suit changed without an 8');
  } else if (top !== s.starter || s.activeSuit !== suitOf(top)) {
    throw new Error('pile does not start with the starter');
  }
  if (isEight(s.starter)) throw new Error('an Eight was left as the starter');
  for (const e of s.buried) if (!isEight(e)) throw new Error('buried a non-Eight');
  s.hands.forEach((h, seat) => {
    const played = plays.filter((e) => e.seat === seat).length;
    const drawn = s.log.filter((e) => e.type === 'draw' && e.seat === seat).length;
    if (s.draws[seat] !== drawn) throw new Error(`draw count of seat ${seat} is wrong`);
    if (h.length !== dealtSize(s.players) + drawn - played) {
      throw new Error(`seat ${seat} holds ${h.length} cards, history says otherwise`);
    }
  });
  const reshuffles = s.log.filter((e) => e.type === 'draw' && e.reshuffled).length;
  if (reshuffles !== s.reshuffles || reshuffles > MAX_RESHUFFLES) {
    throw new Error(`reshuffle count ${s.reshuffles} vs history ${reshuffles}`);
  }
  if (!s.reshuffle && reshuffles > 0) throw new Error('reshuffled without the house rule');
  const over = s.phase === 'over';
  if (over !== (s.endReason !== null) || over !== s.winners.length > 0) {
    throw new Error('phase, endReason and winners disagree');
  }
  if (over) return;
  // Whose turn: same seat after a draw, the next seat after a play or a pass.
  const last = s.log[s.log.length - 1];
  const expected = !last
    ? firstPlayer
    : last.type === 'draw'
      ? last.seat
      : (last.seat + 1) % s.players;
  if (s.turn !== expected) throw new Error(`turn is ${s.turn}, expected ${expected}`);
  let trailing = 0;
  for (let i = s.log.length - 1; i >= 0; i--) {
    const e = s.log[i]!;
    if (e.type !== 'draw' || e.seat !== s.turn) break;
    trailing++;
  }
  if (s.drawnThisTurn !== trailing) throw new Error('drawnThisTurn is wrong');
  // An unfinished game is never secretly blocked.
  const drawable =
    s.stock.length > 0 || (s.reshuffle && s.discard.length > 1 && s.reshuffles < MAX_RESHUFFLES);
  if (!drawable && !s.hands.some((h) => h.some((c) => fits(c, top, s.activeSuit)))) {
    throw new Error('the game is blocked but not over');
  }
  if (s.hands.some((h) => h.length === 0)) throw new Error('someone is out but the game goes on');
}

/** How a seat chooses its moves: a bot level, or uniformly random legal moves (a chaotic learner). */
type Policy = Difficulty | 'random';

interface Replay {
  /** Max (learner's cards − fewest opponent cards) over the whole game. */
  maxBehind: number;
  /** Draws made while holding a playable card (only a 'random' seat does this). */
  voluntaryDraws: number;
}

/**
 * Replay the move history from the initial deal with an independent rules model: every
 * play matched (or was an Eight with a named suit), every draw took the top of the stock
 * (reshuffling only under the house rule), every pass was forced — and the bots followed
 * their documented policies (a 'random' seat may draw by choice). Returns facts used to
 * re-derive the result flags.
 */
function replay(
  initial: CrazyEightsState,
  final: CrazyEightsState,
  policy: (seat: PlayerId) => Policy,
): Replay {
  const hands = initial.hands.map((h) => h.slice().sort(byDisplayOrder));
  let stock = initial.stock.slice();
  let discard = initial.discard.slice();
  let suit = initial.activeSuit;
  let turn = initial.turn;
  let rngState = initial.rngState;
  let reshuffles = 0;
  const behind = () => hands[0]!.length - Math.min(...hands.slice(1).map((h) => h.length));
  let maxBehind = behind();
  let voluntaryDraws = 0;
  for (const [i, e] of final.log.entries()) {
    const at = `event ${i} (${e.type} by seat ${e.seat})`;
    if (e.seat !== turn) throw new Error(`${at}: out of turn`);
    if (hands.some((h) => h.length === 0)) throw new Error(`${at}: game should have ended`);
    const hand = hands[e.seat]!;
    const top = discard[discard.length - 1]!;
    const playable = hand.filter((c) => fits(c, top, suit));
    const canRefill = final.reshuffle && discard.length > 1 && reshuffles < MAX_RESHUFFLES;
    if (e.type === 'play') {
      if (!hand.includes(e.card)) throw new Error(`${at}: card not in hand`);
      if (!fits(e.card, top, suit)) throw new Error(`${at}: ${e.card} does not match ${top}`);
      if (!isEight(e.card) && e.suit !== suitOf(e.card)) throw new Error(`${at}: bad suit`);
      if (!SUITS.includes(e.suit)) throw new Error(`${at}: no suit named`);
      if (policy(e.seat) === 'easy' && e.card !== playable[0]) {
        throw new Error(`${at}: easy bot did not play its first playable card`);
      }
      if (policy(e.seat) === 'normal' && isEight(e.card) && playable.some((c) => !isEight(c))) {
        throw new Error(`${at}: normal bot wasted an Eight while another card matched`);
      }
      hands[e.seat] = hand.filter((c) => c !== e.card);
      discard.push(e.card);
      suit = e.suit;
      turn = (turn + 1) % final.players;
    } else if (e.type === 'draw') {
      // Both bot levels draw only when nothing in hand can be played.
      if (playable.length > 0) {
        if (policy(e.seat) !== 'random') throw new Error(`${at}: bot drew while it could play`);
        voluntaryDraws++;
      }
      if (e.facing !== suit) throw new Error(`${at}: wrong "facing" suit`);
      if (stock.length === 0) {
        if (!canRefill) throw new Error(`${at}: drew from an empty stock`);
        if (!e.reshuffled) throw new Error(`${at}: reshuffle not recorded`);
        const rng = rngFromState(rngState);
        stock = shuffle(discard.slice(0, -1), rng);
        rngState = rng.getState();
        discard = [top];
        reshuffles++;
      } else if (e.reshuffled) {
        throw new Error(`${at}: reshuffled with cards still in the stock`);
      }
      if (stock[0] !== e.card) throw new Error(`${at}: did not draw the top card of the stock`);
      hand.push(stock.shift()!);
      hand.sort(byDisplayOrder);
    } else {
      if (playable.length > 0) throw new Error(`${at}: passed while holding a playable card`);
      if (stock.length > 0 || canRefill) throw new Error(`${at}: passed while able to draw`);
      turn = (turn + 1) % final.players;
    }
    maxBehind = Math.max(maxBehind, behind());
  }
  // The model ends up exactly where the engine did.
  const sorted = (cards: readonly CardCode[]) => [...cards].sort().join(',');
  hands.forEach((h, seat) => {
    if (sorted(h) !== sorted(final.hands[seat]!)) throw new Error(`seat ${seat} hand differs`);
  });
  if (stock.join() !== final.stock.join()) throw new Error('stock differs after replay');
  if (discard.join() !== final.discard.join()) throw new Error('discard differs after replay');
  if (rngState !== final.rngState) throw new Error('rng state differs after replay');
  return { maxBehind, voluntaryDraws };
}

/** Re-derive the winner(s), payout and flags from the final state alone. */
function checkResult(s: CrazyEightsState, r: GameResult, facts: Replay): void {
  const n = s.players;
  const totals = s.hands.map(total);
  const outSeat = s.hands.findIndex((h) => h.length === 0);
  let winners: number[];
  if (outSeat >= 0) {
    expect(s.endReason).toBe('out');
    const last = s.log[s.log.length - 1]!;
    expect(last.type === 'play' && last.seat === outSeat).toBe(true);
    winners = [outSeat];
  } else {
    expect(s.endReason).toBe('blocked');
    const top = s.discard[s.discard.length - 1]!;
    expect(s.stock).toHaveLength(0);
    if (s.reshuffle) expect(s.discard.length <= 1 || s.reshuffles >= MAX_RESHUFFLES).toBe(true);
    for (const h of s.hands) expect(h.some((c) => fits(c, top, s.activeSuit))).toBe(false);
    const best = Math.min(...totals);
    winners = totals.flatMap((t, seat) => (t === best ? [seat] : []));
  }
  const payout = (seat: number) =>
    winners.length === n ? 0 : winners.includes(seat) ? (n - winners.length) / winners.length : -1;
  const net = payout(0);
  expect(r.winners).toEqual(winners);
  expect(r.scores).toEqual(totals);
  expect(r.humanNetUnits).toBeCloseTo(net, 12);
  expect(r.humanOutcome).toBe(net > 0 ? 'win' : net < 0 ? 'loss' : 'push');
  // Pot conservation: zero-sum across the table; payout within [−maxLoss, +max win].
  let sum = 0;
  for (let seat = 0; seat < n; seat++) sum += payout(seat);
  expect(sum).toBeCloseTo(0, 12);
  expect(r.humanNetUnits).toBeGreaterThanOrEqual(-1);
  expect(r.humanNetUnits).toBeLessThanOrEqual(n - 1);
  // Flags agree with what actually happened.
  const won = net > 0;
  const learnerDraws = s.log.filter((e) => e.type === 'draw' && e.seat === 0).length;
  const last = s.log[s.log.length - 1];
  const eightFinish =
    outSeat === 0 && last?.type === 'play' && last.seat === 0 && isEight(last.card);
  let close: boolean;
  if (outSeat >= 0) {
    close = won
      ? s.hands.some((h, seat) => seat !== 0 && h.length === 1)
      : s.hands[0]!.length === 1;
  } else if (winners.includes(0)) {
    const rivals = totals.filter((_, seat) => !winners.includes(seat));
    close = winners.length > 1 || Math.min(...rivals) - totals[0]! <= 3;
  } else {
    close = totals[0]! - Math.min(...totals) <= 3;
  }
  expect(r.flags.perfect).toBe(won && learnerDraws === 0);
  expect(r.flags.luckyLastCard).toBe(won && eightFinish);
  expect(r.flags.comeback).toBe(won && facts.maxBehind >= 3);
  expect(s.maxBehind).toBe(facts.maxBehind);
  expect(r.flags.bigPot).toBe(Math.abs(net) >= 3);
  expect(r.flags.closeFinish).toBe(close);
  expect(r.flags.bust).toBe(false);
  expect(r.flags.folded).toBe(false);
  expect(r.flags.tags?.includes(outSeat >= 0 ? 'wentOut' : 'blocked')).toBe(true);
  expect(r.summary.length).toBeGreaterThan(30);
}

interface Batch {
  name: string;
  games: number;
  seedBase: number;
  config: (seed: number) => GameConfig;
  difficulty: (seat: PlayerId) => Difficulty;
  /** Also check the coach and checkMove/legalMoves consistency at every step. */
  deep?: boolean;
  /**
   * Seat 0 ignores its difficulty and plays random legal moves, drawing by choice half the
   * time it may — the bots never draw while they can play, so this covers voluntary draws,
   * hoarded stocks and many more reshuffles.
   */
  randomLearner?: boolean;
}

const BATCHES: Batch[] = [
  {
    name: '3 players, standard rules, normal on even seats',
    games: 300,
    seedBase: 1,
    config: () => ({ players: 3 }),
    difficulty: (s) => (s % 2 === 0 ? 'normal' : 'easy'),
  },
  {
    name: '2 players, reshuffle on odd seeds, all normal',
    games: 250,
    seedBase: 10_001,
    config: (seed) => ({ players: 2, options: { reshuffle: seed % 2 === 1 } }),
    difficulty: () => 'normal',
  },
  {
    name: '4 players, rotating first player, all easy',
    games: 250,
    seedBase: 20_001,
    config: (seed) => ({ players: 4, options: { firstPlayer: seed % 4 } }),
    difficulty: () => 'easy',
  },
  {
    name: '2–4 players, mixed options, easy learner vs normal bots (coach checked)',
    games: 250,
    seedBase: 30_001,
    config: (seed) => {
      const players = 2 + (seed % 3);
      return {
        players,
        options: { reshuffle: seed % 3 === 0, firstPlayer: Math.floor(seed / 3) % players },
      };
    },
    difficulty: (s) => (s === 0 ? 'easy' : 'normal'),
    deep: true,
  },
  {
    name: '2–4 players, reshuffle on even seeds, random learner who draws by choice vs normal bots',
    games: 200,
    seedBase: 40_001,
    config: (seed) => ({ players: 2 + (seed % 3), options: { reshuffle: seed % 2 === 0 } }),
    difficulty: () => 'normal',
    deep: true,
    randomLearner: true,
  },
];

/** Coach suggestions are legal, and checkMove agrees with legalMoves for every hand card. */
function checkCoachAndChecks(s: CrazyEightsState): void {
  if (s.phase === 'over') return;
  const p = s.turn;
  const legal = crazyEightsEngine.legalMoves(s, p);
  const legalKeys = new Set(legal.map((m) => crazyEightsEngine.moveKey(m)));
  const advice = crazyEightsEngine.coach(s, p);
  const suggestion = advice.suggestion as CrazyEightsMove | undefined;
  if (!suggestion || !legalKeys.has(crazyEightsEngine.moveKey(suggestion))) {
    throw new Error('coach suggested an illegal move');
  }
  const attempts: CrazyEightsMove[] = [{ type: 'draw' }, { type: 'pass' }];
  for (const card of s.hands[p]!) {
    if (isEight(card)) for (const suit of SUITS) attempts.push({ type: 'play', card, suit });
    else attempts.push({ type: 'play', card });
  }
  for (const m of attempts) {
    const check = crazyEightsEngine.checkMove(s, p, m);
    if (check.ok !== legalKeys.has(crazyEightsEngine.moveKey(m))) {
      throw new Error(`checkMove and legalMoves disagree on ${crazyEightsEngine.moveKey(m)}`);
    }
    if (!check.ok && (check.reason ?? '').length < 20) throw new Error('reason too short');
  }
  // Other seats get nothing and are told whose turn it is.
  const other = (p + 1) % s.players;
  if (crazyEightsEngine.legalMoves(s, other).length !== 0) throw new Error('moves out of turn');
}

describe('crazy eights simulation', () => {
  it(`plays ${BATCHES.reduce((a, b) => a + b.games, 0)} bot games without breaking any rule`, () => {
    let games = 0;
    let moves = 0;
    let blocked = 0;
    let reshuffled = 0;
    let eightFinishes = 0;
    let comebacks = 0;
    let buried = 0;
    let voluntaryDraws = 0;
    const outcomes = { win: 0, loss: 0, push: 0 };
    for (const batch of BATCHES) {
      let initial: CrazyEightsState | null = null;
      let firstPlayer = 0;
      const policy = (seat: PlayerId): Policy =>
        batch.randomLearner && seat === 0 ? 'random' : batch.difficulty(seat);
      const recording: typeof crazyEightsEngine = {
        ...crazyEightsEngine,
        setup(config: GameConfig, rng: Rng) {
          initial = crazyEightsEngine.setup(config, rng);
          firstPlayer = initial.turn;
          checkConservation(initial);
          checkStructure(initial, firstPlayer);
          return initial;
        },
        botMove(state, player, difficulty, rng) {
          if (policy(player) !== 'random') {
            return crazyEightsEngine.botMove(state, player, difficulty, rng);
          }
          const legal = crazyEightsEngine.legalMoves(state, player);
          const draw = legal.find((m) => m.type === 'draw');
          return draw && rng.next() < 0.5 ? draw : rng.pick(legal);
        },
      };
      const summary = simulate(recording, {
        games: batch.games,
        seedBase: batch.seedBase,
        config: batch.config,
        difficulty: batch.difficulty,
        maxMoves: 700,
        invariant: (s) => {
          checkConservation(s);
          checkStructure(s, firstPlayer);
          if (batch.deep) checkCoachAndChecks(s);
        },
        onGameEnd: (s, r) => {
          if (!initial) throw new Error('setup was not recorded');
          const facts = replay(initial, s, policy);
          checkResult(s, r, facts);
          if (s.endReason === 'blocked') blocked++;
          if (s.reshuffles > 0) reshuffled++;
          if (r.flags.tags?.includes('eightFinish')) eightFinishes++;
          if (r.flags.comeback) comebacks++;
          buried += s.buried.length;
          voluntaryDraws += facts.voluntaryDraws;
        },
      });
      expect(summary.games).toBe(batch.games);
      expect(summary.maxMovesInAGame).toBeLessThan(600);
      games += summary.games;
      moves += summary.totalMoves;
      outcomes.win += summary.outcomes.win;
      outcomes.loss += summary.outcomes.loss;
      outcomes.push += summary.outcomes.push;
    }
    expect(games).toBeGreaterThanOrEqual(1000);
    // The interesting endings all actually occur.
    expect(blocked).toBeGreaterThan(0);
    expect(reshuffled).toBeGreaterThan(0);
    expect(eightFinishes).toBeGreaterThan(0);
    expect(comebacks).toBeGreaterThan(0);
    expect(buried).toBeGreaterThan(0);
    expect(voluntaryDraws).toBeGreaterThan(0);
    expect(outcomes.win).toBeGreaterThan(0);
    expect(outcomes.loss).toBeGreaterThan(0);
    console.info(
      `crazy-eights sim: ${games} games, avg ${(moves / games).toFixed(1)} moves, ` +
        `outcomes ${JSON.stringify(outcomes)}, blocked ${blocked}, reshuffled ${reshuffled}, ` +
        `eight finishes ${eightFinishes}, comebacks ${comebacks}, buried starters ${buried}, ` +
        `voluntary draws ${voluntaryDraws}`,
    );
  }, 60_000);

  it('normal bots beat easy bots over many heads-up games', () => {
    const run = (difficulty: (seat: PlayerId) => Difficulty) =>
      simulate(crazyEightsEngine, {
        games: 400,
        seedBase: 50_001,
        config: (seed) => ({ players: 2, options: { firstPlayer: seed % 2 } }),
        difficulty,
        freezeEvery: 0,
      }).outcomes.win;
    const normalLearner = run((s) => (s === 0 ? 'normal' : 'easy'));
    const easyLearner = run((s) => (s === 0 ? 'easy' : 'normal'));
    expect(normalLearner).toBeGreaterThan(easyLearner);
  }, 30_000);
});
