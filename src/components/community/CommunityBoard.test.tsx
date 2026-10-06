// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { LiveAnnouncer } from '@/components/layout/LiveAnnouncer';
import { dismissAllToasts, Toaster } from '@/components/ui/Toast';
import { type ApiResult, type Post, type VoteResult } from '@/lib/api-client';
import type * as ApiClient from '@/lib/api-client';
import { useSettings } from '@/store/settings';
import { CommunityBoard } from './CommunityBoard';
import { deferred, makePost } from './test-fixtures';

const api = vi.hoisted(() => ({
  listPosts: vi.fn(),
  createPost: vi.fn(),
  toggleVote: vi.fn(),
}));

vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  ...api,
}));
vi.mock('@/store/hydrate', () => ({ useHydrated: () => true }));

const VOTER = 'voter-token-1234';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  useSettings.setState({ voterToken: VOTER });
  api.listPosts.mockReset();
  api.createPost.mockReset();
  api.toggleVote.mockReset();
});

afterEach(() => {
  dismissAllToasts();
});

const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data });

function renderBoard(posts: Post[] = []) {
  api.listPosts.mockResolvedValue(ok({ posts }));
  const user = userEvent.setup();
  render(
    <>
      <CommunityBoard />
      <Toaster />
    </>,
  );
  return { user };
}

function cardIds(): string[] {
  return within(screen.getByTestId('post-list'))
    .queryAllByRole('article')
    .map((el) => el.getAttribute('data-testid') ?? '');
}

