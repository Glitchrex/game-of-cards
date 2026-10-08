import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'freecell',
  name: 'FreeCell',
  aka: ['Free Cell', 'FreeCell Solitaire'],
  origin: { country: 'United States', countryCode: 'US', region: 'north-america' },
  type: 'solitaire',
  players: { min: 1, max: 1, ideal: 1 },
  deck: 'One standard 52-card deck, no jokers',
  difficulty: 3,
  length: '5–15 minutes a game',
  minutes: 10,
  moods: ['brainy', 'chill'],
  hook: 'Every card face up, almost every deal winnable: the solitaire where your brain beats luck',
  history:
    'FreeCell grew out of an older patience called Baker’s Game, which builds the columns by suit ' +
    'and was described by the puzzle writer Martin Gardner in the 1960s. Paul Alfille switched it ' +
    'to alternating colours and programmed it as a computer game in 1978 on PLATO, an early ' +
    'educational computer system in the United States. FreeCell became world-famous when ' +
    'Microsoft included it with Windows in the 1990s. Of the 32,000 numbered deals in that ' +
    'classic version, just one — deal #11982 — is famous for being impossible to win.',
  featured: false,
  order: 170,
  variantTaught:
    'Standard FreeCell: one 52-card deck dealt face up into eight columns (four columns of 7 ' +
    'cards and four of 6), four free cells that hold one card each, and four foundations built ' +
    'up by suit from Ace to King. Columns are built down in alternating colours. Any card — or ' +
    'any run — may move into an empty column. Officially you move one card at a time; like ' +
    'almost every app, we teach the shortcut of moving a whole run at once when you have enough ' +
    'space to do it card by card: (empty free cells + 1), doubled for every empty column (not ' +
    'counting a column you are moving into). In the classic Windows version a card that reaches ' +
    'a foundation stays there. You win when all 52 cards are home.',
  variants:
    'Baker’s Game is FreeCell’s ancestor: columns are built down by suit instead of by colour, ' +
    'which makes it much harder. Many players make FreeCell tougher by playing with only three, ' +
    'two or even one free cell. Eight Off gives you eight cells but builds by suit, and Seahaven ' +
    'Towers deals ten columns and lets only Kings into empty columns. There are also two-deck ' +
    'FreeCell games with more columns and cells. Apps differ on the small print: most send safe ' +
    'cards to the foundations automatically, most let you undo, and some let you take a card back ' +
    'down from a foundation.',
  glossary: [
    {
      term: 'suit',
      definition:
        'One of the four families of cards: Spades ♠, Hearts ♥, Diamonds ♦ and Clubs ♣. Each suit has 13 cards, from Ace to King.',
    },
    {
      term: 'rank',
      definition:
        'What a card is, ignoring its suit: Ace (lowest), 2, 3 … 10, Jack, Queen, King (highest). The 7♥ and the 7♣ have the same rank.',
    },
    {
      term: 'free cell',
      definition:
        'One of four parking spaces above the columns. Each holds exactly one card of any kind, for example the 3♥ while you dig out an Ace.',
    },
    {
      term: 'foundation',
      definition:
        'One of four piles, one per suit, built up from Ace to King. Get all 52 cards onto the foundations and you have won.',
    },
    {
      term: 'column',
      definition:
        'One of the eight lines of face-up cards dealt at the start. Only the card at the end of a column — the one nobody is covering — can move.',
    },
    {
      term: 'alternating colours',
      definition:
        'Red and black taking turns down a column: black 8, red 7, black 6. Hearts and Diamonds are red; Spades and Clubs are black.',
    },
    {
      term: 'run',
      definition:
        'Cards at the end of a column going down one rank at a time in alternating colours, like 10♠ 9♥ 8♠. A run can move together if you have enough space.',
    },
    {
      term: 'empty column',
      definition:
        'A column with no cards left. In FreeCell any card or run can move into it — it is the most valuable space on the table.',
    },
    {
      term: 'supermove',
      definition:
        'Moving a whole run in one go. It is a shortcut for moving the cards one by one through empty free cells and columns, so the run can be (empty free cells + 1) cards long, doubled for each empty column.',
    },
    {
      term: 'buried card',
      definition:
        'A card with other cards on top of it in a column. A buried Ace is a problem: dig it out early by moving the cards above it.',
    },
  ],
  lesson: [
    {
      title: 'The goal: send every card home',
      body:
        'FreeCell is a card game you play on your own. Your goal is to move all 52 cards onto four ' +
        '[[foundation]] piles — one for each [[suit]]. Each foundation starts with the Ace and climbs ' +
        'one card at a time, all the way up to the King. The twist: every card is face up from ' +
        'the very start, so it is a puzzle of planning, not luck.',
      scene: {
        zones: [
          {
            id: 'clubs',
            label: 'One foundation: Ace upwards, one suit',
            cards: ['AC', '2C', '3C', '4C'],
            layout: 'row',
            highlight: [0],
          },
          {
            id: 'win',
            label: 'You win when all four reach the King',
            cards: ['KS', 'KH', 'KC', 'KD'],
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
      title: 'Setting up: eight columns, all face up',
      body:
        'Deal the whole deck face up into eight [[columns|column]]: the first four get 7 cards ' +
        'each and the other four get 6. Above them sit four empty [[free cells|free cell]] and ' +
        'four empty foundations. Nothing is hidden, so you can plan from your very first move.',
      scene: {
        zones: [
          {
            id: 'c1',
            label: 'Column 1 (7 cards)',
            cards: ['JD', '4C', '9S', '2H', 'QC', '7H', '5S'],
            layout: 'cascade',
            highlight: [6],
          },
          {
            id: 'c2',
            label: 'Column 2 (7 cards)',
            cards: ['8D', 'KC', '3S', 'TH', '6C', 'AD', '9H'],
            layout: 'cascade',
            highlight: [6],
          },
          {
            id: 'c5',
            label: 'Column 5 (6 cards)',
            cards: ['2S', '7D', 'QH', '4H', 'TC', '8S'],
            layout: 'cascade',
            highlight: [5],
          },
          {
            id: 'c6',
            label: 'Column 6 (6 cards)',
            cards: ['KH', '5D', 'JS', '3C', '9D', '6H'],
            layout: 'cascade',
            highlight: [5],
          },
        ],
        caption: 'Four of the eight columns. The glowing card at the end of each one can move.',
        animate: 'deal',
      },
      tip: '4 × 7 + 4 × 6 = 52: every card in the deck is on the table from the start.',
    },
    {
      title: 'A move: one free card goes somewhere new',
      body:
        'You can move the card at the end of any [[column]], or a card sitting in a [[free cell]]. ' +
        'It can go onto the end of another column, into an empty free cell, up to its ' +
        'foundation, or into a column that has no cards left (more on that soon). There is no ' +
        'pile to draw from — every move is your choice.',
      scene: {
        zones: [
          {
            id: 'c3',
            label: 'Column 3',
            cards: ['QS', '8C', '3H'],
            layout: 'cascade',
            highlight: [2],
          },
          {
            id: 'home',
            label: 'Hearts foundation',
            cards: ['AH', '2H'],
            layout: 'stack',
          },
          {
            id: 'c7',
            label: 'Column 7',
            cards: ['TD', '4S'],
            layout: 'cascade',
            highlight: [1],
          },
          {
            id: 'cells',
            label: 'Free cells (1 used, 3 empty)',
            cards: ['7C'],
            layout: 'row',
          },
        ],
        caption: 'The 3♥ could go home onto the 2♥, onto the black 4♠, or into an empty free cell.',
        animate: 'deal',
      },
    },
    {
      title: 'Build down in alternating colours',
      body:
        'On the columns you build down: a card goes on a card one [[rank]] higher in the opposite ' +
        'colour. A red 9 goes on a black 10; a black 8 goes on a red 9. We call that ' +
        '[[alternating colours]]. Cards built like this make a [[run]].',
      scene: {
        zones: [
          {
            id: 'c4',
            label: 'Column 4: a run',
            cards: ['5D', 'QC', 'JH', 'TS', '9H'],
            layout: 'cascade',
            highlight: [1, 2, 3, 4],
          },
          {
            id: 'c8',
            label: 'Column 8',
            cards: ['2C', '6D', '8S'],
            layout: 'cascade',
            highlight: [2],
          },
        ],
        caption: 'Black Q, red J, black 10, red 9… the black 8♠ can join the run next.',
        animate: 'deal',
      },
      tip: 'The colour must change every time: a red 7 can never go on a red 8.',
    },
    {
      title: 'Free cells: four parking spaces',
      body:
        'Each [[free cell]] holds exactly one card — any card. Park a card there to get it out of ' +
        'the way, then bring it back later onto a column or a foundation. Think of the free cells ' +
        'as a car park with only four spaces: fill them all and you are stuck.',
      scene: {
        zones: [
          {
            id: 'cells',
            label: 'Free cells (1 used)',
            cards: ['6H'],
            layout: 'row',
            highlight: [0],
          },
          {
            id: 'c2',
            label: 'Column 2',
            cards: ['9C', '4D', 'AS'],
            layout: 'cascade',
            highlight: [2],
          },
        ],
        caption: 'The 6♥ waits in a free cell, so the A♠ it was covering is free to go home.',
        animate: 'deal',
      },
      tip: 'Before you use a free cell, check whether the card could go onto a column instead.',
    },
    {
      title: 'Empty columns: your super-power',
      body:
        'Clear every card out of a column and you get an [[empty column]]. Unlike Klondike, ANY ' +
        'card can move into it — not just a King. It is even better than a free cell, because you ' +
        'can build a whole run there.',
      scene: {
        zones: [
          {
            id: 'c7',
            label: 'Column 7 (was empty)',
            cards: ['9C', '8H', '7S'],
            layout: 'cascade',
            highlight: [0, 1, 2],
          },
          {
            id: 'c3',
            label: 'Column 3',
            cards: ['JC', '2D'],
            layout: 'cascade',
            highlight: [1],
          },
        ],
        caption: 'Moving the 9♣ 8♥ 7♠ run into the empty column set the 2♦ free.',
        animate: 'deal',
      },
    },
    {
      title: 'Moving a run: count your space',
      body:
        'Officially, you move one card at a time. But you can shift a [[run]] card by card, using ' +
        'empty free cells as stepping stones — so apps let you move it in one go, a [[supermove]]. ' +
        'The longest run you can move is (empty free cells + 1). Every [[empty column]] doubles ' +
        'it: 2 empty free cells plus 1 empty column lets you move 6 cards.',
      scene: {
        zones: [
          {
            id: 'cells',
            label: 'Free cells (2 used, 2 empty)',
            cards: ['QH', '4C'],
            layout: 'row',
          },
          {
            id: 'c5',
            label: 'Column 5: a 3-card run',
            cards: ['KS', 'TD', '9C', '8D'],
            layout: 'cascade',
            highlight: [1, 2, 3],
          },
          {
            id: 'c2',
            label: 'Column 2',
            cards: ['5H', 'JS'],
            layout: 'cascade',
            highlight: [1],
          },
        ],
        caption: '2 empty free cells + 1 = 3 cards, so the 10♦ 9♣ 8♦ can move onto the J♠.',
        animate: 'deal',
      },
      tip: 'Moving a run INTO an empty column? That column does not count toward the doubling.',
    },
    {
      title: 'Foundations and winning',
      body:
        'As soon as an Ace is free, send it up to a [[foundation]]. Then build each foundation up ' +
        'in its own suit: A♠, 2♠, 3♠ and so on to the K♠. In the classic version a card that ' +
        'reaches a foundation stays there. Get all 52 cards home and you have won — and almost ' +
        'every FreeCell deal can be won, so stuck usually means “try a different plan”.',
      scene: {
        zones: [
          {
            id: 'spades',
            label: 'Spades foundation',
            cards: ['AS', '2S', '3S'],
            layout: 'stack',
          },
          { id: 'diamonds', label: 'Diamonds foundation', cards: ['AD'], layout: 'stack' },
          {
            id: 'c6',
            label: 'Column 6',
            cards: ['KH', '7C', '4S'],
            layout: 'cascade',
            highlight: [2],
          },
          {
            id: 'cells',
            label: 'Free cells (1 used)',
            cards: ['2D'],
            layout: 'row',
            highlight: [0],
          },
        ],
        caption: 'The 4♠ can go on the 3♠, and the 2♦ can leave its free cell for the A♦.',
        animate: 'deal',
      },
      tip: 'Aces and 2s should go home straight away — no card on the columns needs them.',
    },
    {
      title: 'A tiny example',
      body:
        'The A♦ was a [[buried card]] in column 4, stuck under the 5♣. The 5♣ is black, so it ' +
        'fits on a red 6 — and column 6 ended with the 6♦. Move the 5♣ there, and the A♦ is ' +
        'free: send it up to its [[foundation]]. One move, no [[free cell]] used, and an Ace is ' +
        'home.',
      scene: {
        zones: [
          {
            id: 'c4',
            label: 'Column 4',
            cards: ['9S', 'QH'],
            layout: 'cascade',
            highlight: [1],
          },
          {
            id: 'c6',
            label: 'Column 6',
            cards: ['TH', '6D', '5C'],
            layout: 'cascade',
            highlight: [2],
          },
          {
            id: 'home',
            label: 'Diamonds foundation',
            cards: ['AD'],
            layout: 'stack',
            highlight: [0],
          },
        ],
        caption: 'The 5♣ moved onto the 6♦, and the A♦ went straight home.',
        animate: 'deal',
      },
    },
    {
      title: 'Beginner strategy',
      body:
        'Look at all eight columns before your first move. Dig out Aces and 2s early. Try a ' +
        'column move before you use a [[free cell]], and keep at least one cell empty whenever you ' +
        'can. Aim to clear a short column — an [[empty column]] makes everything easier. And when ' +
        'you fill one, a King is the perfect tenant: nothing ever needs to go under a King.',
      scene: {
        zones: [
          {
            id: 'c8',
            label: 'Column 8: only 3 cards — clear it first',
            cards: ['7S', '3D', 'JH'],
            layout: 'cascade',
            highlight: [0, 1, 2],
          },
          {
            id: 'home',
            label: 'Aces and 2s go home first',
            cards: ['AC', '2C'],
            layout: 'row',
            highlight: [0, 1],
          },
        ],
        caption: 'Short columns are the quickest to empty — and an empty column is gold.',
        animate: 'deal',
      },
      tip: 'Stuck? Undo a few moves and try another plan — nearly every deal has a way through.',
    },
  ],
  mistakes: [
    'Filling all four free cells early, then having nowhere to put the next card.',
    'Putting a card on one of the same colour — a red 7 needs a black 8, never a red one.',
    'Trying to move a run that is longer than your free space allows, so the plan falls apart halfway.',
    'Dropping a single random card into an empty column instead of saving it for a King or a long run.',
    'Building on top of an Ace or a 2, burying it even deeper.',
    'Rushing the first moves without looking at all eight columns.',
  ],
  tips: [
    'Tip: in FreeCell, try a column move before using a free cell — free cells are your emergency spaces.',
    'Tip: keep at least one free cell empty whenever you can; a full set of cells is how most games get stuck.',
    'Tip: count before moving a run — empty free cells + 1, doubled for every empty column.',
    'Tip: clear the shortest column first; an empty column doubles the runs you can move.',
    'Tip: a King is the perfect card for an empty column, because nothing ever needs to go under it.',
    'Tip: send Aces and 2s home as soon as they are free — nothing on the columns needs them.',
    'Tip: before your first move, find where the four Aces are buried and plan to dig out the shallowest one.',
  ],
  quiz: [
    {
      question: 'Which card can you put on the 8♥ at the end of a column?',
      options: ['7♦', '7♣', '9♠', '8♠'],
      answer: 1,
      explanation:
        'Columns build down in alternating colours, so a red 8 takes a black 7 — the 7♣ (or the 7♠).',
    },
    {
      question: 'How many cards can one free cell hold?',
      options: ['As many as you like', 'Up to four', 'Exactly one', 'A whole run'],
      answer: 2,
      explanation:
        'Each of the four free cells is a parking space for exactly one card. That is why they fill up so quickly.',
    },
    {
      question: 'A column is now completely empty. What can move into it?',
      options: ['Any card, or a run', 'Only a King', 'Only an Ace', 'Nothing — it stays empty'],
      answer: 0,
      explanation:
        'In FreeCell any card or run can move into an empty column. (In Klondike only a King can — that is a big difference!)',
    },
    {
      question:
        'You have 3 empty free cells and no empty columns. How long a run can you move at once?',
      options: ['1 card', '2 cards', '3 cards', '4 cards'],
      answer: 3,
      explanation:
        'The limit is empty free cells + 1, so 3 + 1 = 4 cards. Three cards hop through the free cells while the fourth moves, then they follow it.',
    },
    {
      question:
        'An Ace is under the 5♣. The 5♣ could go into a free cell or onto a red 6 in another column. Which is usually better?',
      options: ['Into a free cell', 'Onto the red 6', 'It makes no difference'],
      answer: 1,
      explanation:
        'Both free the Ace, but moving onto the red 6 keeps all your free cells empty for later. Free cells are precious!',
    },
  ],
  example: {
    intro:
      'A fresh deal. We will zoom in on the columns that matter while you make the key calls — and watch the board get calmer with every smart move.',
    steps: [
      {
        narration:
          'Every card is face up. The A♥ is a [[buried card]] in column 1, under the 8♠ and the 4♦. All four [[free cell]]s are empty. Only the card at the end of a [[column]] can move, so the 4♦ has to go first.',
        scene: {
          zones: [
            {
              id: 'c1',
              label: 'Column 1',
              cards: ['KS', '6H', 'TC', '2D', 'AH', '8S', '4D'],
              layout: 'cascade',
              highlight: [4, 6],
            },
            {
              id: 'c6',
              label: 'Column 6',
              cards: ['8D', 'KC', '4C', 'QS', '6D', '5C'],
              layout: 'cascade',
              highlight: [5],
            },
            {
              id: 'c4',
              label: 'Column 4',
              cards: ['QH', '3S', 'JC', '7C', '2S', 'TS', '9H'],
              layout: 'cascade',
            },
          ],
          caption: 'The A♥ is two cards deep in column 1.',
          animate: 'deal',
        },
        decision: {
          prompt: 'Where should the 4♦ go?',
          options: [
            {
              label: 'Into a free cell',
              card: '4D',
              correct: false,
              feedback:
                'Allowed, but free cells are precious. Why spend one when the 5♣ is sitting there waiting for exactly this card?',
            },
            {
              label: 'Onto the 5♣ in column 6',
              card: '4D',
              correct: true,
              feedback:
                'Perfect! A red 4 on a black 5 is a legal build in alternating colours — and it costs you no free cell at all.',
            },
            {
              label: 'Send the A♥ home right now',
              card: 'AH',
              correct: false,
              feedback:
                'Not yet — the A♥ is covered. Only the card at the very end of a column can move, so you have to dig it out first.',
            },
          ],
          proHint:
            'A pro looks for a column move first. Free cells are for when there is no other way.',
        },
      },
      {
        narration:
          'The 4♦ slides onto the 5♣. Now only the 8♠ is covering the A♥ — and column 4 ends with the red 9♥, sitting on the 10♠.',
        scene: {
          zones: [
            {
              id: 'c1',
              label: 'Column 1',
              cards: ['KS', '6H', 'TC', '2D', 'AH', '8S'],
              layout: 'cascade',
              highlight: [4, 5],
            },
            {
              id: 'c6',
              label: 'Column 6',
              cards: ['8D', 'KC', '4C', 'QS', '6D', '5C', '4D'],
              layout: 'cascade',
              highlight: [6],
            },
            {
              id: 'c4',
              label: 'Column 4',
              cards: ['QH', '3S', 'JC', '7C', '2S', 'TS', '9H'],
              layout: 'cascade',
              highlight: [6],
            },
          ],
          caption: 'One card down, one to go.',
          animate: 'none',
        },
        decision: {
          prompt: 'Where should the 8♠ go?',
          options: [
            {
              label: 'Onto the 4♦ in column 6',
              card: '8S',
              correct: false,
              feedback: 'A card goes on one rank higher — so the 8♠ needs a red 9, not a 4.',
            },
            {
              label: 'Into a free cell',
              card: '8S',
              correct: false,
              feedback:
                'It works, but it uses up a parking space when the 9♥ is a perfect home. Keep your free cells empty.',
            },
            {
              label: 'Onto the 9♥ in column 4',
              card: '8S',
              correct: true,
              feedback:
                'Yes! A black 8 on a red 9 — and it grows a three-card run: 10♠ 9♥ 8♠. Runs are easy to move together later.',
            },
          ],
          proHint:
            'Pros love moves that grow a run: one long run is easier to handle than loose cards.',
        },
      },
      {
        narration:
          'Free at last! The A♥ goes straight up to its [[foundation]]. Two moves, zero free cells used. Column 1 now ends with the 2♦ — it can go home too, as soon as the A♦ turns up.',
        scene: {
          zones: [
            {
              id: 'home',
              label: 'Hearts foundation',
              cards: ['AH'],
              layout: 'stack',
              highlight: [0],
            },
            {
              id: 'c1',
              label: 'Column 1',
              cards: ['KS', '6H', 'TC', '2D'],
              layout: 'cascade',
              highlight: [3],
            },
            {
              id: 'c4',
              label: 'Column 4',
              cards: ['QH', '3S', 'JC', '7C', '2S', 'TS', '9H', '8S'],
              layout: 'cascade',
              highlight: [5, 6, 7],
            },
          ],
          caption: 'The first card is home — and the 10♠ 9♥ 8♠ run is growing.',
          animate: 'none',
        },
      },
      {
        narration:
          'Where is the A♦? In column 5, under the 3♥. A red 3 needs a black 4, but both black 4s are buried. Your [[free cell]]s are still all empty.',
        scene: {
          zones: [
            {
              id: 'home',
              label: 'Hearts foundation',
              cards: ['AH'],
              layout: 'stack',
            },
            {
              id: 'c5',
              label: 'Column 5',
              cards: ['7S', '9D', '5D', 'KH', 'AD', '3H'],
              layout: 'cascade',
              highlight: [4, 5],
            },
            {
              id: 'c1',
              label: 'Column 1',
              cards: ['KS', '6H', 'TC', '2D'],
              layout: 'cascade',
              highlight: [3],
            },
          ],
          caption: 'The A♦ is just one card deep — and the 2♦ is ready to follow it.',
          animate: 'deal',
        },
        decision: {
          prompt: 'What do you do with the 3♥?',
          options: [
            {
              label: 'Park it in a free cell',
              card: '3H',
              correct: true,
              feedback:
                'Exactly what free cells are for! One card parked, and two cards go home: the A♦, then the 2♦ from column 1.',
            },
            {
              label: 'Put it on the 4♦',
              card: '3H',
              correct: false,
              feedback: 'Same colour! The 3♥ and the 4♦ are both red. A red 3 needs a black 4.',
            },
            {
              label: 'Leave it and look elsewhere',
              correct: false,
              feedback:
                'Nothing else frees an Ace this quickly. One free cell for two cards home is a bargain.',
            },
          ],
          proHint:
            'Pros spend a free cell when it pays back quickly — here it sends two cards home at once.',
        },
      },
      {
        narration:
          'The 3♥ waits in a [[free cell]]. The A♦ goes home, and the 2♦ jumps straight up after it. The 3♥ will follow its own Ace as soon as the 2♥ shows up.',
        scene: {
          zones: [
            {
              id: 'cells',
              label: 'Free cells (1 used, 3 empty)',
              cards: ['3H'],
              layout: 'row',
              highlight: [0],
            },
            {
              id: 'home',
              label: 'Foundations (top cards)',
              cards: ['AH', '2D'],
              layout: 'row',
              highlight: [1],
            },
            {
              id: 'c5',
              label: 'Column 5',
              cards: ['7S', '9D', '5D', 'KH'],
              layout: 'cascade',
            },
            {
              id: 'c1',
              label: 'Column 1',
              cards: ['KS', '6H', 'TC'],
              layout: 'cascade',
            },
          ],
          caption: 'Three cards home already, and three free cells still empty.',
          animate: 'none',
        },
      },
      {
        narration:
          'Let’s jump ahead a few moves. The 2♥ turned up, so the 3♥ left its cell and went home; the 3♦ and the A♠ are home too. Along the way you parked the Q♣ in a free cell. Now the 2♠ is stuck in column 4 under the [[run]] 10♠ 9♥ 8♠. The J♦ in column 7 would be a perfect landing spot. You have 3 empty free cells and no [[empty column]].',
        scene: {
          zones: [
            {
              id: 'cells',
              label: 'Free cells (1 used, 3 empty)',
              cards: ['QC'],
              layout: 'row',
            },
            {
              id: 'home',
              label: 'Foundations (top cards)',
              cards: ['3H', '3D', 'AS'],
              layout: 'row',
              highlight: [2],
            },
            {
              id: 'c4',
              label: 'Column 4',
              cards: ['QH', '3S', 'JC', '7C', '2S', 'TS', '9H', '8S'],
              layout: 'cascade',
              highlight: [4, 5, 6, 7],
            },
            {
              id: 'c7',
              label: 'Column 7',
              cards: ['9C', '5H', 'JD'],
              layout: 'cascade',
              highlight: [2],
            },
          ],
          caption: 'Three cards stand between the 2♠ and its Ace.',
          animate: 'deal',
        },
        decision: {
          prompt: 'Can you move the whole 10♠ 9♥ 8♠ run onto the J♦?',
          options: [
            {
              label: 'No — only one card can ever move',
              correct: false,
              feedback:
                'Officially cards move one at a time — but with free cells as stepping stones you can shift the run card by card. Apps simply do it in one go.',
            },
            {
              label: 'Yes — move all three at once',
              card: 'TS',
              correct: true,
              feedback:
                'Right! With 3 empty free cells you can move up to 3 + 1 = 4 cards. Behind the scenes, the 8♠ and 9♥ hop through free cells while the 10♠ moves, then follow it.',
            },
            {
              label: 'Just park the 8♠ in a free cell',
              card: '8S',
              correct: false,
              feedback:
                'That uses a free cell and still leaves the 10♠ and 9♥ sitting on the 2♠. Move the whole run instead.',
            },
          ],
          proHint:
            'Pros count before they move: empty free cells + 1, doubled for every empty column.',
        },
      },
      {
        narration:
          'Whoosh — the run lands on the J♦ in one [[supermove]], the 2♠ goes home, and column 4 now ends with the 7♣. Every move has made the board a little calmer.',
        scene: {
          zones: [
            {
              id: 'cells',
              label: 'Free cells (1 used, 3 empty)',
              cards: ['QC'],
              layout: 'row',
            },
            {
              id: 'home',
              label: 'Foundations (top cards)',
              cards: ['3H', '3D', '2S'],
              layout: 'row',
              highlight: [2],
            },
            {
              id: 'c4',
              label: 'Column 4',
              cards: ['QH', '3S', 'JC', '7C'],
              layout: 'cascade',
            },
            {
              id: 'c7',
              label: 'Column 7',
              cards: ['9C', '5H', 'JD', 'TS', '9H', '8S'],
              layout: 'cascade',
              highlight: [3, 4, 5],
            },
          ],
          caption: 'J♦ 10♠ 9♥ 8♠: a four-card run, and the 2♠ is home.',
          animate: 'none',
        },
      },
      {
        narration:
          'A few moves later you have done something brilliant: column 3 is completely empty! The A♣ is the last Ace still out, stuck under the K♦ in column 2. The Q♣ is still waiting in a free cell. What is the best use of your [[empty column]]?',
        scene: {
          zones: [
            {
              id: 'cells',
              label: 'Free cells (1 used, 3 empty)',
              cards: ['QC'],
              layout: 'row',
              highlight: [0],
            },
            {
              id: 'c3',
              label: 'Column 3 (empty)',
              cards: [],
              layout: 'stack',
            },
            {
              id: 'c2',
              label: 'Column 2',
              cards: ['6C', 'AC', 'KD'],
              layout: 'cascade',
              highlight: [1, 2],
            },
            {
              id: 'home',
              label: 'Foundations (top cards)',
              cards: ['3H', '3D', '2S'],
              layout: 'row',
            },
          ],
          caption: 'An empty column — the most valuable space on the table.',
          animate: 'deal',
        },
        decision: {
          prompt: 'What should go into the empty column?',
          options: [
            {
              label: 'The Q♣ from the free cell',
              card: 'QC',
              correct: false,
              feedback:
                'It empties a cell, but it spends your best space on a Queen, and the A♣ is still trapped. Now the K♦ could only go into a free cell, where a King gets stuck.',
            },
            {
              label: 'Put the K♦ in a free cell instead',
              card: 'KD',
              correct: false,
              feedback:
                'That frees the A♣, but a King in a free cell can only leave for an empty column (or, at the very end, its foundation), so it would block a parking space for a long time.',
            },
            {
              label: 'The K♦',
              card: 'KD',
              correct: true,
              feedback:
                'Brilliant! A King never needs to move again, because nothing can go under it. It frees the A♣ — and gives the Q♣ a home on top of it.',
            },
          ],
          proHint:
            'Pros give an empty column to a King and build a long run on it — that column is then “finished”.',
        },
      },
      {
        narration:
          'The K♦ moves in, the A♣ goes home, and the Q♣ hops out of its cell onto the K♦. All four [[free cell]]s are empty again and every Ace is home. From here the cards start racing to the foundations — that is how FreeCell feels when your plan comes together.',
        scene: {
          zones: [
            {
              id: 'c3',
              label: 'Column 3: K♦ with the Q♣ on it',
              cards: ['KD', 'QC'],
              layout: 'cascade',
              highlight: [0, 1],
            },
            {
              id: 'c2',
              label: 'Column 2',
              cards: ['6C'],
              layout: 'cascade',
            },
            {
              id: 'home',
              label: 'Foundations (top cards)',
              cards: ['3H', '3D', '2S', 'AC'],
              layout: 'row',
              highlight: [3],
            },
          ],
          caption: 'Four Aces home, four empty free cells. Smooth sailing!',
          animate: 'none',
        },
      },
    ],
    outro:
      'You dug out buried Aces without wasting free cells, grew runs, counted your space for a supermove and gave an empty column to a King. Those four habits win most FreeCell deals. Ready to test yourself? Try the quiz!',
  },
  seo: {
    description:
      'Learn FreeCell step by step: four free cells, eight face-up columns and alternating colours. Plan smart moves and win almost every deal with a friendly coach.',
  },
});
