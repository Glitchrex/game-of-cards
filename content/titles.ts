/**
 * Filmy win titles and cheeky roasts — the personality of Game of Cards.
 *
 * HOW TO EDIT (read before adding a line)
 * - Tone: teasing, never cruel. Roast the MOVE, never the person. No jokes about
 *   appearance, gender, religion, caste, region, language, nationality or disability;
 *   no body-shaming, no slurs, no violence played for laughs, no alcohol/drug/addiction
 *   jokes, and no real money (rupees, cash, "paisa double"): Jeet is pretend money.
 * - Films are referenced only through names, characters and SHORT famous catchphrases
 *   (six words or fewer quoted). Credit the film the line actually comes from, with its
 *   release year. Use a film at most three times across both lists.
 * - Lengths (checked by src/lib/titles.test.ts): title `text` ≤ 40 characters and
 *   `blurb` ≤ 100 (both are printed on the share-card poster), roast `text` ≤ 120.
 * - `when` lists conditions that must ALL hold:
 *   · `generic` — fits ANY win (titles) or ANY loss (roasts), including pure-chance games
 *     like War where the learner made no decisions. Never blame a decision here.
 *   · `decisions` (roasts only) — fits any loss in a game where the learner made real
 *     choices, i.e. every game except CHANCE_GAMES below. Lines that blame a move,
 *     plan or strategy go here.
 *   · `game:<slug>` — must make sense for EVERY win (or loss) of that game, however it
 *     ended (e.g. an Indian Rummy win can come from the bot dropping out).
 *   · Result conditions (`comeback`, `bust`, `folded`, …) come from the engine's
 *     ResultFlags; check what each engine actually sets before writing a line. `bust`
 *     means "knocked yourself out": a Blackjack bust, taking the Queen of Spades in a lost
 *     Hearts hand, getting set in Spades, losing your own show in Teen Patti, losing every
 *     chip in Hold'em or a full count in Rummy. `folded` covers packing, folding, dropping
 *     and resigning Klondike.
 *   · `tag:<tag>` must always be paired with its `game:<slug>` and use a tag that game's
 *     engine really emits (the test reads the engine source to check).
 * - How lines are chosen (weights live in src/lib/titles.ts): the most specific matching
 *   tier wins, and neighbouring tiers share the pool for variety. On an ordinary result,
 *   game lines and base lines (`generic` / `decisions`) mix; a special moment (comeback,
 *   bust, …) shows its own lines plus the game's lines; game + tag/special combinations
 *   beat both; a first win beats everything. The previous line is never repeated.
 * - Every entry carries a `cinema` bucket in the source below; it is stripped from the
 *   exported objects and collected into `CINEMA_INDEX` (used to keep the three cinemas
 *   balanced).
 */

export type TitleCondition =
  | 'firstWin'
  | 'streak3'
  | 'streak5'
  | 'comeback'
  | 'bigPot'
  | 'biggestWin'
  | 'closeFinish'
  | 'luckyLastCard'
  | 'perfect'
  | `game:${string}`
  | `tag:${string}`
  | 'generic';

export interface WinTitle {
  id: string;
  /** The title itself, e.g. "Baazigar of the Table". */
  text: string;
  /** The inspiration, e.g. "Baazigar (1993)". */
  film: string;
  /** One short line on why you earned it. */
  blurb: string;
  /** ALL must hold; 'generic' = always eligible. */
  when: TitleCondition[];
}

export type RoastCondition =
  | 'bust'
  | 'folded'
  | 'bigLoss'
  | 'closeLoss'
  | 'streakBroken'
  | 'losingStreak3'
  | `game:${string}`
  | `tag:${string}`
  | 'decisions'
  | 'generic';

export interface Roast {
  id: string;
  text: string;
  film: string;
  when: RoastCondition[];
}

/**
 * Games decided purely by chance once the bet is placed (the learner makes no real
 * decisions), so roasts that blame a move (`decisions`) are never shown for them.
 * Add a slug here when a new luck-only game becomes playable.
 */
export const CHANCE_GAMES: readonly string[] = ['war', 'andar-bahar', 'baccarat'];

export type Cinema = 'bollywood' | 'hollywood' | 'south';

type WithCinema<T> = T & { cinema: Cinema };

