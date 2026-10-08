/** The /journey map: a winding road with one stop per game, plus progress summary. */
export const journey = {
  meta: {
    title: 'Your learning journey',
    description:
      'A winding road through every card game on Game of Cards, from War to Bridge. See what you have learned and mastered, and what to play next.',
  },
  page: {
    eyebrow: 'The road ahead',
    title: 'Your learning journey',
    intro:
      'One stop per game, gentlest first. Learn the rules, try a coached hand, ace the quiz — and watch the road light up in gold.',
  },
  loading: 'Loading your journey…',
  summary: {
    heading: 'Your progress',
    text: '{learned} of {total} games learned, {mastered} mastered',
    learned: 'Learned',
    mastered: 'Mastered',
    started: 'In progress',
    ofTotal: 'of {total}',
    barLabel: 'Games learned',
    barValue: '{learned} of {total} learned',
  },
  next: {
    eyebrow: 'Next up',
    allDone: 'You have mastered every game on the map. Take a bow, legend!',
    allDoneCta: 'Browse all games',
    hub: 'Open the {name} page',
    steps: {
      learn: 'Start the lesson',
      try: 'Try the example hand',
      quiz: 'Take the quiz',
      quizAgain: 'Ace the quiz (5/5)',
      play: 'Win a game vs the bots',
    },
    why: {
      'not-started': 'A fresh stop on the road. The lesson takes a few minutes.',
      learning: 'You have started this one — finish the steps to mark it learned.',
      learned: 'Learned! One more push to master it.',
    },
  },
  map: {
    label: 'Journey map: every game in the recommended order',
    start: 'Start',
    finish: 'Finish',
    nodePending: '{n}. {name}',
    node: '{n}. {name}: {status}',
    nodePlayable: '{n}. {name}: {status}. Playable vs bot',
    nodeNext: 'Next up',
    play: 'Play',
    legend: 'What the stops mean',
  },
  status: {
    'not-started': 'Not started',
    learning: 'Learning',
    learned: 'Learned',
    mastered: 'Mastered',
  },
  statusHint: {
    'not-started': 'Not opened yet',
    learning: 'Lesson, example or quiz started',
    learned: 'Lesson + example + quiz 3/5',
    mastered: 'Quiz 5/5, plus a win if it has a bot table',
  },
} as const;
