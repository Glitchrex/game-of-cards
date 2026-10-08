/**
 * Hearts bots and coach.
 *
 * Bots only ever look at a SeatView: their own hand, what they passed and
 * received, and public table information (every card played so far, captured
 * points, whether Hearts are broken). From that public history they derive
 * "memory" — which cards are still out and which players have shown a void.
 *
 *  - easy:   passes 3 random cards from its 6 highest; plays a random legal card
 *            or (half the time) its lowest legal card.
 *  - normal: passes the Queen of Spades (unless well guarded), high Spades,
 *            high Hearts and short suits; ducks under the current winner, dumps
 *            the Queen / high Spades / high Hearts when void, leads low from
 *            safe suits, smokes out the Queen with low Spades, and steps in to
 *            stop a player who is close to shooting the moon.
 *
 * The normal strategy is deterministic so the coach can reuse it verbatim.
 */
import {
  cardShort,
  makeDeck,
  SUIT_NAMES,
  SUIT_SINGULAR,
  suitOf,
  type CardCode,
  type Suit,
} from '@/games/core/cards';
import { shuffle, type Rng } from '@/games/core/rng';
import type { CoachAdvice, PlayerId } from '@/games/core/types';
import type {
  HeartsMove,
  HeartsPassDirection,
  HeartsPhase,
  HeartsPlay,
  HeartsState,
  HeartsTrick,
} from './engine';
import {
  cardPoints,
  directionWords,
  isPointCard,
  legalPlays,
  PASS_SIZE,
  passSource,
  passTarget,
  pointsIn,
  pointsLabel,
  QUEEN_OF_SPADES,
  rank,
  scoreHand,
  SEATS,
  seatLabel,
  seatObject,
  seatPossessive,
  TOTAL_POINTS,
  TRICKS_PER_HAND,
  TWO_OF_CLUBS,
  winningPlay,
  type PlayContext,
} from './rules';

/** Everything one seat may legally know. Bots and the coach use nothing else. */
export interface SeatView {
  seat: PlayerId;
  phase: Exclude<HeartsPhase, 'over'>;
  passDirection: HeartsPassDirection;
  hand: readonly CardCode[];
  /** The 3 cards this seat passed (it knows who holds them now). */
  passedByMe: readonly CardCode[] | null;
  /** The 3 cards this seat received. */
  receivedByMe: readonly CardCode[] | null;
  trick: readonly HeartsPlay[];
  tricks: readonly HeartsTrick[];
  /** Captured points per seat (public: every trick is played face up). */
  points: readonly number[];
  heartsBroken: boolean;
}

export function seatView(state: HeartsState, seat: PlayerId): SeatView {
  if (state.phase === 'over') throw new Error('Hearts: the hand is over');
  return {
    seat,
    phase: state.phase,
    passDirection: state.passDirection,
    hand: state.hands[seat] ?? [],
    passedByMe: state.passed[seat] ?? null,
    receivedByMe: state.received[seat] ?? null,
    trick: state.trick,
    tricks: state.tricks,
    points: state.points,
    heartsBroken: state.heartsBroken,
  };
}

export interface BotDecision {
  move: HeartsMove;
  /** Plain-language reason, phrased to "you" (used by the coach). */
  why: string;
}

/** Facts a seat can deduce from public play history. */
interface Memory {
  /** Cards not in my hand and not yet played — some opponent holds each one. */
  unseen: CardCode[];
  /** voids[seat] = suits that seat has shown it no longer holds. */
  voids: Set<Suit>[];
  /** The Queen of Spades is still held by an opponent. */
  queenOut: boolean;
}

const FULL_DECK: readonly CardCode[] = makeDeck();

