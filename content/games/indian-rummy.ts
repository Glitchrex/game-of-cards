import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'indian-rummy',
  name: 'Indian Rummy',
  aka: ['13-Card Rummy', 'Points Rummy'],
  origin: { country: 'India', countryCode: 'IN', region: 'south-asia' },
  type: 'rummy',
  players: { min: 2, max: 6, ideal: 2 },
  deck: 'Two standard 52-card decks plus two printed jokers (106 cards)',
  difficulty: 3,
  length: 'About 5–10 minutes a game',
  minutes: 8,
  moods: ['brainy', 'social', 'competitive'],
  hook: 'India’s favourite rummy: sort 13 cards into sequences and sets, then call “Declare!”',
  history:
    'Indian Rummy is the 13-card cousin of the rummy games that spread around the world in the early 1900s, and it is often described as a blend of Rummy 500 and Gin Rummy. Over the years it became a fixture of family gatherings and festival card parties across India — players even have their own nicknames for the key groups, calling the pure sequence the “first life” and the second sequence the “second life”. Today it is also one of the most popular card games played online in India.',
  featured: true,
  order: 120,
  variantTaught:
    '13-card Points Rummy, one deal per game. On this site you play one-on-one against a bot (the same rules work for 2–6 players). Two decks plus two printed jokers; 13 cards each; one card is turned up as the wild joker card and every card of its rank is a joker (if it is a printed joker, every Ace is). On your turn draw from the closed stock or the open pile, then discard. Declare when all 13 cards are in sets and sequences with at least two sequences, one of them pure. Everyone else pays their deadwood — A, K, Q, J and 10 count 10, number cards their face value, jokers 0, and every card counts without a pure sequence — up to 80 points. Before drawing you may drop out: 20 points before your first draw, 40 later. Beginner simplification: an invalid declaration is blocked with an explanation instead of costing 80 points. If 200 turns ever pass without a declaration, the lowest deadwood wins.',
  variants:
    'At most tables a wrong declaration costs the full 80 points — here the game simply tells you what is missing. Pool Rummy (101 or 201) plays many deals and knocks players out once their running total passes 101 or 201 points; Deals Rummy plays a fixed number of deals with chips. Some groups play without printed jokers, forbid picking a joker up from the open pile, use 25 and 50 points for first and middle drops, or play a 10-card version. Marriage (21-card) Rummy uses three decks and pays bonuses for special joker combinations.',
  glossary: [
    {
      term: 'sequence',
      definition:
        'Three or more cards in a row in the same suit, like 4♠ 5♠ 6♠. The Ace can be low (A-2-3) or high (Q-K-A), but a sequence never wraps around (K-A-2 is not allowed).',
    },
    {
      term: 'pure sequence',
      definition:
        'A sequence made without any joker standing in, like 9♥ 10♥ J♥. You need at least one to declare — players call it the “first life”.',
    },
    {
      term: 'impure sequence',
      definition:
        'A sequence where a joker fills a gap or an end, like 9♥ 10♥ (joker) Q♥. It counts as a sequence, but not as your pure one.',
    },
    {
      term: 'set',
      definition:
        'Three or four cards of the same rank in different suits, like 9♥ 9♦ 9♣. Two cards of the same suit can never be in one set, even though there are two decks.',
    },
    {
      term: 'wild joker',
      definition:
        'At the start a card is turned face up under the stock. Every other card of its rank, in any suit, is a joker for that game: if it is the 7♣, every 7 you hold is a joker. If it is a printed joker, every Ace is a joker.',
    },
    {
      term: 'printed joker',
      definition:
        'The two picture jokers in the pack. Like wild jokers they can stand in for any card you are missing, and they are worth 0 points.',
    },
    {
      term: 'declare',
      definition:
        'Finish the game: after drawing, throw your 14th card face down and show your other 13 cards, all in groups, with at least two sequences and one of them pure. The first valid declaration wins.',
    },
    {
      term: 'deadwood',
      definition:
        'Cards that are not in any set or sequence. When someone else declares, you pay what your deadwood is worth: a leftover K♣ and 9♠ cost 19 points. Without a pure sequence every card counts.',
    },
    {
      term: 'drop',
      definition:
        'Give up the game at the start of your turn, before drawing. It costs 20 points if you have not drawn a card yet this game (a first drop) and 40 points later (a middle drop).',
    },
    {
      term: 'closed stock',
      definition:
        'The face-down pile in the middle. Drawing from it gives you a surprise card that nobody else sees.',
    },
    {
      term: 'open pile',
      definition:
        'The face-up pile where everyone throws their discards. You may take its top card instead of drawing from the closed stock — but everyone sees what you took.',
    },
  ],
  lesson: [
    {
      title: 'The goal: every card in a group',
      body: 'Indian Rummy is a race to sort all 13 of your cards into groups: [[sets|set]] and [[sequences|sequence]]. The first player to [[declare]] a complete hand wins, and everyone else pays points for the cards they could not fit. To declare you need at least two sequences, and one of them must be a [[pure sequence]].',
      scene: {
        zones: [
          {
            id: 'pure1',
            label: 'Pure sequence',
            cards: ['4S', '5S', '6S'],
            layout: 'row',
            highlight: [0, 1, 2],
          },
          {
            id: 'pure2',
            label: 'Pure sequence',
            cards: ['9H', 'TH', 'JH', 'QH'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
          { id: 'set1', label: 'Set', cards: ['KS', 'KD', 'KC'], layout: 'row' },
          { id: 'set2', label: 'Set', cards: ['2H', '2C', '2D'], layout: 'row' },
        ],
        caption: 'All 13 cards in groups: two sequences (both pure) and two sets. A winning hand!',
      },
    },
    {
      title: 'The deal and the wild joker',
      body: 'Indian Rummy uses two normal decks plus two [[printed jokers|printed joker]] — 106 cards — so you may see the same card twice. Everyone gets 13 cards. The next card is turned face up under the [[closed stock]]: this is the [[wild joker]] card, and every card of its rank is a joker for this game. One more card is turned up to start the [[open pile]].',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['4S', '5S', '6S', '9H', '9D', 'JH', 'QH', '2C', '5D', '8C', 'KD', '7D', 'AH'],
            layout: 'fan',
            highlight: [11],
          },
          { id: 'wild', label: 'Wild joker card', cards: ['7C'], layout: 'row', highlight: [0] },
          {
            id: 'stock',
            label: 'Closed stock',
            cards: ['2S', '3D', 'TC'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
          { id: 'open', label: 'Open pile', cards: ['KH'], layout: 'stack' },
        ],
        caption: 'The wild joker card is the 7♣, so every 7 is a joker — including your 7♦!',
        animate: 'deal',
      },
    },
    {
      title: 'Your turn: draw one, throw one',
      body: 'On your turn, first draw one card: the top of the [[closed stock]] (a surprise) or the top of the [[open pile]] (you can see it). Now you hold 14 cards, so throw one face up onto the open pile. That’s a turn! Nobody may take the wild joker card itself. One more choice: right at the start of your turn, before drawing, you may [[drop]] out of the game for a fixed number of points.',
      scene: {
        zones: [
          { id: 'open', label: 'Open pile', cards: ['KH'], layout: 'stack', highlight: [0] },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['4S', '5S', '6S', '9H', '9D', 'JH', 'QH', '2C', '5D', '8C', 'KD', '7D', 'AH'],
            layout: 'fan',
            highlight: [5, 6],
          },
        ],
        caption:
          'The K♥ joins your J♥ Q♥ — take it, then throw a card you don’t need, like the 2♣.',
        animate: 'none',
      },
      tip: 'Taking from the open pile shows everyone what you are collecting. The closed stock keeps your plans secret.',
    },
    {
      title: 'Sequences, and the all-important pure one',
      body: 'A [[sequence]] is three or more cards in a row in the same suit, like 4♠ 5♠ 6♠. A [[pure sequence]] is one made without any joker — and you must have at least one to declare. The Ace can be low (A-2-3) or high (Q-K-A), but a sequence can’t wrap around: K-A-2 is not allowed.',
      scene: {
        zones: [
          {
            id: 'pure',
            label: 'Pure sequence',
            cards: ['4S', '5S', '6S'],
            layout: 'row',
            highlight: [0, 1, 2],
          },
          {
            id: 'high',
            label: 'Pure sequence, Ace high',
            cards: ['QD', 'KD', 'AD'],
            layout: 'row',
            highlight: [0, 1, 2],
          },
          {
            id: 'wrap',
            label: 'Not allowed: wraps round',
            cards: ['KC', 'AC', '2C'],
            layout: 'row',
          },
          {
            id: 'mixed',
            label: 'Not allowed: mixed suits',
            cards: ['8H', '9S', 'TH'],
            layout: 'row',
          },
        ],
        caption: 'Same suit, in a row, no wrapping round from King to Two.',
        animate: 'none',
      },
    },
    {
      title: 'Sets: same rank, different suits',
      body: 'A [[set]] is three or four cards of the same rank in different suits, like 9♥ 9♦ 9♣. Because there are two decks you might hold two identical cards — but a set can never use the same suit twice, so 5♥ 5♥ 5♠ is not a set. Sets are useful, but they never count as one of your two sequences.',
      scene: {
        zones: [
          {
            id: 'three',
            label: 'Set of three',
            cards: ['9H', '9D', '9C'],
            layout: 'row',
            highlight: [0, 1, 2],
          },
          {
            id: 'four',
            label: 'Set of four',
            cards: ['JS', 'JH', 'JD', 'JC'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
          { id: 'bad', label: 'Not a set: two Hearts', cards: ['5H', '5H', '5S'], layout: 'row' },
        ],
        caption: 'One card of each suit at most — so a set has 3 or 4 cards.',
        animate: 'none',
      },
    },
    {
      title: 'Jokers fill the gaps',
      body: 'A joker can stand in for any card you are missing. There are [[printed jokers|printed joker]], and there are [[wild jokers|wild joker]]: every card with the rank of the wild joker card. A sequence that uses a joker is an [[impure sequence]] — it still counts as one of your two sequences, but not as the pure one. A set may use a joker too.',
      scene: {
        zones: [
          { id: 'wild', label: 'Wild joker card', cards: ['7C'], layout: 'row', highlight: [0] },
          {
            id: 'impure',
            label: 'Impure sequence',
            cards: ['9H', 'TH', '7D', 'QH'],
            layout: 'row',
            highlight: [2],
          },
          {
            id: 'set',
            label: 'Set with a printed joker',
            cards: ['KS', 'KD', 'X1'],
            layout: 'row',
            highlight: [2],
          },
        ],
        caption: 'The 7♦ plays the J♥, and the printed joker plays a third King.',
        animate: 'none',
      },
      tip: 'A 7 sitting in its own place, as in 6♠ 7♠ 8♠, is just a normal card — that sequence is still pure. And if the wild joker card is a printed joker, every Ace is a joker instead.',
    },
    {
      title: 'Declaring: show your hand',
      body: 'When your 13 cards are all in groups — with at least two sequences and one of them pure — you can [[declare]]. Draw as usual, then throw your 14th card face down and show your hand. In our games the table checks your hand for you: if it isn’t ready yet, it explains exactly what is missing instead of punishing you.',
      scene: {
        zones: [
          {
            id: 'pure1',
            label: 'Pure sequence',
            cards: ['4S', '5S', '6S'],
            layout: 'row',
            highlight: [0, 1, 2],
          },
          { id: 'pure2', label: 'Pure sequence', cards: ['JH', 'QH', 'KH'], layout: 'row' },
          { id: 'set', label: 'Set', cards: ['9H', '9D', '9C'], layout: 'row' },
          {
            id: 'impure',
            label: 'Impure sequence (7♦ = joker)',
            cards: ['2D', '3D', '7D', '5D'],
            layout: 'row',
            highlight: [2],
          },
        ],
        caption:
          'With 7s wild, the 7♦ plays the 4♦. Throw your 14th card (the 8♣) face down and show these four groups. You win!',
        animate: 'none',
      },
      tip: 'At most real tables a wrong declaration costs 80 points, so always check for that pure sequence first.',
    },
    {
      title: 'Scoring: count your deadwood',
      body: 'When someone declares, everyone else counts their [[deadwood]]: the cards they could not fit into a group. Aces, Kings, Queens, Jacks and 10s are worth 10 points each, number cards their face value, and jokers 0. Careful: if you have no [[pure sequence]] yet, every card in your hand counts! Nobody pays more than 80 points. A [[drop]] costs 20 points before your first draw and 40 points later.',
      scene: {
        zones: [
          { id: 'pure', label: 'Pure sequence', cards: ['4S', '5S', '6S'], layout: 'row' },
          { id: 'set', label: 'Set', cards: ['8H', '8D', '8C'], layout: 'row' },
          {
            id: 'impure',
            label: 'Impure sequence (7♥ = joker)',
            cards: ['TS', '7H', 'QS'],
            layout: 'row',
          },
          {
            id: 'dead',
            label: 'Deadwood',
            cards: ['KC', '5H', '3D', '2H'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
        ],
        caption: 'Deadwood: K♣ 10 + 5♥ 5 + 3♦ 3 + 2♥ 2 = 20 points.',
        animate: 'none',
      },
    },
    {
      title: 'A tiny game, start to finish',
      body: 'The wild joker card is the 7♣, so your 7♦ is a joker. You already have two pure sequences (4♠ 5♠ 6♠ and J♥ Q♥ K♥) and a set of 9s. You draw the 3♦ from the [[closed stock]]: now 2♦ 3♦ 7♦ 5♦ is an [[impure sequence]], with the 7♦ playing the 4♦. Throw the 8♣ face down and [[declare]]! Priya has a pure sequence, so she only pays for her [[deadwood]]: K♣ J♦ 9♥ 3♣ = 32 points.',
      scene: {
        zones: [
          { id: 'drawn', label: 'You drew', cards: ['3D'], layout: 'row', highlight: [0] },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['4S', '5S', '6S', 'JH', 'QH', 'KH', '9H', '9D', '9C', '2D', '7D', '5D', '8C'],
            layout: 'fan',
            highlight: [9, 10, 11],
          },
          {
            id: 'priya',
            label: 'Priya',
            cards: ['8S', '9S', 'TS', '4H', '4D', '4S', '6D', '7S', '8D', 'KC', 'JD', '9H', '3C'],
            layout: 'fan',
            highlight: [9, 10, 11, 12],
          },
        ],
        caption: 'The 3♦ completes your hand. Priya’s loose K♣ J♦ 9♥ 3♣ cost her 32 points.',
        animate: 'flip',
      },
    },
    {
      title: 'Beginner strategy (and when to drop)',
      body: 'Build a [[pure sequence]] first — it is the one group you cannot do without, and it stops every card counting against you. Keep your jokers; never throw them away. Get rid of loose high cards (K, Q, J) early. Watch the [[open pile]]: if an opponent picks up your 8♥, don’t feed them another 8 or a heart next to it. And if your first 13 cards have no joker and nothing close to a sequence, a first [[drop]] for 20 points beats losing up to 80.',
      scene: {
        zones: [
          {
            id: 'weak',
            label: 'A hand to drop',
            cards: ['2S', '5S', '9S', 'QS', '3H', '6H', 'TH', 'KH', '4D', '8D', 'JD', 'AC', '5C'],
            layout: 'fan',
          },
          {
            id: 'keep',
            label: 'Always keep',
            cards: ['7D', 'X1'],
            layout: 'row',
            highlight: [0, 1],
          },
        ],
        caption: 'No joker and no cards in a row: a 20-point drop is the smart move.',
        animate: 'none',
      },
      tip: 'In practice mode, ask the coach for a hint whenever you are unsure what to throw.',
    },
  ],
  mistakes: [
    'Collecting sets and joker-filled sequences but forgetting the pure sequence — without it you can’t declare, and every card counts against you.',
    'Counting a sequence that uses a joker as your pure sequence. A pure sequence has no joker standing in.',
    'Throwing away a wild joker because it looks like an ordinary card. Always check the rank of the wild joker card.',
    'Trying to wrap a sequence round the corner, like K-A-2. The Ace is either low (A-2-3) or high (Q-K-A).',
    'Building a set with two cards of the same suit, like 5♥ 5♥ 5♠. With two decks it happens — but it isn’t a set.',
    'Holding loose Kings, Queens and Jacks for too long. If someone declares, each one costs you 10 points.',
    'Playing on with a hopeless first hand instead of dropping for just 20 points.',
  ],
  tips: [
    'Tip: in Indian Rummy, make your pure sequence first — it is the one group you can’t declare without.',
    'Tip: never throw a joker away. Jokers fill any gap, and they cost you 0 points.',
    'Tip: throw loose high cards early. A King you can’t use is 10 points waiting to be counted.',
    'Tip: two cards in a row in one suit, like 5♥ 6♥, can finish two ways (4♥ or 7♥). Keep them over a lonely card.',
    'Tip: notice what your opponent picks up from the open pile, and don’t throw them the cards next to it.',
    'Tip: no joker and nothing in a row in your first 13 cards? A first drop costs only 20 points.',
    'Tip: once you have a pure sequence, use your jokers to finish the second sequence quickly.',
  ],
  quiz: [
    {
      question: 'The wild joker card is the 7♣. Which of these is a pure sequence?',
      options: ['5♥ 6♥ 7♦ 8♥', '9♠ 10♠ J♠', 'Q♣ K♣ A♣ 2♣', '4♦ 4♠ 4♥'],
      answer: 1,
      explanation:
        '9♠ 10♠ J♠ is three cards in a row in one suit with no joker. 5♥ 6♥ 7♦ 8♥ uses the 7♦ as a joker (impure), Q-K-A-2 wraps round, and 4♦ 4♠ 4♥ is a set.',
    },
    {
      question: 'What do you need before you can declare?',
      options: [
        'Any three sets',
        'Just one pure sequence',
        'All 13 cards in groups, with at least two sequences and one of them pure',
        'Four sets and a joker',
      ],
      answer: 2,
      explanation:
        'Every card must be in a set or sequence, at least two of the groups must be sequences, and at least one sequence must be pure. Sets are welcome but never count as sequences.',
    },
    {
      question:
        'Someone declares. You have no pure sequence and your cards add up to 95 points. How many points do you pay?',
      options: ['95 points', '80 points', '40 points', '0 points'],
      answer: 1,
      explanation:
        'Without a pure sequence every card counts, but nobody ever pays more than 80 points.',
    },
    {
      question: 'The wild joker card is the 4♥. Which of these cards is a joker?',
      options: ['4♠', '5♥', 'A♥', 'K♣'],
      answer: 0,
      explanation:
        'Every card with the same rank as the wild joker card is a joker, whatever its suit — so the 4♠ is a joker.',
    },
    {
      question: 'Your first 13 cards have no joker and no cards in a row. What is a sensible move?',
      options: [
        'Declare straight away',
        'Take the wild joker card from under the stock',
        'Drop before your first draw — it costs only 20 points',
        'Keep every card and hope for the best',
      ],
      answer: 2,
      explanation:
        'A first drop costs 20 points, while a hopeless hand can easily cost up to 80 if someone declares. Nobody may ever take the wild joker card.',
    },
  ],
  seo: {
    description:
      'Learn 13-card Indian Rummy step by step: sets, pure and impure sequences, wild jokers, declaring and dropping — then play a coached game against friendly bots.',
  },
});
