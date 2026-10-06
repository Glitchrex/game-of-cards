/**
 * Adversarial rules verification for War: one focused check per rule in
 * docs/RULES_DECISIONS.md → War and docs/engine-notes/war.md, aimed at the edge cases
 * (short piles, simultaneous run-outs, the battle cap, honest result flags, coach wording).
 */
import { describe, expect, it } from 'vitest';
import { makeDeck, rankOf, RANKS, SUITS, type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { simulate } from '@/games/core/simulate';
import type { GameResult } from '@/games/core/types';
import {
  cardValue,
  MAX_LOSS_UNITS,
  resolveBattle,
  WAR_FACE_DOWN,
  warEngine,
  type WarState,
} from './engine';
import { deal52, flip, FLIP, playOut, stateWith } from './test-helpers';

const DECK = makeDeck();
const RANK_ORDER = '23456789TJQKA';
const sizes = (s: WarState): [number, number] => [s.piles[0].length, s.piles[1].length];
/** One battle before the default 60-battle cap. */
const beforeCap = (s: WarState): WarState => ({ ...s, battles: s.maxBattles - 1 });

describe('rule: the higher card wins, Ace high, suits never matter', () => {
  it('every pair of different ranks, in every suit and on either seat, goes to the higher rank', () => {
    let battles = 0;
    for (const a of DECK) {
      for (const b of DECK) {
        if (rankOf(a) === rankOf(b)) continue;
        const outcome = resolveBattle([[a], [b]]);
        const higher = RANK_ORDER.indexOf(rankOf(a)) > RANK_ORDER.indexOf(rankOf(b)) ? 0 : 1;
        expect(outcome.wars).toBe(0);
        expect(outcome.winner).toBe(higher);
        expect(outcome.won).toEqual(higher === 0 ? [a, b] : [b, a]);
        battles++;
      }
    }
    expect(battles).toBe(52 * 48);
  });

  it('every pair of same-rank cards ties and starts a war, whatever the suits', () => {
    for (const r of RANKS) {
      for (const s0 of SUITS) {
        for (const s1 of SUITS) {
          if (s0 === s1) continue;
          const a: CardCode = `${r}${s0}`;
          const b: CardCode = `${r}${s1}`;
          // Only one card each: the tie is recognised as a war that neither side can fight.
          const outcome = resolveBattle([[a], [b]]);
          expect(outcome.wars).toBe(1);
          expect(outcome.winner).toBeNull();
        }
      }
    }
    expect(cardValue('AS')).toBe(14);
    expect(cardValue('2C')).toBe(2);
  });
});

describe('rule: a war is 3 face down + 1 face up, and only the face-up card counts', () => {
  it('ignores the face-down cards: three hidden Aces lose to a face-up Three', () => {
    const s = flip(
      stateWith([
        ['9H', 'AS', 'AH', 'AD', '2C', '5C'],
        ['9C', '2D', '2H', '2S', '3C', '6C'],
      ]),
    );
    expect(s.lastBattle?.winner).toBe(1);
    expect(s.lastBattle?.won).toHaveLength(2 + 2 * WAR_FACE_DOWN + 2);
    expect(s.piles).toEqual([
      ['5C'],
      ['6C', '9C', '2D', '2H', '2S', '3C', '9H', 'AS', 'AH', 'AD', '2C'],
    ]);
  });

  it('a player with exactly 4 cards left plays all 4 and then loses a further tie', () => {
    // After the opening Nines the learner has exactly 4 cards: 3 down + 1 up, then nothing.
    const s = flip(
      stateWith([
        ['9H', '2S', '3S', '4S', 'QS'],
        ['9C', '2D', '3D', '4D', 'QD', '5D', '6D', '7D', '8D', 'KD'],
      ]),
    );
    expect(s.lastBattle?.rounds[1]?.down[0]).toEqual(['2S', '3S', '4S']);
    expect(s.lastBattle).toMatchObject({ winner: 1, decidedBy: 'out-of-cards', ranOut: [0] });
    expect(s.lastBattle?.wars).toBe(2);
    expect(sizes(s)).toEqual([0, 15]);
    expect(s).toMatchObject({ phase: 'over', winner: 1, endReason: 'all-cards' });
  });

  it('two short players each keep their own last card for the face-up flip', () => {
    // After the opening tie the learner has 3 cards (2 down + 1 up), Player 1 has 2 (1 + 1).
    const s = flip(
      stateWith([
        ['9H', '2S', '3S', 'KS'],
        ['9C', '2D', 'QD'],
      ]),
    );
    expect(s.lastBattle?.rounds[1]).toEqual({ down: [['2S', '3S'], ['2D']], up: ['KS', 'QD'] });
    expect(s.lastBattle?.won).toEqual(['9H', '2S', '3S', 'KS', '9C', '2D', 'QD']);
    expect(s).toMatchObject({ phase: 'over', winner: 0, endReason: 'all-cards' });
    const text = warEngine.describeMove(
      stateWith([
        ['9H', '2S', '3S', 'KS'],
        ['9C', '2D', 'QD'],
      ]),
      0,
      FLIP,
    );
    expect(text).toContain(
      'You had only 3 cards left, so you laid 2 face down and flipped your last card, and Player 1 had only 2 cards left, so they laid 1 face down and flipped their last card',
    );
  });

  it('a short player whose last card wins the war carries on with the winnings', () => {
    // The learner has a single card left for the war — it is the face-up card, and it wins.
    const s = flip(
      stateWith([
        ['9H', 'AS'],
        ['9C', '2D', '3D', '4D', '5D', '6D', '7D'],
      ]),
    );
    expect(s.lastBattle?.rounds[1]).toEqual({ down: [[], ['2D', '3D', '4D']], up: ['AS', '5D'] });
    expect(s.piles).toEqual([
      ['9H', 'AS', '9C', '2D', '3D', '4D', '5D'],
      ['6D', '7D'],
    ]);
    expect(s.phase).toBe('play');
    expect(warEngine.currentPlayer(s)).toBe(0);
  });
});

describe('rule: running out of cards', () => {
  it('flipping your last card and losing a plain battle ends the game at once', () => {
    const s = flip(stateWith([['3H'], ['8C', '2D']]));
    expect(s.lastBattle).toMatchObject({ winner: 1, decidedBy: 'higher-card', wars: 0 });
    expect(s).toMatchObject({ phase: 'over', winner: 1, endReason: 'all-cards' });
    expect(warEngine.result(s)).toMatchObject({ humanOutcome: 'loss', humanNetUnits: -1 });
  });

  it('flipping your last card and winning keeps you in the game', () => {
    const s = flip(stateWith([['KH'], ['8C', '2D']]));
    expect(s.piles).toEqual([['KH', '8C'], ['2D']]);
    expect(s.phase).toBe('play');
  });

  it('the last card of a short war that loses ends the game, decided by the higher card', () => {
    const s = flip(
      stateWith([
        ['9H', '4S'],
        ['9C', '2D', '3D', '4D', 'JD', '6D'],
      ]),
    );
    expect(s.lastBattle).toMatchObject({ winner: 1, decidedBy: 'higher-card', wars: 1 });
    expect(s).toMatchObject({ phase: 'over', winner: 1, endReason: 'all-cards' });
  });
});

describe('rule: the 60-battle beginner cap', () => {
  it('never plays past the cap, and every capped game stops exactly on it', () => {
    for (const cap of [1, 2, 5, 17, 60, 250]) {
      for (let seed = 0; seed < 25; seed++) {
        const states = playOut(
          warEngine.setup(
            { players: 2, options: { maxBattles: cap } },
            createRng(`cap-${cap}-${seed}`),
          ),
        );
        const last = states[states.length - 1] as WarState;
        expect(last.battles).toBeLessThanOrEqual(cap);
        expect(states).toHaveLength(last.battles + 1);
        if (last.endReason === 'battle-cap') expect(last.battles).toBe(cap);
        if (last.endReason === 'all-cards') expect(sizes(last)).toContain(0);
      }
    }
  });

  it('a long war chain on battle 60 is still just one battle, and the cap then applies', () => {
    const s = flip(
      beforeCap(
        deal52(
          ['9H', '2S', '3S', '4S', 'QS', '5S', '6S', '7S', 'AS'],
          ['9C', '2D', '3D', '4D', 'QD', '5D', '6D', '7D', '8D'],
          26,
        ),
      ),
    );
    expect(s.lastBattle?.wars).toBe(2);
    expect(s).toMatchObject({ battles: 60, phase: 'over', endReason: 'battle-cap', winner: 0 });
    expect(sizes(s)).toEqual([35, 17]);
  });
});

describe('rule: payouts', () => {
  it('pays exactly +1 / −1 / 0 and never risks more than maxLossUnits', () => {
    const results: GameResult[] = [];
    simulate(warEngine, {
      games: 300,
      seedBase: 70_001,
      config: (seed) => ({ players: 2, options: { maxBattles: 1 + (seed % 120) } }),
      onGameEnd: (_s, r) => {
        results.push(r);
      },
    });
    for (const r of results) {
      const expected = { win: 1, loss: -1, push: 0 }[r.humanOutcome];
      expect(r.humanNetUnits).toBe(expected);
      expect(r.humanNetUnits).toBeGreaterThanOrEqual(-MAX_LOSS_UNITS);
      expect(r.winners).toEqual(
        r.humanOutcome === 'win' ? [0] : r.humanOutcome === 'loss' ? [1] : [],
      );
    }
    expect(MAX_LOSS_UNITS).toBe(1);
  });
});

describe('result flags are honest', () => {
  const war0 = ['9H', '2S', '3S', '4S', 'AS'] as CardCode[];
  const war1 = ['9C', '2D', '3D', '4D', '2C'] as CardCode[];
  const lucky = (s: WarState) => warEngine.result(flip(s)).flags.luckyLastCard;

  it('luckyLastCard needs the final war to decide the game', () => {
    // 27–25 before the last battle: winning the war makes it 32–20, losing it 22–30.
    expect(lucky(beforeCap(deal52(war0, war1, 27)))).toBe(true);
    // Level at 26–26: the war turns a push into a win.
    expect(lucky(beforeCap(deal52(war0, war1, 26)))).toBe(true);
    // 31–21: losing the war would have left 26–26 (a push), so the war still decided it.
    expect(lucky(beforeCap(deal52(war0, war1, 31)))).toBe(true);
    // 35–17: the learner would have won 30–22 even after losing that war — not lucky.
    expect(lucky(beforeCap(deal52(war0, war1, 35)))).toBe(false);
    // 51–1, and the bot cannot even fight the final war: a sure thing, not a lucky card.
    expect(lucky(deal52(['9H', '2S'], ['9C'], 51))).toBe(false);
  });

  it('luckyLastCard counts a final war that swallowed half the deck and took the last card', () => {
    // Player 1 has 13 cards and every face-up card ties until Player 1 runs out: 26 cards
    // in the middle, so losing that war would have left the learner at 26–26.
    const ups0 = ['5S', '6S', '7S', '8S'] as CardCode[];
    const ups1 = ['5H', '6H', '7H', '8H'] as CardCode[];
    const downs0 = ['2C', '3C', '4C', '2D', '3D', '4D', 'TC', 'JC', 'QC'] as CardCode[];
    const downs1 = ['2H', '3H', '4H', 'TD', 'JD', 'QD', 'TH', 'JH', 'QH'] as CardCode[];
    const pile = (ups: CardCode[], downs: CardCode[]) => [
      ups[0] as CardCode,
      ...downs.slice(0, 3),
      ups[1] as CardCode,
      ...downs.slice(3, 6),
      ups[2] as CardCode,
      ...downs.slice(6, 9),
      ups[3] as CardCode,
    ];
    const top0 = pile(ups0, downs0);
    const p1 = pile(ups1, downs1);
    expect(p1).toHaveLength(13);
    const s = flip(deal52(top0, p1, 39));
    expect(s.lastBattle).toMatchObject({ winner: 0, decidedBy: 'out-of-cards', wars: 4 });
    expect(s.lastBattle?.won).toHaveLength(26);
    expect(s.endReason).toBe('all-cards');
    expect(warEngine.result(s).flags.luckyLastCard).toBe(true);
  });

  it('an all-cards win from far ahead is neither a comeback nor a close finish', () => {
    const r = warEngine.result(flip(deal52(['AS'], ['2C'], 51)));
    expect(r.flags).toMatchObject({ comeback: false, closeFinish: false });
  });
});

describe('checkMove and describeMove wording', () => {
  it('uses the singular when the battle cap is a single battle', () => {
    const s = flip({ ...deal52(['AS'], ['2C'], 27), maxBattles: 1 });
    expect(warEngine.checkMove(s, 0, FLIP).reason).toBe(
      'The game is over — the only battle has been fought (you finished with 28 cards, Player 1 with 24 cards).',
    );
  });
});

describe('the coach tells the truth', () => {
  const whyAfter = (s: WarState) => warEngine.coach(flip(s), 0).why ?? '';

  it('does not claim both players laid cards face down when one had only their last card', () => {
    const why = whyAfter(
      stateWith([
        ['9H', 'AS'],
        ['9C', '2D', '3D', '4D', '5D', '6D', '7D'],
      ]),
    );
    expect(why).toContain('That last battle was a war');
    expect(why).not.toMatch(/you each laid (3 )?cards face down and flipped/);
    expect(why).toContain('fewer than 3 if you were running short');
  });

  it('says a full war was 3 cards face down each', () => {
    const why = whyAfter(
      stateWith([
        ['9H', '2S', '3S', '4S', 'QS', 'KC'],
        ['9C', '2D', '3D', '4D', '4C', 'KD'],
      ]),
    );
    expect(why).toContain(
      'That last battle was a war: the first cards tied, so you each laid 3 cards face down and flipped one more — and the higher new card took every card in the middle.',
    );
  });

  it('explains a double war as a double war', () => {
    const why = whyAfter(
      stateWith([
        ['9H', '2S', '3S', '4S', 'QS', '5S', '6S', '7S', 'AS', 'KC'],
        ['9C', '2D', '3D', '4D', 'QD', '5D', '6D', '7D', '8D', 'KD'],
      ]),
    );
    expect(why).toContain('That last battle was a double war');
    expect(why).not.toContain('the higher new card took');
  });

  it('never promises a 10-card war to a learner who cannot afford one', () => {
    // After this battle the learner holds 4 cards: their next war could be 9 cards at most.
    const s = flip(
      stateWith([
        ['5H', '6H', '7H'],
        ['4C', '2D', '3D', '4D', '5D', '6D', '7D', '8D', '9D', 'TD', 'JD', 'QD', 'KD', 'AD'],
      ]),
    );
    expect(sizes(s)[0]).toBe(4);
    const why = warEngine.coach(s, 0).why ?? '';
    expect(why).toContain('low on cards');
    expect(why).not.toMatch(/ten cards|10 cards/);
    // With 9 cards a full war is possible, and the coach may say so.
    const nine = flip(
      stateWith([
        ['KH', '2H', '3H', '4H', '5H', '6H', '7H', '8H'],
        ['4C', '2D', '3D', '4D', '5D', '6D', '7D', '8D', '9D', 'TD', 'JD', 'QD', 'KD', 'AD'],
      ]),
    );
    expect(sizes(nine)[0]).toBe(9);
    expect(warEngine.coach(nine, 0).why).toContain('10 cards');
  });
});

describe('the bot', () => {
  it('ignores difficulty, randomness and every hidden card', () => {
    const rng = createRng('hidden');
    for (let seed = 0; seed < 30; seed++) {
      const s = warEngine.setup({ players: 2 }, createRng(`bot-hidden-${seed}`));
      const shuffled: WarState = {
        ...s,
        piles: [s.piles[1].slice().reverse(), s.piles[0].slice().reverse()],
      };
      const before = rng.getState();
      const moves = [s, shuffled].flatMap((x) =>
        (['easy', 'normal'] as const).map((d) => warEngine.botMove(x, 0, d, rng)),
      );
      expect(rng.getState()).toBe(before);
      for (const m of moves) expect(m).toEqual(FLIP);
    }
  });

  it("'normal' does exactly as well as 'easy': the same seeds give the same games", () => {
    const run = (difficulty: 'easy' | 'normal') => {
      const results: string[] = [];
      const summary = simulate(warEngine, {
        games: 400,
        seedBase: 80_001,
        config: { players: 2 },
        difficulty: () => difficulty,
        onGameEnd: (s, r) => {
          results.push(`${r.humanOutcome}:${s.battles}:${sizes(s).join('-')}`);
        },
      });
      return { summary, results };
    };
    const easy = run('easy');
    const normal = run('normal');
    expect(normal.results).toEqual(easy.results);
    expect(normal.summary.outcomes.win).toBe(easy.summary.outcomes.win);
  });
});
