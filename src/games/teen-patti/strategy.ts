/**
 * Teen Patti bot and coach logic.
 *
 * Information rules: a seat only ever looks at ITS OWN cards, and only after it
 * has seen them. Everything else comes from public information — who is blind
 * or seen, who has packed, the pot, the stake and the public action history.
 *
 * - normal: plays blind for a round or two, then sees. Seen, it estimates its
 *   chance of beating everyone still in (hand strength vs. the range each
 *   opponent's betting suggests) and compares it with the price of staying in
 *   (pot odds) to chaal, raise, show or pack. Bluffs now and then. Near the pot
 *   limit it knows the next bet forces a show: it looks first (free), never
 *   bluffs or raises into the limit, and chaals rather than asking for a show.
 * - easy: cautious and a little random, but never absurd — it never packs a
 *   pair or better.
 * - coach: the normal logic with every random choice replaced by its textbook
 *   default (pass `rng = null`), so advice is deterministic.
 */
import type { Rng } from '@/games/core/rng';
import type { Difficulty, PlayerId } from '@/games/core/types';
import { type HandRank, handStrength, rankHand } from './hand-eval';
import {
  activeSeats,
  canRaise,
  hitsPotLimit,
  moveCost,
  type TeenPattiMove,
  type TeenPattiMoveType,
  type TeenPattiState,
} from './rules';

export interface StrategyChoice {
  move: TeenPattiMove;
  /** Plain-language reason a beginner understands. */
  why: string;
}

/** "about 62%", or "over 99%" / "less than 1%" at the extremes (never a misleading 100% or 0%). */
export function aboutPct(x: number): string {
  if (x >= 0.995) return 'over 99%';
  if (x < 0.005) return 'less than 1%';
  return `about ${Math.round(x * 100)}%`;
}
const boots = (n: number) => `${n} boot${n === 1 ? '' : 's'}`;
const mv = (type: TeenPattiMoveType): TeenPattiMove => ({ type }) as TeenPattiMove;

/** How many bets (chaal / raise) `player` has made while still blind. Public information. */
export function blindBets(state: TeenPattiState, player: PlayerId): number {
  let n = 0;
  for (const a of state.history) {
    if (a.player === player && a.blind && (a.type === 'chaal' || a.type === 'raise')) n++;
  }
  return n;
}

/**
 * The weakest hand strength (0–1) an opponent probably holds, judged only from
 * their public behaviour: a blind player holds a random hand (0); a seen player
 * who keeps betting is likely to hold something, more so after raises.
 */
export function opponentFloor(state: TeenPattiState, opponent: PlayerId): number {
  let saw = false;
  let chaals = 0;
  let raises = 0;
  for (const a of state.history) {
    if (a.player !== opponent) continue;
    if (a.type === 'see') saw = true;
    else if (!a.blind && (a.type === 'chaal' || a.type === 'show')) chaals++;
    else if (!a.blind && a.type === 'raise') raises++;
  }
  if (!saw) return 0;
  return Math.min(0.85, 0.3 + 0.07 * chaals + 0.15 * raises);
}

/**
 * Estimated chance that `player`'s hand beats every opponent still in.
 * Only valid once `player` has seen their cards (it reads their own hand).
 */
export function winChance(state: TeenPattiState, player: PlayerId, rank?: HandRank): number {
  const strength = handStrength(rank ?? rankHand(state.hands[player] ?? []));
  let chance = 1;
  for (const opp of activeSeats(state)) {
    if (opp === player) continue;
    const floor = opponentFloor(state, opp);
    const vsOpp = strength > floor ? (strength - floor) / (1 - floor) : 0;
    // Opponents bluff sometimes, so never treat a hand as completely dead.
    chance *= Math.max(0.04, vsOpp);
  }
  return chance;
}

/** True if any opponent still in has raised after seeing their cards. */
function facingSeenRaise(state: TeenPattiState, player: PlayerId): boolean {
  return state.history.some(
    (a) => a.player !== player && a.type === 'raise' && !a.blind && !state.packed[a.player],
  );
}

interface Spot {
  state: TeenPattiState;
  player: PlayerId;
  /** null = deterministic (coach). */
  rng: Rng | null;
  chaalCost: number;
  raiseCost: number;
  /**
   * A raise is legal and keeps the hand going. A raise that would hit the pot limit
   * ends the betting at once (everyone shows), so it cannot make the others pay more:
   * the bots and the coach chaal instead.
   */
  raiseOk: boolean;
  /** A raise is legal but would bring the pot to the limit (so the bots never choose it). */
  raiseEnds: boolean;
  /** The next chaal reaches the pot limit: it is the last bet and everyone still in shows. */
  chaalEnds: boolean;
  twoLeft: boolean;
  bets: number;
}

