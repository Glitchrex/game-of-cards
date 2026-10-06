/**
 * Klondike bots and the coach's "what would a pro do?" logic.
 *
 * Information rules: the bots never look at face-down tableau cards (only how many there
 * are) and never look at the stock before it has been seen. After the first pass through
 * the stock (or once the stock is empty) every remaining stock/waste card has already been
 * shown on the waste, so remembering them is fair play — exactly what a careful human does.
 *
 * normal: a prioritised heuristic player —
 *   Aces/Twos home → free face-down cards (from the biggest hidden pile) → safe foundation
 *   moves → transfers that unlock a hidden card / a foundation move / the waste card → play
 *   the waste → draw. It never empties a column without a King ready to fill it, never
 *   shuffles a King between empty columns, never undoes its previous move, and plays unsafe
 *   foundation moves only when the deal is stuck ("banking" Vegas value before resigning).
 * easy: picks at random among simple progress moves (any foundation move, any waste play,
 *   any move that turns over a face-down card), otherwise draws.
 *
 * Both resign deterministically once the deal is stuck: no useful move on the table, no
 * remembered stock/waste card that could be played, and nothing left to send home. A
 * backstop (STALL_LIMIT moves without irreversible progress) guarantees termination.
 */
import { SUIT_NAMES, cardName, rankNumber, suitOf, type StandardCard } from '@/games/core/cards';
import type { Rng } from '@/games/core/rng';
import type { Difficulty } from '@/games/core/types';
import {
  CARDS_PER_SUIT,
  TABLEAU_PILES,
  canAutoFinish,
  canGoHome,
  canPlaceOnPile,
  canStack,
  columnName,
  foundationCount,
  homeMovesLowestFirst,
  isEmptyPile,
  isFinished,
  isLegalMove,
  isSafeHome,
  isStuck,
  listLegalMoves,
  movingBase,
  oppositeColour,
  plural,
  rankWordPlural,
  topCard,
  type KlondikeCardMove,
  type KlondikeMove,
  type KlondikeState,
} from './rules';

/** Moves without irreversible progress after which a bot gives up (termination backstop). */
export const STALL_LIMIT = 200;

export type DecisionKind =
  | 'autoFinish'
  | 'aceHome'
  | 'safeHome'
  | 'flip'
  | 'flipHome'
  | 'kingToEmpty'
  | 'makeRoom'
  | 'unlockHome'
  | 'unlockFlip'
  | 'unlockWaste'
  | 'wasteToTableau'
  | 'wasteKing'
  | 'easyPick'
  | 'draw'
  | 'recycle'
  | 'bank'
  | 'bankDraw'
  | 'resign';

export interface Decision {
  move: KlondikeMove;
  kind: DecisionKind;
  /** Plain-language reason (built lazily — only the coach needs it). */
  explain: () => string;
}

interface Candidate extends Decision {
  score: number;
}

export interface DecideOptions {
  /** Apply the STALL_LIMIT backstop (bots: yes; the coach: no). */
  backstop: boolean;
}

// ---------------------------------------------------------------------------
// Board facts (public information only)
// ---------------------------------------------------------------------------

function hasEmptyColumn(s: KlondikeState): boolean {
  return s.tableau.some(isEmptyPile);
}

/** Does the waste card already have a useful home (tableau spot or a safe foundation)? */
function wasteHasSpot(s: KlondikeState): boolean {
  const w = topCard(s.waste);
  if (w === undefined) return false;
  if (canGoHome(s, w) && isSafeHome(s, w)) return true;
  for (let j = 0; j < TABLEAU_PILES; j++) if (canPlaceOnPile(s, j, w)) return true;
  return false;
}

interface WaitingKing {
  card: StandardCard;
  /** Column it sits in (on top of face-down cards), or null for the waste. */
  pile: number | null;
}

/** A King that would gain from an empty column: one on face-down cards, or the waste card. */
function kingWaiting(s: KlondikeState, exclude: number): WaitingKing | null {
  let best: WaitingKing | null = null;
  let bestDown = 0;
  for (let i = 0; i < s.tableau.length; i++) {
    const p = s.tableau[i];
    const b = p?.faceUp[0];
    if (i === exclude || !p || b === undefined || p.faceDown.length <= bestDown) continue;
    if (rankNumber(b) === CARDS_PER_SUIT) {
      best = { card: b, pile: i };
      bestDown = p.faceDown.length;
    }
  }
  if (best) return best;
  const w = topCard(s.waste);
  return w !== undefined && rankNumber(w) === CARDS_PER_SUIT ? { card: w, pile: null } : null;
}

