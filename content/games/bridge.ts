import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'bridge',
  name: 'Bridge',
  aka: ['Contract Bridge'],
  origin: { country: 'United States', countryCode: 'US', region: 'global' },
  type: 'trick-taking',
  players: { min: 4, max: 4, ideal: 4 },
  deck: 'One standard 52-card deck, no jokers',
  difficulty: 5,
  length: 'About 7–10 minutes a deal; a rubber or club session runs 1–3 hours',
  minutes: 60,
  moods: ['brainy', 'social', 'competitive'],
  hook: 'The great partnership game: bid a contract with your partner, then make it — playing their cards too',
  history:
    'Bridge grew out of Whist, a trick-taking game that was hugely popular in England from the 1700s — Edmond Hoyle published a famous guide to Whist in 1742. In the late 1800s came bridge-whist, then auction bridge in the early 1900s, and in 1925 the American Harold Vanderbilt is credited with perfecting the scoring of Contract Bridge, reportedly while on a cruise. Today it is played all over the world, at kitchen tables, in clubs, online and at international championships.',
  featured: false,
  order: 310,
  variantTaught:
    'A beginner introduction to Contract Bridge: the deal, a simple bidding idea (bids from 1 to 7, the suit ladder, passing, the contract), the declarer and the dummy, trick play with trumps or No Trump, and making the contract. Bidding uses common beginner guidelines — count high card points, open with about 12 or more, aim for game with about 25 between partners — rather than a full bidding system. Doubles, redoubles, vulnerability and detailed scoring are only summarised.',
  variants:
    'Full Contract Bridge adds doubles and redoubles, vulnerability, slam bonuses, and either rubber scoring (home games) or duplicate scoring (clubs and tournaments, where every table plays the same deals). Real partnerships agree a bidding system — for example Standard American or 2-over-1 in North America, or Acol in Britain — with conventions such as Stayman and Blackwood. Chicago is a popular four-deal version for home games, and Minibridge is a teaching game used by many clubs that replaces the auction with a simple count of points. Two players can try Honeymoon Bridge. For the full rules, your national bridge federation or a local club is the best next step.',
  glossary: [
    {
      term: 'trick',
      definition:
        'Four cards, one from each player, played in turn. The highest card of the suit led — or the highest trump — wins. Every deal has 13 tricks.',
    },
    {
      term: 'follow suit',
      definition:
        'Play a card of the suit that was led if you have one. If hearts are led and you hold a heart, you must play one.',
    },
    {
      term: 'trump',
      definition:
        'The suit named in the contract. Any trump beats any card of the other suits: in a spade contract, the 2♠ beats the A♥.',
    },
    {
      term: 'no trump',
      definition:
        'A contract with no trump suit, written NT (like 3NT). The highest card of the suit led always wins.',
    },
    {
      term: 'ruff',
      definition:
        'To play a trump when you have no cards of the suit led. “I’ll ruff that club with a small spade.”',
    },
    {
      term: 'draw trumps',
      definition:
        'To lead trumps until the defenders have none left, so they can’t ruff your winners. Example: playing the A♠ and K♠ until all four of their spades have fallen.',
    },
    {
      term: 'auction',
      definition:
        'The bidding before the play. Players take turns to bid or pass until a bid is followed by three passes.',
    },
    {
      term: 'bid',
      definition:
        'A promise such as 2♥. Add 6 to the number to get the tricks your team will win, and the suit becomes trump: 2♥ = 8 tricks with hearts as trumps.',
    },
    {
      term: 'book',
      definition:
        'The first 6 tricks your team wins. They don’t count toward the bid, so 1♠ promises book + 1 = 7 tricks.',
    },
    {
      term: 'contract',
      definition:
        'The final bid of the auction. Example: 4♠ means the declaring team must win at least 10 tricks with spades as trumps.',
    },
    {
      term: 'declarer',
      definition:
        'The player who plays the contract, using their own cards and the dummy’s. It’s the first player on the winning team who named the contract’s suit (or No Trump).',
    },
    {
      term: 'dummy',
      definition:
        'The declarer’s partner. After the opening lead, dummy lays all 13 cards face up and the declarer plays them.',
    },
    {
      term: 'opening lead',
      definition:
        'The very first card of the play, led by the player on the declarer’s left before the dummy is shown — like the K♦ from K-Q-J.',
    },
    {
      term: 'high card points',
      definition:
        'A quick way to judge a hand: Ace 4, King 3, Queen 2, Jack 1. A♠ K♥ Q♦ J♣ adds up to 10 points.',
    },
    {
      term: 'game',
      definition:
        'A contract worth 100 or more trick points: 3NT, 4♥, 4♠, 5♣ or 5♦. Bidding and making one earns a big bonus.',
    },
    {
      term: 'overtrick',
      definition:
        'A trick won beyond what the contract needed. Win 11 tricks in 4♠ and you have one overtrick.',
    },
  ],
  lesson: [
    {
      title: 'The goal: promise tricks, then win them',
      body: 'Bridge is for four people in two teams, and your partner sits opposite you. Players are named like the points of a compass: North and South are partners, against East and West. Every deal has two parts. First comes the [[auction]], where both teams compete to set the [[contract]] — a promise to win a certain number of the 13 [[tricks|trick]]. Then comes the play: the team that won the auction tries to keep its promise, and the other team tries to stop them.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['KS', 'QS', '5S', 'AH', 'JH', '9H', '4H', 'KC', '8C', '3C', 'AD', '7D', '2D'],
            layout: 'fan',
          },
        ],
        caption: 'Thirteen cards each. Your team will try to win the tricks it promises.',
      },
    },
    {
      title: 'The deal: 13 cards each',
      body: 'Bridge uses all 52 cards, with no jokers. The dealer deals them all out, one at a time, so everyone gets 13. In every suit the Ace is highest, then King, Queen, Jack, 10, and so on down to the 2. Sort your hand by suit as soon as you pick it up — it makes everything easier.',
      scene: {
        zones: [
          {
            id: 'suit',
            label: 'One suit, highest to lowest',
            cards: ['AS', 'KS', 'QS', 'JS', 'TS', '9S', '8S', '7S', '6S', '5S', '4S', '3S', '2S'],
            layout: 'row',
            highlight: [0],
          },
        ],
        caption: 'The Ace is high and the 2 is low — in every suit.',
      },
      tip: 'Sort with alternating colours (♠ ♥ ♣ ♦) so you never mix up two black or two red suits.',
    },
    {
      title: 'Playing a trick',
      body: 'One player starts the trick by playing any card — that’s called leading. Going clockwise, everyone must [[follow suit]] — play the same suit — if they can. If they can’t, they may play any card. The highest card of the suit led wins the [[trick]], and the winner starts the next one. Thirteen tricks make one deal.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick',
            cards: ['5H', 'KH', 'AH', '3H'],
            layout: 'row',
            highlight: [2],
          },
        ],
        caption: 'West 5♥ · North K♥ · East A♥ · South 3♥. East’s Ace wins.',
      },
    },
    {
      title: 'Trumps — and No Trump',
      body: 'Most contracts name a [[trump]] suit. If you can’t follow suit, you may play a trump — that’s called a [[ruff]] — and even the smallest trump beats any card of another suit. A contract in [[no trump]] has no trump suit at all: the highest card of the suit led always wins.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick (spades are trumps)',
            cards: ['AH', '4H', '2S', '9H'],
            layout: 'row',
            highlight: [2],
          },
        ],
        caption: 'The third player has no hearts and ruffs with the 2♠ — it beats the A♥!',
      },
    },
    {
      title: 'The auction: bidding for the contract',
      body: 'Starting with the dealer and going clockwise, each player makes a [[bid]] or passes. A bid is a number from 1 to 7 plus a suit or No Trump. Add 6 to the number to get the tricks you are promising — the first six tricks are called [[book]]. So 1♠ means “we’ll win 7 tricks with spades as trumps”. Each bid must beat the last one: a higher number, or the same number in a higher suit. From low to high: ♣, ♦, ♥, ♠, then No Trump.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['AS', 'KS', 'TS', '8S', '3S', 'KH', '7H', 'QC', 'JC', '5C', '9D', '6D', '2D'],
            layout: 'fan',
            highlight: [0, 1, 2, 3, 4],
          },
        ],
        caption: 'Five spades: a natural hand to bid 1♠ — “7 tricks, spades are trumps”.',
      },
      tip: 'Remember the ladder: Clubs, Diamonds, Hearts, Spades — alphabetical order! — with No Trump on top.',
    },
    {
      title: 'Counting your points',
      body: 'How good is your hand? Most players count [[high card points]]: Ace 4, King 3, Queen 2, Jack 1. The whole deck has 40, so an average hand has 10. A common beginner guideline: open the bidding with about 12 or more points. If you and your partner have about 25 between you, aim for a [[game]] contract.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['AS', 'KS', 'TS', '8S', '3S', 'KH', '7H', 'QC', 'JC', '5C', '9D', '6D', '2D'],
            layout: 'fan',
            highlight: [0, 1, 5, 7, 8],
          },
        ],
        caption: 'A♠ 4 + K♠ 3 + K♥ 3 + Q♣ 2 + J♣ 1 = 13 points — enough to open the bidding.',
      },
    },
    {
      title: 'The contract, the declarer and the dummy',
      body: 'The auction ends when a bid is followed by three passes in a row; that last bid is the [[contract]]. On the winning team, the player who first named the contract’s suit (or No Trump) becomes the [[declarer]]. (If all four players pass straight away, nobody plays: the cards are thrown in and dealt again.) The player on the declarer’s left makes the [[opening lead]]. Then the declarer’s partner — the [[dummy]] — lays all 13 cards face up, and the declarer plays both hands for the rest of the deal!',
      scene: {
        zones: [
          {
            id: 'dummy',
            label: 'Dummy (partner, face up)',
            cards: ['QS', 'JS', '4S', 'AH', 'QH', '8H', '3H', 'AC', '9C', '4C', 'AD', '7D', '5D'],
            layout: 'fan',
          },
          {
            id: 'trick',
            label: 'Opening lead',
            cards: ['KD'],
            layout: 'row',
            highlight: [0],
          },
          {
            id: 'hand',
            label: 'Your hand (declarer)',
            cards: ['AS', 'KS', 'TS', '8S', '3S', 'KH', '7H', 'QC', 'JC', '5C', '9D', '6D', '2D'],
            layout: 'fan',
          },
        ],
        caption: 'West leads the K♦, dummy goes face up, and you play both hands.',
      },
      tip: 'The dummy player just watches this deal — no hints allowed! It’s a good moment to enjoy your partner’s play.',
    },
    {
      title: 'Making the contract — and scoring',
      body: 'When all 13 tricks are played, count the declaring team’s tricks. Reach book plus the bid and the contract is made, so you score; fall short and the defenders score instead. In hearts or spades each trick over book is worth 30 points (clubs and diamonds 20; No Trump 40 for the first and 30 after). Reach 100 — like 4♠ = 4 × 30 = 120 — and you’ve made a [[game]], which earns a big bonus. Extra tricks are [[overtricks|overtrick]] and add a little more.',
      scene: {
        zones: [
          {
            id: 'book',
            label: 'Book: the first 6 tricks',
            cards: ['AS', 'AH', 'KH', 'QH', 'AC', 'AD'],
            layout: 'row',
            faceDown: [0, 1, 2, 3, 4, 5],
          },
          {
            id: 'extra',
            label: 'Tricks 7–10: the ones that count',
            cards: ['KS', 'QS', 'JS', 'KD'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
        ],
        caption: 'Book (6) + 4 = 10 tricks. In a 4♠ contract, that’s the contract made!',
      },
    },
    {
      title: 'A tiny example: count your winners',
      body: 'You are the [[declarer]] in 3NT, so you need 9 tricks. Before playing, count your sure winners — cards that win whatever the defenders hold. Spades: A, K, Q = 3. Hearts: A, K = 2. Diamonds: A, K, Q, J = 4. That’s 9! Just take them and the contract is made. In [[no trump]] nobody can ruff your winners.',
      scene: {
        zones: [
          {
            id: 'dummy',
            label: 'Dummy',
            cards: ['QS', '8S', '5S', 'AH', '8H', '3H', 'AD', 'QD', 'JD', '7D', '3D', 'TC', '2C'],
            layout: 'fan',
            highlight: [0, 3, 6, 7, 8],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['AS', 'KS', '4S', 'KH', '7H', '2H', 'KD', '5D', 'QC', 'JC', '9C', '6C', '3C'],
            layout: 'fan',
            highlight: [0, 1, 3, 6],
          },
        ],
        caption: '3 spades + 2 hearts + 4 diamonds = 9 sure tricks. 3NT, here you come.',
      },
    },
    {
      title: 'Beginner strategy',
      body: 'Count before you play: as declarer, count your sure winners and work out where any extra tricks can come from. In a trump contract, usually [[draw trumps]] first so the defenders can’t [[ruff]] your winners — but keep enough in dummy if you need to ruff there. On defence, a classic [[opening lead]] is the top card of a sequence, like the K♦ from K-Q-J. And listen to your partner’s bids: Bridge is a conversation.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand (defending against 4♠)',
            cards: ['KD', 'QD', 'JD', '8D', '7S', '5S', 'TH', '6H', '3H', '9C', '8C', '4C', '2C'],
            layout: 'fan',
            highlight: [0, 1, 2],
          },
        ],
        caption: 'On lead with K-Q-J of diamonds? The K♦ is a classic, safe start.',
      },
      tip: '“Second hand low, third hand high” is an old defensive saying — a great starting point.',
    },
  ],
  mistakes: [
    'Forgetting to add 6: a bid of 3 promises 9 tricks, not 3.',
    'Making a bid that isn’t higher than the last one. After 2♥, you can’t bid 2♣ — you’d need 3♣.',
    'Cashing side-suit winners before drawing trumps, so a defender ruffs them.',
    'Drawing every last trump when dummy still needs its trumps to ruff your losers.',
    'Playing to the first trick without a plan. Count your winners before you touch a card.',
    'Not following suit when you can. In real Bridge that’s a revoke, and it costs tricks.',
  ],
  tips: [
    'Tip: Before playing to the first trick as declarer, count your sure winners. If you’re short, look for ruffs in dummy or a long suit to set up.',
    'Tip: With about 12 or more high card points, open the bidding — 15 points and five spades makes 1♠ an easy choice.',
    'Tip: About 25 points between you and your partner is usually enough for a game contract like 4♠ or 3NT.',
    'Tip: In a trump contract, draw the defenders’ trumps early — unless dummy needs its trumps for ruffing.',
    'Tip: Ruffing in the hand with fewer trumps (usually the dummy) is what creates extra tricks.',
    'Tip: On defence, leading the top of a sequence, like the K from K-Q-J, is a safe and classic opening lead.',
    'Tip: Remember the suit ladder — Clubs, Diamonds, Hearts, Spades (alphabetical), then No Trump on top.',
  ],
  quiz: [
    {
      question: 'The final contract is 2♥. How many tricks must the declarer’s team win?',
      options: ['2', '8', '6', '7'],
      answer: 1,
      explanation: 'Add the 6 tricks of book to the bid: 2 + 6 = 8 tricks, with hearts as trumps.',
    },
    {
      question: 'The last bid was 2♥. Which of these is a legal higher bid?',
      options: ['2♣', '1NT', '2♠', '1♠'],
      answer: 2,
      explanation:
        'At the same level you need a higher-ranking suit, and spades outrank hearts. 2♣, 1NT and 1♠ are all lower than 2♥.',
    },
    {
      question: 'After the opening lead, who plays the dummy’s cards?',
      options: ['The declarer', 'The dummy player', 'The defender on the declarer’s left'],
      answer: 0,
      explanation:
        'The dummy lays their cards face up and the declarer plays both hands. The dummy player doesn’t make any choices.',
    },
    {
      question: 'You hold A♠, K♥, Q♦, J♣ and nine small cards. How many high card points is that?',
      options: ['4', '13', '10', '12'],
      answer: 2,
      explanation: 'Ace 4 + King 3 + Queen 2 + Jack 1 = 10 points — exactly an average hand.',
    },
    {
      question:
        'You are declarer in 4♠. The defenders still have trumps, and you have side-suit winners to cash. What is usually best first?',
      options: [
        'Cash your side winners right away',
        'Lead your lowest side-suit card',
        'Give the lead to a defender',
        'Draw the defenders’ trumps',
      ],
      answer: 3,
      explanation:
        'If you cash side winners first, a defender who runs out of that suit can ruff them. Drawing trumps first makes your winners safe.',
    },
  ],
  example: {
    intro:
      'You are South and the dealer; your partner sits opposite you as North. Together you’ll bid a contract, then you’ll play it as the declarer. You make the key decisions — and each one plays out on the table.',
    steps: [
      {
        narration:
          'The cards are dealt and you sort your 13. Count your [[high card points]]: A♠ 4 + K♠ 3 + J♠ 1 + A♥ 4 + K♣ 3 = 15, and you have five spades. You’re the dealer, so you make the first call of the [[auction]].',
        scene: {
          zones: [
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['AS', 'KS', 'JS', '7S', '4S', 'AH', '6H', '3H', 'KC', '9C', '2C', '8D', '5D'],
              layout: 'fan',
              highlight: [0, 1, 2, 5, 8],
            },
          ],
          caption: '15 high card points and five spades.',
        },
        decision: {
          prompt: 'What is your opening call?',
          options: [
            {
              label: 'Pass',
              correct: false,
              feedback:
                'Too modest! With about 12 or more points you usually open, and 15 is a good hand.',
            },
            {
              label: 'Bid 1♠',
              correct: true,
              feedback:
                'Lovely. 1♠ says “I have an opening hand with plenty of spades” and promises 7 tricks — a low start that leaves room for partner to answer.',
            },
            {
              label: 'Bid 4♠',
              correct: false,
              feedback:
                'Too fast! Jumping straight to game skips the conversation — partner might have nothing, or enough for even more.',
            },
          ],
          proHint:
            'With an opening hand, pros usually start at the one level in their longest suit. With 15 points and five spades, 1♠ is automatic.',
        },
      },
      {
        narration:
          'West passes. Your partner jumps to 3♠! In many beginner systems that says “I like your spades, and I have about 10–12 points.” It’s an invitation: “bid game if you have a bit more than a bare opening hand.” East passes. Your 15 plus partner’s 10–12 makes about 25–27 points between you — usually enough for a [[game]].',
        scene: {
          zones: [
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['AS', 'KS', 'JS', '7S', '4S', 'AH', '6H', '3H', 'KC', '9C', '2C', '8D', '5D'],
              layout: 'fan',
              highlight: [0, 1, 2, 3, 4],
            },
          ],
          caption: 'The auction so far: You 1♠ · West pass · Partner 3♠ · East pass.',
        },
        decision: {
          prompt: 'What do you bid now?',
          options: [
            {
              label: 'Pass and play 3♠',
              correct: false,
              feedback:
                'Safe but timid. 3♠ needs 9 tricks but doesn’t earn the game bonus. With about 25 points between you, go for game.',
            },
            {
              label: 'Bid 4♠',
              correct: true,
              feedback:
                'Exactly. 4♠ is the game contract in spades: 10 tricks. Partner invited you, and with more than a bare minimum you accept.',
            },
            {
              label: 'Bid 6♠ (a slam)',
              correct: false,
              feedback:
                'Too greedy! A small slam needs 12 tricks and usually about 33 points between you. You have around 26.',
            },
          ],
          proHint:
            'Add your points to the range partner has shown. About 25 together → bid game. About 33 → think about a slam.',
        },
      },
      {
        narration:
          'Everyone passes after your 4♠, so that’s the [[contract]]: your team needs 10 tricks with spades as [[trumps|trump]]. You named spades first, so you’re the [[declarer]]. West makes the [[opening lead]] — the K♦ — and your partner, now the [[dummy]], spreads their cards face up.',
        scene: {
          zones: [
            {
              id: 'dummy',
              label: 'Dummy (partner, face up)',
              cards: ['QS', 'TS', '8S', '2S', 'KH', 'QH', '5H', '7C', 'AD', '9D', '6D', '4D', '3D'],
              layout: 'fan',
            },
            {
              id: 'trick',
              label: 'Opening lead (West)',
              cards: ['KD'],
              layout: 'row',
              highlight: [0],
            },
            {
              id: 'hand',
              label: 'Your hand (declarer)',
              cards: ['AS', 'KS', 'JS', '7S', '4S', 'AH', '6H', '3H', 'KC', '9C', '2C', '8D', '5D'],
              layout: 'fan',
            },
          ],
          caption: 'Contract: 4♠ by you. You need 10 tricks.',
        },
        decision: {
          prompt: 'Before you play a card, count: how many sure winners do you have?',
          options: [
            {
              label: '9 — so I need to find one more',
              correct: true,
              feedback:
                'Spot on. Spades A-K-Q-J-10 = 5, hearts A-K-Q = 3, diamonds A = 1. That’s 9. Dummy has only one club — so a club ruff in dummy can be trick number 10.',
            },
            {
              label: '13 — I’ll win them all',
              correct: false,
              feedback:
                'Lovely optimism! But the defenders hold the A♣, and West’s K♦ lead suggests they have the Q♦ too, so some tricks will go their way. Count only cards that are sure to win.',
            },
            {
              label: 'Just 6 — the book',
              correct: false,
              feedback:
                'You have more than that! Spades give 5 tricks, hearts 3 and the A♦ 1. Count each suit carefully.',
            },
          ],
          proHint:
            'Pros count winners (or losers) before playing to trick one. It tells them exactly where the extra tricks must come from.',
        },
      },
      {
        narration:
          'You win the first trick with dummy’s A♦ (East plays the 2♦, you the 5♦). Dummy is now on lead. Time to start your plan.',
        scene: {
          zones: [
            {
              id: 'dummy',
              label: 'Dummy',
              cards: ['QS', 'TS', '8S', '2S', 'KH', 'QH', '5H', '7C', '9D', '6D', '4D', '3D'],
              layout: 'fan',
              highlight: [3],
            },
            {
              id: 'trick',
              label: 'Trick 1',
              cards: ['KD', 'AD', '2D', '5D'],
              layout: 'row',
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['AS', 'KS', 'JS', '7S', '4S', 'AH', '6H', '3H', 'KC', '9C', '2C', '8D'],
              layout: 'fan',
            },
          ],
          caption: 'West K♦ · Dummy A♦ · East 2♦ · You 5♦. Tricks: you 1, defenders 0.',
        },
        decision: {
          prompt: 'What do you lead from dummy?',
          options: [
            {
              label: 'A small trump — draw trumps',
              card: '2S',
              correct: true,
              feedback:
                'Yes! The defenders hold four trumps (13 minus your team’s nine). Pulling them out first stops anyone from ruffing your heart winners.',
            },
            {
              label: 'The K♥ — cash the hearts',
              card: 'KH',
              correct: false,
              feedback:
                'Risky: if a defender runs out of hearts while still holding a trump, they’ll ruff your winner.',
            },
            {
              label: 'The 7♣',
              card: '7C',
              correct: false,
              feedback:
                'Not yet. First make sure the defenders can’t ruff your winners — draw trumps, then work on clubs.',
            },
          ],
          proHint:
            'In a trump contract the first thought is usually “draw trumps” — while keeping enough in dummy for any ruffs you need. Dummy has four, plenty for both jobs.',
        },
      },
      {
        narration:
          'Dummy’s 2♠, East’s 3♠, your A♠, West’s 6♠. Then your K♠: West 9♠, dummy 8♠, East 5♠. The defenders have played four spades — the 3, 6, 9 and 5 — and that’s every [[trump]] they had! You’ve managed to [[draw trumps]] in just two rounds.',
        scene: {
          zones: [
            {
              id: 'dummy',
              label: 'Dummy',
              cards: ['QS', 'TS', 'KH', 'QH', '5H', '7C', '9D', '6D', '4D', '3D'],
              layout: 'fan',
              highlight: [0, 1],
            },
            {
              id: 'trick',
              label: 'Trick 3',
              cards: ['KS', '9S', '8S', '5S'],
              layout: 'row',
              highlight: [0],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JS', '7S', '4S', 'AH', '6H', '3H', 'KC', '9C', '2C', '8D'],
              layout: 'fan',
            },
          ],
          caption: 'You K♠ · West 9♠ · Dummy 8♠ · East 5♠. Tricks: you 3, defenders 0.',
        },
        decision: {
          prompt: 'Do you lead a third round of trumps?',
          options: [
            {
              label: 'Yes — keep leading trumps',
              correct: false,
              feedback:
                'The defenders have none left, so another round would only use up your trumps and dummy’s — and dummy needs its last two to ruff clubs.',
            },
            {
              label: 'No — the defenders have none left',
              correct: true,
              feedback:
                'Right! Every trump you keep is a future trick. Dummy’s Q♠ and 10♠ are saved for ruffing clubs.',
            },
          ],
          proHint:
            'Count trumps as they fall. Once the defenders have none, stop — your remaining trumps are now extra winners.',
        },
      },
      {
        narration:
          'Now you cash your hearts: your A♥ (dummy plays its 5♥), then your 6♥ over to dummy’s K♥, and dummy’s Q♥ — 6 tricks in the bag. Next, dummy leads its only club, the 7♣. East plays low and you try your K♣, hoping East has the Ace… but West wins with the A♣. Never mind — dummy now has no clubs left.',
        scene: {
          zones: [
            {
              id: 'dummy',
              label: 'Dummy',
              cards: ['QS', 'TS', '9D', '6D', '4D', '3D'],
              layout: 'fan',
            },
            {
              id: 'trick',
              label: 'Trick 7',
              cards: ['7C', '3C', 'KC', 'AC'],
              layout: 'row',
              highlight: [3],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JS', '7S', '4S', '9C', '2C', '8D'],
              layout: 'fan',
            },
          ],
          caption: 'Dummy 7♣ · East 3♣ · You K♣ · West A♣. Tricks: you 6, defenders 1.',
        },
      },
      {
        narration:
          'West also wins the next trick with the Q♦ (you have to play your last diamond, the 8♦) — 2 tricks for the defenders, but you can afford 3. West then leads the J♦; you’re out of diamonds, so you [[ruff]] with your 4♠: 7 tricks. Now you lead your 9♣, and West plays the 6♣. Dummy’s turn…',
        scene: {
          zones: [
            {
              id: 'dummy',
              label: 'Dummy (no clubs left)',
              cards: ['QS', 'TS', '9D', '6D'],
              layout: 'fan',
              highlight: [1],
            },
            {
              id: 'trick',
              label: 'Trick 10',
              cards: ['9C', '6C'],
              layout: 'row',
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JS', '7S', '2C'],
              layout: 'fan',
            },
          ],
          caption: 'You 9♣ · West 6♣ · Dummy: ? Tricks: you 7, defenders 2.',
        },
        decision: {
          prompt: 'Dummy has no clubs. What should dummy play?',
          options: [
            {
              label: 'Ruff with the 10♠',
              card: 'TS',
              correct: true,
              feedback:
                'Yes! That’s the ruff you planned at trick one: dummy’s small trump wins a trick your 9♣ would have lost.',
            },
            {
              label: 'Throw the 6♦',
              card: '6D',
              correct: false,
              feedback:
                'Then East can win with any higher club — a third trick for the defenders, and one more would sink your contract.',
            },
          ],
          proHint:
            'Ruffing in the hand with fewer trumps (here, the dummy) creates extra tricks. That’s where your 10th trick was hiding.',
        },
      },
      {
        narration:
          'Dummy’s 10♠ wins: 8 tricks. Now you ruff back and forth: dummy leads a diamond and you ruff with the 7♠; you lead the 2♣ and dummy ruffs with the Q♠; dummy’s last diamond meets your J♠. That’s 11 tricks — 4♠ made with an [[overtrick]]!',
        scene: {
          zones: [
            {
              id: 'won',
              label: 'Your 11 tricks (the winning cards)',
              cards: ['AD', 'AS', 'KS', 'AH', 'KH', 'QH', '4S', 'TS', '7S', 'QS', 'JS'],
              layout: 'row',
              highlight: [6, 7, 8, 9, 10],
            },
            {
              id: 'lost',
              label: 'Defenders’ 2 tricks',
              cards: ['AC', 'QD'],
              layout: 'row',
            },
          ],
          caption:
            '11 tricks — 4♠ needed 10. The gold cards are your five ruffs. Contract made, plus one overtrick!',
        },
      },
    ],
    outro:
      'Well played, declarer! You opened, accepted partner’s invitation to game, counted your winners, drew trumps, stopped at the right moment and used dummy’s trumps to ruff — the heart of Bridge. In 4♠ each trick over book is worth 30: 4 × 30 = 120 for the contract, 30 for the overtrick, and a game bonus on top. Real Bridge adds doubles, vulnerability and full bidding systems, but you now know the core loop. Try the quiz!',
  },
  seo: {
    description:
      'Learn Bridge from zero: tricks, trumps, bidding a contract, the dummy and making your contract — a friendly beginner intro with a clickable example hand.',
  },
});
