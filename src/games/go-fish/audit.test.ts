/**
 * Rules audit: one focused test per rule in docs/RULES_DECISIONS.md → Go Fish and
 * docs/engine-notes/go-fish.md (plus the standard rules they follow), the edge cases around
 * them, the bots' and coach's honesty, and a fuzz over random — not just bot-chosen — legal
 * moves. Each test is written so that it fails if the rule it names is implemented wrongly.
 */
import { describe, expect, it } from 'vitest';
import { cardName, makeDeck, RANKS, type CardCode, type Rank } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { deepFreeze, simulate } from '@/games/core/simulate';
import type { Difficulty, PlayerId } from '@/games/core/types';
import content from '@content/games/go-fish';
import {
  bookCounts,
  bookOwner,
  booksMade,
  goFishEngine as engine,
  type GoFishEvent,
  type GoFishMove,
  type GoFishState,
} from './engine';
import { countRank, handSizeFor, MAX_LOSS_UNITS, rankIndex } from './rules';
import { holdChance, normalDecision, seatView } from './strategy';
import { allCards, FULL_DECK, makeState } from './test-helpers';

const ask = (target: PlayerId, rank: string): GoFishMove => ({
  type: 'ask',
  target,
  rank: rank as Rank,
});
const askEvent = (seat: PlayerId, target: PlayerId, rank: Rank, got: number): GoFishEvent => ({
  type: 'ask',
  seat,
  target,
  rank,
  got,
});
const newEvents = (before: GoFishState, after: GoFishState): GoFishEvent[] =>
  after.log.slice(before.log.length);

/** One rank (Sevens) left: you hold three, Player 1 the last one; `books` are as given. */
function finishWithSevens(books: string[]): GoFishState {
  const s = makeState({
    hands: books.map((_, seat) => (seat === 0 ? '7S 7H 7D' : seat === 1 ? '7C' : '')),
    books,
    exactStock: true,
  });
  const end = engine.applyMove(s, ask(1, '7'));
  expect(end.phase).toBe('over');
  return end;
}

