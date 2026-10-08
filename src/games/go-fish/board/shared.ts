/**
 * Pure helpers for the Go Fish Board: grouping the learner's hand by rank, reading the
 * PUBLIC part of the move history (who asked whom for what, how it went) and naming
 * things for screen readers. Nothing here ever looks at a card the learner can't see.
 */
import { joinNames } from '@/components/play/personas';
import { cardName, rankOf, RANKS, type CardCode, type Rank } from '@/games/core/cards';
import { type BotPersona } from '@/games/core/module';
import { type PlayerId } from '@/games/core/types';
import { t } from '@/games/go-fish/i18n';
import { goFishEngine, type GoFishEvent, type GoFishMove, type GoFishState } from '../engine';
import { rankPlural } from '../rules';
import { GO_FISH_BOTS } from '../personas';

/** One rank's cards in the learner's hand (A → K order, like the engine keeps them). */
export interface RankGroup {
  rank: Rank;
  cards: CardCode[];
}

export function rankGroups(hand: readonly CardCode[]): RankGroup[] {
  const groups: RankGroup[] = [];
  for (const rank of RANKS) {
    const cards = hand.filter((c) => rankOf(c) === rank);
    if (cards.length > 0) groups.push({ rank, cards });
  }
  return groups;
}

export const askKey = (target: PlayerId, rank: Rank) =>
  goFishEngine.moveKey({ type: 'ask', target, rank });

/** A persona for every seat: the shell's personas first, then the Go Fish regulars. */
export function personaFor(personas: readonly BotPersona[], seat: PlayerId): BotPersona {
  return (
    personas[seat] ??
    GO_FISH_BOTS[seat - 1] ?? {
      name: `Player ${seat}`,
      tagline: '',
      avatar: { bg: '#13593d', skin: '#c98f62', accessory: 'none', accent: '#f5d77a' },
    }
  );
}

/** "Sevens and Kings" — the ranks of a seat's books, for labels. */
export function rankList(ranks: readonly Rank[]): string {
  return joinNames(ranks.map(rankPlural));
}

export function cardList(cards: readonly CardCode[]): string {
  return joinNames(cards.map(cardName));
}

/** Index of the most recent `ask` event, or −1 before the first ask. */
export function lastAskIndex(log: readonly GoFishEvent[]): number {
  for (let i = log.length - 1; i >= 0; i--) if (log[i]?.type === 'ask') return i;
  return -1;
}

/** What happened on the latest ask — public information only. */
export interface LastAsk {
  /** Its index in the log (a stable id for the splash). */
  index: number;
  seat: PlayerId;
  target: PlayerId;
  rank: Rank;
  /** Cards handed over (0 = "Go Fish!"). */
  got: number;
  /** The Go Fish draw was the asked rank (shown to everyone). */
  wish: boolean;
  /** "Go Fish!" with an empty pond: nothing was drawn. */
  dry: boolean;
}

export function lastAsk(log: readonly GoFishEvent[]): LastAsk | null {
  const index = lastAskIndex(log);
  const ask = log[index];
  if (!ask || ask.type !== 'ask') return null;
  const next = log[index + 1];
  const fished = next?.type === 'fish' && next.seat === ask.seat ? next : null;
  return {
    index,
    seat: ask.seat,
    target: ask.target,
    rank: ask.rank,
    got: ask.got,
    wish: fished?.wish ?? false,
    dry: ask.got === 0 && fished === null,
  };
}

/**
 * Ranks the learner received in the latest ask (caught from another player, a fished wish,
 * their own Go Fish draw or a refill) — the learner saw all of those cards arrive.
 */
export function freshRanks(state: GoFishState, human: PlayerId): ReadonlySet<Rank> {
  const from = lastAskIndex(state.log);
  const out = new Set<Rank>();
  if (from < 0) return out;
  for (const e of state.log.slice(from)) {
    if (e.type === 'ask' && e.seat === human && e.got > 0) out.add(e.rank);
    if ((e.type === 'fish' || e.type === 'refill') && e.seat === human) out.add(rankOf(e.card));
  }
  return out;
}

/** Parse a moveKey back into the move it names, among `moves`. */
export function moveFor(moves: readonly GoFishMove[], key: string | null): GoFishMove | null {
  if (key === null) return null;
  return moves.find((m) => goFishEngine.moveKey(m) === key) ?? null;
}

/** Keyboard rank shortcuts: A, 2–9, T (or 0 for Ten), J, Q, K. */
export function rankForKey(key: string): Rank | null {
  const k = key.toUpperCase();
  if (k === '0') return 'T';
  return (RANKS as readonly string[]).includes(k) ? (k as Rank) : null;
}

export function isTypingTarget(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'reset', 'submit'].includes(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

export function booksText(n: number): string {
  if (n === 0) return t('goFish.seat.booksNone');
  return n === 1 ? t('goFish.seat.booksOne') : t('goFish.seat.books', { n });
}
