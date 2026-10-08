import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'big-two',
  name: 'Big Two',
  aka: ['Choh Dai Di', 'Deuces', 'Big Deuce', 'Dà Lǎo Èr'],
  origin: { country: 'Hong Kong', countryCode: 'HK', region: 'east-asia' },
  type: 'shedding',
  players: { min: 2, max: 4, ideal: 4 },
  deck: 'One standard 52-card deck, no jokers',
  difficulty: 3,
  length: '5–10 minutes a hand',
  minutes: 10,
  moods: ['brainy', 'competitive', 'social'],
  hook: 'Hong Kong’s classic: poker hands meet a race to empty your hand — and the 2♠ rules them all',
  history:
    'Big Two takes its name from its top card, the mighty 2. In Cantonese it is called Choh Dai Di. Its exact origins are hazy, but it is usually linked with southern China and Hong Kong, and its five-card hands are borrowed from poker. It is hugely popular across Hong Kong, Taiwan and Southeast Asia — and a familiar sight at family gatherings — and it is a close cousin of Vietnam’s Tiến Lên and other “climbing” games, where every play must top the one before.',
  featured: false,
  order: 240,
  variantTaught:
    'Classic Hong Kong-style Big Two for four players, 13 cards each, one hand at a time. Cards rank from 3 (low) to 2 (high), and suits break ties: ♦ diamonds (lowest), ♣ clubs, ♥ hearts, ♠ spades (highest). You may play singles, pairs, triples or five-card hands — straight < flush < full house < four of a kind plus any card < straight flush — and each play must beat the last one with the same number of cards. In our version straights run from 3-4-5-6-7 up to 10-J-Q-K-A (no 2s). Two straights (or straight flushes) are compared by their top card, two flushes by their top card, two full houses by their three of a kind and two fours of a kind by their four. A pass only skips your turn; when everyone else passes in a row, the last player leads anything. The holder of the 3♦ starts and must include it. The first player out wins the hand; each other player scores a penalty point per card left, and a common rule doubles that for 10 or more cards.',
  variants:
    'Big Two has lots of house rules. Many tables allow straights that contain a 2 or a low Ace (like A-2-3-4-5) and rank them in different ways, and some compare two flushes by suit first instead of by their top card. In some groups the winner of the last hand, not the holder of the 3♦, starts each new hand, and in some, once you pass you are out until the next round. A popular “last card” rule says that a player with one card left must announce it, and the player just before them must then play their highest single. Some tables let four of a kind or a straight flush beat a single 2. Penalty scoring varies a lot, and some tables add extra penalties — for example for a player who never managed to play a single card. Many groups play clockwise instead of counter-clockwise — it doesn’t change the game. In Taiwan the game is known as Dà Lǎo Èr, and the Philippine version, Pusoy Dos, uses a different suit order. Two or three players can play too, and groups differ on how many cards to deal.',
  glossary: [
    {
      term: 'rank',
      definition:
        'The number or picture on a card: 3, 4, 5 … 10, J, Q, K, A, 2. In Big Two the 3 is the lowest rank and the 2 the highest.',
    },
    {
      term: 'suit',
      definition:
        'The symbol on a card. In Big Two the suits rank ♦ diamonds (lowest), ♣ clubs, ♥ hearts, ♠ spades (highest), so the 7♠ beats the 7♥.',
    },
    {
      term: 'hand',
      definition:
        'Two meanings: the cards you are holding, and one whole deal of the game — from shuffling until someone runs out of cards.',
    },
    {
      term: 'single',
      definition:
        'One card played on its own, like the 9♥. A single can only be beaten by a higher single.',
    },
    {
      term: 'pair',
      definition:
        'Two cards of the same rank, like K♦ K♥. A higher pair beats it; with equal ranks, the pair holding the higher suit wins — K♣ K♠ beats K♦ K♥.',
    },
    {
      term: 'triple',
      definition: 'Three cards of the same rank, like 5♣ 5♥ 5♠. Only a higher triple beats it.',
    },
    {
      term: 'five-card hand',
      definition:
        'A poker-style play of exactly five cards: a straight, flush, full house, four of a kind (plus one card) or straight flush. It can only be beaten by a higher five-card hand.',
    },
    {
      term: 'straight',
      definition:
        'Five cards in a row in mixed suits, like 6-7-8-9-10. The weakest five-card hand. In our version the lowest is 3-4-5-6-7 and the highest is 10-J-Q-K-A.',
    },
    {
      term: 'flush',
      definition:
        'Five cards of the same suit that are not all in a row, like 3♥ 7♥ 9♥ J♥ K♥. Any flush beats any straight.',
    },
    {
      term: 'full house',
      definition:
        'Three of a kind plus a pair, like Q♦ Q♣ Q♠ 9♣ 9♥. It beats any straight or flush. Two full houses are compared by their three of a kind.',
    },
    {
      term: 'four of a kind',
      definition:
        'All four cards of one rank plus any fifth card, like 8♦ 8♣ 8♥ 8♠ 3♣. It beats a full house. You can’t play the four cards without a fifth.',
    },
    {
      term: 'straight flush',
      definition:
        'Five cards in a row, all of one suit, like 5♠ 6♠ 7♠ 8♠ 9♠. The strongest five-card hand of all.',
    },
    {
      term: 'pass',
      definition:
        'To not play on your turn. In our version a pass only skips this turn: if play comes back to you, you may play again.',
    },
    {
      term: 'round',
      definition:
        'Everything played from a fresh start until all the other players pass in a row. The last player to play wins the round.',
    },
    {
      term: 'lead',
      definition:
        'To start a new round on an empty table. The leader may play anything they like — a single, a pair, a triple or a five-card hand.',
    },
  ],
  lesson: [
    {
      title: 'The goal: empty your hand first',
      body: 'Big Two is a race: four players get 13 cards each, and the first to play them all wins. Each play must beat the one before it — with [[singles|single]], [[pairs|pair]], [[triples|triple]] or poker-style [[five-card hands|five-card hand]]. The game is named after its top card: the 2!',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your 13 cards',
            cards: ['3D', '5C', '6H', '7S', '9D', 'TC', 'JH', 'QS', 'KD', 'AC', 'AH', '2D', '2S'],
            layout: 'fan',
            highlight: [12],
          },
        ],
        caption: 'Thirteen cards. The 2♠ in this hand is the strongest card in the whole deck!',
      },
    },
    {
      title: 'Setup and the 3♦',
      body: 'Deal a standard 52-card deck (no jokers) one card at a time until all four players have 13. Turns traditionally go to the right (counter-clockwise). Whoever holds the 3♦ — the lowest card in the game — starts, and the very first play must include it: alone, or as part of a [[pair]], [[triple]] or [[five-card hand]].',
      scene: {
        zones: [
          {
            id: 'others',
            label: 'Mei, Kit and Sam: 13 cards each',
            cards: ['5S', '8D', 'JD'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['3D', '4C', '4S', '6D', '7H', '8C', '9S', 'TD', 'JC', 'QH', 'KS', 'AD', '2C'],
            layout: 'fan',
            highlight: [0],
          },
        ],
        caption: 'You have the 3♦, so you go first — and your first play must include it.',
      },
    },
    {
      title: 'Which cards are strongest',
      body: 'Every card has a [[rank]] (its number or picture) and a [[suit]] (its symbol). Ranks go from 3 (lowest) up through 10, J, Q, K and A — and the 2 is the highest of all. If two cards share a rank, the suit decides: ♦ diamonds are lowest, then ♣ clubs, ♥ hearts and ♠ spades. So the 3♦ is the weakest card and the 2♠ is the strongest.',
      scene: {
        zones: [
          {
            id: 'ranks',
            label: 'Lowest → highest',
            cards: ['3D', '4C', '5H', '6S', '7D', '8C', '9H', 'TS', 'JD', 'QC', 'KH', 'AS'],
            layout: 'row',
          },
          {
            id: 'twos',
            label: '…and the 2s on top: ♦ < ♣ < ♥ < ♠',
            cards: ['2D', '2C', '2H', '2S'],
            layout: 'row',
            highlight: [3],
          },
        ],
        caption: 'From the 3 up to the Ace, then the 2s. Among them, the 2♠ is king.',
      },
      tip: 'Played Tiến Lên? Careful — the suit order is different here: spades are the top suit in Big Two.',
    },
    {
      title: 'What you can play',
      body: 'You can play a [[single]] card, a [[pair]] (two cards of the same rank) or a [[triple]] (three of the same rank). Or you can play a [[five-card hand]] — patterns borrowed from the game of poker, like a [[straight]] (five cards in a row) or a [[flush]] (five cards of one suit). You can never play exactly four cards.',
      scene: {
        zones: [
          { id: 'single', label: 'Single', cards: ['7H'], layout: 'row' },
          { id: 'pair', label: 'Pair', cards: ['QD', 'QS'], layout: 'row' },
          { id: 'triple', label: 'Triple', cards: ['5C', '5H', '5S'], layout: 'row' },
          {
            id: 'five',
            label: 'Five-card hand (a straight)',
            cards: ['8D', '9C', 'TS', 'JH', 'QC'],
            layout: 'row',
          },
        ],
        caption: 'A single, a pair, a triple and a five-card hand.',
      },
    },
    {
      title: 'Your turn: same number of cards, but higher',
      body: 'Whoever starts a [[round]] can play anything. After that, each player must play the same number of cards, but higher: a single beats a single, a [[pair]] beats a pair. Compare the highest card in each — so a pair holding the K♠ beats a pair holding the K♥. Or you can [[pass]].',
      scene: {
        zones: [
          { id: 'table', label: 'Mei played', cards: ['KD', 'KH'], layout: 'row' },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['4D', '6C', 'KC', 'KS', 'AD', 'AH', '2C'],
            layout: 'fan',
            highlight: [2, 3],
          },
        ],
        caption:
          'Your K♣ K♠ beats Mei’s K♦ K♥, because your pair holds the K♠, the top King. Your Aces would win too.',
      },
    },
    {
      title: 'The five-card hands, weakest to strongest',
      body: 'A [[five-card hand]] can only battle another five-card hand. From weakest to strongest: a [[straight]] (five in a row), a [[flush]] (five of one suit), a [[full house]] (three of a kind plus a pair), [[four of a kind]] plus any fifth card, and — mightiest of all — the [[straight flush]] (five in a row, all one suit). Any flush beats any straight; between two of the same type, the higher one wins.',
      scene: {
        zones: [
          {
            id: 'straight',
            label: 'Straight',
            cards: ['9D', 'TC', 'JS', 'QH', 'KD'],
            layout: 'row',
          },
          { id: 'flush', label: 'Flush', cards: ['3H', '7H', '9H', 'JH', 'KH'], layout: 'row' },
          {
            id: 'fullhouse',
            label: 'Full house',
            cards: ['4C', '4H', '4S', 'QD', 'QC'],
            layout: 'row',
          },
          {
            id: 'four',
            label: 'Four of a kind + 1',
            cards: ['8D', '8C', '8H', '8S', '3C'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
        ],
        caption: 'Straight < flush < full house < four of a kind. A straight flush beats them all.',
      },
      tip: 'Comparing two straights? Look at the top card. Two full houses? Compare the three-of-a-kind part.',
    },
    {
      title: 'Passing and winning a round',
      body: 'Don’t want to beat the last play, or can’t? Just [[pass]]. A pass only skips this turn — if play comes round to you again, you may still join in. When everyone else passes in a row, the player who made the last play wins the [[round]]: the table is cleared and they [[lead]] anything they like.',
      scene: {
        zones: [
          {
            id: 'table',
            label: 'Kit played',
            cards: ['JC', 'JS'],
            layout: 'row',
            highlight: [0, 1],
          },
          {
            id: 'hand',
            label: 'Your hand — no pair beats the Jacks',
            cards: ['4D', '6H', '9C', 'TD', 'QH'],
            layout: 'fan',
          },
        ],
        caption:
          'Sam passes, you pass and Mei passes — three passes in a row. Kit clears the table and leads.',
      },
    },
    {
      title: 'Winning and scoring',
      body: 'The first player to empty their hand wins the [[hand]] — one complete deal. Everyone else is left holding some cards, and each card is a penalty point. Many tables make big piles hurt more — a common rule doubles the penalty if you’re holding 10 or more cards. Play as many hands as you like; the player with the fewest penalty points overall is the winner.',
      scene: {
        zones: [
          {
            id: 'mei',
            label: 'Mei: 2 cards = 2 points',
            cards: ['6H', '9C'],
            layout: 'fan',
          },
          {
            id: 'kit',
            label: 'Kit: 5 cards = 5 points',
            cards: ['4D', '7S', 'JD', 'KC', 'AH'],
            layout: 'fan',
          },
          {
            id: 'sam',
            label: 'Sam: 10 cards = 20 points (doubled)',
            cards: ['3C', '5D', '5S', '8H', 'TC', 'TH', 'QD', 'QS', 'KS', '2H'],
            layout: 'fan',
          },
        ],
        caption:
          'You went out first: 0 points. Sam’s big pile counts double under the common rule.',
      },
    },
    {
      title: 'A tiny example round',
      body: 'Mei [[leads|lead]] a [[straight]], 4-5-6-7-8. Kit beats it with a [[flush]] — any flush beats any straight. Sam passes. You play a [[full house]], which beats a flush! Mei, Kit and Sam all pass in a row, so you win the [[round]] and lead next.',
      scene: {
        zones: [
          {
            id: 'mei',
            label: 'Mei: straight',
            cards: ['4C', '5D', '6H', '7S', '8D'],
            layout: 'row',
          },
          {
            id: 'kit',
            label: 'Kit: flush (beats a straight)',
            cards: ['3C', '6C', '9C', 'JC', 'QC'],
            layout: 'row',
          },
          {
            id: 'you',
            label: 'You: full house (beats a flush)',
            cards: ['TD', 'TH', 'TS', '4D', '4H'],
            layout: 'row',
            highlight: [0, 1, 2, 3, 4],
          },
        ],
        caption: 'Straight → flush → full house. Your full house wins the round!',
      },
    },
    {
      title: 'Beginner strategy',
      body: 'Use [[five-card hands|five-card hand]] to dump your low cards — a [[straight]] from 3 to 7 gets rid of five weak cards at once. Keep your 2s and Aces to win rounds later on. Don’t break up a [[full house]] or a [[pair]] just to beat a single. And watch your opponents: when someone is down to one card, lead pairs or five-card hands, and play high singles to stop them going out.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['3D', '4C', '5H', '6S', '7D', '9C', 'JH', 'JS', 'AS', '2H'],
            layout: 'fan',
            highlight: [0, 1, 2, 3, 4],
          },
        ],
        caption: 'Lead 3-4-5-6-7 to shed five low cards in one play. Keep the 2♥ for later.',
      },
      tip: 'When an opponent has one card left, avoid leading a single — they can only go out on a single.',
    },
  ],
  mistakes: [
    'Playing four cards. You can play one, two, three or five cards — never four. Four of a kind needs a fifth card to make a five-card hand.',
    'Mixing up the suit order. In Big Two it’s ♦ (lowest), ♣, ♥, ♠ (highest), so the 2♠ is the top card.',
    'Trying to beat a pair with a single 2, or a five-card hand with a pair. You must play the same number of cards.',
    'Thinking a straight beats a flush. It’s the other way round: straight < flush < full house < four of a kind < straight flush.',
    'Leading single cards when an opponent has only one card left. That is exactly what they are hoping for!',
    'Forgetting that the first play of the hand must include the 3♦.',
  ],
  tips: [
    'Tip: In Big Two, dump low cards inside five-card hands — a 3-4-5-6-7 straight sheds five weak cards at once.',
    'Tip: Keep a high 2 for the end — nothing can beat the 2♠ as a single. It wins you a round, and the lead, just when you need it most.',
    'Tip: When an opponent is down to one card, lead pairs or five-card hands — they can’t go out on those.',
    'Tip: Count the 2s and Aces as they fall, so you know when your King or Ace has become the top single left.',
    'Tip: Before you play, sort your hand into plays: which cards make a straight, a full house, pairs? Then shed them, lowest first.',
    'Tip: With two cards left, lead the weak one and keep the strong one to go out on.',
    'Tip: Passing is fine! In our version you can still join in later in the same round.',
  ],
  quiz: [
    {
      question: 'Which card is the strongest in Big Two?',
      options: ['2♥', 'A♠', '2♠', '2♦'],
      answer: 2,
      explanation:
        'The 2s are the highest rank, and spades are the highest suit in Big Two. So the 2♠ beats every other single card.',
    },
    {
      question: 'Mei plays a straight. Which of these can beat it?',
      options: ['A pair of Aces', 'A single 2♠', 'Four 9s with no fifth card', 'A flush'],
      answer: 3,
      explanation:
        'A five-card hand can only be beaten by a higher five-card hand, and any flush beats any straight. Four of a kind needs a fifth card before you can play it.',
    },
    {
      question: 'Kit plays the pair 10♦ 10♠. Which pair beats it?',
      options: ['10♣ 10♥', '9♥ 9♠', 'J♦ J♣'],
      answer: 2,
      explanation:
        'Any pair of Jacks beats any pair of 10s. The 10♣ 10♥ loses because its top card, the 10♥, is lower than Kit’s 10♠ — spades are the top suit.',
    },
    {
      question: 'How does the very first play of a hand begin?',
      options: [
        'The holder of the 3♦ plays it, alone or in a combination',
        'The dealer leads anything',
        'The holder of the 2♠ plays it',
      ],
      answer: 0,
      explanation:
        'The 3♦ is the lowest card, and whoever holds it starts. The first play must include it — on its own, or inside a pair, triple or five-card hand.',
    },
    {
      question:
        'Sam has only one card left, and it’s your turn to lead. What is usually the safest play?',
      options: ['Your lowest single card', 'A pair or a five-card hand', 'Pass'],
      answer: 1,
      explanation:
        'Sam can only go out on a single. Lead a pair or a five-card hand and Sam can’t play at all. (And the leader can’t pass — you must play something.)',
    },
  ],
  example: {
    intro:
      'A four-player hand. You sit with Mei (on your right), Kit (across) and Sam (on your left), and turns go to the right: you → Mei → Kit → Sam. You hold the 3♦, so you start. You make the key calls!',
    steps: [
      {
        narration:
          'Thirteen cards each. You hold the 3♦, so you start — and your first play must include it. Look at 3♦ 4♠ 5♥ 6♣ 7♦: five cards in a row, a [[straight]]! You also have three Queens and a [[pair]] of 9s.',
        scene: {
          zones: [
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['3D', '4S', '5H', '6C', '7D', '8H', '9C', '9H', 'QD', 'QC', 'QS', 'KH', '2S'],
              layout: 'fan',
              highlight: [0, 1, 2, 3, 4],
            },
          ],
          caption: 'Your 13 cards. The 3♦ must be part of your first play.',
        },
        decision: {
          prompt: 'What do you lead?',
          options: [
            {
              label: 'The straight 3♦ 4♠ 5♥ 6♣ 7♦',
              correct: true,
              feedback:
                'Excellent! Five low cards gone in one play. Only another five-card hand can beat it, and a low straight is the perfect way to dump weak cards.',
            },
            {
              label: 'The 3♦ on its own',
              card: '3D',
              correct: false,
              feedback:
                'Legal, but you’d still have 4-5-6-7 to get rid of, and loose low singles are hard to shed later. Hide your weak cards inside a five-card hand.',
            },
            {
              label: 'The full house Q♦ Q♣ Q♠ 9♣ 9♥',
              correct: false,
              feedback:
                'A strong play — but not allowed now: the first play must include the 3♦. (Keep that full house in mind, though!)',
            },
          ],
          proHint:
            'Pros open with the biggest play they can build around the 3♦ — ideally a five-card hand full of low cards.',
        },
      },
      {
        narration:
          'Down goes your straight. Mei passes. Kit plays a [[flush]] — five clubs: 4♣ 7♣ 10♣ J♣ K♣. Any flush beats any straight! Sam passes. Now it’s your turn again.',
        scene: {
          zones: [
            {
              id: 'yours',
              label: 'Your straight',
              cards: ['3D', '4S', '5H', '6C', '7D'],
              layout: 'row',
            },
            {
              id: 'table',
              label: 'Kit’s flush beats it',
              cards: ['4C', '7C', 'TC', 'JC', 'KC'],
              layout: 'row',
              highlight: [0, 1, 2, 3, 4],
            },
            {
              id: 'hand',
              label: 'Your hand (8 cards)',
              cards: ['8H', '9C', '9H', 'QD', 'QC', 'QS', 'KH', '2S'],
              layout: 'fan',
              highlight: [1, 2, 3, 4, 5],
            },
          ],
          caption: 'A flush is on the table. Your Queens and 9s make a full house…',
        },
        decision: {
          prompt: 'Kit’s flush is on the table. What do you do?',
          options: [
            {
              label: 'Play the full house Q♦ Q♣ Q♠ 9♣ 9♥',
              correct: true,
              feedback:
                'Spot on! A full house beats any flush. Five more cards leave your hand, and you have a great chance of winning the round and taking the lead.',
            },
            {
              label: 'Play the 2♠',
              card: '2S',
              correct: false,
              feedback:
                'Not allowed: Kit played five cards, so you must play five cards. A single can only beat a single — even the mighty 2♠.',
            },
            {
              label: 'Pass',
              correct: false,
              feedback:
                'Legal, but you’d waste a golden chance. Your full house beats the flush and sheds five cards at once.',
            },
          ],
          proHint:
            'When you can beat a five-card hand and shed five cards in one go, a pro usually grabs it — especially when it should win the lead.',
        },
      },
      {
        narration:
          'Your [[full house]] lands! Mei passed earlier, but a [[pass]] doesn’t lock her out — she could play now if she had something bigger. She doesn’t, and neither do Kit or Sam: to beat your Queens they would need a higher full house, [[four of a kind]] or a [[straight flush]]. Three passes in a row! You win the [[round]] and [[lead]] next. Three cards left: the 8♥, the K♥ and the 2♠.',
        scene: {
          zones: [
            {
              id: 'table',
              label: 'Your full house wins the round',
              cards: ['QD', 'QC', 'QS', '9C', '9H'],
              layout: 'row',
              highlight: [0, 1, 2, 3, 4],
            },
            {
              id: 'hand',
              label: 'Your hand — three cards left',
              cards: ['8H', 'KH', '2S'],
              layout: 'fan',
            },
          ],
          caption: 'The table is yours. Which single do you lead?',
        },
        decision: {
          prompt: 'You lead. Which card do you play?',
          options: [
            {
              label: 'The 8♥',
              card: '8H',
              correct: true,
              feedback:
                'Yes! Lead your weakest card while you still hold the 2♠ — the strongest card in the game — to win the next round of singles.',
            },
            {
              label: 'The 2♠',
              card: '2S',
              correct: false,
              feedback:
                'It would win this round for sure, but then you’d have to lead the 8♥ or the K♥, and if someone beats them you could get stuck. Save the 2♠ to grab the lead when it matters.',
            },
            {
              label: 'The K♥',
              card: 'KH',
              correct: false,
              feedback:
                'Not bad — your 2♠ can still win you the lead later, so this would probably work out too. But build the habit of leading your weakest card first: the 8♥ is the one that could never win a round on its own, so let it go while the 2♠ has your back.',
            },
          ],
          proHint:
            'Pros lead their weakest single and keep the unbeatable 2♠ to take back control.',
        },
      },
      {
        narration:
          'You lead the 8♥. Mei plays the 10♦, Kit the A♠ and Sam the 2♦. Sam is sure that 2 will win the round… but you hold the 2♠!',
        scene: {
          zones: [
            {
              id: 'table',
              label: 'This round',
              cards: ['8H', 'TD', 'AS', '2D'],
              layout: 'row',
              highlight: [3],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['KH', '2S'],
              layout: 'fan',
              highlight: [1],
            },
          ],
          caption: 'Sam’s 2♦ is on top. It’s your turn.',
        },
        decision: {
          prompt: 'What do you do?',
          options: [
            {
              label: 'Play the 2♠',
              card: '2S',
              correct: true,
              feedback:
                'Yes! The 2♠ is the highest card in Big Two. It beats Sam’s 2♦, and no single can beat it back. The round is yours.',
            },
            {
              label: 'Play the K♥',
              card: 'KH',
              correct: false,
              feedback: 'A King can’t beat a 2. To beat a single, you need a higher single.',
            },
            {
              label: 'Pass',
              correct: false,
              feedback:
                'Then Sam will probably win the round and lead — and you’d be sitting on two cards, hoping for another chance. Take control now!',
            },
          ],
          proHint:
            'The 2♠ can never be beaten as a single. A pro saves it for exactly this moment: winning the round right before going out.',
        },
      },
      {
        narration:
          'Your 2♠ wins it: Mei, Kit and Sam all [[pass]]. You [[lead]] your last card, the K♥… and your hand is empty. You win the hand!',
        scene: {
          zones: [
            {
              id: 'table',
              label: 'Your last card',
              cards: ['KH'],
              layout: 'row',
              highlight: [0],
            },
            {
              id: 'others',
              label: 'Mei, Kit and Sam are still holding cards',
              cards: ['5C', '9D', 'QH'],
              layout: 'stack',
              faceDown: [0, 1, 2],
            },
          ],
          caption: 'Out first — you win!',
        },
      },
      {
        narration:
          'Now everyone else counts the cards they’re still holding as penalty points. Mei has 12, Kit has 7 and Sam has 12. With the common rule that 10 or more cards count double, Mei and Sam score 24 penalty points each and Kit scores 7. You score nothing at all — perfect!',
        scene: {
          zones: [
            {
              id: 'mei',
              label: 'Mei: 12 cards → 24 points',
              cards: ['5C', '6D', '8S'],
              layout: 'stack',
              faceDown: [0, 1, 2],
            },
            {
              id: 'kit',
              label: 'Kit: 7 cards → 7 points',
              cards: ['3C', '9D', 'JD'],
              layout: 'stack',
              faceDown: [0, 1, 2],
            },
            {
              id: 'sam',
              label: 'Sam: 12 cards → 24 points',
              cards: ['5S', 'QH', 'AD'],
              layout: 'stack',
              faceDown: [0, 1, 2],
            },
            {
              id: 'you',
              label: 'You: out first — 0 points',
              cards: ['KH'],
              layout: 'row',
              highlight: [0],
            },
          ],
          caption: 'Lots of cards left means lots of penalty points.',
        },
      },
    ],
    outro:
      'You went out first! You shed low cards in a straight, beat a flush with a full house, led low and saved the 2♠ for the perfect moment. Ready to test yourself? Try the quiz!',
  },
  seo: {
    description:
      'Learn Big Two (Choh Dai Di), the Hong Kong classic: beat each play with singles, pairs and poker hands and empty your hand first — with a clickable example.',
  },
});
