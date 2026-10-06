/**
 * Pure helpers for the Indian Rummy Board: how the learner's hand is laid out (in the
 * groups `bestArrangement` finds, or by suit), stable card keys for duplicates from the two
 * decks, and the words screen readers hear for each group.
 */
import { cardKeys } from '@/components/cards';
import {
  cardName,
  isJoker,
  sortHand,
  suitOf,
  type CardCode,
  type Rank,
  type Suit,
} from '@/games/core/cards';
import { joinNames } from '@/components/play/personas';
import { t, type TKey } from '@/games/indian-rummy/i18n';
import { bestArrangement, isJokerFor, type GroupKind } from '../engine';

export type SortMode = 'group' | 'suit';
export type DisplayKind = GroupKind | Suit | 'jokers';

export interface DisplayCard {
  /** Stable React key ("7H~0", "7H~1" for the second 7♥ of the two decks). */
  key: string;
  code: CardCode;
  /** A printed joker or a card of the wild rank. */
  joker: boolean;
}

export interface DisplayGroup {
  id: string;
  kind: DisplayKind;
  cards: DisplayCard[];
}

const SUIT_ORDER: readonly Suit[] = ['S', 'H', 'C', 'D'];

/** Assigns each display card the key of a matching card in `hand` (hand order). */
function keyer(hand: readonly CardCode[]): (code: CardCode) => string {
  const keys = cardKeys(hand);
  const queues = new Map<CardCode, string[]>();
  hand.forEach((code, i) => {
    const list = queues.get(code) ?? [];
    list.push(keys[i] ?? `${code}~${i}`);
    queues.set(code, list);
  });
  let spare = 0;
  return (code) => queues.get(code)?.shift() ?? `${code}~x${spare++}`;
}

/** The learner's hand as the Board shows it: in groups (default) or by suit. */
export function displayGroups(
  hand: readonly CardCode[],
  wildRank: Rank,
  mode: SortMode,
): DisplayGroup[] {
  const keyOf = keyer(hand);
  const toCard = (code: CardCode): DisplayCard => ({
    key: keyOf(code),
    code,
    joker: isJokerFor(code, wildRank),
  });
  if (mode === 'group') {
    const seen = new Map<string, number>();
    return bestArrangement(hand, wildRank).groups.map((g) => {
      const n = seen.get(g.kind) ?? 0;
      seen.set(g.kind, n + 1);
      return { id: `${g.kind}-${n}`, kind: g.kind, cards: g.cards.map(toCard) };
    });
  }
  const sorted = sortHand(hand, { aceHigh: false, suitOrder: SUIT_ORDER });
  const groups: DisplayGroup[] = [];
  for (const suit of SUIT_ORDER) {
    const cards = sorted.filter((c) => !isJoker(c) && suitOf(c) === suit);
    if (cards.length) groups.push({ id: suit, kind: suit, cards: cards.map(toCard) });
  }
  const printed = sorted.filter((c) => isJoker(c));
  if (printed.length) groups.push({ id: 'jokers', kind: 'jokers', cards: printed.map(toCard) });
  return groups;
}

/** Visible group heading ("Pure sequence ✓", "♠ Spades"). */
export function groupTitle(kind: DisplayKind): string {
  return t(`indianRummy.group.${kind}` as TKey);
}

/** Screen-reader name of a group: "Pure sequence, complete: 9 of Clubs, 10 of Clubs…". */
export function groupLabel(group: DisplayGroup): string {
  const names = group.cards.map((c) =>
    c.joker && !isJoker(c.code)
      ? `${cardName(c.code)} (${t('indianRummy.card.joker')})`
      : cardName(c.code),
  );
  return t('indianRummy.group.label', {
    name: t(`indianRummy.group.sr.${group.kind}` as TKey),
    cards: joinNames(names),
  });
}

/** "all 7s are jokers" for the caption under the wild-joker card. */
export function wildCaption(wildCard: CardCode, wildRank: Rank): string {
  return isJoker(wildCard)
    ? t('indianRummy.caption.wildPrinted')
    : t('indianRummy.caption.wildRank', { rank: rankPlural(wildRank) });
}

/** "7s", "Aces", "10s". */
export function rankPlural(rank: Rank): string {
  return t(`indianRummy.rank.${rank}` as TKey);
}

/** Whether a group counts as finished (it gets the gold frame). */
export function isMeld(kind: DisplayKind): boolean {
  return kind === 'pure-sequence' || kind === 'sequence' || kind === 'set';
}
