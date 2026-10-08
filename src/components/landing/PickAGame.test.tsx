// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { LiveAnnouncer } from '@/components/layout/LiveAnnouncer';
import { MOODS } from '@/lib/content/schema';
import { t, type TKey } from '@/lib/i18n';
import {
  PLAYER_BUCKETS,
  TIME_BUCKETS,
  recommendGames,
  type RecommendAnswers,
} from '@/lib/recommend';
import { PickAGame } from './PickAGame';
import {
  MOOD_ANSWERS,
  PLAYERS_ANSWERS,
  TIME_ANSWERS,
  toPickableGame,
  type PickableGame,
} from './pick-data';
import { FIXTURE_GAMES } from './test-fixtures';

// The trigger, the dialog and its data module must never load the catalog (and with it
// every content file) at runtime: the client gets a slim list from the server page.
vi.mock('@/lib/content/catalog', () => {
  throw new Error('the Pick a game dialog must not import the catalog at runtime');
});

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

const GAMES: readonly PickableGame[] = FIXTURE_GAMES.map(toPickableGame);

function setup(games: readonly PickableGame[] = GAMES) {
  const user = userEvent.setup();
  render(
    <>
      <PickAGame games={games} />
      <LiveAnnouncer />
    </>,
  );
  return user;
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('cta-pick'));
  return screen.findByRole('dialog', { name: 'Pick a game for me' });
}

describe('PickAGame', () => {
  it('renders only the trigger until it is used (the dialog code loads on demand)', () => {
    setup();
    const trigger = screen.getByTestId('cta-pick');
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveAccessibleName('Pick a game for me');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pick-dialog')).not.toBeInTheDocument();
  });

  it('walks through three questions to a recommendation with working links', async () => {
    const user = setup();
    const dialog = await openDialog(user);
    expect(within(dialog).getByTestId('pick-dialog')).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'How many players?' })).toHaveFocus();
    expect(within(dialog).getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      'Question 1 of 3',
    );
    for (const value of PLAYERS_ANSWERS)
      expect(within(dialog).getByTestId(`pick-answer-${value}`)).toBeInTheDocument();
    expect(within(dialog).getByTestId('pick-answer-two')).toHaveTextContent('Two of us');

    await user.click(screen.getByTestId('pick-answer-two'));
    expect(screen.getByRole('heading', { name: 'What’s the mood?' })).toHaveFocus();
    expect(screen.getByTestId('pick-answer-lucky')).toHaveTextContent('Feeling lucky');
    expect(screen.getAllByRole('button', { pressed: false }).length).toBe(MOOD_ANSWERS.length);
    await user.click(screen.getByTestId('pick-answer-brainy'));

    expect(screen.getByRole('heading', { name: 'How much time?' })).toHaveFocus();
    expect(screen.getByTestId('pick-answer-quick')).toHaveAccessibleName('Quick 10 min or less');
    expect(screen.getByTestId('pick-answer-medium')).toHaveTextContent('A while');
    expect(screen.getByTestId('pick-answer-long')).toHaveTextContent('Long session');
    await user.click(screen.getByTestId('pick-answer-quick'));

    const answers: RecommendAnswers = { players: 'two', mood: 'brainy', time: 'quick' };
    const [top, second, third] = recommendGames(GAMES, answers);
    expect(top && second && third).toBeTruthy();

    const result = screen.getByTestId('pick-result');
    expect(result).toHaveAttribute('data-slug', top!.game.slug);
    expect(within(result).getByRole('heading', { name: top!.game.name })).toHaveFocus();
    expect(result).toHaveTextContent(top!.reason);
    expect(result).toHaveTextContent(top!.game.hook);

    const learn = within(result).getByRole('link', { name: `Learn it: ${top!.game.name}` });
    expect(learn).toHaveAttribute('href', `/games/${top!.game.slug}/learn`);
    expect(learn).toHaveAttribute('data-testid', 'pick-learn');
    const tryIt = within(result).getByRole('link', { name: `Try it: ${top!.game.name}` });
    expect(tryIt).toHaveAttribute('href', `/games/${top!.game.slug}/try`);
    expect(tryIt).toHaveAttribute('data-testid', 'pick-try');

    const runnersUp = screen.getByRole('list', { name: 'Also showing' });
    const chips = within(runnersUp).getAllByRole('link');
    expect(chips.map((a) => a.getAttribute('href'))).toEqual([
      `/games/${second!.game.slug}`,
      `/games/${third!.game.slug}`,
    ]);
    expect(chips[0]).toHaveTextContent(second!.game.name);

    expect(screen.getByTestId('sr-announcer')).toHaveTextContent(
      `We picked ${top!.game.name}. ${top!.reason}`,
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'All done');
  });

  it('marks a Tier 1 pick as playable against bots', async () => {
    const user = setup();
    await openDialog(user);
    await user.click(screen.getByTestId('pick-answer-solo'));
    await user.click(screen.getByTestId('pick-answer-lucky'));
    await user.click(screen.getByTestId('pick-answer-quick'));
    const top = recommendGames(GAMES, { players: 'solo', mood: 'lucky', time: 'quick' })[0]!;
    expect(top.game.slug).toBe('blackjack');
    const result = screen.getByTestId('pick-result');
    expect(result).toHaveTextContent('Play vs bots here');
    expect(result).toHaveTextContent('Worldwide');
    expect(result).toHaveTextContent('1–7 players');
    expect(result).toHaveTextContent('~2 min');
    expect(result).toHaveTextContent('Difficulty 2 of 5');
  });

  it('goes back to the previous question with its answer still selected', async () => {
    const user = setup();
    await openDialog(user);
    await user.click(screen.getByTestId('pick-answer-small-group'));
    expect(screen.getByRole('heading', { name: 'What’s the mood?' })).toBeInTheDocument();
    await user.click(screen.getByTestId('pick-back'));
    expect(screen.getByRole('heading', { name: 'How many players?' })).toHaveFocus();
    expect(screen.getByTestId('pick-answer-small-group')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('pick-answer-two')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('pick-back')).not.toBeInTheDocument();
  });

  it('starts over from the result screen', async () => {
    const user = setup();
    await openDialog(user);
    await user.click(screen.getByTestId('pick-answer-big-group'));
    await user.click(screen.getByTestId('pick-answer-social'));
    await user.click(screen.getByTestId('pick-answer-long'));
    expect(screen.getByTestId('pick-result')).toBeInTheDocument();

    await user.click(screen.getByTestId('pick-restart'));
    expect(screen.queryByTestId('pick-result')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How many players?' })).toHaveFocus();
    expect(screen.getByTestId('pick-answer-big-group')).toHaveAttribute('aria-pressed', 'false');
  });

  it('is fully keyboard operable and hands focus back to the trigger on Escape', async () => {
    const user = setup();
    const trigger = screen.getByTestId('cta-pick');
    await user.tab();
    expect(trigger).toHaveFocus();
    await user.keyboard('{Enter}');
    await screen.findByRole('dialog');
    expect(screen.getByRole('heading', { name: 'How many players?' })).toHaveFocus();

    await user.tab();
    expect(screen.getByTestId('pick-answer-solo')).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId('pick-answer-two')).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('heading', { name: 'What’s the mood?' })).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByTestId('pick-answer-brainy')).toHaveFocus();
    await user.keyboard(' ');

    await user.tab();
    expect(screen.getByTestId('pick-answer-quick')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('pick-result')).toBeInTheDocument();
    await user.tab();
    expect(screen.getByTestId('pick-learn')).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('ignores the second click of a double-click (it would answer the next question)', async () => {
    const user = setup();
    await openDialog(user);
    // Same spot on both screens: "Just me" and "Chill" are both the first answer.
    await user.dblClick(screen.getByTestId('pick-answer-solo'));
    expect(screen.getByRole('heading', { name: 'What’s the mood?' })).toBeInTheDocument();
    expect(screen.getByTestId('pick-answer-chill')).toHaveAttribute('aria-pressed', 'false');
    // Ordinary single clicks (and keyboard presses) carry on as normal.
    await user.click(screen.getByTestId('pick-answer-chill'));
    expect(screen.getByRole('heading', { name: 'How much time?' })).toBeInTheDocument();
  });

  it('starts from question 1 every time it is reopened', async () => {
    const user = setup();
    await openDialog(user);
    await user.click(screen.getByTestId('pick-answer-two'));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await openDialog(user);
    expect(screen.getByRole('heading', { name: 'How many players?' })).toHaveFocus();
    expect(screen.getByTestId('pick-answer-two')).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows a friendly empty state when there are no games yet', async () => {
    const user = setup([]);
    await openDialog(user);
    await user.click(screen.getByTestId('pick-answer-solo'));
    await user.click(screen.getByTestId('pick-answer-chill'));
    await user.click(screen.getByTestId('pick-answer-quick'));
    expect(screen.queryByTestId('pick-result')).not.toBeInTheDocument();
    const empty = screen.getByTestId('pick-empty');
    expect(within(empty).getByRole('link', { name: 'Browse games' })).toHaveAttribute(
      'href',
      '/games',
    );
    await act(async () => {});
    expect(screen.getByTestId('sr-announcer')).toHaveTextContent('The projector’s warming up');
  });
});

