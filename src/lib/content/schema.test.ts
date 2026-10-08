import { describe, expect, it } from 'vitest';
import {
  GAME_TYPES,
  GAME_TYPE_LABELS,
  GameContentSchema,
  MOODS,
  REGIONS,
  REGION_LABELS,
  defineGame,
  referencedTerms,
  validateGameContent,
  type GameContentInput,
} from './schema';

/** A complete, valid content file. Every call returns a fresh deep copy. */
function validGame(slug = 'toy-snap'): GameContentInput {
  const step = (n: number) => ({
    narration: `Step ${n}: you hold the [[pair]] — what now?`,
    scene: { zones: [{ id: 'hand', cards: ['7H', '7S', 'X1'], highlight: [0, 1] }] },
    decision: {
      prompt: 'Shout snap?',
      options: [
        { label: 'Snap!', card: '7H', correct: true, feedback: 'Yes — two sevens make a pair.' },
        { label: 'Wait', correct: false, feedback: 'Too slow, someone else snaps first.' },
      ],
      proHint: 'Matching ranks mean snap.',
    },
  });
  return {
    slug,
    name: 'Toy Snap',
    aka: ['Snap'],
    origin: { country: 'United Kingdom', countryCode: 'GB', region: 'europe' },
    type: 'shedding',
    players: { min: 2, max: 6, ideal: 3 },
    deck: 'One standard 52-card deck',
    difficulty: 1,
    length: '5 minutes',
    minutes: 5,
    moods: ['social', 'lucky'],
    hook: 'Spot two matching cards first and shout “Snap!”',
    history: 'Snap has been a family favourite in Britain for well over a century.',
    order: 5,
    variantTaught: 'Classic two-pile snap.',
    variants: 'Some families play with one shared pile in the middle.',
    glossary: [
      { term: 'pair', definition: 'Two cards of the same rank.' },
      { term: 'pile', definition: 'Your face-down stack of cards.' },
      { term: 'snap', definition: 'What you shout when you see a pair.' },
    ],
    lesson: [
      { title: 'The goal', body: 'Win every card by spotting each [[pair]].' },
      {
        title: 'The deal',
        body: 'Deal all the cards into face-down [[piles|pile]].',
        scene: {
          zones: [{ id: 'piles', cards: ['AS', 'KD'], layout: 'stack', faceDown: [0, 1] }],
        },
      },
      { title: 'Turning cards', body: 'Take turns flipping the top card of your [[Pile]].' },
      {
        title: 'Snap!',
        body: 'When two face-up cards match, shout [[ snap ]].',
        scene: { zones: [{ id: 'middle', cards: ['QH', 'QC'], highlight: [1] }], animate: 'flip' },
        tip: 'Keep your hand ready!',
      },
      { title: 'Winning', body: 'Whoever collects every card wins.' },
    ],
    mistakes: ['Peeking at your pile', 'Snapping on a near miss', 'Flipping out of turn'],
    tips: ['Watch the ranks, not the suits', 'Stay relaxed', 'Flip away from you'],
    quiz: Array.from({ length: 5 }, (_, i) => ({
      question: `Question ${i + 1}?`,
      options: ['A', 'B', 'C', 'D'],
      answer: i % 4,
      explanation: 'Because that is the rule.',
    })),
    example: {
      intro: 'Let’s play a quick round together.',
      steps: [step(1), step(2), step(3), step(4)],
      outro: 'You snapped like a pro!',
    },
    seo: {
      description:
        'Learn Snap, the fast family card game where you spot matching cards and shout first.',
    },
  };
}

type Mutable = Record<string, unknown>;
/** Clone the valid fixture and apply a mutation to the raw object. */
function variant(mutate: (g: Mutable & GameContentInput) => void, slug = 'toy-snap') {
  const g = validGame(slug) as Mutable & GameContentInput;
  mutate(g);
  return g;
}
const messages = (raw: unknown, opts = { fileSlug: 'toy-snap', hasEngine: false }) =>
  validateGameContent(raw, opts).issues.map((i) => i.message);

