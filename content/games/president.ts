import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'president',
  name: 'President',
  aka: ['Scum', 'Capitalism'],
  origin: { country: 'Worldwide', countryCode: 'UN', region: 'global' },
  type: 'shedding',
  players: { min: 3, max: 7, ideal: 4 },
  deck: 'One standard 52-card deck, no jokers (shuffle two decks together for big groups)',
  difficulty: 2,
  length: 'About 5–10 minutes a hand; play as many hands as you like',
  minutes: 20,
  moods: ['social', 'chill', 'competitive'],
  hook: 'The party game with a pecking order: win to become President — and collect the loser’s best cards',
  history:
    'President belongs to the family of “climbing” games, where every play must top the last one. It is thought to be a Western cousin of East Asian games such as Japan’s Daifugō (“grand millionaire”), and nobody knows exactly who invented it. Its big idea — the finishing order becomes a social ladder, and the loser must hand their best cards to the winner — has made it popular with students and groups of friends, under a whole list of nicknames (some of them not very polite!).',
  featured: false,
  order: 140,
  variantTaught:
    'Classic President for four players (it works for 3–7): one standard 52-card deck dealt out completely. Cards rank from 3 (low) to 2 (high), and suits don’t matter. The leader plays a single card, a pair, a triple or four of a kind; each player in turn must play the same number of cards of a higher rank, or pass. An equal rank is not enough. A pass only skips that turn. When everyone else passes, the last player to play clears the pile and leads anything; if that player has just gone out, the next player still in leads. In the first hand, the holder of the 3♣ starts and must include it. The finishing order gives the titles — President, Vice-President, Vice-Scum and Scum — and before each later hand the Scum gives the President their two best cards (getting any two back), and the Vice-Scum gives the Vice-President their best card (getting any one back).',
  variants:
    'President goes by many names, including Scum, Capitalism and some ruder ones, and almost every group has house rules. Popular ones: playing an equal card is allowed and makes the next player miss a turn; a 2 clears the pile at once; jokers are added as the highest cards or as wild cards; once you pass you are out until the pile is cleared; players change seats so the President sits in the best chair; and the Scum shuffles and deals the next hand. Who starts later hands varies too — often the Scum, sometimes the President. With five or more players, the players in the middle are neutral and swap no cards; with three, groups usually skip the Vice titles, so only the President and the Scum swap. In Japan, a close cousin called Daifugō adds a “revolution”: playing four of a kind turns the whole ranking upside down.',
  glossary: [
    {
      term: 'rank',
      definition:
        'The number or picture on a card: 3, 4, 5 … 10, J, Q, K, A, 2. In President the 3 is the lowest rank and the 2 the highest.',
    },
    {
      term: 'suit',
      definition:
        'The symbol on a card: ♠ spades, ♥ hearts, ♦ diamonds or ♣ clubs. Suits don’t matter in President — the 9♠ and the 9♥ are equal.',
    },
    {
      term: 'hand',
      definition:
        'Two meanings: the cards you are holding, and one whole deal of the game — from shuffling until only the Scum is left holding cards.',
    },
    {
      term: 'pile',
      definition:
        'The cards played in the middle of the table during a round. Only the top play matters: on a 9, you need a 10 or higher.',
    },
    {
      term: 'lead',
      definition:
        'To start a round by playing any card or set onto the empty table — for example, leading a pair of 4s.',
    },
    {
      term: 'pass',
      definition:
        'To not play on your turn, even if you could. In our version a pass only skips this turn: if play comes back round to you, you may play.',
    },
    {
      term: 'round',
      definition:
        'Everything played from one lead until all the other players pass. The last player to play wins the round, clears the pile and leads next.',
    },
    {
      term: 'pair',
      definition:
        'Two cards of the same rank, like 7♠ 7♦. A pair can only be beaten by a higher pair.',
    },
    {
      term: 'triple',
      definition: 'Three cards of the same rank, like Q♣ Q♥ Q♠. Only a higher triple can beat it.',
    },
    {
      term: 'four of a kind',
      definition:
        'All four cards of one rank, like 6♠ 6♥ 6♦ 6♣. Only a higher four of a kind can beat it.',
    },
    {
      term: 'President',
      definition:
        'The first player to go out. Before the next hand, the President receives the Scum’s two best cards and gives back any two.',
    },
    {
      term: 'Vice-President',
      definition:
        'The second player to go out. Before the next hand, they receive the Vice-Scum’s best card and give back any one.',
    },
    {
      term: 'Vice-Scum',
      definition:
        'The player who finishes second from last — with four players, the third one out. Before the next hand, they must give their best card to the Vice-President.',
    },
    {
      term: 'Scum',
      definition:
        'The last player left holding cards. Before the next hand, the Scum must give their two best cards to the President.',
    },
    {
      term: 'card swap',
      definition:
        'The trade before each new hand: Scum ↔ President swap two cards, Vice-Scum ↔ Vice-President swap one. The lower titles must give their best cards; the higher titles give back any cards they like.',
    },
  ],
  lesson: [
    {
      title: 'The goal: climb to the top',
      body: 'President is a race to get rid of your cards — with a twist. The first player out becomes the [[President]], and the last player left holding cards becomes the [[Scum]]. In the next [[hand]] — the next deal of the cards — the Scum has to give their best cards to the President. So winners stay on top… unless you can climb the ladder!',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your 13 cards',
            cards: ['3C', '5D', '5S', '7H', '8C', '9D', 'TS', 'JH', 'QC', 'KD', 'AS', '2H', '2C'],
            layout: 'fan',
          },
        ],
        caption: 'Get rid of all 13 cards first and you’re the President!',
      },
    },
    {
      title: 'Setup: deal out the whole deck',
      body: 'Use a standard 52-card deck. Deal all the cards out, one at a time. With four players that’s 13 each (with some other numbers of players, a few people get one extra card — that’s fine). Turns go clockwise, to the left. In the first hand, whoever holds the 3♣ starts, and their first play must include it.',
      scene: {
        zones: [
          {
            id: 'others',
            label: 'Ava, Ben and Cara: 13 cards each',
            cards: ['5H', '9S', 'QD'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['3C', '4H', '6D', '6S', '8H', '9C', 'TD', 'JC', 'QS', 'KH', 'AD', 'AC', '2S'],
            layout: 'fan',
            highlight: [0],
          },
        ],
        caption: 'You hold the 3♣, so you start the first hand.',
      },
    },
    {
      title: 'Which cards are strongest',
      body: 'Every card has a [[rank]] (its number or picture) and a [[suit]] (its symbol). Only the rank matters here. The 3 is the lowest and the 2 is the highest: 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2. Suits don’t matter at all in President — a 9♠ and a 9♥ are exactly equal.',
      scene: {
        zones: [
          {
            id: 'ranks',
            label: 'Lowest → highest',
            cards: ['3H', '4S', '5C', '6D', '7H', '8S', '9C', 'TD', 'JH', 'QS', 'KC', 'AD', '2H'],
            layout: 'row',
            highlight: [12],
          },
          {
            id: 'equal',
            label: 'Exactly equal — suits don’t matter',
            cards: ['9S', '9H'],
            layout: 'row',
          },
        ],
        caption: 'The 2 is the boss card. A 3 is the weakest.',
      },
    },
    {
      title: 'A turn: play higher, or pass',
      body: 'The first player [[leads|lead]] a card onto the [[pile]] in the middle. Going round the table, each player either plays a higher card on top or says “[[pass]]” — you may pass even when you could play. Equal isn’t enough: to beat an 8 you need a 9 or higher.',
      scene: {
        zones: [
          {
            id: 'pile',
            label: 'The pile',
            cards: ['5C', '8D'],
            layout: 'row',
            highlight: [1],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['4S', '7H', '8C', '9D', 'JC', 'KS', '2D'],
            layout: 'fan',
            highlight: [3, 4, 5, 6],
          },
        ],
        caption: 'The top card is the 8♦. Your 9, J, K or 2 can beat it — your 8♣ is only equal.',
      },
    },
    {
      title: 'Pairs, triples and fours',
      body: 'You don’t have to play just one card. You can lead a [[pair]], a [[triple]] or even [[four of a kind]]. Then everyone else must play the same number of cards, of a higher rank: a pair of 6s can only be beaten by a higher pair, like two Jacks.',
      scene: {
        zones: [
          { id: 'pile', label: 'The pile: a pair of 6s', cards: ['6C', '6H'], layout: 'row' },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['4D', '9S', 'JS', 'JD', 'QH', 'QC', 'QS'],
            layout: 'fan',
            highlight: [2, 3],
          },
        ],
        caption:
          'Your J♠ J♦ beats the 6s. You could split your Queens too — but why break up a triple?',
      },
      tip: 'A single 2 can’t beat a pair of 3s. The number of cards must always match.',
    },
    {
      title: 'Clearing the pile',
      body: 'Play keeps going round the table, and players who passed may still play later if it comes back to them. When everyone else passes after someone’s play, that player wins the [[round]]: the [[pile]] is cleared away and they [[lead]] again with anything they like. Since nothing is higher than a 2, a 2 can never be beaten: play one and you win the round on the spot.',
      scene: {
        zones: [
          {
            id: 'pile',
            label: 'The pile',
            cards: ['7S', 'TH', 'KD', '2C'],
            layout: 'row',
            highlight: [3],
          },
        ],
        caption:
          'Nobody can play higher than the 2♣ — another 2 would only be equal — so everyone passes. The pile is cleared and the 2♣’s owner leads.',
      },
    },
    {
      title: 'Going out, and the new titles',
      body: 'When you play your last card, you’re out! The first player out is the [[President]], the second is the [[Vice-President]], the player who finishes second from last (the third out, with four players) is the [[Vice-Scum]] and the last player left holding cards is the [[Scum]]. With more than four players, everyone in the middle is a neutral citizen. If you go out with the last play of a round, the next player still in leads the new one.',
      scene: {
        zones: [
          { id: 'p', label: '1st out: President', cards: ['2D'], layout: 'row', highlight: [0] },
          { id: 'vp', label: '2nd out: Vice-President', cards: ['KH'], layout: 'row' },
          { id: 'vs', label: '3rd out: Vice-Scum', cards: ['9C'], layout: 'row' },
          {
            id: 'scum',
            label: 'Still holding cards: Scum',
            cards: ['4D', '6S'],
            layout: 'fan',
            faceDown: [0, 1],
          },
        ],
        caption: 'The order you go out in becomes your title for the next hand.',
      },
    },
    {
      title: 'The card swap',
      body: 'Before the next hand is played comes the [[card swap]]. The [[Scum]] must give the [[President]] their two best cards, and the President gives back any two cards they like — usually their worst. The [[Vice-Scum]] gives the [[Vice-President]] their single best card and gets any one card back. Then play begins — who leads varies from table to table, but it is often the Scum. Climbing out of Scum is hard — that’s the fun!',
      scene: {
        zones: [
          {
            id: 'scumGives',
            label: 'Scum → President (their two best)',
            cards: ['2S', 'AH'],
            layout: 'row',
            highlight: [0, 1],
          },
          {
            id: 'presGives',
            label: 'President → Scum (any two, usually the worst)',
            cards: ['3D', '4C'],
            layout: 'row',
          },
        ],
        caption: 'Ouch for the Scum: a 2 and an Ace out, a 3 and a 4 in.',
      },
    },
    {
      title: 'A tiny example round',
      body: 'Ava leads a [[pair]] of 5s. Ben plays two 9s and Cara passes. You play two Kings. Ava passes, Ben passes and Cara passes again, so you win the [[round]]: the [[pile]] is cleared and you lead whatever you like.',
      scene: {
        zones: [
          {
            id: 'pile',
            label: 'One round, play by play',
            cards: ['5H', '5S', '9C', '9D', 'KH', 'KS'],
            layout: 'row',
            highlight: [4, 5],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['3D', '7C', '8H', 'JS', 'AS'],
            layout: 'fan',
          },
        ],
        caption: '5-5 → 9-9 → (pass) → K-K → (pass, pass, pass). Your Kings win the round.',
      },
    },
    {
      title: 'Beginner strategy',
      body: 'Get rid of your low cards early, and in groups — leading a [[pair]] or [[triple]] of low cards sheds them fast and is hard to beat. Don’t split pairs and triples just to beat a single. Hang on to your 2s and Aces: they win rounds, and winning a round lets you [[lead]]. Near the end, use a 2 to grab the lead, then play your last cards.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['3S', '4D', '4H', '4C', '7S', '9H', 'JD', 'KC', 'AS', '2H'],
            layout: 'fan',
            highlight: [1, 2, 3],
          },
        ],
        caption:
          'Lead the three 4s: three low cards gone in one go, and few players can beat a triple.',
      },
      tip: 'A lone 3 can never beat anything — you can only get rid of it when you lead. Pair it up or lead it early.',
    },
  ],
  mistakes: [
    'Playing an equal card. In our version a 9 can’t go on a 9 — you need a higher rank.',
    'Playing a single card on a pair, or a pair on a triple. You must match the number of cards.',
    'Thinking suits matter. In President, a 7♥ and a 7♣ are exactly the same.',
    'Splitting a pair or triple to beat a single card. Groups are your fastest way to shed cards.',
    'Playing your 2s too early. Nothing can beat them, so save them to win a round when you really need the lead.',
    'Giving away good cards in the swap. As President, give back your two worst cards — lone low cards are best.',
  ],
  tips: [
    'Tip: In President, lead your lowest pairs and triples early — they shed cards fast and are hard to beat.',
    'Tip: Beat a single with the cheapest card that works. Save your Aces and 2s.',
    'Tip: Nothing beats a 2. With a 2 and one other card left, lead the 2 to win the round, then lead your last card.',
    'Tip: Passing isn’t giving up — you can still play later in the same round, and it keeps your good cards safe.',
    'Tip: Watch who is close to going out. If a player has one card left, lead pairs instead of singles.',
    'Tip: As President, give away lone low cards in the swap. As Scum, don’t despair — one good hand can send you right back up.',
    'Tip: Keep track of the 2s. Once all four have been played, the Aces are the cards nobody can beat.',
  ],
  quiz: [
    {
      question: 'Which card is the highest in President?',
      options: ['Any King', 'Any Ace', 'Any 2', 'The A♠'],
      answer: 2,
      explanation:
        'The 2s are the highest rank, and suits don’t matter — so every 2 is equally mighty, and they all beat Aces.',
    },
    {
      question: 'Ben leads a pair of 8s. Which of these can you play on it?',
      options: ['Two Jacks', 'A single 2', 'Two 7s', 'Three 5s'],
      answer: 0,
      explanation:
        'You must play the same number of cards with a higher rank. Two Jacks beat two 8s. A single 2 is the wrong number of cards, 7s are too low, and three cards don’t match a pair.',
    },
    {
      question: 'The top card of the pile is the 10♦. Can you play the 10♠ on it?',
      options: [
        'Yes — spades beat diamonds',
        'No — you need a higher rank, like a Jack',
        'Only if it’s your last card',
      ],
      answer: 1,
      explanation:
        'Suits don’t matter in President, so the 10♠ is only equal to the 10♦ — and equal isn’t enough. You need a Jack or higher.',
    },
    {
      question: 'Who gives their two best cards to the President before the next hand?',
      options: [
        'The Vice-President',
        'The dealer',
        'Nobody — the President picks from the deck',
        'The Scum',
      ],
      answer: 3,
      explanation:
        'The Scum (last out) gives the President their two best cards and gets any two back. The Vice-Scum and Vice-President swap one card the same way.',
    },
    {
      question:
        'You have two cards left, a 6 and a 2, and it’s your lead. What is the smartest play?',
      options: ['Lead the 6 first', 'Lead the 2 first', 'Either — it doesn’t matter'],
      answer: 1,
      explanation:
        'Nobody can beat a 2, so everyone passes, you win the round and lead the 6 — out! Lead the 6 first and someone may play a 2 on it, which your 2 can’t beat, because equal isn’t higher.',
    },
  ],
  example: {
    intro:
      'The first hand of the night, for four players. You sit with Ava (on your left), Ben (across) and Cara (on your right), and turns go clockwise: you → Ava → Ben → Cara. Nobody has a title yet — let’s see who climbs to the top!',
    steps: [
      {
        narration:
          'The whole deck is dealt out: 13 cards each. You hold the 3♣, so you start, and your first play must include it. You also hold the 3♦ — and three 5s, a [[pair]] of 8s and a pair of Queens.',
        scene: {
          zones: [
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['3C', '3D', '5S', '5H', '5D', '7D', '8C', '8H', '9C', 'QS', 'QC', 'AH', '2S'],
              layout: 'fan',
              highlight: [0, 1],
            },
          ],
          caption: 'Your 13 cards. The 3♣ must be part of your first play.',
        },
        decision: {
          prompt: 'What do you lead?',
          options: [
            {
              label: 'The pair 3♣ 3♦',
              correct: true,
              feedback:
                'Perfect! Both 3s gone in one play. 3s are the weakest cards in the game, and a lone 3 would be a real headache later.',
            },
            {
              label: 'The 3♣ on its own',
              card: '3C',
              correct: false,
              feedback:
                'Legal, but then your 3♦ is stranded. Nothing is lower than a 3, so a single 3 can only be played when you lead — a wasted lead later on!',
            },
            {
              label: 'The three 5s',
              correct: false,
              feedback:
                'A nice group, but not allowed yet: in the first hand, the opening play must include the 3♣.',
            },
          ],
          proHint:
            'Pros lead their lowest cards in the biggest group they can — and a pair of 3s is perfect.',
        },
      },
      {
        narration:
          'Your 3s hit the [[pile]]. Ava plays two 8s, the 8♠ and 8♦. Ben [[passes|pass]]. Cara plays two 10s, the 10♠ and 10♦. Your turn: you need a [[pair]] higher than 10s.',
        scene: {
          zones: [
            {
              id: 'pile',
              label: 'The pile',
              cards: ['3C', '3D', '8S', '8D', 'TS', 'TD'],
              layout: 'row',
              highlight: [4, 5],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['5S', '5H', '5D', '7D', '8C', '8H', '9C', 'QS', 'QC', 'AH', '2S'],
              layout: 'fan',
              highlight: [7, 8],
            },
          ],
          caption: 'Cara’s pair of 10s is on top.',
        },
        decision: {
          prompt: 'What do you play on Cara’s 10s?',
          options: [
            {
              label: 'The pair Q♠ Q♣',
              correct: true,
              feedback:
                'Yes! Queens beat 10s, you shed two more cards, and there’s a good chance nobody can go higher — which would let you lead next.',
            },
            {
              label: 'The pair 8♣ 8♥',
              correct: false,
              feedback:
                'Not high enough: 8s are lower than 10s. On a pair of 10s you need a pair of Jacks or better.',
            },
            {
              label: 'Pass',
              correct: false,
              feedback:
                'Allowed, and you could still join in later — but your Queens fit perfectly right now. Why wait?',
            },
          ],
          proHint:
            'When you can beat a pair with a pair you were going to play anyway, a pro takes the chance to grab control.',
        },
      },
      {
        narration:
          'Two Queens! Ava passes. Ben passes again, and so does Cara. Everyone else has passed, so you win the [[round]]: the pile is cleared away and you [[lead]] anything you like.',
        scene: {
          zones: [
            {
              id: 'pile',
              label: 'Your Queens win the round',
              cards: ['TS', 'TD', 'QS', 'QC'],
              layout: 'row',
              highlight: [2, 3],
            },
            {
              id: 'hand',
              label: 'Your hand (9 cards)',
              cards: ['5S', '5H', '5D', '7D', '8C', '8H', '9C', 'AH', '2S'],
              layout: 'fan',
            },
          ],
          caption: 'The pile is yours. What do you lead?',
        },
        decision: {
          prompt: 'Your lead. What do you play?',
          options: [
            {
              label: 'The three 5s',
              correct: true,
              feedback:
                'Great choice! Three low cards gone at once — and a triple is hard to beat, because someone needs three cards of a higher rank.',
            },
            {
              label: 'The 2♠',
              card: '2S',
              correct: false,
              feedback:
                'It would win the round, but it’s your best card and you still have nine cards. Save it for the finish, when winning a round matters most.',
            },
            {
              label: 'The 7♦',
              card: '7D',
              correct: false,
              feedback:
                'Not bad — it’s low — but your 5s are lower still, and leading all three at once sheds cards much faster.',
            },
          ],
          proHint: 'With the lead, pros shed their weakest cards in the biggest group they can.',
        },
      },
      {
        narration:
          'Nobody beats your [[triple]] — they would need three matching cards higher than 5s — so everyone passes and you lead again: your 8♣ 8♥. Ava passes, but Ben plays two Jacks. Cara passes, you have no pair higher than Jacks so you pass too, and Ava passes again. Not every round goes your way: Ben wins this one and leads next.',
        scene: {
          zones: [
            {
              id: 'pile',
              label: 'The pile',
              cards: ['8C', '8H', 'JC', 'JH'],
              layout: 'row',
              highlight: [2, 3],
            },
            {
              id: 'hand',
              label: 'Your hand (4 cards)',
              cards: ['7D', '9C', 'AH', '2S'],
              layout: 'fan',
            },
          ],
          caption: 'Ben’s Jacks win the round.',
        },
      },
      {
        narration:
          'Ben leads the 4♥. Cara plays the 6♦, you drop your 7♦, Ava plays the 10♣ and Ben the K♣. Cara passes — and you play your A♥! Nobody plays a 2 on it, so everyone passes. The [[round]] is yours, and you have just two cards left: the 9♣ and the 2♠.',
        scene: {
          zones: [
            {
              id: 'pile',
              label: 'Your A♥ wins the round',
              cards: ['4H', '6D', '7D', 'TC', 'KC', 'AH'],
              layout: 'row',
              highlight: [5],
            },
            {
              id: 'hand',
              label: 'Your hand — two cards left',
              cards: ['9C', '2S'],
              layout: 'fan',
            },
          ],
          caption: 'Your lead, with the 9♣ and the 2♠.',
        },
        decision: {
          prompt: 'Which card do you lead?',
          options: [
            {
              label: 'The 2♠',
              card: '2S',
              correct: true,
              feedback:
                'Exactly! Nothing is higher than a 2 — another 2 would only be equal, which isn’t enough — so everyone must pass. You win the round, lead the 9♣, and you’re out!',
            },
            {
              label: 'The 9♣',
              card: '9C',
              correct: false,
              feedback:
                'Risky! If someone plays a 2 on your 9♣, your 2♠ can’t beat it — equal isn’t higher. You could be stuck with your last card while the others race out.',
            },
          ],
          proHint:
            'Holding a 2 and one other card, a pro plays the 2 first: a guaranteed round win, then out with the last card.',
        },
      },
      {
        narration:
          'Your 2♠ goes down and nobody can top it. The pile is cleared, you lead the 9♣ — and your hand is empty. You’re out first: you’re the [[President]]! The others play on: Ava goes out next and becomes [[Vice-President]], Ben is third — the [[Vice-Scum]] — and Cara is left holding cards, so she is the [[Scum]].',
        scene: {
          zones: [
            {
              id: 'you',
              label: 'You — President!',
              cards: ['9C'],
              layout: 'row',
              highlight: [0],
            },
            {
              id: 'cara',
              label: 'Cara — last one holding cards: Scum',
              cards: ['4D', '6S', 'JD'],
              layout: 'fan',
              faceDown: [0, 1, 2],
            },
          ],
          caption:
            'You’re the President. Ava is Vice-President, Ben is Vice-Scum and Cara is Scum.',
        },
      },
      {
        narration:
          'Hand two! The cards are shuffled and dealt again. Before anyone plays, it’s the [[card swap]]: Cara, the Scum, must give you her two best cards — the 2♥ and the A♦. Now you give her back any two cards you choose. (Meanwhile Ben, the Vice-Scum, gives Ava his best card and gets one back.)',
        scene: {
          zones: [
            {
              id: 'gift',
              label: 'From Cara (her two best)',
              cards: ['2H', 'AD'],
              layout: 'row',
              highlight: [0, 1],
            },
            {
              id: 'hand',
              label: 'Your new hand',
              cards: ['3H', '4S', '6D', '6C', '8D', '9H', '9S', 'JD', 'QH', 'KS', 'KC', 'AS', '2C'],
              layout: 'fan',
            },
          ],
          caption: 'Two great cards in. Now choose two to give back.',
        },
        decision: {
          prompt: 'Which two cards do you give Cara?',
          options: [
            {
              label: 'The 3♥ and the 4♠',
              correct: true,
              feedback:
                'Perfect! They’re your two weakest cards, and they’re loners — no pair or triple to go with them. Getting rid of them makes your hand even stronger.',
            },
            {
              label: 'The 6♦ and the 6♣',
              correct: false,
              feedback:
                'They’re low, but they’re a pair — and a pair sheds two cards in one play. Give away lone low cards instead.',
            },
            {
              label: 'The 2♥ and the A♦, straight back',
              correct: false,
              feedback:
                'Very generous! But the swap is your reward for winning. Keep the strong cards and pass on your worst ones.',
            },
          ],
          proHint:
            'As President, a pro gives away their lowest lone cards and keeps pairs, triples and high cards together.',
        },
      },
      {
        narration:
          'You hand over the 3♥ and the 4♠. Your new hand is packed with power: two 2s, two Aces and two Kings. Being [[President]] is sweet — but stay sharp, because the ladder can flip in a single hand!',
        scene: {
          zones: [
            {
              id: 'cara',
              label: 'Cara receives',
              cards: ['3H', '4S'],
              layout: 'row',
            },
            {
              id: 'hand',
              label: 'Your hand after the swap',
              cards: ['6D', '6C', '8D', '9H', '9S', 'JD', 'QH', 'KS', 'KC', 'AS', 'AD', '2C', '2H'],
              layout: 'fan',
              highlight: [7, 8, 9, 10, 11, 12],
            },
          ],
          caption: 'Ready for hand two — as the President.',
        },
      },
    ],
    outro:
      'You became President! You paired up your 3s, grabbed control with your Queens, shed a triple, saved your 2 for the finish and made a smart swap. Ready to test yourself? Try the quiz!',
  },
  seo: {
    description:
      'Learn President (also called Scum), the party card game: beat each play, go out first to become President and swap cards with the Scum — with a clickable example.',
  },
});
