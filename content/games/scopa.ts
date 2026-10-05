import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'scopa',
  name: 'Scopa',
  origin: { country: 'Italy', countryCode: 'IT', region: 'europe' },
  type: 'fishing',
  players: { min: 2, max: 4, ideal: 2 },
  deck: '40 cards: Ace to 7, Jack, Queen and King of each suit (a standard deck with the 8s, 9s and 10s taken out)',
  difficulty: 2,
  length: 'About 5–10 minutes a hand; around 30 minutes to reach 11 points',
  minutes: 30,
  moods: ['social', 'brainy'],
  hook: 'Italy’s café classic: sweep the table, snatch the Settebello and shout “Scopa!”',
  history:
    'Scopa means “broom” in Italian — when you capture every card on the table, you have swept it clean. It has long been played all over Italy and, along with Briscola, is often called one of the country’s two great national card games. It is traditionally played with regional 40-card packs, many of them with the Italian suits of coins, cups, swords and batons. In a famous photo from 1982, Italy’s President Sandro Pertini is playing Scopone, Scopa’s four-player cousin, with members of the World Cup–winning team on the flight home.',
  featured: false,
  order: 210,
  variantTaught:
    'Classic two-player Scopa with the 40-card French-suited deck: A–7, J, Q, K, worth 1–7, 8, 9 and 10, with diamonds standing in for the Italian suit of coins. Three cards each and four face up on the table; then three more each whenever both hands are empty. You capture one card of the same value, or a group that adds up to your card — but a single matching card must be taken before a sum, and a card that can capture must capture. A sweep is a scopa (1 point), except on the very last play of the hand. Leftover table cards go to the last player who captured. Each hand scores 1 point each for most cards, most diamonds, the Settebello (7♦) and the primiera, plus 1 per scopa. First to 11 wins (if both players reach 11 in the same hand, the higher score wins).',
  variants:
    'In Italy, Scopa is usually played with a regional 40-card pack: Fante, Cavallo and Re (Jack, Knight, King) are worth 8, 9 and 10, and coins (denari) take the place of our diamonds — we use the French-suited equivalent, which is also how many people play outside Italy. With four players it is played in two teams of partners. Scopone is a four-player version in which all the cards are dealt out at the start; in Scopone Scientifico, its most famous form, each player gets ten cards and none go to the table. Scopa a 15 (Scopa di Quindici) and the Genoese favourite Cirulla let you capture cards that add up to 15 together with the card you play. Some tables play to 15 or 21 instead of 11, add a bonus called Napola for capturing the Ace, 2 and 3 of coins, or redeal if three or four Kings land on the table at the start.',
  glossary: [
    {
      term: 'hand',
      definition:
        'Two meanings! The cards you are holding — and one whole deal, from the first cards dealt until the points are counted. A game of Scopa lasts several hands.',
    },
    {
      term: 'stock',
      definition:
        'The face-down pile of cards left after the deal. New cards are dealt from it, three to each player, whenever both players have run out.',
    },
    {
      term: 'capture',
      definition:
        'Taking cards from the table with a card from your hand. They go face down into your pile. Your 5♠ can capture the 5♣.',
    },
    {
      term: 'sum',
      definition:
        'Capturing two or more table cards that add up to the value of the card you play. A Jack (worth 8) can capture a 5 and a 3.',
    },
    {
      term: 'trail',
      definition:
        'Putting a card face up on the table without capturing anything, because it can’t capture. It stays there for anyone to take.',
    },
    {
      term: 'scopa',
      definition:
        'Sweeping the table: capturing every card on it at once. It scores 1 point. If the table holds 2♣, 4♦ and A♥, a 7 makes a scopa.',
    },
    {
      term: 'settebello',
      definition:
        'The “beautiful seven”: the 7♦ (the seven of coins in an Italian pack). Whoever captures it scores 1 point.',
    },
    {
      term: 'diamonds',
      definition:
        'The suit that stands in for the Italian coins (denari). Capturing more diamonds than your opponent scores 1 point.',
    },
    {
      term: 'primiera',
      definition:
        'A point for the best set of four cards, one of each suit, using special values: 7 = 21, 6 = 18, A = 16, 5 = 15, 4 = 14, 3 = 13, 2 = 12, J/Q/K = 10.',
    },
    {
      term: 'last capture',
      definition:
        'When all the cards have been played, any cards still on the table go to the player who made the last capture. This is never a scopa.',
    },
  ],
  lesson: [
    {
      title: 'The goal: capture cards from the table',
      body: 'Scopa is a “fishing” game: cards lie face up in the middle of the table, and on your turn you play a card from your hand to fish out — [[capture]] — matching cards. At the end of each [[hand]] — one whole deal of the cards — you score points for the best captures. The first player to reach 11 points wins.',
      scene: {
        zones: [
          {
            id: 'table',
            label: 'Table',
            cards: ['5C', '2H', '6S', 'KD'],
            layout: 'row',
            highlight: [0],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['5S', 'QH', '7C'],
            layout: 'fan',
            highlight: [0],
          },
        ],
        caption: 'Your 5♠ can capture the 5♣. Into your pile they go!',
      },
    },
    {
      title: 'A 40-card deck where every card has a value',
      body: 'Scopa uses 40 cards: Ace to 7, plus Jack, Queen and King, in each suit. Every card has a value: Ace = 1, 2 to 7 = their number, Jack = 8, Queen = 9 and King = 10. You will add these up a lot, so take a good look!',
      scene: {
        zones: [
          {
            id: 'suit',
            label: 'One suit, worth 1 to 10',
            cards: ['AH', '2H', '3H', '4H', '5H', '6H', '7H', 'JH', 'QH', 'KH'],
            layout: 'row',
            highlight: [7, 8, 9],
          },
        ],
        caption: 'A = 1 · 2 to 7 as printed · J = 8 · Q = 9 · K = 10',
      },
      tip: 'Only have a 52-card deck? Take out the 8s, 9s and 10s and you are ready to play.',
    },
    {
      title: 'The deal',
      body: 'The dealer gives three cards to each player and puts four cards face up on the table. The rest of the deck waits face down as the [[stock]]. The player who didn’t deal goes first, then you take turns, playing one card each time.',
      scene: {
        zones: [
          {
            id: 'opp',
            label: 'Opponent',
            cards: ['3S', '6D', 'KC'],
            layout: 'fan',
            faceDown: [0, 1, 2],
          },
          {
            id: 'table',
            label: 'Table',
            cards: ['4C', 'JD', 'AS', '7H'],
            layout: 'row',
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['2C', '5D', 'QS'],
            layout: 'fan',
          },
          {
            id: 'stock',
            label: 'Stock',
            cards: ['6C', '3H'],
            layout: 'stack',
            faceDown: [0, 1],
          },
        ],
        caption: 'Three cards each, four face up on the table.',
      },
    },
    {
      title: 'A turn: capture or trail',
      body: 'Play one card from your hand. If a table card has the same value, you [[capture]] it: take both cards and put them face down in your pile. If your card can’t capture anything, it just stays on the table — that’s called a [[trail]]. One firm rule: if the card you play can capture, it must capture.',
      scene: {
        zones: [
          {
            id: 'table',
            label: 'Table',
            cards: ['6D', '3S', 'KC', '2H'],
            layout: 'row',
            highlight: [0],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['6C', '7H', 'AD'],
            layout: 'fan',
            highlight: [0],
          },
        ],
        caption:
          'The 6♣ captures the 6♦. The 7♥ can’t capture anything here, so playing it would be a trail.',
      },
    },
    {
      title: 'Capturing a sum',
      body: 'Your card can also capture two or more table cards that add up to its value — a [[sum]]. A Jack (8) can take a 5 and a 3. But if a single table card matches your card, you must take that single card instead of a sum.',
      scene: {
        zones: [
          {
            id: 'sum',
            label: 'Sum: J (8) takes 5 + 3',
            cards: ['JC', '5H', '3C'],
            layout: 'row',
            highlight: [0],
          },
          {
            id: 'single',
            label: 'A matching card comes first',
            cards: ['JS', 'JD'],
            layout: 'row',
            highlight: [0],
          },
        ],
        caption:
          'If the J♦ is on the table, your J♠ must take it — even if a 5 and a 3 are there too.',
      },
      tip: 'Before every play, add up the table cards in different groups. Sums are where the clever captures hide.',
    },
    {
      title: 'Scopa! Sweep the table',
      body: 'If your capture takes every card on the table, you have made a [[scopa]] — a sweep — and it scores 1 point. Leave the capturing card face up in your pile so you remember it. Your opponent must then trail a card onto the empty table. One exception: a sweep on the very last play of the hand doesn’t count.',
      scene: {
        zones: [
          {
            id: 'table',
            label: 'Table',
            cards: ['2C', '4D', 'AH'],
            layout: 'row',
            highlight: [0, 1, 2],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['7H', 'QC'],
            layout: 'fan',
            highlight: [0],
          },
        ],
        caption: '2 + 4 + 1 = 7, so your 7♥ captures all three cards. Scopa!',
      },
    },
    {
      title: 'New cards and the end of the hand',
      body: 'When both players have played their three cards, the dealer gives three more to each player — none to the table. When the stock is used up and the last cards are played, any cards left on the table go to the player who made the [[last capture]]. Then it’s time to count.',
      scene: {
        zones: [
          {
            id: 'table',
            label: 'Table after the final card',
            cards: ['4C', 'QD', '2S'],
            layout: 'row',
            highlight: [0, 1, 2],
          },
          {
            id: 'pile',
            label: 'Pile of the last player to capture',
            cards: ['5S', '5H'],
            layout: 'stack',
            highlight: [1],
          },
        ],
        caption:
          'The last capture was 5♠ taking 5♥, so that player also gets the 4♣, Q♦ and 2♠. No scopa for this.',
      },
    },
    {
      title: 'Scoring a hand',
      body: 'At the end of each hand there are four points to win, plus your sweeps. 1 point for the most cards. 1 point for the most [[diamonds]]. 1 point for the [[settebello]], the 7♦. 1 point for the [[primiera]] (next step!). And 1 point for every [[scopa]]. If players tie for cards or diamonds, nobody scores that point.',
      scene: {
        zones: [
          {
            id: 'diamonds',
            label: 'Your diamonds: 6 of the 10',
            cards: ['AD', '3D', '5D', '7D', 'QD', 'KD'],
            layout: 'row',
            highlight: [3],
          },
        ],
        caption:
          'Six diamonds beat your opponent’s four: 1 point. And the 7♦ among them is the Settebello: another point!',
      },
      tip: 'There are 40 cards and 10 diamonds, so 21 cards or 6 diamonds always wins that point.',
    },
    {
      title: 'The primiera: a tiny worked example',
      body: 'For the [[primiera]], each player picks their best card in each suit using special values: 7 = 21, 6 = 18, A = 16, 5 = 15, 4 = 14, 3 = 13, 2 = 12, and J, Q, K = 10. Add up your four cards — the higher total wins the point. You need at least one card of every suit to count it.',
      scene: {
        zones: [
          {
            id: 'you',
            label: 'Your best in each suit: 76',
            cards: ['7D', '7C', '6H', 'AS'],
            layout: 'row',
            highlight: [0, 1],
          },
          {
            id: 'opp',
            label: 'Opponent’s best in each suit: 61',
            cards: ['7S', '5H', '5C', 'KD'],
            layout: 'row',
          },
        ],
        caption:
          'You: 21 + 21 + 18 + 16 = 76. Opponent: 21 + 15 + 15 + 10 = 61. The point is yours!',
      },
    },
    {
      title: 'Beginner strategy',
      body: 'Grab 7s and [[diamonds]] whenever you can — they win the Settebello, diamonds and primiera points. When you have to [[trail]], add up the table first: if it would total 10 or less, one card could sweep it all for a [[scopa]]. Keep it above 10, and trail a King or Queen rather than a 7 or a diamond.',
      scene: {
        zones: [
          {
            id: 'table',
            label: 'Table: 2 + 5 = 7',
            cards: ['2S', '5C'],
            layout: 'row',
          },
          {
            id: 'hand',
            label: 'Your hand — nothing captures',
            cards: ['KH', '6D', '3S'],
            layout: 'fan',
            highlight: [0],
          },
        ],
        caption:
          'Trail the K♥: the table becomes 17, too big to sweep, and your 6♦ stays safe in your hand.',
      },
      tip: 'Count the 7s as they are captured. Once you know where they are, the primiera is much easier to win.',
    },
  ],
  mistakes: [
    'Taking a sum when a single matching card is on the table. If a card of the same value is there, you must take that one.',
    'Trailing a card that could capture. In Scopa, a card that can capture must capture — choose a different card if you don’t want to take.',
    'Trailing so that the table adds up to 10 or less, which lets your opponent sweep it all for a scopa.',
    'Counting a sweep on the very last play of the hand as a scopa. It doesn’t count — those cards are simply the last capture.',
    'Forgetting that a King is worth 10, a Queen 9 and a Jack 8, so you miss sums like K = 6 + 4.',
    'Leaving the 7♦ on the table when you could take it. The Settebello is a whole point on its own.',
  ],
  tips: [
    'Tip: In Scopa, never leave the Settebello (7♦) on the table if you can capture it.',
    'Tip: Before you trail, add up the table. If it would total 10 or less, one card could sweep it — try to keep it above 10.',
    'Tip: When you must trail, put down a King or Queen. They are worth little in the primiera, while 7s and 6s are gold.',
    'Tip: Grab diamonds whenever you can. With 6 of the 10, the diamonds point is yours.',
    'Tip: Whoever holds the most 7s usually wins the primiera. Capture 7s first, then 6s and Aces.',
    'Tip: Count the cards that have gone. If three 7s are already captured, a 7 on the table is much safer to leave.',
    'Tip: Before you play, add up the whole table. If one of your cards equals the total, that’s a scopa!',
  ],
  quiz: [
    {
      question: 'The table shows 2♣, 5♥ and 7♠. You play your 7♦. What do you capture?',
      options: [
        'The 2♣ and 5♥',
        'All three cards',
        'You may choose the 7♠ or the 2♣ + 5♥',
        'The 7♠ only',
      ],
      answer: 3,
      explanation:
        'When a single table card matches your card, you must take that single card. So your 7♦ captures the 7♠, and the 2♣ and 5♥ stay on the table.',
    },
    {
      question: 'The table shows 3♥, 4♣ and A♠. Which card makes a scopa?',
      options: ['K♠', 'J♦', '7♥', 'Q♣'],
      answer: 1,
      explanation:
        '3 + 4 + 1 = 8, and the Jack is worth 8. Taking every card on the table is a scopa. A 7 would only take the 3♥ and 4♣.',
    },
    {
      question: 'Which card is worth a whole point all by itself?',
      options: ['The 7♦, the Settebello', 'The K♦, the highest diamond', 'The A♠'],
      answer: 0,
      explanation:
        'The Settebello, the “beautiful seven” of diamonds (coins), scores 1 point for whoever captures it.',
    },
    {
      question:
        'The table shows 2♠ and 3♦. None of your cards can capture. Which is the safest card to trail?',
      options: ['A♣', '4♥', 'K♣'],
      answer: 2,
      explanation:
        'With the K♣ the table adds up to 15, so no single card can sweep it. After the A♣ it would be 6 (any 6 sweeps it), and after the 4♥ it would be 9 (any Queen sweeps it).',
    },
    {
      question: 'In the primiera, which card is worth the most?',
      options: ['A King', 'A 7', 'An Ace'],
      answer: 1,
      explanation:
        'In the primiera a 7 is worth 21, a 6 is 18 and an Ace is 16 — while Kings, Queens and Jacks are only 10.',
    },
  ],
  example: {
    intro:
      'The first hand of a two-player game. Your opponent dealt, so you play first. You make the key choices — and watch the table change after each one.',
    steps: [
      {
        narration:
          'Three cards each and four face up on the table. And look — the 7♦, the [[settebello]], is sitting right there! It’s your turn to play.',
        scene: {
          zones: [
            {
              id: 'opp',
              label: 'Opponent',
              cards: ['QS', 'JD', 'AS'],
              layout: 'fan',
              faceDown: [0, 1, 2],
            },
            {
              id: 'table',
              label: 'Table',
              cards: ['7D', '3C', '4S', 'QH'],
              layout: 'row',
              highlight: [0],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['7S', '2H', 'JC'],
              layout: 'fan',
            },
            {
              id: 'stock',
              label: 'Stock',
              cards: ['QC', 'JH'],
              layout: 'stack',
              faceDown: [0, 1],
            },
          ],
          caption: 'Table: 7♦ · 3♣ · 4♠ · Q♥. You hold 7♠, 2♥, J♣.',
        },
        decision: {
          prompt: 'What do you play?',
          options: [
            {
              label: 'The 7♠ — capture the 7♦',
              card: '7S',
              correct: true,
              feedback:
                'Brilliant! The 7♦ is the Settebello — a whole point by itself — and it’s also a diamond and a 7, which help two more scoring points.',
            },
            {
              label: 'The 7♠ — capture the 3♣ + 4♠',
              card: '7S',
              correct: false,
              feedback:
                'Not allowed! 3 + 4 does make 7, but when a single table card matches your card, you must take that single card instead.',
            },
            {
              label: 'The J♣ — trail it',
              card: 'JC',
              correct: false,
              feedback:
                'You may (a Jack is worth 8, and nothing on the table adds up to 8), but it leaves the Settebello sitting there for your opponent to grab. Take it while you can!',
            },
          ],
          proHint:
            'A pro never leaves the Settebello on the table if they can take it. It’s the most famous card in Scopa.',
        },
      },
      {
        narration:
          'You [[capture]] the 7♦ and put both 7s in your pile. Your opponent plays the Q♠ and captures the Q♥. Now the table holds only the 3♣ and the 4♠ — and neither of your cards can capture them.',
        scene: {
          zones: [
            {
              id: 'opp',
              label: 'Opponent',
              cards: ['JD', 'AS'],
              layout: 'fan',
              faceDown: [0, 1],
            },
            {
              id: 'table',
              label: 'Table',
              cards: ['3C', '4S'],
              layout: 'row',
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['2H', 'JC'],
              layout: 'fan',
            },
            {
              id: 'pile',
              label: 'Your captures',
              cards: ['7S', '7D'],
              layout: 'stack',
              highlight: [1],
            },
          ],
          caption: 'The Settebello is yours! Table: 3♣ + 4♠ = 7.',
        },
        decision: {
          prompt: 'You must trail a card. Which one?',
          options: [
            {
              label: 'The J♣',
              card: 'JC',
              correct: true,
              feedback:
                'Smart. The table becomes 3 + 4 + 8 = 15. No card is worth more than 10, so nobody can sweep all three cards at once.',
            },
            {
              label: 'The 2♥',
              card: '2H',
              correct: false,
              feedback:
                'Risky! The table would add up to 3 + 4 + 2 = 9 — and any Queen (worth 9) would sweep all three for a scopa point.',
            },
          ],
          proHint:
            'Before you trail, add up the table. If the total would be 10 or less, one card could sweep it — so keep it above 10.',
        },
      },
      {
        narration:
          'You [[trail]] the J♣, and your opponent captures it with the J♦. Your last card, the 2♥, can’t capture, so down it goes. Your opponent trails their last card, the A♠. Both hands are empty, so the dealer gives you three fresh cards each — none to the table.',
        scene: {
          zones: [
            {
              id: 'table',
              label: 'Table',
              cards: ['3C', '4S', '2H', 'AS'],
              layout: 'row',
              highlight: [0, 1, 2, 3],
            },
            {
              id: 'pile',
              label: 'Your captures',
              cards: ['7S', '7D'],
              layout: 'stack',
            },
            {
              id: 'oppPile',
              label: 'Opponent’s captures',
              cards: ['QS', 'QH', 'JD', 'JC'],
              layout: 'stack',
            },
          ],
          caption: 'Four small cards on the table: 3♣, 4♠, 2♥ and A♠.',
        },
      },
      {
        narration:
          'Your new cards are the K♥, 5♦ and 3♥. Now add up the whole table: 3 + 4 + 2 + 1 = 10. Hmm… which card is worth 10?',
        scene: {
          zones: [
            {
              id: 'opp',
              label: 'Opponent',
              cards: ['KC', '6D', '2S'],
              layout: 'fan',
              faceDown: [0, 1, 2],
            },
            {
              id: 'table',
              label: 'Table: 3 + 4 + 2 + 1 = 10',
              cards: ['3C', '4S', '2H', 'AS'],
              layout: 'row',
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['KH', '5D', '3H'],
              layout: 'fan',
            },
            {
              id: 'pile',
              label: 'Your captures',
              cards: ['7S', '7D'],
              layout: 'stack',
            },
          ],
          caption: 'All three of your cards can capture something. Which one is best?',
        },
        decision: {
          prompt: 'Which card do you play?',
          options: [
            {
              label: 'The K♥',
              card: 'KH',
              correct: true,
              feedback:
                'SCOPA! The King is worth 10 and the table adds up to exactly 10, so you capture all four cards and sweep the table clean. That’s a bonus point!',
            },
            {
              label: 'The 5♦',
              card: '5D',
              correct: false,
              feedback:
                'It does capture (4 + 1, or 3 + 2), but it leaves cards behind. The King takes everything — and an empty table is worth a point.',
            },
            {
              label: 'The 3♥',
              card: '3H',
              correct: false,
              feedback:
                'It must take the 3♣ (a single matching card always comes first), and that leaves three cards behind. Look for the card that equals the whole table.',
            },
          ],
          proHint:
            'Always add up the whole table first. If one of your cards matches the total, that’s a scopa.',
        },
      },
      {
        narration:
          '[[Scopa|scopa]]! Your K♥ sweeps the table. To remember the point, you leave the K♥ face up in your pile. Now your opponent has to trail a card onto the empty table: the 2♠.',
        scene: {
          zones: [
            {
              id: 'opp',
              label: 'Opponent',
              cards: ['KC', '6D'],
              layout: 'fan',
              faceDown: [0, 1],
            },
            {
              id: 'table',
              label: 'Table',
              cards: ['2S'],
              layout: 'row',
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['5D', '3H'],
              layout: 'fan',
            },
            {
              id: 'pile',
              label: 'Your captures (scopa card face up)',
              cards: ['7S', '7D', 'KH'],
              layout: 'stack',
              faceDown: [0, 1],
              highlight: [2],
            },
          ],
          caption: 'Scopa! One point already in the bag.',
        },
      },
      {
        narration:
          'Fast-forward to the end of the hand. All the cards have been played, and your opponent made the [[last capture]], so they took the cards left on the table. Time to count! First, the [[primiera]]: each player shows their best card in each suit. Remember: 7 = 21, 6 = 18, A = 16, 5 = 15.',
        scene: {
          zones: [
            {
              id: 'you',
              label: 'Your best card in each suit',
              cards: ['7D', '7S', '5H', 'AC'],
              layout: 'row',
            },
            {
              id: 'opp',
              label: 'Opponent’s best card in each suit',
              cards: ['6D', '6S', '7H', '7C'],
              layout: 'row',
            },
          ],
          caption: 'Primiera values: 7 = 21 · 6 = 18 · A = 16 · 5 = 15',
        },
        decision: {
          prompt: 'Who wins the primiera point?',
          options: [
            {
              label: 'You',
              correct: false,
              feedback:
                'Close, but no: you have 21 + 21 + 15 + 16 = 73, and your opponent has 21 + 21 + 18 + 18 = 78.',
            },
            {
              label: 'Your opponent',
              correct: true,
              feedback:
                'Right. You both have two 7s (21 each), but their two 6s (18 each) beat your 5♥ (15) and A♣ (16): 78 to 73.',
            },
            {
              label: 'Nobody — it’s a tie',
              correct: false,
              feedback:
                'Not this time: it’s 78 to 73. Nobody scores the point only when the totals are exactly equal.',
            },
          ],
          proHint:
            '7s are king in the primiera, then 6s and Aces. Capture them during play and the primiera usually follows.',
        },
      },
      {
        narration:
          'Now the rest of the count. You captured 22 cards to their 18 (1 point), 6 [[diamonds]] to their 4 (1 point), the [[settebello]] (1 point) and one [[scopa]] (1 point). Your opponent won the primiera and sneaked in a scopa of their own later in the hand. Score: you 4, opponent 2. Next hand, the deal passes to you — first to 11 wins!',
        scene: {
          zones: [
            {
              id: 'yourDiamonds',
              label: 'Your diamonds (6)',
              cards: ['AD', '2D', '3D', '5D', '7D', 'KD'],
              layout: 'row',
              highlight: [4],
            },
            {
              id: 'oppDiamonds',
              label: 'Opponent’s diamonds (4)',
              cards: ['4D', '6D', 'JD', 'QD'],
              layout: 'row',
            },
            {
              id: 'scopa',
              label: 'Your scopa card',
              cards: ['KH'],
              layout: 'row',
              highlight: [0],
            },
          ],
          caption:
            'Cards, diamonds, Settebello and a scopa: 4 points for you, 2 for your opponent.',
        },
      },
    ],
    outro:
      'A lovely first hand! You grabbed the Settebello, kept the table too big to sweep, spotted a scopa and learned how the primiera is counted. A full game keeps going, hand after hand, until someone reaches 11. Ready to test yourself? Try the quiz!',
  },
  seo: {
    description:
      'Learn Scopa, Italy’s classic card game: capture by matching and adding, sweep the table, win the Settebello and count the primiera — with a clickable example hand.',
  },
});
