/**
 * Adversarial rules audit for Hearts: one focused test per rule edge case, regression
 * tests for every bug found during verification, and fuzzing with uniformly random
 * legal moves (not just bot moves) across every passing direction.
 */
import { describe, expect, it } from 'vitest';
import {
  cardName,
  cardShort,
  makeDeck,
  rankNumberAceHigh,
  suitOf,
  SUIT_SINGULAR,
  type CardCode,
} from '@/games/core/cards';
import { createRng, type Rng } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import { IllegalMoveError, type Difficulty } from '@/games/core/types';
import {
  heartsEngine as E,
  type HeartsMove,
  type HeartsPassDirection,
  type HeartsState,
} from './engine';
import { passSource, scoreHand, lowestScorers, payoutUnits, winningPlay } from './rules';
import { normalDecision, seatView } from './strategy';
import { ALL_HEARTS, cards, playState } from './test-helpers';

const DECK = makeDeck();
const play = (card: string): HeartsMove => ({ type: 'play', card: card as CardCode });
const pass = (list: string): HeartsMove => ({ type: 'pass', cards: cards(list) });
const playable = (s: HeartsState) =>
  E.legalMoves(s, E.currentPlayer(s)!)
    .map((m) => (m.type === 'play' ? m.card : ''))
    .sort();
const reasonFor = (s: HeartsState, seat: number, m: HeartsMove) => {
  const check = E.checkMove(s, seat, m);
  expect(check.ok).toBe(false);
  return check.reason ?? '';
};
const decision = (s: HeartsState) => normalDecision(seatView(s, E.currentPlayer(s)!));
const rank = rankNumberAceHigh;
const DIRECTIONS: readonly HeartsPassDirection[] = ['left', 'right', 'across', 'hold'];

/** Cards still "out" for seat 0: not played yet and not in its own hand. */
function outFrom0(s: HeartsState): CardCode[] {
  const played = new Set<CardCode>([
    ...s.tricks.flatMap((t) => t.plays.map((p) => p.card)),
    ...s.trick.map((p) => p.card),
  ]);
  return DECK.filter((c) => !played.has(c) && !(s.hands[0] ?? []).includes(c));
}

/** Cards seat 0 cannot see: still out, and not among the cards it passed itself. */
function hiddenFrom0(s: HeartsState): CardCode[] {
  return outFrom0(s).filter((c) => !(s.passed[0] ?? []).includes(c));
}

/** Finish the current trick with bots and return the completed trick's winner. */
function trickWinnerAfter(s: HeartsState, m: HeartsMove, rng: Rng): number {
  const index = s.tricks.length;
  let t = E.applyMove(s, m);
  while (t.tricks.length === index) {
    t = E.applyMove(t, E.botMove(t, E.currentPlayer(t)!, 'normal', rng));
  }
  return t.tricks[index]!.winner;
}

