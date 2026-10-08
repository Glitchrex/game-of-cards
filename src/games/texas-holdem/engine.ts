/**
 * Texas Hold'em Poker (No-Limit) engine (docs/RULES_DECISIONS.md → Texas Hold'em).
 *
 * One hand per game. 4 seats by default (2–6), 100 chips each, blinds 1/2, the
 * button chosen by the seed. Everyone gets two hole cards; four betting rounds
 * (pre-flop, flop, turn, river) with fold / check / call / bet / raise /
 * all-in; side pots for unequal all-ins; the best five-card hand out of seven
 * wins at the showdown, ties split (odd chips to the first winner left of the
 * button). Board cards are dealt automatically inside applyMove when a betting
 * round closes.
 *
 * Seat 0 is the learner in play mode. 1 unit = 1 chip:
 * humanNetUnits = final stack − starting stack (worst case −100).
 */
import { type CardCode, cardName, cardShort } from '@/games/core/cards';
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
import { type HandValue, decidedByKicker, evaluateHand, madeByBoard } from './hand-eval';
import {
  type HoldemPot,
  type MoveProblem,
  type Street,
  type TexasHoldemMove,
  type TexasHoldemState,
  betOptions,
  legalMovesFor,
  moveKeyOf,
  moveProblem,
  potTotal,
  setupState,
  transition,
} from './rules';
import { chips, chooseMove, describeHoldings } from './strategy';

export type {
  HoldemLogEntry,
  HoldemPot,
  Street,
  TexasHoldemMove,
  TexasHoldemMoveType,
  TexasHoldemOptions,
  TexasHoldemOutcome,
  TexasHoldemState,
  BetOptions,
} from './rules';
export {
  DEFAULT_BIG_BLIND,
  DEFAULT_PLAYERS,
  DEFAULT_SMALL_BLIND,
  DEFAULT_STACK,
  MAX_LOSS_UNITS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  STREETS,
  betOptions,
  buildPots,
  isAllIn,
  liveSeats,
  potTotal,
  seatsWithChips,
} from './rules';
export {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type HandCategory,
  type HandValue,
  compareHands,
  decidedByKicker,
  evaluate7,
  evaluateHand,
  madeByBoard,
  sameMadeHand,
} from './hand-eval';
export { chenScore, describeHole, estimateEquity } from './strategy';

