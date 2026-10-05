// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { useState } from 'react';
import { type CardCode } from '@/games/core/cards';
import { Hand } from './Hand';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

const CARDS: CardCode[] = ['AS', '7H', 'QC', '2D', 'KH'];

describe('Hand keyboard navigation', () => {
  it('is a single tab stop with roving tabindex', async () => {
    const user = userEvent.setup();
    render(<Hand cards={CARDS} label="Your hand" onActivate={() => {}} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Your hand' });
    const buttons = within(toolbar).getAllByRole('button');
    expect(buttons).toHaveLength(5);
    expect(buttons.filter((b) => b.tabIndex === 0)).toHaveLength(1);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Ace of Spades' })).toHaveFocus();
    await user.tab();
    expect(toolbar).not.toContainElement(document.activeElement as HTMLElement);
  });

  it('moves focus with the arrow keys, Home and End', async () => {
    const user = userEvent.setup();
    render(<Hand cards={CARDS} label="Your hand" onActivate={() => {}} />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Seven of Hearts' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Queen of Clubs' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: 'Seven of Hearts' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('button', { name: 'Ace of Spades' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: 'Ace of Spades' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('button', { name: 'King of Hearts' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'King of Hearts' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('button', { name: 'Ace of Spades' })).toHaveFocus();
    // The focused card is the tab stop.
    expect(screen.getByRole('button', { name: 'Ace of Spades' })).toHaveAttribute('tabindex', '0');
  });

  it('activates the focused card with Enter and Space', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<Hand cards={CARDS} label="Your hand" onActivate={onActivate} />);
    await user.tab();
    await user.keyboard('{ArrowRight}{ArrowRight}{Enter}');
    expect(onActivate).toHaveBeenLastCalledWith('QC', 2);
    await user.keyboard('{ArrowRight} ');
    expect(onActivate).toHaveBeenLastCalledWith('2D', 3);
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it('activates a card on click/tap', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<Hand cards={CARDS} label="Your hand" onActivate={onActivate} />);
    await user.click(screen.getByRole('button', { name: 'King of Hearts' }));
    expect(onActivate).toHaveBeenCalledWith('KH', 4);
  });

  it('keeps focus in the hand when the focused card is played', async () => {
    const user = userEvent.setup();
    function Playable() {
      const [cards, setCards] = useState(CARDS);
      return (
        <Hand
          cards={cards}
          label="Your hand"
          onActivate={(_c, i) => setCards((cs) => cs.filter((_, j) => j !== i))}
        />
      );
    }
    render(<Playable />);
    await user.tab();
    await user.keyboard('{ArrowRight}{Enter}');
    expect(screen.queryByRole('button', { name: 'Seven of Hearts' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Queen of Clubs' })).toHaveFocus();
  });
  it('keeps the tab stop on the focused card when another card leaves', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Hand cards={CARDS} label="Your hand" onActivate={() => {}} />);
    await user.tab();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    const queen = screen.getByRole('button', { name: 'Queen of Clubs' });
    expect(queen).toHaveFocus();
    rerender(<Hand cards={CARDS.slice(1)} label="Your hand" onActivate={() => {}} />);
    expect(screen.getByRole('button', { name: 'Queen of Clubs' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Queen of Clubs' })).toHaveAttribute('tabindex', '0');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Two of Diamonds' })).toHaveFocus();
  });
});

describe('Hand states', () => {
  it('dims and describes cards that cannot be played', () => {
    render(
      <Hand
        cards={CARDS}
        label="Your hand"
        onActivate={() => {}}
        playable={(code) => code[1] === 'H'}
      />,
    );
    const seven = screen.getByRole('button', { name: 'Seven of Hearts' });
    const ace = screen.getByRole('button', { name: 'Ace of Spades' });
    expect(seven).not.toHaveAttribute('data-dimmed');
    expect(ace).toHaveAttribute('data-dimmed', 'true');
    expect(ace).toHaveAccessibleDescription("can't be played right now");
  });

  it('can describe unplayable cards without dimming them', () => {
    render(
      <Hand
        cards={CARDS}
        label="Your hand"
        onActivate={() => {}}
        playable={() => false}
        dimUnplayable={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'Ace of Spades' })).not.toHaveAttribute(
      'data-dimmed',
    );
  });

  it('marks highlighted, suggested and selected cards', () => {
    render(
      <Hand
        cards={CARDS}
        label="Your hand"
        onActivate={() => {}}
        highlighted={new Set([0, 1])}
        suggested={1}
        selected={new Set([4])}
      />,
    );
    expect(screen.getByRole('button', { name: 'Ace of Spades' })).toHaveAttribute(
      'data-highlighted',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Seven of Hearts' })).toHaveAttribute(
      'data-suggested',
      'true',
    );
    expect(screen.getByRole('button', { name: 'King of Hearts' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Queen of Clubs' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('renders a display-only hand as a labelled list of cards', () => {
    render(<Hand cards={['AS', 'KH']} label="Table" />);
    const list = screen.getByRole('list', { name: 'Table' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByRole('img', { name: 'King of Hearts' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it("announces only the count of an opponent's face-down hand", () => {
    render(
      <Hand cards={['AS', 'KH', '2C', '3C', '4C', '5C', '6C']} label="Opponent's hand" faceDown />,
    );
    expect(screen.getByRole('img', { name: "Opponent's hand, 7 cards" })).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Ace of Spades' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Ace of Spades/)).not.toBeInTheDocument();
  });

  it('numbers face-down cards in an interactive hand without revealing them', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const { container } = render(
      <Hand cards={['AS', 'KH', '2C']} label="Your hand" faceDown onActivate={onActivate} />,
    );
    expect(screen.getByRole('toolbar', { name: 'Your hand, 3 cards' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Face-down card 2 of 3' }));
    expect(onActivate).toHaveBeenCalledWith('KH', 1);
    expect(container.querySelector('[data-card]')).toBeNull();
    expect(screen.queryByText(/King of Hearts/)).not.toBeInTheDocument();
  });

  it('handles duplicate cards from two decks', () => {
    render(<Hand cards={['AS', 'AS', 'KH']} label="Your hand" onActivate={() => {}} />);
    expect(screen.getAllByRole('button', { name: 'Ace of Spades' })).toHaveLength(2);
  });
});
