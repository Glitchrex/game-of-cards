/**
 * Klondike Solitaire engine (Draw-1, unlimited passes, Vegas-style payout).
 * Pure: no React/DOM/IO, no Math.random, no Date. One seat (0) — the learner.
 *
 * Moves:
 *   { type: 'draw' }                         stock → waste (one card)
 *   { type: 'recycle' }                      empty stock: turn the waste over into a new stock
 *   { type: 'move', from, to }               from: waste | tableau{pile, index} | foundation{suit}
 *                                            to:   tableau{pile} | foundation
 *   { type: 'resign' }                       "I'm done" — always legal
 * Columns are 0-based (pile 0 = column 1). `index` is where the moved run starts in the
 * column's face-up cards; a negative index = a face-down card (explained, never legal).
 * The top face-down card of a column turns over automatically as part of the move that
 * uncovers it.
 *
 * Payout (docs/RULES_DECISIONS.md): net units = 5 × foundationCards ÷ 52 − 1 (−1 … +4);
 * win when the board is cleared or the net is positive (11+ cards home), else loss.
 */
import { SUIT_NAMES, SUITS, cardName, cardShort, suitOf } from '@/games/core/cards';
import type { Rng } from '@/games/core/rng';
import {
  assertLegal,
  type CoachAdvice,
  type Difficulty,
  type GameConfig,
  type GameEngine,
  type GameResult,
  type MoveCheck,
  type PlayerId,
  type ResultFlags,
} from '@/games/core/types';
import {
  CARDS_IN_DECK,
  applyUnchecked,
  columnName,
  dealKlondike,
  faceDownCount,
  foundationCount,
  foundationName,
  isCleared,
  isFinished,
  isMoveShape,
  isPileIndex,
  isPointlessKingShuffle,
  listLegalMoves,
  moveFlipsCard,
  moveProblem,
  movingBase,
  movingLength,
  plural,
  topCard,
  vegasNetUnits,
  type KlondikeCardMove,
  type KlondikeMove,
  type KlondikeState,
} from './rules';
import { decide } from './strategy';

export type {
  KlondikeLastMove,
  KlondikePile,
  KlondikeSource,
  KlondikeTarget,
  KlondikeCardMove,
} from './rules';
export type { KlondikeMove, KlondikeState };
export {
  CARDS_IN_DECK,
  TABLEAU_PILES,
  UNITS_PER_CARD,
  autoFoundationMoves,
  canAutoFinish,
  canGoHome,
  canPlaceOnPile,
  canStack,
  faceDownCount,
  foundationCount,
  isSafeHome,
  isStuck,
  vegasNetUnits,
} from './rules';

/** The human seat — Klondike has no other. */
export const SOLO: PlayerId = 0;

/** Cards needed on the foundations to come out ahead (5 × 11 ÷ 52 − 1 > 0). */
export const BREAK_EVEN_CARDS = 11;

function who(p: PlayerId): string {
  return p === 0 ? 'You' : `Player ${p}`;
}

// ---------------------------------------------------------------------------
// Move keys and labels
// ---------------------------------------------------------------------------

export function klondikeMoveKey(m: KlondikeMove): string {
  if (!isMoveShape(m)) return `?${JSON.stringify(m)}`;
  switch (m.type) {
    case 'draw':
    case 'recycle':
    case 'resign':
      return m.type;
    case 'move': {
      const f = m.from;
      const src =
        f.kind === 'waste'
          ? 'w'
          : f.kind === 'foundation'
            ? `f${String(f.suit)}`
            : `t${f.pile}.${f.index}`;
      const dst = m.to.kind === 'foundation' ? 'f' : `t${m.to.pile}`;
      return `move:${src}>${dst}`;
    }
  }
}

/**
 * Short label for a move that never reveals a hidden card — safe for buttons, hints and
 * coach suggestions ("Draw a card", "7♣ → column 5", "4♥ → foundation").
 */
export function klondikeMoveLabel(m: KlondikeMove, s: KlondikeState): string {
  if (!isMoveShape(m)) return 'Unknown move';
  switch (m.type) {
    case 'draw':
      return 'Draw a card';
    case 'recycle':
      return 'Turn the waste over';
    case 'resign':
      return "I'm done";
    case 'move': {
      const base = movingBase(s, m);
      const len = movingLength(s, m);
      const what = base ? `${cardShort(base)}${len > 1 ? ` (+${len - 1})` : ''}` : 'Card';
      const where =
        m.to.kind === 'foundation'
          ? 'foundation'
          : isPileIndex(m.to.pile)
            ? columnName(m.to.pile)
            : 'column';
      return `${what} → ${where}`;
    }
  }
}

// ---------------------------------------------------------------------------
// Descriptions
// ---------------------------------------------------------------------------