/** A random number, or `fallback` in deterministic (coach) mode. */
function roll(spot: Spot, fallback = 1): number {
  return spot.rng ? spot.rng.next() : fallback;
}

function spotOf(state: TeenPattiState, player: PlayerId, rng: Rng | null): Spot {
  const raiseEnds = canRaise(state) && hitsPotLimit(state, player, { type: 'raise' });
  return {
    state,
    player,
    rng,
    chaalCost: moveCost(state, player, { type: 'chaal' }),
    raiseCost: moveCost(state, player, { type: 'raise' }),
    raiseOk: canRaise(state) && !raiseEnds,
    raiseEnds,
    chaalEnds: hitsPotLimit(state, player, { type: 'chaal' }),
    twoLeft: activeSeats(state).length === 2,
    bets: blindBets(state, player),
  };
}

// ----------------------------------------------------------------- normal

function normalBlind(s: Spot): StrategyChoice {
  const { state } = s;
  if (s.chaalEnds) {
    // A blind chaal this big is capped by the pot limit, so a seen chaal costs exactly the same.
    return {
      move: mv('see'),
      why: `Your next bet brings the pot to the ${state.potLimit}-boot limit, and then everyone still in must show their cards. Looking is free and that bet costs ${boots(s.chaalCost)} either way, so see your cards first and decide whether the showdown is worth it.`,
    };
  }
  if (state.stake >= 4) {
    return {
      move: mv('see'),
      why: `The stake has climbed to ${boots(state.stake)}. Before you put in more, look at your cards so you know what you are betting on.`,
    };
  }
  if (s.bets >= 1 && facingSeenRaise(state, s.player)) {
    return {
      move: mv('see'),
      why: 'Someone who has seen their cards raised — that often means a good hand. Look at yours before you decide.',
    };
  }
  if (s.bets === 0) {
    if (s.raiseOk && state.stake === 1 && roll(s) < 0.1) {
      return {
        move: mv('raise'),
        why: `A blind raise costs only ${boots(s.raiseCost)} and puts pressure on everyone who has seen.`,
      };
    }
    return {
      move: mv('chaal'),
      why: `Playing blind is half price: a blind chaal costs only ${boots(s.chaalCost)}. It's a cheap way to stay in for the first round before you look.`,
    };
  }
  if (s.bets === 1 && roll(s) < 0.5) {
    return {
      move: mv('chaal'),
      why: `Another cheap blind chaal (${boots(s.chaalCost)}) keeps the pressure on.`,
    };
  }
  return {
    move: mv('see'),
    why: "You've played blind for a round — now look at your cards so you can decide properly.",
  };
}

