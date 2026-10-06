/**
 * Go Fish table chrome (src/games/go-fish/Board.tsx): zone labels, the seats you can ask,
 * the pond, the books, your hand grouped by rank and the Ask bar. Rules, coach text and
 * the bot personas live with the game (engine + content file + personas.ts); only UI text
 * is here.
 */
export const goFish = {
  felt: {
    rule: 'Collect all four of a rank',
    /** Screen-reader version of the printed line. */
    rules:
      'Table rules: ask a player for a rank you hold. Four of a kind makes a book; the most books wins.',
  },
  zone: {
    seats: 'Players you can ask',
    backs: '{name} holds {count}',
    out: '{name} has no cards left',
    hand: 'Your hand, grouped by rank — pick a rank to ask for',
    handEmpty: 'Your hand is empty',
    group: '{rank}: {cards}',
    books: '{name}’s books: {ranks}',
    booksNone: '{name} has no books yet',
    yourBooks: 'Your books: {ranks}',
    yourBooksNone: 'You have no books yet',
    pond: 'The pond: {count} face down',
    pondEmpty: 'The pond is empty',
  },
  seat: {
    out: 'Out of cards',
    books: '{n} books',
    booksOne: '1 book',
    booksNone: 'No books',
    winner: 'Winner',
    picked: 'Asking',
    ask: 'Ask {name}',
    unavailable: '{name} has no cards left — press anyway and the coach explains why.',
  },
  pond: {
    caption: 'The pond',
    left: '{n} left',
    empty: 'Empty',
  },
  splash: {
    fish: 'Go Fish!',
    wish: 'Fished a wish!',
    catch: 'Catch! +{n}',
    dry: 'Go Fish! The pond is dry',
  },
  last: {
    asked: '{asker} asked {target} for {rank}',
    caught: '{target} handed over {n}.',
    fish: 'Go Fish!',
    wish: 'Go Fish — and the pond gave {who} one!',
    dry: 'Go Fish — but the pond is empty.',
  },
  ask: {
    button: 'Ask {name} for {rank}',
    pickBoth: 'Pick a player and a rank',
    pickRank: 'Now pick a rank from your hand',
    pickPlayer: 'Now pick a player to ask',
    incomplete: 'Not ready yet — press it anyway and the coach explains why.',
    wait: 'Wait — it’s {name}’s turn.',
    over: 'The game is over.',
    suggested: 'The coach’s pick',
    pick: 'Pro pick',
    usePick: 'Use the coach’s pick',
    rankPicked: '{rank} picked.',
    targetPicked: '{name} picked.',
    ready: 'Ready: ask {name} for {rank}.',
    keys: 'Keys',
    keyRanks: 'A, 2–9, T, J, Q, K pick a rank',
    keyArrows: '← → move',
    keyEnter: 'Enter picks or asks',
  },
  you: {
    name: 'You',
    /** Object form, as in “Kanta Kaka asked you for Sevens”. */
    object: 'you',
    zone: 'Your seat',
    turn: 'Your turn — ask someone!',
    again: 'Go again!',
    waiting: '{name}’s turn',
    over: 'Game over',
    noBooks: 'Collect all four of a rank to make a book',
    new: 'New',
    count: '×{n}',
  },
} as const;
