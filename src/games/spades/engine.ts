/**
 * Spades — pure rules engine. One hand = one game (docs/DECISIONS.md D-05).
 *
 * Seats 0–3 play clockwise (seat i+1 is on seat i's left); seat 0 is the
 * learner in play mode. Partnerships: seats 0 & 2 (learner + bot partner)
 * against seats 1 & 3. Flow:
 *  1. setup: the dealer is chosen from the seed (or config.options.dealer) and
 *     13 cards are dealt to each seat, one at a time starting left of the dealer.
 *  2. Phase 'bid': starting left of the dealer, each seat bids 0–13 tricks once
 *     (0 = Nil: "I will win no tricks"). No Blind Nil.
 *  3. Phase 'play': the player left of the dealer leads the first trick.
 *     Follow suit if you can; otherwise play any card. Spades are always trump.
 *     Spades can't be LED until they are broken — a Spade has been played on a
 *     trick of another suit (rules.ts breaksSpades) — unless the leader holds
 *     nothing but Spades. The highest Spade wins the trick, otherwise the
 *     highest card of the suit led; the winner leads next. A completed trick is
 *     resolved inside the applyMove that plays its 4th card (the Board can show
 *     `tricks[tricks.length - 1]` while animating).
 *  4. After 13 tricks each partnership scores (see rules.ts scoreTeam):
 *     made contract → 10 × contract + 1 per bag; failed → −10 × contract;
 *     Nil ±100; a Nil bidder's tricks never help the partner's contract but do
 *     count as bags. The higher team score wins; a tie is a push. Betting ±1 unit.
 *
 * No randomness is needed after the deal, so the state carries no RNG.
 */
import { isCardCode, makeDeck, sortHand, suitOf, type CardCode } from '@/games/core/cards';
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
  bidLabel,
  breaksSpades,
  checkPlay,
  HAND_SIZE,
  isSpade,
  legalPlays,
  MAX_BID,
  NIL,
  nextSeat,
  payoutUnits,
  pointsLabel,
  scoreHand,
  SEATS,
  seatLabel,
  seatPossessive,
  teamOf,
  teamSeats,
  theCard,
  TRICKS_PER_HAND,
  tricksLabel,
  tricksNeeded,
  verbFor,
  winningPlay,
  type PlayContext,
  type SpadesPlay,
  type TeamScore,
} from './rules';
import { coachAdvice, easyMove, normalDecision, seatView } from './strategy';

export type { SpadesPlay } from './rules';

export type SpadesPhase = 'bid' | 'play' | 'over';

/** A finished trick. */
export interface SpadesTrick {
  leader: PlayerId;
  /** The four plays in the order they were made. */
  plays: SpadesPlay[];
  winner: PlayerId;
}

export interface SpadesState {
  phase: SpadesPhase;
  /** The dealer; bidding and the first lead start on the dealer's left. */
  dealer: PlayerId;
  /** Cards currently held by each seat (kept sorted for display). */
  hands: CardCode[][];
  /** Each seat's bid (0 = Nil); null until that seat has bid. */
  bids: (number | null)[];
  /** Seat whose decision it is (meaningless once phase is 'over'). */
  turn: PlayerId;
  /** Seat that led (or will lead) the current trick. */
  leader: PlayerId;
  /** Plays made to the current, unfinished trick. */
  trick: SpadesPlay[];
  /** Completed tricks, oldest first. */
  tricks: SpadesTrick[];
  /** Tricks won by each seat. */
  tricksWon: number[];
  /**
   * True once a Spade has been played on a trick of another suit (a player who
   * couldn't follow suit trumped or threw one away). A Spade led by a Spades-only
   * hand, and Spades played to follow it, do not break Spades.
   */
  spadesBroken: boolean;
}

export type SpadesMove = { type: 'bid'; tricks: number } | { type: 'play'; card: CardCode };

/** Game-specific options (config.options). */
export interface SpadesOptions {
  /** Fix the dealer seat (0–3). Default: chosen at random from the seed. */
  dealer?: PlayerId;
}

function readDealer(options: Record<string, unknown> | undefined, rng: Rng): PlayerId {
  const raw = options?.dealer;
  if (raw === undefined) return rng.int(SEATS);
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < SEATS) return raw;
  throw new RangeError(`Spades: options.dealer must be a seat from 0 to 3 (got ${String(raw)}).`);
}

function isMoveShape(move: unknown): move is SpadesMove {
  if (typeof move !== 'object' || move === null) return false;
  const m = move as { type?: unknown; tricks?: unknown; card?: unknown };
  if (m.type === 'bid') return typeof m.tricks === 'number';
  if (m.type === 'play') return typeof m.card === 'string';
  return false;
}

