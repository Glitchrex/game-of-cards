/**
 * Spades bots and coach.
 *
 * Bots only ever look at a SeatView: their own hand plus public information
 * (every bid, every card played so far, tricks won, whether Spades are broken).
 * From the public history they derive "memory": which cards are still unseen
 * and which players have shown a void.
 *
 *  - easy bid:    Aces + half the Kings + Spades beyond three, give or take one;
 *                 never Nil.
 *  - normal bid:  counts likely tricks (Aces, guarded Kings and Queens, Spade
 *                 honours and length, voids/singletons to trump in), bids a
 *                 little under the count, and bids Nil only with a very weak hand.
 *  - easy play:   usually the lowest legal card, sometimes the cheapest winner
 *                 when the team still needs tricks, now and then a random card.
 *  - normal play: wins the tricks the team still needs (cheapest sure winner,
 *                 trumping when void, "second hand low, third hand high"),
 *                 never overtakes a partner who is safely winning, tries to set
 *                 the opponents, covers a partner's Nil, dodges tricks when
 *                 bidding Nil and lets an opponent's Nil bidder win tricks. Once
 *                 both contracts are settled it keeps competing while the
 *                 remaining tricks could still change who wins this one-hand game
 *                 (each bag is +1 point here), and only ducks to avoid bags — the
 *                 full-game habit the lesson teaches — once the result is locked.
 *
 * The normal strategy is deterministic so the coach can reuse it verbatim.
 */
import {
  cardShort,
  rankOf,
  SUIT_NAMES,
  SUIT_SINGULAR,
  suitOf,
  SUITS,
  makeDeck,
  type CardCode,
  type Rank,
  type Suit,
} from '@/games/core/cards';
import type { Rng } from '@/games/core/rng';
import type { CoachAdvice, PlayerId } from '@/games/core/types';
import type { SpadesMove, SpadesPhase, SpadesState, SpadesTrick } from './engine';
import {
  beats,
  bidLabel,
  breaksSpades,
  isSpade,
  legalPlays,
  MAX_BID,
  NIL,
  partnerOf,
  rank,
  scoreHand,
  SEATS,
  teamOf,
  teamSeats,
  TRICKS_PER_HAND,
  tricksLabel,
  tricksNeeded,
  TRUMP,
  winningPlay,
  type PlayContext,
  type SpadesPlay,
  type Team,
} from './rules';

/** Everything one seat may legally know. Bots and the coach use nothing else. */
export interface SeatView {
  seat: PlayerId;
  phase: Exclude<SpadesPhase, 'over'>;
  dealer: PlayerId;
  hand: readonly CardCode[];
  bids: readonly (number | null)[];
  trick: readonly SpadesPlay[];
  tricks: readonly SpadesTrick[];
  tricksWon: readonly number[];
  spadesBroken: boolean;
}

export function seatView(state: SpadesState, seat: PlayerId): SeatView {
  if (state.phase === 'over') throw new Error('Spades: the hand is over');
  return {
    seat,
    phase: state.phase,
    dealer: state.dealer,
    hand: state.hands[seat] ?? [],
    bids: state.bids,
    trick: state.trick,
    tricks: state.tricks,
    tricksWon: state.tricksWon,
    spadesBroken: state.spadesBroken,
  };
}

export interface BotDecision {
  move: SpadesMove;
  /** Plain-language reason, phrased to "you" (used by the coach). */
  why: string;
}

const SIDE_SUITS: readonly Suit[] = ['H', 'C', 'D'];
const FULL_DECK: readonly CardCode[] = makeDeck();

function bySuit(hand: readonly CardCode[]): Record<Suit, CardCode[]> {
  const out: Record<Suit, CardCode[]> = { S: [], H: [], D: [], C: [] };
  for (const c of hand) out[suitOf(c)].push(c);
  for (const s of SUITS) out[s].sort((a, b) => rank(b) - rank(a));
  return out;
}

const lowest = (cards: readonly CardCode[]): CardCode | undefined =>
  cards.reduce<CardCode | undefined>(
    (m, c) => (m === undefined || rank(c) < rank(m) ? c : m),
    undefined,
  );
const highest = (cards: readonly CardCode[]): CardCode | undefined =>
  cards.reduce<CardCode | undefined>(
    (m, c) => (m === undefined || rank(c) > rank(m) ? c : m),
    undefined,
  );

// ─── Bidding ────────────────────────────────────────────────────────────────

export interface TrickEstimate {
  /** Expected number of tricks (fractional). */
  tricks: number;
  /** Plain-words reasons, e.g. "the A♥ (a sure trick)". */
  parts: string[];
  /** Is the hand weak and safe enough for a Nil bid? */
  nilSuitable: boolean;
}

function creditWords(credit: number): string {
  if (credit >= 0.9) return 'a sure trick';
  if (credit >= 0.55) return 'a likely trick';
  return 'maybe a trick';
}

/**
 * Count likely tricks the way a careful beginner would: sure winners (Aces,
 * guarded Kings), Spade honours and Spade length, and short side suits that
 * let low Spades trump in.
 */
