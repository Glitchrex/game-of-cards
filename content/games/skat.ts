import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'skat',
  name: 'Skat',
  origin: { country: 'Germany', countryCode: 'DE', region: 'europe' },
  type: 'trick-taking',
  players: { min: 3, max: 4, ideal: 3 },
  deck: '32 cards: the 7, 8, 9, 10, J, Q, K and A of each suit',
  difficulty: 5,
  length: 'About 5 minutes a deal; a session of many deals runs 1–2 hours',
  minutes: 60,
  moods: ['brainy', 'competitive', 'social'],
  hook: 'Germany’s national card game: one bold player against two, Jacks on top, and 61 points to win',
  history:
    'Skat was created in the early 1800s in Altenburg, a town in Thuringia, Germany, where card players blended ideas from older games such as Schafkopf and Tarock. The name is thought to come from the Italian word “scartare”, to discard — a nod to the two cards the declarer swaps. Altenburg still celebrates the game with a Skat fountain, and a Skat court based there rules on tricky questions of the rules. Skat has also been recognised as part of Germany’s intangible cultural heritage.',
  featured: false,
  order: 300,
  variantTaught:
    'A beginner introduction to standard Skat as described by the International Skat Order: three active players, a 32-card French-suited deck, bidding from 18, picking up the skat and discarding two cards, and the three kinds of game — suit games, grand and null. Scoring is taught in simplified form: a won game scores its value and a lost game costs double its value, without tournament bonus points. Hand games, open (ouvert) games and announcements are mentioned but not drilled.',
  variants:
    'Tournament Skat adds Seeger–Fabian scoring (50 extra points for each won game, minus 50 for each lost one, and bonus points for the defenders when the declarer loses). Full rules also include hand games (playing without picking up the skat), announcing Schneider or Schwarz, and open (ouvert) games; null has fixed values of 23, 35 (hand), 46 (ouvert) and 59 (ouvert hand). Many tables play Ramsch when everyone passes — every player for themselves, trying to take as few points as possible — and “Bock” rounds with doubled scores, and casual games often add Kontra and Re for doubling. With four at the table, the dealer sits out each deal. In much of Germany Skat is also played with German-suited cards: Acorns (clubs), Leaves (spades), Hearts and Bells (diamonds).',
  glossary: [
    {
      term: 'declarer',
      definition:
        'The player who wins the bidding and plays alone against the other two. “I’m the declarer — hearts are trump!”',
    },
    {
      term: 'defenders',
      definition:
        'The two players teaming up against the declarer for this deal. Their card points are added together.',
    },
    {
      term: 'skat',
      definition:
        'The two face-down cards set aside during the deal. The declarer may pick them up and put two cards back; their points count for the declarer.',
    },
    {
      term: 'trick',
      definition:
        'Each of the three players plays one card, and the best card wins all three. A deal has 10 tricks. Example: K♠, 10♠, 7♠ — the 10♠ wins.',
    },
    {
      term: 'follow suit',
      definition:
        'Play a card of the suit that was led if you have one. In a suit game the Jacks belong to the trump suit, not to their printed suit.',
    },
    {
      term: 'trump',
      definition:
        'A card that beats every card of the other suits. In a hearts game the four Jacks and all the hearts are trumps; in a grand only the Jacks are.',
    },
    {
      term: 'card points',
      definition:
        'What the cards you win are worth: Ace 11, Ten 10, King 4, Queen 3, Jack 2, and 9, 8, 7 nothing. The deck holds 120 points.',
    },
    {
      term: 'forehand',
      definition:
        'The player on the dealer’s left. Forehand answers the first bids and leads to the first trick.',
    },
    {
      term: 'middlehand',
      definition:
        'The player after forehand. Middlehand starts the bidding by calling numbers to forehand: “18?”',
    },
    {
      term: 'rearhand',
      definition:
        'The third player (the dealer, when three play). Rearhand then bids against whichever of forehand and middlehand is still in.',
    },
    {
      term: 'bid',
      definition:
        'A number your game will be worth at least: 18, 20, 22, 23, 24, 27, 30 and so on. The other player answers “yes” to stay in, or passes.',
    },
    {
      term: 'suit game',
      definition:
        'A game where the declarer names clubs, spades, hearts or diamonds as trump. That gives 11 trumps, starting with the four Jacks.',
    },
    {
      term: 'grand',
      definition:
        'A game where only the four Jacks are trumps. It is worth a lot, so it needs a strong hand — think three Jacks and some Aces.',
    },
    {
      term: 'null',
      definition:
        'A game where the declarer promises to lose every single trick. There are no trumps, and the 10 ranks between the 9 and the Jack.',
    },
    {
      term: 'schneider',
      definition:
        'When the losing side ends with 30 card points or fewer. It adds 1 to the game’s multiplier, e.g. hearts “with 1” becomes worth 30 instead of 20.',
    },
    {
      term: 'smear',
      definition:
        'A defender’s move: putting a high-point card such as a 10 or King onto a trick your partner is sure to win, so the points stay on your side.',
    },
  ],
  lesson: [
    {
      title: 'The goal: collect 61 card points',
      body: 'Skat is for three players (with four, the dealer sits out each deal). Every deal, one player becomes the [[declarer]] and plays alone against the other two, the [[defenders]]. What matters isn’t how many tricks you win but what’s inside them. Every card has [[card points]]: Ace 11, Ten 10, King 4, Queen 3, Jack 2, and the 9, 8 and 7 nothing. The deck holds 120 points, and the declarer needs at least 61.',
      scene: {
        zones: [
          {
            id: 'values',
            label: 'Card points',
            cards: ['AH', 'TH', 'KH', 'QH', 'JH', '9H', '8H', '7H'],
            layout: 'row',
            highlight: [0, 1],
          },
        ],
        caption: 'A 11 · 10 10 · K 4 · Q 3 · J 2 · 9, 8, 7 = 0. 120 points in the whole deck.',
      },
      tip: 'Aces and Tens are the big prizes — together they make up 84 of the 120 points.',
    },
    {
      title: 'A 32-card deck and the skat',
      body: 'Skat uses 32 cards: the 7, 8, 9, 10, Jack, Queen, King and Ace of each suit. Everyone gets 10 cards, and 2 go face down in the middle: the [[skat]]. (The dealer deals in packets: 3 each, 2 to the skat, 4 each, then 3 each.) The player on the dealer’s left is [[forehand]], next comes [[middlehand]], then [[rearhand]].',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['JC', 'JH', 'AS', 'TS', 'KS', 'AH', '9H', 'QD', '8D', '7C'],
            layout: 'fan',
          },
          {
            id: 'skat',
            label: 'Skat',
            cards: ['9C', 'KD'],
            layout: 'stack',
            faceDown: [0, 1],
          },
        ],
        caption: 'Ten cards each, and two face down in the skat.',
      },
    },
    {
      title: 'Playing a trick',
      body: 'Forehand leads the first card. The others must [[follow suit]] if they can; if not, they may play any card, including a [[trump]]. The highest card of the suit led wins, unless a trump was played. In plain suits the order is A, 10, K, Q, 9, 8, 7 — yes, the 10 beats the King! The winner takes the [[trick]] and leads the next one.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick',
            cards: ['KS', 'TS', '7S'],
            layout: 'row',
            highlight: [1],
          },
        ],
        caption:
          'Forehand K♠ · Middlehand 10♠ · Rearhand 7♠. The 10 beats the King: 4 + 10 + 0 = 14 points for middlehand.',
      },
    },
    {
      title: 'The Jacks are always the top trumps',
      body: 'In a [[suit game]] the declarer names a trump suit. The four Jacks are the highest [[trump]] cards, always in this order: J♣, J♠, J♥, J♦. After them come the trump suit’s A, 10, K, Q, 9, 8, 7 — 11 trumps in all. The Jacks count as trumps, not as their printed suit: if hearts are trump and someone leads a Jack, you must answer with a trump if you can.',
      scene: {
        zones: [
          {
            id: 'trumps',
            label: 'Trumps in a hearts game (best → worst)',
            cards: ['JC', 'JS', 'JH', 'JD', 'AH', 'TH', 'KH', 'QH', '9H', '8H', '7H'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
        ],
        caption: 'Eleven trumps: four Jacks, then the seven hearts.',
      },
      tip: 'The Jacks rank Clubs, Spades, Hearts, Diamonds — the same order as the suits’ values (12, 11, 10, 9).',
    },
    {
      title: 'Bidding: who becomes the declarer?',
      body: 'Players compete to be declarer by calling numbers. [[Middlehand|middlehand]] starts, calling [[bids|bid]] to forehand: 18, 20, 22, 23, 24, 27, 30… Forehand answers “yes” to stay in, or passes. Whoever is left then faces [[rearhand]] the same way, and the last player standing is the [[declarer]]. Each number is the value of a possible game, so never bid more than your best game is worth.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['JC', 'JS', 'AC', 'TC', 'KC', '9C', '8C', 'AS', 'TH', '8D'],
            layout: 'fan',
            highlight: [0, 1, 2, 3, 4, 5, 6],
          },
        ],
        caption:
          'The two black Jacks and five clubs: seven trumps in a clubs game, worth at least (2 + 1) × 12 = 36. A hand worth bidding on!',
      },
      tip: 'If nobody bids even 18, the cards are thrown in and the next player deals (many home games play “Ramsch” instead).',
    },
    {
      title: 'The skat: swap two cards',
      body: 'The declarer may pick up the [[skat]], holding 12 cards, then put any two cards face down as the new skat. Those two cards’ points count for the declarer at the end! Good habits: put away a lonely 10 that could be captured, or the last cards of a suit so you can trump it. (You may also play without looking at the skat — a “hand game” — for a higher value.)',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['JS', 'JD', 'AD', 'TD', 'KD', '9D', '7D', 'AC', 'TH', '8S'],
            layout: 'fan',
            highlight: [8],
          },
          {
            id: 'skat',
            label: 'The skat (just picked up)',
            cards: ['QD', '7H'],
            layout: 'row',
            highlight: [1],
          },
        ],
        caption:
          'A smart swap: put the 10♥ and 7♥ back in the skat. 10 points banked, and no hearts left to lose.',
      },
    },
    {
      title: 'Choose your game: suit, grand or null',
      body: 'Now the declarer announces the game. A [[suit game]]: name clubs, spades, hearts or diamonds as trump. A [[grand]]: only the four Jacks are trumps — powerful, but you need strong Jacks and Aces. Or [[null]]: you promise to lose every trick! In null there are no trumps, and each suit ranks A, K, Q, J, 10, 9, 8, 7.',
      scene: {
        zones: [
          {
            id: 'grand',
            label: 'A grand hand',
            cards: ['JC', 'JS', 'JH', 'AS', 'TS', 'KS', 'AC', 'TC', 'AH', 'TH'],
            layout: 'fan',
            highlight: [0, 1, 2],
          },
          {
            id: 'null',
            label: 'A null hand',
            cards: ['7S', '8S', '9S', '7H', '8H', '7C', '8C', '9C', '7D', '8D'],
            layout: 'fan',
          },
        ],
        caption: 'Three Jacks and plenty of Aces and Tens → grand. Nothing but low cards → null.',
      },
    },
    {
      title: 'Winning, losing and the game’s value',
      body: 'After 10 tricks, count the declarer’s [[card points]], including the skat. 61 or more wins; 60 loses. Each game has a value: a base (diamonds 9, hearts 10, spades 11, clubs 12, grand 24) times a multiplier. For the multiplier, count the top trumps you hold in an unbroken row from the J♣ (“with 1, with 2…”) — or, if you don’t have the J♣, how many are missing before your best one (“without 1, without 2…”). Add 1 for the game, 1 more for [[schneider]], and 1 more for schwarz (one side taking every trick). Null is simply worth 23. Your value must reach your bid. Win and you score the value; lose and you lose double.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand (a hearts game)',
            cards: ['JC', 'JH', 'AH', 'TH', 'KH', '9H', '7H', 'AS', 'KS', '8C'],
            layout: 'fan',
            highlight: [0, 1],
          },
        ],
        caption:
          'You hold the J♣ but not the J♠: “with 1”. Hearts: (1 + 1) × 10 = 20, enough for a bid of 18 or 20.',
      },
      tip: 'The Jacks in the skat count for the multiplier too, so the skat can change your game’s value.',
    },
    {
      title: 'A tiny example: counting to 61',
      body: 'You played hearts, and the 10 tricks are done. Count the points in your tricks plus the [[skat]]: A♠ 11, 10♠ 10, A♥ 11, 10♥ 10, K♣ 4, Q♦ 3, and two Jacks at 2 each — that’s 53. The 10♦ you put in the skat adds 10 more: 63. The 7s, 8s and 9s add nothing. 63 beats 60, so you win! If the [[defenders]] had 30 or fewer, they would be [[schneider]].',
      scene: {
        zones: [
          {
            id: 'won',
            label: 'Your tricks (point cards only)',
            cards: ['AS', 'TS', 'AH', 'TH', 'KC', 'QD', 'JC', 'JH'],
            layout: 'row',
          },
          {
            id: 'skat',
            label: 'Your skat',
            cards: ['TD', '7S'],
            layout: 'row',
            highlight: [0],
          },
        ],
        caption: '53 in your tricks + 10 in the skat = 63 points. You win!',
      },
    },
    {
      title: 'Beginner strategy',
      body: 'Bid with confidence when you hold two or more Jacks and a long suit. As [[declarer]], lead your Jacks early to pull out the defenders’ trumps. Put lonely 10s in the skat. As a defender, help your partner: [[smear]] a 10 or King onto a trick your partner is sure to win. And keep counting points — 61 is the magic number.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['JC', 'JS', 'AH', 'TH', 'KH', '9H', '7H', 'AC', 'TC', '8S'],
            layout: 'fan',
            highlight: [0, 1],
          },
        ],
        caption: 'Two black Jacks and five hearts: a confident hearts game “with 2”, worth 30.',
      },
    },
  ],
  mistakes: [
    'Forgetting that Jacks are trumps and not part of their printed suit — in a hearts game, the J♠ is a trump, not a spade.',
    'Thinking the King beats the Ten. In Skat the 10 ranks just below the Ace — and it’s worth 10 points.',
    'Bidding more than your game is worth. If your game’s value ends up below your bid, you lose even with 61 points or more.',
    'Leaving a lonely 10 in your hand instead of putting it safely in the skat.',
    'Counting tricks instead of points. Six tricks full of 7s and 8s won’t get you to 61.',
    'As a defender, throwing a 10 or Ace onto a trick the declarer is going to win.',
    'Putting a trump — especially a Jack — into the skat without a very good reason. Trumps are your strength.',
  ],
  tips: [
    'Tip: Learn the magic numbers: Ace 11, Ten 10, King 4, Queen 3, Jack 2. Everything else is worth nothing.',
    'Tip: Two or more Jacks plus a long suit is usually a good hand to bid on.',
    'Tip: As declarer, lead your Jacks early to pull out the defenders’ trumps.',
    'Tip: Put a lonely 10 in the skat — its 10 points count for you, and nobody can capture it there.',
    'Tip: As a defender, smear a 10 or King onto a trick your partner is sure to win.',
    'Tip: Work out your game’s value before you bid. Hearts “with 1” is worth 20, so don’t go past 20 with that hand.',
    'Tip: Keep a running count of points. At 61 you’ve won, and at 90 the defenders are Schneider.',
  ],
  quiz: [
    {
      question: 'How many card points does the declarer need to win a suit game or a grand?',
      options: ['60', '61', '90', '120'],
      answer: 1,
      explanation:
        'There are 120 points in the deck. The declarer needs more than half: 61. With exactly 60, the defenders win.',
    },
    {
      question: 'Hearts are trump. Which card is the highest?',
      options: ['A♥', 'J♥', 'J♣', '10♥'],
      answer: 2,
      explanation:
        'The four Jacks are always the top trumps, and the J♣ is the best of them. Then come J♠, J♥, J♦ and only then the A♥.',
    },
    {
      question: 'In a plain (non-trump) suit, which card wins: the King or the Ten?',
      options: [
        'The Ten — it ranks just below the Ace',
        'The King — Kings always beat Tens',
        'Whichever was played first',
      ],
      answer: 0,
      explanation:
        'In suit games and grands each suit ranks A, 10, K, Q, 9, 8, 7. The Ten is both strong and worth 10 points.',
    },
    {
      question: 'In a null game, what must the declarer do?',
      options: [
        'Win at least 61 points',
        'Win every trick',
        'Play with only the Jacks as trumps',
        'Lose every trick',
      ],
      answer: 3,
      explanation:
        'Null is the opposite game: the declarer must not take a single trick. There are no trumps in null.',
    },
    {
      question:
        'You pick up the skat and hold a lonely 10♠ with no other spades. What is usually a smart move?',
      options: [
        'Keep it and lead it later',
        'Put it in the skat so its 10 points are safely yours',
        'Put a Jack in the skat instead',
      ],
      answer: 1,
      explanation:
        'A lonely 10 is easily caught by the Ace. In the skat its points count for you, and you also empty a suit you can now trump.',
    },
  ],
  example: {
    intro:
      'Three players: you are forehand, on the dealer’s left. Middlehand sits on your left, and rearhand — today’s dealer — on your right. You’ll answer the first bid and lead the first trick. Let’s win a deal as declarer!',
    steps: [
      {
        narration:
          'Your 10 cards: the J♣ and J♥, five hearts (A, 10, K, 8, 7), the A♣, a lonely 10♠ and the 8♦. If hearts become trump, the two Jacks join the hearts and you hold 7 trumps! Two more cards wait face down in the [[skat]]. You’re [[forehand]].',
        scene: {
          zones: [
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JC', 'JH', 'AH', 'TH', 'KH', '8H', '7H', 'AC', 'TS', '8D'],
              layout: 'fan',
              highlight: [0, 1],
            },
            {
              id: 'skat',
              label: 'Skat',
              cards: ['QH', '7C'],
              layout: 'stack',
              faceDown: [0, 1],
            },
          ],
          caption: 'Your hand — and two mystery cards in the skat.',
        },
      },
      {
        narration:
          'The bidding begins. [[Middlehand|middlehand]], on your left, asks: “18?” Saying “yes” means you’re ready to play a game worth at least 18.',
        scene: {
          zones: [
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JC', 'JH', 'AH', 'TH', 'KH', '8H', '7H', 'AC', 'TS', '8D'],
              layout: 'fan',
              highlight: [0, 1, 2, 3, 4, 5, 6],
            },
            {
              id: 'skat',
              label: 'Skat',
              cards: ['QH', '7C'],
              layout: 'stack',
              faceDown: [0, 1],
            },
          ],
          caption: 'Middlehand: “18?”',
        },
        decision: {
          prompt: 'Middlehand bids 18. What do you answer?',
          options: [
            {
              label: 'Yes',
              correct: true,
              feedback:
                'Right! Two Jacks and five hearts make a strong hearts game. With the J♣ but not the J♠ it is worth (1 + 1) × 10 = 20 — more than 18.',
            },
            {
              label: 'Pass',
              correct: false,
              feedback:
                'Too cautious! This is a lovely hand. Passing lets someone else become declarer.',
            },
          ],
          proHint:
            'Pros work out their game’s value before bidding. Hearts “with 1” is worth 20, so they would happily hold up to 20.',
        },
      },
      {
        narration:
          'Middlehand passes, and [[rearhand]] passes too. You’re the [[declarer]] at 18! You pick up the skat: the Q♥ and the 7♣. Now you hold 12 cards and must put two back face down.',
        scene: {
          zones: [
            {
              id: 'hand',
              label: 'Your hand (12 cards)',
              cards: ['JC', 'JH', 'AH', 'TH', 'KH', 'QH', '8H', '7H', 'AC', '7C', 'TS', '8D'],
              layout: 'fan',
              highlight: [5, 9],
            },
          ],
          caption: 'The Q♥ and 7♣ join your hand. Two cards must go back.',
        },
        decision: {
          prompt: 'Which two cards go into the skat?',
          options: [
            {
              label: 'The 10♠ and the 8♦',
              correct: true,
              feedback:
                'Excellent. Your lonely 10♠ could easily be caught by the A♠; in the skat its 10 points are safely yours. And now you have no spades or diamonds, so you can trump them.',
            },
            {
              label: 'The 7♣ and the 8♦',
              correct: false,
              feedback:
                'Safe-looking, but your lonely 10♠ stays behind. If a defender leads the A♠, you must play it and hand them 21 points.',
            },
            {
              label: 'The J♥ and the 7♥',
              correct: false,
              feedback:
                'Never throw away trumps — especially a Jack! They are the strength of your hand.',
            },
          ],
          proHint:
            'Pros bank lonely 10s in the skat and empty whole suits so they can trump them later.',
        },
      },
      {
        narration:
          'The 10♠ and 8♦ go face down — 10 points already in your pocket. Time to announce your game: a [[suit game]], a [[grand]] or [[null]]?',
        scene: {
          zones: [
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JC', 'JH', 'AH', 'TH', 'KH', 'QH', '8H', '7H', 'AC', '7C'],
              layout: 'fan',
              highlight: [0, 1, 2, 3, 4, 5, 6, 7],
            },
            {
              id: 'skat',
              label: 'Your new skat (face down)',
              cards: ['TS', '8D'],
              layout: 'stack',
              faceDown: [0, 1],
            },
          ],
          caption: 'Your hand after the swap.',
        },
        decision: {
          prompt: 'Which game do you announce?',
          options: [
            {
              label: 'Hearts',
              correct: true,
              feedback:
                'Yes! With hearts as trump you hold 8 of the 11 trumps: J♣, J♥, A♥, 10♥, K♥, Q♥, 8♥ and 7♥.',
            },
            {
              label: 'Grand',
              correct: false,
              feedback:
                'In a grand only the Jacks are trumps, and you have just two. Your hearts would be an ordinary suit — far too risky.',
            },
            {
              label: 'Null',
              correct: false,
              feedback:
                'Null means losing every trick. With the J♣ and the A♥ you would certainly win some!',
            },
          ],
          proHint:
            'Pick the game where your long suit is trump. A grand usually needs three or four Jacks, or two Jacks plus several Aces and Tens.',
        },
      },
      {
        narration:
          'Hearts it is! Your game is worth 20 (“with 1, game 2” × 10), which covers your bid of 18. As forehand, you lead the first [[trick]].',
        scene: {
          zones: [
            {
              id: 'hand',
              label: 'Your hand (hearts are trump)',
              cards: ['JC', 'JH', 'AH', 'TH', 'KH', 'QH', '8H', '7H', 'AC', '7C'],
              layout: 'fan',
            },
          ],
          caption: 'You lead first. The defenders hold just 3 trumps: J♠, J♦ and 9♥.',
        },
        decision: {
          prompt: 'What do you lead?',
          options: [
            {
              label: 'The J♣',
              card: 'JC',
              correct: true,
              feedback:
                'Great lead. It’s the highest card in the game, and it forces each defender to play a trump if they have one.',
            },
            {
              label: 'The A♣',
              card: 'AC',
              correct: false,
              feedback:
                'It would probably win 11 points, but the defenders keep their trumps and could use them later to trump your winners. Pull trumps first.',
            },
            {
              label: 'The 7♣',
              card: '7C',
              correct: false,
              feedback:
                'That hands the lead to the defenders for nothing. Use your strength first.',
            },
          ],
          proHint:
            'With lots of trumps, pros pull the defenders’ trumps early, starting with the Jacks.',
        },
      },
      {
        narration:
          'Middlehand must answer with a [[trump]] and gives up the J♠; rearhand plays the 9♥. Your J♣ wins the [[trick]]: 2 + 2 + 0 = 4 points. Now count trumps: the J♠ and 9♥ are gone, so the [[defenders]] have just one trump left — the J♦. You lead again.',
        scene: {
          zones: [
            {
              id: 'trick',
              label: 'Trick 1',
              cards: ['JC', 'JS', '9H'],
              layout: 'row',
              highlight: [0],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JH', 'AH', 'TH', 'KH', 'QH', '8H', '7H', 'AC', '7C'],
              layout: 'fan',
            },
          ],
          caption: 'You J♣ · Middlehand J♠ · Rearhand 9♥. Your points: 4.',
        },
        decision: {
          prompt: 'One defender trump (the J♦) is still out there. What do you lead now?',
          options: [
            {
              label: 'The J♥',
              card: 'JH',
              correct: true,
              feedback:
                'Yes! The J♥ beats the J♦, so it wins and drags out the defenders’ last trump. After that, nobody can trump your Aces.',
            },
            {
              label: 'The A♣',
              card: 'AC',
              correct: false,
              feedback:
                'Tempting, but whoever holds the J♦ may have no clubs — then they trump your Ace and grab its 11 points. Pull the last trump first.',
            },
            {
              label: 'The 7♥',
              card: '7H',
              correct: false,
              feedback:
                'That pulls a trump too, but the J♦ would win the trick — and the other defender could smear points onto it. Your J♥ does the same job and wins.',
            },
          ],
          proHint:
            'Count trumps as they fall. When the defenders have one trump left and you hold a higher one, lead it.',
        },
      },
      {
        narration:
          'You lead the J♥. Middlehand has no trumps left and throws the 9♦, while rearhand has to give up the J♦. The [[defenders]] are out of trumps — every heart in your hand is now a sure winner!',
        scene: {
          zones: [
            {
              id: 'trick',
              label: 'Trick 2',
              cards: ['JH', '9D', 'JD'],
              layout: 'row',
              highlight: [0],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['AH', 'TH', 'KH', 'QH', '8H', '7H', 'AC', '7C'],
              layout: 'fan',
            },
          ],
          caption: 'You J♥ · Middlehand 9♦ · Rearhand J♦. Your points: 8.',
        },
      },
      {
        narration:
          'You cash the A♣ (middlehand 8♣, rearhand 9♣): 11 more points. Then you lead your little 7♣ — it can never win a trick, so you give it up now while you still hold every trump. Middlehand wins with the 10♣ — and rearhand, playing last and seeing partner win, [[smears|smear]] the K♣ onto it. That’s 14 points for the defenders.',
        scene: {
          zones: [
            {
              id: 'trick',
              label: 'Trick 4',
              cards: ['7C', 'TC', 'KC'],
              layout: 'row',
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['AH', 'TH', 'KH', 'QH', '8H', '7H'],
              layout: 'fan',
            },
          ],
          caption:
            'You 7♣ · Middlehand 10♣ · Rearhand K♣ (smeared). Your points: 19 · Defenders: 14.',
        },
      },
      {
        narration:
          'Middlehand leads the A♠; rearhand plays the 8♠ and you trump with the 7♥ — 11 more points. From there your hearts win every trick, and the defenders must throw their remaining cards — Aces, Tens and all — onto them. Time to count, including the 10♠ in your [[skat]]…',
        scene: {
          zones: [
            {
              id: 'big',
              label: 'Aces and Tens you collected (with the 10♠ from your skat)',
              cards: ['AC', 'AS', 'AD', 'AH', 'TH', 'TD', 'TS'],
              layout: 'row',
              highlight: [0, 1, 2, 3, 4, 5, 6],
            },
            {
              id: 'def',
              label: 'The defenders’ only trick',
              cards: ['7C', 'TC', 'KC'],
              layout: 'row',
            },
          ],
          caption: 'Final count — You 106 · Defenders 14.',
        },
        decision: {
          prompt: 'You have 106 points and the defenders 14. What is the result?',
          options: [
            {
              label: 'You win, and the defenders are Schneider',
              correct: true,
              feedback:
                'Yes! 61 or more wins, and the defenders have 30 or fewer — that’s Schneider, which adds 1 to the multiplier: (with 1, game 2, Schneider 3) × 10 = 30 points.',
            },
            {
              label: 'You win, but only just',
              correct: false,
              feedback:
                'You smashed it! 106 is far past 61 — and the defenders’ 14 means they are Schneider.',
            },
            {
              label: 'You lose — you needed all 120',
              correct: false,
              feedback: 'You only need 61. Every point beyond that is a bonus.',
            },
          ],
          proHint:
            'Pros keep a running count during play. Once you reach 90, the defenders are Schneider and your game gains value.',
        },
      },
    ],
    outro:
      'Schneider! Hearts “with 1, game 2, Schneider 3” × 10 = 30 points for you. Had you lost, you’d have lost double the game’s value, so Skat rewards bold but careful bidding. Real Skat has much more to discover — hand games, open games, grand and null tactics, Ramsch — but you’ve just played its core. Ready for the quiz?',
  },
  seo: {
    description:
      'Learn Skat, Germany’s favourite card game: card points, Jacks as trumps, bidding, the skat, and suit, grand and null games — with a clickable example deal.',
  },
});