describe('hearts audit: first trick', () => {
  it('the Two of Clubs holder may lead nothing else, even holding the Queen of Spades and Hearts', () => {
    const s = playState({ hands: ['2C QS AH KH 3D 4D 5D 6D 7D 8D 9D TD JD', null, null, null] });
    expect(playable(s)).toEqual(['2C']);
    expect(reasonFor(s, 0, play('QS'))).toMatch(/starts with the Two of Clubs/);
  });

  it('a Club holder must follow with a Club on the first trick (even a high one)', () => {
    const s = playState({
      hands: [null, 'AC QS AH KH 3D 4D 5D 6D 7D 8D 9D TD JD', null, null],
      trick: '0: 2C',
    });
    expect(playable(s)).toEqual(['AC']);
  });

  it('void in Clubs with one safe card left: that card is forced, with a specific reason', () => {
    const s = playState({
      hands: ['QS 2H 3H 4H 5H 6H 7H 8H 9H TH JH QH 2S', null, null, null],
      trick: '1: 2C 3C 4C',
    });
    expect(playable(s)).toEqual(['2S']);
    expect(reasonFor(s, 0, play('QS'))).toBe(
      "No points on the first trick: you can't play the Queen of Spades on the first trick while you still have a card that isn't worth points (like your 2♠).",
    );
    expect(decision(s).why).toBe(
      "You have no Clubs, and points aren't allowed on the first trick, so the 2♠ — your only card that isn't a Heart or the Queen of Spades — is the one you must play.",
    );
  });

  it('void in Clubs holding the Queen of Spades and Diamonds: only Diamonds', () => {
    const s = playState({
      hands: ['QS 2D 3D 4D 5D 6D 7D 8D 9D TD JD QD KD', null, null, null],
      trick: '1: 2C 3C 4C',
    });
    expect(playable(s)).toEqual(cards('2D 3D 4D 5D 6D 7D 8D 9D TD JD QD KD').sort());
  });

  it('a first-trick Heart (all-Heart hand) breaks Hearts for the next lead', () => {
    const s = playState({ hands: [ALL_HEARTS, null, null, null], trick: '1: 2C 3C 4C' });
    const next = E.applyMove(s, play('2H'));
    expect(next.heartsBroken).toBe(true);
    const leader = E.currentPlayer(next)!;
    const hearts = next.hands[leader]!.filter((c) => suitOf(c) === 'H');
    for (const h of hearts) expect(E.checkMove(next, leader, play(h)).ok).toBe(true);
  });

  it('the coach explains a first-trick discard without claiming you have nothing dangerous', () => {
    const s = playState({
      hands: ['AH KH 2S 3S 4S 5S 6S 7S 8S 9D TD JD QD', null, null, null],
      trick: '1: 2C 3C 4C',
    });
    const d = decision(s);
    expect(E.checkMove(s, 0, d.move).ok).toBe(true);
    expect(d.why).not.toMatch(/nothing dangerous/);
    expect(d.why).toMatch(/points aren't allowed on the first trick/);
  });
});

describe('hearts audit: leading', () => {
  const afterFirst = ['0: 2C 3C 4C 5C']; // seat 3 wins with the 5♣ and leads trick 2

  it('the Queen of Spades may be led before Hearts are broken', () => {
    const s = playState({
      hands: [null, null, null, 'QS 2D 3D 4D 5D 6D 7D 8D 9D TD JD QD'],
      history: afterFirst,
    });
    expect(E.checkMove(s, 3, play('QS')).ok).toBe(true);
    const next = E.applyMove(s, play('QS'));
    expect(next.heartsBroken).toBe(false);
  });

  it('holding only Hearts and the Queen of Spades before Hearts are broken, only the Queen may be led', () => {
    const s = playState({
      hands: [null, null, null, 'QS 2H 3H 4H 5H 6H 7H 8H 9H TH JH QH'],
      history: afterFirst,
    });
    expect(playable(s)).toEqual(['QS']);
    expect(reasonFor(s, 3, play('2H'))).toMatch(/Lead a Spade instead\.$/);
  });

  it('once Hearts are broken any suit may be led, even while holding other suits', () => {
    const s = playState({
      hands: [null, null, null, '2H 3H 2S 3S 4S 5S 6D 7D 8D 9D TD JD'],
      history: ['0: 2C 3C 4C 5C'],
      heartsBroken: true,
    });
    expect(playable(s)).toEqual(cards('2H 3H 2S 3S 4S 5S 6D 7D 8D 9D TD JD').sort());
  });

  it("the coach names only the suits you can actually lead while Hearts aren't broken", () => {
    const s = playState({
      hands: ['2H 3H 4H 5H 6H 7H 8H 9H 2D 3D 4D 5D', null, null, null],
      history: ['1: 2C 3C 4C AC'],
    });
    expect(E.currentPlayer(s)).toBe(0);
    expect(E.coach(s, 0).situation).toBe(
      "Trick 2 of 13 — it's your lead. Hearts aren't broken yet, so lead a Diamond. You have taken 0 points so far.",
    );
  });

  it('the coach explains a lead forced by unbroken Hearts', () => {
    const s = playState({
      hands: [null, null, null, '2H 3H 4H 5H 6H 7H 8H 9H TH JH QH 6D'],
      history: afterFirst,
    });
    expect(decision(s).why).toBe(
      "Hearts aren't broken yet and the 6♦ is your only card that isn't a Heart, so you must lead it.",
    );
  });

  it('bug: the normal bot led the last card of a suit nobody else holds, inviting every dump', () => {
    // All 12 other Diamonds are gone, so a Diamond lead lets all three opponents discard
    // points on it. The Q♣ only has one known-void opponent behind it.
    const s = playState({
      hands: ['AD QC 2H 3H 4H 5H 6H 7H', null, null, '3S 4S 5S 8H 9H TH JH QH'],
      history: [
        '0: 2C 3C 4C KC',
        '3: 2D 3D 4D 5D',
        '2: 6D 7D 8D 9D',
        '1: TD JD QD KD',
        '0: AC 6C 7C 2S',
      ],
    });
    expect(E.currentPlayer(s)).toBe(0);
    expect(playable(s)).toEqual(['AD', 'QC']);
    const d = decision(s);
    expect(d.move).toEqual(play('QC'));
    expect(d.why).toBe(
      'Lead the Q♣: of the cards you may lead, it is the least likely to land you points.',
    );
  });

  it('bug: a high lead was explained as "low cards rarely win tricks"', () => {
    let leads = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let s = E.setup({ players: 4 }, createRng(`lead-why-${seed}`));
      const rng = createRng(`lead-why-bots-${seed}`);
      while (!E.isOver(s)) {
        const p = E.currentPlayer(s)!;
        if (s.phase === 'play' && s.trick.length === 0 && s.tricks.length > 0) {
          const d = normalDecision(seatView(s, p));
          const c = d.move.type === 'play' ? d.move.card : null;
          if (c && /\blow\b/i.test(d.why)) {
            expect(rank(c), d.why).toBeLessThan(10);
          }
          leads++;
        }
        s = E.applyMove(s, E.botMove(s, p, 'normal', rng));
      }
    }
    expect(leads).toBeGreaterThan(400);
  });
});

