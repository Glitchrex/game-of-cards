import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'klondike',
  name: 'Klondike Solitaire',
  aka: ['Solitaire', 'Patience', 'Klondike Patience'],
  origin: { country: 'Worldwide', countryCode: 'UN', region: 'global' },
  type: 'solitaire',
  players: { min: 1, max: 1, ideal: 1 },
  deck: 'One standard 52-card deck, no jokers',
  difficulty: 2,
  length: '10–15 minutes a game',
  minutes: 12,
  moods: ['chill', 'brainy'],
  hook: 'The classic one-player card game: uncover every hidden card and send all 52 home',
  history:
    'Klondike is named after the Klondike region of Canada’s Yukon, famous for its gold rush in ' +
    'the late 1890s — though nobody is quite sure where or when the game itself began. One-player ' +
    'card games, called “patience” in Britain, were already popular in Europe in the 1800s. ' +
    'Klondike became world-famous when Microsoft shipped a version simply called Solitaire with ' +
    'Windows from 1990, and it is often said to be one of the most-played computer games ever. ' +
    '“Vegas” scoring is said to come from casinos that let players buy a deck and paid out for ' +
    'every card that reached the foundations.',
  featured: true,
  order: 100,
  variantTaught:
    'Klondike Draw-1: seven columns of 1 to 7 cards with only the top card of each face up, and a ' +
    '24-card stock turned over one card at a time onto the waste, with unlimited passes through ' +
    'the stock. Build the tableau down in alternating colours (a whole run can move together); ' +
    'only a King, or a run that starts with a King, may fill an empty column; build the ' +
    'foundations up by suit from Ace to King, one card at a time; foundation cards may come back ' +
    'down to the tableau; a face-down card turns over by itself once it is uncovered. You can stop ' +
    'at any time with “I’m done”. When you play for Jeet we use Vegas-style scoring: every card ' +
    'that reaches a foundation pays back 5/52 of your stake, so 11 cards puts you ahead (and ' +
    'counts as a win) and clearing all 52 pays back five times your stake.',
  variants:
    'Draw-3 Klondike turns over three cards at a time and only the top one can be played — it is ' +
    'harder, and many apps use it as the classic setting. Casino-style Vegas rules usually allow ' +
    'just one pass through the stock with Draw-1 (or three passes with Draw-3); we allow unlimited ' +
    'passes so a beginner is never cut off. Lots of apps score “standard” points instead (for ' +
    'example 10 points per foundation card, with a timer bonus) and let you undo moves. ' +
    '“Thoughtful” solitaire deals every card face up so you can plan the whole game. FreeCell and ' +
    'Spider Solitaire are popular cousins with different layouts.',
  glossary: [
    {
      term: 'tableau',
      definition:
        'The seven columns of cards in the middle of the table. It is where you build and rearrange cards, for example by putting a red 7 on a black 8.',
    },
    {
      term: 'foundation',
      definition:
        'One of four piles, one per suit, built up from Ace to King. Get all 52 cards onto the foundations and you have won.',
    },
    {
      term: 'stock',
      definition:
        'The face-down pile of cards left over after the deal (24 cards). You turn them over one at a time onto the waste.',
    },
    {
      term: 'waste',
      definition:
        'The face-up pile next to the stock where drawn cards land. Only its top card can be played.',
    },
    {
      term: 'face-down card',
      definition:
        'A hidden card in a column. It turns face up by itself as soon as every card on top of it has been moved away.',
    },
    {
      term: 'alternating colours',
      definition:
        'Red and black taking turns down a column: black 8, red 7, black 6. Hearts and Diamonds are red; Spades and Clubs are black.',
    },
    {
      term: 'run',
      definition:
        'A group of face-up cards in a column going down one rank at a time in alternating colours, like 9♠ 8♥ 7♣. You can move a whole run — or its lower part — together.',
    },
    {
      term: 'empty column',
      definition:
        'A column with no cards left at all. Only a King, or a run that starts with a King, may move into it.',
    },
    {
      term: 'Draw-1',
      definition:
        'The version where you turn over one card from the stock at a time. It is the easiest way to play Klondike.',
    },
    {
      term: 'recycle',
      definition:
        'Turning the whole waste pile back over to make a new stock once the stock is empty. In our Draw-1 game you may do this as many times as you like.',
    },
    {
      term: 'Vegas scoring',
      definition:
        'A way to score for pretend money: you put in a stake and every card that reaches a foundation pays back 5/52 of it. 11 cards home puts you ahead.',
    },
    {
      term: 'I’m done',
      definition:
        'The button that ends the game when you are stuck (or happy). You keep the value of every card already on the foundations.',
    },
  ],
  lesson: [
    {
      title: 'The goal: send every card home',
      body:
        'Klondike is the classic card game you play on your own. Your goal is to move all 52 cards ' +
        'onto four [[foundation]] piles — one for each suit. Each foundation starts with the Ace ' +
        'and climbs one card at a time, all the way up to the King. Get every card home and you win!',
      scene: {
        zones: [
          {
            id: 'one',
            label: 'One foundation: Ace upwards, one suit',
            cards: ['AH', '2H', '3H', '4H', '5H'],
            layout: 'row',
            highlight: [0],
          },
          {
            id: 'done',
            label: 'A finished game: four Kings on top',
            cards: ['KS', 'KH', 'KD', 'KC'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
        ],
        caption: 'Ace, 2, 3 … all the way to the King — in each of the four suits.',
        animate: 'deal',
      },
      tip: 'The ranks go Ace (lowest), 2 to 10, Jack, Queen, King (highest).',
    },
    {
      title: 'Setting up: tableau, stock and waste',
      body:
        'Deal seven columns — together they are the [[tableau]]. The first column gets 1 card, the ' +
        'second 2, and so on up to 7. Only the top card of each column is face up; the rest are ' +
        '[[face-down cards|face-down card]]. The other 24 cards go face down in the [[stock]]. ' +
        'Cards you draw land face up next to it, on the [[waste]].',
      scene: {
        zones: [
          { id: 'c1', label: 'Column 1', cards: ['KD'], layout: 'cascade', highlight: [0] },
          {
            id: 'c2',
            label: 'Column 2',
            cards: ['5S', '9H'],
            layout: 'cascade',
            faceDown: [0],
            highlight: [1],
          },
          {
            id: 'c3',
            label: 'Column 3',
            cards: ['2C', 'JD', '6C'],
            layout: 'cascade',
            faceDown: [0, 1],
            highlight: [2],
          },
          {
            id: 'stock',
            label: 'Stock (24 cards)',
            cards: ['QH', '4S', '8D'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
        ],
        caption: 'The first three of the seven columns, and the stock waiting to be drawn.',
        animate: 'deal',
      },
      tip: 'A full deal has 28 cards in the tableau (only 7 face up) and 24 in the stock.',
    },
    {
      title: 'Your turn: move a card or draw',
      body:
        'On your turn, make any move the rules allow — or draw. To draw, turn the top card of the ' +
        'stock face up onto the waste. This is [[Draw-1]]: one card at a time. Only the top card ' +
        'of the waste can be played. When the stock runs out, [[recycle]]: turn the waste over to ' +
        'make a new stock and go round again, as often as you like.',
      scene: {
        zones: [
          {
            id: 'stock',
            label: 'Stock',
            cards: ['3D', 'TC'],
            layout: 'stack',
            faceDown: [0, 1],
          },
          {
            id: 'waste',
            label: 'Waste',
            cards: ['8C', '4H', 'QS'],
            layout: 'stack',
            highlight: [2],
          },
        ],
        caption: 'Only the top waste card — the Q♠ — can be played right now.',
        animate: 'flip',
      },
    },
    {
      title: 'Build down in alternating colours',
      body:
        'In the tableau you build down: a card goes on a card one rank higher in the opposite ' +
        'colour. A red 7 goes on a black 8; a black 6 goes on a red 7 — we call that ' +
        '[[alternating colours]]. Cards built like this make a [[run]], and you can move a whole ' +
        'run, or its lower part, to another column in one go.',
      scene: {
        zones: [
          {
            id: 'col',
            label: 'Column 4: a run',
            cards: ['TD', '9S', '8H', '7C'],
            layout: 'cascade',
            highlight: [1, 2, 3],
          },
          { id: 'waste', label: 'Waste', cards: ['6D'], layout: 'stack', highlight: [0] },
        ],
        caption: 'Red, black, red, black… the 6♦ from the waste can go on the 7♣ next.',
        animate: 'deal',
      },
      tip: 'The colour must change every time: a red 7 can never go on a red 8.',
    },
    {
      title: 'Uncover the face-down cards',
      body:
        'When you move the last face-up card off a column, the [[face-down card]] underneath turns ' +
        'over by itself. Uncovering these hidden cards is the heart of Klondike: every new card ' +
        'gives you new moves.',
      scene: {
        zones: [
          {
            id: 'c4',
            label: 'Column 4',
            cards: ['4C', 'JH'],
            layout: 'cascade',
            faceDown: [0],
            highlight: [1],
          },
          {
            id: 'c6',
            label: 'Column 6',
            cards: ['QS', '8S', '7H'],
            layout: 'cascade',
            faceDown: [0],
            highlight: [2],
          },
        ],
        caption: 'The 7♥ moved onto the 8♠, so the J♥ underneath turned face up.',
        animate: 'flip',
      },
      tip: 'Start with the tallest columns — that is where most of the hidden cards are.',
    },
    {
      title: 'Empty columns take only Kings',
      body:
        'If you clear a column completely, it becomes an [[empty column]]. Only a King — or a run ' +
        'that starts with a King — may move into it. So only empty a column when a King is ready ' +
        'to take the space.',
      scene: {
        zones: [
          {
            id: 'new',
            label: 'Column 3: was empty, now starts with a King',
            cards: ['KH', 'QC', 'JD'],
            layout: 'cascade',
            highlight: [0],
          },
          {
            id: 'c5',
            label: 'Column 5: this King could move too',
            cards: ['5D', '2S', 'KS'],
            layout: 'cascade',
            faceDown: [0, 1],
            highlight: [2],
          },
        ],
        caption: 'A King (with its run) can start a new column. A Queen or lower cannot.',
        animate: 'deal',
      },
    },
    {
      title: 'Foundations: up by suit from the Ace',
      body:
        'As soon as an Ace is free, put it on a [[foundation]]. Then build each foundation up in ' +
        'its own suit: Ace, 2, 3 and so on to the King. Only one card at a time can go up. If you ' +
        'ever need to, you may bring the top foundation card back down onto the tableau.',
      scene: {
        zones: [
          {
            id: 'hearts',
            label: 'Hearts foundation',
            cards: ['AH', '2H', '3H'],
            layout: 'stack',
          },
          { id: 'clubs', label: 'Clubs foundation', cards: ['AC'], layout: 'stack' },
          { id: 'waste', label: 'Waste', cards: ['4H'], layout: 'stack', highlight: [0] },
          {
            id: 'c6',
            label: 'Column 6',
            cards: ['8D', '2C'],
            layout: 'cascade',
            faceDown: [0],
            highlight: [1],
          },
        ],
        caption: 'The 4♥ can go on the 3♥, and the 2♣ can go on the A♣.',
        animate: 'deal',
      },
      tip: 'Aces and 2s should always go up straight away — nothing in the tableau needs them.',
    },
    {
      title: 'Winning and Vegas scoring',
      body:
        'Getting all 52 cards home is the perfect finish. When you play for Jeet we use ' +
        '[[Vegas scoring]]: you put in your stake, and every card that reaches a foundation pays ' +
        'back 5/52 of it. Finish with 11 or more cards home and you come out ahead — that counts ' +
        'as a win — while clearing the board pays back five times your stake. Stuck? Press ' +
        '[[I’m done]] at any time to stop and keep what you have earned.',
      scene: {
        zones: [
          {
            id: 'home',
            label: 'Foundations: 11 cards home',
            cards: ['5S', '3H', 'AD', '2C'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
        ],
        caption: '5 + 3 + 1 + 2 = 11 cards home — just enough to come out ahead.',
        animate: 'deal',
      },
      tip: 'Before you press “I’m done”, send every card you can to the foundations — each one counts.',
    },
    {
      title: 'A tiny example',
      body:
        'The waste shows the 6♦ and column 2 ends with the 7♣, so the 6♦ goes on the 7♣. Now the ' +
        '5♠ — the only face-up card in column 5 — fits on the 6♦. Move it, and the face-down ' +
        'card under it turns over. It is the A♠! Send it straight up to a [[foundation]].',
      scene: {
        zones: [
          {
            id: 'c2',
            label: 'Column 2',
            cards: ['TH', '7C', '6D', '5S'],
            layout: 'cascade',
            faceDown: [0],
            highlight: [2, 3],
          },
          {
            id: 'c5',
            label: 'Column 5',
            cards: ['9D', 'AS'],
            layout: 'cascade',
            faceDown: [0],
            highlight: [1],
          },
          { id: 'waste', label: 'Waste', cards: ['QC'], layout: 'stack' },
          { id: 'home', label: 'Foundations', cards: ['AH'], layout: 'row' },
        ],
        caption: 'Two moves, one hidden card uncovered — and an Ace ready to go home.',
        animate: 'flip',
      },
    },
    {
      title: 'Beginner strategy',
      body:
        'Send Aces and 2s home straight away. Prefer moves that turn over a [[face-down card]], ' +
        'starting with the tallest columns. Don’t empty a column unless a King can move in. Play ' +
        'waste cards when they fit, but think before sending middle cards home early — you might ' +
        'need them to build on. If a whole trip through the [[stock]] gives you nothing to play ' +
        'and no move on the table helps, the deal is stuck: send what you can home and press ' +
        'I’m done.',
      scene: {
        zones: [
          {
            id: 'c7',
            label: 'Column 7: six hidden cards',
            cards: ['3H', '9C', 'QD', '4S', 'JC', '6S', '8H'],
            layout: 'cascade',
            faceDown: [0, 1, 2, 3, 4, 5],
            highlight: [6],
          },
          {
            id: 'home',
            label: 'Aces and 2s go home first',
            cards: ['AS', '2S'],
            layout: 'row',
            highlight: [0, 1],
          },
        ],
        caption: 'Moving the 8♥ away turns over a card in the column with the most hidden cards.',
        animate: 'deal',
      },
      tip: 'Scan every column and the waste before you draw — a missed move is the most common slip.',
    },
  ],
  mistakes: [
    'Putting a card on one of the same colour — a red 7 needs a black 8, never a red one.',
    'Emptying a column when no King is ready to move in, so the space sits wasted.',
    'Drawing again without checking whether the waste card can be played.',
    'Sending middle cards like a 6 or 7 home too early, then having nowhere to put the next lower card.',
    'Ignoring the tallest columns, where most of the face-down cards are hiding.',
    'Going round the stock again and again when nothing has changed — if a full pass gives you nothing to play and no table move helps, the deal is stuck.',
  ],
  tips: [
    'Tip: in Klondike, always send Aces and 2s to the foundations right away — no card in the tableau ever needs them.',
    'Tip: when you have a choice, free a face-down card from the column with the most hidden cards.',
    'Tip: only empty a column when a King is ready to move into the space.',
    'Tip: a card is safe to send home when both opposite-colour cards one rank lower are already home — for example, the 5♥ once both black 4s are up.',
    'Tip: before drawing, scan every column and the waste for a move — it is easy to miss one.',
    'Tip: you may bring a card back down from a foundation if it gives a stuck card somewhere to go.',
    'Tip: with Vegas scoring every card home counts — when you are stuck, send everything you can home before pressing I’m done.',
  ],
  quiz: [
    {
      question: 'Which card can you put on the 9♠ in the tableau?',
      options: ['8♣', '8♥', '10♦', '9♥'],
      answer: 1,
      explanation:
        'The tableau builds down in alternating colours, so a black 9 takes a red 8 — the 8♥ (or the 8♦).',
    },
    {
      question: 'A column is now completely empty. What can move into it?',
      options: [
        'Any card',
        'Only an Ace',
        'Only a King, or a run that starts with a King',
        'Nothing — it stays empty',
      ],
      answer: 2,
      explanation:
        'Empty columns take only Kings (with any run below them). That is why you should only empty a column when a King is ready.',
    },
    {
      question: 'Which card must go first on an empty Hearts foundation?',
      options: ['The Ace of Hearts', 'The King of Hearts', 'Any Heart', 'Any Ace'],
      answer: 0,
      explanation:
        'Each foundation is one suit, built up from its Ace: A♥, then 2♥, then 3♥ and so on to the K♥.',
    },
    {
      question: 'The stock has run out. What can you do?',
      options: [
        'Nothing — the game is over',
        'Shuffle the tableau back into the stock',
        'Draw from a foundation instead',
        'Turn the waste pile over to make a new stock',
      ],
      answer: 3,
      explanation:
        'In our Draw-1 game you can recycle the waste into a new stock as many times as you like.',
    },
    {
      question:
        'You can either play a card that uncovers a face-down card, or play the waste card onto a column. Which is usually better first?',
      options: [
        'Play the waste card',
        'Uncover the face-down card',
        'Draw a new card from the stock',
      ],
      answer: 1,
      explanation:
        'Hidden cards are what block you in Klondike. Uncovering one gives you new choices — and the waste card will still be there afterwards.',
    },
  ],
  seo: {
    description:
      'Learn Klondike Solitaire step by step: build down in alternating colours, fill the foundations from Ace to King, then play Draw-1 with a friendly coach.',
  },
});
