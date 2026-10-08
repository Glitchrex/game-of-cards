import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'gin-rummy',
  name: 'Gin Rummy',
  aka: ['Gin'],
  origin: { country: 'United States', countryCode: 'US', region: 'north-america' },
  type: 'rummy',
  players: { min: 2, max: 2, ideal: 2 },
  deck: 'One standard 52-card deck, no jokers',
  difficulty: 3,
  length: 'About 5 minutes a hand; 20–40 minutes to reach 100 points',
  minutes: 30,
  moods: ['brainy', 'chill', 'competitive'],
  hook: 'The two-player classic Hollywood fell for: build melds, shrink your deadwood, then knock!',
  history:
    'Gin Rummy grew out of older rummy games in the United States in the early 1900s. A popular story credits a New York whist teacher, Elwood T. Baker, with inventing it around 1909, though nobody can be completely sure. It became a real craze in the 1930s and 1940s, especially among Hollywood film people, and the name is often said to be a little joke: swapping one drink (rum, as in rummy) for another (gin).',
  featured: false,
  order: 160,
  variantTaught:
    'Standard two-player Gin Rummy: 10 cards each, Ace always low, knock with 10 or fewer deadwood points, 25-point bonus for going gin and for an undercut, first player to 100 points wins.',
  variants:
    'Full "box" scoring adds extras at the end of a game: 100 points for winning the game, 25 points for every hand each player won, and a doubled score for a shutout (when the loser scored nothing). Oklahoma Gin: the first upcard sets the knocking limit (an Ace means you must go gin). Straight Gin: no knocking at all — you can only end the hand with gin. Big Gin: if all 11 cards in your hand make melds after you draw, you go out without discarding for an even bigger bonus. Hollywood scoring keeps three games going at once. Bonus sizes differ between rule books (some use 20 for gin, or 10 or 20 for an undercut), and there are three- and four-player versions too.',
  glossary: [
    {
      term: 'suit',
      definition:
        'One of the four families of cards: Spades ♠, Hearts ♥, Diamonds ♦ and Clubs ♣. The 7♥ belongs to the Hearts suit.',
    },
    {
      term: 'rank',
      definition:
        'The number or picture on a card: A, 2–10, J, Q or K. The 9♠ and the 9♦ have the same rank.',
    },
    {
      term: 'meld',
      definition:
        'A group of 3 or more cards that belong together — either a set or a run. Example: 9♠ 9♦ 9♣.',
    },
    {
      term: 'set',
      definition: 'Three or four cards of the same rank. Example: 7♣ 7♥ 7♦.',
    },
    {
      term: 'run',
      definition:
        "Three or more cards in a row in the same suit, like 4♥ 5♥ 6♥. The Ace is low, so A-2-3 works but Q-K-A doesn't.",
    },
    {
      term: 'deadwood',
      definition:
        "Cards in your hand that aren't part of any meld. They count against you: a loose K♠ and 3♦ are 13 points of deadwood.",
    },
    {
      term: 'stock',
      definition: 'The face-down pile of cards left after the deal. You may draw its top card.',
    },
    {
      term: 'discard pile',
      definition:
        'The face-up pile where each player throws one card at the end of their turn. You may take its top card instead of drawing from the stock.',
    },
    {
      term: 'upcard',
      definition:
        'The first card turned face up after the deal. It starts the discard pile, and the non-dealer may take it on the first turn.',
    },
    {
      term: 'knock',
      definition:
        'Ending the hand when your deadwood adds up to 10 points or less. You discard face down and lay out your cards, e.g. knocking with just a loose 4♥.',
    },
    {
      term: 'gin',
      definition:
        'A hand where all 10 cards are in melds, with zero deadwood. Going gin earns a 25-point bonus on top of your opponent’s deadwood.',
    },
    {
      term: 'lay off',
      definition:
        "After a knock, the defender adds loose cards to the knocker's melds so they stop counting as deadwood — like adding a 7♥ to 4♥ 5♥ 6♥.",
    },
    {
      term: 'undercut',
      definition:
        "When the defender's deadwood is equal to or lower than the knocker's. The defender then scores the difference plus a 25-point bonus.",
    },
  ],
  lesson: [
    {
      title: 'The goal: a tidy hand',
      body: 'Gin Rummy is a duel for two players. You each hold 10 cards and try to sort them into neat groups called [[melds|meld]]. Any card that doesn’t fit a group is [[deadwood]] — and deadwood counts against you. Get your deadwood low and you can end the hand and score. The first player to reach 100 points wins the game.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['4H', '5H', '6H', '9S', '9D', '9C', 'TC', 'JC', 'QC', '2S'],
            layout: 'fan',
            highlight: [0, 1, 2, 3, 4, 5, 6, 7, 8],
          },
        ],
        caption: 'Three tidy groups and just one loose card, the 2♠. That’s a lovely hand!',
      },
    },
    {
      title: 'Setup and the deal',
      body: 'Use one normal 52-card deck with no jokers. The dealer gives each player 10 cards, one at a time, taking turns between the two of you. The next card is turned face up: this [[upcard]] starts the [[discard pile]]. The rest of the deck sits face down in the middle as the [[stock]].',
      scene: {
        zones: [
          {
            id: 'opponent',
            label: 'Opponent',
            cards: ['3D', '3H', '3C', '6S', '7S', '7H', 'KC', 'QD', '4C', 'TC'],
            layout: 'fan',
            faceDown: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          },
          {
            id: 'stock',
            label: 'Stock',
            cards: ['AH', '5D'],
            layout: 'stack',
            faceDown: [0, 1],
          },
          {
            id: 'discard',
            label: 'Discard pile',
            cards: ['9C'],
            layout: 'stack',
            highlight: [0],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['4H', '5H', '6H', '9S', '9D', 'JC', 'QC', '2S', '8D', 'KD'],
            layout: 'fan',
          },
        ],
        caption: 'Ten cards each, the stock in the middle, and the 9♣ as the upcard.',
      },
      tip: 'On the very first turn, the non-dealer may take the upcard. If they pass, the dealer may take it. If both pass, the non-dealer starts by drawing from the stock.',
    },
    {
      title: 'A turn: draw one, discard one',
      body: 'On your turn, first draw ONE card: either the top card of the face-down [[stock]], or the top card of the face-up [[discard pile]]. Then throw one card face up onto the discard pile. You always finish your turn with 10 cards.',
      scene: {
        zones: [
          {
            id: 'discard',
            label: 'Discard pile',
            cards: ['KD', 'TC'],
            layout: 'stack',
            highlight: [1],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['4H', '5H', '6H', '9S', '9D', '9C', 'JC', 'QC', '2S', '8D'],
            layout: 'fan',
            highlight: [6, 7],
          },
        ],
        caption: 'The 10♣ on top of the pile fits right next to your J♣ Q♣. Worth taking!',
      },
      tip: 'Taking the face-up card tells your opponent what you are collecting. Drawing from the stock keeps your plans secret.',
    },
    {
      title: 'Melds: sets and runs',
      body: 'A [[meld]] is a group of 3 or more cards. A [[set]] is 3 or 4 cards of the same [[rank]] (the same number or picture), like 9♠ 9♦ 9♣. A [[run]] is 3 or more cards in a row in the same [[suit]], like 4♥ 5♥ 6♥ 7♥. The Ace is always low: A-2-3 is a run, but Q-K-A is not. Each card can belong to only one meld at a time.',
      scene: {
        zones: [
          {
            id: 'set',
            label: 'A set',
            cards: ['9S', '9D', '9C'],
            layout: 'row',
            highlight: [0, 1, 2],
          },
          {
            id: 'run',
            label: 'A run',
            cards: ['4H', '5H', '6H', '7H'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
          { id: 'ace-low', label: 'Ace-low run', cards: ['AS', '2S', '3S'], layout: 'row' },
          { id: 'not-run', label: 'NOT a run', cards: ['QD', 'KD', 'AD'], layout: 'row' },
        ],
        caption: 'The Ace only sits below the 2 — it can’t wrap around after the King.',
      },
    },
    {
      title: 'Deadwood and card values',
      body: 'Any card that isn’t in a meld is [[deadwood]]. Count it like this: Ace = 1 point, number cards = their number, and J, Q, K = 10 points each. Lower deadwood is better, so big loose cards like Kings are usually the first ones you throw away.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['4H', '5H', '6H', '9S', '9D', '9C', 'KD', '8D', '2S', 'AC'],
            layout: 'fan',
            highlight: [6, 7, 8, 9],
          },
        ],
        caption: 'Deadwood: K (10) + 8 + 2 + A (1) = 21 points.',
      },
    },
    {
      title: 'Knocking',
      body: 'When your deadwood adds up to 10 or less, you may [[knock]] to end the hand. Draw as usual, then put your discard face DOWN and lay out your cards: melds in groups, deadwood to one side. Knocking is your choice — you never have to.',
      scene: {
        zones: [
          {
            id: 'melds',
            label: 'Your melds',
            cards: ['AD', '2D', '3D', '7C', '7H', '7S', 'TS', 'JS', 'QS'],
            layout: 'row',
          },
          {
            id: 'deadwood',
            label: 'Your deadwood',
            cards: ['4H'],
            layout: 'row',
            highlight: [0],
          },
          {
            id: 'discard',
            label: 'Discard (face down)',
            cards: ['KC'],
            layout: 'stack',
            faceDown: [0],
          },
        ],
        caption: 'Only 4 points of deadwood — 10 or less, so you may knock.',
      },
      tip: 'Say "I knock" out loud and place your last discard face down. That’s the signal the hand is over.',
    },
    {
      title: 'Going gin',
      body: 'If ALL 10 of your cards fit into melds — zero deadwood — you have [[gin]]! Gin scores a 25-point bonus plus all of your opponent’s deadwood. Even better, your opponent is not allowed to [[lay off]] any cards on your melds.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['AS', '2S', '3S', '4S', '7D', '7H', '7C', 'JH', 'QH', 'KH'],
            layout: 'fan',
            highlight: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          },
        ],
        caption: 'A-2-3-4♠, three 7s and J-Q-K♥: every card is in a meld. Gin!',
      },
    },
    {
      title: 'Laying off and the undercut',
      body: 'After a knock, the other player (the defender) lays out their melds too. Then they may [[lay off]]: add loose cards to the knocker’s melds so they stop counting. If the defender ends up with deadwood equal to or LOWER than the knocker’s, that’s an [[undercut]] — the defender scores the difference plus a 25-point bonus.',
      scene: {
        zones: [
          {
            id: 'opp-melds',
            label: 'Opponent’s melds (they knocked)',
            cards: ['3C', '4C', '5C', '6C', '8H', '8S', '8D', '8C', 'JD', 'QD', 'KD'],
            layout: 'row',
            highlight: [3, 7],
          },
          { id: 'opp-dead', label: 'Opponent’s deadwood', cards: ['6S'], layout: 'row' },
          {
            id: 'your-melds',
            label: 'Your melds',
            cards: ['TH', 'JH', 'QH', 'KH', '2D', '2H', '2S'],
            layout: 'row',
          },
          {
            id: 'your-dead',
            label: 'Your deadwood',
            cards: ['5S'],
            layout: 'row',
            highlight: [0],
          },
        ],
        caption:
          'You lay off the 6♣ and 8♣. Your 5 is lower than their 6: undercut! You score 1 + 25 = 26.',
      },
      tip: 'The knocker never lays off on the defender’s melds — only the defender gets that chance.',
    },
    {
      title: 'Scoring a hand: a worked example',
      body: 'Score after every hand. After a [[knock]], the knocker scores the difference between the two deadwood totals. Example: you knock holding 3♥ + A♠ = 4. Your opponent is stuck with K♠ 9♦ 5♣ = 24. You score 24 − 4 = 20 points. [[Gin]] scores 25 + the opponent’s deadwood; an [[undercut]] scores the difference + 25 for the defender. Keep a running total — the first to 100 wins.',
      scene: {
        zones: [
          {
            id: 'your-dead',
            label: 'Your deadwood (you knocked)',
            cards: ['3H', 'AS'],
            layout: 'row',
            highlight: [0, 1],
          },
          {
            id: 'opp-dead',
            label: 'Opponent’s deadwood',
            cards: ['KS', '9D', '5C'],
            layout: 'row',
            highlight: [0, 1, 2],
          },
        ],
        caption: 'Theirs 24 − yours 4 = 20 points for you.',
      },
      tip: 'If the stock gets down to its last two cards and nobody has knocked, the hand is a draw: nobody scores, and you deal a fresh hand.',
    },
    {
      title: 'Beginner strategy',
      body: 'Throw away high, lonely cards (Kings, Queens) early — they’re expensive [[deadwood]]. Keep cards that are close together, like 6♦ 7♦ or two 8s, because they can grow into melds. Watch which cards your opponent picks up from the [[discard pile]], and don’t hand them the card they want. And when you can [[knock]] early in a hand, it’s usually a great idea.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['2C', '3C', '6D', '7D', '8C', '8H', '5S', 'JH', 'QD', 'KS'],
            layout: 'fan',
            highlight: [8, 9],
          },
        ],
        caption:
          'The lonely Q♦ and K♠ are great first discards. Keep 6♦ 7♦ and the two 8s — they want to grow.',
      },
      tip: 'Low cards like Aces and 2s make the cheapest deadwood. They’re fine to hold while you wait for a knock.',
    },
  ],
  example: {
    intro:
      'You’re playing one hand against the computer. You are the non-dealer, so you get the first chance at the upcard. Your goal this hand: build melds fast and knock before your opponent gets organised.',
    steps: [
      {
        narration:
          'The cards are dealt. Your hand has a nice start: 4♥ 5♥ 6♥ is already a [[run]], and you hold two 9s. The [[upcard]] is the 9♣. As the non-dealer, you decide first whether to take it.',
        scene: {
          zones: [
            {
              id: 'opponent',
              label: 'Opponent',
              cards: ['3D', '3H', '3C', '6S', '7S', '7H', 'KC', 'QD', '4C', 'TC'],
              layout: 'fan',
              faceDown: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
            },
            { id: 'stock', label: 'Stock', cards: ['AH', '5D'], layout: 'stack', faceDown: [0, 1] },
            {
              id: 'discard',
              label: 'Discard pile',
              cards: ['9C'],
              layout: 'stack',
              highlight: [0],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['4H', '5H', '6H', '9S', '9D', 'JC', 'QC', '2S', '8D', 'KD'],
              layout: 'fan',
              highlight: [3, 4],
            },
          ],
          caption: 'The 9♣ would join your 9♠ and 9♦.',
        },
        decision: {
          prompt: 'Take the 9♣ or pass?',
          options: [
            {
              label: 'Take the 9♣',
              card: '9C',
              correct: true,
              feedback:
                'Yes! 9♠ 9♦ 9♣ is an instant set. You turn two loose cards (18 points of deadwood) into a finished meld on turn one.',
            },
            {
              label: 'Pass — let the dealer decide',
              correct: false,
              feedback:
                'Passing gives the dealer the chance to grab it, and you give up a free set. When the upcard completes a meld, take it.',
            },
          ],
          proHint:
            'A pro grabs any upcard that completes a meld straight away. A ready-made set on the first turn is the best start you can get.',
        },
      },
      {
        narration:
          'You take the 9♣ — that’s a [[set]] of three 9s. Now you hold 11 cards, so you must discard one. Which card is doing the least for you?',
        scene: {
          zones: [
            {
              id: 'opponent',
              label: 'Opponent',
              cards: ['3D', '3H', '3C', '6S', '7S', '7H', 'KC', 'QD', '4C', 'TC'],
              layout: 'fan',
              faceDown: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
            },
            { id: 'stock', label: 'Stock', cards: ['AH', '5D'], layout: 'stack', faceDown: [0, 1] },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['4H', '5H', '6H', '9S', '9D', '9C', 'JC', 'QC', '2S', '8D', 'KD'],
              layout: 'fan',
              highlight: [3, 4, 5],
            },
          ],
          animate: 'none',
          caption: 'Run: 4♥ 5♥ 6♥. Set: 9♠ 9♦ 9♣. Loose: J♣ Q♣ 2♠ 8♦ K♦.',
        },
        decision: {
          prompt: 'Which card do you discard?',
          options: [
            {
              label: 'K♦',
              card: 'KD',
              correct: true,
              feedback:
                'Perfect. The K♦ costs 10 points if you get caught with it, and it connects to nothing — no other Kings, no Q♦ or J♦. Out it goes.',
            },
            {
              label: '2♠',
              card: '2S',
              correct: false,
              feedback:
                'The 2♠ only costs 2 points if you get caught holding it. Keep cheap cards; throw away expensive lonely ones.',
            },
            {
              label: 'J♣',
              card: 'JC',
              correct: false,
              feedback:
                'J♣ and Q♣ are side by side in the same suit — one 10♣ or K♣ turns them into a run. Don’t break up a promising pair.',
            },
          ],
          proHint:
            'Pros throw high cards that don’t connect to anything. A lonely King is the textbook discard.',
        },
      },
      {
        narration:
          'You discard the K♦. Your opponent draws from the [[stock]] and throws the 10♣ onto the [[discard pile]]. Look closely — that’s exactly the card that sits next to your J♣ Q♣!',
        scene: {
          zones: [
            {
              id: 'opponent',
              label: 'Opponent',
              cards: ['3D', '3H', '3C', '6S', '7S', '8S', '7H', 'KC', 'QD', '4C'],
              layout: 'fan',
              faceDown: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
            },
            { id: 'stock', label: 'Stock', cards: ['AH', '5D'], layout: 'stack', faceDown: [0, 1] },
            {
              id: 'discard',
              label: 'Discard pile',
              cards: ['KD', 'TC'],
              layout: 'stack',
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['4H', '5H', '6H', '9S', '9D', '9C', 'JC', 'QC', '2S', '8D'],
              layout: 'fan',
              highlight: [6, 7],
            },
          ],
        },
        decision: {
          prompt: 'Draw from the stock, or take the 10♣?',
          options: [
            {
              label: 'Take the 10♣',
              card: 'TC',
              correct: true,
              feedback:
                '10♣ J♣ Q♣ is a run! Twenty points of loose cards just became a meld. You now have three melds.',
            },
            {
              label: 'Draw from the stock',
              correct: false,
              feedback:
                'The stock is a mystery card that probably won’t help. The 10♣ is a sure thing that completes a meld — take the sure thing.',
            },
          ],
          proHint:
            'When the top discard completes a meld, take it. A guaranteed meld beats hoping for a lucky draw.',
        },
      },
      {
        narration:
          'Three [[melds|meld]]! You hold 11 cards: 4♥ 5♥ 6♥, 9♠ 9♦ 9♣, 10♣ J♣ Q♣ — plus the 2♠ and the 8♦. One of those two must go.',
        scene: {
          zones: [
            {
              id: 'opponent',
              label: 'Opponent',
              cards: ['3D', '3H', '3C', '6S', '7S', '8S', '7H', 'KC', 'QD', '4C'],
              layout: 'fan',
              faceDown: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
            },
            { id: 'discard', label: 'Discard pile', cards: ['KD'], layout: 'stack' },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['4H', '5H', '6H', '9S', '9D', '9C', 'TC', 'JC', 'QC', '2S', '8D'],
              layout: 'fan',
              highlight: [9, 10],
            },
          ],
          animate: 'none',
        },
        decision: {
          prompt: 'Which loose card do you throw away?',
          options: [
            {
              label: '8♦',
              card: '8D',
              correct: true,
              feedback:
                'Right. Keeping the 2♠ leaves you with just 2 points of deadwood — as low as it gets without going gin.',
            },
            {
              label: '2♠',
              card: '2S',
              correct: false,
              feedback:
                'That leaves the 8♦ as your deadwood: 8 points instead of 2. Always keep the cheaper loose card.',
            },
            {
              label: 'Q♣',
              card: 'QC',
              correct: false,
              feedback:
                'Breaking a finished run would leave you with three loose cards again. Never pull apart a meld you’ve just built.',
            },
          ],
          proHint:
            'Keep your lowest loose card. Fewer deadwood points means a safer knock and a bigger score.',
        },
      },
      {
        narration:
          'You’re about to discard the 8♦. Your only [[deadwood]] is the 2♠ — just 2 points. That’s 10 or less, so you may [[knock]] by putting the 8♦ face down. Or you could discard it face up and keep playing, hoping for [[gin]].',
        scene: {
          zones: [
            {
              id: 'opponent',
              label: 'Opponent',
              cards: ['3D', '3H', '3C', '6S', '7S', '8S', '7H', 'KC', 'QD', '4C'],
              layout: 'fan',
              faceDown: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
            },
            { id: 'discard', label: 'Discard pile', cards: ['KD'], layout: 'stack' },
            {
              id: 'throw',
              label: 'Card to discard',
              cards: ['8D'],
              layout: 'stack',
              highlight: [0],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['4H', '5H', '6H', '9S', '9D', '9C', 'TC', 'JC', 'QC', '2S'],
              layout: 'fan',
              highlight: [9],
            },
          ],
          animate: 'none',
        },
        decision: {
          prompt: 'Knock now, or keep playing for gin?',
          options: [
            {
              label: 'Knock now',
              correct: true,
              feedback:
                'Great call. It’s only your second turn, so your opponent is probably still holding plenty of deadwood. A 2-point knock is very hard to undercut.',
            },
            {
              label: 'Keep playing for gin',
              correct: false,
              feedback:
                'Gin pays a 25-point bonus, but only a few cards would get you there (the 3♥, 7♥, 9♥ or K♣), and you’d still have to draw one. Meanwhile your opponent keeps improving every turn and might knock first.',
            },
          ],
          proHint:
            'Most experts knock as soon as they can early in a hand. A 2-point knock on turn two is a gift — take it.',
        },
      },
      {
        narration:
          '"I knock!" You lay out your melds. Your opponent shows theirs: 3♦ 3♥ 3♣ and 6♠ 7♠ 8♠. Then they [[lay off]]: the 7♥ joins your 4♥ 5♥ 6♥, and the K♣ joins your 10♣ J♣ Q♣. They are left with the Q♦ and 4♣ as [[deadwood]].',
        scene: {
          zones: [
            {
              id: 'your-melds',
              label: 'Your melds',
              cards: ['4H', '5H', '6H', '7H', '9S', '9D', '9C', 'TC', 'JC', 'QC', 'KC'],
              layout: 'row',
              highlight: [3, 10],
            },
            { id: 'your-dead', label: 'Your deadwood', cards: ['2S'], layout: 'row' },
            {
              id: 'opp-melds',
              label: 'Opponent’s melds',
              cards: ['3D', '3H', '3C', '6S', '7S', '8S'],
              layout: 'row',
            },
            {
              id: 'opp-dead',
              label: 'Opponent’s deadwood',
              cards: ['QD', '4C'],
              layout: 'row',
              highlight: [0, 1],
            },
          ],
          animate: 'flip',
          caption: 'The glowing 7♥ and K♣ were laid off by your opponent.',
        },
      },
      {
        narration:
          'Time to score. Their deadwood: Q♦ (10) + 4♣ (4) = 14. Yours: 2♠ = 2. You score the difference: 14 − 2 = 12 points. Your 2 was lower than their 14, so there’s no [[undercut]]. Twelve points closer to 100 — shuffle up for the next hand!',
        scene: {
          zones: [
            {
              id: 'your-dead',
              label: 'Your deadwood',
              cards: ['2S'],
              layout: 'row',
              highlight: [0],
            },
            {
              id: 'opp-dead',
              label: 'Opponent’s deadwood',
              cards: ['QD', '4C'],
              layout: 'row',
              highlight: [0, 1],
            },
          ],
          animate: 'none',
          caption: '14 − 2 = 12 points to you.',
        },
      },
    ],
    outro:
      'You built three melds in two turns and knocked for 12 points — that’s exactly how good Gin players win: grab useful cards, dump high loners, and knock early. Ready to test yourself? Try the quiz!',
  },
  mistakes: [
    'Holding on to lonely Kings and Queens hoping for a meld — if your opponent knocks, each one costs you 10 points.',
    'Forgetting that the Ace is low: Q-K-A is not a run, but A-2-3 is.',
    'Waiting for gin when you could knock early — your opponent may knock first or keep improving.',
    'Discarding a card right next to one your opponent just picked up (if they took the 7♠, the 6♠ and 8♠ are dangerous).',
    'Knocking with 9 or 10 deadwood late in a hand, when your opponent has probably tidied up and can undercut you.',
    'Trying to use the same card in two melds at once — each card belongs to only one meld.',
  ],
  tips: [
    'Tip: in Gin Rummy, throw away lonely Kings and Queens early — each one costs 10 points if you get caught.',
    'Tip: knock as soon as you can early in a hand; your opponent is still holding lots of deadwood.',
    'Tip: cards side by side in the same suit (like 6♦ 7♦) are flexible — they can grow into a run.',
    'Tip: if your opponent picks a card up from the discard pile, avoid throwing cards of the same rank or its suit neighbours.',
    'Tip: late in a hand, get your deadwood really low (3 or less) before you knock, to avoid an undercut.',
    'Tip: the safest discards are cards your opponent has just passed on, or ranks that have already been thrown.',
    'Tip: Aces, 2s and 3s are cheap deadwood — keep them over big cards while you wait to knock.',
  ],
  quiz: [
    {
      question: 'Which of these is a valid run?',
      options: ['Q♠ K♠ A♠', '4♥ 5♥ 6♥', '7♣ 8♦ 9♣', '2♦ 2♣ 2♥'],
      answer: 1,
      explanation:
        'A run is 3+ cards in a row in the SAME suit. Q-K-A doesn’t count because the Ace is low, 7♣ 8♦ 9♣ mixes suits, and 2♦ 2♣ 2♥ is a set, not a run.',
    },
    {
      question: 'Your deadwood is a King, a 3 and an Ace. How many points is that?',
      options: ['14', '5', '13', '24'],
      answer: 0,
      explanation: 'King = 10, the 3 = 3 and the Ace = 1. 10 + 3 + 1 = 14.',
    },
    {
      question: 'What is the most deadwood you can have and still knock?',
      options: ['0 points', '5 points', '10 points', '15 points'],
      answer: 2,
      explanation:
        'You may knock with 10 points of deadwood or less. Zero deadwood is even better — that’s gin.',
    },
    {
      question:
        'You knock with 4 deadwood. After laying off, your opponent has 3 deadwood. What happens?',
      options: [
        'You score 1 point',
        'Your opponent undercuts you and scores 1 + 25 = 26',
        'Nobody scores',
        'You score 25 points',
      ],
      answer: 1,
      explanation:
        'When the defender’s deadwood is equal to or lower than the knocker’s, it’s an undercut: the defender scores the difference (1) plus a 25-point bonus.',
    },
    {
      question:
        'You go gin. Your opponent is holding 18 points of deadwood. How many do you score?',
      options: ['18', '25', '7', '43'],
      answer: 3,
      explanation:
        'Gin scores a 25-point bonus plus all of your opponent’s deadwood: 25 + 18 = 43. They can’t lay off on a gin hand.',
    },
  ],
  seo: {
    description:
      'Learn Gin Rummy from scratch: melds, deadwood, knocking, going gin and scoring — with a clickable example hand and a quick quiz.',
  },
});
