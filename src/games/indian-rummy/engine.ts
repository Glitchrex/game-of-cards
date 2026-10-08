/**
 * Indian Rummy (13-card points rummy) engine — docs/RULES_DECISIONS.md → Indian Rummy,
 * docs/engine-notes/indian-rummy.md.
 *
 * Two decks + two printed jokers; 13 cards each; a face-up wild-joker card makes its rank
 * wild (Aces if it is a printed joker). Draw (closed stock or open pile), then discard — or
 * declare a hand with every card in groups, at least two sequences and one of them pure.
 * Before drawing you may drop: 20 points before your first draw, 40 later. When someone
 * declares, everyone else pays their deadwood (all cards if they have no pure sequence),
 * capped at 80. After 200 turns without a declaration every hand is scored by deadwood and
 * the lowest wins. One game = one deal (D-05); 1 betting unit = 1 point.
 */
import { type CardCode, RANK_NAMES, cardShort, isJoker, rankOf } from '@/games/core/cards';
import { type Rng } from '@/games/core/rng';
import {
  type CoachAdvice,
  type Difficulty,
  type GameConfig,
  type GameEngine,
  type GameResult,
  type PlayerId,
  type ResultFlags,
  assertLegal,
} from '@/games/core/types';
import {
  type MeldGroup,
  DEADWOOD_CAP,
  bestArrangement,
  hasPureSequence,
  isJokerFor,
  isValidWithoutJokers,
} from './melds';
import {
  type IndianRummyMove,
  type IndianRummyState,
  activeSeats,
  cardPhrase,
  checkMoveFor,
  declarableDiscards,
  dropKindFor,
  dropPoints,
  legalMovesFor,
  moveKeyOf,
  points,
  seatLower,
  seatName,
  setupState,
  topDiscard,
  transition,
  verb,
} from './rules';
import { chooseMove } from './strategy';

export type {
  DrawSource,
  DropKind,
  EndKind,
  IndianRummyMove,
  IndianRummyMoveType,
  IndianRummyOptions,
  IndianRummyOutcome,
  IndianRummyState,
} from './rules';
export {
  DECK_SIZE,
  DEFAULT_MAX_TURNS,
  DEFAULT_PLAYERS,
  FIRST_DROP_POINTS,
  HAND_SIZE,
  MAX_LOSS_UNITS,
  MAX_PLAYERS,
  MIDDLE_DROP_POINTS,
  MIN_PLAYERS,
  activeSeats,
  declarableDiscards,
  dropKindFor,
  dropPoints,
  fullDeck,
  handAfterDiscard,
  nextActive,
  topDiscard,
} from './rules';
export {
  DEADWOOD_CAP,
  type Arrangement,
  type GroupKind,
  type MeldGroup,
  bestArrangement,
  cardPoints,
  deadwoodOf,
  declareProblem,
  handPoints,
  isJokerFor,
  isValidHand,
  rawDeadwoodOf,
  wildRankFor,
} from './melds';

/** Big-pot threshold in points (= stake units). */
export const BIG_POT_POINTS = 40;
/** Raw deadwood at or above this, followed by a win, is a comeback. */
export const COMEBACK_DEADWOOD = 60;
/** A loser on at most this many points makes a close finish. */
export const CLOSE_FINISH_POINTS = 10;
/** Declaring within this many of your own turns is "perfect". */
export const QUICK_DECLARE_TURNS = 3;

// ------------------------------------------------------------------ words

