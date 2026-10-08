/**
 * Teen Patti engine (docs/RULES_DECISIONS.md → Teen Patti).
 *
 * One deal per game. Everyone posts a 1-boot boot and starts blind; play starts
 * on the dealer's left. On your turn: see (look at your cards, then act again),
 * chaal, raise, show (two players left only) or pack. Blind players bet the
 * stake, seen players twice the stake; a raise doubles the stake (never above
 * the 8-boot chaal limit). A bet that would bring the pot to the 64-boot pot
 * limit is capped and everyone left shows. Last player standing, or the best
 * hand at a show, takes the pot.
 *
 * Seats are numbered clockwise; "left of" a seat = the next seat number.
 * Seat 0 is the learner in play mode. 1 unit = 1 boot.
 */
import { type CardCode, cardName } from '@/games/core/cards';
import { type Rng } from '@/games/core/rng';
import {
  type CoachAdvice,
  type Difficulty,
  type GameConfig,
  type GameEngine,
  type GameResult,
  type MoveCheck,
  type PlayerId,
  type ResultFlags,
  assertLegal,
} from '@/games/core/types';
import { type HandRank, compareHands, handDecider, handStrength, rankHand } from './hand-eval';
import {
  type TeenPattiMove,
  type TeenPattiState,
  activeSeats,
  baseCost,
  bestSeats,
  canRaise,
  hitsPotLimit,
  isMove,
  legalMovesFor,
  moveCost,
  setupState,
  transition,
} from './rules';
import { aboutPct, chooseMove } from './strategy';

export type {
  TeenPattiAction,
  TeenPattiEndKind,
  TeenPattiMove,
  TeenPattiMoveType,
  TeenPattiOptions,
  TeenPattiOutcome,
  TeenPattiState,
} from './rules';
export {
  BOOT,
  DEFAULT_PLAYERS,
  DEFAULT_POT_LIMIT,
  DEFAULT_STAKE_LIMIT,
  MAX_LOSS_UNITS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  activeSeats,
  canRaise,
  hitsPotLimit,
  moveCost,
} from './rules';
export {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type HandCategory,
  type HandRank,
  compareHands,
  handStrength,
  rankHand,
} from './hand-eval';

// ------------------------------------------------------------------ words

