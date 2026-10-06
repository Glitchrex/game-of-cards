// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { dismissAllToasts, Toaster } from '@/components/ui/Toast';
import { type ApiResult, type Comment, type Post } from '@/lib/api-client';
import type * as ApiClient from '@/lib/api-client';
import { useSettings } from '@/store/settings';
import { PostDetail, type PostWithComments } from './PostDetail';
import { deferred, makeComment, makePost } from './test-fixtures';

const api = vi.hoisted(() => ({
  getPost: vi.fn(),
  addComment: vi.fn(),
  toggleVote: vi.fn(),
}));

vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  ...api,
}));
vi.mock('@/store/hydrate', () => ({ useHydrated: () => true }));

const VOTER = 'voter-token-5678';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  useSettings.setState({ voterToken: VOTER });
  api.getPost.mockReset();
  api.addComment.mockReset();
  api.toggleVote.mockReset();
});

afterEach(() => {
  dismissAllToasts();
});

const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data });

function setup(data: PostWithComments, opts: { initial?: boolean } = {}) {
  api.getPost.mockResolvedValue(ok(data));
  const user = userEvent.setup();
  render(
    <>
      <PostDetail postId={data.post.id} initial={opts.initial === false ? null : data} />
      <Toaster />
    </>,
  );
  return { user };
}

function fixture(): { post: Post; comments: Comment[] } {
  const post = makePost({
    title: 'Teach Rummy with jokers',
    body: 'Line one of the idea.\nLine two, with more detail.\n\nA new paragraph.',
    type: 'game',
    status: 'in-progress',
    authorName: 'Ravi',
    upvotes: 12,
    commentCount: 1,
  });
  return {
    post,
    comments: [
      makeComment({ postId: post.id, body: 'Yes please!\nSecond line.', authorName: 'Meera' }),
    ],
  };
}

