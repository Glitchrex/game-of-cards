import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'teen-patti',
  name: 'Teen Patti',
  aka: ['Teen Pathi', '3 Patti', 'Flash', 'Flush'],
  origin: { country: 'India', countryCode: 'IN', region: 'south-asia' },
  type: 'comparing',
  players: { min: 2, max: 5, ideal: 3 },
  deck: 'One standard 52-card deck, no jokers',
  difficulty: 2,
  length: 'About 3–5 minutes a hand',
  minutes: 5,
  moods: ['social', 'lucky', 'competitive'],
  hook: 'The game every Indian family plays at Diwali: three cards, one pot and a lot of nerve',
  history:
    'Teen patti simply means "three cards" in Hindi. It is a close cousin of the British game Three Card Brag and is generally thought to have grown out of it. Today it is one of the best-loved card games in South Asia, and it is especially popular around Diwali, when card parties are a festive tradition in many homes.',
  featured: true,
  order: 80,
  variantTaught:
    'Classic Teen Patti for 2–5 players, one deal per game. Everyone posts a 1-boot boot and starts blind; play starts on the dealer’s left. Blind players chaal the current stake, seen players twice the stake; a raise doubles the stake, up to an 8-boot chaal limit. A show is only allowed when two players are left (it costs a chaal, and the player who asks loses an exact tie). A 64-boot pot limit cuts any bet down to fit; once a chaal or raise brings the pot to 64, everyone still in shows (exact ties split the pot). Hands rank Trail > Pure sequence > Sequence > Colour > Pair > High card, with A-K-Q the top sequence and A-2-3 second.',
  variants:
    'Many tables add a side show: a seen player may ask the player who bet just before them (if they have seen too) to compare cards privately. That player may refuse; if they agree, the weaker hand must pack, and on an exact tie the player who asked packs. We leave it out to keep your first games simple. Boots, chaal limits and pot limits differ from table to table, and some groups rank A-2-3 differently (as the very top or the very bottom sequence). Party nights often switch to "dealer’s choice" games such as Muflis (the lowest hand wins), AK47 (every Ace, King, Four and Seven is wild), joker games where a chosen card is wild, and Best of Four (you get four cards and keep your best three).',
  glossary: [
    {
      term: 'boot',
      definition:
        'The small entry bet everyone puts into the pot before the deal. In our games one boot is the basic betting unit, so a 3-player pot starts at 3 boots.',
    },
    {
      term: 'pot',
      definition:
        'All the boots and bets in the middle of the table. The winner of the hand takes the whole pot.',
    },
    {
      term: 'blind',
      definition:
        'Playing without looking at your cards. Blind players pay half price: a blind chaal costs the stake, e.g. 1 boot when the stake is 1.',
    },
    {
      term: 'see',
      definition:
        'To look at your three cards. It is free, you do it on your turn, and then you choose your move straight away.',
    },
    {
      term: 'seen',
      definition:
        'A player who has looked at their cards. Seen players pay double: a seen chaal costs twice the stake, e.g. 4 boots when the stake is 2.',
    },
    {
      term: 'stake',
      definition:
        'The current bet size, counted at the blind price. It starts at 1 boot and doubles each time someone raises: 1, 2, 4, 8.',
    },
    {
      term: 'chaal',
      definition:
        'A bet that keeps you in the hand: the stake if you are blind, twice the stake if you are seen. "I’ll chaal!"',
    },
    {
      term: 'raise',
      definition:
        'Bet double a chaal and double the stake for everyone after you. A blind raise at stake 1 costs 2 boots and makes the stake 2.',
    },
    {
      term: 'pack',
      definition:
        'To fold: give up the hand. You lose what you have already put in, but nothing more.',
    },
    {
      term: 'show',
      definition:
        'When only two players are left, either one can pay a chaal to turn both hands face up. The better hand wins; if they are exactly equal, the player who asked loses.',
    },
    {
      term: 'chaal limit',
      definition:
        'The stake can never go above 8 boots. Once it reaches 8 nobody can raise; you can still chaal.',
    },
    {
      term: 'pot limit',
      definition:
        'The pot can hold at most 64 boots. A bet that would go past 64 is cut down to fit, and once a chaal or raise brings the pot to 64, everyone still in shows their cards. Exact ties share the pot.',
    },
    {
      term: 'trail',
      definition:
        'Three cards of the same rank, like 7♠ 7♥ 7♦. The best hand type in Teen Patti (also called a set or trio); three Aces is the top trail.',
    },
    {
      term: 'pure sequence',
      definition:
        'Three cards in a row, all in the same suit, like 9♥ 10♥ J♥. The second-best hand type.',
    },
    {
      term: 'sequence',
      definition:
        'Three cards in a row in mixed suits, like 4♣ 5♦ 6♠ (also called a run). It beats a colour.',
    },
    {
      term: 'colour',
      definition: 'Three cards of the same suit that are not in a row, like 2♠ 8♠ K♠.',
    },
    {
      term: 'pair',
      definition: 'Two cards of the same rank plus one other card, like Q♦ Q♣ 5♥.',
    },
    {
      term: 'high card',
      definition:
        'A hand with nothing special, like A♥ 9♣ 3♦. It is named after its highest card — that one is "Ace high".',
    },
  ],
  lesson: [
    {
      title: 'The goal: win the pot',
      body: 'Teen Patti means "three cards". Everyone gets three cards and bets into a shared [[pot]]. You win the pot in one of two ways: be the last player left after everyone else [[packs|pack]], or hold the best hand when the cards are finally turned up at a [[show]].',
      scene: {
        zones: [
          {
            id: 'opp1',
            label: 'Opponent 1',
            cards: ['2C', '8D', 'JS'],
            layout: 'fan',
            faceDown: [0, 1, 2],
          },
          {
            id: 'opp2',
            label: 'Opponent 2',
            cards: ['5H', '9C', 'KD'],
            layout: 'fan',
            faceDown: [0, 1, 2],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['QH', 'QS', '4D'],
            layout: 'fan',
            highlight: [0, 1],
          },
        ],
        caption: 'Three cards each. Best hand — or last player standing — takes the pot.',
      },
    },
    {
      title: 'Boot first, then the deal',
      body: 'Before any cards come out, everyone puts one [[boot]] into the pot — think of it as the entry ticket. Then the dealer deals three cards to each player, face down, one at a time. The player on the dealer’s left starts, and play goes round the table from there.',
      scene: {
        zones: [
          {
            id: 'opp1',
            label: 'Opponent 1',
            cards: ['2C', '8D', 'JS'],
            layout: 'fan',
            faceDown: [0, 1, 2],
          },
          {
            id: 'opp2',
            label: 'Opponent 2',
            cards: ['5H', '9C', 'KD'],
            layout: 'fan',
            faceDown: [0, 1, 2],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['QH', 'QS', '4D'],
            layout: 'fan',
            faceDown: [0, 1, 2],
          },
        ],
        caption: 'Three players have each paid 1 boot, so the pot starts at 3 boots.',
        animate: 'deal',
      },
    },
    {
      title: 'Blind or seen?',
      body: 'Everyone starts [[blind]]: nobody has looked yet. On your turn you may [[see]] your cards — it’s free, and then you choose your move straight away. From then on you are [[seen]]. Blind players bet at half price, so many players stay blind for a round before they look.',
      scene: {
        zones: [
          {
            id: 'opp1',
            label: 'Opponent (still blind)',
            cards: ['2C', '8D', 'JS'],
            layout: 'fan',
            faceDown: [0, 1, 2],
          },
          {
            id: 'hand',
            label: 'Your hand (you chose to see)',
            cards: ['QH', 'QS', '4D'],
            layout: 'fan',
            highlight: [0, 1],
          },
        ],
        caption: 'You looked — a pair of Queens! Now you are a seen player.',
        animate: 'flip',
      },
      tip: 'You can still bet without ever looking. Some players love winning a whole hand blind!',
    },
    {
      title: 'Your turn: chaal, raise or pack',
      body: 'On your turn you [[chaal]] (bet to stay in), [[raise]] (bet double and push the [[stake]] up), or [[pack]] (give up). Blind players pay the stake; seen players pay twice the stake. With the stake at 1 boot: a blind chaal costs 1, a seen chaal 2; a blind raise costs 2, a seen raise 4 — and either raise makes the stake 2. The stake stops at the 8-boot [[chaal limit]].',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand (seen)',
            cards: ['QH', 'QS', '4D'],
            layout: 'fan',
            highlight: [0, 1],
          },
        ],
        caption: 'A pair of Queens is a good hand: a seen chaal costs 2 boots, a raise 4.',
      },
      tip: 'Packing isn’t losing badly — you only lose what you already put in.',
    },
    {
      title: 'The best hands: trail, pure sequence, sequence',
      body: 'At the top is a [[trail]]: three of a kind. Next is a [[pure sequence]]: three cards in a row in one suit. Then a [[sequence]]: three in a row in mixed suits. These are rare — fewer than 1 hand in 20 is a sequence or better.',
      scene: {
        zones: [
          { id: 'trail', label: '1. Trail', cards: ['7S', '7H', '7D'], layout: 'row' },
          {
            id: 'pure',
            label: '2. Pure sequence',
            cards: ['9H', 'TH', 'JH'],
            layout: 'row',
          },
          { id: 'seq', label: '3. Sequence', cards: ['4C', '5D', '6S'], layout: 'row' },
        ],
        caption: 'Strongest first: trail, pure sequence, sequence.',
        animate: 'none',
      },
    },
    {
      title: 'Everyday hands: colour, pair, high card',
      body: 'Below the sequences comes a [[colour]]: three cards of one suit, not in a row. Then a [[pair]]. Last is a [[high card]] hand, named after its top card. Careful: in Teen Patti a sequence beats a colour — the opposite of poker. Any pair already beats about three out of four hands.',
      scene: {
        zones: [
          { id: 'colour', label: '4. Colour', cards: ['2S', '8S', 'KS'], layout: 'row' },
          { id: 'pair', label: '5. Pair', cards: ['QD', 'QC', '5H'], layout: 'row' },
          { id: 'high', label: '6. High card', cards: ['AH', '9C', '3D'], layout: 'row' },
        ],
        caption: 'Colour beats pair, and pair beats high card.',
        animate: 'none',
      },
    },
    {
      title: 'Same kind of hand? Breaking ties',
      body: 'When two hands are the same kind, compare the highest card, then the next, then the last (Ace is high). A [[pair]] is compared by the pair first, then the odd card. A [[sequence]] has a special order: A-K-Q is the best, A-2-3 is second, then K-Q-J, Q-J-10 … down to 4-3-2. Suits never break a tie.',
      scene: {
        zones: [
          { id: 'top', label: 'Best sequence', cards: ['AH', 'KS', 'QD'], layout: 'row' },
          { id: 'second', label: 'Second best', cards: ['AC', '2D', '3S'], layout: 'row' },
          { id: 'third', label: 'Third best', cards: ['KD', 'QC', 'JH'], layout: 'row' },
        ],
        caption: 'A-K-Q, then A-2-3, then K-Q-J. No wrapping: K-A-2 is just Ace high.',
        animate: 'none',
      },
      tip: 'Exactly equal hands are rare, but they do happen — like A♠ K♦ 9♣ against A♥ K♣ 9♦.',
    },
    {
      title: 'How a hand ends: pack-out, show or pot limit',
      body: 'If everyone else packs, the last player wins without showing. When just two players are left, either can ask for a [[show]] by paying a chaal: both hands turn up and the better one wins. If they are exactly equal, the player who asked loses. Finally, the [[pot limit]] is 64 boots: a bet that would go past it is cut down to fit, and once a chaal or raise brings the pot to 64, everyone still in shows. Best hand wins; exact ties share the pot.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['8S', '8C', 'KH'],
            layout: 'fan',
            highlight: [0, 1],
          },
          { id: 'opp', label: 'Opponent', cards: ['AD', 'JC', '6H'], layout: 'fan' },
        ],
        caption: 'Show! A pair of Eights beats Ace high — the pot is yours.',
        animate: 'flip',
      },
      tip: 'Still blind when the next bet will reach the pot limit? Look first: seeing is free, and that bet makes everyone show.',
    },
    {
      title: 'A tiny hand, start to finish',
      body: 'Three players, pot 3 boots, stake 1. Asha stays [[blind]] and chaals 1. Ben looks, has a pair of Fives and chaals 2 (seen pays double). You look: J-Q-K in mixed suits — a [[sequence]]! You [[raise]]: 4 boots, and the stake becomes 2. Asha packs. Ben chaals 4. Now only two are left, so you ask for a [[show]] for 4 more. Your sequence beats his pair: you put in 9 boots and win the 18-boot pot.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['JD', 'QS', 'KC'],
            layout: 'fan',
            highlight: [0, 1, 2],
          },
          { id: 'ben', label: 'Ben', cards: ['5S', '5H', '9D'], layout: 'fan' },
          {
            id: 'asha',
            label: 'Asha (packed)',
            cards: ['2H', '7C', 'TD'],
            layout: 'fan',
            faceDown: [0, 1, 2],
          },
        ],
        caption: 'Pot: 3 + 1 + 2 + 4 + 4 + 4 = 18 boots. Sequence beats pair!',
        animate: 'flip',
      },
    },
    {
      title: 'Beginner strategy',
      body: 'Stay [[blind]] for the first round — it’s cheap. Then look. With a [[pair]] or better, stay in and think about raising. With a weak [[high card]] hand (no Ace or King), [[pack]] early instead of chasing boots you have already spent. If a seen player keeps raising, they usually have something. Down to two and probably ahead? Ask for a [[show]].',
      scene: {
        zones: [
          {
            id: 'good',
            label: 'Worth playing',
            cards: ['TC', 'TS', '3H'],
            layout: 'fan',
            highlight: [0, 1],
          },
          { id: 'weak', label: 'Usually pack', cards: ['8H', '5C', '2D'], layout: 'fan' },
        ],
        caption: 'A pair of Tens is worth a fight; 8-5-2 in mixed suits is not.',
        animate: 'none',
      },
      tip: 'In practice mode, ask the coach what a steady player would do — it’s a great way to learn.',
    },
  ],
  mistakes: [
    'Looking at your cards on the very first turn every time — a round of blind play costs half as much.',
    'Forgetting that seen players pay double: at a stake of 2, a seen chaal is 4 boots, not 2.',
    'Thinking a colour beats a sequence. In Teen Patti a sequence (three in a row) is higher.',
    'Treating A-2-3 as the lowest sequence. Here it is the second highest, just below A-K-Q.',
    'Trying to ask for a show while three or more players are still in — a show is only for the last two.',
    'Staying in with a weak high card just because you have already put boots in the pot.',
    'Asking for a show with a hand you are unsure about — remember, the asker loses an exact tie.',
  ],
  tips: [
    'Tip: in Teen Patti, play the first round blind — a blind chaal costs half of a seen one.',
    'Tip: any pair beats about three out of four hands. That is a good hand to stay in with.',
    'Tip: when a seen player raises, they usually have something. Pack weak high cards against them.',
    'Tip: down to two players with a decent hand? Asking for a show settles it before the stake climbs.',
    'Tip: A-K-Q and A-2-3 are the two best sequences — and any sequence beats a colour.',
    'Tip: packing early is not losing big. It saves your boots for the hands worth fighting for.',
    'Tip: only ask for a show when you think you are ahead — exactly equal hands go against the asker.',
  ],
  quiz: [
    {
      question: 'Which hand wins: a pure sequence (9♥ 10♥ J♥) or a trail of three Fours?',
      options: ['The pure sequence', 'They tie', 'The trail', 'Whoever bet more'],
      answer: 2,
      explanation:
        'A trail (three of a kind) is the best hand type in Teen Patti, so even three Fours beat any pure sequence.',
    },
    {
      question:
        'The stake is 2 boots and you have already seen your cards. What does a chaal cost you?',
      options: ['4 boots', '2 boots', '1 boot', '8 boots'],
      answer: 0,
      explanation:
        'Seen players pay twice the stake, so a chaal costs 2 × 2 = 4 boots. A seen raise would cost 8.',
    },
    {
      question: 'Which is higher: a sequence (4♣ 5♦ 6♠) or a colour (A♥ K♥ 9♥)?',
      options: ['The colour', 'The sequence', 'They are equal'],
      answer: 1,
      explanation:
        'In Teen Patti the order is trail, pure sequence, sequence, colour, pair, high card — so a sequence beats a colour.',
    },
    {
      question: 'When can you ask for a show?',
      options: [
        'Any time on your turn',
        'Only while you are still blind',
        'Only after the stake reaches 8 boots',
        'Only when just two players are left',
      ],
      answer: 3,
      explanation:
        'A show is only allowed when exactly two players remain. It costs the same as a chaal, and both hands are turned up.',
    },
    {
      question:
        'It is the first round, you are blind and the stake is 1 boot. What is a sensible, cheap move?',
      options: [
        'Pack straight away',
        'Chaal blind for 1 boot',
        'Raise every turn until the limit',
        'Ask for a show',
      ],
      answer: 1,
      explanation:
        'A blind chaal costs only 1 boot and keeps you in. You can look at your cards next turn before the betting gets expensive.',
    },
  ],
  seo: {
    description:
      'Learn Teen Patti step by step: boot, blind and seen play, chaal, show and hand rankings — then play a coached hand against friendly bots.',
  },
});
