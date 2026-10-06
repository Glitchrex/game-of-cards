import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'hearts',
  name: 'Hearts',
  aka: ['Black Lady'],
  origin: { country: 'United States', countryCode: 'US', region: 'north-america' },
  type: 'trick-taking',
  players: { min: 3, max: 6, ideal: 4 },
  deck: 'Standard 52-card deck (no jokers)',
  difficulty: 2,
  length: '5–10 minutes per hand',
  minutes: 8,
  moods: ['brainy', 'social', 'competitive'],
  hook: 'Dodge every Heart, run from the Queen of Spades — and the lowest score wins!',
  history:
    'Hearts is thought to descend from older European games such as Reversis, where the aim was to avoid winning tricks. The version with the Queen of Spades as a 13-point penalty — once called Black Lady — is believed to have taken shape in America. For many years a copy of Hearts came free with Microsoft Windows, which helped make it one of the best-known card games in the world.',
  featured: true,
  order: 90,
  variantTaught:
    'Classic 4-player Hearts, played as a single hand: pass 3 cards to the left, the Two of Clubs leads the first trick, no Hearts or Queen of Spades on the first trick (unless you have nothing else), Hearts cannot be led until they are broken (the Queen of Spades does not break them), each Heart is 1 point and the Queen of Spades is 13, and a player who takes all 26 points shoots the moon (0 for them, 26 for everyone else). Lowest score wins; ties share the win.',
  variants:
    "A full game is many hands long and ends when someone reaches 100 points — the lowest total then wins. In a full game the pass rotates: left, then right, then across, then a 'hold' hand with no passing. Some tables let the Queen of Spades break Hearts, let you lead Hearts at any time, count the Jack of Diamonds as minus 10 points (the 'Omnibus' style), or let a moon shooter take 26 points off their own score instead of adding 26 to everyone else. With 3, 5 or 6 players a few low cards are taken out so everyone gets the same number of cards.",
  glossary: [
    {
      term: 'trick',
      definition:
        'One round where every player plays one card. The highest card of the suit that was led wins all of them — for example 5♦, K♦, 2♦, 9♦: the K♦ wins.',
    },
    {
      term: 'lead',
      definition:
        'To play the first card of a trick. Its suit is the one everyone else must follow — lead the 4♣ and Clubs are led.',
    },
    {
      term: 'follow suit',
      definition:
        'Playing a card of the suit that was led. You must do it if you can: if Diamonds are led and you hold the 7♦, you have to play a Diamond.',
    },
    {
      term: 'void',
      definition:
        'Having no cards left in a suit. When you are void in the led suit you may play any card — the perfect moment to get rid of points (except on the very first trick, where points are not allowed unless you hold nothing else).',
    },
    {
      term: 'point cards',
      definition:
        'The cards that count against you: every Heart is 1 point and the Queen of Spades is 13. All the other cards are worth nothing.',
    },
    {
      term: 'breaking Hearts',
      definition:
        'The first time anyone plays a Heart on a trick. Until then nobody may lead a Heart, unless their hand is nothing but Hearts.',
    },
    {
      term: 'Queen of Spades',
      definition:
        'The most dangerous card in Hearts: on her own she is worth 13 points — as much as all 13 Hearts put together, and half of all the points in the deck.',
    },
    {
      term: 'passing',
      definition:
        'Before the first trick, everyone gives 3 cards to the player on their left and gets 3 from the player on their right. Pass the cards you fear most.',
    },
    {
      term: 'shooting the moon',
      definition:
        'Taking ALL 13 Hearts and the Queen of Spades in one hand. Instead of scoring 26, you score 0 — and every other player gets 26.',
    },
    {
      term: 'Two of Clubs',
      definition:
        'The card that always starts the very first trick. Whoever holds the 2♣ must lead it.',
    },
  ],
  lesson: [
    {
      title: 'The goal: dodge the points',
      body: 'Hearts is a game about NOT collecting points. Every one of the [[point cards]] you collect counts against you: each Heart is 1 point and the [[Queen of Spades]] is 13. When the hand is over, the player with the LOWEST score wins.',
      scene: {
        zones: [
          {
            id: 'points',
            label: 'Point cards',
            cards: ['QS', 'AH', 'KH', '7H', '2H'],
            layout: 'row',
            highlight: [0, 1, 2, 3, 4],
          },
          { id: 'safe', label: 'Worth nothing', cards: ['AC', 'KD', 'JS', '9C'], layout: 'row' },
        ],
        caption: 'Hearts are 1 point each. The Queen of Spades is 13 points on her own.',
        animate: 'deal',
      },
      tip: 'Think of points as penalties — you want as few as possible.',
    },
    {
      title: 'Deal 13 each, then pass 3',
      body: 'Four players share one deck, so everyone gets 13 cards. Before anyone plays, you choose 3 cards to give to the player on your left — this is [[passing]]. At the same moment the player on your right passes 3 cards to you, but you only see them after you have chosen. Pass your scariest cards: the Queen of Spades, high Hearts, or the last cards of a short suit.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['QS', '8S', '3S', 'AH', 'KH', '6H', '2H', 'KC', '9C', '5C', 'JD', '8D', '4D'],
            layout: 'fan',
            highlight: [0, 3, 4],
          },
          {
            id: 'incoming',
            label: 'Coming from your right',
            cards: ['7C', 'TD', '2S'],
            layout: 'row',
            faceDown: [0, 1, 2],
          },
        ],
        caption: 'Pass the Q♠, A♥ and K♥ to your left — three cards that love to win points.',
        animate: 'deal',
      },
      tip: 'Keep the Queen of Spades only if you hold four or more lower Spades to hide her behind.',
    },
    {
      title: 'Tricks: the Two of Clubs starts',
      body: 'The hand is played in 13 [[tricks|trick]]. Whoever holds the [[Two of Clubs]] must [[lead]] it to start the first trick. Then, going clockwise, everyone plays one card. The highest card of the suit that was led wins the trick, and the winner leads the next one. Aces are high.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick 1',
            cards: ['2C', '9C', 'KC', '5C'],
            layout: 'row',
            highlight: [2],
          },
        ],
        caption: 'The K♣ is the highest Club, so it wins the trick — and its player leads next.',
        animate: 'deal',
      },
    },
    {
      title: 'Follow suit',
      body: 'You must [[follow suit]]: if a Diamond is led and you hold any Diamond, you have to play one. You do get to choose WHICH one — play a low Diamond to lose the trick, or a high one if you are happy to win it.',
      scene: {
        zones: [
          { id: 'trick', label: 'Trick', cards: ['8D'], layout: 'row' },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['QS', '7S', 'JH', '4H', 'AC', '6C', 'KD', '3D'],
            layout: 'fan',
            highlight: [6, 7],
          },
        ],
        caption: 'Diamonds were led: you must play the K♦ or the 3♦. The 3♦ can never win here.',
        animate: 'deal',
      },
    },
    {
      title: 'Void? Play anything!',
      body: 'When you have no cards of the led suit you are [[void]] in it, and you may play any card. This is your chance to dump the Queen of Spades or a high Heart on somebody else’s trick! One exception: on the very first trick nobody may play a Heart or the Queen of Spades unless they have nothing else.',
      scene: {
        zones: [
          { id: 'trick', label: 'Trick', cards: ['5C', 'JC', '9C'], layout: 'row', highlight: [1] },
          {
            id: 'hand',
            label: 'Your hand (no Clubs)',
            cards: ['QS', '9S', 'AH', 'TH', '3H', 'KD', '6D'],
            layout: 'fan',
            highlight: [0],
          },
        ],
        caption:
          'No Clubs? Drop the Queen of Spades — the J♣ wins, so its player takes her 13 points.',
        animate: 'deal',
      },
      tip: 'Passing away a short suit makes you void sooner, so you can dump points earlier.',
    },
    {
      title: 'Breaking Hearts',
      body: 'You may not lead a Heart until a Heart has been played on an earlier trick — that moment is called [[breaking Hearts]]. Usually it happens when a void player throws a Heart onto a trick. Two details: if your hand is nothing but Hearts you may lead one anyway, and the Queen of Spades does NOT break Hearts.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick 4',
            cards: ['6S', '2S', 'KH', '9S'],
            layout: 'row',
            highlight: [2],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['TS', '3S', '8H', '5H', 'QC', '8C', 'JD', '7D', '4D'],
            layout: 'fan',
            highlight: [2, 3],
          },
        ],
        caption:
          'Someone had no Spades and threw the K♥ — Hearts are broken. Now Hearts may be led.',
        animate: 'deal',
      },
    },
    {
      title: 'Beware the Queen of Spades',
      body: 'The [[Queen of Spades]] is worth 13 points — as much as all 13 Hearts put together. Protect her with lower Spades or pass her away. Watch your A♠ and K♠ too: if one of them is winning a Spade trick and someone drops the Queen on it, she is all yours.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Spade trick',
            cards: ['4S', 'AS', 'QS', '7S'],
            layout: 'row',
            highlight: [1, 2],
          },
        ],
        caption: 'Ouch! The A♠ wins this trick, and the Queen of Spades with it: 13 points.',
        animate: 'deal',
      },
      tip: 'Once the Queen of Spades has been played, your Ace and King of Spades can no longer catch her.',
    },
    {
      title: 'Scoring and shooting the moon',
      body: 'After 13 tricks, count the [[point cards]] you won: 1 per Heart, 13 for the Queen of Spades — 26 points in all. The lowest score wins, and tied players share the win. But if one player takes ALL 26 points, they are [[shooting the moon]]: they score 0 and every other player gets 26!',
      scene: {
        zones: [
          {
            id: 'hearts',
            label: 'All 13 Hearts…',
            cards: ['AH', 'KH', 'QH', 'JH', 'TH', '9H', '8H', '7H', '6H', '5H', '4H', '3H', '2H'],
            layout: 'grid',
          },
          { id: 'queen', label: '…and the Queen', cards: ['QS'], layout: 'stack', highlight: [0] },
        ],
        caption: 'Take every point card and the 26 points go to everyone else instead of you.',
        animate: 'deal',
      },
      tip: 'Shooting the moon is risky: if anyone else takes even one Heart, you are stuck with a big score.',
    },
    {
      title: 'A tiny example',
      body: 'Diamonds are led with the 9♦. You [[follow suit]] with your 4♦ — lower, so it cannot win. The next player is [[void]] in Diamonds and drops the Queen of Spades. The last player plays the J♦. The J♦ is the highest Diamond, so that player wins the [[trick]] and takes 13 points. You took none — perfect!',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'The trick',
            cards: ['9D', '4D', 'QS', 'JD'],
            layout: 'row',
            highlight: [3],
          },
          {
            id: 'hand',
            label: 'Your hand afterwards',
            cards: ['5S', '3S', '6H', 'TC', '2D'],
            layout: 'fan',
          },
        ],
        caption: 'The J♦ wins: its player collects the Queen of Spades. Your 4♦ ducked safely.',
        animate: 'deal',
      },
    },
    {
      title: 'Beginner strategy',
      body: 'Play low cards when you are not sure you will lose the trick. When you are last on a trick with no points, you can safely win it with a high card (just never with the Queen of Spades). Try to become [[void]] in a short suit early so you can dump points later. Count the Spades as they fall, and if one player has taken every point so far, grab a Heart yourself to stop them [[shooting the moon]].',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['AS', 'KS', '3S', '5H', '2H', 'KC', '4C', '3C', 'QD', '2D'],
            layout: 'fan',
            highlight: [2, 4, 7, 9],
          },
        ],
        caption: 'Low cards are your best friends: they lose tricks safely.',
        animate: 'deal',
      },
      tip: 'Your A♠ and K♠ are dangerous while the Queen of Spades is still out — get rid of them when you are void.',
    },
  ],
  mistakes: [
    'Leading a Heart before Hearts have been broken.',
    'Forgetting to follow suit — if you hold a card of the led suit, you must play one.',
    'Keeping the Queen of Spades with only one or two small Spades to protect her.',
    'Playing a high card in the middle of a trick when a low card would have lost it safely.',
    'Throwing away a low card when void, instead of the Queen of Spades or a high Heart.',
    'Going for the moon after another player has already taken a Heart — it can no longer work.',
  ],
  tips: [
    'Tip: in Hearts, pass the Queen of Spades unless you hold at least four lower Spades to hide her behind.',
    'Tip: pass the last one or two cards of a short suit — being void lets you dump points later.',
    'Tip: when you are last to play and the trick has no points, win it with your highest card of that suit (never the Queen of Spades) — a free way to get rid of a dangerous card.',
    'Tip: when you cannot follow suit, throw away the Queen of Spades or your highest Heart first.',
    'Tip: if you do not hold the Queen of Spades, leading low Spades can force her out onto someone else.',
    'Tip: if one player has taken every point so far, take a Heart yourself to stop them shooting the moon.',
    'Tip: count the Spades as they are played — once the Queen is gone, your Ace and King of Spades are safe.',
  ],
  quiz: [
    {
      question: 'What are you trying to do in Hearts?',
      options: [
        'Win as many tricks as you can',
        'Finish with the lowest score',
        'Collect as many Hearts as you can',
        'Be the first to empty your hand',
      ],
      answer: 1,
      explanation:
        'Points are penalties: every Heart is 1 point and the Queen of Spades is 13. The lowest score wins — unless someone shoots the moon.',
    },
    {
      question:
        'Clubs are led on the third trick. You have no Clubs, but you hold the Queen of Spades and some Diamonds. What is usually best?',
      options: [
        'Play the Queen of Spades',
        'Play your lowest Diamond',
        'You must skip your turn',
        'Play any Heart except the Ace',
      ],
      answer: 0,
      explanation:
        'You are void in Clubs, so you may play any card. Dumping the 13-point Queen on a trick you cannot win is a great move.',
    },
    {
      question:
        "Hearts haven't been broken yet and it's your lead. Your hand has Hearts and Diamonds. What may you lead?",
      options: ['Any card', 'Only a Heart', 'Nothing — you must pass', 'Only a Diamond'],
      answer: 3,
      explanation:
        "Hearts can't be led until a Heart has been played on an earlier trick. Since you still hold Diamonds, you must lead one of those.",
    },
    {
      question:
        'Diamonds are led. The trick already holds the 9♦ and the 10♦. You hold the 3♦ and the K♦. Which card avoids winning the trick?',
      options: ['The K♦', 'Any Heart — your choice', 'The 3♦'],
      answer: 2,
      explanation:
        'You must follow suit with a Diamond. The 3♦ is lower than the 10♦ so it cannot win, while the K♦ would take the trick.',
    },
    {
      question: 'One player takes all 13 Hearts and the Queen of Spades. What happens?',
      options: [
        'They score 26 points',
        'They score 0 and everyone else gets 26',
        'The hand is dealt again',
        'Everyone scores 0',
      ],
      answer: 1,
      explanation:
        'That is shooting the moon! Taking all 26 points flips the scoring: the shooter gets 0 and every other player gets 26.',
    },
  ],
  seo: {
    description:
      'Learn Hearts step by step: pass three cards, follow suit, break Hearts, dodge the Queen of Spades and shoot the moon — then play a hand against friendly bots.',
  },
});
