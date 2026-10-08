// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { makeAdminPost } from '@/components/community/test-fixtures';
import { dismissAllToasts, Toaster } from '@/components/ui/Toast';
import { type AdminOverview, type ApiResult } from '@/lib/api-client';
import type * as ApiClient from '@/lib/api-client';
import { AdminApp } from './AdminApp';

const api = vi.hoisted(() => ({
  adminSession: vi.fn(),
  adminLogin: vi.fn(),
  adminLogout: vi.fn(),
  adminOverview: vi.fn(),
  adminSetPostStatus: vi.fn(),
  adminDeletePost: vi.fn(),
  adminDeleteComment: vi.fn(),
  adminSetMessageRead: vi.fn(),
  adminDeleteMessage: vi.fn(),
}));

vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  ...api,
}));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
});

afterEach(() => {
  dismissAllToasts();
});

const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data });
const OK = ok({ ok: true as const });

const GAME_NAMES = { 'teen-patti': 'Teen Patti', blackjack: 'Blackjack' };

function overviewFixture(): AdminOverview {
  return {
    posts: [
      makeAdminPost({
        id: 1,
        title: 'Add Mendikot',
        type: 'game',
        status: 'open',
        authorName: 'Asha',
        authorEmail: 'asha@example.com',
        upvotes: 5,
        commentCount: 1,
      }),
      makeAdminPost({ id: 2, title: 'Dark mode', type: 'feature', status: 'planned' }),
    ],
    comments: [
      {
        id: 11,
        postId: 1,
        postTitle: 'Add Mendikot',
        body: 'Yes please!',
        authorName: null,
        createdAt: '2026-10-02T10:00:00.000Z',
      },
    ],
    messages: [
      {
        id: 21,
        name: 'Kabir',
        email: 'kabir@example.com',
        message: 'Loved the Blackjack lesson.\nThank you!',
        read: false,
        createdAt: '2026-10-03T09:00:00.000Z',
      },
      {
        id: 22,
        name: 'Lina',
        email: 'lina@example.com',
        message: 'How do I reset my Jeet?',
        read: true,
        createdAt: '2026-10-01T09:00:00.000Z',
      },
    ],
    ratings: [
      {
        id: 31,
        gameSlug: 'teen-patti',
        stars: 5,
        comment: 'So clear!',
        createdAt: '2026-10-03T12:00:00.000Z',
      },
      {
        id: 32,
        gameSlug: 'teen-patti',
        stars: 4,
        comment: null,
        createdAt: '2026-10-02T12:00:00.000Z',
      },
      {
        id: 33,
        gameSlug: 'go-fish',
        stars: 3,
        comment: 'Bit fast',
        createdAt: '2026-10-01T12:00:00.000Z',
      },
    ],
    ratingSummary: [
      { gameSlug: 'go-fish', count: 1, average: 3 },
      { gameSlug: 'teen-patti', count: 2, average: 4.5 },
    ],
  };
}

function renderAdmin() {
  const user = userEvent.setup();
  render(
    <>
      <AdminApp gameNames={GAME_NAMES} />
      <Toaster />
    </>,
  );
  return { user };
}

async function renderLoggedIn(overview = overviewFixture()) {
  api.adminSession.mockResolvedValue(ok({ enabled: true, authenticated: true }));
  api.adminOverview.mockResolvedValue(ok(overview));
  const utils = renderAdmin();
  await screen.findByTestId('admin-post-1');
  return utils;
}

