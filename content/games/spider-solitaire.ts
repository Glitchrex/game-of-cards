import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'spider-solitaire',
  name: 'Spider Solitaire',
  aka: ['Spider', 'Spider Patience'],
  origin: { country: 'Worldwide', countryCode: 'UN', region: 'global' },
  type: 'solitaire',
  players: { min: 1, max: 1, ideal: 1 },
  deck: 'Two standard 52-card decks (104 cards), no jokers; the beginner one-suit version uses eight full sets of Spades',
  difficulty: 3,
  length: '15–30 minutes a game',
  minutes: 20,
  moods: ['chill', 'brainy'],
  hook: 'Two decks, ten columns, eight perfect runs from King to Ace — untangle the web one card at a time',
  history:
    'Nobody knows exactly who invented Spider, but this two-deck patience has been a favourite in ' +
    'card-game books for many decades. Its name is often said to come from a spider’s eight legs — ' +
    'the eight finished King-to-Ace runs you need to win. Spider became a household name around ' +
    'the turn of the millennium, when Microsoft began including Spider Solitaire with Windows, ' +
    'complete with gentler one-suit and two-suit levels for beginners.',
  featured: false,
  order: 180,
  variantTaught:
    'One-suit Spider (often labelled Easy or Beginner): 104 cards, all Spades — eight full sets ' +
    'of Ace to King. Deal 54 cards into ten columns (the first four get 6 cards, the other six get ' +
    '5) with only the last card of each column face up; the other 50 cards make the stock. Build ' +
    'down one rank at a time (a 6 on a 7). Cards in order in the same suit form a run that moves ' +
    'as one, and you may also move just the lower part of a run. Any card or run may move into an ' +
    'empty column. A face-down card turns over as soon as it is uncovered. Whenever you like, deal ' +
    'ten cards from the stock — one face up on every column — but never while a column is empty. ' +
    'A complete run from King down to Ace in one suit leaves the table (most apps do this ' +
    'automatically). Remove all eight runs to win. The lesson ends by showing how the two-suit and ' +
    'four-suit versions change things.',
  variants:
    'Two-suit Spider (Medium) uses four sets each of Spades and Hearts, and four-suit Spider ' +
    '(Hard) — the classic game — uses two ordinary decks. With more than one suit you may still ' +
    'put any card on a card one rank higher, but only same-suit runs move together and only a ' +
    'same-suit King-to-Ace run leaves the table, so mixing suits can lock cards in place. ' +
    'Spiderette is a one-deck cousin dealt like Klondike. Apps differ on the small print: many let ' +
    'you undo, a few let you deal with an empty column, and Windows-style scoring starts at 500 ' +
    'points, takes away 1 for every move and adds 100 for every finished run.',
  glossary: [
    {
      term: 'column',
      definition:
        'One of the ten lines of cards on the table. You build on the last card of a column, for example a 6♠ on a 7♠.',
    },
    {
      term: 'face-down card',
      definition:
        'A hidden card in a column. It turns face up by itself as soon as every card on top of it has moved away.',
    },
    {
      term: 'stock',
      definition:
        'The face-down pile of 50 cards left after the deal. Each time you deal from it, one new card lands face up on every column — five deals in all.',
    },
    {
      term: 'rank',
      definition:
        'What a card is, ignoring its suit: Ace (lowest), 2, 3 … 10, Jack, Queen, King (highest). One rank higher than a 7 is an 8.',
    },
    {
      term: 'build',
      definition:
        'Putting a card on a card exactly one rank higher, like the 7♠ on the 8♠. A Queen goes on a King, a 2 on a 3.',
    },
    {
      term: 'run',
      definition:
        'Cards at the end of a column going down in order in the same suit, like 9♠ 8♠ 7♠. A run moves together, as one piece.',
    },
    {
      term: 'empty column',
      definition:
        'A column with no cards left. Any card or run can move into it — but you must fill it before you deal from the stock.',
    },
    {
      term: 'full run',
      definition:
        'All thirteen cards of one suit in order, from King down to Ace. It leaves the table at once — finish eight and you win.',
    },
    {
      term: 'foundation',
      definition:
        'Where finished King-to-Ace runs go when they leave the table. Eight full runs on the foundation means you have won.',
    },
    {
      term: 'suit',
      definition:
        'One of the four families of cards: Spades ♠, Hearts ♥, Diamonds ♦ and Clubs ♣. Beginner Spider uses only Spades.',
    },
  ],
  lesson: [
    {
      title: 'The goal: eight perfect runs',
      body:
        'Spider is a card game you play on your own, with two decks. Your goal is to build eight ' +
        '[[full runs|full run]]: King, Queen, Jack, 10 and all the way down to the Ace. Each time ' +
        'you finish one, it leaves the table for the [[foundation]]. Clear all eight and you win! ' +
        'In the beginner version you will learn here, every card is a Spade, so you never have to ' +
        'worry about [[suits|suit]].',
      scene: {
        zones: [
          {
            id: 'run',
            label: 'One full run: King down to Ace',
            cards: ['KS', 'QS', 'JS', 'TS', '9S', '8S', '7S', '6S', '5S', '4S', '3S', '2S', 'AS'],
            layout: 'row',
            highlight: [0, 12],
          },
          {
            id: 'home',
            label: 'Finished runs (3 of 8)',
            cards: ['KS', 'KS', 'KS'],
            layout: 'stack',
          },
        ],
        caption: 'Thirteen cards in order make one run. You need eight of them.',
        animate: 'deal',
      },
      tip: 'The ranks go Ace (lowest), 2 to 10, Jack, Queen, King (highest).',
    },
    {
      title: 'Setting up: ten columns and a stock',
      body:
        'Deal 54 cards into ten [[columns|column]]: the first four get 6 cards each and the other ' +
        'six get 5. Only the last card of each column is face up; the rest are ' +
        '[[face-down cards|face-down card]], which turn over by themselves once they are ' +
        'uncovered. The other 50 cards wait face down in the [[stock]].',
      scene: {
        zones: [
          {
            id: 'c1',
            label: 'Column 1 (6 cards)',
            cards: ['3S', 'JS', '7S', 'QS', '2S', '9S'],
            layout: 'cascade',
            faceDown: [0, 1, 2, 3, 4],
            highlight: [5],
          },
          {
            id: 'c5',
            label: 'Column 5 (5 cards)',
            cards: ['KS', '5S', 'AS', '8S', '4S'],
            layout: 'cascade',
            faceDown: [0, 1, 2, 3],
            highlight: [4],
          },
          {
            id: 'c10',
            label: 'Column 10 (5 cards)',
            cards: ['6S', 'TS', 'QS', '2S', '8S'],
            layout: 'cascade',
            faceDown: [0, 1, 2, 3],
            highlight: [4],
          },
          {
            id: 'stock',
            label: 'Stock (50 cards)',
            cards: ['KS', 'KS', 'KS'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
        ],
        caption: 'Three of the ten columns. Only the glowing last card of each is face up.',
        animate: 'deal',
      },
      tip: '4 × 6 + 6 × 5 = 54 cards on the table, plus 50 in the stock: 104 in all.',
    },
    {
      title: 'A move: build down one rank',
      body:
        'To [[build]], move the face-up card at the end of one [[column]] onto a card exactly one ' +
        '[[rank]] higher at the end of another: a 7 on an 8, a Queen on a King. Every move is your ' +
        'choice — there are no turns and no opponent.',
      scene: {
        zones: [
          {
            id: 'c3',
            label: 'Column 3',
            cards: ['4S', 'QS', '8S'],
            layout: 'cascade',
            faceDown: [0, 1],
            highlight: [2],
          },
          {
            id: 'c7',
            label: 'Column 7',
            cards: ['TS', '7S'],
            layout: 'cascade',
            faceDown: [0],
            highlight: [1],
          },
        ],
        caption: 'The 7♠ can go on the 8♠ — one rank lower.',
        animate: 'deal',
      },
      tip: 'Nothing goes on an Ace, and a King can only move into an empty column.',
    },
    {
      title: 'Runs move together',
      body:
        'Cards going down in order in the same suit make a [[run]], and a run moves as one piece. ' +
        'Here the 9♠ 8♠ 7♠ 6♠ can all jump onto the 10♠ in one move. You can also move just the ' +
        'lower part of a run — say the 7♠ 6♠ onto another 8♠.',
      scene: {
        zones: [
          {
            id: 'c2',
            label: 'Column 2: a four-card run',
            cards: ['KS', '9S', '8S', '7S', '6S'],
            layout: 'cascade',
            faceDown: [0],
            highlight: [1, 2, 3, 4],
          },
          {
            id: 'c6',
            label: 'Column 6',
            cards: ['2S', 'JS', 'TS'],
            layout: 'cascade',
            faceDown: [0, 1],
            highlight: [2],
          },
        ],
        caption: 'The whole run can move onto the 10♠ — and the hidden card under it will flip.',
        animate: 'deal',
      },
    },
    {
      title: 'Empty columns take anything',
      body:
        'Move every card out of a column and you have an [[empty column]]. Any card or any run can ' +
        'move into it. It is the most useful space in the game: park a card there to reach the ' +
        'hidden cards underneath it, or to re-order your runs.',
      scene: {
        zones: [
          {
            id: 'c8',
            label: 'Column 8 (was empty)',
            cards: ['5S', '4S', '3S'],
            layout: 'cascade',
            highlight: [0, 1, 2],
          },
          {
            id: 'c4',
            label: 'Column 4',
            cards: ['AS', 'JS', 'QS'],
            layout: 'cascade',
            faceDown: [0, 1],
            highlight: [2],
          },
        ],
        caption: 'The 5♠ 4♠ 3♠ moved into the empty column, and a Q♠ turned face up.',
        animate: 'deal',
      },
    },
    {
      title: 'Dealing from the stock',
      body:
        'Out of moves — or just want fresh cards? Deal from the [[stock]]: one card lands face up ' +
        'on the end of every [[column]], ten cards in all. That gives you five deals. One rule: ' +
        'you cannot deal while any column is empty, so fill it first.',
      scene: {
        zones: [
          {
            id: 'stock',
            label: 'Stock (4 deals left)',
            cards: ['KS', 'KS', 'KS'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
          {
            id: 'c1',
            label: 'Column 1',
            cards: ['3S', 'JS', 'TS', '4S'],
            layout: 'cascade',
            faceDown: [0],
            highlight: [3],
          },
          {
            id: 'c2',
            label: 'Column 2',
            cards: ['6S', 'KS', 'QS'],
            layout: 'cascade',
            faceDown: [0],
            highlight: [2],
          },
          {
            id: 'c3',
            label: 'Column 3',
            cards: ['9S', '8S', '7S', 'JS'],
            layout: 'cascade',
            faceDown: [0],
            highlight: [3],
          },
        ],
        caption:
          'A new card on every column. Sometimes it helps (the Q♠), sometimes it blocks (the J♠).',
        animate: 'deal',
      },
      tip: 'Before you deal, make every useful move — new cards land on top of everything.',
    },
    {
      title: 'Finish a run, and win',
      body:
        'When a column holds a [[full run]] — K♠ all the way down to A♠ — it leaves the table and ' +
        'goes to the [[foundation]]. That frees up lots of space at once. Finish all eight runs ' +
        'and you have won the game!',
      scene: {
        zones: [
          {
            id: 'c5',
            label: 'Column 5: a full run!',
            cards: ['KS', 'QS', 'JS', 'TS', '9S', '8S', '7S', '6S', '5S', '4S', '3S', '2S', 'AS'],
            layout: 'row',
            highlight: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          },
          {
            id: 'home',
            label: 'Finished runs (1 of 8)',
            cards: ['KS'],
            layout: 'stack',
          },
        ],
        caption: 'King to Ace: these 13 cards will leave the table together.',
        animate: 'deal',
      },
      tip: 'A run that starts with a King is the best kind: it never has to move onto another card, it just grows down to the Ace.',
    },
    {
      title: 'A tiny example',
      body:
        'Column 1 ends with the 7♠, and column 2 ends with a 6♠ sitting on one ' +
        '[[face-down card]]. [[Build|build]] the 6♠ onto the 7♠ — and the hidden card in column 2 ' +
        'flips over. It is a 5♠! It fits right on your 6♠, and now column 2 is an ' +
        '[[empty column]], ready for anything.',
      scene: {
        zones: [
          {
            id: 'c1',
            label: 'Column 1',
            cards: ['QS', '8S', '7S', '6S', '5S'],
            layout: 'cascade',
            faceDown: [0],
            highlight: [3, 4],
          },
          {
            id: 'c2',
            label: 'Column 2 (now empty)',
            cards: [],
            layout: 'stack',
          },
        ],
        caption: 'Two moves: a growing run in column 1 and a brand-new empty column.',
        animate: 'deal',
      },
    },
    {
      title: 'Beginner strategy',
      body:
        'Turning over [[face-down cards|face-down card]] is the heart of Spider — when you can ' +
        'choose, pick the move that flips one, starting with the tallest columns. Build long ' +
        '[[runs|run]] in order, try to clear a column, and make every useful move before you deal ' +
        'from the [[stock]]. When you fill an [[empty column]], a King or a long run is the ' +
        'perfect choice.',
      scene: {
        zones: [
          {
            id: 'c1',
            label: 'Column 1: five hidden cards',
            cards: ['2S', '9S', 'QS', '4S', 'JS', '7S'],
            layout: 'cascade',
            faceDown: [0, 1, 2, 3, 4],
            highlight: [5],
          },
          {
            id: 'c9',
            label: 'Column 9: a King-led run',
            cards: ['KS', 'QS', 'JS', 'TS'],
            layout: 'cascade',
            highlight: [0],
          },
        ],
        caption: 'Moving the 7♠ off column 1 would flip a hidden card — a great move.',
        animate: 'deal',
      },
      tip: 'Scan every column before you deal — a missed move is the most common slip.',
    },
    {
      title: 'Level up: two and four suits',
      body:
        'Ready for more? Two-suit Spider uses Spades and Hearts; four-suit Spider uses two ordinary ' +
        'decks. You may still put any card on one rank higher — the 7♥ on the 8♠ is fine. But only ' +
        'cards of the same [[suit]] form a [[run]] that moves together, and only a King-to-Ace run ' +
        'in ONE suit leaves the table. So whenever you can, build in the same suit.',
      scene: {
        zones: [
          {
            id: 'c4',
            label: 'Column 4 (two suits)',
            cards: ['5D', '8S', '7H', '6H'],
            layout: 'cascade',
            faceDown: [0],
            highlight: [2, 3],
          },
          {
            id: 'c6',
            label: 'Column 6',
            cards: ['3C', '8H'],
            layout: 'cascade',
            faceDown: [0],
            highlight: [1],
          },
        ],
        caption:
          'The 7♥ 6♥ move together, but the 8♠ can’t come with them. They would be happier on the 8♥.',
        animate: 'deal',
      },
      tip: 'In two- and four-suit Spider, a same-suit build is worth far more than a mixed one.',
    },
  ],
  mistakes: [
    'Dealing from the stock while there are still useful moves on the table.',
    'Trying to deal with an empty column — every column needs a card before you deal.',
    'Moving cards around without ever flipping a face-down card, so the board never opens up.',
    'Breaking up a good run just to make a move that achieves nothing.',
    'Filling an empty column with a lonely low card that blocks it for the rest of the game.',
    'In two- and four-suit Spider: building in mixed suits when a same-suit build was possible, then finding the run will not move.',
  ],
  tips: [
    'Tip: in Spider, when two moves look equal, pick the one that flips a face-down card.',
    'Tip: work on the tallest columns first — that is where most of the hidden cards are.',
    'Tip: make every useful move before you deal; new cards land on top of everything you have built.',
    'Tip: an empty column is your best tool — use it to reach hidden cards, then fill it before dealing.',
    'Tip: a run that starts with a King never has to move onto another card, so put a King (and its run) into an empty column whenever you can.',
    'Tip: right after a deal, look for new cards that landed on your runs and move them away first.',
    'Tip: once you beat one-suit Spider, try two suits — and always prefer same-suit builds.',
  ],
  quiz: [
    {
      question: 'In one-suit Spider, which card can you put on the 9♠?',
      options: ['The 10♠', 'The 8♠', 'The 7♠', 'Any Spade'],
      answer: 1,
      explanation:
        'You build down one rank at a time, so a 9 takes an 8. The 10♠ would have to go the other way: the 9♠ on top of it.',
    },
    {
      question: 'A column is empty and you want to deal from the stock. What must you do first?',
      options: [
        'Nothing — deal straight away',
        'Shuffle the stock',
        'Remove a finished run',
        'Move a card or run into the empty column',
      ],
      answer: 3,
      explanation:
        'You can’t deal while any column is empty, so fill it first — ideally with a move that flips a hidden card.',
    },
    {
      question: 'What happens when you complete a run from K♠ down to A♠?',
      options: [
        'It leaves the table — one of the eight runs you need',
        'You must break it up again',
        'It turns into the stock',
      ],
      answer: 0,
      explanation:
        'A full run leaves the table for the foundation. Finish eight of them and you have won.',
    },
    {
      question:
        'You can move a 6♠ onto a 7♠ from two columns. Under one is a face-down card; under the other is a card you can already see. Which 6♠ should you move?',
      options: [
        'The one with the visible card under it',
        'The one with the face-down card under it',
        'Neither — deal from the stock instead',
      ],
      answer: 1,
      explanation:
        'Flipping hidden cards is the heart of Spider. Moving that 6♠ turns over a new card and gives you new choices.',
    },
    {
      question:
        'In two-suit Spider, a column ends 8♠ 7♥ 6♥. Which cards can move together as a run?',
      options: ['All three cards', 'Only the 6♥', 'The 7♥ and the 6♥', 'None of them'],
      answer: 2,
      explanation:
        'A run must be in the same suit. The 7♥ 6♥ are both Hearts, so they move together; the 8♠ is a Spade, so it stays behind.',
    },
  ],
  example: {
    intro:
      'A one-suit game: every card is a Spade. We join after the first deal from the stock, show four of the ten columns, and let you make the key calls.',
    steps: [
      {
        narration:
          'The [[stock]] has 4 deals left. Two 6♠s could go on the 7♠ at the end of column 1. Under the 6♠ in column 2 are three [[face-down cards|face-down card]]; under the 6♠ in column 3 is the 10♠ you can already see.',
        scene: {
          zones: [
            {
              id: 'c1',
              label: 'Column 1',
              cards: ['5S', 'QS', '2S', 'JS', '7S'],
              layout: 'cascade',
              faceDown: [0, 1, 2, 3],
              highlight: [4],
            },
            {
              id: 'c2',
              label: 'Column 2',
              cards: ['9S', '3S', 'KS', '6S'],
              layout: 'cascade',
              faceDown: [0, 1, 2],
              highlight: [3],
            },
            {
              id: 'c3',
              label: 'Column 3',
              cards: ['AS', '8S', 'TS', '6S'],
              layout: 'cascade',
              faceDown: [0, 1],
              highlight: [3],
            },
            {
              id: 'c4',
              label: 'Column 4',
              cards: ['4S', 'QS', '9S', '8S'],
              layout: 'cascade',
              faceDown: [0, 1],
            },
          ],
          caption: 'One 7♠, two 6♠s that want it.',
          animate: 'deal',
        },
        decision: {
          prompt: 'Which 6♠ should go on the 7♠?',
          options: [
            {
              label: 'The 6♠ from column 3',
              card: '6S',
              correct: false,
              feedback:
                'Legal, but it only shows the 10♠ — a card you could already see. Nothing new is uncovered.',
            },
            {
              label: 'The 6♠ from column 2',
              card: '6S',
              correct: true,
              feedback:
                'Great choice! It is sitting on hidden cards, so moving it flips one over — a brand-new card to play with.',
            },
          ],
          proHint:
            'When two moves look the same, a pro always picks the one that turns over a face-down card.',
        },
      },
      {
        narration:
          'The 6♠ joins the 7♠, and the hidden card in column 2 flips over: a K♠! Now look at column 4 — its 9♠ 8♠ end in an 8♠, ready for a 7.',
        scene: {
          zones: [
            {
              id: 'c1',
              label: 'Column 1',
              cards: ['5S', 'QS', '2S', 'JS', '7S', '6S'],
              layout: 'cascade',
              faceDown: [0, 1, 2, 3],
              highlight: [4, 5],
            },
            {
              id: 'c2',
              label: 'Column 2',
              cards: ['9S', '3S', 'KS'],
              layout: 'cascade',
              faceDown: [0, 1],
              highlight: [2],
            },
            {
              id: 'c3',
              label: 'Column 3',
              cards: ['AS', '8S', 'TS', '6S'],
              layout: 'cascade',
              faceDown: [0, 1],
            },
            {
              id: 'c4',
              label: 'Column 4',
              cards: ['4S', 'QS', '9S', '8S'],
              layout: 'cascade',
              faceDown: [0, 1],
              highlight: [3],
            },
          ],
          caption: 'A K♠ turned up in column 2.',
          animate: 'none',
        },
        decision: {
          prompt: 'What can you move onto the 8♠ in column 4?',
          options: [
            {
              label: 'The 7♠ 6♠ from column 1, together',
              card: '7S',
              correct: true,
              feedback:
                'Yes! Cards in order in the same suit move together as a run. And there is a face-down card under the 7♠, waiting to flip.',
            },
            {
              label: 'The 6♠ from column 3',
              card: '6S',
              correct: false,
              feedback: 'A 6 needs a 7 to sit on — it can’t go on an 8.',
            },
            {
              label: 'Nothing — deal from the stock',
              correct: false,
              feedback:
                'Too soon! Always make your useful moves before dealing, because the new cards land on top of everything.',
            },
          ],
          proHint:
            'Pros make every move that flips a hidden card before they even think about the stock.',
        },
      },
      {
        narration:
          'The [[run]] 7♠ 6♠ slides onto the 8♠, and column 1 flips a J♠. Column 4 now holds a lovely 9-8-7-6 run. Nothing else fits anywhere, so it is time to deal from the [[stock]]: one new card face up on every [[column]].',
        scene: {
          zones: [
            {
              id: 'c1',
              label: 'Column 1',
              cards: ['5S', 'QS', '2S', 'JS'],
              layout: 'cascade',
              faceDown: [0, 1, 2],
              highlight: [3],
            },
            {
              id: 'c2',
              label: 'Column 2',
              cards: ['9S', '3S', 'KS'],
              layout: 'cascade',
              faceDown: [0, 1],
            },
            {
              id: 'c3',
              label: 'Column 3',
              cards: ['AS', '8S', 'TS', '6S'],
              layout: 'cascade',
              faceDown: [0, 1],
            },
            {
              id: 'c4',
              label: 'Column 4',
              cards: ['4S', 'QS', '9S', '8S', '7S', '6S'],
              layout: 'cascade',
              faceDown: [0, 1],
              highlight: [2, 3, 4, 5],
            },
          ],
          caption: 'Two hidden cards flipped in two moves. Now: deal!',
          animate: 'none',
        },
      },
      {
        narration:
          'Ten new cards, one per column (we are showing four). Some luck: a 10♠ lands on your J♠ and a Q♠ on your K♠. But a 9♠ lands right on top of your 9-8-7-6 run in column 4. The stock has 3 deals left.',
        scene: {
          zones: [
            {
              id: 'c1',
              label: 'Column 1',
              cards: ['5S', 'QS', '2S', 'JS', 'TS'],
              layout: 'cascade',
              faceDown: [0, 1, 2],
              highlight: [4],
            },
            {
              id: 'c2',
              label: 'Column 2',
              cards: ['9S', '3S', 'KS', 'QS'],
              layout: 'cascade',
              faceDown: [0, 1],
              highlight: [3],
            },
            {
              id: 'c3',
              label: 'Column 3',
              cards: ['AS', '8S', 'TS', '6S', '5S'],
              layout: 'cascade',
              faceDown: [0, 1],
              highlight: [4],
            },
            {
              id: 'c4',
              label: 'Column 4',
              cards: ['4S', 'QS', '9S', '8S', '7S', '6S', '9S'],
              layout: 'cascade',
              faceDown: [0, 1],
              highlight: [6],
            },
          ],
          caption: 'The new cards glow. One of them is in the way.',
          animate: 'deal',
        },
        decision: {
          prompt: 'What do you do with the stray 9♠ in column 4?',
          options: [
            {
              label: 'Leave it where it is',
              correct: false,
              feedback:
                'Your 9-8-7-6 run is now trapped under it and can’t move anywhere. Get the stray card off it.',
            },
            {
              label: 'Move it onto the Q♠ in column 2',
              card: '9S',
              correct: false,
              feedback: 'A card goes only on one rank higher, so a 9 needs a 10 — not a Queen.',
            },
            {
              label: 'Move it onto the 10♠ in column 1',
              card: '9S',
              correct: true,
              feedback:
                'Perfect: it unblocks your run in column 4 and makes column 1 read J♠ 10♠ 9♠. Two wins in one move.',
            },
          ],
          proHint: 'Pros clear stray cards off their best runs straight after every deal.',
        },
      },
      {
        narration:
          'The 9♠ moves onto the 10♠ — and then the whole J♠ 10♠ 9♠ [[run]] hops onto the Q♠ in column 2. Column 2 now runs from the K♠ down to the 9♠, and column 1 flips a 2♠.',
        scene: {
          zones: [
            {
              id: 'c1',
              label: 'Column 1',
              cards: ['5S', 'QS', '2S'],
              layout: 'cascade',
              faceDown: [0, 1],
              highlight: [2],
            },
            {
              id: 'c2',
              label: 'Column 2',
              cards: ['9S', '3S', 'KS', 'QS', 'JS', 'TS', '9S'],
              layout: 'cascade',
              faceDown: [0, 1],
              highlight: [2, 3, 4, 5, 6],
            },
            {
              id: 'c3',
              label: 'Column 3',
              cards: ['AS', '8S', 'TS', '6S', '5S'],
              layout: 'cascade',
              faceDown: [0, 1],
            },
            {
              id: 'c4',
              label: 'Column 4',
              cards: ['4S', 'QS', '9S', '8S', '7S', '6S'],
              layout: 'cascade',
              faceDown: [0, 1],
              highlight: [2, 3, 4, 5],
            },
          ],
          caption: 'K♠ Q♠ J♠ 10♠ 9♠ — column 2 is turning into something special.',
          animate: 'none',
        },
      },
      {
        narration:
          'Let’s skip ahead a few moves and one more deal (2 deals left). You slid the 8♠ 7♠ 6♠ from column 4 onto the 9♠ in column 2, which now runs from the K♠ all the way down to the 6♠. Column 4 ends with a 5♠ 4♠ 3♠ 2♠ A♠ run. And column 3 is an [[empty column]].',
        scene: {
          zones: [
            {
              id: 'c2',
              label: 'Column 2',
              cards: ['9S', '3S', 'KS', 'QS', 'JS', 'TS', '9S', '8S', '7S', '6S'],
              layout: 'cascade',
              faceDown: [0, 1],
              highlight: [9],
            },
            {
              id: 'c3',
              label: 'Column 3 (empty)',
              cards: [],
              layout: 'stack',
            },
            {
              id: 'c4',
              label: 'Column 4',
              cards: ['4S', 'QS', '9S', '5S', '4S', '3S', '2S', 'AS'],
              layout: 'cascade',
              faceDown: [0, 1],
              highlight: [3, 4, 5, 6, 7],
            },
          ],
          caption: 'K♠ down to 6♠ in one column, 5♠ down to A♠ in another…',
          animate: 'deal',
        },
        decision: {
          prompt: 'How do you finish the job?',
          options: [
            {
              label: 'Move just the A♠ into the empty column',
              card: 'AS',
              correct: false,
              feedback:
                'That breaks your run apart for nothing. Move all five cards onto the 6♠ instead.',
            },
            {
              label: 'Move the 5♠–A♠ run onto the 6♠',
              card: '5S',
              correct: true,
              feedback:
                'Yes! That completes K♠ all the way down to A♠ — a full run of thirteen cards.',
            },
            {
              label: 'Deal from the stock',
              correct: false,
              feedback:
                'Not allowed while column 3 is empty — and you would bury a winning move under new cards!',
            },
          ],
          proHint:
            'Pros always look for the move that completes a King-to-Ace run — it clears 13 cards at once.',
        },
      },
      {
        narration:
          'Thirteen Spades in order — the [[full run]] leaves the table for the [[foundation]]! Column 2 flips a 3♠. You still have 2 deals in the stock, but column 3 is empty, and you can’t deal while any column is empty.',
        scene: {
          zones: [
            {
              id: 'home',
              label: 'Finished runs (1 of 8)',
              cards: ['KS'],
              layout: 'stack',
              highlight: [0],
            },
            {
              id: 'c2',
              label: 'Column 2',
              cards: ['9S', '3S'],
              layout: 'cascade',
              faceDown: [0],
              highlight: [1],
            },
            {
              id: 'c3',
              label: 'Column 3 (empty)',
              cards: [],
              layout: 'stack',
            },
            {
              id: 'c4',
              label: 'Column 4',
              cards: ['4S', 'QS', '9S'],
              layout: 'cascade',
              faceDown: [0, 1],
              highlight: [2],
            },
          ],
          caption: 'One run home! Seven to go.',
          animate: 'none',
        },
        decision: {
          prompt: 'Column 3 is empty and you want more cards. What now?',
          options: [
            {
              label: 'Deal from the stock right away',
              correct: false,
              feedback: 'Not allowed: every column needs at least one card before you deal.',
            },
            {
              label: 'Move the 9♠ from column 4 into it',
              card: '9S',
              correct: true,
              feedback:
                'Smart! Filling the empty column also flips the hidden card under the 9♠ — two good things in one move. Now you may deal.',
            },
            {
              label: 'Leave it empty for good',
              correct: false,
              feedback:
                'Then you could never deal again! An empty column is a tool — use it, then deal.',
            },
          ],
          proHint:
            'Before dealing, pros fill an empty column with a card whose move flips a hidden card.',
        },
      },
      {
        narration:
          'The 9♠ fills the gap and column 4 flips a Q♠. Every [[column]] has a card again, so the [[stock]] is ready to deal. One run down, seven to go — keep flipping hidden cards and building in order, and the web untangles.',
        scene: {
          zones: [
            {
              id: 'c2',
              label: 'Column 2',
              cards: ['9S', '3S'],
              layout: 'cascade',
              faceDown: [0],
            },
            {
              id: 'c3',
              label: 'Column 3',
              cards: ['9S'],
              layout: 'cascade',
              highlight: [0],
            },
            {
              id: 'c4',
              label: 'Column 4',
              cards: ['4S', 'QS'],
              layout: 'cascade',
              faceDown: [0],
              highlight: [1],
            },
            {
              id: 'stock',
              label: 'Stock (2 deals left)',
              cards: ['KS', 'KS'],
              layout: 'stack',
              faceDown: [0, 1],
            },
          ],
          caption: 'No empty columns, a fresh Q♠ — deal away!',
          animate: 'none',
        },
      },
    ],
    outro:
      'You flipped hidden cards whenever you could, moved runs as one piece, cleaned up after a deal, finished your first King-to-Ace run and filled an empty column before dealing. Do that eight times and you have beaten Spider! Ready to test yourself? Try the quiz!',
  },
  seo: {
    description:
      'Learn Spider Solitaire step by step, starting with easy one-suit Spider: build runs from King to Ace, use empty columns, then level up to two and four suits.',
  },
});
