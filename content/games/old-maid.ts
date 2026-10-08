import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'old-maid',
  name: 'Old Maid',
  origin: { country: 'United Kingdom', countryCode: 'GB', region: 'europe' },
  type: 'collecting',
  players: { min: 2, max: 8, ideal: 4 },
  deck: 'A standard 52-card deck with one Queen taken out (51 cards), no jokers',
  difficulty: 1,
  length: '5–10 minutes a game',
  minutes: 8,
  moods: ['social', 'lucky'],
  hook: 'The giggly pairs game where everybody hopes they’re not the one left holding the last Queen',
  history:
    'Old Maid is thought to have been a favourite in Victorian Britain, and by the late 1800s ' +
    'special Old Maid decks — with funny picture pairs instead of numbers — were being sold for ' +
    'children in Britain and America. Many countries play a game just like it: in Germany it is ' +
    'Schwarzer Peter (“Black Peter”), and in Japan it is Babanuki, where a Joker is the card ' +
    'nobody wants to be left holding.',
  featured: false,
  order: 70,
  variantTaught:
    'Classic Old Maid with a standard deck, for 2–8 players (taught with four). Take one Queen out ' +
    'of the deck (many families take out the Q♣), leaving three Queens, so one of them can never ' +
    'be paired. Deal all 51 cards one at a time (some players get one card more than others). A ' +
    'pair is any two cards of the same rank, whatever their suit or colour. Everyone first puts ' +
    'down all their pairs; with three of a kind, put down two and keep the third. Then the player ' +
    'on the dealer’s left begins: on your turn you take one card, without looking, from the ' +
    'face-down fan of the player on your right, put down any pair it makes, and then the player ' +
    'on your left takes a card from you. Players who run out of cards are safe and drop out. When ' +
    'every pair is down, the player left holding the last Queen — the Old Maid — loses.',
  variants:
    'Many families only count two cards as a pair when they are the same colour too (the 7♠ pairs ' +
    'with the 7♣, the 7♥ with the 7♦) and take out the Q♣, so the Q♠ is always the Old Maid. Some ' +
    'add a Joker as the odd card instead of removing a Queen — that is how Japan’s Babanuki works. ' +
    'A similar French game uses a Jack as the odd card instead of a Queen, and Germany’s Schwarzer ' +
    'Peter is usually played with a special deck whose odd card is the “Black Peter”. Shop-bought ' +
    'Old Maid decks use pairs of pictures instead of ranks. Tables also differ on direction: some ' +
    'take cards from the player on their left instead.',
  glossary: [
    {
      term: 'pair',
      definition:
        'Two cards of the same rank, like the 7♠ and the 7♦ or two Kings. Suit and colour don’t matter in the classic game.',
    },
    {
      term: 'suit',
      definition:
        'One of the four families of cards: Spades ♠, Hearts ♥, Diamonds ♦ and Clubs ♣. Hearts and Diamonds are red; Spades and Clubs are black.',
    },
    {
      term: 'rank',
      definition:
        'What a card is, ignoring its suit: Ace, 2, 3 … 10, Jack, Queen or King. The 9♥ and the 9♣ have the same rank.',
    },
    {
      term: 'three of a kind',
      definition:
        'Three cards of the same rank, like three 7s. Only two of them make a pair, so you put two down and keep the third.',
    },
    {
      term: 'Old Maid',
      definition:
        'The one Queen that can never be paired, because another Queen was taken out before the deal. Whoever holds it at the end loses.',
    },
    {
      term: 'discard pile',
      definition:
        'The face-up heap in the middle where everyone puts their pairs. Cards there are out of the game.',
    },
    {
      term: 'fan',
      definition:
        'Cards spread out in your hand like a fan. In Old Maid you offer your fan face down, so the other player can pick a card without seeing it.',
    },
    {
      term: 'going out',
      definition:
        'Getting rid of your very last card. Once you have gone out you are safe — you can’t be the Old Maid.',
    },
    {
      term: 'poker face',
      definition:
        'Keeping the same calm face whatever happens, so nobody can guess what you are holding — especially the Old Maid!',
    },
  ],
  lesson: [
    {
      title: 'The goal: pair up and get out',
      body:
        'In Old Maid you get rid of your cards by matching them into [[pairs|pair]]. Run out of ' +
        'cards and you are safe! One card can never be matched: the [[Old Maid]]. Whoever is left ' +
        'holding it at the very end loses — so everyone hopes it ends up with somebody else.',
      scene: {
        zones: [
          {
            id: 'pair',
            label: 'A pair: two 7s',
            cards: ['7S', '7D'],
            layout: 'row',
            highlight: [0, 1],
          },
          {
            id: 'maid',
            label: 'The card nobody wants',
            cards: ['QS'],
            layout: 'row',
            highlight: [0],
          },
        ],
        caption: 'Pairs leave your hand. The lonely Queen never does.',
        animate: 'deal',
      },
    },
    {
      title: 'Setting up: take out one Queen',
      body:
        'Take one Queen out of a normal deck and put it away — many families take out the Q♣. Now ' +
        'there are 51 cards and only three Queens, so one Queen will always be left without a ' +
        'partner. Shuffle and deal ALL the cards, one at a time, around the table. It’s fine if ' +
        'some players get one card more than others.',
      scene: {
        zones: [
          {
            id: 'out',
            label: 'Taken out of the game',
            cards: ['QC'],
            layout: 'row',
            faceDown: [0],
          },
          {
            id: 'queens',
            label: 'Three Queens are left',
            cards: ['QS', 'QH', 'QD'],
            layout: 'row',
            highlight: [0, 1, 2],
          },
        ],
        caption: 'Three Queens: two can make a pair, but the third is always left alone.',
        animate: 'deal',
      },
      tip: 'With four players, 51 cards means three players get 13 cards and one gets 12.',
    },
    {
      title: 'What counts as a pair',
      body:
        'A [[pair]] is two cards of the same [[rank]] — two 7s, two Kings, two Aces. Their ' +
        '[[suits|suit]] and colours don’t matter. If you have [[three of a kind]], only two of them make a pair: ' +
        'put two down and keep the third. It may find a partner later.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['3S', '7S', '7H', '7D', '9H', 'JC', 'KC', 'KH'],
            layout: 'fan',
            highlight: [1, 2, 6, 7],
          },
        ],
        caption: '7♠ 7♥ make a pair, and so do K♣ K♥. The 7♦ has to wait for the last 7.',
        animate: 'deal',
      },
      tip: 'Sort your cards by rank as soon as you pick them up — pairs jump right out.',
    },
    {
      title: 'First, everyone puts down pairs',
      body:
        'Before anyone takes a card, every player puts all their [[pairs|pair]] face up on the ' +
        '[[discard pile]] in the middle. Cards there are out of the game for good. Now everyone ' +
        'holds a smaller hand — and no pairs at all.',
      scene: {
        zones: [
          {
            id: 'discard',
            label: 'Discard pile',
            cards: ['7S', '7H', 'KC', 'KH'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
          {
            id: 'hand',
            label: 'Your hand afterwards',
            cards: ['3S', '7D', '9H', 'JC'],
            layout: 'fan',
          },
        ],
        caption: 'Two pairs down, four cards left in your hand.',
        animate: 'deal',
      },
    },
    {
      title: 'A turn: pick a card, any card',
      body:
        'The player on the dealer’s left goes first, then play moves to the left. On your turn, ' +
        'the player on your right holds their cards in a face-down [[fan]]. Pick one without ' +
        'looking! If it makes a [[pair]] with a card you hold, put the pair down. Then the player ' +
        'on your left picks a card from you, and so on around the table.',
      scene: {
        zones: [
          {
            id: 'right',
            label: 'Player on your right (face down)',
            cards: ['2C', '8D', 'JH', '5H'],
            layout: 'fan',
            faceDown: [0, 1, 2, 3],
            highlight: [2],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['3S', '7D', '9H', 'JC'],
            layout: 'fan',
            highlight: [3],
          },
        ],
        caption: 'You pick the glowing card: it’s the J♥ — a pair with your J♣!',
        animate: 'deal',
      },
    },
    {
      title: 'Meet the Old Maid',
      body:
        'Sooner or later, two of the three Queens meet up and go down as a pair. The last Queen ' +
        'can never be matched — she is the [[Old Maid]]. If she lands in your hand, keep a ' +
        '[[poker face]]! If nobody knows you have her, the next player is just as likely to take ' +
        'her from you as any other card.',
      scene: {
        zones: [
          {
            id: 'discard',
            label: 'Discard pile',
            cards: ['QH', 'QD'],
            layout: 'row',
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['4H', 'QS', '9C'],
            layout: 'fan',
            highlight: [1],
          },
        ],
        caption: 'The Q♥ and Q♦ are paired up, so the Q♠ is the Old Maid. Shh — keep smiling!',
        animate: 'deal',
      },
    },
    {
      title: 'Going out — and who loses',
      body:
        'When you get rid of your last card — by pairing it or because someone took it — you have ' +
        'gone [[out|going out]]. You are safe! The others keep playing until every pair is down; ' +
        'if the player you would pick from is out, just pick from the next player still in. ' +
        'Then only one card is left in the whole game: the [[Old Maid]]. Whoever holds her loses ' +
        'the game — and usually gets a lot of friendly teasing.',
      scene: {
        zones: [
          {
            id: 'safe',
            label: 'Your last pair: you’re out!',
            cards: ['5S', '5D'],
            layout: 'row',
            highlight: [0, 1],
          },
          {
            id: 'loser',
            label: 'Left with the Old Maid',
            cards: ['QS'],
            layout: 'row',
            highlight: [0],
          },
        ],
        caption: 'One player goes out safely; another is left holding the Queen.',
        animate: 'deal',
      },
    },
    {
      title: 'A tiny example',
      body:
        'You hold the 5♠ and the 8♣. You pick a card from the player on your right: the 8♥ — a ' +
        '[[pair]]! Down go the 8s onto the [[discard pile]], leaving you with just the 5♠. When ' +
        'the player on your left takes it from you, you have no cards left: you’re out and safe.',
      scene: {
        zones: [
          {
            id: 'discard',
            label: 'Discard pile',
            cards: ['8C', '8H'],
            layout: 'row',
            highlight: [0, 1],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['5S'],
            layout: 'fan',
            highlight: [0],
          },
        ],
        caption: 'One card left. As soon as it goes, you are safe.',
        animate: 'deal',
      },
    },
    {
      title: 'Beginner strategy',
      body:
        'Old Maid is mostly luck, but a few habits help. Sort your hand so pairs are easy to see. ' +
        'Before you offer your [[fan]], mix your cards so the [[Old Maid]] is never in the same ' +
        'spot twice. Keep your [[poker face]] whatever you draw. And when you pick, watch the other ' +
        'player’s face — some people can’t help smiling when your fingers touch the Queen!',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your cards, mixed and offered face down',
            cards: ['3D', 'QS', 'TC', '6H'],
            layout: 'fan',
            faceDown: [0, 1, 2, 3],
            highlight: [1],
          },
        ],
        caption: 'Can you tell which one is the Queen? Neither can they.',
        animate: 'deal',
      },
      tip: 'If the player on your left takes the Old Maid from you, relax — she has to pass through every other player still in the game before she can come back.',
    },
  ],
  mistakes: [
    'Putting down three of a kind as if it were a pair — only two cards go down; the third stays in your hand.',
    'Forgetting to put a pair down as soon as you make it.',
    'Gasping, groaning or grinning when you draw the Old Maid, so everyone knows where she is.',
    'Holding a card back or hiding the Old Maid — you must offer every card you hold.',
    'Keeping the Old Maid in the same spot in your fan every time, so sharp players learn to avoid it.',
    'Thinking two cards of the same suit, like the Q♥ and K♥, make a pair — a pair needs the same rank.',
  ],
  tips: [
    'Tip: in Old Maid, sort your cards by rank the moment you pick them up — pairs are easy to spot.',
    'Tip: mix your cards before every offer, so the Old Maid never sits in the same place twice.',
    'Tip: keep the same calm face whatever you draw — the Old Maid hides best when nobody knows where she is.',
    'Tip: with three of a kind, put two down and keep the third — the fourth card of that rank is still out there.',
    'Tip: if the player on your left took the Old Maid from you, she has to pass through every other player still in the game before she can come back.',
    'Tip: when only two players are left, watch your opponent’s face as your fingers hover over each card.',
    'Tip: losing Old Maid is just bad luck, not a bad brain — shuffle up and play again!',
  ],
  quiz: [
    {
      question: 'Which two cards make a pair in Old Maid?',
      options: ['7♠ and 8♠', 'Q♥ and K♥', '7♠ and 7♦', '2♣ and A♣'],
      answer: 2,
      explanation:
        'A pair is two cards of the same rank. The 7♠ and 7♦ are both 7s, so they pair — the suit doesn’t matter.',
    },
    {
      question: 'You are dealt three 4s. What do you do with them?',
      options: [
        'Put two down as a pair and keep one',
        'Put all three down',
        'Keep all three in your hand',
      ],
      answer: 0,
      explanation:
        'Only two cards make a pair, so two 4s go down and the third stays in your hand until the last 4 turns up.',
    },
    {
      question: 'Why can the Old Maid never be paired?',
      options: [
        'Queens are not allowed in pairs',
        'She is the highest card',
        'She is always dealt face up',
        'One Queen was taken out, so only three Queens are in the game',
      ],
      answer: 3,
      explanation:
        'With one Queen removed, three are left. Two of them can make a pair, but the third will always be alone.',
    },
    {
      question: 'The player on your left takes your very last card. What happens to you?',
      options: [
        'You draw a new card from the deck',
        'You are out — and safe!',
        'You lose the game',
        'You must take a card back',
      ],
      answer: 1,
      explanation:
        'Once you have no cards left you have gone out. You are safe, and the others play on until only the Old Maid is left.',
    },
    {
      question: 'You have just picked the Old Maid. What is the smartest thing to do?',
      options: [
        'Tell everyone so the game is fair',
        'Hide her in your lap',
        'Keep a calm face and mix her in with your other cards',
      ],
      answer: 2,
      explanation:
        'A poker face gives nothing away, so the next player is as likely to take her as any other card. Hiding cards is not allowed.',
    },
  ],
  example: {
    intro:
      'A four-player game: you, Sam on your left, Mia opposite and Leo on your right. Leo deals. You make the calls — and try not to be the one left holding the Queen!',
    steps: [
      {
        narration:
          'Leo deals all 51 cards, one at a time. You get 13 (Leo, the dealer, ends up with 12). Before anyone picks a card, everybody puts down their [[pairs|pair]]. Look: you have [[three of a kind]] — three 7s — and two Kings.',
        scene: {
          zones: [
            {
              id: 'hand',
              label: 'Your hand (13 cards)',
              cards: ['AS', '2H', '3S', '4C', '5S', '7S', '7H', '7D', '8C', '9H', 'JC', 'KC', 'KH'],
              layout: 'fan',
              highlight: [5, 6, 7, 11, 12],
            },
          ],
          caption: 'Three 7s and two Kings. What goes down?',
          animate: 'deal',
        },
        decision: {
          prompt: 'What do you put down?',
          options: [
            {
              label: 'All three 7s and both Kings',
              correct: false,
              feedback:
                'Three cards aren’t a pair. Put down two of the 7s and keep one in your hand.',
            },
            {
              label: 'Two of the 7s and both Kings',
              correct: true,
              feedback:
                'Right! A pair is exactly two cards. With three 7s you put two down and keep the third — it might pair up with the last 7 later.',
            },
            {
              label: 'Nothing yet — save the pairs for later',
              correct: false,
              feedback:
                'Pairs go down straight away. The fewer cards you hold, the sooner you are safe.',
            },
          ],
          proHint: 'Pros sort their hand by rank first — then the pairs jump right out.',
        },
      },
      {
        narration:
          'Everyone puts their pairs on the [[discard pile]]. Mia puts down the Q♥ and the Q♦ — so only one Queen is left in the whole game: the Q♠. That is the [[Old Maid]]! Somebody is holding her… but who?',
        scene: {
          zones: [
            {
              id: 'discard',
              label: 'Discard pile',
              cards: ['7S', '7H', 'KC', 'KH', 'QH', 'QD'],
              layout: 'row',
              highlight: [4, 5],
            },
            {
              id: 'hand',
              label: 'Your hand (9 cards)',
              cards: ['AS', '2H', '3S', '4C', '5S', '7D', '8C', '9H', 'JC'],
              layout: 'fan',
            },
          ],
          caption: 'Two Queens are paired up. The third one is the Old Maid.',
          animate: 'deal',
        },
      },
      {
        narration:
          'You sit on the dealer’s left, so you go first: Leo holds his cards in a face-down [[fan]] and you pull one out. It’s the 9♣!',
        scene: {
          zones: [
            {
              id: 'leo',
              label: 'Leo (on your right)',
              cards: ['TD', '4H', '2D', '6S', 'QS'],
              layout: 'fan',
              faceDown: [0, 1, 2, 3, 4],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['AS', '2H', '3S', '4C', '5S', '7D', '8C', '9H', '9C', 'JC'],
              layout: 'fan',
              highlight: [7, 8],
            },
          ],
          caption: 'The 9♣ joins your 9♥.',
          animate: 'deal',
        },
        decision: {
          prompt: 'You now hold the 9♥ and the 9♣. What do you do?',
          options: [
            {
              label: 'Keep them to confuse everyone',
              correct: false,
              feedback:
                'Pairs go down as soon as you make them — holding on to them only keeps you in the game longer.',
            },
            {
              label: 'Give the 9♣ back to Leo',
              correct: false,
              feedback: 'Once you have picked a card, it is yours. No take-backs!',
            },
            {
              label: 'Put them down as a pair',
              card: '9C',
              correct: true,
              feedback: 'Yes! Two 9s are a pair, so down they go. One step closer to being safe.',
            },
          ],
          proHint:
            'Pros put pairs down the moment they make them — without letting their face show anything.',
        },
      },
      {
        narration:
          'Round and round the cards go, and pairs keep landing on the [[discard pile]]. You are down to the 5♠ and the J♣. Then, on your turn, you pull a card from Leo… the Q♠. The [[Old Maid]]! Sam, on your left, will pick from you next.',
        scene: {
          zones: [
            {
              id: 'leo',
              label: 'Leo (on your right)',
              cards: ['TD', '6S'],
              layout: 'fan',
              faceDown: [0, 1],
            },
            {
              id: 'discard',
              label: 'Discard pile',
              cards: ['QD', '9H', '9C'],
              layout: 'stack',
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['5S', 'JC', 'QS'],
              layout: 'fan',
              highlight: [2],
            },
          ],
          caption: 'Uh-oh. The Q♠ is in your hand.',
          animate: 'deal',
        },
        decision: {
          prompt: 'What do you do?',
          options: [
            {
              label: 'Keep a calm face and mix your cards',
              correct: true,
              feedback:
                'Perfect poker face! If nobody knows you have her, Sam is just as likely to take the Queen as any other card.',
            },
            {
              label: 'Groan “Oh no!”',
              correct: false,
              feedback: 'Now everyone knows — and Sam will carefully pick around her.',
            },
            {
              label: 'Put the Q♠ down with your J♣',
              card: 'QS',
              correct: false,
              feedback:
                'A Queen and a Jack aren’t a pair — a pair needs the same rank. The Old Maid can never be put down.',
            },
          ],
          proHint: 'Pros never react to what they draw. Happy or sad, the face stays the same.',
        },
      },
      {
        narration:
          'You give your cards a quick secret mix. Now Sam reaches across to pick one of your three cards. How should your [[fan]] look?',
        scene: {
          zones: [
            {
              id: 'sam',
              label: 'Sam (on your left)',
              cards: ['3H', '8D', 'KS'],
              layout: 'fan',
              faceDown: [0, 1, 2],
            },
            {
              id: 'hand',
              label: 'Your hand (Sam only sees the backs)',
              cards: ['JC', 'QS', '5S'],
              layout: 'fan',
              highlight: [1],
            },
          ],
          caption: 'The Queen is hiding in the middle.',
          animate: 'none',
        },
        decision: {
          prompt: 'How do you offer your cards to Sam?',
          options: [
            {
              label: 'Keep the Q♠ hidden in your lap',
              card: 'QS',
              correct: false,
              feedback: 'Not allowed — you must offer every card you hold. That would be cheating!',
            },
            {
              label: 'Mixed up, fanned out evenly, face down',
              correct: true,
              feedback:
                'Just right. Every card looks the same from the back, so Sam has a one-in-three chance of taking the Queen.',
            },
            {
              label: 'Always put the Q♠ on the far left',
              card: 'QS',
              correct: false,
              feedback:
                'If you always hide her in the same spot, sharp players will notice. Mix your cards every time.',
            },
          ],
          proHint:
            'Pros mix their cards every turn so the Old Maid never sits in a pattern anyone could learn.',
        },
      },
      {
        narration:
          'Sam takes the middle card — the Q♠! Phew. Sam keeps a straight face, but you know exactly where the [[Old Maid]] is now. She will have to travel all the way round the table to come back to you.',
        scene: {
          zones: [
            {
              id: 'sam',
              label: 'Sam (on your left)',
              cards: ['3H', '8D', 'KS', 'QS'],
              layout: 'fan',
              faceDown: [0, 1, 2, 3],
              highlight: [3],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JC', '5S'],
              layout: 'fan',
            },
          ],
          caption: 'The Queen has moved on. Breathe out!',
          animate: 'none',
        },
      },
      {
        narration:
          'Many turns later, Sam and Mia have both gone out — they are safe. But the Q♠ travelled from Sam to Mia, and from Mia to Leo. Now only you and Leo are left. You hold the 5♠; Leo holds two cards: the 5♦ and the [[Old Maid]]. It is your turn to pick.',
        scene: {
          zones: [
            {
              id: 'leo',
              label: 'Leo (2 cards)',
              cards: ['5D', 'QS'],
              layout: 'fan',
              faceDown: [0, 1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['5S'],
              layout: 'fan',
              highlight: [0],
            },
          ],
          caption: 'One card is your pair. The other is the Queen.',
          animate: 'deal',
        },
        decision: {
          prompt: 'Which of Leo’s two cards do you pick?',
          options: [
            {
              label: 'The card on the left',
              correct: true,
              feedback:
                'Good luck! You can’t see the faces, so this is a true 50/50 — that is Old Maid. Let’s see what you got…',
            },
            {
              label: 'The card on the right',
              correct: true,
              feedback:
                'Either card is a fine choice — nobody can see through the backs. It’s a coin toss. Let’s see what you got…',
            },
          ],
          proHint:
            'Even pros can’t see through cards! They just watch the other player’s face for a clue — and keep their own face calm.',
        },
      },
      {
        narration:
          'It’s the 5♦ — a [[pair]] with your 5♠! Down they go, and your hand is empty: you have gone out, and you are safe. Leo is left holding the Q♠. Leo is the [[Old Maid]] this time — cue friendly groans, a big shuffle and a rematch.',
        scene: {
          zones: [
            {
              id: 'discard',
              label: 'Your last pair',
              cards: ['5S', '5D'],
              layout: 'row',
              highlight: [0, 1],
            },
            {
              id: 'leo',
              label: 'Leo: left with the Old Maid',
              cards: ['QS'],
              layout: 'row',
              highlight: [0],
            },
          ],
          caption: 'You’re safe! Leo holds the last Queen.',
          animate: 'flip',
        },
      },
    ],
    outro:
      'You put down only true pairs, matched cards the moment they paired, kept a poker face with the Queen and offered your cards fairly. The rest was luck — and this time luck smiled on you. Ready to test yourself? Try the quiz!',
  },
  seo: {
    description:
      'Learn Old Maid, the classic pairs card game for kids and families: take out one Queen, match pairs, keep a poker face and don’t get stuck with the Old Maid.',
  },
});