describe('AdminApp — access', () => {
  it('explains ADMIN_PASSWORD when admin is disabled', async () => {
    api.adminSession.mockResolvedValue(ok({ enabled: false, authenticated: false }));
    renderAdmin();
    const panel = await screen.findByTestId('admin-disabled');
    expect(within(panel).getByRole('heading', { name: 'Admin is switched off' })).toBeVisible();
    expect(panel).toHaveTextContent('ADMIN_PASSWORD');
    expect(screen.queryByTestId('admin-password')).not.toBeInTheDocument();
  });

  it('rejects an empty password without calling the server', async () => {
    api.adminSession.mockResolvedValue(ok({ enabled: true, authenticated: false }));
    const { user } = renderAdmin();
    const input = await screen.findByTestId('admin-password');
    // Focus is moved in a passive effect, which can flush after findBy resolves under load.
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByTestId('admin-login'));
    expect(input).toHaveAccessibleDescription(/Please enter the password\./);
    expect(api.adminLogin).not.toHaveBeenCalled();
  });

  it('shows the error for a wrong password, then logs in and loads the dashboard', async () => {
    api.adminSession.mockResolvedValue(ok({ enabled: true, authenticated: false }));
    api.adminLogin.mockResolvedValueOnce({
      ok: false,
      status: 401,
      error: 'That password is not right.',
    });
    const { user } = renderAdmin();
    const input = await screen.findByTestId('admin-password');
    await user.type(input, 'wrong-guess');
    await user.click(screen.getByTestId('admin-login'));
    expect(await screen.findByTestId('admin-login-error')).toHaveTextContent(
      'That password is not right.',
    );
    expect(api.adminLogin).toHaveBeenCalledWith('wrong-guess');
    expect(input).toHaveFocus();
    expect(api.adminOverview).not.toHaveBeenCalled();

    api.adminLogin.mockResolvedValueOnce(OK);
    api.adminOverview.mockResolvedValue(ok(overviewFixture()));
    await user.clear(input);
    await user.type(input, 'correct horse');
    await user.click(screen.getByTestId('admin-login'));

    expect(await screen.findByTestId('admin-post-1')).toBeInTheDocument();
    expect(api.adminLogin).toHaveBeenLastCalledWith('correct horse');
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Welcome back to the booth.' })).toHaveFocus(),
    );
    // The test ids sit on the real role="tab" buttons (Playwright can assert aria-selected).
    for (const tab of ['posts', 'comments', 'messages', 'ratings']) {
      expect(screen.getByTestId(`admin-tab-${tab}`)).toHaveAttribute('role', 'tab');
    }
    expect(screen.getByTestId('admin-tab-posts')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('admin-tab-posts')).toBe(screen.getByRole('tab', { name: /Posts/ }));
  });

  it('goes back to the login form when the session has expired', async () => {
    api.adminSession.mockResolvedValue(ok({ enabled: true, authenticated: true }));
    api.adminOverview.mockResolvedValue({
      ok: false,
      status: 401,
      error: 'Please log in as admin to continue.',
    });
    renderAdmin();
    expect(await screen.findByTestId('admin-password')).toBeInTheDocument();
    expect(screen.getByText('Your admin session has ended. Please log in again.')).toBeVisible();
  });

  it('logs out', async () => {
    const { user } = await renderLoggedIn();
    api.adminLogout.mockResolvedValue(OK);
    await user.click(screen.getByTestId('admin-logout'));
    expect(await screen.findByTestId('admin-password')).toBeInTheDocument();
    expect(api.adminLogout).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('toast')).toHaveTextContent('Logged out.');
  });
});

describe('AdminApp — posts', () => {
  it('lists posts with the author email and a status select', async () => {
    await renderLoggedIn();
    const row = screen.getByTestId('admin-post-1');
    expect(within(row).getByRole('link', { name: 'Add Mendikot' })).toHaveAttribute(
      'href',
      '/community/1',
    );
    expect(within(row).getByRole('link', { name: /asha@example\.com/ })).toHaveAttribute(
      'href',
      'mailto:asha@example.com',
    );
    expect(within(screen.getByTestId('admin-post-2')).getByText('No email given')).toBeVisible();
    const select = screen.getByTestId('admin-status-1');
    expect(select).toHaveValue('open');
    expect(select).toHaveAccessibleName('Status: Add Mendikot');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Open', 'Planned', 'In progress', 'Done']);
  });

  it('changes a status, confirms with a toast and refreshes', async () => {
    const { user } = await renderLoggedIn();
    expect(api.adminOverview).toHaveBeenCalledTimes(1);
    api.adminSetPostStatus.mockResolvedValue(
      ok({ post: { ...overviewFixture().posts[0]!, status: 'in-progress' } }),
    );
    const updated = overviewFixture();
    updated.posts[0]!.status = 'in-progress';
    api.adminOverview.mockResolvedValue(ok(updated));

    await user.selectOptions(screen.getByTestId('admin-status-1'), 'in-progress');
    expect(api.adminSetPostStatus).toHaveBeenCalledWith(1, 'in-progress');
    await waitFor(() => expect(api.adminOverview).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('admin-status-1')).toHaveValue('in-progress');
    expect(screen.getByTestId('admin-post-1')).toHaveAttribute('data-status', 'in-progress');
    expect(screen.getByTestId('toast')).toHaveTextContent(
      'Status of “Add Mendikot” set to In progress.',
    );
  });

  it('reverts a failed status change', async () => {
    const { user } = await renderLoggedIn();
    api.adminSetPostStatus.mockResolvedValue({
      ok: false,
      status: 500,
      error: 'Something went wrong on our side. Please try again in a moment.',
    });
    await user.selectOptions(screen.getByTestId('admin-status-1'), 'done');
    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Something went wrong on our side.',
    );
    await waitFor(() => expect(screen.getByTestId('admin-status-1')).toHaveValue('open'));
  });

  it('deletes a post only after confirming in a dialog', async () => {
    const { user } = await renderLoggedIn();
    await user.click(screen.getByTestId('admin-delete-1'));
    let dialog = await screen.findByRole('alertdialog', { name: 'Delete this post?' });
    expect(dialog).toHaveAccessibleDescription(
      '“Add Mendikot” and all of its comments and votes will be removed for good.',
    );
    expect(within(dialog).getByTestId('admin-confirm-cancel')).toHaveFocus();
    await user.click(within(dialog).getByTestId('admin-confirm-cancel'));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(api.adminDeletePost).not.toHaveBeenCalled();
    expect(screen.getByTestId('admin-delete-1')).toHaveFocus();

    api.adminDeletePost.mockResolvedValue(OK);
    const after = overviewFixture();
    after.posts = after.posts.filter((p) => p.id !== 1);
    after.comments = [];
    api.adminOverview.mockResolvedValue(ok(after));

    await user.click(screen.getByTestId('admin-delete-1'));
    dialog = await screen.findByRole('alertdialog', { name: 'Delete this post?' });
    await user.click(within(dialog).getByTestId('admin-confirm-delete'));

    await waitFor(() => expect(screen.queryByTestId('admin-post-1')).not.toBeInTheDocument());
    expect(api.adminDeletePost).toHaveBeenCalledWith(1);
    expect(screen.getByTestId('admin-post-2')).toBeInTheDocument();
    expect(screen.getByTestId('toast')).toHaveTextContent('Post deleted.');
    await waitFor(() => expect(api.adminOverview).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Community posts' })).toHaveFocus(),
    );
  });
});

