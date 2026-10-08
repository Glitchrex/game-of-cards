// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { dismissAllToasts, Toaster } from '@/components/ui/Toast';
import { createShareImage, shareOrDownload } from '@/lib/share-card';
import { StoreHydrator } from '@/store/hydrate';
import { useStats, type Award } from '@/store/stats';
import { AwardsShelf, SHELF_INITIAL, titleStyle } from './AwardsShelf';

vi.mock('@/lib/share-card', () => ({
  createShareImage: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
  shareOrDownload: vi.fn(() => Promise.resolve('downloaded')),
}));

const NAMES = { blackjack: 'Blackjack', war: 'War', 'teen-patti': 'Teen Patti' };

const award = (n: number, over: Partial<Award> = {}): Award => ({
  id: `award-${n}`,
  titleId: `title-${n}`,
  text: `Title number ${n}`,
  film: `Film ${n} (199${n % 10})`,
  gameSlug: 'war',
  jeet: n * 10,
  at: Date.UTC(2026, 8, n, 12),
  ...over,
});

// Persisted order is oldest-first here on purpose: the shelf must sort newest first.
const AWARDS: Award[] = [
  award(1, { text: 'Thalaivar of the Table', film: 'Baasha (1995)', gameSlug: 'teen-patti' }),
  award(3, {
    text: 'Baazigar of the Table',
    film: 'Baazigar (1993)',
    gameSlug: 'blackjack',
    jeet: 1250,
    titleId: 'baazigar',
    at: Date.UTC(2026, 9, 5, 12),
  }),
  award(2, { text: 'The Comeback Kid', film: 'Rocky (1976)' }),
];

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  localStorage.clear();
  dismissAllToasts();
  vi.mocked(createShareImage).mockClear();
  vi.mocked(shareOrDownload).mockClear();
  vi.mocked(shareOrDownload).mockImplementation(() => Promise.resolve('downloaded'));
  useStats.setState({ awards: [] });
});

function renderShelf(blurbs?: Record<string, string>) {
  return render(
    <>
      <StoreHydrator />
      <AwardsShelf gameNames={NAMES} titleBlurbs={blurbs} />
      <Toaster />
    </>,
  );
}

