/**
 * Hearts — pure rules engine. One hand = one game (docs/DECISIONS.md D-05).
 *
 * Seats 0–3 play clockwise; seat 0 is the learner in play mode. Flow:
 *  1. Deal 13 cards each (setup).
 *  2. Phase 'pass': seats 0, 1, 2, 3 in turn each choose 3 cards to pass
 *     (default: to the left, seat i → seat i+1). The chosen cards leave the hand
 *     at once but nobody receives anything until all four have chosen; then the
 *     cards change hands simultaneously (state.received records what arrived).
 *  3. Phase 'play': the holder of the Two of Clubs leads it. Follow suit if you
 *     can; no point cards on the first trick unless you hold nothing else;
 *     Hearts can't be led until a Heart has been played ("broken") unless the
 *     leader holds only Hearts. The Queen of Spades does NOT break Hearts.
 *     Highest card of the led suit wins the trick and leads the next one.
 *     A completed trick is resolved inside the applyMove that plays its 4th card
 *     (the Board can show `tricks[tricks.length - 1]` while it animates).
 *  4. After 13 tricks: 1 point per Heart, 13 for the Queen of Spades; a player
 *     who took all 26 "shoots the moon" and scores 0 while everyone else gets 26.
 *     Lowest score wins; betting is winner-takes-pot (see payoutUnits).
 *
 * No randomness is needed after the deal, so the state carries no RNG.
 */
import { makeDeck, sortHand, isCardCode, suitOf, type CardCode } from '@/games/core/cards';
import { shuffle, type Rng } from '@/games/core/rng';
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
  checkPlay,
  HAND_SIZE,
  listCardNames,
  legalPlays,
  listSeats,
  lowestScorers,
  PASS_DIRECTIONS,
  PASS_SIZE,
  passSource,
  passTarget,
  payoutUnits,
  pointsIn,
  pointsLabel,
  QUEEN_OF_SPADES,
  scoreHand,
  SEATS,
  seatLabel,
  seatObject,
  seatPossessive,
  TOTAL_POINTS,
  TRICKS_PER_HAND,
  TWO_OF_CLUBS,
  verbFor,
  winningPlay,
  type PlayContext,
} from './rules';
import { coachAdvice, easyMove, normalDecision, seatView } from './strategy';

export type HeartsPassDirection = 'left' | 'right' | 'across' | 'hold';
export type HeartsPhase = 'pass' | 'play' | 'over';

/** One card played to a trick. */
export interface HeartsPlay {
  seat: PlayerId;
  card: CardCode;
}

/** A finished trick. */
export interface HeartsTrick {
  leader: PlayerId;
  /** The four plays in the order they were made. */
  plays: HeartsPlay[];
  winner: PlayerId;
  /** Penalty points the winner collected with this trick. */
  points: number;
}

export interface HeartsState {
  phase: HeartsPhase;
  passDirection: HeartsPassDirection;
  /** Cards currently held by each seat (kept sorted for display). */
  hands: CardCode[][];
  /**
   * The 3 cards each seat chose to pass (null = not chosen yet / no passing).
   * During the pass phase these are "in transit" (not in any hand); after the
   * exchange they are history (now held by the receiver).
   */
  passed: (CardCode[] | null)[];
  /** The 3 cards each seat received in the exchange (null before it / when holding). */
  received: (CardCode[] | null)[];
  /** Seat whose decision it is (meaningless once phase is 'over'). */
  turn: PlayerId;
  /** Seat that led (or will lead) the current trick. */
  leader: PlayerId;
  /** Plays made to the current, unfinished trick. */
  trick: HeartsPlay[];
  /** Completed tricks, oldest first. */
  tricks: HeartsTrick[];
  /** Cards captured by each seat. */
  won: CardCode[][];
  /** Raw penalty points captured by each seat (before the shoot-the-moon rule). */
  points: number[];
  /** True once any Heart has been played. */
  heartsBroken: boolean;
}

export type HeartsMove = { type: 'pass'; cards: CardCode[] } | { type: 'play'; card: CardCode };

/** Game-specific options (config.options). */
export interface HeartsOptions {
  /** Where the 3 passed cards go. Default 'left' (the variant we teach). */
  passDirection?: HeartsPassDirection;
}

function readPassDirection(options: Record<string, unknown> | undefined): HeartsPassDirection {
  const raw = options?.passDirection;
  if (raw === undefined) return 'left';
  if (typeof raw === 'string' && (PASS_DIRECTIONS as readonly string[]).includes(raw)) {
    return raw as HeartsPassDirection;
  }
  throw new RangeError(
    `Hearts: unknown passDirection "${String(raw)}" (use ${PASS_DIRECTIONS.join(', ')}).`,
  );
}

