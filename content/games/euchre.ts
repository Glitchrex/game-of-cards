import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'euchre',
  name: 'Euchre',
  origin: { country: 'United States', countryCode: 'US', region: 'north-america' },
  type: 'trick-taking',
  players: { min: 4, max: 4, ideal: 4 },
  deck: '24 cards: the 9, 10, J, Q, K and A of each suit (taken from a standard deck)',
  difficulty: 3,
  length: 'About 3 minutes a deal; 20–30 minutes to reach 10 points',
  minutes: 25,
  moods: ['social', 'competitive'],
  hook: 'The Midwest’s kitchen-table classic: grab a partner, pick trump, and let the Jacks do the talking',
  history:
    'Euchre is thought to come from an Alsatian game called Juckerspiel, probably carried to America by German-speaking immigrants, and during the 1800s it became one of the most popular card games in the United States. Its famous “bowers” take their name from the German word Bauer (farmer), a name for the Jack. The Joker is widely believed to have been invented for Euchre, around the 1860s, as an extra-high trump called the “best bower”. Today Euchre is a favourite in the American Midwest and in Ontario, Canada.',
  featured: false,
  order: 190,
  variantTaught:
    'Standard four-player partnership Euchre: a 24-card deck (9 to Ace), five cards each, one card turned up from the four-card kitty, two rounds of choosing trump, the Right and Left Bowers, the option of going alone, and game to 10 points. If all four players pass in both rounds, the cards are thrown in and the next player deals.',
  variants:
    'Stick the dealer: if everyone passes twice, the dealer must name trump — very common in casual and tournament play. Some groups add a Joker as the very highest trump (often called the Benny or best bower), and some use a bigger deck with the 8s and 7s added. Tables also differ on the target score (5, 7, 10 or 11 points) and on lone-hand extras, such as allowing a defender to go alone or giving 4 points for euchring a lone player. Bid Euchre adds an auction for the number of tricks, and there are versions for two or three players, such as three-handed “cutthroat” Euchre.',
  glossary: [
    {
      term: 'trick',
      definition:
        'One round where each of the four players plays one card; the best card wins all four. Example: Q♠, A♠, 9♠, K♠ — the A♠ wins the trick.',
    },
    {
      term: 'lead',
      definition:
        'To play the first card of a trick. Whoever wins a trick leads the next one, e.g. leading the A♣.',
    },
    {
      term: 'follow suit',
      definition:
        'Play a card of the same suit that was led if you have one. If spades are led and you hold a spade, you must play it.',
    },
    {
      term: 'trump',
      definition:
        'The suit chosen for this deal. Any trump beats any card of another suit: if hearts are trump, the 9♥ beats the A♠.',
    },
    {
      term: 'right bower',
      definition:
        'The Jack of the trump suit — the highest card in the game. If hearts are trump, the Right Bower is the J♥.',
    },
    {
      term: 'left bower',
      definition:
        'The other Jack of the same colour as trump. It becomes a trump, the second-best card. If hearts are trump, the J♦ is the Left Bower and counts as a heart.',
    },
    {
      term: 'kitty',
      definition:
        'The four cards left over after the deal. The top one is turned face up to suggest a trump suit, e.g. the K♥.',
    },
    {
      term: 'order up',
      definition:
        'To accept the turned-up card’s suit as trump in round one. The dealer then picks up that card. “I order it up!”',
    },
    {
      term: 'makers',
      definition:
        'The team that chose trump this deal. They need at least 3 of the 5 tricks to score.',
    },
    {
      term: 'euchre',
      definition:
        'When the makers win fewer than 3 tricks. The other team scores 2 points — “We got euchred!”',
    },
    {
      term: 'march',
      definition:
        'When the makers win all 5 tricks. It scores 2 points (or 4 for a player going alone).',
    },
    {
      term: 'going alone',
      definition:
        'The player who chose trump may play without their partner, who puts their cards face down and sits out. Win all 5 tricks alone and score 4 points; 3 or 4 tricks still score 1.',
    },
    {
      term: 'void',
      definition:
        'Having no cards at all of a suit. If you are void in clubs, you may trump when clubs are led.',
    },
  ],
  lesson: [
    {
      title: 'The goal: win 3 of 5 tricks with your partner',
      body: 'Euchre is for four players in two teams, and your partner sits across from you. Each deal, one team picks the [[trump]] suit and then tries to win at least 3 of the 5 [[tricks|trick]]. Win them and you score points. The first team to reach 10 points wins the game.',
      scene: {
        zones: [
          {
            id: 'partner',
            label: 'Partner (across the table)',
            cards: ['TS', 'QD', 'KC', '9H', 'AD'],
            layout: 'fan',
            faceDown: [0, 1, 2, 3, 4],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['JH', 'AH', 'KS', 'QC', 'TD'],
            layout: 'fan',
          },
        ],
        caption: 'You and your partner are a team. Five cards each, five tricks to play.',
      },
    },
    {
      title: 'A small deck and a quick deal',
      body: 'Euchre uses just 24 cards: the 9, 10, Jack, Queen, King and Ace of each suit. The dealer gives everyone 5 cards, in a group of 2 and a group of 3. The 4 cards left over are the [[kitty]]. Its top card is turned face up — it suggests which suit could become trump.',
      scene: {
        zones: [
          {
            id: 'suit',
            label: 'One suit in Euchre: 9 up to Ace',
            cards: ['9C', 'TC', 'JC', 'QC', 'KC', 'AC'],
            layout: 'row',
          },
          {
            id: 'kitty',
            label: 'Kitty (top card turned up)',
            cards: ['QS', 'KH'],
            layout: 'stack',
            faceDown: [0],
            highlight: [1],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['AS', 'KD', 'QH', 'TH', 'JD'],
            layout: 'fan',
          },
        ],
        caption: 'Five cards each. The K♥ is turned up on the kitty.',
      },
      tip: 'The deal moves one seat to the left after every hand, so everyone gets a turn as dealer.',
    },
    {
      title: 'Playing a trick',
      body: 'The player to the dealer’s left [[leads|lead]] the first card. Going clockwise, everyone must [[follow suit]] — play the same suit — if they can. If you can’t, play any card. The highest card of the suit led wins — Ace is highest, then King, Queen, Jack, 10 and 9 — unless someone played a trump. The winner takes the [[trick]] and leads the next one.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick',
            cards: ['QS', 'AS', '9S', 'KS'],
            layout: 'row',
            highlight: [1],
          },
          {
            id: 'hand',
            label: 'Your hand (after playing the K♠)',
            cards: ['JH', 'TD', '9C', 'AH'],
            layout: 'fan',
          },
        ],
        caption:
          'Left opponent Q♠ · Partner A♠ · Right opponent 9♠ · You K♠. Everyone followed suit, so the A♠ wins.',
      },
    },
    {
      title: 'Trump and the two Bowers',
      body: 'Once a suit is [[trump]], every trump beats every card of the other suits. The two best trumps are Jacks. The [[right bower]] is the Jack of the trump suit. The [[left bower]] is the other Jack of the same colour. So with hearts as trump the order is: J♥, J♦, A♥, K♥, Q♥, 10♥, 9♥.',
      scene: {
        zones: [
          {
            id: 'trumps',
            label: 'Trumps when hearts are trump (best → worst)',
            cards: ['JH', 'JD', 'AH', 'KH', 'QH', 'TH', '9H'],
            layout: 'row',
            highlight: [0, 1],
          },
        ],
        caption: 'Seven trumps in all: the six hearts plus the J♦.',
      },
      tip: 'Say it out loud a few times: “Right Bower, Left Bower, Ace, King…” It sticks fast!',
    },
    {
      title: 'The Left Bower changes suit',
      body: 'Here is Euchre’s famous trap. With hearts as trump, the J♦ is a heart for the whole deal — not a diamond. So if diamonds are led and your only “diamond” is the J♦, you are really [[void]] in diamonds: you may trump or play anything. And if hearts are led, the J♦ counts as a heart, so you must play it if it is your only heart.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick: diamonds led',
            cards: ['AD'],
            layout: 'row',
          },
          {
            id: 'hand',
            label: 'Your hand (hearts are trump)',
            cards: ['JD', 'QS', '9C', 'KC', 'TH'],
            layout: 'fan',
            highlight: [0],
          },
        ],
        caption:
          'Your J♦ is a heart this deal, so you have no diamonds. You may trump with the J♦ or 10♥ — or throw any card.',
      },
    },
    {
      title: 'Choosing trump: round one',
      body: 'Look at the turned-up card. Starting left of the dealer, each player either passes or [[orders it up|order up]] — that makes the turned-up suit trump. The dealer then adds that card to their hand and throws one card away face down. (When the dealer accepts, it’s called “picking it up”.) The team that chose trump are the [[makers]].',
      scene: {
        zones: [
          {
            id: 'kitty',
            label: 'Kitty (top card turned up)',
            cards: ['QC', '9S'],
            layout: 'stack',
            faceDown: [0],
            highlight: [1],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['JC', 'AS', 'KS', '9H', 'TD'],
            layout: 'fan',
            highlight: [0, 1, 2],
          },
        ],
        caption:
          'Spades are turned up. With the J♣ (the Left Bower for spades), A♠ and K♠, ordering it up is a strong call.',
      },
      tip: 'If the dealer is on the other team, ordering up hands them an extra trump. If the dealer is your partner, it’s a gift to your team!',
    },
    {
      title: 'Choosing trump: round two',
      body: 'If all four players pass, the dealer turns the card face down. Now, going around once more, each player may name any other suit as [[trump]], or pass. You may not choose the suit that was just turned down. If everyone passes again, the cards are thrown in and the next player deals.',
      scene: {
        zones: [
          {
            id: 'kitty',
            label: 'Kitty (turned down)',
            cards: ['QC', '9S'],
            layout: 'stack',
            faceDown: [0, 1],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['JD', 'AH', 'KH', 'TH', 'AC'],
            layout: 'fan',
            highlight: [0, 1, 2, 3],
          },
        ],
        caption:
          'Spades were turned down, so you can’t pick spades now. Hearts, with the J♦ as Left Bower, look great!',
      },
    },
    {
      title: 'Scoring points',
      body: 'If the [[makers]] win 3 or 4 tricks, they score 1 point. If they win all 5 — a [[march]] — they score 2. If they win fewer than 3, they are [[euchred|euchre]] and the other team scores 2 points. A player with a great hand may [[go alone|going alone]]: their partner sits out, and winning all 5 tricks alone scores 4 points (3 or 4 tricks alone still score 1). First team to 10 points wins.',
      scene: {
        zones: [
          {
            id: 'makers',
            label: 'Makers: 3 tricks',
            cards: ['JH', 'AS', 'KC'],
            layout: 'row',
            highlight: [0, 1, 2],
          },
          {
            id: 'defenders',
            label: 'Defenders: 2 tricks',
            cards: ['AD', 'QH'],
            layout: 'row',
          },
        ],
        caption:
          '3 tricks for the makers = 1 point. All 5 = 2 points. Fewer than 3 = 2 points for the defenders.',
      },
    },
    {
      title: 'A tiny example',
      body: 'Hearts are [[trump]]. Your left opponent [[leads|lead]] the A♣ and your partner follows with the K♣. Your right opponent has no clubs, so they play the 9♥ — the lowest trump of all. Your only club is the 9♣, so you must play it. The little 9♥ wins the [[trick]], because any trump beats any card of another suit.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick (hearts are trump)',
            cards: ['AC', 'KC', '9H', '9C'],
            layout: 'row',
            highlight: [2],
          },
        ],
        caption: 'Left opponent A♣ · Partner K♣ · Right opponent 9♥ (trump!) · You 9♣.',
      },
    },
    {
      title: 'Beginner strategy',
      body: 'Choose trump when you hold three or more trumps, especially with a Bower. When your team are the [[makers]], lead trumps early to pull out the opponents’ trumps. Don’t trump a trick your partner is sure to win. And count trumps: there are only seven, so you can know when they are all gone.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'A dream hand for hearts',
            cards: ['JH', 'JD', 'AH', 'AS', 'KC'],
            layout: 'fan',
            highlight: [0, 1, 2],
          },
        ],
        caption: 'Both Bowers plus the A♥: the three best trumps. Call hearts with confidence!',
      },
      tip: 'Holding both Bowers? Lead one — anyone who still has a trump must play it.',
    },
  ],
  mistakes: [
    'Treating the Left Bower as its printed suit. With hearts as trump, the J♦ is a heart for the whole deal — it can’t follow a diamond lead, and it must follow a heart lead.',
    'Trumping a trick your partner is already sure to win, which wastes a trump your team needs later.',
    'Ordering up the turned card with a weak hand when the dealer is an opponent — you’ve just handed them an extra trump.',
    'Forgetting, as dealer, to throw away one card after picking up. You must always play with exactly five cards.',
    'Cashing side-suit Aces before pulling trumps when your team chose trump, so an opponent trumps them.',
    'Trying to name the turned-down suit in round two. Once it’s turned down, that suit is off the menu.',
  ],
  tips: [
    'Tip: There are only seven trumps in Euchre. Count them as they fall and you’ll know when your Aces are safe.',
    'Tip: When your partner is the dealer and a Jack is turned up, ordering it up puts a Bower straight into your team’s hands.',
    'Tip: As dealer, throw away a lone low card from a side suit to make yourself void — then you can trump that suit.',
    'Tip: If your team chose trump, leading trumps early pulls out the opponents’ trumps and protects your Aces.',
    'Tip: Partner’s card is winning and you play last? Throw your least useful card instead of trumping.',
    'Tip: A popular rule of thumb is to call trump with three or more trumps, especially with a Bower and an off-suit Ace.',
    'Tip: On defence, leading an off-suit Ace early is a solid start — it may win before anyone runs out of that suit.',
  ],
  quiz: [
    {
      question: 'Hearts are trump. Which card is the highest in the game?',
      options: ['A♥', 'J♦', 'J♥', 'K♥'],
      answer: 2,
      explanation:
        'The Jack of the trump suit — the Right Bower — beats everything. The J♦ (Left Bower) is second, then the A♥.',
    },
    {
      question:
        'Hearts are trump and diamonds are led. Your only red Jack is the J♦, and you have no other diamonds. What is true?',
      options: [
        'You must play the J♦ to follow suit',
        'The J♦ is a heart now, so you have no diamonds — you may trump or play any card',
        'The J♦ is out of play for this deal',
      ],
      answer: 1,
      explanation:
        'The Left Bower belongs to the trump suit for the whole deal. With no real diamonds you are void, so you may trump (even with the J♦) or throw anything.',
    },
    {
      question: 'In round one, a player orders up the turned-up card. Who gets that card?',
      options: ['The dealer', 'The player who ordered it up', 'Nobody — it stays in the kitty'],
      answer: 0,
      explanation:
        'The dealer always picks up the turned-up card and throws one card away face down, no matter who ordered it up.',
    },
    {
      question: 'Your team chose trump but won only 2 tricks. What happens?',
      options: [
        'Your team scores 1 point',
        'Nobody scores',
        'Your team scores 2 points',
        'The other team scores 2 points',
      ],
      answer: 3,
      explanation:
        'The makers need at least 3 tricks. With fewer they are euchred, and the defenders score 2 points.',
    },
    {
      question:
        'Your partner’s Ace is winning the trick, you are last to play, and you have no cards of that suit. What is the best play?',
      options: [
        'Trump it, just to be safe',
        'Play your highest trump',
        'Throw away your least useful card',
      ],
      answer: 2,
      explanation:
        'Nothing can beat partner’s Ace after you, so the trick is already your team’s. Save your trumps for tricks you actually need.',
    },
  ],
  example: {
    intro:
      'You are the dealer, sitting across from your partner. Let’s play one full deal together — you make the big calls, and each choice plays out on the table.',
    steps: [
      {
        narration:
          'You deal five cards to everyone and turn up the top card of the [[kitty]]: the J♥! If hearts become [[trump]], that card is the [[right bower]] — the best card in the game — and the J♦ in your hand becomes the [[left bower]].',
        scene: {
          zones: [
            {
              id: 'kitty',
              label: 'Kitty (top card turned up)',
              cards: ['QS', 'JH'],
              layout: 'stack',
              faceDown: [0],
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JD', 'AH', 'AC', '9C', '9D'],
              layout: 'fan',
              highlight: [0, 1],
            },
          ],
          caption: 'The J♥ is turned up, and you hold the J♦ and A♥. Hearts look exciting!',
        },
      },
      {
        narration:
          'Round one of choosing trump. Your left opponent passes, your partner passes, and your right opponent passes. As dealer, you speak last. If you pick it up, hearts are trump and the J♥ joins your hand. If you turn it down, hearts can’t be trump this deal.',
        scene: {
          zones: [
            {
              id: 'kitty',
              label: 'Kitty (top card turned up)',
              cards: ['QS', 'JH'],
              layout: 'stack',
              faceDown: [0],
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JD', 'AH', 'AC', '9C', '9D'],
              layout: 'fan',
              highlight: [0, 1],
            },
          ],
          caption: 'Pass, pass, pass… your call, dealer.',
        },
        decision: {
          prompt: 'Do you pick up the J♥ and make hearts trump?',
          options: [
            {
              label: 'Pick it up — hearts are trump!',
              card: 'JH',
              correct: true,
              feedback:
                'Yes! With the J♥ you’ll hold the three best trumps in the game — J♥, J♦ and A♥ — plus the A♣. That’s a monster hand.',
            },
            {
              label: 'Turn it down',
              correct: false,
              feedback:
                'Too shy! You’d be turning down the best card in the game, and your J♦ is only a Bower if hearts are trump. Once turned down, hearts are off the menu.',
            },
          ],
          proHint:
            'A pro picks this up instantly. Three top trumps plus an off-suit Ace is about as good as it gets — some would even think about going alone.',
        },
      },
      {
        narration:
          'You pick up the J♥. Hearts are trump, and your team are the [[makers]]: you need 3 of the 5 tricks. You now hold six cards, so one must go face down under the kitty.',
        scene: {
          zones: [
            {
              id: 'kitty',
              label: 'Kitty',
              cards: ['QS'],
              layout: 'stack',
              faceDown: [0],
            },
            {
              id: 'hand',
              label: 'Your hand (6 cards)',
              cards: ['JH', 'JD', 'AH', 'AC', '9C', '9D'],
              layout: 'fan',
              highlight: [0, 1, 2],
            },
          ],
          caption: 'Six cards. Which one goes?',
        },
        decision: {
          prompt: 'Which card do you throw away?',
          options: [
            {
              label: 'The 9♦',
              card: '9D',
              correct: true,
              feedback:
                'Perfect. Remember, the J♦ is a heart now — so dropping the 9♦ leaves you with no diamonds at all. If diamonds are led, you can trump.',
            },
            {
              label: 'The 9♣',
              card: '9C',
              correct: false,
              feedback:
                'Not terrible, but it doesn’t empty a suit: you’d still hold the A♣ and the 9♦. Throwing the 9♦ makes you void in diamonds instead.',
            },
            {
              label: 'The J♦',
              card: 'JD',
              correct: false,
              feedback:
                'Careful! The J♦ is the Left Bower — your second-best trump. Never throw it away.',
            },
            {
              label: 'The A♣',
              card: 'AC',
              correct: false,
              feedback: 'An Ace is a likely trick-winner. Throw away a low card instead.',
            },
          ],
          proHint:
            'Pros discard to create a void — a suit they have none of — so they can trump it later.',
        },
      },
      {
        narration:
          'The 9♦ goes face down, so you are now [[void]] in diamonds. Your left opponent [[leads|lead]] the first trick with the K♠. Your partner plays the A♠, and your right opponent follows with the 9♠. You have no spades…',
        scene: {
          zones: [
            {
              id: 'trick',
              label: 'Trick 1',
              cards: ['KS', 'AS', '9S'],
              layout: 'row',
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JH', 'JD', 'AH', 'AC', '9C'],
              layout: 'fan',
            },
          ],
          caption: 'Left opponent K♠ · Partner A♠ · Right opponent 9♠ · You: ?',
        },
        decision: {
          prompt: 'Your partner’s A♠ is winning and you play last. What do you play?',
          options: [
            {
              label: 'Trump with the J♥',
              card: 'JH',
              correct: false,
              feedback:
                'It wins — but your partner already had this trick! You’d waste the best card in the game.',
            },
            {
              label: 'Trump with the A♥',
              card: 'AH',
              correct: false,
              feedback:
                'Still a wasted trump. Nobody plays after you, so partner’s A♠ was already the winner.',
            },
            {
              label: 'Throw away the 9♣',
              card: '9C',
              correct: true,
              feedback:
                'Exactly. Partner’s Ace is winning and nobody plays after you, so the trick is safe. Keep your trumps for later.',
            },
          ],
          proHint:
            'Never trump your partner’s winning trick when you play last. Throw your least useful card.',
        },
      },
      {
        narration:
          'You throw the 9♣ and partner’s A♠ wins trick 1. Partner now leads the 10♦, and your right opponent pounces with the A♦. It’s your turn — and here comes Euchre’s famous trap. Do you have a diamond?',
        scene: {
          zones: [
            {
              id: 'trick',
              label: 'Trick 2',
              cards: ['TD', 'AD'],
              layout: 'row',
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JH', 'JD', 'AH', 'AC'],
              layout: 'fan',
              highlight: [1],
            },
          ],
          caption: 'Your team 1 trick · Opponents 0. Partner 10♦ · Right opponent A♦ · You: ?',
        },
        decision: {
          prompt: 'The A♦ is winning. What do you play?',
          options: [
            {
              label: 'The J♦ — I must follow suit',
              card: 'JD',
              correct: false,
              feedback:
                'That’s the trap! With hearts as trump, the J♦ is a heart, not a diamond. You have no diamonds, so you don’t have to play it. (It would win, but you’d spend your second-best trump.)',
            },
            {
              label: 'Trump with the A♥',
              card: 'AH',
              correct: true,
              feedback:
                'Yes! You have no diamonds, so you may trump. Only the two Bowers can beat your A♥ — and you hold both of them.',
            },
            {
              label: 'Throw away the A♣',
              card: 'AC',
              correct: false,
              feedback:
                'Then the opponents’ A♦ wins the trick. You’re allowed to trump it — so do!',
            },
          ],
          proHint:
            'Pros treat the Left Bower as a trump the moment trump is named. Here they trump with the cheapest card that is sure to win: the A♥.',
        },
      },
      {
        narration:
          'Your A♥ trumps their Ace, and your left opponent follows with the Q♦. Trick 2 is yours — 2 tricks to 0. Now you lead.',
        scene: {
          zones: [
            {
              id: 'trick',
              label: 'Trick 2',
              cards: ['TD', 'AD', 'AH', 'QD'],
              layout: 'row',
              highlight: [2],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JH', 'JD', 'AC'],
              layout: 'fan',
            },
          ],
          caption: 'Partner 10♦ · Right opponent A♦ · You A♥ (trump) · Left opponent Q♦.',
        },
        decision: {
          prompt: 'You hold J♥, J♦ and A♣. What do you lead?',
          options: [
            {
              label: 'The J♥ (Right Bower)',
              card: 'JH',
              correct: true,
              feedback:
                'Great. Nobody can beat it, and anyone who still has a trump must play one — which protects your A♣ later.',
            },
            {
              label: 'The A♣',
              card: 'AC',
              correct: false,
              feedback:
                'Risky. If an opponent has no clubs but still holds a trump, they’ll trump your Ace.',
            },
            {
              label: 'The J♦ (Left Bower)',
              card: 'JD',
              correct: true,
              feedback:
                'Also fine — you hold the J♥, so nobody can beat your J♦ either. Leading from the very top is just the simplest habit.',
            },
          ],
          proHint:
            'As the makers, pull the opponents’ trumps first, then cash your side Aces when nobody can trump them.',
        },
      },
      {
        narration:
          'You lead the J♥. Everyone who has a trump must [[follow suit]] with one: left opponent 9♥, partner 10♥, right opponent Q♥. Your Bower wins — 3 tricks, so you’ve made it! Now count trumps. There are seven, and you’ve seen six: J♥, J♦, A♥, Q♥, 10♥ and 9♥. Only the K♥ is still hiding.',
        scene: {
          zones: [
            {
              id: 'trick',
              label: 'Trick 3',
              cards: ['JH', '9H', 'TH', 'QH'],
              layout: 'row',
              highlight: [0],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JD', 'AC'],
              layout: 'fan',
            },
          ],
          caption: 'Your team 3 tricks · Opponents 0 — you’ve scored at least 1 point!',
        },
        decision: {
          prompt: 'One trump (the K♥) is still out there. What do you lead now?',
          options: [
            {
              label: 'The J♦ — pull the last trump',
              card: 'JD',
              correct: true,
              feedback:
                'Smart. The J♦ beats the K♥, so it wins and drags out the last trump. After that, your A♣ is safe.',
            },
            {
              label: 'The A♣',
              card: 'AC',
              correct: false,
              feedback:
                'Risky! If the player holding the K♥ has no clubs, they’ll trump your Ace and spoil your chance of all five tricks.',
            },
          ],
          proHint:
            'Counting the seven trumps is a pro habit. When you know exactly how many are left, you know when your Aces are safe.',
        },
      },
      {
        narration:
          'Your J♦ forces out the last trump: your left opponent has to play the K♥. Partner throws the 10♠, and your right opponent throws the J♠ — that Jack is not a trump, because only the J♦ is the Left Bower when hearts are trump. 4 tricks!',
        scene: {
          zones: [
            {
              id: 'trick',
              label: 'Trick 4',
              cards: ['JD', 'KH', 'TS', 'JS'],
              layout: 'row',
              highlight: [0],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['AC'],
              layout: 'fan',
            },
          ],
          caption: 'You J♦ · Left opponent K♥ · Partner 10♠ · Right opponent J♠.',
        },
      },
      {
        narration:
          'No trumps are left, so your A♣ can’t be beaten: left opponent J♣, partner K♣, right opponent 10♣. That’s all 5 tricks — a [[march]]! Your team scores 2 points.',
        scene: {
          zones: [
            {
              id: 'trick',
              label: 'Trick 5',
              cards: ['AC', 'JC', 'KC', 'TC'],
              layout: 'row',
              highlight: [0],
            },
          ],
          caption: 'Your team 5 tricks · Opponents 0. A march: 2 points!',
        },
      },
    ],
    outro:
      'A march on your first deal — brilliant! You picked up the Right Bower, made a void, saved your trumps, dodged the Left Bower trap and counted every trump. In a real game you’d keep dealing (one seat to the left each time) until a team reaches 10 points. Ready to test yourself? Try the quiz!',
  },
  seo: {
    description:
      'Learn Euchre the friendly way: the 24-card deck, the Right and Left Bowers, ordering up trump and scoring — plus a clickable example hand.',
  },
});
