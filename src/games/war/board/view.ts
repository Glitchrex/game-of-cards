/**
 * Pure helpers for the War table: what each side shows for a battle, the reveal timeline,
 * the pile sizes before a battle, and the outcome words. No React here, so all of it is
 * easy to test.
 */
import { joinNames } from '@/components/play/personas';
import { cardName, type CardCode } from '@/games/core/cards';
import { t } from '@/lib/i18n';
import { sameRank, type Pair, type WarBattle, type WarSeat } from '../engine';

/** One card in a side's battle row. Face-down cards carry NO code: they never reach the DOM. */
export type BattleSlot =
  | { id: string; round: number; kind: 'up'; code: CardCode }
  | { id: string; round: number; kind: 'down' };

/** The cards a seat put into the middle, in play order: the opening card, then each war. */
export function laneSlots(battle: WarBattle, seat: WarSeat): BattleSlot[] {
  return battle.rounds.flatMap((round, r): BattleSlot[] => [
    ...round.down[seat].map((_, i): BattleSlot => ({ id: `d${r}-${i}`, round: r, kind: 'down' })),
    { id: `u${r}`, round: r, kind: 'up', code: round.up[seat] },
  ]);
}

/** "Ace of Spades, 3 face-down cards and Ace of Hearts" — face-down cards are only counted. */
export function laneText(slots: readonly BattleSlot[]): string {
  const parts: string[] = [];
  let down = 0;
  const flush = () => {
    if (down === 0) return;
    parts.push(down === 1 ? t('war.zone.faceDownOne') : t('war.zone.faceDownMany', { n: down }));
    down = 0;
  };
  for (const slot of slots) {
    if (slot.kind === 'down') {
      down++;
      continue;
    }
    flush();
    parts.push(cardName(slot.code));
  }
  flush();
  return joinNames(parts);
}

/** How far a battle's reveal has got. */
export interface RevealStep {
  /** Milliseconds after the flip. */
  at: number;
  /** Rounds whose cards are on the table. */
  shown: number;
  /** Rounds whose face-up cards have turned over. */
  flipped: number;
  /** The winner is known: outcome text, glow and the "+N" chip. */
  done: boolean;
}

/** ms until the opening cards turn face up (they fly from the piles first). */
const FIRST_FLIP_MS = 450;
/** ms between a tie turning up and the war's cards going down. */
const WAR_PAUSE_MS = 600;
/** ms for the face-down cards to fan out before the deciding card turns. */
const WAR_LAY_MS = 700;
/** ms the last face-up cards stay on show before the result. */
const SETTLE_MS = 350;

/**
 * The cinematic reveal of one battle, step by step: both opening cards fly in and turn
 * over; for every war the "WAR!" banner goes up, three cards each fan out face down and
 * the deciding cards turn; then the winner is shown. (A player who runs out of cards
 * mid-war loses after the banner — there is no war round to lay.)
 */
export function revealTimeline(battle: WarBattle): RevealStep[] {
  const steps: RevealStep[] = [{ at: 0, shown: 1, flipped: 0, done: false }];
  let at = FIRST_FLIP_MS;
  steps.push({ at, shown: 1, flipped: 1, done: false });
  for (let r = 1; r < battle.rounds.length; r++) {
    at += WAR_PAUSE_MS;
    steps.push({ at, shown: r + 1, flipped: r, done: false });
    at += WAR_LAY_MS;
    steps.push({ at, shown: r + 1, flipped: r + 1, done: false });
  }
  // The last tie of an out-of-cards (or both-out) battle gets the banner before the end.
  at += battle.decidedBy === 'higher-card' ? SETTLE_MS : WAR_PAUSE_MS + SETTLE_MS;
  const last = battle.rounds.length;
  steps.push({ at, shown: last, flipped: last, done: true });
  return steps;
}

/** Total ms the reveal of this battle takes. */
export function revealMs(battle: WarBattle): number {
  return revealTimeline(battle).at(-1)?.at ?? 0;
}

/** The finished reveal (what reduced motion, and a battle already on the table, show). */
export function finalStep(battle: WarBattle): RevealStep {
  const last = battle.rounds.length;
  return { at: 0, shown: last, flipped: last, done: true };
}

/** How many ties have turned face up so far (0 = no war yet). */
export function tiesShown(battle: WarBattle, flipped: number): number {
  return battle.rounds.slice(0, flipped).filter((r) => sameRank(r.up[0], r.up[1])).length;
}

/** Cards each seat put into the middle in this battle. */
export function playedCounts(battle: WarBattle): Pair<number> {
  const count = (seat: WarSeat) => battle.rounds.reduce((n, r) => n + r.down[seat].length + 1, 0);
  return [count(0), count(1)];
}

/** Pile sizes just before the battle was fought (shown while its reveal is running). */
export function countsBefore(battle: WarBattle): Pair<number> {
  const played = playedCounts(battle);
  const gained = (seat: WarSeat) =>
    battle.winner === null ? played[seat] : battle.winner === seat ? battle.won.length : 0;
  return [battle.counts[0] + played[0] - gained(0), battle.counts[1] + played[1] - gained(1)];
}

/** Big line + small line under the battle, from the learner's seat. */
export function outcomeWords(
  battle: WarBattle,
  botName: string,
): { title: string; detail: string } {
  if (battle.decidedBy === 'both-out' || battle.winner === null) {
    return { title: t('war.outcome.bothOut'), detail: t('war.outcome.back') };
  }
  const w = battle.winner;
  const total = battle.won.length;
  const cards = total === 2 ? t('war.outcome.both') : t('war.outcome.all', { n: total });
  const detail =
    w === 0
      ? t('war.outcome.takeYou', { cards })
      : t('war.outcome.takeBot', { name: botName, cards });
  if (battle.decidedBy === 'out-of-cards') {
    const title = w === 0 ? t('war.outcome.outYou', { name: botName }) : t('war.outcome.outBot');
    return { title, detail };
  }
  if (battle.wars === 0) return { title: t('war.outcome.higher'), detail };
  const title = w === 0 ? t('war.outcome.warYou') : t('war.outcome.warBot', { name: botName });
  return { title, detail };
}

/** "War!" / "Double war!" / "3 wars in a row!" */
export function bannerText(ties: number): string {
  if (ties <= 1) return t('war.banner.war');
  if (ties === 2) return t('war.banner.double');
  return t('war.banner.many', { n: ties });
}