function remember(view: SeatView): Memory {
  const played = new Set<CardCode>();
  const voids: Set<Suit>[] = Array.from({ length: SEATS }, () => new Set<Suit>());
  const allTricks: (readonly HeartsPlay[])[] = [...view.tricks.map((t) => t.plays), view.trick];
  for (const plays of allTricks) {
    const lead = plays[0];
    if (!lead) continue;
    const led = suitOf(lead.card);
    for (const p of plays) {
      played.add(p.card);
      if (suitOf(p.card) !== led) voids[p.seat]?.add(led);
    }
  }
  const mine = new Set(view.hand);
  const unseen = FULL_DECK.filter((c) => !played.has(c) && !mine.has(c));
  return { unseen, voids, queenOut: unseen.includes(QUEEN_OF_SPADES) };
}

function contextOf(view: SeatView): PlayContext {
  return { trick: view.trick, trickIndex: view.tricks.length, heartsBroken: view.heartsBroken };
}

function opponents(seat: PlayerId): PlayerId[] {
  return [1, 2, 3].map((d) => (seat + d) % SEATS);
}

function countSuit(cards: readonly CardCode[], suit: Suit): number {
  let n = 0;
  for (const c of cards) if (suitOf(c) === suit) n++;
  return n;
}

const byRankAsc = (a: CardCode, b: CardCode) => rank(a) - rank(b);
const byRankDesc = (a: CardCode, b: CardCode) => rank(b) - rank(a);

function highest(cards: readonly CardCode[]): CardCode {
  const c = cards.slice().sort(byRankDesc)[0];
  if (!c) throw new Error('highest() of no cards');
  return c;
}

function lowest(cards: readonly CardCode[]): CardCode {
  const c = cards.slice().sort(byRankAsc)[0];
  if (!c) throw new Error('lowest() of no cards');
  return c;
}

/** Highest card, breaking rank ties toward the suit we hold fewest of (to build voids). */
function highestPreferShort(cards: readonly CardCode[], hand: readonly CardCode[]): CardCode {
  const c = cards
    .slice()
    .sort(
      (a, b) => rank(b) - rank(a) || countSuit(hand, suitOf(a)) - countSuit(hand, suitOf(b)),
    )[0];
  if (!c) throw new Error('highestPreferShort() of no cards');
  return c;
}

/** Points needed before a one-player sweep is treated as a shoot-the-moon threat. */
export const MOON_ALERT = 6;

/**
 * An opponent who has taken every point so far (at least MOON_ALERT of them)
 * while points are still left to win — they might be shooting the moon.
 */
export function moonThreat(view: SeatView): PlayerId | null {
  const total = view.points.reduce((a, b) => a + b, 0);
  if (total < MOON_ALERT || total >= TOTAL_POINTS) return null;
  for (const s of opponents(view.seat)) {
    if (view.points[s] === total) return s;
  }
  return null;
}

/* ------------------------------------------------------------------ passing */

type PassReason = 'queen' | 'highSpade' | 'highHeart' | 'void' | 'high' | 'spare';

interface PassChoice {
  card: CardCode;
  score: number;
  reason: PassReason;
}

function passDanger(card: CardCode, hand: readonly CardCode[]): PassChoice {
  const r = rank(card);
  const s = suitOf(card);
  const lowSpades = hand.filter((c) => suitOf(c) === 'S' && rank(c) < 12).length;
  const guarded = lowSpades >= 4;
  if (card === QUEEN_OF_SPADES) return { card, score: guarded ? 5 : 100, reason: 'queen' };
  if (s === 'S') {
    if (r > 12) {
      return guarded
        ? { card, score: 15 + r, reason: 'high' }
        : { card, score: 70 + r, reason: 'highSpade' };
    }
    return { card, score: r, reason: 'spare' };
  }
  if (s === 'H') {
    return r >= 10
      ? { card, score: 40 + 2 * r, reason: 'highHeart' }
      : { card, score: 2 * r, reason: 'spare' };
  }
  const short = countSuit(hand, s) <= 2;
  return {
    card,
    score: 3 * r + (short ? 30 : 0),
    reason: short ? 'void' : r >= 10 ? 'high' : 'spare',
  };
}