export function estimateTricks(hand: readonly CardCode[]): TrickEstimate {
  const suits = bySuit(hand);
  const parts: string[] = [];
  let total = 0;
  const credit = (card: CardCode, value: number, note = '') => {
    if (value <= 0) return;
    total += value;
    if (value >= 0.3) parts.push(`the ${cardShort(card)}${note} (${creditWords(value)})`);
  };

  // Spades: honours first, then length beyond three, then spare low Spades for trumping.
  const spades = suits.S;
  const n = spades.length;
  const has = (cards: readonly CardCode[], r: Rank) => cards.find((c) => rankOf(c) === r);
  const aS = has(spades, 'A');
  const kS = has(spades, 'K');
  const qS = has(spades, 'Q');
  const jS = has(spades, 'J');
  let honours = 0;
  if (aS) {
    credit(aS, 1);
    honours++;
  }
  if (kS) {
    const v = aS ? 1 : n >= 2 ? 0.8 : 0.3;
    credit(kS, v);
    if (v >= 0.5) honours++;
  }
  if (qS) {
    const v = aS && kS ? 1 : n >= 3 ? (aS || kS ? 0.8 : 0.5) : 0.2;
    credit(qS, v);
    if (v >= 0.5) honours++;
  }
  if (jS && n >= 4) {
    const above = [aS, kS, qS].filter(Boolean).length;
    const v = above === 3 ? 1 : above === 2 ? 0.6 : 0;
    credit(jS, v);
    if (v >= 0.5) honours++;
  }
  const length = Math.max(0, Math.min(n - 3, n - honours));
  if (length > 0) {
    total += length;
    parts.push(
      `${length} extra Spade${length === 1 ? '' : 's'} beyond three (${length === 1 ? 'a likely trick' : `about ${length} tricks`})`,
    );
  }
  const spare = Math.max(0, n - honours - length);

  // Side suits.
  let ruffChances = 0;
  const shortNotes: string[] = [];
  for (const s of SIDE_SUITS) {
    const cards = suits[s];
    const len = cards.length;
    const a = has(cards, 'A');
    const k = has(cards, 'K');
    const q = has(cards, 'Q');
    if (a) credit(a, len <= 6 ? 1 : 0.6);
    if (k) {
      const v = a
        ? len <= 4
          ? 0.9
          : len === 5
            ? 0.6
            : 0.3
        : len === 1
          ? 0.1
          : len <= 4
            ? 0.6
            : len === 5
              ? 0.4
              : 0.2;
      credit(k, v, a ? '' : ' with a guard');
    }
    if (q) {
      const v =
        a && k
          ? len <= 4
            ? 0.5
            : 0.2
          : (a || k) && len >= 3 && len <= 4
            ? 0.3
            : len >= 3 && len <= 4
              ? 0.15
              : 0;
      credit(q, v);
    }
    const shortness = len === 0 ? 1.5 : len === 1 ? 0.9 : len === 2 ? 0.4 : 0;
    if (shortness > 0) {
      ruffChances += shortness;
      shortNotes.push(
        len === 0
          ? `no ${SUIT_NAMES[s]}`
          : `only ${len} ${len === 1 ? SUIT_SINGULAR[s] : SUIT_NAMES[s]}`,
      );
    }
  }
  const ruffs = Math.min(ruffChances, spare * 0.9);
  if (ruffs >= 0.3) {
    total += ruffs;
    parts.push(
      `short suits (${shortNotes.join(', ')}) with spare low Spades to trump in (${ruffs >= 1.5 ? `about ${Math.round(ruffs)} tricks` : creditWords(ruffs)})`,
    );
  }

  total = Math.min(MAX_BID, total);
  return { tricks: total, parts, nilSuitable: isNilHand(hand, total) };
}

/** A very weak hand with no card likely to win a trick by accident. */
function isNilHand(hand: readonly CardCode[], estimate: number): boolean {
  if (estimate > 1) return false;
  const suits = bySuit(hand);
  if (hand.some((c) => rankOf(c) === 'A')) return false;
  if (suits.S.length > 3 || suits.S.some((c) => rank(c) > 9)) return false;
  for (const s of SIDE_SUITS) {
    const cards = suits[s];
    const len = cards.length;
    if (len === 0) continue;
    if (cards.some((c) => rankOf(c) === 'K') && len < 4) return false;
    if (cards.some((c) => rankOf(c) === 'Q') && len < 3) return false;
    const low = lowest(cards);
    if (len === 1 && low && rank(low) > 9) return false;
    if (len >= 2 && low && rank(low) > 6) return false;
  }
  return true;
}

/** Normal bot bid (also the coach's suggestion) with a plain-words explanation. */
export function normalBid(view: SeatView): { bid: number; why: string } {
  const est = estimateTricks(view.hand);
  const partnerBid = view.bids[partnerOf(view.seat)];
  if (est.nilSuitable && partnerBid !== NIL) {
    return {
      bid: NIL,
      why: 'Your hand is very weak: no Aces, no Spade higher than the 9, and low cards in your side suits. That makes it a good Nil bid — if you win no tricks at all your team scores 100 points, and your partner will try to cover you by winning tricks with high cards.',
    };
  }
  // Bid a little under the count: getting set costs 10 points per trick bid,
  // while an extra trick (a bag) is worth only 1 point. Never push the team
  // contract past the 13 tricks there are.
  const partnerTricks = partnerBid === null || partnerBid === undefined ? 0 : partnerBid;
  const room = Math.max(1, MAX_BID - partnerTricks);
  const estimateBid = Math.floor(est.tricks + 0.3);
  const bid = Math.max(1, Math.min(room, estimateBid));
  const capped = estimateBid > room;
  const counted =
    est.parts.length > 0
      ? `You count about ${est.tricks.toFixed(1)} tricks: ${listWords(est.parts)}.`
      : `Your hand has hardly any winners (about ${est.tricks.toFixed(1)} tricks).`;
  const partnerNote =
    partnerBid === null || partnerBid === undefined || capped
      ? ''
      : partnerBid === NIL
        ? ' Your partner bid Nil, so your tricks alone must make the team contract.'
        : ` Your partner bid ${bidLabel(partnerBid)}, so together your team's contract will be ${tricksLabel(partnerBid + bid)}.`;
  const tail = est.nilSuitable
    ? ' This hand would suit a Nil, but your partner already bid Nil — with two Nils nobody is left to cover, so bid 1, the smallest real bid.'
    : capped
      ? partnerTricks >= MAX_BID
        ? ' Your partner already bid all 13 tricks, so no bid of yours can be made on top of that — bid 1, the smallest real bid.'
        : ` Your partner already bid ${bidLabel(partnerTricks)} and there are only 13 tricks, so bid ${bidLabel(bid)} — a team contract above 13 can never be made.`
      : bid === 1 && est.tricks < 0.7
        ? ' Nil looks too risky with this hand, so bid 1 — the smallest real bid.'
        : ` So ${bidLabel(bid)} is about right. When in doubt, bid low: failing your bid costs 10 points per trick, while an extra trick is worth only 1 point.`;
  return { bid, why: `${counted}${tail}${partnerNote}` };
}