function holderOf(hands: readonly CardCode[][], card: CardCode): PlayerId {
  const seat = hands.findIndex((h) => h.includes(card));
  if (seat < 0) throw new Error(`Hearts: nobody holds ${card}`);
  return seat;
}

function playContext(state: HeartsState): PlayContext {
  return {
    trick: state.trick,
    trickIndex: state.tricks.length,
    heartsBroken: state.heartsBroken,
  };
}

function isMoveShape(move: unknown): move is HeartsMove {
  if (typeof move !== 'object' || move === null) return false;
  const m = move as { type?: unknown; cards?: unknown; card?: unknown };
  if (m.type === 'pass') return Array.isArray(m.cards);
  if (m.type === 'play') return typeof m.card === 'string';
  return false;
}

function hand(state: HeartsState, seat: PlayerId): CardCode[] {
  return state.hands[seat] ?? [];
}

/** All 3-card combinations of a hand, in hand order. */
function passCombinations(cards: readonly CardCode[]): CardCode[][] {
  const out: CardCode[][] = [];
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      for (let k = j + 1; k < cards.length; k++) {
        out.push([cards[i] as CardCode, cards[j] as CardCode, cards[k] as CardCode]);
      }
    }
  }
  return out;
}

function checkPass(state: HeartsState, seat: PlayerId, cards: readonly unknown[]): MoveCheck {
  if (cards.length !== PASS_SIZE) {
    return {
      ok: false,
      reason: `Pick exactly 3 cards to pass — you picked ${cards.length}.`,
    };
  }
  const own = hand(state, seat);
  const seen = new Set<string>();
  for (const c of cards) {
    if (typeof c !== 'string' || !isCardCode(c)) {
      return { ok: false, reason: "That isn't a real card — pick 3 cards from your hand." };
    }
    if (seen.has(c)) {
      return { ok: false, reason: 'You picked the same card twice — choose 3 different cards.' };
    }
    seen.add(c);
    if (!own.includes(c)) {
      return {
        ok: false,
        reason: `You don't have ${listCardNames([c])} — pick 3 cards from your own hand.`,
      };
    }
  }
  return { ok: true };
}

/** Canonical (sorted) copy of a pass, so equal sets of cards compare equal. */
function canonicalPass(cards: readonly CardCode[]): CardCode[] {
  return cards.slice().sort();
}

function applyPass(state: HeartsState, cards: readonly CardCode[]): HeartsState {
  const seat = state.turn;
  const chosen = sortHand(cards);
  const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => !chosen.includes(c)) : h));
  const passed = state.passed.map((p, i) => (i === seat ? chosen : p));
  if (passed.some((p) => p === null)) {
    return { ...state, hands, passed, turn: seat + 1 };
  }
  // Everyone has chosen: exchange simultaneously.
  const received: (CardCode[] | null)[] = passed.map((_, i) => {
    const from = passed[passSource(i, state.passDirection)];
    return from ? from.slice() : null;
  });
  const newHands = hands.map((h, i) => sortHand([...h, ...(received[i] ?? [])]));
  const leader = holderOf(newHands, TWO_OF_CLUBS);
  return {
    ...state,
    phase: 'play',
    hands: newHands,
    passed,
    received,
    turn: leader,
    leader,
  };
}

function applyPlay(state: HeartsState, card: CardCode): HeartsState {
  const seat = state.turn;
  const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => c !== card) : h));
  const trick = [...state.trick, { seat, card }];
  const heartsBroken = state.heartsBroken || suitOf(card) === 'H';
  if (trick.length < SEATS) {
    return { ...state, hands, trick, heartsBroken, turn: (seat + 1) % SEATS };
  }
  const winner = winningPlay(trick).seat;
  const cards = trick.map((p) => p.card);
  const points = pointsIn(cards);
  const tricks = [...state.tricks, { leader: state.leader, plays: trick, winner, points }];
  const won = state.won.map((w, i) => (i === winner ? [...w, ...cards] : w));
  const totals = state.points.map((p, i) => (i === winner ? p + points : p));
  return {
    ...state,
    phase: tricks.length === TRICKS_PER_HAND ? 'over' : 'play',
    hands,
    trick: [],
    tricks,
    won,
    points: totals,
    heartsBroken,
    turn: winner,
    leader: winner,
  };
}

/** Highest running raw total a seat reached after any trick (for the comeback flag). */
function peakPoints(state: HeartsState, seat: PlayerId): number {
  let running = 0;
  let peak = 0;
  for (const t of state.tricks) {
    if (t.winner === seat) running += t.points;
    peak = Math.max(peak, running);
  }
  return peak;
}

