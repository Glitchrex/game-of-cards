import { SUITS, rankNumber, suitOf, type StandardCard } from '@/games/core/cards';
import { simulate, type SimulationSummary } from '@/games/core/simulate';
import type { Difficulty, GameResult } from '@/games/core/types';
import { klondikeEngine, type KlondikeState } from './engine';
import { STALL_LIMIT } from './strategy';
import { faceDownCount, foundationCount, fullDeck, isRun } from './rules';

const DECK = new Set<string>(fullDeck());

interface Tally {
  cleared: number;
  resigned: number;
  backstops: number;
  homeTotal: number;
  flags: Record<string, number>;
}

/** Card conservation + structural invariants, checked after every single move. */
function makeInvariant() {
  let prev: KlondikeState | null = null;
  return (s: KlondikeState, step: number) => {
    if (step === 1) prev = null;
    const cards: StandardCard[] = [
      ...s.stock,
      ...s.waste,
      ...s.tableau.flatMap((p) => [...p.faceDown, ...p.faceUp]),
      ...SUITS.flatMap((suit) => s.foundations[suit]),
    ];
    if (cards.length !== 52) throw new Error(`step ${step}: ${cards.length} cards on the table`);
    const seen = new Set<string>(cards);
    if (seen.size !== 52) throw new Error(`step ${step}: duplicate card`);
    for (const c of seen) if (!DECK.has(c)) throw new Error(`step ${step}: unknown card ${c}`);

    if (s.tableau.length !== 7) throw new Error(`step ${step}: ${s.tableau.length} columns`);
    s.tableau.forEach((p, i) => {
      if (p.faceDown.length > 0 && p.faceUp.length === 0) {
        throw new Error(`step ${step}: column ${i + 1} has hidden cards but nothing face up`);
      }
      if (p.faceUp.length > 0 && !isRun(p.faceUp)) {
        throw new Error(`step ${step}: column ${i + 1} face-up cards are not a run`);
      }
    });
    for (const suit of SUITS) {
      s.foundations[suit].forEach((c, k) => {
        if (suitOf(c) !== suit || rankNumber(c) !== k + 1) {
          throw new Error(`step ${step}: ${suit} foundation out of order at ${c}`);
        }
      });
    }
    const hidden = faceDownCount(s);
    if (s.flips !== 21 - hidden) throw new Error(`step ${step}: flips ${s.flips} ≠ ${21 - hidden}`);
    if (s.moveCount !== step) throw new Error(`step ${step}: moveCount ${s.moveCount}`);
    const home = foundationCount(s);
    if (s.bestHome < home) throw new Error(`step ${step}: bestHome below foundation count`);
    if (prev) {
      // Hidden cards and the stock cycle only ever shrink; a move shifts at most one card home.
      if (hidden > faceDownCount(prev)) throw new Error(`step ${step}: a card turned face down`);
      const cycle = s.stock.length + s.waste.length;
      if (cycle > prev.stock.length + prev.waste.length) {
        throw new Error(`step ${step}: a card returned to the stock/waste`);
      }
      if (Math.abs(home - foundationCount(prev)) > 1) {
        throw new Error(`step ${step}: more than one card changed foundations in one move`);
      }
      if (s.bestHome < prev.bestHome) throw new Error(`step ${step}: bestHome went down`);
    }
    prev = s;
  };
}

