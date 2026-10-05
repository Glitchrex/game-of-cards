/**
 * Zod schema for one game's content file (content/games/<slug>.ts).
 * Validated at build time (scripts/validate-content.ts runs in `prebuild`) and in
 * tests, so a missing or malformed field fails the build.
 */
import { z } from 'zod';
import { isCardCode } from '@/games/core/cards';

export const REGIONS = [
  'south-asia',
  'east-asia',
  'southeast-asia',
  'europe',
  'north-america',
  'latin-america',
  'global',
] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_LABELS: Record<Region, string> = {
  'south-asia': 'South Asia',
  'east-asia': 'East Asia',
  'southeast-asia': 'Southeast Asia',
  europe: 'Europe',
  'north-america': 'North America',
  'latin-america': 'Latin America',
  global: 'Played worldwide',
};

export const GAME_TYPES = [
  'trick-taking',
  'shedding',
  'rummy',
  'comparing',
  'solitaire',
  'casino',
  'fishing',
  'collecting',
] as const;
export type GameType = (typeof GAME_TYPES)[number];

export const GAME_TYPE_LABELS: Record<GameType, string> = {
  'trick-taking': 'Trick-taking',
  shedding: 'Shedding',
  rummy: 'Rummy',
  comparing: 'Comparing',
  solitaire: 'Solitaire',
  casino: 'Casino-style',
  fishing: 'Fishing',
  collecting: 'Collecting',
};

export const MOODS = ['chill', 'brainy', 'social', 'lucky', 'competitive'] as const;
export type Mood = (typeof MOODS)[number];

const cardCode = z.string().refine(isCardCode, { message: 'Invalid card code' });

/** A text field that may contain [[term]] or [[shown text|term]] glossary links. */
const richText = z.string().min(1);

export const SceneZoneSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  cards: z.array(cardCode),
  layout: z.enum(['fan', 'row', 'stack', 'cascade', 'grid']).default('row'),
  /** Indexes of cards to highlight (gold glow). */
  highlight: z.array(z.number().int().nonnegative()).optional(),
  /** Indexes of cards shown face-down. */
  faceDown: z.array(z.number().int().nonnegative()).optional(),
});
export type SceneZone = z.infer<typeof SceneZoneSchema>;

export const SceneSchema = z.object({
  zones: z.array(SceneZoneSchema).min(1),
  caption: z.string().optional(),
  animate: z.enum(['deal', 'flip', 'none']).default('deal'),
});
export type Scene = z.infer<typeof SceneSchema>;

export const LessonStepSchema = z.object({
  title: z.string().min(1).max(80),
  body: richText,
  scene: SceneSchema.optional(),
  tip: z.string().optional(),
});
export type LessonStep = z.infer<typeof LessonStepSchema>;

export const DecisionOptionSchema = z.object({
  label: z.string().min(1),
  /** Optional card the option represents (rendered as a mini card). */
  card: cardCode.optional(),
  correct: z.boolean(),
  /** Shown after picking this option: why it is right or wrong. */
  feedback: z.string().min(1),
});

export const ScriptedStepSchema = z.object({
  narration: richText,
  scene: SceneSchema,
  decision: z
    .object({
      prompt: z.string().min(1),
      options: z
        .array(DecisionOptionSchema)
        .min(2)
        .max(5)
        .refine((opts) => opts.some((o) => o.correct), {
          message: 'A decision needs at least one correct option',
        }),
      /** "What would a pro do?" hint. */
      proHint: z.string().min(1),
    })
    .optional(),
});
export type ScriptedStep = z.infer<typeof ScriptedStepSchema>;

