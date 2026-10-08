import { describe, expect, it } from 'vitest';
import { makeDeck, sortHand, type CardCode } from '@/games/core/cards';
import { createRng, shuffle } from '@/games/core/rng';
import { spadesEngine as E, type SpadesMove, type SpadesState } from './engine';
import { easyBid, estimateTricks, normalBid, normalDecision, seatView } from './strategy';
import { bidState, cards, playState } from './test-helpers';

const play = (card: string): SpadesMove => ({ type: 'play', card: card as CardCode });
const normal = (s: SpadesState, seat = 0) => E.botMove(s, seat, 'normal', createRng(1));
const why = (s: SpadesState, seat = 0) => normalDecision(seatView(s, seat)).why;

describe('spades bidding heuristics', () => {
  it('counts a strong hand high', () => {
    const hand = cards('AS KS QS JS 5S AH KH AC KC 2D 3D 4D 5D');
    const est = estimateTricks(hand);
    expect(est.tricks).toBeGreaterThanOrEqual(8);
    expect(est.nilSuitable).toBe(false);
    const s = bidState({ hands: ['AS KS QS JS 5S AH KH AC KC 2D 3D 4D 5D', null, null, null] });
    const b = normalBid(seatView(s, 0));
    expect(b.bid).toBeGreaterThanOrEqual(8);
    expect(b.why).toMatch(/You count about/);
    expect(b.why).toMatch(/A♠/);
  });

  it('counts voids with spare Spades as trumping chances', () => {
    const est = estimateTricks(cards('AS 7S 5S 2S AH KH QH JH TH 9H 2C 3C 4C'));
    expect(est.parts.some((p) => p.includes('no Diamonds'))).toBe(true);
    expect(est.tricks).toBeGreaterThan(4);
    expect(est.tricks).toBeLessThan(6);
  });

  it('bids Nil only with a very weak, safe hand', () => {
    const weak = '2S 4S 7S 3H 5H 8H 2C 4C 6C 9C 3D 5D 7D';
    expect(estimateTricks(cards(weak)).nilSuitable).toBe(true);
    const s = bidState({ hands: [weak, null, null, null] });
    const b = normalBid(seatView(s, 0));
    expect(b.bid).toBe(0);
    expect(b.why).toMatch(/Nil/);
    expect(b.why).toMatch(/100 points/);
    // An Ace, a high Spade, a short King or a fourth Spade spoils a Nil.
    for (const spoiled of [
      'AS 4S 7S 3H 5H 8H 2C 4C 6C 9C 3D 5D 7D',
      '2S 4S QS 3H 5H 8H 2C 4C 6C 9C 3D 5D 7D',
      '2S 4S 7S KH 5H 2C 4C 6C 9C 8C 3D 5D 7D',
      '2S 4S 7S 8S 5H 8H 2C 4C 6C 9C 3D 5D 7D',
    ]) {
      expect(estimateTricks(cards(spoiled)).nilSuitable).toBe(false);
    }
  });

  it('never bids Nil when the partner already bid Nil', () => {
    const weak = '2S 4S 7S 3H 5H 8H 2C 4C 6C 9C 3D 5D 7D';
    const s = bidState({ hands: [weak, null, null, null], dealer: 1, bids: [null, null, 0, 4] });
    expect(s.turn).toBe(0);
    const b = normalBid(seatView(s, 0));
    expect(b.bid).toBe(1);
    expect(b.why).toMatch(/your partner already bid Nil/);
    expect(b.why).toMatch(/Your partner bid Nil, so your tricks alone/);
  });

  it('mentions the team contract once the partner has bid', () => {
    const s = bidState({
      hands: ['AS KS 5S AH KH 7H 2C 3C 4C 5D 6D 7D 8D', null, null, null],
      dealer: 1,
      bids: [null, null, 3, 4],
    });
    expect(normalBid(seatView(s, 0)).why).toMatch(/your team's contract will be/);
  });

  it('easy bids are always 1–13 (never Nil) and roughly follow the hand', () => {
    const deck = makeDeck();
    for (let i = 0; i < 300; i++) {
      const hand = sortHand(shuffle(deck, createRng(`hand-${i}`)).slice(0, 13));
      const s = bidState({ hands: [hand.join(' '), null, null, null] });
      const b = easyBid(seatView(s, 0), createRng(i));
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(13);
      const n = normalBid(seatView(s, 0)).bid;
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(13);
    }
  });
});

describe('spades normal play', () => {
  it('Nil bidder: plays the highest card that still loses', () => {
    const s = playState({
      hands: ['KH 8H 2H 4C 9D 3S 5S 8S 9S TS JS QS AS', null, null, null],
      dealer: 2,
      trick: '3: 9H',
      bids: [0, 3, 3, 3],
    });
    expect(normal(s)).toEqual(play('8H'));
    expect(why(s)).toMatch(/You bid Nil/);
  });

  it('Nil bidder: forced to win as the last player, gets rid of the highest card', () => {
    const s = playState({
      hands: ['KH QH 4C 9D 3S 5S 8S 9S TS JS QS AS 2S', null, null, null],
      dealer: 0,
      trick: '1: 2H 3H 4H',
      bids: [0, 3, 3, 3],
    });
    expect(normal(s)).toEqual(play('KH'));
  });

  it('Nil bidder: when every card wins but others still play, plays the lowest', () => {
    const s = playState({
      hands: ['KH QH 4C 9D 3S 5S 8S 9S TS JS QS AS 2S', null, null, null],
      dealer: 1,
      trick: '2: 2H 3H',
      bids: [0, 3, 3, 3],
    });
    expect(normal(s)).toEqual(play('QH'));
  });

  it('Nil bidder: leads the card most likely to be beaten', () => {
    const s = playState({
      hands: ['2H 9H 4C KD 3S 5S 8S 9S TS JS QS AS 2S', null, null, null],
      bids: [0, 3, 3, 3],
    });
    expect(normal(s)).toEqual(play('2H'));
  });

  it('covers a partner’s Nil: overtakes the partner’s winning card', () => {
    const s = playState({
      hands: ['KD TD 3D 4C 9C 3S 5S 8S 9S TS JS QS AS', null, null, null],
      dealer: 0,
      trick: '1: 5D 9D 6D',
      bids: [3, 3, 0, 3],
    });
    expect(normal(s)).toEqual(play('TD'));
    expect(why(s)).toMatch(/partner bid Nil/);
  });

  it('covers a partner’s Nil: plays high when the partner plays later', () => {
    const s = playState({
      hands: ['KD TD 3D 4C 9C 3S 5S 8S 9S TS JS QS AS', null, null, null],
      dealer: 2,
      trick: '3: 5D',
      bids: [3, 3, 0, 3],
    });
    expect(normal(s)).toEqual(play('KD'));
  });

  it('covers a partner’s Nil: leads a sure winner', () => {
    const s = playState({
      hands: ['AH 3H 4C 9D 3S 5S 8S 9S TS JS QS KS 2S', null, null, null],
      bids: [3, 3, 0, 3],
    });
    expect(normal(s)).toEqual(play('AH'));
  });

  it('does not trump a partner’s sure winner', () => {
    const s = playState({
      hands: ['KC 4C 9D 8D 3S 5S 8S 9S TS JS QS AS 2S', null, null, null],
      dealer: 1,
      trick: '2: AH 3H',
    });
    expect(normal(s)).toEqual(play('4C'));
    expect(why(s)).toMatch(/partner's A♥ is already winning/);
  });

  it('trumps with a low Spade when void and the opponents are winning', () => {
    const s = playState({
      hands: ['KC 4C 9D 8D 3S 5S 8S 9S TS JS QS AS 2S', null, null, null],
      dealer: 2,
      trick: '3: KH',
    });
    expect(normal(s)).toEqual(play('2S'));
  });

  it('second hand low: keeps a King back when the Ace is still out and partner plays later', () => {
    const s = playState({
      hands: ['KC 4C 9D 8D 3S 5S 8S 9S TS JS QS AS 2S', null, null, null],
      dealer: 2,
      trick: '3: 5C',
    });
    expect(normal(s)).toEqual(play('4C'));
    expect(why(s)).toMatch(/second hand low/);
  });

  it('third hand high: plays the cheaper of touching high cards', () => {
    const s = playState({
      hands: ['KC QC 4C 9D 3S 5S 8S 9S TS JS QS AS 2S', null, null, null],
      dealer: 1,
      trick: '2: 5C 7C',
    });
    expect(normal(s)).toEqual(play('QC'));
  });

  it('cashes a sure winner while the opponents can still be set', () => {
    const s = playState({
      hands: ['AH 3H 9C 3C QD 8D 3S 5S 8S 9S TS', null, null, null],
      history: ['0: AD 2D 3D 4D', '0: KD 5D 6D 7D'],
      bids: [1, 3, 1, 3],
    });
    expect(s.turn).toBe(0);
    expect(normal(s)).toEqual(play('AH'));
    expect(why(s)).toMatch(/stop the opponents/);
  });

  it('ducks to avoid bags once both contracts are settled', () => {
    // Team 0 bid 2 and has 2; the opponents bid 13 and are already set.
    const lead = playState({
      hands: ['AH KH 2H 9C 3C QD 8D 3S 5S 8S 9S', null, null, null],
      history: ['0: AD 2D 3D 4D', '0: KD 5D 6D 7D'],
      bids: [1, 6, 1, 7],
    });
    expect(normal(lead)).toEqual(play('2H'));
    expect(why(lead)).toMatch(/bags/);
    const follow = playState({
      hands: ['KH TH 8H 2H 9C 3C 3S 5S 8S 9S', null, null, null],
      history: ['0: AD 2D 3D 4D', '0: KD 5D 6D 7D', '0: 8D QD 9D TD'],
      trick: '1: 9H 5H 4H',
      bids: [1, 6, 1, 7],
    });
    expect(normal(follow)).toEqual(play('8H'));
  });

  it('lets an opponent who bid Nil keep winning the trick', () => {
    const s = playState({
      hands: ['KD 5D 4C 9C 3S 5S 8S 9S TS JS QS AS 2S', null, null, null],
      dealer: 0,
      trick: '1: 8D 2D 3D',
      bids: [3, 0, 3, 3],
    });
    expect(normal(s)).toEqual(play('5D'));
    expect(why(s)).toMatch(/Player 1 bid Nil/);
  });

  it('leads low against an opponent’s Nil', () => {
    const s = playState({
      hands: ['KH 3H 4C 9D 3S 5S 8S 9S TS JS QS AS 2S', null, null, null],
      bids: [3, 0, 3, 3],
    });
    expect(normal(s)).toEqual(play('3H'));
  });
});

describe('spades normal play: one-hand scoring and honest reasons', () => {
  it('keeps competing for tricks while they can still decide this one-hand game', () => {
    // A real position (reached by legal bot play). Both teams bid 5 and have made
    // it; the score is 51–50-ish, so whoever takes more of the last 3 tricks wins.
    // Ducking with the 10♣ (the old "avoid bags" habit) loses the hand 51–52;
    // over-trumping with the 10♠ wins it 52–51.
    const s = playState({
      hands: ['TS 8C TC', '7S 8H', 'QH KH', 'JD KD'],
      bids: [2, 3, 3, 2],
      dealer: 3,
      history: [
        '0: AD 4D 3D 2D',
        '0: TH AH 3H 2H',
        '1: 8D 3S 5D 6D',
        '2: KC 9C 5C 2C',
        '2: AC JC 6C 4C',
        '2: 9H 6H 2S 4H',
        '0: 9D AS 3C 7D',
        '1: QC 4S 6S 7C',
        '3: KS 9S 5S QS',
        '3: TD QD JS 7H',
      ],
      trick: '1: 5H JH 8S',
    });
    expect(s.turn).toBe(0);
    expect(normal(s)).toEqual(play('TS'));
    expect(why(s)).toMatch(/still close/);
    // Following the advice wins the hand; ducking would have lost it.
    const finish = (st: SpadesState) => {
      let x = st;
      while (!E.isOver(x)) x = E.applyMove(x, normal(x, E.currentPlayer(x)!));
      return E.result(x).humanOutcome;
    };
    expect(finish(E.applyMove(s, play('TS')))).toBe('win');
    expect(finish(E.applyMove(s, play('TC')))).toBe('loss');
  });

  it('ducks for bags only once the result is locked, and says why', () => {
    const lead = playState({
      hands: ['AH KH 2H 9C 3C QD 8D 3S 5S 8S 9S', null, null, null],
      history: ['0: AD 2D 3D 4D', '0: KD 5D 6D 7D'],
      bids: [1, 6, 1, 7],
    });
    expect(normal(lead)).toEqual(play('2H'));
    expect(why(lead)).toMatch(/can no longer change/);
    expect(why(lead)).toMatch(/every 10 bags cost 100 points/);
  });

  it('never pushes the team contract past 13 tricks', () => {
    const s = bidState({
      hands: ['AS KS QS JS TS 9S AH KH QH AC KC 2D 3D', null, null, null],
      dealer: 1,
      bids: [null, null, 9, 4],
    });
    expect(estimateTricks(s.hands[0]!).tricks).toBeGreaterThan(5);
    const b = normalBid(seatView(s, 0));
    expect(b.bid).toBe(4);
    expect(b.why).toMatch(/only 13 tricks/);
  });

  it('only promises a sure trick when no opponent can trump it', () => {
    // Hedged: the A♥ is the boss Heart, but an opponent may be out of Hearts.
    const hedged = playState({
      hands: ['AH 3H 9C 3C QD 8D 3S 5S 8S 9S TS', null, null, null],
      history: ['0: AD 2D 3D 4D', '0: KD 5D 6D 7D'],
      bids: [1, 3, 1, 3],
    });
    expect(normal(hedged)).toEqual(play('AH'));
    expect(why(hedged)).toMatch(/should win the trick — unless an opponent .* trumps it/);
    // Certain: both opponents have shown they hold no Spades.
    const certain = playState({
      hands: ['AH KH QH JH TH AC KC QC JC TC', null, '6S 7S 8S 9S TS JS QS KS 2H 2C', null],
      dealer: 0,
      history: ['1: 2D 3D 4D 2S', '0: 3S 5D 4S 6D', '2: 5S 7D AS 8D'],
    });
    expect(certain.turn).toBe(0);
    // The 10♥ is as good as the A♥ here: every higher Heart is in the leader's own hand.
    expect(normal(certain)).toEqual(play('TH'));
    expect(why(certain)).toMatch(
      /every higher one is gone or in your hand\), so lead it: it wins the trick\.$/,
    );
  });

  it('hedges a following "winner" that a void opponent could still trump', () => {
    const s = playState({
      hands: ['AC 4C 9D 8D 3S 5S 8S 9S TS JS QS KS 2S', null, null, null],
      dealer: 1,
      trick: '2: 5C 7C',
    });
    expect(normal(s)).toEqual(play('AC'));
    expect(why(s)).toBe(
      'The A♣ beats the 7♣ and every higher Club is gone, so it should win the trick for your team — unless an opponent still to play has run out of Clubs and trumps it.',
    );
  });

  it('a Nil bidder holding only top cards is told the lead is hard to lose', () => {
    const s = playState({
      hands: ['AH KH QH JH AC KC QC JC AD KD QD JD TD', null, null, null],
      bids: [0, 3, 3, 3],
    });
    expect(why(s)).toMatch(/no higher card of that suit is still out/);
  });
});

describe('spades coach situation text', () => {
  it('does not offer a trump to a void player who has no Spades', () => {
    const s = playState({
      hands: ['KC 5C 9D 8D 7D 6D 5D 4D 3D 2D AD QD', null, null, null],
      trick: '3: 9H',
      history: ['0: 2C 3C 4C AC'],
    });
    expect(E.coach(s, 0).situation).toMatch(
      /You have no Hearts and no Spades, so you may throw away any card/,
    );
  });

  it('counts only the non-Nil partner’s tricks toward the bid', () => {
    // Seat 2 bid Nil and won the first trick; seat 0 (bid 3) has won none.
    const s = playState({
      hands: [null, null, null, null],
      dealer: 1,
      history: ['2: AD 2D 3D 4D'],
      bids: [3, 3, 0, 3],
    });
    expect(E.coach(s, 2).situation).toBeTruthy();
    expect(E.coach(s, 0).situation).toMatch(
      /Your team bid 3 and has won 0 tricks toward the bid \(3 more needed\); your partner's Nil is broken \(1 trick taken\)/,
    );
  });
});

describe('spades easy play', () => {
  it('is legal and prefers sensible cards', () => {
    const s = playState({
      hands: ['KH 8H 2H 4C 9D 3S 5S 8S 9S TS JS QS AS', null, null, null],
      dealer: 2,
      trick: '3: 9H',
      bids: [3, 3, 3, 3],
    });
    const seen = new Map<string, number>();
    for (let i = 0; i < 200; i++) {
      const m = E.botMove(s, 0, 'easy', createRng(`easy-${i}`));
      expect(['play:KH', 'play:8H', 'play:2H']).toContain(E.moveKey(m));
      seen.set(E.moveKey(m), (seen.get(E.moveKey(m)) ?? 0) + 1);
    }
    expect(seen.get('play:2H') ?? 0).toBeGreaterThan(seen.get('play:8H') ?? 0);
  });
});