/** A |net| of at least this many chips counts as a big pot for titles/roasts. */
export const BIG_POT_UNITS = 30;

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
/** Verb agreeing with the seat: v(0,'fold','folds') → 'fold'. */
function v(p: PlayerId, you: string, they: string): string {
  return p === 0 ? you : they;
}
function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function listNames(seats: readonly PlayerId[]): string {
  const names = seats.map(lower);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
function joinWith(items: readonly string[], word: string): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${word} ${items[items.length - 1]}`;
}
function listCardNames(cards: readonly CardCode[]): string {
  return joinWith(cards.map(cardName), 'and');
}
function shortCards(cards: readonly CardCode[]): string {
  return cards.map(cardShort).join(' ');
}

const STREET_WORDS: Record<Street, string> = {
  preflop: 'before the flop',
  flop: 'on the flop',
  turn: 'on the turn',
  river: 'on the river',
};
const STREET_TITLES: Record<Street, string> = {
  preflop: 'Before the flop',
  flop: 'On the flop',
  turn: 'On the turn',
  river: 'On the river',
};

/** "Button", "Small blind", "Big blind" or "" for other seats. */
export function positionName(state: TexasHoldemState, seat: PlayerId): string {
  if (state.players === 2) {
    return seat === state.button ? 'Button and small blind' : 'Big blind';
  }
  if (seat === state.button) return 'Button';
  if (seat === state.smallBlindSeat) return 'Small blind';
  if (seat === state.bigBlindSeat) return 'Big blind';
  return '';
}

interface Aggression {
  player: PlayerId;
  effect: 'bet' | 'raise';
}

/**
 * The most recent bet or raise on this street (null if nobody bet yet), or with
 * `shortOnly` the most recent one smaller than a full bet/raise (always an all-in).
 */
function lastAggression(state: TexasHoldemState, shortOnly = false): Aggression | null {
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i];
    if (!e) continue;
    if (e.kind === 'deal') break;
    if (e.kind !== 'action' || (e.effect !== 'bet' && e.effect !== 'raise')) continue;
    if (!shortOnly || !e.full) return { player: e.player, effect: e.effect };
  }
  return null;
}

function isBigBlindOption(state: TexasHoldemState, p: PlayerId): boolean {
  return (
    state.street === 'preflop' &&
    p === state.bigBlindSeat &&
    state.currentBet === state.bigBlind &&
    (state.streetBets[p] ?? 0) === state.currentBet
  );
}

// ------------------------------------------------------------- checkMove

function reasonFor(
  state: TexasHoldemState,
  p: PlayerId,
  move: TexasHoldemMove,
  problem: MoveProblem,
): string {
  const o = betOptions(state, p);
  const last = lastAggression(state);
  const bettorText = last === null ? 'the big blind' : lower(last.player);
  const bettorDid = last?.effect === 'raise' ? 'raised' : 'bet';
  const blindsOnly = state.street === 'preflop' && last === null;
  // What the player CAN do instead, e.g. "call 4 chips, raise to 10 or more, or fold".
  const stay = o.canCheck ? 'check' : `call ${chips(o.toCall)}${o.callIsAllIn ? ' (all-in)' : ''}`;
  const raiseWords =
    o.canRaise && o.maxTo > o.minRaiseTo
      ? `raise to ${o.minRaiseTo} or more`
      : o.canRaise
        ? `go all-in for ${chips(state.stacks[p] ?? 0)}`
        : null;
  const alternatives = raiseWords ? `${stay}, ${raiseWords}, or fold` : `${stay} or fold`;
  switch (problem.kind) {
    case 'over':
      return 'The hand is over — there are no more moves to make.';
    case 'not-a-move':
      return "That isn't a poker move. On your turn you can fold, check, call, bet, raise or go all-in.";
    case 'no-seat':
      return `There is no seat ${p} at this table.`;
    case 'folded':
      return p === 0
        ? "You've already folded, so you're out of this hand — sit back and watch how it ends."
        : `Player ${p} has already folded and is out of this hand.`;
    case 'all-in':
      return p === 0
        ? "You're already all-in — every chip you have is in the pot, so there's nothing more to decide. Just watch the cards come out."
        : `Player ${p} is all-in and has no more decisions to make this hand.`;
    case 'not-your-turn':
      return p === 0
        ? `It's ${poss(problem.turn)} turn, not yours.`
        : `It's ${poss(problem.turn)} turn, not ${poss(p)}.`;
    case 'check-facing-bet': {
      const options = o.canRaise ? 'You can call, raise or fold.' : 'You can call or fold.';
      if (blindsOnly) {
        const more = (state.streetBets[p] ?? 0) > 0 ? ' more' : '';
        return `You can't check — the big blind is ${chips(state.bigBlind)}, so staying in costs ${chips(o.toCall)}${more}. ${options}`;
      }
      const raise = o.canRaise ? ', raise,' : '';
      return `You can't check — ${bettorText} ${bettorDid}, so the bet to match is ${chips(state.currentBet)}. Call ${chips(o.toCall)} to stay in${raise} or fold.`;
    }
    case 'nothing-to-call':
      if (isBigBlindOption(state, p)) {
        return "There's nothing to call — you already put in the big blind and nobody raised. You can check for free, or raise.";
      }
      return "There's nothing to call — nobody has bet yet this round. You can check for free, or make a bet.";
    case 'bet-exists':
      if (blindsOnly) {
        return `Before the flop the blinds already count as the first bet, so you can't "bet" — you can ${alternatives}.`;
      }
      return `${capitalise(bettorText)} already ${bettorDid} this round (the bet is ${chips(state.currentBet)}), so you can't open the betting — you can ${alternatives}.`;
    case 'no-bet-to-raise': {
      const bet =
        o.maxTo > o.minBet ? `bet ${chips(o.minBet)} or more` : `go all-in for ${chips(o.maxTo)}`;
      return `Nobody has bet yet this round, so there's nothing to raise. You can check, or ${bet}.`;
    }
    case 'not-whole':
      return problem.field === 'amount'
        ? 'Bets are made in whole chips — choose an amount like 2 or 10.'
        : 'Raises are made in whole chips — choose a total like 8 or 20.';
    case 'bet-too-small':
      return `The smallest bet allowed is the big blind: ${chips(o.minBet)}. You can only bet less than that by going all-in.`;
    case 'bet-too-big': {
      const amount = move.type === 'bet' ? move.amount : 0;
      return `You only have ${chips(o.maxTo)}, so you can't bet ${amount}. To bet everything, go all-in.`;
    }
    case 'raise-not-bigger':
      return `A raise has to make the bet bigger than ${chips(state.currentBet)}. To just match it, call instead.`;
    case 'raise-too-small':
      return `The smallest raise here is to ${chips(o.minRaiseTo)} — a raise must add at least ${chips(state.minRaise)} (the size of the last bet or raise) on top of the ${chips(state.currentBet)} bet. You can raise by less only by going all-in.`;
    case 'raise-too-big': {
      const bet = state.streetBets[p] ?? 0;
      const have =
        bet > 0
          ? `${chips(o.maxTo)} for this round (${chips(state.stacks[p] ?? 0)} left plus the ${chips(bet)} you already bet)`
          : chips(o.maxTo);
      return `You have ${have}, so the most you can raise to is ${o.maxTo} — and that's going all-in.`;
    }
    case 'raise-closed': {
      const short = lastAggression(state, true);
      const whoText = short === null ? 'A player' : capitalise(lower(short.player));
      const size = short?.effect === 'bet' ? 'bet' : 'raise';
      const what = problem.allIn ? "you can't go all-in as a raise" : "you can't raise";
      return `${whoText} went all-in for less than a full ${size}, and you have already acted this round, so the betting isn't re-opened: ${what}. You can call ${chips(o.toCall)} or fold.`;
    }
    case 'cannot-cover-raise':
      return `You don't have enough chips to raise — calling ${chips(o.toCall)} already puts you all-in. You can call or fold.`;
    case 'others-all-in':
      return o.canCall
        ? `Everyone else still in the hand is all-in, so nobody could match a raise. You can call ${chips(o.toCall)} or fold.`
        : "Everyone else still in the hand is all-in, so there's nobody left to bet against — just check.";
  }
}