describe('RULES_DECISIONS checklist', () => {
  it('supports 2–5 players (3 is a normal table) and nothing else', () => {
    expect(engine.setup({ players: 3 }, createRng(1)).players).toBe(3);
    expect(() => engine.setup({ players: 1 }, createRng(1))).toThrow(RangeError);
    expect(() => engine.setup({ players: 6 }, createRng(1))).toThrow(RangeError);
  });

  it.each([
    [2, 7],
    [3, 7],
    [4, 5],
    [5, 5],
  ])('with %i players everyone is dealt %i cards and the rest is the pond', (players, size) => {
    expect(handSizeFor(players)).toBe(size);
    for (let seed = 0; seed < 40; seed++) {
      const s = engine.setup({ players }, createRng(`audit-${players}-${seed}`));
      s.hands.forEach((h, seat) => expect(h.length + 4 * s.books[seat]!.length).toBe(size));
      expect(s.stock).toHaveLength(52 - players * size);
      expect(allCards(s)).toBe(FULL_DECK);
    }
  });

  it('you may ask only ONE OTHER player, and only for a rank you already hold', () => {
    const s = makeState({ hands: ['7S KD', '7C 2S', 'KS 5D'] });
    const legal = engine.legalMoves(s, 0).map((m) => engine.moveKey(m));
    expect(legal.sort()).toEqual(['ask:1:7', 'ask:1:K', 'ask:2:7', 'ask:2:K']);
    // Even a rank the target obviously has is off limits if you hold none of it.
    expect(engine.checkMove(s, 0, ask(1, '2')).ok).toBe(false);
  });

  it('a catch takes EVERY card of the rank (and nothing else), with no draw, and you go again', () => {
    const s = makeState({ hands: ['7S KD', '7C 7H 7D 2S', 'KS 5D'], stock: '9S' });
    const t = engine.applyMove(s, ask(1, '7'));
    expect(t.hands[1]).toEqual(['2S']);
    expect(t.books[0]).toEqual([{ rank: '7', via: 'catch' }]);
    expect(t.stock).toEqual(s.stock);
    expect(t.turn).toBe(0);
  });

  it('a miss is "Go Fish": exactly one card, from the top of the pond, then the turn passes', () => {
    const s = makeState({ hands: ['7S KD', '2S 9D', 'KS 5D'], stock: '3C 9S' });
    const t = engine.applyMove(s, ask(1, '7'));
    expect(t.hands[0]).toEqual(['3C', '7S', 'KD']);
    expect(t.stock).toEqual(s.stock.slice(1));
    expect(t.hands[1]).toEqual(s.hands[1]);
    expect(t.turn).toBe(1);
  });

  it('fishing your wish is shown to everyone and you go again', () => {
    const s = makeState({ hands: ['7S KD', '2S 9D', 'KS 5D'], stock: '7H' });
    const t = engine.applyMove(s, ask(2, '7'));
    expect(newEvents(s, t)).toContainEqual({ type: 'fish', seat: 0, card: '7H', wish: true });
    expect(engine.describeMove(s, 0, ask(2, '7'))).toContain('Seven of Hearts');
    expect(t.turn).toBe(0);
  });

  it('drawing a rank you hold but did NOT ask for is no wish: the turn passes', () => {
    const s = makeState({ hands: ['7S KD', '2S 9D', 'KS 5D'], stock: 'KH' });
    const t = engine.applyMove(s, ask(2, '7'));
    expect(newEvents(s, t)).toContainEqual({ type: 'fish', seat: 0, card: 'KH', wish: false });
    expect(t.turn).toBe(1);
  });

  it('four of a kind in the deal is laid down as a book before anyone asks', () => {
    let found = 0;
    for (let seed = 0; seed < 4000 && found < 5; seed++) {
      const s = engine.setup({ players: 4 }, createRng(`dealt-${seed}`));
      for (const h of s.hands) for (const r of RANKS) expect(countRank(h, r)).toBeLessThan(4);
      if (booksMade(s) > 0) {
        found++;
        expect(s.books.flat().every((b) => b.via === 'deal')).toBe(true);
      }
    }
    expect(found).toBe(5);
  });

  it('when two hands empty at once and ONE pond card is left, the target gets it and the asker is out', () => {
    const s = makeState({
      hands: ['7S 7H 7D', '7C', 'KS KH KC'],
      books: ['A 2 3 4', '5 6 8', '9 T J Q'],
      stock: 'KD',
      exactStock: true,
    });
    const t = engine.applyMove(s, ask(1, '7'));
    expect(newEvents(s, t)).toEqual([
      askEvent(0, 1, '7', 1),
      { type: 'book', seat: 0, rank: '7', via: 'catch' },
      { type: 'refill', seat: 1, card: 'KD' },
      { type: 'out', seat: 0 },
    ]);
    // You have no cards and nothing to draw, so the turn passes even though you caught.
    expect(t.turn).toBe(1);
    expect(engine.legalMoves(t, 1)).toEqual([ask(2, 'K')]);
    const end = engine.applyMove(t, ask(2, 'K'));
    expect(end.phase).toBe('over');
    expect(bookCounts(end)).toEqual([5, 4, 4]);
    expect(engine.result(end).flags.tags).toContain('ranOutOfCards');
  });

  it('the turn skips every player who is out, wrapping round the table', () => {
    // You and Player 4 are out (empty pond). Player 3 misses, so the turn skips Player 4
    // and you, and wraps round to Player 1.
    const s = makeState({
      hands: ['', '7S 7H', 'QS QH QC', '7D 7C QD', ''],
      books: ['A 2 3', '4 5', '6 8', '9 T', 'J K'],
      exactStock: true,
      turn: 3,
    });
    expect(engine.legalMoves(s, 3).map((m) => engine.moveKey(m))).toEqual([
      'ask:1:7',
      'ask:1:Q',
      'ask:2:7',
      'ask:2:Q',
    ]);
    const t = engine.applyMove(s, ask(1, 'Q'));
    expect(newEvents(s, t)).toEqual([askEvent(3, 1, 'Q', 0)]);
    expect(t.turn).toBe(1);
  });

  it('an out player is never asked and never gets a turn again', () => {
    const s = makeState({
      hands: ['7S 7H KD', '7C', '7D KS KH', 'KC'],
      books: ['A 2 3', '4 5 6', '8 9 T', 'J Q'],
      exactStock: true,
    });
    let t = engine.applyMove(s, ask(1, '7')); // Player 1 hands over their last card: out
    expect(t.log.at(-1)).toEqual({ type: 'out', seat: 1 });
    const rng = createRng('out-player');
    while (!engine.isOver(t)) {
      const p = engine.currentPlayer(t)!;
      expect(p).not.toBe(1);
      const legal = engine.legalMoves(t, p);
      expect(legal.some((m) => m.target === 1)).toBe(false);
      t = engine.applyMove(t, legal[rng.int(legal.length)]!);
    }
    expect(t.hands[1]).toEqual([]);
  });

  it('the game ends exactly when the 13th book is made — never earlier, never later', () => {
    for (let seed = 1; seed <= 60; seed++) {
      let s = engine.setup({ players: 2 + (seed % 4) }, createRng(`end-${seed}`));
      const rng = createRng(`end-moves-${seed}`);
      while (!engine.isOver(s)) {
        expect(booksMade(s)).toBeLessThan(13);
        const legal = engine.legalMoves(s, s.turn);
        s = engine.applyMove(s, legal[rng.int(legal.length)]!);
      }
      expect(booksMade(s)).toBe(13);
      expect(s.stock).toEqual([]);
      expect(s.hands.flat()).toEqual([]);
    }
  });

  it('most books wins, ties share the pot, and nobody can lose more than the 1-unit ante', () => {
    const sole = engine.result(finishWithSevens(['A 2 3 4 5', 'K Q J T', '6 8 9']));
    expect([sole.winners, sole.humanNetUnits]).toEqual([[0], 2]);
    const tie = engine.result(finishWithSevens(['A 2 3 4', 'K Q J T 5', '6 8 9']));
    expect([tie.winners, tie.humanNetUnits]).toEqual([[0, 1], 0.5]);
    const lost = engine.result(finishWithSevens(['A', 'K Q J T 5 2', '6 8 9 3 4']));
    expect([lost.winners, lost.humanNetUnits]).toEqual([[1], -1]);
    expect(MAX_LOSS_UNITS).toBe(1);
  });
});