function hand(state: SpadesState, seat: PlayerId): CardCode[] {
  return state.hands[seat] ?? [];
}

function playContext(state: SpadesState): PlayContext {
  return { trick: state.trick, spadesBroken: state.spadesBroken };
}

function checkBid(tricks: number): MoveCheck {
  if (!Number.isInteger(tricks)) {
    return {
      ok: false,
      reason: `A bid is a whole number of tricks from 0 (Nil) to 13 — you can't bid ${tricks}.`,
    };
  }
  if (tricks < 0 || tricks > MAX_BID) {
    return {
      ok: false,
      reason: `You can bid from 0 (Nil) up to 13 tricks — there are only 13 tricks in a hand, so ${tricks} isn't possible.`,
    };
  }
  return { ok: true };
}

/** Team contract (sum of the non-Nil bids) for the given bids. */
function contractOf(team: 0 | 1, bids: readonly (number | null)[]): number {
  return teamSeats(team).reduce((sum, s) => sum + (bids[s] ?? 0), 0);
}

function applyBid(state: SpadesState, tricks: number): SpadesState {
  const seat = state.turn;
  const bids = state.bids.map((b, i) => (i === seat ? tricks : b));
  if (bids.some((b) => b === null)) {
    return { ...state, bids, turn: nextSeat(seat) };
  }
  const first = nextSeat(state.dealer);
  return { ...state, phase: 'play', bids, turn: first, leader: first };
}

function applyPlay(state: SpadesState, card: CardCode): SpadesState {
  const seat = state.turn;
  const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => c !== card) : h));
  const trick = [...state.trick, { seat, card }];
  const spadesBroken = state.spadesBroken || breaksSpades(state.trick, card);
  if (trick.length < SEATS) {
    return { ...state, hands, trick, spadesBroken, turn: nextSeat(seat) };
  }
  const winner = winningPlay(trick).seat;
  const tricks = [...state.tricks, { leader: state.leader, plays: trick, winner }];
  const tricksWon = state.tricksWon.map((n, i) => (i === winner ? n + 1 : n));
  return {
    ...state,
    phase: tricks.length === TRICKS_PER_HAND ? 'over' : 'play',
    hands,
    trick: [],
    tricks,
    tricksWon,
    spadesBroken,
    turn: winner,
    leader: winner,
  };
}

function finalBids(state: SpadesState): number[] {
  return state.bids.map((b) => b ?? 0);
}

/** Tricks won by each seat after the first `count` completed tricks. */
function tricksAfter(state: SpadesState, count: number): number[] {
  const won = [0, 0, 0, 0];
  for (const t of state.tricks.slice(0, count)) won[t.winner] = (won[t.winner] ?? 0) + 1;
  return won;
}

/**
 * Was the learner's team "behind" with 4 or fewer tricks left? Behind = it
 * still needed at least 2 more tricks, and more than half of those remaining,
 * to make its contract (needing just the very last trick is luckyLastCard
 * territory, not a comeback).
 */
function wasBehindLate(state: SpadesState): boolean {
  const bids = finalBids(state);
  for (let done = TRICKS_PER_HAND - 4; done < TRICKS_PER_HAND; done++) {
    const left = TRICKS_PER_HAND - done;
    const need = tricksNeeded(0, bids, tricksAfter(state, done));
    if (need >= 2 && need * 2 > left) return true;
  }
  return false;
}

function teamClause(s: TeamScore, learner: boolean): string {
  const who = learner ? 'your team' : 'the opponents';
  const bits: string[] = [];
  if (s.contract === 0) bits.push('bid two Nils');
  if (s.contract > 0) {
    if (!s.made) {
      bits.push(`bid ${s.contract} but took only ${s.contractTricks} and got set`);
    } else if (s.contractTricks === s.contract) {
      bits.push(`bid ${s.contract} and made it exactly`);
    } else {
      bits.push(`bid ${s.contract} and took ${s.contractTricks}`);
    }
  }
  for (const n of s.nils) {
    const nilOwner = n.seat === 0 ? 'your' : seatPossessive(n.seat);
    bits.push(`${nilOwner} Nil ${n.made ? 'succeeded' : 'failed'}`);
  }
  const listed =
    bits.length <= 1
      ? (bits[0] ?? '')
      : `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}`;
  return `${who} ${listed}`;
}

