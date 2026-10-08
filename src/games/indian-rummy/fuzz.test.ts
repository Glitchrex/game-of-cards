/**
 * Fuzzing Indian Rummy with random (but legal) moves, 2–6 players and varied turn caps,
 * looking for crashes, stuck states, non-termination, lost or duplicated cards, mutated
 * inputs, illegal or dishonest coaching, leaked hidden cards and out-of-range payouts.
 */
import { describe, expect, it } from 'vitest';
import { type CardCode, cardName, cardShort } from '@/games/core/cards';
import { type Rng, createRng, shuffle } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import engine, {
  MAX_LOSS_UNITS,
  type IndianRummyMove,
  type IndianRummyState,
  bestArrangement,
  fullDeck,
} from './engine';

const FULL = fullDeck().sort().join(' ');
const BROKEN_TEXT = /your ,|your \.|your and |\(\)|undefined|NaN|null|\s{2}|-0\b/;

function cardsOf(s: IndianRummyState): string {
  return [
    ...s.hands.flat(),
    ...s.stock,
    ...s.discard,
    s.wildCard,
    ...(s.finishCard ? [s.finishCard] : []),
  ]
    .sort()
    .join(' ');
}

/** Mostly random legal moves, sometimes a bot's choice; drops are kept rare. */
function pickMove(s: IndianRummyState, p: number, rng: Rng): IndianRummyMove {
  const legal = engine.legalMoves(s, p);
  const r = rng.next();
  if (r < 0.35) return engine.botMove(s, p, r < 0.2 ? 'normal' : 'easy', rng);
  const declare = legal.find((m) => m.type === 'declare');
  if (declare && rng.next() < 0.5) return declare;
  const pool = legal.filter((m) => m.type !== 'drop' || rng.next() < 0.04);
  return rng.pick(pool.length ? pool : legal);
}

interface Tally {
  games: number;
  moves: number;
  kinds: Record<string, number>;
  outcomes: Record<string, number>;
  reshuffles: number;
}

function fuzz(games: number, seedBase: number): Tally {
  const tally: Tally = { games: 0, moves: 0, kinds: {}, outcomes: {}, reshuffles: 0 };
  for (let g = 0; g < games; g++) {
    const seed = seedBase + g;
    const players = 2 + (g % 5);
    const maxTurns = g % 3 === 0 ? 1 + (g % 37) : 200;
    let s = engine.setup({ players, options: { maxTurns } }, createRng(`fz-${seed}`));
    const rng = createRng(`fz-moves-${seed}`);
    const at = (msg: string) => `[seed ${seed}, move ${tally.moves}] ${msg}`;
    let steps = 0;
    while (!engine.isOver(s)) {
      const p = engine.currentPlayer(s);
      if (p === null) throw new Error(at('currentPlayer is null before the end'));
      const legal = engine.legalMoves(s, p);
      if (!legal.length) throw new Error(at(`seat ${p} is stuck with no legal move`));
      for (let q = 0; q < players; q++) {
        if (q !== p && engine.legalMoves(s, q).length) throw new Error(at(`seat ${q} may move`));
      }
      // The coach always suggests a legal move and its words make sense.
      const c = engine.coach(s, p);
      const suggestion = c.suggestion as IndianRummyMove | undefined;
      if (!suggestion || !engine.checkMove(s, p, suggestion).ok) {
        throw new Error(at(`coach suggested ${JSON.stringify(suggestion)}`));
      }
      if (BROKEN_TEXT.test(`${c.situation} ${c.why ?? ''}`)) {
        throw new Error(at(`coach text: ${c.situation} / ${c.why}`));
      }
      const move = pickMove(s, p, rng);
      const said = engine.describeMove(s, p, move);
      if (said.startsWith('Not allowed') || BROKEN_TEXT.test(said)) {
        throw new Error(at(`describeMove: ${said}`));
      }
      if (p !== 0 && move.type === 'draw' && move.from === 'stock') {
        const card = s.stock[s.stock.length - 1] as CardCode;
        if (said.includes(cardName(card)) || said.includes(cardShort(card))) {
          throw new Error(at(`a bot's blind draw was revealed: ${said}`));
        }
      }
      const before = JSON.stringify(s);
      deepFreeze(s);
      const next = engine.applyMove(s, move);
      if (JSON.stringify(s) !== before) throw new Error(at('applyMove mutated its input'));
      s = next;
      steps++;
      tally.moves++;
      if (cardsOf(s) !== FULL) throw new Error(at('a card was lost or duplicated'));
      if (!engine.isOver(s) && s.phase === 'draw' && (!s.stock.length || !s.discard.length)) {
        throw new Error(at('a pile is empty at the start of a turn'));
      }
      // Each table turn is a draw and a discard; drops end a seat. Nothing else can happen.
      if (steps > 2 * maxTurns + players + 2) throw new Error(at('the game did not end'));
    }
    if (engine.currentPlayer(s) !== null) throw new Error(at('a finished game has a player'));
    expect(engine.legalMoves(s, 0)).toEqual([]);
    const r = engine.result(s);
    const o = s.outcome;
    if (!o) throw new Error(at('no outcome'));
    const sum = o.net.reduce((a, b) => a + b, 0);
    if (Math.abs(sum) > 1e-9) throw new Error(at(`points do not balance (${sum})`));
    if (r.humanNetUnits < -MAX_LOSS_UNITS || r.humanNetUnits > MAX_LOSS_UNITS * (players - 1)) {
      throw new Error(at(`net ${r.humanNetUnits} is out of range`));
    }
    if (Object.is(r.humanNetUnits, -0)) throw new Error(at('net is -0'));
    if (r.humanOutcome === 'win' && !o.winners.includes(0)) throw new Error(at('false win'));
    if (r.humanOutcome === 'loss' && (o.winners.includes(0) || r.humanNetUnits > 0)) {
      throw new Error(at('false loss'));
    }
    if (r.flags.folded !== (s.drops[0] !== null)) throw new Error(at('folded flag'));
    if (BROKEN_TEXT.test(r.summary)) throw new Error(at(`summary: ${r.summary}`));
    tally.games++;
    tally.kinds[o.kind] = (tally.kinds[o.kind] ?? 0) + 1;
    tally.outcomes[r.humanOutcome] = (tally.outcomes[r.humanOutcome] ?? 0) + 1;
    if (s.reshuffles) tally.reshuffles++;
  }
  return tally;
}