function computeFlags(
  state: HeartsState,
  scores: readonly number[],
  winners: readonly PlayerId[],
  moonShooter: PlayerId | null,
): ResultFlags {
  const humanWon = winners.includes(0);
  const myScore = scores[0] ?? 0;
  const tags: string[] = [];
  if (moonShooter === 0) tags.push('shootTheMoon');
  if (moonShooter !== null && moonShooter !== 0) tags.push('opponentShotMoon');
  const tookQueen = (state.won[0] ?? []).includes(QUEEN_OF_SPADES);
  if (tookQueen) tags.push('queenOfSpades');
  if ((state.points[0] ?? 0) === 0) tags.push('cleanHand');
  if (humanWon && winners.length > 1) tags.push('sharedWin');

  // Margin to the decisive rival: the best non-winner when you won, the winner when you lost.
  const others = scores.filter((_, i) => !winners.includes(i));
  const margin = humanWon ? Math.min(...others) - myScore : myScore - Math.min(...scores);

  // Was the result already a win before the final trick was collected?
  const last = state.tricks[state.tricks.length - 1];
  let winBeforeLast = humanWon;
  if (last) {
    const before = state.points.map((p, i) => (i === last.winner ? p - last.points : p));
    winBeforeLast = lowestScorers(scoreHand(before).scores).includes(0);
  }

  return {
    comeback: humanWon && peakPoints(state, 0) >= 13,
    closeFinish: margin <= 2,
    luckyLastCard: humanWon && !winBeforeLast,
    bigPot: humanWon && winners.length === 1,
    perfect: myScore === 0,
    bust: !humanWon && tookQueen,
    folded: false,
    tags,
  };
}

function summarise(
  scores: readonly number[],
  winners: readonly PlayerId[],
  moonShooter: PlayerId | null,
): string {
  const mine = scores[0] ?? 0;
  if (moonShooter === 0) {
    return 'You shot the moon! You took every Heart and the Queen of Spades, so you score 0 and everyone else gets 26.';
  }
  if (moonShooter !== null) {
    return `${seatLabel(moonShooter)} shot the moon by taking every point card, so everyone else — including you — gets 26 points.`;
  }
  if (winners.includes(0) && winners.length === 1) {
    return `You won with ${pointsLabel(mine)} — the lowest score at the table!`;
  }
  if (winners.includes(0)) {
    const rivals = listSeats(winners.filter((w) => w !== 0));
    return `You tied for the lowest score (${pointsLabel(mine)}) with ${rivals}, so you share the win.`;
  }
  const best = scores[winners[0] ?? 0] ?? 0;
  const who = listSeats(winners);
  const label = who.charAt(0).toUpperCase() + who.slice(1);
  return `${label} won with ${pointsLabel(best)}; you finished with ${pointsLabel(mine)}.`;
}

