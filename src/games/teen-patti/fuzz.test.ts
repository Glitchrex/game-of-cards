/**
 * Fuzzing Teen Patti with RANDOM (but legal) moves — not just the bots' sensible ones — over
 * random table sizes, dealers, chaal limits and pot limits. Looks for stuck states, broken
 * invariants, card loss or duplication, input mutation, hidden-information leaks (in
 * describeMove, coach and the bots) and coach advice that is not legal. Also checks that the
 * normal bot is never worse than easy, at every table size.
 */
import { describe, expect, it } from 'vitest';
import { type CardCode, cardName, makeDeck } from '@/games/core/cards';
import { createRng, shuffle, type Rng } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import type { Difficulty } from '@/games/core/types';
import engine, {
  MAX_LOSS_UNITS,
  type TeenPattiMove,
  type TeenPattiState,
  activeSeats,
  hitsPotLimit,
  rankHand,
} from './engine';

const TYPES = ['see', 'chaal', 'raise', 'show', 'pack'] as const;

function randomConfig(rng: Rng) {
  const players = 2 + rng.int(4);
  const options: Record<string, unknown> = {};
  if (rng.next() < 0.6) options.potLimit = players + 1 + rng.int(64 - players);
  if (rng.next() < 0.3) options.stakeLimit = rng.pick([1, 2, 4, 8]);
  if (rng.next() < 0.5) options.dealer = rng.int(players);
  return { players, options };
}

/** Random legal move; `deep` makes packs and shows rare so games reach the pot limit. */
function randomMove(state: TeenPattiState, p: number, rng: Rng, deep: boolean): TeenPattiMove {
  const legal = engine.legalMoves(state, p);
  if (!deep) return rng.pick(legal);
  const weight = (m: TeenPattiMove) => (m.type === 'pack' ? 0.05 : m.type === 'show' ? 0.15 : 1);
  let x = rng.next() * legal.reduce((a, m) => a + weight(m), 0);
  for (const m of legal) {
    x -= weight(m);
    if (x <= 0) return m;
  }
  return legal[legal.length - 1] as TeenPattiMove;
}

/** Same public state, but every card `p` may not see (opponents', and its own while blind) re-dealt. */
function redealHidden(state: TeenPattiState, p: number, rng: Rng): TeenPattiState {
  const keep = state.seen[p] ? (state.hands[p] ?? []) : [];
  const pool = shuffle(
    makeDeck().filter((c) => !keep.includes(c)),
    rng,
  );
  let next = 0;
  const hands = state.hands.map((hand, i) => {
    if (i === p && state.seen[p]) return hand;
    const fresh = pool.slice(next, next + 3);
    next += 3;
    return fresh;
  });
  return { ...state, hands, stock: pool.slice(next) };
}

/**
 * Problems are collected as strings (one `expect` per game instead of thousands per game),
 * which keeps these large fuzz runs fast while still reporting exactly what went wrong.
 */
type Problems = string[];

function checkStep(state: TeenPattiState, p: number, bad: Problems) {
  const legal = engine.legalMoves(state, p).map((m) => m.type);
  if (!legal.includes('chaal') || !legal.includes('pack')) bad.push(`stuck: legal ${legal}`);
  for (const t of TYPES) {
    const check = engine.checkMove(state, p, { type: t });
    if (check.ok !== legal.includes(t)) bad.push(`checkMove(${t}) disagrees with legalMoves`);
    if (!check.ok && (check.reason?.length ?? 0) <= 20) bad.push(`unhelpful reason for ${t}`);
    for (let q = 0; q < state.players; q++) {
      if (q === p) continue;
      if (engine.legalMoves(state, q).length) bad.push(`seat ${q} has moves out of turn`);
      const off = engine.checkMove(state, q, { type: t });
      if (off.ok) bad.push(`seat ${q} may ${t} out of turn`);
      if (/when it's your turn — right now it's your turn/.test(off.reason ?? '')) {
        bad.push(`contradictory reason: ${off.reason}`);
      }
    }
  }
  const advice = engine.coach(state, p);
  const suggested = (advice.suggestion as TeenPattiMove | undefined)?.type;
  if (!suggested || !legal.includes(suggested)) bad.push(`coach suggested ${suggested}`);
  if ((advice.why?.length ?? 0) <= 10) bad.push('coach gave no reason');
  for (let q = 0; q < state.players; q++) {
    if (q !== p && engine.coach(state, q).suggestion !== undefined) {
      bad.push(`coach suggested a move to seat ${q} out of turn`);
    }
  }
}

