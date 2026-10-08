import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'durak',
  name: 'Durak',
  aka: ['Podkidnoy Durak', 'The Fool'],
  origin: { country: 'Russia', countryCode: 'RU', region: 'europe' },
  type: 'shedding',
  players: { min: 2, max: 6, ideal: 4 },
  deck: '36 cards: the 6 up to the Ace in each suit (a standard deck with the 2s to 5s taken out)',
  difficulty: 2,
  length: '10–20 minutes a game',
  minutes: 15,
  moods: ['social', 'competitive'],
  hook: 'Russia’s favourite card game: nobody wins — one unlucky player is left holding cards as the fool',
  history:
    'Durak means “fool” in Russian, and that is the whole idea: there is no winner, only one loser — the last player still holding cards. The game is thought to have spread across Russia during the 1800s, and today it is widely called the most popular card game in Russia and in many countries of the former Soviet Union, played everywhere from kitchen tables to long train journeys.',
  featured: false,
  order: 200,
  variantTaught:
    'Podkidnoy (“throw-in”) Durak, the most popular form, taught for two players: a 36-card deck (6 to Ace), six cards each, a face-up trump card under the stock, and the player with the lowest trump attacks first. The defender must beat every attack card or pick them all up. After each card is beaten the attacker may throw in more cards of any rank already on the table — up to six attack cards in a bout, and never more than the defender holds. Everyone draws back up to six (attacker first), and once the stock is empty, players who run out of cards are safe. The last player holding cards is the durak.',
  variants:
    'With three to six players, you attack the player on your left, and the other players may also throw in cards (some tables allow only the defender’s neighbours to do it). In Perevodnoy (“passing”) Durak, a defender who holds a card of the same rank as the attack can add it and pass the whole attack on to the next player — a favourite twist in Russia. Simple Durak, the plainer version, is usually played without throw-ins: each bout is a single attack card. Tables also differ on the small print: some limit the very first attack of a game to five cards, some allow attacking with a pair or more of the same rank at once, and many play several games in a row, with tables differing on who starts the next one (often the newest durak deals).',
  glossary: [
    {
      term: 'durak',
      definition:
        'Russian for “fool”. The last player still holding cards when the stock has run out is the durak — the only loser of the game.',
    },
    {
      term: 'trump',
      definition:
        'The suit of the card turned face up under the stock. Any trump beats any card of another suit: if hearts are trump, the 6♥ beats the A♠.',
    },
    {
      term: 'stock',
      definition:
        'The face-down pile of cards left after the deal. Players draw from it to get back up to six cards, e.g. after playing two cards you draw two.',
    },
    {
      term: 'attacker',
      definition:
        'The player who plays a card at the defender to start a bout, e.g. leading the 7♠. The attacker may then throw in more cards.',
    },
    {
      term: 'defender',
      definition:
        'The player being attacked. They must beat every attack card — or pick up all the cards on the table.',
    },
    {
      term: 'beat',
      definition:
        'To cover an attack card with a higher card of the same suit, or with any trump. The Q♠ beats the 9♠; with hearts as trump, the 6♥ also beats it.',
    },
    {
      term: 'throw in',
      definition:
        'To add another attack card of a rank that is already on the table. If the 7♠ and J♠ are on the table, the attacker may throw in any 7 or any Jack.',
    },
    {
      term: 'pick up',
      definition:
        'What the defender does if they can’t (or don’t want to) beat a card: they take every card on the table into their hand, and they don’t get to attack next.',
    },
    {
      term: 'bout',
      definition:
        'One attack from start to finish: the first attack card, any cards thrown in, and the defence. A bout ends with “beaten!” or with the defender picking up.',
    },
    {
      term: 'discard pile',
      definition:
        'Where the cards go, face down, when the defender beats every attack card. They are out of the game for good.',
    },
  ],
  lesson: [
    {
      title: 'The goal: don’t be the fool!',
      body: 'Durak has no winner — only a loser. You try to get rid of all your cards. When the cards to draw have run out, anyone with an empty hand is safe. The last player still holding cards is the [[durak]], the fool. So the game is really a race not to be last!',
      scene: {
        zones: [
          {
            id: 'opp',
            label: 'Opponent',
            cards: ['8D', 'QH', '6C', 'JS', '9H', 'KD'],
            layout: 'fan',
            faceDown: [0, 1, 2, 3, 4, 5],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['6D', '9S', 'TC', 'JH', 'KC', 'AS'],
            layout: 'fan',
          },
        ],
        caption: 'Six cards each. Empty your hand before your opponent does!',
      },
    },
    {
      title: 'The deck, the deal and the trump card',
      body: 'Durak uses 36 cards: the 6 up to the Ace in every suit. Each player gets six cards. The next card is turned face up and slid under the [[stock]], so everyone can see it. Its suit is [[trump]] for the whole game — and that card will be the very last one drawn.',
      scene: {
        zones: [
          {
            id: 'stock',
            label: 'Stock (trump card underneath)',
            cards: ['KH', '7S'],
            layout: 'stack',
            faceDown: [0],
            highlight: [1],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['8C', '9D', 'JD', 'QH', 'AC', 'TS'],
            layout: 'fan',
            highlight: [5],
          },
        ],
        caption: 'The 7♠ is turned up, so spades are trump. Your 10♠ is a trump!',
      },
      tip: 'Only have a 52-card deck? Take out the 2s, 3s, 4s and 5s and you are ready to play.',
    },
    {
      title: 'Which cards are strongest',
      body: 'In each suit the 6 is lowest and the Ace is highest. But a [[trump]] beats any card of another suit — even the lowest trump beats an Ace. A trump can only be beaten by a higher trump.',
      scene: {
        zones: [
          {
            id: 'order',
            label: 'Lowest → highest',
            cards: ['6H', '7H', '8H', '9H', 'TH', 'JH', 'QH', 'KH', 'AH'],
            layout: 'row',
          },
          {
            id: 'trump',
            label: 'Spades are trump',
            cards: ['AD', '6S'],
            layout: 'row',
            highlight: [1],
          },
        ],
        caption: 'The little 6♠ beats the A♦, because spades are trump.',
      },
    },
    {
      title: 'A turn: attack and defend',
      body: 'On the first deal, the player with the lowest trump is the first [[attacker]]. They put any card face up in front of the [[defender]]. The defender must [[beat]] it: cover it with a higher card of the same suit, or with any trump. A trump attack can only be beaten by a higher trump.',
      scene: {
        zones: [
          {
            id: 'same',
            label: 'Higher card, same suit',
            cards: ['9D', 'QD'],
            layout: 'row',
            highlight: [1],
          },
          {
            id: 'trump',
            label: 'Or any trump',
            cards: ['AC', '8S'],
            layout: 'row',
            highlight: [1],
          },
          {
            id: 'trumpAttack',
            label: 'Trump attacked? Higher trump only',
            cards: ['JS', 'KS'],
            layout: 'row',
            highlight: [1],
          },
        ],
        caption: 'Spades are trump. Each pair shows the attack card and the card that beats it.',
      },
      tip: 'You don’t have to beat a card just because you can. Sometimes taking the cards instead is the smart move — you’ll see how in a moment.',
    },
    {
      title: 'Throwing in more cards',
      body: 'This is the “podkidnoy” in Podkidnoy Durak. After the defender beats a card, the attacker may [[throw in]] another one — but only a card whose rank is already on the table (the defender’s cards count too). The defender must beat that one as well, or pick up. A [[bout]] can have at most six attack cards, and never more cards than the defender is holding.',
      scene: {
        zones: [
          {
            id: 'table',
            label: 'Table',
            cards: ['9D', 'QD'],
            layout: 'row',
          },
          {
            id: 'hand',
            label: 'Attacker’s hand',
            cards: ['9C', 'QH', 'KH', '6C', '8S'],
            layout: 'fan',
            highlight: [0, 1],
          },
        ],
        caption:
          'The 9♦ was beaten by the Q♦. A 9 and a Queen are now on the table, so the attacker may throw in the 9♣ or the Q♥. Not the K♥: no King is there yet.',
      },
    },
    {
      title: 'Can’t beat it? Pick it all up',
      body: 'If the defender can’t beat a card (or doesn’t want to), they must [[pick up]] every card on the table — attack cards and defence cards. Before they do, the attacker may throw in a few more cards of matching ranks for them to take. Ouch! The defender also misses their turn to attack: the attacker goes again.',
      scene: {
        zones: [
          {
            id: 'table',
            label: 'Table',
            cards: ['8H', 'JH', '8C'],
            layout: 'row',
            highlight: [2],
          },
          {
            id: 'hand',
            label: 'Defender’s hand',
            cards: ['7C', '6D', '9H', 'TD'],
            layout: 'fan',
          },
        ],
        caption:
          'Spades are trump. The 8♥ was beaten, then the 8♣ was thrown in. No club higher than the 8♣ and no trump — the defender must pick up all three cards.',
      },
    },
    {
      title: 'All beaten? Swap roles',
      body: 'If the defender beats every attack card and the attacker has nothing more to throw in (or chooses not to), the bout is over: “Beaten!” All those cards go face down on the [[discard pile]], out of the game. Now the defender becomes the attacker for the next bout.',
      scene: {
        zones: [
          {
            id: 'table',
            label: 'Table: every attack is covered',
            cards: ['7C', 'TC', '7H', 'QH'],
            layout: 'row',
            highlight: [1, 3],
          },
          {
            id: 'discard',
            label: 'Discard pile',
            cards: ['8C', 'JD', '6H'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
        ],
        caption:
          'The 10♣ beat the 7♣ and the Q♥ beat the 7♥. Beaten! Into the discard pile they go.',
      },
    },
    {
      title: 'Draw back up to six',
      body: 'After every bout, anyone with fewer than six cards draws from the [[stock]] until they have six again. The [[attacker]] draws first and the [[defender]] draws last. The face-up trump is the very last card to be drawn. Once the stock is empty, nobody draws any more.',
      scene: {
        zones: [
          {
            id: 'stock',
            label: 'Stock',
            cards: ['9C', 'KD', '7S'],
            layout: 'stack',
            faceDown: [0, 1],
            highlight: [2],
          },
          {
            id: 'hand',
            label: 'Attacker: 4 cards + 2 drawn',
            cards: ['8D', 'JC', 'AH', 'QS', '6D', 'TS'],
            layout: 'fan',
            highlight: [4, 5],
          },
        ],
        caption: 'The attacker had four cards, so they draw two. Then the defender fills up.',
      },
      tip: 'Near the end, watch who will draw the face-up trump. It’s a guaranteed trump for someone!',
    },
    {
      title: 'How it ends: a tiny example',
      body: 'The stock is empty and you have one card left, the 10♣. You attack with it, and your opponent [[beats|beat]] it with the Q♣. Beaten! But you have no cards left and nothing to draw, so you are out — safe. Your opponent still holds two cards, so they are the [[durak]]. (If the last two players run out at the same moment, it’s usually called a draw.)',
      scene: {
        zones: [
          {
            id: 'table',
            label: 'Your last attack',
            cards: ['TC', 'QC'],
            layout: 'row',
            highlight: [0],
          },
          {
            id: 'opp',
            label: 'Opponent — the durak!',
            cards: ['6D', '9H'],
            layout: 'fan',
          },
        ],
        caption: 'Your hand is empty and the stock is gone: you’re safe. They’re the fool!',
      },
    },
    {
      title: 'Beginner strategy',
      body: 'Attack with your low cards that are not [[trump]] — get rid of the weak stuff early. Keep your trumps for defending, because they beat anything. When you defend, use the cheapest card that does the job. And watch which ranks are on the table: holding two cards of the same rank lets you [[throw in]] the second one.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand (spades are trump)',
            cards: ['6C', '7D', '7H', 'JH', 'QS', 'AS'],
            layout: 'fan',
            highlight: [0, 1, 2],
          },
        ],
        caption:
          'Attack with the 6♣ or a 7 (you can throw in the other 7!). Save the Q♠ and A♠ for defence.',
      },
      tip: 'Picking up a few low cards early in the game is not a disaster — there is lots of time to get rid of them.',
    },
  ],
  mistakes: [
    'Spending a trump on an easy attack. If a higher card of the same suit can beat it, use that and save your trumps.',
    'Throwing in a card whose rank isn’t on the table yet. You may only add ranks that are already there.',
    'Trying to beat a trump with a high card of another suit. A trump attack can only be beaten by a higher trump.',
    'Opening with an Ace or King. High cards are your best defenders — attack with low ones first.',
    'Forgetting to draw back up to six after a bout, or drawing in the wrong order (the attacker draws first, the defender last).',
    'Attacking with more cards than the defender holds, or more than six in one bout.',
  ],
  tips: [
    'Tip: In Durak, attack with your lowest non-trump cards first and keep your trumps for defence.',
    'Tip: Hold two cards of the same rank? Attack with one — if it’s beaten, throw in its twin.',
    'Tip: Defend with the cheapest card that works. Beating a 9♣ with the 10♣ is better than using your best trump.',
    'Tip: Watch the ranks on the table. Every rank your opponent uses to defend is a rank you can throw in.',
    'Tip: Picking up a couple of low cards early isn’t the end of the world — there is plenty of time to get rid of them.',
    'Tip: Count the trumps as they fall. There are only nine, and knowing who still has them wins endgames.',
    'Tip: In the endgame, a pair is gold: attacking with one and throwing in the other can empty your hand in a single bout.',
  ],
  quiz: [
    {
      question: 'Hearts are trump. Your opponent attacks with the A♠. Which card can beat it?',
      options: ['K♠', '6♥', 'A♦', 'Q♠'],
      answer: 1,
      explanation:
        'Nothing in spades is higher than the Ace, so only a trump can beat it — and even the lowest trump, the 6♥, does the job. The A♦ is a different suit and not trump.',
    },
    {
      question:
        'On the table, the 8♣ has been beaten by the J♣. Which card may the attacker throw in?',
      options: ['9♣', 'Q♦', 'J♥', '7♣'],
      answer: 2,
      explanation:
        'You may only throw in a rank that is already on the table — here, 8s and Jacks. The J♥ is allowed; the suit doesn’t matter.',
    },
    {
      question: 'The defender can’t beat one of the attack cards. What happens?',
      options: [
        'The cards go to the discard pile and the defender attacks next',
        'The defender picks up every card on the table and doesn’t get to attack next',
        'The attacker takes back the card that couldn’t be beaten',
      ],
      answer: 1,
      explanation:
        'A defender who can’t beat a card must pick up all the cards on the table — attacks and defences — and the next attack skips them.',
    },
    {
      question: 'The stock is empty. Who is the durak?',
      options: [
        'The first player to run out of cards',
        'The player who drew the face-up trump',
        'The player with the fewest trumps',
        'The last player still holding cards',
      ],
      answer: 3,
      explanation:
        'Players who run out of cards (once the stock is gone) are safe. The last one still holding cards is the durak — the fool.',
    },
    {
      question:
        'Early in the game, spades are trump. You are attacked with the 7♦ and you hold the 9♦, A♦ and 6♠. What is the best defence?',
      options: ['Beat it with the 9♦', 'Beat it with the A♦', 'Beat it with the 6♠', 'Pick up'],
      answer: 0,
      explanation:
        'Use the cheapest card that works. The 9♦ beats the 7♦ and keeps your A♦ and your trump for harder attacks later.',
    },
  ],
  example: {
    intro:
      'A two-player game of Podkidnoy Durak. You make the big calls — how to attack, when to throw in and how to defend — and see how each choice plays out on the table.',
    steps: [
      {
        narration:
          'Six cards each, and the next card, the 9♥, is turned face up under the [[stock]]: hearts are [[trump]]. You hold the 6♥ — the lowest trump in the whole deck — so you are the first [[attacker]]. Your opponent is the [[defender]].',
        scene: {
          zones: [
            {
              id: 'opp',
              label: 'Opponent',
              cards: ['JS', '9D', '9C', 'QS', 'QD', '8H'],
              layout: 'fan',
              faceDown: [0, 1, 2, 3, 4, 5],
            },
            {
              id: 'stock',
              label: 'Stock (trump underneath)',
              cards: ['TD', '9H'],
              layout: 'stack',
              faceDown: [0],
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['6H', '7S', '7D', '8C', 'TC', 'KS'],
              layout: 'fan',
              highlight: [0],
            },
          ],
          caption: 'Hearts are trump. Your 6♥ is the lowest trump, so you attack first.',
        },
        decision: {
          prompt: 'Which card do you attack with?',
          options: [
            {
              label: 'The 7♠',
              card: '7S',
              correct: true,
              feedback:
                'Great start! A low card that isn’t a trump — and you also hold the 7♦, so if it gets beaten you can throw in its twin. (The 7♦ would be just as good.)',
            },
            {
              label: 'The 6♥',
              card: '6H',
              correct: false,
              feedback:
                'It looks small, but it’s a trump — it beats any Ace of another suit! Trumps are your shields, so don’t waste one on an opening attack.',
            },
            {
              label: 'The K♠',
              card: 'KS',
              correct: false,
              feedback:
                'Kings are brilliant defenders, so keep it for when you are attacked. Get rid of your low cards first.',
            },
          ],
          proHint:
            'A pro opens with their lowest non-trump card, ideally one they hold a pair of, so they can throw in the second one.',
        },
      },
      {
        narration:
          'You attack with the 7♠. Your opponent [[beats|beat]] it with the J♠ — a higher spade. Now a 7 and a Jack are on the table, so you may [[throw in]] another 7 or another Jack.',
        scene: {
          zones: [
            {
              id: 'opp',
              label: 'Opponent',
              cards: ['9D', '9C', 'QS', 'QD', '8H'],
              layout: 'fan',
              faceDown: [0, 1, 2, 3, 4],
            },
            {
              id: 'table',
              label: 'Table',
              cards: ['7S', 'JS'],
              layout: 'row',
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['6H', '7D', '8C', 'TC', 'KS'],
              layout: 'fan',
              highlight: [1],
            },
          ],
          caption: 'Your 7♠ is beaten by the J♠. Ranks on the table: 7 and Jack.',
        },
        decision: {
          prompt: 'Do you throw in another card?',
          options: [
            {
              label: 'Throw in the 7♦',
              card: '7D',
              correct: true,
              feedback:
                'Yes! A 7 is already on the table, so the 7♦ is allowed. It’s a weak card you are happy to lose, and your opponent has to spend another card to beat it.',
            },
            {
              label: 'Throw in the K♠',
              card: 'KS',
              correct: false,
              feedback:
                'Not allowed — there is no King on the table. You may only throw in ranks that are already there: a 7 or a Jack.',
            },
            {
              label: 'Stop and say “Beaten!”',
              correct: false,
              feedback:
                'Legal, but you’d miss a free chance to dump a weak card. In Podkidnoy, throwing in your low matches keeps the pressure on.',
            },
          ],
          proHint:
            'Pros keep track of every rank on the table and throw in their low, non-trump matches.',
        },
      },
      {
        narration:
          'In goes the 7♦, and your opponent beats it with the 9♦. You have no 7, Jack or 9 left, so you call “Beaten!” — all four cards go to the [[discard pile]]. Now you both draw back up to six: you first (the A♥ and the 8♠ — lucky!), then your opponent. Because their defence worked, your opponent attacks next.',
        scene: {
          zones: [
            {
              id: 'table',
              label: 'Table — all beaten!',
              cards: ['7S', 'JS', '7D', '9D'],
              layout: 'row',
              highlight: [1, 3],
            },
            {
              id: 'stock',
              label: 'Stock',
              cards: ['TD', '9H'],
              layout: 'stack',
              faceDown: [0],
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand (2 cards drawn)',
              cards: ['6H', '8C', 'TC', 'KS', 'AH', '8S'],
              layout: 'fan',
              highlight: [4, 5],
            },
          ],
          caption: 'Beaten! The four cards leave the game, and everyone fills up to six.',
        },
      },
      {
        narration:
          'Your opponent attacks with the 9♣. Now you are the [[defender]]: [[beat]] it with a higher club or any trump — or [[pick up]].',
        scene: {
          zones: [
            {
              id: 'opp',
              label: 'Opponent',
              cards: ['QS', 'QD', '8H', 'JC', 'KD'],
              layout: 'fan',
              faceDown: [0, 1, 2, 3, 4],
            },
            {
              id: 'table',
              label: 'Table',
              cards: ['9C'],
              layout: 'row',
              highlight: [0],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['6H', '8C', 'TC', 'KS', 'AH', '8S'],
              layout: 'fan',
            },
          ],
          caption: 'The 9♣ is coming at you. Hearts are still trump.',
        },
        decision: {
          prompt: 'How do you defend against the 9♣?',
          options: [
            {
              label: 'Beat it with the 10♣',
              card: 'TC',
              correct: true,
              feedback:
                'Perfect — the cheapest card that does the job. A higher club beats it, and you keep all your trumps.',
            },
            {
              label: 'Beat it with the 8♣',
              card: '8C',
              correct: false,
              feedback:
                'An 8 is lower than a 9, so it can’t beat it. To beat a card with the same suit, yours must be higher.',
            },
            {
              label: 'Beat it with the A♥',
              card: 'AH',
              correct: false,
              feedback:
                'It works — a trump beats any club — but the A♥ is the best card in the game! Spending it when the 10♣ would do is like paying for a sweet with a gold coin.',
            },
            {
              label: 'Pick up',
              correct: false,
              feedback:
                'No need — you can beat it cheaply. Picking up would also give you an extra card and cost you your turn to attack.',
            },
          ],
          proHint:
            'Defend with the lowest card that beats the attack, and save trumps for cards you can’t beat any other way.',
        },
      },
      {
        narration:
          'Your 10♣ covers the 9♣. Your opponent has no 9 or 10 to throw in, so it’s “Beaten!” again. Your opponent draws first, then you draw the 9♠. You defended successfully, so now you are the [[attacker]].',
        scene: {
          zones: [
            {
              id: 'opp',
              label: 'Opponent',
              cards: ['QS', 'QD', '8H', 'JC', 'KD', 'AD'],
              layout: 'fan',
              faceDown: [0, 1, 2, 3, 4, 5],
            },
            {
              id: 'table',
              label: 'Table — beaten!',
              cards: ['9C', 'TC'],
              layout: 'row',
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['6H', '8C', 'KS', 'AH', '8S', '9S'],
              layout: 'fan',
              highlight: [5],
            },
          ],
          caption: 'Your defence held. Your turn to attack!',
        },
      },
      {
        narration:
          'Fast-forward: many bouts later, the [[stock]] is gone — someone drew the face-up 9♥ as the very last card. No more drawing now, so whoever runs out of cards is safe. You hold just two cards, the 8♠ and the 8♦, and it’s your attack. You lead the 8♠, and your opponent beats it with the Q♠.',
        scene: {
          zones: [
            {
              id: 'opp',
              label: 'Opponent (2 cards left)',
              cards: ['KH', '6C'],
              layout: 'fan',
              faceDown: [0, 1],
            },
            {
              id: 'table',
              label: 'Table',
              cards: ['8S', 'QS'],
              layout: 'row',
              highlight: [0],
            },
            {
              id: 'hand',
              label: 'Your hand — one card left!',
              cards: ['8D'],
              layout: 'fan',
              highlight: [0],
            },
          ],
          caption: 'The stock is empty. An 8 is on the table… and you hold an 8.',
        },
        decision: {
          prompt: 'Your last card is the 8♦. What do you do?',
          options: [
            {
              label: 'Throw in the 8♦',
              card: '8D',
              correct: true,
              feedback:
                'Yes! An 8 is on the table, so it’s allowed — and it’s your last card. With the stock empty, playing it means you are out and safe, whatever your opponent does.',
            },
            {
              label: 'Say “Beaten!” and keep it',
              correct: false,
              feedback:
                'Then the bout ends and your opponent attacks you. If you can’t beat their card, you’ll have to pick up… and the fool’s hat starts to fit!',
            },
          ],
          proHint:
            'In the endgame, look for ways to dump two or more cards in one bout. Pairs are gold.',
        },
      },
      {
        narration:
          'In goes the 8♦! Your opponent beats it with the K♥, a trump — but your hand is empty and there is nothing to draw, so you are out. Safe! Your opponent is still holding the 6♣, which makes them the [[durak]]. You didn’t lose — and in Durak, that’s a win!',
        scene: {
          zones: [
            {
              id: 'table',
              label: 'Table',
              cards: ['8S', 'QS', '8D', 'KH'],
              layout: 'row',
              highlight: [2],
            },
            {
              id: 'opp',
              label: 'Opponent — the durak!',
              cards: ['6C'],
              layout: 'fan',
              highlight: [0],
            },
          ],
          caption: 'You’re out of cards. Your opponent is left holding the 6♣ — the fool!',
        },
      },
    ],
    outro:
      'You escaped! You led low, threw in your twins, defended cheaply and used a pair to empty your hand in the endgame. In a real evening you’d play again and again — and nobody wants to be the durak twice in a row. Ready to test yourself? Try the quiz!',
  },
  seo: {
    description:
      'Learn Durak, Russia’s favourite card game: attack, defend, throw in cards and avoid being the fool — with a clickable example game.',
  },
});