function passWhy(chosen: readonly PassChoice[], hand: readonly CardCode[], to: string): string {
  const remaining = hand.filter((c) => !chosen.some((p) => p.card === c));
  const groups = new Map<string, CardCode[]>();
  for (const p of chosen) {
    let key: string;
    switch (p.reason) {
      case 'queen':
        key = '13 points, and you have too few low Spades to hide her behind';
        break;
      case 'highSpade':
        key = 'high Spades can get stuck catching the Queen of Spades';
        break;
      case 'highHeart':
        key = 'high Hearts tend to win tricks full of points';
        break;
      case 'void': {
        const suit = suitOf(p.card);
        key =
          countSuit(remaining, suit) === 0
            ? `with no ${SUIT_NAMES[suit]} left you can throw away points whenever ${SUIT_NAMES[suit]} are led`
            : `getting rid of ${SUIT_NAMES[suit]} brings you closer to having none`;
        break;
      }
      case 'high':
        key = 'high cards win tricks you would rather lose';
        break;
      case 'spare':
        key = 'it is the least useful card you have left';
        break;
    }
    const list = groups.get(key) ?? [];
    list.push(p.card);
    groups.set(key, list);
  }
  const parts = [...groups.entries()].map(([why, list]) => {
    const names = list.map((c) => (c === QUEEN_OF_SPADES ? 'Queen of Spades' : cardShort(c)));
    return `the ${joinAnd(names)} (${why})`;
  });
  const sentence = joinAnd(parts);
  return `Pass ${sentence} to ${to}. Keep your low cards — they help you lose tricks safely.`;
}

/** "a", "a and b", "a, b and c" */
function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function normalPass(view: SeatView): BotDecision {
  const chosen = view.hand
    .map((c) => passDanger(c, view.hand))
    .sort(
      (a, b) =>
        b.score - a.score ||
        rank(b.card) - rank(a.card) ||
        (a.card < b.card ? -1 : a.card > b.card ? 1 : 0),
    )
    .slice(0, PASS_SIZE);
  const to = seatObject(passTarget(view.seat, view.passDirection));
  return {
    move: { type: 'pass', cards: chosen.map((p) => p.card) },
    why: passWhy(chosen, view.hand, to),
  };
}

/* --------------------------------------------------------------------- play */

function decide(card: CardCode, why: string): BotDecision {
  return { move: { type: 'play', card }, why };
}

function forcedPlay(view: SeatView, card: CardCode): BotDecision {
  if (view.tricks.length === 0 && view.trick.length === 0 && card === TWO_OF_CLUBS) {
    return decide(card, 'You hold the Two of Clubs, so you must start the first trick with it.');
  }
  const short = cardShort(card);
  if (view.hand.length === 1) {
    return decide(card, `The ${short} is your last card, so it is the one you play.`);
  }
  const lead = view.trick[0];
  if (lead && suitOf(lead.card) === suitOf(card)) {
    const s = suitOf(card);
    return decide(card, `The ${short} is your only ${SUIT_SINGULAR[s]}, and you must follow suit.`);
  }
  if (!lead && !view.heartsBroken && suitOf(card) !== 'H') {
    return decide(
      card,
      `Hearts aren't broken yet and the ${short} is your only card that isn't a Heart, so you must lead it.`,
    );
  }
  if (lead && view.tricks.length === 0 && !isPointCard(card)) {
    const led = SUIT_NAMES[suitOf(lead.card)];
    return decide(
      card,
      `You have no ${led}, and points aren't allowed on the first trick, so the ${short} — your only card that isn't a Heart or the Queen of Spades — is the one you must play.`,
    );
  }
  return decide(card, `The ${short} is the only card the rules let you play here.`);
}

/**
 * How many opponents can still follow `suit`: those not known to be void, but
 * never more than the number of cards of that suit still out (with none left
 * out, everyone else must discard — and can dump points on the trick).
 */
function possibleFollowers(view: SeatView, mem: Memory, suit: Suit): number {
  const notVoid = opponents(view.seat).filter((o) => !mem.voids[o]?.has(suit)).length;
  return Math.min(notVoid, countSuit(mem.unseen, suit));
}