describe('PostDetail', () => {
  it('renders the full post (line breaks kept) with status, comments and a back link', async () => {
    const data = fixture();
    setup(data);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Teach Rummy with jokers' }),
    ).toBeVisible();
    const body = screen.getByTestId('post-body');
    expect(body.textContent).toBe(data.post.body);
    expect(body).toHaveClass('whitespace-pre-line');
    const article = screen.getByTestId('post-detail');
    expect(within(article).getByText('In progress')).toBeInTheDocument();
    expect(within(article).getByText('Game request')).toBeInTheDocument();
    expect(within(article).getByText('by Ravi')).toBeInTheDocument();
    expect(screen.getByTestId(`upvote-${data.post.id}`)).toHaveAttribute('data-count', '12');

    const list = screen.getByTestId('comment-list');
    expect(within(list).getByText('Meera')).toBeInTheDocument();
    expect(within(list).getByText(/Yes please!/).textContent).toBe('Yes please!\nSecond line.');
    expect(screen.getByTestId('back-to-board')).toHaveAttribute('href', '/community');

    // Refreshes with this browser's voter token once hydrated.
    await waitFor(() =>
      expect(api.getPost).toHaveBeenCalledWith(
        data.post.id,
        VOTER,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
  });

  it('treats user text as text, never as HTML', () => {
    const post = makePost({
      title: '<img src=x onerror=alert(1)>',
      body: '<b>bold?</b> & <i>no</i>',
    });
    setup({ post, comments: [] });
    expect(screen.getByTestId('post-body').textContent).toBe('<b>bold?</b> & <i>no</i>');
    expect(screen.getByTestId('post-body').querySelector('b, i')).toBeNull();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('applies the refreshed hasVoted state', async () => {
    const data = fixture();
    api.getPost.mockResolvedValue(ok({ ...data, post: { ...data.post, hasVoted: true } }));
    render(<PostDetail postId={data.post.id} initial={data} />);
    const button = screen.getByTestId(`upvote-${data.post.id}`);
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
  });

  it('validates the comment form, then posts and appends the comment', async () => {
    const data = fixture();
    const { user } = setup(data);
    await waitFor(() => expect(api.getPost).toHaveBeenCalled());

    const form = screen.getByTestId('comment-form');
    expect(form).toHaveAccessibleName('Add a comment');
    await user.click(screen.getByTestId('comment-submit'));
    const input = screen.getByTestId('comment-input');
    expect(input).toHaveFocus();
    expect(input).toHaveAccessibleDescription(/Your comment is required\./);
    expect(api.addComment).not.toHaveBeenCalled();

    await user.type(input, 'x');
    await user.click(screen.getByTestId('comment-submit'));
    expect(screen.getByText('Your comment needs at least 2 characters.')).toBeInTheDocument();
    expect(api.addComment).not.toHaveBeenCalled();

    const created = makeComment({
      postId: data.post.id,
      body: 'Count me in — jokers make it fun.',
      authorName: 'Zoya',
    });
    const pending = deferred<ApiResult<{ comment: Comment }>>();
    api.addComment.mockReturnValue(pending.promise);
    await user.clear(input);
    await user.type(input, '  Count me in — jokers make it fun. ');
    await user.type(screen.getByTestId('comment-name-input'), 'Zoya');
    await user.click(screen.getByTestId('comment-submit'));
    expect(api.addComment).toHaveBeenCalledWith(data.post.id, {
      body: 'Count me in — jokers make it fun.',
      name: 'Zoya',
      website: '',
    });
    expect(screen.getByTestId('comment-submit')).toHaveAttribute('aria-busy', 'true');

    await act(async () => pending.resolve(ok({ comment: created })));
    const list = screen.getByTestId('comment-list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText('Count me in — jokers make it fun.')).toBeInTheDocument();
    expect(screen.getByTestId('toast')).toHaveTextContent(
      'Comment posted — thanks for chiming in!',
    );
    expect(input).toHaveValue('');
    expect(screen.getByTestId('comment-name-input')).toHaveValue('Zoya');
    expect(within(screen.getByTestId('post-detail')).getByText('2 comments')).toBeInTheDocument();
  });

  it('shows the server error for a rejected comment', async () => {
    const data = fixture();
    const { user } = setup(data);
    api.addComment.mockResolvedValue({
      ok: false,
      status: 429,
      error: 'Too many requests — take a breather and try again in a minute.',
    });
    await user.type(screen.getByTestId('comment-input'), 'Great idea!');
    await user.click(screen.getByTestId('comment-submit'));
    expect(await screen.findByTestId('comment-error')).toHaveTextContent(
      'Too many requests — take a breather and try again in a minute.',
    );
    expect(screen.getByTestId('comment-input')).toHaveValue('Great idea!');
  });

  it('shows the empty comments message', () => {
    const post = makePost({ commentCount: 0 });
    setup({ post, comments: [] });
    expect(
      within(screen.getByTestId('comment-list')).getByText(
        'No comments yet. Start the conversation!',
      ),
    ).toBeInTheDocument();
  });

  it('fetches in the browser when there is no server copy', async () => {
    const data = fixture();
    const pending = deferred<ApiResult<PostWithComments>>();
    api.getPost.mockReturnValue(pending.promise);
    render(<PostDetail postId={data.post.id} />);
    expect(screen.getByTestId('post-detail-loading')).toBeInTheDocument();
    await act(async () => pending.resolve(ok(data)));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Teach Rummy with jokers' }),
    ).toBeInTheDocument();
  });

  it('shows a 404 state for an unknown post', async () => {
    api.getPost.mockResolvedValue({ ok: false, status: 404, error: 'Post not found.' });
    render(<PostDetail postId={424242} />);
    const gone = await screen.findByTestId('post-not-found');
    expect(
      within(gone).getByRole('heading', { name: 'This post has left the building' }),
    ).toBeInTheDocument();
    expect(within(gone).getByRole('link', { name: 'Back to the board' })).toHaveAttribute(
      'href',
      '/community',
    );
    expect(screen.queryByTestId('comment-form')).not.toBeInTheDocument();
  });

  it('keeps the server copy and offers a retry when only the refresh fails', async () => {
    const data = fixture();
    api.getPost.mockResolvedValue({ ok: false, status: 500, error: 'Something went wrong.' });
    render(<PostDetail postId={data.post.id} initial={data} />);
    expect(await screen.findByText(/Couldn’t refresh this post\./)).toBeInTheDocument();
    expect(screen.getByTestId('post-detail')).toBeInTheDocument();
  });

  it('retries a failed first load', async () => {
    const data = fixture();
    api.getPost.mockResolvedValueOnce({ ok: false, status: 500, error: 'Something went wrong.' });
    api.getPost.mockResolvedValue(ok(data));
    const user = userEvent.setup();
    render(<PostDetail postId={data.post.id} />);
    const alert = await screen.findByRole('alert');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('post-detail')).toBeInTheDocument();
  });
  it('upvotes from the post page and keeps the server numbers', async () => {
    const data = fixture();
    const { user } = setup(data);
    await waitFor(() => expect(api.getPost).toHaveBeenCalled());
    const button = screen.getByTestId(`upvote-${data.post.id}`);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    api.toggleVote.mockResolvedValue(ok({ upvotes: 20, hasVoted: true }));
    await user.click(button);
    expect(api.toggleVote).toHaveBeenCalledWith(data.post.id, VOTER);
    await waitFor(() => expect(button).toHaveAttribute('data-count', '20'));
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAccessibleName('Upvote “Teach Rummy with jokers” — 20 upvotes');
  });

  it('shows the 404 state when the post is removed while the page is open', async () => {
    const data = fixture();
    api.getPost.mockResolvedValue({ ok: false, status: 404, error: 'Post not found.' });
    render(<PostDetail postId={data.post.id} initial={data} />);
    expect(await screen.findByTestId('post-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('post-detail')).not.toBeInTheDocument();
  });

  it('never renders an author email, even if one slipped into the data', () => {
    const data = fixture();
    const leaky = { ...data.post, authorEmail: 'ravi@example.com' };
    setup({ post: leaky, comments: data.comments });
    expect(screen.getByTestId('post-detail')).toHaveTextContent('by Ravi');
    expect(document.body.innerHTML).not.toContain('ravi@example.com');
  });
});
