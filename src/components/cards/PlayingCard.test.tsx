// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { CardBack, PlayingCard } from './PlayingCard';
import { SuitIcon } from './SuitIcon';
import { useSettings } from '@/store/settings';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
beforeEach(() => {
  useSettings.setState({ fourColor: false, motion: 'system' });
});

describe('PlayingCard', () => {
  it('names a face-up card after its rank and suit', () => {
    render(<PlayingCard code="QH" />);
    expect(screen.getByRole('img', { name: 'Queen of Hearts' })).toBeInTheDocument();
  });

  it('uses the printed name for tens, aces and jokers', () => {
    render(
      <>
        <PlayingCard code="TD" />
        <PlayingCard code="AS" />
        <PlayingCard code="X1" />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Ten of Diamonds' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ace of Spades' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Joker' })).toBeInTheDocument();
  });

  it('hides the identity of a face-down card', () => {
    const { container } = render(<PlayingCard code="QH" faceDown />);
    expect(screen.getByRole('img', { name: 'Face-down card' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Queen of Hearts' })).not.toBeInTheDocument();
    // The face is not even in the DOM, and the code is not leaked in attributes.
    expect(container.querySelector('[data-card]')).toBeNull();
    expect(container.innerHTML).not.toContain('QH');
  });

  it('mounts the face when a face-down card is turned over', () => {
    const { rerender } = render(<PlayingCard code="7C" faceDown />);
    rerender(<PlayingCard code="7C" faceDown={false} />);
    expect(screen.getByRole('img', { name: 'Seven of Clubs' })).toBeInTheDocument();
  });

  it('never mounts the face of a new code dealt into a face-down card', () => {
    const { container, rerender } = render(<PlayingCard code="QH" />);
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    // Turning it over keeps the shown face for the flip animation…
    rerender(<PlayingCard code="QH" faceDown />);
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    // …but a different card dealt face-down into the same slot stays secret.
    rerender(<PlayingCard code="2C" faceDown />);
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    expect(container.querySelector('[data-card]')).toBeNull();
    expect(screen.getByRole('img', { name: 'Face-down card' })).toBeInTheDocument();
    rerender(<PlayingCard code="2C" />);
    expect(screen.getByRole('img', { name: 'Two of Clubs' })).toBeInTheDocument();
  });

  it('still animates a flip that happens as the card becomes clickable', async () => {
    MotionGlobalConfig.skipAnimations = false;
    try {
      const { container, rerender } = render(<PlayingCard code="7C" faceDown />);
      const flipper = () => container.querySelector<HTMLElement>('.transform-3d');
      expect(flipper()?.style.transform).toBe('rotateY(180deg)');
      // span → button remounts the flipper; it must start from the back, not snap.
      rerender(<PlayingCard code="7C" onClick={() => {}} />);
      expect(screen.getByRole('button', { name: 'Seven of Clubs' })).toBeInTheDocument();
      expect(flipper()?.style.transform).toBe('rotateY(180deg)');
      await waitFor(() => expect(flipper()?.style.transform).toMatch(/^(none|rotateY\(0deg\))$/));
      // Becoming clickable without a flip does not re-run the animation.
      rerender(<PlayingCard code="7C" />);
      expect(flipper()?.style.transform).toMatch(/^(none|rotateY\(0deg\))$/);
    } finally {
      MotionGlobalConfig.skipAnimations = true;
    }
  });

  it('describes selection on a card that is not a button', () => {
    render(<PlayingCard code="5S" selected />);
    expect(screen.getByRole('img', { name: 'Five of Spades' })).toHaveAccessibleDescription(
      'selected',
    );
  });

  it('honours an ariaLabel override', () => {
    render(<PlayingCard code="2S" ariaLabel="Your hole card" />);
    expect(screen.getByRole('img', { name: 'Your hole card' })).toBeInTheDocument();
  });

  it('is a real button when clickable, with aria-pressed only when selected is defined', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(<PlayingCard code="KS" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'King of Spades' });
    expect(button).not.toHaveAttribute('aria-pressed');
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<PlayingCard code="KS" onClick={onClick} selected />);
    expect(screen.getByRole('button', { name: 'King of Spades' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('stays focusable but ignores clicks when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<PlayingCard code="KS" onClick={onClick} disabled />);
    const button = screen.getByRole('button', { name: 'King of Spades' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('describes highlight and coach states without changing the name', () => {
    render(
      <>
        <PlayingCard code="9H" onClick={() => {}} highlighted />
        <PlayingCard code="8H" onClick={() => {}} suggested />
      </>,
    );
    const hl = screen.getByRole('button', { name: 'Nine of Hearts' });
    expect(hl).toHaveAccessibleDescription('highlighted');
    expect(hl).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByRole('button', { name: 'Eight of Hearts' })).toHaveAccessibleDescription(
      "coach's pick",
    );
  });

  it('can be decorative', () => {
    const { container } = render(<PlayingCard code="9H" decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('CardBack', () => {
  it('is decorative unless labelled', () => {
    const { rerender } = render(<CardBack />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    rerender(<CardBack ariaLabel="Deck" />);
    expect(screen.getByRole('img', { name: 'Deck' })).toBeInTheDocument();
  });
});

describe('SuitIcon', () => {
  it('uses suit colours, with an optional four-colour deck from settings', () => {
    const { container, rerender } = render(<SuitIcon suit="D" />);
    expect(container.querySelector('svg')).toHaveClass('text-suit-red');
    useSettings.setState({ fourColor: true });
    rerender(<SuitIcon suit="D" />);
    expect(container.querySelector('svg')).toHaveClass('text-suit-blue');
    rerender(<SuitIcon suit="C" fourColor={false} title="Clubs" />);
    expect(screen.getByRole('img', { name: 'Clubs' })).toHaveClass('text-suit-black');
  });
});