function checkInvariants(s: TeenPattiState, bad: Problems) {
  if (s.pot !== s.contributed.reduce((a, b) => a + b, 0)) bad.push('pot ≠ contributions');
  if (s.pot > s.potLimit) bad.push(`pot ${s.pot} above the limit ${s.potLimit}`);
  if (s.stake > s.stakeLimit) bad.push(`stake ${s.stake} above the limit ${s.stakeLimit}`);
  const all = [...s.hands.flat(), ...s.stock];
  if (all.length !== 52 || new Set(all).size !== 52) bad.push('cards lost or duplicated');
  if (s.hands.some((hand) => hand.length !== 3)) bad.push('a hand without 3 cards');
  if ((engine.currentPlayer(s) === null) !== engine.isOver(s)) bad.push('turn/over mismatch');
}

/** Names of cards / hands that `describeMove` must not mention for this move. */
function hiddenWords(
  before: TeenPattiState,
  after: TeenPattiState,
  p: number,
  move: TeenPattiMove,
) {
  const revealed = new Set<number>(after.outcome?.showdown ?? []);
  if (move.type === 'see' && p === 0) revealed.add(0);
  const visible = new Set([...revealed].map((s) => rankHand(before.hands[s] ?? []).name));
  const words: string[] = [];
  for (let q = 0; q < before.players; q++) {
    if (revealed.has(q)) continue;
    words.push(...(before.hands[q] ?? []).map((c: CardCode) => cardName(c)));
    const name = rankHand(before.hands[q] ?? []).name;
    if (!visible.has(name)) words.push(name);
  }
  return words;
}

function checkEnd(s: TeenPattiState, bad: Problems) {
  const o = s.outcome;
  if (!o) {
    bad.push('ended without an outcome');
    return;
  }
  const r = engine.result(s);
  const net = (o.payouts[0] ?? 0) - (s.contributed[0] ?? 0);
  if (o.payouts.reduce((a, b) => a + b, 0) !== s.pot) bad.push('payouts ≠ pot');
  if (o.winners.some((w) => s.packed[w])) bad.push('a packed player won');
  if (o.kind === 'last-standing' && o.showdown.length) bad.push('cards shown at a pack-out');
  if (o.kind !== 'last-standing' && !o.winners.every((w) => o.showdown.includes(w))) {
    bad.push('a winner was not in the show');
  }
  if (o.kind === 'pot-limit' && JSON.stringify(o.showdown) !== JSON.stringify(activeSeats(s))) {
    bad.push('pot-limit show is not everyone still in');
  }
  if (o.kind === 'show' && o.showdown.length !== 2) bad.push('a show without two players');
  if (r.humanNetUnits !== net) bad.push(`net ${r.humanNetUnits} ≠ ${net}`);
  if (net < -MAX_LOSS_UNITS) bad.push(`lost ${-net} boots, more than the escrow`);
  if (r.humanOutcome !== (net > 0 ? 'win' : net < 0 ? 'loss' : 'push')) bad.push('outcome');
  if (r.flags.perfect && r.humanOutcome !== 'win') bad.push('perfect without a win');
  if (r.flags.luckyLastCard && JSON.stringify(o.winners) !== '[0]') bad.push('lucky, not sole');
  if (r.flags.bust && o.asker !== 0) bad.push('bust without asking for the show');
  if (engine.coach(s, 0).suggestion !== undefined) bad.push('coach suggestion after the end');
}

