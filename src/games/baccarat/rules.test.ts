import { describe, expect, it } from 'vitest';
import { makeDeck, rankOf, type CardCode } from '@/games/core/cards';
import {
  BANKER_COMMISSION,
  bankerDraws,
  bankerRuleWhy,
  BETS,
  cardPoints,
  coupWinner,
  handPhrase,
  handTotal,
  isBetOn,
  isNatural,
  MAX_GAME_MOVES,
  MAX_LOSS_UNITS,
  MAX_WIN_UNITS,
  netUnits,
  otherHand,
  outcomePhrase,
  PAYOUT,
  playerDraws,
  playerRuleWhy,
  seatName,
  verbFor,
  type BetOn,
  type CoupWinner,
} from './rules';

describe('card values', () => {
  it('Ace = 1, 2–9 = face value, 10/J/Q/K = 0, for every suit', () => {
    const expected: Record<string, number> = {
      A: 1,
      '2': 2,
      '3': 3,
      '4': 4,
      '5': 5,
      '6': 6,
      '7': 7,
      '8': 8,
      '9': 9,
      T: 0,
      J: 0,
      Q: 0,
      K: 0,
    };
    for (const c of makeDeck()) expect(cardPoints(c), c).toBe(expected[rankOf(c)]);
  });

  it('jokers are not part of the game', () => {
    expect(() => cardPoints('X1')).toThrow(RangeError);
  });

  it('a total keeps only the last digit of the sum', () => {
    expect(handTotal([])).toBe(0);
    expect(handTotal(['7H'])).toBe(7);
    expect(handTotal(['7H', '5C'])).toBe(2); // 12 → 2
    expect(handTotal(['9H', '9C'])).toBe(8); // 18 → 8
    expect(handTotal(['KH', 'QC'])).toBe(0); // 0 — "baccarat"
    expect(handTotal(['TH', '9C'])).toBe(9);
    expect(handTotal(['AH', '9C', 'KD'])).toBe(0); // 10 → 0
    expect(handTotal(['5H', '5C', '9D'])).toBe(9); // 19 → 9
    expect(handTotal(['AS', 'AH'])).toBe(2);
  });

  it('a natural is exactly two cards totalling 8 or 9', () => {
    expect(isNatural(['8H', 'KC'])).toBe(true);
    expect(isNatural(['4H', '5C'])).toBe(true);
    expect(isNatural(['9H', '9C'])).toBe(true); // 18 → 8
    expect(isNatural(['7H', 'AC'])).toBe(true);
    expect(isNatural(['7H', 'KC'])).toBe(false);
    expect(isNatural(['3H', '3C', '3D'])).toBe(false); // three-card 9 is not a natural
    expect(isNatural(['9H'])).toBe(false);
  });
});

describe('the Player rule', () => {
  it('draws on 0–5 and stands on 6–7', () => {
    for (let t = 0; t <= 5; t++) expect(playerDraws(t), `total ${t}`).toBe(true);
    expect(playerDraws(6)).toBe(false);
    expect(playerDraws(7)).toBe(false);
  });

  it('rejects impossible totals', () => {
    for (const t of [-1, 10, 2.5, Number.NaN]) expect(() => playerDraws(t)).toThrow(RangeError);
  });
});

describe('the Banker tableau — every cell', () => {
  // Row = Banker's two-card total 0–7. Columns = Player's third card: none, then 0–9.
  // D = Banker draws, S = Banker stands. This is the standard Punto Banco table.
  const TABLE: Record<number, string> = {
    //   none 0 1 2 3 4 5 6 7 8 9
    0: 'D DDDDDDDDDD',
    1: 'D DDDDDDDDDD',
    2: 'D DDDDDDDDDD',
    3: 'D DDDDDDDDSD',
    4: 'D SSDDDDDDSS',
    5: 'D SSSSDDDDSS',
    6: 'S SSSSSSDDSS',
    7: 'S SSSSSSSSSS',
  };

  for (let banker = 0; banker <= 7; banker++) {
    const row = TABLE[banker]!.replace(' ', '');
    it(`Banker on ${banker}: Player stood → ${row[0] === 'D' ? 'draws' : 'stands'}`, () => {
      expect(bankerDraws(banker, null)).toBe(row[0] === 'D');
    });
    for (let third = 0; third <= 9; third++) {
      const draws = row[third + 1] === 'D';
      it(`Banker on ${banker}, Player's third card ${third} → ${draws ? 'draws' : 'stands'}`, () => {
        expect(bankerDraws(banker, third)).toBe(draws);
      });
    }
  }

  it('matches the rule as written in the engine notes', () => {
    for (let b = 0; b <= 7; b++) {
      expect(bankerDraws(b, null)).toBe(b <= 5);
      for (let t = 0; t <= 9; t++) {
        const expected =
          b <= 2 ||
          (b === 3 && t !== 8) ||
          (b === 4 && t >= 2 && t <= 7) ||
          (b === 5 && t >= 4 && t <= 7) ||
          (b === 6 && (t === 6 || t === 7));
        expect(bankerDraws(b, t), `${b}/${t}`).toBe(expected);
      }
    }
  });

  it('an 8 or 9 always stands', () => {
    for (const b of [8, 9]) {
      expect(bankerDraws(b, null)).toBe(false);
      for (let t = 0; t <= 9; t++) expect(bankerDraws(b, t)).toBe(false);
    }
  });

  it('rejects impossible totals and third-card values', () => {
    expect(() => bankerDraws(10, null)).toThrow(RangeError);
    expect(() => bankerDraws(-1, 3)).toThrow(RangeError);
    expect(() => bankerDraws(3, 10)).toThrow(RangeError);
    expect(() => bankerDraws(3, 1.5)).toThrow(RangeError);
  });
});

