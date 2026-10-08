/**
 * Blackjack table chrome (src/games/blackjack/Board.tsx): zone labels, totals, badges,
 * the action bar and the rules printed on the felt. Game rules and the dealer persona
 * live with the game (engine + content file); only UI text is here.
 */
export const blackjack = {
  felt: {
    pays: 'Blackjack pays 3 to 2',
    stands: 'Dealer stands on all 17s',
    /** Screen-reader version of the two printed lines. */
    rules: 'Table rules: the dealer stands on all 17s, and Blackjack pays 3 to 2.',
  },
  shoe: {
    caption: '{n}-deck shoe',
  },
  zone: {
    dealer: 'Dealer’s hand: {cards}',
    dealerEmpty: 'Dealer’s hand: no cards yet',
    you: 'Your hand: {cards}',
    first: 'Your first hand: {cards}',
    second: 'Your second hand: {cards}',
    faceDown: 'a face-down card',
    hands: 'Your hands',
  },
  total: {
    soft: 'Soft {n}',
    hard: 'Hard {n}',
    plain: '{n}',
    shows: 'Shows {total}',
    showsAce: 'Shows an Ace',
    /** Screen-reader prefixes for the total pills. */
    label: 'Your total:',
    dealerLabel: 'Dealer total:',
  },
  badge: {
    bust: 'Bust',
    blackjack: 'Blackjack',
  },
  outcome: {
    win: 'Win',
    blackjack: 'Win 3:2',
    push: 'Push',
    loss: 'Lose',
    /** Screen-reader prefix for the WIN / PUSH / LOSE stamp. */
    label: 'Result:',
  },
  hand: {
    first: 'Hand 1',
    second: 'Hand 2',
    playing: 'Playing',
    next: 'Up next',
    done: 'Done',
    betOne: '1 bet riding',
    betMany: '{n} bets riding (doubled)',
  },
  actions: {
    label: 'Your moves',
    hit: 'Hit',
    stand: 'Stand',
    double: 'Double',
    split: 'Split',
    reveal: 'Turn over the hole card',
    dealerHit: 'Dealer draws',
    dealerStand: 'Dealer stands',
    hitHint: 'Take a card',
    standHint: 'Stop here',
    doubleHint: 'Bet ×2',
    splitHint: 'Pairs only',
    suggested: 'The coach’s pick',
    pick: 'Pro pick',
    unavailable: 'Not available right now — press it and the coach explains why.',
    wait: 'Wait — {name} is playing.',
    over: 'This round is over.',
    keys: 'Keyboard shortcuts',
  },
} as const;