function checkMoveFor(state: TexasHoldemState, p: PlayerId, move: TexasHoldemMove): MoveCheck {
  const problem = moveProblem(state, p, move);
  return problem ? { ok: false, reason: reasonFor(state, p, move, problem) } : { ok: true };
}

// --------------------------------------------------------------- outcomes

function potLabel(i: number, total: number): string {
  if (total === 1) return 'the pot';
  return i === 0 ? 'the main pot' : total === 2 ? 'the side pot' : `side pot ${i}`;
}

/** "you win the 80-chip pot with …" (present) or "you won …" (past) for every pot. */
function potsText(state: TexasHoldemState, past: boolean): string {
  const pots = state.outcome?.pots ?? [];
  const parts = pots.map((pot: HoldemPot, i) => {
    const label = potLabel(i, pots.length);
    const sized =
      pots.length === 1 ? `the ${pot.amount}-chip pot` : `${label} (${chips(pot.amount)})`;
    const w = pot.winners[0] ?? 0;
    if (pot.handName === null) {
      return `${lower(w)} ${past ? 'took' : v(w, 'take', 'takes')} ${sized}, which nobody else could win`;
    }
    if (pot.winners.length > 1) {
      return `${listNames(pot.winners)} split ${sized}, each with ${pot.handName}`;
    }
    return `${lower(w)} ${past ? 'won' : v(w, 'win', 'wins')} ${sized} with ${pot.handName}`;
  });
  return joinWith(parts, 'and');
}

/** Present-tense description of how the hand just ended (for the move log). */
function outcomeNow(state: TexasHoldemState): string {
  const o = state.outcome;
  if (!o) return '';
  if (o.kind === 'fold') {
    const w = o.winners[0] ?? 0;
    return `Everyone else has folded, so ${lower(w)} ${v(w, 'win', 'wins')} the ${o.pots[0]?.amount ?? potTotal(state)}-chip pot.`;
  }
  return `Showdown: ${potsText(state, false)}.`;
}

function foldStreet(state: TexasHoldemState, seat: PlayerId): Street | null {
  for (const e of state.log) {
    if (e.kind === 'action' && e.player === seat && e.type === 'fold') return e.street;
  }
  return null;
}

function finalHand(state: TexasHoldemState, seat: PlayerId): HandValue {
  return evaluateHand([...(state.hands[seat] ?? []), ...state.board]);
}

