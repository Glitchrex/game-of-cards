import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'belote',
  name: 'Belote',
  aka: ['Classic Belote'],
  origin: { country: 'France', countryCode: 'FR', region: 'europe' },
  type: 'trick-taking',
  players: { min: 4, max: 4, ideal: 4 },
  deck: '32 cards: 7, 8, 9, 10, J, Q, K and A of each suit (take the 2s to 6s out of a standard deck)',
  difficulty: 4,
  length: 'About 5 minutes a deal; 30–60 minutes for a game to 1000 points',
  minutes: 40,
  moods: ['brainy', 'social', 'competitive'],
  hook: 'France’s favourite card game: pick trumps, shout "Belote!" and chase 162 points with your partner',
  history:
    'Belote became hugely popular in France during the 20th century and is often called the country’s favourite card game, played in cafés and family kitchens alike. It belongs to the Jass family of games, in which the Jack and Nine of trumps are the strongest cards, and it has many cousins around the world — Klaverjas in the Netherlands, Belot in Bulgaria and Baloot in Saudi Arabia among them. Where the name "Belote" comes from is still debated.',
  featured: false,
  order: 290,
  variantTaught:
    'A beginner introduction to Classic Belote for four players in two partnerships: 32 cards, play to the right (anticlockwise), 5 cards each plus a turned-up card, two rounds of "take or pass" to choose trumps, then must follow suit / must trump / must go higher in trumps, belote-rebelote (20), 10 points for the last trick, and the takers needing more points than the defenders out of 162. Declarations (sequences and four of a kind) and the bidding game Coinche are explained in Variants.',
  variants:
    'Declarations (annonces): in the full classic rules, players also score for sequences of three, four or five cards in a suit (20, 50 and 100 points) and for four of a kind (four Jacks 200, four Nines 150, four Aces, Tens, Kings or Queens 100), declared during the first trick. Belote coinchée (Coinche) is very popular in France today: instead of a turned-up card there is an auction in which teams bid a points target, and opponents can double ("coinche"). Many modern games also allow "no trumps" and "all trumps" contracts. Some tables don’t force you to play a lower trump when you can’t beat a trump already played. There are versions for two and three players, many groups play clockwise, and shorter games often go to 501 points. Related games include Klaverjas (Netherlands), Belot (Bulgaria) and Baloot (Saudi Arabia).',
  glossary: [
    {
      term: 'suit',
      definition:
        'One of the four families of cards: Spades ♠, Hearts ♥, Diamonds ♦ and Clubs ♣. In Belote each suit has 8 cards, from the Ace down to the 7.',
    },
    {
      term: 'trick',
      definition:
        'One round in which each of the four players plays one card. The best card wins the trick and all its points — for example, the J♥ (Hearts trumps) wins a trick of A♠, 10♠ and 9♥.',
    },
    {
      term: 'trump',
      definition:
        'The suit chosen for the deal. Any trump beats any card of another suit, and in trumps the Jack (20 points) and Nine (14) are the top cards.',
    },
    {
      term: 'turned card',
      definition:
        'The card turned face up after everyone has 5 cards. Its suit is the first trump suit on offer, and whoever takes picks it up.',
    },
    {
      term: 'taker',
      definition:
        'The player who chooses trumps by saying "I take". The taker’s team must then score more points than the other team.',
    },
    {
      term: 'follow suit',
      definition:
        'Playing a card of the same suit as the first card of the trick. If Diamonds are led and you have a Diamond, you must play one.',
    },
    {
      term: 'overtrump',
      definition:
        'Playing a higher trump than one already in the trick. In Belote you must overtrump an opponent’s trump whenever you can — for example, J♠ on top of an opponent’s 9♠ when Spades are trumps.',
    },
    {
      term: 'load',
      definition:
        'Throwing a high-point card, like a 10 or an Ace, onto a trick your partner is sure to win.',
    },
    {
      term: 'belote',
      definition:
        'Holding the King and Queen of trumps. Say "Belote" as you play the first and "Rebelote" as you play the second, for 20 bonus points.',
    },
    {
      term: 'dix de der',
      definition:
        'French for "ten for the last": the team that wins the last trick scores 10 extra points.',
    },
    {
      term: 'dedans',
      definition:
        'French for "inside": what happens when the takers fail. They lose all their card points, and the defenders score all 162.',
    },
    {
      term: 'capot',
      definition: 'Winning all eight tricks in a deal. It’s worth a big 250 points instead of 162.',
    },
  ],
  lesson: [
    {
      title: 'The goal: more points than the other team',
      body: 'Belote is played by four people in two teams of two. Each deal, one team chooses the [[trump]] suit and must then score more card points than the other team. You get points by winning [[tricks|trick]] that contain valuable cards — there are 162 points up for grabs in every deal. Scores add up deal after deal, and the first team to reach the target (often 1000) wins. Don’t worry about the details yet — one step at a time!',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'A juicy trick (Hearts are trumps)',
            cards: ['AS', 'TS', '9H', 'JH'],
            layout: 'row',
            highlight: [3],
          },
        ],
        caption: 'Two players trumped, and the J♥ won it all: 11 + 10 + 14 + 20 = 55 points!',
      },
    },
    {
      title: 'The cards: two different rankings',
      body: 'Belote uses 32 cards: 7, 8, 9, 10, Jack, Queen, King and Ace of each [[suit]] (Spades ♠, Hearts ♥, Diamonds ♦ and Clubs ♣). In the [[trump]] suit the Jack is the boss (20 points), then the Nine (14), Ace (11), 10 (10), King (4), Queen (3), 8 and 7. In the other suits the order is: Ace (11), 10 (10), King (4), Queen (3), Jack (2), then 9, 8 and 7, worth nothing. Notice how high the 10 is!',
      scene: {
        zones: [
          {
            id: 'trumps',
            label: 'Trump suit (Hearts): highest → lowest',
            cards: ['JH', '9H', 'AH', 'TH', 'KH', 'QH', '8H', '7H'],
            layout: 'row',
            highlight: [0, 1],
          },
          {
            id: 'plain',
            label: 'Other suits (Spades): highest → lowest',
            cards: ['AS', 'TS', 'KS', 'QS', 'JS', '9S', '8S', '7S'],
            layout: 'row',
            highlight: [0, 1],
          },
        ],
        caption: 'Trumps: J 20, 9 14, A 11, 10 10, K 4, Q 3. Others: A 11, 10 10, K 4, Q 3, J 2.',
      },
      tip: 'The Jack and Nine of trumps are worth 34 points together — they’re the cards you most want to hold.',
    },
    {
      title: 'The deal and the turned card',
      body: 'Deal and play go to the right (anticlockwise). The dealer gives everyone 5 cards — 3, then 2. Then the next card of the deck is turned face up in the middle: the [[turned card]]. Its suit is the first trump suit on offer.',
      scene: {
        zones: [
          { id: 'turned', label: 'Turned card', cards: ['JS'], layout: 'stack', highlight: [0] },
          {
            id: 'deck',
            label: 'Rest of the deck',
            cards: ['QD', '8H'],
            layout: 'stack',
            faceDown: [0, 1],
          },
          {
            id: 'hand',
            label: 'Your 5 cards',
            cards: ['9S', 'AS', 'KS', 'TD', '7C'],
            layout: 'fan',
          },
        ],
        caption: 'The J♠ is turned up: Spades are offered as trumps.',
        animate: 'flip',
      },
    },
    {
      title: 'Taking: who chooses trumps?',
      body: 'Starting with the player to the dealer’s right, each player says "I take" or "Pass". The first to take makes the turned card’s suit trumps, picks up that card and becomes the [[taker]]. If all four pass, there’s a second round: now each player may name a different suit as trumps (and still picks up the turned card), or pass. If everyone passes twice, the cards are dealt again. Then the dealer finishes the deal: the taker gets 2 more cards and everyone else 3, so all have 8.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand after taking',
            cards: ['9S', 'AS', 'KS', 'TD', '7C', 'JS', 'QD', '8H'],
            layout: 'fan',
            highlight: [0, 5],
          },
        ],
        caption:
          'You said "I take": the J♠ joins your hand, plus 2 more cards. Spades are trumps — and you hold the Jack and Nine!',
      },
      tip: 'Take with the Jack of trumps (or the Nine and Ace) plus a couple more trumps. One or two small trumps aren’t enough.',
    },
    {
      title: 'Playing a trick',
      body: 'The player to the dealer’s right always leads the first trick, whoever took. Each player plays one card in turn, and you must [[follow suit]] if you can. The highest card of the suit led wins the [[trick]] — unless someone plays a [[trump]], because any trump beats any other suit. The winner leads the next trick.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick (Spades are trumps)',
            cards: ['KD', 'AD', '7D', 'TD'],
            layout: 'row',
            highlight: [1],
          },
        ],
        caption: 'Diamonds led, no trumps played: the A♦ wins 4 + 11 + 0 + 10 = 25 points.',
      },
    },
    {
      title: 'No card of that suit? Trump it!',
      body: 'If you can’t follow suit, you must play a [[trump]] if you have one — even a small one. There’s one exception: if your partner is already winning the trick, you don’t have to trump and may play any card. That’s a great moment to [[load]] the trick with a 10 or an Ace.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'An opponent leads the A♣',
            cards: ['AC'],
            layout: 'row',
          },
          {
            id: 'hand',
            label: 'Your hand (no Clubs)',
            cards: ['7S', 'QH', 'KD', '9D'],
            layout: 'fan',
            highlight: [0],
          },
        ],
        caption:
          'No Clubs and an opponent is winning: you must trump with the 7♠ (Spades are trumps).',
      },
    },
    {
      title: 'Trumps: always go higher',
      body: 'Trumps have one more rule: go higher if you can. If an opponent has already trumped, you must beat their trump if you can — that’s called [[overtrumping|overtrump]]. If you can’t beat it, you still have to play a trump (a lower one). And when trumps are led, you must play a higher trump if you have one — even if your partner is winning the trick!',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick so far (Spades are trumps)',
            cards: ['KH', '9S'],
            layout: 'row',
            highlight: [1],
          },
          {
            id: 'hand',
            label: 'Your hand (no Hearts)',
            cards: ['JS', '8S', 'AD', '7C'],
            layout: 'fan',
            highlight: [0],
          },
        ],
        caption:
          'An opponent trumped with the 9♠. You have no Hearts and you can beat it, so you must: play the J♠.',
      },
    },
    {
      title: 'Belote and Rebelote',
      body: 'If you hold the King and Queen of trumps, you have a [[belote]] — worth 20 bonus points. When you play the first of the two, say "Belote!", and when you play the second, say "Rebelote!". Say it out loud: at most tables the bonus only counts if you announce it.',
      scene: {
        zones: [
          {
            id: 'pair',
            label: 'King and Queen of trumps (Spades)',
            cards: ['KS', 'QS'],
            layout: 'row',
            highlight: [0, 1],
          },
        ],
        caption: '"Belote!" … "Rebelote!" = 20 bonus points.',
      },
    },
    {
      title: 'Scoring: did the takers win?',
      body: 'After the 8th trick, each team adds up its card points, and whoever won the last trick gets 10 more — the [[dix de der]]. That makes 162 in total. If the takers score more than the defenders (belote points count too), both teams score what they won. If not, the takers are [[dedans]] ("inside"): they lose all their card points and the defenders get all 162. Win all 8 tricks and it’s a [[capot]], worth 250. Tiny example: the takers win 104 card points plus 20 for belote = 124, and the defenders 58. 124 beats 58, so the contract is made: 124 to 58.',
      scene: {
        zones: [
          {
            id: 'last',
            label: 'The last trick (Hearts are trumps)',
            cards: ['7D', 'KD', 'QD', 'AD'],
            layout: 'row',
            highlight: [3],
          },
        ],
        caption: 'K 4 + Q 3 + A 11 = 18 card points, plus 10 for the dix de der = 28.',
      },
      tip: 'Without a belote, the takers need at least 82 of the 162 points to beat the defenders.',
    },
    {
      title: 'Beginner strategy',
      body: 'Only take with a real trump hand — the Jack, or the Nine with the Ace, plus a couple more trumps. As [[taker]], lead your top trumps early to pull out the opponents’ trumps. When your partner’s card is sure to win, [[load]] it with a 10 or an Ace. Don’t lead a 10 in a plain suit while its Ace is still out. And count the trumps: there are only eight.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'A good hand to take with Hearts',
            cards: ['JH', '9H', 'AH', '7H', 'AS', 'KD', '8C', '7C'],
            layout: 'fan',
            highlight: [0, 1, 2],
          },
        ],
        caption:
          'J, 9 and A of trumps: lead the Jack first and watch the opponents’ trumps start falling.',
      },
    },
  ],
  example: {
    intro:
      'You sit South, with your partner opposite. West (on your left) dealt, so play goes to the right: you, then the Right opponent (East), then your partner, then West. That means you speak first and lead the first trick. Let’s take trumps and play a whole deal!',
    steps: [
      {
        narration:
          'West deals you 5 cards — 9♥ K♥ Q♥ A♠ 10♦ — and turns up the J♥ as the [[turned card]]. Hearts are on offer as [[trumps|trump]], and you’re the first to speak.',
        scene: {
          zones: [
            { id: 'turned', label: 'Turned card', cards: ['JH'], layout: 'stack', highlight: [0] },
            {
              id: 'deck',
              label: 'Deck',
              cards: ['7S', '7D'],
              layout: 'stack',
              faceDown: [0, 1],
            },
            {
              id: 'hand',
              label: 'Your 5 cards',
              cards: ['9H', 'KH', 'QH', 'AS', 'TD'],
              layout: 'fan',
              highlight: [0, 1, 2],
            },
          ],
        },
        decision: {
          prompt: 'Do you take Hearts as trumps?',
          options: [
            {
              label: '"I take!"',
              correct: true,
              feedback:
                'Absolutely! With the J♥ you’ll hold the Jack and Nine of trumps — the two best cards in the game — plus the King and Queen of Hearts for a belote. That’s a dream hand.',
            },
            {
              label: '"Pass"',
              correct: false,
              feedback:
                'That throws away a monster: the turned J♥ would give you the Jack and Nine of trumps plus a belote. Hands this good don’t come along often!',
            },
          ],
          proHint:
            'Count the trumps you’d hold after taking. Jack + Nine + two more is a very strong take — pros take with less.',
        },
      },
      {
        narration:
          '"I take!" You pick up the J♥, and West deals you 2 more cards (7♠ and 7♦) and everyone else 3. Hearts are trumps, you’re the [[taker]] — and with the K♥ and Q♥ you have a [[belote]] waiting. You lead the first trick.',
        scene: {
          zones: [
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JH', '9H', 'KH', 'QH', 'AS', '7S', 'TD', '7D'],
              layout: 'fan',
              highlight: [0, 1],
            },
          ],
          caption: 'Hearts are trumps.',
          animate: 'deal',
        },
        decision: {
          prompt: 'Which card do you lead?',
          options: [
            {
              label: 'J♥',
              card: 'JH',
              correct: true,
              feedback:
                'Perfect. The J♥ can’t be beaten. Leading it forces everyone to play a trump if they have one — pulling out trumps the opponents could use against your Ace.',
            },
            {
              label: 'A♠',
              card: 'AS',
              correct: false,
              feedback:
                'The A♠ will still be a winner later. Pull trumps first — otherwise an opponent with no Spades could trump your Ace.',
            },
            {
              label: '10♦',
              card: 'TD',
              correct: false,
              feedback:
                'Leading a 10 while the A♦ is still out is a gift: 10 points for whoever holds the Ace.',
            },
          ],
          proHint:
            'As taker with the Jack and Nine of trumps, lead them straight away to draw the opponents’ trumps.',
        },
      },
      {
        narration:
          'Brilliant! East plays the 7♥, partner the 8♥, and West is forced to play the A♥ — 31 points for you. Next you lead the 9♥, now the highest trump left: East must give up the 10♥, while partner and West, out of trumps, throw small cards. +24! Six trumps have gone, so only your K♥ and Q♥ are left.',
        scene: {
          zones: [
            {
              id: 'trick1',
              label: 'Trick 1 — yours (31)',
              cards: ['JH', '7H', '8H', 'AH'],
              layout: 'row',
              highlight: [0, 3],
            },
            {
              id: 'trick2',
              label: 'Trick 2 — yours (24)',
              cards: ['9H', 'TH', '8D', '8C'],
              layout: 'row',
              highlight: [0, 1],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['KH', 'QH', 'AS', '7S', 'TD', '7D'],
              layout: 'fan',
            },
          ],
          caption: 'Your team: 55 points.',
        },
      },
      {
        narration:
          'You play your A♠: East plays the 8♠, partner [[loads|load]] it with the 10♠, and West adds the J♠ — 23 more. Then you lead the 7♠ and partner wins with the K♠ (7 points). Your team has 85, and it’s partner’s lead.',
        scene: {
          zones: [
            {
              id: 'trick3',
              label: 'Trick 3 — yours (23)',
              cards: ['AS', '8S', 'TS', 'JS'],
              layout: 'row',
              highlight: [0, 2],
            },
            {
              id: 'trick4',
              label: 'Trick 4 — partner’s (7)',
              cards: ['7S', '9S', 'KS', 'QS'],
              layout: 'row',
              highlight: [2],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['KH', 'QH', 'TD', '7D'],
              layout: 'fan',
            },
          ],
          caption: 'Your team: 85 points.',
        },
      },
      {
        narration:
          'Partner leads the A♣ and West plays the 9♣. You have no Clubs. Partner’s Ace is the highest Club, and every trump except your own two has been played — so partner is sure to win this trick.',
        scene: {
          zones: [
            {
              id: 'trick',
              label: 'Trick 5 so far',
              cards: ['AC', '9C'],
              layout: 'row',
              highlight: [0],
            },
            {
              id: 'hand',
              label: 'Your hand (no Clubs)',
              cards: ['KH', 'QH', 'TD', '7D'],
              layout: 'fan',
            },
          ],
        },
        decision: {
          prompt: 'What do you play?',
          options: [
            {
              label: '10♦ — load partner’s trick',
              card: 'TD',
              correct: true,
              feedback:
                'Exactly right. Partner is winning, so you don’t have to trump. Loading the 10♦ banks 10 points that the A♦ could otherwise catch later.',
            },
            {
              label: 'Trump with the K♥',
              card: 'KH',
              correct: false,
              feedback:
                'Not needed — partner already has this trick. You’d waste a trump, and your 10♦ would stay in danger.',
            },
            {
              label: '7♦',
              card: '7D',
              correct: false,
              feedback:
                'Safe, but you miss 10 free points: your 10♦ could be captured later by the A♦.',
            },
          ],
          proHint:
            'When your partner is sure to win, load the trick with your 10s and Aces — and never waste a trump on it.',
        },
      },
      {
        narration:
          'East plays the 7♣ and partner collects 21 points (106 so far). Partner now leads the K♣ — but West plays the 10♣, and in plain suits the 10 beats the King! So an opponent is winning this trick, and again you have no Clubs.',
        scene: {
          zones: [
            {
              id: 'trick5',
              label: 'Trick 5 — partner’s (21)',
              cards: ['AC', '9C', 'TD', '7C'],
              layout: 'row',
              highlight: [0, 2],
            },
            {
              id: 'trick',
              label: 'Trick 6 so far — West is winning',
              cards: ['KC', 'TC'],
              layout: 'row',
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand (no Clubs)',
              cards: ['KH', 'QH', '7D'],
              layout: 'fan',
            },
          ],
        },
        decision: {
          prompt: 'What do you do?',
          options: [
            {
              label: 'Trump with the K♥ and say "Belote!"',
              card: 'KH',
              correct: true,
              feedback:
                'Yes! An opponent is winning and you have no Clubs, so you must trump — and your K♥ captures West’s 10♣ too. Saying "Belote" as you play it starts your 20-point bonus.',
            },
            {
              label: 'Throw the 7♦',
              card: '7D',
              correct: false,
              feedback:
                'Not allowed! West, an opponent, is winning the trick. When you can’t follow suit and your partner isn’t winning, you must play a trump if you have one.',
            },
            {
              label: 'Trump with the K♥ without saying anything',
              card: 'KH',
              correct: false,
              feedback:
                'Right card, but announce it! At most tables the 20 points for a belote only count if you say "Belote" as you play the first of the pair.',
            },
          ],
          proHint:
            'Ask yourself: "Is my partner winning this trick?" If yes, you may load points onto it. If an opponent is winning, you must trump — so announce your belote as you do.',
        },
      },
      {
        narration:
          '"Belote!" Your K♥ beats the 10♣, and East follows with the J♣: 20 points (126). Two tricks to go. You hold the Q♥ — the very last trump in the game — and the 7♦, and it’s your lead.',
        scene: {
          zones: [
            {
              id: 'trick6',
              label: 'Trick 6 — yours (20)',
              cards: ['KC', 'TC', 'KH', 'JC'],
              layout: 'row',
              highlight: [1, 2],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['QH', '7D'],
              layout: 'fan',
            },
          ],
          caption: 'Your team: 126 points. Only your Q♥ is left in trumps.',
        },
        decision: {
          prompt: 'Which card do you lead?',
          options: [
            {
              label: '7♦ — keep the Q♥ for the last trick',
              card: '7D',
              correct: true,
              feedback:
                'Smart counting! Your little 7♦ will lose a trick whenever you play it, so lose it now. Then your Q♥ — the only trump left — is sure to win the last trick and its 10 bonus points.',
            },
            {
              label: 'Q♥ — "Rebelote!"',
              card: 'QH',
              correct: false,
              feedback:
                'It wins this trick, but then you must lead the 7♦ to the last trick and lose it — handing the opponents the last trick and its 10 extra points.',
            },
          ],
          proHint:
            'Holding the last trump? Save it for the final trick: it can’t lose, and the last trick is worth 10 extra points.',
        },
      },
      {
        narration:
          'You lead the 7♦: East plays the J♦, partner the 9♦, and West wins with the A♦ (13 points to the defenders). West leads the Q♣ to the last trick — and you trump it with the Q♥: "Rebelote!" East and partner throw the K♦ and Q♦: 13 points plus the 10-point [[dix de der]] (149). Final count: your team 149 + 20 for belote = 169, the defenders 13. You took trumps and scored far more than the other team — contract made!',
        scene: {
          zones: [
            {
              id: 'trick7',
              label: 'Trick 7 — West’s (13)',
              cards: ['7D', 'JD', '9D', 'AD'],
              layout: 'row',
              highlight: [3],
            },
            {
              id: 'trick8',
              label: 'Trick 8 — yours (13 + 10)',
              cards: ['QC', 'QH', 'KD', 'QD'],
              layout: 'row',
              highlight: [1],
            },
          ],
          caption: 'Takers 169 (with belote), defenders 13. Contract made!',
        },
      },
    ],
    outro:
      'You took on a great hand, pulled trumps, loaded your partner’s sure trick, trumped when an opponent was winning, saved your last trump for the last trick — and collected your belote along the way. That’s the heart of Belote! Try the quiz next — and when you’re ready, the full rules add declarations and the bidding game Coinche.',
  },
  mistakes: [
    'Treating the Jack of trumps like an ordinary Jack — in trumps it’s the top card (20 points), in other suits it’s worth just 2.',
    'Taking with a weak hand: one or two small trumps won’t win more than half the points.',
    'Forgetting that you must trump when you can’t follow suit (unless your partner is winning the trick).',
    'Not going higher when trumps are led or when someone has already trumped.',
    'Forgetting to say "Belote" and "Rebelote" — the 20 points depend on it.',
    'Leading a plain-suit 10 while its Ace is still out — it’s 10 free points for the opponents.',
    'Forgetting the 10 extra points for winning the last trick.',
  ],
  tips: [
    'Tip: in Belote, take when you hold the Jack of trumps plus two more — the Jack and Nine alone are worth 34 points.',
    'Tip: as taker, lead your Jack and Nine of trumps early to pull out the opponents’ trumps.',
    'Tip: when your partner is sure to win a trick, load it with a 10 or an Ace.',
    'Tip: count trumps — there are eight in each suit. Once they’ve all gone, your Aces are safe.',
    'Tip: can’t follow suit and an opponent is winning? You must trump — and if a trump is already there, beat it if you can.',
    'Tip: try to keep a winner for the last trick — it’s worth 10 extra points.',
    'Tip: in plain suits the 10 is the second-best card. Play your Ace first, and the 10 often becomes a winner.',
  ],
  quiz: [
    {
      question: 'Hearts are trumps. Which Heart is the highest?',
      options: ['A♥', 'J♥', '9♥', 'K♥'],
      answer: 1,
      explanation:
        'In the trump suit the order is J, 9, A, 10, K, Q, 8, 7. The Jack of trumps is the top card, worth 20 points.',
    },
    {
      question: 'How many points is the Nine of trumps worth?',
      options: ['0', '11', '14', '20'],
      answer: 2,
      explanation:
        'The Nine of trumps is worth 14, second only to the Jack (20). In the other suits a Nine is worth nothing.',
    },
    {
      question:
        'An opponent leads a Club and is winning the trick. You have no Clubs but you do have trumps. What must you do?',
      options: ['Play any card you like', 'Pass your turn', 'Show your hand', 'Play a trump'],
      answer: 3,
      explanation:
        'If you can’t follow suit and your partner isn’t winning the trick, you must trump. You may only throw any card when your partner is winning.',
    },
    {
      question: 'Hearts are trumps and you hold the K♥ and Q♥. What do you say when you play them?',
      options: ['"Belote", then "Rebelote"', '"Capot"', '"Dix de der"', 'Nothing at all'],
      answer: 0,
      explanation:
        'The King and Queen of trumps make a belote, worth 20 points. Say "Belote" with the first and "Rebelote" with the second.',
    },
    {
      question:
        'Your team took trumps and scored 78 points; the defenders scored 84. What happens?',
      options: [
        'You score your 78 anyway',
        'You are "dedans": the defenders score all 162',
        'Nobody scores this deal',
      ],
      answer: 1,
      explanation:
        'The takers must score more than the defenders. 78 is less than 84, so the takers are "dedans" (inside): they lose all their card points and the defenders score all 162.',
    },
  ],
  seo: {
    description:
      'Learn Belote, France’s favourite card game: trumps, the mighty Jack and Nine, belote-rebelote and scoring 162 points — with a clickable example hand and quiz.',
  },
});