describe('bugs found in the audit', () => {
  it('the normal bot never re-asks a player for the rank it just took from them', () => {
    // From a real game: you just took Player 1's only Ten, and Player 1 told you "Go Fish"
    // to Sevens before drawing one face-down card. Asking for Tens again MUST fail; asking
    // for Sevens might work (that face-down card could be a Seven).
    const s = makeState({
      hands: ['7S 7C TS TH TC', 'AC 3H 3C 3D 6S 6H 6C 9S 9H 9C JH JC QS QH'],
      books: ['8 K 5 4', '2'],
      log: [
        askEvent(0, 1, '7', 0),
        { type: 'fish', seat: 0, card: '4C', wish: false },
        { type: 'book', seat: 0, rank: '4', via: 'fish' },
        askEvent(1, 0, 'Q', 0),
        { type: 'fish', seat: 1, card: '9C', wish: false },
        askEvent(0, 1, 'T', 1),
      ],
    });
    const view = seatView(s, 0);
    expect(holdChance(view, 1, 'T')).toBe(0);
    expect(holdChance(view, 1, '7')).toBeGreaterThan(0);
    const d = normalDecision(view);
    expect(d.move).toEqual(ask(1, '7'));
    expect(engine.botMove(s, 0, 'normal', createRng(1))).toEqual(ask(1, '7'));
    expect(engine.coach(s, 0).suggestion).toEqual(ask(1, '7'));
  });

  it('when every ask must miss, the coach says so and fishes for the rank most likely on top', () => {
    // Heads-up: Player 1 already handed over all their Sevens and all their Tens and has not
    // drawn since, so both possible asks are certain to hear "Go Fish!". The two Sevens you
    // can't see must be in the pond, but only one Ten — Sevens are twice as likely to come up.
    const s = makeState({
      hands: ['7S 7H TS TH TC', '2S 3D 9S 9C QC JD'],
      log: [askEvent(0, 1, '7', 1), askEvent(0, 1, 'T', 1)],
    });
    const view = seatView(s, 0);
    expect(holdChance(view, 1, '7')).toBe(0);
    expect(holdChance(view, 1, 'T')).toBe(0);
    const advice = engine.coach(s, 0);
    expect(advice.suggestion).toEqual(ask(1, '7'));
    expect(advice.why).not.toMatch(/best chance|hopeful guess|likeliest/);
    expect(advice.why).toMatch(/Go Fish/);
    expect(advice.why).toContain('fish your wish');
    expect(advice.why).toContain("The two Sevens you haven't seen must be in the pond");
    // And it really is a sure miss.
    expect(engine.applyMove(s, ask(1, '7')).log.at(-2)).toEqual(askEvent(0, 1, '7', 0));
  });

  it('perfect is a landslide, not just any heads-up win (7–6 is the closest possible)', () => {
    const close = engine.result(finishWithSevens(['A 2 3 4 5 6', 'K Q J T 8 9']));
    expect(close.scores).toEqual([7, 6]);
    expect(close.humanOutcome).toBe('win');
    expect(close.flags.closeFinish).toBe(true);
    expect(close.flags.perfect).toBe(false);
    const eight = engine.result(finishWithSevens(['A 2 3 4 5 6 8', 'K Q J T 9']));
    expect(eight.flags.perfect).toBe(false);
    const landslide = engine.result(finishWithSevens(['A 2 3 4 5 6 8 9', 'K Q J T']));
    expect(landslide.scores).toEqual([9, 4]);
    expect(landslide.flags.perfect).toBe(true);
    // With three or more players, more books than everyone else together (7+) is perfect.
    expect(engine.result(finishWithSevens(['A 2 3 4 5 6', 'K Q J', 'T 8 9'])).flags.perfect).toBe(
      true,
    );
    expect(engine.result(finishWithSevens(['A 2 3 4 5', 'K Q J', 'T 8 9 6'])).flags.perfect).toBe(
      false,
    );
  });

  it('luckyLastCard only when the wished final book decided the win', () => {
    // You fish your wish for the last Seven, then sit out while the Kings are booked.
    const play = (books: string[]) => {
      const s = makeState({
        hands: ['7S 7H 7D', 'KS KH', 'KD KC'],
        books,
        stock: '7C',
        exactStock: true,
      });
      const t = engine.applyMove(s, ask(1, '7'));
      expect(t.books[0]!.at(-1)).toEqual({ rank: '7', via: 'wish' });
      return engine.result(engine.applyMove(t, ask(2, 'K')));
    };
    // 5–5–3: without that lucky book you would have lost — it decided the game.
    const decisive = play(['A 2 3 4', 'Q J 5 6', 'T 8 9']);
    expect(decisive.scores).toEqual([5, 5, 3]);
    expect(decisive.humanOutcome).toBe('win');
    expect(decisive.flags.luckyLastCard).toBe(true);
    // 6–4–3: one book ahead without it as well, so it was not the decisive card.
    const comfortable = play(['A 2 3 4 5', 'Q J 6', 'T 8 9']);
    expect(comfortable.scores).toEqual([6, 4, 3]);
    expect(comfortable.flags.luckyLastCard).toBe(false);
    expect(comfortable.flags.tags).toContain('luckyFinalBook');
    // 5–4–4: without it you would only have tied, so it won you the whole pot.
    const outright = play(['A 2 3 4', 'Q J 5', 'T 8 9 6']);
    expect(outright.scores).toEqual([5, 4, 4]);
    expect(outright.flags.luckyLastCard).toBe(true);
  });
});