/** The column (not in `exclude`) with the most face-down cards whose run could go on `target`. */
function bestFlipOnto(
  s: KlondikeState,
  target: StandardCard,
  exclude: readonly number[],
): number | null {
  let best: number | null = null;
  let bestDown = 0;
  for (let i = 0; i < s.tableau.length; i++) {
    const p = s.tableau[i];
    const b = p?.faceUp[0];
    if (exclude.includes(i) || !p || b === undefined || p.faceDown.length <= bestDown) continue;
    if (canStack(b, target)) {
      best = i;
      bestDown = p.faceDown.length;
    }
  }
  return best;
}

function isReverseOfLast(s: KlondikeState, m: KlondikeCardMove): boolean {
  const l = s.last;
  if (!l || movingBase(s, m) !== l.card) return false;
  const fromMatches =
    m.from.kind === l.to && (m.from.kind !== 'tableau' || m.from.pile === l.toPile);
  const toMatches = m.to.kind === l.from && (m.to.kind !== 'tableau' || m.to.pile === l.fromPile);
  return fromMatches && toMatches;
}

// ---------------------------------------------------------------------------
// Explanations
// ---------------------------------------------------------------------------

function runText(len: number): string {
  return len > 1 ? ` and the ${plural(len - 1, 'card')} on it` : '';
}

function homeWhy(s: KlondikeState, c: StandardCard): string {
  const r = rankNumber(c);
  if (r === 1) {
    return `Put the ${cardName(c)} on a foundation. Aces start the foundations and no card in the columns ever needs one, so an Ace should always go up straight away.`;
  }
  if (r === 2) {
    return `Put the ${cardName(c)} on its foundation. A Two is just as safe as an Ace: the only cards that could sit on it are Aces, and those go home anyway.`;
  }
  return `Put the ${cardName(c)} on its foundation. Both ${oppositeColour(c)} ${rankWordPlural(
    r - 1,
  )} are already home, so no card will ever need to sit on it in the columns — it's safe to send it up.`;
}

function kingText(k: WaitingKing): string {
  return k.pile === null
    ? `the ${cardName(k.card)} from the waste`
    : `the ${cardName(k.card)}, which is sitting on face-down cards in ${columnName(k.pile)}`;
}

// ---------------------------------------------------------------------------
// Scoring (normal)
// ---------------------------------------------------------------------------

function cand(move: KlondikeMove, score: number, kind: DecisionKind, explain: () => string) {
  return { move, score, kind, explain };
}