function describeCardMove(s: KlondikeState, p: PlayerId, m: KlondikeCardMove): string {
  const actor = who(p);
  const base = movingBase(s, m);
  if (base === undefined) return `${actor} tried to move a card that isn't there.`;
  const name = cardName(base);
  const len = movingLength(s, m);

  let dest: string;
  if (m.to.kind === 'foundation') {
    dest = `on the ${foundationName(suitOf(base))}`;
  } else {
    const d = isPileIndex(m.to.pile) ? s.tableau[m.to.pile] : undefined;
    const t = d ? topCard(d.faceUp) : undefined;
    dest = !isPileIndex(m.to.pile)
      ? 'to a column'
      : t === undefined
        ? `into empty ${columnName(m.to.pile)}`
        : `onto the ${cardName(t)} in ${columnName(m.to.pile)}`;
  }

  let flip = '';
  if (moveFlipsCard(s, m) && m.from.kind === 'tableau') {
    const hidden = topCard(s.tableau[m.from.pile]?.faceDown ?? []);
    if (hidden) flip = ` and turned over the ${cardName(hidden)} in ${columnName(m.from.pile)}`;
  }
  const end =
    m.to.kind === 'foundation' && foundationCount(s) === CARDS_IN_DECK - 1
      ? ' — that is all 52 cards home!'
      : '.';

  switch (m.from.kind) {
    case 'waste':
      return m.to.kind === 'foundation'
        ? `${actor} put the ${name} from the waste ${dest}${end}`
        : `${actor} moved the ${name} from the waste ${dest}.`;
    case 'tableau': {
      const src = columnName(m.from.pile);
      if (m.to.kind === 'foundation')
        return `${actor} put the ${name} from ${src} ${dest}${flip}${end}`;
      const last = s.tableau[m.from.pile]?.faceUp.at(-1);
      const what =
        len > 1 && last
          ? `${len} cards (the ${name} down to the ${cardName(last)})`
          : `the ${name}`;
      return `${actor} moved ${what} from ${src} ${dest}${flip}.`;
    }
    case 'foundation': {
      const placed = dest.replace(/^onto/, 'on');
      return `${actor} took the ${name} back down from the ${SUIT_NAMES[suitOf(base)]} foundation and put it ${placed}.`;
    }
  }
}

