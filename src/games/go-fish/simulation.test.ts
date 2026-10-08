import { describe, expect, it } from 'vitest';
import { makeDeck, RANKS, type Rank } from '@/games/core/cards';
import type { Rng } from '@/games/core/rng';
import { simulate } from '@/games/core/simulate';
import type { Difficulty, GameConfig, GameResult, PlayerId } from '@/games/core/types';
import {
  goFishEngine,
  type GoFishBookSource,
  type GoFishEvent,
  type GoFishMove,
  type GoFishState,
} from './engine';
import { holdChance, seatView } from './strategy';

const DECK_SORTED = makeDeck().slice().sort().join(',');

// ---------------------------------------------------------------- independent rules
// Deliberately NOT imported from the engine, so the simulation re-derives everything.

const rankOf = (c: string) => c[0] as Rank;
const dealtSize = (players: number) => (players <= 3 ? 7 : 5);
const count = (hand: readonly string[], rank: string) => hand.filter((c) => c[0] === rank).length;
const suitsOf = (rank: string) => ['S', 'H', 'D', 'C'].map((s) => `${rank}${s}`);
/** Display order of a hand: by rank (Ace low), then suit ♠ ♥ ♣ ♦. */
const byDisplayOrder = (a: string, b: string) =>
  'A23456789TJQK'.indexOf(a[0]!) - 'A23456789TJQK'.indexOf(b[0]!) ||
  'SHCD'.indexOf(a[1]!) - 'SHCD'.indexOf(b[1]!);
const sorted = (cards: readonly string[]) => [...cards].sort().join(',');

/** Every card is in exactly one place at every step. */
function checkConservation(s: GoFishState): void {
  const all = [...s.hands.flat(), ...s.stock, ...s.books.flat().flatMap((b) => suitsOf(b.rank))];
  if (all.length !== 52 || sorted(all) !== DECK_SORTED) {
    throw new Error(`card conservation broken (${all.length} cards)`);
  }
}

/** The bookkeeping agrees with the rules at every step. */
function checkStructure(s: GoFishState): void {
  const bookRanks = s.books.flat().map((b) => b.rank);
  if (new Set(bookRanks).size !== bookRanks.length) throw new Error('a rank was booked twice');
  s.hands.forEach((h, seat) => {
    for (const r of RANKS) {
      if (count(h, r) >= 4) throw new Error(`seat ${seat} sits on an unlaid book of ${r}`);
    }
    if (h.join() !== [...h].sort(byDisplayOrder).join()) throw new Error('hand not sorted');
  });
  const over = s.phase === 'over';
  if (over !== (bookRanks.length === 13)) throw new Error('over iff all 13 books are made');
  if (over !== s.winners.length > 0) throw new Error('winners set iff the game is over');
  if (over) {
    if (s.stock.length > 0 || s.hands.some((h) => h.length > 0)) throw new Error('cards left');
    return;
  }
  // An empty hand is refilled at once while the pond lasts.
  if (s.stock.length > 0 && s.hands.some((h) => h.length === 0)) {
    throw new Error('an empty hand was not refilled from the pond');
  }
  if ((s.hands[s.turn] ?? []).length === 0) throw new Error('the player to act has no cards');
  if (!s.hands.some((h, seat) => seat !== s.turn && h.length > 0)) {
    throw new Error('the player to act has nobody to ask');
  }
  const mine = s.books[0]!.length;
  const best = Math.max(...s.books.slice(1).map((b) => b.length));
  if (s.maxBehind < best - mine) throw new Error('maxBehind is behind the times');
}

interface Replay {
  /** Max (most books held by an opponent − the learner's books) over the whole game. */
  maxBehind: number;
  /** How each of the learner's books was completed, in order. */
  learnerBooks: GoFishBookSource[];
}

/**
 * Replay the history from the initial deal with an independent rules model: every ask was
 * by the player to act, for a rank they held, of another player with cards; the target
 * handed over exactly the cards of that rank they held; every Go Fish drew the top of the
 * pond; books were laid down exactly when four were held; empty hands were refilled in
 * the documented order (target, then asker) or went out; and the turn moved correctly.
 */