describe('winner and payouts', () => {
  it('the total closer to 9 wins; equal totals tie', () => {
    expect(coupWinner(9, 8)).toBe('player');
    expect(coupWinner(0, 1)).toBe('banker');
    expect(coupWinner(6, 6)).toBe('tie');
    expect(coupWinner(0, 0)).toBe('tie');
  });

  it('pays Player 1:1, Banker 0.95:1 and Tie 8:1; P/B push on a tie; losses −1', () => {
    const table: Record<BetOn, Record<CoupWinner, number>> = {
      player: { player: 1, banker: -1, tie: 0 },
      banker: { player: -1, banker: 0.95, tie: 0 },
      tie: { player: -1, banker: -1, tie: 8 },
    };
    for (const bet of BETS) {
      for (const w of ['player', 'banker', 'tie'] as const) {
        expect(netUnits(bet, w), `${bet} on ${w}`).toBe(table[bet][w]);
      }
    }
    expect(PAYOUT.banker).toBeCloseTo(1 - BANKER_COMMISSION, 12);
    expect(MAX_LOSS_UNITS).toBe(1);
    expect(MAX_WIN_UNITS).toBe(8);
    expect(MAX_GAME_MOVES).toBe(7);
  });
});

describe('words', () => {
  it('names seats the way the UI expects', () => {
    expect(seatName(0)).toBe('You');
    expect(seatName(1)).toBe('Player 1');
    expect(verbFor(0, 'deal', 'deals')).toBe('deal');
    expect(verbFor(1, 'deal', 'deals')).toBe('deals');
  });

  it('small helpers', () => {
    expect(isBetOn('tie')).toBe(true);
    expect(isBetOn('dealer')).toBe(false);
    expect(otherHand('player')).toBe('banker');
    expect(otherHand('banker')).toBe('player');
    expect(outcomePhrase('player', 9, 7)).toBe('Player wins, 9 to 7');
    expect(outcomePhrase('banker', 2, 6)).toBe('Banker wins, 6 to 2');
    expect(outcomePhrase('tie', 6, 6)).toBe('it’s a tie at 6');
    expect(handPhrase('banker', ['4H', '5C'] as CardCode[])).toBe('Banker has a natural 9');
    expect(handPhrase('player', ['4H', '5C', 'KD'] as CardCode[])).toBe('Player has 9');
  });

  it('explains every Player decision', () => {
    expect(playerRuleWhy(3)).toBe('Player has 3, and Player always draws a third card on 0–5.');
    expect(playerRuleWhy(6)).toBe('Player has 6, and Player always stands on 6 or 7.');
  });

  it('explains every Banker decision, and the verdict always matches the tableau', () => {
    for (let b = 0; b <= 7; b++) {
      for (const t of [null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
        const why = bankerRuleWhy(b, t);
        const draws = bankerDraws(b, t);
        expect(why, `${b}/${t}`).toContain(draws ? 'so Banker draws' : 'so Banker stands');
        expect(why).toContain(`Banker has ${b}`);
        if (t !== null) expect(why).toMatch(new RegExp(`worth ${t}|always`));
        // "Player N" is reserved for seat names (the UI swaps it for a persona name).
        expect(why).not.toMatch(/Player \d/);
      }
    }
    expect(bankerRuleWhy(3, 8)).toBe(
      'Banker has 3, which draws unless Player’s third card was an 8. Player’s third card was worth 8, so Banker stands.',
    );
    expect(bankerRuleWhy(5, null)).toBe(
      'Player stood, and then Banker follows the same rule — draw on 0–5, stand on 6 or 7. Banker has 5, so Banker draws a third card.',
    );
  });
});