/** Past-tense one-sentence summary for the result screen. */
function summaryOf(state: TexasHoldemState): string {
  const o = state.outcome;
  if (!o) return 'The hand is still going.';
  const w = o.winners[0] ?? 0;
  const humanFoldedOn = foldStreet(state, 0);
  if (o.kind === 'fold') {
    const pot = o.pots[0]?.amount ?? 0;
    if (w === 0) {
      return `Everyone else folded, so you won the ${pot}-chip pot without showing your cards.`;
    }
    return `You folded ${STREET_WORDS[humanFoldedOn ?? 'preflop']}, and ${lower(w)} won the ${pot}-chip pot without a showdown.`;
  }
  if (humanFoldedOn !== null) {
    return `You folded ${STREET_WORDS[humanFoldedOn]}; at the showdown ${potsText(state, true)}.`;
  }
  const mine = finalHand(state, 0);
  if (o.pots.length === 1) {
    const pot = o.pots[0];
    if (pot) {
      const others = o.showdown.filter((s) => s !== 0);
      if (pot.winners.length === 1 && pot.winners[0] === 0) {
        const beat =
          others.length === 1
            ? `${poss(others[0] ?? 1)} ${finalHand(state, others[0] ?? 1).name}`
            : 'every other hand';
        return `At the showdown your ${mine.name} beat ${beat}, and you won the ${pot.amount}-chip pot.`;
      }
      if (pot.winners.includes(0)) {
        const sharers = [0, ...pot.winners.filter((s) => s !== 0)];
        return `At the showdown ${listNames(sharers)} had equally good hands (${mine.name}), so you split the ${pot.amount}-chip pot.`;
      }
      const handName = pot.handName ?? finalHand(state, w).name;
      if (pot.winners.length > 1) {
        return `At the showdown ${listNames(pot.winners)} split the ${pot.amount}-chip pot, each with ${handName}, which beat your ${mine.name}.`;
      }
      return `At the showdown ${poss(w)} ${handName} beat your ${mine.name}, so ${lower(w)} won the ${pot.amount}-chip pot.`;
    }
  }
  return `At the showdown ${potsText(state, true)}.`;
}

// ----------------------------------------------------------------- result

