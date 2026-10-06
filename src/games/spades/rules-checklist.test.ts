/**
 * Rule-by-rule checklist for the Spades variant in docs/RULES_DECISIONS.md and
 * docs/engine-notes/spades.md. Each test pins one rule (or one edge of it) so a
 * regression names the rule it broke.
 */
import { describe, expect, it } from 'vitest';
import { type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { spadesEngine as E, type SpadesMove, type SpadesState } from './engine';
import { beats, breaksSpades, scoreTeam, winningPlay, type SpadesPlay } from './rules';
import { finishedHand, playState, winnersFor } from './test-helpers';

const play = (card: string): SpadesMove => ({ type: 'play', card: card as CardCode });
const bid = (tricks: number): SpadesMove => ({ type: 'bid', tricks });
const keys = (s: SpadesState, seat: number) => E.legalMoves(s, seat).map((m) => E.moveKey(m));
const plays = (leader: number, list: string): SpadesPlay[] =>
  list.split(' ').map((card, i) => ({ seat: (leader + i) % 4, card: card as CardCode }));
const over = (bids: number[], counts: number[]) =>
  E.result(finishedHand({ bids, winners: winnersFor(counts) }));

describe('checklist: seats, dealer and turn order', () => {
  it('for every dealer: bidding and the first lead start on the dealer’s left', () => {
    for (let dealer = 0; dealer < 4; dealer++) {
      let s = E.setup({ players: 4, options: { dealer } }, createRng(`dealer-${dealer}`));
      const order: number[] = [];
      while (s.phase === 'bid') {
        order.push(s.turn);
        s = E.applyMove(s, bid(3));
      }
      const left = (dealer + 1) % 4;
      expect(order).toEqual([0, 1, 2, 3].map((k) => (left + k) % 4));
      expect(E.currentPlayer(s)).toBe(left);
      expect(s.leader).toBe(left);
    }
  });

  it('partnerships are seats 0 & 2 against 1 & 3 (team scores are shared)', () => {
    const r = over([3, 3, 3, 3], [4, 0, 3, 6]);
    // Team 0 took 7 of 13 (seat 0: 4, seat 2: 3); team 1 took 6 (seat 3 alone).
    expect(r.scores).toEqual([61, 60, 61, 60]);
    expect(r.winners).toEqual([0, 2]);
  });
});

describe('checklist: bidding', () => {
  it('any bid 0–13 is allowed regardless of the other bids (no total limit)', () => {
    let s = E.setup({ players: 4, options: { dealer: 3 } }, createRng('bids'));
    for (let k = 0; k < 4; k++) {
      expect(E.checkMove(s, s.turn, bid(13)).ok).toBe(true);
      s = E.applyMove(s, bid(13));
    }
    expect(s.bids).toEqual([13, 13, 13, 13]);
    expect(s.phase).toBe('play');
  });

  it('both partners may bid Nil (double Nil)', () => {
    let s = E.setup({ players: 4, options: { dealer: 3 } }, createRng('double-nil'));
    s = E.applyMove(s, bid(0)); // seat 0
    s = E.applyMove(s, bid(4)); // seat 1
    expect(keys(s, 2)).toContain('bid:0');
    s = E.applyMove(s, bid(0)); // seat 2
    expect(s.bids.slice(0, 3)).toEqual([0, 4, 0]);
  });

  it('there is no Blind Nil or any other bid-phase move', () => {
    const s = E.setup({ players: 4, options: { dealer: 3 } }, createRng('blind'));
    expect(E.legalMoves(s, 0).every((m) => m.type === 'bid')).toBe(true);
    expect(E.checkMove(s, 0, { type: 'blindNil' } as unknown as SpadesMove).ok).toBe(false);
  });
});

describe('checklist: trick play', () => {
  it('must follow a Spade lead with a Spade when holding one', () => {
    const s = playState({
      hands: ['KC 4C 9D 8D 3S 5S AH 9S TS JS QS AS', null, null, null],
      trick: '3: 2S',
      history: ['0: 2D 3D 4D AD'],
    });
    expect(keys(s, 0).every((k) => k.endsWith('S'))).toBe(true);
    expect(E.checkMove(s, 0, play('AH')).reason).toMatch(/Spades were led/);
  });

  it('Aces are high; an off-suit card never wins; any Spade beats every other suit', () => {
    expect(winningPlay(plays(0, 'KH AH 2H QH')).card).toBe('AH');
    expect(winningPlay(plays(0, '2H AC AD KH')).card).toBe('KH');
    expect(winningPlay(plays(0, '3D AD 2S KD')).card).toBe('2S');
    expect(winningPlay(plays(0, '3D 2S AS 4S')).card).toBe('AS');
    expect(beats('AC', '2H', 'H')).toBe(false);
    expect(beats('2S', 'AD', 'D')).toBe(true);
  });

  it('a Spade played on another suit breaks Spades; a Spade lead or follow does not', () => {
    expect(breaksSpades(plays(0, '9H'), '2S')).toBe(true);
    expect(breaksSpades(plays(0, '9H KH 2C'), '2S')).toBe(true);
    expect(breaksSpades([], '2S')).toBe(false);
    expect(breaksSpades(plays(0, '4S'), '9S')).toBe(false);
    expect(breaksSpades(plays(0, '9H'), 'KC')).toBe(false);
  });

  it('a hand of only Spades may lead one before Spades are broken; others may not', () => {
    const allSpades = playState({
      hands: ['AS KS QS JS TS 9S 8S 7S 6S 5S 4S 3S 2S', null, null, null],
    });
    expect(E.checkMove(allSpades, 0, play('2S')).ok).toBe(true);
    const mixed = playState({
      hands: ['AS KS QS JS TS 9S 8S 7S 6S 5S 4S 3S 2H', null, null, null],
    });
    expect(keys(mixed, 0)).toEqual(['play:2H']);
  });

  it('the winner of a trick leads the next one, even when it was trumped', () => {
    let s = playState({
      hands: ['KC 4C 9D 8D 3S 5S 8S 9S TS JS QS AS', null, null, null],
      trick: '1: AH 2H 3H',
      history: ['0: 2D AD 3D 4D'],
    });
    s = E.applyMove(s, play('3S'));
    expect(s.tricks[1]!.winner).toBe(0);
    expect(E.currentPlayer(s)).toBe(0);
    expect(s.spadesBroken).toBe(true);
    expect(keys(s, 0)).toContain('play:AS');
  });
});

describe('checklist: scoring', () => {
  it('making the bid exactly is made (no bags); one short is set', () => {
    expect(scoreTeam(0, [3, 0, 3, 0], [3, 0, 3, 0]).total).toBe(60);
    expect(scoreTeam(0, [3, 0, 3, 0], [3, 0, 2, 0]).total).toBe(-60);
  });

  it('a team contract above 13 can never be made', () => {
    const s = scoreTeam(0, [7, 0, 7, 0], [7, 0, 6, 0]);
    expect(s).toMatchObject({ contract: 14, made: false, contractPoints: -140, bags: 0 });
  });

  it('a set team earns nothing for extra tricks, but a Nil bidder’s tricks are still bags', () => {
    expect(scoreTeam(0, [5, 0, 4, 0], [4, 0, 4, 0])).toMatchObject({ bags: 0, total: -90 });
    expect(scoreTeam(0, [0, 0, 6, 0], [3, 0, 5, 0])).toMatchObject({
      made: false,
      bags: 3,
      nilPoints: -100,
      total: -60 - 100 + 3,
    });
  });

  it('a made Nil next to a set partner still scores +100', () => {
    expect(scoreTeam(1, [0, 0, 0, 6], [0, 0, 0, 5])).toMatchObject({
      nilPoints: 100,
      contractPoints: -60,
      total: 40,
    });
  });
});

describe('checklist: result, payout and flags', () => {
  it('payout is exactly +1 / −1 / 0 and never below −1 (maxLossUnits 1)', () => {
    expect(over([4, 3, 3, 3], [4, 3, 3, 3]).humanNetUnits).toBe(1);
    expect(over([5, 3, 4, 3], [4, 3, 3, 3]).humanNetUnits).toBe(-1);
    expect(over([4, 4, 4, 4], [3, 4, 3, 3]).humanNetUnits).toBe(0);
    // The worst possible hand for the learner still costs only one unit.
    const worst = over([0, 1, 13, 1], [13, 0, 0, 0]);
    expect(worst.scores![0]).toBe(-130 - 100 + 13);
    expect(worst.humanNetUnits).toBe(-1);
  });

  it('bigPot starts at a 100-point winning margin', () => {
    // Us: bid 2, took 2 → 20. Them: a failed Nil (−100 + 1 bag) and a 1-bid that took 10 (19).
    const at100 = over([1, 0, 1, 1], [0, 1, 2, 10]);
    expect(at100.scores!.slice(0, 2)).toEqual([20, -80]);
    expect(at100.flags.bigPot).toBe(true);
    const at99 = over([1, 0, 1, 2], [0, 1, 6, 6]);
    expect(at99.scores!.slice(0, 2)).toEqual([24, -75]);
    expect(at99.flags.bigPot).toBe(false);
    // Losing by 100 is never a big pot.
    expect(over([1, 1, 1, 0], [1, 10, 2, 0]).flags.bigPot).toBe(false);
  });

  it('closeFinish is a margin of 10 or less (10 counts, 11 does not)', () => {
    const at10 = over([1, 0, 4, 3], [0, 1, 0, 12]);
    expect(at10.scores!.slice(0, 2)).toEqual([-50, -60]);
    expect(at10.flags.closeFinish).toBe(true);
    const at11 = over([1, 0, 3, 4], [0, 1, 0, 12]);
    expect(at11.scores!.slice(0, 2)).toEqual([-40, -51]);
    expect(at11.flags.closeFinish).toBe(false);
  });

  it('comeback needs a win: making the bid late but losing the hand is not a comeback', () => {
    // Team 0 bid 6 and needed 3 of the last 4 tricks — and made it — but the
    // opponents' Nil (+100) still beat them.
    const lost = finishedHand({
      bids: [3, 0, 3, 3],
      winners: [0, 0, 0, 3, 3, 3, 3, 3, 3, 2, 2, 2, 3],
    });
    const r = E.result(lost);
    expect(r.humanOutcome).toBe('loss');
    expect(r.flags.comeback).toBe(false);
  });

  it('luckyLastCard also fires when the last trick breaks an opponent’s Nil', () => {
    const s = finishedHand({
      bids: [3, 3, 3, 0],
      winners: [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 3],
    });
    const r = E.result(s);
    // Before trick 13 the opponents led 133–60; seat 3's Nil broke on the last trick.
    expect(r.scores!.slice(0, 2)).toEqual([60, -66]);
    expect(r.humanOutcome).toBe('win');
    expect(r.flags.luckyLastCard).toBe(true);
    expect(r.flags.tags).toContain('bustedNil');
  });

  it('a partner’s failed Nil is not the learner’s bust when the learner made the bid', () => {
    const r = over([4, 3, 0, 3], [4, 4, 1, 4]);
    expect(r.humanOutcome).toBe('loss');
    expect(r.flags.tags).toContain('nilFailed');
    expect(r.flags.bust).toBe(false);
  });

  it('perfect: an exact bid spoiled by a failed partner Nil is not perfect', () => {
    const r = over([4, 3, 0, 3], [4, 4, 1, 4]);
    expect(r.flags.perfect).toBe(false);
    expect(r.flags.tags).not.toContain('exactBid');
  });
});