describe('pick-data', () => {
  it('offers every answer the recommender understands, each with real copy', () => {
    expect([...PLAYERS_ANSWERS].sort()).toEqual(Object.keys(PLAYER_BUCKETS).sort());
    expect([...MOOD_ANSWERS]).toEqual([...MOODS]);
    expect([...TIME_ANSWERS].sort()).toEqual(Object.keys(TIME_BUCKETS).sort());
    const groups = { players: PLAYERS_ANSWERS, mood: MOOD_ANSWERS, time: TIME_ANSWERS };
    for (const [q, values] of Object.entries(groups)) {
      for (const value of values) {
        for (const part of ['label', 'hint']) {
          const key = `landing.pick.${q}.${value}.${part}`;
          // t() falls back to the key itself when a string is missing.
          expect(t(key as TKey), key).not.toBe(key);
          expect(t(key as TKey).trim().length, key).toBeGreaterThan(1);
        }
      }
    }
  });

  it('keeps only what the dialog needs from a catalog entry', () => {
    const slim = toPickableGame(FIXTURE_GAMES[0]!);
    expect(Object.keys(slim).sort()).toEqual(
      [
        'slug',
        'name',
        'tier',
        'players',
        'difficulty',
        'minutes',
        'moods',
        'order',
        'hook',
        'country',
        'countryCode',
      ].sort(),
    );
    expect(JSON.parse(JSON.stringify(slim))).toEqual(slim);
  });
});
