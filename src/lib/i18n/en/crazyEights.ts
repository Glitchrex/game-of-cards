/**
 * Crazy Eights table chrome (src/games/crazy-eights/Board.tsx): zone labels, the stock and
 * discard pile, the suit chooser for Eights, seat counts and the action bar. Rules, coach
 * text and personas live with the game (engine + content file); only UI text is here.
 */
export const crazyEights = {
  felt: {
    wild: 'Eights are wild',
    match: 'Match the suit or the rank',
    /** Screen-reader version of the printed lines. */
    rules:
      'Table rules: match the top card’s suit or rank. Eights are wild and name the next suit.',
  },
  zone: {
    board: 'Crazy Eights board',
    you: 'Your hand: {cards}',
    youEmpty: 'Your hand: no cards left',
    table: 'The middle of the table',
    backs: '{name} holds {count}',
    revealed: '{name}’s cards: {cards}',
    revealedEmpty: '{name} has no cards left',
  },
  stock: {
    label: 'Draw a card from the stock, {count} left',
    empty: 'The stock is empty',
    caption: 'Draw',
    left: '{n} left',
    none: 'Empty',
  },
  discard: {
    label: 'Discard pile, {count}. Top card: {card}. {need}',
    needNormal: 'Next card: {suit} or {rank}, or a wild Eight.',
    needEight: 'The suit is now {suit}: play {singular} or another Eight.',
    match: 'Match',
    or: 'or',
    wild: 'wild',
    suitNow: 'Suit is now',
    /** Screen-reader prefix for the suit badge. */
    suitLabel: 'Suit to follow:',
  },
  count: {
    many: '{n} cards',
    two: '2 cards left!',
    last: 'Last card!',
    out: 'Out — winner!',
    points: '{n} pts',
    pointsLabel: '{name}: {n} points in hand',
  },
  you: {
    title: 'Your hand',
    lastCard: 'Last card! One more play and you win.',
    drew: 'Drew',
    drewLabel: 'You just drew the {card}',
    winner: 'You went out!',
  },
  chooser: {
    title: 'Name the next suit',
    lead: 'Your {card} is wild. Which suit must the next player follow?',
    hint: 'Name the suit you hold most, so you can keep playing.',
    pick: 'Pro pick',
    suggested: 'The coach’s pick',
    youHold: 'You hold {n}',
    youHoldOne: 'You hold 1',
    suitLabel: '{suit} ({held})',
    cancel: 'Back to my hand',
    keys: 'Keys: S, H, D or C · Esc to go back',
  },
  actions: {
    label: 'Your moves',
    pass: 'Pass',
    passHint: 'Only when stuck',
    draw: 'Draw a card',
    suggested: 'The coach’s pick',
    pick: 'Pro pick',
    unavailable: 'Not available right now — press it and the coach explains why.',
    wait: 'Wait — {name} is playing.',
    over: 'This game is over.',
    keys: 'Keyboard shortcuts',
    keyCards: 'pick a card',
    keyPlay: 'play it',
  },
  moveLabel: {
    play: 'Play the {card}',
    playEight: 'Play the {card} and name {suit}',
    draw: 'Draw a card',
    pass: 'Pass',
  },
  badge: {
    reshuffled: 'Reshuffled!',
  },
} as const;