describe('CommunityBoard — list', () => {
  it('loads posts after hydration with the browser voter token and renders cards', async () => {
    const a = makePost({
      title: 'Add Mendikot',
      type: 'game',
      status: 'planned',
      authorName: 'Asha',
      commentCount: 3,
      upvotes: 7,
    });
    const b = makePost({ title: 'Cards overlap on my phone', type: 'bug', status: 'done' });
    renderBoard([a, b]);

    const card = await screen.findByTestId(`post-card-${a.id}`);
    expect(api.listPosts).toHaveBeenCalledWith(
      { sort: 'new', type: 'all', voter: VOTER },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(within(card).getByRole('link', { name: 'Add Mendikot' })).toHaveAttribute(
      'href',
      `/community/${a.id}`,
    );
    expect(within(card).getByText('Game request')).toBeInTheDocument();
    expect(within(card).getByText('Planned')).toBeInTheDocument();
    expect(within(card).getByText('by Asha')).toBeInTheDocument();
    expect(
      within(card).getByRole('link', { name: '3 comments on “Add Mendikot”' }),
    ).toHaveAttribute('href', `/community/${a.id}#comments`);
    expect(screen.getByTestId(`upvote-${a.id}`)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId(`upvote-${a.id}`)).toHaveAccessibleName(
      'Upvote “Add Mendikot” — 7 upvotes',
    );

    const other = screen.getByTestId(`post-card-${b.id}`);
    expect(within(other).getByText('Anonymous')).toBeInTheDocument();
    expect(within(other).getByText('Done')).toBeInTheDocument();
    expect(within(other).getByText('No comments yet')).toBeInTheDocument();
    expect(screen.getByTestId('post-count')).toHaveTextContent('2 posts');
  });

  it('never sends a malformed stored voter token (the API would reject the list)', async () => {
    useSettings.setState({ voterToken: 'not a token!' });
    renderBoard([]);
    await screen.findByTestId('post-empty');
    expect(api.listPosts).toHaveBeenCalledWith(
      { sort: 'new', type: 'all', voter: null },
      expect.anything(),
    );
  });

  it('shows loading skeletons until the first answer arrives', async () => {
    const pending = deferred<ApiResult<{ posts: Post[] }>>();
    api.listPosts.mockReturnValue(pending.promise);
    render(<CommunityBoard />);
    expect(screen.getAllByTestId('post-skeleton')).toHaveLength(3);
    expect(screen.getByRole('status')).toHaveTextContent('Loading posts…');
    expect(screen.getByTestId('post-list')).toHaveAttribute('aria-busy', 'true');

    await act(async () => pending.resolve(ok({ posts: [makePost({ title: 'Hello board' })] })));
    expect(await screen.findByRole('link', { name: 'Hello board' })).toBeInTheDocument();
    expect(screen.queryByTestId('post-skeleton')).not.toBeInTheDocument();
  });

  it('sort tabs and filter chips call listPosts with the right params', async () => {
    const { user } = renderBoard([makePost()]);
    await waitFor(() => expect(api.listPosts).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('sort-new')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('filter-all')).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByTestId('sort-top'));
    await waitFor(() => expect(api.listPosts).toHaveBeenCalledTimes(2));
    expect(api.listPosts).toHaveBeenLastCalledWith(
      { sort: 'top', type: 'all', voter: VOTER },
      expect.anything(),
    );
    expect(screen.getByTestId('sort-top')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('sort-new')).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByTestId('filter-bug'));
    await waitFor(() => expect(api.listPosts).toHaveBeenCalledTimes(3));
    expect(api.listPosts).toHaveBeenLastCalledWith(
      { sort: 'top', type: 'bug', voter: VOTER },
      expect.anything(),
    );
    expect(screen.getByTestId('filter-bug')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('filter-all')).toHaveAttribute('aria-pressed', 'false');

    // Clicking the active chip again keeps the filter (radio-like) and doesn't refetch.
    await user.click(screen.getByTestId('filter-bug'));
    expect(screen.getByTestId('filter-bug')).toHaveAttribute('aria-pressed', 'true');
    expect(api.listPosts).toHaveBeenCalledTimes(3);

    for (const type of ['feature', 'game', 'general'] as const) {
      await user.click(screen.getByTestId(`filter-${type}`));
      await waitFor(() =>
        expect(api.listPosts).toHaveBeenLastCalledWith(
          { sort: 'top', type, voter: VOTER },
          expect.anything(),
        ),
      );
    }
  });

  it('shows an empty state that leads to the form', async () => {
    const { user } = renderBoard([]);
    const empty = await screen.findByTestId('post-empty');
    expect(within(empty).getByRole('heading', { name: 'The stage is empty' })).toBeInTheDocument();
    await user.click(within(empty).getByRole('button', { name: 'Write a post' }));
    expect(screen.getByTestId('post-title-input')).toHaveFocus();
  });

  it('offers "Show all posts" when a filter has no results', async () => {
    const { user } = renderBoard([]);
    await screen.findByTestId('post-empty');
    await user.click(screen.getByTestId('filter-game'));
    expect(
      await screen.findByRole('heading', { name: 'Nothing in this row yet' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show all posts' }));
    expect(screen.getByTestId('filter-all')).toHaveAttribute('aria-pressed', 'true');
  });

  it('reports a failed load and retries', async () => {
    api.listPosts.mockResolvedValueOnce({
      ok: false,
      status: 0,
      error: 'Network error — check your connection and try again.',
    });
    api.listPosts.mockResolvedValue(ok({ posts: [makePost({ title: 'Back on screen' })] }));
    const user = userEvent.setup();
    render(<CommunityBoard />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Network error — check your connection and try again.');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Back on screen' })).toBeInTheDocument();
  });
});

