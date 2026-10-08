/**
 * Baccarat table chrome (src/games/baccarat/Board.tsx): hand zones, totals, the drawing-rule
 * caption, banners and the three betting spots. Game rules, the move log and the coach's
 * words come from the engine; the croupier persona lives with the game.
 */
export const baccarat = {
  felt: {
    title: 'Punto Banco',
    rules: 'Closest to 9 wins',
    /** Screen-reader version of the printed felt. */
    rulesSr:
      'Table rules: the hand closer to 9 wins. Tens and picture cards count 0, Aces count 1, and only the last digit of a total counts.',
  },
  seat: {
    dealing: 'Dealing',
  },
  shoe: {
    caption: '{n}-deck shoe',
  },
  zone: {
    player: 'Player hand: {cards}',
    banker: 'Banker hand: {cards}',
    playerEmpty: 'Player hand: no cards yet',
    bankerEmpty: 'Banker hand: no cards yet',
    third: 'third card',
    /** Screen-reader prefixes for the total pills. */
    playerTotal: 'Player total:',
    bankerTotal: 'Banker total:',
    /** "7 + 6 = 13 → 3": how the total was worked out. */
    math: 'Worked out:',
    mathSr: '{expr} makes {n}.',
    mathDrop: '{expr} makes {sum}; only the last digit counts, so {n}.',
  },
  hand: {
    player: 'Player',
    banker: 'Banker',
    natural: 'Natural {n}',
    wins: 'Wins',
  },
  rule: {
    label: 'Drawing rule',
    values: 'Aces count 1; tens and picture cards count 0; only the last digit of a total counts.',
    waiting: 'Place a bet and the dealer deals: Player, Banker, Player, Banker.',
    opening: 'Two cards each, one at a time: Player, Banker, Player, Banker.',
    natural: '{hand} has a natural {n} → nobody draws.',
    naturalBoth: 'Both hands have a natural → nobody draws.',
    playerDraws: 'Player has {n} → draws a third card (0–5 draws).',
    playerStands: 'Player has {n} → stands (6 or 7 stands).',
    bankerAfterStand: 'Player stood. Banker has {n} → {verdict} (draws on 0–5).',
    bankerTable: 'Banker has {n}, Player’s third card is worth {v} → {verdict}.',
    draws: 'Banker draws',
    stands: 'Banker stands',
    done: 'No more cards: {outcome}.',
    playerWins: 'Player wins {p} to {b}',
    bankerWins: 'Banker wins {b} to {p}',
    tie: 'a tie at {n}',
  },
  banner: {
    natural: 'Natural!',
    tie: 'Tie!',
    playerWins: 'Player wins',
    bankerWins: 'Banker wins',
    tieWins: 'Tie at {n}',
    /** Shown after "Tie!" on the banner. */
    tieScore: 'Both on {n}',
    score: '{w} – {l}',
    scoreSr: '{title}, {w} to {l}',
    /** Screen-reader version of the result banner. */
    label: 'Result: {text}.',
  },
  spots: {
    label: 'Betting spots',
    prompt: 'Place your bet',
    promptHint: 'Pick the hand you think will finish closer to 9 — or bet on a tie.',
    locked: 'Bets are locked — {name} is dealing.',
    over: 'The coup is over.',
    player: 'Player',
    banker: 'Banker',
    tie: 'Tie',
    pays: 'pays {words}',
    winsOften: 'wins {pct}',
    /** Accessible name of each spot. */
    aria: 'Bet on {name} — pays {words}',
    yourBet: 'Your bet is on this spot.',
    suggested: 'The coach’s pick',
    pick: 'Pro pick',
    wait: 'Bets are locked — {name} is dealing the cards.',
    keys: 'Keyboard shortcuts',
  },
  moves: {
    bet: 'Bet on {name}',
    deal: 'Deal a card',
  },
  outcome: {
    win: 'Win',
    push: 'Push',
    loss: 'Lose',
    /** Screen-reader prefix for the stamp on your spot. */
    label: 'Your bet:',
  },
} as const;
