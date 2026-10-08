import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'blackjack',
  name: 'Blackjack',
  aka: ['21', 'Twenty-One', 'Vingt-et-un'],
  origin: { country: 'Worldwide', countryCode: 'UN', region: 'global' },
  type: 'casino',
  players: { min: 1, max: 7, ideal: 1 },
  deck: 'Six standard 52-card decks shuffled together in a shoe (any number of decks works)',
  difficulty: 2,
  length: '1–2 minutes per round',
  minutes: 2,
  moods: ['lucky', 'brainy', 'chill'],
  hook: 'Get closer to 21 than the dealer without going over — the world’s favourite casino card game.',
  history:
    'Blackjack grew out of older “twenty-one” games played in Europe: a Spanish game called ' +
    'veintiuna appears in a story by Miguel de Cervantes from the early 1600s, and the French ' +
    'played Vingt-et-un by the 1700s. When the game reached American gambling halls, the story ' +
    'goes that some houses paid a bonus for an Ace of Spades with a black Jack — the bonus ' +
    'disappeared, but the name Blackjack stuck. In the 1950s and 60s, mathematicians worked out ' +
    'the best play for every hand: the “basic strategy” our coach uses.',
  featured: true,
  order: 40,
  variantTaught:
    'Casino Blackjack, one player against the dealer: a 6-deck shoe shuffled fresh every round; ' +
    'the dealer stands on all 17s (soft 17 too) and peeks for Blackjack under an Ace or a ' +
    '10-value upcard; Blackjack pays 3 to 2, other wins pay 1 to 1 and ties push; double down on ' +
    'any first two cards, also after splitting; split any pair (two cards of the same value) ' +
    'once — split Aces get one card each, and 21 after a split is not a Blackjack; a hand that ' +
    'reaches 21 stands automatically; no surrender and no insurance.',
  variants:
    'Many casinos make the dealer hit a soft 17, which is slightly worse for you. Some let you ' +
    'split again (up to four hands), or “surrender” a bad hand to get half your bet back. ' +
    '“Insurance” is a side bet offered when the dealer shows an Ace — it is a poor bet for ' +
    'beginners, so we leave it out. Watch out for tables that pay 6 to 5 for a Blackjack instead ' +
    'of 3 to 2: that is much worse for you. Some games use just one or two decks. In Britain a ' +
    'home cousin called Pontoon says “twist” for hit and “stick” for stand, and Spanish 21 takes ' +
    'the 10s (but not the picture cards) out of the deck and adds bonus payouts.',
  glossary: [
    {
      term: 'Blackjack',
      definition:
        'An Ace plus a 10-value card as your first two cards, like Ace + King. It is the best hand and pays 3 to 2: bet 10, win 15.',
    },
    {
      term: 'ten-value card',
      definition: 'Any 10, Jack, Queen or King. They are all worth 10 points.',
    },
    {
      term: 'bust',
      definition:
        'Going over 21. If you bust you lose that hand straight away — even if the dealer busts later.',
    },
    {
      term: 'hit',
      definition:
        'Take one more card. You can hit again and again until you stand, reach 21 or bust.',
    },
    {
      term: 'stand',
      definition: 'Stop taking cards and keep your total. For example, stand on 18.',
    },
    {
      term: 'double down',
      definition:
        'On your first two cards, add a second bet the same size as the first and take exactly one more card. Great on 10 or 11.',
    },
    {
      term: 'split',
      definition:
        'Turn a pair (two cards of the same value, like two 8s) into two hands, each with its own bet. You can split once per round.',
    },
    {
      term: 'soft hand',
      definition:
        'A hand where an Ace counts as 11, like Ace + 6 = soft 17. One more card can never bust it, because the Ace can drop to 1.',
    },
    {
      term: 'hard hand',
      definition:
        'A hand with no Ace counted as 11, like 10 + 6 = hard 16. Once a hard hand is 12 or more, a big card can bust it.',
    },
    {
      term: 'upcard',
      definition:
        'The dealer’s face-up card. It tells you how strong the dealer is likely to be — a 6 is weak, a 10 is strong.',
    },
    {
      term: 'hole card',
      definition:
        'The dealer’s face-down second card. It is turned over after you finish — or straight away if the dealer has Blackjack.',
    },
    {
      term: 'peek',
      definition:
        'When the dealer’s upcard is an Ace or a 10-value card, the dealer secretly checks the hole card for Blackjack before anyone plays.',
    },
    {
      term: 'push',
      definition:
        'A tie: you and the dealer have the same total, so your bet comes back. Example: 19 against 19.',
    },
    {
      term: 'shoe',
      definition:
        'A box holding several decks shuffled together. We use 6 decks, shuffled fresh every round.',
    },
    {
      term: 'basic strategy',
      definition:
        'The best play for every hand against every dealer upcard, worked out by mathematicians. The coach uses it to give hints.',
    },
  ],
  lesson: [
    {
      title: 'The goal: beat the dealer',
      body:
        'In Blackjack you play against the dealer, not against the other players. You both try ' +
        'to make a hand worth as close to 21 as you can. Finish closer to 21 than the dealer and ' +
        'you win. But if you go over 21 you [[bust]] and lose straight away.',
      scene: {
        zones: [
          { id: 'dealer', label: 'Dealer: 17', cards: ['TD', '7C'], layout: 'row' },
          { id: 'you', label: 'You: 19', cards: ['KH', '9S'], layout: 'fan', highlight: [0, 1] },
        ],
        caption: 'Your 19 is closer to 21 than the dealer’s 17 — you win!',
        animate: 'deal',
      },
      tip: 'You don’t need exactly 21. You only need to beat the dealer — or let the dealer bust.',
    },
    {
      title: 'What the cards are worth',
      body:
        'Number cards are worth their number: a 7 is 7. 10s, Jacks, Queens and Kings are all ' +
        'worth 10 — we call them [[10-value cards|ten-value card]]. An Ace is worth 1 or 11, ' +
        'whichever helps you more. When the Ace counts as 11 your hand is a [[soft hand]]; any ' +
        'other hand is a [[hard hand]]. Suits don’t matter at all.',
      scene: {
        zones: [
          { id: 'numbers', label: 'Worth their number', cards: ['2H', '5C', '9D'], layout: 'row' },
          {
            id: 'tens',
            label: 'Worth 10',
            cards: ['TS', 'JH', 'QD', 'KC'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
          { id: 'ace', label: 'Worth 1 or 11', cards: ['AS'], layout: 'row', highlight: [0] },
          { id: 'soft', label: 'Ace + 6 = soft 17', cards: ['AD', '6S'], layout: 'fan' },
        ],
        caption: 'Ace + 6 is a soft 17: if a big card comes along, the Ace switches to 1.',
        animate: 'deal',
      },
      tip: 'Soft 17 can’t bust with one more card: draw a 10 and the Ace simply drops to 1, giving you 17.',
    },
    {
      title: 'The deal',
      body:
        'First you place your bet. Cards come from a [[shoe]] of six decks, shuffled fresh every ' +
        'round. You get two cards face up. The dealer gets one face up — the [[upcard]] — and one ' +
        'face down, the [[hole card]]. If the upcard is an Ace or a 10-value card, the dealer ' +
        'takes a quick [[peek]] at the hole card: a dealer [[Blackjack]] ends the round at once.',
      scene: {
        zones: [
          {
            id: 'dealer',
            label: 'Dealer shows a 9',
            cards: ['9C', '4H'],
            layout: 'row',
            faceDown: [1],
            highlight: [0],
          },
          { id: 'you', label: 'You: 8', cards: ['5H', '3S'], layout: 'fan' },
        ],
        caption: 'A 9 upcard means no peek — a 9 can’t make Blackjack.',
        animate: 'deal',
      },
    },
    {
      title: 'Your turn: hit or stand',
      body:
        'Look at your total and the dealer’s upcard, then choose. [[Hit]] means take another ' +
        'card — you can hit as many times as you like. [[Stand]] means stop and keep your total. ' +
        'Go over 21 and you [[bust]]: that hand loses at once. Reach exactly 21 and you stand ' +
        'automatically.',
      scene: {
        zones: [
          {
            id: 'dealer',
            label: 'Dealer shows a 9',
            cards: ['9C', '4H'],
            layout: 'row',
            faceDown: [1],
          },
          { id: 'you', label: 'You: 17', cards: ['5H', '3S', '9D'], layout: 'fan', highlight: [2] },
        ],
        caption: 'You had 8, hit, and drew a 9. Now you have 17 — time to stand.',
        animate: 'deal',
      },
      tip: 'With 11 or less, one more card can never bust you — so always take at least one more.',
    },
    {
      title: 'Double down',
      body:
        'On your first two cards you can [[double down]]: add a second bet the same size as the ' +
        'first, take exactly one more card, and that hand is finished. It’s a power move when you ' +
        'have 10 or 11 and the dealer’s upcard is weak. You can double after splitting, too.',
      scene: {
        zones: [
          {
            id: 'dealer',
            label: 'Dealer shows a 6',
            cards: ['6D', 'TC'],
            layout: 'row',
            faceDown: [1],
            highlight: [0],
          },
          { id: 'you', label: 'You: 21', cards: ['6S', '5H', 'KD'], layout: 'fan', highlight: [2] },
        ],
        caption: '11 against a weak 6: double down! One card — a King — and you have 21.',
        animate: 'deal',
      },
    },
    {
      title: 'Split a pair',
      body:
        'If your first two cards are a pair — the same value, like two 8s, or any two ' +
        '[[10-value cards|ten-value card]] — you can [[split]] them into two hands. You add a ' +
        'second bet, each hand gets a new second card, and you play them one after the other. ' +
        'You can split once per round. Split Aces are special: each gets just one more card.',
      scene: {
        zones: [
          {
            id: 'dealer',
            label: 'Dealer shows a 7',
            cards: ['7C', 'QS'],
            layout: 'row',
            faceDown: [1],
          },
          { id: 'hand1', label: 'Hand 1: 11', cards: ['8S', '3C'], layout: 'fan', highlight: [0] },
          { id: 'hand2', label: 'Hand 2: 18', cards: ['8H', 'KH'], layout: 'fan', highlight: [0] },
        ],
        caption: 'Two 8s make a weak 16. Split, they became 11 and 18 — much better.',
        animate: 'deal',
      },
      tip: 'Always split Aces and 8s. Never split 10s or 5s.',
    },
    {
      title: 'The dealer’s turn',
      body:
        'When you finish, the dealer turns over the [[hole card]] and follows fixed rules — the ' +
        'dealer never chooses. The dealer must hit on 16 or less and stand on 17 or more, even a ' +
        '[[soft hand|soft hand]] like Ace + 6. If the dealer busts, every hand still in play wins. ' +
        'If you already busted, the dealer doesn’t need to draw: that hand has lost.',
      scene: {
        zones: [
          {
            id: 'dealer',
            label: 'Dealer: soft 17 — must stand',
            cards: ['AD', '6C'],
            layout: 'row',
            highlight: [0, 1],
          },
          { id: 'you', label: 'You: 18', cards: ['TS', '8H'], layout: 'fan' },
        ],
        caption: 'Dealers stand on every 17, soft ones too. Your 18 wins.',
        animate: 'flip',
      },
    },
    {
      title: 'Winning and payouts',
      body:
        'A higher total than the dealer pays 1 to 1: bet 10, win 10. Equal totals are a ' +
        '[[push]] and your bet comes back. A [[Blackjack]] — an Ace plus a 10-value card as your ' +
        'first two cards — pays 3 to 2: bet 10, win 15. Blackjack against a dealer Blackjack is a ' +
        'push. If only the dealer has Blackjack, you lose just your one bet. A 21 made after ' +
        'splitting is a plain 21, not a Blackjack.',
      scene: {
        zones: [
          { id: 'dealer', label: 'Dealer: 17', cards: ['9D', '8C'], layout: 'row' },
          {
            id: 'you',
            label: 'Blackjack! Pays 3 to 2',
            cards: ['AS', 'KH'],
            layout: 'fan',
            highlight: [0, 1],
          },
        ],
        caption: 'Ace + King as your first two cards: Blackjack!',
        animate: 'deal',
      },
    },
    {
      title: 'A tiny example',
      body:
        'You have 10 + 2 = 12 and the dealer shows a 6. A 6 is a weak upcard, so you [[stand]]. ' +
        'The dealer turns over a 10 — that’s 16, so the dealer must [[hit]]. A 9 arrives: 25. ' +
        'The dealer busts, and your little 12 wins!',
      scene: {
        zones: [
          {
            id: 'dealer',
            label: 'Dealer: 6 + 10 + 9 = 25, bust',
            cards: ['6C', 'TD', '9S'],
            layout: 'row',
            highlight: [2],
          },
          { id: 'you', label: 'You stood on 12', cards: ['TH', '2S'], layout: 'fan' },
        ],
        caption: 'Standing on 12 against a 6 let the dealer do the busting.',
        animate: 'deal',
      },
    },
    {
      title: 'Beginner strategy',
      body:
        'You don’t have to guess: [[basic strategy]] gives the best play for every hand. The ' +
        'short version: stand on a hard 17 or more. With a hard 12 to 16, stand if the dealer ' +
        'shows 2 to 6 (but hit 12 against a 2 or 3), and hit if the dealer shows 7 or higher. ' +
        'Double 11 unless the dealer shows an Ace, and double 10 against 2 to 9. Always split ' +
        'Aces and 8s, never 10s or 5s. Never stand on a soft 17 or less: hit it (or double ' +
        'against a weak upcard). The coach shows the right move every time.',
      scene: {
        zones: [
          {
            id: 'dealer',
            label: 'Dealer shows a 6',
            cards: ['6H', '9C'],
            layout: 'row',
            faceDown: [1],
            highlight: [0],
          },
          { id: 'you', label: 'You: 12 — stand', cards: ['TC', '2D'], layout: 'fan' },
        ],
        caption: 'Standing on 12 against a dealer 6 is usually right.',
        animate: 'deal',
      },
      tip: 'Soft 18 (Ace + 7): double against a dealer 3 to 6, stand against 2, 7 or 8, and hit against 9, 10 or Ace.',
    },
  ],
  mistakes: [
    'Hitting a hard 17 or more hoping for a small card — most cards will bust you.',
    'Standing on 12 to 16 when the dealer shows 7 or higher. The dealer will usually reach 17 or more, so you need to improve.',
    'Splitting two 10-value cards. 20 is a winning hand — don’t break it up.',
    'Forgetting that an Ace can count as 1: Ace + 6 + 9 is 16, not a bust.',
    'Copying the dealer by always hitting until 17. The dealer’s rules are made for the house; basic strategy does much better.',
    'Not doubling 11 against a weak dealer card — it’s one of your best chances to win more.',
  ],
  tips: [
    'Tip: in Blackjack, standing on 12 against a dealer 6 is usually right.',
    'Tip: always split Aces and 8s — and never split 10s or 5s.',
    'Tip: double down on 11 unless the dealer shows an Ace.',
    'Tip: if the dealer shows 7 or higher, don’t stand on a hard 12 to 16 — keep hitting until you have 17 or more.',
    'Tip: soft hands are safe to hit — your Ace can drop from 11 to 1, so one card can’t bust you.',
    'Tip: when the dealer shows 2 to 6, stand on a hard 13 or more and let the dealer take the risk.',
    'Tip: you don’t need 21 — you just need to beat the dealer, or let the dealer bust.',
  ],
  quiz: [
    {
      question: 'You hit and go over 21 with 23. What happens to your bet?',
      options: [
        'Nothing yet — if the dealer busts too, it’s a push',
        'You lose it straight away, whatever the dealer does',
        'You win if the dealer ends up even higher',
        'The round is played again',
      ],
      answer: 1,
      explanation:
        'Your hand loses the moment you go over 21, even if the dealer would have busted too. The dealer doesn’t even need to draw — that’s the dealer’s big advantage.',
    },
    {
      question: 'You have an Ace and a 7. What is your total?',
      options: [
        '8, nothing else',
        '18, nothing else',
        '15',
        'Soft 18 — the Ace can still drop to 1, making it 8',
      ],
      answer: 3,
      explanation:
        'The Ace counts 11 while that doesn’t bust you, so Ace + 7 is a soft 18. If you take a big card, the Ace drops to 1.',
    },
    {
      question:
        'Your first two cards are an Ace and a Queen, and the dealer has no Blackjack. You bet 10. How much do you win?',
      options: ['15 — Blackjack pays 3 to 2', '10', '20', '21'],
      answer: 0,
      explanation: 'Ace + a 10-value card is Blackjack, which pays 3 to 2: 15 on a bet of 10.',
    },
    {
      question: 'You have a hard 16 and the dealer shows a 10. What does basic strategy say?',
      options: [
        'Stand — you might bust',
        'Double down',
        'Hit — the dealer will probably finish with 17 or more',
        'Split',
      ],
      answer: 2,
      explanation:
        'Against a strong 10 the dealer usually makes 17 or better, so standing on 16 loses most of the time. Hitting is risky, but it loses less often.',
    },
    {
      question: 'The dealer has a soft 17 (Ace + 6). What must the dealer do in our game?',
      options: ['Hit', 'Stand', 'Double down', 'Ask you what to do'],
      answer: 1,
      explanation:
        'Our dealer stands on every 17, soft or hard. (Some casinos make the dealer hit soft 17 — see Variants.)',
    },
  ],
  seo: {
    description:
      'Learn Blackjack (21) step by step: card values, hit, stand, double down, split, dealer rules and basic strategy — then play a coached hand.',
  },
});