function leadCost(card: CardCode, view: SeatView, mem: Memory): number {
  const s = suitOf(card);
  const r = rank(card);
  const out = mem.unseen.filter((u) => suitOf(u) === s);
  const higher = out.filter((u) => rank(u) > r).length;
  const lower = out.length - higher;
  const opps = opponents(view.seat);
  const followers = possibleFollowers(view, mem, s);
  const pointsOut = mem.unseen.some(isPointCard);
  // Rough chance that this lead ends up winning the trick.
  const win = higher === 0 || followers === 0 ? 1 : lower / (lower + higher);
  let stake = cardPoints(card);
  if (pointsOut) {
    stake += 0.5 + (opps.length - followers) * 3;
    if (s === 'H') stake += Math.min(followers, out.length);
    if (s === 'S' && mem.queenOut && r > 12) stake += 8;
  }
  let cost = win * stake;
  if (s === 'S' && mem.queenOut && r < 12) cost -= 0.6;
  if (s === 'S' && view.hand.includes(QUEEN_OF_SPADES) && card !== QUEEN_OF_SPADES) cost += 0.6;
  return cost + countSuit(view.hand, s) * 0.05 + r * 0.01;
}

function chooseLead(view: SeatView, legal: readonly CardCode[], mem: Memory): BotDecision {
  let best = legal[0] as CardCode;
  let bestCost = Infinity;
  for (const c of legal) {
    const cost = leadCost(c, view, mem);
    if (cost < bestCost) {
      best = c;
      bestCost = cost;
    }
  }
  const s = suitOf(best);
  const out = mem.unseen.filter((u) => suitOf(u) === s);
  const higher = out.filter((u) => rank(u) > rank(best)).length;
  const short = cardShort(best);
  if (s === 'S' && mem.queenOut && rank(best) < 12) {
    return decide(
      best,
      `Lead the ${short}, a Spade lower than the Queen. The Queen of Spades is still out there, and leading Spades can force her out onto someone else's higher Spade.`,
    );
  }
  if (out.length > 0 && higher === out.length) {
    // Whoever holds one of those cards must follow suit with it and beat this one.
    return decide(
      best,
      `Lead the ${short}: every ${SUIT_SINGULAR[s]} still out is higher, so someone else has to win this trick.`,
    );
  }
  if (!mem.unseen.some(isPointCard) && !isPointCard(best)) {
    const where = view.hand.some(isPointCard)
      ? 'The only point cards left are in your own hand'
      : 'Every point card has already been taken';
    return decide(
      best,
      `${where}, so nobody else can put points on this trick — leading the ${short} is safe.`,
    );
  }
  const note =
    higher > 0
      ? ` (${higher} higher ${higher === 1 ? `${SUIT_SINGULAR[s]} is` : `${SUIT_NAMES[s]} are`} still out)`
      : '';
  return decide(
    best,
    `Lead the ${short}: of the cards you may lead, it is the least likely to land you points${note}.`,
  );
}

