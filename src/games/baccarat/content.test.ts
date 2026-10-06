/**
 * The lesson must teach exactly the variant the engine plays: these checks replay every
 * lesson scene that shows a coup through the engine, and tie the numbers, rules and quiz
 * answers quoted to learners to the engine's own tableau, payouts and exact odds.
 */
import { describe, expect, it } from 'vitest';
import { makeDeck, removeCard, type CardCode } from '@/games/core/cards';
import { validateGameContent } from '@/lib/content/schema';
import content from '@content/games/baccarat';
import engine, {
  bankerDraws,
  bestBet,
  cardPoints,
  coupOdds,
  handTotal,
  houseEdges,
  naturalOnTable,
  netUnits,
  PAYOUT,
  percent,
  playerDraws,
  setupWithShoe,
  totals,
  type BaccaratState,
  type BetOn,
} from './engine';

type Zone = { id: string; label?: string; cards: string[]; highlight?: number[] };

const zonesOf = (title: string): Zone[] =>
  (content.lesson.find((l) => l.title === title)?.scene?.zones ?? []) as Zone[];

const zone = (zones: readonly Zone[], id: string) => zones.find((z) => z.id === id);

/** The scene's cards in deal order: P1, B1, P2, B2, then Player’s and Banker’s third cards. */
function dealOrder(player: readonly string[], banker: readonly string[]): CardCode[] {
  const out: CardCode[] = [];
  for (let i = 0; i < 3; i++) {
    if (player[i] !== undefined) out.push(player[i] as CardCode);
    if (banker[i] !== undefined) out.push(banker[i] as CardCode);
  }
  return out;
}

/** Deal exactly `sequence` from a stacked 8-deck shoe; fails if the engine stops early. */
function replay(sequence: CardCode[], on: BetOn = 'banker'): BaccaratState {
  let rest = makeDeck({ copies: 8 });
  for (const c of sequence) rest = removeCard(rest, c);
  let s = engine.applyMove(setupWithShoe({ players: 2 }, [...sequence, ...rest]), {
    type: 'bet',
    on,
  });
  for (const card of sequence) {
    expect(engine.isOver(s), `the engine stopped before dealing ${card}`).toBe(false);
    s = engine.applyMove(s, { type: 'deal' });
  }
  return s;
}

const allText = [
  content.variantTaught,
  ...content.lesson.flatMap((l) => [l.body, l.tip ?? '', l.scene?.caption ?? '']),
  ...content.tips,
  ...content.mistakes,
  ...content.glossary.map((g) => g.definition),
  ...content.quiz.flatMap((q) => [q.question, q.explanation, ...q.options]),
].join(' ');