const rawTitles: WithCinema<WinTitle>[] = [
  // ── First win ever ──────────────────────────────────────────────────────────
  {
    id: 't-ek-tha-tiger',
    cinema: 'bollywood',
    text: 'Ek Tha Tiger, Ab Hai Champion',
    film: 'Ek Tha Tiger (2012)',
    blurb: "Your very first win! Every legend needs a Chapter One, and this one's yours.",
    when: ['firstWin'],
  },
  {
    id: 't-jo-jeeta',
    cinema: 'bollywood',
    text: 'Jo Jeeta Wohi Sikandar',
    film: 'Jo Jeeta Wohi Sikandar (1992)',
    blurb: "Whoever wins is the king. Today, for the very first time, that's you.",
    when: ['firstWin'],
  },
  {
    id: 't-a-new-hope',
    cinema: 'hollywood',
    text: 'A New Hope',
    film: 'Star Wars (1977)',
    blurb: 'Your first win. A long time ago (about five minutes), at a table far, far away…',
    when: ['firstWin'],
  },
  {
    id: 't-anyone-can-play',
    cinema: 'hollywood',
    text: 'Anyone Can Play',
    film: 'Ratatouille (2007)',
    blurb: 'Gusteau said anyone can cook. You just proved anyone can win. First one in the bag!',
    when: ['firstWin'],
  },
  {
    id: 't-the-beginning',
    cinema: 'south',
    text: 'The Beginning (Conclusion Pending)',
    film: 'Baahubali: The Beginning (2015)',
    blurb:
      'First win unlocked. Like every great epic, it ends on a cliffhanger: what do you win next?',
    when: ['firstWin'],
  },
  {
    id: 't-vaathi-coming',
    cinema: 'south',
    text: 'Vaathi Coming!',
    film: 'Master (2021)',
    blurb:
      'Lesson learned, first win earned. JD is handing out gold stars, and the first is yours.',
    when: ['firstWin'],
  },

  // ── Win streaks ─────────────────────────────────────────────────────────────
  {
    id: 't-don-of-the-deck',
    cinema: 'bollywood',
    text: 'Don of the Deck',
    film: 'Don (1978)',
    blurb: "A hat-trick and counting. Catching you isn't just mushkil — it's naamumkin.",
    when: ['streak3'],
  },
  {
    id: 't-dhoom-3',
    cinema: 'bollywood',
    text: 'Dhoom: 3 in a Row',
    film: 'Dhoom 3 (2013)',
    blurb:
      'Win after win after win. Like any good franchise, every sequel is bigger than the last.',
    when: ['streak3'],
  },
  {
    id: 't-eye-of-the-tiger',
    cinema: 'hollywood',
    text: 'Eye of the Tiger',
    film: 'Rocky III (1982)',
    blurb: 'Win, win, win. Somewhere, a training montage just started playing.',
    when: ['streak3'],
  },
  {
    id: 't-tiger-ka-hukum',
    cinema: 'south',
    text: 'Tiger Ka Hukum',
    film: 'Jailer (2023)',
    blurb: 'Win after win, on command. When the Tiger gives the order, the cards fall in line.',
    when: ['streak3'],
  },
  {
    id: 't-line-starts-here',
    cinema: 'bollywood',
    text: 'The Line Starts Where You Sit',
    film: 'Kaalia (1981)',
    blurb: "Five in a row and counting. Wherever you sit, the winners' queue begins right there.",
    when: ['streak5'],
  },
  {
    id: 't-bhaag-milkha',
    cinema: 'bollywood',
    text: 'Jeet, Milkha, Jeet!',
    film: 'Bhaag Milkha Bhaag (2013)',
    blurb: 'Five in a row and still sprinting. The bots can only watch you vanish down the track.',
    when: ['streak5'],
  },
  {
    id: 't-inevitable',
    cinema: 'hollywood',
    text: 'I Am Inevitable',
    film: 'Avengers: Endgame (2019)',
    blurb: 'Five in a row and counting. At this point the bots just shuffle and sigh.',
    when: ['streak5'],
  },
  {
    id: 't-oru-thadava',
    cinema: 'south',
    text: 'Said It Once. Won It Five Times.',
    film: 'Baasha (1995)',
    blurb: 'Baasha says it once and it counts a hundred times. Five in a row and counting: got it.',
    when: ['streak5'],
  },

  // ── Comebacks ───────────────────────────────────────────────────────────────
  {
    id: 't-baazigar',
    cinema: 'bollywood',
    text: 'Baazigar of the Table',
    film: 'Baazigar (1993)',
    blurb: "You were losing, then you weren't. Lose first, win anyway? That's a Baazigar.",
    when: ['comeback'],
  },
  {
    id: 't-picture-baaki-thi',
    cinema: 'bollywood',
    text: 'Picture Abhi Baaki Thi',
    film: 'Om Shanti Om (2007)',
    blurb: 'Everyone thought the film was over. You stayed for the climax and rewrote the ending.',
    when: ['comeback'],
  },
  {
    id: 't-failure-not-option',
    cinema: 'hollywood',
    text: 'Failure Was Not an Option',
    film: 'Apollo 13 (1995)',
    blurb: 'Behind, low on fuel and still brought it home. Mission Control is on its feet.',
    when: ['comeback'],
  },
  {
    id: 't-why-do-we-fall',
    cinema: 'hollywood',
    text: 'Why Do We Fall?',
    film: 'Batman Begins (2005)',
    blurb: "So we can learn to pick ourselves up — and pick up the pot while we're at it.",
    when: ['comeback'],
  },
  {
    id: 't-eega-mode',
    cinema: 'south',
    text: 'Tiny Stack, Mighty Revenge',
    film: 'Eega (2012)',
    blurb: 'Down to almost nothing, you buzzed back and took it all. Small? Yes. Unstoppable? Yes.',
    when: ['comeback'],
  },
  {
    id: 't-oru-kadha',
    cinema: 'south',
    text: 'Oru Kadha Sollatta, Sir?',
    film: 'Vikram Vedha (2017)',
    blurb: 'Shall I tell you a story? It starts with you way behind and ends with you on top.',
    when: ['comeback'],
  },
  {
    id: 't-second-innings',
    cinema: 'south',
    text: 'Second-Innings Hero',
    film: 'Jersey (2019)',
    blurb: 'Counted out, padded up, walked back in and won it. Arjun from Jersey has company.',
    when: ['comeback'],
  },

  // ── Big pots ────────────────────────────────────────────────────────────────
  {
    id: 't-mogambo-khush-hua',
    cinema: 'bollywood',
    text: 'Mogambo Khush Hua',
    film: 'Mr. India (1987)',
    blurb:
      'A pot this big made even the grumpiest villain smile. Your Jeet wallet is grinning too.',
    when: ['bigPot'],
  },
  {
    id: 't-bigger-boat',
    cinema: 'hollywood',
    text: "You're Gonna Need a Bigger Boat",
    film: 'Jaws (1975)',
    blurb:
      "That haul won't fit in your pocket. Someone call for a bigger boat, or a bigger wallet.",
    when: ['bigPot'],
  },
  {
    id: 't-show-me-the-jeet',
    cinema: 'hollywood',
    text: 'Show Me the Jeet!',
    film: 'Jerry Maguire (1996)',
    blurb: 'You shouted it, the table delivered: a big, beautiful pile of pretend money.',
    when: ['bigPot'],
  },
  {
    id: 't-rocky-bhai-gold',
    cinema: 'south',
    text: 'Rocky Bhai Struck Gold',
    film: 'K.G.F: Chapter 2 (2022)',
    blurb: "You didn't just win a pot, you hit a whole gold field. Salaam, Rocky Bhai.",
    when: ['bigPot'],
  },
  {
    id: 't-flower-nahi-fire',
    cinema: 'south',
    text: 'Flower Nahi, Fire Hai',
    film: 'Pushpa: The Rise (2021)',
    blurb: "They saw your stake and thought 'flower'. That pot says fire.",
    when: ['bigPot'],
  },

  // ── Biggest win ever (not the first) ────────────────────────────────────────
  {
    id: 't-shahenshah',
    cinema: 'bollywood',
    text: 'Naam Hai Shahenshah',
    film: 'Shahenshah (1988)',
    blurb: 'A new personal best. Rishte mein toh, this win is the baap of all your old ones.',
    when: ['biggestWin'],
  },
  {
    id: 't-wolf-of-card-street',
    cinema: 'hollywood',
    text: 'The Wolf of Card Street',
    film: 'The Wolf of Wall Street (2013)',
    blurb: 'Your biggest win ever. Somebody frame this hand and hang it in the lobby.',
    when: ['biggestWin'],
  },
  {
    id: 't-king-of-the-world',
    cinema: 'hollywood',
    text: 'King of the World',
    film: 'Titanic (1997)',
    blurb: "A new personal record! Front of the ship, arms wide open. You've earned the pose.",
    when: ['biggestWin'],
  },
  {
    id: 't-sarileru',
    cinema: 'south',
    text: 'Sarileru Neekevvaru!',
    film: 'Sarileru Neekevvaru (2020)',
    blurb: "The title means 'nobody can match you', and your new personal best agrees.",
    when: ['biggestWin'],
  },

  // ── Close finishes ──────────────────────────────────────────────────────────
  {
    id: 't-last-ball-lagaan',
    cinema: 'bollywood',
    text: 'Last-Ball Lagaan',
    film: 'Lagaan (2001)',
    blurb: 'Won it on the very last ball, Bhuvan-style. You can breathe out now.',
    when: ['closeFinish'],
  },
  {
    id: 't-danger-zone',
    cinema: 'hollywood',
    text: 'Danger Zone Survivor',
    film: 'Top Gun (1986)',
    blurb: 'That margin was razor-thin. You flew straight through the danger zone and landed it.',
    when: ['closeFinish'],
  },
  {
    id: 't-one-drop',
    cinema: 'hollywood',
    text: 'One Drop from the Floor',
    film: 'Mission: Impossible (1996)',
    blurb:
      'Dangling inches above disaster like Ethan Hunt in the vault, and not one alarm went off.',
    when: ['closeFinish'],
  },
  {
    id: 't-ghilli-raid',
    cinema: 'south',
    text: 'Ghilli Raid, Line Touched',
    film: 'Ghilli (2004)',
    blurb: 'Like a kabaddi raider stretching back over the line, you made it by a fingertip.',
    when: ['closeFinish'],
  },

  // ── Lucky last card ─────────────────────────────────────────────────────────
  {
    id: 't-jais-coin',
    cinema: 'bollywood',
    text: "Jai's Lucky Coin",
    film: 'Sholay (1975)',
    blurb: "That last card landed like Jai's famous coin: somehow it always comes up your way.",
    when: ['luckyLastCard'],
  },
  {
    id: 't-oceans-eleventh-hand',
    cinema: 'hollywood',
    text: "Ocean's Eleventh Hand",
    film: "Ocean's Eleven (2001)",
    blurb: 'The plan looked doomed until the very last card. Then the vault swung open.',
    when: ['luckyLastCard'],
  },
  {
    id: 't-rolex-cameo',
    cinema: 'south',
    text: 'The Rolex Cameo',
    film: 'Vikram (2022)',
    blurb: 'The winning card walked in during the final minutes and stole the whole film.',
    when: ['luckyLastCard'],
  },
  {
    id: 't-minnal-strike',
    cinema: 'south',
    text: 'Struck by Minnal',
    film: 'Minnal Murali (2021)',
    blurb: 'Lightning hit on the very last card and turned you into a superhero.',
    when: ['luckyLastCard'],
  },

  // ── Perfect play ────────────────────────────────────────────────────────────
  {
    id: 't-all-is-well',
    cinema: 'bollywood',
    text: 'All Is Well. Very, Very Well.',
    film: '3 Idiots (2009)',
    blurb: 'Not one wasted move. Chase excellence, Rancho said, and the win will follow. It did.',
    when: ['perfect'],
  },
  {
    id: 't-no-secret-ingredient',
    cinema: 'hollywood',
    text: 'There Is No Secret Ingredient',
    film: 'Kung Fu Panda (2008)',
    blurb: 'A flawless game. Turns out the secret ingredient was you all along.',
    when: ['perfect'],
  },
  {
    id: 't-practically-perfect',
    cinema: 'hollywood',
    text: 'Practically Perfect in Every Way',
    film: 'Mary Poppins (1964)',
    blurb:
      "Mary Poppins's tape measure said 'practically perfect'. Yours just skipped the 'practically'.",
    when: ['perfect'],
  },
  {
    id: 't-thani-vazhi',
    cinema: 'south',
    text: 'En Vazhi Thani Vazhi',
    film: 'Padayappa (1999)',
    blurb: 'My way is a one-of-a-kind way. A perfect game, played entirely your way.',
    when: ['perfect'],
  },

  // ── Special moments (game + engine tag) ─────────────────────────────────────
  {
    id: 't-mere-paas-ace',
    cinema: 'bollywood',
    text: 'Mere Paas Ace Hai',
    film: 'Deewaar (1975)',
    blurb: 'The dealer had chips, cards and a smirk. You had an Ace and a ten. Natural Blackjack!',
    when: ['game:blackjack', 'tag:blackjack'],
  },
  {
    id: 't-hasta-la-vista-dealer',
    cinema: 'hollywood',
    text: 'Hasta La Vista, Dealer',
    film: 'Terminator 2: Judgment Day (1991)',
    blurb: 'An Ace plus a ten-card as your first two cards. Dealer terminated, and it pays 3 to 2.',
    when: ['game:blackjack', 'tag:blackjack'],
  },
  {
    id: 't-kabali-twenty-one',
    cinema: 'south',
    text: 'Kabali Da! Twenty-One',
    film: 'Kabali (2016)',
    blurb:
      'Two cards, one look, pure magizhchi (joy). A natural Blackjack: the cleanest win there is.',
    when: ['game:blackjack', 'tag:blackjack'],
  },
  {
    id: 't-chaand-taare',
    cinema: 'bollywood',
    text: 'Chaand Taare Tod Laaya',
    film: 'Yes Boss (1997)',
    blurb:
      "Every heart and the Queen, dumped on everyone else. You didn't reach for the moon. You shot it.",
    when: ['game:hearts', 'tag:shootTheMoon'],
  },
  {
    id: 't-to-infinity',
    cinema: 'hollywood',
    text: 'To Infinity and Beyond!',
    film: 'Toy Story (1995)',
    blurb: 'You took every heart and the Queen of Spades. The moon was just a pit stop.',
    when: ['game:hearts', 'tag:shootTheMoon'],
  },
  {
    id: 't-nilaave-vaa',
    cinema: 'south',
    text: 'Nilaave Vaa, and the Moon Came',
    film: 'Mouna Ragam (1986)',
    blurb: "'Nilaave vaa' means 'come, O moon'. You called, it came, and everyone else got 26.",
    when: ['game:hearts', 'tag:shootTheMoon'],
  },
  {
    id: 't-bluffmaster',
    cinema: 'bollywood',
    text: 'Bluffmaster!',
    film: 'Bluffmaster! (2005)',
    blurb: 'Someone who packed held better cards. You never let them find out. Pure Bluffmaster.',
    when: ['game:teen-patti', 'tag:bluff-win'],
  },
  {
    id: 't-catch-me',
    cinema: 'hollywood',
    text: 'Catch Me If You Can',
    film: 'Catch Me If You Can (2002)',
    blurb: 'You bet like you meant it and everyone folded. Nobody will ever know what you held.',
    when: ['game:texas-holdem', 'tag:bluff-win'],
  },
  {
    id: 't-nil-battey',
    cinema: 'bollywood',
    text: 'Nil Battey Sannata',
    film: 'Nil Battey Sannata (2016)',
    blurb: 'Your team bid zero tricks and took exactly zero. Nil, divided by nothing: perfection.',
    when: ['game:spades', 'tag:nil'],
  },

  // ── Blackjack ───────────────────────────────────────────────────────────────
  {
    id: 't-bj-singam',
    cinema: 'south',
    text: 'Singam Single-a Dhaan Varum',
    film: 'Sivaji: The Boss (2007)',
    blurb: 'Just you against the dealer, and the lion walked out on top. Lions come alone.',
    when: ['game:blackjack'],
  },
  {
    id: 't-bj-munna-bhai',
    cinema: 'bollywood',
    text: 'Munna Bhai B.J.B.S.',
    film: 'Munna Bhai M.B.B.S. (2003)',
    blurb: 'Bachelor of Blackjack Strategy, with honours. Circuit is already printing the degree.',
    when: ['game:blackjack'],
  },
  {
    id: 't-bj-basic-strategy',
    cinema: 'hollywood',
    text: 'I Know Basic Strategy',
    film: 'The Matrix (1999)',
    blurb:
      'Neo downloaded kung fu. You downloaded basic strategy, and the dealer never saw it coming.',
    when: ['game:blackjack'],
  },

  // ── Teen Patti ──────────────────────────────────────────────────────────────
  {
    id: 't-tp-kitne-aadmi',
    cinema: 'bollywood',
    text: 'Kitne Aadmi The? Teen!',
    film: 'Sholay (1975)',
    blurb: 'Gabbar asked how many. Three cards, and all three were on your side.',
    when: ['game:teen-patti'],
  },
  {
    id: 't-tp-prestige',
    cinema: 'hollywood',
    text: 'Are You Watching Closely?',
    film: 'The Prestige (2006)',
    blurb:
      'The pledge, the turn, the prestige: three cards, three acts, and the pot vanished your way.',
    when: ['game:teen-patti'],
  },
  {
    id: 't-tp-dinesha',
    cinema: 'south',
    text: 'Nee Po Mone Dinesha',
    film: 'Narasimham (2000)',
    blurb:
      'Every raise waved away with full Mohanlal swagger. The pot never even thought of leaving.',
    when: ['game:teen-patti'],
  },

  // ── Andar Bahar ─────────────────────────────────────────────────────────────
  {
    id: 't-ab-dilwale-joker',
    cinema: 'bollywood',
    text: 'Dilwale Joker Le Jayenge',
    film: 'Dilwale Dulhania Le Jayenge (1995)',
    blurb: 'You picked your side and held on. The match came running, like Simran for the train.',
    when: ['game:andar-bahar'],
  },
  {
    id: 't-ab-inside-out',
    cinema: 'hollywood',
    text: 'Inside Out, All Joy',
    film: 'Inside Out (2015)',
    blurb: 'Andar means inside, Bahar means outside. Either way, Joy just took over headquarters.',
    when: ['game:andar-bahar'],
  },
  {
    id: 't-ab-kambala',
    cinema: 'south',
    text: 'Your Buffalo Won the Kambala',
    film: 'Kantara (2022)',
    blurb: 'Two lanes, one race to the matching card, and your side splashed over the line first.',
    when: ['game:andar-bahar'],
  },

  // ── Indian Rummy ────────────────────────────────────────────────────────────
  {
    id: 't-rummy-housefull',
    cinema: 'bollywood',
    text: 'Housefull Hand',
    film: 'Housefull (2010)',
    blurb: 'Sets here, sequences there: by the end, the table had no room left for anyone else.',
    when: ['game:indian-rummy'],
  },
  {
    id: 't-rummy-baasha',
    cinema: 'south',
    text: 'It Was Baasha All Along',
    film: 'Baasha (1995)',
    blurb: 'Quiet all game, like Manikkam the auto driver. Then the whole table met Baasha.',
    when: ['game:indian-rummy'],
  },
  {
    id: 't-rummy-assemble',
    cinema: 'hollywood',
    text: 'Avengers, Assemble!',
    film: 'Avengers: Endgame (2019)',
    blurb: 'Every card went looking for its team, and the whole squad brought home the win.',
    when: ['game:indian-rummy'],
  },

  // ── Texas Hold'em ───────────────────────────────────────────────────────────
  {
    id: 't-holdem-bond',
    cinema: 'hollywood',
    text: "The Name's Hold'em. Texas Hold'em.",
    film: 'Casino Royale (2006)',
    blurb:
      'Ice-cool reads and every chip slid your way. The next Bond film is casting. You got the part.',
    when: ['game:texas-holdem'],
  },
  {
    id: 't-holdem-okkadu',
    cinema: 'south',
    text: 'Okkadu: The One With the Chips',
    film: 'Okkadu (2003)',
    blurb: "Okkadu means 'the one'. Everyone else folded or fell short, and you were the one.",
    when: ['game:texas-holdem'],
  },
  {
    id: 't-holdem-apna-time',
    cinema: 'bollywood',
    text: 'Apna Time Aa Gaya',
    film: 'Gully Boy (2019)',
    blurb: "'Apna time aayega,' they said. Turns out 'aayega' meant this exact hand.",
    when: ['game:texas-holdem'],
  },

  // ── Baccarat ────────────────────────────────────────────────────────────────
  {
    id: 't-bacc-bond',
    cinema: 'hollywood',
    text: 'Bond. James Baccarat.',
    film: 'Dr. No (1962)',
    blurb:
      "Cinema's suavest spy first said his name at a baccarat table. Tonight, the table says yours.",
    when: ['game:baccarat'],
  },
  {
    id: 't-bacc-k3g',
    cinema: 'bollywood',
    text: 'Kabhi Player, Kabhi Banker',
    film: 'Kabhi Khushi Kabhie Gham (2001)',
    blurb: "Sometimes it's Player, sometimes Banker. Tonight it was all khushi for you.",
    when: ['game:baccarat'],
  },
  {
    id: 't-bacc-marana-mass',
    cinema: 'south',
    text: 'Marana Mass Baccarat',
    film: 'Petta (2019)',
    blurb: 'You backed the right side and the cards walked in with pure Petta swag. Marana mass!',
    when: ['game:baccarat'],
  },

  // ── Hearts ──────────────────────────────────────────────────────────────────
  {
    id: 't-hearts-kkhh',
    cinema: 'bollywood',
    text: 'Kuch Kuch Hota Hai, Points Nahi',
    film: 'Kuch Kuch Hota Hai (1998)',
    blurb: 'Hearts flew everywhere, but very few landed on you. Lowest score, biggest smile.',
    when: ['game:hearts'],
  },
  {
    id: 't-hearts-ocean',
    cinema: 'hollywood',
    text: 'Heart of the Ocean',
    film: 'Titanic (1997)',
    blurb: 'The rarest heart is the one you never had to take. Low score, high class.',
    when: ['game:hearts'],
  },
  {
    id: 't-hearts-premam',
    cinema: 'south',
    text: 'Premam, Minus the Heartbreak',
    film: 'Premam (2015)',
    blurb:
      'Plenty of hearts on the table, very few in your pile. A love story with a happy ending.',
    when: ['game:hearts'],
  },

  // ── Spades ──────────────────────────────────────────────────────────────────
  {
    id: 't-sultan-of-spades',
    cinema: 'bollywood',
    text: 'Sultan of Spades',
    film: 'Sultan (2016)',
    blurb:
      'You wrestled the bid, pinned the tricks and lifted the trophy. Spades never stood a chance.',
    when: ['game:spades'],
  },
  {
    id: 't-spades-naatu',
    cinema: 'south',
    text: 'Naatu Naatu Partners',
    film: 'RRR (2022)',
    blurb:
      'You and your partner moved in perfect sync: bid together, won together, danced together.',
    when: ['game:spades'],
  },
  {
    id: 't-spades-casablanca',
    cinema: 'hollywood',
    text: 'A Beautiful Partnership',
    film: 'Casablanca (1942)',
    blurb: 'Tricks taken, partner beaming. Looks like the start of a beautiful friendship.',
    when: ['game:spades'],
  },

  // ── Crazy Eights ────────────────────────────────────────────────────────────
  {
    id: 't-c8-andaz',
    cinema: 'bollywood',
    text: 'Andaz Apna Apna, Suit Apna Apna',
    film: 'Andaz Apna Apna (1994)',
    blurb: 'Matching suits, switching suits, naming suits: your style, your suit, your win.',
    when: ['game:crazy-eights'],
  },
  {
    id: 't-c8-no-suit',
    cinema: 'hollywood',
    text: 'There Is No Suit',
    film: 'The Matrix (1999)',
    blurb:
      'Neo learned there is no spoon. You learned that with an eight in hand, there is no suit.',
    when: ['game:crazy-eights'],
  },
  {
    id: 't-c8-pushpa-rule',
    cinema: 'south',
    text: 'Pushpa Ka Rule: Eights Are Wild',
    film: 'Pushpa 2: The Rule (2024)',
    blurb: 'You set the suit, the table followed, and the rule was yours from start to finish.',
    when: ['game:crazy-eights'],
  },

  // ── Go Fish ─────────────────────────────────────────────────────────────────
  {
    id: 't-gofish-drishyam',
    cinema: 'south',
    text: 'Drishyam-Level Memory',
    film: 'Drishyam (2013)',
    blurb:
      'You remembered who asked for what, like Georgekutty remembers every detail. Case closed.',
    when: ['game:go-fish'],
  },
  {
    id: 't-gofish-nemo',
    cinema: 'hollywood',
    text: 'Fish Are Friends (Especially Sevens)',
    film: 'Finding Nemo (2003)',
    blurb: 'You asked nicely, the cards swam home and the books piled up. Most books wins: you!',
    when: ['game:go-fish'],
  },
  {
    id: 't-gofish-koi-mil-gaya',
    cinema: 'bollywood',
    text: 'Koi Mil Gaya! (Four, Actually)',
    film: 'Koi... Mil Gaya (2003)',
    blurb: 'You asked, you fished, you found: four of a kind, again and again.',
    when: ['game:go-fish'],
  },

  // ── War ─────────────────────────────────────────────────────────────────────
  {
    id: 't-war-entertained',
    cinema: 'hollywood',
    text: 'Are You Not Entertained?',
    film: 'Gladiator (2000)',
    blurb: "Battle after battle, flip after flip, and you're the last one standing in the arena.",
    when: ['game:war'],
  },
  {
    id: 't-war-mahishmati',
    cinema: 'south',
    text: 'Jai Mahishmati!',
    film: 'Baahubali 2: The Conclusion (2017)',
    blurb:
      "Battle after battle, war within war, and the whole kingdom's deck marched to your side.",
    when: ['game:war'],
  },
  {
    id: 't-war-dangal',
    cinema: 'bollywood',
    text: 'Pinned the Whole Deck',
    film: 'Dangal (2016)',
    blurb: 'Round after round of grappling, and the deck ended up flat on its back. Gold medal.',
    when: ['game:war'],
  },

  // ── Klondike ────────────────────────────────────────────────────────────────
  {
    id: 't-klondike-lock',
    cinema: 'south',
    text: 'The Ornate Lock, Opened',
    film: 'Manichitrathazhu (1993)',
    blurb: "Manichitrathazhu means 'the ornate lock'. You picked it and set all 52 cards free.",
    when: ['game:klondike', 'perfect'],
  },
  {
    id: 't-klondike-shawshank',
    cinema: 'hollywood',
    text: 'The Shawshank Shuffle',
    film: 'The Shawshank Redemption (1994)',
    blurb: 'Every buried card tunnelled out to freedom. All 52 home, and no poster required.',
    when: ['game:klondike', 'perfect'],
  },
  {
    id: 't-klondike-swades',
    cinema: 'bollywood',
    text: 'Swades: All 52 Came Home',
    film: 'Swades (2004)',
    blurb: 'Ace to King, suit by suit, every last card found its way home. What a homecoming.',
    when: ['game:klondike', 'perfect'],
  },
  {
    id: 't-klondike-home-alone',
    cinema: 'hollywood',
    text: 'Home Alone, Winning Alone',
    film: 'Home Alone (1990)',
    blurb: 'No bots, no partners, no burglars: just you versus the deck, and the deck lost.',
    when: ['game:klondike'],
  },
  {
    id: 't-klondike-akele',
    cinema: 'bollywood',
    text: 'Akele Hum, Jeete Hum',
    film: 'Akele Hum Akele Tum (1995)',
    blurb: 'Just you and fifty-two cards, and you came out ahead. Who needs a co-star?',
    when: ['game:klondike'],
  },
  {
    id: 't-klondike-thani-oruvan',
    cinema: 'south',
    text: 'Thani Oruvan',
    film: 'Thani Oruvan (2015)',
    blurb: "It means 'the lone one'. One player, one deck, and the deck blinked first.",
    when: ['game:klondike'],
  },

  // ── Generic (any win, any game) ─────────────────────────────────────────────
  {
    id: 't-chak-de',
    cinema: 'bollywood',
    text: 'Chak De, Champion!',
    film: 'Chak De! India (2007)',
    blurb: 'No seventy-minute pep talk needed. That win came straight from the heart.',
    when: ['generic'],
  },
  {
    id: 't-main-hoon-na',
    cinema: 'bollywood',
    text: 'Main Hoon Na!',
    film: 'Main Hoon Na (2004)',
    blurb: 'The table needed a winner, and you stepped up and said it: main hoon na.',
    when: ['generic'],
  },
  {
    id: 't-apni-favourite',
    cinema: 'bollywood',
    text: 'Main Apni Favourite Hoon',
    film: 'Jab We Met (2007)',
    blurb: "Geet said it first. After a win like that, you're allowed to say it too.",
    when: ['generic'],
  },
  {
    id: 't-swag-se-swagat',
    cinema: 'bollywood',
    text: 'Swag Se Swagat',
    film: 'Tiger Zinda Hai (2017)',
    blurb: "The table just rolled out the red carpet. That's how winners get welcomed.",
    when: ['generic'],
  },
  {
    id: 't-kaho-naa-jeet',
    cinema: 'bollywood',
    text: 'Kaho Naa… Jeet Hai!',
    film: 'Kaho Naa... Pyaar Hai (2000)',
    blurb: 'Say it loud: that was a win. Even the bots are humming the title track.',
    when: ['generic'],
  },
  {
    id: 't-may-the-deck',
    cinema: 'hollywood',
    text: 'May the Deck Be With You',
    film: 'Star Wars (1977)',
    blurb: 'The Force was strong today, and it picked your side of the table.',
    when: ['generic'],
  },
  {
    id: 't-wax-on-win-off',
    cinema: 'hollywood',
    text: 'Wax On, Win Off',
    film: 'The Karate Kid (1984)',
    blurb: 'Wax on, wax off, win on. Mr. Miyagi would allow himself one tiny smile.',
    when: ['generic'],
  },
  {
    id: 't-great-scott',
    cinema: 'hollywood',
    text: 'Great Scott, What a Win!',
    film: 'Back to the Future (1985)',
    blurb: 'Doc would fire up the DeLorean just to go back and watch that win again.',
    when: ['generic'],
  },
  {
    id: 't-hakuna-ma-win-ta',
    cinema: 'hollywood',
    text: 'Hakuna Ma-Win-Ta',
    film: 'The Lion King (1994)',
    blurb: 'No worries, just winnings. Everything the light touches is your Jeet.',
    when: ['generic'],
  },
  {
    id: 't-great-power',
    cinema: 'hollywood',
    text: 'With Great Power Comes Great Jeet',
    film: 'Spider-Man (2002)',
    blurb: "Your spidey-sense said 'win' and it was right. Use those powers responsibly.",
    when: ['generic'],
  },
  {
    id: 't-yo-adrian',
    cinema: 'hollywood',
    text: 'Yo, Adrian, I Did It!',
    film: 'Rocky II (1979)',
    blurb: "Shout it from the top of the steps. That one's going straight into the highlight reel.",
    when: ['generic'],
  },
  {
    id: 't-mersal-mode',
    cinema: 'south',
    text: 'Pure Mersal',
    film: 'Mersal (2017)',
    blurb: "Mersal means 'stunned', which is exactly how the bots looked when that win landed.",
    when: ['generic'],
  },
  {
    id: 't-kaithi-night',
    cinema: 'south',
    text: 'One Night, One Win',
    film: 'Kaithi (2019)',
    blurb: 'One long game, one tough fight, one hot win. Dilli would celebrate with biryani.',
    when: ['generic'],
  },
  {
    id: 't-committed',
    cinema: 'south',
    text: 'Committed and Conquered',
    film: 'Pokiri (2006)',
    blurb: "Once you commit, you don't even listen to yourself, and this time that worked.",
    when: ['generic'],
  },
  {
    id: 't-aaluma-doluma',
    cinema: 'south',
    text: 'Aaluma Doluma!',
    film: 'Vedalam (2015)',
    blurb: 'A win like that deserves the full Vedalam dance break. Everybody up!',
    when: ['generic'],
  },
  {
    id: 't-full-kushi',
    cinema: 'south',
    text: 'Full Kushi',
    film: 'Kushi (2000)',
    blurb: 'Kushi means happiness, and that win just served a full plate of it.',
    when: ['generic'],
  },
];

