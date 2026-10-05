import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'twenty-nine',
  name: 'Twenty-Nine',
  aka: ['29'],
  origin: { country: 'India', countryCode: 'IN', region: 'south-asia' },
  type: 'trick-taking',
  players: { min: 4, max: 4, ideal: 4 },
  deck: '32 cards: J, 9, A, 10, K, Q, 8 and 7 of each suit (take the 2s to 6s out of a standard deck)',
  difficulty: 3,
  length: 'About 5 minutes a deal; 30–45 minutes for a game to 6 points',
  minutes: 30,
  moods: ['social', 'brainy', 'competitive'],
  hook: 'The Indian partnership game where the Jack is king, the Nine is next, and the trump suit is a secret',
  history:
    'Twenty-Nine is a hugely popular partnership game in India and in neighbouring countries such as Bangladesh and Nepal. It belongs to the Jass family of card games — cousins of European games like Belote and Klaverjas, where the Jack and Nine of trumps are also the top cards — and card historians think the family travelled to South Asia from Europe, although exactly how and when is not known. Funnily enough, all the point cards together add up to only 28, and nobody is quite sure where the "twenty-nine" in the name comes from.',
  featured: false,
  order: 250,
  variantTaught:
    'Standard four-player Twenty-Nine in fixed partnerships: 32 cards ranked J-9-A-10-K-Q-8-7, play to the right (anticlockwise), bidding from 16 to 28 on the first four cards, a secret trump card that is revealed when someone cannot follow suit, the pair (King and Queen of trumps) moving the target by 4, and +1 or −1 game point per deal, playing to 6. The auction is simplified to "bid higher or pass"; doubling and single hand are described in Variants.',
  variants:
    'Traditional auction: the bidding is fought out between two players at a time, and the player who spoke earlier can "hold" by matching a bid instead of raising it — we teach the simpler "bid higher or pass". Some groups start the bidding at 15 or 17 instead of 16. Double and redouble: after the bidding, an opponent may double (the deal is worth 2 game points) and the bidding team may redouble (4). Single hand: a player with a superb hand may announce they will win all eight tricks alone, for a bigger reward or penalty. Many groups allow a redeal when a player’s first four cards hold no points at all. Exactly when the pair may be shown varies — many groups only allow it after the holder’s team has won a trick once trumps are revealed. Twenty-Eight is a close cousin with very similar cards and slightly different bidding.',
  glossary: [
    {
      term: 'suit',
      definition:
        'One of the four families of cards: Spades ♠, Hearts ♥, Diamonds ♦ and Clubs ♣. In Twenty-Nine each suit has 8 cards, from the Jack down to the 7.',
    },
    {
      term: 'trick',
      definition:
        'One round in which each of the four players plays one card. The best card wins the trick and all four cards — for example, the J♠ wins a trick of 8♠, 10♠ and K♠.',
    },
    {
      term: 'point cards',
      definition:
        'The only cards worth points: each Jack 3, each Nine 2, each Ace 1 and each Ten 1. All of them together add up to 28.',
    },
    {
      term: 'follow suit',
      definition:
        'Playing a card of the same suit as the first card of the trick. If Clubs are led and you have a Club, you must play one.',
    },
    {
      term: 'bid',
      definition:
        'A promise of how many points your team will collect, from 16 up to 28. The highest bid wins the right to choose trumps.',
    },
    {
      term: 'bidder',
      definition:
        'The player who made the highest bid. They secretly choose the trump suit, and their team must collect at least the bid.',
    },
    {
      term: 'trump',
      definition:
        'The suit the bidder chose. Once trumps are revealed, any trump beats any card of another suit — even a little 7♥ beats the J♠ when Hearts are trumps.',
    },
    {
      term: 'trump card',
      definition:
        'The card the bidder places face down to secretly mark the trump suit. Nobody else sees it until someone calls for trump.',
    },
    {
      term: 'call for trump',
      definition:
        'When you can’t follow suit, you may ask the bidder to turn the trump card face up. From then on everyone knows the trump suit — and if you called, you must play a trump if you have one.',
    },
    {
      term: 'pair',
      definition:
        'The King and Queen of trumps in one player’s hand. Showing it lowers the target by 4 if the bidding team holds it, or raises it by 4 if the opponents do.',
    },
    {
      term: 'game point',
      definition:
        'The score for one deal: +1 if the bidding team makes its bid, −1 if it fails. Most groups play until a team reaches 6.',
    },
  ],
  lesson: [
    {
      title: 'The goal: collect the point cards',
      body: 'Twenty-Nine is played by four people in two teams of two. Cards are played in rounds called [[tricks|trick]], and the team that wins a trick keeps its cards. Only four kinds of card are worth anything — the [[point cards]]: each Jack is worth 3, each Nine 2, each Ace 1 and each Ten 1. That’s 28 points in the whole deck. Each deal, one team promises to collect a certain number of them, and the other team tries to stop it!',
      scene: {
        zones: [
          {
            id: 'points',
            label: 'Point cards',
            cards: ['JS', '9S', 'AS', 'TS'],
            layout: 'row',
            highlight: [0, 1, 2, 3],
          },
          {
            id: 'zero',
            label: 'Worth nothing',
            cards: ['KS', 'QS', '8S', '7S'],
            layout: 'row',
          },
        ],
        caption: 'J = 3, 9 = 2, A = 1, 10 = 1: seven points in each suit, 28 in all.',
      },
    },
    {
      title: 'Jack is boss, Nine is next',
      body: 'Forget what you know about Aces! A deck has four [[suits|suit]] — Spades ♠, Hearts ♥, Diamonds ♦ and Clubs ♣ — and in every suit the cards rank, from highest to lowest: Jack, Nine, Ace, Ten, King, Queen, 8, 7. So a Jack beats everything in its suit, and a Nine beats everything except the Jack. The deck has just 32 cards — take the 2s, 3s, 4s, 5s and 6s out of a normal deck.',
      scene: {
        zones: [
          {
            id: 'rank',
            label: 'Highest → lowest',
            cards: ['JH', '9H', 'AH', 'TH', 'KH', 'QH', '8H', '7H'],
            layout: 'row',
            highlight: [0, 1],
          },
        ],
        caption: 'The Jack wins, the Nine is second — and the Ace is only third.',
      },
      tip: 'Say it like a chant: "Jack, Nine, Ace, Ten" — the four cards that win tricks AND score points.',
    },
    {
      title: 'Partners and the deal',
      body: 'Partners sit opposite each other, so the teams alternate around the table. Dealing and play move to the right (anticlockwise). The dealer first gives everyone just 4 cards. You look at these four to decide whether to make a [[bid]] — the other 4 cards each come later.',
      scene: {
        zones: [
          {
            id: 'partner',
            label: 'Partner (opposite you)',
            cards: ['7C', '8C', 'QS', 'KH'],
            layout: 'fan',
            faceDown: [0, 1, 2, 3],
          },
          {
            id: 'deck',
            label: 'Rest of the deck',
            cards: ['AD', 'TC'],
            layout: 'stack',
            faceDown: [0, 1],
          },
          {
            id: 'hand',
            label: 'Your first 4 cards',
            cards: ['JD', '9D', 'KD', 'AS'],
            layout: 'fan',
          },
        ],
        caption: 'Only 4 cards each so far — just enough to judge a bid.',
        animate: 'deal',
      },
    },
    {
      title: 'Bidding: how many points will you win?',
      body: 'Starting with the player to the dealer’s right, each player either makes a [[bid]] — a number from 16 to 28 — or passes. Every new bid must be higher than the last, and once you pass you are out of the bidding. The highest bidder becomes the [[bidder]]: their team must collect at least that many points, and they get to choose the trump suit.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your first 4 cards',
            cards: ['JD', '9D', 'KD', 'AS'],
            layout: 'fan',
            highlight: [0, 1, 2],
          },
        ],
        caption: 'Jack, Nine and King of Diamonds: a strong start. A bid of 16 or 17 is sensible.',
      },
      tip: 'Bid on Jacks and Nines, especially two or three cards of one suit. Big bids need your partner’s help too!',
    },
    {
      title: 'The secret trump',
      body: 'The bidder now chooses a [[trump]] suit — secretly! From their first four cards, they place one card of that suit face down on the table: the [[trump card]]. Nobody else knows the suit yet. Then the dealer gives everyone 4 more cards, so each player has 8. The bidder can’t play the face-down card until trumps are revealed.',
      scene: {
        zones: [
          {
            id: 'trump',
            label: 'Your trump card (secret)',
            cards: ['KD'],
            layout: 'stack',
            faceDown: [0],
          },
          {
            id: 'hand',
            label: 'Your other 7 cards',
            cards: ['JD', '9D', 'AS', 'TS', 'QC', '7H', '8D'],
            layout: 'fan',
            highlight: [3, 4, 5, 6],
          },
        ],
        caption:
          'You chose Diamonds and hid the K♦ from your first four cards. The 4 glowing cards just arrived.',
      },
      tip: 'Hide a low card of your trump suit, not your Jack — the face-down card is stuck until trumps are revealed.',
    },
    {
      title: 'Playing a trick',
      body: 'The player to the dealer’s right leads the first card. Then everyone plays one card in turn. You must [[follow suit]] — play the same suit as the first card — if you can. The highest card of that suit wins the [[trick]], and the winner leads the next one.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick',
            cards: ['KC', '9C', 'TC', '7C'],
            layout: 'row',
            highlight: [1],
          },
        ],
        caption: 'Clubs were led. The 9♣ beats the 10♣ and K♣ — only a Jack outranks a Nine.',
      },
    },
    {
      title: 'Calling for trump',
      body: 'If you can’t follow suit, you may [[call for trump]]: the bidder turns the [[trump card]] face up and takes it back into their hand (the bidder may call too). From then on everyone knows the [[trump]] suit, and any trump beats every card of the other suits. If you called, you must play a trump to that trick if you have one. After that, trumping is a choice: when you can’t follow suit, play a trump or any other card. Careful: before trumps are revealed, a card of the trump suit played off-suit can’t win — it’s just a throwaway.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Trick so far',
            cards: ['AS', 'KS'],
            layout: 'row',
          },
          {
            id: 'trump',
            label: 'Bidder’s trump card — turned over!',
            cards: ['8D'],
            layout: 'stack',
            highlight: [0],
          },
          {
            id: 'hand',
            label: 'Your hand (no Spades)',
            cards: ['QD', '7D', 'KC', '8H'],
            layout: 'fan',
            highlight: [0, 1],
          },
        ],
        caption: 'Diamonds are trumps! Now even your little 7♦ beats the A♠.',
        animate: 'flip',
      },
    },
    {
      title: 'The pair: King and Queen of trumps',
      body: 'Once trumps are revealed, a player holding both the King and the Queen of trumps can show them as the [[pair]]. If the bidding team shows it, their target goes down by 4. If the opponents show it, the target goes up by 4 (but never above 28). It can turn a deal upside down!',
      scene: {
        zones: [
          {
            id: 'pair',
            label: 'The pair (Diamonds are trumps)',
            cards: ['KD', 'QD'],
            layout: 'row',
            highlight: [0, 1],
          },
        ],
        caption: 'Bidding team shows it: a bid of 20 becomes 16. Opponents show it: 20 becomes 24.',
      },
    },
    {
      title: 'Scoring: did you make your bid?',
      body: 'When all 8 tricks are played, the bidding team counts the [[point cards]] in its tricks. If they have at least their [[bid]], they win a [[game point]]; if not, they lose one. Tiny example: you bid 17, and your team’s tricks hold three Jacks (9), three Nines (6), two Aces (2) and two Tens (2) — that’s 19. You made it: +1 game point! Most groups play until a team reaches 6 game points, or sinks to −6.',
      scene: {
        zones: [
          {
            id: 'won',
            label: 'Point cards in your team’s tricks',
            cards: ['JS', 'JH', 'JD', '9H', '9D', '9C', 'AC', 'AD', 'TS', 'TH'],
            layout: 'grid',
            highlight: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          },
        ],
        caption: '9 + 6 + 2 + 2 = 19 points. You bid 17 — made it!',
      },
      tip: 'Many players keep the score with the spare red and black 6s from the deck.',
    },
    {
      title: 'Beginner strategy',
      body: 'Bid on Jacks and Nines in one suit, and hide a low card of it as your [[trump card]]. Lead your Jacks — nothing can beat them in their own suit. When your partner is sure to win a [[trick]], throw a point card onto it. And keep an eye on the Jacks: once a suit’s Jack has gone, its Nine becomes the boss.',
      scene: {
        zones: [
          {
            id: 'trick',
            label: 'Partner is winning with the J♣',
            cards: ['8C', 'JC', '7C'],
            layout: 'row',
            highlight: [1],
          },
          {
            id: 'hand',
            label: 'Your hand (no Clubs)',
            cards: ['AD', 'TS', '7H', 'QS'],
            layout: 'fan',
            highlight: [0, 1],
          },
        ],
        caption:
          'You play last and partner’s Jack can’t be beaten: drop the A♦ or the 10♠ onto it for a free point.',
      },
    },
  ],
  example: {
    intro:
      'You sit South, with your partner opposite you. West (on your left) is the dealer, and play goes to the right: you, then the Right opponent, then your partner, then the Left opponent (the dealer). That means you bid first and lead the first trick. Let’s bid, hide a trump and play a whole deal!',
    steps: [
      {
        narration:
          'The dealer gives everyone 4 cards. Yours: J♥ 9♥ 8♥ A♣ — the two best Hearts, a third Heart and an Ace. As the player to the dealer’s right, you make the first [[bid]].',
        scene: {
          zones: [
            {
              id: 'partner',
              label: 'Partner',
              cards: ['TS', 'QC', '9D', 'TH'],
              layout: 'fan',
              faceDown: [0, 1, 2, 3],
            },
            { id: 'deck', label: 'Deck', cards: ['JD', 'TD'], layout: 'stack', faceDown: [0, 1] },
            {
              id: 'hand',
              label: 'Your first 4 cards',
              cards: ['JH', '9H', '8H', 'AC'],
              layout: 'fan',
              highlight: [0, 1, 2],
            },
          ],
        },
        decision: {
          prompt: 'What do you bid?',
          options: [
            {
              label: 'Pass',
              correct: false,
              feedback:
                'Too shy! Holding the Jack and Nine of a suit plus a third card of it is a lovely trump suit. Passing throws away a great chance to choose trumps.',
            },
            {
              label: 'Bid 17',
              correct: true,
              feedback:
                'Spot on. J♥ 9♥ 8♥ give you control of a strong trump suit, and with the A♣ you already hold 6 points. With 4 more cards to come and a partner to help, 17 is very reachable.',
            },
            {
              label: 'Bid 24',
              correct: false,
              feedback:
                'Too greedy: 24 of the 28 points means the opponents may take only 4. From just four cards you can’t know enough to promise that much.',
            },
          ],
          proHint:
            'Count your Jacks and Nines and how many cards you hold in your best suit. Jack-Nine plus one more of the same suit is a classic opening bid of around 16–18.',
        },
      },
      {
        narration:
          'Your Right opponent, your partner and the dealer all pass — you are the [[bidder]] at 17. Your team needs at least 17 of the 28 points. Now make Hearts your [[trump]] suit by placing one Heart face down as your [[trump card]].',
        scene: {
          zones: [
            {
              id: 'hand',
              label: 'Your first 4 cards',
              cards: ['JH', '9H', '8H', 'AC'],
              layout: 'fan',
              highlight: [0, 1, 2],
            },
          ],
          caption: 'Bidding: you 17 — Right: pass — Partner: pass — Dealer: pass.',
          animate: 'none',
        },
        decision: {
          prompt: 'Which card do you place face down as your trump card?',
          options: [
            {
              label: '8♥',
              card: '8H',
              correct: true,
              feedback:
                'Perfect. The 8♥ marks Hearts as trumps, and it’s your least useful Heart. The face-down card can’t be played until trumps are revealed, so your Jack and Nine stay free in your hand.',
            },
            {
              label: 'J♥',
              card: 'JH',
              correct: false,
              feedback:
                'That locks away your very best card. Until trumps are revealed you couldn’t play it at all — hide a small trump instead.',
            },
            {
              label: 'A♣',
              card: 'AC',
              correct: false,
              feedback:
                'The face-down card decides the trump suit — this would make Clubs trumps, a suit where you hold just one card. Your strength is in Hearts!',
            },
          ],
          proHint:
            'Pros hide the lowest card of their trump suit, keeping the Jack and Nine ready for action.',
        },
      },
      {
        narration:
          'You hide the 8♥. The dealer deals 4 more cards each, and you get J♠ Q♠ 7♠ 7♣. Now you have 7 cards in your hand plus your secret trump card. It’s time to lead the first [[trick]].',
        scene: {
          zones: [
            {
              id: 'trump',
              label: 'Your trump card (8♥, face down)',
              cards: ['8H'],
              layout: 'stack',
              faceDown: [0],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JH', '9H', 'AC', 'JS', 'QS', '7S', '7C'],
              layout: 'fan',
            },
          ],
        },
        decision: {
          prompt: 'Which card do you lead?',
          options: [
            {
              label: 'J♠',
              card: 'JS',
              correct: true,
              feedback:
                'Great lead. The Jack is the highest Spade, so it should win the trick — and it’s worth 3 points itself. Your partner may even add a point card to it.',
            },
            {
              label: 'A♣',
              card: 'AC',
              correct: false,
              feedback:
                'In Twenty-Nine the Ace is only the third-best card: the J♣ and 9♣ both beat it, and you’d be handing over a point card.',
            },
            {
              label: '7♠',
              card: '7S',
              correct: false,
              feedback:
                'The 7 is the lowest card — it almost certainly loses, and gives the opponents the lead for nothing.',
            },
          ],
          proHint: 'Lead a Jack early: it’s the boss of its suit and carries 3 points.',
        },
      },
      {
        narration:
          'Your J♠ wins! Right plays the 8♠, your partner follows with the 10♠ (a point for your side) and the dealer adds the K♠: 4 points for your team. Next you lead the little 7♣ to get rid of a loser cheaply — the dealer wins it with the J♣ (3 points to them). Now the dealer leads.',
        scene: {
          zones: [
            {
              id: 'trick1',
              label: 'Trick 1 — yours (4 points)',
              cards: ['JS', '8S', 'TS', 'KS'],
              layout: 'row',
              highlight: [0, 2],
            },
            {
              id: 'trick2',
              label: 'Trick 2 — dealer’s (3 points)',
              cards: ['7C', '8C', 'QC', 'JC'],
              layout: 'row',
              highlight: [3],
            },
            {
              id: 'trump',
              label: 'Your trump card',
              cards: ['8H'],
              layout: 'stack',
              faceDown: [0],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JH', '9H', 'AC', 'QS', '7S'],
              layout: 'fan',
            },
          ],
          caption: 'Score: your team 4, opponents 3.',
        },
      },
      {
        narration:
          'The dealer leads the A♦ — and you have no Diamonds! You can’t [[follow suit]], so you may [[call for trump]]. As the bidder, that means turning your own trump card face up and playing a Heart.',
        scene: {
          zones: [
            { id: 'trick', label: 'Trick 3 so far', cards: ['AD'], layout: 'row' },
            {
              id: 'trump',
              label: 'Your trump card',
              cards: ['8H'],
              layout: 'stack',
              faceDown: [0],
            },
            {
              id: 'hand',
              label: 'Your hand (no Diamonds)',
              cards: ['JH', '9H', 'AC', 'QS', '7S'],
              layout: 'fan',
            },
          ],
        },
        decision: {
          prompt: 'You have no Diamonds. What do you do?',
          options: [
            {
              label: 'Reveal trumps and play the 8♥',
              card: '8H',
              correct: true,
              feedback:
                'Excellent. Hearts become trumps, and your 8♥ — the card you hid — now beats the A♦. You win the Ace’s point, plus anything else that falls on the trick.',
            },
            {
              label: 'Throw the 7♠ and keep trumps secret',
              card: '7S',
              correct: false,
              feedback:
                'Then the dealer’s A♦ wins and the opponents take the point — maybe more if their partner adds a point card. You’d waste a chance to win cheaply with a low trump.',
            },
            {
              label: 'Throw the A♣',
              card: 'AC',
              correct: false,
              feedback:
                'Without revealing trumps your Club can’t win here, so this hands the opponents two Aces — 2 points for nothing.',
            },
          ],
          proHint:
            'When you can’t follow suit and the trick holds points, trumping is usually right — and a low trump is the cheapest way to do it.',
        },
      },
      {
        narration:
          'You turn over the 8♥ — Hearts are trumps! — and play it. Right follows with the 7♦, and your partner, seeing your trump win, throws on the 9♦: 3 points (your team 7). Nobody holds both the K♥ and Q♥, so there’s no [[pair]] this deal. Now you lead.',
        scene: {
          zones: [
            {
              id: 'trick',
              label: 'Trick 3 — won by your 8♥ (3 points)',
              cards: ['AD', '8H', '7D', '9D'],
              layout: 'row',
              highlight: [1, 3],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['JH', '9H', 'AC', 'QS', '7S'],
              layout: 'fan',
            },
          ],
          caption: 'Hearts are trumps. Score: your team 7, opponents 3.',
          animate: 'flip',
        },
        decision: {
          prompt: 'Which card do you lead now?',
          options: [
            {
              label: 'J♥',
              card: 'JH',
              correct: true,
              feedback:
                'Yes! The J♥ is the highest trump of all — nothing can beat it. Leading it forces the others to play their Hearts, pulling out trumps they could have used against you.',
            },
            {
              label: 'A♣',
              card: 'AC',
              correct: false,
              feedback:
                'The J♣ has gone, but the 9♣ is still out there and beats your Ace. Pull the trumps first, then think about Clubs.',
            },
            {
              label: 'Q♠',
              card: 'QS',
              correct: false,
              feedback:
                'The 9♠ and A♠ haven’t appeared yet — both beat your Queen. You’d lose the trick and the lead.',
            },
          ],
          proHint:
            'Once trumps are revealed, a bidder holding the top trumps usually leads them straight away to pull out the opponents’ trumps.',
        },
      },
      {
        narration:
          'Your J♥ collects the 7♥, your partner’s 10♥ and the dealer’s Q♥: 4 more points (11). Now your 9♥ is the highest trump left, so you lead it too: the K♥ and A♥ fall, and partner throws the 8♦. Another 3 points — your team has 14!',
        scene: {
          zones: [
            {
              id: 'trick4',
              label: 'Trick 4 — yours (4 points)',
              cards: ['JH', '7H', 'TH', 'QH'],
              layout: 'row',
              highlight: [0, 2],
            },
            {
              id: 'trick5',
              label: 'Trick 5 — yours (3 points)',
              cards: ['9H', 'KH', '8D', 'AH'],
              layout: 'row',
              highlight: [0, 3],
            },
            { id: 'hand', label: 'Your hand', cards: ['AC', 'QS', '7S'], layout: 'fan' },
          ],
          caption: 'Score: your team 14, opponents 3. Just 3 more points needed!',
        },
      },
      {
        narration:
          'Three cards left: A♣, Q♠ and 7♠. All eight Hearts have been played, so nobody can trump any more. Think back: the J♣ went in trick 2, so only the 9♣ can still beat your Ace. In Spades, the 9♠ and A♠ are both still out there.',
        scene: {
          zones: [
            {
              id: 'clubs',
              label: 'Clubs already played',
              cards: ['7C', '8C', 'QC', 'JC'],
              layout: 'row',
              highlight: [3],
            },
            { id: 'hand', label: 'Your hand', cards: ['AC', 'QS', '7S'], layout: 'fan' },
          ],
          animate: 'none',
        },
        decision: {
          prompt: 'Which card do you lead?',
          options: [
            {
              label: 'A♣',
              card: 'AC',
              correct: true,
              feedback:
                'Best chance. Only one card still out — the 9♣ — can beat your Ace, and if your partner holds it, the trick is yours either way.',
            },
            {
              label: 'Q♠',
              card: 'QS',
              correct: false,
              feedback:
                'Two cards still out — the 9♠ and A♠ — beat your Queen, so it’s much less likely to win than your Ace.',
            },
            {
              label: '7♠',
              card: '7S',
              correct: false,
              feedback:
                'The lowest card won’t win anything, and the opponents could collect points with the lead.',
            },
          ],
          proHint:
            'Track which Jacks and Nines have gone, and lead the card with the fewest higher cards still out. Once every higher card has gone, it’s a sure winner.',
        },
      },
      {
        narration:
          'You lead the A♣. Right plays the K♣, your partner wins with the 9♣ — and the dealer has to drop the 10♣: 4 points, so your team has 18! Partner then wins the last two tricks with the J♦ and 10♦. Final count: your team 25, opponents 3. You bid 17 and made it — +1 [[game point]]!',
        scene: {
          zones: [
            {
              id: 'trick6',
              label: 'Trick 6 — partner’s 9♣ wins (4 points)',
              cards: ['AC', 'KC', '9C', 'TC'],
              layout: 'row',
              highlight: [2],
            },
            {
              id: 'trick7',
              label: 'Trick 7 — partner’s (3 points)',
              cards: ['JD', 'KD', '7S', 'QD'],
              layout: 'row',
              highlight: [0],
            },
            {
              id: 'trick8',
              label: 'Trick 8 — partner’s (4 points)',
              cards: ['TD', 'AS', 'QS', '9S'],
              layout: 'row',
              highlight: [0],
            },
          ],
          caption: 'Final: your team 25, opponents 3. Bid 17 — made it!',
        },
      },
    ],
    outro:
      'You bid sensibly, hid a low trump, revealed it at just the right moment and pulled trumps like a pro — then trusted your partner to finish the job. That’s Twenty-Nine! Ready to test yourself in the quiz?',
  },
  mistakes: [
    'Thinking the Ace is the highest card — in Twenty-Nine the Jack and the Nine both beat it.',
    'Forgetting that only Jacks, Nines, Aces and Tens carry points — Kings, Queens, 8s and 7s are worth nothing.',
    'Bidding on high cards scattered across different suits instead of strength and length in one suit.',
    'Hiding your Jack as the trump card, which locks your best card away until trumps are revealed.',
    'Playing a card of the trump suit before trumps are revealed and expecting it to win — it’s just a throwaway.',
    'Calling for trump and then not playing a trump when you have one.',
    'Throwing a point card onto a trick that the opponents are going to win.',
  ],
  tips: [
    'Tip: in Twenty-Nine, the Jack is the boss of every suit and the Nine is second — the Ace is only third.',
    'Tip: Jack-Nine plus one more card of a suit is a classic opening bid of about 16–18.',
    'Tip: as bidder, hide a low card of your trump suit face down — keep your Jack free to play.',
    'Tip: when your partner is sure to win a trick, throw an Ace or a Ten onto it for free points.',
    'Tip: once trumps are revealed, lead your top trumps to pull out the opponents’ trumps.',
    'Tip: count the Jacks — once a suit’s Jack has gone, its Nine becomes the highest card.',
    'Tip: you don’t have to call for trump just because you can’t follow suit — call when trumping will win points.',
  ],
  quiz: [
    {
      question: 'Which card is the highest in each suit?',
      options: ['The Ace', 'The Jack', 'The King', 'The Nine'],
      answer: 1,
      explanation:
        'Twenty-Nine ranks the cards J, 9, A, 10, K, Q, 8, 7. The Jack beats everything in its suit, and the Nine is second.',
    },
    {
      question: 'How many points are there in all the cards together?',
      options: ['16', '32', '28', '40'],
      answer: 2,
      explanation:
        'Each suit holds 7 points (Jack 3, Nine 2, Ace 1, Ten 1), and there are four suits: 28 points in all.',
    },
    {
      question: 'Trumps are still secret and you can’t follow suit. What are you allowed to do?',
      options: [
        'Ask the bidder to reveal the trump card',
        'Choose a new trump suit yourself',
        'Skip your turn',
        'Take back the last trick',
      ],
      answer: 0,
      explanation:
        'When you can’t follow suit you may call for trump: the bidder turns the trump card face up. If you called, you must then play a trump if you have one.',
    },
    {
      question: 'Your team bid 18 but collected only 17 points. What happens?',
      options: [
        'You win 1 game point',
        'Nobody scores',
        'You score 17 game points',
        'You lose 1 game point',
      ],
      answer: 3,
      explanation:
        'The bidding team must collect at least its bid. One point short is still a failure, so your team loses a game point.',
    },
    {
      question:
        'Your team bid 18. After trumps are revealed, an opponent shows the King and Queen of trumps. What is your new target?',
      options: ['14', '22', '18', '20'],
      answer: 1,
      explanation:
        'When the opponents show the pair, the bidding team’s target goes up by 4: 18 becomes 22. If your own team had shown it, it would drop to 16 instead.',
    },
  ],
  seo: {
    description:
      'Learn Twenty-Nine (29), the Indian partnership card game: the J-9-A-10 ranking, bidding 16–28, the secret trump and the pair — with a clickable example hand and quiz.',
  },
});