export const heartsEngine: GameEngine<HeartsState, HeartsMove> = {
  id: 'hearts',

  setup(config: GameConfig, rng: Rng): HeartsState {
    if (config.players !== SEATS) {
      throw new RangeError(`Hearts is played by exactly ${SEATS} players (got ${config.players}).`);
    }
    const passDirection = readPassDirection(config.options);
    const deck = shuffle(makeDeck(), rng);
    const dealt: CardCode[][] = [[], [], [], []];
    deck.forEach((c, i) => dealt[i % SEATS]?.push(c));
    const hands = dealt.map((h) => sortHand(h));
    if (hands.some((h) => h.length !== HAND_SIZE)) throw new Error('Hearts: bad deal');
    const holding = passDirection === 'hold';
    const leader = holderOf(hands, TWO_OF_CLUBS);
    return {
      phase: holding ? 'play' : 'pass',
      passDirection,
      hands,
      passed: [null, null, null, null],
      received: [null, null, null, null],
      turn: holding ? leader : 0,
      leader,
      trick: [],
      tricks: [],
      won: [[], [], [], []],
      points: [0, 0, 0, 0],
      heartsBroken: false,
    };
  },

  currentPlayer(state) {
    return state.phase === 'over' ? null : state.turn;
  },

  legalMoves(state, player) {
    if (state.phase === 'over' || player !== state.turn) return [];
    const own = hand(state, player);
    if (state.phase === 'pass') {
      return passCombinations(own).map((cards) => ({ type: 'pass', cards }));
    }
    return legalPlays(own, playContext(state)).map((card) => ({ type: 'play', card }));
  },

  checkMove(state, player, move) {
    if (state.phase === 'over') {
      return { ok: false, reason: 'The hand is over — all 13 tricks have been played.' };
    }
    if (!isMoveShape(move)) {
      return {
        ok: false,
        reason: "That isn't a Hearts move — pick 3 cards to pass, or play one card.",
      };
    }
    if (player !== state.turn) {
      if (state.phase === 'pass' && state.passed[player]) {
        const yours = player === 0 ? "You've" : `${seatLabel(player)} has`;
        return {
          ok: false,
          reason: `${yours} already chosen 3 cards to pass — wait for ${seatObject(state.turn)} to choose too. The cards change hands once everyone has picked.`,
        };
      }
      const doing = state.phase === 'pass' ? 'to pick cards to pass' : 'to play';
      return {
        ok: false,
        reason:
          state.turn === 0
            ? `It's your turn ${doing}, not ${seatPossessive(player)}.`
            : `It's ${seatPossessive(state.turn)} turn ${doing}, not yours.`,
      };
    }
    if (state.phase === 'pass') {
      if (move.type !== 'pass') {
        const to = seatObject(passTarget(player, state.passDirection));
        return {
          ok: false,
          reason: `Not yet! First choose 3 cards to pass to ${to}. Everyone passes before the first trick is played.`,
        };
      }
      return checkPass(state, player, move.cards);
    }
    if (move.type !== 'play') {
      return {
        ok: false,
        reason:
          state.passDirection === 'hold'
            ? "There's no passing this hand — everyone keeps their cards, so just play a card."
            : "Passing is already finished — now it's time to play a card.",
      };
    }
    if (!isCardCode(move.card)) {
      return { ok: false, reason: "That isn't a real card — play one from your hand." };
    }
    return checkPlay(hand(state, player), playContext(state), move.card);
  },

  applyMove(state, move) {
    assertLegal(heartsEngine, state, move);
    return move.type === 'pass' ? applyPass(state, move.cards) : applyPlay(state, move.card);
  },

  isOver(state) {
    return state.phase === 'over';
  },

  result(state): GameResult {
    if (state.phase !== 'over') throw new Error('Hearts: result() called before the hand ended');
    const { scores, moonShooter } = scoreHand(state.points);
    const winners = lowestScorers(scores);
    const humanOutcome = winners.includes(0) ? 'win' : 'loss';
    return {
      winners,
      humanOutcome,
      humanNetUnits: payoutUnits(0, winners),
      scores,
      summary: summarise(scores, winners, moonShooter),
      flags: computeFlags(state, scores, winners, moonShooter),
    };
  },

  botMove(state, player, difficulty: Difficulty, rng) {
    if (state.phase === 'over' || player !== state.turn) {
      throw new Error(`Hearts: botMove called for seat ${player}, but it is not their turn`);
    }
    const view = seatView(state, player);
    return difficulty === 'easy' ? easyMove(view, rng) : normalDecision(view).move;
  },

  describeMove(state, player, move) {
    const who = seatLabel(player);
    if (move.type === 'pass') {
      const to = seatObject(passTarget(player, state.passDirection));
      let text =
        player === 0
          ? `You passed ${listCardNames(sortHand(move.cards))} to ${to}.`
          : `${who} passed 3 cards to ${to}.`;
      const othersDone = state.passed.every((p, i) => i === player || p !== null);
      if (othersDone) {
        const from = passSource(0, state.passDirection);
        const incoming = from === player ? move.cards : (state.passed[from] ?? []);
        text += ` Everyone has passed, so the cards change hands — you received ${listCardNames(sortHand(incoming))}.`;
      }
      return text;
    }
    const lead = state.trick[0];
    let text: string;
    if (!lead) {
      text = `${who} led ${listCardNames([move.card])}.`;
    } else if (suitOf(move.card) !== suitOf(lead.card)) {
      text = `${who} couldn't follow suit and played ${listCardNames([move.card])}.`;
    } else {
      text = `${who} played ${listCardNames([move.card])}.`;
    }
    if (suitOf(move.card) === 'H' && !state.heartsBroken) text += ' Hearts are broken!';
    if (state.trick.length === SEATS - 1) {
      const plays = [...state.trick, { seat: player, card: move.card }];
      const winner = winningPlay(plays).seat;
      const pts = pointsIn(plays.map((p) => p.card));
      text += ` ${seatLabel(winner)} ${verbFor(winner, 'win', 'wins')} the trick`;
      text += pts > 0 ? ` and ${verbFor(winner, 'take', 'takes')} ${pointsLabel(pts)}.` : '.';
      if (state.tricks.length === TRICKS_PER_HAND - 1) {
        const totals = state.points.map((p, i) => (i === winner ? p + pts : p));
        const shooter = totals.findIndex((p) => p === TOTAL_POINTS);
        text +=
          shooter >= 0
            ? ` That was the last trick — ${seatObject(shooter)} shot the moon!`
            : ' That was the last trick.';
      }
    }
    return text;
  },

  coach(state, player): CoachAdvice {
    return coachAdvice(state, player);
  },

  moveKey(move) {
    if (move.type === 'pass') {
      return `pass:${canonicalPass(Array.isArray(move.cards) ? move.cards : []).join(',')}`;
    }
    return `play:${move.card}`;
  },
};

export default heartsEngine;