describe('AwardsShelf', () => {
  it('renders every award as a mini poster, newest first', () => {
    useStats.setState({ awards: AWARDS });
    renderShelf();
    const shelf = screen.getByTestId('awards-shelf');
    expect(within(shelf).getByRole('heading', { name: 'Awards shelf', level: 2 })).toBeVisible();
    expect(screen.getByTestId('awards-count')).toHaveTextContent('3 titles');
    const list = within(shelf).getByRole('list', { name: 'Your awards, newest first' });
    const titles = within(list)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(titles).toEqual(['Baazigar of the Table', 'The Comeback Kid', 'Thalaivar of the Table']);

    const newest = screen.getByTestId('award-0');
    expect(newest).toHaveAccessibleName('Baazigar of the Table');
    expect(newest).toHaveTextContent('Game of Cards presents');
    expect(newest).toHaveTextContent('Inspired by Baazigar (1993)');
    expect(newest).toHaveTextContent('Won at Blackjack');
    expect(newest).toHaveTextContent('+1,250 Jeet');
    expect(newest).toHaveTextContent('5 Oct 2026');
    expect(screen.getByTestId('award-2')).toHaveTextContent('Won at Teen Patti');
    expect(screen.getByTestId('share-award-0')).toHaveAccessibleName(
      'Share the poster for “Baazigar of the Table”',
    );
  });

  it('Share renders the poster with createShareImage and hands it to shareOrDownload', async () => {
    const user = userEvent.setup();
    useStats.setState({ awards: AWARDS });
    renderShelf({ baazigar: 'You were losing, then you weren’t.' });
    await user.click(screen.getByTestId('share-award-0'));

    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledTimes(1));
    expect(createShareImage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createShareImage).mock.calls[0]?.[0]).toMatchObject({
      title: 'Baazigar of the Table',
      film: 'Baazigar (1993)',
      blurb: 'You were losing, then you weren’t.',
      gameName: 'Blackjack',
      jeet: 1250,
      dateLabel: '5 Oct 2026',
    });
    const [blob, filename, text] = vi.mocked(shareOrDownload).mock.calls[0] ?? [];
    expect(blob).toBeInstanceOf(Blob);
    expect(filename).toBe('game-of-cards-baazigar-of-the-table.png');
    expect(text).toBe('I earned “Baazigar of the Table” playing Blackjack on Game of Cards!');
    expect(await screen.findByText('Poster saved — go show it off!')).toBeInTheDocument();
  });

  it('shares an older award from its own button, and confirms a native share', async () => {
    const user = userEvent.setup();
    vi.mocked(shareOrDownload).mockImplementation(() => Promise.resolve('shared'));
    useStats.setState({ awards: AWARDS });
    renderShelf();
    await user.click(screen.getByTestId('share-award-2'));
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createShareImage).mock.calls[0]?.[0]).toMatchObject({
      title: 'Thalaivar of the Table',
      gameName: 'Teen Patti',
    });
    expect(await screen.findByText('Shared! Take a bow.')).toBeInTheDocument();
  });

  it('stays quiet when the learner dismisses the share sheet, and reports real failures', async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    useStats.setState({ awards: AWARDS });
    renderShelf();

    vi.mocked(shareOrDownload).mockImplementationOnce(() =>
      Promise.reject(new DOMException('Share cancelled', 'AbortError')),
    );
    await user.click(screen.getByTestId('share-award-0'));
    await waitFor(() =>
      expect(screen.getByTestId('share-award-0')).not.toHaveAttribute('aria-busy'),
    );
    expect(screen.queryByRole('status', { name: 'Notifications' })).toBeEmptyDOMElement();

    vi.mocked(createShareImage).mockImplementationOnce(() =>
      Promise.reject(new Error('no canvas')),
    );
    await user.click(screen.getByTestId('share-award-1'));
    expect(
      await screen.findByText('Couldn’t make the poster. Please try again.'),
    ).toBeInTheDocument();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('survives damaged persisted awards (no blank posters, no crash on a bad date)', () => {
    useStats.setState({
      awards: [
        award(1, { text: 'Thalaivar of the Table' }),
        award(2, { text: '' }),
        award(3, { text: 'Don of the Deck', at: Number.NaN }),
      ],
    });
    renderShelf();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Thalaivar of the Table',
      'Don of the Deck',
    ]);
    expect(screen.getByTestId('awards-count')).toHaveTextContent('2 titles');
    expect(screen.getByTestId('award-1').querySelector('time')).toBeNull();
  });

  it('sizes poster titles so the longest word fits the poster', () => {
    const size = (text: string) =>
      Number(/,\s*([\d.]+)cqi/.exec(String(titleStyle(text).fontSize))?.[1] ?? NaN);
    expect(size('Unbreakable')).toBeLessThan(size('Don of the Deck'));
    expect(size('With Great Power Comes Great Jeet')).toBeLessThan(size('Baazigar of the Table'));
    // Every size stays within the poster type scale (14 px – 22 px).
    expect(String(titleStyle('Baazigar of the Table').fontSize)).toMatch(
      /^clamp\(0\.875rem, [\d.]+cqi, 1\.375rem\)$/,
    );
  });

  it('shows an encouraging empty state before the first win', () => {
    renderShelf();
    const empty = screen.getByTestId('awards-empty');
    expect(empty).toHaveTextContent('Your shelf is waiting for its first trophy');
    expect(within(empty).getByRole('link', { name: 'Find a game to win' })).toHaveAttribute(
      'href',
      '/games?playable=1',
    );
    expect(screen.queryByTestId('share-award-0')).not.toBeInTheDocument();
  });

  it(`shows the newest ${SHELF_INITIAL} posters, with a toggle for the rest`, async () => {
    const user = userEvent.setup();
    useStats.setState({ awards: Array.from({ length: 11 }, (_, i) => award(i + 1)) });
    renderShelf();
    expect(screen.getAllByTestId(/^share-award-\d+$/)).toHaveLength(SHELF_INITIAL);
    expect(screen.getByTestId('share-award-0')).toHaveAccessibleName(/Title number 11/);
    const toggle = screen.getByRole('button', { name: 'Show all 11 awards' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(screen.getAllByTestId(/^share-award-\d+$/)).toHaveLength(11);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveTextContent('Show fewer');
    expect(toggle).toHaveFocus();
  });
});
