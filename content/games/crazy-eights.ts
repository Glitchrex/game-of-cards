import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'crazy-eights',
  name: 'Crazy Eights',
  aka: ['Eights', 'Swedish Rummy'],
  origin: { country: 'United States', countryCode: 'US', region: 'north-america' },
  type: 'shedding',
  players: { min: 2, max: 7, ideal: 3 },
  deck: 'Standard 52-card deck (no jokers)',
  difficulty: 1,
  length: '5–10 minutes',
  minutes: 6,
  moods: ['chill', 'social', 'lucky'],
  hook: "Match the suit, match the rank — and when you're stuck, a wild Eight saves the day!",
  history:
    "Crazy Eights belongs to a big family of 'shedding' games played all over the world, such as Mau-Mau in Germany and Pesten in the Netherlands. The name Crazy Eights is American and is thought to date from around the middle of the 1900s. The famous card game UNO, which arrived in the early 1970s, is built on the very same match-the-colour-or-number idea.",
  featured: false,
  order: 30,
  variantTaught:
    "Classic Crazy Eights, played as a single hand: 5 cards each with 3 or 4 players (7 each with 2). Play a card that matches the top card's suit or rank; Eights are wild and let you name the next suit. You may draw instead of playing; if you cannot play you must draw, one card at a time, until you can; if the stock is empty and you cannot play, you pass. The first player to empty their hand wins the pot. If the stock is gone and nobody can play, the lowest card points left in hand wins (K, Q, J and 10 count 10, an Ace 1, other cards their number) and tied players share the pot.",
  variants:
    "Many families add 'action cards' borrowed from games like UNO or Switch: a 2 makes the next player pick up two cards, a Jack skips a turn, a Queen reverses the direction of play. Some tables let you draw only up to three cards before passing, and some shuffle the discard pile into a new stock when the stock runs out so the game never gets stuck. A full game is played over several hands: whoever goes out scores the points left in everyone else's hands (Eights 50, K/Q/J/10 10, Aces 1, other cards their number) and the first to an agreed total wins. Big groups of five or more often shuffle two decks together.",
  glossary: [
    {
      term: 'shedding game',
      definition:
        'A game where you win by getting rid of all your cards first. Crazy Eights is the classic one.',
    },
    {
      term: 'suit',
      definition:
        'One of the four families of cards: Spades ♠, Hearts ♥, Diamonds ♦ and Clubs ♣. The 7♥ belongs to the Hearts suit.',
    },
    {
      term: 'rank',
      definition:
        'The number or picture on a card: A, 2–10, J, Q or K. The 7♥ and the 7♣ have the same rank.',
    },
    {
      term: 'match',
      definition:
        'To play a card with the same suit OR the same rank as the top card of the discard pile. The 4♥ and the 9♣ both match the 9♥.',
    },
    {
      term: 'stock',
      definition:
        'The face-down pile of cards left over after the deal. You draw from it when you cannot — or choose not to — play.',
    },
    {
      term: 'discard pile',
      definition:
        'The face-up pile in the middle. Every card played goes on top of it, and the next card must match its top card.',
    },
    {
      term: 'starter card',
      definition:
        'The first card turned face up from the stock to begin the discard pile. If it is an Eight, it is tucked back into the stock and another card is turned.',
    },
    {
      term: 'wild card',
      definition:
        'A card you may play at any time, whatever is on top of the pile. In Crazy Eights every Eight is wild.',
    },
    {
      term: 'name a suit',
      definition:
        "When you play an Eight you choose the suit that comes next — for example, 'Clubs!'. The next player must then play a Club or another Eight.",
    },
    {
      term: 'draw',
      definition:
        'Take the top card of the stock into your hand. If it fits, you may play it straight away.',
    },
    {
      term: 'pass',
      definition:
        'Skip your turn. You may only pass when the stock is empty and nothing in your hand can be played.',
    },
    {
      term: 'blocked game',
      definition:
        'When the stock is empty and nobody can play. Everyone adds up the points of the cards left in their hand, and the lowest total wins.',
    },
    {
      term: 'pot',
      definition:
        'The pretend Jeet every player puts in before the game. The winner collects all of it (in a blocked game, players tied for the lowest total share it).',
    },
  ],
  lesson: [
    {
      title: 'The goal: empty your hand first',
      body: 'Crazy Eights is a [[shedding game]]: you win by getting rid of every card in your hand before anyone else does. Players take turns putting one card at a time on the [[discard pile]] in the middle — but only a card that fits.',
      scene: {
        zones: [
          { id: 'pile', label: 'Discard pile', cards: ['QH'], layout: 'stack' },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['5H', 'JH', '3C', '9S', '8D'],
            layout: 'fan',
          },
        ],
        caption: 'Five cards in your hand. Be the first to get them all onto the pile!',
        animate: 'deal',
      },
    },
    {
      title: 'Deal 5 cards each (7 for two players)',
      body: 'Use one ordinary 52-card deck. With 3 or more players everyone gets 5 cards; with just 2 players you each get 7. The leftover cards go face down in the middle as the [[stock]]. Turn its top card face up beside it: that [[starter card]] begins the discard pile. If the starter is an Eight, it is tucked back into the stock and a new card is turned up.',
      scene: {
        zones: [
          {
            id: 'p1',
            label: 'Player 1',
            cards: ['2S', '6D', 'TC', 'KD', '4S'],
            layout: 'row',
            faceDown: [0, 1, 2, 3, 4],
          },
          {
            id: 'p2',
            label: 'Player 2',
            cards: ['7C', 'JD', '9H', '5S', 'AD'],
            layout: 'row',
            faceDown: [0, 1, 2, 3, 4],
          },
          {
            id: 'stock',
            label: 'Stock',
            cards: ['AC', '7D', '3H'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
          { id: 'pile', label: 'Discard pile', cards: ['QH'], layout: 'stack', highlight: [0] },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['5H', 'JH', '3C', '9S', '8D'],
            layout: 'fan',
          },
        ],
        caption:
          'Three players, 5 cards each. The Q♥ was turned up as the starter card — now the game can begin.',
        animate: 'deal',
      },
      tip: "The player on the dealer's left goes first, and turns go round the table clockwise.",
    },
    {
      title: 'Your turn: match the suit or the rank',
      body: 'On your turn, play ONE card that [[matches|match]] the top card of the discard pile: either the same [[suit]] or the same [[rank]]. On the Q♥ you could play any Heart, like the 5♥ or the J♥, or any Queen, like the Q♣.',
      scene: {
        zones: [
          { id: 'pile', label: 'Discard pile', cards: ['QH'], layout: 'stack' },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['5H', 'JH', 'QC', '3C', '9S'],
            layout: 'fan',
            highlight: [0, 1, 2],
          },
        ],
        caption: "The 5♥ and J♥ match the suit, the Q♣ matches the rank. The 3♣ and 9♠ don't fit.",
        animate: 'deal',
      },
    },
    {
      title: 'Matching the rank switches the suit',
      body: 'When you [[match]] by rank, the suit changes along with your card. Play the Q♣ on the Q♥ and the next player now needs a Club — or a Queen. It is a handy way to steer the game toward the suit you hold the most of.',
      scene: {
        zones: [
          {
            id: 'pile',
            label: 'Discard pile',
            cards: ['QH', 'QC'],
            layout: 'stack',
            highlight: [1],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['JC', '6C', '2C', '5H'],
            layout: 'fan',
            highlight: [0, 1, 2],
          },
        ],
        caption: 'After your Q♣, Clubs are the suit to match — and you hold three more of them.',
        animate: 'deal',
      },
      tip: 'Two cards fit? Pick the one that leaves you holding the most cards of the next suit.',
    },
    {
      title: 'Eights are wild!',
      body: 'Every Eight is a [[wild card]]. You may play an Eight on ANY card, whatever its suit or rank. When you do, you [[name a suit]]: you decide which suit the next player has to play.',
      scene: {
        zones: [
          { id: 'pile', label: 'Discard pile', cards: ['KS'], layout: 'stack' },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['8D', '4C', '9C', 'JC'],
            layout: 'fan',
            highlight: [0],
          },
        ],
        caption: "Nothing matches the K♠ — except your wild 8♦. Play it and say 'Clubs!'.",
        animate: 'deal',
      },
      tip: 'Eights are precious. Save them for the moment nothing else fits.',
    },
    {
      title: 'After an Eight, follow the named suit',
      body: "After an Eight, forget the Eight's own suit: the next player must play the suit that was named, or another Eight. If the 8♦ was played and Clubs were named, a Club works — a Diamond does not.",
      scene: {
        zones: [
          {
            id: 'pile',
            label: "Discard pile ('Clubs!')",
            cards: ['KS', '8D'],
            layout: 'stack',
            highlight: [1],
          },
          {
            id: 'next',
            label: "Next player's hand",
            cards: ['7C', '3D', '8H', 'QD'],
            layout: 'fan',
            highlight: [0, 2],
          },
        ],
        caption:
          "Clubs were named: the 7♣ or the wild 8♥ can be played. The 3♦ and Q♦ can't, even though the Eight is a Diamond.",
        animate: 'deal',
      },
    },
    {
      title: "Can't play? Draw from the stock",
      body: "If nothing in your hand matches, [[draw]] the top card of the [[stock]]. If it fits, you may play it right away; if not, keep drawing, one card at a time, until you can play. You may also draw when you could play — but every draw is one more card to get rid of. If the stock is empty and you still can't play, you [[pass]].",
      scene: {
        zones: [
          { id: 'pile', label: 'Discard pile', cards: ['6S'], layout: 'stack' },
          {
            id: 'stock',
            label: 'Stock',
            cards: ['9D', 'JS'],
            layout: 'stack',
            faceDown: [0, 1],
          },
          { id: 'drawn', label: 'You draw', cards: ['3S'], layout: 'stack', highlight: [0] },
          { id: 'hand', label: 'Your hand', cards: ['2H', 'KD', 'TC'], layout: 'fan' },
        ],
        caption: 'Nothing matches the 6♠, so you draw. The 3♠ is a Spade — play it straight away!',
        animate: 'deal',
      },
    },
    {
      title: 'Winning — and the rare blocked game',
      body: 'The moment you play your last card, you win the [[pot]]. Once in a while the stock runs out and nobody can play at all — a [[blocked game]]. Then everyone adds up the cards left in their hand: K, Q, J and 10 count 10, an Ace counts 1, and every other card its number. (An Eight would count 50, but an Eight can always be played, so nobody gets stuck with one.) The LOWEST total wins, and tied players share the pot.',
      scene: {
        zones: [
          { id: 'pile', label: 'Discard pile (stock empty)', cards: ['7S'], layout: 'stack' },
          {
            id: 'you',
            label: 'You: 4 points',
            cards: ['3C', 'AH'],
            layout: 'row',
            highlight: [0, 1],
          },
          { id: 'p1', label: 'Player 1: 12 points', cards: ['KD', '2D'], layout: 'row' },
          { id: 'p2', label: 'Player 2: 19 points', cards: ['9D', 'TH'], layout: 'row' },
        ],
        caption:
          'Nobody has a Spade, a Seven or an Eight. Blocked! Your 3 + 1 = 4 is lowest — you win.',
        animate: 'deal',
      },
    },
    {
      title: 'A tiny example',
      body: 'The pile shows the 5♦ and you hold the 5♣ and the 2♥. You play the 5♣ — a rank [[match]] that switches the suit to Clubs. Player 1 has no Club, no Five and no Eight, so they [[draw]]: it is the J♣, which they play at once. Player 2 plays the 8♠ and names Hearts. Now you play your last card, the 2♥ — you are out, and you win!',
      scene: {
        zones: [
          {
            id: 'played',
            label: 'Cards played, in order',
            cards: ['5D', '5C', 'JC', '8S', '2H'],
            layout: 'row',
            highlight: [4],
          },
        ],
        caption: "5♦ → your 5♣ → Player 1's J♣ → Player 2's 8♠ ('Hearts!') → your 2♥. You win!",
        animate: 'deal',
      },
    },
    {
      title: 'Beginner strategy',
      body: 'Keep your Eights until nothing else fits — they are your rescue cards. When two cards fit, play the one that leaves you holding more of the next suit, and use rank matches to switch to your best [[suit]]. Shed big cards (K, Q, J, 10) early. And watch everyone else: when a player is down to one card, try to change the suit away from what they seem to need.',
      scene: {
        zones: [
          { id: 'pile', label: 'Discard pile', cards: ['KD'], layout: 'stack' },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['8C', 'KH', '9H', '4H', 'KS', '2D'],
            layout: 'fan',
            highlight: [1],
          },
        ],
        caption:
          'On the K♦, play the K♥: it switches to Hearts, your longest suit, and keeps the 8♣ for later.',
        animate: 'deal',
      },
      tip: 'There are only four Eights in the deck — keep count of how many have been played.',
    },
  ],
  mistakes: [
    'Playing an Eight early when another card would have matched — then there is no rescue card left for later.',
    "Forgetting that after an Eight the NAMED suit counts, not the Eight's own suit.",
    "Naming a suit you don't hold — name the suit you have the most of.",
    'Drawing when you could have played — every draw is one more card to get rid of.',
    'Trying to pass while the stock still has cards — you must draw until you can play.',
    'Ignoring the player who is down to one card instead of switching the suit away from them.',
  ],
  tips: [
    'Tip: in Crazy Eights, keep your Eights until nothing else fits — they are your rescue cards.',
    'Tip: when you play an Eight, name the suit you hold the most of, so you can follow it next turn.',
    'Tip: matching by rank is a free change of suit — use it to steer play toward your longest suit.',
    'Tip: when two cards fit, play the one that leaves you holding more cards of the next suit.',
    'Tip: shed your Kings, Queens, Jacks and 10s early — they cost the most if the game gets blocked.',
    'Tip: if a player is down to one card, switch to a suit they had to draw on earlier.',
    'Tip: only draw when you have to — every extra card is one more to get rid of.',
  ],
  quiz: [
    {
      question: 'The top card of the discard pile is the 7♠. Which of these can you play?',
      options: ['The 9♥', 'The 7♦', 'The K♣', 'The 2♦'],
      answer: 1,
      explanation:
        'You need a Spade, a Seven or a wild Eight. The 7♦ has the same rank as the 7♠, so it matches.',
    },
    {
      question: 'Player 1 plays the 8♥ and names Clubs. Which card can you play?',
      options: ['The 4♥', 'The K♦', 'The J♣', 'Any card at all'],
      answer: 2,
      explanation:
        "After an Eight the named suit counts — here, Clubs. The 4♥ shares the Eight's suit, but that no longer matters.",
    },
    {
      question: 'Nothing in your hand matches and the stock still has cards. What do you do?',
      options: [
        'Draw one card at a time until you can play',
        'Pass your turn',
        'Play any card you like',
        'Take the whole discard pile',
      ],
      answer: 0,
      explanation:
        'You must draw from the stock, one card at a time, until you get a card you can play. Passing is only allowed once the stock is empty.',
    },
    {
      question: 'When is usually the best time to play an Eight?',
      options: [
        'Straight away, before anything else',
        'Only ever as your very last card',
        'Never — Eights are bad luck',
        'When nothing else in your hand fits',
      ],
      answer: 3,
      explanation:
        'An Eight can be played on anything, so saving it means you are never stuck. Played early, it is gone when you really need it.',
    },
    {
      question: 'The stock is empty and nobody can play. Who wins?',
      options: [
        'Nobody — the cards are dealt again',
        'The player who played last',
        'The player with the lowest card points left in hand',
        'The player holding the most cards',
      ],
      answer: 2,
      explanation:
        'That is a blocked game. Everyone adds up their cards (K, Q, J, 10 = 10, Ace = 1, others their number) and the lowest total wins.',
    },
  ],
  seo: {
    description:
      'Learn Crazy Eights step by step: match the suit or rank, play wild Eights to name a new suit and race to empty your hand — then play friendly bots.',
  },
});
