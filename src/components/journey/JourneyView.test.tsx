// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { StoreHydrator } from '@/store/hydrate';
import { emptyProgress, useProgress, type GameProgress } from '@/store/progress';
import { type GameSummary } from './journey-data';
import { JourneyView } from './JourneyView';

const GAMES: GameSummary[] = [
  { slug: 'war', name: 'War', tier: 1 },
  { slug: 'go-fish', name: 'Go Fish', tier: 1 },
  { slug: 'old-maid', name: 'Old Maid', tier: 2 },
  { slug: 'blackjack', name: 'Blackjack', tier: 1 },
  { slug: 'bridge', name: 'Bridge', tier: 2 },
];

const p = (over: Partial<GameProgress>): GameProgress => ({ ...emptyProgress(), ...over });
const LEARNED = { started: true, lessonDone: true, exampleDone: true, quizBest: 4 };

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  localStorage.clear();
  useProgress.setState({ games: {} });
});

function renderJourney() {
  return render(
    <>
      <StoreHydrator />
      <JourneyView games={GAMES} />
    </>,
  );
}

describe('JourneyView', () => {
  it('renders one linked stop per game, in journey order, inside a labelled list', async () => {
    renderJourney();
    const list = screen.getByRole('list', { name: /journey map/i });
    const links = within(list).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(GAMES.map((g) => `/games/${g.slug}`));
    // Before hydration the stops are neutral; afterwards they carry real statuses.
    expect(screen.getByTestId('journey-node-war')).toHaveAttribute('data-status', 'pending');
    expect(await screen.findByTestId('journey-summary')).toBeInTheDocument();
    expect(screen.getByTestId('journey-node-war')).toHaveAttribute('data-status', 'not-started');
  });

  it('shows each stop’s status from the progress store as an icon + text label', async () => {
    useProgress.setState({
      games: {
        war: p({ ...LEARNED, quizBest: 5, wins: 1 }),
        'go-fish': p({ ...LEARNED }),
        'old-maid': p({ started: true }),
      },
    });
    renderJourney();
    await screen.findByTestId('journey-summary');

    const expected: Record<string, [string, string]> = {
      war: ['mastered', 'Mastered'],
      'go-fish': ['learned', 'Learned'],
      'old-maid': ['learning', 'Learning'],
      blackjack: ['not-started', 'Not started'],
      bridge: ['not-started', 'Not started'],
    };
    for (const [slug, [status, label]] of Object.entries(expected)) {
      const node = screen.getByTestId(`journey-node-${slug}`);
      expect(node).toHaveAttribute('data-status', status);
      expect(node).toHaveTextContent(label);
      // Never colour alone: an icon is drawn in the stop's circle.
      expect(node.querySelector('svg')).not.toBeNull();
    }
    // Screen readers hear name, position and status (and the bot table for Tier 1).
    expect(screen.getByRole('link', { name: '1. War: Mastered. Playable vs bot' })).toBe(
      screen.getByTestId('journey-node-war'),
    );
    expect(screen.getByRole('link', { name: '3. Old Maid: Learning' })).toBeInTheDocument();
  });

  it('marks Tier 1 games with a Play chip', async () => {
    renderJourney();
    await screen.findByTestId('journey-summary');
    expect(screen.getByTestId('journey-node-blackjack')).toHaveTextContent('Play');
    expect(screen.getByTestId('journey-node-bridge')).not.toHaveTextContent('Play');
  });

  it('summarises progress and suggests the first game that is not mastered', async () => {
    useProgress.setState({
      games: {
        war: p({ ...LEARNED, quizBest: 5, wins: 3 }),
        'go-fish': p({ started: true, lessonDone: true }),
        bridge: p({ ...LEARNED, quizBest: 5 }),
      },
    });
    renderJourney();
    expect(await screen.findByTestId('journey-summary')).toHaveTextContent(
      '2 of 5 games learned, 2 mastered',
    );
    expect(screen.getByTestId('journey-count-learned')).toHaveTextContent(/^2$/);
    expect(screen.getByTestId('journey-count-mastered')).toHaveTextContent(/^2$/);
    expect(screen.getByTestId('journey-count-learning')).toHaveTextContent(/^1$/);
    expect(screen.getByRole('progressbar', { name: 'Games learned' })).toHaveAttribute(
      'aria-valuetext',
      '2 of 5 learned',
    );
    expect(screen.getByTestId('journey-next-game')).toHaveTextContent('Go Fish');
    const cta = screen.getByTestId('journey-next-cta');
    expect(cta).toHaveAttribute('href', '/games/go-fish/try');
    expect(cta).toHaveTextContent('Try the example hand');
    expect(screen.getByTestId('journey-node-go-fish')).toHaveAttribute('data-next', 'true');
    expect(
      screen.getByRole('link', { name: /2\. Go Fish: Learning.*Next up/ }),
    ).toBeInTheDocument();

    // Progress updates live.
    act(() => useProgress.getState().markExampleDone('go-fish'));
    expect(screen.getByTestId('journey-next-cta')).toHaveAttribute('href', '/games/go-fish/quiz');
  });

  it('celebrates when every game is mastered', async () => {
    useProgress.setState({
      games: Object.fromEntries(
        GAMES.map((g) => [g.slug, p({ ...LEARNED, quizBest: 5, wins: 1 })]),
      ),
    });
    renderJourney();
    expect(await screen.findByTestId('journey-summary')).toHaveTextContent(
      '5 of 5 games learned, 5 mastered',
    );
    const next = screen.getByTestId('journey-next');
    expect(next).toHaveTextContent(/mastered every game/i);
    expect(within(next).getByRole('link', { name: 'Browse all games' })).toHaveAttribute(
      'href',
      '/games',
    );
    expect(screen.queryByTestId('journey-next-cta')).not.toBeInTheDocument();
  });

  it('lights the road behind learned games', async () => {
    useProgress.setState({ games: { war: p({ ...LEARNED }) } });
    const { container } = renderJourney();
    await screen.findByTestId('journey-summary');
    // Three responsive roads; each lights the start leg and the leg after War.
    expect(container.querySelectorAll('[data-lit="true"]')).toHaveLength(6);
  });
});