describe('hearts audit: trick winners and scoring', () => {
  it('Aces are high and only the led suit can win', () => {
    const plays = (list: string) => cards(list).map((card, i) => ({ seat: i, card }));
    expect(winningPlay(plays('KC AC 2C QC')).seat).toBe(1);
    expect(winningPlay(plays('2C AD AS AH')).seat).toBe(0);
    expect(winningPlay(plays('3H 2H AS 4H')).seat).toBe(3);
  });

  it('25 points for one player and 1 for another is not a moon', () => {
    expect(scoreHand([25, 1, 0, 0])).toEqual({ scores: [25, 1, 0, 0], moonShooter: null });
    expect(lowestScorers([25, 1, 0, 0])).toEqual([2, 3]);
  });

  it('moon payouts: the shooter alone wins +3, everybody else pays exactly one stake', () => {
    const { scores } = scoreHand([0, 0, 26, 0]);
    const winners = lowestScorers(scores);
    expect(winners).toEqual([2]);
    expect(payoutUnits(2, winners)).toBe(3);
    for (const seat of [0, 1, 3]) expect(payoutUnits(seat, winners)).toBe(-1);
  });
});

describe('hearts audit: passing', () => {
  for (const dir of ['left', 'right', 'across'] as const) {
    it(`passing ${dir}: the last pass announces exactly what you receive`, () => {
      let s = E.setup({ players: 4, options: { passDirection: dir } }, createRng(`ann-${dir}`));
      while (s.turn < 3) s = E.applyMove(s, { type: 'pass', cards: s.hands[s.turn]!.slice(0, 3) });
      const last: HeartsMove = { type: 'pass', cards: s.hands[3]!.slice(-3) };
      const text = E.describeMove(s, 3, last);
      const after = E.applyMove(s, last);
      const incoming = after.received[0]!;
      expect(after.passed[passSource(0, dir)]).toEqual(incoming);
      for (const c of incoming) expect(text).toContain(cardName(c));
      // Nothing seat 0 does not now hold is named.
      for (const c of DECK.filter((x) => !after.hands[0]!.includes(x))) {
        expect(text).not.toContain(cardName(c));
      }
      const holder = after.hands.findIndex((h) => h.includes('2C'));
      expect(E.currentPlayer(after)).toBe(holder);
    });
  }

  it("a pass in a 'hold' hand is explained as there being no passing at all", () => {
    const s = E.setup({ players: 4, options: { passDirection: 'hold' } }, createRng(3));
    const p = E.currentPlayer(s)!;
    expect(reasonFor(s, p, pass(s.hands[p]!.slice(0, 3).join(' ')))).toBe(
      "There's no passing this hand — everyone keeps their cards, so just play a card.",
    );
  });
});

