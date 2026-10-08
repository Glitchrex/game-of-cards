import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'mendikot',
  name: 'Mendikot',
  aka: ['Mendicot'],
  origin: { country: 'India (Maharashtra & Gujarat)', countryCode: 'IN', region: 'south-asia' },
  type: 'trick-taking',
  players: { min: 4, max: 4, ideal: 4 },
  deck: 'One standard 52-card deck, no jokers',
  difficulty: 2,
  length: 'About 5–10 minutes a deal',
  minutes: 15,
  moods: ['social', 'chill', 'competitive'],
  hook: 'Grab the tens! The family team game from Maharashtra and Gujarat where four cards decide everything',
  history:
    'Mendikot is a much-loved family game in western India, especially in Maharashtra and Gujarat, and for many children it is their very first trick-taking game. It belongs to the big family of trick-taking games that includes English Whist, but it has a twist all its own: instead of counting every trick, everyone fights over just four cards — the tens. Where the name comes from is not certain.',
  featured: false,
  order: 260,
  variantTaught:
    'Standard four-player Mendikot in fixed partnerships with one 52-card deck (Ace high), play to the right (anticlockwise) and "cut hukum" trumps: there are no trumps until someone can’t follow suit, and the suit of the card they play becomes trumps for the rest of the deal. The team that captures 3 or 4 tens wins the deal; with 2 tens each, the team with 7 or more tricks wins.',
  variants:
    'Band hukum (hidden trump): before play, one player — often the one to the dealer’s right — secretly places a card from their hand face down, and its suit becomes trumps; it is turned over the first time someone can’t follow suit. Some groups play with six or eight players in alternating teams, removing a few low cards so everyone gets the same number. Scoring is usually kept simple: many families just count the deals each team wins, with a Mendikot (all four tens) or a whitewash (all 13 tricks) counting extra, and in many homes the losing team has to deal the next hand. A very similar game played in North India is often called Dehla Pakad ("catch the ten").',
  glossary: [
    {
      term: 'suit',
      definition:
        'One of the four families of cards: Spades ♠, Hearts ♥, Diamonds ♦ and Clubs ♣. Each suit has 13 cards, from the Ace down to the 2.',
    },
    {
      term: 'trick',
      definition:
        'One round in which each of the four players plays one card. The best card wins the trick and all four cards — including any tens in it.',
    },
    {
      term: 'lead',
      definition: 'To play the first card of a trick. The winner of each trick leads the next one.',
    },
    {
      term: 'follow suit',
      definition:
        'Playing a card of the same suit as the first card of the trick. If Hearts are led and you have a Heart, you must play one.',
    },
    {
      term: 'hukum',
      definition:
        'The trump suit (the word means "command" in Hindi). Any card of the hukum beats any card of another suit — a 2♣ beats the A♥ when Clubs are hukum.',
    },
    {
      term: 'trump',
      definition:
        'A card of the hukum suit. To trump a trick is to play a trump on it when you can’t follow suit — e.g. a 3♣ trumps a trick of Hearts when Clubs are hukum.',
    },
    {
      term: 'cut hukum',
      definition:
        'The way trumps are chosen in the game we teach: the first player who can’t follow suit sets the hukum with the card they play.',
    },
    {
      term: 'feeding',
      definition:
        'Dropping your ten onto a trick your partner is sure to win, so your team captures it. Example: partner’s A♦ is winning and you play the 10♦.',
    },
    {
      term: 'Mendikot',
      definition: 'Capturing all four tens in one deal — a famous win (and the name of the game!).',
    },
    {
      term: 'whitewash',
      definition: 'Winning all 13 tricks in a deal — the biggest win of all.',
    },
  ],
  lesson: [
    {
      title: 'The goal: capture the tens',
      body: 'Mendikot is a team game for four players: you and your partner against the other two. Cards are played in rounds called [[tricks|trick]], and whoever wins a trick keeps all its cards. The only cards that really matter are the four tens. Capture at least three of them and your team wins the deal!',
      scene: {
        zones: [
          {
            id: 'tens',
            label: 'The four tens',
            cards: ['TS', 'TH', 'TD', 'TC'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
        ],
        caption: 'Catch three of these four and your team wins.',
      },
    },
    {
      title: 'Partners and the deal',
      body: 'Partners sit opposite each other. You need one normal 52-card deck with no jokers. The dealer deals out all the cards, so everyone gets 13. Dealing and play go to the right (anticlockwise), and the player to the dealer’s right [[leads|lead]] the first trick.',
      scene: {
        zones: [
          {
            id: 'partner',
            label: 'Partner (opposite you)',
            cards: ['2H', '8C'],
            layout: 'stack',
            faceDown: [0, 1],
          },
          {
            id: 'hand',
            label: 'Your 13 cards, sorted by suit',
            cards: ['AS', 'KS', '7S', 'TH', '9H', '4H', 'QD', '8D', '5D', '2D', 'JC', '6C', '3C'],
            layout: 'fan',
            highlight: [3],
          },
        ],
        caption: 'You hold one ten — the 10♥. Now you have to keep it safe!',
        animate: 'deal',
      },
      tip: 'Sort your cards by suit as soon as you pick them up — it makes following suit much easier.',
    },
    {
      title: 'Card ranking: the Ace is high',
      body: 'There are four [[suits|suit]]: Spades ♠, Hearts ♥, Diamonds ♦ and Clubs ♣. In each suit the Ace is the highest card, then King, Queen, Jack, 10, 9 and so on down to the 2. So a ten is not a very strong card — the Ace, King, Queen and Jack of its suit all beat it. That’s exactly why tens are so easy to lose!',
      scene: {
        zones: [
          {
            id: 'rank',
            label: 'Highest → lowest',
            cards: ['AH', 'KH', 'QH', 'JH', 'TH', '9H', '8H', '7H', '6H', '5H', '4H', '3H', '2H'],
            layout: 'row',
            highlight: [4],
          },
        ],
        caption: 'Four cards outrank the 10♥.',
      },
    },
    {
      title: 'Playing a trick',
      body: 'The leader plays any card. Then each player in turn plays one card, and you must [[follow suit]] — play the same suit — if you can. The highest card of the suit that was led wins the [[trick]], and the winner leads next.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick',
            cards: ['8S', 'KS', 'TS', '3S'],
            layout: 'row',
            highlight: [1],
          },
        ],
        caption: 'Spades were led. The K♠ is highest, so it wins — and it captures the 10♠!',
      },
    },
    {
      title: 'How trumps appear: cut hukum',
      body: 'At the start there are no trumps at all. The first time someone can’t follow suit, the card they play sets the [[hukum]] — the trump suit — for the rest of the deal. This is called [[cut hukum]]. Their card counts as a trump straight away, so it wins the trick unless a later player in that trick plays a higher trump.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick: Diamonds led',
            cards: ['AD', '4C'],
            layout: 'row',
            highlight: [1],
          },
          {
            id: 'hand',
            label: 'Your hand (no Diamonds)',
            cards: ['AC', '9C', '6C', '2C', 'KS', 'TH'],
            layout: 'fan',
          },
        ],
        caption:
          'You have no Diamonds and play the 4♣: Clubs become hukum, and your 4♣ beats the A♦!',
      },
      tip: 'If you’re the first to run out of a suit, play a low card of your longest suit — that suit becomes trumps, and you’ll hold plenty of them.',
    },
    {
      title: 'Using trumps',
      body: 'Once the [[hukum]] is set, any [[trump]] beats any card of the other suits, and a higher trump beats a lower one. When you can’t follow suit you may play a trump — or throw away any other card if you’d rather keep your trumps. But remember: if you can follow suit, you must.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick (Clubs are hukum)',
            cards: ['KH', 'TH', '3C', 'QH'],
            layout: 'row',
            highlight: [2],
          },
        ],
        caption: 'The little 3♣ is a trump, so it beats the K♥ — and catches the 10♥!',
      },
    },
    {
      title: 'Feeding and guarding your tens',
      body: 'A ten belongs to whoever wins the trick it lands in. So when your partner is sure to win a trick, drop your ten on it — that’s called [[feeding]]. But never [[lead]] a ten into danger: while the Ace, King, Queen or Jack of its suit is still out, an opponent may catch it.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Partner’s A♦ is winning — you play last',
            cards: ['4D', 'AD', '9D'],
            layout: 'row',
            highlight: [1],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['TD', '6D', 'KS', '2C'],
            layout: 'fan',
            highlight: [0],
          },
        ],
        caption:
          'Nobody can beat partner’s Ace now: drop the 10♦ and it’s safe in your team’s pile.',
      },
    },
    {
      title: 'Winning the deal',
      body: 'When all 13 tricks are played, count the tens. The team with 3 or 4 tens wins the deal. If each team has 2, the team that won more tricks — 7 or more — wins. Capturing all four tens is a [[Mendikot]], and winning all 13 tricks is a [[whitewash]]: the sweetest wins of all! Tiny example: your team caught the 10♠ and 10♥, the opponents the 10♦ and 10♣. That’s 2 each, but you won 8 tricks to their 5 — so your team wins.',
      scene: {
        zones: [
          {
            id: 'us',
            label: 'Your team: 2 tens, 8 tricks',
            cards: ['TS', 'TH'],
            layout: 'row',
            highlight: [0, 1],
          },
          {
            id: 'them',
            label: 'Opponents: 2 tens, 5 tricks',
            cards: ['TD', 'TC'],
            layout: 'row',
          },
        ],
        caption: '2–2 in tens, so tricks decide it: 8 beats 5.',
      },
      tip: 'Scoring is simple: many families just count how many deals each team wins, with a Mendikot counting extra.',
    },
    {
      title: 'Beginner strategy',
      body: '[[Lead|lead]] your Aces early — an Ace wins the first round of its suit and may catch a ten that’s alone. Hold on to your own ten until the higher cards of its suit have gone, or until you can feed it to your partner. Running out of a suit is a weapon: then you can trump tricks with tens in them. And keep count — always know which tens are still out there.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['AS', 'TH', 'QH', '5H', '9D', '3D', 'KC', '6C'],
            layout: 'fan',
            highlight: [0],
          },
          {
            id: 'tens',
            label: 'Tens still out there',
            cards: ['TS', 'TD', 'TC'],
            layout: 'row',
          },
        ],
        caption:
          'Lead the A♠ — the 10♠ might fall. Keep your 10♥ tucked away until the A♥ and K♥ have gone.',
      },
    },
  ],
  example: {
    intro:
      'You sit South, with your partner opposite. Your partner dealt, so the Left opponent (West) leads the first trick, and play goes to the right: West, then you, then the Right opponent (East), then your partner. There are no trumps yet — the first player who can’t follow suit will set them. Ready? Grab those tens!',
    steps: [
      {
        narration:
          'West leads the A♦. Look at your hand: you have no Diamonds at all! Nobody has set trumps yet, so the card you play now will become the [[hukum]] for the whole deal — that’s [[cut hukum]].',
        scene: {
          zones: [
            { id: 'trick', label: 'Trick 1 so far', cards: ['AD'], layout: 'row' },
            {
              id: 'hand',
              label: 'Your hand (no Diamonds)',
              cards: ['AS', 'KS', 'JS', '4S', 'TH', '8H', '3H', 'AC', 'QC', '9C', '7C', '5C', '2C'],
              layout: 'fan',
            },
          ],
        },
        decision: {
          prompt: 'Which card do you play — and so which suit becomes trumps?',
          options: [
            {
              label: '5♣ (Clubs become trumps)',
              card: '5C',
              correct: true,
              feedback:
                'Great choice. Clubs is your longest suit — six cards, including the A♣ and Q♣ — so making it trumps gives your team the most trumps. And your little 5♣ wins this trick, because it’s now a trump.',
            },
            {
              label: '4♠ (Spades become trumps)',
              card: '4S',
              correct: false,
              feedback:
                'Not terrible — your Spades are strong — but you hold only four of them and six Clubs. The more trumps you hold, the more tricks you control.',
            },
            {
              label: '3♥ (Hearts become trumps)',
              card: '3H',
              correct: false,
              feedback:
                'You have only three Hearts, so the opponents would probably hold most of the trumps — and your 10♥ would be in more danger.',
            },
          ],
          proHint:
            'When you’re the first to run out of a suit, make your longest suit trumps — and set it with a low card of that suit.',
        },
      },
      {
        narration:
          'Clubs are trumps! Your 5♣ beats the A♦. East follows with the 2♦, and your partner — seeing your trump winning — drops the 10♦ onto it. That’s [[feeding]], and it’s your team’s first ten! Now you lead.',
        scene: {
          zones: [
            {
              id: 'trick',
              label: 'Trick 1 — yours',
              cards: ['AD', '5C', '2D', 'TD'],
              layout: 'row',
              highlight: [1, 3],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['AS', 'KS', 'JS', '4S', 'TH', '8H', '3H', 'AC', 'QC', '9C', '7C', '2C'],
              layout: 'fan',
            },
          ],
          caption: 'Clubs are hukum. Tens: your team 1, opponents 0.',
        },
        decision: {
          prompt: 'What do you lead?',
          options: [
            {
              label: 'A♠',
              card: 'AS',
              correct: true,
              feedback:
                'Yes! An Ace wins the first round of its suit (unless someone trumps it). If an opponent holds the 10♠ with no other Spades, they’ll have to play it — straight into your pile.',
            },
            {
              label: '10♥',
              card: 'TH',
              correct: false,
              feedback:
                'Leading a ten is like handing it over: anyone with the A♥, K♥, Q♥ or J♥ can capture it.',
            },
            {
              label: '2♣',
              card: '2C',
              correct: false,
              feedback:
                'Leading your smallest trump just gives the lead away. Your A♠ can win a trick right now — and maybe catch a ten.',
            },
          ],
          proHint: 'Lead your Aces early: they win, and they can force out tens that are alone.',
        },
      },
      {
        narration:
          'Your A♠ wins — and look: East had just one Spade, the 10♠, and had to play it! That’s two tens. Next you lead the K♠, now the highest Spade left. But East, out of Spades, trumps it with the 3♣ and wins the trick. No ten lost, though — and it’s East’s lead.',
        scene: {
          zones: [
            {
              id: 'trick2',
              label: 'Trick 2 — yours',
              cards: ['AS', 'TS', '6S', '7S'],
              layout: 'row',
              highlight: [0, 1],
            },
            {
              id: 'trick3',
              label: 'Trick 3 — East trumps',
              cards: ['KS', '3C', '8S', '2S'],
              layout: 'row',
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JS', '4S', 'TH', '8H', '3H', 'AC', 'QC', '9C', '7C', '2C'],
              layout: 'fan',
            },
          ],
          caption: 'Tens: your team 2, opponents 0.',
        },
      },
      {
        narration:
          'East leads the 5♥. Your partner plays the A♥, and West plays the 9♥. Nobody has trumped. You play last — and you’re holding the 10♥.',
        scene: {
          zones: [
            {
              id: 'trick',
              label: 'Trick 4 so far',
              cards: ['5H', 'AH', '9H'],
              layout: 'row',
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JS', '4S', 'TH', '8H', '3H', 'AC', 'QC', '9C', '7C', '2C'],
              layout: 'fan',
            },
          ],
        },
        decision: {
          prompt: 'Which Heart do you play?',
          options: [
            {
              label: '10♥',
              card: 'TH',
              correct: true,
              feedback:
                'Perfect feeding! You’re last to play and partner’s A♥ can’t be beaten, so your ten is 100% safe. That’s three tens — your team has won the deal!',
            },
            {
              label: '3♥',
              card: '3H',
              correct: false,
              feedback:
                'Safe, but a missed chance. Your 10♥ may get caught later by the K♥, Q♥ or J♥ — right now it could go into your team’s pile for free.',
            },
            {
              label: '8♥',
              card: '8H',
              correct: false,
              feedback:
                'Same problem: you keep the ten in your hand, where an opponent’s King or Queen might catch it later.',
            },
          ],
          proHint:
            'When partner is sure to win and you play last, drop your ten on the trick. Pros never miss a free ten.',
        },
      },
      {
        narration:
          'Partner’s A♥ wins and your 10♥ is safe: three tens — the deal is already yours! Partner now leads the 8♣, a trump, and West plays the 4♣. Remember: East trumped earlier, and East plays after you…',
        scene: {
          zones: [
            {
              id: 'tens',
              label: 'Your team’s tens',
              cards: ['TD', 'TS', 'TH'],
              layout: 'row',
              highlight: [2],
            },
            {
              id: 'trick',
              label: 'Trick 5 so far',
              cards: ['8C', '4C'],
              layout: 'row',
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JS', '4S', '8H', '3H', 'AC', 'QC', '9C', '7C', '2C'],
              layout: 'fan',
            },
          ],
          caption: 'Tens: your team 3, opponents 0.',
        },
        decision: {
          prompt: 'Which trump do you play?',
          options: [
            {
              label: 'A♣',
              card: 'AC',
              correct: true,
              feedback:
                'Brilliant. The A♣ is the highest trump, so nothing can beat it. If East is holding the 10♣, it has to fall into your trick.',
            },
            {
              label: '2♣',
              card: '2C',
              correct: false,
              feedback:
                'East plays last. If East holds the 10♣, they’d win the trick with it and keep the ten for their team.',
            },
            {
              label: '9♣',
              card: '9C',
              correct: false,
              feedback:
                'Better than the 2, but the 10♣, J♣ and K♣ all beat it — East could still win with the ten.',
            },
          ],
          proHint:
            'When a ten could still fall and an opponent plays after you, play a card nobody can beat.',
        },
      },
      {
        narration:
          'Your A♣ is the highest trump — and East has to follow with their last Club: the 10♣! Your team has captured all four tens. That’s a [[Mendikot]]!',
        scene: {
          zones: [
            {
              id: 'trick',
              label: 'Trick 5 — yours',
              cards: ['8C', '4C', 'AC', 'TC'],
              layout: 'row',
              highlight: [2, 3],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JS', '4S', '8H', '3H', 'QC', '9C', '7C', '2C'],
              layout: 'fan',
            },
          ],
          caption: 'Tens: your team 4, opponents 0. Mendikot!',
        },
      },
      {
        narration:
          'The last eight tricks are still played out, but nothing can change the result: all four tens belong to your team. You lost one trick (East’s trump), so it’s not a [[whitewash]] — but a Mendikot is a famous win. Time to celebrate!',
        scene: {
          zones: [
            {
              id: 'tens',
              label: 'Your team’s tens',
              cards: ['TD', 'TS', 'TH', 'TC'],
              layout: 'row',
              highlight: [0, 1, 2, 3],
            },
          ],
          caption: 'Mendikot! Your team captured all four tens.',
          animate: 'none',
        },
      },
    ],
    outro:
      'You made your longest suit trumps, cashed your Ace to catch a lonely ten, fed your partner and dropped the last ten with your Ace of trumps. A perfect Mendikot! Ready for the quiz?',
  },
  mistakes: [
    'Leading a ten early, straight into an opponent’s Ace or King.',
    'Playing your ten on a trick the opponents are winning when you could have played a small card.',
    'Forgetting that the first card played by someone who can’t follow suit decides the trumps.',
    'Setting trumps with a short suit, so the opponents end up holding most of the trumps.',
    'Not following suit when you can — that breaks the most important rule of the game.',
    'Forgetting the tie-break: with two tens each, the team with more tricks (7 or more) wins.',
  ],
  tips: [
    'Tip: in Mendikot, never lead a ten while higher cards of its suit are still out — it’s an easy catch.',
    'Tip: when your partner is sure to win and you play last, drop your ten on the trick.',
    'Tip: if you’re first to run out of a suit, make your longest suit trumps with a low card.',
    'Tip: a short suit is a weapon — run out of it, and you can trump tricks that hold tens.',
    'Tip: lead your Aces early; they can force out a ten that’s alone in an opponent’s hand.',
    'Tip: keep track of the four tens — once all the higher cards of a suit are gone, your ten wins.',
    'Tip: with two tens each, every trick counts — the team with 7 tricks wins the deal.',
  ],
  quiz: [
    {
      question: 'What is the main goal in Mendikot?',
      options: [
        'Win the most tricks',
        'Capture the tens',
        'Get rid of all your cards',
        'Collect the most Hearts',
      ],
      answer: 1,
      explanation:
        'The team that captures 3 or 4 of the four tens wins the deal. Tricks only matter as a tie-break when it’s 2 tens each.',
    },
    {
      question:
        'No trumps have been set yet. A Diamond is led, you have no Diamonds, and you play the 4♠. What happens?',
      options: [
        'Spades become trumps for the rest of the deal',
        'Nothing special — your card just loses',
        'You must take the card back',
      ],
      answer: 0,
      explanation:
        'That’s cut hukum: the first player who can’t follow suit sets the trump suit with the card they play. Your 4♠ is now a trump and wins unless someone plays a higher Spade.',
    },
    {
      question:
        'Each team captured 2 tens. Your team won 8 tricks and the opponents won 5. Who wins the deal?',
      options: ['The opponents', 'Nobody — it’s a draw', 'Your team, because it won more tricks'],
      answer: 2,
      explanation:
        'When the tens are split 2–2, the team that won more tricks (7 or more) wins the deal.',
    },
    {
      question:
        'Your partner’s A♥ is winning, nobody has trumped, and you play last holding the 10♥ and 3♥. What’s the best play?',
      options: [
        '3♥, to keep your ten for later',
        'Either one — it makes no difference',
        'Pass your turn',
        '10♥, so your team captures the ten',
      ],
      answer: 3,
      explanation:
        'Partner’s Ace can’t be beaten and nobody plays after you, so the ten is completely safe. Feeding it now banks it for your team.',
    },
    {
      question: 'What is a Mendikot?',
      options: [
        'Winning the first trick',
        'Holding all four Aces',
        'Capturing all four tens',
        'Running out of a suit',
      ],
      answer: 2,
      explanation:
        'A Mendikot is capturing all four tens in one deal. Winning all 13 tricks is an even bigger win, called a whitewash.',
    },
  ],
  seo: {
    description:
      'Learn Mendikot, the Indian team card game of capturing tens: tricks, cut hukum trumps, feeding your partner and how to win a Mendikot — with a clickable example.',
  },
});
