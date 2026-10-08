import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'war',
  name: 'War',
  aka: ['Battle', 'La Bataille'],
  origin: { country: 'Worldwide', countryCode: 'UN', region: 'global' },
  type: 'comparing',
  players: { min: 2, max: 2, ideal: 2 },
  deck: 'Standard 52-card deck (no jokers)',
  difficulty: 1,
  length: '3–5 minutes (60-battle limit)',
  minutes: 5,
  moods: ['lucky', 'chill'],
  hook: 'Flip, compare, shout "War!" — the simplest card game there is, and the perfect first one.',
  history:
    "Nobody knows exactly where or when War began. It has been a favourite first card game for children for generations, and versions of it are played all over the world — in France it is called La Bataille ('The Battle'), and in Britain it is often simply called Battle. Because nobody makes any decisions, a game played to the very last card can go on for a long, long time, which is why many families agree on a time limit.",
  featured: false,
  order: 10,
  variantTaught:
    "Classic two-player War with a beginner time limit. Each player gets 26 cards in a face-down pile. Both flip their top card; the higher card wins (2 is lowest, Ace is highest, suits don't matter) and the winner puts both cards under their pile, their own card first. A tie is a war: each player lays 3 cards face down and turns 1 face up, and the higher face-up card takes everything; if those tie too, the war repeats. With fewer than 4 cards you lay all but your last card face down and use the last one as your face-up card; with no cards left for a war you lose. The game ends when one player has all 52 cards, or after 60 battles (a war, however long, counts as one battle), when whoever holds more cards wins (equal piles are a push). In the very rare case that both players run out of cards in the same war, the game is a tie.",
  variants:
    'Played with no time limit, one game of War can last an hour or more, so many families play to the last card only on rainy days. Some tables put only 1 or 2 cards face down in a war instead of 3, and some kids chant "I de-clare war!" laying a card for each beat. In some homes the winner picks up the cards in any order or shuffles their pile now and then, which changes how long games last. With three or more players everyone flips at once, the highest card takes them all, and only the players who tie fight the war. For a twist, try playing "low card wins" — the smallest card takes the battle.',
  glossary: [
    {
      term: 'pile',
      definition:
        'Your stack of cards, kept face down in front of you. You always play the top card and put the cards you win underneath.',
    },
    {
      term: 'battle',
      definition:
        'One round of War: both players flip their top card and the higher card wins both. A King flipped against a 7 wins the battle.',
    },
    {
      term: 'face up',
      definition:
        'Turned over so everyone can see the card. In each battle you flip your top card face up.',
    },
    {
      term: 'face down',
      definition:
        'Turned over so nobody can see what the card is. Your whole pile stays face down, and so do the 3 hidden cards in a war.',
    },
    {
      term: 'rank',
      definition:
        'The number or picture on a card. In War the order is 2 (lowest), 3, 4 … 10, Jack, Queen, King, Ace (highest).',
    },
    {
      term: 'suit',
      definition:
        "One of the four card families: Spades ♠, Hearts ♥, Diamonds ♦ and Clubs ♣. In War suits don't matter — a 9♥ and a 9♣ are equal.",
    },
    {
      term: 'war',
      definition:
        'What happens when both flipped cards have the same rank. Each player lays 3 cards face down and flips 1 more; the higher new card wins every card in the middle.',
    },
    {
      term: 'double war',
      definition:
        'When the new face-up cards in a war tie too, so you go to war again. That puts 18 cards in the middle, and whoever finally flips the higher card takes them all.',
    },
    {
      term: 'push',
      definition:
        'A tie: nobody wins or loses, and your pretend Jeet stake comes back to you. In War that happens when you both hold 26 cards after 60 battles (or, super rarely, when you both run out of cards in the same war).',
    },
  ],
  lesson: [
    {
      title: 'The goal: win every card',
      body: 'War is the simplest card game there is — the perfect first one. You and one opponent fight [[battles|battle]] with cards: the higher card wins, and its owner keeps both cards. Collect all 52 cards and you win the game!',
      scene: {
        zones: [
          { id: 'opponent', label: "Opponent's card", cards: ['7C'], layout: 'stack' },
          { id: 'you', label: 'Your card', cards: ['KH'], layout: 'stack', highlight: [0] },
        ],
        caption: 'The King beats the Seven, so its owner takes both cards.',
        animate: 'flip',
      },
    },
    {
      title: 'Split the deck: 26 cards each',
      body: 'Shuffle one ordinary 52-card deck and deal it out one card at a time until you each have 26. Keep your cards in a neat [[face down]] [[pile]] in front of you — no peeking! You never choose a card in War: you always play the top one.',
      scene: {
        zones: [
          {
            id: 'opponent',
            label: 'Opponent: 26 cards',
            cards: ['3D', '8S', 'QC'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
          {
            id: 'you',
            label: 'You: 26 cards',
            cards: ['5H', 'JD', '2S'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
        ],
        caption: 'Two face-down piles of 26. Nobody looks at their cards.',
        animate: 'deal',
      },
      tip: "Don't shuffle or sort your pile during the game — the cards come in whatever order luck gives you.",
    },
    {
      title: 'A battle: flip and compare',
      body: 'In each [[battle]] you both turn your top card [[face up]] at the same moment. The higher card wins: its owner takes both cards and tucks them, face down, under the bottom of their pile. Then the next battle begins with the new top cards.',
      scene: {
        zones: [
          { id: 'opponent', label: "Opponent's card", cards: ['4D'], layout: 'stack' },
          { id: 'you', label: 'Your card', cards: ['JS'], layout: 'stack', highlight: [0] },
          {
            id: 'pile',
            label: 'Your pile',
            cards: ['9C', '6H', 'TD'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
        ],
        caption: 'Your Jack beats the Four — both cards go under your pile.',
        animate: 'flip',
      },
      tip: "In our game the winner's own card always goes under the pile first, then the other card — a fixed order, so nobody has to decide how to pick them up.",
    },
    {
      title: 'Which card is higher?',
      body: "Cards are ranked by their [[rank]], from low to high: 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King — and, highest of all, the Ace. The [[suit]] (♠ ♥ ♦ ♣) doesn't matter at all in War.",
      scene: {
        zones: [
          {
            id: 'ranks',
            label: 'Lowest → highest',
            cards: ['2C', '3H', '4S', '5D', '6C', '7H', '8S', '9D', 'TC', 'JH', 'QS', 'KD', 'AC'],
            layout: 'row',
            highlight: [12],
          },
        ],
        caption: 'The Ace beats everything, even the King. The 2 is the lowest card.',
        animate: 'none',
      },
    },
    {
      title: 'A tie means WAR!',
      body: "If both cards have the same rank — say two Sevens — it's [[war]]! Each of you lays 3 cards face down on the table, then flips a fourth card face up. The higher of those new cards wins everything in the middle: all 10 cards! If the new cards tie too, it's a [[double war]]: do it again, and the winner takes the lot.",
      scene: {
        zones: [
          {
            id: 'opponent',
            label: 'Opponent',
            cards: ['7D', '3C', '8H', 'QS', '4C'],
            layout: 'row',
            faceDown: [1, 2, 3],
          },
          {
            id: 'you',
            label: 'You',
            cards: ['7S', '2D', 'KC', '9H', 'JD'],
            layout: 'row',
            faceDown: [1, 2, 3],
            highlight: [4],
          },
        ],
        caption: 'Sevens tie — WAR! Your Jack beats the Four, so you win all 10 cards.',
        animate: 'flip',
      },
      tip: 'Wars are where the big swings happen: one war moves 10 cards at once.',
    },
    {
      title: 'How the game ends',
      body: 'You win by collecting all 52 cards — and you lose if you run out, even in the middle of a war. (Fewer than 4 cards when a war starts? Lay down all but one and flip your last card.) To keep games short, we stop after 60 battles (a war, however long, counts as one battle): then whoever holds more cards wins. Equal piles are a [[push]] — nobody wins and your stake comes back.',
      scene: {
        zones: [
          {
            id: 'opponent',
            label: 'Opponent: 22 cards',
            cards: ['2H', '6S', '9C'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
          {
            id: 'you',
            label: 'You: 30 cards',
            cards: ['5C', '8D', 'QH'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
        ],
        caption: 'Battle 60 is over: you hold 30 cards, your opponent 22 — you win!',
        animate: 'none',
      },
      tip: 'If both players run out of cards in the very same war (super rare!), the game is a tie.',
    },
    {
      title: 'The secret strategy: enjoy the luck',
      body: "War is pure luck — nobody makes any choices, so you can't play it wrong. That makes it a brilliant way to learn which card beats which: try to call out the winner before the cards are compared. When you play here, just press Flip, cheer for Aces and watch out for wars!",
      scene: {
        zones: [
          {
            id: 'opponent',
            label: "Opponent's card",
            cards: ['AH'],
            layout: 'stack',
            highlight: [0],
          },
          { id: 'you', label: 'Your card', cards: ['AS'], layout: 'stack', highlight: [0] },
        ],
        caption: "Two Aces tie, so it's war! Nobody chose these cards — that is the fun of War.",
        animate: 'flip',
      },
      tip: 'Shout "War!" when the cards tie — it is half the fun.',
    },
  ],
  mistakes: [
    'Thinking the suit matters — a 9♥ and a 9♣ are equal, so they start a war.',
    'Treating the Ace as the lowest card — in War the Ace is the highest card of all.',
    'Putting won cards on top of your pile instead of underneath it.',
    'Peeking at or rearranging your pile — you always play the top card, in order.',
    'Forgetting the 3 face-down cards in a war and just flipping the next card.',
    'Giving up when your pile is small — win one war and all 10 cards in the middle come to you.',
  ],
  tips: [
    "Tip: War is pure luck, so a loss isn't your fault — shuffle up and flip again!",
    'Tip: in War the Ace is the highest card — it even beats the King.',
    'Tip: a small pile can still win — the winner of a war takes all 10 cards in the middle, and a double war is worth 18.',
    'Tip: use War to learn card ranks — try to call the winner before the cards are compared.',
    'Tip: suits never matter in War — two cards of the same rank always mean war.',
    'Tip: with fewer than 4 cards in a war, your last card becomes your face-up card, and it can still win!',
    'Tip: near battle 60 every battle counts — the bigger pile wins when time runs out.',
  ],
  quiz: [
    {
      question: 'You flip the K♠ and your opponent flips the A♦. Who wins the battle?',
      options: [
        'You — the King is royal',
        'Your opponent — the Ace is the highest card',
        "Nobody — it's a war",
        'Whoever has more cards',
      ],
      answer: 1,
      explanation:
        'In War the Ace is the highest card of all, so it beats the King. The suits make no difference.',
    },
    {
      question: 'You both flip a Seven. What happens next?',
      options: [
        'You both just flip again',
        'The red Seven wins',
        'Nobody takes the cards',
        'War! Each of you lays 3 cards face down and flips 1 more',
      ],
      answer: 3,
      explanation:
        'A tie means war. You each lay 3 cards face down and flip a fourth; the higher of the new cards takes all 10 cards.',
    },
    {
      question: 'You win a battle. Where do the two cards go?',
      options: [
        'Under the bottom of your pile',
        'On top of your pile',
        'Onto a discard pile',
        'Back into the deck to be shuffled',
      ],
      answer: 0,
      explanation:
        'Won cards are tucked under your pile, so you will meet them again later in the game.',
    },
    {
      question: 'A war starts, but you only have 2 cards left. What do you do?',
      options: [
        'You lose straight away',
        'Borrow cards from your opponent',
        'Lay 1 card face down and flip your last card',
        'Skip the war',
      ],
      answer: 2,
      explanation:
        'With fewer than 4 cards you lay down all but one and use your last card as your face-up card. You only lose straight away if you have no cards left at all.',
    },
    {
      question: 'Nobody has all 52 cards after 60 battles. Who wins?',
      options: [
        'Nobody — you keep playing until someone has every card',
        'Whoever holds more cards (equal piles are a push)',
        'Whoever won the last battle',
        'Whoever won the most wars',
      ],
      answer: 1,
      explanation:
        'Our beginner time limit stops the game after 60 battles. Then the bigger pile wins; if the piles are equal, it is a push and your stake comes back.',
    },
  ],
  seo: {
    description:
      'Learn War, the easiest card game: flip your top card, the higher card wins, and a tie means WAR! Learn the rules in minutes, then play a friendly bot.',
  },
});