function turnWords(n: number): string {
  return `${n} turn${n === 1 ? '' : 's'}`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function list(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function seatList(seats: readonly PlayerId[]): string {
  return list(seats.map(seatLower));
}

const GROUP_WORDS: Record<MeldGroup['kind'], string> = {
  'pure-sequence': 'a pure sequence',
  sequence: 'a sequence',
  set: 'a set',
  unmatched: 'loose cards',
};

/** "…so every Seven is a joker", or the Aces-wild version for a printed-joker wild card. */
function wildWords(state: IndianRummyState): string {
  const rank = RANK_NAMES[state.wildRank];
  if (isJoker(state.wildCard)) {
    return `The wild-joker card is a printed joker, so every Ace is a joker — and so is the other printed joker.`;
  }
  return `The wild-joker card is the ${cardShort(state.wildCard)}, so every ${rank} is a joker — and so are the printed jokers.`;
}

/** "4♥ 5♥ 6♥" for a pure sequence; "9♠ 9♦ + a joker" when jokers stand in. */
function groupWords(g: MeldGroup, state: IndianRummyState): string {
  if (g.kind === 'pure-sequence') return g.cards.map(cardShort).join(' ');
  const natural = g.cards.filter((c) => !isJokerFor(c, state.wildRank));
  const jokers = g.cards.length - natural.length;
  const plus = jokers === 1 ? 'a joker' : `${jokers} jokers`;
  if (!natural.length) return g.cards.map(cardShort).join(' ');
  return jokers
    ? `${natural.map(cardShort).join(' ')} + ${plus}`
    : natural.map(cardShort).join(' ');
}

/**
 * "You have a pure sequence (4♥ 5♥ 6♥) and a set (9♠ 9♦ 9♣). 3 cards are still loose (…)."
 * plus, for a 13-card hand, what it would pay if someone declared now.
 */
function handSummary(hand: readonly CardCode[], state: IndianRummyState): string {
  const a = bestArrangement(hand, state.wildRank);
  const groups = a.groups.filter((g) => g.kind !== 'unmatched');
  const loose = a.groups.find((g) => g.kind === 'unmatched')?.cards ?? [];
  const parts = groups.map((g) => `${GROUP_WORDS[g.kind]} (${groupWords(g, state)})`);
  const have = parts.length ? `You have ${list(parts)}.` : 'You have no complete groups yet.';
  const looseWords = loose.length
    ? ` ${loose.length} card${loose.length === 1 ? ' is' : 's are'} still loose (${loose.map(cardShort).join(' ')}).`
    : '';
  const pure = a.hasPureSequence
    ? ''
    : ' You have no pure sequence yet — building one is your first job, because without it every card counts against you.';
  const dead =
    hand.length === 13 ? ` If someone declared now you would pay ${points(a.deadwoodPoints)}.` : '';
  return `${have}${looseWords}${pure}${dead}`;
}

// --------------------------------------------------------------- outcome

function payerWords(state: IndianRummyState, seat: PlayerId): string {
  const o = state.outcome;
  if (!o) return '';
  return `${seatLower(seat)} ${verb(seat, 'pay', 'pays')} ${points(o.points[seat] ?? 0)}`;
}

/** Present-tense sentence about how the game just ended (for the move log). */
function endingNow(state: IndianRummyState): string {
  const o = state.outcome;
  if (!o) return '';
  const losers = Array.from({ length: state.players }, (_, i) => i).filter(
    (i) => !o.winners.includes(i) && !state.drops[i],
  );
  const pays = losers.length ? ` — ${list(losers.map((i) => payerWords(state, i)))}` : '';
  if (o.kind === 'declare') {
    const d = o.declarer ?? 0;
    return `${seatName(d)} ${verb(d, 'win', 'wins')}${pays}.`;
  }
  if (o.kind === 'drop') {
    const w = o.winners[0] ?? 0;
    return `Only ${seatLower(w)} ${verb(w, 'are', 'is')} left, so ${seatLower(w)} ${verb(w, 'win', 'wins')} ${points(o.net[w] ?? 0)}.`;
  }
  const lowest = o.points[o.winners[0] ?? 0] ?? 0;
  if (o.winners.length > 1) {
    return `That was turn ${state.maxTurns}, so every hand is scored by deadwood: ${seatList(o.winners)} tie with the lowest (${points(lowest)})${pays}.`;
  }
  const w = o.winners[0] ?? 0;
  return `That was turn ${state.maxTurns}, so every hand is scored by deadwood: ${seatLower(w)} ${verb(w, 'have', 'has')} the lowest (${points(lowest)}) and ${verb(w, 'win', 'wins')}${pays}.`;
}

/** Past-tense one-sentence summary for the result screen. */
function summaryOf(state: IndianRummyState): string {
  const o = state.outcome;
  if (!o) return 'The game is still going.';
  const net = o.net[0] ?? 0;
  const dropped0 = state.drops[0];
  const droppedWords = dropped0
    ? `You dropped out (a ${dropped0} drop, ${points(dropPoints(dropped0))})`
    : '';
  if (o.kind === 'declare') {
    const d = o.declarer ?? 0;
    if (d === 0) {
      const turns = turnWords(state.turnsTaken[0] ?? 0);
      if (state.players === 2) {
        if (net === 0) {
          return `You declared a valid hand after ${turns}, but Player 1 had every card in a group too, so they paid nothing.`;
        }
        const why = hasPureSequence(state.hands[1] ?? [], state.wildRank)
          ? ' for their loose cards'
          : ' — they had no pure sequence, so every card counted';
        return `You declared a valid hand after ${turns}, so Player 1 paid you ${points(net)}${why}.`;
      }
      if (net === 0) {
        return `You declared a valid hand after ${turns}, but everyone else had every card in a group too, so nobody paid anything.`;
      }
      const owed = Array.from({ length: state.players - 1 }, (_, i) => i + 1).map(
        (i) => `${seatLower(i)} ${o.points[i] ?? 0}${state.drops[i] ? ' for dropping' : ''}`,
      );
      return `You declared a valid hand after ${turns} and won ${points(net)} (${list(owed)}).`;
    }
    if (dropped0) return `${droppedWords}, and later ${seatLower(d)} declared and won.`;
    const own = o.points[0] ?? 0;
    if (own === 0) {
      return `${seatName(d)} declared a valid hand, but every one of your cards was in a group, so you paid nothing.`;
    }
    // Without a pure sequence every card counts — whether or not the total reached the cap.
    const noPure = !hasPureSequence(state.hands[0] ?? [], state.wildRank);
    const why = noPure
      ? ` — without a pure sequence every card counted${own === DEADWOOD_CAP ? ` (${points(DEADWOOD_CAP)} is the most anyone pays)` : ''}`
      : ' for your loose cards';
    return `${seatName(d)} declared a valid hand, so you paid ${points(own)}${why}.`;
  }
  if (o.kind === 'drop') {
    const w = o.winners[0] ?? 0;
    if (w === 0) {
      return `Everyone else dropped out, so you won ${points(net)}.`;
    }
    if (dropped0 && state.players === 2) return `${droppedWords}, so ${seatLower(w)} won.`;
    if (dropped0) return `${droppedWords}, and ${seatLower(w)} was the last player left.`;
    return `Everyone else dropped out, so ${seatLower(w)} won.`;
  }
  const low = o.points[o.winners[0] ?? 0] ?? 0;
  const capped = `After ${turnWords(state.maxTurns)} nobody had declared, so every hand was scored by deadwood`;
  if (dropped0)
    return `${droppedWords}, and the game later ended at the ${state.maxTurns}-turn limit.`;
  if (o.winners.includes(0)) {
    if (o.winners.length > 1) {
      return `${capped}: you tied for the lowest (${points(low)}) with ${seatList(o.winners.filter((w) => w !== 0))}${net ? ` and won ${points(net)}` : ', so nobody won anything'}.`;
    }
    return `${capped}: yours was the lowest (${points(low)}), so you won ${points(net)}.`;
  }
  return `${capped}: ${seatList(o.winners)} had the lowest (${points(low)}), so you paid your ${points(o.points[0] ?? 0)}.`;
}

// ----------------------------------------------------------------- result

function computeResult(state: IndianRummyState): GameResult {
  const o = state.outcome;
  if (!o) throw new Error('Indian Rummy: result() called before the game is over');
  const net = o.net[0] ?? 0;
  const won = o.winners.includes(0);
  const humanOutcome: GameResult['humanOutcome'] = won
    ? o.winners.length === 1 || net > 0
      ? 'win'
      : 'push'
    : 'loss';
  const humanDeclared = o.kind === 'declare' && o.declarer === 0;
  const hand0 = state.hands[0] ?? [];
  const noJokers = humanDeclared && isValidWithoutJokers(hand0, state.wildRank);
  const quick = humanDeclared && (state.turnsTaken[0] ?? 0) <= QUICK_DECLARE_TURNS;
  const losers = activeSeats(state).filter((i) => !o.winners.includes(i));
  let closeFinish: boolean;
  if (humanOutcome === 'push') closeFinish = true;
  else if (won)
    closeFinish = losers.some((i) => (o.points[i] ?? DEADWOOD_CAP) <= CLOSE_FINISH_POINTS);
  else closeFinish = !state.drops[0] && (o.points[0] ?? DEADWOOD_CAP) <= CLOSE_FINISH_POINTS;
  const drawn = state.drawn;
  const luckyLastCard = humanDeclared && drawn?.from === 'stock' && hand0.includes(drawn.card);
  const fullCount = !won && !state.drops[0] && (o.points[0] ?? 0) >= DEADWOOD_CAP;
  const tags: string[] = [o.kind];
  if (state.drops[0]) tags.push(`${state.drops[0]}-drop`);
  if (state.drops.some((d, i) => i > 0 && d)) tags.push('opponent-dropped');
  if (noJokers) tags.push('no-jokers');
  if (quick) tags.push('quick-declare');
  if (fullCount) tags.push('full-count');
  if (luckyLastCard) tags.push('stock-finish');
  if (state.reshuffles > 0) tags.push('reshuffled');
  if (isJoker(state.wildCard)) tags.push('aces-wild');
  const flags: ResultFlags = {
    comeback: humanOutcome === 'win' && (state.peakDeadwood[0] ?? 0) >= COMEBACK_DEADWOOD,
    closeFinish,
    luckyLastCard,
    bigPot: Math.abs(net) >= BIG_POT_POINTS,
    perfect: noJokers || quick,
    bust: fullCount,
    folded: state.drops[0] !== null,
    tags,
  };
  return {
    winners: o.winners.slice(),
    humanOutcome,
    humanNetUnits: net,
    scores: o.points.slice(),
    summary: summaryOf(state),
    flags,
  };
}

// ----------------------------------------------------------------- describe

function describe(state: IndianRummyState, p: PlayerId, move: IndianRummyMove): string {
  const check = checkMoveFor(state, p, move);
  if (!check.ok) return `Not allowed: ${check.reason ?? 'that move is not possible right now.'}`;
  const name = seatName(p);
  const w = state.wildRank;
  const next = transition(state, move);
  const end = next.outcome ? ` ${endingNow(next)}` : '';
  switch (move.type) {
    case 'draw': {
      if (move.from === 'discard') {
        const card = topDiscard(state);
        return `${name} ${verb(p, 'pick', 'picks')} up ${card ? cardPhrase(card, w) : 'the top card'} from the open pile.`;
      }
      if (p !== 0) return `${name} draws a card from the closed stock.`;
      const card = state.stock[state.stock.length - 1];
      return `You draw ${card ? cardPhrase(card, w) : 'a card'} from the closed stock.`;
    }
    case 'discard': {
      const reshuffled =
        next.reshuffles > state.reshuffles
          ? ' The closed stock has run out, so the open pile (except its top card) is shuffled into a new stock.'
          : '';
      return `${name} ${verb(p, 'discard', 'discards')} ${cardPhrase(move.card, w)}.${reshuffled}${end}`;
    }
    case 'declare':
      return `${name} ${verb(p, 'declare', 'declares')}! ${capitalise(seatLower(p))} ${verb(p, 'throw', 'throws')} ${cardPhrase(move.discard, w)} and ${verb(p, 'show', 'shows')} a valid hand.${end}`;
    case 'drop': {
      const kind = dropKindFor(state, p);
      return `${name} ${verb(p, 'drop', 'drops')} out (a ${kind} drop) and ${verb(p, 'pay', 'pays')} ${points(dropPoints(kind))}.${end}`;
    }
  }
}

// -------------------------------------------------------------------- coach

function coachFor(state: IndianRummyState, p: PlayerId): CoachAdvice {
  if (state.outcome) return { situation: summaryOf(state) };
  if (state.drops[p]) {
    return {
      situation: `You've dropped out of this game, so you just watch now. ${activeSeats(state).length} players are still playing.`,
    };
  }
  const turn = state.turn;
  const top = topDiscard(state);
  const openWords = top ? `The open pile shows the ${cardShort(top)}.` : 'The open pile is empty.';
  if (turn !== p) {
    const whose = turn === 0 ? "the learner's" : `Player ${turn}'s`;
    return {
      situation: `It's ${whose} turn. ${openWords} Watch what they pick up from the open pile — it tells you which cards they are collecting, so avoid throwing those.`,
    };
  }
  const hand = state.hands[p] ?? [];
  const choice = chooseMove(state, p, 'normal', null);
  if (state.phase === 'draw') {
    const kind = dropKindFor(state, p);
    const situation = `Your turn: draw one card from the closed stock or the open pile (or drop out now for ${points(dropPoints(kind))}). ${openWords} ${wildWords(state)} ${handSummary(hand, state)}`;
    return { situation, suggestion: choice.move, why: choice.why };
  }
  const canDeclare = declarableDiscards(state, p).length > 0;
  const lead = canDeclare
    ? 'You hold 14 cards and your hand is complete — you can declare by throwing your extra card!'
    : 'You hold 14 cards: throw one onto the open pile to end your turn.';
  const drawnWords = state.drawn
    ? ` You just drew the ${cardShort(state.drawn.card)} from the ${state.drawn.from === 'stock' ? 'closed stock' : 'open pile'}.`
    : '';
  const situation = `${lead}${drawnWords} ${handSummary(hand, state)}`;
  return { situation, suggestion: choice.move, why: choice.why };
}

// ------------------------------------------------------------------- engine

export const indianRummyEngine: GameEngine<IndianRummyState, IndianRummyMove> = {
  id: 'indian-rummy',
  setup(config: GameConfig, rng: Rng): IndianRummyState {
    return setupState(config, rng);
  },
  currentPlayer(state) {
    return state.outcome ? null : state.turn;
  },
  legalMoves(state, player) {
    return legalMovesFor(state, player);
  },
  checkMove(state, player, move) {
    return checkMoveFor(state, player, move);
  },
  applyMove(state, move) {
    assertLegal(indianRummyEngine, state, move);
    return transition(state, move);
  },
  isOver(state) {
    return state.outcome !== null;
  },
  result(state) {
    return computeResult(state);
  },
  botMove(state, player, difficulty: Difficulty, rng: Rng) {
    return chooseMove(state, player, difficulty, rng).move;
  },
  describeMove(state, player, move) {
    return describe(state, player, move);
  },
  coach(state, player) {
    return coachFor(state, player);
  },
  moveKey(move) {
    return moveKeyOf(move);
  },
};

export default indianRummyEngine;

/** Exposed for the UI: the rank name used in "every 7 is a joker" copy. */
export function wildRankName(state: IndianRummyState): string {
  return RANK_NAMES[state.wildRank];
}

/** Exposed for tests/UI: true when `card` is the rank of the face-up wild-joker card. */
export function isWildRankCard(state: IndianRummyState, card: CardCode): boolean {
  return !isJoker(card) && rankOf(card) === state.wildRank;
}
