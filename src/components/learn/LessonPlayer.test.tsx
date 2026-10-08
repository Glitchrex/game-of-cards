// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { StoreHydrator } from '@/store/hydrate';
import { useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';
import { LessonPlayer, type LessonGame } from './LessonPlayer';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  localStorage.clear();
  useProgress.setState({ games: {} });
  useSettings.setState({ motion: 'reduce' });
});

const game: LessonGame = {
  slug: 'teen-patti',
  name: 'Teen Patti',
  glossary: [{ term: 'pot', definition: 'All the bets in the middle.' }],
  lesson: [
    {
      title: 'The goal',
      body: 'Win the [[pot]].',
      scene: {
        zones: [{ id: 'hand', label: 'Your hand', cards: ['QH', 'QS', '4D'], highlight: [0, 1] }],
        caption: 'A pair of Queens.',
      },
    },
    { title: 'The deal', body: 'Three cards each.', tip: 'Never show your cards.' },
    { title: 'Betting', body: 'Bet or fold.' },
    { title: 'The show', body: 'Compare hands at the end.' },
  ],
};

const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 2, name });

function setup() {
  const user = userEvent.setup();
  render(
    <>
      <StoreHydrator />
      <LessonPlayer game={game} />
    </>,
  );
  return user;
}

describe('LessonPlayer', () => {
  it('shows step 1 with its scene and progress, and marks the game started', async () => {
    setup();
    expect(await heading(/The goal/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Step 1 of 4');
    expect(screen.getByTestId('lesson-progress')).toHaveAttribute('data-step', '1');
    expect(screen.getByText('A pair of Queens.')).toBeInTheDocument();
    expect(screen.getByText(/Your hand: Queen of Hearts/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'pot' })).toBeInTheDocument();
    await waitFor(() => expect(useProgress.getState().games['teen-patti']?.started).toBe(true));
    expect(useProgress.getState().games['teen-patti']?.lessonDone).toBe(false);
  });

  it('moves with Next and Back and focuses the new step heading', async () => {
    const user = setup();
    await heading(/The goal/);
    expect(screen.getByTestId('lesson-back')).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByTestId('lesson-next'));
    const deal = await heading(/The deal/);
    await waitFor(() => expect(deal).toHaveFocus());
    expect(deal).toHaveAccessibleName('Step 2 of 4: The deal');
    expect(screen.getByRole('note')).toHaveTextContent('Tip: Never show your cards.');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Step 2 of 4');
    await user.click(screen.getByTestId('lesson-back'));
    expect(await heading(/The goal/)).toBeInTheDocument();
  });

  it('moves with the arrow keys but not while typing or on a glossary term', async () => {
    const user = setup();
    await heading(/The goal/);
    await user.keyboard('{ArrowRight}');
    expect(await heading(/The deal/)).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(await heading(/Betting/)).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(await heading(/The deal/)).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    const goal = await heading(/The goal/);

    // Focus on a glossary term (its popover is open): arrows are left alone.
    screen.getByRole('button', { name: 'pot' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(goal).toBeInTheDocument();
    expect(screen.getByTestId('lesson-progress')).toHaveAttribute('data-step', '1');
  });

  it('ignores arrow keys typed into an input', async () => {
    const user = userEvent.setup();
    render(
      <>
        <StoreHydrator />
        <label>
          Notes <input />
        </label>
        <LessonPlayer game={game} />
      </>,
    );
    await heading(/The goal/);
    await user.click(screen.getByLabelText('Notes'));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('lesson-progress')).toHaveAttribute('data-step', '1');
  });

  it('marks the lesson done on the last step and ends with try / quiz links', async () => {
    const user = setup();
    await heading(/The goal/);
    for (let i = 0; i < 3; i++) await user.click(screen.getByTestId('lesson-next'));
    await heading(/The show/);
    await waitFor(() => expect(useProgress.getState().games['teen-patti']?.lessonDone).toBe(true));
    expect(screen.getByTestId('lesson-next')).toHaveTextContent('Finish');

    await user.click(screen.getByTestId('lesson-next'));
    const done = await heading('You’ve got the basics of Teen Patti!');
    await waitFor(() => expect(done).toHaveFocus());
    expect(screen.queryByTestId('lesson-next')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try an example' })).toHaveAttribute(
      'href',
      '/games/teen-patti/try',
    );
    expect(screen.getByRole('link', { name: 'Take the quiz' })).toHaveAttribute(
      'href',
      '/games/teen-patti/quiz',
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Lesson complete');

    await user.click(screen.getByRole('button', { name: 'Start the lesson again' }));
    expect(await heading(/The goal/)).toBeInTheDocument();
  });
});
