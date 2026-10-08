// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { renderToString } from 'react-dom/server';
import { useSettings } from '@/store/settings';
import { Primer, PRIMER_STEPS } from './Primer';

const push = vi.fn();
let search = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => search,
}));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  push.mockReset();
  search = new URLSearchParams('next=/games/blackjack/try');
  useSettings.setState({ primerSeen: false, motion: 'reduce' });
});

const heading = (name: string) => screen.findByRole('heading', { level: 2, name });

describe('Primer navigation', () => {
  it('moves forward and back with the Next and Back buttons', async () => {
    const user = userEvent.setup();
    render(<Primer />);
    expect(await heading('Meet the deck')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');

    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(await heading('Four suits')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Step 2 of 8');

    await user.click(screen.getByRole('button', { name: /Back/ }));
    expect(await heading('Meet the deck')).toBeInTheDocument();
  });

  it('does nothing when Back is pressed on the first screen', async () => {
    const user = userEvent.setup();
    render(<Primer />);
    const back = screen.getByRole('button', { name: /Back/ });
    expect(back).toHaveAttribute('aria-disabled', 'true');
    await user.click(back);
    expect(await heading('Meet the deck')).toBeInTheDocument();
  });

  it('moves between screens with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<Primer />);
    await heading('Meet the deck');
    await user.keyboard('{ArrowRight}');
    expect(await heading('Four suits')).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(await heading('Ranks: who beats whom')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(await heading('Four suits')).toBeInTheDocument();
  });

  it('leaves the arrow keys to a hand of cards when one has focus', async () => {
    const user = userEvent.setup();
    render(<Primer />);
    await user.keyboard('{ArrowRight}{ArrowRight}');
    await heading('Ranks: who beats whom');
    const pool = screen.getByRole('toolbar', { name: 'Cards to put in order' });
    within(pool).getByRole('button', { name: 'Nine of Clubs' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(within(pool).getByRole('button', { name: 'Three of Clubs' })).toHaveFocus();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Ranks: who beats whom' }),
    ).toBeInTheDocument();
  });
});

describe('Primer on the server', () => {
  it('prerenders the first screen with its progress and navigation', () => {
    const html = renderToString(<Primer />);
    expect(html).toContain('Meet the deck');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Primer navigation"');
    expect(html).toContain('aria-label="The deck, 52 cards"');
  });
});

describe('Primer arrow keys and overlays', () => {
  it('ignores the arrow keys while a dialog on top of the primer has focus', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Primer />
        <div role="dialog" aria-modal="true" aria-label="Settings">
          <button type="button">Inside the dialog</button>
        </div>
      </>,
    );
    await heading('Meet the deck');
    screen.getByRole('button', { name: 'Inside the dialog' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('heading', { level: 2, name: 'Meet the deck' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });
});

describe('Primer interactions', () => {
  it('peeks at the hand when a face-down card is tapped, then picks a card', async () => {
    const user = userEvent.setup();
    render(<Primer />);
    for (let i = 0; i < 4; i++) await user.keyboard('{ArrowRight}');
    await heading('Your hand');
    expect(screen.getByRole('img', { name: "Opponent's hand, 5 cards" })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Face-down card 1 of 5' }));
    expect(screen.getByRole('status')).toHaveTextContent('Only you can see these');
    const mine = screen.getByRole('toolbar', { name: 'Your hand' });
    await user.click(within(mine).getByRole('button', { name: 'King of Diamonds' }));
    expect(within(mine).getByRole('button', { name: 'King of Diamonds' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('status')).toHaveTextContent('You picked the King of Diamonds');
    // The opponent's cards stay secret the whole time.
    expect(screen.queryByText(/Queen of Spades/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide my cards' }));
    expect(screen.getByRole('toolbar', { name: 'Your hand, 5 cards' })).toBeInTheDocument();
  });

  it('turns the face cards over one by one', async () => {
    const user = userEvent.setup();
    render(<Primer />);
    for (let i = 0; i < 3; i++) await user.keyboard('{ArrowRight}');
    await heading('Face cards');
    await user.click(screen.getByRole('button', { name: /Face-down card 2/ }));
    expect(screen.getByRole('button', { name: 'Queen of Spades' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Meet the Queen');
    expect(screen.getByRole('status')).toHaveTextContent('1 of 3 met');
  });

  it('spreads the deck when it is tapped', async () => {
    const user = userEvent.setup();
    render(<Primer />);
    await user.click(screen.getByRole('button', { name: 'The deck, 52 cards' }));
    expect(screen.getByRole('status')).toHaveTextContent('52 cards: 4 families of 13 cards each');
    expect(screen.getByRole('list', { name: 'The deck, spread out' })).toBeInTheDocument();
  });

  it('teaches suit names on tap', async () => {
    const user = userEvent.setup();
    render(<Primer />);
    await user.keyboard('{ArrowRight}');
    await heading('Four suits');
    await user.click(screen.getByRole('button', { name: 'Clubs' }));
    expect(screen.getByRole('button', { name: 'Clubs' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Clubs: three round leaves');
    expect(screen.getByRole('status')).toHaveTextContent('1 of 4 suits found');
  });

  it('gives feedback in the ordering game', async () => {
    const user = userEvent.setup();
    render(<Primer />);
    await user.keyboard('{ArrowRight}{ArrowRight}');
    await heading('Ranks: who beats whom');
    await user.click(screen.getByRole('button', { name: 'King of Clubs' }));
    expect(screen.getByRole('status')).toHaveTextContent('Not quite');
    for (const name of ['Three of Clubs', 'Six of Clubs', 'Nine of Clubs', 'King of Clubs']) {
      await user.click(screen.getByRole('button', { name }));
    }
    expect(screen.getByRole('status')).toHaveTextContent('Perfect order!');
  });

  it('asks for the winner of a trick and explains wrong picks', async () => {
    const user = userEvent.setup();
    render(<Primer />);
    for (let i = 0; i < 5; i++) await user.keyboard('{ArrowRight}');
    await heading('A trick');
    await user.click(screen.getByRole('button', { name: 'King of Clubs, played by North' }));
    expect(screen.getByRole('status')).toHaveTextContent('it is a Club');
    await user.click(screen.getByRole('button', { name: 'Ten of Hearts, played by East' }));
    expect(screen.getByRole('status')).toHaveTextContent('East wins the trick');
  });

  it('shows that a trump beats the led suit', async () => {
    const user = userEvent.setup();
    render(<Primer />);
    for (let i = 0; i < 6; i++) await user.keyboard('{ArrowRight}');
    await heading('Trump');
    await user.click(screen.getByRole('button', { name: 'Ace of Diamonds, played by North' }));
    expect(screen.getByRole('status')).toHaveTextContent('a trump beats it');
    await user.click(screen.getByRole('button', { name: 'Two of Spades, played by East' }));
    expect(screen.getByRole('status')).toHaveTextContent('Spades are trump');
  });

  it('checks melds', async () => {
    const user = userEvent.setup();
    render(<Primer />);
    for (let i = 0; i < 7; i++) await user.keyboard('{ArrowRight}');
    await heading('Melds: sets and runs');
    await user.click(screen.getByRole('button', { name: /^Group 3:/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Not a set');
    await user.click(screen.getByRole('button', { name: /^Group 2:/ }));
    expect(screen.getByRole('status')).toHaveTextContent('is a run');
  });
});

describe('Primer finishing and skipping', () => {
  it('skip marks the primer as seen and goes to a safe ?next=', async () => {
    const user = userEvent.setup();
    render(<Primer />);
    await user.click(screen.getByRole('button', { name: 'Skip — I already know cards' }));
    expect(useSettings.getState().primerSeen).toBe(true);
    expect(push).toHaveBeenCalledWith('/games/blackjack/try');
  });

  it.each(['//evil.example', 'https://evil.example/games', 'javascript:alert(1)'])(
    'falls back to /games for an unsafe next (%s)',
    async (next) => {
      search = new URLSearchParams({ next });
      const user = userEvent.setup();
      render(<Primer />);
      await user.click(screen.getByRole('button', { name: 'Skip — I already know cards' }));
      expect(push).toHaveBeenCalledWith('/games');
      expect(useSettings.getState().primerSeen).toBe(true);
    },
  );

  it('falls back to /games when there is no next', async () => {
    search = new URLSearchParams();
    const user = userEvent.setup();
    render(<Primer />);
    await user.click(screen.getByRole('button', { name: 'Skip — I already know cards' }));
    expect(push).toHaveBeenCalledWith('/games');
  });

  it('finishes on the last screen', async () => {
    const user = userEvent.setup();
    render(<Primer />);
    for (let i = 0; i < PRIMER_STEPS; i++) {
      await user.click(screen.getByRole('button', { name: /Next/ }));
    }
    expect(await heading("You're ready!")).toBeInTheDocument();
    expect(useSettings.getState().primerSeen).toBe(true);
    expect(screen.queryByRole('button', { name: /Skip/ })).not.toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(push).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Let's play/ }));
    expect(push).toHaveBeenCalledWith('/games/blackjack/try');
  });
});
