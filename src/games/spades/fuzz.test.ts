/**
 * Seeded fuzzing with uniformly random LEGAL moves (not bot moves), so the engine
 * meets positions bots never reach. Checks the engine contract at every step, that
 * announcements never reveal hidden cards, and that every unhedged "this wins"
 * claim the coach makes is true against the real (hidden) hands.
 */
import { describe, expect, it } from 'vitest';
import { cardName, makeDeck, suitOf, type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import { IllegalMoveError } from '@/games/core/types';
import { spadesEngine as E, type SpadesMove, type SpadesState } from './engine';
import { beats, teamOf, winningPlay } from './rules';

const DECK = makeDeck();
const DECK_SORTED = [...DECK].sort().join(',');

/** Could an opponent still to play beat `card` (played now by `seat`) with the cards they really hold? */
function opponentCanBeat(s: SpadesState, seat: number, card: CardCode): boolean {
  const plays = [...s.trick, { seat, card }];
  const led = suitOf(plays[0]!.card);
  const best = winningPlay(plays);
  if (best.seat !== seat) return true;
  for (let k = plays.length; k < 4; k++) {
    const next = (plays[0]!.seat + k) % 4;
    if (teamOf(next) === teamOf(seat)) continue;
    const hand = s.hands[next]!;
    const follow = hand.some((c) => suitOf(c) === led);
    const legal = follow ? hand.filter((c) => suitOf(c) === led) : hand;
    if (legal.some((c) => beats(c, best.card, led))) return true;
  }
  return false;
}

const UNHEDGED_WIN =
  /wins the trick for sure|no opponent still to play can top it|so lead it: it wins the trick|nothing can beat it/;

/** Matches any full card name ("Queen of Hearts"), to spot hidden cards in announcements. */
const CARD_NAME_RE = new RegExp(DECK.map((c) => cardName(c)).join('|'), 'g');

describe('spades fuzz (random legal moves)', () => {
  it('keeps every engine promise across 400 random games', () => {
    const tally = { games: 0, moves: 0, win: 0, loss: 0, push: 0, sureClaims: 0, illegalTried: 0 };
    for (let seed = 0; seed < 400; seed++) {
      const rng = createRng(`fuzz-${seed}`);
      const options = seed % 3 === 0 ? { dealer: seed % 4 } : undefined;
      let s = E.setup({ players: 4, options }, createRng(`fuzz-deal-${seed}`));
      let steps = 0;
      const fail = (msg: string): never => {
        throw new Error(`[seed ${seed}, step ${steps}] ${msg}`);
      };
      while (!E.isOver(s)) {
        const seat = E.currentPlayer(s) ?? fail('currentPlayer is null before the end');
        const legal = E.legalMoves(s, seat);
        if (legal.length === 0) fail(`seat ${seat} is stuck with no legal moves`);
        for (const other of [0, 1, 2, 3]) {
          if (other === seat) continue;
          if (E.legalMoves(s, other).length > 0) fail(`seat ${other} has moves out of turn`);
          if (E.coach(s, other).suggestion !== undefined) fail(`coach suggests for seat ${other}`);
          if (E.checkMove(s, other, legal[0]!).ok) fail(`checkMove accepts seat ${other}`);
        }
        const legalKeys = new Set(legal.map((m) => E.moveKey(m)));
        // checkMove agrees with legalMoves for every card in hand, with a reason when illegal.
        if (s.phase === 'play') {
          for (const c of s.hands[seat]!) {
            const check = E.checkMove(s, seat, { type: 'play', card: c });
            if (check.ok !== legalKeys.has(`play:${c}`)) fail(`checkMove disagrees on ${c}`);
            if (!check.ok && (check.reason?.length ?? 0) < 20) fail(`weak reason for ${c}`);
          }
          // A card from someone else's hand is always rejected (and applyMove throws).
          const foreign = s.hands[(seat + 1) % 4]![0];
          if (foreign) {
            tally.illegalTried++;
            expect(() => E.applyMove(s, { type: 'play', card: foreign })).toThrow(IllegalMoveError);
          }
        }
        // The coach suggests a legal move, and its unhedged "this wins" claims are true.
        const advice = E.coach(s, seat);
        const suggestion = advice.suggestion as SpadesMove;
        if (!legalKeys.has(E.moveKey(suggestion))) fail(`coach suggests ${E.moveKey(suggestion)}`);
        if ((advice.why?.length ?? 0) < 10) fail('coach gave no reason');
        if (suggestion.type === 'play' && UNHEDGED_WIN.test(advice.why ?? '')) {
          tally.sureClaims++;
          if (opponentCanBeat(s, seat, suggestion.card)) fail(`false claim: ${advice.why}`);
        }
        // Announcements only ever name the card being played.
        for (const m of legal) {
          const text = E.describeMove(s, seat, m);
          for (const named of text.match(CARD_NAME_RE) ?? []) {
            if (m.type !== 'play' || named !== cardName(m.card)) fail(`"${text}" names ${named}`);
          }
        }
        const move = rng.pick(legal);
        const before = JSON.stringify(s);
        deepFreeze(s);
        const next = E.applyMove(s, move);
        if (JSON.stringify(s) !== before) fail('applyMove mutated its input');
        s = next;
        steps++;
        const all = [
          ...s.hands.flat(),
          ...s.trick.map((x) => x.card),
          ...s.tricks.flatMap((t) => t.plays.map((x) => x.card)),
        ];
        if ([...all].sort().join(',') !== DECK_SORTED) fail('a card was lost or duplicated');
        if (steps > 56) fail('the hand did not end after 4 bids and 52 cards');
      }
      expect(steps).toBe(56);
      expect(E.currentPlayer(s)).toBeNull();
      const r = E.result(s);
      expect([-1, 0, 1]).toContain(r.humanNetUnits);
      tally.games++;
      tally.moves += steps;
      tally[r.humanOutcome]++;
    }
    expect(tally.games).toBe(400);
    expect(tally.sureClaims).toBeGreaterThan(100);
    // Random play produces ties now and then — the push path really runs.
    expect(tally.push).toBeGreaterThan(0);
    console.info(`spades fuzz: ${JSON.stringify(tally)}`);
  }, 120_000);
});