/** Every card named in `text` (by its full name, e.g. "Seven of Hearts"). */
function namedCards(text: string): CardCode[] {
  return makeDeck().filter((c) => text.includes(cardName(c)));
}

describe('fuzz: random legal moves (not just what the bots like)', () => {
  it('never loses a card, mutates its input, gets stuck, leaks a secret or lies in the coach', () => {
    let games = 0;
    let moves = 0;
    for (let g = 0; g < 240; g++) {
      const players = 2 + (g % 4);
      const rng = createRng(`fuzz-${g}`);
      let s = engine.setup(
        { players, options: { firstPlayer: g % players } },
        createRng(`fuzz-deal-${g}`),
      );
      let steps = 0;
      while (!engine.isOver(s)) {
        const p = engine.currentPlayer(s);
        expect(p).not.toBeNull();
        const legal = engine.legalMoves(s, p!);
        expect(legal.length).toBeGreaterThan(0);
        // The coach's suggestion is legal, and what its reason claims is true.
        const advice = engine.coach(s, p!);
        const suggestion = advice.suggestion as GoFishMove;
        expect(legal.map((m) => engine.moveKey(m))).toContain(engine.moveKey(suggestion));
        const view = seatView(s, p!);
        const chance = holdChance(view, suggestion.target, suggestion.rank);
        const anyChance = legal.some((m) => holdChance(view, m.target, m.rank) > 0);
        // Never a doomed ask while some ask could still work.
        if (anyChance) expect(chance).toBeGreaterThan(0);
        const after = engine.applyMove(s, suggestion);
        const got = (newEvents(s, after)[0] as Extract<GoFishEvent, { type: 'ask' }>).got;
        if (/sure catch|completes your book/.test(advice.why ?? '')) expect(got).toBeGreaterThan(0);
        if (/completes your book/.test(advice.why ?? '')) {
          expect(bookOwner(after, suggestion.rank)).toBe(p);
        }
        if (chance <= 0) expect(got).toBe(0);
        const why = advice.why ?? '';
        const r = rankIndex(suggestion.rank);
        if (why.startsWith('Every ask is sure to hear "Go Fish!"')) {
          // Really a sure miss everywhere, and every unseen copy really is in the pond.
          for (const m of legal) expect(countRank(s.hands[m.target]!, m.rank)).toBe(0);
          expect(countRank(s.stock, suggestion.rank)).toBe(view.outstanding[r]);
        }
        if (/likeliest to have one/.test(why)) {
          for (const m of legal) {
            if (m.rank !== suggestion.rank) continue;
            expect(chance).toBeGreaterThanOrEqual(holdChance(view, m.target, m.rank));
          }
        }
        if (/nobody has shown any of the other/.test(why)) {
          expect(view.known.reduce((sum, row) => sum + (row[r] ?? 0), 0)).toBe(0);
          expect(why).toContain(`the other ${4 - (view.mine[r] ?? 0)},`);
        }
        // Play a random legal move about half the time, the coach's otherwise.
        const move = rng.next() < 0.5 ? legal[rng.int(legal.length)]! : suggestion;
        const text = engine.describeMove(s, p!, move);
        const before = JSON.stringify(s);
        deepFreeze(s);
        const next = engine.applyMove(s, move);
        expect(JSON.stringify(s)).toBe(before);
        expect(allCards(next)).toBe(FULL_DECK);
        // The announcement names only cards the learner may see: their own new cards and
        // fished wishes (shown to everyone).
        const visible = new Set<CardCode>(next.hands[0]);
        for (const e of newEvents(s, next)) {
          if (e.type === 'fish' && (e.wish || e.seat === 0)) visible.add(e.card);
          if (e.type === 'refill' && e.seat === 0) visible.add(e.card);
        }
        for (const c of namedCards(text)) expect(visible.has(c)).toBe(true);
        s = next;
        steps++;
        expect(steps).toBeLessThan(400);
      }
      expect(engine.currentPlayer(s)).toBeNull();
      const r = engine.result(s);
      expect(r.humanNetUnits).toBeGreaterThanOrEqual(-MAX_LOSS_UNITS);
      expect(r.humanNetUnits).toBeLessThanOrEqual(players - 1);
      games++;
      moves += steps;
    }
    expect(games).toBe(240);
    expect(moves / games).toBeGreaterThan(20);
  }, 60_000);
});

