// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { Pile } from './Pile';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

describe('Pile', () => {
  it('is a button announcing its action and count', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Pile count={23} label="Draw from stock" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Draw from stock, 23 cards' });
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText('23')).toBeInTheDocument();
  });

  it('names the face-up top card', () => {
    render(<Pile count={4} label="Discard pile" topCard="7H" />);
    expect(
      screen.getByRole('img', { name: 'Discard pile, 4 cards, top card Seven of Hearts' }),
    ).toBeInTheDocument();
  });

  it('keeps a face-down top card secret', () => {
    const { container } = render(<Pile count={1} label="Stock" topCard="7H" faceUp={false} />);
    expect(screen.getByRole('img', { name: 'Stock, 1 card' })).toBeInTheDocument();
    expect(container.querySelector('[data-card]')).toBeNull();
  });

  it('shows an empty slot', () => {
    render(<Pile count={0} label="Foundation" dropId="foundation-0" />);
    const pile = screen.getByRole('img', { name: 'Foundation, empty' });
    expect(pile).toHaveAttribute('data-drop-id', 'foundation-0');
  });

  it("describes the coach's pick and highlights without changing the name", () => {
    render(
      <>
        <Pile count={9} label="Draw from stock" onClick={() => {}} suggested />
        <Pile count={3} label="Discard pile" topCard="QS" highlighted />
        <Pile count={3} label="Waste" topCard="2S" />
      </>,
    );
    expect(
      screen.getByRole('button', { name: 'Draw from stock, 9 cards' }),
    ).toHaveAccessibleDescription("coach's pick");
    expect(
      screen.getByRole('img', { name: 'Discard pile, 3 cards, top card Queen of Spades' }),
    ).toHaveAccessibleDescription('highlighted');
    expect(
      screen.getByRole('img', { name: 'Waste, 3 cards, top card Two of Spades' }),
    ).not.toHaveAttribute('aria-describedby');
  });

  it('ignores clicks while disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Pile count={5} label="Draw from stock" onClick={onClick} disabled />);
    await user.click(screen.getByRole('button', { name: 'Draw from stock, 5 cards' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
