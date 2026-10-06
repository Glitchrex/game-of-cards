import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'baccarat',
  name: 'Baccarat',
  aka: ['Punto Banco', 'Baccara'],
  origin: { country: 'France', countryCode: 'FR', region: 'europe' },
  type: 'casino',
  players: { min: 1, max: 14, ideal: 1 },
  deck: 'Eight standard 52-card decks shuffled together in a shoe (416 cards, no jokers)',
  difficulty: 1,
  length: 'About a minute a coup',
  minutes: 1,
  moods: ['lucky', 'chill', 'social'],
  hook: 'James Bond’s card game: bet on Player or Banker, then watch which hand gets closer to 9',
  history:
    'Baccarat’s roots are uncertain. It is often said to have come from Italy several centuries ' +
    'ago, and its name is usually linked to the Italian word for zero — fitting, because tens and ' +
    'picture cards count as nothing. By the 1800s it was a favourite in French gaming rooms, in ' +
    'versions called chemin de fer and baccarat banque. The version we teach, Punto Banco, where ' +
    'the house deals both hands and every draw follows fixed rules, is thought to have grown up ' +
    'in Latin America before reaching Las Vegas in the mid-1900s. Today it is the biggest casino ' +
    'game in Macau — and, in its older chemin de fer form, it is the game James Bond plays in ' +
    'Ian Fleming’s first novel, Casino Royale.',
  featured: false,
  order: 60,
  variantTaught:
    'Punto Banco with an 8-deck shoe, shuffled fresh for every coup, one learner against the ' +
    'house. You bet one stake on Player, Banker or Tie. The dealer then deals two cards to each ' +
    'hand — Player, Banker, Player, Banker, all face up — and any third cards by the standard ' +
    'fixed rules: a natural (8 or 9 in two cards) stops the deal; otherwise Player draws on 0–5 ' +
    'and stands on 6–7, and Banker follows the standard third-card table. The total closer to 9 ' +
    'wins. Player pays 1 to 1, Banker 0.95 to 1 (a 5% commission) and Tie 8 to 1; Player and ' +
    'Banker bets push (come back) on a tie. Bets lock once the deal starts, and there are no ' +
    'side bets.',
  variants:
    'Mini-baccarat is the same game at a smaller, faster table. Many casinos also offer ' +
    '“no-commission” tables, where a Banker win pays 1 to 1 except in one special case — for ' +
    'example, paying only half when Banker wins with a 6, or turning a Banker win with a ' +
    'three-card 7 into a push. Some tables pay 9 to 1 on a Tie. In the older French games the ' +
    'bank is held at the table — in chemin de fer it passes from player to player, while in ' +
    'baccarat banque one banker keeps it — and some draws are a choice, such as whether to ' +
    'draw on a 5. Casinos often add side bets such as Player Pair and Banker Pair; ' +
    'we leave them out to keep your first games simple. Real casinos also deal several coups ' +
    'from one shoe, while ours is shuffled fresh every time.',
  glossary: [
    {
      term: 'Player',
      definition:
        'One of the two hands on the table (also called Punto). It is just a name — it is not you. A winning Player bet pays 1 to 1: bet 100, win 100.',
    },
    {
      term: 'Banker',
      definition:
        'The other hand on the table (also called Banco). It is not the dealer’s money — just a name. A winning Banker bet pays 0.95 to 1: bet 100, win 95.',
    },
    {
      term: 'Tie',
      definition:
        'A bet that both hands finish on the same total, such as 6 and 6. It pays 8 to 1, but it only wins about one coup in ten.',
    },
    {
      term: 'coup',
      definition:
        'One round of Baccarat: you bet, the dealer deals both hands, and the hand closer to 9 wins (equal totals are a tie). A coup takes about a minute.',
    },
    {
      term: 'shoe',
      definition:
        'The box the dealer deals from. Ours holds eight decks shuffled together — 416 cards — and is shuffled fresh for every coup.',
    },
    {
      term: 'total',
      definition:
        'A hand’s score. Add up the card values and keep only the last digit: a 7 and a 6 make 13, which counts as 3. Totals go from 0 to 9.',
    },
    {
      term: 'natural',
      definition:
        'A total of 8 or 9 from a hand’s first two cards, like a 4 and a 5. A natural ends the coup at once: nobody gets a third card.',
    },
    {
      term: 'third card',
      definition:
        'One extra card a hand may get after its first two. Fixed rules decide it — for example, Player always draws on 0–5 — so nobody ever chooses.',
    },
    {
      term: 'commission',
      definition:
        'The 5% the house keeps from a winning Banker bet. That is why Banker pays 0.95 to 1: bet 100 and you win 95 instead of 100.',
    },
    {
      term: 'push',
      definition:
        'A result where your bet simply comes back — no win, no loss. Player and Banker bets push when the coup is a tie.',
    },
    {
      term: 'house edge',
      definition:
        'How much of each bet the house keeps on average. In our game it is about 1.06% on Banker, 1.24% on Player and 14.4% on Tie.',
    },
    {
      term: 'stake',
      definition:
        'How much you bet on a coup. Here it is always pretend coins called Jeet — for example a stake of 100 Jeet.',
    },
  ],
  lesson: [
    {
      title: 'The goal: closer to 9',
      body:
        'Baccarat is a guessing game with two hands of cards. One hand is called [[Player]] and ' +
        'the other is called [[Banker]] — they are just names, neither one is you. You bet on ' +
        'which hand will finish closer to 9, or that they will [[Tie]]. Then you sit back: the ' +
        'dealer does everything else.',
      scene: {
        zones: [
          {
            id: 'player',
            label: 'Player: 9',
            cards: ['4D', '5C'],
            layout: 'row',
            highlight: [0, 1],
          },
          { id: 'banker', label: 'Banker: 7', cards: ['KS', '7H'], layout: 'row' },
        ],
        caption: 'Player has 9, Banker has 7. Player wins!',
        animate: 'deal',
      },
      tip: 'You never play a hand yourself — you only pick which hand wins.',
    },
    {
      title: 'Counting: only the last digit',
      body:
        'Aces count 1. Cards 2 to 9 count their number. Tens, Jacks, Queens and Kings count 0. ' +
        'To find a hand’s [[total]], add the cards and keep only the last digit: a 7 and a 6 ' +
        'make 13, so the hand is worth 3. A hand can never go over 9 — and it can never bust.',
      scene: {
        zones: [
          {
            id: 'numbers',
            label: 'Count their number',
            cards: ['AS', '2H', '5D', '9C'],
            layout: 'row',
          },
          { id: 'zeros', label: 'Count 0', cards: ['TH', 'JS', 'QD', 'KC'], layout: 'row' },
          {
            id: 'example',
            label: '7 + 6 = 13 → worth 3',
            cards: ['7H', '6S'],
            layout: 'row',
            highlight: [0, 1],
          },
        ],
        caption: 'Picture cards and tens are worth nothing; 13 counts as 3.',
        animate: 'flip',
      },
      tip: 'Drop the tens: 15 is a 5, 18 is an 8, and 10 is a 0.',
    },
    {
      title: 'Place your bet',
      body:
        'Before any card is dealt, put your [[stake]] — pretend coins called Jeet — on Player, ' +
        'Banker or Tie. The cards come from a [[shoe]] of eight decks, shuffled fresh for every ' +
        '[[coup]]. Once the dealing starts, bets are locked: no switching!',
      scene: {
        zones: [
          {
            id: 'shoe',
            label: 'Shoe: 416 cards',
            cards: ['AS', '2C', '3H'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
        ],
        caption: 'Player, Banker or Tie? Choose before the first card comes out.',
        animate: 'none',
      },
    },
    {
      title: 'The deal: two cards each',
      body:
        'The dealer deals four cards face up, one at a time: Player, Banker, Player, Banker. ' +
        'Each hand now has two cards and a [[total]]. Nobody makes any choices — not you, not ' +
        'the dealer. What happens next depends only on these totals.',
      scene: {
        zones: [
          { id: 'player', label: 'Player: 5', cards: ['3C', '2D'], layout: 'row' },
          { id: 'banker', label: 'Banker: 6', cards: ['6H', 'KS'], layout: 'row' },
        ],
        caption: 'Player has 5, Banker has 6. No 8 or 9 — so the drawing rules come next.',
        animate: 'deal',
      },
    },
    {
      title: 'A natural stops everything',
      body:
        'If either hand’s first two cards make 8 or 9, that is a [[natural]]. The coup ends ' +
        'right there: nobody gets a [[third card]], and the higher total wins. A natural 9 can ' +
        'only be matched by another natural 9.',
      scene: {
        zones: [
          {
            id: 'player',
            label: 'Player: 8',
            cards: ['8D', 'KH'],
            layout: 'row',
            highlight: [0, 1],
          },
          { id: 'banker', label: 'Banker: 5', cards: ['3S', '2C'], layout: 'row' },
        ],
        caption: 'Player has a natural 8. Banker can’t draw — Player wins 8 to 5.',
        animate: 'deal',
      },
    },
    {
      title: 'Player’s third card',
      body:
        'With no natural on the table, Player goes first. Player’s rule is simple: draw a ' +
        '[[third card]] on 0 to 5, stand on 6 or 7. The dealer does it for you — you only ' +
        'watch the new total.',
      scene: {
        zones: [
          {
            id: 'player',
            label: 'Player: 9',
            cards: ['3C', '2D', '4S'],
            layout: 'row',
            highlight: [2],
          },
          { id: 'banker', label: 'Banker: 6', cards: ['6H', 'KS'], layout: 'row' },
        ],
        caption:
          'Player had 5, so it drew a 4 to make 9. Banker’s 6 stands against a 4 — Player wins 9 to 6.',
        animate: 'deal',
      },
      tip: 'Player draws on 0–5 and stands on 6–7. That’s the whole Player rule.',
    },
    {
      title: 'Banker’s third card',
      body:
        'Banker draws last. If Player stood, Banker uses the same rule: draw on 0–5, stand on ' +
        '6 or 7. If Player drew, Banker looks at Player’s third card: on 0–2 Banker always ' +
        'draws; on 3 it draws unless that card was an 8; on 4 it draws if it was 2–7; on 5 if ' +
        'it was 4–7; on 6 if it was a 6 or 7; on 7 it stands. You never need to memorise this ' +
        '— the dealer follows the table for you.',
      scene: {
        zones: [
          { id: 'player', label: 'Player: 8', cards: ['AC', '4H', '3D'], layout: 'row' },
          {
            id: 'banker',
            label: 'Banker: 9',
            cards: ['4S', 'QC', '5H'],
            layout: 'row',
            highlight: [2],
          },
        ],
        caption:
          'Player drew a 3 to reach 8. Banker had 4, and a 3 is in the 2–7 range, so Banker drew a 5 — Banker wins 9 to 8.',
        animate: 'deal',
      },
    },
    {
      title: 'How bets are paid',
      body:
        'A winning Player bet pays 1 to 1: bet 100, win 100. A winning Banker bet pays 0.95 to ' +
        '1 because the house keeps a 5% [[commission]]: bet 100, win 95. A winning [[Tie]] bet ' +
        'pays 8 to 1. If the coup is a tie, Player and Banker bets are a [[push]] — they simply ' +
        'come back to you. Any other result loses your stake.',
      scene: {
        zones: [
          { id: 'player', label: 'Player: 7', cards: ['7C', 'KD'], layout: 'row' },
          { id: 'banker', label: 'Banker: 7', cards: ['4C', '3H'], layout: 'row' },
        ],
        caption: 'A tie at 7: Tie bets win 8 to 1, Player and Banker bets come back.',
        animate: 'deal',
      },
    },
    {
      title: 'A tiny example',
      body:
        'You bet 100 Jeet on [[Banker]]. Player gets a 6 and a Jack: 6, so Player stands. ' +
        'Banker gets a 3 and a 2: 5. Player stood, so Banker draws on 5 — a 3, making 8. ' +
        'Banker wins 8 to 6! You get your 100 back and win 95 more (100 minus the 5% ' +
        '[[commission]]).',
      scene: {
        zones: [
          { id: 'player', label: 'Player: 6', cards: ['6D', 'JC'], layout: 'row' },
          {
            id: 'banker',
            label: 'Banker: 8 — your bet',
            cards: ['3C', '2S', '3D'],
            layout: 'row',
            highlight: [2],
          },
        ],
        caption: 'Banker wins 8 to 6: your 100 Jeet bet wins 95.',
        animate: 'deal',
      },
    },
    {
      title: 'Beginner strategy: bet Banker, skip the Tie',
      body:
        'Every bet is luck, but they are not equally kind. Banker draws last, so it wins a ' +
        'little more often: about 45.86% of coups, against 44.62% for Player and 9.52% ties. ' +
        'Even after the commission, Banker has the smallest [[house edge]] — about 1.06%, so on ' +
        'average you lose about 1 Jeet per 100 bet. Player’s edge is about 1.24%. The Tie pays ' +
        '8 to 1 but wins so rarely that its edge is about 14.4%. Every coup is a fresh shuffle, ' +
        'so streaks never tell you what comes next.',
      scene: {
        zones: [
          { id: 'player', label: 'Player: 2', cards: ['TS', '5D', '7D'], layout: 'row' },
          {
            id: 'banker',
            label: 'Banker: 7',
            cards: ['2H', '2C', '3S'],
            layout: 'row',
            highlight: [2],
          },
        ],
        caption:
          'Banker draws last: it saw Player’s third card was a 7, drew a 3 — Banker wins 7 to 2.',
        animate: 'deal',
      },
      tip: 'Banker is the best bet on the table; the Tie is the worst.',
    },
  ],
  mistakes: [
    'Thinking you are the Player hand. Player and Banker are just the names of the two hands — you bet on one of them.',
    'Adding totals like in Blackjack. Only the last digit counts: 8 + 7 = 15 is a 5, and a hand can never bust.',
    'Waiting to decide whether to take a third card. Every draw follows fixed rules; the dealer does it automatically.',
    'Chasing the Tie because 8 to 1 looks big. Ties are rare, and the Tie has by far the biggest house edge (about 14.4%).',
    'Expecting a Banker win to pay 1 to 1. The house keeps a 5% commission, so it pays 0.95 to 1.',
    'Believing a hand is “due” after a streak. Our shoe is shuffled fresh for every coup — the cards have no memory.',
  ],
  tips: [
    'Tip: in Baccarat, Banker is the best bet — even after the 5% commission its house edge is only about 1.06%.',
    'Tip: skip the Tie. 8 to 1 sounds big, but ties come up only about 9.5% of the time, so it costs about 14.4% of every bet.',
    'Tip: only the last digit counts — a 9 and a 6 make 15, which is a 5.',
    'Tip: tens and picture cards count 0 and Aces count 1, so a King and a 9 is a natural 9.',
    'Tip: a natural (8 or 9 in the first two cards) ends the coup straight away — nobody draws.',
    'Tip: on a tie, Player and Banker bets push and come back to you, so a tie never costs you on those bets.',
    'Tip: Player draws on 0–5 and stands on 6–7; Banker’s rules are trickier, but the dealer handles them for you.',
    'Tip: a loss in Baccarat is pure chance, not a mistake — keep your stake steady and enjoy the next coup.',
  ],
  quiz: [
    {
      question: 'A hand has a 7 and a 6. What is it worth?',
      options: ['13', '3', '6', '1'],
      answer: 1,
      explanation:
        '7 + 6 = 13, and only the last digit counts, so the hand is worth 3. Totals never go above 9.',
    },
    {
      question: 'You bet 100 Jeet on Banker and Banker wins. How much do you win?',
      options: ['100 Jeet', '105 Jeet', '95 Jeet', '80 Jeet'],
      answer: 2,
      explanation:
        'Banker pays 0.95 to 1 because the house keeps a 5% commission: you win 95 Jeet, and your 100 Jeet stake comes back too.',
    },
    {
      question: 'You bet on Player and the coup ends in a tie. What happens to your bet?',
      options: [
        'You lose it',
        'It pushes — you get it back',
        'It wins 8 to 1',
        'It moves over to Banker',
      ],
      answer: 1,
      explanation:
        'Player and Banker bets push on a tie: no win, no loss. Only a Tie bet wins 8 to 1 when the totals are equal.',
    },
    {
      question: 'Player’s first two cards make 8 and Banker’s make 5. What happens next?',
      options: [
        'Player has a natural, so nobody draws and Player wins 8 to 5',
        'Player must take a third card',
        'Banker draws because it has 5',
        'You decide whether Player draws',
      ],
      answer: 0,
      explanation:
        'An 8 or 9 in the first two cards is a natural. It stops the coup at once — no third cards — and the higher total wins.',
    },
    {
      question: 'Which bet has the smallest house edge?',
      options: ['Tie', 'Player', 'They are all the same', 'Banker'],
      answer: 3,
      explanation:
        'Banker wins a little more often because it draws last. Even after the 5% commission its edge is about 1.06%, against 1.24% for Player and 14.4% for Tie.',
    },
  ],
  seo: {
    description:
      'Learn Baccarat (Punto Banco) step by step: card values, naturals, the third-card rules and why Banker is the best bet — then play a coached coup with pretend coins.',
  },
});