describe('Teen Patti fuzz: random legal moves', () => {
  for (const deep of [false, true]) {
    it(`never gets stuck, breaks an invariant or leaks hidden cards (${deep ? 'deep, toward the pot limit' : 'uniform'} play)`, () => {
      const kinds: Record<string, number> = {};
      let moves = 0;
      const games = 4000;
      for (let g = 0; g < games; g++) {
        const bad: Problems = [];
        const rng = createRng(`fuzz-${deep}-${g}`);
        const config = randomConfig(rng);
        let s = engine.setup(config, createRng(`fuzz-deal-${deep}-${g}`));
        checkInvariants(s, bad);
        while (!engine.isOver(s) && bad.length === 0) {
          const p = engine.currentPlayer(s);
          if (p === null) {
            bad.push('no player to act but the hand is not over');
            break;
          }
          checkStep(s, p, bad);
          if (moves % 5 === 0) {
            // Hidden information never changes a bot's decision or the coach's advice.
            const t = redealHidden(s, p, rng);
            for (const d of ['easy', 'normal'] as const) {
              const a = engine.botMove(s, p, d, createRng(`b-${moves}`));
              const b = engine.botMove(t, p, d, createRng(`b-${moves}`));
              if (a.type !== b.type) bad.push(`${d} bot used hidden cards`);
            }
            if (JSON.stringify(engine.coach(t, p)) !== JSON.stringify(engine.coach(s, p))) {
              bad.push('coach used hidden cards');
            }
          }
          const move = randomMove(s, p, rng, deep);
          const text = engine.describeMove(s, p, move);
          const before = JSON.stringify(s);
          const next = engine.applyMove(deepFreeze(s), move);
          if (JSON.stringify(s) !== before) bad.push('applyMove mutated its input');
          for (const word of hiddenWords(s, next, p, move)) {
            if (text.includes(word)) bad.push(`describeMove leaked "${word}": ${text}`);
          }
          s = next;
          checkInvariants(s, bad);
          moves++;
          if (s.history.length >= 300) bad.push('no end in sight');
        }
        if (bad.length === 0) checkEnd(s, bad);
        expect({ game: g, config, problems: bad }).toEqual({ game: g, config, problems: [] });
        const kind = s.outcome?.kind ?? 'none';
        kinds[kind] = (kinds[kind] ?? 0) + 1;
      }
      console.info(
        `[teen-patti fuzz] ${deep ? 'deep' : 'uniform'}: ${games} games, avg ${(moves / games).toFixed(1)} moves, endings ${JSON.stringify(kinds)}`,
      );
      // Every ending is exercised.
      expect(Object.keys(kinds).sort()).toEqual(['last-standing', 'pot-limit', 'show']);
    }, 120_000);
  }
});

describe('Teen Patti fuzz: the normal bot near the pot limit', () => {
  it('looks first while blind, never raises or asks for a show when a chaal ends the hand', () => {
    let spots = 0;
    for (let g = 0; g < 1500; g++) {
      const rng = createRng(`limit-${g}`);
      const config = randomConfig(rng);
      let s = engine.setup(config, createRng(`limit-deal-${g}`));
      while (!engine.isOver(s)) {
        const p = engine.currentPlayer(s) ?? 0;
        const chaalEnds = hitsPotLimit(s, p, { type: 'chaal' });
        const legal = engine.legalMoves(s, p).map((m) => m.type);
        const raiseEnds = legal.includes('raise') && hitsPotLimit(s, p, { type: 'raise' });
        if (chaalEnds || raiseEnds) {
          spots++;
          for (let i = 0; i < 5; i++) {
            const m = engine.botMove(s, p, 'normal', createRng(`limit-bot-${g}-${i}`));
            expect(m.type).not.toBe('raise');
            if (chaalEnds) {
              expect(m.type).not.toBe('show');
              if (!s.seen[p]) expect(m.type).toBe('see');
            }
          }
        }
        s = engine.applyMove(s, randomMove(s, p, rng, true));
      }
    }
    expect(spots).toBeGreaterThan(500);
  }, 60_000);
});

describe('Teen Patti bots: normal is never worse than easy', () => {
  /** Average learner net per game with seat 0 at `d0` and the bots at `bots`, same deals. */
  function averageNet(players: number, d0: Difficulty, bots: Difficulty, games: number) {
    let net = 0;
    for (let g = 0; g < games; g++) {
      let s = engine.setup({ players }, createRng(`skill-${players}-${g}`));
      const rng = createRng(`skill-bots-${players}-${g}`);
      while (!engine.isOver(s)) {
        const p = engine.currentPlayer(s) ?? 0;
        s = engine.applyMove(s, engine.botMove(s, p, p === 0 ? d0 : bots, rng));
      }
      net += engine.result(s).humanNetUnits;
    }
    return net / games;
  }

  it('at every table size, against easy bots and against normal bots', () => {
    const lines: string[] = [];
    for (let players = 2; players <= 5; players++) {
      const games = players === 2 ? 1500 : 700;
      for (const bots of ['easy', 'normal'] as const) {
        const normal = averageNet(players, 'normal', bots, games);
        const easy = averageNet(players, 'easy', bots, games);
        lines.push(`${players}p vs ${bots}: normal ${normal.toFixed(2)}, easy ${easy.toFixed(2)}`);
        expect(normal).toBeGreaterThan(easy);
      }
    }
    console.info(`[teen-patti skill] ${lines.join(' | ')}`);
  }, 120_000);
});