describe('hearts audit: coach and bot explanations', () => {
  it("bug: the coach's trick summary capitalised “Your” mid-sentence", () => {
    const s = playState({
      hands: [null, null, null, null],
      history: ['0: 2C 3C 4C 5C'],
      trick: '3: 5D 9D',
    });
    expect(E.coach(s, 0).situation).toBe(
      'Trick 2 of 13. Player 3 led the 5♦; your 9♦ is winning so far. Waiting for Player 1 to play. You have taken 0 points so far.',
    );
  });

  it('bug: dropping the Queen under the K♠ named a taker although the A♠ could still beat it', () => {
    // Player 2 led the 5♠, Player 3 played the K♠; Player 1 (still to play) may hold the A♠.
    const unsettled = playState({
      hands: [
        'QS 2S 3S 4S 6D 7D 8D 9D TD JD QD KD',
        'AS 6S 7S 8S AD 2D 3D 4D 5D 6C 7C 8C',
        null,
        null,
      ],
      history: ['3: 2C 3C 4C 5C'],
      trick: '2: 5S KS',
    });
    expect(E.currentPlayer(unsettled)).toBe(0);
    const d = decision(unsettled);
    expect(d.move).toEqual(play('QS'));
    expect(d.why).toBe(
      "Drop the Queen of Spades under the K♠ — she can't win this trick now, so whoever wins this trick takes her 13 points, not you.",
    );
    // Once the A♠ has been played the K♠ is certain to win, so the taker can be named…
    const aceGone = playState({
      hands: ['QS 2S 3S 4S 6D 7D 8D 9D TD JD QD', null, null, null],
      history: ['0: 2C 3C 4C 5C', '3: 7S 8S 9S AS'],
      trick: '2: 5S KS',
    });
    expect(E.currentPlayer(aceGone)).toBe(0);
    expect(decision(aceGone).why).toBe(
      "Drop the Queen of Spades under the K♠ — she can't win this trick now, so Player 3 will take her 13 points, not you.",
    );
    // …and so can it when you are the last to play.
    const last = playState({
      hands: ['QS 2S 3S 4S 6D 7D 8D 9D TD JD QD', null, null, null],
      history: ['3: 2C 3C 4C 5C', '2: 9S 7S 8S AS'],
      trick: '1: 5S KS 6S',
    });
    expect(E.currentPlayer(last)).toBe(0);
    expect(decision(last).why).toMatch(/so Player 2 will take her 13 points, not you\.$/);
  });

  it('bug: ducking under a possible moon shooter handed them the Queen of Spades', () => {
    // Player 1 has all 9 points so far and leads the A♠; Player 2 holds Q♠ 9♠ 4♠.
    const s = playState({
      hands: [null, null, 'QS 9S 4S 2D 3D 4D 5D 6D 7D', null],
      history: ['0: 2C 3C 4C 5C', '3: 6C 7C KC 2H', '1: AH 3H 4H 5H', '1: KH 6H 7H 8H'],
      trick: '1: AS',
    });
    expect(E.currentPlayer(s)).toBe(2);
    expect(decision(s).move).toEqual(play('9S'));
  });

  it('bug: with only point cards left, the bot fed the Queen of Spades to a possible moon shooter', () => {
    const s = playState({
      hands: [null, null, 'QS 8H 9H TH JH QH', null],
      history: [
        '0: 2C 3C 4C 5C',
        '3: 6D 7D KD 2H',
        '1: AD 3H 8D 9D',
        '1: KC 4H 7C 8C',
        '1: QC 5H 9C TC',
        '1: AC 6H JC 2S',
        '1: TD 7H 3D 4D',
      ],
      trick: '1: JD',
    });
    expect(E.currentPlayer(s)).toBe(2);
    const d = decision(s);
    expect(d.move).toEqual(play('8H'));
    expect(d.why).toMatch(/keep the Queen of Spades: they can't take all 26/);
  });

  it('explains the last card of the hand plainly', () => {
    let s = E.setup({ players: 4, options: { passDirection: 'hold' } }, createRng('last-card'));
    const rng = createRng('last-card-bots');
    while (s.tricks.length < 12) s = E.applyMove(s, E.botMove(s, s.turn, 'normal', rng));
    const why = decision(s).why;
    const only = s.hands[s.turn]![0]!;
    expect(why).toBe(`The ${cardShort(only)} is your last card, so it is the one you play.`);
  });

  it("every factual claim in the learner's coaching is true", () => {
    let checked = 0;
    for (let seed = 1; seed <= 120; seed++) {
      let s = E.setup({ players: 4 }, createRng(`claims-${seed}`));
      const rng = createRng(`claims-bots-${seed}`);
      while (!E.isOver(s)) {
        const p = E.currentPlayer(s)!;
        if (p === 0 && s.phase === 'play') {
          const advice = E.coach(s, 0);
          const why = advice.why ?? '';
          const m = advice.suggestion as HeartsMove;
          const c = m.type === 'play' ? m.card : ('' as CardCode);
          const hidden = outFrom0(s);
          const out = (suit: string) => hidden.filter((h) => suitOf(h) === suit);
          let match = why.match(/every (\w+) still out is higher/);
          if (match) {
            const suit = suitOf(c);
            expect(match[1]).toBe(SUIT_SINGULAR[suit]);
            expect(out(suit).length).toBeGreaterThan(0);
            expect(out(suit).every((h) => rank(h) > rank(c))).toBe(true);
          }
          match = why.match(/\((\d+) higher \w+ (?:is|are) still out\)/);
          if (match) {
            expect(out(suitOf(c)).filter((h) => rank(h) > rank(c)).length).toBe(Number(match[1]));
          }
          if (/nobody else can put points on this trick/.test(why)) {
            expect(hidden.some((h) => h === 'QS' || suitOf(h) === 'H')).toBe(false);
          }
          if (/a Spade lower than the Queen/.test(why)) {
            expect(suitOf(c)).toBe('S');
            expect(rank(c)).toBeLessThan(12);
            expect(hidden).toContain('QS');
          }
          const lead = s.trick[0];
          if (lead) {
            const best = winningPlay(s.trick);
            if (/so you won't win this trick/.test(why)) {
              expect(suitOf(c)).toBe(suitOf(lead.card));
              expect(rank(c)).toBeLessThan(rank(best.card));
            }
            if (/Beat their card with/.test(why)) {
              expect(suitOf(c)).toBe(suitOf(lead.card));
              expect(rank(c)).toBeGreaterThan(rank(best.card));
            }
            const winner = trickWinnerAfter(
              s,
              m,
              createRng(`claims-trick-${seed}-${s.tricks.length}`),
            );
            const named = why.match(/(?:so|go to|goes to) Player (\d)(?: will take|, not you)/);
            if (named) expect(winner).toBe(Number(named[1]));
            if (/this trick is yours anyway|so win it with/.test(why)) expect(winner).toBe(0);
            if (/you stay out of this trick|so you won't win this trick/.test(why)) {
              expect(winner).not.toBe(0);
            }
          } else if (/someone else has to win this trick/.test(why)) {
            expect(trickWinnerAfter(s, m, createRng(`claims-lead-${seed}`))).not.toBe(0);
          }
          checked++;
        }
        const diff: Difficulty = p === 0 || seed % 2 === 0 ? 'normal' : 'easy';
        s = E.applyMove(s, E.botMove(s, p, diff, rng));
      }
    }
    expect(checked).toBeGreaterThan(1400);
  });

  it("the coach and the move announcements never name another seat's hidden card", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const dir = DIRECTIONS[seed % 4]!;
      let s = E.setup({ players: 4, options: { passDirection: dir } }, createRng(`leak-${seed}`));
      const rng = createRng(`leak-bots-${seed}`);
      while (!E.isOver(s)) {
        const p = E.currentPlayer(s)!;
        const hidden = hiddenFrom0(s);
        const advice = E.coach(s, 0);
        const coachText = `${advice.situation} ${advice.why ?? ''}`;
        for (const h of hidden) expect(coachText).not.toContain(cardShort(h));
        const m = E.botMove(s, p, 'normal', rng);
        if (p !== 0) {
          const text = E.describeMove(s, p, m);
          const next = E.applyMove(s, m);
          const visible = new Set<CardCode>(next.hands[0]);
          if (m.type === 'play') visible.add(m.card);
          for (const h of hidden.filter((x) => !visible.has(x))) {
            expect(text).not.toContain(cardName(h));
          }
        }
        s = E.applyMove(s, m);
      }
    }
  });
});