describe('AdminApp — comments, messages and ratings', () => {
  it('deletes a comment', async () => {
    const { user } = await renderLoggedIn();
    await user.click(screen.getByTestId('admin-tab-comments'));
    const row = await screen.findByTestId('admin-comment-11');
    expect(within(row).getByRole('link', { name: 'On “Add Mendikot”' })).toHaveAttribute(
      'href',
      '/community/1#comment-11',
    );
    api.adminDeleteComment.mockResolvedValue(OK);
    api.adminOverview.mockResolvedValue(ok({ ...overviewFixture(), comments: [] }));
    await user.click(within(row).getByRole('button', { name: 'Delete comment by Anonymous' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this comment?' });
    await user.click(within(dialog).getByTestId('admin-confirm-delete'));
    await waitFor(() => expect(screen.queryByTestId('admin-comment-11')).not.toBeInTheDocument());
    expect(api.adminDeleteComment).toHaveBeenCalledWith(11);
  });

  it('lists contact messages with mailto links and toggles read/unread', async () => {
    const { user } = await renderLoggedIn();
    await user.click(screen.getByTestId('admin-tab-messages'));
    expect(screen.getByTestId('admin-tab-messages')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('admin-tab-posts')).toHaveAttribute('aria-selected', 'false');
    // The count on the tab is the number of unread messages, and says so.
    expect(screen.getByTestId('admin-tab-messages')).toHaveAccessibleName(
      /^Messages\s*1\s*unread$/,
    );

    const unread = await screen.findByTestId('admin-message-21');
    expect(unread).toHaveAttribute('data-read', 'false');
    expect(within(unread).getByText('Kabir')).toBeVisible();
    expect(within(unread).getByText('Unread')).toBeVisible();
    expect(within(unread).getByRole('link', { name: /kabir@example\.com/ })).toHaveAttribute(
      'href',
      'mailto:kabir@example.com',
    );
    expect(within(unread).getByText(/Loved the Blackjack lesson\./).textContent).toBe(
      'Loved the Blackjack lesson.\nThank you!',
    );
    const read = screen.getByTestId('admin-message-22');
    expect(within(read).getByRole('button', { name: 'Mark as unread' })).toBeVisible();
    expect(screen.getByText('1 unread')).toBeVisible();

    api.adminSetMessageRead.mockResolvedValue(OK);
    const after = overviewFixture();
    after.messages[0]!.read = true;
    api.adminOverview.mockResolvedValue(ok(after));
    await user.click(within(unread).getByRole('button', { name: 'Mark as read' }));
    expect(api.adminSetMessageRead).toHaveBeenCalledWith(21, true);
    await waitFor(() =>
      expect(screen.getByTestId('admin-message-21')).toHaveAttribute('data-read', 'true'),
    );
    expect(
      within(screen.getByTestId('admin-message-21')).getByRole('button', {
        name: 'Mark as unread',
      }),
    ).toBeVisible();
  });

  it('deletes a message after confirming', async () => {
    const { user } = await renderLoggedIn();
    await user.click(screen.getByTestId('admin-tab-messages'));
    api.adminDeleteMessage.mockResolvedValue(OK);
    const after = overviewFixture();
    after.messages = after.messages.filter((m) => m.id !== 22);
    api.adminOverview.mockResolvedValue(ok(after));
    await user.click(screen.getByTestId('admin-message-delete-22'));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this message?' });
    expect(dialog).toHaveAccessibleDescription('The message from Lina will be removed for good.');
    await user.click(within(dialog).getByTestId('admin-confirm-delete'));
    await waitFor(() => expect(screen.queryByTestId('admin-message-22')).not.toBeInTheDocument());
    expect(api.adminDeleteMessage).toHaveBeenCalledWith(22);
    expect(screen.getByTestId('toast')).toHaveTextContent('Message deleted.');
  });

  it('summarises ratings per game and lists the latest ones', async () => {
    const { user } = await renderLoggedIn();
    await user.click(screen.getByTestId('admin-tab-ratings'));
    const table = await screen.findByTestId('admin-ratings-summary');
    const rows = within(table).getAllByRole('row').slice(1);
    // Most-rated first; catalog names when known, a readable fallback otherwise.
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual([
      'Teen Patti',
      'Go Fish',
    ]);
    expect(
      within(rows[0]!).getByRole('img', { name: '4.5 out of 5 from 2 ratings' }),
    ).toBeVisible();
    expect(within(screen.getByTestId('admin-rating-31')).getByText('So clear!')).toBeVisible();
    expect(
      within(screen.getByTestId('admin-rating-32')).getByText('No comment left.'),
    ).toBeVisible();
  });
});

describe('AdminApp — keyboard and server states', () => {
  it('moves between tabs with the arrow keys', async () => {
    const { user } = await renderLoggedIn();
    const posts = screen.getByTestId('admin-tab-posts');
    posts.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('admin-tab-comments')).toHaveFocus();
    expect(screen.getByTestId('admin-tab-comments')).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByTestId('admin-comment-11')).toBeInTheDocument();
    await user.keyboard('{End}');
    expect(screen.getByTestId('admin-tab-ratings')).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByTestId('admin-ratings-summary')).toBeInTheDocument();
    await user.keyboard('{Home}');
    expect(screen.getByTestId('admin-tab-posts')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('admin-post-1')).toBeInTheDocument();
  });

  it('shows the explainer when the server turns out to have admin disabled (503 on login)', async () => {
    api.adminSession.mockResolvedValue(ok({ enabled: true, authenticated: false }));
    api.adminLogin.mockResolvedValue({
      ok: false,
      status: 503,
      error: 'Admin is disabled on this server.',
    });
    const { user } = renderAdmin();
    await user.type(await screen.findByTestId('admin-password'), 'anything');
    await user.click(screen.getByTestId('admin-login'));
    expect(await screen.findByTestId('admin-disabled')).toBeInTheDocument();
  });

  it('shows the explainer when the dashboard gets a 503', async () => {
    api.adminSession.mockResolvedValue(ok({ enabled: true, authenticated: true }));
    api.adminOverview.mockResolvedValue({
      ok: false,
      status: 503,
      error: 'Admin is disabled on this server.',
    });
    renderAdmin();
    expect(await screen.findByTestId('admin-disabled')).toBeInTheDocument();
  });

  it('reports a failed session check and retries it', async () => {
    api.adminSession.mockResolvedValueOnce({
      ok: false,
      status: 0,
      error: 'Network error — check your connection and try again.',
    });
    api.adminSession.mockResolvedValue(ok({ enabled: true, authenticated: false }));
    const { user } = renderAdmin();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Network error');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('admin-password')).toBeInTheDocument();
  });

  it('keeps a post and explains when the delete is refused', async () => {
    const { user } = await renderLoggedIn();
    api.adminDeletePost.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Cross-site requests are not allowed.',
    });
    await user.click(screen.getByTestId('admin-delete-1'));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this post?' });
    await user.click(within(dialog).getByTestId('admin-confirm-delete'));
    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Cross-site requests are not allowed.',
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('admin-post-1')).toBeInTheDocument();
  });

  it('shows the empty state of every tab', async () => {
    const { user } = await renderLoggedIn({
      ...overviewFixture(),
      posts: [makeAdminPost({ id: 1, title: 'Only post' })],
      comments: [],
      messages: [],
      ratings: [],
      ratingSummary: [],
    });
    await user.click(screen.getByTestId('admin-tab-comments'));
    expect(await screen.findByText('No comments yet.')).toBeVisible();
    await user.click(screen.getByTestId('admin-tab-messages'));
    expect(await screen.findByText(/Your inbox is empty\./)).toBeVisible();
    await user.click(screen.getByTestId('admin-tab-ratings'));
    expect(await screen.findByText(/No lesson ratings yet\./)).toBeVisible();
  });
});
