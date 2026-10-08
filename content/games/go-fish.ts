import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'go-fish',
  name: 'Go Fish',
  aka: ['Fish'],
  origin: { country: 'Worldwide', countryCode: 'UN', region: 'global' },
  type: 'collecting',
  players: { min: 2, max: 5, ideal: 3 },
  deck: 'Standard 52-card deck (no jokers)',
  difficulty: 1,
  length: '5–10 minutes',
  minutes: 8,
  moods: ['chill', 'social', 'lucky'],
  hook: '"Got any Sevens?" The friendly asking game that is the perfect first card game for any family.',
  history:
    "Go Fish belongs to the 'quartet' family of card games, where players collect sets of four by asking each other for cards. A close cousin, Happy Families — played with specially drawn cards of characters such as Mr. Bun the Baker — became a nursery favourite in Britain in the 1800s. Nobody knows exactly where Go Fish itself began, but it is thought to have spread with the ordinary 52-card deck, and today it is often the very first card game children learn.",
  featured: false,
  order: 20,
  variantTaught:
    "Classic Go Fish with books of four, played by 2–5 players: 7 cards each with 2 or 3 players, 5 each with 4 or 5. On your turn you ask one player for a rank you already hold. If they have any, they hand over all of them and you go again. If not — 'Go Fish!' — you draw one card from the pond; if it is the rank you asked for, you show it and go again, otherwise the turn passes to the left. Four cards of a rank make a book, laid down at once. If your hand empties, you draw a card while the pond lasts; once the pond is empty, a player with no cards sits out. When all 13 books are made, the most books wins, and tied players share the pot.",
  variants:
    'Many families play for pairs instead of books of four: you only need two cards of a rank, which makes the game faster for very young children. Some tables end the game as soon as the pond is empty or someone runs out of cards, and some deal only 5 cards even for two players. In some versions a player who runs out of cards draws five new ones, and in others the turn always passes after one ask, even after a catch. Happy Families and Quartett are the same idea played with special picture decks.',
  glossary: [
    {
      term: 'collecting game',
      definition:
        'A game where you win by gathering matching sets of cards. In Go Fish the sets are books of four.',
    },
    {
      term: 'rank',
      definition:
        'The number or picture on a card: A, 2–10, J, Q or K. The 7♥ and the 7♣ have the same rank: they are both Sevens.',
    },
    {
      term: 'suit',
      definition:
        'One of the four families of cards: Spades ♠, Hearts ♥, Diamonds ♦ and Clubs ♣. Every rank comes in all four suits.',
    },
    {
      term: 'book',
      definition:
        'All four cards of one rank, such as 7♠ 7♥ 7♦ 7♣. You lay a book face up in front of you, and it is yours to keep.',
    },
    {
      term: 'pond',
      definition:
        'The face-down pile of leftover cards in the middle (some people call it the pool or the stock). You draw from it when someone says "Go Fish!", and when your hand runs out of cards.',
    },
    {
      term: 'Go Fish',
      definition:
        'What a player says when you ask for a rank they do not have. You then draw the top card of the pond (if any cards are left in it).',
    },
    {
      term: 'fish your wish',
      definition:
        'Drawing exactly the rank you asked for after hearing "Go Fish!". Show the card to everyone — you get to go again.',
    },
    {
      term: 'go again',
      definition:
        'Take another turn straight away. You go again after every catch, and after fishing your wish.',
    },
    {
      term: 'pot',
      definition:
        'The pretend Jeet every player puts in before the game. The player with the most books collects it; tied players share it.',
    },
  ],
  lesson: [
    {
      title: 'The goal: collect books of four',
      body: 'Go Fish is a [[collecting game]]. You try to gather [[books|book]]: all four cards of one [[rank]] — one of every [[suit]], like four Sevens. You get the cards you need by asking the other players for them. When every book has been made, whoever has the most books wins!',
      scene: {
        zones: [
          {
            id: 'book',
            label: 'A book of Sevens',
            cards: ['7S', '7H', '7D', '7C'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
        ],
        caption: 'Four Sevens — one of every suit — make one book.',
        animate: 'deal',
      },
    },
    {
      title: 'Deal 7 cards each (5 with 4 or 5 players)',
      body: 'Use one ordinary 52-card deck. With 2 or 3 players everyone gets 7 cards; with 4 or 5 players, 5 cards each. Spread the leftover cards face down in the middle: that messy pile is the [[pond]]. Hold your own cards so nobody else can see them.',
      scene: {
        zones: [
          {
            id: 'opponent',
            label: 'Player 1',
            cards: ['2S', '9H', 'QC', '4D', 'JS', '6H', 'TC'],
            layout: 'row',
            faceDown: [0, 1, 2, 3, 4, 5, 6],
          },
          {
            id: 'pond',
            label: 'Pond',
            cards: ['3S', '8D', 'AC'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['2C', '3H', '7S', '7D', '9C', 'KS', 'KD'],
            layout: 'fan',
          },
        ],
        caption: 'Seven cards each, and the rest go into the pond.',
        animate: 'deal',
      },
      tip: "The player on the dealer's left asks first, and turns go round the table to the left.",
    },
    {
      title: 'Your turn: ask for a rank you hold',
      body: "On your turn, pick ONE other player and ask them for a [[rank]] — for example, 'Player 1, do you have any Sevens?' The one rule: you may only ask for a rank you already hold at least one card of. With this hand you could ask for Twos, Threes, Sevens, Nines or Kings — but not Queens.",
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['2C', '3H', '7S', '7D', '9C', 'KS', 'KD'],
            layout: 'fan',
            highlight: [2, 3],
          },
        ],
        caption: 'You hold two Sevens, so you may ask for Sevens.',
        animate: 'deal',
      },
      tip: 'Grouping your cards by rank makes it easy to see what you can ask for.',
    },
    {
      title: 'A catch: they hand over ALL of them',
      body: 'If the player has any cards of that rank, they must give you every one of them — not just one. Then you [[go again]]: ask anyone for any rank you hold. Here Player 1 had one Seven, the 7♥, so now you hold three.',
      scene: {
        zones: [
          {
            id: 'given',
            label: 'Player 1 hands over',
            cards: ['7H'],
            layout: 'row',
            highlight: [0],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['2C', '3H', '7S', '7H', '7D', '9C', 'KS', 'KD'],
            layout: 'fan',
            highlight: [2, 3, 4],
          },
        ],
        caption: "A catch! You now hold three Sevens — and it's still your turn.",
        animate: 'deal',
      },
    },
    {
      title: 'Go Fish! Draw from the pond',
      body: "If the player has none, they say '[[Go Fish]]!' and you take the top card of the [[pond]]. If it is the very rank you asked for, show it to everyone — you [[fish your wish]] and go again. Any other card stays in your hand, and your turn is over: play passes to the left. (If the pond is empty, there is nothing to draw and the turn simply passes.)",
      scene: {
        zones: [
          {
            id: 'pond',
            label: 'Pond',
            cards: ['8D', 'AC'],
            layout: 'stack',
            faceDown: [0, 1],
          },
          {
            id: 'drawn',
            label: 'You drew',
            cards: ['KH'],
            layout: 'row',
            highlight: [0],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['2C', '3H', '7S', '7H', '7D', '9C', 'KS', 'KH', 'KD'],
            layout: 'fan',
            highlight: [6, 7, 8],
          },
        ],
        caption:
          "You asked Player 2 for Kings — 'Go Fish!' — and drew the K♥. You fished your wish: go again!",
        animate: 'deal',
      },
    },
    {
      title: 'Four of a kind? Lay down a book',
      body: 'The moment you hold all four cards of a rank, lay them face up in front of you. That is a [[book]], and it stays yours for the rest of the game. It happens straight away — after a catch, after a draw, even if you were dealt four of a kind.',
      scene: {
        zones: [
          {
            id: 'book',
            label: 'Your book',
            cards: ['7S', '7H', '7D', '7C'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['2C', '3H', '9C', 'KS', 'KH', 'KD'],
            layout: 'fan',
          },
        ],
        caption: 'Player 2 handed over the 7♣ — four Sevens! Lay the book down and keep asking.',
        animate: 'deal',
      },
      tip: 'A book is safe forever: nobody can take it from you.',
    },
    {
      title: 'Out of cards? Draw one',
      body: 'If your hand ever becomes empty — because your last cards became a book, or you handed them over — draw one card from the [[pond]] straight away, and if it is your turn, keep asking. Once the pond is empty too, a player with no cards sits out until the end, and nobody can ask them for anything.',
      scene: {
        zones: [
          {
            id: 'book',
            label: 'Your new book',
            cards: ['9S', '9H', '9D', '9C'],
            layout: 'row',
          },
          {
            id: 'pond',
            label: 'Pond',
            cards: ['QS', '6C'],
            layout: 'stack',
            faceDown: [0, 1],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['5H'],
            layout: 'fan',
            highlight: [0],
          },
        ],
        caption:
          'Your last three Nines plus the one you caught made a book. Your hand was empty, so you drew the 5♥.',
        animate: 'deal',
      },
    },
    {
      title: 'Winning: the most books',
      body: 'The game ends when all 13 books have been laid down. Count them up: the player with the most books wins the [[pot]]. If two or more players tie for the most, they share it.',
      scene: {
        zones: [
          {
            id: 'you',
            label: 'You: 5 books',
            cards: ['AS', '4H', '7D', 'TC', 'KS'],
            layout: 'row',
            highlight: [0, 1, 2, 3, 4],
          },
          {
            id: 'p1',
            label: 'Player 1: 4 books',
            cards: ['2H', '5C', '8S', 'QD'],
            layout: 'row',
          },
          {
            id: 'p2',
            label: 'Player 2: 4 books',
            cards: ['3D', '6S', '9H', 'JC'],
            layout: 'row',
          },
        ],
        caption: 'One card shown for each book. Your 5 books beat 4 and 4 — you win!',
        animate: 'deal',
      },
    },
    {
      title: 'A tiny example',
      body: "You hold the 5♣, 5♥ and J♦. You ask Player 1 for Fives and they hand over the 5♠ — a catch, so you go again. You ask Player 2 for Fives: 'Go Fish!' You draw the 5♦ — the rank you asked for! That makes four Fives, a [[book]], and you go again. You ask Player 1 for Jacks: 'Go Fish!' You draw the 2♠, so play passes to Player 1.",
      scene: {
        zones: [
          {
            id: 'book',
            label: 'Your book',
            cards: ['5S', '5H', '5D', '5C'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['2S', 'JD'],
            layout: 'fan',
          },
        ],
        caption: 'A catch, a fished wish and a book — then a miss. A great turn!',
        animate: 'deal',
      },
    },
    {
      title: 'Beginner strategy: listen and remember',
      body: "Every question gives away a secret: a player who asks for a rank must hold it — so if you hold that rank too, ask them for it on your turn! If a player just said '[[Go Fish]]' to Fives, don't ask them for Fives again unless they have drawn a card since. Ask for the rank you hold the most of, and when you have no clues, try the player holding the most cards.",
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['3D', '8S', 'QH', 'QC'],
            layout: 'fan',
            highlight: [2, 3],
          },
        ],
        caption:
          'Player 2 just asked for Queens and missed — so Player 2 still has one. On your turn, ask Player 2 for Queens!',
        animate: 'deal',
      },
      tip: 'Asking for a rank tells everyone you hold it. Be ready for them to ask you back!',
    },
  ],
  mistakes: [
    "Asking for a rank you don't hold — you must already have at least one card of it.",
    'Handing over only one card when you hold several of the rank that was asked for — you must give them all.',
    'Ending your turn after a catch — when you get cards, you go again.',
    'Forgetting to lay down a book the moment you hold all four cards of a rank.',
    'Not listening to the other players: someone who asks for a rank is telling you they hold it.',
    "Asking the same player for the same rank right after they said 'Go Fish' — they still have none.",
  ],
  tips: [
    'Tip: in Go Fish, a player who asks for a rank must hold it — if you hold it too, ask them for it on your turn.',
    "Tip: a player who just said 'Go Fish' to Fives has none — unless they have drawn a card since.",
    'Tip: ask for the rank you hold the most of — one catch could complete a book.',
    'Tip: after a catch you go again, so start your turn with your surest ask.',
    'Tip: a player who caught cards from someone still holds that rank until somebody takes it back.',
    'Tip: when you have no clues at all, ask the player holding the most cards.',
    'Tip: once the pond is empty, count — every card that is not in a book or in your hand must be in another player’s hand.',
  ],
  quiz: [
    {
      question: 'You hold the 7♠, the 7♦ and the K♣. What may you ask for?',
      options: ['Queens', 'Sevens or Kings', 'Any rank you like', 'Only Aces'],
      answer: 1,
      explanation:
        'You may only ask for a rank you already hold. You have Sevens and a King, so Sevens or Kings.',
    },
    {
      question: 'You ask Player 1 for Fives, and they hold two Fives. What happens?',
      options: [
        'They hand over both Fives and you go again',
        'They hand over one Five and you go again',
        'They hand over both Fives and your turn ends',
        "They say 'Go Fish!'",
      ],
      answer: 0,
      explanation:
        'A player who holds the rank must give you ALL of those cards — and a catch means you take another turn.',
    },
    {
      question: "You ask for Jacks, hear 'Go Fish!' and draw a Jack from the pond. What now?",
      options: [
        'Your turn is over',
        'Put the Jack back in the pond',
        'Show it and go again',
        'Give it to the player you asked',
      ],
      answer: 2,
      explanation:
        'Drawing the very rank you asked for is called fishing your wish. Show it to everyone and take another turn.',
    },
    {
      question: "Player 2 asks Player 1 for Nines and hears 'Go Fish!'. What does that tell you?",
      options: [
        'Nothing at all',
        'Player 2 has no Nines',
        'Player 2 already has a book of Nines',
        'Player 2 holds at least one Nine',
      ],
      answer: 3,
      explanation:
        'You may only ask for a rank you hold, so Player 2 must have at least one Nine — and Player 1 has none. If you hold a Nine too, ask Player 2 for Nines on your turn!',
    },
    {
      question: 'When does the game end, and who wins?',
      options: [
        'When the pond is empty; fewest cards wins',
        'When all 13 books are made; most books wins',
        'When someone makes 3 books; they win',
        'When one player runs out of cards; they win',
      ],
      answer: 1,
      explanation:
        'Play goes on until all 13 books are on the table. Then the player with the most books wins (ties share the pot).',
    },
  ],
  seo: {
    description:
      "Learn Go Fish step by step: ask for ranks you hold, catch cards or 'Go Fish' from the pond, collect books of four — then play friendly bots.",
  },
});