function chooseFollow(
  view: SeatView,
  legal: readonly CardCode[],
  mem: Memory,
  shooter: PlayerId | null,
): BotDecision {
  const trick = view.trick;
  const lead = trick[0] as HeartsPlay;
  const led = suitOf(lead.card);
  const best = winningPlay(trick);
  const wr = rank(best.card);
  const winShort = cardShort(best.card);
  const pts = pointsIn(trick.map((p) => p.card));
  const last = trick.length === SEATS - 1;
  const below = legal.filter((c) => rank(c) < wr).sort(byRankDesc);
  const above = legal.filter((c) => rank(c) > wr).sort(byRankAsc);
  const singular = SUIT_SINGULAR[led];

  if (view.tricks.length === 0 && pts === 0) {
    const card = highest(legal);
    return decide(
      card,
      `Nobody may play points on the first trick (unless they have nothing else), so it's a safe moment to get rid of your highest ${singular}, the ${cardShort(card)}.`,
    );
  }

  const shooterWinning = shooter !== null && best.seat === shooter;
  if (shooterWinning && pts > 0 && above.length > 0) {
    const card = above.find((c) => c !== QUEEN_OF_SPADES) ?? (above[0] as CardCode);
    return decide(
      card,
      `${seatLabel(best.seat)} has taken every point so far and might shoot the moon. Beat their card with the ${cardShort(card)} so they can't collect all 26.`,
    );
  }

  if (led === 'S' && legal.includes(QUEEN_OF_SPADES) && wr > 12 && !shooterWinning) {
    // Only the A♠ can still beat a winning K♠; if it might come later the taker is not settled.
    const settled = last || wr === 14 || !mem.unseen.includes('AS');
    const taker = settled
      ? `${seatObject(best.seat)} will take her 13 points`
      : 'whoever wins this trick takes her 13 points';
    return decide(
      QUEEN_OF_SPADES,
      `Drop the Queen of Spades under the ${winShort} — she can't win this trick now, so ${taker}, not you.`,
    );
  }

  if (last && pts === 0) {
    const pool = legal.filter((c) => c !== QUEEN_OF_SPADES);
    if (pool.length > 0) {
      const card = highest(pool);
      if (rank(card) > wr) {
        return decide(
          card,
          `You're the last to play and this trick has no points, so win it with the ${cardShort(card)} — a free chance to get rid of a high card.`,
        );
      }
      return decide(
        card,
        `Play the ${cardShort(card)}: it's lower than the ${winShort}, so you stay out of this trick.`,
      );
    }
  }

  // Never hand the Queen of Spades to a possible moon shooter: while she is out of
  // their pile they cannot take all 26.
  const duck = shooterWinning ? (below.find((c) => c !== QUEEN_OF_SPADES) ?? below[0]) : below[0];
  if (duck) {
    const extra = pts > 0 ? ` and its ${pointsLabel(pts)}` : '';
    return decide(
      duck,
      `Play the ${cardShort(duck)} — your highest ${singular} that is still lower than the ${winShort}, so you won't win this trick${extra}.`,
    );
  }

  if (last) {
    const pool = legal.filter((c) => c !== QUEEN_OF_SPADES);
    const card = pool.length > 0 ? highest(pool) : QUEEN_OF_SPADES;
    return decide(
      card,
      `Every ${singular} you hold beats the ${winShort}, so this trick is yours anyway — use it to get rid of your highest ${singular}, the ${cardShort(card)}.`,
    );
  }
  const card = above.find((c) => c !== QUEEN_OF_SPADES) ?? (above[0] as CardCode);
  return decide(
    card,
    `Every ${singular} you hold beats the ${winShort}. Play your lowest safe one, the ${cardShort(card)}, so a player after you has the best chance to beat it.`,
  );
}