describe('hearts audit: fuzzing with random legal moves', () => {
  it('300 games of uniformly random legal moves in every passing direction stay consistent', () => {
    const sorted = [...DECK].sort().join();
    const problems: string[] = [];
    let games = 0;
    let moons = 0;
    let illegalChecked = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const dir = DIRECTIONS[seed % 4]!;
      let s = E.setup({ players: 4, options: { passDirection: dir } }, createRng(`fuzz-${seed}`));
      const rng = createRng(`fuzz-moves-${seed}`);
      let steps = 0;
      const fail = (what: string) => problems.push(`[seed ${seed}, move ${steps}] ${what}`);
      while (!E.isOver(s)) {
        const p = E.currentPlayer(s);
        if (p === null) {
          fail('currentPlayer is null before the hand is over');
          break;
        }
        const legal = E.legalMoves(s, p);
        if (legal.length === 0) {
          fail(`seat ${p} has no legal moves (stuck)`);
          break;
        }
        for (const other of [0, 1, 2, 3].filter((x) => x !== p)) {
          if (E.legalMoves(s, other).length > 0) fail(`seat ${other} has moves off-turn`);
          if (E.coach(s, other).suggestion !== undefined) fail(`coach suggests for seat ${other}`);
        }
        const advice = E.coach(s, p);
        if (!E.checkMove(s, p, advice.suggestion as HeartsMove).ok)
          fail('coach suggestion illegal');
        if (!advice.why) fail('coach gave no reason');
        if (s.phase === 'play') {
          const keys = new Set(legal.map((m) => E.moveKey(m)));
          let firstIllegal: CardCode | null = null;
          for (const c of DECK) {
            const check = E.checkMove(s, p, play(c));
            if (check.ok !== keys.has(`play:${c}`)) fail(`checkMove/legalMoves disagree on ${c}`);
            if (!check.ok && !check.reason) fail(`no reason for illegal ${c}`);
            if (!check.ok && firstIllegal === null && s.hands[p]!.includes(c)) firstIllegal = c;
          }
          if (firstIllegal) {
            illegalChecked++;
            try {
              E.applyMove(s, play(firstIllegal));
              fail(`applyMove accepted illegal ${firstIllegal}`);
            } catch (err) {
              if (!(err instanceof IllegalMoveError)) fail(`wrong error type for ${firstIllegal}`);
            }
          }
        }
        const m = legal[rng.int(legal.length)]!;
        const before = JSON.stringify(s);
        deepFreeze(s);
        const next = E.applyMove(s, m);
        if (JSON.stringify(s) !== before) fail('applyMove mutated its input');
        const json = JSON.stringify(next);
        if (JSON.stringify(JSON.parse(json)) !== json) fail('state is not plain JSON');
        const places = [
          ...next.hands.flat(),
          ...next.trick.map((x) => x.card),
          ...next.won.flat(),
          ...(next.phase === 'pass' ? next.passed.flatMap((x) => x ?? []) : []),
        ];
        if ([...places].sort().join() !== sorted) fail('a card was lost or duplicated');
        s = next;
        steps++;
        if (steps > 56) {
          fail('hand did not end after 56 moves');
          break;
        }
      }
      if (E.currentPlayer(s) !== null) fail('currentPlayer is not null after the hand');
      const r = E.result(s);
      if (r.humanNetUnits < -1 || r.humanNetUnits > 3) fail(`net ${r.humanNetUnits} out of range`);
      if (r.humanOutcome !== (r.winners.includes(0) ? 'win' : 'loss')) fail('wrong outcome');
      if (s.points.includes(26)) moons++;
      games++;
    }
    expect(problems).toEqual([]);
    expect(games).toBe(300);
    expect(illegalChecked).toBeGreaterThan(3000);
    expect(moons).toBeGreaterThan(0); // random play does stumble into moons
  }, 60_000);
});

describe('hearts audit: bot strength', () => {
  it('a normal learner does clearly better than an easy one against the same normal bots', () => {
    const N = 150;
    const run = (me: Difficulty) => {
      let wins = 0;
      let pts = 0;
      for (let seed = 1; seed <= N; seed++) {
        let s = E.setup({ players: 4 }, createRng(`strength-${seed}`));
        const rng = createRng(`strength-bots-${seed}`);
        while (!E.isOver(s)) {
          const p = E.currentPlayer(s)!;
          s = E.applyMove(s, E.botMove(s, p, p === 0 ? me : 'normal', rng));
        }
        const r = E.result(s);
        if (r.humanOutcome === 'win') wins++;
        pts += r.scores![0]!;
      }
      return { wins, pts };
    };
    const normal = run('normal');
    const easy = run('easy');
    expect(normal.wins).toBeGreaterThan(easy.wins * 2);
    expect(normal.pts).toBeLessThan(easy.pts * 0.75);
  }, 60_000);
});
