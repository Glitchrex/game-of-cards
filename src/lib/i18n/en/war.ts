/**
 * War table chrome (src/games/war/Board.tsx): zone labels, the battle area, the battle
 * counter, the card-count bar and the Flip / Auto-flip buttons. Game rules and the
 * opponent's persona live with the game (engine, content file, personas.ts).
 */
export const war = {
  zone: {
    yourPile: 'Your pile',
    botPile: '{name}’s pile',
    battle: 'Battle area',
    yourCards: 'Your cards in this battle: {cards}',
    botCards: '{name}’s cards in this battle: {cards}',
    noCards: 'Your cards in this battle: none yet',
    noBotCards: '{name}’s cards in this battle: none yet',
    faceDownOne: '1 face-down card',
    faceDownMany: '{n} face-down cards',
  },
  lane: {
    you: 'You',
    wins: 'Wins!',
    gain: '+{n}',
    gainLabel: '{n} cards won',
  },
  ready: {
    title: 'Ready for battle',
    hint: 'Press Flip: you both turn over your top card, and the higher card wins both.',
  },
  banner: {
    war: 'War!',
    double: 'Double war!',
    many: '{n} wars in a row!',
    /** Screen-reader text for the banner stamp. */
    label: 'This battle went to war.',
  },
  outcome: {
    higher: 'Higher card wins!',
    warYou: 'You win the war!',
    warBot: '{name} wins the war!',
    outYou: '{name} ran out of cards!',
    outBot: 'You ran out of cards!',
    bothOut: 'Nobody can carry on',
    takeYou: 'You take {cards}.',
    takeBot: '{name} takes {cards}.',
    both: 'both cards',
    all: 'all {n} cards',
    back: 'You each take your own cards back.',
    battle: 'Battle {n}',
  },
  counter: {
    battle: 'Battle {n} of {max}',
    none: 'No battles yet: {max} to play',
    left: '{n} left',
    leftOne: 'Last battle next!',
    over: 'Game over after {n}',
    battles: '{n} battles',
    battleOne: '1 battle',
  },
  bar: {
    label: 'Who holds more cards',
    value: 'You have {you} cards and {name} has {bot}.',
    you: 'You {n}',
    bot: '{name} {n}',
  },
  actions: {
    label: 'Your moves',
    flip: 'Flip',
    flipHint: 'Turn over your top card',
    auto: 'Auto ×10',
    autoHint: 'Flips 10 battles for you',
    stop: 'Stop',
    stopHint: 'Stop auto-flipping',
    suggested: 'The coach’s pick',
    pick: 'Pro pick',
    wait: 'Wait — it’s not time to flip yet.',
    over: 'This game is over.',
    keys: 'Keyboard shortcuts',
    keySpace: 'Space',
    autoKey: 'Auto-flip',
  },
} as const;