describe('Indian Rummy fuzzing', () => {
  it('random legal play at 2–6 seats never crashes, sticks, loses cards or overpays', () => {
    const t = fuzz(700, 50_000);
    console.info(
      `[indian-rummy fuzz] ${t.games} games, avg ${(t.moves / t.games).toFixed(1)} moves, ` +
        `endings ${JSON.stringify(t.kinds)}, learner ${JSON.stringify(t.outcomes)}, ` +
        `reshuffled ${t.reshuffles}`,
    );
    expect(t.games).toBe(700);
    // Every ending and outcome actually occurs.
    for (const kind of ['declare', 'drop', 'turn-cap']) expect(t.kinds[kind]).toBeGreaterThan(20);
    for (const outcome of ['win', 'loss', 'push']) expect(t.outcomes[outcome]).toBeGreaterThan(0);
    expect(t.reshuffles).toBeGreaterThan(5);
  }, 120_000);

  it('the coach never says a card it throws out of a group fits no group', () => {
    let checked = 0;
    for (let g = 0; g < 120; g++) {
      let s = engine.setup({ players: 2 + (g % 3) }, createRng(`honest-${g}`));
      const rng = createRng(`honest-moves-${g}`);
      while (!engine.isOver(s)) {
        const p = s.turn;
        const c = engine.coach(s, p);
        const m = c.suggestion as IndianRummyMove;
        if (m.type === 'discard') {
          const loose = bestArrangement(s.hands[p] ?? [], s.wildRank).groups.find(
            (gr) => gr.kind === 'unmatched',
          );
          const grouped = !(loose?.cards ?? []).includes(m.card);
          if (grouped) {
            expect(c.why).not.toMatch(/doesn't fit with any of your groups/);
            checked++;
          }
        }
        s = engine.applyMove(s, engine.botMove(s, p, p % 2 ? 'easy' : 'normal', rng));
      }
    }
    expect(checked).toBeGreaterThan(30);
  }, 60_000);

  it('bots never peek: re-dealing every hidden card leaves their choice unchanged', () => {
    let compared = 0;
    for (let g = 0; g < 60; g++) {
      let s = engine.setup({ players: 2 + (g % 5) }, createRng(`peek-audit-${g}`));
      const rng = createRng(`peek-audit-moves-${g}`);
      for (let step = 0; step < 60 && !engine.isOver(s); step++) {
        const p = s.turn;
        if (step % 3 === 0) {
          // Everything the seat cannot see (other hands and the stock order) is re-dealt.
          const others = s.hands.flatMap((h, i) => (i === p ? [] : h));
          const hidden = shuffle([...others, ...s.stock], createRng(`redeal-${g}-${step}`));
          let k = 0;
          const take = (n: number) => hidden.slice(k, (k += n));
          const hands = s.hands.map((h, i) => (i === p ? h.slice() : take(h.length)));
          const twin: IndianRummyState = { ...s, hands, stock: take(s.stock.length) };
          for (const d of ['easy', 'normal'] as const) {
            const a = engine.botMove(s, p, d, createRng(`same-${step}`));
            const b = engine.botMove(twin, p, d, createRng(`same-${step}`));
            expect(b).toEqual(a);
            compared++;
          }
        }
        s = engine.applyMove(s, engine.botMove(s, p, step % 2 ? 'easy' : 'normal', rng));
      }
    }
    expect(compared).toBeGreaterThan(500);
  }, 60_000);
});