function computeResult(state: TexasHoldemState): GameResult {
  const o = state.outcome;
  if (!o) throw new Error("Texas Hold'em: result() called before the hand is over");
  const scores = state.stacks.map((s, i) => s - (state.startingStacks[i] ?? 0));
  const net = scores[0] ?? 0;
  const humanOutcome: GameResult['humanOutcome'] = net > 0 ? 'win' : net < 0 ? 'loss' : 'push';
  const folded = state.folded[0] === true;
  const atBoard = (seat: PlayerId, n: number) =>
    evaluateHand([...(state.hands[seat] ?? []), ...state.board.slice(0, n)]).score;

  const atShowdown = o.kind === 'showdown' && o.showdown.includes(0);
  const contested = o.pots.filter((p) => p.eligible.length > 1);
  const wonAtShowdown = atShowdown && net > 0 && contested.some((p) => p.winners.includes(0));
  const mine = !folded && state.board.length >= 3 ? finalHand(state, 0) : null;
  // A hand that is entirely on the board (four Nines, a royal flush) belongs to everyone:
  // it earns no special-hand tag or "perfect" flag.
  const ownHand = mine !== null && !madeByBoard(state.hands[0] ?? [], state.board) ? mine : null;
  const beaten: PlayerId[] =
    atShowdown && mine
      ? o.showdown.filter((s) => s !== 0 && finalHand(state, s).score < mine.score)
      : [];

  const luckyLastCard =
    wonAtShowdown && state.board.length === 5 && beaten.some((s) => atBoard(s, 4) > atBoard(0, 4));

  const allInOn = state.allInStreet[0] ?? null;
  const behindStreets: number[] =
    allInOn === 'preflop' || allInOn === 'flop' ? [3, 4] : allInOn === 'turn' ? [4] : [];
  const comeback =
    wonAtShowdown && beaten.some((s) => behindStreets.some((n) => atBoard(s, n) > atBoard(0, n)));

  let closeFinish = false;
  if (atShowdown && mine) {
    const mainPot = contested
      .filter((p) => p.eligible.includes(0))
      .reduce<HoldemPot | null>((best, p) => (best && best.amount >= p.amount ? best : p), null);
    if (mainPot) {
      if (mainPot.winners.includes(0)) {
        if (mainPot.winners.length === 1) {
          const rivals = mainPot.eligible
            .filter((s) => s !== 0)
            .map((s) => finalHand(state, s))
            .sort((a, b) => b.score - a.score);
          const runnerUp = rivals[0];
          closeFinish = runnerUp ? decidedByKicker(mine, runnerUp) : false;
        }
      } else {
        closeFinish = decidedByKicker(finalHand(state, mainPot.winners[0] ?? 0), mine);
      }
    }
  }

  const raised = state.log.some(
    (e) => e.kind === 'action' && e.player === 0 && (e.effect === 'bet' || e.effect === 'raise'),
  );
  const tags: string[] = [];
  if (ownHand?.isRoyal) tags.push('royal-flush');
  else if (ownHand?.category === 'straight-flush') tags.push('straight-flush');
  if (ownHand?.category === 'four-of-a-kind') tags.push('four-of-a-kind');
  if (o.kind === 'fold' && o.winners[0] === 0 && raised) tags.push('bluff-win');
  if (atShowdown) tags.push('showdown');
  if (atShowdown && o.pots.some((p) => p.winners.length > 1 && p.winners.includes(0))) {
    tags.push('split-pot');
  }
  if (o.kind === 'showdown' && o.pots.length > 1) tags.push('side-pot');
  if (allInOn !== null) tags.push('all-in');
  if (folded && o.kind === 'showdown' && state.board.length === 5) {
    const would = finalHand(state, 0).score;
    if (o.showdown.every((s) => finalHand(state, s).score < would)) tags.push('folded-best-hand');
  }

  const flags: ResultFlags = {
    comeback,
    closeFinish,
    luckyLastCard,
    bigPot: Math.abs(net) >= BIG_POT_UNITS,
    perfect: net > 0 && ownHand !== null && ownHand.categoryIndex >= 7,
    bust: (state.stacks[0] ?? 0) === 0,
    folded,
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

// ----------------------------------------------------------------- describe

function actionText(state: TexasHoldemState, p: PlayerId, move: TexasHoldemMove): string {
  const name = seatName(p);
  const o = betOptions(state, p);
  const stack = state.stacks[p] ?? 0;
  switch (move.type) {
    case 'fold':
      return `${name} ${v(p, 'fold', 'folds')}.`;
    case 'check':
      return `${name} ${v(p, 'check', 'checks')}.`;
    case 'call':
      return o.callIsAllIn
        ? `${name} ${v(p, 'call', 'calls')} ${chips(o.toCall)} and ${v(p, 'are', 'is')} all-in.`
        : `${name} ${v(p, 'call', 'calls')} ${chips(o.toCall)}.`;
    case 'bet':
      return move.amount === o.maxTo
        ? `${name} ${v(p, 'bet', 'bets')} ${chips(move.amount)} — all-in!`
        : `${name} ${v(p, 'bet', 'bets')} ${chips(move.amount)}.`;
    case 'raise':
      return move.to === o.maxTo
        ? `${name} ${v(p, 'raise', 'raises')} to ${chips(move.to)} — all-in!`
        : `${name} ${v(p, 'raise', 'raises')} to ${chips(move.to)}.`;
    case 'all-in':
      if (o.allInEffect === 'call') {
        return `${name} ${v(p, 'call', 'calls')} all-in for ${chips(stack)}.`;
      }
      if (o.allInEffect === 'bet')
        return `${name} ${v(p, 'go', 'goes')} all-in for ${chips(stack)}.`;
      return `${name} ${v(p, 'go', 'goes')} all-in, raising to ${chips(o.maxTo)}.`;
  }
}

/** What happened automatically after the move: returned chips, new board cards, the end. */
function consequences(before: TexasHoldemState, after: TexasHoldemState): string {
  const fresh = after.log.slice(before.log.length);
  const parts: string[] = [];
  for (const e of fresh) {
    if (e.kind === 'uncalled') {
      parts.push(
        `${capitalise(chips(e.amount))} that nobody matched ${e.amount === 1 ? 'goes' : 'go'} back to ${lower(e.player)}.`,
      );
    }
  }
  const deals = fresh.filter((e) => e.kind === 'deal');
  if (deals.length > 1)
    parts.push('No more betting is possible, so the rest of the board is dealt.');
  for (const e of deals) {
    if (e.kind !== 'deal') continue;
    parts.push(`The ${e.street}: ${listCardNames(e.cards)}.`);
  }
  if (after.outcome) parts.push(outcomeNow(after));
  return parts.join(' ');
}

function describe(state: TexasHoldemState, p: PlayerId, move: TexasHoldemMove): string {
  const check = checkMoveFor(state, p, move);
  if (!check.ok) return `Not allowed: ${check.reason ?? 'that move is illegal right now.'}`;
  const next = transition(state, move);
  const rest = consequences(state, next);
  return rest ? `${actionText(state, p, move)} ${rest}` : actionText(state, p, move);
}

// -------------------------------------------------------------------- coach

function optionsText(state: TexasHoldemState, p: PlayerId): string {
  const o = betOptions(state, p);
  const items: string[] = ['fold'];
  if (o.canCheck) items.push('check');
  if (o.canCall)
    items.push(o.callIsAllIn ? `call ${chips(o.toCall)} (all-in)` : `call ${chips(o.toCall)}`);
  // Amounts below all-in (all-in itself is listed separately).
  const span = (lo: number, hi: number) => (lo === hi ? chips(lo) : `${lo}–${hi} chips`);
  if (o.canBet && o.maxTo > o.minBet) items.push(`bet ${span(o.minBet, o.maxTo - 1)}`);
  if (o.canRaise && o.maxTo > o.minRaiseTo) {
    items.push(`raise to ${span(o.minRaiseTo, o.maxTo - 1)}`);
  }
  if (o.canAllIn && o.allInEffect !== 'call')
    items.push(`go all-in for ${chips(state.stacks[p] ?? 0)}`);
  return joinWith(items, 'or');
}

function positionText(state: TexasHoldemState, p: PlayerId): string {
  if (state.players === 2) {
    return p === state.button
      ? "You're on the button and post the small blind: you act first before the flop and last after it."
      : "You're the big blind: you act last before the flop and first after it.";
  }
  if (p === state.button) {
    return "You're on the button, so you act last after the flop — the best seat at the table.";
  }
  if (p === state.smallBlindSeat) {
    return `You're the small blind (you put in ${chips(state.smallBlind)}), so you act first after the flop.`;
  }
  if (p === state.bigBlindSeat) {
    return `You're the big blind (you put in ${chips(state.bigBlind)}) and act early after the flop.`;
  }
  const behind = (state.button - p + state.players) % state.players;
  return behind >= 2
    ? 'You act early, with several players still to come — play only good hands from here.'
    : "You're one seat before the button, a good late position.";
}

function coachFor(state: TexasHoldemState, p: PlayerId): CoachAdvice {
  if (state.outcome) return { situation: summaryOf(state) };
  const live = state.folded.filter((f) => !f).length;
  const table = `${live} players are still in and the pot has ${chips(potTotal(state))}.`;
  if (state.folded[p]) {
    return { situation: `You've folded, so you're out of this hand. ${table}` };
  }
  if ((state.stacks[p] ?? 0) === 0) {
    return {
      situation: `You're all-in, so you have no more decisions — the rest of the cards will decide it. ${table}`,
    };
  }
  const turn = state.toAct ?? 0;
  const hole = state.hands[p] ?? [];
  const holding = `You hold ${shortCards(hole)} — ${describeHoldings(hole, state.board)}.`;
  if (turn !== p) {
    return {
      situation: `It's ${turn === 0 ? 'your' : `Player ${turn}'s`} turn. ${holding} ${table} Watch what they do — big bets usually mean strong hands.`,
    };
  }
  const o = betOptions(state, p);
  const board = state.board.length ? ` The board shows ${shortCards(state.board)}.` : '';
  let facing: string;
  if (o.canCall) {
    facing = ` To stay in you must call ${chips(o.toCall)}${o.callIsAllIn ? ', which would put you all-in' : ''}.`;
  } else if (isBigBlindOption(state, p)) {
    facing = ' Nobody raised your big blind, so you can check for free.';
  } else {
    facing = ' Nobody has bet yet, so you can check for free.';
  }
  const situation = `${STREET_TITLES[state.street]}. ${holding}${board} ${positionText(state, p)} The pot has ${chips(potTotal(state))}.${facing} You can ${optionsText(state, p)}.`;
  const pick = chooseMove(state, p, 'normal', null);
  return { situation, suggestion: pick.move, why: pick.why };
}

// ------------------------------------------------------------------- engine

export const texasHoldemEngine: GameEngine<TexasHoldemState, TexasHoldemMove> = {
  id: 'texas-holdem',
  setup(config: GameConfig, rng: Rng): TexasHoldemState {
    return setupState(config, rng);
  },
  currentPlayer(state) {
    return state.outcome ? null : state.toAct;
  },
  legalMoves(state, player) {
    return legalMovesFor(state, player);
  },
  checkMove(state, player, move) {
    return checkMoveFor(state, player, move);
  },
  applyMove(state, move) {
    assertLegal(texasHoldemEngine, state, move);
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

export default texasHoldemEngine;