describe('validateGameContent — valid content', () => {
  it('accepts the fixture with no issues (Tier 2, with example)', () => {
    const { content, issues } = validateGameContent(validGame(), {
      fileSlug: 'toy-snap',
      hasEngine: false,
    });
    expect(issues).toEqual([]);
    expect(content?.slug).toBe('toy-snap');
  });

  it('accepts a Tier 1 game without a scripted example', () => {
    const raw = variant((g) => delete g.example);
    expect(messages(raw, { fileSlug: 'toy-snap', hasEngine: true })).toEqual([]);
  });

  it('applies schema defaults', () => {
    const { content } = validateGameContent(validGame(), {
      fileSlug: 'toy-snap',
      hasEngine: false,
    });
    expect(content?.featured).toBe(false);
    expect(content?.lesson[3]?.scene?.zones[0]?.layout).toBe('row');
    expect(content?.lesson[1]?.scene?.zones[0]?.layout).toBe('stack');
    expect(content?.lesson[1]?.scene?.animate).toBe('deal');
    expect(content?.lesson[3]?.scene?.animate).toBe('flip');
  });

  it('defineGame is an identity helper', () => {
    const g = validGame();
    expect(defineGame(g)).toBe(g);
  });

  it('exposes labels for every region and game type', () => {
    for (const r of REGIONS) expect(REGION_LABELS[r]).toMatch(/\S/);
    for (const t of GAME_TYPES) expect(GAME_TYPE_LABELS[t]).toMatch(/\S/);
    expect(MOODS).toEqual(['chill', 'brainy', 'social', 'lucky', 'competitive']);
  });
});