function replay(initial: GoFishState, final: GoFishState): Replay {
  const n = final.players;
  const hands = initial.hands.map((h) => h.slice());
  const stock = initial.stock.slice();
  const books: { rank: Rank; via: GoFishBookSource }[][] = initial.books.map((b) => b.slice());
  const learnerBooks: GoFishBookSource[] = books[0]!.map((b) => b.via);
  let turn = initial.turn;
  const behind = () => Math.max(...books.slice(1).map((b) => b.length)) - books[0]!.length;
  let maxBehind = Math.max(0, behind());
  const events = final.log.slice(initial.log.length);
  let i = 0;
  const take = (): GoFishEvent | undefined => events[i++];
  const expectEvent = (want: GoFishEvent, at: string) => {
    const got = take();
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      throw new Error(`${at}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    }
  };
  const bookIfFour = (seat: PlayerId, rank: Rank, via: GoFishBookSource, at: string) => {
    if (count(hands[seat]!, rank) < 4) return;
    hands[seat] = hands[seat]!.filter((c) => rankOf(c) !== rank);
    books[seat]!.push({ rank, via });
    if (seat === 0) learnerBooks.push(via);
    expectEvent({ type: 'book', seat, rank, via }, at);
  };
  const refill = (seat: PlayerId, at: string) => {
    if (hands[seat]!.length > 0) return;
    const card = stock.shift();
    if (card === undefined) expectEvent({ type: 'out', seat }, at);
    else {
      hands[seat] = [card];
      expectEvent({ type: 'refill', seat, card }, at);
    }
  };
  while (i < events.length) {
    const e = take()!;
    const at = `event ${i - 1}`;
    if (e.type !== 'ask') throw new Error(`${at}: a move must start with an ask, got ${e.type}`);
    const { seat, target, rank } = e;
    if (seat !== turn) throw new Error(`${at}: seat ${seat} asked out of turn (turn ${turn})`);
    if (target === seat || target < 0 || target >= n) throw new Error(`${at}: bad target`);
    if (count(hands[seat]!, rank) === 0) throw new Error(`${at}: asked for a rank not held`);
    if (hands[target]!.length === 0) throw new Error(`${at}: asked a player with no cards`);
    const given = hands[target]!.filter((c) => rankOf(c) === rank);
    if (e.got !== given.length) throw new Error(`${at}: got ${e.got}, target held ${given.length}`);
    let again: boolean;
    if (given.length > 0) {
      hands[target] = hands[target]!.filter((c) => rankOf(c) !== rank);
      hands[seat]!.push(...given);
      bookIfFour(seat, rank, 'catch', at);
      again = true;
    } else {
      const card = stock.shift();
      if (card === undefined) again = false;
      else {
        const wish = rankOf(card) === rank;
        expectEvent({ type: 'fish', seat, card, wish }, at);
        hands[seat]!.push(card);
        bookIfFour(seat, rankOf(card), wish ? 'wish' : 'fish', at);
        again = wish;
      }
    }
    maxBehind = Math.max(maxBehind, behind());
    if (books.flat().length === 13) {
      if (i !== events.length) throw new Error(`${at}: events after the last book`);
      break;
    }
    refill(target, at);
    refill(seat, at);
    if (!(again && hands[seat]!.length > 0)) {
      let next = seat;
      do next = (next + 1) % n;
      while (hands[next]!.length === 0 && next !== seat);
      turn = next;
    }
  }
  // The model ends up exactly where the engine did.
  hands.forEach((h, seat) => {
    if (sorted(h) !== sorted(final.hands[seat]!)) throw new Error(`seat ${seat} hand differs`);
  });
  if (stock.join() !== final.stock.join()) throw new Error('pond differs after replay');
  if (JSON.stringify(books) !== JSON.stringify(final.books)) throw new Error('books differ');
  if (final.phase !== 'over' && turn !== final.turn) throw new Error('turn differs');
  return { maxBehind, learnerBooks };
}

/** Re-derive the winners, payout and flags from the final state and the replay alone. */
function checkResult(s: GoFishState, r: GameResult, facts: Replay): void {
  const n = s.players;
  const counts = s.books.map((b) => b.length);
  expect(counts.reduce((a, b) => a + b, 0)).toBe(13);
  const best = Math.max(...counts);
  const winners = counts.flatMap((c, seat) => (c === best ? [seat] : []));
  const payout = (seat: number) =>
    winners.length === n ? 0 : winners.includes(seat) ? (n - winners.length) / winners.length : -1;
  const net = payout(0);
  expect(r.winners).toEqual(winners);
  expect(r.scores).toEqual(counts);
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
  const mine = counts[0]!;
  const rival = Math.max(...counts.slice(1));
  const finalWish = facts.learnerBooks.at(-1) === 'wish';
  // The wished final book decided the game: without it you would not have won outright.
  const decisive = mine - 1 <= rival;
  // A landslide: more books than all opponents together; heads-up, twice the opponent's.
  const landslide = n === 2 ? mine >= 2 * (13 - mine) : mine > 13 - mine;
  expect(s.books[0]!.map((b) => b.via)).toEqual(facts.learnerBooks);
  expect(s.maxBehind).toBe(facts.maxBehind);
  expect(r.flags.comeback).toBe(won && facts.maxBehind >= 3);
  expect(r.flags.closeFinish).toBe(Math.abs(mine - rival) === 1);
  expect(r.flags.luckyLastCard).toBe(won && finalWish && decisive);
  expect(r.flags.perfect).toBe(landslide);
  if (mine >= 7) expect(winners).toEqual([0]);
  expect(r.flags.bigPot).toBe(Math.abs(net) >= 3);
  expect(r.flags.bust).toBe(false);
  expect(r.flags.folded).toBe(false);
  expect(r.flags.tags?.includes('sharedWin')).toBe(won && winners.length > 1);
  expect(r.flags.tags?.includes('noBooks')).toBe(mine === 0);
  expect(r.summary.length).toBeGreaterThan(30);
}

/** Coach suggestions are legal, checkMove agrees with legalMoves, the memory is sound. */
function deepChecks(s: GoFishState): void {
  if (s.phase === 'over') return;
  const p = s.turn;
  const legal = goFishEngine.legalMoves(s, p);
  const legalKeys = new Set(legal.map((m) => goFishEngine.moveKey(m)));
  const advice = goFishEngine.coach(s, p);
  const suggestion = advice.suggestion as GoFishMove | undefined;
  if (!suggestion || !legalKeys.has(goFishEngine.moveKey(suggestion))) {
    throw new Error('coach suggested an illegal move');
  }
  if ((advice.why ?? '').length < 40 || advice.situation.length < 40) {
    throw new Error('coach text is too thin');
  }
  for (let target = 0; target < s.players; target++) {
    for (const rank of RANKS) {
      const m: GoFishMove = { type: 'ask', target, rank };
      const check = goFishEngine.checkMove(s, p, m);
      if (check.ok !== legalKeys.has(goFishEngine.moveKey(m))) {
        throw new Error(`checkMove and legalMoves disagree on ${goFishEngine.moveKey(m)}`);
      }
      if (!check.ok && (check.reason ?? '').length < 30) throw new Error('reason too short');
    }
  }
  for (let other = 0; other < s.players; other++) {
    if (other === p) continue;
    if (goFishEngine.legalMoves(s, other).length !== 0) throw new Error('moves out of turn');
    const m = legal[0]!;
    if (!/turn/.test(goFishEngine.checkMove(s, other, m).reason ?? '')) {
      throw new Error('out-of-turn reason does not mention the turn');
    }
  }
  // The public memory never claims more than the truth, for any seat.
  for (let viewer = 0; viewer < s.players; viewer++) {
    const view = seatView(s, viewer);
    for (let seat = 0; seat < s.players; seat++) {
      if (seat === viewer) continue;
      for (const rank of RANKS) {
        const r = RANKS.indexOf(rank);
        const actual = count(s.hands[seat]!, rank);
        const known = view.known[seat]![r]!;
        const room = Math.min(view.maybe[seat]![r]!, view.unknown[seat]!);
        if (known > actual || actual > known + room) {
          throw new Error(`memory of seat ${viewer} about seat ${seat}/${rank} is unsound`);
        }
        const chance = holdChance(view, seat, rank);
        if (chance >= 1 && actual === 0) throw new Error('claimed a sure catch that misses');
        if (chance <= 0 && actual > 0) throw new Error('ruled out a rank that is there');
      }
    }
  }
}

interface Batch {
  name: string;
  games: number;
  seedBase: number;
  config: (seed: number) => GameConfig;
  difficulty: (seat: PlayerId) => Difficulty;
  /** Also check the coach, checkMove/legalMoves consistency and memory at every step. */
  deep?: boolean;
}

const BATCHES: Batch[] = [
  {
    name: '3 players (default), normal on even seats',
    games: 300,
    seedBase: 1,
    config: () => ({ players: 3 }),
    difficulty: (s) => (s % 2 === 0 ? 'normal' : 'easy'),
  },
  {
    name: '2 players, alternating first player, all normal',
    games: 250,
    seedBase: 10_001,
    config: (seed) => ({ players: 2, options: { firstPlayer: seed % 2 } }),
    difficulty: () => 'normal',
  },
  {
    name: '4 players, rotating first player, all easy',
    games: 200,
    seedBase: 20_001,
    config: (seed) => ({ players: 4, options: { firstPlayer: seed % 4 } }),
    difficulty: () => 'easy',
  },
  {
    name: '5 players, normal on odd seats',
    games: 200,
    seedBase: 30_001,
    config: () => ({ players: 5 }),
    difficulty: (s) => (s % 2 === 1 ? 'normal' : 'easy'),
  },
  {
    name: '2–5 players, easy learner vs normal bots (coach + memory checked)',
    games: 150,
    seedBase: 40_001,
    config: (seed) => {
      const players = 2 + (seed % 4);
      return { players, options: { firstPlayer: Math.floor(seed / 4) % players } };
    },
    difficulty: (s) => (s === 0 ? 'easy' : 'normal'),
    deep: true,
  },
];

describe('go fish simulation', () => {
  it(`plays ${BATCHES.reduce((a, b) => a + b.games, 0)} bot games without breaking any rule`, () => {
    let games = 0;
    let moves = 0;
    let wishes = 0;
    let dealtBooks = 0;
    let outs = 0;
    let refills = 0;
    let comebacks = 0;
    let lucky = 0;
    let shared = 0;
    let perfect = 0;
    let close = 0;
    const outcomes = { win: 0, loss: 0, push: 0 };
    const players = { 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>;
    for (const batch of BATCHES) {
      let initial: GoFishState | null = null;
      const recording = {
        ...goFishEngine,
        setup(config: GameConfig, rng: Rng) {
          initial = goFishEngine.setup(config, rng);
          checkConservation(initial);
          checkStructure(initial);
          const size = dealtSize(initial.players);
          initial.hands.forEach((h, seat) => {
            expect(h.length + 4 * initial!.books[seat]!.length).toBe(size);
          });
          expect(initial.stock).toHaveLength(52 - size * initial.players);
          return initial;
        },
        botMove(state: GoFishState, player: PlayerId, difficulty: Difficulty, rng: Rng) {
          const move = goFishEngine.botMove(state, player, difficulty, rng);
          if (difficulty === 'normal') {
            // The normal bot takes a sure catch whenever its memory proves one exists.
            const view = seatView(state, player);
            const sure = goFishEngine
              .legalMoves(state, player)
              .some((m) => holdChance(view, m.target, m.rank) >= 1);
            if (sure && holdChance(view, move.target, move.rank) < 1) {
              throw new Error('normal bot skipped a sure catch');
            }
          }
          return move;
        },
      };
      const summary = simulate(recording, {
        games: batch.games,
        seedBase: batch.seedBase,
        config: batch.config,
        difficulty: batch.difficulty,
        maxMoves: 600,
        invariant: (s) => {
          checkConservation(s);
          checkStructure(s);
          if (batch.deep) deepChecks(s);
        },
        onGameEnd: (s, r) => {
          if (!initial) throw new Error('setup was not recorded');
          const facts = replay(initial, s);
          checkResult(s, r, facts);
          players[s.players]!++;
          wishes += s.log.filter((e) => e.type === 'fish' && e.wish).length;
          dealtBooks += s.books.flat().filter((b) => b.via === 'deal').length;
          outs += s.log.filter((e) => e.type === 'out').length;
          refills += s.log.filter((e) => e.type === 'refill').length;
          if (r.flags.comeback) comebacks++;
          if (r.flags.luckyLastCard) lucky++;
          if (r.flags.tags?.includes('sharedWin')) shared++;
          if (r.flags.perfect) perfect++;
          if (r.flags.closeFinish) close++;
        },
      });
      expect(summary.games, batch.name).toBe(batch.games);
      expect(summary.maxMovesInAGame, batch.name).toBeLessThan(400);
      games += summary.games;
      moves += summary.totalMoves;
      outcomes.win += summary.outcomes.win;
      outcomes.loss += summary.outcomes.loss;
      outcomes.push += summary.outcomes.push;
    }
    expect(games).toBeGreaterThanOrEqual(1000);
    expect(Object.values(players).every((n) => n > 0)).toBe(true);
    // The interesting situations all actually occur.
    for (const [what, n] of Object.entries({
      wishes,
      dealtBooks,
      outs,
      refills,
      comebacks,
      lucky,
      shared,
      perfect,
      close,
    })) {
      expect(n, what).toBeGreaterThan(0);
    }
    expect(outcomes.win).toBeGreaterThan(0);
    expect(outcomes.loss).toBeGreaterThan(0);
    console.info(
      `go-fish sim: ${games} games, avg ${(moves / games).toFixed(1)} moves, ` +
        `outcomes ${JSON.stringify(outcomes)}, wishes ${wishes}, dealt books ${dealtBooks}, ` +
        `refills ${refills}, outs ${outs}, comebacks ${comebacks}, lucky ${lucky}, ` +
        `shared ${shared}, perfect ${perfect}, close ${close}`,
    );
  }, 60_000);

  it('normal bots beat easy bots over many heads-up games', () => {
    const run = (difficulty: (seat: PlayerId) => Difficulty) =>
      simulate(goFishEngine, {
        games: 400,
        seedBase: 50_001,
        config: (seed) => ({ players: 2, options: { firstPlayer: seed % 2 } }),
        difficulty,
        freezeEvery: 0,
      }).outcomes.win;
    const normalLearner = run((s) => (s === 0 ? 'normal' : 'easy'));
    const easyLearner = run((s) => (s === 0 ? 'easy' : 'normal'));
    expect(normalLearner).toBeGreaterThan(easyLearner);
    expect(normalLearner).toBeGreaterThan(200);
  }, 30_000);
});
