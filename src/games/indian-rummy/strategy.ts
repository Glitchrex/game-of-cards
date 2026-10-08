/**
 * Indian Rummy bots. They only look at their own hand, the top of the open pile and the
 * wild rank — never at other hands or the order of the closed stock.
 *
 * normal: takes the open card only when it clearly improves its hand (always a joker),
 *   throws the card whose loss hurts least (unconnected and high cards first; jokers are
 *   kept), declares as soon as it can, drops a hopeless opening hand (rarely) and makes a
 *   middle drop when it still has no pure sequence and no joker late in the game.
 * easy: takes the open card only when it completes a group at once (or is a joker), throws
 *   a random card that is not in a group yet, declares when it can, never drops.
 */
import { type CardCode, type Rank, cardShort, rankNumber, suitOf } from '@/games/core/cards';
import type { Rng } from '@/games/core/rng';
import type { Difficulty, PlayerId } from '@/games/core/types';
import {
  type Arrangement,
  type GroupKind,
  bestArrangement,
  bestDiscard,
  cardPoints,
  handScore,
  hasPureSequence,
  isJokerFor,
} from './melds';
import {
  type IndianRummyMove,
  type IndianRummyState,
  declarableDiscards,
  distinctCards,
  dropKindFor,
  dropPoints,
  topDiscard,
} from './rules';

export interface BotChoice {
  move: IndianRummyMove;
  /** Plain-language reason (used by the coach). */
  why: string;
}

/** Heuristic improvement the normal bot needs before it takes the open card. */
export const TAKE_MARGIN = 2;
/**
 * Opening hands with no joker, no pure sequence, at most two same-suit neighbours and a
 * handScore of at least this are dropped (about 1 hand in 80; in bot-vs-bot play such hands
 * lost about 40 points on average, double the 20-point first drop).
 */
export const HOPELESS_SCORE = 100;
/** A middle drop needs this many own turns without a pure sequence or a joker... */
export const MIDDLE_DROP_TURN = 8;
/** ...and a handScore of at least this (such hands lost about the 40-point drop on average). */
export const MIDDLE_DROP_SCORE = 60;

const KIND_WORDS: Record<GroupKind, string> = {
  'pure-sequence': 'pure sequence',
  sequence: 'sequence',
  set: 'set',
  unmatched: 'group',
};

function list(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function positions(card: CardCode): number[] {
  const r = rankNumber(card);
  return r === 1 ? [1, 14] : [r];
}

/**
 * Cards in `hand` that could form a group with `card` given one more card: same rank in a
 * different suit, or same suit within two places. Jokers are not listed (they fit anything).
 */
export function partnersOf(hand: readonly CardCode[], card: CardCode, wildRank: Rank): CardCode[] {
  if (isJokerFor(card, wildRank)) return [];
  const out: CardCode[] = [];
  for (const c of hand) {
    if (c === card || isJokerFor(c, wildRank)) continue;
    if (rankNumber(c) === rankNumber(card)) {
      if (suitOf(c) !== suitOf(card)) out.push(c);
    } else if (
      suitOf(c) === suitOf(card) &&
      positions(c).some((a) => positions(card).some((b) => Math.abs(a - b) <= 2))
    ) {
      out.push(c);
    }
  }
  return distinctCards(out);
}

/** Two cards already in `hand` make a group with `card` (a set or a 3-card run). */
export function completesGroup(hand: readonly CardCode[], card: CardCode, wildRank: Rank): boolean {
  if (isJokerFor(card, wildRank)) return true;
  const natural = hand.filter((c) => !isJokerFor(c, wildRank));
  const suits = new Set(
    natural
      .filter((c) => rankNumber(c) === rankNumber(card) && suitOf(c) !== suitOf(card))
      .map(suitOf),
  );
  if (suits.size >= 2) return true;
  const present = new Set<number>();
  for (const c of natural)
    if (suitOf(c) === suitOf(card)) positions(c).forEach((x) => present.add(x));
  const has = (x: number) => present.has(x);
  return positions(card).some(
    (x) => (has(x - 2) && has(x - 1)) || (has(x - 1) && has(x + 1)) || (has(x + 1) && has(x + 2)),
  );
}

export function jokerCount(hand: readonly CardCode[], wildRank: Rank): number {
  return hand.filter((c) => isJokerFor(c, wildRank)).length;
}

/** Same-suit neighbours (one or two apart): the raw material of a pure sequence. */
export function connectorCount(hand: readonly CardCode[], wildRank: Rank): number {
  const cards = distinctCards(hand.filter((c) => !isJokerFor(c, wildRank)));
  let n = 0;
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i];
      const b = cards[j];
      if (!a || !b || suitOf(a) !== suitOf(b)) continue;
      if (positions(a).some((x) => positions(b).some((y) => Math.abs(x - y) <= 2))) n++;
    }
  }
  return n;
}

