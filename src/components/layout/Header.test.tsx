// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { useSettings } from '@/store/settings';
import { resetFeedback, FeedbackButton } from './FeedbackButton';
import { Header } from './Header';

const nav = vi.hoisted(() => ({ pathname: '/community' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

afterEach(() => {
  act(() => resetFeedback());
});

beforeEach(() => {
  nav.pathname = '/community';
  useSettings.setState({ muted: true, fourColor: false, motion: 'system', botSpeed: 'normal' });
});

describe('Header', () => {
  it('links the wordmark home and marks the active section', () => {
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Game of Cards — home' })).toHaveAttribute('href', '/');
    const main = screen.getByRole('navigation', { name: 'Main' });
    const links = within(main).getAllByRole('link');
    expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Games', '/games'],
      ['Basics', '/basics'],
      ['Journey', '/journey'],
      ['Community', '/community'],
      ['Contact', '/contact'],
    ]);
    expect(within(main).getByRole('link', { name: 'Community' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(main).getByRole('link', { name: 'Games' })).not.toHaveAttribute('aria-current');
  });

  it('treats nested routes as active', () => {
    nav.pathname = '/games/blackjack/play';
    render(<Header />);
    const main = screen.getByRole('navigation', { name: 'Main' });
    expect(within(main).getByRole('link', { name: 'Games' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('opens the mobile menu sheet with every destination and closes it on navigation', async () => {
    const user = userEvent.setup();
    render(<Header />);
    const menuButton = screen.getByRole('button', { name: 'Open menu' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await user.click(menuButton);
    const sheet = await screen.findByRole('dialog', { name: 'Where to next?' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    const sheetNav = within(sheet).getByRole('navigation', { name: 'Main' });
    expect(within(sheetNav).getByRole('link', { name: /Stats & awards/ })).toHaveAttribute(
      'href',
      '/stats',
    );
    expect(within(sheet).getByRole('switch', { name: 'Four-colour deck' })).toBeInTheDocument();
    await user.click(within(sheetNav).getByRole('link', { name: /Journey/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(menuButton).toHaveFocus();
  });

  it('hands off from the menu to the feedback sheet', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Header />
        <FeedbackButton />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const sheet = await screen.findByRole('dialog', { name: 'Where to next?' });
    await user.click(within(sheet).getByRole('button', { name: 'Send feedback' }));
    const feedback = await screen.findByRole('dialog', { name: 'Share your feedback' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Where to next?' })).not.toBeInTheDocument(),
    );
    expect(within(feedback).getByRole('combobox', { name: 'Type' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus();
  });

  it('opens table settings from the gear and updates the store', async () => {
    const user = userEvent.setup();
    render(<Header />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const panel = screen.getByRole('dialog', { name: 'Table settings' });
    await user.click(within(panel).getByRole('switch', { name: 'Four-colour deck' }));
    expect(useSettings.getState().fourColor).toBe(true);
    await user.click(within(panel).getByRole('radio', { name: 'Reduce' }));
    expect(useSettings.getState().motion).toBe('reduce');
    await user.click(within(panel).getByRole('radio', { name: 'Fast' }));
    expect(useSettings.getState().botSpeed).toBe('fast');
    await user.keyboard('{ArrowLeft}');
    expect(useSettings.getState().botSpeed).toBe('normal');
  });
});