describe('CommunityBoard — new post form', () => {
  it('validates on the client before posting', async () => {
    const { user } = renderBoard([]);
    await screen.findByTestId('post-empty');
    await user.click(screen.getByTestId('post-submit'));

    const title = screen.getByTestId('post-title-input');
    expect(title).toHaveFocus();
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAccessibleDescription(/Title is required\./);
    expect(screen.getByText('Description is required.')).toBeInTheDocument();
    expect(api.createPost).not.toHaveBeenCalled();

    await user.type(title, 'Hi');
    await user.type(screen.getByTestId('post-body-input'), 'Too short');
    await user.type(screen.getByTestId('post-email-input'), 'not-an-email');
    await user.click(screen.getByTestId('post-submit'));
    expect(screen.getByText('Title needs at least 3 characters.')).toBeInTheDocument();
    expect(screen.getByText('Description needs at least 10 characters.')).toBeInTheDocument();
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(api.createPost).not.toHaveBeenCalled();

    // The type select offers exactly the four post types.
    const select = screen.getByTestId('post-type-select');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => [(o as HTMLOptionElement).value, o.textContent]),
    ).toEqual([
      ['feature', 'Feature request'],
      ['bug', 'Bug'],
      ['game', 'Game request'],
      ['general', 'General feedback'],
    ]);
  });

  it('creates a post, puts it at the top of the board and shows a toast', async () => {
    const existing = makePost({ title: 'An older idea' });
    const { user } = renderBoard([existing]);
    await screen.findByTestId(`post-card-${existing.id}`);

    const created = makePost({
      type: 'game',
      title: 'Please add Mendikot',
      body: 'My family plays it every Diwali.\nIt would be amazing here!',
      authorName: 'Asha',
    });
    api.createPost.mockResolvedValue(ok({ post: created }));

    await user.selectOptions(screen.getByTestId('post-type-select'), 'game');
    await user.type(screen.getByTestId('post-title-input'), '  Please add Mendikot ');
    await user.type(
      screen.getByTestId('post-body-input'),
      'My family plays it every Diwali.{enter}It would be amazing here!',
    );
    await user.type(screen.getByTestId('post-name-input'), 'Asha');
    await user.type(screen.getByTestId('post-email-input'), 'asha@example.com');
    await user.click(screen.getByTestId('post-submit'));

    await screen.findByTestId(`post-card-${created.id}`);
    expect(api.createPost).toHaveBeenCalledWith({
      type: 'game',
      title: 'Please add Mendikot',
      body: 'My family plays it every Diwali.\nIt would be amazing here!',
      name: 'Asha',
      email: 'asha@example.com',
      website: '',
    });
    expect(cardIds()).toEqual([`post-card-${created.id}`, `post-card-${existing.id}`]);
    expect(
      within(screen.getByTestId(`post-card-${created.id}`)).getByText('Just posted'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('toast')).toHaveTextContent(
      'Posted! Your idea is at the top of the board.',
    );
    // Title and description reset; type and name are kept for the next idea.
    expect(screen.getByTestId('post-title-input')).toHaveValue('');
    expect(screen.getByTestId('post-body-input')).toHaveValue('');
    expect(screen.getByTestId('post-type-select')).toHaveValue('game');
    expect(screen.getByTestId('post-name-input')).toHaveValue('Asha');
  });

  it('switches back to Newest and a matching filter after posting', async () => {
    const { user } = renderBoard([]);
    await screen.findByTestId('post-empty');
    await user.click(screen.getByTestId('sort-top'));
    await user.click(screen.getByTestId('filter-bug'));
    await waitFor(() => expect(api.listPosts).toHaveBeenCalledTimes(3));

    const created = makePost({ type: 'feature', title: 'Dark mode for cards' });
    api.createPost.mockResolvedValue(ok({ post: created }));
    api.listPosts.mockResolvedValue(ok({ posts: [created] }));
    await user.type(screen.getByTestId('post-title-input'), 'Dark mode for cards');
    await user.type(screen.getByTestId('post-body-input'), 'Easier on the eyes at night.');
    await user.click(screen.getByTestId('post-submit'));

    await screen.findByTestId(`post-card-${created.id}`);
    expect(screen.getByTestId('sort-new')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('filter-all')).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() =>
      expect(api.listPosts).toHaveBeenLastCalledWith(
        { sort: 'new', type: 'all', voter: VOTER },
        expect.anything(),
      ),
    );
  });

  it('shows server field errors inline and the rate-limit message', async () => {
    const { user } = renderBoard([]);
    await screen.findByTestId('post-empty');
    await user.type(screen.getByTestId('post-title-input'), 'A fine title');
    await user.type(screen.getByTestId('post-body-input'), 'A fine description too.');

    api.createPost.mockResolvedValueOnce({
      ok: false,
      status: 400,
      error: 'Please check the highlighted fields and try again.',
      fieldErrors: { title: 'Title must be between 3 and 120 characters.' },
    });
    await user.click(screen.getByTestId('post-submit'));
    expect(
      await screen.findByText('Title must be between 3 and 120 characters.'),
    ).toBeInTheDocument();
    const title = screen.getByTestId('post-title-input');
    await waitFor(() => expect(title).toHaveFocus());
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please check the highlighted fields and try again.',
    );

    // Editing the field clears its server error.
    await user.type(title, '!');
    expect(
      screen.queryByText('Title must be between 3 and 120 characters.'),
    ).not.toBeInTheDocument();

    api.createPost.mockResolvedValueOnce({
      ok: false,
      status: 429,
      error: 'Too many requests — take a breather and try again in a minute.',
    });
    await user.click(screen.getByTestId('post-submit'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many requests — take a breather and try again in a minute.',
    );
    expect(screen.getByTestId('post-title-input')).toHaveValue('A fine title!');
  });

  it('keeps the honeypot out of reach of people and assistive tech', async () => {
    renderBoard([]);
    await screen.findByTestId('post-empty');
    const honeypot = screen.getByTestId('post-honeypot');
    expect(honeypot).toHaveAttribute('name', 'website');
    expect(honeypot).toHaveAttribute('tabindex', '-1');
    expect(honeypot).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('textbox', { name: /website/i })).not.toBeInTheDocument();
  });
});

