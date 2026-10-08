// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { StoreHydrator } from '@/store/hydrate';
import { emptyProgress, useProgress } from '@/store/progress';
import { HubJourney } from './HubJourney';

beforeEach(() => {
  localStorage.clear();
  useProgress.setState({ games: {} });
});

describe('HubJourney', () => {
  it('links Learn → Try → Play → Quiz for Tier 1 and ticks completed steps', async () => {
    localStorage.setItem(
      'goc:progress',
      JSON.stringify({
        state: {
          games: {
            hearts: { ...emptyProgress(), started: true, lessonDone: true, quizBest: 4, wins: 2 },
          },
        },
        version: 1,
      }),
    );
    render(
      <>
        <StoreHydrator />
        <HubJourney slug="hearts" name="Hearts" tier={1} />
      </>,
    );
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/games/hearts/learn',
      '/games/hearts/try',
      '/games/hearts/play',
      '/games/hearts/quiz',
    ]);
    // No ticks before hydration; "Learn" is spotlit as the first step.
    expect(screen.getByTestId('hub-learn')).not.toHaveAttribute('data-done');
    expect(screen.getByTestId('hub-learn')).toHaveAttribute('data-next', 'true');
    await waitFor(() => expect(screen.getByTestId('hub-learn')).toHaveAttribute('data-done'));
    // Once progress loads, the spotlight moves to the first unfinished step.
    expect(screen.getByTestId('hub-learn')).not.toHaveAttribute('data-next');
    expect(screen.getByTestId('hub-try')).toHaveAttribute('data-next', 'true');
    expect(screen.getByTestId('hub-play')).not.toHaveAttribute('data-next');
    expect(screen.getByTestId('hub-learn')).toHaveTextContent('Done');
    expect(screen.getByTestId('hub-try')).not.toHaveAttribute('data-done');
    expect(screen.getByTestId('hub-play')).toHaveTextContent('2 wins');
    expect(screen.getByTestId('hub-quiz')).toHaveTextContent('Best 4/5');
    expect(screen.getByTestId('hub-status')).toHaveTextContent('Your progress: Learning');
  });

  it('has no Play step for Tier 2 games', () => {
    render(<HubJourney slug="durak" name="Durak" tier={2} />);
    expect(screen.queryByTestId('hub-play')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });
});
