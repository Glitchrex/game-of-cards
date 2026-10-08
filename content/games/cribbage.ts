import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'cribbage',
  name: 'Cribbage',
  aka: ['Crib'],
  origin: { country: 'England (UK)', countryCode: 'GB', region: 'europe' },
  type: 'collecting',
  players: { min: 2, max: 4, ideal: 2 },
  deck: 'One standard 52-card deck, plus a cribbage board (pen and paper works too)',
  difficulty: 4,
  length: '20–30 minutes for a game to 121',
  minutes: 25,
  moods: ['brainy', 'competitive', 'chill'],
  hook: '"Fifteen-two, fifteen-four…" The English pub classic where you add to 15 and peg your way to 121',
  history:
    'Cribbage is traditionally credited to the English poet Sir John Suckling in the early 1600s, who is said to have developed it from an older card game called Noddy. Its famous pegboard lets you keep score without pencil or paper, and the game has long been a favourite in English pubs. Some of its old words survive to this day — the Jack of the starter’s suit is still called "his nobs".',
  featured: false,
  order: 270,
  variantTaught:
    'A beginner introduction to standard two-player, six-card Cribbage: deal 6 each, throw 2 into the dealer’s crib, cut a starter, peg up to 31, then count the pone’s hand, the dealer’s hand and the crib. First to 121 wins. Club extras such as muggins and skunk scoring are explained in Variants.',
  variants:
    'Muggins (also called cutthroat): if a player misses points when counting, the opponent may call "muggins" and take them. Skunks: many players count a win as double if the loser hasn’t reached 91, and some count a "double skunk" below 61. Five-card Cribbage is the older form: 5 cards each, 2 thrown to the crib, and a game to 61. Three-player Cribbage: 5 cards each plus one card dealt straight into the crib, and everyone throws 1. Four-player Cribbage is played in partnerships with 5 cards each and 1 thrown each. Casual players sometimes play a shorter game to 61.',
  glossary: [
    {
      term: 'crib',
      definition:
        'The extra four-card hand made from the two cards each player throws away. It belongs to the dealer and is counted last.',
    },
    {
      term: 'pone',
      definition:
        'The non-dealer. The pone cuts the deck, plays the first card and counts their hand first.',
    },
    {
      term: 'starter',
      definition:
        'The card turned face up after the throw to the crib. It counts as a fifth card for both hands and the crib, but nobody plays it.',
    },
    {
      term: 'pegging',
      definition:
        'Scoring points during the play by moving your pegs along the board — for example, pegging 2 for making the count 15.',
    },
    {
      term: 'fifteen',
      definition:
        'Any group of cards that adds up to exactly 15 (J, Q and K count 10). Each different fifteen scores 2 — for example 7 + 8, or 4 + 5 + 6.',
    },
    {
      term: 'run',
      definition:
        'Three or more cards with ranks in a row, like 4-5-6, in any suit. Each card in a run scores 1 point. The Ace is always low: A-2-3 is a run, but Q-K-A is not.',
    },
    {
      term: 'go',
      definition:
        'What you say when you can’t play a card without the count going over 31. Your opponent plays on, and whoever lays the last card pegs 1.',
    },
    {
      term: 'the show',
      definition:
        'Counting the hands after the play: first the pone’s hand, then the dealer’s hand, then the crib — each together with the starter.',
    },
    {
      term: 'flush',
      definition:
        'Four cards of the same suit in your hand: 4 points (5 if the starter matches too). The crib only scores a flush if all five cards match.',
    },
    {
      term: 'his nobs',
      definition:
        'Holding the Jack of the same suit as the starter. It scores 1 point in the show — for example, the J♠ when the starter is the 5♠.',
    },
    {
      term: 'his heels',
      definition: 'When the starter itself is a Jack, the dealer pegs 2 points straight away.',
    },
    {
      term: 'skunk',
      definition:
        'A big win: reaching 121 before your opponent gets to 91. Many players count it as a double win.',
    },
  ],
  lesson: [
    {
      title: 'The goal: first to 121',
      body: 'Cribbage is usually a two-player race to 121 points. You score for card combinations — cards that add up to [[15|fifteen]], pairs, [[runs|run]] — and you keep track by moving pegs along a cribbage board (pen and paper works too). Points arrive in little bursts all through the hand, so every card you play matters.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['5H', 'TD', '5S', 'JC'],
            layout: 'fan',
            highlight: [0, 1, 2, 3],
          },
        ],
        caption: 'Fives love 10-cards: every two cards that add up to 15 are worth 2 points.',
      },
    },
    {
      title: 'The deal and the crib',
      body: 'The dealer gives each player 6 cards. Each of you then chooses 2 cards to put face down into the [[crib]] — a bonus hand that belongs to the dealer. So the dealer will score two hands and the non-dealer (the [[pone]]) one. Don’t worry: the deal swaps every hand, so it evens out.',
      scene: {
        zones: [
          {
            id: 'opponent',
            label: 'Opponent',
            cards: ['AD', '4S', '6H', 'TC', 'JH', 'QS'],
            layout: 'fan',
            faceDown: [0, 1, 2, 3, 4, 5],
          },
          {
            id: 'hand',
            label: 'Your 6 cards',
            cards: ['7C', '8D', '8S', '9H', 'KD', '2C'],
            layout: 'fan',
            highlight: [4, 5],
          },
        ],
        caption: 'Keep 7-8-8-9, which score well together. Throw the K♦ and 2♣ into the crib.',
      },
      tip: 'When it’s your own crib, you can throw it good cards. When it’s your opponent’s crib, give it cards that are unlikely to score.',
    },
    {
      title: 'The starter card',
      body: 'Next, the [[pone]] cuts the deck and the dealer turns over the top card of the bottom half. This [[starter]] counts as a fifth card for both hands AND the crib — but it is never played. If the starter is a Jack, the dealer pegs 2 points on the spot: that’s called [[his heels]].',
      scene: {
        zones: [
          { id: 'deck', label: 'Deck', cards: ['AS', '4D'], layout: 'stack', faceDown: [0, 1] },
          { id: 'starter', label: 'Starter', cards: ['JH'], layout: 'stack', highlight: [0] },
        ],
        caption: 'A Jack! The dealer pegs 2 for his heels.',
        animate: 'flip',
      },
    },
    {
      title: 'The play: count up to 31',
      body: 'Now comes the play, also called [[pegging]]. The [[pone]] lays one card face up in front of themselves and says its value. Then you take turns, each time saying the new running total. Aces count 1, number cards their number, and J, Q, K count 10. The total can never go over 31. If you can’t play without passing 31, say "[[Go]]". Your opponent plays on if they can, and whoever lays the last card pegs 1. Then the count starts again from zero.',
      scene: {
        zones: [
          {
            id: 'played',
            label: 'Played so far (count 29)',
            cards: ['KD', 'QS', '9H'],
            layout: 'row',
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['5C', '8S'],
            layout: 'fan',
            highlight: [0, 1],
          },
        ],
        caption: '29 + 5 = 34 and 29 + 8 = 37: both too big, so you say "Go".',
      },
      tip: 'You must play if you can. "Go" is only allowed when every card in your hand would push the count past 31.',
    },
    {
      title: 'Scoring during the play',
      body: 'You score as you play. Make the count exactly 15 and peg 2 — that’s a [[fifteen]]. Hit exactly 31: peg 2. Play the same rank as the card just played (a 9 on a 9, say) for a pair: 2 points. A third one straight after is 6, and a fourth is 12. And if the last few cards form a [[run]], like 4, 6, 5 in any order, peg 1 point per card.',
      scene: {
        zones: [
          {
            id: 'fifteen',
            label: 'Fifteen (2)',
            cards: ['TH', '5C'],
            layout: 'row',
            highlight: [1],
          },
          {
            id: 'run',
            label: 'Run of 3 — and 15! (5)',
            cards: ['4C', '6H', '5S'],
            layout: 'row',
            highlight: [0, 1, 2],
          },
          { id: 'pair', label: 'Pair (2)', cards: ['9D', '9C'], layout: 'row', highlight: [1] },
        ],
        caption:
          'The glowing card is the one that scored. 4, 6, 5 is a run of three AND adds up to 15.',
      },
    },
    {
      title: 'The show: fifteens and pairs',
      body: 'When all the cards are played, each player picks up their own four cards and counts them together with the [[starter]] — that’s [[the show]]. Every different group of cards that adds up to 15 scores 2. Every pair scores 2 (three of a kind hides three different pairs, so it scores 6). A card may be used in many different combinations.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['5H', 'TS', 'JD', '5C'],
            layout: 'fan',
            highlight: [0, 1, 2, 3],
          },
          { id: 'starter', label: 'Starter', cards: ['2S'], layout: 'stack' },
        ],
        caption: '5♥+10♠, 5♥+J♦, 5♣+10♠, 5♣+J♦: four fifteens (8 points) + a pair of 5s (2) = 10.',
      },
      tip: 'Say it out loud like the pros: "Fifteen-two, fifteen-four, fifteen-six, fifteen-eight, and a pair is ten."',
    },
    {
      title: 'The show: runs, flushes and his nobs',
      body: 'A [[run]] scores 1 per card — and if one of its cards is doubled, you get the run twice: 7-8-8-9 holds two runs of 7-8-9, worth 6. A [[flush]] is four hand cards of one suit: 4 points, or 5 if the starter matches too. And holding the Jack of the starter’s suit is [[his nobs]]: 1 point.',
      scene: {
        zones: [
          {
            id: 'double-run',
            label: 'Sample hand 1: a double run',
            cards: ['7C', '8D', '8S', '9C'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
          {
            id: 'flush',
            label: 'Sample hand 2: a flush',
            cards: ['2H', '6H', '9H', 'JH'],
            layout: 'row',
            highlight: [3],
          },
          { id: 'starter', label: 'Starter', cards: ['QH'], layout: 'stack', highlight: [0] },
        ],
        caption:
          'Hand 2 with the Q♥ starter: a five-card flush (5) + his nobs for the J♥ (1) + 6 + 9 = 15 (2) = 8.',
      },
    },
    {
      title: 'Counting order and winning',
      body: 'Hands are always counted in the same order: the [[pone]] first, then the dealer’s hand, then the dealer’s [[crib]]. That order matters near the end: the moment someone reaches 121 they win, even if the other player had points waiting to be counted. Win before your opponent reaches 91 and it’s a [[skunk]] — many players count that as a double win.',
      scene: {
        zones: [
          {
            id: 'pone',
            label: '1st: pone’s hand',
            cards: ['3C', '4C', 'KS', 'QD'],
            layout: 'row',
          },
          {
            id: 'dealer',
            label: '2nd: dealer’s hand',
            cards: ['5S', '5H', 'TC', '2D'],
            layout: 'row',
          },
          { id: 'crib', label: '3rd: the crib', cards: ['AH', '6S', '7D', 'JC'], layout: 'row' },
          { id: 'starter', label: 'Starter', cards: ['8C'], layout: 'stack', highlight: [0] },
        ],
        caption: 'Pone, then dealer, then crib — every hand uses the same starter.',
      },
    },
    {
      title: 'A tiny worked example',
      body: 'Let’s count 4♦ 5♦ 6♦ J♠ with the 5♠ as [[starter]]. Fifteens: 4+5♦+6, 4+5♠+6, 5♦+J, 5♠+J — four fifteens = 8. Pair: 5♦ 5♠ = 2. Runs: 4-5-6 twice (once with each 5) = 6. [[His nobs]]: the J♠ matches the starter’s suit = 1. Total: 8 + 2 + 6 + 1 = 17 points!',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['4D', '5D', '6D', 'JS'],
            layout: 'fan',
            highlight: [0, 1, 2, 3],
          },
          { id: 'starter', label: 'Starter', cards: ['5S'], layout: 'stack', highlight: [0] },
        ],
        caption: 'Fifteens, then pairs, then runs, then flush, then nobs: 17 points.',
      },
      tip: 'Only three of these cards are Diamonds, so there is no flush here. A flush needs all four hand cards.',
    },
    {
      title: 'Beginner strategy',
      body: 'When it’s your own [[crib]], throw it good cards: 5s, pairs, or two cards that add up to 15. When it’s your opponent’s crib, avoid giving away 5s or cards close together in rank. In the play, leading a 4 or lower is safe — no single card can turn it into a [[fifteen]]. And try not to leave the count on 5 or 21: one 10-card makes it 15 or 31 for your opponent.',
      scene: {
        zones: [
          { id: 'safe', label: 'Safe lead', cards: ['4S'], layout: 'row', highlight: [0] },
          { id: 'risky', label: 'Risky lead', cards: ['5D'], layout: 'row' },
        ],
        caption: 'Lead the 4, not the 5: a 10, J, Q or K turns a 5 into 15 for your opponent.',
      },
    },
  ],
  example: {
    intro:
      'You are the pone (the non-dealer) for this hand, so the crib belongs to your opponent. You’ll throw two cards, lead the play, peg as many points as you can, and then count your hand. Let’s go!',
    steps: [
      {
        narration:
          'You’re dealt six cards: 4♣ 5♦ 6♥ 6♠ 9♦ K♣. You must throw two of them into the dealer’s [[crib]] — and that crib will score for your opponent, not you.',
        scene: {
          zones: [
            {
              id: 'opponent',
              label: 'Opponent (dealer)',
              cards: ['5C', '7C', '8D', 'TH', 'JS', 'QH'],
              layout: 'fan',
              faceDown: [0, 1, 2, 3, 4, 5],
            },
            { id: 'deck', label: 'Deck', cards: ['2C', '3D'], layout: 'stack', faceDown: [0, 1] },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['4C', '5D', '6H', '6S', '9D', 'KC'],
              layout: 'fan',
            },
          ],
        },
        decision: {
          prompt: 'Which two cards do you throw into the dealer’s crib?',
          options: [
            {
              label: '9♦ and K♣',
              correct: true,
              feedback:
                'Spot on. You keep 4♣ 5♦ 6♥ 6♠, already worth 12 points (two fifteens, a pair and two runs). A 9 and a King are far apart and don’t add up to 15, so they are a fairly safe gift to the dealer.',
            },
            {
              label: '5♦ and K♣',
              correct: false,
              feedback:
                'Never hand a 5 to your opponent’s crib — a 5 plus any 10-card is 15. And without the 5, your hand loses both of its runs: 4♣ 6♥ 6♠ 9♦ is worth only 6 points instead of 12.',
            },
            {
              label: '6♠ and 9♦',
              correct: false,
              feedback:
                '6 + 9 = 15, so that’s 2 free points in the dealer’s crib — and you’d break up your lovely double run.',
            },
          ],
          proHint:
            'Keep the four cards that score the most together. When it’s your opponent’s crib, throw cards far apart in rank that don’t add up to 15.',
        },
      },
      {
        narration:
          'You keep 4♣ 5♦ 6♥ 6♠, and the dealer throws two cards as well. You cut the deck, and the dealer turns up the [[starter]]: the 9♣. It’s not a Jack, so no points for his heels. As the [[pone]], you play the first card.',
        scene: {
          zones: [
            {
              id: 'opponent',
              label: 'Opponent (dealer)',
              cards: ['5C', '7C', '8D', 'TH'],
              layout: 'fan',
              faceDown: [0, 1, 2, 3],
            },
            {
              id: 'crib',
              label: 'Crib (dealer’s)',
              cards: ['9D', 'KC', 'JS', 'QH'],
              layout: 'stack',
              faceDown: [0, 1, 2, 3],
            },
            { id: 'starter', label: 'Starter', cards: ['9C'], layout: 'stack', highlight: [0] },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['4C', '5D', '6H', '6S'],
              layout: 'fan',
            },
          ],
        },
        decision: {
          prompt: 'Which card do you lead?',
          options: [
            {
              label: '4♣',
              card: '4C',
              correct: true,
              feedback:
                'Safe! To make 15 off a 4, your opponent would need an 11 — and there’s no such card. They can’t score a fifteen right away.',
            },
            {
              label: '5♦',
              card: '5D',
              correct: false,
              feedback:
                'Risky: 16 cards in the deck are worth 10 (the 10s, Jacks, Queens and Kings). If your opponent plays one, it’s 15 and they peg 2.',
            },
            {
              label: '6♥',
              card: '6H',
              correct: false,
              feedback: 'Not terrible, but a 9 makes 15 for your opponent. The 4 is simply safer.',
            },
          ],
          proHint:
            'Pros usually lead a card lower than 5. A 4 is the classic choice, because no single card can turn it into 15.',
        },
      },
      {
        narration:
          'You lead the 4♣: "Four." Your opponent plays the 5♣: "Nine." Now it’s your turn — and you have a real chance at [[pegging]] some points.',
        scene: {
          zones: [
            {
              id: 'opponent',
              label: 'Opponent',
              cards: ['7C', '8D', 'TH'],
              layout: 'fan',
              faceDown: [0, 1, 2],
            },
            {
              id: 'played',
              label: 'Play (count 9)',
              cards: ['4C', '5C'],
              layout: 'row',
              highlight: [1],
            },
            { id: 'starter', label: 'Starter', cards: ['9C'], layout: 'stack' },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['5D', '6H', '6S'],
              layout: 'fan',
            },
          ],
        },
        decision: {
          prompt: 'The count is 9. What do you play?',
          options: [
            {
              label: '6♥ — make 15 and a run',
              card: '6H',
              correct: true,
              feedback:
                'Brilliant! 9 + 6 = 15 for 2 points, AND 4-5-6 is a run of three for 3 more. You peg 5 with one card.',
            },
            {
              label: '5♦ — pair the 5',
              card: '5D',
              correct: false,
              feedback:
                'A pair is worth 2 and the count becomes 14 — but the 6 scores 5 points right now. Take the bigger score.',
            },
            {
              label: 'Say "Go"',
              correct: false,
              feedback:
                'You can only say Go when every card would take the count past 31. At 9, you must play.',
            },
          ],
          proHint:
            'Before you play, check every card: does it make 15 or 31? A pair? A run? Here one card does two jobs at once.',
        },
      },
      {
        narration:
          '"Fifteen for two, and a run of three for three!" You peg 5. Your opponent answers with the 7♣: "Twenty-two" — and 4-5-6-7 is a [[run]] of four, so they peg 4. Your turn again, with 5♦ and 6♠ left.',
        scene: {
          zones: [
            {
              id: 'opponent',
              label: 'Opponent',
              cards: ['8D', 'TH'],
              layout: 'fan',
              faceDown: [0, 1],
            },
            {
              id: 'played',
              label: 'Play (count 22)',
              cards: ['4C', '5C', '6H', '7C'],
              layout: 'row',
              highlight: [3],
            },
            { id: 'starter', label: 'Starter', cards: ['9C'], layout: 'stack' },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['5D', '6S'],
              layout: 'fan',
            },
          ],
        },
        decision: {
          prompt: 'The count is 22. Which card do you play?',
          options: [
            {
              label: '5♦',
              card: '5D',
              correct: true,
              feedback:
                'Yes! The count becomes 27, and the last three cards played — 6, 7, 5 — form a run of three. In the play, runs don’t need to be in order. Peg 3!',
            },
            {
              label: '6♠',
              card: '6S',
              correct: false,
              feedback:
                'That makes 28, but 6-7-6 is not a run and 7-6 is not a pair, so it scores nothing. The 5 scores 3.',
            },
          ],
          proHint:
            'Look at the last two cards on the table. If your card fills in a sequence with them — in any order — that’s a run.',
        },
      },
      {
        narration:
          'You peg 3 more. The count is 27, and your opponent holds an 8 and a 10 — both would go past 31 — so they say "[[Go]]". Your 6♠ would make 33, so you can’t play either. You laid the last card, so you peg 1 for the go. The count starts again: your opponent plays the 8♦, you play the 6♠ ("fourteen"), and they finish with the 10♥ ("twenty-four"), pegging 1 for the last card.',
        scene: {
          zones: [
            {
              id: 'first',
              label: 'First count (27)',
              cards: ['4C', '5C', '6H', '7C', '5D'],
              layout: 'row',
              highlight: [4],
            },
            {
              id: 'second',
              label: 'Second count (24)',
              cards: ['8D', '6S', 'TH'],
              layout: 'row',
            },
            { id: 'starter', label: 'Starter', cards: ['9C'], layout: 'stack' },
          ],
          caption: 'Pegging score so far: you 9 (5 + 3 + 1), opponent 5 (4 + 1).',
        },
      },
      {
        narration:
          'Now for [[the show]]. As the pone, you count first: your four cards — 4♣ 5♦ 6♥ 6♠ — together with the 9♣ [[starter]]. Take your time and look for fifteens, pairs and runs.',
        scene: {
          zones: [
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['4C', '5D', '6H', '6S'],
              layout: 'fan',
              highlight: [0, 1, 2, 3],
            },
            { id: 'starter', label: 'Starter', cards: ['9C'], layout: 'stack', highlight: [0] },
          ],
          animate: 'flip',
        },
        decision: {
          prompt: 'How many points is your hand worth?',
          options: [
            {
              label: '8',
              correct: false,
              feedback:
                'You’ve counted the fifteens, but forgot the pair of 6s (2) and the two runs of 4-5-6 (6). Keep going!',
            },
            {
              label: '12',
              correct: false,
              feedback:
                'Close! You missed the two fifteens made with the starter: 6♥ + 9♣ and 6♠ + 9♣. Those add 4 more.',
            },
            {
              label: '16',
              correct: true,
              feedback:
                'Perfect! Fifteens: 4+5+6♥, 4+5+6♠, 6♥+9, 6♠+9 = 8. Pair of 6s = 2. Two runs of 4-5-6 = 6. Total: 16!',
            },
            {
              label: '14',
              correct: false,
              feedback:
                'Almost. Check the fifteens again: there are four of them (worth 8), plus a pair (2) and two runs (6).',
            },
          ],
          proHint:
            'Count in a fixed order every time — fifteens, pairs, runs, flush, nobs — and say the total out loud as you go.',
        },
      },
      {
        narration:
          'The dealer counts next: 5♣ 7♣ 8♦ 10♥ with the 9♣ — two fifteens (5+10 and 7+8) for 4, and a run of 7-8-9-10 for 4 = 8 points. Then the [[crib]]: 9♦ K♣ J♠ Q♥ with the 9♣ — a pair of 9s for 2 and a run of J-Q-K for 3 = 5. Your King helped their run — that’s cribbage! Hand total: you 9 + 16 = 25, opponent 5 + 8 + 5 = 18.',
        scene: {
          zones: [
            {
              id: 'dealer',
              label: 'Dealer’s hand (8)',
              cards: ['5C', '7C', '8D', 'TH'],
              layout: 'row',
            },
            {
              id: 'crib',
              label: 'Crib (5)',
              cards: ['9D', 'KC', 'JS', 'QH'],
              layout: 'row',
            },
            { id: 'starter', label: 'Starter', cards: ['9C'], layout: 'stack', highlight: [0] },
            {
              id: 'yours',
              label: 'Your hand (16)',
              cards: ['4C', '5D', '6H', '6S'],
              layout: 'row',
            },
          ],
          animate: 'flip',
          caption: 'You lead this hand 25 to 18. Next hand, the deal swaps and the crib is yours!',
        },
      },
    ],
    outro:
      'You threw safely, led the classic 4, pegged 9 points and counted a 16-point hand — a great first hand of Cribbage. Keep pegging and counting like this and 121 will come quickly. Ready for the quiz?',
  },
  mistakes: [
    'Forgetting to include the starter card when counting your hand.',
    'Throwing 5s, pairs or cards that add up to 15 into your opponent’s crib.',
    'Missing fifteens made from three or more cards, like 4 + 5 + 6 or 2 + 3 + K.',
    'Counting 7-8-8-9 as one run of four instead of two runs of three (6 points).',
    'Saying "Go" when you still have a card you could legally play.',
    'Counting the crib before the pone’s hand — near 121, the order decides who wins.',
    'Claiming a four-card flush in the crib — the crib only scores a flush if all five cards match.',
  ],
  tips: [
    'Tip: in Cribbage, never throw a 5 into your opponent’s crib — it makes 15 with any 10-card.',
    'Tip: lead a 4 or lower. Your opponent can’t make 15 with a single card.',
    'Tip: avoid leaving the count on 5 or 21 — one 10-card makes it 15 or 31 for your opponent.',
    'Tip: when it’s your own crib, throw it a pair, a 5, or two cards that add up to 15.',
    'Tip: count your hand in the same order every time: fifteens, pairs, runs, flush, nobs.',
    'Tip: cards close in rank (like 6-7-8) keep runs alive — they are usually worth keeping together.',
    'Tip: pairing your opponent’s card scores 2, but watch out — they may answer with a third one for 6.',
  ],
  quiz: [
    {
      question: 'During the play the count is 10 and you lay a 5. What happens?',
      options: [
        'You peg 2 for making 15',
        'You peg 1 for a go',
        'Nothing — it scores no points',
        'The count resets to zero',
      ],
      answer: 0,
      explanation:
        '10 + 5 = 15. Making the count exactly 15 (or exactly 31) during the play scores 2 points.',
    },
    {
      question: 'Who owns the crib?',
      options: [
        'The pone',
        'The dealer',
        'Whoever makes the first fifteen',
        'Both players share it',
      ],
      answer: 1,
      explanation:
        'The crib always belongs to the dealer and is counted last. The deal swaps every hand, so you get it every other hand.',
    },
    {
      question: 'Your hand is 7♣ 8♦ 8♠ 9♥. How many points do the runs alone score?',
      options: ['6', '3', '4', '8'],
      answer: 0,
      explanation:
        'Because there are two 8s, you have two separate runs of 7-8-9: 3 + 3 = 6 points (before counting fifteens and the pair).',
    },
    {
      question: 'The count is 26 and your only cards are a 6 and a 9. What do you say?',
      options: ['"Thirty-two"', '"Fifteen"', '"Go"', '"Thirty-one"'],
      answer: 2,
      explanation:
        '26 + 6 = 32 and 26 + 9 = 35 — both over 31. When you can’t play without passing 31, you say "Go".',
    },
    {
      question: 'Why is leading a 5 risky?',
      options: [
        'A 5 can never be played first',
        'It ends the count at 5',
        'It gives your opponent a free go',
        'Any 10, J, Q or K played on it makes 15 for your opponent',
      ],
      answer: 3,
      explanation:
        'Sixteen cards in the deck count 10. If your opponent has one, they play it on your 5 to make 15 and peg 2.',
    },
  ],
  seo: {
    description:
      'Learn Cribbage step by step: the crib, the starter, pegging to 31, counting fifteens, pairs and runs — with a clickable example hand and quiz.',
  },
});
