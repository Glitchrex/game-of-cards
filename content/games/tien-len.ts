import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'tien-len',
  name: 'Tiến Lên',
  aka: ['Thirteen', 'Tien Len', 'Tiến Lên Miền Nam'],
  origin: { country: 'Vietnam', countryCode: 'VN', region: 'southeast-asia' },
  type: 'shedding',
  players: { min: 2, max: 4, ideal: 4 },
  deck: 'One standard 52-card deck, no jokers',
  difficulty: 3,
  length: '5–10 minutes a game',
  minutes: 10,
  moods: ['social', 'competitive', 'brainy'],
  hook: 'Vietnam’s much-loved card game: race to empty your hand, then chop the mighty 2s with bombs!',
  history:
    'Tiến lên means “go forward” in Vietnamese — a perfect name for a game where every play has to climb higher than the last. It is often called Vietnam’s national card game, and it belongs to the same “climbing” family as Chinese games such as Big Two. Its exact beginnings are not well recorded, but it is a popular pastime at Tết (Lunar New Year) gatherings and has travelled the world with Vietnamese communities. In the south of Vietnam the 2s are nicknamed “heo” — pigs — so beating one with a bomb is called “chặt heo”: chopping the pig!',
  featured: false,
  order: 230,
  variantTaught:
    'Southern-style Tiến Lên (Tiến Lên Miền Nam), the most widely played form, for four players with 13 cards each. Cards rank from 3 (low) to 2 (high), and suits break ties: ♠ spades (lowest), ♣ clubs, ♦ diamonds, ♥ hearts (highest). You may play singles, pairs, triples, four of a kind, sequences of three or more cards (never including a 2) and double sequences of three or more pairs in a row. Each play must beat the last one with the same kind and number of cards — compare the highest card — or you pass, and a pass keeps you out until the next round starts. Bombs: four of a kind or three pairs in a row can chop a single 2, and four pairs in a row can chop a pair of 2s. In the first game the holder of the 3♠ starts and must include it; in later games the previous winner starts with anything. The first player to empty their hand wins; the others play on for places.',
  variants:
    'Tables differ most on the bombs: many let four of a kind also chop a pair of 2s and beat three pairs in a row, and some say five pairs in a row can chop three 2s. Some groups let a player who has passed jump back in later in the same round, often only to chop a 2. Many players award an instant win for an amazing deal, such as all four 2s, and some give a penalty to anyone caught still holding 2s when someone goes out. A northern style, Tiến Lên Miền Bắc, is usually played with stricter rules about matching suits. Outside Vietnam lots of groups play clockwise — it doesn’t change the game. With two or three players, deal 13 cards each and leave the rest out of play; if nobody holds the 3♠, the holder of the lowest card usually starts. Over an evening, players often keep score by finishing place.',
  glossary: [
    {
      term: 'rank',
      definition:
        'The number or picture on a card: 3, 4, 5 … 10, J, Q, K, A, 2. In Tiến Lên the 3 is the lowest rank and the 2 the highest.',
    },
    {
      term: 'suit',
      definition:
        'The symbol on a card: ♠ spades, ♣ clubs, ♦ diamonds or ♥ hearts. In Tiến Lên suits only break ties, so the 7♥ beats the 7♦.',
    },
    {
      term: 'combination',
      definition:
        'Any legal group of cards played together: a single, a pair, a triple, four of a kind, a sequence or a double sequence.',
    },
    {
      term: 'single',
      definition:
        'One card played on its own, like the 9♦. A single can only be beaten by a higher single.',
    },
    {
      term: 'pair',
      definition:
        'Two cards of the same rank, like 7♣ 7♥. A pair is beaten by a higher pair — compare the higher card of each.',
    },
    {
      term: 'triple',
      definition: 'Three cards of the same rank, like J♠ J♦ J♥. Only a higher triple beats it.',
    },
    {
      term: 'four of a kind',
      definition:
        'All four cards of one rank, like 5♠ 5♣ 5♦ 5♥. It beats a lower four of a kind — and it is also a bomb that can chop a single 2.',
    },
    {
      term: 'sequence',
      definition:
        'Three or more cards in a row, in any suits, like 8♦ 9♠ 10♣. It can end with an Ace (Q-K-A) but can never include a 2. It is beaten by a higher sequence of the same length.',
    },
    {
      term: 'double sequence',
      definition:
        'Three or more pairs in a row, like 4♠ 4♦ 5♣ 5♥ 6♠ 6♦. Three pairs in a row is a bomb that can chop a single 2.',
    },
    {
      term: 'pass',
      definition:
        'To not play on your turn. In Tiến Lên a pass lasts for the whole round: you can’t play again until a new round starts.',
    },
    {
      term: 'round',
      definition:
        'Everything played from a fresh start until all the other players pass. The player who made the last play wins the round and leads the next one.',
    },
    {
      term: 'lead',
      definition:
        'To start a new round on an empty table. The leader may play any combination they like, e.g. a long sequence.',
    },
    {
      term: 'bomb',
      definition:
        'A special combination that can beat 2s even though it’s a different shape: four of a kind or three pairs in a row beats a single 2, and four pairs in a row beats a pair of 2s.',
    },
    {
      term: 'chop',
      definition:
        'To beat a 2 with a bomb — “chặt” in Vietnamese. If someone plays the 2♠, you can chop it with 8♠ 8♦ 9♣ 9♥ 10♠ 10♦.',
    },
  ],
  lesson: [
    {
      title: 'The goal: empty your hand first',
      body: 'Tiến Lên is a race. Everyone gets 13 cards, and the first player to get rid of all of them wins. You play one card or a group of cards at a time — each is called a [[combination]] — and each player must beat the last play, or [[pass]]. “Tiến lên” means “go forward”: every play climbs higher than the one before!',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your 13 cards',
            cards: ['3S', '5H', '6D', '7C', '8C', '9S', 'TH', 'JD', 'QC', 'KS', 'AH', '2C', '2D'],
            layout: 'fan',
          },
        ],
        caption: 'Thirteen cards each. Be the first to play them all and you win!',
      },
    },
    {
      title: 'Setup: four players, 13 cards each',
      body: 'Shuffle a standard 52-card deck (no jokers) and deal it all out, one card at a time, so each of the four players has 13. Turns traditionally go to the right (counter-clockwise). In the first game, whoever holds the 3♠ — the lowest card in the deck — goes first, and their first play must include that 3♠.',
      scene: {
        zones: [
          {
            id: 'others',
            label: 'Lan, Minh and Hoa: 13 cards each',
            cards: ['5S', '7H', 'TD'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['3S', '4D', '6C', '8H', '9C', '9D', 'JS', 'QD', 'QH', 'KC', 'AS', 'AD', '2H'],
            layout: 'fan',
            highlight: [0],
          },
        ],
        caption: 'You hold the 3♠, so you start — and your first play must include it.',
      },
    },
    {
      title: 'Which cards are strongest',
      body: 'Every card has a [[rank]] (its number or picture) and a [[suit]] (its symbol). The 3 is the lowest rank and the 2 is the highest: 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2. When two cards have the same rank, the suit decides: ♠ spades are lowest, then ♣ clubs, ♦ diamonds and ♥ hearts. So the 3♠ is the weakest card in the deck and the 2♥ is the mightiest.',
      scene: {
        zones: [
          {
            id: 'ranks',
            label: 'Lowest → highest',
            cards: ['3S', '4C', '5D', '6H', '7S', '8C', '9D', 'TH', 'JS', 'QC', 'KD', 'AH'],
            layout: 'row',
          },
          {
            id: 'twos',
            label: '…and the 2s on top: ♠ < ♣ < ♦ < ♥',
            cards: ['2S', '2C', '2D', '2H'],
            layout: 'row',
            highlight: [3],
          },
        ],
        caption: 'From the 3 up to the Ace, then the four 2s. The 2♥ beats every other card.',
      },
      tip: 'Suits only matter when ranks tie: any 8 beats any 7, but the 7♥ beats the 7♦.',
    },
    {
      title: 'What you can play: combinations',
      body: 'On your turn you play a [[combination]]: a [[single]] card, a [[pair]], a [[triple]] or [[four of a kind]] — or a [[sequence]] of three or more cards in a row, like 8-9-10, in any suits. There is also the [[double sequence]]: three or more pairs in a row. The Ace can sit at the top of a sequence (Q-K-A), but a 2 can never be part of one.',
      scene: {
        zones: [
          { id: 'pair', label: 'Pair', cards: ['6C', '6H'], layout: 'row' },
          { id: 'triple', label: 'Triple', cards: ['JS', 'JD', 'JH'], layout: 'row' },
          { id: 'seq', label: 'Sequence', cards: ['8D', '9S', 'TC'], layout: 'row' },
          {
            id: 'dbl',
            label: 'Double sequence',
            cards: ['4S', '4D', '5C', '5H', '6S', '6D'],
            layout: 'row',
          },
        ],
        caption: 'A pair, a triple, a sequence and a double sequence. A single card counts too!',
      },
    },
    {
      title: 'Your turn: same shape, but higher',
      body: 'Whoever starts a [[round]] can play any combination. After that, each player in turn must play the same kind of combination, with the same number of cards, but higher: a [[pair]] beats a pair, a three-card [[sequence]] beats a three-card sequence. To see which is higher, compare the highest card in each — and if the ranks tie, the suit decides.',
      scene: {
        zones: [
          { id: 'table', label: 'Lan played', cards: ['7C', '7D'], layout: 'row' },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['4S', '7S', '7H', '9C', 'JD', 'JH', 'KC'],
            layout: 'fan',
            highlight: [1, 2],
          },
        ],
        caption:
          'Your 7♠ 7♥ beats Lan’s 7♣ 7♦ — your pair holds the top 7, the 7♥. Your Jacks would work too.',
      },
      tip: 'Comparing sequences? Just look at the top card: 9-10-J ending in the J♥ beats 9-10-J ending in the J♦.',
    },
    {
      title: 'Passing, and starting a new round',
      body: 'Can’t beat the last play — or don’t want to? Say “[[pass]]”. In Tiến Lên a pass counts for the whole [[round]]: you can’t jump back in until a new round starts. When everyone else has passed, the player who made the last play clears the table and [[leads|lead]] the next round with any combination they like.',
      scene: {
        zones: [
          {
            id: 'table',
            label: 'This round so far',
            cards: ['6C', '9H', 'KD'],
            layout: 'row',
            highlight: [2],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['3D', '4S', '5S', '8C', '8H', 'JS'],
            layout: 'fan',
          },
        ],
        caption:
          'Minh played the K♦ and nothing in your hand beats it, so you pass. If everyone else passes too, Minh starts the next round.',
      },
      tip: 'You may pass even when you could play. Sometimes keeping your hand together is worth more than one round.',
    },
    {
      title: 'The mighty 2 — and how to chop it',
      body: 'A 2 is the highest card, so a single 2 can normally only be beaten by a higher 2. But Tiến Lên has [[bombs|bomb]]! [[Four of a kind|four of a kind]], or a [[double sequence]] of three pairs, can [[chop]] a single 2 — even though it’s a different shape. Bigger bombs exist too: four pairs in a row can even chop a pair of 2s.',
      scene: {
        zones: [
          { id: 'table', label: 'Lan played the 2♠', cards: ['2S'], layout: 'row' },
          {
            id: 'quad',
            label: 'Four of a kind chops it',
            cards: ['5S', '5C', '5D', '5H'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
          {
            id: 'dbl',
            label: 'So do three pairs in a row',
            cards: ['8S', '8D', '9C', '9H', 'TS', 'TD'],
            layout: 'row',
            highlight: [0, 1, 2, 3, 4, 5],
          },
        ],
        caption:
          'Chop! Either bomb beats a single 2. In Vietnam this is “chặt heo” — chopping the pig.',
      },
      tip: 'Holding a bomb? Be patient. Wait for someone to play a 2, then chop it to grab control. (Many tables even let you chop after you’ve passed — agree on it before you start.)',
    },
    {
      title: 'Winning: first out takes first place',
      body: 'The moment you play your last card, you win! The others keep playing to decide second, third and last place. Then the next game begins: the player who came last usually deals, and the winner makes the first play — with any [[combination]] at all. (The 3♠ rule is only for the very first game.)',
      scene: {
        zones: [
          {
            id: 'table',
            label: 'Hoa played the 9♣ — you play your last card',
            cards: ['9C', 'QH'],
            layout: 'row',
            highlight: [1],
          },
          {
            id: 'others',
            label: 'Lan, Minh and Hoa play on for 2nd, 3rd and last',
            cards: ['4C', '6D', 'JC'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
        ],
        caption: 'Your Q♥ was your last card. You’re out — first place!',
      },
    },
    {
      title: 'A tiny example round',
      body: 'Minh [[leads|lead]] the 5♣. Hoa beats it with the 9♦, and you play the Q♠. Lan passes. Minh plays the A♣, then Hoa passes and so do you. Lan has already passed, so the [[round]] is over: Minh clears the table and starts the next round with any combination.',
      scene: {
        zones: [
          {
            id: 'table',
            label: 'One round, play by play',
            cards: ['5C', '9D', 'QS', 'AC'],
            layout: 'row',
            highlight: [3],
          },
        ],
        caption: '5♣ → 9♦ → Q♠ → (pass) → A♣ → (pass, pass). Minh’s A♣ wins the round.',
      },
    },
    {
      title: 'Beginner strategy',
      body: 'Get rid of your low cards early, in big groups if you can — a long [[sequence]] dumps lots of cards in one go. Don’t break up pairs and sequences without a good reason. Save your 2s and [[bombs|bomb]] for later, when winning a round lets you lead your last cards. And when you’re down to two plays, lead the weaker one first.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['3D', '4H', '5C', '6S', '9S', '9D', 'KC', 'AS', '2H'],
            layout: 'fan',
            highlight: [0, 1, 2, 3],
          },
        ],
        caption: 'Lead 3-4-5-6 to dump four low cards at once. Keep the 2♥ for the finish.',
      },
      tip: 'Count the 2s as they are played. Once all four are gone, the Aces are the top singles.',
    },
  ],
  mistakes: [
    'Trying to beat a pair with one high card, or a three-card sequence with a four-card one. You must match the kind of combination and the number of cards.',
    'Putting a 2 in a sequence. A sequence can end with an Ace (Q-K-A) but can never include a 2.',
    'Forgetting that suits break ties: the 7♥ beats the 7♦, and a pair holding the 7♥ beats a pair of 7s without it.',
    'Trying to play again after passing. In Tiến Lên, once you pass you wait for the next round.',
    'Spending 2s early. They are your best way to win a round late in the game, when you need the lead.',
    'Breaking up a bomb to beat an ordinary play. Three pairs in a row are worth far more as a 2-chopper.',
    'Forgetting that the opening play of the first game must include the 3♠.',
  ],
  tips: [
    'Tip: In Tiến Lên, open with your longest sequence of low cards — it sheds lots of cards and is hard to beat.',
    'Tip: Beat a single with the cheapest card that works. Don’t spend an Ace when a 9 will do.',
    'Tip: Holding four of a kind or three pairs in a row? Keep it together — it can chop a 2.',
    'Tip: When an opponent has one card left, lead pairs or sequences instead of singles. They can’t play a single card on those.',
    'Tip: Count the 2s. When all four have been played, your Aces become the top singles.',
    'Tip: Plan your finish. With two plays left, lead the weaker one and keep the strong one to go out on.',
    'Tip: Passing isn’t losing. Sitting out a round to keep your hand in good shape is often the smart move.',
  ],
  quiz: [
    {
      question: 'Which is the highest single card in Tiến Lên?',
      options: ['A♠', '2♠', '2♥', 'K♥'],
      answer: 2,
      explanation:
        'The 2s are the highest rank, and when ranks tie the suit decides: hearts are the top suit. So the 2♥ is the mightiest card of all.',
    },
    {
      question: 'Lan plays the pair 9♠ 9♦. Which of these can you play on it?',
      options: ['The single 2♣', 'The pair 9♣ 9♥', 'The sequence 10-J-Q', 'The pair 8♦ 8♥'],
      answer: 1,
      explanation:
        'A pair must be beaten by a higher pair. 9♣ 9♥ holds the 9♥, which beats Lan’s top card, the 9♦. A single or a sequence is the wrong shape, and 8s are too low.',
    },
    {
      question: 'Which of these is a legal sequence?',
      options: ['Q-K-A', 'K-A-2', 'A-2-3', '2-3-4'],
      answer: 0,
      explanation:
        'A sequence can climb up to the Ace, but a 2 can never be part of one — and it can’t wrap around from the Ace back to the 3.',
    },
    {
      question: 'Minh plays a single 2♠. Which of these can chop it?',
      options: [
        'A pair of Aces',
        'A sequence 9-10-J',
        'A triple of Kings',
        'Three pairs in a row: 5-5-6-6-7-7',
      ],
      answer: 3,
      explanation:
        'Three pairs in a row (a double sequence) is a bomb, and bombs can chop a single 2. Four of a kind would also work. Ordinary pairs, triples and sequences can’t.',
    },
    {
      question:
        'You have two plays left — the single 4♦ and the single A♥ — and it’s your turn to lead. What should you lead?',
      options: ['The 4♦', 'The A♥', 'Either — it makes no difference'],
      answer: 0,
      explanation:
        'Lead the weak card first. Someone will beat the 4♦, and then you can play your A♥ on their card and go out. Lead the Ace first and, if someone beats it with a 2, you are stuck with the 4♦.',
    },
  ],
  example: {
    intro:
      'The first game of the evening, for four players. You sit with Lan (on your right), Minh (across) and Hoa (on your left), and turns go to the right: you → Lan → Minh → Hoa. You make the big calls — and watch how each one plays out!',
    steps: [
      {
        narration:
          'The cards are dealt: 13 each. You hold the 3♠, the lowest card in the deck, so you start the first [[round]] — and your first play must include the 3♠. Look closely: 3♠ 4♣ 5♦ 6♥ 7♠ are five cards in a row!',
        scene: {
          zones: [
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['3S', '4C', '4H', '5D', '6H', '7S', '9D', '9H', 'TS', 'TC', 'JC', 'JD', 'KS'],
              layout: 'fan',
              highlight: [0, 1, 3, 4, 5],
            },
          ],
          caption: 'Your 13 cards. The 3♠ must be part of your first play.',
        },
        decision: {
          prompt: 'What do you lead?',
          options: [
            {
              label: 'The sequence 3♠ 4♣ 5♦ 6♥ 7♠',
              correct: true,
              feedback:
                'Brilliant! Five low cards gone in one go — and only a higher five-card sequence can beat it, which many players won’t have.',
            },
            {
              label: 'The 3♠ on its own',
              card: '3S',
              correct: false,
              feedback:
                'Legal, but slow. A single 3 is the easiest play in the world to beat, and you’d still need to get rid of the 4-5-6-7 later. Groups shed cards faster.',
            },
            {
              label: 'The pair of 9s',
              correct: false,
              feedback:
                'Not allowed in the first game: the opening play must include the 3♠. (And those 9s are part of something special — keep reading!)',
            },
          ],
          proHint:
            'Pros open with the biggest group of low cards they can build around the 3♠ — usually a long sequence.',
        },
      },
      {
        narration:
          'Out goes your [[sequence]]! Lan can’t beat it and passes, and Minh passes too. But Hoa plays 5♠ 6♣ 7♦ 8♠ 9♣ — also five cards in a row, and its top card, the 9♣, beats your 7♠. You have no higher five-card sequence, so you [[pass]]. Lan and Minh passed earlier, so they can’t come back in: Hoa wins the round and will [[lead]] the next one.',
        scene: {
          zones: [
            {
              id: 'yours',
              label: 'Your sequence',
              cards: ['3S', '4C', '5D', '6H', '7S'],
              layout: 'row',
            },
            {
              id: 'table',
              label: 'Hoa’s sequence — top card 9♣',
              cards: ['5S', '6C', '7D', '8S', '9C'],
              layout: 'row',
              highlight: [4],
            },
            {
              id: 'hand',
              label: 'Your hand (8 cards)',
              cards: ['4H', '9D', '9H', 'TS', 'TC', 'JC', 'JD', 'KS'],
              layout: 'fan',
            },
          ],
          caption: 'Hoa’s 9♣ beats your 7♠. Everyone else has passed, so the round goes to Hoa.',
        },
      },
      {
        narration:
          'Hoa leads a [[pair]] of 8s: the 8♣ and the 8♦. It’s your turn. You could beat them with your 9s, 10s or Jacks… but look again: 9-9, 10-10, J-J is a [[double sequence]] — three pairs in a row. That’s a [[bomb]]!',
        scene: {
          zones: [
            {
              id: 'table',
              label: 'Hoa leads',
              cards: ['8C', '8D'],
              layout: 'row',
              highlight: [0, 1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['4H', '9D', '9H', 'TS', 'TC', 'JC', 'JD', 'KS'],
              layout: 'fan',
              highlight: [1, 2, 3, 4, 5, 6],
            },
          ],
          caption: 'Three pairs in a row sit in your hand: 9-9, 10-10, J-J.',
        },
        decision: {
          prompt: 'What do you play on the pair of 8s?',
          options: [
            {
              label: 'Pass, and keep your three pairs together',
              correct: true,
              feedback:
                'Smart! Split off the 9s and your bomb is gone, leaving two ordinary pairs. Kept together, those six cards can chop a 2 later. Passing just means you sit out this one round.',
            },
            {
              label: 'Beat them with 9♦ 9♥',
              correct: false,
              feedback:
                'It’s legal — 9s beat 8s — but it breaks up your bomb. Three pairs in a row are worth far more than winning one small round.',
            },
            {
              label: 'Beat them with the K♠',
              card: 'KS',
              correct: false,
              feedback:
                'Not allowed: a pair can only be beaten by a higher pair. A single card, even a King, is the wrong shape.',
            },
          ],
          proHint:
            'Pros protect their bombs. They would rather pass a round than break up a combination that can chop a 2.',
        },
      },
      {
        narration:
          'You pass, so you sit out this round. Lan plays the pair Q♣ Q♦, and Minh and Hoa both pass, so Lan wins the round. Lan leads the 10♦, Minh plays the A♦… and Hoa slams down the 2♠! Only a higher 2 — or a [[bomb]] — can beat it. Your turn.',
        scene: {
          zones: [
            {
              id: 'table',
              label: 'New round: Lan → Minh → Hoa',
              cards: ['TD', 'AD', '2S'],
              layout: 'row',
              highlight: [2],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['4H', '9D', '9H', 'TS', 'TC', 'JC', 'JD', 'KS'],
              layout: 'fan',
              highlight: [1, 2, 3, 4, 5, 6],
            },
          ],
          caption: 'Hoa’s 2♠ is on the table. Hoa has just 5 cards left.',
        },
        decision: {
          prompt: 'Hoa’s 2♠ is on the table. What do you do?',
          options: [
            {
              label: 'Chop it with 9♦ 9♥ 10♠ 10♣ J♣ J♦',
              correct: true,
              feedback:
                'CHOP! Three pairs in a row is a bomb, and it beats a single 2. Six cards leave your hand at once, and Hoa’s mighty 2 is beaten.',
            },
            {
              label: 'Play the K♠',
              card: 'KS',
              correct: false,
              feedback:
                'A King is lower than a 2, so it can’t beat it. Only a higher 2 — or a bomb — can.',
            },
            {
              label: 'Pass',
              correct: false,
              feedback:
                'You’d miss the perfect moment! Bombs exist for exactly this: chopping a 2. Pass now and Hoa keeps control.',
            },
          ],
          proHint:
            'A pro waits with a bomb until a 2 hits the table, then chops it to grab control of the game.',
        },
      },
      {
        narration:
          '[[Chop|chop]]! To beat your bomb, someone would need a higher run of three pairs. Nobody has one, so Lan, Minh and Hoa all [[pass]]. You win the round and [[lead]] the next one. Only two cards are left in your hand: the 4♥ and the K♠.',
        scene: {
          zones: [
            {
              id: 'table',
              label: 'Your bomb chops the 2♠',
              cards: ['2S', '9D', '9H', 'TS', 'TC', 'JC', 'JD'],
              layout: 'row',
              highlight: [1, 2, 3, 4, 5, 6],
            },
            {
              id: 'hand',
              label: 'Your hand — two cards left',
              cards: ['4H', 'KS'],
              layout: 'fan',
            },
          ],
          caption: 'The round is yours. Two cards to go!',
        },
        decision: {
          prompt: 'You lead. Which card do you play first?',
          options: [
            {
              label: 'The 4♥',
              card: '4H',
              correct: true,
              feedback:
                'Yes! Lead the weak card first. Someone will beat it, and on your next turn you can drop the K♠ on their card if it’s lower — and you’re out. The 4♥ would almost never win a round by itself.',
            },
            {
              label: 'The K♠',
              card: 'KS',
              correct: false,
              feedback:
                'Risky. If anyone beats it with an Ace or a 2, you’re left holding the 4♥, which can only beat a 3 — you might never get rid of it.',
            },
          ],
          proHint:
            'With two plays left, a pro leads the one that can’t win and keeps the strong one to finish on.',
        },
      },
      {
        narration:
          'You lead the 4♥. Lan plays the 8♥, Minh the 10♥ and Hoa the J♥. Back to you: your K♠ beats the J♥ — and it’s your very last card!',
        scene: {
          zones: [
            {
              id: 'table',
              label: 'This round',
              cards: ['4H', '8H', 'TH', 'JH'],
              layout: 'row',
              highlight: [3],
            },
            {
              id: 'hand',
              label: 'Your hand — one card left',
              cards: ['KS'],
              layout: 'fan',
              highlight: [0],
            },
          ],
          caption: 'The top card is Hoa’s J♥. Your K♠ is higher.',
        },
        decision: {
          prompt: 'What do you do?',
          options: [
            {
              label: 'Play the K♠',
              card: 'KS',
              correct: true,
              feedback:
                'Yes! A King beats a Jack, and it’s your last card — the moment it lands, you’re out and you win.',
            },
            {
              label: 'Pass and wait for a better moment',
              correct: false,
              feedback:
                'In Tiến Lên a pass keeps you out for the rest of this round — and someone might go out before you get another chance. Play it now!',
            },
          ],
          proHint:
            'When your last card can legally be played, a pro plays it. Going out is the whole game.',
        },
      },
      {
        narration:
          'Down goes the K♠. Your hand is empty — you win the game! Lan, Minh and Hoa play on to decide second, third and last place. In the next game, whoever came last usually deals, and you, the winner, make the first play with any [[combination]] you like.',
        scene: {
          zones: [
            {
              id: 'table',
              label: 'Your last card',
              cards: ['4H', '8H', 'TH', 'JH', 'KS'],
              layout: 'row',
              highlight: [4],
            },
            {
              id: 'others',
              label: 'Lan, Minh and Hoa play on',
              cards: ['QH', 'AC', '6S'],
              layout: 'stack',
              faceDown: [0, 1, 2],
            },
          ],
          caption: 'First place! The others battle on for the remaining places.',
        },
      },
    ],
    outro:
      'You won! You opened with a long sequence, protected your bomb, chopped Hoa’s 2 at the perfect moment and planned your finish. That’s Tiến Lên in a nutshell. Ready to test yourself? Try the quiz!',
  },
  seo: {
    description:
      'Learn Tiến Lên (Thirteen), the much-loved Vietnamese card game: beat each play, chop 2s with bombs and empty your hand first — with a clickable example game.',
  },
});