function chooseDiscard(
  view: SeatView,
  legal: readonly CardCode[],
  mem: Memory,
  shooter: PlayerId | null,
): BotDecision {
  const lead = view.trick[0] as HeartsPlay;
  const ledName = SUIT_NAMES[suitOf(lead.card)];
  const best = winningPlay(view.trick);
  const last = view.trick.length === SEATS - 1;
  // Only the last player knows for sure who takes the trick.
  const taker = last ? seatObject(best.seat) : 'whoever wins this trick';

  if (shooter !== null && best.seat === shooter) {
    const safe = legal.filter((c) => !isPointCard(c));
    if (safe.length > 0) {
      const card = highestPreferShort(safe, view.hand);
      return decide(
        card,
        `${seatLabel(shooter)} has every point so far and might shoot the moon, so don't feed them any — throw away the ${cardShort(card)} instead.`,
      );
    }
    const hearts = legal.filter((c) => suitOf(c) === 'H');
    if (legal.includes(QUEEN_OF_SPADES) && hearts.length > 0) {
      const card = lowest(hearts);
      return decide(
        card,
        `${seatLabel(shooter)} has every point so far and might shoot the moon. You only hold point cards, so give up your lowest Heart, the ${cardShort(card)}, and keep the Queen of Spades: they can't take all 26 while she is in your hand.`,
      );
    }
  }
  if (legal.includes(QUEEN_OF_SPADES)) {
    return decide(
      QUEEN_OF_SPADES,
      `You have no ${ledName}, so you may play any card — dump the Queen of Spades! Her 13 points go to ${taker}, not you.`,
    );
  }
  const highSpades = legal.filter((c) => suitOf(c) === 'S' && rank(c) > 12);
  if (mem.queenOut && highSpades.length > 0) {
    const card = highest(highSpades);
    return decide(
      card,
      `You have no ${ledName}. The Queen of Spades is still out, so get rid of the ${cardShort(card)} before it gets stuck catching her.`,
    );
  }
  const hearts = legal.filter((c) => suitOf(c) === 'H');
  if (hearts.length > 0) {
    const card = highest(hearts);
    return decide(
      card,
      `You have no ${ledName}, so unload your highest Heart, the ${cardShort(card)}. Its point goes to ${taker}, not you.`,
    );
  }
  const card = highestPreferShort(legal, view.hand);
  if (view.tricks.length === 0 && view.hand.some(isPointCard)) {
    return decide(
      card,
      `You have no ${ledName}, but points aren't allowed on the first trick, so keep your point cards for later and throw away your highest safe card, the ${cardShort(card)}.`,
    );
  }
  return decide(
    card,
    `You have no ${ledName} and nothing dangerous to dump, so throw away your highest card, the ${cardShort(card)}, while it's safe.`,
  );
}

function normalPlay(view: SeatView): BotDecision {
  const legal = legalPlays(view.hand, contextOf(view));
  const only = legal[0];
  if (!only) throw new Error(`Hearts: seat ${view.seat} has no legal play`);
  if (legal.length === 1) return forcedPlay(view, only);
  const mem = remember(view);
  const lead = view.trick[0];
  if (!lead) return chooseLead(view, legal, mem);
  const shooter = moonThreat(view);
  const led = suitOf(lead.card);
  if (legal.some((c) => suitOf(c) === led)) return chooseFollow(view, legal, mem, shooter);
  return chooseDiscard(view, legal, mem, shooter);
}

/** The normal bot's (and the coach's) choice with a plain-language reason. */
export function normalDecision(view: SeatView): BotDecision {
  return view.phase === 'pass' ? normalPass(view) : normalPlay(view);
}

/** Easy bot: simple but never absurd. */
export function easyMove(view: SeatView, rng: Rng): HeartsMove {
  if (view.phase === 'pass') {
    const top = view.hand.slice().sort(byRankDesc).slice(0, 6);
    return { type: 'pass', cards: shuffle(top, rng).slice(0, PASS_SIZE) };
  }
  const legal = legalPlays(view.hand, contextOf(view));
  if (legal.length === 0) throw new Error(`Hearts: seat ${view.seat} has no legal play`);
  const card = legal.length === 1 || rng.next() < 0.5 ? lowest(legal) : rng.pick(legal);
  return { type: 'play', card };
}

/* -------------------------------------------------------------------- coach */

function trickSoFar(state: HeartsState): string {
  const lead = state.trick[0];
  if (!lead) return '';
  const best = winningPlay(state.trick);
  const pts = pointsIn(state.trick.map((p) => p.card));
  const leader = seatLabel(lead.seat);
  const winning =
    best === lead
      ? 'it is winning so far'
      : `${seatPossessive(best.seat)} ${cardShort(best.card)} is winning so far`;
  return `${leader} led the ${cardShort(lead.card)}; ${winning}${pts > 0 ? ` (${pointsLabel(pts)} in the trick)` : ''}.`;
}