/** Score a legal card move for the normal bot; null = not worth making. */
function scoreCardMove(s: KlondikeState, m: KlondikeCardMove): Candidate | null {
  const base = movingBase(s, m);
  if (base === undefined) return null;
  const name = cardName(base);
  const r = rankNumber(base);
  const { from, to } = m;

  if (from.kind === 'waste') {
    if (to.kind === 'foundation') {
      if (r <= 2) return cand(m, 1000, 'aceHome', () => homeWhy(s, base));
      if (isSafeHome(s, base)) return cand(m, 700, 'safeHome', () => homeWhy(s, base));
      return null;
    }
    const t = topCard(s.tableau[to.pile]?.faceUp ?? []);
    if (t === undefined) {
      return cand(
        m,
        150,
        'wasteKing',
        () =>
          `Put the ${name} from the waste into empty ${columnName(to.pile)}. Only Kings can start a new column, and every waste card you use keeps the stock moving.`,
      );
    }
    return cand(
      m,
      200,
      'wasteToTableau',
      () =>
        `Play the ${name} from the waste onto the ${cardName(t)} in ${columnName(to.pile)}. Using up waste cards keeps the stock moving and builds your columns.`,
    );
  }

  if (from.kind === 'tableau') {
    const i = from.pile;
    const p = s.tableau[i];
    if (!p) return null;
    const k = from.index;
    const down = p.faceDown.length;
    const len = p.faceUp.length - k;
    const flips = k === 0 && down > 0;
    const empties = k === 0 && down === 0;
    const hidden = `${columnName(i)} still hides ${plural(down, 'card')}`;

    if (to.kind === 'foundation') {
      const value = r <= 2 ? 1000 : isSafeHome(s, base) ? 700 : 0;
      if (flips) {
        return cand(m, value + (value > 0 ? 800 : 790) + 10 * down, 'flipHome', () =>
          value > 0
            ? `${homeWhy(s, base)} It also turns over the face-down card under it (${hidden}).`
            : `Put the ${name} on its foundation — that turns over the face-down card under it in ${columnName(i)}. Freeing a hidden card is worth more than keeping this card in the column.`,
        );
      }
      if (value > 0) return cand(m, value, r <= 2 ? 'aceHome' : 'safeHome', () => homeWhy(s, base));
      if (empties && !hasEmptyColumn(s)) {
        const king = kingWaiting(s, i);
        if (king) {
          return cand(
            m,
            250,
            'makeRoom',
            () =>
              `Put the ${name} on its foundation. That empties ${columnName(i)}, making room for ${kingText(king)}.`,
          );
        }
      }
      // An early (unsafe) trip home is still worth it when it uncovers something useful.
      const below = p.faceUp[k - 1];
      if (below !== undefined) {
        const fp = bestFlipOnto(s, below, [i]);
        if (fp !== null) {
          const x = s.tableau[fp]?.faceUp[0];
          const downX = s.tableau[fp]?.faceDown.length ?? 0;
          return cand(
            m,
            590 + 10 * downX,
            'unlockFlip',
            () =>
              `Put the ${name} on its foundation. That uncovers the ${cardName(below)}, so the ${
                x ? cardName(x) : 'run'
              } from ${columnName(fp)} can move onto it next and turn over a hidden card.`,
          );
        }
        if (canGoHome(s, below) && isSafeHome(s, below)) {
          return cand(
            m,
            390,
            'unlockHome',
            () =>
              `Put the ${name} on its foundation. That uncovers the ${cardName(below)}, which can follow it up next.`,
          );
        }
        const w = topCard(s.waste);
        if (w !== undefined && canStack(w, below) && !wasteHasSpot(s)) {
          return cand(
            m,
            240,
            'unlockWaste',
            () =>
              `Put the ${name} on its foundation. That uncovers the ${cardName(below)} — exactly the spot the ${cardName(w)} from the waste needs.`,
          );
        }
      }
      return null;
    }

    const t = topCard(s.tableau[to.pile]?.faceUp ?? []);
    if (flips) {
      if (t === undefined) {
        return cand(
          m,
          800 + 10 * down,
          'kingToEmpty',
          () =>
            `Move the ${name}${runText(len)} into empty ${columnName(to.pile)}. Only a King can fill an empty column, and moving this one turns over the face-down card under it (${hidden}).`,
        );
      }
      return cand(
        m,
        800 + 10 * down,
        'flip',
        () =>
          `Move the ${name}${runText(len)} from ${columnName(i)} onto the ${cardName(t)} in ${columnName(to.pile)}. That turns over a face-down card (${hidden}) — every card you uncover gives you new chances.`,
      );
    }
    if (empties) {
      if (t === undefined || hasEmptyColumn(s)) return null; // pointless / room already exists
      const king = kingWaiting(s, i);
      if (!king) return null; // never empty a column without a King ready to use it
      return cand(
        m,
        300,
        'makeRoom',
        () =>
          `Move the ${name}${runText(len)} onto the ${cardName(t)}. That empties ${columnName(i)}, making room for ${kingText(king)}.`,
      );
    }
    // A partial run: moving it uncovers the face-up card `e` underneath.
    const e = p.faceUp[k - 1];
    if (e === undefined || t === undefined) return null;
    const onto = `the ${cardName(t)} in ${columnName(to.pile)}`;
    if (canGoHome(s, e) && isSafeHome(s, e)) {
      return cand(
        m,
        400,
        'unlockHome',
        () =>
          `Move the ${name}${runText(len)} onto ${onto}. That uncovers the ${cardName(e)}, which can then go up to its foundation.`,
      );
    }
    const fp = bestFlipOnto(s, e, [i]);
    if (fp !== null) {
      const x = s.tableau[fp]?.faceUp[0];
      const downX = s.tableau[fp]?.faceDown.length ?? 0;
      return cand(
        m,
        600 + 10 * downX,
        'unlockFlip',
        () =>
          `Move the ${name}${runText(len)} onto ${onto}. That uncovers the ${cardName(e)}, so the ${
            x ? cardName(x) : 'run'
          } from ${columnName(fp)} can move onto it next and turn over a hidden card.`,
      );
    }
    const w = topCard(s.waste);
    if (w !== undefined && canStack(w, e) && !wasteHasSpot(s)) {
      return cand(
        m,
        250,
        'unlockWaste',
        () =>
          `Move the ${name}${runText(len)} onto ${onto}. That uncovers the ${cardName(e)} — exactly the spot the ${cardName(w)} from the waste needs.`,
      );
    }
    return null;
  }

  // Foundation → tableau: only when it unlocks something specific.
  if (to.kind !== 'tableau') return null;
  const t = topCard(s.tableau[to.pile]?.faceUp ?? []);
  const onto = t === undefined ? `empty ${columnName(to.pile)}` : `the ${cardName(t)}`;
  const fp = bestFlipOnto(s, base, [to.pile]);
  if (fp !== null) {
    const x = s.tableau[fp]?.faceUp[0];
    const downX = s.tableau[fp]?.faceDown.length ?? 0;
    return cand(
      m,
      550 + 10 * downX,
      'unlockFlip',
      () =>
        `Bring the ${name} back down from the ${SUIT_NAMES[suitOf(base)]} foundation onto ${onto}. Then the ${
          x ? cardName(x) : 'run'
        } from ${columnName(fp)} can move onto it and turn over a hidden card. Taking a card back down is allowed — sometimes it's the key move.`,
    );
  }
  const w = topCard(s.waste);
  if (w !== undefined && canStack(w, base) && !wasteHasSpot(s) && !canGoHome(s, w)) {
    return cand(
      m,
      120,
      'unlockWaste',
      () =>
        `Bring the ${name} back down from its foundation onto ${onto}, so the ${cardName(w)} from the waste has somewhere to go.`,
    );
  }
  return null;
}