function summarise(us: TeamScore, them: TeamScore): string {
  const head =
    us.total > them.total
      ? `Your team won ${us.total} to ${them.total}`
      : us.total < them.total
        ? `The opponents won ${them.total} to ${us.total}`
        : `It's a tie at ${pointsLabel(us.total)} each`;
  return `${head}: ${teamClause(us, true)}, while ${teamClause(them, false)}.`;
}

function computeFlags(state: SpadesState, us: TeamScore, them: TeamScore): ResultFlags {
  const won = us.total > them.total;
  const margin = us.total - them.total;
  const tags: string[] = [];
  const ourNilMade = us.nils.some((n) => n.made);
  if (ourNilMade) tags.push('nil');
  if (us.nils.some((n) => !n.made)) tags.push('nilFailed');
  if (them.nils.some((n) => n.made)) tags.push('opponentNil');
  if (them.nils.some((n) => !n.made)) tags.push('bustedNil');
  if (us.contract > 0 && !us.made) tags.push('set');
  if (them.contract > 0 && !them.made) tags.push('setOpponents');
  const exact = us.contract > 0 && us.made && us.bags === 0;
  if (exact) tags.push('exactBid');
  if (us.total === them.total) tags.push('tie');

  // Would the learner's team have been winning if the hand had ended one trick earlier?
  const before = scoreHand(finalBids(state), tricksAfter(state, TRICKS_PER_HAND - 1));
  const winningBeforeLast = before[0].total > before[1].total;
  const humanNil = us.nils.find((n) => n.seat === 0);

  return {
    // A comeback is a WIN after being behind late (ResultFlags: "behind … and still won").
    comeback: won && us.contract > 0 && us.made && wasBehindLate(state),
    closeFinish: Math.abs(margin) <= 10,
    luckyLastCard: won && !winningBeforeLast,
    bigPot: won && margin >= 100,
    perfect: exact || ourNilMade,
    bust: margin < 0 && ((us.contract > 0 && !us.made) || humanNil?.made === false),
    folded: false,
    tags,
  };
}