function normalSeen(s: Spot): StrategyChoice {
  const { state, player } = s;
  const rank = rankHand(state.hands[player] ?? []);
  const strength = handStrength(rank);
  const win = winChance(state, player, rank);
  const potOdds = s.chaalCost / (state.pot + s.chaalCost);
  const hand = `${rank.name} beats ${aboutPct(strength)} of all hands`;

  if (s.chaalEnds) {
    // The last bet: whatever happens, everyone still in shows right after it. Bluffing is
    // pointless, raising costs no less, and (heads-up) a chaal beats asking for a show
    // because an exact tie at the pot limit splits the pot instead of losing it.
    const finalPot = state.pot + s.chaalCost;
    if (win >= potOdds) {
      const versusShow = s.twoLeft
        ? ' It is better than asking for a show: same price, and an exact tie splits the pot instead of losing it.'
        : '';
      return {
        move: mv('chaal'),
        why: `${hand}. This chaal costs ${boots(s.chaalCost)} and brings the pot to the ${state.potLimit}-boot limit, so everyone still in shows straight away. With ${aboutPct(win)} to win the ${finalPot}-boot pot, that price is worth paying.${versusShow}`,
      };
    }
    return {
      move: mv('pack'),
      why: `${hand}. The next bet brings the pot to the ${state.potLimit}-boot limit and forces everyone to show, and your chance of winning that showdown is ${aboutPct(win)} — not worth ${boots(s.chaalCost)}. Pack and keep the rest of your boots.`,
    };
  }

  if (win >= 0.8) {
    if (s.raiseOk) {
      return {
        move: mv('raise'),
        why: `${hand} — you are very likely ahead. Raise (${boots(s.raiseCost)}) to make the others pay more to stay in.`,
      };
    }
    if (s.raiseEnds) {
      return {
        move: mv('chaal'),
        why: `${hand} — very strong. A raise would hit the ${state.potLimit}-boot pot limit and end the betting at once, so chaal for ${boots(s.chaalCost)} instead and let the others keep paying in.`,
      };
    }
    return {
      move: mv('chaal'),
      why: `${hand} — very strong. The stake can't go higher, so keep chaal-ing: the pot grows until someone gives up or the pot limit forces a show.`,
    };
  }
  if (win >= 0.55) {
    if (s.twoLeft) {
      return {
        move: mv('show'),
        why: `${hand}, so you are probably ahead (${aboutPct(win)} to win). Pay ${boots(s.chaalCost)} for a show and settle it now.`,
      };
    }
    if (s.raiseOk && state.stake <= 2 && roll(s) < 0.2) {
      return {
        move: mv('raise'),
        why: `${hand}. A small raise now builds the pot while it's still cheap.`,
      };
    }
    return {
      move: mv('chaal'),
      why: `${hand}, giving you a good chance (${aboutPct(win)}) against everyone still in. Chaal for ${boots(s.chaalCost)} and stay in.`,
    };
  }
  if (win >= potOdds + 0.08) {
    if (s.twoLeft && win >= 0.45) {
      return {
        move: mv('show'),
        why: `${hand} — about a coin flip (${aboutPct(win)} to win). The pot holds ${boots(state.pot)}, so a show for ${boots(s.chaalCost)} is worth it.`,
      };
    }
    return {
      move: mv('chaal'),
      why: `${hand}. It costs ${boots(s.chaalCost)} to stay in a ${state.pot}-boot pot, and with ${aboutPct(win)} to win that price is worth paying.`,
    };
  }
  if (s.rng && s.chaalCost <= 4 && roll(s) < 0.07) {
    return {
      move: mv('chaal'),
      why: 'A cheeky bluff: chaal as if the hand were strong and hope the others pack.',
    };
  }
  return {
    move: mv('pack'),
    why: `${hand}, so it is unlikely to win here (${aboutPct(win)}), and staying in costs ${boots(s.chaalCost)}. Pack and keep the rest of your boots.`,
  };
}

// ------------------------------------------------------------------- easy

function easyBlind(s: Spot): StrategyChoice {
  if (s.state.stake >= 4 || s.bets >= 3 || (s.bets >= 1 && roll(s) < 0.5)) {
    return { move: mv('see'), why: 'Time to peek at the cards.' };
  }
  if (s.raiseOk && s.state.stake === 1 && roll(s) < 0.05) {
    return { move: mv('raise'), why: 'A playful blind raise.' };
  }
  return { move: mv('chaal'), why: 'Blind chaal — cheap and cheerful.' };
}

function easySeen(s: Spot): StrategyChoice {
  const rank = rankHand(s.state.hands[s.player] ?? []);
  const cat = rank.category;
  if (cat === 'trail' || cat === 'pure-sequence' || cat === 'sequence') {
    if (s.raiseOk && roll(s) < 0.5) return { move: mv('raise'), why: `${rank.name} — raise!` };
    if (s.twoLeft && roll(s) < 0.25) return { move: mv('show'), why: `${rank.name} — show!` };
    return { move: mv('chaal'), why: `${rank.name} is strong — stay in.` };
  }
  if (cat === 'colour' || cat === 'pair') {
    if (s.twoLeft && roll(s) < 0.5) return { move: mv('show'), why: `${rank.name} — let's see.` };
    return { move: mv('chaal'), why: `${rank.name} is decent — stay in.` };
  }
  const top = rank.values[0] ?? 0;
  if (top >= 13) {
    if (roll(s) < 0.6) {
      if (s.twoLeft && roll(s) < 0.3) return { move: mv('show'), why: 'High card — risk a show.' };
      return { move: mv('chaal'), why: 'A high card might be enough.' };
    }
    return { move: mv('pack'), why: 'Only a high card — pack.' };
  }
  if (s.chaalCost <= 2 && roll(s) < 0.3) {
    return { move: mv('chaal'), why: "It's cheap, so stay in a little longer." };
  }
  return { move: mv('pack'), why: 'A weak hand — pack.' };
}

/**
 * Choose a move for `player` (who must be the seat to act). With `rng = null`
 * the choice is deterministic (used by the coach).
 */
export function chooseMove(
  state: TeenPattiState,
  player: PlayerId,
  difficulty: Difficulty,
  rng: Rng | null,
): StrategyChoice {
  if (state.outcome || state.turn !== player) {
    throw new Error(`Teen Patti: it is not seat ${player}'s turn`);
  }
  const s = spotOf(state, player, rng);
  const blind = !state.seen[player];
  if (difficulty === 'easy') return blind ? easyBlind(s) : easySeen(s);
  return blind ? normalBlind(s) : normalSeen(s);
}
