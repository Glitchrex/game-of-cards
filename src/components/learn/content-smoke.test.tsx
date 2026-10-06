// @vitest-environment jsdom
/**
 * Walks every real lesson and scripted example with the learner's UI, so a
 * content file the components can't handle (markup, cards, decisions) fails
 * here rather than in front of a learner.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { validateGameContent, type GameContent } from '@/lib/content/schema';
import { useSettings } from '@/store/settings';
import { LessonPlayer } from './LessonPlayer';
import { ScriptedExample } from './ScriptedExample';

const CONTENT_DIR = path.resolve(import.meta.dirname, '../../../content/games');
const files = readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith('.ts') && f !== 'index.ts' && !f.endsWith('.test.ts'))
  .sort();

const games: GameContent[] = await Promise.all(
  files.map(async (file) => {
    const mod = (await import(path.join(CONTENT_DIR, file))) as { default: unknown };
    const fileSlug = file.replace(/\.ts$/, '');
    const { content, issues } = validateGameContent(mod.default, { fileSlug, hasEngine: true });
    if (!content) throw new Error(`${fileSlug}: ${issues.map((i) => i.message).join('; ')}`);
    return content;
  }),
);

const withExample = games.filter((g) => g.example);

/** Step transitions settle within a frame; poll often to keep this suite quick. */
const FAST = { interval: 5 };

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
  useSettings.setState({ motion: 'reduce' });
});

afterEach(cleanup);

describe('real content in the lesson player', () => {
  it('finds the content files', () => {
    expect(games.length).toBeGreaterThan(0);
  });

  it.each(games.map((g) => [g.slug, g] as const))(
    '%s: every lesson step renders without leftover markup',
    async (_slug, game) => {
      render(<LessonPlayer game={game} />);
      for (const [i, step] of game.lesson.entries()) {
        await waitFor(
          () =>
            expect(screen.getByTestId('lesson-progress')).toHaveAttribute('data-step', `${i + 1}`),
          FAST,
        );
        expect(await screen.findByText(step.title, {}, FAST)).toBeInTheDocument();
        expect(document.body.textContent ?? '').not.toMatch(/\[\[|\]\]|\*\*/);
        fireEvent.click(screen.getByTestId('lesson-next'));
      }
      expect(
        await screen.findByText(`You’ve got the basics of ${game.name}!`, {}, FAST),
      ).toBeInTheDocument();
    },
  );
});

describe('real content in the scripted example', () => {
  it.each(withExample.map((g) => [g.slug, g] as const))(
    '%s: the example can be completed by choosing the right options',
    async (_slug, game) => {
      const example = game.example;
      if (!example) return;
      render(
        <ScriptedExample
          slug={game.slug}
          name={game.name}
          glossary={game.glossary}
          example={example}
          tips={game.tips}
        />,
      );
      fireEvent.click(await screen.findByTestId('example-continue', {}, FAST));
      for (const [i, step] of example.steps.entries()) {
        await waitFor(
          () =>
            expect(screen.getByTestId('example-progress')).toHaveAttribute('data-step', `${i + 1}`),
          FAST,
        );
        expect(document.body.textContent ?? '').not.toMatch(/\[\[|\]\]|\*\*/);
        if (step.decision) {
          expect(screen.queryByTestId('example-continue')).not.toBeInTheDocument();
          const wrong = step.decision.options.findIndex((o) => !o.correct);
          if (wrong >= 0) {
            fireEvent.click(screen.getByTestId(`example-option-${wrong}`));
            expect(screen.getByTestId('example-feedback')).toHaveAttribute('data-tone', 'wrong');
          }
          const right = step.decision.options.findIndex((o) => o.correct);
          fireEvent.click(screen.getByTestId(`example-option-${right}`));
          expect(screen.getByTestId('example-feedback')).toHaveAttribute('data-tone', 'right');
        }
        fireEvent.click(screen.getByTestId('example-continue'));
      }
      expect(await screen.findByTestId('example-outro', {}, FAST)).toBeInTheDocument();
    },
  );
});
