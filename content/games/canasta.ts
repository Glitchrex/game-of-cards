import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'canasta',
  name: 'Canasta',
  aka: ['Classic Canasta'],
  origin: { country: 'Uruguay', countryCode: 'UY', region: 'latin-america' },
  type: 'rummy',
  players: { min: 2, max: 6, ideal: 4 },
  deck: 'Two standard 52-card decks plus 4 jokers (108 cards)',
  difficulty: 4,
  length: '20–30 minutes a hand; a full game to 5,000 often takes 1–2 hours',
  minutes: 90,
  moods: ['social', 'brainy', 'chill'],
  hook: 'The Uruguayan team game that swept 1950s America: build seven-card canastas with your partner',
  history:
    'Canasta is thought to have been invented in Montevideo, Uruguay, in the late 1930s — it is often credited to Segundo Santos and Alberto Serrato. It spread quickly to Argentina and then to the United States, where it became a nationwide craze around 1950. "Canasta" is Spanish for "basket"; one popular explanation is the tray or basket that held the cards in the middle of the table.',
  featured: false,
  order: 280,
  variantTaught:
    'A beginner introduction to Classic Canasta for 4 players in two partnerships: 108 cards, 11 cards each, draw one card per turn, Jokers and 2s wild, a 50-point first meld, at least one canasta needed to go out, game to 5,000. The lesson and example focus on the core loop (draw, meld, take the pile, build canastas, go out); the full Classic details are in Variants.',
  variants:
    'Full Classic rules add a few details: the first-meld target rises to 90 points once your team has 1,500, and 120 once it has 3,000 (and drops to 15 if your score is below zero); going out "concealed" (melding your whole hand in one turn without having melded before) earns 200 instead of 100; and all four red threes for one team are worth 800. Two players: 15 cards each, draw two cards and discard one every turn, and you need two canastas to go out. Three players: 13 cards each, everyone plays alone. Samba and Bolivia are relatives that use three decks and allow runs. Modern American Canasta, very popular in the US today, plays quite differently (for example you draw two cards, and there are special canastas of sevens and of wild cards). Hand and Foot is another popular cousin.',
  glossary: [
    {
      term: 'rank',
      definition:
        'The number or picture on a card: A, 2–10, J, Q or K. The 9♠ and the 9♥ have the same rank — in Canasta, only the rank matters, never the suit.',
    },
    {
      term: 'meld',
      definition:
        'Three or more cards of the same rank laid face up on the table, like 9♠ 9♥ 9♦. Your team shares all its melds.',
    },
    {
      term: 'wild card',
      definition:
        'Jokers and 2s. They can stand in for any rank in a meld — for example 8♣ 8♦ 2♠ is a meld of three 8s.',
    },
    {
      term: 'natural card',
      definition:
        'Any card that is not wild — not a Joker or a 2. A "natural pair" is two real cards of the same rank, like Q♠ Q♦.',
    },
    {
      term: 'canasta',
      definition:
        'A meld of seven or more cards. Canastas earn big bonuses, and your team needs at least one before anyone can go out.',
    },
    {
      term: 'natural canasta',
      definition:
        'A canasta with no wild cards at all, like seven Kings. It earns a 500-point bonus and is stacked with a red card on top.',
    },
    {
      term: 'mixed canasta',
      definition:
        'A canasta that includes 1 to 3 wild cards, like five Jacks plus a 2 and a Joker. It earns a 300-point bonus and is stacked with a black card on top.',
    },
    {
      term: 'red three',
      definition:
        'The 3♥ and 3♦. They are bonus cards worth 100 points each: put them face up on the table as soon as you get one and draw a replacement.',
    },
    {
      term: 'black three',
      definition:
        'The 3♠ and 3♣. Discarding one stops the next player from taking the discard pile on their turn. You can only meld black threes when going out.',
    },
    {
      term: 'stock',
      definition: 'The face-down pile of undealt cards. Normally you draw its top card each turn.',
    },
    {
      term: 'discard pile',
      definition:
        'The face-up pile in the middle. Instead of drawing from the stock you may take the WHOLE pile, if you can meld its top card right away.',
    },
    {
      term: 'frozen pile',
      definition:
        'A discard pile that can only be taken with a natural pair matching its top card. It is frozen for your team until you make your first meld, and for everyone once a wild card is in it.',
    },
    {
      term: 'initial meld',
      definition:
        "Your team's first meld in each hand. The cards in it must add up to at least 50 points (while your team's score is under 1,500) — for example A♠ A♥ 2♦ = 60.",
    },
    {
      term: 'going out',
      definition:
        'Getting rid of every card in your hand by melding (you may discard the very last one). It ends the hand and earns 100 points. Your team needs a canasta first.',
    },
  ],
  lesson: [
    {
      title: 'The goal: build canastas with your partner',
      body: 'Canasta is a team game. You and your partner sit opposite each other and share everything you put on the table. You lay down groups of cards of the same [[rank]] (like three Kings), called [[melds|meld]], and grow them into [[canastas|canasta]] — melds of 7 cards — for big bonuses. When someone [[goes out|going out]], the hand is scored. The first team to reach 5,000 points wins.',
      scene: {
        zones: [
          {
            id: 'canasta',
            label: 'Your team’s canasta',
            cards: ['KS', 'KH', 'KD', 'KC', 'KS', 'KH', 'KD'],
            layout: 'row',
            highlight: [0, 1, 2, 3, 4, 5, 6],
          },
        ],
        caption: 'Seven Kings: a canasta! (Two decks are used, so you will see some cards twice.)',
      },
    },
    {
      title: 'Setup and the deal',
      body: 'Shuffle two normal decks together with four jokers — 108 cards in all. Deal 11 cards to each of the four players. Put the rest face down as the [[stock]], and turn its top card face up to start the [[discard pile]]. Play goes clockwise, to the left, so you and your partner take turns with the opponents in between.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['X1', '2D', 'AS', 'AH', 'KC', 'KD', '9S', '7H', '7C', '5D', '3S'],
            layout: 'fan',
          },
          { id: 'stock', label: 'Stock', cards: ['QS', 'QD'], layout: 'stack', faceDown: [0, 1] },
          { id: 'discard', label: 'Discard pile', cards: ['8H'], layout: 'stack', highlight: [0] },
        ],
        caption: 'Eleven cards each, the stock, and one face-up card to start the discard pile.',
      },
      tip: 'Sort your hand by rank, not by suit — in Canasta, suits don’t matter for melds.',
    },
    {
      title: 'A turn: draw, meld, discard',
      body: 'Every turn has three parts. 1) Draw the top card of the [[stock]] (or, sometimes, take the whole [[discard pile]] — more on that soon). 2) Lay down any [[melds|meld]] you like, or add cards to your team’s melds. 3) Discard one card face up. Your turn always ends with a discard, unless you go out.',
      scene: {
        zones: [
          { id: 'stock', label: 'Stock', cards: ['QS', 'QD'], layout: 'stack', faceDown: [0, 1] },
          { id: 'discard', label: 'Discard pile', cards: ['8H', 'JS'], layout: 'stack' },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['AS', 'AH', 'AD', '9S', '9C', '6H', '4C', 'JD'],
            layout: 'fan',
            highlight: [0, 1, 2],
          },
        ],
        caption: 'You drew the A♦. Meld your three Aces, then discard one card.',
      },
    },
    {
      title: 'Melds and wild cards',
      body: 'A [[meld]] is 3 or more cards of the same rank, like three 9s. Suits don’t matter, and runs (like 5-6-7) are NOT allowed in Canasta. Jokers and 2s are [[wild cards|wild card]]: they can stand in for any rank. Every meld needs at least two [[natural cards|natural card]] and may hold no more than three wild cards.',
      scene: {
        zones: [
          {
            id: 'natural',
            label: 'Natural meld',
            cards: ['9S', '9C', '9H'],
            layout: 'row',
            highlight: [0, 1, 2],
          },
          {
            id: 'wild',
            label: 'Meld with a wild card',
            cards: ['QD', 'QS', '2H'],
            layout: 'row',
            highlight: [2],
          },
          { id: 'bad', label: 'NOT allowed', cards: ['5D', '2C', 'X2'], layout: 'row' },
        ],
        caption:
          'Q♦ Q♠ + a wild 2 is fine. One 5 with two wild cards is not — it needs two real 5s.',
      },
    },
    {
      title: 'Card points and your first meld',
      body: 'Every card has a point value: Jokers 50; Aces and 2s 20; K, Q, J, 10, 9 and 8 are 10 each; 7, 6, 5 and 4 (and black threes) are 5 each. In every hand, your team’s [[first meld|initial meld]] must add up to at least 50 points — you may put down two or more melds at once to reach it. After that, any meld is fine for the rest of the hand.',
      scene: {
        zones: [
          {
            id: 'ok',
            label: 'Enough (60 points)',
            cards: ['AS', 'AH', '2D'],
            layout: 'row',
            highlight: [0, 1, 2],
          },
          { id: 'low', label: 'Too small (15 points)', cards: ['7H', '7C', '7D'], layout: 'row' },
        ],
        caption: 'A + A + 2 = 20 + 20 + 20 = 60. Three 7s are only 5 + 5 + 5 = 15.',
      },
      tip: 'Only the cards you put down count toward the 50 — red threes and bonuses don’t. In full Classic rules the target rises as your team’s score grows (90 points from 1,500, 120 from 3,000).',
    },
    {
      title: 'Canastas: the big bonus',
      body: 'A meld of 7 or more cards is a [[canasta]] — the heart of the game. A [[natural canasta]] (no wild cards) earns a 500-point bonus. A [[mixed canasta]] (with 1 to 3 wild cards) earns 300. Square the cards into a neat pile — red card on top for natural, black on top for mixed. Your team needs at least one canasta before anyone can go out.',
      scene: {
        zones: [
          {
            id: 'natural',
            label: 'Natural canasta (500)',
            cards: ['8S', '8H', '8D', '8C', '8S', '8H', '8D'],
            layout: 'row',
            highlight: [0, 1, 2, 3, 4, 5, 6],
          },
          {
            id: 'mixed',
            label: 'Mixed canasta (300)',
            cards: ['JS', 'JH', 'JD', 'JC', 'JS', '2C', 'X1'],
            layout: 'row',
            highlight: [5, 6],
          },
        ],
        caption: 'Seven real 8s = 500 bonus. Five Jacks + a 2 + a Joker = 300 bonus.',
      },
    },
    {
      title: 'Taking the discard pile',
      body: 'Instead of drawing, you may take the WHOLE [[discard pile]] — but only if you can meld its top card right away. Usually that means two cards in your hand that go with it (a natural pair, or one natural card plus a wild card), or adding it to one of your team’s melds. But the pile is [[frozen|frozen pile]] until your team has made its first meld, and for everyone once a wild card is in it. A frozen pile can only be taken with a natural pair that matches the top card.',
      scene: {
        zones: [
          {
            id: 'discard',
            label: 'Discard pile (top card last)',
            cards: ['6D', 'JH', '4S', '7D'],
            layout: 'row',
            highlight: [3],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['7C', '7S', 'QC', '5H'],
            layout: 'fan',
            highlight: [0, 1],
          },
        ],
        caption: 'Your 7♣ 7♠ + the 7♦ on top make a meld — so the whole pile is yours!',
      },
      tip: 'You can never take the pile when its top card is a wild card or a black three.',
    },
    {
      title: 'Red threes and black threes',
      body: 'Threes are special. A [[red three]] is a bonus card: put it face up on the table straight away and draw a replacement. Each one is worth 100 points — but it counts AGAINST your team if you haven’t melded anything by the end of the hand. A [[black three]] is a blocker: discard it and the next player cannot take the pile on their turn.',
      scene: {
        zones: [
          {
            id: 'red',
            label: 'Red threes (100 each)',
            cards: ['3H', '3D'],
            layout: 'row',
            highlight: [0, 1],
          },
          {
            id: 'pile',
            label: 'Black three on the pile',
            cards: ['9H', 'KC', '3S'],
            layout: 'stack',
            highlight: [2],
          },
        ],
        caption:
          'Red threes: free points. A black three on top: the next player can’t take the pile.',
      },
    },
    {
      title: 'Going out and scoring',
      body: 'Once your team has a [[canasta]], you can [[go out|going out]] by melding all your cards (you may discard the last one). You may first ask your partner, "Partner, may I go out?" — if you ask, you must follow their answer. Going out earns 100 points. Then each team adds its canasta bonuses, red threes, and the points of every card it melded, and subtracts the points of cards still in its hands. Example: mixed canasta 300 + going out 100 + melded cards 150 − 15 left in partner’s hand = 535.',
      scene: {
        zones: [
          {
            id: 'canasta',
            label: 'Mixed canasta (300)',
            cards: ['QS', 'QH', 'QD', 'QC', 'QS', '2D', '2S'],
            layout: 'row',
          },
          { id: 'melds', label: 'Other meld', cards: ['AS', 'AH', 'AD'], layout: 'row' },
          {
            id: 'partner',
            label: 'Left in partner’s hand',
            cards: ['5C', '4H', '7S'],
            layout: 'row',
            highlight: [0, 1, 2],
          },
        ],
        caption: 'Melded cards: Queens 90 + Aces 60 = 150. Partner’s leftovers: −15.',
      },
    },
    {
      title: 'Beginner strategy',
      body: 'Make your team’s [[first meld|initial meld]] early, so the [[discard pile]] opens up for you. Keep natural pairs in your hand — they are your keys to grabbing the pile. Save [[wild cards|wild card]] for finishing canastas. And when the pile is big, a [[black three]] is the safest card to throw.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['JC', 'JH', '6S', '6D', 'X2', '9D', '4H', '3C'],
            layout: 'fan',
            highlight: [0, 1, 2, 3],
          },
        ],
        caption:
          'Two natural pairs (Jacks and 6s) ready to pounce on the pile, a Joker saved for a canasta, and a black three for defence.',
      },
      tip: 'Don’t throw a card that matches one of your opponents’ melds — they can add it and scoop up the whole pile.',
    },
  ],
  example: {
    intro:
      'You (South) and your partner (North, sitting opposite you) are playing against West and East. East dealt, and the player on the dealer’s left starts — that’s you! Your team’s score is 0, so your first meld needs at least 50 points. Let’s play your key turns of one hand.',
    steps: [
      {
        narration:
          'Here are your 11 cards. The first card on the [[discard pile]] is the J♦. And look — you were dealt a [[red three]], the 3♥!',
        scene: {
          zones: [
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['3H', 'KS', 'KC', 'KD', '9H', '9D', '7C', '7S', '3S', '6D', '5H'],
              layout: 'fan',
              highlight: [0],
            },
            { id: 'stock', label: 'Stock', cards: ['AC', 'QS'], layout: 'stack', faceDown: [0, 1] },
            { id: 'discard', label: 'Discard pile', cards: ['JD'], layout: 'stack' },
          ],
        },
        decision: {
          prompt: 'What do you do with the 3♥?',
          options: [
            {
              label: 'Put it face up on the table and draw a replacement',
              correct: true,
              feedback:
                'Exactly. Red threes are bonus cards worth 100 points to your team. They never stay in your hand — lay it down and take a fresh card from the stock.',
            },
            {
              label: 'Keep it and try to collect more threes',
              correct: false,
              feedback:
                'Red threes can’t be melded like normal cards. Put it face up in front of you straight away and draw a replacement.',
            },
            {
              label: 'Discard it',
              card: '3H',
              correct: false,
              feedback:
                'You can’t throw a red three away — and you wouldn’t want to! It’s a 100-point bonus. Lay it down and draw a replacement.',
            },
          ],
          proHint:
            'Red threes go down first thing, every time. Then draw a replacement and carry on with your normal turn.',
        },
      },
      {
        narration:
          'The 3♥ sits in front of you, and your replacement card is the 9♠. Now your normal draw from the [[stock]]: the 4♣. Your team hasn’t melded yet, so your [[first meld|initial meld]] must be worth at least 50 points. Remember: Kings and 9s are 10 points each, 7s are 5.',
        scene: {
          zones: [
            { id: 'red', label: 'Red three', cards: ['3H'], layout: 'row' },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['KS', 'KC', 'KD', '9H', '9D', '9S', '7C', '7S', '3S', '6D', '5H', '4C'],
              layout: 'fan',
              highlight: [5, 11],
            },
            { id: 'discard', label: 'Discard pile', cards: ['JD'], layout: 'stack' },
          ],
          animate: 'none',
        },
        decision: {
          prompt: 'Which first meld can you put down?',
          options: [
            {
              label: 'K♠ K♣ K♦ (30 points)',
              correct: false,
              feedback:
                'Three Kings make a fine meld, but 30 points is short of the 50 you need for your team’s first meld.',
            },
            {
              label: 'K♠ K♣ K♦ and 9♥ 9♦ 9♠ (60 points)',
              correct: true,
              feedback:
                'Yes! Two melds put down together count toward the minimum: 30 + 30 = 60. That clears 50, and the discard pile is no longer frozen for your team.',
            },
            {
              label: '7♣ 7♠ (10 points)',
              correct: false,
              feedback:
                'That’s only two cards — a meld needs at least three. And 10 points is far below 50 anyway.',
            },
          ],
          proHint:
            'Pros try to make the first meld early, because until you do the discard pile stays frozen for your team. Use just enough cards to reach the target.',
        },
      },
      {
        narration:
          'You meld K K K and 9 9 9, then discard the 6♦. West throws the 8♠. Your partner adds the K♥ and a wild 2♦ to your Kings — remember, melds are shared! — and discards the Q♣. East discards the 7♦. Now it’s your turn, and you’re holding 7♣ 7♠.',
        scene: {
          zones: [
            {
              id: 'melds',
              label: 'Your team’s melds',
              cards: ['KS', 'KC', 'KD', 'KH', '2D', '9H', '9D', '9S'],
              layout: 'row',
              highlight: [3, 4],
            },
            {
              id: 'discard',
              label: 'Discard pile (5 cards)',
              cards: ['8S', 'QC', '7D'],
              layout: 'stack',
              highlight: [2],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['7C', '7S', '3S', '5H', '4C'],
              layout: 'fan',
              highlight: [0, 1],
            },
          ],
        },
        decision: {
          prompt: 'Draw from the stock, or take the discard pile?',
          options: [
            {
              label: 'Take the pile with 7♣ 7♠',
              correct: true,
              feedback:
                'Yes! Your natural pair plus the 7♦ on top makes a meld of three 7s — and the other four cards in the pile come into your hand. More cards means more melds.',
            },
            {
              label: 'Draw one card from the stock',
              correct: false,
              feedback:
                'Legal, but you’d get one card instead of five. With a natural pair matching the top card, grabbing the pile is the stronger play.',
            },
            {
              label: 'Take just the 7♦',
              card: '7D',
              correct: false,
              feedback:
                'In Canasta you can’t take only the top card — it’s the whole pile or nothing.',
            },
          ],
          proHint:
            'When a natural pair in your hand matches the top discard, pros usually pounce. Big piles win games.',
        },
      },
      {
        narration:
          'You meld 7♦ 7♣ 7♠ and scoop up the rest of the pile: J♦, 6♦, 8♠ and Q♣. Then you discard the 4♣ to start a fresh [[discard pile]]. Your team now has three melds on the table.',
        scene: {
          zones: [
            {
              id: 'melds',
              label: 'Your team’s melds',
              cards: ['KS', 'KC', 'KD', 'KH', '2D', '9H', '9D', '9S', '7D', '7C', '7S'],
              layout: 'row',
              highlight: [8, 9, 10],
            },
            { id: 'discard', label: 'Discard pile', cards: ['4C'], layout: 'stack' },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['3S', '5H', 'JD', '6D', '8S', 'QC'],
              layout: 'fan',
              highlight: [2, 3, 4, 5],
            },
          ],
        },
      },
      {
        narration:
          'A few rounds later. You drew the 8♥ and a Joker, and threw away the 6♦ and 5♥. Your partner added a wild 2♥ to the Kings, so that meld has 6 cards. This turn you draw the 8♣, so you can meld 8♠ 8♥ 8♣. But where should your [[Joker|wild card]] go?',
        scene: {
          zones: [
            {
              id: 'kings',
              label: 'Kings meld (6 cards)',
              cards: ['KS', 'KC', 'KD', 'KH', '2D', '2H'],
              layout: 'row',
              highlight: [5],
            },
            {
              id: 'melds',
              label: 'Other melds',
              cards: ['9H', '9D', '9S', '7D', '7C', '7S'],
              layout: 'row',
            },
            {
              id: 'discard',
              label: 'Discard pile (12 cards)',
              cards: ['TH', 'JC', '4S'],
              layout: 'stack',
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['3S', 'JD', 'QC', '8S', '8H', '8C', 'X1'],
              layout: 'fan',
              highlight: [6],
            },
          ],
        },
        decision: {
          prompt: 'Where do you put the Joker?',
          options: [
            {
              label: 'On the Kings, making 7 cards',
              card: 'X1',
              correct: true,
              feedback:
                'Canasta! Four Kings + two 2s + the Joker is 7 cards with 3 wild cards — the most allowed. That’s a mixed canasta worth a 300-point bonus, and now your team is allowed to go out.',
            },
            {
              label: 'With your 8s (8 8 8 + Joker)',
              correct: false,
              feedback:
                'Legal, but it only makes a 4-card meld. On the Kings the very same Joker completes a canasta worth 300 points.',
            },
            {
              label: 'Keep it in your hand for later',
              correct: false,
              feedback:
                'If an opponent goes out while you’re holding it, the Joker counts 50 points AGAINST your team. Use it now, where it finishes a canasta.',
            },
          ],
          proHint:
            'Wild cards are best spent finishing canastas. A meld that already has a wild card can only ever be a mixed canasta, so complete it.',
        },
      },
      {
        narration:
          'Your Kings are now a [[mixed canasta]], squared up with a black card on top, and your 8♠ 8♥ 8♣ are on the table too. You have three cards left: 3♠, J♦ and Q♣. The [[discard pile]] has grown to 12 cards, and West plays next. What do you throw?',
        scene: {
          zones: [
            {
              id: 'canasta',
              label: 'Canasta! (Kings)',
              cards: ['KS', 'KC', 'KD', 'KH', '2D', '2H', 'X1'],
              layout: 'row',
              highlight: [0, 1, 2, 3, 4, 5, 6],
            },
            {
              id: 'melds',
              label: 'Other melds',
              cards: ['9H', '9D', '9S', '7D', '7C', '7S', '8S', '8H', '8C'],
              layout: 'row',
            },
            {
              id: 'discard',
              label: 'Discard pile (12 cards)',
              cards: ['TH', 'JC', '4S'],
              layout: 'stack',
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['3S', 'JD', 'QC'],
              layout: 'fan',
              highlight: [0],
            },
          ],
        },
        decision: {
          prompt: 'Which card do you discard?',
          options: [
            {
              label: '3♠ — the black three',
              card: '3S',
              correct: true,
              feedback:
                'Smart defence. With a black three on top, West cannot take the pile this turn. Keeping 12 cards away from the opponents is a big save.',
            },
            {
              label: 'Q♣',
              card: 'QC',
              correct: false,
              feedback:
                'If West holds two Queens, they take all 12 cards — that could hand them a canasta. Too risky with a pile this big.',
            },
            {
              label: 'J♦',
              card: 'JD',
              correct: false,
              feedback:
                'Same danger: a pair of Jacks in West’s hand would scoop up the whole 12-card pile.',
            },
          ],
          proHint:
            'Black threes are your safest discard. Save them for the moment the pile gets big and the next player might want it.',
        },
      },
      {
        narration:
          'West is blocked and has to draw from the stock. Your partner lays down Q♦ Q♥ Q♠! East discards. On your turn you draw the 2♠ — another [[wild card]]. Your hand is J♦, Q♣ and 2♠, and your team already has a canasta, so [[going out]] is possible...',
        scene: {
          zones: [
            {
              id: 'canasta',
              label: 'Canasta (Kings)',
              cards: ['KS', 'KC', 'KD', 'KH', '2D', '2H', 'X1'],
              layout: 'row',
            },
            {
              id: 'melds',
              label: 'Other melds',
              cards: ['9H', '9D', '9S', '7D', '7C', '7S', '8S', '8H', '8C', 'QD', 'QH', 'QS'],
              layout: 'row',
              highlight: [9, 10, 11],
            },
            {
              id: 'discard',
              label: 'Discard pile',
              cards: ['6H', 'TD', '5C'],
              layout: 'stack',
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JD', 'QC', '2S'],
              layout: 'fan',
              highlight: [1, 2],
            },
          ],
        },
        decision: {
          prompt: 'What now?',
          options: [
            {
              label: 'Add Q♣ and 2♠ to the Queens, then discard the J♦ to go out',
              correct: true,
              feedback:
                'You’re out! Q♣ and the wild 2♠ join your partner’s Queens, and the J♦ is your final discard. Going out earns 100 points — and the opponents are stuck with all their cards.',
            },
            {
              label: 'Keep the 2♠ and wait to build a second canasta',
              correct: false,
              feedback:
                'Tempting, but every turn you wait lets the opponents meld their cards. With a canasta down and your team ahead, going out now scores 100 and catches them with full hands.',
            },
            {
              label: 'Discard the 2♠',
              card: '2S',
              correct: false,
              feedback:
                'Throwing away a wild card wastes it, and it doesn’t get you out. You can use it on the Queens right now.',
            },
          ],
          proHint:
            'When your team has a canasta, is ahead on the table, and you can go out — go out. (You may ask your partner "May I go out?" first; if you ask, you must follow their answer.)',
        },
      },
      {
        narration:
          'Hand over! Your team adds up: bonuses — mixed [[canasta]] 300 + [[red three]] 100 + going out 100 = 500. Melded cards — Kings canasta 130, 9s 30, 7s 15, 8s 30, Queens 60 = 265. Your partner is still holding five low cards (4♦ 4♥ 5♠ 6♠ 6♣) worth 25, so subtract 25. Total: 500 + 265 − 25 = 740 points! The opponents score the same way — but they get no going-out bonus, and everything stuck in their hands counts against them. First team to 5,000 wins.',
        scene: {
          zones: [
            {
              id: 'canasta',
              label: 'Mixed canasta (300)',
              cards: ['KS', 'KC', 'KD', 'KH', '2D', '2H', 'X1'],
              layout: 'row',
              highlight: [0, 1, 2, 3, 4, 5, 6],
            },
            {
              id: 'melds',
              label: 'Other melds',
              cards: ['9H', '9D', '9S', '7D', '7C', '7S', '8S', '8H', '8C'],
              layout: 'row',
            },
            {
              id: 'queens',
              label: 'Queens',
              cards: ['QD', 'QH', 'QS', 'QC', '2S'],
              layout: 'row',
              highlight: [3, 4],
            },
            { id: 'red', label: 'Red three (100)', cards: ['3H'], layout: 'row' },
          ],
          animate: 'none',
          caption: 'Your team scores 740 for the hand.',
        },
      },
    ],
    outro:
      'That’s the whole core loop of Canasta: make your first meld, grab the pile with a natural pair, finish a canasta with your wild cards, block with a black three, and go out. Real games last several hands on the way to 5,000 — but you’ve got the heart of it. Now try the quiz!',
  },
  mistakes: [
    'Trying to meld red threes — they are bonus cards and go face up on the table straight away.',
    'Forgetting the first-meld target: your team’s first meld must add up to at least 50 points.',
    'Putting too many wild cards in a meld — every meld needs at least two natural cards and no more than three wild cards.',
    'Trying to go out before your team has completed a canasta.',
    'Discarding a card that matches an opponent’s meld on the table, which lets them take the whole pile.',
    'Melding almost your whole hand early, leaving no natural pairs to capture the discard pile.',
    'Hanging on to Jokers and Aces too long — if the opponents go out, they count against you.',
  ],
  tips: [
    'Tip: in Canasta, get your team’s first meld down early — until you do, the discard pile is frozen for you.',
    'Tip: keep natural pairs in your hand; they are what let you snatch the discard pile.',
    'Tip: when the discard pile gets big, discard a black three so the next player can’t take it.',
    'Tip: save Jokers and 2s for finishing a canasta — a mixed canasta is still worth 300.',
    'Tip: never discard a card that fits one of your opponents’ melds; they can add it and grab the whole pile.',
    'Tip: once your team has a canasta and is ahead, go out quickly to catch the opponents with cards in hand.',
    'Tip: cards your left-hand opponent has already thrown away are usually safer to discard.',
  ],
  quiz: [
    {
      question: 'Which cards are wild in Canasta?',
      options: ['Jokers and 2s', 'Only the Jokers', 'Jokers and 3s', 'All the Aces'],
      answer: 0,
      explanation:
        'Jokers and all the 2s are wild. Threes are special (red = bonus, black = blocker), but they are not wild.',
    },
    {
      question: 'How many cards make a canasta?',
      options: ['5', '6', '7', '8'],
      answer: 2,
      explanation:
        'A canasta is a meld of at least 7 cards. With no wild cards it earns 500; with 1–3 wild cards it earns 300.',
    },
    {
      question: 'You are dealt a red three. What do you do?',
      options: [
        'Meld it with other threes',
        'Place it face up on the table and draw a replacement',
        'Discard it at once',
        'Keep it hidden until the end of the hand',
      ],
      answer: 1,
      explanation:
        'Red threes are 100-point bonus cards. You put them face up in front of you and draw a replacement card from the stock.',
    },
    {
      question:
        'Your team’s score is 0 and you haven’t melded yet this hand. Which first meld is allowed?',
      options: [
        '7♥ 7♣ 7♦ (15 points)',
        'K♠ K♦ (20 points)',
        '5♣ + 2♥ + Joker (75 points)',
        'A♠ A♥ 2♦ (60 points)',
      ],
      answer: 3,
      explanation:
        'The first meld needs at least 50 points AND must be a proper meld. Three 7s are too few points, two Kings are too few cards, and one 5 with two wild cards breaks the "at least two natural cards" rule.',
    },
    {
      question: 'What does a black three on top of the discard pile do?',
      options: [
        'Doubles the value of the pile',
        'Stops the next player from taking the pile',
        'Acts as a wild card',
        'Ends the hand immediately',
      ],
      answer: 1,
      explanation:
        'A black three is a stop card: the next player cannot take the discard pile and must draw from the stock instead.',
    },
  ],
  seo: {
    description:
      'Learn Canasta step by step: melds, wild cards, canastas, red and black threes, taking the pile and going out — with a clickable example hand.',
  },
});