describe('validateGameContent — schema failures', () => {
  it.each([
    'slug',
    'name',
    'origin',
    'type',
    'players',
    'difficulty',
    'minutes',
    'moods',
    'hook',
    'glossary',
    'lesson',
    'quiz',
    'seo',
    'mistakes',
    'tips',
    'order',
  ])('reports a missing "%s" field by path', (field) => {
    const raw = variant((g) => delete g[field]);
    const result = validateGameContent(raw, { fileSlug: 'toy-snap', hasEngine: true });
    expect(result.content).toBeUndefined();
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.message.startsWith(`${field}: `))).toBe(true);
    expect(result.issues.every((i) => i.slug === 'toy-snap')).toBe(true);
  });

  it('reports missing nested fields with their full path', () => {
    const raw = variant((g) => {
      delete (g.origin as Mutable).region;
      delete (g.quiz[2] as Mutable).explanation;
    });
    const msgs = messages(raw);
    expect(msgs.some((m) => m.startsWith('origin.region: '))).toBe(true);
    expect(msgs.some((m) => m.startsWith('quiz.2.explanation: '))).toBe(true);
  });

  it('labels root-level problems clearly', () => {
    expect(messages(null)[0]).toMatch(/^\(root\): /);
    expect(messages('not an object')[0]).toMatch(/^\(root\): /);
  });

  it.each<[string, (g: Mutable & GameContentInput) => void, string]>([
    ['difficulty above 5', (g) => (g.difficulty = 6), 'difficulty: '],
    ['difficulty below 1', (g) => (g.difficulty = 0), 'difficulty: '],
    ['a fractional difficulty', (g) => (g.difficulty = 2.5), 'difficulty: '],
    ['zero minimum players', (g) => (g.players = { min: 0, max: 4 }), 'players.min: '],
    ['an invalid slug', (g) => (g.slug = 'Toy Snap'), 'slug: '],
    [
      'a 3-letter country code',
      (g) => (g.origin = { ...g.origin, countryCode: 'GBR' }),
      'origin.countryCode: ',
    ],
    [
      'an unknown region',
      (g) => (g.origin = { ...g.origin, region: 'mars' as never }),
      'origin.region: ',
    ],
    ['an unknown type', (g) => (g.type = 'bingo' as never), 'type: '],
    ['no moods', (g) => (g.moods = []), 'moods: '],
    ['an unknown mood', (g) => (g.moods = ['sleepy' as never]), 'moods.0: '],
    ['a hook over 110 chars', (g) => (g.hook = 'x'.repeat(111)), 'hook: '],
    ['zero minutes', (g) => (g.minutes = 0), 'minutes: '],
    ['only 4 quiz questions', (g) => (g.quiz = g.quiz.slice(0, 4)), 'quiz: '],
    [
      'a quiz question with 2 options',
      (g) => (g.quiz[0] = { ...g.quiz[0]!, options: ['A', 'B'], answer: 0 }),
      'quiz.0.options: ',
    ],
    ['too few lesson steps', (g) => (g.lesson = g.lesson.slice(0, 4)), 'lesson: '],
    ['too few glossary terms', (g) => (g.glossary = g.glossary.slice(0, 2)), 'glossary: '],
    [
      'a short SEO description',
      (g) => (g.seo = { description: 'Too short.' }),
      'seo.description: ',
    ],
    [
      'too few example steps',
      (g) => (g.example = { ...g.example!, steps: g.example!.steps.slice(0, 3) }),
      'example.steps: ',
    ],
  ])('rejects %s', (_label, mutate, prefix) => {
    const msgs = messages(variant(mutate));
    expect(msgs.some((m) => m.startsWith(prefix))).toBe(true);
  });

  it('reports a quiz answer index that is out of range', () => {
    const raw = variant((g) => (g.quiz[1] = { ...g.quiz[1]!, answer: 4 }));
    expect(messages(raw)).toContain('quiz.1: Quiz answer index out of range');
    const ok = variant((g) => (g.quiz[1] = { ...g.quiz[1]!, options: ['A', 'B', 'C'], answer: 2 }));
    expect(messages(ok)).toEqual([]);
  });

  it('reports invalid card codes in scenes and decision options', () => {
    const raw = variant((g) => {
      g.lesson[0] = { ...g.lesson[0]!, scene: { zones: [{ id: 'z', cards: ['AS', '10H'] }] } };
      const step = g.example!.steps[0]!;
      step.decision!.options[0] = { ...step.decision!.options[0]!, card: 'JK' };
    });
    const msgs = messages(raw);
    expect(msgs).toContain('lesson.0.scene.zones.0.cards.1: Invalid card code');
    expect(msgs).toContain('example.steps.0.decision.options.0.card: Invalid card code');
  });

  it('requires at least one correct option in a decision', () => {
    const raw = variant((g) => {
      const d = g.example!.steps[2]!.decision!;
      d.options = d.options.map((o) => ({ ...o, correct: false }));
    });
    expect(messages(raw)).toContain(
      'example.steps.2.decision.options: A decision needs at least one correct option',
    );
  });
});