export const spadesEngine: GameEngine<SpadesState, SpadesMove> = {
  id: 'spades',

  setup(config: GameConfig, rng: Rng): SpadesState {
    if (config.players !== SEATS) {
      throw new RangeError(`Spades is played by exactly ${SEATS} players (got ${config.players}).`);
    }
    const dealer = readDealer(config.options, rng);
    const deck = shuffle(makeDeck(), rng);
    const dealt: CardCode[][] = [[], [], [], []];
    deck.forEach((c, i) => dealt[(dealer + 1 + i) % SEATS]?.push(c));
    const hands = dealt.map((h) => sortHand(h));
    if (hands.some((h) => h.length !== HAND_SIZE)) throw new Error('Spades: bad deal');
    const first = nextSeat(dealer);
    return {
      phase: 'bid',
      dealer,
      hands,
      bids: [null, null, null, null],
      turn: first,
      leader: first,
      trick: [],
      tricks: [],
      tricksWon: [0, 0, 0, 0],
      spadesBroken: false,
    };
  },

  currentPlayer(state) {
    return state.phase === 'over' ? null : state.turn;
  },

  legalMoves(state, player) {
    if (state.phase === 'over' || player !== state.turn) return [];
    if (state.phase === 'bid') {
      return Array.from({ length: MAX_BID + 1 }, (_, tricks) => ({ type: 'bid', tricks }));
    }
    return legalPlays(hand(state, player), playContext(state)).map((card) => ({
      type: 'play',
      card,
    }));
  },

  checkMove(state, player, move) {
    if (state.phase === 'over') {
      return { ok: false, reason: 'The hand is over — all 13 tricks have been played.' };
    }
    if (!isMoveShape(move)) {
      return {
        ok: false,
        reason: "That isn't a Spades move — make a bid, or play one card from your hand.",
      };
    }
    if (player !== state.turn) {
      const doing = state.phase === 'bid' ? 'to bid' : 'to play';
      return {
        ok: false,
        reason:
          state.turn === 0
            ? `It's your turn ${doing}, not ${seatPossessive(player)}.`
            : `It's ${seatPossessive(state.turn)} turn ${doing}, not ${player === 0 ? 'yours' : seatPossessive(player)}.`,
      };
    }
    if (state.phase === 'bid') {
      if (move.type !== 'bid') {
        return {
          ok: false,
          reason:
            'Not yet! Everyone bids before any card is played — first say how many tricks you think you will win (0 = Nil).',
        };
      }
      return checkBid(move.tricks);
    }
    if (move.type !== 'play') {
      const mine = state.bids[player];
      return {
        ok: false,
        reason: `Bidding is over${mine === null || mine === undefined ? '' : ` — you bid ${bidLabel(mine)}`}. Now it's time to play a card.`,
      };
    }
    if (!isCardCode(move.card)) {
      return { ok: false, reason: "That isn't a real card — play one from your hand." };
    }
    return checkPlay(hand(state, player), playContext(state), move.card);
  },

  applyMove(state, move) {
    assertLegal(spadesEngine, state, move);
    return move.type === 'bid' ? applyBid(state, move.tricks) : applyPlay(state, move.card);
  },

  isOver(state) {
    return state.phase === 'over';
  },

  result(state): GameResult {
    if (state.phase !== 'over') throw new Error('Spades: result() called before the hand ended');
    const [us, them] = scoreHand(finalBids(state), state.tricksWon);
    const humanOutcome = us.total > them.total ? 'win' : us.total < them.total ? 'loss' : 'push';
    const winners = humanOutcome === 'win' ? [0, 2] : humanOutcome === 'loss' ? [1, 3] : [];
    return {
      winners,
      humanOutcome,
      humanNetUnits: payoutUnits(us.total, them.total),
      scores: [us.total, them.total, us.total, them.total],
      summary: summarise(us, them),
      flags: computeFlags(state, us, them),
    };
  },

  botMove(state, player, difficulty: Difficulty, rng) {
    if (state.phase === 'over' || player !== state.turn) {
      throw new Error(`Spades: botMove called for seat ${player}, but it is not their turn`);
    }
    const view = seatView(state, player);
    return difficulty === 'easy' ? easyMove(view, rng) : normalDecision(view).move;
  },

  describeMove(state, player, move) {
    const who = seatLabel(player);
    if (move.type === 'bid') {
      let text =
        move.tricks === NIL
          ? `${who} bid Nil — ${player === 0 ? 'you are' : 'they are'} aiming to win no tricks at all.`
          : `${who} bid ${bidLabel(move.tricks)}.`;
      const bids = state.bids.map((b, i) => (i === player ? move.tricks : b));
      if (bids.every((b) => b !== null)) {
        const nilNote = (team: 0 | 1) => {
          const nils = teamSeats(team).filter((s) => bids[s] === NIL);
          return nils.length === 0
            ? ''
            : ` plus ${nils.map((s) => `${seatPossessive(s)} Nil`).join(' and ')}`;
        };
        text += ` Bidding is over: your team's contract is ${tricksLabel(contractOf(0, bids))}${nilNote(0)}, and the opponents' is ${tricksLabel(contractOf(1, bids))}${nilNote(1)}.`;
      }
      return text;
    }
    const lead = state.trick[0];
    let text: string;
    if (!lead) {
      text = `${who} led ${theCard(move.card)}.`;
    } else if (suitOf(move.card) === suitOf(lead.card)) {
      text = `${who} played ${theCard(move.card)}.`;
    } else if (isSpade(move.card)) {
      text = `${who} couldn't follow suit and trumped with ${theCard(move.card)}.`;
    } else {
      text = `${who} couldn't follow suit and threw away ${theCard(move.card)}.`;
    }
    if (!state.spadesBroken && breaksSpades(state.trick, move.card)) text += ' Spades are broken!';
    if (state.trick.length === SEATS - 1) {
      const plays = [...state.trick, { seat: player, card: move.card }];
      const winner = winningPlay(plays).seat;
      text += ` ${seatLabel(winner)} ${verbFor(winner, 'win', 'wins')} the trick.`;
      const bid = state.bids[winner];
      const before = state.tricksWon[winner] ?? 0;
      if (bid === NIL) {
        if (before === 0) {
          text += ` That breaks ${seatPossessive(winner)} Nil bid.`;
        }
      } else {
        const team = teamOf(winner);
        const after = state.tricksWon.map((n, i) => (i === winner ? n + 1 : n));
        const needBefore = tricksNeeded(team, state.bids, state.tricksWon);
        const needAfter = tricksNeeded(team, state.bids, after);
        if (needBefore > 0 && needAfter === 0) {
          text +=
            team === teamOf(0)
              ? ' Your team has made its bid!'
              : ' The opponents have made their bid.';
        }
      }
      if (state.tricks.length === TRICKS_PER_HAND - 1) text += ' That was the last trick.';
    }
    return text;
  },

  coach(state, player): CoachAdvice {
    return coachAdvice(state, player);
  },

  moveKey(move) {
    return move.type === 'bid' ? `bid:${move.tricks}` : `play:${move.card}`;
  },
};

export default spadesEngine;