// ---------------------------------------------------------------- reasons

/** `cards` without one copy of `card`. */
function minus(cards: readonly CardCode[], card: CardCode): CardCode[] {
  const out = cards.slice();
  const i = out.indexOf(card);
  if (i >= 0) out.splice(i, 1);
  return out;
}

function looseOf(a: Arrangement): CardCode[] {
  return a.groups.find((g) => g.kind === 'unmatched')?.cards ?? [];
}

function sameCards(a: readonly CardCode[], b: readonly CardCode[]): boolean {
  return a.length === b.length && a.slice().sort().join() === b.slice().sort().join();
}

function takeWhy(hand: readonly CardCode[], top: CardCode, discard: CardCode, w: Rank): string {
  const after = minus([...hand, top], discard);
  const group = bestArrangement(after, w).groups.find(
    (g) => g.kind !== 'unmatched' && g.cards.includes(top),
  );
  const name = cardShort(top);
  if (group) {
    const others = group.cards.filter((c, i) => c !== top || group.cards.indexOf(top) !== i);
    return `Take the ${name} from the open pile: with your ${list(others.map(cardShort))} it makes a ${KIND_WORDS[group.kind]}.`;
  }
  const partners = partnersOf(hand, top, w);
  if (partners.length) {
    return `Take the ${name} from the open pile: it sits right next to your ${list(partners.map(cardShort))}, so one more card turns them into a group.`;
  }
  // No natural partner: the card is worth taking because the hand's jokers can build around
  // it, which leaves a weaker card to throw away.
  const swap = `it is more useful to you than the ${cardShort(discard)}, which you can throw instead`;
  const jokers = jokerCount(hand, w);
  if (jokers > 0) {
    return `Take the ${name} from the open pile: your ${jokers === 1 ? 'joker' : 'jokers'} can help build a sequence around it, and ${swap}.`;
  }
  return `Take the ${name} from the open pile: ${swap}.`;
}

function discardWhy(hand: readonly CardCode[], card: CardCode, w: Rank): string {
  const name = cardShort(card);
  const pts = cardPoints(card, w);
  const before = bestArrangement(hand, w);
  const after = bestArrangement(minus(hand, card), w);
  if (looseOf(before).includes(card)) {
    const partners = partnersOf(looseOf(after), card, w);
    const cost = pts >= 8 ? `, and it's worth ${pts} points if someone else declares` : '';
    if (!partners.length) {
      return `Throw the ${name}: it doesn't fit with any of your groups or loose cards${cost}. Keep your jokers and the cards that are close to making groups.`;
    }
    return `Throw the ${name}: it could still pair up with your ${list(partners.map(cardShort))}, but your other cards are closer to finished groups, so this one helps you least.`;
  }
  // The card sits in one of the groups.
  const group = before.groups.find((g) => g.kind !== 'unmatched' && g.cards.includes(card));
  const words = group
    ? `your ${KIND_WORDS[group.kind]} (${group.cards.map(cardShort).join(' ')})`
    : 'your groups';
  const spare =
    sameCards(looseOf(after), looseOf(before)) &&
    after.hasPureSequence === before.hasPureSequence &&
    (after.hasTwoSequences || !before.hasTwoSequences);
  if (spare) {
    return `Throw the ${name}: it is a spare card in ${words} — all your other cards stay just as well grouped without it.`;
  }
  return `Throw the ${name}: it breaks up ${words}, but you must throw a card and every other choice leaves your hand further from a declaration.`;
}

// ------------------------------------------------------------------ normal

function normalDrop(state: IndianRummyState, p: PlayerId): BotChoice | null {
  const hand = state.hands[p] ?? [];
  const w = state.wildRank;
  if (jokerCount(hand, w) > 0 || hasPureSequence(hand, w)) return null;
  const kind = dropKindFor(state, p);
  const score = handScore(hand, w);
  if (kind === 'first') {
    if (connectorCount(hand, w) > 2 || score < HOPELESS_SCORE) return null;
    return {
      move: { type: 'drop' },
      why: `This hand is hopeless: no joker, no pure sequence and hardly any cards in a row. Dropping now costs only ${dropPoints(kind)} points — far less than the 80 you could lose by playing it out.`,
    };
  }
  if ((state.turnsTaken[p] ?? 0) < MIDDLE_DROP_TURN || score < MIDDLE_DROP_SCORE) return null;
  return {
    move: { type: 'drop' },
    why: `After ${state.turnsTaken[p]} turns you still have no pure sequence and no joker, so if someone declares you could pay up to 80 points. A middle drop costs ${dropPoints(kind)} points instead.`,
  };
}