function describe(s: KlondikeState, p: PlayerId, m: KlondikeMove): string {
  const actor = who(p);
  if (!isMoveShape(m)) return `${actor} tried a move that isn't part of Klondike.`;
  switch (m.type) {
    case 'draw': {
      const c = topCard(s.stock);
      return c
        ? `${actor} drew the ${cardName(c)} from the stock.`
        : `${actor} tried to draw, but the stock is empty.`;
    }
    case 'recycle':
      return `${actor} turned the waste over to make a new stock (pass ${s.recycles + 2} through the cards).`;
    case 'resign':
      return `${actor} stopped the game with ${plural(foundationCount(s), 'card')} on the foundations.`;
    case 'move':
      return describeCardMove(s, p, m);
  }
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

function computeResult(s: KlondikeState): GameResult {
  const home = foundationCount(s);
  const cleared = home === CARDS_IN_DECK;
  const net = vegasNetUnits(home);
  const win = cleared || net > 0;
  const allAces = SUITS.every((suit) => s.foundations[suit].length > 0);
  const tags: string[] = [cleared ? 'cleared' : 'resigned'];
  if (cleared && s.recycles === 0) tags.push('firstPass');
  if (allAces) tags.push('allAcesHome');
  if (home === 0) tags.push('nothingHome');

  const flags: ResultFlags = {
    perfect: cleared,
    // Cleared after going round the stock at least three times.
    comeback: cleared && s.recycles >= 3,
    // Only one card either side of breaking even (10 or 11 cards home).
    closeFinish: !cleared && (home === BREAK_EVEN_CARDS - 1 || home === BREAK_EVEN_CARDS),
    // The result hinged on the last card home: exactly 11 cards (never more), so one card
    // fewer would have been a loss. A clear is decided long before its last King goes up.
    luckyLastCard: !cleared && home === BREAK_EVEN_CARDS && s.bestHome === BREAK_EVEN_CARDS,
    bigPot: net >= 3,
    bust: false,
    folded: s.resigned && !cleared,
    tags,
  };

  let summary: string;
  if (cleared) {
    summary =
      'You moved all 52 cards to the foundations — a perfect clear that pays back five times your stake!';
  } else if (win) {
    summary = `You got ${home} of 52 cards home — at 5/52 of your stake per card, that's more than you put in, so you finish ahead.`;
  } else if (home === 0) {
    summary = 'You stopped before any card reached a foundation, so the stake is lost.';
  } else if (home === BREAK_EVEN_CARDS - 1) {
    summary = `You got 10 cards home — just one short of the ${BREAK_EVEN_CARDS} you need to come out ahead.`;
  } else {
    summary = `You got ${plural(home, 'card')} home, which wins back part of your stake — ${BREAK_EVEN_CARDS} or more would put you ahead.`;
  }

  return {
    winners: win ? [SOLO] : [],
    humanOutcome: win ? 'win' : 'loss',
    humanNetUnits: net,
    scores: [home],
    summary,
    flags,
  };
}

// ---------------------------------------------------------------------------
// Coach
// ---------------------------------------------------------------------------

function situation(s: KlondikeState): string {
  const home = foundationCount(s);
  const hidden = faceDownCount(s);
  const w = topCard(s.waste);
  const parts: string[] = [
    `${plural(home, 'card')} of 52 ${home === 1 ? 'is' : 'are'} home on the foundations, and ${plural(
      hidden,
      'face-down card',
    )} ${hidden === 1 ? 'is' : 'are'} still hidden in the columns.`,
  ];
  const stock =
    s.stock.length > 0
      ? `The stock has ${plural(s.stock.length, 'card')} left`
      : 'The stock is empty';
  parts.push(
    w ? `${stock} and the waste shows the ${cardName(w)}.` : `${stock} and the waste is empty.`,
  );
  if (s.recycles > 0) parts.push(`You are on pass ${s.recycles + 1} through the stock.`);
  const draw =
    s.stock.length > 0 ? 'draw from the stock' : s.waste.length > 0 ? 'turn the waste over' : null;
  const stop =
    home > 0 ? `press "I'm done" to stop and keep what you've earned` : `press "I'm done" to stop`;
  const canMoveCard = listLegalMoves(s).some(
    (m) => m.type === 'move' && !isPointlessKingShuffle(s, m),
  );
  if (canMoveCard) {
    parts.push(
      `You can move a face-up card (or a run of them)${draw ? `, ${draw}` : ''}, or ${stop}.`,
    );
  } else {
    parts.push(
      draw
        ? `No card can move right now, so ${draw} — or ${stop}.`
        : `No card can move and there is nothing left to draw, so ${stop}.`,
    );
  }
  return parts.join(' ');
}

function coachFor(s: KlondikeState, p: PlayerId): CoachAdvice {
  if (isFinished(s)) {
    const home = foundationCount(s);
    return {
      situation: isCleared(s)
        ? 'The board is clear — all 52 cards are home. Brilliant!'
        : `The game is over with ${plural(home, 'card')} on the foundations.`,
    };
  }
  if (p !== SOLO) {
    return { situation: `Klondike is played solo — Player ${p} doesn't have a turn.` };
  }
  const d = decide(s, 'normal', null, { backstop: false });
  return { situation: situation(s), suggestion: d.move, why: d.explain() };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export const klondikeEngine: GameEngine<KlondikeState, KlondikeMove> = {
  id: 'klondike',

  setup(config: GameConfig, rng: Rng): KlondikeState {
    if (config.players !== 1) {
      throw new RangeError(
        `Klondike is a one-player game (players must be 1, got ${config.players}).`,
      );
    }
    return dealKlondike(rng);
  },

  currentPlayer(state: KlondikeState): PlayerId | null {
    return isFinished(state) ? null : SOLO;
  },

  legalMoves(state: KlondikeState, player: PlayerId): KlondikeMove[] {
    if (player !== SOLO) return [];
    return listLegalMoves(state);
  },

  checkMove(state: KlondikeState, player: PlayerId, move: KlondikeMove): MoveCheck {
    if (!isFinished(state) && player !== SOLO) {
      return {
        ok: false,
        reason: `Klondike is played solo — Player ${player} doesn't have a turn.`,
      };
    }
    const reason = moveProblem(state, move, true);
    return reason === null ? { ok: true } : { ok: false, reason };
  },

  applyMove(state: KlondikeState, move: KlondikeMove): KlondikeState {
    assertLegal(klondikeEngine, state, move);
    return applyUnchecked(state, move);
  },

  isOver(state: KlondikeState): boolean {
    return isFinished(state);
  },

  result(state: KlondikeState): GameResult {
    return computeResult(state);
  },

  botMove(state: KlondikeState, player: PlayerId, difficulty: Difficulty, rng: Rng): KlondikeMove {
    if (player !== SOLO || isFinished(state)) {
      throw new Error(`Player ${player} has no move to make in this Klondike game.`);
    }
    return decide(state, difficulty, rng, { backstop: true }).move;
  },

  describeMove(state: KlondikeState, player: PlayerId, move: KlondikeMove): string {
    return describe(state, player, move);
  },

  coach(state: KlondikeState, player: PlayerId): CoachAdvice {
    return coachFor(state, player);
  },

  moveKey(move: KlondikeMove): string {
    return klondikeMoveKey(move);
  },
};

export default klondikeEngine;
