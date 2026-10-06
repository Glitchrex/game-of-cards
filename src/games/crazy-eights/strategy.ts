/**
 * Crazy Eights bots and coach reasoning.
 *
 * Bots only ever see a `SeatView`: their own hand plus public information (the pile,
 * hand sizes, stock size and the public move history — who played which card, and which
 * suit was needed when somebody drew). They never look at other hands, the stock order
 * or the identity of anyone else's drawn cards.
 *
 *  - easy:   plays the first playable card in hand order (Eights whenever they come up,
 *            naming a random suit it holds), otherwise draws, otherwise passes.
 *  - normal: saves Eights for when nothing else matches, prefers the play that leaves it
 *            the most cards of the new suit (so matching by rank switches to its strongest
 *            suit), sheds high-point cards first, names the suit it holds most for an
 *            Eight, and draws only when it has nothing to play.
 */
import {
  cardShort,
  removeCard,
  suitOf,
  SUIT_NAMES,
  SUIT_SINGULAR,
  SUITS,
  type CardCode,
  type Suit,
} from '@/games/core/cards';
import type { Rng } from '@/games/core/rng';
import type { PlayerId } from '@/games/core/types';
import type { CrazyEightsMove, CrazyEightsState } from './engine';
import {
  cardPoints,
  cardsLabel,
  isEight,
  joinWords,
  needWords,
  playableCards,
  seatLabel,
  seatObject,
  seatPossessive,
  shortList,
  suitCounts,
  suitWithArticle,
  type PlayContext,
} from './rules';

/** Everything one seat may legally know. */
export interface SeatView {
  seat: PlayerId;
  players: number;
  hand: CardCode[];
  pile: PlayContext;
  stockCount: number;
  /** Cards held by every seat (public). */
  handCounts: number[];
  /** Every card that has been face up this game (starter, buried Eights, every play). */
  seen: CardCode[];
  /**
   * Per seat: suits that seat had to face when it drew a card and has not played since —
   * a public hint that it may be out of that suit.
   */
  drewOn: Suit[][];
  /** Cards this seat has drawn so far on the current turn. */
  drawnThisTurn: number;
}

/** A move plus the plain-language reason for it (used by the coach). */
export interface Decision {
  move: CrazyEightsMove;
  why: string;
}

/** The pile as the play rules see it, plus who named the suit and whether drawing works. */
export function playContextOf(state: CrazyEightsState, canDraw: boolean): PlayContext {
  const top = state.discard[state.discard.length - 1];
  if (top === undefined) throw new Error('Crazy Eights: the discard pile is empty');
  let namedBy: PlayerId | null = null;
  if (isEight(top)) {
    for (let i = state.log.length - 1; i >= 0; i--) {
      const e = state.log[i];
      if (e?.type === 'play') {
        namedBy = e.seat;
        break;
      }
    }
  }
  return { top, activeSuit: state.activeSuit, namedBy, canDraw };
}

/** Build the public + own-hand view for `seat`. */
export function seatView(state: CrazyEightsState, seat: PlayerId, canDraw: boolean): SeatView {
  const drewOn: Suit[][] = state.hands.map(() => []);
  const seen: CardCode[] = [state.starter, ...state.buried];
  for (const e of state.log) {
    const list = drewOn[e.seat];
    if (!list) continue;
    if (e.type === 'draw') {
      if (!list.includes(e.facing)) list.push(e.facing);
    } else if (e.type === 'play') {
      seen.push(e.card);
      if (!isEight(e.card)) {
        const i = list.indexOf(suitOf(e.card));
        if (i >= 0) list.splice(i, 1);
      }
    }
  }
  return {
    seat,
    players: state.players,
    hand: (state.hands[seat] ?? []).slice(),
    pile: playContextOf(state, canDraw),
    stockCount: state.stock.length,
    handCounts: state.hands.map((h) => h.length),
    seen,
    drewOn,
    drawnThisTurn: state.turn === seat ? state.drawnThisTurn : 0,
  };
}

const nextSeat = (view: SeatView) => (view.seat + 1) % view.players;

/** "1 Heart", "3 Hearts". */
function suitCountWords(n: number, suit: Suit): string {
  return `${n} ${n === 1 ? SUIT_SINGULAR[suit] : SUIT_NAMES[suit]}`;
}

function likelyLacks(view: SeatView, seat: PlayerId, suit: Suit): boolean {
  return view.drewOn[seat]?.includes(suit) ?? false;
}

function suitPoints(hand: readonly CardCode[], suit: Suit): number {
  let total = 0;
  for (const c of hand) if (!isEight(c) && suitOf(c) === suit) total += cardPoints(c);
  return total;
}