describe('baccarat content matches the engine', () => {
  it('validates as a Tier 1 content file at journey order 60', () => {
    const { issues } = validateGameContent(content, { fileSlug: 'baccarat', hasEngine: true });
    expect(issues).toEqual([]);
    expect(content.order).toBe(60);
    expect(content.featured ?? false).toBe(false);
    expect(content.lesson.length).toBeGreaterThanOrEqual(7);
    expect(content.lesson.length).toBeLessThanOrEqual(10);
    expect(content.lesson.every((l) => l.scene !== undefined)).toBe(true);
  });

  it('every coup shown in the lesson replays on the engine card for card', () => {
    let replayed = 0;
    for (const step of content.lesson) {
      const zones = (step.scene?.zones ?? []) as Zone[];
      const player = zone(zones, 'player');
      const banker = zone(zones, 'banker');
      if (!player || !banker) continue;
      replayed++;
      const s = replay(dealOrder(player.cards, banker.cards));
      const t = totals(s);
      // The labels quote the engine's totals.
      expect(player.label, step.title).toMatch(new RegExp(`^Player: ${t.player}\\b`));
      expect(banker.label, step.title).toMatch(new RegExp(`^Banker: ${t.banker}\\b`));
      if (step.title === 'The deal: two cards each') {
        // The only scene that stops after four cards on purpose: no natural, draws to come.
        expect(engine.isOver(s)).toBe(false);
        expect(naturalOnTable(s)).toBe(false);
        continue;
      }
      // Every other scene is a complete coup, and its caption names the right result.
      expect(engine.isOver(s), step.title).toBe(true);
      const caption = step.scene?.caption ?? '';
      if (s.winner === 'tie') expect(caption, step.title).toMatch(/tie/i);
      else
        expect(caption, step.title).toContain(
          `${s.winner === 'player' ? 'Player' : 'Banker'} wins`,
        );
    }
    expect(replayed).toBeGreaterThanOrEqual(7);
  });

  it('the natural scenes really are naturals, and the third-card scenes really draw', () => {
    for (const title of ['The goal: closer to 9', 'A natural stops everything']) {
      const z = zonesOf(title);
      const s = replay(dealOrder(zone(z, 'player')!.cards, zone(z, 'banker')!.cards));
      expect(naturalOnTable(s), title).toBe(true);
    }
    const playerThird = zonesOf('Player’s third card');
    expect(zone(playerThird, 'player')!.cards).toHaveLength(3);
    expect(zone(playerThird, 'banker')!.cards).toHaveLength(2);
    const bankerThird = zonesOf('Banker’s third card');
    expect(zone(bankerThird, 'banker')!.cards).toHaveLength(3);
  });

  it('the card values and totals taught are the engine’s', () => {
    const z = zonesOf('Counting: only the last digit');
    for (const c of zone(z, 'numbers')!.cards) {
      const rank = c[0]!;
      expect(cardPoints(c as CardCode)).toBe(rank === 'A' ? 1 : Number(rank));
    }
    for (const c of zone(z, 'zeros')!.cards) expect(cardPoints(c as CardCode)).toBe(0);
    const example = zone(z, 'example')!;
    expect(handTotal(example.cards as CardCode[])).toBe(3);
    expect(example.label).toContain('worth 3');
  });

  it('the drawing rules in the lesson are the engine’s tableau', () => {
    const playerStep = content.lesson.find((l) => l.title === 'Player’s third card')!;
    expect(playerStep.body).toContain('draw a [[third card]] on 0 to 5, stand on 6 or 7');
    for (let t = 0; t <= 7; t++) expect(playerDraws(t)).toBe(t <= 5);

    const bankerStep = content.lesson.find((l) => l.title === 'Banker’s third card')!;
    const claims: [string, number, (third: number | null) => boolean][] = [
      ['If Player stood, Banker uses the same rule: draw on 0–5, stand on 6 or 7', -1, () => true],
      ['on 0–2 Banker always draws', 0, () => true],
      ['on 3 it draws unless that card was an 8', 3, (x) => x !== 8],
      ['on 4 it draws if it was 2–7', 4, (x) => x !== null && x >= 2 && x <= 7],
      ['on 5 if it was 4–7', 5, (x) => x !== null && x >= 4 && x <= 7],
      ['on 6 if it was a 6 or 7', 6, (x) => x === 6 || x === 7],
      ['on 7 it stands', 7, () => false],
    ];
    for (const [phrase, banker, draws] of claims) {
      expect(bankerStep.body).toContain(phrase);
      if (banker < 0) {
        for (let b = 0; b <= 7; b++) expect(bankerDraws(b, null)).toBe(b <= 5);
        continue;
      }
      const rows = banker === 0 ? [0, 1, 2] : [banker];
      for (const b of rows) {
        for (let x = 0; x <= 9; x++) expect(bankerDraws(b, x), `${b}/${x}`).toBe(draws(x));
      }
    }
  });

  it('the worked example pays what the engine pays', () => {
    const step = content.lesson.find((l) => l.title === 'A tiny example')!;
    const z = (step.scene?.zones ?? []) as Zone[];
    const s = replay(dealOrder(zone(z, 'player')!.cards, zone(z, 'banker')!.cards), 'banker');
    const r = engine.result(s);
    expect(s.winner).toBe('banker');
    expect(totals(s)).toEqual({ player: 6, banker: 8 });
    expect(Math.round(r.humanNetUnits * 100)).toBe(95);
    expect(step.body).toContain('You bet 100 Jeet on [[Banker]]');
    expect(step.body).toContain('Banker wins 8 to 6');
    expect(step.body).toContain('win 95 more');
  });

  it('the odds, house edges and payouts quoted to learners are the engine’s', () => {
    const odds = coupOdds(8);
    const edge = houseEdges(8);
    for (const figure of [
      percent(odds.banker),
      percent(odds.player),
      percent(odds.tie),
      percent(edge.banker),
      percent(edge.player),
      percent(edge.tie, 1),
      percent(odds.tie, 1),
    ]) {
      expect(allText).toContain(figure);
    }
    expect([percent(edge.banker), percent(edge.player), percent(edge.tie, 1)]).toEqual([
      '1.06%',
      '1.24%',
      '14.4%',
    ]);
    expect(PAYOUT).toEqual({ player: 1, banker: 0.95, tie: 8 });
    for (const words of ['pays 1 to 1', 'pays 0.95 to 1', 'pays 8 to 1', '5% commission']) {
      expect(allText).toContain(words);
    }
    expect(content.variantTaught).toContain('8-deck shoe');
  });

  it('every quiz answer agrees with the engine', () => {
    const q = (needle: string) => {
      const found = content.quiz.find((x) => x.question.includes(needle))!;
      return found.options[found.answer]!;
    };
    expect(q('a 7 and a 6')).toBe(String(handTotal(['7H', '6S'])));
    expect(q('100 Jeet on Banker')).toBe(`${Math.round(100 * PAYOUT.banker)} Jeet`);
    expect(netUnits('player', 'tie')).toBe(0);
    expect(q('ends in a tie')).toMatch(/pushes/);
    const natural = replay(['8D', '3S', 'KH', '2C'], 'player');
    expect(engine.isOver(natural)).toBe(true);
    expect(natural.winner).toBe('player');
    expect(q('make 8')).toBe('Player has a natural, so nobody draws and Player wins 8 to 5');
    expect(q('smallest house edge')).toBe(bestBet(8) === 'banker' ? 'Banker' : '');
    // The correct answer moves around.
    expect(new Set(content.quiz.map((x) => x.answer)).size).toBeGreaterThanOrEqual(3);
  });

  it('the background facts are stated accurately', () => {
    // Two hands: one finishes "closer" to 9, not "closest".
    expect(content.hook).toContain('closer to 9');
    // Only chemin de fer passes the bank around; in baccarat banque one banker keeps it.
    expect(content.variants).toContain('in chemin de fer it passes from player to player');
    expect(content.variants).toContain('in baccarat banque one banker keeps it');
    expect(content.variants).not.toMatch(/take turns being the banker/);
    // Bond's game in Casino Royale is the chemin de fer form, not Punto Banco.
    expect(content.history).toContain('in its older chemin de fer form');
    // A coup can also end in a tie, not only in a win for the hand closer to 9.
    const coup = content.glossary.find((g) => g.term === 'coup')!;
    expect(coup.definition).toContain('equal totals are a tie');
  });
});