function bestOf(s: KlondikeState, moves: readonly KlondikeMove[]): Candidate | null {
  let best: Candidate | null = null;
  for (const m of moves) {
    if (m.type !== 'move' || isReverseOfLast(s, m)) continue;
    const c = scoreCardMove(s, m);
    if (c && (!best || c.score > best.score)) best = c;
  }
  return best;
}

/** Moves whose value can change when a different card is on the waste. */
function wasteSensitive(s: KlondikeState, m: KlondikeMove): boolean {
  if (m.type !== 'move') return false;
  if (m.from.kind === 'foundation') return true;
  if (m.from.kind !== 'tableau') return false;
  const p = s.tableau[m.from.pile];
  if (!p) return false;
  if (m.to.kind === 'tableau' && m.from.index > 0) return true; // unlockWaste
  return m.from.index === 0 && p.faceDown.length === 0; // makeRoom for a waste King
}

const WASTE_MOVES: readonly KlondikeCardMove[] = [
  { type: 'move', from: { kind: 'waste' }, to: { kind: 'foundation' } },
  ...Array.from({ length: TABLEAU_PILES }, (_, j): KlondikeCardMove => ({
    type: 'move',
    from: { kind: 'waste' },
    to: { kind: 'tableau', pile: j },
  })),
];

/** For a position with no useful table move: would card `c` be worth playing from the waste? */
function wasteProbe(s: KlondikeState, difficulty: Difficulty): (c: StandardCard) => boolean {
  if (difficulty === 'easy') {
    return (c) => canGoHome(s, c) || s.tableau.some((_, j) => canPlaceOnPile(s, j, c));
  }
  const sensitive = listLegalMoves(s).filter((m) => wasteSensitive(s, m));
  return (c) => {
    const v: KlondikeState = { ...s, waste: [c] };
    const moves = [...WASTE_MOVES.filter((m) => isLegalMove(v, m)), ...sensitive];
    return bestOf(v, moves) !== null;
  };
}

/** Remembered stock + waste cards (all seen once a full pass is done), else null. */
function knownCards(s: KlondikeState): StandardCard[] | null {
  return s.recycles > 0 || s.stock.length === 0 ? [...s.stock, ...s.waste] : null;
}

// ---------------------------------------------------------------------------
// Easy candidates
// ---------------------------------------------------------------------------

