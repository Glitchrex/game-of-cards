// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { dismissAllToasts, Toaster } from '@/components/ui/Toast';
import { closeFeedback, FeedbackButton, openFeedback, resetFeedback } from './FeedbackButton';

const nav = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

let fetchMock: ReturnType<typeof vi.fn>;

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  nav.pathname = '/';
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  act(() => resetFeedback());
  dismissAllToasts();
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function openSheet() {
  const user = userEvent.setup();
  render(
    <>
      <FeedbackButton />
      <Toaster />
    </>,
  );
  await user.click(screen.getByRole('button', { name: 'Feedback' }));
  const sheet = await screen.findByRole('dialog', { name: 'Share your feedback' });
  return { user, sheet };
}

describe('FeedbackButton', () => {
  it('opens an accessible sheet with the feedback form', async () => {
    const { sheet } = await openSheet();
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    const type = within(sheet).getByRole('combobox', { name: 'Type' });
    expect(type).toHaveFocus();
    expect(
      within(type)
        .getAllByRole('option')
        .map((o) => [o.textContent, (o as HTMLOptionElement).value]),
    ).toEqual([
      ['Feature request', 'feature'],
      ['Bug', 'bug'],
      ['Game request', 'game'],
      ['General feedback', 'general'],
    ]);
  });

  it('validates title and description against the API limits', async () => {
    const { user, sheet } = await openSheet();
    await user.click(within(sheet).getByRole('button', { name: 'Post feedback' }));
    const title = within(sheet).getByRole('textbox', { name: 'Title' });
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveFocus();
    expect(within(sheet).getByText('Title is required.')).toBeInTheDocument();
    expect(within(sheet).getByText('Description is required.')).toBeInTheDocument();

    await user.type(title, 'Hi');
    await user.type(within(sheet).getByRole('textbox', { name: 'Description' }), 'short');
    await user.type(within(sheet).getByRole('textbox', { name: /Email/ }), 'not-an-email');
    expect(within(sheet).getByText('Title needs at least 3 characters.')).toBeInTheDocument();
    expect(
      within(sheet).getByText('Description needs at least 10 characters.'),
    ).toBeInTheDocument();
    expect(within(sheet).getByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(within(sheet).getByRole('textbox', { name: 'Title' })).toHaveAttribute(
      'maxlength',
      '120',
    );
    expect(within(sheet).getByRole('textbox', { name: 'Description' })).toHaveAttribute(
      'maxlength',
      '2000',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the "website" honeypot hidden and out of the tab order', async () => {
    const { user, sheet } = await openSheet();
    const honeypot = sheet.querySelector<HTMLInputElement>('input[name="website"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute('tabindex', '-1');
    expect(honeypot).toHaveAttribute('aria-hidden', 'true');
    expect(honeypot).toHaveAttribute('autocomplete', 'off');
    expect(within(sheet).queryByRole('textbox', { name: /website/i })).not.toBeInTheDocument();

    const focused = new Set<Element | null>();
    for (let i = 0; i < 15; i++) {
      await user.tab();
      focused.add(document.activeElement);
    }
    expect(focused.has(honeypot)).toBe(false);
    expect(focused.has(within(sheet).getByRole('button', { name: 'Post feedback' }))).toBe(true);
  });

  it('posts to /api/posts and shows a success state with a link to the board', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(201, { post: { id: 7, type: 'game', title: 'Add Mendikot' } }),
    );
    const { user, sheet } = await openSheet();
    await user.selectOptions(within(sheet).getByRole('combobox', { name: 'Type' }), 'game');
    await user.type(within(sheet).getByRole('textbox', { name: 'Title' }), 'Add Mendikot');
    await user.type(
      within(sheet).getByRole('textbox', { name: 'Description' }),
      'A fun team trick-taking game from Gujarat.',
    );
    await user.type(within(sheet).getByRole('textbox', { name: /Your name/ }), 'Ravi');
    await user.click(within(sheet).getByRole('button', { name: 'Post feedback' }));

    expect(await within(sheet).findByTestId('feedback-success')).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'See the Community Board' })).toHaveAttribute(
      'href',
      '/community',
    );
    expect(await screen.findByTestId('toast')).toHaveTextContent('Feedback posted');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/posts');
    expect(JSON.parse(String(init.body))).toEqual({
      type: 'game',
      title: 'Add Mendikot',
      body: 'A fun team trick-taking game from Gujarat.',
      name: 'Ravi',
      website: '',
    });
  });

  it('shows the server message on 429', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(429, {
        error: 'Too many requests — take a breather and try again in a minute.',
      }),
    );
    const { user, sheet } = await openSheet();
    await user.type(within(sheet).getByRole('textbox', { name: 'Title' }), 'Dark mode');
    await user.type(
      within(sheet).getByRole('textbox', { name: 'Description' }),
      'Even darker felt, please.',
    );
    await user.click(within(sheet).getByRole('button', { name: 'Post feedback' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Too many requests');
  });

  it('moves focus to the first field the server rejected', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: 'Please check the highlighted fields.',
        fieldErrors: { body: 'Description needs a little more detail.' },
      }),
    );
    const { user, sheet } = await openSheet();
    await user.type(within(sheet).getByRole('textbox', { name: 'Title' }), 'Dark mode');
    await user.type(
      within(sheet).getByRole('textbox', { name: 'Description' }),
      'Even darker felt, please.',
    );
    await user.click(within(sheet).getByRole('button', { name: 'Post feedback' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent(
      'Please check the highlighted fields.',
    );
    const body = within(sheet).getByRole('textbox', { name: 'Description' });
    await waitFor(() => expect(body).toHaveFocus());
    expect(body).toHaveAccessibleDescription(/Description needs a little more detail\./);
  });

  it('keeps an unsent draft when the sheet is closed and reopened', async () => {
    const { user, sheet } = await openSheet();
    await user.type(within(sheet).getByRole('textbox', { name: 'Title' }), 'Half a thought');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Feedback' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Feedback' }));
    const again = await screen.findByRole('dialog', { name: 'Share your feedback' });
    expect(within(again).getByRole('textbox', { name: 'Title' })).toHaveValue('Half a thought');
  });

  it('hides the pill on phone game tables (play/try) but not on other game pages', () => {
    nav.pathname = '/games/blackjack/play';
    const { unmount } = render(<FeedbackButton />);
    expect(screen.getByRole('button', { name: 'Feedback' })).toHaveClass('max-sm:hidden');
    unmount();
    nav.pathname = '/games/blackjack';
    render(<FeedbackButton />);
    expect(screen.getByRole('button', { name: 'Feedback' })).not.toHaveClass('max-sm:hidden');
  });

  it('can be opened programmatically with a preset type, and is hidden on /admin', async () => {
    render(<FeedbackButton />);
    act(() => openFeedback('bug'));
    const sheet = await screen.findByRole('dialog', { name: 'Share your feedback' });
    expect(within(sheet).getByRole('combobox', { name: 'Type' })).toHaveValue('bug');
    act(() => closeFeedback());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    nav.pathname = '/admin';
    const { container } = render(
      <div data-testid="admin-root">
        <FeedbackButton />
      </div>,
    );
    expect(within(container).queryByRole('button', { name: 'Feedback' })).not.toBeInTheDocument();
  });
});
