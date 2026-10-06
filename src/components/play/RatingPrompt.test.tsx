// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RatingPrompt, ratingStorageKey } from './RatingPrompt';

type FetchMock = ReturnType<
  typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>
>;

let fetchMock: FetchMock;

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function bodies(): unknown[] {
  return fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
}

beforeEach(() => {
  sessionStorage.clear();
  fetchMock = vi.fn(() => respond(201, { ok: true }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RatingPrompt', () => {
  it('stars → optional comment → Send stores exactly one rating and thanks the learner', async () => {
    const user = userEvent.setup();
    const view = render(<RatingPrompt gameSlug="blackjack" context="lesson" />);
    const prompt = screen.getByTestId('rating-prompt');
    expect(prompt).toHaveTextContent('How was this lesson?');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '4 out of 5 stars' }));
    expect(fetchMock).not.toHaveBeenCalled();
    await user.type(
      screen.getByRole('textbox', { name: /Anything we could do better/ }),
      'Loved the coach',
    );
    await user.click(screen.getByRole('button', { name: 'Send rating' }));

    expect(await screen.findByText('Thanks for the 4-star rating!')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/ratings');
    expect(bodies()[0]).toEqual({ gameSlug: 'blackjack', stars: 4, comment: 'Loved the coach' });
    expect(sessionStorage.getItem(ratingStorageKey('blackjack', 'lesson'))).toBe('1');

    view.unmount();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Doesn't nag again this session…
    const again = render(<RatingPrompt gameSlug="blackjack" context="lesson" />);
    expect(screen.queryByTestId('rating-prompt')).not.toBeInTheDocument();
    again.unmount();
    // …but other contexts / games still ask.
    render(<RatingPrompt gameSlug="blackjack" context="game" />);
    expect(screen.getByTestId('rating-prompt')).toBeInTheDocument();
  });

  it('"Skip comment, just send" sends the stars alone', async () => {
    const user = userEvent.setup();
    render(<RatingPrompt gameSlug="hearts" context="game" />);
    await user.click(screen.getByRole('radio', { name: '5 out of 5 stars' }));
    await user.type(screen.getByRole('textbox'), 'ignored');
    await user.click(screen.getByRole('button', { name: 'Skip comment, just send' }));
    expect(await screen.findByText('Thanks for the 5-star rating!')).toBeInTheDocument();
    expect(bodies()).toEqual([{ gameSlug: 'hearts', stars: 5 }]);
  });

  it('shows the server error and lets the learner retry once more', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementationOnce(() =>
      respond(429, { error: 'Too many requests — take a breather and try again in a minute.' }),
    );
    render(<RatingPrompt gameSlug="spades" context="lesson" />);
    await user.click(screen.getByRole('radio', { name: '2 out of 5 stars' }));
    await user.click(screen.getByRole('button', { name: 'Send rating' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests');
    expect(screen.getByTestId('rating-prompt')).toHaveAttribute('data-state', 'error');
    expect(sessionStorage.getItem(ratingStorageKey('spades', 'lesson'))).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Send rating' }));
    expect(await screen.findByText('Thanks for the 2-star rating!')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends the picked stars once if the learner leaves without pressing Send', async () => {
    const user = userEvent.setup();
    const view = render(<RatingPrompt gameSlug="war" context="game" />);
    await user.click(screen.getByRole('radio', { name: '3 out of 5 stars' }));
    view.unmount();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodies()[0]).toEqual({ gameSlug: 'war', stars: 3 });
    await waitFor(() => expect(sessionStorage.getItem(ratingStorageKey('war', 'game'))).toBe('1'));
  });

  it('sends nothing when no star was picked', () => {
    const view = render(<RatingPrompt gameSlug="war" context="lesson" />);
    view.unmount();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