/** Sentence-start name: "You" for seat 0, "Player N" otherwise. */
export function seatName(p: PlayerId): string {
  return p === 0 ? 'You' : `Player ${p}`;
}
function lower(p: PlayerId): string {
  return p === 0 ? 'you' : `Player ${p}`;
}
function poss(p: PlayerId): string {
  return p === 0 ? 'your' : `Player ${p}'s`;
}
function possCap(p: PlayerId): string {
  return p === 0 ? 'Your' : `Player ${p}'s`;
}
/** Verb agreeing with the seat: v(0,'pack','packs') → 'pack'. */
function v(p: PlayerId, you: string, they: string): string {
  return p === 0 ? you : they;
}
function boots(n: number): string {
  return `${n} boot${n === 1 ? '' : 's'}`;
}
function listNames(seats: readonly PlayerId[]): string {
  const names = seats.map(lower);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
function joinOr(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

function handRankOf(state: TeenPattiState, seat: PlayerId): HandRank {
  return rankHand(state.hands[seat] ?? []);
}

/**
 * "chaal for 2 boots", "raise for 4 boots", "see your cards", … for `p`'s legal moves.
 * `addressed` = the text speaks to `p` directly ("see your cards"); otherwise it talks
 * about seat `p` to the learner ("see their cards").
 */
function moveOptions(
  state: TeenPattiState,
  p: PlayerId,
  exclude?: TeenPattiMove['type'],
  addressed = true,
): string[] {
  return legalMovesFor(state, p)
    .filter((m) => m.type !== exclude)
    .map((m) => {
      switch (m.type) {
        case 'see':
          return `see ${addressed ? 'your' : 'their'} cards (free)`;
        case 'chaal':
          return `chaal for ${boots(moveCost(state, p, m))}`;
        case 'raise':
          return `raise for ${boots(moveCost(state, p, m))}`;
        case 'show':
          return `ask for a show for ${boots(moveCost(state, p, m))}`;
        case 'pack':
          return 'pack';
      }
    });
}

// --------------------------------------------------------------- outcomes

/** Present-tense description of how the hand just ended (for the move log). */
function outcomeNow(state: TeenPattiState): string {
  const o = state.outcome;
  if (!o) return '';
  const w = o.winners[0] ?? 0;
  if (o.kind === 'last-standing') {
    return `Only ${lower(w)} ${v(w, 'are', 'is')} left, so ${lower(w)} ${v(w, 'win', 'wins')} the ${state.pot}-boot pot.`;
  }
  if (o.kind === 'show') {
    const asker = o.asker ?? 0;
    const other = o.showdown.find((s) => s !== asker) ?? 0;
    const loser = w === asker ? other : asker;
    if (compareHands(state.hands[w] ?? [], state.hands[loser] ?? []) === 0) {
      return `The hands are exactly equal (${handRankOf(state, w).name} each), so the player who asked for the show loses and ${lower(w)} ${v(w, 'win', 'wins')} the ${state.pot}-boot pot.`;
    }
    return `${possCap(w)} ${handRankOf(state, w).name} beats ${poss(loser)} ${handRankOf(state, loser).name}, so ${lower(w)} ${v(w, 'win', 'wins')} the ${state.pot}-boot pot.`;
  }
  if (o.winners.length > 1) {
    return `${capitalise(listNames(o.winners))} tie with equal hands (${handRankOf(state, w).name}) and split the ${state.pot}-boot pot.`;
  }
  return `${possCap(w)} ${handRankOf(state, w).name} is the best hand, so ${lower(w)} ${v(w, 'win', 'wins')} the ${state.pot}-boot pot.`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Past-tense one-sentence summary for the result screen. */
function summaryOf(state: TeenPattiState): string {
  const o = state.outcome;
  if (!o) return 'The hand is still going.';
  const pot = `${state.pot}-boot pot`;
  const w = o.winners[0] ?? 0;
  if (o.kind === 'last-standing') {
    if (state.packed[0]) {
      const last = state.history[state.history.length - 1];
      return last?.player === 0
        ? `You packed, so ${lower(w)} won the ${pot}.`
        : `You packed, and once everyone else had packed too, ${lower(w)} won the ${pot}.`;
    }
    return `Everyone else packed, so ${lower(w)} won the ${pot}.`;
  }
  if (o.kind === 'show') {
    const asker = o.asker ?? 0;
    const other = o.showdown.find((s) => s !== asker) ?? 0;
    const loser = w === asker ? other : asker;
    const wName = handRankOf(state, w).name;
    if (compareHands(state.hands[w] ?? [], state.hands[loser] ?? []) === 0) {
      return `${seatName(asker)} asked for a show, but the hands were exactly equal (${wName} each), so the asker lost and ${lower(w)} won the ${pot}.`;
    }
    return `${seatName(asker)} asked for a show: ${poss(w)} ${wName} beat ${poss(loser)} ${handRankOf(state, loser).name}, so ${lower(w)} won the ${pot}.`;
  }
  if (o.winners.length > 1) {
    return `The pot reached the ${state.potLimit}-boot limit and ${listNames(o.winners)} tied with ${handRankOf(state, w).name}, so the ${pot} was split.`;
  }
  return `The pot reached the ${state.potLimit}-boot limit, so everyone left showed: ${poss(w)} ${handRankOf(state, w).name} was best and ${lower(w)} won the ${pot}.`;
}

// ----------------------------------------------------------------- result

const CLOSE_DECIDERS = new Set(['high-card', 'kicker', 'tie']);

function computeResult(state: TeenPattiState): GameResult {
  const o = state.outcome;
  if (!o) throw new Error('Teen Patti: result() called before the hand is over');
  const scores = state.contributed.map((c, i) => (o.payouts[i] ?? 0) - c);
  const net = scores[0] ?? 0;
  const humanOutcome: GameResult['humanOutcome'] = net > 0 ? 'win' : net < 0 ? 'loss' : 'push';
  const humanWon = o.winners.includes(0) && net > 0;
  const humanHand = state.hands[0] ?? [];
  const human = rankHand(humanHand);
  const others = Array.from({ length: state.players - 1 }, (_, i) => i + 1);

  let closeFinish = false;
  let luckyLastCard = false;
  if (o.showdown.includes(0)) {
    if (o.winners.includes(0) && o.winners.length > 1) {
      closeFinish = true; // tied for the best hand and split the pot: as close as it gets
    } else if (o.winners.includes(0)) {
      // Sole winner: how did the learner beat the best of the rest?
      const losers = o.showdown.filter((s) => s !== 0);
      const runnerUp = bestSeats(state, losers)[0];
      if (runnerUp !== undefined) {
        const d = handDecider(humanHand, state.hands[runnerUp] ?? []);
        closeFinish = CLOSE_DECIDERS.has(d.decider);
        luckyLastCard = humanWon && d.lastCard;
      }
    } else {
      const d = handDecider(state.hands[o.winners[0] ?? 0] ?? [], humanHand);
      closeFinish = CLOSE_DECIDERS.has(d.decider);
    }
  }
  // Behind at some point and still won: someone (who packed) held a better hand.
  const comeback =
    humanWon && others.some((s) => compareHands(state.hands[s] ?? [], humanHand) > 0);
  const tags: string[] = [];
  if (human.category === 'trail') tags.push('trail');
  if (human.category === 'pure-sequence') tags.push('pure-sequence');
  if (humanWon && !state.seen[0]) tags.push('blind-win');
  if (comeback && o.kind === 'last-standing') tags.push('bluff-win');
  if (o.kind === 'show') tags.push('show');
  if (o.kind === 'pot-limit') tags.push('pot-limit');
  if (o.winners.length > 1) tags.push('split-pot');
  if (state.packed[0] && others.every((s) => compareHands(humanHand, state.hands[s] ?? []) > 0)) {
    tags.push('packed-best-hand');
  }
  const flags: ResultFlags = {
    comeback,
    closeFinish,
    luckyLastCard,
    bigPot: Math.abs(net) >= 8,
    perfect: humanWon && human.category === 'trail',
    bust: o.kind === 'show' && o.asker === 0 && !o.winners.includes(0),
    folded: state.packed[0] === true,
    tags,
  };
  return {
    winners: o.winners.slice(),
    humanOutcome,
    humanNetUnits: net,
    scores,
    summary: summaryOf(state),
    flags,
  };
}

// ------------------------------------------------------------- checkMove

function checkMoveFor(state: TeenPattiState, p: PlayerId, move: TeenPattiMove): MoveCheck {
  if (state.outcome)
    return { ok: false, reason: 'The hand is over — there are no more moves to make.' };
  if (!isMove(move)) {
    return {
      ok: false,
      reason:
        "That isn't a Teen Patti move. On your turn you can see your cards, chaal, raise, show or pack.",
    };
  }
  if (!Number.isInteger(p) || p < 0 || p >= state.players) {
    return { ok: false, reason: `There is no seat ${p} at this table.` };
  }
  if (state.packed[p]) {
    return {
      ok: false,
      reason:
        p === 0
          ? "You've already packed, so you're out of this hand — sit back and watch how it ends."
          : `Player ${p} has already packed and is out of this hand.`,
    };
  }
  const turn = state.turn ?? 0;
  if (turn !== p) {
    if (move.type === 'see') {
      return {
        ok: false,
        reason:
          p === 0
            ? `You can look at your cards when it's your turn — right now it's ${poss(turn)} turn.`
            : `Player ${p} can only look at their cards on their own turn — right now it's ${poss(turn)} turn.`,
      };
    }
    return {
      ok: false,
      reason:
        p === 0
          ? `It's ${poss(turn)} turn, not yours.`
          : `It's ${poss(turn)} turn, not ${poss(p)}.`,
    };
  }
  const can = p === 0 ? 'you can' : `Player ${p} can`;
  if (move.type === 'see' && state.seen[p]) {
    return {
      ok: false,
      reason: `${p === 0 ? "You've" : `Player ${p} has`} already seen ${p === 0 ? 'your' : 'their'} cards. Now ${can} ${joinOr(moveOptions(state, p, undefined, p === 0))}.`,
    };
  }
  if (move.type === 'raise' && !canRaise(state)) {
    return {
      ok: false,
      reason: `The stake is already ${boots(state.stake)} — the most it can be (the chaal limit) — so nobody can raise any more. ${capitalise(can)} still chaal for ${boots(moveCost(state, p, { type: 'chaal' }))}.`,
    };
  }
  if (move.type === 'show') {
    const left = activeSeats(state).length;
    if (left !== 2) {
      return {
        ok: false,
        reason: `${capitalise(can)} only ask for a show when just two players are left, and right now ${left} players are still in. ${capitalise(can)} ${joinOr(moveOptions(state, p, 'show', p === 0))} instead.`,
      };
    }
  }
  return { ok: true };
}

// ----------------------------------------------------------------- describe

function describe(state: TeenPattiState, p: PlayerId, move: TeenPattiMove): string {
  const check = checkMoveFor(state, p, move);
  if (!check.ok) return `Not allowed: ${check.reason ?? 'that move is illegal right now.'}`;
  const name = seatName(p);
  const blind = !state.seen[p];
  const next = transition(state, move);
  const end = next.outcome ? ` ${outcomeNow(next)}` : '';
  switch (move.type) {
    case 'see': {
      if (p !== 0) return `${name} looks at their cards.`;
      const hand = state.hands[0] ?? [];
      return `You look at your cards: ${listCards(hand)} — ${rankHand(hand).name}.`;
    }
    case 'pack':
      return `${name} ${v(p, 'pack', 'packs')}.${end}`;
    case 'chaal':
    case 'raise': {
      const pay = moveCost(state, p, move);
      const how = blind ? ' blind' : '';
      const capped = hitsPotLimit(state, p, move)
        ? ` That brings the pot to the ${state.potLimit}-boot limit, so everyone still in shows their cards.`
        : '';
      const base =
        move.type === 'chaal'
          ? `${name} ${v(p, 'chaal', 'chaals')}${how} for ${boots(pay)}.`
          : `${name} ${v(p, 'raise', 'raises')}${how} and ${v(p, 'put', 'puts')} in ${boots(pay)} — the stake is now ${boots(next.stake)}.`;
      return `${base}${capped}${end}`;
    }
    case 'show':
      return `${name} ${v(p, 'ask', 'asks')} for a show and ${v(p, 'pay', 'pays')} ${boots(moveCost(state, p, move))}.${end}`;
  }
}

function listCards(cards: readonly CardCode[]): string {
  const names = cards.map(cardName);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// -------------------------------------------------------------------- coach

function coachFor(state: TeenPattiState, p: PlayerId): CoachAdvice {
  if (state.outcome) return { situation: summaryOf(state) };
  const left = activeSeats(state).length;
  const table = `${left} players are still in and the pot holds ${boots(state.pot)}.`;
  if (state.packed[p]) {
    return { situation: `You've packed, so you're out of this hand. ${table}` };
  }
  const turn = state.turn ?? 0;
  if (turn !== p) {
    const who = turn === 0 ? "the learner's" : `Player ${turn}'s`;
    return {
      situation: `It's ${who} turn. ${table} Watch what they do — it tells you something about their hand.`,
    };
  }
  const options = `You can ${joinOr(moveOptions(state, p))}.`;
  const chaal: TeenPattiMove = { type: 'chaal' };
  const chaalCost = boots(moveCost(state, p, chaal));
  const limit = `${state.potLimit}-boot pot limit`;
  // Near the pot limit the next bet is cut down to fit and ends the betting.
  let price: string;
  if (hitsPotLimit(state, p, chaal)) {
    const cut = baseCost(state, p, 'chaal') > moveCost(state, p, chaal) ? ' (cut down to fit)' : '';
    price = `The stake is ${boots(state.stake)}, but the pot is close to the ${limit}: your next bet costs ${chaalCost}${cut}, brings the pot to the limit, and then everyone still in must show.`;
  } else {
    price = state.seen[p]
      ? `The stake is ${boots(state.stake)}, and as a seen player you pay double: a chaal costs ${chaalCost}.`
      : `The stake is ${boots(state.stake)}, so a blind chaal costs ${chaalCost}.`;
    if (canRaise(state) && hitsPotLimit(state, p, { type: 'raise' })) {
      price += ` A raise would bring the pot to the ${limit}, which ends the betting and makes everyone still in show.`;
    }
  }
  let situation: string;
  if (!state.seen[p]) {
    situation = `You're playing blind — you haven't looked at your cards yet. ${price} ${table} ${options}`;
  } else {
    const rank = handRankOf(state, p);
    situation = `You've seen your cards: ${rank.name}, which beats ${aboutPct(handStrength(rank))} of all hands. ${price} ${table} ${options}`;
  }
  const choice = chooseMove(state, p, 'normal', null);
  return { situation, suggestion: choice.move, why: choice.why };
}

// ------------------------------------------------------------------- engine

export const teenPattiEngine: GameEngine<TeenPattiState, TeenPattiMove> = {
  id: 'teen-patti',
  setup(config: GameConfig, rng: Rng): TeenPattiState {
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
    assertLegal(teenPattiEngine, state, move);
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
    return move.type;
  },
};

export default teenPattiEngine;