function easyMoves(s: KlondikeState, legal: readonly KlondikeMove[]): KlondikeCardMove[] {
  return legal.filter((m): m is KlondikeCardMove => {
    if (m.type !== 'move' || isReverseOfLast(s, m)) return false;
    if (m.from.kind === 'foundation') return false;
    if (m.to.kind === 'foundation' || m.from.kind === 'waste') return true;
    const p = s.tableau[m.from.pile];
    return !!p && m.from.index === 0 && p.faceDown.length > 0;
  });
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

/**
 * The bot / coach decision for the (single) player. Always returns a legal move.
 * `rng` is only used by the easy bot; the normal bot is fully deterministic.
 */
export function decide(
  s: KlondikeState,
  difficulty: Difficulty,
  rng: Rng | null,
  opts: DecideOptions,
): Decision {
  if (isFinished(s)) throw new Error('The game is over — there is no move to make.');
  const legal = listLegalMoves(s);

  if (canAutoFinish(s)) {
    const m = homeMovesLowestFirst(s)[0];
    if (m) {
      const c = movingBase(s, m);
      return {
        move: m,
        kind: 'autoFinish',
        explain: () =>
          `Every card is face up and the stock is used up, so this game is won — just send the cards home, lowest first. Next up: the ${
            c ? cardName(c) : 'lowest card'
          }.`,
      };
    }
  }

  const stalled = opts.backstop && s.moveCount - s.lastProgressAt > STALL_LIMIT;
  if (!stalled) {
    if (difficulty === 'normal') {
      const best = bestOf(s, legal);
      if (best) return best;
    } else {
      const options = easyMoves(s, legal);
      if (options.length > 0) {
        const pick = rng ? rng.pick(options) : options[0];
        if (pick) {
          return {
            move: pick,
            kind: 'easyPick',
            explain: () => 'Making a simple move that gets a card closer to home.',
          };
        }
      }
    }
    const known = knownCards(s);
    let probe: ((c: StandardCard) => boolean) | null = null;
    const playable = (c: StandardCard) => (probe ??= wasteProbe(s, difficulty))(c);
    if (s.stock.length > 0) {
      if (known === null || known.some(playable)) {
        return {
          move: { type: 'draw' },
          kind: 'draw',
          explain: () =>
            'Nothing on the table can move usefully right now, so turn over the next card from the stock.',
        };
      }
    } else if (s.waste.length > 0 && s.waste.some(playable)) {
      return {
        move: { type: 'recycle' },
        kind: 'recycle',
        explain: () =>
          'The stock is empty, so turn the waste over and go through it again — at least one of those cards can be played now, and Draw-1 lets you go round as many times as you like.',
      };
    }
  }

  // Stuck: bank as many cards as possible before stopping (each one is worth 5/52 of a stake).
  const home = homeMovesLowestFirst(s)[0];
  if (home) {
    const c = movingBase(s, home);
    return {
      move: home,
      kind: 'bank',
      explain: () =>
        `No useful move is left, so this deal looks stuck. Before you stop, put the ${
          c ? cardName(c) : 'card'
        } on its foundation — every card home earns back 5/52 of your stake.`,
    };
  }
  if (!stalled) {
    const known = knownCards(s);
    if (known && known.some((c) => canGoHome(s, c))) {
      const move: KlondikeMove = s.stock.length > 0 ? { type: 'draw' } : { type: 'recycle' };
      return {
        move,
        kind: 'bankDraw',
        explain: () =>
          "None of the cards you've seen in the stock fits in the columns, but one of them can still go up to a foundation — keep going through the stock to reach it. Every card home earns back part of your stake.",
      };
    }
  }
  const n = foundationCount(s);
  return {
    move: { type: 'resign' },
    kind: 'resign',
    explain: () => {
      // Only call the deal certainly stuck when every stock/waste card has been seen and the
      // rules check agrees; otherwise this is the heuristic's judgement, so say "looks".
      const certain = knownCards(s) !== null && isStuck(s);
      const empty = s.stock.length + s.waste.length === 0;
      const verdict = certain
        ? `Nothing can move any more and ${
            empty
              ? 'there is nothing left to draw'
              : 'none of the cards in the stock or waste fit anywhere'
          }, so this deal is stuck.`
        : `No move left on the table helps${
            empty
              ? ' and there is nothing left to draw'
              : ', and none of the cards in the stock or waste will either'
          }, so this deal looks stuck.`;
      const keep =
        n > 0
          ? `you keep the value of the ${plural(n, 'card')} already home.`
          : 'no card made it home this time, so the stake is lost — every deal is different, so try another.';
      return `${verdict} Press "I'm done" — ${keep}`;
    },
  };
}