describe('bots use public information only', () => {
  it('their choices never change when hidden cards are rearranged', () => {
    let positions = 0;
    for (let g = 0; g < 60; g++) {
      const players = 2 + (g % 4);
      const rng = createRng(`hidden-${g}`);
      let s = engine.setup({ players }, createRng(`hidden-deal-${g}`));
      while (!engine.isOver(s)) {
        const p = s.turn;
        // Shuffle every card p cannot see (other hands and the pond) into new places, keep
        // every hand size, and blank out the face-down cards in the log.
        const hidden = [...s.hands.filter((_, i) => i !== p).flat(), ...s.stock];
        const order = hidden.map((c, i) => ({ c, k: (i * 7919 + g * 31) % 104_729 }));
        const moved = order.sort((a, b) => a.k - b.k).map((x) => x.c);
        let k = 0;
        const twin: GoFishState = {
          ...s,
          hands: s.hands.map((h, i) => (i === p ? h : h.map(() => moved[k++]!))),
          stock: s.stock.map(() => moved[k++]!),
          log: s.log.map((e): GoFishEvent => {
            if (e.type === 'refill' && e.seat !== p) return { ...e, card: '2C' };
            if (e.type === 'fish' && !e.wish && e.seat !== p) return { ...e, card: '2C' };
            return e;
          }),
        };
        for (const d of ['easy', 'normal'] as const) {
          expect(engine.botMove(twin, p, d, createRng(g))).toEqual(
            engine.botMove(s, p, d, createRng(g)),
          );
        }
        positions++;
        const legal = engine.legalMoves(s, p);
        s = engine.applyMove(s, legal[rng.int(legal.length)]!);
      }
    }
    expect(positions).toBeGreaterThan(2000);
  }, 60_000);
});