describe('validateGameContent — cross-checks', () => {
  it('reports a glossary reference to an undefined term', () => {
    const raw = variant((g) => {
      g.lesson[4] = { ...g.lesson[4]!, body: 'Win with a [[trump]] or a [[pair]].' };
    });
    expect(messages(raw)).toEqual(['lesson[4].body: glossary term "trump" is not defined']);
  });

  it('checks the term (not the shown text) of [[shown|term]] links', () => {
    const okRaw = variant((g) => {
      g.lesson[0] = { ...g.lesson[0]!, body: 'Two [[matching cards|pair]] win.' };
    });
    expect(messages(okRaw)).toEqual([]);
    const badRaw = variant((g) => {
      g.lesson[0] = { ...g.lesson[0]!, body: 'Two [[pair|matching cards]] win.' };
    });
    expect(messages(badRaw)).toEqual([
      'lesson[0].body: glossary term "matching cards" is not defined',
    ]);
  });

  it('matches glossary terms case-insensitively and ignores surrounding spaces', () => {
    // The fixture already uses [[Pile]], [[piles|pile]] and [[ snap ]].
    expect(messages(validGame())).toEqual([]);
  });

  it('reports undefined terms inside the scripted example too', () => {
    const raw = variant((g) => {
      g.example!.steps[3] = { ...g.example!.steps[3]!, narration: 'Now [[slap]] the pile!' };
    });
    expect(messages(raw)).toEqual([
      'example.steps[3].narration: glossary term "slap" is not defined',
    ]);
  });

  it('reports out-of-range highlight and faceDown indexes', () => {
    const raw = variant((g) => {
      g.lesson[0] = {
        ...g.lesson[0]!,
        scene: { zones: [{ id: 'hand', cards: ['AS', 'KS', 'QS'], highlight: [2, 3] }] },
      };
      g.lesson[2] = {
        ...g.lesson[2]!,
        scene: { zones: [{ id: 'deck', cards: ['2C'], faceDown: [1] }] },
      };
      g.example!.steps[1]!.scene.zones[0]!.highlight = [0, 7];
    });
    expect(messages(raw)).toEqual([
      'lesson[0].scene: zone "hand" index 3 out of range',
      'lesson[2].scene: zone "deck" index 1 out of range',
      'example.steps[1].scene: zone "hand" index 7 out of range',
    ]);
  });

  it('rejects any highlight on an empty zone', () => {
    const raw = variant((g) => {
      g.lesson[0] = {
        ...g.lesson[0]!,
        scene: { zones: [{ id: 'empty', cards: [], highlight: [0] }] },
      };
    });
    expect(messages(raw)).toEqual(['lesson[0].scene: zone "empty" index 0 out of range']);
  });

  it('reports a Tier 2 game without a scripted example', () => {
    const raw = variant((g) => delete g.example);
    expect(messages(raw, { fileSlug: 'toy-snap', hasEngine: false })).toEqual([
      'Tier 2 game (no engine) must include a scripted example',
    ]);
  });

  it('reports a slug that does not match the file name', () => {
    const result = validateGameContent(validGame('toy-snap'), {
      fileSlug: 'snap',
      hasEngine: false,
    });
    expect(result.issues).toEqual([
      { slug: 'toy-snap', message: 'slug "toy-snap" does not match file name "snap"' },
    ]);
  });

  it('reports inconsistent player counts', () => {
    expect(messages(variant((g) => (g.players = { min: 5, max: 2 })))).toContain(
      'players.min > players.max',
    );
    expect(messages(variant((g) => (g.players = { min: 2, max: 4, ideal: 6 })))).toEqual([
      'players.ideal (6) is outside players.min..players.max',
    ]);
    expect(messages(variant((g) => (g.players = { min: 2, max: 4 })))).toEqual([]);
  });

  it('collects several problems at once and still returns the parsed content', () => {
    const raw = variant((g) => {
      delete g.example;
      g.lesson[0] = { ...g.lesson[0]!, body: '[[ghost]] and [[phantom]]' };
    }, 'wrong');
    const result = validateGameContent(raw, { fileSlug: 'right', hasEngine: false });
    expect(result.content?.slug).toBe('wrong');
    expect(result.issues.map((i) => i.message)).toEqual([
      'slug "wrong" does not match file name "right"',
      'Tier 2 game (no engine) must include a scripted example',
      'lesson[0].body: glossary term "ghost" is not defined',
      'lesson[0].body: glossary term "phantom" is not defined',
    ]);
  });
});

describe('referencedTerms', () => {
  it('extracts plain and aliased terms in order', () => {
    expect(referencedTerms('Play a [[trick]], then [[lead|leading]] and [[ trump ]].')).toEqual([
      'trick',
      'leading',
      'trump',
    ]);
  });

  it('returns nothing for text without links (and ignores single brackets)', () => {
    expect(referencedTerms('No links [here] at all.')).toEqual([]);
    expect(referencedTerms('')).toEqual([]);
  });

  it('can be called repeatedly (no shared regex state)', () => {
    expect(referencedTerms('[[a]] [[b]]')).toEqual(['a', 'b']);
    expect(referencedTerms('[[a]] [[b]]')).toEqual(['a', 'b']);
  });
});

describe('GameContentSchema', () => {
  it('round-trips the fixture through parse', () => {
    const parsed = GameContentSchema.parse(validGame());
    expect(parsed.name).toBe('Toy Snap');
    expect(parsed.quiz).toHaveLength(5);
  });
});
