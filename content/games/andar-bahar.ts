import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'andar-bahar',
  name: 'Andar Bahar',
  aka: ['Katti', 'Mankatha', 'Inside Outside'],
  origin: { country: 'India', countryCode: 'IN', region: 'south-asia' },
  type: 'casino',
  players: { min: 1, max: 10, ideal: 4 },
  deck: 'One standard 52-card deck, no printed jokers (the “joker” is simply the face-up middle card)',
  difficulty: 1,
  length: 'About a minute a deal',
  minutes: 1,
  moods: ['lucky', 'social', 'chill'],
  hook: 'The fastest card game at every Indian wedding and mela: pick a side, bet pretend coins, watch the cards fly',
  history:
    'Andar Bahar means “inside, outside” in Hindi, after the two places the cards land. It is ' +
    'one of the oldest and simplest card games played in India; it is often said to have begun ' +
    'in the south of the country, though nobody knows exactly where or when. In Tamil Nadu it ' +
    'is known as Mankatha. Because a deal takes about a minute and anyone can join in without ' +
    'learning any strategy, it is a favourite at festival card parties, weddings and melas — ' +
    'and the shout when the matching card turns up is half the fun.',
  featured: false,
  order: 50,
  variantTaught:
    'Classic Andar Bahar, one learner against the dealer, with a single 52-card deck. The ' +
    'dealer shuffles and turns the top card face up as the joker. You see it, then bet one ' +
    'stake on Andar (inside) or Bahar (outside). The dealer deals face up, one card at a time, ' +
    'to Andar and Bahar in turn — always starting with Andar — until a card of the joker’s rank ' +
    '(any suit) appears; the side it lands on wins. A winning Andar bet pays 0.9 to 1, a ' +
    'winning Bahar bet pays 1 to 1, and a losing bet loses its stake. Bets are locked once the ' +
    'dealing starts, and there are no side bets.',
  variants:
    'Tables differ on which side gets the first card: some always start with Bahar, and in ' +
    'others the starting side changes from deal to deal. Whichever side gets the first card ' +
    'wins a little more often, so that is the side that usually pays a bit less. Casino-style ' +
    'tables often add side bets on how many cards will be dealt before the match (1–5, 6–10 and ' +
    'so on); we leave those out to keep your first games simple. Friendly home games often pay ' +
    'both sides 1 to 1 and pass the dealing around the table.',
  glossary: [
    {
      term: 'joker',
      definition:
        'The card the dealer turns face up in the middle before the deal. It is not a clown card — just an ordinary card, like the 7 of Hearts, whose rank everyone is hunting for.',
    },
    {
      term: 'Andar',
      definition:
        'Hindi for “inside”: the side that gets the first card, then every other card (1st, 3rd, 5th…). A winning Andar bet pays 0.9 to 1.',
    },
    {
      term: 'Bahar',
      definition:
        'Hindi for “outside”: the side that gets the second card, then every other card (2nd, 4th, 6th…). A winning Bahar bet pays 1 to 1.',
    },
    {
      term: 'rank',
      definition:
        'The number or picture on a card: Ace, 2, 3 … 10, Jack, Queen or King. The 7 of Hearts and the 7 of Clubs have the same rank.',
    },
    {
      term: 'suit',
      definition:
        'The symbol on a card: Spades ♠, Hearts ♥, Diamonds ♦ or Clubs ♣. In Andar Bahar the suit never matters.',
    },
    {
      term: 'deal',
      definition:
        'One round of the game: the joker is turned up, bets go down, and cards are dealt until the match. A deal usually takes about a minute.',
    },
    {
      term: 'match',
      definition:
        'The first card with the same rank as the joker. If the joker is the Queen of Diamonds, the first Queen of any suit is the match, and its side wins.',
    },
    {
      term: 'stake',
      definition:
        'How much you bet on your side. Here it is always pretend coins called Jeet — for example a stake of 10 Jeet.',
    },
    {
      term: 'payout',
      definition:
        'What a winning bet earns on top of getting the stake back. 1 to 1 means bet 10, win 10; 0.9 to 1 means bet 10, win 9.',
    },
    {
      term: 'house edge',
      definition:
        'The small amount the dealer keeps on average because the payouts are not quite fair. In our game it is about 2 Jeet per 100 bet on Andar and 3 per 100 on Bahar.',
    },
    {
      term: 'pure chance',
      definition:
        'A game decided by luck, not skill. Picking a side is your only choice, and no plan or pattern can beat the house edge. A fresh shuffle every deal means past results never help predict the next one.',
    },
  ],
  lesson: [
    {
      title: 'The goal: guess the side',
      body:
        'Andar Bahar is a guessing game. One card sits face up in the middle: the [[joker]]. ' +
        'You guess where the next card of the same [[rank]] will land — on [[Andar]] (inside) ' +
        'or on [[Bahar]] (outside). Guess right and you win. That’s the whole game!',
      scene: {
        zones: [
          {
            id: 'andar',
            label: 'Andar (inside)',
            cards: ['3C', 'KD', '7S'],
            layout: 'row',
            highlight: [2],
          },
          { id: 'joker', label: 'Joker', cards: ['7H'], layout: 'stack', highlight: [0] },
          { id: 'bahar', label: 'Bahar (outside)', cards: ['9S', '2D'], layout: 'row' },
        ],
        caption: 'The joker is a 7. The next 7 landed on Andar — Andar wins!',
        animate: 'deal',
      },
      tip: 'There is nothing to memorise: one decision, then pure suspense.',
    },
    {
      title: 'Only the rank matters',
      body:
        'A card is a [[match]] when it has the same [[rank]] as the joker — the same number or ' +
        'picture. The [[suit]] doesn’t matter at all. If the joker is the 7 of Hearts, any other ' +
        '7 is a match. A Heart that isn’t a 7 is not. A deck has four 7s, so three matches are ' +
        'still hiding in the deck.',
      scene: {
        zones: [
          { id: 'joker', label: 'Joker', cards: ['7H'], layout: 'stack', highlight: [0] },
          {
            id: 'matches',
            label: 'Matches',
            cards: ['7S', '7D', '7C'],
            layout: 'row',
            highlight: [0, 1, 2],
          },
          { id: 'misses', label: 'Not matches', cards: ['8H', '6H', 'KH'], layout: 'row' },
        ],
        caption: 'Same rank, any suit: only these three 7s can end the deal.',
        animate: 'flip',
      },
    },
    {
      title: 'Setting up the deal',
      body:
        'We use one ordinary deck of 52 cards — no clown jokers. At the start of each [[deal]] ' +
        'the dealer shuffles and turns the top card face up in the middle. That card is the ' +
        '[[joker]]. The other 51 cards stay face down, ready to be dealt.',
      scene: {
        zones: [
          {
            id: 'deck',
            label: 'Deck: 51 cards',
            cards: ['AS', '2C', '3H'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
          { id: 'joker', label: 'Joker', cards: ['QD'], layout: 'stack', highlight: [0] },
        ],
        caption: 'The Queen of Diamonds is the joker. Now the hunt is on for another Queen.',
        animate: 'flip',
      },
    },
    {
      title: 'Place your bet',
      body:
        'Now you pick a side: Andar or Bahar. You see the joker before you choose. Put down ' +
        'your [[stake]] — pretend coins only, called Jeet. As soon as your bet is down the ' +
        'dealing starts, and bets are locked: no switching sides!',
      scene: {
        zones: [
          {
            id: 'deck',
            label: 'Deck',
            cards: ['AS', '2C'],
            layout: 'stack',
            faceDown: [0, 1],
          },
          { id: 'joker', label: 'Joker', cards: ['QD'], layout: 'stack', highlight: [0] },
        ],
        caption: 'Andar or Bahar? Choose before the first card flies.',
        animate: 'none',
      },
      tip: 'Choose a stake you’re happy to lose — it’s a game of luck, and that keeps it fun.',
    },
    {
      title: 'The deal: one card at a time',
      body:
        'The dealer deals the cards face up, one at a time, to the two sides in turn — always ' +
        'starting with [[Andar]]: Andar, [[Bahar]], Andar, Bahar… Nobody makes any choices ' +
        'now, not even the dealer. Everyone just watches for a card of the joker’s rank.',
      scene: {
        zones: [
          { id: 'andar', label: 'Andar: cards 1 and 3', cards: ['5C', 'JH'], layout: 'row' },
          { id: 'joker', label: 'Joker', cards: ['QD'], layout: 'stack' },
          { id: 'bahar', label: 'Bahar: cards 2 and 4', cards: ['2S', '9D'], layout: 'row' },
        ],
        caption: 'Four cards dealt, two on each side — and no Queen yet!',
        animate: 'deal',
      },
    },
    {
      title: 'The match ends the deal',
      body:
        'The moment a card of the joker’s rank appears, the deal stops and the side it landed ' +
        'on wins. That card is the [[match]]. It can come on the very first card or after more ' +
        'than forty — but a full deck always has a match before it runs out.',
      scene: {
        zones: [
          { id: 'andar', label: 'Andar', cards: ['5C', 'JH', '8C'], layout: 'row' },
          { id: 'joker', label: 'Joker', cards: ['QD'], layout: 'stack', highlight: [0] },
          {
            id: 'bahar',
            label: 'Bahar wins!',
            cards: ['2S', '9D', 'QS'],
            layout: 'row',
            highlight: [2],
          },
        ],
        caption: 'Card 6, the Queen of Spades, lands on Bahar. Match — Bahar wins!',
        animate: 'deal',
      },
    },
    {
      title: 'How bets are paid',
      body:
        'If your side wins, you get your stake back plus a [[payout]]. Bahar pays 1 to 1: bet ' +
        '10, win 10. Andar pays 0.9 to 1: bet 10, win 9. If the other side wins, you lose your ' +
        'stake. Why does Andar pay less? It gets the first card, so it wins a little more often ' +
        '— about 51.5 deals in every 100, against 48.5 for Bahar. Both payouts are a touch ' +
        'less than those odds deserve, and that small gap is the dealer’s [[house edge]].',
      scene: {
        zones: [
          {
            id: 'andar',
            label: 'Andar wins: bet 10, win 9',
            cards: ['4D'],
            layout: 'row',
            highlight: [0],
          },
          { id: 'joker', label: 'Joker', cards: ['4S'], layout: 'stack', highlight: [0] },
          { id: 'bahar', label: 'Bahar bets lose', cards: [], layout: 'row' },
        ],
        caption: 'The very first card is a 4: Andar wins straight away.',
        animate: 'deal',
      },
      tip: 'Andar wins more often but pays less; Bahar wins less often but pays more.',
    },
    {
      title: 'A tiny example',
      body:
        'The joker is the 9 of Clubs. You bet 10 Jeet on [[Bahar]]. Card 1, a 3, goes to ' +
        'Andar. Card 2, a King, goes to Bahar. Card 3, a 6, goes to Andar. Card 4 is the 9 of ' +
        'Hearts and it lands on Bahar — a [[match]]! You get your 10 back and win 10 more.',
      scene: {
        zones: [
          { id: 'andar', label: 'Andar', cards: ['3D', '6S'], layout: 'row' },
          { id: 'joker', label: 'Joker', cards: ['9C'], layout: 'stack', highlight: [0] },
          {
            id: 'bahar',
            label: 'Bahar — your side',
            cards: ['KC', '9H'],
            layout: 'row',
            highlight: [1],
          },
        ],
        caption: 'Bahar wins on card 4: your 10 Jeet bet wins 10.',
        animate: 'deal',
      },
    },
    {
      title: 'Beginner strategy: enjoy the luck',
      body:
        'There is no skill in choosing a side — Andar Bahar is [[pure chance]]. Andar wins a ' +
        'little more often but pays a little less, so the two bets come out almost the same. ' +
        'Andar is a whisker kinder on average (about 2 Jeet lost per 100 bet, against 3 on ' +
        'Bahar), so our coach points there — but that is tiny. Every deal starts with a fresh ' +
        'shuffle, so a streak never tells you what comes next. Keep your stake small, pick a ' +
        'side and enjoy the suspense!',
      scene: {
        zones: [
          {
            id: 'andar',
            label: 'Andar',
            cards: ['2C', '5D', '8S', 'JC', '3H', 'TD'],
            layout: 'row',
          },
          { id: 'joker', label: 'Joker', cards: ['AH'], layout: 'stack', highlight: [0] },
          {
            id: 'bahar',
            label: 'Bahar',
            cards: ['4C', 'KS', '6D', '9C', 'QH', 'AC'],
            layout: 'row',
            highlight: [5],
          },
        ],
        caption: 'Twelve cards of suspense — then the Ace of Clubs lands on Bahar.',
        animate: 'deal',
      },
      tip: 'Five Bahar wins in a row? The next deal is still about 51.5% Andar — the cards have no memory.',
    },
  ],
  mistakes: [
    'Thinking the suit matters. Any card of the joker’s rank is a match, whatever its suit.',
    'Believing a side is “due” after a streak. Every deal starts with a fresh shuffle, so past results tell you nothing.',
    'Forgetting that the first card always goes to Andar, then the sides take turns.',
    'Expecting Andar to pay 1 to 1. It pays 0.9 to 1 because it gets the first card and wins slightly more often.',
    'Raising your stake to win back a loss. It’s pure chance, so bigger bets only mean bigger swings.',
  ],
  tips: [
    'Tip: in Andar Bahar no side is ever “due” — every deal starts from a fresh shuffle.',
    'Tip: Andar wins about 51.5% of deals and Bahar about 48.5% — that’s why Andar pays only 0.9 to 1.',
    'Tip: only the rank matters. If the joker is a 7, watch for any 7: Spades, Hearts, Diamonds or Clubs.',
    'Tip: keep your stake small and steady. Luck swings both ways, and chasing a loss just makes the swings bigger.',
    'Tip: Andar’s lower payout still leaves it a whisker kinder on average — about 2 Jeet lost per 100 bet, against 3 on Bahar.',
    'Tip: whichever side is due the next card is always the favourite (only slightly, early on), but bets lock when dealing starts — so just enjoy the ride.',
    'Tip: a loss here isn’t a mistake — it’s pure chance. Shake it off and enjoy the next deal.',
  ],
  quiz: [
    {
      question: 'The joker is the 7 of Hearts. Which of these cards would end the deal?',
      options: ['The 8 of Hearts', 'The 7 of Spades', 'Any Heart', 'The next King'],
      answer: 1,
      explanation:
        'Only the rank matters. Any 7 is a match, whatever its suit — the 8 of Hearts shares the suit but not the rank.',
    },
    {
      question: 'Which side gets the first card after the joker?',
      options: [
        'Bahar',
        'Whichever side you bet on',
        'Andar',
        'The dealer chooses a side each time',
      ],
      answer: 2,
      explanation:
        'In our game the first card always goes to Andar, then the sides take turns: Andar, Bahar, Andar, Bahar…',
    },
    {
      question: 'You bet 10 Jeet on Andar and Andar wins. How much do you win?',
      options: ['9 Jeet', '10 Jeet', '19 Jeet', '5 Jeet'],
      answer: 0,
      explanation:
        'Andar pays 0.9 to 1, so a 10 Jeet bet wins 9 Jeet — and your 10 Jeet stake comes back too.',
    },
    {
      question: 'Why does Andar pay a little less than Bahar?',
      options: [
        'Andar cards are worth less',
        'The dealer likes Bahar better',
        'Andar has fewer cards in the deck',
        'Andar gets the first card, so it wins slightly more often',
      ],
      answer: 3,
      explanation:
        'Getting the first card gives Andar a small head start: it wins about 51.5% of deals, so it pays a little less to make up for it.',
    },
    {
      question: 'Bahar has won the last five deals. What does that tell you about the next deal?',
      options: [
        'Andar is due to win now',
        'Nothing — every deal starts with a fresh shuffle',
        'Bahar is on a hot streak, so bet Bahar',
        'The dealer will switch sides',
      ],
      answer: 1,
      explanation:
        'The cards have no memory. Each deal is shuffled fresh, so Andar still wins about 51.5% of the time and Bahar about 48.5%.',
    },
  ],
  seo: {
    description:
      'Learn Andar Bahar step by step: the joker card, Andar vs Bahar, how the deal works and why Andar pays 0.9 to 1 — then play a coached deal with pretend coins.',
  },
});