describe('bot strength', () => {
  it.each([2, 3, 4])(
    'a normal learner wins more than an easy one with %i players',
    (players) => {
      const wins = (learner: Difficulty) =>
        simulate(engine, {
          games: 300,
          seedBase: 90_000 + players * 1000,
          config: (seed) => ({ players, options: { firstPlayer: seed % players } }),
          difficulty: (seat) => (seat === 0 ? learner : 'normal'),
          freezeEvery: 0,
        }).outcomes.win;
      const normal = wins('normal');
      const easy = wins('easy');
      expect(normal).toBeGreaterThan(easy);
      // Against equal opponents a normal learner should take at least a fair share.
      expect(normal / 300).toBeGreaterThan(0.8 / players);
    },
    60_000,
  );
});

describe('content agrees with the engine', () => {
  it('the "what does an ask tell you" quiz question matches what a seat may deduce', () => {
    const q = content.quiz.find((x) => /asks? Player 1 for Nines/.test(x.question));
    expect(q, 'quiz question about another player asking for Nines').toBeDefined();
    expect(q!.options[q!.answer]).toBe('Player 2 holds at least one Nine');
    // Player 2 asked Player 1 for Nines and heard "Go Fish!": you now know Player 2 holds a
    // Nine and Player 1 holds none.
    const s = makeState({
      hands: ['9C 4H', '2S 5D', '9H KS 3C'],
      log: [askEvent(2, 1, '9', 0), { type: 'fish', seat: 2, card: '3C', wish: false }],
    });
    const v = seatView(s, 0);
    expect(v.known[2]![rankIndex('9')]).toBe(1);
    expect(holdChance(v, 2, '9')).toBe(1);
    expect(holdChance(v, 1, '9')).toBe(0);
    expect(engine.coach(s, 0).suggestion).toEqual(ask(2, '9'));
    // The explanation must not tell you to ask for a rank you would have had to hand over.
    expect(q!.explanation).not.toMatch(/asked you/);
  });

  it('every claim about who goes again matches the engine', () => {
    const glossary = Object.fromEntries(content.glossary.map((g) => [g.term, g.definition]));
    expect(glossary['go again']).toMatch(/after every catch, and after fishing your wish/);
    // A Go Fish draw of a different rank — even one that completes a book — ends the turn.
    const s = makeState({ hands: ['7S 7H 7D KD', '2S 9D', 'KS 5D'], stock: '7C' });
    expect(engine.applyMove(s, ask(1, 'K')).turn).toBe(1);
  });

  it('the pond tip is only true once the pond is empty', () => {
    const tip = content.tips.find((t) => /count/i.test(t));
    expect(tip).toBeDefined();
    expect(tip).toMatch(/pond is empty/);
  });
});