function normalDraw(state: IndianRummyState, p: PlayerId): BotChoice {
  const drop = normalDrop(state, p);
  if (drop) return drop;
  const hand = state.hands[p] ?? [];
  const w = state.wildRank;
  const top = topDiscard(state);
  const stock: IndianRummyMove = { type: 'draw', from: 'stock' };
  const open: IndianRummyMove = { type: 'draw', from: 'discard' };
  if (top && isJokerFor(top, w)) {
    return {
      move: open,
      why: `Grab the ${cardShort(top)} from the open pile — it's a joker, and jokers can stand in for any card you are missing.`,
    };
  }
  if (top) {
    if (!state.stock.length) {
      return {
        move: open,
        why: `The closed stock is empty, so take the ${cardShort(top)} from the open pile.`,
      };
    }
    const choice = bestDiscard([...hand, top], w);
    if (choice.score < handScore(hand, w) - TAKE_MARGIN) {
      return { move: open, why: takeWhy(hand, top, choice.discard, w) };
    }
  }
  return {
    move: stock,
    why: top
      ? `The ${cardShort(top)} on the open pile wouldn't improve your hand much (and taking it shows everyone what you collect), so draw a mystery card from the closed stock — it might be exactly what you need.`
      : 'The open pile is empty, so draw from the closed stock.',
  };
}

function highestCard(cards: readonly CardCode[], w: Rank): CardCode | undefined {
  let best: CardCode | undefined;
  for (const c of cards) {
    if (best === undefined) best = c;
    else if (isJokerFor(best, w) && !isJokerFor(c, w)) best = c;
    else if (cardPoints(c, w) > cardPoints(best, w)) best = c;
  }
  return best;
}

function declareChoice(state: IndianRummyState, p: PlayerId): BotChoice | null {
  const card = highestCard(declarableDiscards(state, p), state.wildRank);
  if (card === undefined) return null;
  return {
    move: { type: 'declare', discard: card },
    why: `Declare! Throw the ${cardShort(card)} and every one of your other 13 cards fits into a group, with at least two sequences and one of them pure. You win the game.`,
  };
}

function normalDiscard(state: IndianRummyState, p: PlayerId): BotChoice {
  const declare = declareChoice(state, p);
  if (declare) return declare;
  const hand = state.hands[p] ?? [];
  const { discard } = bestDiscard(hand, state.wildRank);
  return {
    move: { type: 'discard', card: discard },
    why: discardWhy(hand, discard, state.wildRank),
  };
}

// -------------------------------------------------------------------- easy

function easyDraw(state: IndianRummyState, p: PlayerId): BotChoice {
  const hand = state.hands[p] ?? [];
  const top = topDiscard(state);
  if (top && (completesGroup(hand, top, state.wildRank) || !state.stock.length)) {
    return {
      move: { type: 'draw', from: 'discard' },
      why: `The ${cardShort(top)} makes a group with cards you already hold, so take it.`,
    };
  }
  return {
    move: { type: 'draw', from: 'stock' },
    why: 'Nothing useful on the open pile, so draw from the closed stock.',
  };
}

function easyDiscard(state: IndianRummyState, p: PlayerId, rng: Rng | null): BotChoice {
  const declare = declareChoice(state, p);
  if (declare) return declare;
  const hand = state.hands[p] ?? [];
  const w = state.wildRank;
  const loose = distinctCards(
    bestArrangement(hand, w)
      .groups.find((g) => g.kind === 'unmatched')
      ?.cards.filter((c) => !isJokerFor(c, w)) ?? [],
  );
  // Any card that is not in a group yet (or, if all are grouped, any non-joker).
  const pool = loose.length ? loose : distinctCards(hand.filter((c) => !isJokerFor(c, w)));
  const candidates = pool.length ? pool : distinctCards(hand);
  const card = (rng ? rng.pick(candidates) : highestCard(candidates, w)) ?? hand[0] ?? 'X1';
  return {
    move: { type: 'discard', card },
    why: loose.length
      ? `Throw the ${cardShort(card)}: it isn't part of any group yet.`
      : `Every card is in a group, so break one up: throw the ${cardShort(card)}.`,
  };
}

// --------------------------------------------------------------- dispatch

/** A legal move for `p` (who must be the current player) with a plain-language reason. */
export function chooseMove(
  state: IndianRummyState,
  p: PlayerId,
  difficulty: Difficulty,
  rng: Rng | null,
): BotChoice {
  if (state.outcome || state.turn !== p) {
    throw new Error(`Indian Rummy: seat ${p} cannot move right now`);
  }
  if (state.phase === 'draw') {
    return difficulty === 'normal' ? normalDraw(state, p) : easyDraw(state, p);
  }
  return difficulty === 'normal' ? normalDiscard(state, p) : easyDiscard(state, p, rng);
}
