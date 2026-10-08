export const landing = {
  hero: {
    eyebrow: 'Now showing · {count} card games',
    eyebrowNoCount: 'Now showing · card games from around the world',
    titleLead: 'Learn every card game.',
    titleAccent: 'The fun way.',
    subhead:
      'Never held a deck? Perfect. Bite-size animated lessons and a friendly coach get you playing in minutes.',
    ctaStart: 'Start learning in 2 minutes',
    ctaPick: 'Pick a game for me',
    note: 'You start with {amount} Jeet — pretend coins, no real money, ever.',
  },
  nowShowing: {
    eyebrow: 'Tonight’s line-up',
    title: 'Now showing',
    intro: 'Crowd favourites from around the world. Pick a poster to see what the game is about.',
    seeAll: 'See all {count} games',
    seeAllNoCount: 'See all games',
    poster: {
      playable: 'Play vs bots',
      players: '{range} players',
      playersOne: 'Solo',
      minutes: '~{minutes} min',
      difficulty: 'Difficulty {level} of 5',
      playersLabel: 'Players',
      lengthLabel: 'Length',
      difficultyLabel: 'Difficulty',
    },
  },
  howItWorks: {
    eyebrow: 'From zero to card shark',
    title: 'How it works',
    intro:
      'Four small steps. No rulebooks, no pressure — just you, a deck and a very patient coach.',
    stepLabel: 'Step {n}',
    steps: {
      discover: {
        title: 'Discover',
        body: 'Browse card games from around the world — or tap “Pick a game for me” and we’ll choose.',
      },
      learn: {
        title: 'Learn',
        body: 'Animated lessons explain one idea per screen in plain words. Tricky terms explain themselves.',
      },
      try: {
        title: 'Try',
        body: 'Play a practice hand with a coach who shows your options and explains every move.',
      },
      play: {
        title: 'Play',
        body: 'Take on friendly bots with pretend Jeet. Wins earn filmy titles; losses earn a gentle roast and a tip.',
      },
    },
  },
  world: {
    eyebrow: 'Passport stamps',
    title: 'Games from around the world',
    intro:
      'From family tables in Mumbai to card rooms in Las Vegas. Pick a region and start exploring.',
    games: '{count} games',
    gamesOne: '1 game',
  },
  closing: {
    eyebrow: 'Your seat is saved',
    title: 'The show starts in 60 seconds.',
    body: 'A quick card-basics primer, then your first real hand of Blackjack with the coach by your side. Popcorn optional.',
    ctaStart: 'Start learning in 2 minutes',
    ctaBrowse: 'Browse all games',
  },
  pick: {
    title: 'Pick a game for me',
    eyebrow: '3 quick questions',
    resultEyebrow: 'Your feature presentation',
    description: 'Tap an answer for each question and we’ll find a game that fits.',
    progress: 'Question {n} of {total}',
    progressLabel: 'Your progress',
    resultProgress: 'All done',
    back: 'Back',
    restart: 'Start over',
    loading: 'Opening…',
    questions: {
      players: 'How many players?',
      mood: 'What’s the mood?',
      time: 'How much time?',
    },
    players: {
      solo: { label: 'Just me', hint: 'Solo games and you-vs-the-dealer' },
      two: { label: 'Two of us', hint: 'Head-to-head with a friend' },
      'small-group': { label: '3–4 friends', hint: 'A cosy table' },
      'big-group': { label: 'A big group', hint: '5 or more players' },
    },
    mood: {
      chill: { label: 'Chill', hint: 'Easy-going and relaxed' },
      brainy: { label: 'Brainy', hint: 'Clever plans, tricky choices' },
      social: { label: 'Social', hint: 'Chatting, laughing, teaming up' },
      lucky: { label: 'Feeling lucky', hint: 'Let the cards decide' },
      competitive: { label: 'Competitive', hint: 'Bragging rights on the line' },
    },
    time: {
      quick: { label: 'Quick', hint: '10 min or less' },
      medium: { label: 'A while', hint: 'About 20 min' },
      long: { label: 'Long session', hint: '25 min or more' },
    },
    result: {
      heading: 'We picked',
      playable: 'Play vs bots here',
      learn: 'Learn it',
      try: 'Try it',
      learnLabel: 'Learn it: {name}',
      tryLabel: 'Try it: {name}',
      runnersUp: 'Also showing',
      players: '{range} players',
      playersOne: 'Solo',
      minutes: '~{minutes} min',
      difficulty: 'Difficulty {level} of 5',
      announce: 'We picked {name}. {reason}',
    },
    empty: {
      title: 'The projector’s warming up',
      body: 'No games are on the bill just yet. Have a look around the catalog instead.',
      browse: 'Browse games',
    },
  },
  og: {
    alt: '{name} — {tagline} Animated lessons, coached practice hands and friendly bots, with pretend coins only.',
    eyebrow: 'Now showing · nightly',
    features: 'Lessons · coached hands · friendly bots',
    promise: 'Pretend coins only · no real money, ever',
  },
  jsonLd: {
    description:
      'Learn card games from around the world with animated lessons, coached practice hands and friendly bots. Pretend coins only.',
  },
} as const;
