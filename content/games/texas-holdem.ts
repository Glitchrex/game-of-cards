import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'texas-holdem',
  name: 'Texas Hold’em Poker',
  aka: ['Hold’em', 'No-Limit Hold’em', 'Texas Hold ’Em', 'Poker'],
  origin: { country: 'United States', countryCode: 'US', region: 'north-america' },
  type: 'comparing',
  players: { min: 2, max: 6, ideal: 4 },
  deck: 'One standard 52-card deck, no jokers',
  difficulty: 3,
  length: 'About 3–6 minutes a hand',
  minutes: 5,
  moods: ['competitive', 'brainy', 'social'],
  hook: 'The world’s most famous poker game: two secret cards, five shared ones and one brave bluff',
  history:
    'Texas Hold’em is thought to have been born in Texas in the early 1900s — Texas lawmakers ' +
    'have even honoured the small town of Robstown as its birthplace. Travelling Texan gamblers ' +
    'are said to have brought it to Las Vegas in the 1960s, and it became the main event of the ' +
    'World Series of Poker in the 1970s. In the early 2000s, TV shows with tiny cameras that ' +
    'revealed the players’ hidden cards turned it into the most popular poker game on the planet.',
  featured: true,
  order: 130,
  variantTaught:
    'No-Limit Texas Hold’em, one hand per game, for 2–6 players (4 by default): everyone starts ' +
    'with 100 chips; the dealer button is picked at random; the two players to its left post ' +
    'blinds of 1 and 2 chips (heads-up, the button posts the small blind and acts first before ' +
    'the flop, last after it). Two hole cards each, then four betting rounds — pre-flop (starting ' +
    'left of the big blind), flop (3 cards), turn (1) and river (1), with a burn card before ' +
    'each — and after the flop the first player still in left of the button acts first. Fold, ' +
    'check, call, bet or raise: the smallest bet is the big blind, a raise must add at least the ' +
    'last bet or raise, and you can go all-in even for less than that. An all-in smaller than a ' +
    'full raise does not re-open the betting: players who already acted may then only call or ' +
    'fold, and once everyone else is all-in nobody can raise. Unmatched chips go back, side ' +
    'pots are made for all-in players, the best five-card hand from seven cards wins, and equal ' +
    'hands split the pot (an odd chip goes to the first winner left of the button).',
  variants:
    'Real games deal hand after hand, with the button moving one seat to the left each time, and ' +
    'tournaments keep raising the blinds until one player has every chip. Full tables seat 9 or ' +
    '10 players, and many games add antes (a small bet from everyone) or a voluntary “straddle”. ' +
    'Limit Hold’em uses fixed bet sizes, and Pot-Limit games cap a bet at the size of the pot. ' +
    'Omaha, a close cousin, deals four hole cards and makes you use exactly two of them. In ' +
    'Short Deck (Six Plus) Hold’em the 2s to 5s are removed and a flush beats a full house. At ' +
    'real tables a player who loses at the showdown may throw away (“muck”) their cards without ' +
    'showing them; we always show every hand so you can learn from it.',
  glossary: [
    {
      term: 'hole cards',
      definition:
        'Your two private cards, dealt face down. Only you can see them — like A♠ K♠ hidden in your hand.',
    },
    {
      term: 'community cards',
      definition:
        'The five cards dealt face up in the middle of the table. Every player uses them, together with their own hole cards.',
    },
    {
      term: 'board',
      definition:
        'Another name for the community cards in the middle. "The board shows three Hearts" means three of the shared cards are Hearts.',
    },
    {
      term: 'pot',
      definition:
        'All the chips bet so far, in the middle of the table. The winner of the hand takes the pot.',
    },
    {
      term: 'button',
      definition:
        'A round disc that marks the dealer’s seat. The player on the button acts last after the flop — the best seat at the table.',
    },
    {
      term: 'small blind',
      definition:
        'A forced bet posted by the player just left of the button before the cards are dealt. In our games it is 1 chip.',
    },
    {
      term: 'big blind',
      definition:
        'A forced bet posted by the second player left of the button. In our games it is 2 chips, and it is also the smallest bet allowed.',
    },
    {
      term: 'blinds',
      definition:
        'The small blind and the big blind together: forced bets that give everyone something to win from the very start.',
    },
    {
      term: 'pre-flop',
      definition:
        'The first betting round, after everyone gets their two hole cards and before any community cards appear.',
    },
    {
      term: 'flop',
      definition:
        'The first three community cards, dealt face up together, e.g. K♥ 9♣ 4♦. A betting round follows.',
    },
    {
      term: 'turn',
      definition: 'The fourth community card. Another betting round follows it.',
    },
    {
      term: 'river',
      definition:
        'The fifth and last community card. After the last betting round comes the showdown.',
    },
    {
      term: 'fold',
      definition:
        'Give up the hand: your cards go away and you lose what you have already bet, but nothing more.',
    },
    {
      term: 'check',
      definition:
        'Pass without betting. You can only check when there is nothing for you to call — for example when nobody has bet yet in this round.',
    },
    {
      term: 'call',
      definition: 'Match the current bet to stay in. If someone bets 6 chips, calling costs you 6.',
    },
    {
      term: 'bet',
      definition:
        'Put chips in when nobody else has bet yet in this round. The smallest bet is the big blind (2 chips).',
    },
    {
      term: 'raise',
      definition:
        'Make the bet bigger. A raise must add at least as much as the last bet or raise: after a bet of 6, the smallest raise is to 12.',
    },
    {
      term: 'all-in',
      definition:
        'Betting every chip you have left. It is allowed even when you have less than a full bet or raise — you then play for the chips you matched.',
    },
    {
      term: 'no-limit',
      definition:
        'The betting style we play: you can bet or raise any amount from the minimum up to all of your chips.',
    },
    {
      term: 'showdown',
      definition:
        'After the last betting round, everyone still in turns their hole cards face up and the best five-card hand wins.',
    },
    {
      term: 'kicker',
      definition:
        'A spare card that breaks a tie between equal hands. A♥ K♦ beats A♣ Q♠ when both pair the Ace: the King kicker beats the Queen.',
    },
    {
      term: 'split pot',
      definition:
        'When the best hands are exactly equal, the winners share the pot. Any odd chip goes to the first winner left of the button.',
    },
    {
      term: 'side pot',
      definition:
        'An extra pot made when a player is all-in. The all-in player can only win the chips they matched; bigger bets between the others go into a side pot.',
    },
    {
      term: 'position',
      definition:
        'Where you sit compared with the button. "Late position" (on or near the button) means you act after most players and see what they do first.',
    },
    {
      term: 'pot odds',
      definition:
        'The price of a call compared with the pot. Calling 10 chips to win a 30-chip pot means you need to win at least 1 time in 4 (25%).',
    },
    {
      term: 'royal flush',
      definition: 'A-K-Q-J-10 all in one suit, like A♠ K♠ Q♠ J♠ 10♠. The best hand in poker.',
    },
    {
      term: 'straight flush',
      definition: 'Five cards in a row, all in one suit, like 5♥ 6♥ 7♥ 8♥ 9♥.',
    },
    {
      term: 'four of a kind',
      definition: 'Four cards of the same rank, like 9♣ 9♦ 9♥ 9♠ (also called "quads").',
    },
    {
      term: 'full house',
      definition:
        'Three of one rank plus two of another, like K♥ K♦ K♣ 7♠ 7♥ — "Kings full of Sevens".',
    },
    {
      term: 'flush',
      definition: 'Any five cards of the same suit that are not in a row, like A♦ J♦ 8♦ 6♦ 3♦.',
    },
    {
      term: 'straight',
      definition:
        'Five cards in a row in mixed suits, like 5♣ 6♥ 7♠ 8♣ 9♥. The Ace can be high (10-J-Q-K-A) or low (A-2-3-4-5), but a straight never wraps around (Q-K-A-2-3 is not one).',
    },
    {
      term: 'three of a kind',
      definition: 'Three cards of the same rank, like Q♠ Q♥ Q♣ (also called "trips" or a "set").',
    },
    {
      term: 'two pair',
      definition: 'Two different pairs, like J♥ J♣ 4♠ 4♥, plus one more card.',
    },
    {
      term: 'pair',
      definition: 'Two cards of the same rank, like 8♠ 8♣, plus three other cards.',
    },
    {
      term: 'high card',
      definition:
        'A hand with nothing better. It is named after its top card: A♣ Q♦ 9♥ 5♠ 3♣ is "Ace high".',
    },
  ],
  lesson: [
    {
      title: 'The goal: win the pot',
      body: 'Everyone gets two secret [[hole cards]]. Then five shared [[community cards]] are dealt face up in the middle. Players bet chips into the [[pot]] as the cards appear. You win the pot in one of two ways: hold the best five-card hand at the [[showdown]], or bet so boldly that everyone else decides to [[fold]].',
      scene: {
        zones: [
          {
            id: 'opp',
            label: 'Opponent',
            cards: ['9C', '4D'],
            layout: 'fan',
            faceDown: [0, 1],
          },
          {
            id: 'board',
            label: 'Community cards',
            cards: ['KH', '7S', '2D', 'QC', 'JH'],
            layout: 'row',
          },
          { id: 'hand', label: 'Your hand', cards: ['AH', 'KS'], layout: 'fan', highlight: [1] },
        ],
        caption:
          'Two cards just for you, five for everyone. Best hand — or last player left — wins.',
      },
    },
    {
      title: 'The button, the blinds and the deal',
      body: 'A round [[button]] marks the dealer’s seat. Before any cards come out, the player on its left puts in the [[small blind]] (1 chip) and the next player the [[big blind]] (2 chips). These forced bets, the [[blinds]], give everyone something to fight for. Then each player gets two hole cards, face down, one at a time. In our games everyone starts with 100 chips.',
      scene: {
        zones: [
          {
            id: 'sb',
            label: 'Small blind (1 chip)',
            cards: ['5S', 'JD'],
            layout: 'fan',
            faceDown: [0, 1],
          },
          {
            id: 'bb',
            label: 'Big blind (2 chips)',
            cards: ['8H', '3C'],
            layout: 'fan',
            faceDown: [0, 1],
          },
          {
            id: 'hand',
            label: 'Your hand (on the button)',
            cards: ['AH', 'KS'],
            layout: 'fan',
            faceDown: [0, 1],
          },
        ],
        caption: 'Blinds of 1 and 2 go in first, so the pot starts at 3 chips.',
        animate: 'deal',
      },
      tip: 'With only two players, the button posts the small blind and acts first before the flop.',
    },
    {
      title: 'Your turn: fold, check, call, bet or raise',
      body: 'On your turn you can [[fold]] (give up), [[check]] (pass — only when there is nothing for you to call), [[call]] (match the bet), [[bet]] (be the first to put chips in) or [[raise]] (make the bet bigger). This is [[no-limit]] poker: any bet from the big blind up to all your chips is allowed — that last one is going [[all-in]]. A raise must add at least as much as the last bet or raise: after a bet of 6, the smallest raise is to 12.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['AH', 'KS'],
            layout: 'fan',
            highlight: [0, 1],
          },
        ],
        caption: 'Ace-King is a strong start — a good hand to raise with.',
        animate: 'flip',
      },
      tip: 'Folding is free when you are behind: you only lose what you have already bet.',
    },
    {
      title: 'Four rounds of betting',
      body: 'Betting happens four times. [[Pre-flop|pre-flop]]: right after the deal, starting with the player left of the big blind. The [[flop]]: three community cards at once. The [[turn]]: a fourth card. The [[river]]: the fifth and last. From the flop on, the first player still in to the left of the button acts first. A round ends when everyone still in has had a turn and put in the same amount (or is all-in). A player who is all-in can only win the chips they matched — bigger bets between the others go into a [[side pot]].',
      scene: {
        zones: [
          { id: 'flop', label: 'Flop', cards: ['KH', '7S', '2D'], layout: 'row' },
          { id: 'turn', label: 'Turn', cards: ['QC'], layout: 'row' },
          { id: 'river', label: 'River', cards: ['JH'], layout: 'row' },
          { id: 'hand', label: 'Your hand', cards: ['AH', 'KS'], layout: 'fan' },
        ],
        caption: 'Three cards, then one, then one — with a betting round after each.',
        animate: 'deal',
      },
      tip: 'The dealer “burns” (discards face down) one card before the flop, the turn and the river.',
    },
    {
      title: 'Best five out of seven',
      body: 'At the [[showdown]] you make your best five-card hand from any mix of your two hole cards and the five community cards. You can use both of your cards, just one, or even none — then you are "playing the [[board]]". Here 7♥ 8♥ joins 9♣ 10♦ J♠ from the board to make a [[straight]].',
      scene: {
        zones: [
          {
            id: 'board',
            label: 'Community cards',
            cards: ['9C', 'TD', 'JS', '2H', 'KC'],
            layout: 'row',
            highlight: [0, 1, 2],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['7H', '8H'],
            layout: 'fan',
            highlight: [0, 1],
          },
        ],
        caption: '7-8-9-10-J: a straight using both of your cards and three from the board.',
        animate: 'none',
      },
    },
    {
      title: 'Hand rankings 1: the monsters',
      body: 'Poker hands have a fixed order. At the very top is a [[straight flush]]: five in a row, all one suit. The Ace-high one is the famous [[royal flush]]. Next comes [[four of a kind]], then a [[full house]] (three of one rank plus a pair). You will not see these often — enjoy them when you do!',
      scene: {
        zones: [
          {
            id: 'royal',
            label: '1. Straight flush (this one is a royal flush)',
            cards: ['AS', 'KS', 'QS', 'JS', 'TS'],
            layout: 'row',
          },
          {
            id: 'quads',
            label: '2. Four of a kind',
            cards: ['9C', '9D', '9H', '9S', '2D'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
          {
            id: 'boat',
            label: '3. Full house',
            cards: ['KH', 'KD', 'KC', '7S', '7H'],
            layout: 'row',
          },
        ],
        caption:
          'Strongest first: straight flush (royal flush on top), four of a kind, full house.',
        animate: 'none',
      },
    },
    {
      title: 'Hand rankings 2: flush, straight, three of a kind',
      body: 'Below the full house comes a [[flush]]: five cards of one suit. Then a [[straight]]: five in a row in mixed suits (A-2-3-4-5 is the lowest, 10-J-Q-K-A the highest; no wrapping around). Then [[three of a kind]]. Remember: a flush beats a straight.',
      scene: {
        zones: [
          {
            id: 'flush',
            label: '4. Flush',
            cards: ['AD', 'JD', '8D', '6D', '3D'],
            layout: 'row',
          },
          {
            id: 'straight',
            label: '5. Straight',
            cards: ['5C', '6H', '7S', '8C', '9H'],
            layout: 'row',
          },
          {
            id: 'trips',
            label: '6. Three of a kind',
            cards: ['QS', 'QH', 'QC', '4D', '2S'],
            layout: 'row',
            highlight: [0, 1, 2],
          },
        ],
        caption: 'Flush beats straight, and straight beats three of a kind.',
        animate: 'none',
      },
    },
    {
      title: 'Hand rankings 3: two pair, pair, high card',
      body: 'The everyday hands: [[two pair]], then one [[pair]], and finally [[high card]] when you have nothing better. If two players have the same kind of hand, the higher cards win (Aces are high): a pair of Jacks beats a pair of Eights. If that is equal too, the next best card — the [[kicker]] — decides. Suits never break a tie.',
      scene: {
        zones: [
          {
            id: 'twopair',
            label: '7. Two pair',
            cards: ['JH', 'JC', '4S', '4H', 'AD'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
          {
            id: 'pair',
            label: '8. Pair',
            cards: ['8S', '8C', 'KD', '6H', '2C'],
            layout: 'row',
            highlight: [0, 1],
          },
          {
            id: 'high',
            label: '9. High card',
            cards: ['AC', 'QD', '9H', '5S', '3C'],
            layout: 'row',
            highlight: [0],
          },
        ],
        caption: 'Two pair beats a pair; a pair beats a high card.',
        animate: 'none',
      },
    },
    {
      title: 'A tiny hand, start to finish',
      body: 'You hold A♥ K♦ on the button. Asha raises to 6; you call; the blinds fold. The flop is A♠ 7♦ 4♣ — you have a pair of Aces! Asha bets 8 and you call. The turn (2♥) and river (9♠) bring nothing new, and you both check. [[Showdown|showdown]]: Asha shows A♣ Q♠, also a pair of Aces — but your King [[kicker]] beats her Queen, so you win the 31-chip pot. Had the hands been exactly equal, it would be a [[split pot]].',
      scene: {
        zones: [
          {
            id: 'board',
            label: 'Community cards',
            cards: ['AS', '7D', '4C', '2H', '9S'],
            layout: 'row',
            highlight: [0],
          },
          {
            id: 'asha',
            label: 'Asha',
            cards: ['AC', 'QS'],
            layout: 'fan',
            highlight: [0],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['AH', 'KD'],
            layout: 'fan',
            highlight: [0, 1],
          },
        ],
        caption: 'Pot: 1 + 2 + 6 + 6 + 8 + 8 = 31 chips. Same pair — the King kicker wins it!',
        animate: 'flip',
      },
      tip: 'Here every hand still in is turned face up at the showdown, so you can always see why you won or lost.',
    },
    {
      title: 'Beginner strategy: good cards and good seats',
      body: 'Fold most hands before the flop. Pairs and two high cards like A-K, A-Q or K-Q are good places to start — and raise them rather than just calling. Your [[position]] matters: on or near the [[button]] you act last after the flop, so you can play a few more hands there. Before calling, check the price with [[pot odds]]: calling 10 to win a 30-chip pot only pays off if you win at least 1 time in 4.',
      scene: {
        zones: [
          {
            id: 'raise',
            label: 'Raise these',
            cards: ['AC', 'KC'],
            layout: 'fan',
            highlight: [0, 1],
          },
          {
            id: 'pair',
            label: 'And these',
            cards: ['QD', 'QH'],
            layout: 'fan',
            highlight: [0, 1],
          },
          { id: 'fold', label: 'Usually fold', cards: ['7S', '2D'], layout: 'fan' },
        ],
        caption: 'A-K and a pair of Queens are worth a raise; 7-2 in different suits is not.',
        animate: 'none',
      },
      tip: 'In practice mode, ask the coach what a steady player would do — it explains the odds in plain words.',
    },
  ],
  mistakes: [
    'Playing far too many starting hands. Most hands should be folded before the flop.',
    'Thinking a straight beats a flush. A flush is higher — and a full house beats both.',
    'Forgetting the board is shared: if four Hearts are showing, anyone with one Heart has a flush.',
    'Calling a big bet just because you have already put chips in the pot.',
    'Trying to check when someone has bet — you must call, raise or fold.',
    'Forgetting the kicker: A-K beats A-Q when both players pair the Ace.',
    'Playing the same hands from an early seat as from the button.',
  ],
  tips: [
    'Tip: in Texas Hold’em, fold most hands before the flop — pairs, A-K, A-Q and K-Q are good places to start.',
    'Tip: raise your good hands instead of just calling. It builds the pot and can win it straight away.',
    'Tip: compare the price with your chances — calling 10 chips to win a 30-chip pot needs you to win 1 time in 4.',
    'Tip: before betting big with one pair, look at the board for possible flushes and straights.',
    'Tip: the button is the best seat. You act last after the flop, so you can play a few more hands there.',
    'Tip: when a quiet player suddenly makes a big raise, believe them unless your hand is strong too.',
    'Tip: with four cards to a flush on the flop, you will make the flush about 1 time in 3 by the river.',
  ],
  quiz: [
    {
      question: 'Which hand is stronger: a flush or a straight?',
      options: ['The straight', 'The flush', 'They tie', 'Whichever has the higher top card'],
      answer: 1,
      explanation:
        'A flush (five cards of one suit) always beats a straight (five in a row), whatever the cards.',
    },
    {
      question:
        'You hold K♠ K♦ and the board shows K♣ 7♥ 7♦ 2♠ 9♣. What is your best five-card hand?',
      options: [
        'Three of a kind, Kings',
        'Two pair, Kings and Sevens',
        'Full house, Kings full of Sevens',
        'Four of a kind',
      ],
      answer: 2,
      explanation:
        'Your two Kings plus the K♣ make three Kings, and the 7♥ 7♦ on the board add a pair: K-K-K-7-7 is a full house.',
    },
    {
      question: 'Nobody has bet yet on the flop. Which move is NOT possible?',
      options: ['Call', 'Check', 'Bet', 'Go all-in'],
      answer: 0,
      explanation:
        'There is nothing to call until someone bets. You can check for free, bet, or even go all-in.',
    },
    {
      question:
        'The big blind is 2 chips and a player raises to 6. What is the smallest re-raise allowed?',
      options: ['To 8 chips', 'To 12 chips', 'Any amount you like', 'To 10 chips'],
      answer: 3,
      explanation:
        'The raise added 4 chips (from 2 to 6), so the next raise must add at least 4 more: to 10. Going all-in is the only way to raise by less.',
    },
    {
      question: 'Why is the button the best seat at the table?',
      options: [
        'You never pay the blinds there',
        'You act last after the flop, so you see what everyone else does first',
        'You get to look at an extra card',
        'You win all ties',
      ],
      answer: 1,
      explanation:
        'From the flop on, the button acts last in every betting round. Seeing everyone else act first is a big advantage — that is why position matters.',
    },
  ],
  seo: {
    description:
      'Learn Texas Hold’em poker step by step: blinds, the flop, turn and river, hand rankings and betting — then play a coached hand against friendly bots.',
  },
});