const rawRoasts: WithCinema<Roast>[] = [
  // ── Bust: knocked yourself out (any game) ───────────────────────────────────
  {
    id: 'r-control-uday',
    cinema: 'bollywood',
    text: "Control, Uday, control! A little less turbo and you'd still be in this game.",
    film: 'Welcome (2007)',
    when: ['bust'],
  },
  {
    id: 'r-iceberg',
    cinema: 'hollywood',
    text: 'Full speed ahead, straight into the iceberg. Bold navigation, Captain.',
    film: 'Titanic (1997)',
    when: ['bust'],
  },
  {
    id: 'r-italian-job',
    cinema: 'hollywood',
    text: "The plan was to 'blow the doors off'. You took out the whole van, Italian Job-style.",
    film: 'The Italian Job (1969)',
    when: ['bust'],
  },
  {
    id: 'r-red-chip',
    cinema: 'south',
    text: "Like Chitti after the red chip, you just couldn't stop. System overload.",
    film: 'Enthiran (2010)',
    when: ['bust'],
  },

  // ── Blackjack bust (went over 21) ───────────────────────────────────────────
  {
    id: 'r-need-for-one-more',
    cinema: 'hollywood',
    text: 'You felt the need... the need for one more card. The card did not feel the same way.',
    film: 'Top Gun (1986)',
    when: ['game:blackjack', 'bust'],
  },
  {
    id: 'r-ambi-complaint',
    cinema: 'south',
    text: 'Ambi from Anniyan is filing a formal complaint: that total broke the rule of 21.',
    film: 'Anniyan (2005)',
    when: ['game:blackjack', 'bust'],
  },
  {
    id: 'r-ek-aur-ek',
    cinema: 'bollywood',
    text: 'Ek aur ek gyarah? Maybe in the movies. At this table, one more card made it a bust.',
    film: 'Ek Aur Ek Gyarah (2003)',
    when: ['game:blackjack', 'bust'],
  },

  // ── Hearts: took the Queen of Spades and lost ───────────────────────────────
  {
    id: 'r-hearts-queen-rani',
    cinema: 'bollywood',
    text: 'Like Rani in Queen, you ended up on a solo trip: just you, the Queen of Spades and 13 points.',
    film: 'Queen (2014)',
    when: ['game:hearts', 'bust'],
  },
  {
    id: 'r-hearts-bites-the-dust',
    cinema: 'hollywood',
    text: 'You invited the Queen of Spades into your pile. Thirteen points later: another one bites the dust.',
    film: 'Bohemian Rhapsody (2018)',
    when: ['game:hearts', 'bust'],
  },
  {
    id: 'r-hearts-rudhramadevi',
    cinema: 'south',
    text: 'Rudhramadevi ruled a whole kingdom. The Queen of Spades only ruled your score: 13 points.',
    film: 'Rudhramadevi (2015)',
    when: ['game:hearts', 'bust'],
  },

  // ── Folded / packed / dropped / resigned ────────────────────────────────────
  {
    id: 'r-alvida',
    cinema: 'bollywood',
    text: 'Kabhi Alvida Naa Kehna? You said alvida the moment things got tricky.',
    film: 'Kabhi Alvida Naa Kehna (2006)',
    when: ['folded'],
  },
  {
    id: 'r-znmd-fold',
    cinema: 'bollywood',
    text: 'Zindagi na milegi dobara — and neither will that deal you just walked away from.',
    film: 'Zindagi Na Milegi Dobara (2011)',
    when: ['folded'],
  },
  {
    id: 'r-let-it-go',
    cinema: 'hollywood',
    text: 'You let it go, Elsa-style. Very brave, very dramatic, and the Jeet went with it.',
    film: 'Frozen (2013)',
    when: ['folded'],
  },
  {
    id: 'r-run-forrest',
    cinema: 'hollywood',
    text: 'Run, Forrest, run! And you did: straight out of that game.',
    film: 'Forrest Gump (1994)',
    when: ['folded'],
  },
  {
    id: 'r-thaggedhe-le',
    cinema: 'south',
    text: "Pushpa says 'thaggedhe le': never back down. You backed down. Very politely, but still.",
    film: 'Pushpa: The Rise (2021)',
    when: ['folded'],
  },
  {
    id: 'r-muthu-timing',
    cinema: 'south',
    text: 'Rajini in Muthu always shows up at exactly the right moment. You left before yours arrived.',
    film: 'Muthu (1995)',
    when: ['folded'],
  },
  {
    id: 'r-tp-jaane-tu',
    cinema: 'bollywood',
    text: 'Jaane tu... ya jaane na? You packed the best hand at the table. Now you know.',
    film: 'Jaane Tu... Ya Jaane Na (2008)',
    when: ['game:teen-patti', 'tag:packed-best-hand'],
  },
  {
    id: 'r-holdem-its-a-trap',
    cinema: 'hollywood',
    text: "'It's a trap!' you decided, and folded. Spoiler: it wasn't. Your hand would have won.",
    film: 'Return of the Jedi (1983)',
    when: ['game:texas-holdem', 'tag:folded-best-hand'],
  },

  // ── Big losses ──────────────────────────────────────────────────────────────
  {
    id: 'r-spared-no-expense',
    cinema: 'hollywood',
    text: 'Spared no expense. Especially your Jeet.',
    film: 'Jurassic Park (1993)',
    when: ['bigLoss'],
  },
  {
    id: 'r-little-manoeuvre',
    cinema: 'hollywood',
    text: 'That little manoeuvre just cost you. Not 51 years, but a lot of Jeet.',
    film: 'Interstellar (2014)',
    when: ['bigLoss'],
  },
  {
    id: 'r-deewaar-paas',
    cinema: 'bollywood',
    text: "The bot just pulled a full Deewaar: 'Kya hai tumhare paas?' Right now? Not much Jeet.",
    film: 'Deewaar (1975)',
    when: ['bigLoss'],
  },
  {
    id: 'r-special-26',
    cinema: 'bollywood',
    text: 'The bots ran a full Special 26 raid on your wallet: smooth, polite and very thorough.',
    film: 'Special 26 (2013)',
    when: ['bigLoss'],
  },
  {
    id: 'r-gold-mine-shovels',
    cinema: 'south',
    text: 'You brought a whole gold mine to the table and handed the bots the shovels.',
    film: 'K.G.F: Chapter 1 (2018)',
    when: ['bigLoss'],
  },

  // ── Close losses ────────────────────────────────────────────────────────────
  {
    id: 'r-one-run-short',
    cinema: 'bollywood',
    text: 'One run short of a Lagaan ending. The rematch is your final over.',
    film: 'Lagaan (2001)',
    when: ['closeLoss'],
  },
  {
    id: 'r-baazigar-close',
    cinema: 'bollywood',
    text: "So close! Lose first, win next: that's how every Baazigar story goes.",
    film: 'Baazigar (1993)',
    when: ['closeLoss'],
  },
  {
    id: 'r-went-the-distance',
    cinema: 'hollywood',
    text: 'You went the distance like Rocky, and like Rocky, lost on points. Sequel time?',
    film: 'Rocky (1976)',
    when: ['closeLoss'],
  },
  {
    id: 'r-spin-the-top',
    cinema: 'hollywood',
    text: "Lost by a hair. Spin the top: maybe this is a dream. (It isn't. Rematch?)",
    film: 'Inception (2010)',
    when: ['closeLoss'],
  },
  {
    id: 'r-premam-first-love',
    cinema: 'south',
    text: "Like George's first love in Premam: so close, so sweet, not meant to be. Chapter two awaits.",
    film: 'Premam (2015)',
    when: ['closeLoss'],
  },
  {
    id: 'r-400-years',
    cinema: 'south',
    text: 'Magadheera waited 400 years for a second chance. You only have to press Rematch.',
    film: 'Magadheera (2009)',
    when: ['closeLoss'],
  },

  // ── Win streak broken ───────────────────────────────────────────────────────
  {
    id: 'r-kattappa-twist',
    cinema: 'south',
    text: 'Kattappa ne Baahubali ko kyun maara? Same reason your streak ended: nobody saw it coming.',
    film: 'Baahubali: The Beginning (2015)',
    when: ['streakBroken'],
  },
  {
    id: 'r-don-caught',
    cinema: 'bollywood',
    text: "Turns out catching this Don wasn't naamumkin after all. Streak over, for now.",
    film: 'Don (1978)',
    when: ['streakBroken'],
  },
  {
    id: 'r-k3g-streak',
    cinema: 'bollywood',
    text: "Kabhi khushi, kabhie gham. The streak was all khushi; this one's a little gham.",
    film: 'Kabhi Khushi Kabhie Gham (2001)',
    when: ['streakBroken'],
  },
  {
    id: 'r-streak-ill-be-back',
    cinema: 'hollywood',
    text: "Your streak just said 'I'll be back.' Go make it keep that promise.",
    film: 'The Terminator (1984)',
    when: ['streakBroken'],
  },
  {
    id: 'r-88-mph',
    cinema: 'hollywood',
    text: 'Your streak hit 88 miles per hour and vanished. Quick, somebody find the DeLorean.',
    film: 'Back to the Future (1985)',
    when: ['streakBroken'],
  },
  {
    id: 'r-chapter-two',
    cinema: 'south',
    text: "Even Rocky Bhai needed a Chapter 2. Your streak's sequel starts with the Rematch button.",
    film: 'K.G.F: Chapter 2 (2022)',
    when: ['streakBroken'],
  },

  // ── Third (or later) loss in a row: gentle and encouraging ─────────────────
  {
    id: 'r-apna-time',
    cinema: 'bollywood',
    text: 'Apna time aayega. Just... not this hand. Maybe the next one?',
    film: 'Gully Boy (2019)',
    when: ['losingStreak3'],
  },
  {
    id: 'r-lakshya-aim',
    cinema: 'bollywood',
    text: 'Karan in Lakshya took a while to find his aim too. The tip below is a good place to start.',
    film: 'Lakshya (2004)',
    when: ['losingStreak3'],
  },
  {
    id: 'r-keep-swimming',
    cinema: 'hollywood',
    text: 'Another one? Just keep swimming, and maybe read the tip below first.',
    film: 'Finding Nemo (2003)',
    when: ['losingStreak3'],
  },
  {
    id: 'r-wax-on',
    cinema: 'hollywood',
    text: 'Wax on, wax off. Daniel thought the chores were pointless too, then it all clicked.',
    film: 'The Karate Kid (1984)',
    when: ['losingStreak3'],
  },
  {
    id: 'r-jersey-years',
    cinema: 'south',
    text: 'Arjun in Jersey picked the bat back up years later. A few lost hands are nothing. Pad up!',
    film: 'Jersey (2019)',
    when: ['losingStreak3'],
  },
  {
    id: 'r-neelambari-18',
    cinema: 'south',
    text: 'Neelambari waited 18 years to settle the score. Your comeback can start in 18 seconds.',
    film: 'Padayappa (1999)',
    when: ['losingStreak3'],
  },

  // ── Blackjack ───────────────────────────────────────────────────────────────
  {
    id: 'r-bj-call-doctor',
    cinema: 'bollywood',
    text: 'Circuit, call a doctor! That hand needs an emergency dose of basic strategy.',
    film: 'Munna Bhai M.B.B.S. (2003)',
    when: ['game:blackjack'],
  },
  {
    id: 'r-bj-terminator-dealer',
    cinema: 'hollywood',
    text: 'The dealer is basically a Terminator: no bargaining, no feelings, always stands on 17.',
    film: 'The Terminator (1984)',
    when: ['game:blackjack'],
  },
  {
    id: 'r-bj-dial-up',
    cinema: 'south',
    text: 'Chitti computes at one terahertz. That decision was running on dial-up.',
    film: 'Enthiran (2010)',
    when: ['game:blackjack'],
  },
  {
    id: 'r-bj-dealer-natural',
    cinema: 'hollywood',
    text: 'The dealer had Blackjack all along. A Sixth Sense twist, and nothing you could have done.',
    film: 'The Sixth Sense (1999)',
    when: ['game:blackjack', 'tag:dealerBlackjack'],
  },

  // ── Teen Patti ──────────────────────────────────────────────────────────────
  {
    id: 'r-tp-invisible-chips',
    cinema: 'bollywood',
    text: 'Your chips pulled a full Mr. India: on the table one moment, completely invisible the next.',
    film: 'Mr. India (1987)',
    when: ['game:teen-patti'],
  },
  {
    id: 'r-tp-could-refuse',
    cinema: 'hollywood',
    text: "You made them an offer they couldn't refuse. Turns out they could, and the pot went with them.",
    film: 'The Godfather (1972)',
    when: ['game:teen-patti'],
  },
  {
    id: 'r-tp-sivaji-boss',
    cinema: 'south',
    text: 'Sivaji lost everything and still came back as The Boss. You only lost one hand.',
    film: 'Sivaji: The Boss (2007)',
    when: ['game:teen-patti'],
  },

  // ── Andar Bahar ─────────────────────────────────────────────────────────────
  {
    id: 'r-ab-palat',
    cinema: 'bollywood',
    text: "You whispered 'palat, palat' and the match card turned around — to face the other side.",
    film: 'Dilwale Dulhania Le Jayenge (1995)',
    when: ['game:andar-bahar'],
  },
  {
    id: 'r-ab-chocolates',
    cinema: 'hollywood',
    text: "Life's like a box of chocolates, said Forrest's mama. This box hid the match on the other side.",
    film: 'Forrest Gump (1994)',
    when: ['game:andar-bahar'],
  },
  {
    id: 'r-ab-buffalo-snack',
    cinema: 'south',
    text: 'Two lanes, one race, just like the Kambala in Kantara, and your buffalo stopped for a snack.',
    film: 'Kantara (2022)',
    when: ['game:andar-bahar'],
  },

  // ── Indian Rummy ────────────────────────────────────────────────────────────
  {
    id: 'r-rummy-virus',
    cinema: 'bollywood',
    text: 'Virus says life is a race. So is rummy, and you were still sorting cards at the finish.',
    film: '3 Idiots (2009)',
    when: ['game:indian-rummy'],
  },
  {
    id: 'r-rummy-mission',
    cinema: 'hollywood',
    text: 'New mission, should you accept it: build a pure sequence before anything else.',
    film: 'Mission: Impossible (1996)',
    when: ['game:indian-rummy'],
  },
  {
    id: 'r-rummy-alibi',
    cinema: 'south',
    text: "Georgekutty lined up a whole alibi in perfect order. You couldn't line up three cards of one suit.",
    film: 'Drishyam (2013)',
    when: ['game:indian-rummy'],
  },

  // ── Texas Hold'em ───────────────────────────────────────────────────────────
  {
    id: 'r-holdem-pen',
    cinema: 'hollywood',
    text: 'Sell me this pen? The table politely declined your pitch, and kept the pot.',
    film: 'The Wolf of Wall Street (2013)',
    when: ['game:texas-holdem'],
  },
  {
    id: 'r-holdem-commitment',
    cinema: 'bollywood',
    text: "'Ek baar commitment kar di…' works for Radhe. In Hold'em, even a committed hand deserves a second look.",
    film: 'Wanted (2009)',
    when: ['game:texas-holdem'],
  },
  {
    id: 'r-holdem-hundred',
    cinema: 'south',
    text: 'Magadheera can take on a hundred warriors at once. Calling everyone at once is a different sport.',
    film: 'Magadheera (2009)',
    when: ['game:texas-holdem'],
  },

  // ── Baccarat ────────────────────────────────────────────────────────────────
  {
    id: 'r-bacc-bond-calm',
    cinema: 'hollywood',
    text: 'Bond plays baccarat with a perfectly straight face, because the cards decide everything. Steal the face.',
    film: 'Dr. No (1962)',
    when: ['game:baccarat'],
  },
  {
    id: 'r-bacc-luck-by-chance',
    cinema: 'bollywood',
    text: 'Luck by Chance? Tonight it was all chance and no luck. Baccarat is a coin toss in a tuxedo.',
    film: 'Luck by Chance (2009)',
    when: ['game:baccarat'],
  },
  {
    id: 'r-bacc-hukum',
    cinema: 'south',
    text: "You gave the shoe a full Jailer-style 'Hukum!'. Sadly, the shoe doesn't take orders.",
    film: 'Jailer (2023)',
    when: ['game:baccarat'],
  },

  // ── Hearts ──────────────────────────────────────────────────────────────────
  {
    id: 'r-hearts-darna-kya',
    cinema: 'bollywood',
    text: 'Pyar kiya to darna kya? In Hearts, a little darr helps: every heart is a point.',
    film: 'Mughal-e-Azam (1960)',
    when: ['game:hearts'],
  },
  {
    id: 'r-hearts-all-the-tricks',
    cinema: 'hollywood',
    text: 'Of all the tricks in all the world, the points kept walking into yours.',
    film: 'Casablanca (1942)',
    when: ['game:hearts'],
  },
  {
    id: 'r-hearts-96',
    cinema: 'south',
    text: "Ram held on to one love for 22 years in '96'. You held on to those hearts for way too long.",
    film: '96 (2018)',
    when: ['game:hearts'],
  },
  {
    id: 'r-hearts-small-step',
    cinema: 'hollywood',
    text: 'A bot shot the moon. One small step for a bot, 26 giant points for everyone else.',
    film: 'First Man (2018)',
    when: ['game:hearts', 'tag:opponentShotMoon'],
  },

  // ── Spades ──────────────────────────────────────────────────────────────────
  {
    id: 'r-spades-team-sport',
    cinema: 'bollywood',
    text: "Chak De taught us it's a team sport. You and your partner bid like two separate films.",
    film: 'Chak De! India (2007)',
    when: ['game:spades'],
  },
  {
    id: 'r-spades-heist',
    cinema: 'hollywood',
    text: 'Danny Ocean needed a whole crew. Spades needs a partner. You played a one-person heist.',
    film: "Ocean's Eleven (2001)",
    when: ['game:spades'],
  },
  {
    id: 'r-spades-nanban',
    cinema: 'south',
    text: 'In Nanban, friends stick together. You and your partner stuck to two different plans.',
    film: 'Nanban (2012)',
    when: ['game:spades'],
  },

  // ── Crazy Eights ────────────────────────────────────────────────────────────
  {
    id: 'r-c8-galti',
    cinema: 'bollywood',
    text: 'Galti se mistake? Saving an eight for the end would have changed the whole climax.',
    film: 'Andaz Apna Apna (1994)',
    when: ['game:crazy-eights'],
  },
  {
    id: 'r-c8-why-so-serious',
    cinema: 'hollywood',
    text: "'Why so serious?' asked the Joker. Because you're still holding a fistful of cards, that's why.",
    film: 'The Dark Knight (2008)',
    when: ['game:crazy-eights'],
  },
  {
    id: 'r-c8-ghilli-speed',
    cinema: 'south',
    text: "That wasn't Ghilli speed. By the time you picked a suit, the game had already moved on.",
    film: 'Ghilli (2004)',
    when: ['game:crazy-eights'],
  },

  // ── Go Fish ─────────────────────────────────────────────────────────────────
  {
    id: 'r-gofish-big-fish',
    cinema: 'hollywood',
    text: 'Less Big Fish, more no fish. Remembering who asked for what is free bait.',
    film: 'Big Fish (2003)',
    when: ['game:go-fish'],
  },
  {
    id: 'r-gofish-dil-chahta',
    cinema: 'bollywood',
    text: "Dil chahta hai sevens. The deck said 'Go Fish'. The heart wants what the stock won't give.",
    film: 'Dil Chahta Hai (2001)',
    when: ['game:go-fish'],
  },
  {
    id: 'r-gofish-chemmeen',
    cinema: 'south',
    text: "In Chemmeen, a whole village lives off the sea. You fished all game and the sea kept saying 'Go Fish'.",
    film: 'Chemmeen (1965)',
    when: ['game:go-fish'],
  },

  // ── War ─────────────────────────────────────────────────────────────────────
  {
    id: 'r-war-finds-a-way',
    cinema: 'hollywood',
    text: "Life, uh, finds a way, and today it found its way to the other player's pile.",
    film: 'Jurassic Park (1993)',
    when: ['game:war'],
  },
  {
    id: 'r-war-karan-arjun',
    cinema: 'bollywood',
    text: "'Mere aces aayenge!' Like Karan Arjun, they will come back. Just not in this game.",
    film: 'Karan Arjun (1995)',
    when: ['game:war'],
  },
  {
    id: 'r-war-charlie-fetch',
    cinema: 'south',
    text: 'Charlie the dog fetches everything, and your deck fetched every ace for your opponent.',
    film: '777 Charlie (2022)',
    when: ['game:war'],
  },

  // ── Klondike ────────────────────────────────────────────────────────────────
  {
    id: 'r-klondike-wilson',
    cinema: 'hollywood',
    text: 'Even Wilson the volleyball saw that coming. Next time, free the face-down cards first.',
    film: 'Cast Away (2000)',
    when: ['game:klondike'],
  },
  {
    id: 'r-klondike-ten-moves',
    cinema: 'south',
    text: 'Agent Vikram plans ten moves ahead. You took the first move you saw, and the tableau froze.',
    film: 'Vikram (2022)',
    when: ['game:klondike'],
  },
  {
    id: 'r-klondike-saath-saath',
    cinema: 'bollywood',
    text: 'Hum Saath-Saath Hain? Not these cards: they stayed stuck in seven separate piles.',
    film: 'Hum Saath-Saath Hain (1999)',
    when: ['game:klondike'],
  },

  // ── Generic: any loss in any game (no blame — War has no decisions) ─────────
  {
    id: 'r-picture-abhi-baaki',
    cinema: 'bollywood',
    text: "Picture abhi baaki hai... but your chips aren't.",
    film: 'Om Shanti Om (2007)',
    when: ['generic'],
  },
  {
    id: 'r-kal-ho-naa-ho',
    cinema: 'bollywood',
    text: "Kal ho naa ho? Tomorrow is uncertain. The Rematch button isn't.",
    film: 'Kal Ho Naa Ho (2003)',
    when: ['generic'],
  },
  {
    id: 'r-strictly-business',
    cinema: 'hollywood',
    text: "It wasn't personal. It was strictly business, and business was bad.",
    film: 'The Godfather (1972)',
    when: ['generic'],
  },
  {
    id: 'r-remember-who-you-are',
    cinema: 'hollywood',
    text: 'Remember who you are: a learner with a rematch button. Hakuna matata.',
    film: 'The Lion King (1994)',
    when: ['generic'],
  },
  {
    id: 'r-self-destruct',
    cinema: 'hollywood',
    text: 'This hand will self-destruct in five seconds... oh. It already did.',
    film: 'Mission: Impossible (1996)',
    when: ['generic'],
  },
  {
    id: 'r-kabali-da',
    cinema: 'south',
    text: "That ending wasn't 'Kabali da!', it was 'Kabali... da?'. Rematch for the real mass scene.",
    film: 'Kabali (2016)',
    when: ['generic'],
  },
  {
    id: 'r-vaathi-lesson',
    cinema: 'south',
    text: "Vaathi says: that wasn't a loss, it was a lesson. Notebook out, tip below.",
    film: 'Master (2021)',
    when: ['generic'],
  },

  // ── Decisions: any loss in a game with real choices (blames the move) ──────
  {
    id: 'r-devdas',
    cinema: 'bollywood',
    text: 'Even Devdas made better decisions.',
    film: 'Devdas (2002)',
    when: ['decisions'],
  },
  {
    id: 'r-deleted-scene',
    cinema: 'bollywood',
    text: "That move belongs in a deleted scene, right next to Sholay's original ending.",
    film: 'Sholay (1975)',
    when: ['decisions'],
  },
  {
    id: 'r-hera-pheri-energy',
    cinema: 'bollywood',
    text: 'That plan was pure Hera Pheri: big confidence, zero idea what was going on.',
    film: 'Hera Pheri (2000)',
    when: ['decisions'],
  },
  {
    id: 'r-golmaal',
    cinema: 'bollywood',
    text: 'Golmaal hai bhai, sab golmaal hai — especially that last move.',
    film: 'Golmaal (1979)',
    when: ['decisions'],
  },
  {
    id: 'r-bhool-bhulaiyaa',
    cinema: 'bollywood',
    text: 'That plan wandered into a full Bhool Bhulaiyaa and never found the exit.',
    film: 'Bhool Bhulaiyaa (2007)',
    when: ['decisions'],
  },
  {
    id: 'r-villain-explains',
    cinema: 'hollywood',
    text: 'You played like the villain who explains his plan and still loses.',
    film: 'Goldfinger (1964)',
    when: ['decisions'],
  },
  {
    id: 'r-houston',
    cinema: 'hollywood',
    text: "Houston, we have a problem. It's your strategy.",
    film: 'Apollo 13 (1995)',
    when: ['decisions'],
  },
  {
    id: 'r-lack-of-strategy',
    cinema: 'hollywood',
    text: 'I find your lack of strategy disturbing. (Darth Vader, reviewing that hand.)',
    film: 'Star Wars (1977)',
    when: ['decisions'],
  },
  {
    id: 'r-deja-vu',
    cinema: 'hollywood',
    text: "Déjà vu? That's a glitch in the Matrix — or the same mistake as last time.",
    film: 'The Matrix (1999)',
    when: ['decisions'],
  },
  {
    id: 'r-naatu-timing',
    cinema: 'south',
    text: 'Full Naatu Naatu enthusiasm, zero Naatu Naatu timing. The steps matter too!',
    film: 'RRR (2022)',
    when: ['decisions'],
  },
  {
    id: 'r-eega-plan',
    cinema: 'south',
    text: 'The fly in Eega made smarter plans than that, and it was a fly.',
    film: 'Eega (2012)',
    when: ['decisions'],
  },
  {
    id: 'r-karagattakaran',
    cinema: 'south',
    text: 'Like the banana scene in Karagattakaran: a very confident explanation that made zero sense.',
    film: 'Karagattakaran (1989)',
    when: ['decisions'],
  },
  {
    id: 'r-mmkr',
    cinema: 'south',
    text: 'Kamal juggled four roles in Michael Madana Kama Rajan. You had one plan and still mixed it up.',
    film: 'Michael Madana Kama Rajan (1990)',
    when: ['decisions'],
  },
  {
    id: 'r-aavesham',
    cinema: 'south',
    text: "That move has earned a full Aavesham-style 'Eda mone…' and a long, loving lecture.",
    film: 'Aavesham (2024)',
    when: ['decisions'],
  },
];

function stripCinema<T extends { cinema: Cinema }>({
  cinema: _cinema,
  ...rest
}: T): Omit<T, 'cinema'> {
  return rest;
}

/** Win titles shown on the celebration screen and the Awards Shelf. */
export const titles: WinTitle[] = rawTitles.map(stripCinema);

/** Gentle roasts shown on the loss screen (always followed by a real tip). */
export const roasts: Roast[] = rawRoasts.map(stripCinema);

/** Which cinema each title/roast id draws from (keeps the three cinemas balanced). */
export const CINEMA_INDEX: Record<string, Cinema> = Object.fromEntries(
  [...rawTitles, ...rawRoasts].map((entry) => [entry.id, entry.cinema]),
);