describe('CommunityBoard — upvotes', () => {
  it('toggles optimistically, then settles on the server values', async () => {
    const post = makePost({ title: 'Teen Patti tips', upvotes: 4, hasVoted: false });
    const { user } = renderBoard([post]);
    const button = await screen.findByTestId(`upvote-${post.id}`);

    const pending = deferred<ApiResult<VoteResult>>();
    api.toggleVote.mockReturnValue(pending.promise);
    await user.click(button);

    // Before the server answers.
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('data-count', '5');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(api.toggleVote).toHaveBeenCalledWith(post.id, VOTER);

    // A second click while the first is in flight is ignored.
    await user.click(button);
    expect(api.toggleVote).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve(ok({ upvotes: 9, hasVoted: true })));
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('data-count', '9');
    expect(button).not.toHaveAttribute('aria-busy');
    expect(button).toHaveAccessibleName('Upvote “Teen Patti tips” — 9 upvotes');

    // Toggling again removes the vote.
    api.toggleVote.mockResolvedValue(ok({ upvotes: 8, hasVoted: false }));
    await user.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));
    expect(button).toHaveAttribute('data-count', '8');
  });

  it('rolls back and explains when the vote fails', async () => {
    const post = makePost({ title: 'Hold’em hand ranks', upvotes: 1, hasVoted: true });
    const { user } = renderBoard([post]);
    const button = await screen.findByTestId(`upvote-${post.id}`);
    expect(button).toHaveAttribute('aria-pressed', 'true');

    const pending = deferred<ApiResult<VoteResult>>();
    api.toggleVote.mockReturnValue(pending.promise);
    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('data-count', '0');

    await act(async () =>
      pending.resolve({
        ok: false,
        status: 429,
        error: 'Too many requests — take a breather and try again in a minute.',
      }),
    );
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('toast')).toHaveTextContent(
      'Your vote wasn’t saved. Too many requests — take a breather and try again in a minute.',
    );
  });

  it('creates the voter token on the first vote when the browser has none', async () => {
    useSettings.setState({ voterToken: null });
    const post = makePost({ upvotes: 0 });
    const { user } = renderBoard([post]);
    const button = await screen.findByTestId(`upvote-${post.id}`);
    expect(api.listPosts).toHaveBeenCalledWith(
      { sort: 'new', type: 'all', voter: null },
      expect.anything(),
    );
    api.toggleVote.mockResolvedValue(ok({ upvotes: 1, hasVoted: true }));
    await user.click(button);
    const token = useSettings.getState().voterToken;
    expect(token).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    expect(api.toggleVote).toHaveBeenCalledWith(post.id, token);
  });
});

