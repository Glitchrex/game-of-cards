import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'spades',
  name: 'Spades',
  origin: { country: 'United States', countryCode: 'US', region: 'north-america' },
  type: 'trick-taking',
  players: { min: 2, max: 4, ideal: 4 },
  deck: 'Standard 52-card deck (no jokers)',
  difficulty: 3,
  length: 'About 10 minutes per hand',
  minutes: 10,
  moods: ['social', 'brainy', 'competitive'],
  hook: 'Team up with a partner, call your tricks — and let the mighty Spades do the trumping!',
  history:
    'Spades belongs to the big Whist family of trick-taking games, the same family as Bridge. It is thought to have been developed in the United States around the 1930s, and it is said to have spread widely with American soldiers during the Second World War, who liked that a hand could be dropped and picked up quickly. Today it is a favourite at family tables, in college dorms and in online card rooms.',
  featured: false,
  order: 110,
  variantTaught:
    'Classic 4-player partnership Spades, played as a single hand: you and your partner sit opposite each other; every player bids 0 to 13 tricks (0 = Nil; no Blind Nil); the player on the dealer’s left bids first and leads the first trick; you must follow suit if you can; Spades are always trump and cannot be led until they are broken — until someone has played a Spade on a trick of another suit — unless you hold only Spades. A team that makes its bid scores 10 points per trick bid plus 1 point per extra trick (bag, with no bag penalty in a single hand); a team that falls short loses 10 points per trick bid. A Nil scores +100 if the Nil bidder wins no tricks and −100 if they win any; a Nil bidder’s tricks never count toward the partner’s bid (they count as bags). The team with the higher score for the hand wins; equal scores are a tie.',
  variants:
    'A full game is many hands long and usually ends when a team reaches 500 points (some tables also stop when a team falls to −200). In a full game, every 10 bags costs your team 100 points — that is why good players try not to win extra tricks once their bid is safe. Popular extras: Blind Nil (bidding Nil before you look at your cards, worth ±200), Big and Little Jokers added as the two highest trumps, a minimum team bid of 4, and “Suicide Spades”, where one partner in each team must bid Nil. Some tables let a Nil bidder’s tricks count toward the partner’s bid, and there are 2- and 3-player “cutthroat” versions where everyone plays alone.',
  glossary: [
    {
      term: 'trick',
      definition:
        'One round in which each of the four players plays one card. The best card wins all four — for example 4♦, K♦, 9♦, 2♦: the K♦ wins.',
    },
    {
      term: 'lead',
      definition:
        'To play the first card of a trick. Its suit is the one everyone else must follow — lead the 7♣ and Clubs are led.',
    },
    {
      term: 'follow suit',
      definition:
        'Playing a card of the suit that was led. You must do it if you can: if Hearts are led and you hold the 5♥, you have to play a Heart.',
    },
    {
      term: 'void',
      definition:
        'Having no cards left in a suit. When you are void in the suit that was led, you may play any card — including a Spade to trump.',
    },
    {
      term: 'trump',
      definition:
        'In Spades, every Spade is a trump: it beats any card of the other three suits. If Hearts are led, even the 2♠ beats the A♥.',
    },
    {
      term: 'partner',
      definition:
        'The player sitting across from you. You are a team: your tricks are added together and you score together.',
    },
    {
      term: 'bid',
      definition:
        'Your promise of how many tricks you will win, made before any card is played. For example, “I bid 3.”',
    },
    {
      term: 'contract',
      definition:
        'Your team’s target: your bid plus your partner’s bid. Bid 3 and 2 and your contract is 5 tricks.',
    },
    {
      term: 'Nil',
      definition:
        'A bid of zero: you promise to win no tricks at all. It is worth +100 points if you win none and −100 if you win even one.',
    },
    {
      term: 'breaking Spades',
      definition:
        'The first time anyone plays a Spade on a trick of another suit (because they had none of the suit that was led). Until then nobody may lead a Spade, unless their hand is all Spades.',
    },
    {
      term: 'bag',
      definition:
        'An extra trick beyond your contract. In a single hand each bag is worth just 1 point — bid 5, win 7 and you have 2 bags. (In a full game, every 10 bags cost 100 points.)',
    },
    {
      term: 'set',
      definition:
        'Failing to win as many tricks as your contract. A team that bid 6 and won only 5 is “set” and loses 60 points.',
    },
  ],
  lesson: [
    {
      title: 'The goal: you and your partner',
      body: 'Spades is played by four people in two teams. Your [[partner]] sits across from you, and the players on your left and right are a team too. Before any card is played, everyone makes a [[bid]] — a promise of how many [[tricks|trick]] they will win. Your bid plus your partner’s bid is your team’s [[contract]]: win at least that many tricks together and you score.',
      scene: {
        zones: [
          {
            id: 'partner',
            label: 'Your partner (across)',
            cards: ['KS', '9H', '4C'],
            layout: 'row',
            faceDown: [0, 1, 2],
          },
          {
            id: 'left',
            label: 'Opponent (left)',
            cards: ['QD', '7S', '2H'],
            layout: 'row',
            faceDown: [0, 1, 2],
          },
          {
            id: 'right',
            label: 'Opponent (right)',
            cards: ['JC', '5D', '8H'],
            layout: 'row',
            faceDown: [0, 1, 2],
          },
          {
            id: 'you',
            label: 'You',
            cards: ['AS', 'QS', 'KH', 'AC', '6D'],
            layout: 'fan',
          },
        ],
        caption: 'Sit opposite your partner. The two of you share every trick you win.',
        animate: 'deal',
      },
      tip: 'Spades is a team game — your partner’s tricks count just as much as yours.',
    },
    {
      title: 'Deal 13 cards each',
      body: 'The whole deck is dealt, one card at a time, so everyone holds 13 cards. Sort your hand by suit — it makes counting much easier. The player on the dealer’s left bids first, and that same player [[leads|lead]] the first trick once everyone has bid.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['AS', 'QS', '7S', '3S', 'KH', '9H', '4H', 'AC', 'JC', '6C', '2C', '8D', '5D'],
            layout: 'fan',
            highlight: [0, 1, 2, 3],
          },
        ],
        caption: 'Your 13 cards, sorted by suit. Spades are the special suit — more on them soon.',
        animate: 'deal',
      },
    },
    {
      title: 'A trick: follow suit',
      body: 'A [[trick]] is one card from each player, going clockwise. The leader may play any card (except a Spade, early on — see below). Everyone else must [[follow suit]] if they can. The highest card of the suit that was led wins, Aces are high, and the winner leads the next trick.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick',
            cards: ['TD', '4D', 'KD', '7D'],
            layout: 'row',
            highlight: [2],
          },
        ],
        caption: 'Diamonds were led and everyone followed. The K♦ is the highest, so it wins.',
        animate: 'deal',
      },
    },
    {
      title: 'Spades are always trump',
      body: 'Spades are [[trump]]. When you are [[void]] in the suit that was led, you may play a Spade — and any Spade beats every card of the other suits. If two players trump, the higher Spade wins. You never have to trump: when you can’t follow suit you may throw away any card instead.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick',
            cards: ['AH', '9H', '2S', '5H'],
            layout: 'row',
            highlight: [2],
          },
          {
            id: 'hand',
            label: 'Your hand (no Hearts left)',
            cards: ['QS', '6S', 'KC', '8C', '3D'],
            layout: 'fan',
          },
        ],
        caption:
          'Someone had no Hearts and played the 2♠. Even the A♥ loses to the smallest Spade!',
        animate: 'deal',
      },
      tip: 'Short of a suit? Once you are void, your low Spades can win tricks you never expected.',
    },
    {
      title: 'Breaking Spades',
      body: 'You may not lead a Spade until someone has played a Spade on a trick of another suit — that moment is called [[breaking Spades]]. It happens when a player who is [[void]] in the suit that was led trumps with a Spade (or throws one away). One exception: if your hand is nothing but Spades, you may lead one anyway — but that lead on its own does not break Spades for the others.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Earlier trick',
            cards: ['QC', '3C', '8S', 'JC'],
            layout: 'row',
            highlight: [2],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['KS', '9S', '4S', '7H', '2D'],
            layout: 'fan',
            highlight: [0, 1, 2],
          },
        ],
        caption: 'The 8♠ trumped a Club, so Spades are broken — now you may lead your Spades.',
        animate: 'deal',
      },
    },
    {
      title: 'Bidding: count your tricks',
      body: 'Look at your hand and count the tricks you expect to win. Each Ace is about one trick. A King with at least one more card of its suit is often one. High Spades are strong, and every Spade beyond your third usually wins a trick too. A very short suit lets you trump. Then make your [[bid]] — and bid a little LOW: missing your [[contract]] costs far more than winning an extra trick.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['AS', 'KS', '9S', '4S', 'AH', '8H', '3H', 'KC', '6C', '2C', '9D', '7D', '4D'],
            layout: 'fan',
            highlight: [0, 1, 3, 4, 7],
          },
        ],
        caption: 'A♠, K♠, A♥, maybe the K♣, and your fourth Spade: a bid of 4 is about right.',
        animate: 'deal',
      },
      tip: 'Your partner’s bid adds to yours. If they bid high, don’t stretch your own bid to match.',
    },
    {
      title: 'Nil: the bold zero',
      body: 'A bid of 0 is called [[Nil]]: you promise to win NO tricks at all. Manage it and your team scores 100 points; win even one trick and it is −100. Your [[partner]] still plays for their own bid and protects you by winning tricks with high cards. Only bid Nil with a hand full of low cards: no Aces and no high Spades.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'A good Nil hand',
            cards: ['7S', '4S', '2S', '9H', '5H', '3H', 'JC', '6C', '4C', '2C', '8D', '5D', '3D'],
            layout: 'fan',
            highlight: [2, 5, 9, 12],
          },
        ],
        caption: 'No Aces, no high Spades and lots of low cards to duck with: a nice Nil hand.',
        animate: 'deal',
      },
      tip: 'Bidding Nil? Get rid of your highest cards early, while others are still playing high.',
    },
    {
      title: 'Scoring and bags',
      body: 'When all 13 tricks are played, each team counts its tricks. Made your [[contract]]? Score 10 points per trick you bid, plus 1 point for each extra trick — an extra trick is called a [[bag]]. Fell short? You are [[set]] and lose 10 points per trick you bid. A [[Nil]] adds +100 or −100, and a Nil bidder’s tricks never help their partner’s bid (they only count as bags). The team with the higher score wins the hand. (In a full game, every 10 bags cost 100 points — that is why players avoid them.)',
      scene: {
        zones: [
          {
            id: 'us',
            label: 'Your team: bid 5, won 7 → 52 points',
            cards: ['AS', 'KS', 'AH', 'KH', 'AC', 'QD', '9S'],
            layout: 'row',
            highlight: [5, 6],
          },
          {
            id: 'them',
            label: 'Opponents: bid 7, won 6 → set, −70',
            cards: ['QS', 'JS', 'AD', 'KC', 'KD', 'QH'],
            layout: 'row',
          },
        ],
        caption:
          'Each card stands for one trick won. You made your 5 with 2 bags; the opponents fell one short.',
        animate: 'deal',
      },
    },
    {
      title: 'A tiny example',
      body: 'The player on your left leads the K♥. Your partner plays the A♥ — it is winning! The player on your right follows with the 6♥. You have no Hearts, so you could trump… but there is no need: your partner already has this [[trick]]. Throw away your low 3♣ and save your Spades for later. Your team wins the trick.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'The trick',
            cards: ['KH', 'AH', '6H', '3C'],
            layout: 'row',
            highlight: [1],
          },
          {
            id: 'hand',
            label: 'Your hand afterwards',
            cards: ['QS', '9S', '5S', 'KC', '8C', '4D', '2D'],
            layout: 'fan',
          },
        ],
        caption:
          'Your partner’s A♥ wins. Don’t waste a trump on a trick your partner is sure to win.',
        animate: 'deal',
      },
    },
    {
      title: 'Beginner strategy',
      body: 'Bid a little low. Count the Spades as they fall — once the high ones are gone, your low Spades become winners. Don’t [[trump]] a trick your partner is already sure to win. Second to play? Usually play low. Third? Play high. If your partner bids [[Nil]], use your high cards to cover them. Once your team has made its [[contract]] and the hand is safely decided, lose tricks on purpose to avoid [[bags|bag]] — but while the score is close, every extra trick is a point.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['AS', 'TS', '6S', 'QH', '5H', '2H', 'AC', '7C', '3C', 'KD', '9D'],
            layout: 'fan',
            highlight: [0, 6],
          },
        ],
        caption:
          'Your Aces are your surest tricks. Low cards are perfect for losing a trick on purpose.',
        animate: 'deal',
      },
      tip: 'Watch your partner’s bid: if they bid high, they’ll want the lead — help them get it.',
    },
  ],
  mistakes: [
    'Forgetting to follow suit — if you still hold a card of the led suit, you must play one.',
    'Leading a Spade before Spades have been broken.',
    'Trumping a trick your partner is already winning.',
    'Counting every King and Queen as a sure trick and bidding too high — then getting set.',
    'Bidding Nil while holding an Ace or a high Spade.',
    'Forgetting that the contract is shared: your partner’s bid adds to yours.',
  ],
  tips: [
    'Tip: in Spades, bid a little under your count — getting set costs 10 points per trick, while an extra trick is worth only 1.',
    'Tip: don’t trump your partner’s winning card — throw away a low card from another suit instead.',
    'Tip: count the Spades as they are played; once the Ace, King and Queen of Spades are gone, your Jack is the boss.',
    'Tip: lead your short side suit early — once you are void, you can trump that suit with low Spades.',
    'Tip: when your partner bids Nil, play your highest card on every trick they might win.',
    'Tip: playing second, usually play low; playing third, play high to help your partner.',
    'Tip: once your team has made its bid and the hand is safely decided, duck tricks with your highest losing cards to avoid bags — in a close hand, every extra trick is a point.',
  ],
  quiz: [
    {
      question: 'You bid 4 and your partner bids 3. What is your team’s contract?',
      options: ['3 tricks', '4 tricks', '7 tricks', '12 tricks'],
      answer: 2,
      explanation:
        'Partners add their bids together: 4 + 3 = 7. Your team needs at least 7 tricks between you.',
    },
    {
      question: 'Hearts are led. You have no Hearts at all. What may you play?',
      options: [
        'Any card — a Spade would trump the trick',
        'Only a Spade',
        'Only a Club or a Diamond',
        'Nothing — you must skip your turn',
      ],
      answer: 0,
      explanation:
        'When you are void in the led suit you may play any card. A Spade beats every Heart; any other card just loses.',
    },
    {
      question:
        'No Spade has been played yet and it is your lead. Your hand has Spades and Clubs. What may you lead?',
      options: ['Any card', 'Only a Spade', 'Nothing — you must pass', 'Only a Club'],
      answer: 3,
      explanation:
        'Spades can’t be led until they are broken (someone has played a Spade on a trick of another suit). You still hold Clubs, so lead a Club.',
    },
    {
      question: 'Your team bid 5 and won 7 tricks. What does your team score for the hand?',
      options: ['70 points', '52 points', '50 points', '−50 points'],
      answer: 1,
      explanation:
        'You made your contract: 10 × 5 = 50, plus 1 point for each of the 2 extra tricks (bags) = 52.',
    },
    {
      question:
        'Your partner bid Nil. Diamonds are led and your partner’s Q♦ is winning. You hold the K♦ and the 3♦. What should you play?',
      options: [
        'The 3♦, to save your King',
        'A Spade',
        'The K♦, so you win the trick instead of your partner',
      ],
      answer: 2,
      explanation:
        'If your partner wins a trick their Nil fails (−100). Beat their Q♦ with your K♦ so they stay at zero tricks.',
    },
  ],
  seo: {
    description:
      'Learn Spades step by step: team up with a partner, bid your tricks, follow suit, trump with Spades and try a bold Nil — then play a hand against friendly bots.',
  },
});
