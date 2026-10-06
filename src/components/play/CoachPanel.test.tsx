// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { CoachPanel } from './CoachPanel';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

describe('CoachPanel', () => {
  it('shows the situation, an optional why, and actions', () => {
    render(
      <CoachPanel
        situation={<p>You have 16 against a dealer 10.</p>}
        why="Sixteen is the hardest hand in Blackjack."
        actions={<button type="button">Next</button>}
      />,
    );
    const panel = screen.getByRole('complementary', { name: 'Coach' });
    expect(panel).toHaveTextContent('You have 16 against a dealer 10.');
    expect(panel).toHaveTextContent('Why?');
    expect(panel).toHaveTextContent('Sixteen is the hardest hand in Blackjack.');
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.queryByTestId('coach-hint')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coach-error')).not.toBeInTheDocument();
  });

  it('shows the illegal-move reason prominently as an alert', () => {
    render(<CoachPanel title="Your coach" situation="Your turn." error="You must follow suit." />);
    expect(screen.getByRole('complementary', { name: 'Your coach' })).toBeInTheDocument();
    const error = screen.getByTestId('coach-error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error).toHaveTextContent('Why not?');
    expect(error).toHaveTextContent('You must follow suit.');
  });

  it('offers "What would a pro do?" and shows the revealed hint', async () => {
    const user = userEvent.setup();
    const onHint = vi.fn();
    const { rerender } = render(<CoachPanel situation="Your turn." onHint={onHint} />);
    await user.click(screen.getByTestId('coach-hint'));
    expect(onHint).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('coach-hint')).toHaveTextContent('What would a pro do?');
    rerender(<CoachPanel situation="Your turn." onHint={onHint} hintRevealed="Stand on 17." />);
    expect(screen.getByTestId('coach-hint-text')).toHaveTextContent('Stand on 17.');
    expect(screen.getByTestId('coach-hint-text').parentElement).toHaveAttribute(
      'aria-live',
      'polite',
    );
    rerender(<CoachPanel situation="Your turn." onHint={onHint} hintLabel="Show me" />);
    expect(screen.getByTestId('coach-hint')).toHaveTextContent('Show me');
  });

  it('collapses on small screens but keeps the error visible', async () => {
    const user = userEvent.setup();
    render(<CoachPanel situation="Watch the dealer." error="Wait for your turn." />);
    const toggle = screen.getByRole('button', { name: 'Hide coach' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    const show = screen.getByRole('button', { name: 'Show coach' });
    expect(show).toHaveAttribute('aria-expanded', 'false');
    const body = document.getElementById(show.getAttribute('aria-controls') ?? '');
    expect(body).toHaveClass('max-lg:hidden');
    expect(screen.getByTestId('coach-error')).toBeInTheDocument();
  });
});