/** "a Club", "a Club or a Diamond", "a Spade, a Club or a Diamond" */
function suitChoices(suits: readonly Suit[]): string {
  const names = suits.map((s) => `a ${SUIT_SINGULAR[s]}`);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

function playSituation(state: HeartsState, p: PlayerId): string {
  const n = state.tricks.length + 1;
  const mine = state.points[p] ?? 0;
  const score = `You have taken ${pointsLabel(mine)} so far.`;
  if (state.turn !== p) {
    const sofar = trickSoFar(state);
    const action = sofar ? 'play' : 'lead';
    return `Trick ${n} of ${TRICKS_PER_HAND}. ${sofar ? `${sofar} ` : ''}Waiting for ${seatObject(state.turn)} to ${action}. ${score}`;
  }
  const hand = state.hands[p] ?? [];
  const lead = state.trick[0];
  if (!lead) {
    if (state.tricks.length === 0) {
      return `Trick 1 of ${TRICKS_PER_HAND}. You hold the Two of Clubs, so you start the very first trick with it.`;
    }
    const others = (['S', 'C', 'D'] as const).filter((s) => hand.some((c) => suitOf(c) === s));
    const hearts = state.heartsBroken
      ? 'Hearts are broken, so you may lead any suit.'
      : others.length === 0
        ? "Hearts aren't broken yet, but you hold only Hearts, so you may lead one."
        : `Hearts aren't broken yet, so lead ${suitChoices(others)}.`;
    return `Trick ${n} of ${TRICKS_PER_HAND} — it's your lead. ${hearts} ${score}`;
  }
  const led = suitOf(lead.card);
  let options: string;
  if (hand.some((c) => suitOf(c) === led)) {
    options = `You have ${SUIT_NAMES[led]}, so you must play one.`;
  } else if (state.tricks.length === 0 && hand.some((c) => !isPointCard(c))) {
    options = `You have no ${SUIT_NAMES[led]}, so you may play any card except a Heart or the Queen of Spades (no points on the first trick).`;
  } else {
    options = `You have no ${SUIT_NAMES[led]}, so you may play any card — a great chance to get rid of points.`;
  }
  return `Trick ${n} of ${TRICKS_PER_HAND}. ${trickSoFar(state)} ${options} ${score}`;
}

function passSituation(state: HeartsState, p: PlayerId): string {
  const to = seatObject(passTarget(p, state.passDirection));
  const from = seatObject(passSource(p, state.passDirection));
  if (state.turn === p) {
    return `Everyone has 13 cards. Before the first trick, choose 3 cards to pass to ${to} (${directionWords(state.passDirection)}). You'll get 3 cards from ${from} once everyone has chosen.`;
  }
  if (state.passed[p]) {
    return `You've chosen your 3 cards for ${to}. Waiting for ${seatObject(state.turn)} to choose theirs.`;
  }
  return `${seatLabel(state.turn)} is choosing 3 cards to pass. You'll pick yours on your turn.`;
}

function overSituation(state: HeartsState): string {
  const { scores, moonShooter } = scoreHand(state.points);
  const parts = scores.map((pts, i) => `${seatLabel(i)} ${pointsLabel(pts)}`);
  const moon = moonShooter === null ? '' : ` ${seatLabel(moonShooter)} shot the moon!`;
  return `The hand is over.${moon} Final scores: ${parts.join(', ')}. The lowest score wins.`;
}

/** Coach advice for `p`: what's happening, the normal bot's move when it's p's turn, and why. */
export function coachAdvice(state: HeartsState, p: PlayerId): CoachAdvice {
  if (state.phase === 'over') return { situation: overSituation(state) };
  if (state.phase === 'pass') {
    const situation = passSituation(state, p);
    if (state.turn !== p) return { situation };
    const d = normalDecision(seatView(state, p));
    return { situation, suggestion: d.move, why: d.why };
  }
  const situation = playSituation(state, p);
  if (state.turn !== p) return { situation };
  const d = normalDecision(seatView(state, p));
  return { situation, suggestion: d.move, why: d.why };
}