/** How attractive a (non-Eight) play is for the normal bot. Higher is better. */
function playScore(view: SeatView, card: CardCode): number {
  const rest = removeCard(view.hand, card);
  const keep = suitCounts(rest)[suitOf(card)];
  let score = keep * 10 + cardPoints(card);
  const next = nextSeat(view);
  if (likelyLacks(view, next, suitOf(card))) score += (view.handCounts[next] ?? 0) <= 2 ? 15 : 5;
  return score;
}

/** The suit to name for an Eight, given the cards left after playing it, with a reason. */
export function chooseSuitForEight(
  view: SeatView,
  rest: readonly CardCode[],
): { suit: Suit; reason: string } {
  const counts = suitCounts(rest);
  const next = nextSeat(view);
  const ranked = SUITS.slice().sort((a, b) => {
    if (counts[b] !== counts[a]) return counts[b] - counts[a];
    const pts = suitPoints(rest, b) - suitPoints(rest, a);
    if (pts !== 0) return pts;
    const lacks = Number(likelyLacks(view, next, b)) - Number(likelyLacks(view, next, a));
    if (lacks !== 0) return lacks;
    return SUITS.indexOf(a) - SUITS.indexOf(b);
  });
  const best = ranked[0] ?? 'S';
  if (counts[best] > 0) {
    const n = counts[best];
    const only = rest.find((c) => !isEight(c) && suitOf(c) === best);
    return {
      suit: best,
      reason:
        n === 1 && only !== undefined
          ? `you still hold ${suitWithArticle(best)} (the ${cardShort(only)}), so you can play it next turn if nobody changes the suit`
          : `${SUIT_NAMES[best]} are your longest suit (${n} cards), so you can keep playing them`,
    };
  }
  // No ordinary cards left to aim for: make life hard for the next player instead.
  const lacking = SUITS.find((s) => likelyLacks(view, next, s));
  if (lacking) {
    return {
      suit: lacking,
      reason: `${seatObject(next)} had to draw when ${SUIT_NAMES[lacking]} were needed, so they may not have any`,
    };
  }
  const seenCount = (s: Suit) => view.seen.filter((c) => !isEight(c) && suitOf(c) === s).length;
  const gone = SUITS.slice().sort((a, b) => seenCount(b) - seenCount(a))[0] ?? 'S';
  const most = seenCount(gone);
  if (most === 0 || SUITS.filter((s) => seenCount(s) === most).length > 1) {
    return {
      suit: gone,
      reason: 'you have no other suit left to aim for, so any suit is as good as another',
    };
  }
  return {
    suit: gone,
    reason: `more ${SUIT_NAMES[gone]} have been played than any other suit, so your opponents are less likely to hold one`,
  };
}

/** The normal bot's choice (also the coach's suggestion), with a beginner-friendly reason. */
export function normalDecision(view: SeatView): Decision {
  const playable = playableCards(view.hand, view.pile);
  const nonEights = playable.filter((c) => !isEight(c));
  const eights = playable.filter((c) => isEight(c));

  // Going out wins the game — always take it.
  const only = view.hand.length === 1 ? playable[0] : undefined;
  if (only !== undefined) {
    if (isEight(only)) {
      const { suit } = chooseSuitForEight(view, []);
      return {
        move: { type: 'play', card: only, suit },
        why: `Your ${cardShort(only)} is your last card and Eights are always playable — play it (any suit will do) and you win!`,
      };
    }
    return {
      move: { type: 'play', card: only },
      why: `The ${cardShort(only)} is your last card and it matches — play it and you win!`,
    };
  }

  if (nonEights.length > 0) {
    let best = nonEights[0] as CardCode;
    let bestScore = playScore(view, best);
    for (const c of nonEights.slice(1)) {
      const s = playScore(view, c);
      if (s > bestScore || (s === bestScore && cardPoints(c) > cardPoints(best))) {
        best = c;
        bestScore = s;
      }
    }
    return { move: { type: 'play', card: best }, why: explainPlay(view, best) };
  }

  const eight = eights[0];
  if (eight !== undefined) {
    const rest = removeCard(view.hand, eight);
    const { suit, reason } = chooseSuitForEight(view, rest);
    return {
      move: { type: 'play', card: eight, suit },
      why: `Nothing else in your hand matches, so this is the moment for your wild ${cardShort(eight)}. Name ${SUIT_NAMES[suit]} — ${reason}.`,
    };
  }

  if (view.pile.canDraw) {
    const again = view.drawnThisTurn > 0 ? ' again' : '';
    const fresh =
      view.stockCount === 0
        ? ' The stock is empty, so the discard pile (except its top card) gets shuffled into a new stock first.'
        : '';
    return {
      move: { type: 'draw' },
      why: `Nothing in your hand matches and you have no Eight, so draw${again}. If the new card matches, you can play it straight away.${fresh}`,
    };
  }
  return {
    move: { type: 'pass' },
    why: 'Nothing in your hand can be played and the stock is empty, so the only thing you can do is pass.',
  };
}