describe('CommunityBoard — edge cases', () => {
  it('sends whatever a bot typed into the honeypot (the server then fakes a success)', async () => {
    const { user } = renderBoard([]);
    await screen.findByTestId('post-empty');
    const fake = makePost({ title: 'Cheap watches', body: 'Buy cheap watches now please.' });
    api.createPost.mockResolvedValue(ok({ post: fake }));
    await user.type(screen.getByTestId('post-title-input'), 'Cheap watches');
    await user.type(screen.getByTestId('post-body-input'), 'Buy cheap watches now please.');
    // Bots fill every input they find; people never see this one.
    await user.type(screen.getByTestId('post-honeypot'), 'https://spam.example');
    await user.click(screen.getByTestId('post-submit'));
    await waitFor(() => expect(api.createPost).toHaveBeenCalledTimes(1));
    expect(api.createPost).toHaveBeenCalledWith(
      expect.objectContaining({ website: 'https://spam.example' }),
    );
    // The bot sees an ordinary success; the honeypot is cleared for the next try.
    expect(await screen.findByTestId(`post-card-${fake.id}`)).toBeInTheDocument();
    expect(screen.getByTestId('post-honeypot')).toHaveValue('');
  });

  it('shows a new post even when the list had failed to load, then fetches the board again', async () => {
    api.listPosts.mockResolvedValueOnce({
      ok: false,
      status: 500,
      error: 'Something went wrong on our side. Please try again in a moment.',
    });
    const older = makePost({ title: 'An older idea' });
    const created = makePost({ title: 'Freshly posted idea' });
    api.listPosts.mockResolvedValue(ok({ posts: [created, older] }));
    api.createPost.mockResolvedValue(ok({ post: created }));
    const user = userEvent.setup();
    render(<CommunityBoard />);
    expect(await screen.findByTestId('post-list-error')).toBeInTheDocument();

    await user.type(screen.getByTestId('post-title-input'), 'Freshly posted idea');
    await user.type(screen.getByTestId('post-body-input'), 'This one should show up anyway.');
    await user.click(screen.getByTestId('post-submit'));

    expect(await screen.findByTestId(`post-card-${created.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId('post-list-error')).not.toBeInTheDocument();
    await waitFor(() => expect(api.listPosts).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId(`post-card-${older.id}`)).toBeInTheDocument();
    expect(cardIds()).toEqual([`post-card-${created.id}`, `post-card-${older.id}`]);
  });

  it('replaces a malformed stored voter token before voting (the API would refuse it)', async () => {
    useSettings.setState({ voterToken: 'bad token!' });
    const post = makePost({ upvotes: 2 });
    const { user } = renderBoard([post]);
    const button = await screen.findByTestId(`upvote-${post.id}`);
    api.toggleVote.mockResolvedValue(ok({ upvotes: 3, hasVoted: true }));
    await user.click(button);
    const token = useSettings.getState().voterToken;
    expect(token).not.toBe('bad token!');
    expect(token).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    expect(api.toggleVote).toHaveBeenCalledWith(post.id, token);
    await waitFor(() => expect(button).toHaveAttribute('data-count', '3'));
  });

  it('never shows an author email on the board, even if one slipped into the data', async () => {
    const leaky = { ...makePost({ authorName: 'Asha' }), authorEmail: 'asha@example.com' };
    renderBoard([leaky]);
    const card = await screen.findByTestId(`post-card-${leaky.id}`);
    expect(card).toHaveTextContent('by Asha');
    expect(document.body.innerHTML).not.toContain('asha@example.com');
  });

  it('announces the number of posts after the filter changes', async () => {
    api.listPosts.mockResolvedValue(ok({ posts: [makePost(), makePost()] }));
    const user = userEvent.setup();
    render(
      <>
        <CommunityBoard />
        <LiveAnnouncer />
      </>,
    );
    await screen.findByTestId('post-count');
    api.listPosts.mockResolvedValue(ok({ posts: [makePost({ type: 'bug' })] }));
    await user.click(screen.getByTestId('filter-bug'));
    await waitFor(() => expect(screen.getByTestId('post-count')).toHaveTextContent('1 post'));
    expect(screen.getByTestId('sr-announcer').textContent).toMatch(/^1 post/);
  });
});
