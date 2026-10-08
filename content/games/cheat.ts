import { defineGame } from '@/lib/content/schema';

export default defineGame({
  slug: 'cheat',
  name: 'Cheat',
  aka: ['Bluff', 'I Doubt It'],
  origin: { country: 'Worldwide', countryCode: 'UN', region: 'global' },
  type: 'shedding',
  players: { min: 3, max: 8, ideal: 4 },
  deck: 'One standard 52-card deck, no jokers (shuffle two decks together for a big group)',
  difficulty: 1,
  length: '10–20 minutes a game',
  minutes: 15,
  moods: ['social', 'competitive'],
  hook: 'The game where fibbing is allowed: sneak your cards away — unless someone shouts “Cheat!”',
  history:
    'Cheat is a classic bluffing game that goes by many names: Cheat in Britain, I Doubt It in ' +
    'many older American card books, Bluff in lots of homes — and a cheekier name in American ' +
    'schoolyards that usually gets shortened to “BS”. Nobody knows who first thought of it, but ' +
    'the idea of playing cards face down, saying what they are and daring someone to doubt you ' +
    'has kept families laughing for generations.',
  featured: false,
  order: 150,
  variantTaught:
    'Classic Cheat for 3–8 players (taught with four) with one 52-card deck. Deal out every card ' +
    '(some players may get one more). The player on the dealer’s left starts, and turns go ' +
    'clockwise. On your turn you put 1 to 4 cards face down on the pile and say how many cards ' +
    'they are and what rank — and the rank must be the next one in order: the first player claims ' +
    'Aces, the next player 2s, then 3s, and so on up to Kings, then back to Aces. The number you ' +
    'say must match the cards you put down, but the rank can be a lie. You may not pass: if you ' +
    'have none of the rank, you must still play at least one card. Before the next player plays, ' +
    'anyone may call “Cheat!” (the first to call is the challenger): the cards just played are ' +
    'turned face up. If any of them is not the rank that was claimed, the player who played them ' +
    'picks up the whole pile; if they were all true, the challenger picks up the whole pile. Play ' +
    'then carries on with the next player and the next rank. The first player to get rid of all ' +
    'their cards wins — but a last play can be challenged too, and if it was a lie, that player ' +
    'picks up the pile and the game goes on.',
  variants:
    'Many British tables let you claim the same rank as the last player, one higher or one lower, ' +
    'which gives you more chances to tell the truth. Some groups allow passing, some let you play ' +
    'any number of cards, and some only allow the next player to challenge. Big groups often ' +
    'shuffle two decks together. Some families start with the player holding the A♠ (or the 2♣), ' +
    'and some keep playing after the winner goes out to decide second and third place.',
  glossary: [
    {
      term: 'suit',
      definition:
        'One of the four families of cards: Spades ♠, Hearts ♥, Diamonds ♦ and Clubs ♣. In Cheat suits never matter — only ranks do.',
    },
    {
      term: 'rank',
      definition:
        'What a card is, ignoring its suit: Ace, 2, 3 … 10, Jack, Queen or King. The 7♥ and the 7♣ have the same rank.',
    },
    {
      term: 'pile',
      definition:
        'The heap of face-down cards in the middle. It grows every turn — until someone has to pick the whole thing up.',
    },
    {
      term: 'claim',
      definition:
        'What you say as you put your cards down: how many and what rank, like “Two Fives!”. The number must be true; the rank might not be.',
    },
    {
      term: 'bluff',
      definition:
        'Playing cards that are not what you claim, and acting as if they are. Saying “One Seven” while putting down a King is a bluff.',
    },
    {
      term: 'call Cheat',
      definition:
        'Shouting “Cheat!” when you think the last claim was a lie. The cards are turned over to find out who was right.',
    },
    {
      term: 'pick up the pile',
      definition:
        'The penalty in Cheat: you take every card in the pile into your hand. It happens to a caught liar — or to a wrong challenger.',
    },
    {
      term: 'going out',
      definition:
        'Getting rid of your very last card. If nobody catches you lying on that play, you have won!',
    },
  ],
  lesson: [
    {
      title: 'The goal: be the first with no cards',
      body:
        'In Cheat you race to get rid of every card in your hand. You put cards face down on a ' +
        '[[pile]] and say what they are — and here is the fun part: you are allowed to lie! But ' +
        'if someone catches you, you have to take the whole pile.',
      scene: {
        zones: [
          {
            id: 'pile',
            label: 'The pile (face down)',
            cards: ['9C', 'KD', '4H'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['3S', '7D', 'JC'],
            layout: 'fan',
          },
        ],
        caption: 'Three cards to go. Nobody knows what is really in that pile…',
        animate: 'deal',
      },
    },
    {
      title: 'Setting up: deal out every card',
      body:
        'Shuffle one deck and deal ALL the cards out, one at a time. With four players everyone ' +
        'gets 13; with other numbers some players get one card more — that’s fine. Pick up your ' +
        'hand and sort it by [[rank]], so you can quickly see how many of each card you hold. ' +
        '[[Suits|suit]] don’t matter at all in Cheat.',
      scene: {
        zones: [
          {
            id: 'hand',
            label: 'Your hand, sorted by rank',
            cards: ['AC', '2H', '4S', '4D', '5C', '7H', '8S', '9D', 'TC', 'JS', 'JH', 'QD', 'KC'],
            layout: 'fan',
            highlight: [2, 3, 9, 10],
          },
        ],
        caption: 'Sorted by rank: two 4s and two Jacks are easy to spot.',
        animate: 'deal',
      },
      tip: 'The player on the dealer’s left goes first, and turns go clockwise.',
    },
    {
      title: 'A turn: put cards down and claim them',
      body:
        'On your turn, put 1 to 4 cards face down on the [[pile]] and make a [[claim]]: say out ' +
        'loud how many cards they are and what [[rank]] — “Two Fives!”. Everyone can see how many ' +
        'cards you put down, so the number must be true.',
      scene: {
        zones: [
          {
            id: 'pile',
            label: 'The pile',
            cards: ['KD', '9C'],
            layout: 'stack',
            faceDown: [0, 1],
          },
          {
            id: 'played',
            label: 'You put down 2 cards: “Two Fives!”',
            cards: ['5H', '5C'],
            layout: 'row',
            faceDown: [0, 1],
            highlight: [0, 1],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['3C', '8H', 'JD', 'QS'],
            layout: 'fan',
          },
        ],
        caption: 'Two cards, face down. (This time they really are the 5♥ and 5♣.)',
        animate: 'deal',
      },
    },
    {
      title: 'The ranks go up in order',
      body:
        'You can’t claim just any [[rank]]. The first player claims Aces, the next player 2s, the ' +
        'next 3s, and so on up to Kings — then back to Aces again. So each [[claim]] is decided ' +
        'for you: you only choose which cards to put down, and how many.',
      scene: {
        zones: [
          {
            id: 'ladder',
            label: 'Turn by turn: Aces, 2s, 3s, 4s, 5s…',
            cards: ['AS', '2H', '3C', '4D', '5S'],
            layout: 'row',
            highlight: [0],
          },
          {
            id: 'wrap',
            label: '…Jacks, Queens, Kings, then Aces again',
            cards: ['JD', 'QC', 'KH', 'AD'],
            layout: 'row',
            highlight: [3],
          },
        ],
        caption: 'After Kings, the ladder starts again at Aces.',
        animate: 'deal',
      },
      tip: 'With four players you claim every fourth rank: start on Aces and your next claims are 5s, 9s and Kings.',
    },
    {
      title: 'Lying is allowed',
      body:
        'Don’t have the rank you need? No problem — put down other cards and claim it anyway. ' +
        'That is a [[bluff]]. You can also sneak an extra card in with real ones. But you may ' +
        'never pass: every turn you must put down at least one card.',
      scene: {
        zones: [
          {
            id: 'played',
            label: 'You say “One Seven”… but it’s really:',
            cards: ['KD'],
            layout: 'row',
            highlight: [0],
          },
          {
            id: 'hand',
            label: 'Your hand (no 7s at all)',
            cards: ['2C', '4H', '9S', 'TD', 'QH'],
            layout: 'fan',
          },
        ],
        caption: 'A calm voice and a straight face — nobody knows it’s a King.',
        animate: 'deal',
      },
      tip: 'Keep the same speed and the same voice every turn, true or not.',
    },
    {
      title: 'Calling “Cheat!”',
      body:
        'After any play, before the next player goes, anyone who doubts the claim may ' +
        '[[call Cheat]]. The cards just played are turned face up. If even one is not the claimed ' +
        'rank, the liar must [[pick up the pile]] — the whole thing! But if every card was true, ' +
        'the player who called Cheat picks it up instead. Either way, a fresh pile starts and the ' +
        'next player carries on with the next rank.',
      scene: {
        zones: [
          {
            id: 'revealed',
            label: '“Two Jacks”, turned over:',
            cards: ['JS', '4H'],
            layout: 'row',
            highlight: [1],
          },
          {
            id: 'pile',
            label: '…and the rest of the pile goes to the liar',
            cards: ['9C', '2D', '6S'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
        ],
        caption: 'Caught! The 4♥ is not a Jack, so the liar takes every card.',
        animate: 'flip',
      },
    },
    {
      title: 'Going out and winning',
      body:
        'The first player to get rid of all their cards wins. But your last play can be challenged ' +
        'too! If someone calls Cheat and you were telling the truth, you have gone ' +
        '[[out|going out]] and won. If you lied, you pick up the pile and the game goes on.',
      scene: {
        zones: [
          {
            id: 'last',
            label: 'Your last card: “One Queen”',
            cards: ['QH'],
            layout: 'row',
            highlight: [0],
          },
          {
            id: 'pile',
            label: 'The pile',
            cards: ['3D', 'JC', '8S'],
            layout: 'stack',
            faceDown: [0, 1, 2],
          },
        ],
        caption: 'Call Cheat if you like — it’s a real Queen. You win!',
        animate: 'deal',
      },
    },
    {
      title: 'A tiny example',
      body:
        'The player before you puts down three cards: “Three Eights.” You hold the 8♠ and the 8♥. ' +
        'There are only four 8s in the deck, so they can have two at most — that [[claim]] must be ' +
        'a lie! You [[call Cheat]]. The cards are turned over: the 8♦, the 3♣ and the K♠. Caught! ' +
        'They [[pick up the pile]].',
      scene: {
        zones: [
          {
            id: 'revealed',
            label: '“Three Eights”, turned over:',
            cards: ['8D', '3C', 'KS'],
            layout: 'row',
            highlight: [1, 2],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['8S', '8H', '2D', '6C', 'QD'],
            layout: 'fan',
            highlight: [0, 1],
          },
        ],
        caption: 'Your two 8s proved it: nobody else could have three.',
        animate: 'flip',
      },
    },
    {
      title: 'Beginner strategy',
      body:
        'Tell the truth whenever you can — it makes your lies easier to believe. When you must ' +
        '[[bluff]], use just one card, or hide one stranger among real cards. Count what you hold: ' +
        'if you have three 9s, nobody can honestly claim two. And always [[call Cheat]] on a ' +
        'player’s last card — if they are honest they win anyway, so you have nothing to lose.',
      scene: {
        zones: [
          {
            id: 'played',
            label: '“Three Sixes!” (two real, one stranger)',
            cards: ['6S', '6D', 'JC'],
            layout: 'row',
            highlight: [2],
          },
          {
            id: 'hand',
            label: 'Your hand',
            cards: ['2H', '9C', '9D', '9S', 'KH'],
            layout: 'fan',
            highlight: [1, 2, 3],
          },
        ],
        caption: 'A fib hidden among true cards — and three 9s that tell you who is lying later.',
        animate: 'deal',
      },
      tip: 'Lying is cheapest early, while the pile is small. Calling is riskiest when the pile is huge.',
    },
  ],
  mistakes: [
    'Claiming the wrong rank — after Sixes comes Sevens, whatever you are holding.',
    'Telling a giant lie with three or four cards when a one-card fib would do.',
    'Never calling Cheat, so even impossible claims slip through.',
    'Calling Cheat on every play, and picking up one huge pile after another.',
    'Letting a player’s last card go unchallenged — there was nothing to lose!',
    'Giving yourself away: hesitating, giggling or taking ages only when you are lying.',
  ],
  tips: [
    'Tip: in Cheat, tell the truth whenever you can — your lies are easier to believe when you are usually honest.',
    'Tip: when you have to lie, lie with just one card.',
    'Tip: hide one extra card among real ones — two real 6s plus a stranger make a believable “Three Sixes”.',
    'Tip: count what you hold — if you have three 9s, anybody claiming two 9s must be lying.',
    'Tip: always call Cheat on a player’s last card; if they are honest, they win either way.',
    'Tip: lie early while the pile is small, and think twice before calling Cheat when the pile is huge.',
    'Tip: with four players you claim every fourth rank — work out your next few ranks and save real cards for them.',
  ],
  quiz: [
    {
      question: 'The player before you claimed “Two Nines”. What rank must you claim?',
      options: ['Nines', 'Tens', 'Eights', 'Any rank you like'],
      answer: 1,
      explanation:
        'The ranks go up one at a time, so after Nines comes Tens — whatever cards you actually hold.',
    },
    {
      question: 'You must claim Kings, but you don’t have a single King. What do you do?',
      options: [
        'Pass your turn',
        'Draw a card from the pile',
        'Show everyone your hand',
        'Put down at least one card anyway and claim Kings',
      ],
      answer: 3,
      explanation:
        'You can’t pass in Cheat. Put down one or more cards face down and claim Kings — that is a bluff, and it’s allowed.',
    },
    {
      question:
        'You call “Cheat!”, the cards are turned over, and they really are what was claimed. Who picks up the pile?',
      options: ['You, the caller', 'The player who played them', 'Nobody — the pile is discarded'],
      answer: 0,
      explanation:
        'A wrong challenge costs the challenger: you pick up the whole pile. That is why you shouldn’t call Cheat on every play.',
    },
    {
      question:
        'You hold three Jacks. The player before you claims “Two Jacks”. What should you do?',
      options: [
        'Stay quiet — it’s probably true',
        'Wait and call Cheat on the next player instead',
        'Call Cheat — only one other Jack exists',
      ],
      answer: 2,
      explanation:
        'There are only four Jacks. With three in your hand, nobody can honestly put down two, so it must be a lie.',
    },
    {
      question: 'A player puts down their very last card. Should you call Cheat?',
      options: [
        'No — it’s rude to challenge the last card',
        'Yes — if they are honest they win anyway, so you lose nothing',
        'Only if the pile is small',
        'No — last cards can’t be challenged',
      ],
      answer: 1,
      explanation:
        'If you stay quiet, they win. If you call and they lied, they pick up the pile and the game goes on. Always challenge a last card!',
    },
  ],
  example: {
    intro:
      'A four-player game: you, Ava on your left, Ben opposite and Cara on your right. Cara deals. You make the calls — when to tell the truth, when to fib and when to shout “Cheat!”.',
    steps: [
      {
        narration:
          'Cara deals all 52 cards — 13 each. You sit on the dealer’s left, so you start, and the first [[claim]] must be Aces. You have exactly one Ace, the A♥.',
        scene: {
          zones: [
            {
              id: 'hand',
              label: 'Your hand (13 cards)',
              cards: ['AH', '2S', '3S', '3D', '4S', '6D', '7C', '9H', 'TD', 'JH', 'QD', 'KS', 'KD'],
              layout: 'fan',
              highlight: [0],
            },
          ],
          caption: 'Your turn first. The claim must be Aces.',
          animate: 'deal',
        },
        decision: {
          prompt: 'What do you play?',
          options: [
            {
              label: 'Pass — keep the Ace for later',
              correct: false,
              feedback: 'You can’t pass in Cheat: every turn you must put down at least one card.',
            },
            {
              label: 'The A♥, and say “One Ace”',
              card: 'AH',
              correct: true,
              feedback:
                'Honest and safe. Nobody can catch you, and you are already a card lighter.',
            },
            {
              label: 'The K♠, and say “One Ace”',
              card: 'KS',
              correct: false,
              feedback:
                'Why lie when you hold a real Ace? Save your fibs for when you actually need them.',
            },
          ],
          proHint:
            'Pros tell the truth whenever they can — it makes their lies more believable later.',
        },
      },
      {
        narration:
          'Your A♥ goes face down on the [[pile]]. Ava puts down two cards: “Two Twos.” Nobody doubts her. Then Ben puts down three cards: “Three Threes!” But wait… you are holding the 3♠ and the 3♦.',
        scene: {
          zones: [
            {
              id: 'pile',
              label: 'The pile',
              cards: ['AH', '2C', '2D'],
              layout: 'stack',
              faceDown: [0, 1, 2],
            },
            {
              id: 'played',
              label: 'Ben’s 3 cards: “Three Threes!”',
              cards: ['3C', '9D', 'JS'],
              layout: 'row',
              faceDown: [0, 1, 2],
              highlight: [0, 1, 2],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['2S', '3S', '3D', '4S', '6D', '7C', '9H', 'TD', 'JH', 'QD', 'KS', 'KD'],
              layout: 'fan',
              highlight: [1, 2],
            },
          ],
          caption: 'Ben says three 3s. You are holding two of them.',
          animate: 'deal',
        },
        decision: {
          prompt: 'Ben claims he played three 3s. What do you do?',
          options: [
            {
              label: 'Stay quiet',
              correct: false,
              feedback:
                'You would let a guaranteed lie slip by. With two 3s in your hand, Ben can have two at the very most.',
            },
            {
              label: 'Call Cheat on Ava instead',
              correct: false,
              feedback:
                'Too late — you can only challenge a play before the next player goes. Ava’s turn is over, and Ben’s claim is the one that can’t be true.',
            },
            {
              label: 'Call “Cheat!”',
              correct: true,
              feedback:
                'Spot on! There are only four 3s in the deck and you hold two of them, so Ben can’t possibly have played three. He is fibbing!',
            },
          ],
          proHint:
            'Pros count: when you hold some cards of a rank, you know how many anyone else can have.',
        },
      },
      {
        narration:
          '“Cheat!” Ben’s three cards are turned face up: the 3♣… the 9♦… the J♠. Caught! Ben must [[pick up the pile]] — all six cards, including your A♥. The pile starts again from nothing.',
        scene: {
          zones: [
            {
              id: 'revealed',
              label: 'Ben’s cards, turned over',
              cards: ['3C', '9D', 'JS'],
              layout: 'row',
              highlight: [1, 2],
            },
            {
              id: 'rest',
              label: '…plus the rest of the pile, all to Ben',
              cards: ['AH', '2C', '2D'],
              layout: 'stack',
              faceDown: [0, 1, 2],
            },
          ],
          caption: 'Only one real 3! Ben takes all six cards.',
          animate: 'flip',
        },
      },
      {
        narration:
          'Play goes on with the next player and the next rank. Cara puts down one card: “One Four.” Now it is your turn, and you must claim Fives — but you don’t have a single 5.',
        scene: {
          zones: [
            {
              id: 'pile',
              label: 'The pile',
              cards: ['4H'],
              layout: 'stack',
              faceDown: [0],
            },
            {
              id: 'hand',
              label: 'Your hand (no 5s)',
              cards: ['2S', '3S', '3D', '4S', '6D', '7C', '9H', 'TD', 'JH', 'QD', 'KS', 'KD'],
              layout: 'fan',
              highlight: [4],
            },
          ],
          caption: 'Fives are wanted. You have none.',
          animate: 'deal',
        },
        decision: {
          prompt: 'You have no Fives. What do you do?',
          options: [
            {
              label: 'Put down the 6♦ and say “One Five”',
              card: '6D',
              correct: true,
              feedback:
                'A small, calm fib. One card is the hardest lie to catch, the pile is tiny if you are caught — and Sixes won’t be your rank for a long time anyway.',
            },
            {
              label: 'Put down three cards and say “Three Fives”',
              correct: false,
              feedback:
                'A big lie with a big risk. Everyone is alert after Ben got caught — and nobody holds three 5s very often.',
            },
            {
              label: 'Say “Pass”',
              correct: false,
              feedback:
                'You can’t pass in Cheat. Every turn you must put down at least one card — even if you have to fib.',
            },
          ],
          proHint:
            'When pros must lie, they lie with one card and keep their face and voice exactly the same as when they tell the truth.',
        },
      },
      {
        narration:
          'You slide the 6♦ onto the [[pile]]: “One Five.” A tiny pause… nobody calls! Your [[bluff]] worked, and you are down to 11 cards.',
        scene: {
          zones: [
            {
              id: 'pile',
              label: 'The pile',
              cards: ['4H', '6D'],
              layout: 'stack',
              faceDown: [0, 1],
              highlight: [1],
            },
            {
              id: 'hand',
              label: 'Your hand (11 cards)',
              cards: ['2S', '3S', '3D', '4S', '7C', '9H', 'TD', 'JH', 'QD', 'KS', 'KD'],
              layout: 'fan',
            },
          ],
          caption: 'Straight face, steady voice — the fib slips through.',
          animate: 'none',
        },
      },
      {
        narration:
          'Many turns later… you got caught once and had to pick up a pile (oops!), but now you hold just two cards. Ava has only one card left — and she puts it down: “One Five.” If nobody challenges, she is [[out|going out]] and wins.',
        scene: {
          zones: [
            {
              id: 'pile',
              label: 'The pile (4 cards)',
              cards: ['TC', '7H', 'KH'],
              layout: 'stack',
              faceDown: [0, 1, 2],
            },
            {
              id: 'played',
              label: 'Ava’s last card: “One Five”',
              cards: ['QC'],
              layout: 'row',
              faceDown: [0],
              highlight: [0],
            },
            {
              id: 'hand',
              label: 'Your hand (2 cards)',
              cards: ['8C', '8H'],
              layout: 'fan',
            },
          ],
          caption: 'Ava’s very last card. Is it really a 5?',
          animate: 'deal',
        },
        decision: {
          prompt: 'Ava wins if her claim stands. Do you call Cheat?',
          options: [
            {
              label: 'No — trust her',
              correct: false,
              feedback:
                'If you stay quiet, she wins right now. Calling costs you nothing: if she is honest, the game is over either way.',
            },
            {
              label: 'Yes — call “Cheat!”',
              correct: true,
              feedback:
                'Always challenge a last card! If she is telling the truth she wins anyway, so you have nothing to lose.',
            },
          ],
          proHint: 'Pros always call Cheat on a player’s final play — there is nothing to lose.',
        },
      },
      {
        narration:
          '“Cheat!” Ava’s card is turned over: the Q♣. Not a 5! Ava must [[pick up the pile]]. Then Ben claims “One Six” and Cara “Two Sevens”, and nobody calls. Now it is your turn — and the claim must be Eights. You hold the 8♣ and the 8♥!',
        scene: {
          zones: [
            {
              id: 'revealed',
              label: 'Ava’s card, turned over',
              cards: ['QC'],
              layout: 'row',
              highlight: [0],
            },
            {
              id: 'pile',
              label: 'The new pile (Ben’s and Cara’s cards)',
              cards: ['6C', '7S', '7D'],
              layout: 'stack',
              faceDown: [0, 1, 2],
            },
            {
              id: 'hand',
              label: 'Your hand',
              cards: ['8C', '8H'],
              layout: 'fan',
              highlight: [0, 1],
            },
          ],
          caption: 'Ava is back in the game with five cards. Your turn: Eights!',
          animate: 'flip',
        },
        decision: {
          prompt: 'The claim must be Eights. What do you play?',
          options: [
            {
              label: 'Just the 8♣: “One Eight”',
              card: '8C',
              correct: false,
              feedback: 'Legal, but why keep a card? Play both and you could win right now.',
            },
            {
              label: 'Both cards, and say “Three Eights”',
              correct: false,
              feedback:
                'Everyone can see you put down two cards, so your claim must say two: “Two Eights”.',
            },
            {
              label: 'Both cards, and say “Two Eights”',
              correct: true,
              feedback:
                'Your last two cards, and both are real Eights. Let them call Cheat if they dare!',
            },
          ],
          proHint:
            'When their real cards match the rank, pros play them all — the truth can’t be caught.',
        },
      },
      {
        narration:
          'Cara can’t believe your luck: “Cheat!” Your cards are turned over — the 8♣ and the 8♥. Every word was true! Cara has to [[pick up the pile]], and you have no cards left. You are [[out|going out]] — you win!',
        scene: {
          zones: [
            {
              id: 'revealed',
              label: 'Your cards, turned over',
              cards: ['8C', '8H'],
              layout: 'row',
              highlight: [0, 1],
            },
            {
              id: 'rest',
              label: '…plus the rest of the pile, all to Cara',
              cards: ['6C', '7S', '7D'],
              layout: 'stack',
              faceDown: [0, 1, 2],
            },
          ],
          caption: 'Honest to the end. Your hand is empty — victory!',
          animate: 'flip',
        },
      },
    ],
    outro:
      'You told the truth when you could, counted cards to catch Ben, fibbed with a single card when you had to, challenged Ava’s last card and finished with real Eights. That is Cheat in a nutshell! Ready to test yourself? Try the quiz!',
  },
  seo: {
    description:
      'Learn Cheat (also called Bluff or I Doubt It): play cards face down, claim the next rank, bluff with a straight face and know exactly when to shout “Cheat!”.',
  },
});