export const QuizQuestionSchema = z
  .object({
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(3).max(4),
    answer: z.number().int().nonnegative(),
    explanation: z.string().min(1),
  })
  .refine((q) => q.answer < q.options.length, { message: 'Quiz answer index out of range' });
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const GameContentSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().min(1),
  aka: z.array(z.string()).optional(),
  origin: z.object({
    country: z.string().min(1),
    /** ISO 3166-1 alpha-2 code, used to render the flag badge. Use 'UN' for "worldwide". */
    countryCode: z.string().length(2),
    region: z.enum(REGIONS),
  }),
  type: z.enum(GAME_TYPES),
  players: z.object({
    min: z.number().int().min(1),
    max: z.number().int().min(1),
    ideal: z.number().int().optional(),
  }),
  deck: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),
  /** Typical game length, human readable ("10–15 minutes"). */
  length: z.string().min(1),
  /** Typical length in minutes (used by "Pick a game for me"). */
  minutes: z.number().int().positive(),
  moods: z.array(z.enum(MOODS)).min(1),
  hook: z.string().min(1).max(110),
  history: z.string().min(1),
  featured: z.boolean().default(false),
  /** Recommended position on the learning journey map (lower = earlier). */
  order: z.number().int(),
  variantTaught: z.string().min(1),
  variants: z.string().min(1),
  glossary: z
    .array(z.object({ term: z.string().min(1), definition: z.string().min(1) }))
    .min(3),
  lesson: z.array(LessonStepSchema).min(5).max(14),
  mistakes: z.array(z.string().min(1)).min(3),
  /** Encouraging, specific tips shown after a roast. */
  tips: z.array(z.string().min(1)).min(3),
  quiz: z.array(QuizQuestionSchema).length(5),
  /** Scripted, clickable example hand. Required for games without an engine. */
  example: z
    .object({
      intro: z.string().min(1),
      steps: z.array(ScriptedStepSchema).min(4),
      outro: z.string().min(1),
    })
    .optional(),
  seo: z.object({ description: z.string().min(50).max(170) }),
});

export type GameContentInput = z.input<typeof GameContentSchema>;
export type GameContent = z.output<typeof GameContentSchema>;

/** Identity helper giving content files type-checking and autocompletion. */
export function defineGame(content: GameContentInput): GameContentInput {
  return content;
}

const TERM_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/** Every glossary term referenced in a rich text string. */
export function referencedTerms(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(TERM_RE)) out.push((m[2] ?? m[1] ?? '').trim());
  return out;
}

export interface ContentIssue {
  slug: string;
  message: string;
}

/**
 * Deep validation beyond the schema: glossary references resolve, scene
 * highlight indexes are in range, Tier 2 games have a scripted example.
 */
export function validateGameContent(
  raw: unknown,
  opts: { fileSlug: string; hasEngine: boolean },
): { content?: GameContent; issues: ContentIssue[] } {
  const parsed = GameContentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      issues: parsed.error.issues.map((i) => ({
        slug: opts.fileSlug,
        message: `${i.path.join('.')}: ${i.message}`,
      })),
    };
  }
  const c = parsed.data;
  const issues: ContentIssue[] = [];
  const add = (message: string) => issues.push({ slug: c.slug, message });
  if (c.slug !== opts.fileSlug) add(`slug "${c.slug}" does not match file name "${opts.fileSlug}"`);
  if (c.players.min > c.players.max) add('players.min > players.max');
  if (!opts.hasEngine && !c.example) add('Tier 2 game (no engine) must include a scripted example');
  const terms = new Set(c.glossary.map((g) => g.term.toLowerCase()));
  const checkText = (where: string, text: string) => {
    for (const t of referencedTerms(text)) {
      if (!terms.has(t.toLowerCase())) add(`${where}: glossary term "${t}" is not defined`);
    }
  };
  const checkScene = (where: string, scene: Scene | undefined) => {
    if (!scene) return;
    for (const z of scene.zones) {
      for (const i of [...(z.highlight ?? []), ...(z.faceDown ?? [])]) {
        if (i >= z.cards.length) add(`${where}: zone "${z.id}" index ${i} out of range`);
      }
    }
  };
  c.lesson.forEach((s, i) => {
    checkText(`lesson[${i}].body`, s.body);
    checkScene(`lesson[${i}].scene`, s.scene);
  });
  c.example?.steps.forEach((s, i) => {
    checkText(`example.steps[${i}].narration`, s.narration);
    checkScene(`example.steps[${i}].scene`, s.scene);
  });
  return { content: c, issues };
}
