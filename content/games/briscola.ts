import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'briscola',
  name: 'Briscola',
  origin: { country: 'Italy', countryCode: 'IT', region: 'europe' },
  type: 'trick-taking',
  players: { min: 2, max: 4, ideal: 2 },
  deck: '40 cards: Ace to 7, Jack, Queen and King of each suit (a standard deck with the 8s, 9s and 10s taken out)',
  difficulty: 2,
  length: 'About 10 minutes a game',
  minutes: 10,
  moods: ['chill', 'social', 'competitive'],
  hook: 'Italy’s classic card duel: no need to follow suit — just grab the Aces and Threes',
  history:
    'Briscola belongs to the big “Ace-Ten” family of card games, where a few high cards carry almost all the points — in Briscola, the Aces and the Threes. It is thought to be related to an old French game called Brusquembille. Along with Scopa and Tressette it is one of Italy’s best-loved card games, and close relatives are played in Spain (Brisca) and on the Croatian coast (Briškula).',
  featured: false,
  order: 220,
  variantTaught:
    'Classic two-player Briscola with the 40-card French-suited deck (A–7, J, Q, K; the Queen plays the part of the Italian Knight). Cards rank A, 3, K, Q, J, 7, 6, 5, 4, 2 and score A = 11, 3 = 10, K = 4, Q = 3, J = 2, others 0 — 120 points in all. Three cards each; the next card is turned face up under the stock and its suit is the briscola (trump). You never have to follow suit: a briscola beats any other suit, otherwise the highest card of the suit led wins. The trick winner draws first and leads next, and the face-up briscola is the last card drawn. More than 60 points wins; 60–60 is a draw.',
  variants:
    'In Italy, Briscola is played with a regional 40-card pack: the Fante, Cavallo and Re (Jack, Knight, King) are worth 2, 3 and 4 points — we use the French-suited equivalent, with the Queen in the Knight’s place. With four players it is played in two teams of partners, and some groups even let partners swap secret signals about their cards. With three players, one 2 is usually taken out so the cards share evenly. Briscola Chiamata is a lively five-player version with an auction, where the winner calls a card to pick a secret partner. Some tables let a player holding a low briscola swap it for the face-up card, and many play a match of several games, such as the best of three.',
  glossary: [
    {
      term: 'briscola',
      definition:
        'The trump suit, shown by the card turned face up under the stock. Any briscola beats any card of another suit: if clubs are briscola, the 2♣ beats the A♥.',
    },
    {
      term: 'trick',
      definition:
        'One round where each player plays one card. The winner takes both cards — and all the points in them.',
    },
    {
      term: 'lead',
      definition:
        'To play the first card of a trick. Whoever won the last trick leads the next one.',
    },
    {
      term: 'stock',
      definition:
        'The face-down pile left after the deal, with the face-up briscola card tucked underneath. After each trick both players draw one card from it.',
    },
    {
      term: 'card points',
      definition:
        'What the cards you win are worth: Ace 11, Three 10, King 4, Queen 3, Jack 2, and nothing for 7, 6, 5, 4 and 2. A trick with the A♠ and 3♠ is worth 21.',
    },
    {
      term: 'carico',
      definition:
        'Italian for “loaded”: an Ace or a Three, the two big point cards (11 and 10). Guard them carefully — and try to capture your opponent’s.',
    },
    {
      term: 'blank',
      definition:
        'A card worth zero points: any 7, 6, 5, 4 or 2 (Italians call it a liscio, “smooth”). Blanks are the safest cards to lead, like the 4♠.',
    },
  ],
  lesson: [
    {
      title: 'The goal: win the points, not the tricks',
      body: 'Briscola is a duel for points. You play [[tricks|trick]], and the winner of each trick keeps the cards in it. Some cards are worth a lot of [[card points]], most are worth nothing. There are 120 points in the deck, and whoever collects more than 60 wins the game.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'A trick you won',
            cards: ['3S', 'AS'],
            layout: 'row',
            highlight: [1],
          },
        ],
        caption: 'Their 3♠ (10 points) and your A♠ (11 points): 21 points in one trick!',
      },
    },
    {
      title: 'The deck, the deal and the briscola',
      body: 'Briscola uses 40 cards: Ace to 7, plus Jack, Queen and King, in each suit. Each player gets three cards. The next card is turned face up and tucked under the [[stock]] so it sticks out. Its suit is the [[briscola]] — the trump suit — for the whole game, and that card will be the last one drawn.',
      scene: {
        zones: [
          {
            id: 'opp',
            label: 'Opponent',
            cards: ['7C', 'QS', '4D'],
            layout: 'fan',
            faceDown: [0, 1, 2],
          },
          {
            id: 'stock',
            label: 'Stock (briscola underneath)',
            cards: ['JC', '5H'],
            layout: 'stack',
            faceDown: [0],
            highlight: [1],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['KD', '2S', 'AH'],
            layout: 'fan',
            highlight: [2],
          },
        ],
        caption:
          'The 5♥ is turned up, so hearts are briscola. Your A♥ is the strongest briscola of all!',
      },
      tip: 'Only have a 52-card deck? Take out the 8s, 9s and 10s and you are ready to play.',
    },
    {
      title: 'A surprising card order',
      body: 'Here is Briscola’s famous twist: the Three is the second-highest card! In every suit, from strongest to weakest, the order is Ace, Three, King, Queen, Jack, 7, 6, 5, 4, 2.',
      scene: {
        zones: [
          {
            id: 'order',
            label: 'Strongest → weakest',
            cards: ['AS', '3S', 'KS', 'QS', 'JS', '7S', '6S', '5S', '4S', '2S'],
            layout: 'row',
            highlight: [0, 1],
          },
        ],
        caption: 'The little 3♠ beats the K♠, Q♠ and J♠.',
      },
      tip: 'Say it a few times: “Ace, Three, King, Queen, Jack…” — then the rest go down from 7 to 2.',
    },
    {
      title: 'What the cards are worth',
      body: 'Only five ranks score [[card points]]: Ace 11, Three 10, King 4, Queen 3 and Jack 2. The Aces and Threes are called [[carichi|carico]] — the “loaded” cards. Every 7, 6, 5, 4 and 2 is a [[blank]], worth nothing at all.',
      scene: {
        zones: [
          {
            id: 'points',
            label: 'Point cards: 11 · 10 · 4 · 3 · 2',
            cards: ['AC', '3C', 'KC', 'QC', 'JC'],
            layout: 'row',
            highlight: [0, 1],
          },
          {
            id: 'blanks',
            label: 'Blanks: 0 points each',
            cards: ['7C', '6C', '5C', '4C', '2C'],
            layout: 'row',
          },
        ],
        caption: 'Each suit holds 30 points, and the Ace and Three alone are 21 of them.',
      },
    },
    {
      title: 'A trick: play any card you like',
      body: 'The player who didn’t deal [[leads|lead]] the first [[trick]] by playing any card. The other player answers with any card too. Unlike most trick games, you never have to follow suit — even if you have cards of the suit that was led.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick',
            cards: ['KD', '4S'],
            layout: 'row',
            highlight: [1],
          },
          {
            id: 'hand',
            label: 'Your hand (after playing the 4♠)',
            cards: ['6D', 'JC'],
            layout: 'fan',
          },
        ],
        caption: 'Diamonds were led, but you may answer with the 4♠ — even though you hold the 6♦.',
      },
    },
    {
      title: 'Who wins the trick',
      body: 'If a [[briscola]] was played, the highest briscola wins. Otherwise, the higher card of the suit that was led wins. A card of a different suit that isn’t briscola can never win — however high it is.',
      scene: {
        zones: [
          {
            id: 'same',
            label: 'Same suit: higher card wins',
            cards: ['7S', '3S'],
            layout: 'row',
            highlight: [1],
          },
          {
            id: 'trump',
            label: 'A briscola beats other suits',
            cards: ['AD', '2H'],
            layout: 'row',
            highlight: [1],
          },
          {
            id: 'other',
            label: 'Other suit, no briscola: lead wins',
            cards: ['5C', 'KS'],
            layout: 'row',
            highlight: [0],
          },
        ],
        caption: 'Hearts are briscola. The first card in each pair was led.',
      },
    },
    {
      title: 'Draw, then lead again',
      body: 'The winner of the trick keeps both cards face down. Then the winner draws a card from the [[stock]] first, the other player draws second, and the winner [[leads|lead]] the next trick. The face-up briscola is the very last card drawn. When the stock is gone, you play out your last three cards without drawing.',
      scene: {
        zones: [
          {
            id: 'stock',
            label: 'Stock',
            cards: ['QS', '5H'],
            layout: 'stack',
            faceDown: [0],
            highlight: [1],
          },
          {
            id: 'hand',
            label: 'Your hand (you drew the K♥)',
            cards: ['2D', '6C', 'KH'],
            layout: 'fan',
            highlight: [2],
          },
        ],
        caption: 'You won the trick, so you draw first and lead next.',
      },
    },
    {
      title: 'Counting up and winning',
      body: 'After all 20 tricks, each player adds up the [[card points]] in the cards they won. There are exactly 120, so more than 60 wins the game. If you both have 60, it’s a draw. Many people play a few games in a row as a match.',
      scene: {
        zones: [
          {
            id: 'pile',
            label: 'Your point cards',
            cards: ['AD', 'AC', '3H', '3C', '3S', 'KS', 'QD', 'JC'],
            layout: 'row',
            highlight: [0, 1, 2, 3, 4],
          },
        ],
        caption: '11 + 11 + 10 + 10 + 10 + 4 + 3 + 2 = 61. Just enough to win!',
      },
    },
    {
      title: 'A tiny example',
      body: 'Hearts are [[briscola]]. Your opponent [[leads|lead]] the 3♣ — 10 points. You have no club higher than a 3, but you do hold the 2♥, the lowest briscola. You play it, and it wins! Your zero-point card has just captured 10 points.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick (hearts are briscola)',
            cards: ['3C', '2H'],
            layout: 'row',
            highlight: [1],
          },
          {
            id: 'hand',
            label: 'Your hand after the trick',
            cards: ['AD', '5S'],
            layout: 'fan',
          },
        ],
        caption: 'Any briscola beats a card of another suit — even the 2♥ beats a 3♣.',
      },
    },
    {
      title: 'Beginner strategy',
      body: 'Lead your [[blanks|blank]]: if your opponent wins them, they get nothing. Keep your [[carichi|carico]] out of danger, because any briscola can capture them. Save your briscole for capturing your opponent’s Aces and Threes. And when a trick is worth nothing, don’t spend a briscola on it — throw a blank instead.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand (hearts are briscola)',
            cards: ['4C', 'AD', 'JH'],
            layout: 'fan',
            highlight: [0],
          },
        ],
        caption:
          'Lead the 4♣ (worth nothing). Keep the A♦ safe, and save the J♥ to capture a big card.',
      },
      tip: 'There are ten briscole. Count them as they fall: once your opponent can’t have any left, your Aces are safe to lead.',
    },
  ],
  mistakes: [
    'Thinking you must follow suit. In Briscola you may always play any card you like.',
    'Leading an Ace or a Three that isn’t a briscola. Any briscola can capture it, handing your opponent 10 or 11 points.',
    'Spending a briscola on a trick worth zero points. Save it for a trick with an Ace or Three in it.',
    'Forgetting that the Three ranks above the King — and is worth 10 points, not 3.',
    'Expecting a high card of another suit to win. If it isn’t the suit led and isn’t a briscola, it can never win the trick.',
    'Drawing in the wrong order. The trick winner always draws first, then leads the next trick.',
  ],
  tips: [
    'Tip: In Briscola, lead your blanks (7s, 6s, 5s, 4s and 2s) and keep your Aces and Threes out of danger.',
    'Tip: Save your briscole for capturing Aces and Threes — that’s 10 or 11 points each time.',
    'Tip: When your opponent leads a blank in a suit where you hold the Ace, playing the Ace banks 11 points safely.',
    'Tip: Use your lowest briscola that does the job. The 2 of briscola captures the Three of another suit just as well as the Ace of briscola does.',
    'Tip: Nothing to win in a trick? Throw a blank and lose nothing.',
    'Tip: Count the briscole — there are ten. Once your opponent can’t have any left, your Aces are safe to lead (and so is a Three whose Ace has already gone).',
    'Tip: Near the end, look at the face-up briscola. If it’s a good card, losing a zero-point trick can win it for you.',
  ],
  quiz: [
    {
      question: 'Your opponent leads a heart, and you have hearts in your hand. Must you play one?',
      options: [
        'Yes, always',
        'No — you may play any card you like',
        'Only if your heart can beat theirs',
      ],
      answer: 1,
      explanation:
        'In Briscola there is no need to follow suit. You may play any card, of any suit, at any time.',
    },
    {
      question: 'Which card ranks higher in Briscola?',
      options: ['The 3♠', 'The K♠', 'They are equal'],
      answer: 0,
      explanation:
        'The order is Ace, Three, King, Queen, Jack, 7, 6, 5, 4, 2. The Three is the second-highest card — and worth 10 points.',
    },
    {
      question: 'Diamonds are briscola. Your opponent leads the K♠ and you play the 2♦. Who wins?',
      options: [
        'Your opponent — a King beats a 2',
        'Nobody — the trick is played again',
        'You — any briscola beats a card of another suit',
      ],
      answer: 2,
      explanation:
        'A briscola beats every card of the other suits, however small it is. Your 2♦ captures the King and its 4 points.',
    },
    {
      question: 'How many card points do you need to win a game?',
      options: ['21', '60', '120', '61'],
      answer: 3,
      explanation:
        'There are 120 points in the deck, so 61 or more wins. If both players have exactly 60, it’s a draw.',
    },
    {
      question:
        'Hearts are briscola. Your opponent leads the 6♠, worth nothing. You hold the 7♥, the K♦ and the 4♣. What is the best play?',
      options: ['The 7♥ — win it with a briscola', 'The 4♣ — lose nothing', 'The K♦'],
      answer: 1,
      explanation:
        'The trick is worth zero points. Throw the blank 4♣: you lose nothing and keep your briscola for a trick with real points. The K♦ would hand over 4 points.',
    },
  ],
  example: {
    intro:
      'A two-player game of Briscola. Your opponent dealt, so you lead the first trick. You make the key choices — and watch the points pile up.',
    steps: [
      {
        narration:
          'Three cards each, then the next card is turned face up under the [[stock]]: the 3♣. Clubs are the [[briscola]] for this game! You hold the A♥ (11 points), the 2♠ (a [[blank]]) and the Q♣ (a briscola worth 3). You [[lead]] the first [[trick]].',
        scene: {
          zones: [
            {
              id: 'opp',
              label: 'Opponent',
              cards: ['7S', 'KD', '5H'],
              layout: 'fan',
              faceDown: [0, 1, 2],
            },
            {
              id: 'stock',
              label: 'Stock (briscola underneath)',
              cards: ['QS', '3C'],
              layout: 'stack',
              faceDown: [0],
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['AH', '2S', 'QC'],
              layout: 'fan',
            },
          ],
          caption: 'Clubs are briscola. Your move!',
        },
        decision: {
          prompt: 'What do you lead?',
          options: [
            {
              label: 'The 2♠',
              card: '2S',
              correct: true,
              feedback:
                'Perfect. A blank risks nothing: even if your opponent wins it, they get no points from you.',
            },
            {
              label: 'The A♥',
              card: 'AH',
              correct: false,
              feedback:
                'Leading an Ace is like leaving a gift on the table: your opponent can grab its 11 points with any briscola.',
            },
            {
              label: 'The Q♣',
              card: 'QC',
              correct: false,
              feedback:
                'That’s a briscola — save it! Briscole are for capturing your opponent’s big cards later.',
            },
          ],
          proHint:
            'Lead blanks, keep your Aces and Threes safe, and save your briscole for captures.',
        },
      },
      {
        narration:
          'You lead the 2♠, and your opponent wins it with the 7♠ — a higher spade, but zero points. The winner draws first, then you draw the A♦. Now your opponent leads the 5♥, a [[blank]].',
        scene: {
          zones: [
            {
              id: 'opp',
              label: 'Opponent',
              cards: ['KD', 'AS'],
              layout: 'fan',
              faceDown: [0, 1],
            },
            {
              id: 'trick',
              label: 'Trick 2',
              cards: ['5H'],
              layout: 'row',
            },
            {
              id: 'stock',
              label: 'Stock',
              cards: ['QS', '3C'],
              layout: 'stack',
              faceDown: [0],
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['AH', 'QC', 'AD'],
              layout: 'fan',
            },
          ],
          caption: 'Trick 1 went to your opponent: 2♠ against 7♠, no points.',
        },
        decision: {
          prompt: 'Your opponent leads the 5♥, worth nothing. What do you play?',
          options: [
            {
              label: 'The A♥',
              card: 'AH',
              correct: true,
              feedback:
                'Yes! The Ace is the highest heart and nobody plays after you, so it wins — and its 11 points are now safe in your pile. Kept in your hand, it could be captured by a briscola later.',
            },
            {
              label: 'The Q♣',
              card: 'QC',
              correct: false,
              feedback:
                'It wins (a briscola beats any heart), but you spend a briscola to win just 3 points — the Q♣’s own.',
            },
            {
              label: 'The A♦',
              card: 'AD',
              correct: false,
              feedback:
                'Ouch! A diamond can’t beat a heart and it isn’t a briscola, so the 5♥ wins — and your opponent collects your 11 points.',
            },
          ],
          proHint:
            'When a blank is led in the suit of your Ace, a pro often plays the Ace: it can’t be beaten, and 11 points are banked.',
        },
      },
      {
        narration:
          'Your A♥ wins: 11 points for you. You draw first (the 4♠), then your opponent draws. Like a good player, you lead your new [[blank]], the 4♠ — but your opponent takes it with the A♠, banking 11 points of their own. Score: you 11, opponent 11.',
        scene: {
          zones: [
            {
              id: 'trick',
              label: 'Trick 3',
              cards: ['4S', 'AS'],
              layout: 'row',
              highlight: [1],
            },
            {
              id: 'pile',
              label: 'Your pile',
              cards: ['5H', 'AH'],
              layout: 'stack',
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['QC', 'AD'],
              layout: 'fan',
            },
          ],
          caption: 'You lost only a blank. Their Ace was always worth 11 to them.',
        },
      },
      {
        narration:
          'Your opponent draws first, then you draw the 6♦. Now they lead the 3♠ — a [[carico]] worth 10 points! The A♠ is gone, so no spade can beat it. Only a briscola can… and they’re hoping you don’t have one.',
        scene: {
          zones: [
            {
              id: 'opp',
              label: 'Opponent',
              cards: ['KD', 'JH'],
              layout: 'fan',
              faceDown: [0, 1],
            },
            {
              id: 'trick',
              label: 'Trick 4',
              cards: ['3S'],
              layout: 'row',
              highlight: [0],
            },
            {
              id: 'stock',
              label: 'Stock',
              cards: ['QS', '3C'],
              layout: 'stack',
              faceDown: [0],
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['QC', 'AD', '6D'],
              layout: 'fan',
            },
          ],
          caption: 'Score: you 11, opponent 11. Ten points are on the table.',
        },
        decision: {
          prompt: 'The 3♠ is worth 10 points. What do you play?',
          options: [
            {
              label: 'The Q♣',
              card: 'QC',
              correct: true,
              feedback:
                'Got it! Any briscola beats a card of another suit. You win 10 + 3 = 13 points.',
            },
            {
              label: 'The 6♦',
              card: '6D',
              correct: false,
              feedback:
                'A diamond can’t beat a spade, so your opponent keeps their 10 points. This is a job for your briscola!',
            },
            {
              label: 'The A♦',
              card: 'AD',
              correct: false,
              feedback:
                'Oh no — it isn’t a spade or a briscola, so the 3♠ wins, and your opponent takes 21 points!',
            },
          ],
          proHint:
            'This is exactly what briscole are for: capturing Aces and Threes. Use the lowest briscola that does the job.',
        },
      },
      {
        narration:
          'Your Q♣ captures the 3♠: 13 points! Score: you 24, opponent 11. As the winner, you’ll draw first and lead the next trick.',
        scene: {
          zones: [
            {
              id: 'trick',
              label: 'Trick 4',
              cards: ['3S', 'QC'],
              layout: 'row',
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['AD', '6D'],
              layout: 'fan',
            },
          ],
          caption: 'A briscola well spent: 13 points.',
        },
      },
      {
        narration:
          'Fast-forward: the game rolls on, trick after trick. Now only two cards are left in the [[stock]]: one face down, and the face-up 3♣. Whoever wins this trick draws the hidden card — and the loser gets the 3♣, a 10-point briscola. Score: you 34, opponent 57. There are still 29 points to play for! Your opponent leads the 4♥.',
        scene: {
          zones: [
            {
              id: 'opp',
              label: 'Opponent',
              cards: ['3D', 'JS'],
              layout: 'fan',
              faceDown: [0, 1],
            },
            {
              id: 'trick',
              label: 'Trick 17',
              cards: ['4H'],
              layout: 'row',
            },
            {
              id: 'stock',
              label: 'Last two cards',
              cards: ['QD', '3C'],
              layout: 'stack',
              faceDown: [0],
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['KH', '7C', '2D'],
              layout: 'fan',
            },
          ],
          caption: 'The winner draws the hidden card. The loser gets the 3♣.',
        },
        decision: {
          prompt: 'Your opponent leads the 4♥, worth nothing. What do you play?',
          options: [
            {
              label: 'The 2♦',
              card: '2D',
              correct: true,
              feedback:
                'Clever! You lose a trick worth zero points, so your opponent draws the hidden card — and the face-up 3♣, a 10-point briscola, comes to you.',
            },
            {
              label: 'The K♥',
              card: 'KH',
              correct: false,
              feedback:
                'It wins (a King beats a 4), but then you draw the hidden card and your opponent gets the 3♣ — 10 points and a top briscola.',
            },
            {
              label: 'The 7♣',
              card: '7C',
              correct: false,
              feedback:
                'Spending a briscola to win zero points, and handing your opponent the 3♣ as well? Double ouch.',
            },
          ],
          proHint:
            'Watch the face-up briscola near the end. If it’s a strong card, losing a cheap trick on purpose can win it for you.',
        },
      },
      {
        narration:
          'Their 4♥ wins the empty trick, so they draw the hidden card, and the 3♣ comes to you. The stock is empty: three tricks left, no more drawing. You’ve been counting — your 3♣ and 7♣ are the last two briscole! They lead the J♠ and you capture it with the 7♣. You lead the K♥, and with no heart or briscola they can’t beat it. Then your 3♣ captures their 3♦.',
        scene: {
          zones: [
            {
              id: 'tricks',
              label: 'Your last three tricks',
              cards: ['JS', '7C', 'KH', 'QD', '3C', '3D'],
              layout: 'row',
              highlight: [4],
            },
          ],
          caption: 'J♠ + 7♣ = 2 · K♥ + Q♦ = 7 · 3♣ + 3♦ = 20. That’s 29 points!',
        },
      },
      {
        narration:
          'Count time! You had 34, plus 29 from the last three tricks: 63 [[card points]]. Your opponent has 57. You passed 60 — you win the game! (60 each would have been a draw.)',
        scene: {
          zones: [
            {
              id: 'yours',
              label: 'Your best captures',
              cards: ['AH', '3S', 'QC', 'KH', '3C', '3D'],
              layout: 'row',
              highlight: [0, 1, 4, 5],
            },
            {
              id: 'opp',
              label: 'Some of your opponent’s captures',
              cards: ['AS', 'AC', '3H', 'KS'],
              layout: 'row',
            },
          ],
          caption: 'You 63 · Opponent 57. A comeback win!',
        },
      },
    ],
    outro:
      'What a comeback! You led blanks, banked your Ace, captured a Three with a briscola and lost a cheap trick on purpose to win the 3♣. Many players go on to a best-of-three match. Ready to test yourself? Try the quiz!',
  },
  seo: {
    description:
      'Learn Briscola, Italy’s classic trick-taking duel: the A-3-K card order, card points, the briscola trump and smart beginner play — with a clickable example hand.',
  },
});