/** Re-derive the payout and flags from the final position alone. */
function makeOnGameEnd(tally: Tally) {
  return (s: KlondikeState, r: GameResult, seed: number) => {
    const fail = (msg: string) => {
      throw new Error(`[seed ${seed}] ${msg}`);
    };
    const home = SUITS.reduce((n, suit) => n + s.foundations[suit].length, 0);
    const cleared = home === 52;
    if (!cleared && !s.resigned) fail('game ended without a clear or a resignation');
    const net = (5 * home) / 52 - 1;
    if (Math.abs(r.humanNetUnits - net) > 1e-12) fail(`net ${r.humanNetUnits} ≠ ${net}`);
    if (r.humanNetUnits < -1 || r.humanNetUnits > 4) fail(`net ${r.humanNetUnits} out of range`);
    // Vegas ledger: stake in (1 unit) + net out = exactly 5/52 of a unit per card home.
    if (Math.abs(1 + r.humanNetUnits - (5 * home) / 52) > 1e-12) fail('Vegas ledger mismatch');
    const win = cleared || net > 0;
    if (r.humanOutcome !== (win ? 'win' : 'loss')) fail(`outcome ${r.humanOutcome}`);
    if (JSON.stringify(r.winners) !== JSON.stringify(win ? [0] : [])) fail('winners');
    if (JSON.stringify(r.scores) !== JSON.stringify([home])) fail('scores');
    if (!r.summary) fail('empty summary');
    const f = r.flags;
    if (!!f.perfect !== cleared) fail('perfect flag');
    if (!!f.folded !== (s.resigned && !cleared)) fail('folded flag');
    if (!!f.bigPot !== home >= 42) fail('bigPot flag');
    if (!!f.closeFinish !== (!cleared && (home === 10 || home === 11))) fail('closeFinish flag');
    if (!!f.comeback !== (cleared && s.recycles >= 3)) fail('comeback flag');
    if (!!f.luckyLastCard !== (!cleared && home === 11 && s.bestHome === 11)) {
      fail('luckyLastCard flag');
    }
    if (f.bust) fail('bust flag');
    if (cleared) {
      if (s.flips !== 21) fail('cleared without turning over all 21 hidden cards');
      if (!s.lastHome || rankNumber(s.lastHome) !== 13) fail('the last card home must be a King');
      tally.cleared++;
    } else {
      tally.resigned++;
      if (s.moveCount - 1 - s.lastProgressAt > STALL_LIMIT) tally.backstops++;
    }
    tally.homeTotal += home;
    for (const [k, v] of Object.entries(f)) {
      if (v === true) tally.flags[k] = (tally.flags[k] ?? 0) + 1;
    }
  };
}

function run(difficulty: Difficulty, games: number, seedBase: number, freezeEvery?: number) {
  const tally: Tally = { cleared: 0, resigned: 0, backstops: 0, homeTotal: 0, flags: {} };
  const summary: SimulationSummary = simulate(klondikeEngine, {
    games,
    seedBase,
    config: { players: 1 },
    difficulty: () => difficulty,
    maxMoves: 2000,
    freezeEvery,
    invariant: makeInvariant(),
    onGameEnd: makeOnGameEnd(tally),
  });
  console.info(
    `klondike ${difficulty}: ${summary.games} games, avg ${(summary.totalMoves / summary.games).toFixed(1)} moves ` +
      `(max ${summary.maxMovesInAGame}), cleared ${tally.cleared} (${((100 * tally.cleared) / games).toFixed(1)}%), ` +
      `outcomes ${JSON.stringify(summary.outcomes)}, avg cards home ${(tally.homeTotal / games).toFixed(1)}, ` +
      `net ${summary.netUnits.toFixed(2)} units, flags ${JSON.stringify(tally.flags)}`,
  );
  return { summary, tally };
}

describe('Klondike simulations', () => {
  test('700 games with the normal bot', { timeout: 120_000 }, () => {
    const { summary, tally } = run('normal', 700, 1);
    expect(summary.games).toBe(700);
    expect(summary.outcomes.push).toBe(0);
    expect(tally.cleared + tally.resigned).toBe(700);
    // A good heuristic player clears roughly a third or more of Draw-1 deals.
    expect(tally.cleared / 700).toBeGreaterThan(0.3);
    // The stall backstop is a safety net only — the normal bot resigns on its own rules.
    expect(tally.backstops).toBe(0);
    expect(tally.flags.perfect).toBe(tally.cleared);
  });

  test('400 games with the easy bot', { timeout: 120_000 }, () => {
    const { summary, tally } = run('easy', 400, 10_001);
    expect(summary.games).toBe(400);
    expect(tally.cleared + tally.resigned).toBe(400);
    expect(tally.cleared).toBeGreaterThan(0);
    expect(tally.cleared / 400).toBeLessThan(0.3);
    expect(tally.backstops).toBe(0);
  });

  test('100 games with immutability checked on every move', { timeout: 120_000 }, () => {
    const { summary } = run('normal', 100, 50_001, 1);
    expect(summary.games).toBe(100);
  });
});