/** Easy bot bid: Aces + half the Kings + Spades beyond three, give or take one. */
export function easyBid(view: SeatView, rng: Rng): number {
  const aces = view.hand.filter((c) => rankOf(c) === 'A').length;
  const kings = view.hand.filter((c) => rankOf(c) === 'K').length;
  const spades = view.hand.filter(isSpade).length;
  const count = aces + kings * 0.5 + Math.max(0, spades - 3);
  const wobble = [-1, 0, 0, 1][rng.int(4)] ?? 0;
  return Math.max(1, Math.min(MAX_BID, Math.round(count) + wobble));
}

/** "you" for the seat being advised, otherwise "Player N" ("the learner" for seat 0). */
function nameFor(seat: PlayerId, me: PlayerId): string {
  if (seat === me) return 'you';
  const label = seat === 0 ? 'the learner' : `Player ${seat}`;
  return seat === partnerOf(me) ? `your partner (${label})` : label;
}

/** "your" / "your partner's" / "Player N's". */
function possessiveFor(seat: PlayerId, me: PlayerId): string {
  if (seat === me) return 'your';
  if (seat === partnerOf(me)) return "your partner's";
  return `${nameFor(seat, me)}'s`;
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function listWords(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// ─── Memory ─────────────────────────────────────────────────────────────────

/** Facts a seat can deduce from public play history. */
interface Memory {
  /** Cards not in my hand and not yet played — some other player holds each one. */
  unseen: Set<CardCode>;
  /** voids[seat] = suits that seat has shown it no longer holds. */
  voids: Set<Suit>[];
}

function remember(view: SeatView): Memory {
  const played = new Set<CardCode>();
  const voids: Set<Suit>[] = Array.from({ length: SEATS }, () => new Set<Suit>());
  let broken = false;
  const allTricks: (readonly SpadesPlay[])[] = [...view.tricks.map((t) => t.plays), view.trick];
  for (const plays of allTricks) {
    const lead = plays[0];
    if (!lead) continue;
    const led = suitOf(lead.card);
    // A Spade led before Spades were broken means the leader held nothing else.
    if (led === TRUMP && !broken) for (const s of SIDE_SUITS) voids[lead.seat]?.add(s);
    for (const [k, p] of plays.entries()) {
      played.add(p.card);
      if (suitOf(p.card) !== led) voids[p.seat]?.add(led);
      if (breaksSpades(plays.slice(0, k), p.card)) broken = true;
    }
  }
  const mine = new Set(view.hand);
  const unseen = new Set(FULL_DECK.filter((c) => !played.has(c) && !mine.has(c)));
  // When nobody else can hold a suit any more, everyone else is void in it.
  for (const s of SUITS) {
    if (![...unseen].some((c) => suitOf(c) === s)) {
      for (let seat = 0; seat < SEATS; seat++) if (seat !== view.seat) voids[seat]?.add(s);
    }
  }
  return { unseen, voids };
}

function unseenOf(mem: Memory, suit: Suit): CardCode[] {
  return [...mem.unseen].filter((c) => suitOf(c) === suit);
}

/** No unseen card of the same suit outranks `card`. */
function isBoss(card: CardCode, mem: Memory): boolean {
  const r = rank(card);
  for (const c of mem.unseen) if (suitOf(c) === suitOf(card) && rank(c) > r) return false;
  return true;
}

/** Could `seat` (still to play) beat `card` if it ends up winning the trick so far? */
function couldBeat(seat: PlayerId, card: CardCode, led: Suit, mem: Memory): boolean {
  const voids = mem.voids[seat] ?? new Set<Suit>();
  const higher = (suit: Suit, than: number) =>
    [...mem.unseen].some((c) => suitOf(c) === suit && rank(c) > than);
  if (!voids.has(led)) {
    // They will follow suit (as far as we know), so only a higher led-suit card beats us.
    return suitOf(card) === led && higher(led, rank(card));
  }
  if (voids.has(TRUMP)) return false;
  if (isSpade(card)) return higher(TRUMP, rank(card));
  return unseenOf(mem, TRUMP).length > 0;
}

function seatsAfter(view: SeatView): PlayerId[] {
  const leader = view.trick[0]?.seat ?? view.seat;
  const out: PlayerId[] = [];
  for (let k = view.trick.length + 1; k < SEATS; k++) out.push((leader + k) % SEATS);
  return out;
}

/** Would `card`, if it became the winning card now, hold against everyone still to play? */
function holds(card: CardCode, led: Suit, after: readonly PlayerId[], mem: Memory): boolean {
  return after.every((s) => !couldBeat(s, card, led, mem));
}

/**
 * Stricter than couldBeat: could `seat` possibly beat the winning `card`, even
 * by turning out to be void in the led suit without having shown it yet?
 */
function mightBeat(seat: PlayerId, card: CardCode, led: Suit, mem: Memory): boolean {
  const voids = mem.voids[seat] ?? new Set<Suit>();
  const higher = (suit: Suit, than: number) =>
    [...mem.unseen].some((c) => suitOf(c) === suit && rank(c) > than);
  if (isSpade(card)) return !voids.has(TRUMP) && higher(TRUMP, rank(card));
  if (!voids.has(led) && higher(led, rank(card))) return true;
  return !voids.has(TRUMP) && unseenOf(mem, TRUMP).length > 0;
}

/** Is `card` certain to win against every OPPONENT still to play (no surprise trump possible)? */
function certainAgainst(
  card: CardCode,
  led: Suit,
  after: readonly PlayerId[],
  me: PlayerId,
  mem: Memory,
): boolean {
  return after.filter((s) => teamOf(s) !== teamOf(me)).every((s) => !mightBeat(s, card, led, mem));
}

/**
 * "is the highest card left in its suit" — or, when you also hold higher cards of
 * that suit, "can't be beaten by another Heart (the higher ones are yours)".
 */
function bossWords(card: CardCode, hand: readonly CardCode[]): string {
  const s = suitOf(card);
  const mineAbove = hand.some((c) => suitOf(c) === s && rank(c) > rank(card));
  return mineAbove
    ? `can't be beaten by another ${SUIT_SINGULAR[s]} (every higher one is gone or in your hand)`
    : 'is the highest card left in its suit';
}

/** Why a card that `holds` is expected to win (used when a surprise trump is still possible). */
function holdReason(card: CardCode, led: Suit, mem: Memory): string {
  const s = suitOf(card);
  const higherOut = [...mem.unseen].some((u) => suitOf(u) === s && rank(u) > rank(card));
  if (s !== led) {
    return higherOut ? 'the players still to play should follow suit' : 'no higher Spade is left';
  }
  return higherOut
    ? `the players still to play have run out of ${SUIT_NAMES[led]}`
    : `every higher ${SUIT_SINGULAR[led]} is gone`;
}

/** "— unless …" clause naming the only way a likely winner can still lose. */
function trumpRisk(card: CardCode, led: Suit): string {
  return isSpade(card)
    ? ` — unless an opponent still to play is also out of ${SUIT_NAMES[led]} and has a higher Spade`
    : ` — unless an opponent still to play has run out of ${SUIT_NAMES[led]} and trumps it`;
}

/**
 * The team that wins the hand however the remaining tricks fall, or null while
 * they could still change (or tie) the result. Which seat could really take
 * which trick is ignored, so the answer errs on the side of "not locked".
 */
function lockedWinner(
  bids: readonly (number | null)[],
  tricksWon: readonly number[],
  remaining: number,
): Team | null {
  const finalBids = bids.map((b) => b ?? 0);
  const base = [0, 1, 2, 3].map((s) => tricksWon[s] ?? 0) as [number, number, number, number];
  let sign = 0;
  for (let a = 0; a <= remaining; a++) {
    for (let b = 0; a + b <= remaining; b++) {
      for (let c = 0; a + b + c <= remaining; c++) {
        const d = remaining - a - b - c;
        const [us, them] = scoreHand(finalBids, [
          base[0] + a,
          base[1] + b,
          base[2] + c,
          base[3] + d,
        ]);
        const m = Math.sign(us.total - them.total);
        if (m === 0 || (sign !== 0 && m !== sign)) return null;
        sign = m;
      }
    }
  }
  return sign > 0 ? 0 : 1;
}

/**
 * The cheapest card among `options` that is exactly as strong as `top`: no
 * unseen card lies between them (e.g. holding K♣ Q♣ with the J♣ played, the
 * Q♣ does the same job as the K♣).
 */
function cheapestEquivalent(top: CardCode, options: readonly CardCode[], mem: Memory): CardCode {
  const suit = suitOf(top);
  const sameSuit = options
    .filter((c) => suitOf(c) === suit && rank(c) <= rank(top))
    .sort((a, b) => rank(b) - rank(a));
  let pick = top;
  for (const c of sameSuit) {
    const gap = [...mem.unseen].some(
      (u) => suitOf(u) === suit && rank(u) > rank(c) && rank(u) < rank(pick),
    );
    if (gap) break;
    pick = c;
  }
  return pick;
}

// ─── Play ───────────────────────────────────────────────────────────────────

interface Plan {
  me: PlayerId;
  partner: PlayerId;
  team: Team;
  myNilAlive: boolean;
  partnerNilAlive: boolean;
  /** Opponents whose Nil bids are still unbroken. */
  oppNils: PlayerId[];
  /** Tricks our contract still needs. */
  need: number;
  /** Tricks the opponents' contract still needs. */
  oppNeed: number;
  /** Tricks left to play, including the current one. */
  remaining: number;
  /** Should we be trying to win tricks (rather than ducking to avoid bags)? */
  wantTricks: boolean;
  /**
   * Both contracts are settled (made, or out of reach) but the remaining tricks
   * could still change who wins this one-hand game, so every trick counts.
   */
  contest: boolean;
  /** We need every remaining trick (or close to it) to make our contract. */
  urgent: boolean;
}

function makePlan(view: SeatView): Plan {
  const me = view.seat;
  const partner = partnerOf(me);
  const team = teamOf(me);
  const opp: Team = team === 0 ? 1 : 0;
  const nilAlive = (s: PlayerId) => view.bids[s] === NIL && (view.tricksWon[s] ?? 0) === 0;
  const remaining = TRICKS_PER_HAND - view.tricks.length;
  const need = tricksNeeded(team, view.bids, view.tricksWon);
  const oppNeed = tricksNeeded(opp, view.bids, view.tricksWon);
  const ourLive = need > 0 && need <= remaining;
  const setLive = oppNeed > 0 && oppNeed <= remaining;
  const contest =
    !ourLive && !setLive && lockedWinner(view.bids, view.tricksWon, remaining) === null;
  return {
    me,
    partner,
    team,
    myNilAlive: nilAlive(me),
    partnerNilAlive: nilAlive(partner),
    oppNils: teamSeats(opp).filter(nilAlive),
    need,
    oppNeed,
    remaining,
    wantTricks: ourLive || setLive || contest,
    contest,
    urgent: ourLive && need >= remaining,
  };
}

/** Why the team is still trying to win tricks (one sentence, ends with a full stop). */
function goalWords(plan: Plan): string {
  if (plan.need > 0 && plan.need <= plan.remaining) {
    return `Your team still needs ${tricksLabel(plan.need)}.`;
  }
  if (!plan.contest) return 'You can still stop the opponents making their bid.';
  return plan.need === 0
    ? 'Your team has made its bid, but this hand is still close — here every extra trick (bag) is +1 point, so keep winning tricks.'
    : 'Your team can no longer make its bid, but this hand is still close — every trick you take stops the opponents scoring a bag (+1).';
}

/** Why the team is ducking: both contracts are settled and the result is locked. */
function settledWords(plan: Plan): string {
  return plan.need === 0
    ? 'Your team has made its bid and the result of this hand can no longer change, so practise the full-game habit of avoiding extra tricks ("bags" — in a full game every 10 bags cost 100 points).'
    : 'Your team can no longer make its bid and the result of this hand can no longer change, so let the others take the last tricks.';
}

type Pick = { card: CardCode; why: string };

/** Cheapest card to throw away: lowest side-suit card (keeps Spades), else lowest Spade. */
function cheapest(cards: readonly CardCode[]): CardCode {
  const side = cards.filter((c) => !isSpade(c));
  return (lowest(side.length > 0 ? side : cards) ?? cards[0]) as CardCode;
}

/** Most dangerous card to hold on to: the highest side-suit card, else the highest Spade. */
function priciest(cards: readonly CardCode[]): CardCode {
  const side = cards.filter((c) => !isSpade(c));
  return (highest(side.length > 0 ? side : cards) ?? cards[0]) as CardCode;
}

function nilPlay(view: SeatView, mem: Memory, legal: readonly CardCode[]): Pick {
  const lead = view.trick[0];
  if (!lead) {
    // Lead the card most likely to be beaten: the one with the most unseen higher cards.
    const score = (c: CardCode) =>
      [...mem.unseen].filter((u) => suitOf(u) === suitOf(c) && rank(u) > rank(c)).length -
      (isSpade(c) ? 0.5 : 0);
    const best = [...legal].sort((a, b) => score(b) - score(a) || rank(a) - rank(b))[0] as CardCode;
    const above = [...mem.unseen].filter(
      (u) => suitOf(u) === suitOf(best) && rank(u) > rank(best),
    ).length;
    const odds =
      above >= 3
        ? 'lots of higher cards in that suit are still out, so someone else should win it'
        : above > 0
          ? `only ${above === 1 ? 'one higher card is' : `${above} higher cards are`} still out in that suit, but it is your best chance that someone else wins the trick`
          : 'no higher card of that suit is still out, so this trick is hard to lose — but no other card gives you a better chance';
    return {
      card: best,
      why: `You bid Nil, so you want to lose every trick. Lead the ${cardShort(best)}: ${odds}.`,
    };
  }
  const led = suitOf(lead.card);
  const best = winningPlay(view.trick);
  const losers = legal.filter((c) => !beats(c, best.card, led));
  if (losers.length > 0) {
    const card = priciest(losers);
    return {
      card,
      why: `You bid Nil, so stay under the winning ${cardShort(best.card)}. The ${cardShort(card)} is the highest card you can play that still loses — getting rid of high cards now keeps you safe later.`,
    };
  }
  if (seatsAfter(view).length === 0) {
    const card = highest(legal) as CardCode;
    return {
      card,
      why: `Every card you may play beats the ${cardShort(best.card)}, so you have to win this trick — use your highest card, the ${cardShort(card)}, to get rid of it.`,
    };
  }
  const card = lowest(legal) as CardCode;
  return {
    card,
    why: `Every card you may play beats the ${cardShort(best.card)}. Play your lowest, the ${cardShort(card)}, and hope a player after you plays higher.`,
  };
}

function coverLead(legal: readonly CardCode[], mem: Memory, plan: Plan): Pick {
  const side = legal.filter((c) => !isSpade(c));
  const boss = side.filter((c) => isBoss(c, mem));
  const pick = highest(boss);
  if (pick) {
    return {
      card: pick,
      why: `Your partner bid Nil. Lead the ${cardShort(pick)} — it is the highest card left in its suit, so your partner can safely play under it.`,
    };
  }
  const partnerVoid = side.filter((c) => mem.voids[plan.partner]?.has(suitOf(c)));
  const pv = highest(partnerVoid);
  if (pv) {
    return {
      card: pv,
      why: `Your partner bid Nil and has no ${SUIT_NAMES[suitOf(pv)]} left, so they can throw away a dangerous card on this lead.`,
    };
  }
  const card = highest(side.length > 0 ? side : legal) as CardCode;
  return {
    card,
    why: `Your partner bid Nil. Lead high (the ${cardShort(card)}) so your partner can play a lower card under it.`,
  };
}

function leadPlay(view: SeatView, mem: Memory, legal: readonly CardCode[], plan: Plan): Pick {
  if (plan.partnerNilAlive) return coverLead(legal, mem, plan);
  const side = legal.filter((c) => !isSpade(c));
  const spadesOut = unseenOf(mem, TRUMP).length;
  const oppSeats = teamSeats(plan.team === 0 ? 1 : 0);

  if (plan.oppNils.length > 0 && !plan.urgent) {
    const target = plan.oppNils[0] as PlayerId;
    const into = legal.filter((c) => !mem.voids[target]?.has(suitOf(c)));
    const card = cheapest(into.length > 0 ? into : legal);
    return {
      card,
      why: `${capitalise(nameFor(target, plan.me))} bid Nil. Lead a low card (the ${cardShort(card)}) so they may be forced to win the trick — breaking a Nil costs their team 100 points.`,
    };
  }

  if (plan.wantTricks) {
    // 1. Cash a side-suit winner while nobody can trump it.
    const safeSide = side.filter((c) => {
      if (!isBoss(c, mem)) return false;
      const s = suitOf(c);
      const trumpRisk =
        spadesOut > 0 && oppSeats.some((o) => mem.voids[o]?.has(s) && !mem.voids[o]?.has(TRUMP));
      return !trumpRisk && unseenOf(mem, s).length >= 2;
    });
    const cash = [...safeSide].sort(
      (a, b) => unseenOf(mem, suitOf(b)).length - unseenOf(mem, suitOf(a)).length,
    )[0];
    if (cash) {
      const s = suitOf(cash);
      const certain = certainAgainst(cash, s, oppSeats, plan.me, mem);
      return {
        card: cash,
        why: `${goalWords(plan)} The ${cardShort(cash)} ${bossWords(cash, view.hand)}, so lead it: it ${certain ? 'wins the trick' : `should win the trick${trumpRisk(cash, s)}`}.`,
      };
    }
    // 2. A boss Spade always wins.
    const bossSpade = legal.filter((c) => isSpade(c) && isBoss(c, mem));
    const bs = highest(bossSpade);
    if (bs) {
      return {
        card: bs,
        why: `${plan.contest ? `${goalWords(plan)} ` : ''}The ${cardShort(bs)} is the highest Spade left, so nothing can beat it — a sure trick, and it pulls Spades out of the other players' hands.`,
      };
    }
    // 3. Lead a suit your partner can trump (and the opponents can't).
    const partnerRuff = side.filter((c) => {
      const s = suitOf(c);
      return (
        mem.voids[plan.partner]?.has(s) &&
        !mem.voids[plan.partner]?.has(TRUMP) &&
        !oppSeats.some((o) => mem.voids[o]?.has(s))
      );
    });
    const pr = lowest(partnerRuff);
    if (pr) {
      return {
        card: pr,
        why: `Your partner has no ${SUIT_NAMES[suitOf(pr)]} left, so lead a low one: your partner can trump it with a Spade.`,
      };
    }
    // 4. Lead from a short side suit to get void and trump later.
    const mySpades = view.hand.filter(isSpade).length;
    if (mySpades > 0) {
      const suits = bySuit(view.hand);
      const shortSuit = SIDE_SUITS.filter(
        (s) => suits[s].length > 0 && suits[s].length <= 2 && !suits[s].some((c) => isBoss(c, mem)),
      ).sort((a, b) => suits[a].length - suits[b].length)[0];
      const sc = shortSuit ? lowest(side.filter((c) => suitOf(c) === shortSuit)) : undefined;
      if (sc) {
        return {
          card: sc,
          why: `Lead your short ${SUIT_NAMES[suitOf(sc)]}: once you run out of them you can trump that suit with your Spades and win tricks.`,
        };
      }
    }
    // 5. Otherwise lead low from the longest side suit.
    const suits = bySuit(side);
    const longSuit = SIDE_SUITS.filter((s) => suits[s].length > 0).sort(
      (a, b) => suits[b].length - suits[a].length,
    )[0];
    const lc = longSuit ? lowest(suits[longSuit]) : lowest(legal);
    const card = (lc ?? legal[0]) as CardCode;
    return {
      card,
      why: `No sure winner to lead, so lead a low card (the ${cardShort(card)}) and keep your high cards for later tricks.`,
    };
  }

  // Avoid bags: lead the card least likely to win.
  const danger = (c: CardCode) =>
    [...mem.unseen].filter((u) => suitOf(u) === suitOf(c) && rank(u) > rank(c)).length -
    (isSpade(c) ? 3 : 0);
  const card = [...legal].sort((a, b) => danger(b) - danger(a) || rank(a) - rank(b))[0] as CardCode;
  return {
    card,
    why: `${settledWords(plan)} Lead a low card (the ${cardShort(card)}) that someone else will probably beat.`,
  };
}

function followPlay(view: SeatView, mem: Memory, legal: readonly CardCode[], plan: Plan): Pick {
  const lead = view.trick[0] as SpadesPlay;
  const led = suitOf(lead.card);
  const best = winningPlay(view.trick);
  const after = seatsAfter(view);
  const last = after.length === 0;
  const winners = legal.filter((c) => beats(c, best.card, led));
  const losers = legal.filter((c) => !beats(c, best.card, led));
  const following = legal.some((c) => suitOf(c) === led);
  const partnerWinning = best.seat === plan.partner;
  const partnerPlayed = view.trick.some((p) => p.seat === plan.partner);
  const lowestWinner = lowest(winners);

  // 1. Cover a partner who bid Nil.
  if (plan.partnerNilAlive) {
    if (partnerPlayed && partnerWinning) {
      if (lowestWinner) {
        const card = following ? lowestWinner : (lowest(winners.filter(isSpade)) ?? lowestWinner);
        return {
          card,
          why: `Your partner bid Nil and their ${cardShort(best.card)} is winning this trick. Beat it with the ${cardShort(card)} so they don't take a trick.`,
        };
      }
    } else if (!partnerPlayed && winners.length > 0) {
      // Raise the bar the Nil bidder has to stay under (if we can't, the
      // current winner already sets it and we just play normally).
      const pick = following
        ? highest(winners)
        : (lowest(winners.filter(isSpade)) ?? highest(winners));
      if (pick) {
        return {
          card: pick,
          why: `Your partner bid Nil and plays after you. Play high (the ${cardShort(pick)}) so they can safely drop a lower card.`,
        };
      }
    }
  }

  // 2. Let an opponent who bid Nil keep winning.
  if (plan.oppNils.includes(best.seat) && !plan.urgent && losers.length > 0) {
    const card = following ? (highest(losers) as CardCode) : cheapest(losers);
    return {
      card,
      why: `${capitalise(nameFor(best.seat, plan.me))} bid Nil and is winning this trick. Don't rescue them — play under with the ${cardShort(card)} and their Nil may break (that's −100 for their team).`,
    };
  }

  // 3. Win the tricks we still need (or deny the opponents theirs).
  if (plan.wantTricks) {
    if (partnerWinning && holds(best.card, led, after, mem)) {
      const card = cheapest(legal);
      return {
        card,
        why: `Your partner's ${cardShort(best.card)} is already winning this trick, so save your good cards and play the ${cardShort(card)}.`,
      };
    }
    if (!lowestWinner) {
      const card = cheapest(legal);
      return {
        card,
        why: following
          ? `You can't beat the ${cardShort(best.card)}, so play your lowest ${SUIT_SINGULAR[led]}, the ${cardShort(card)}, and keep your better cards.`
          : `You can't beat the ${cardShort(best.card)}, so throw away your least useful card, the ${cardShort(card)}.`,
      };
    }
    const goal = plan.contest ? `${goalWords(plan)} ` : '';
    if (last) {
      return {
        card: lowestWinner,
        why: `${goal}You play last, so the ${cardShort(lowestWinner)} — your cheapest card that beats the ${cardShort(best.card)} — wins the trick for sure.`,
      };
    }
    const sure = lowest(winners.filter((c) => holds(c, led, after, mem)));
    if (sure) {
      const certain = certainAgainst(sure, led, after, plan.me, mem);
      return {
        card: sure,
        why: certain
          ? `${goal}The ${cardShort(sure)} beats the ${cardShort(best.card)} and no opponent still to play can top it, so it wins the trick for your team.`
          : `${goal}The ${cardShort(sure)} beats the ${cardShort(best.card)} and ${holdReason(sure, led, mem)}, so it should win the trick for your team${trumpRisk(sure, led)}.`,
      };
    }
    if (!following) {
      const ruff = lowest(winners.filter(isSpade)) ?? lowestWinner;
      return {
        card: ruff,
        why: `${goal}You have no ${SUIT_NAMES[led]}, so trump with a low Spade (the ${cardShort(ruff)}) — any Spade beats every ${SUIT_SINGULAR[led]}.`,
      };
    }
    const partnerAfter = after.includes(plan.partner);
    if (partnerAfter && !plan.urgent) {
      const card = cheapest(legal);
      return {
        card,
        why: `Your partner still plays after you, so play low (the ${cardShort(card)}) — "second hand low" saves your high cards and lets your partner try to win it.`,
      };
    }
    const card = cheapestEquivalent(highest(winners) as CardCode, winners, mem);
    return {
      card,
      why:
        view.trick.length === 1
          ? `Your team needs nearly every trick that is left, so play high with the ${cardShort(card)} and try to win this one now.`
          : `${goal}Play high with the ${cardShort(card)} ("third hand high") to give your team the best chance of winning this trick.`,
    };
  }

  // 4. Both contracts are settled and the result is locked: duck to avoid bags.
  if (losers.length > 0) {
    const card = following ? (highest(losers) as CardCode) : priciest(losers);
    return {
      card,
      why: `${settledWords(plan)} The ${cardShort(card)} loses this trick and gets rid of a high card.`,
    };
  }
  if (last) {
    const card = highest(legal) as CardCode;
    return {
      card,
      why: `You have to win this trick anyway, so use your highest card, the ${cardShort(card)}.`,
    };
  }
  const card = lowest(legal) as CardCode;
  return {
    card,
    why: `Every card you may play beats the ${cardShort(best.card)}. Play your lowest, the ${cardShort(card)}, and hope someone after you plays higher.`,
  };
}

function playContext(view: SeatView): PlayContext {
  return { trick: view.trick, spadesBroken: view.spadesBroken };
}

function normalPlay(view: SeatView): Pick {
  const legal = legalPlays(view.hand, playContext(view));
  const only = legal[0];
  if (legal.length === 1 && only) {
    return { card: only, why: `The ${cardShort(only)} is the only card you're allowed to play.` };
  }
  const mem = remember(view);
  const plan = makePlan(view);
  if (plan.myNilAlive) return nilPlay(view, mem, legal);
  if (view.trick.length === 0) return leadPlay(view, mem, legal, plan);
  return followPlay(view, mem, legal, plan);
}

/** The normal bot's (and the coach's) move with a plain-words reason. */
export function normalDecision(view: SeatView): BotDecision {
  if (view.phase === 'bid') {
    const b = normalBid(view);
    return { move: { type: 'bid', tricks: b.bid }, why: b.why };
  }
  const p = normalPlay(view);
  return { move: { type: 'play', card: p.card }, why: p.why };
}

/** Easy bot: simple but not absurd. */
export function easyMove(view: SeatView, rng: Rng): SpadesMove {
  if (view.phase === 'bid') return { type: 'bid', tricks: easyBid(view, rng) };
  const legal = legalPlays(view.hand, playContext(view));
  const plan = makePlan(view);
  const roll = rng.next();
  let card: CardCode | undefined;
  if (plan.myNilAlive) {
    card = roll < 0.8 ? lowest(legal) : rng.pick(legal);
  } else if (view.trick.length === 0) {
    const side = legal.filter((c) => !isSpade(c));
    if (plan.need > 0 && roll < 0.4) card = highest(side.length > 0 ? side : legal);
    else if (roll < 0.8) card = cheapest(legal);
    else card = rng.pick(legal);
  } else {
    const lead = view.trick[0] as SpadesPlay;
    const best = winningPlay(view.trick);
    const winners = legal.filter((c) => beats(c, best.card, suitOf(lead.card)));
    if (plan.need > 0 && winners.length > 0 && best.seat !== plan.partner && roll < 0.5) {
      card = lowest(winners);
    } else if (roll < 0.8) {
      card = cheapest(legal);
    } else {
      card = rng.pick(legal);
    }
  }
  return { type: 'play', card: (card ?? rng.pick(legal)) as CardCode };
}

// ─── Coach ──────────────────────────────────────────────────────────────────

function bidWords(seat: PlayerId, bid: number | null | undefined, me: PlayerId): string {
  const who = nameFor(seat, me);
  if (bid === null || bid === undefined) return `${who} hasn't bid yet`;
  return `${who} bid ${bidLabel(bid)}`;
}

function teamStatus(view: SeatView | SpadesState, me: PlayerId): string {
  const team = teamOf(me);
  const parts: string[] = [];
  for (const t of [team, team === 0 ? 1 : 0] as Team[]) {
    const seats = teamSeats(t);
    const contract = seats.reduce((sum, s) => sum + (view.bids[s] ?? 0), 0);
    const nils = seats.filter((s) => view.bids[s] === NIL);
    // Only tricks won by the non-Nil partner count toward the contract.
    const counted = seats
      .filter((s) => view.bids[s] !== NIL)
      .reduce((sum, s) => sum + (view.tricksWon[s] ?? 0), 0);
    const who = t === team ? 'Your team' : 'The opponents';
    const has = t === team ? 'has' : 'have';
    const need = tricksNeeded(t, view.bids, view.tricksWon);
    let text: string;
    if (contract === 0) {
      text = `${who} bid two Nils`;
    } else {
      const toward = nils.length > 0 ? ' toward the bid' : '';
      text = `${who} bid ${contract} and ${has} won ${tricksLabel(counted)}${toward}`;
      text += need > 0 ? ` (${need} more needed)` : ' (bid made)';
    }
    for (const s of nils) {
      const taken = view.tricksWon[s] ?? 0;
      text += `; ${possessiveFor(s, me)} Nil is ${taken > 0 ? `broken (${tricksLabel(taken)} taken)` : 'still safe'}`;
    }
    parts.push(text);
  }
  return `${parts.join('. ')}.`;
}

function bidSituation(state: SpadesState, p: PlayerId): string {
  const order: PlayerId[] = [];
  for (let k = 1; k <= SEATS; k++) order.push((state.dealer + k) % SEATS);
  const others = order.filter((s) => s !== p).map((s) => bidWords(s, state.bids[s], p));
  const sofar = `So far: ${listWords(others)}.`;
  if (state.turn !== p) {
    return `Bidding: everyone says how many tricks they expect to win. Waiting for ${nameFor(state.turn, p)} to bid. ${sofar}`;
  }
  return `It's your turn to bid. Say how many of the 13 tricks you think you can win — 0 means Nil (you promise to win none). Your bid and your partner's add up to your team's contract. ${sofar}`;
}

function playSituation(state: SpadesState, p: PlayerId): string {
  const trickNo = state.tricks.length + 1;
  const head = `Trick ${trickNo} of ${TRICKS_PER_HAND}. ${teamStatus(state, p)}`;
  if (state.turn !== p) {
    return `${head} Waiting for ${nameFor(state.turn, p)} to play.`;
  }
  const hand = state.hands[p] ?? [];
  const lead = state.trick[0];
  if (!lead) {
    const onlySpades = hand.every(isSpade);
    const rule = state.spadesBroken
      ? 'Spades are broken, so you may lead any card.'
      : onlySpades
        ? "You hold nothing but Spades, so you may lead one even though Spades aren't broken."
        : "You may lead any card except a Spade — Spades aren't broken yet.";
    return `${head} You lead this trick. ${rule}`;
  }
  const led = suitOf(lead.card);
  const best = winningPlay(state.trick);
  const leader = capitalise(nameFor(lead.seat, p));
  const status =
    best.seat === lead.seat
      ? `${leader} led the ${cardShort(lead.card)}, which is winning so far.`
      : `${leader} led ${SUIT_NAMES[led]} and ${possessiveFor(best.seat, p)} ${cardShort(best.card)} is winning so far.`;
  const can = hand.some((c) => suitOf(c) === led)
    ? `You have ${SUIT_NAMES[led]}, so you must play one.`
    : led === TRUMP
      ? 'You have no Spades, so you may play any card.'
      : hand.some(isSpade)
        ? `You have no ${SUIT_NAMES[led]}, so you may trump with a Spade or throw away any card.`
        : `You have no ${SUIT_NAMES[led]} and no Spades, so you may throw away any card (it can't win this trick).`;
  return `${head} ${status} ${can}`;
}

function overSituation(): string {
  return 'The hand is over — all 13 tricks have been played. See the result for the final score.';
}

export function coachAdvice(state: SpadesState, p: PlayerId): CoachAdvice {
  if (state.phase === 'over') return { situation: overSituation() };
  const situation = state.phase === 'bid' ? bidSituation(state, p) : playSituation(state, p);
  if (state.turn !== p) return { situation };
  const d = normalDecision(seatView(state, p));
  return { situation, suggestion: d.move, why: d.why };
}