function explainPlay(view: SeatView, card: CardCode): string {
  const rest = removeCard(view.hand, card);
  const suit = suitOf(card);
  const keep = suitCounts(rest)[suit];
  const parts: string[] = [];
  if (suit !== view.pile.activeSuit) {
    parts.push(
      keep > 0
        ? `Playing the ${cardShort(card)} on the ${cardShort(view.pile.top)} switches the suit to ${SUIT_NAMES[suit]} — you'd still hold ${suitCountWords(keep, suit)}, so you'll probably be able to play again next turn.`
        : `Matching the ${cardShort(view.pile.top)} by rank with the ${cardShort(card)} switches the suit to ${SUIT_NAMES[suit]}.`,
    );
  } else if (keep > 0) {
    parts.push(
      `The ${cardShort(card)} follows the ${SUIT_NAMES[suit]} and you'd still hold ${suitCountWords(keep, suit)}, so you'll probably be able to play again next turn.`,
    );
  } else {
    parts.push(`The ${cardShort(card)} matches, so playing it gets a card out of your hand.`);
  }
  if (cardPoints(card) >= 10) {
    parts.push('It is also a 10-point card — shed big cards early in case the game gets blocked.');
  }
  const next = nextSeat(view);
  if (likelyLacks(view, next, suit)) {
    parts.push(
      `${seatLabel(next)} had to draw when ${SUIT_NAMES[suit]} were needed, so they may not have any.`,
    );
  }
  const eights = view.hand.filter((c) => isEight(c)).length;
  if (eights === 1) {
    parts.push('Keep your Eight for later — it rescues you when nothing else matches.');
  } else if (eights > 1) {
    parts.push('Keep your Eights for later — they rescue you when nothing else matches.');
  }
  return parts.join(' ');
}

/** The easy bot: first playable card in hand order, else draw, else pass. */
export function easyMove(view: SeatView, rng: Rng): CrazyEightsMove {
  const first = playableCards(view.hand, view.pile)[0];
  if (first !== undefined) {
    if (!isEight(first)) return { type: 'play', card: first };
    const rest = removeCard(view.hand, first);
    const held = SUITS.filter((s) => rest.some((c) => !isEight(c) && suitOf(c) === s));
    return { type: 'play', card: first, suit: rng.pick(held.length > 0 ? held : SUITS) };
  }
  return view.pile.canDraw ? { type: 'draw' } : { type: 'pass' };
}

/** Plain-words description of the table for `view.seat`, addressed as "you". */
export function situationWords(view: SeatView, turn: PlayerId): string {
  const { pile } = view;
  const parts: string[] = [];
  if (turn !== view.seat) parts.push(`It's ${seatPossessive(turn)} turn.`);
  if (isEight(pile.top)) {
    const who = pile.namedBy === null ? 'Someone' : seatLabel(pile.namedBy);
    parts.push(
      `${who} played the ${cardShort(pile.top)} and named ${SUIT_NAMES[pile.activeSuit]}, so the next card must be ${needWords(pile)}.`,
    );
  } else {
    parts.push(
      `The pile shows the ${cardShort(pile.top)}, so the next card must be ${needWords(pile)}.`,
    );
  }
  const others = view.handCounts
    .map((n, seat) => ({ n, seat }))
    .filter((o) => o.seat !== view.seat)
    .map((o) => `${seatLabel(o.seat)} ${o.n === 1 ? 'has just 1 card' : `has ${o.n}`}`);
  parts.push(`You hold ${cardsLabel(view.hand.length)}; ${joinWords(others)}.`);
  parts.push(
    view.stockCount > 0
      ? `The stock has ${cardsLabel(view.stockCount)} left.`
      : view.pile.canDraw
        ? 'The stock is empty — drawing will shuffle the discard pile into a new stock.'
        : 'The stock is empty.',
  );
  const danger = view.handCounts.findIndex((n, seat) => seat !== view.seat && n === 1);
  if (danger >= 0) parts.push(`Watch out: ${seatObject(danger)} could go out next turn!`);
  if (turn === view.seat) {
    const playable = playableCards(view.hand, pile);
    if (view.drawnThisTurn > 0) {
      parts.push(`You've drawn ${cardsLabel(view.drawnThisTurn)} this turn.`);
    }
    if (playable.length > 0) {
      parts.push(
        `You can play ${shortList(playable, 'or')}${view.pile.canDraw ? ', or draw instead' : ''}.`,
      );
    } else if (view.pile.canDraw) {
      parts.push('Nothing in your hand matches, so you must draw a card.');
    } else {
      parts.push('Nothing in your hand matches and there is nothing to draw, so you must pass.');
    }
  }
  return parts.join(' ');
}
