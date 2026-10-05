// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { useSettings } from '@/store/settings';
import { DeckShowcase } from './DeckShowcase';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
beforeEach(() => {
  useSettings.setState({ motion: 'system' });
});

const flippers = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-flip]'));

describe('DeckShowcase', () => {
  it('is a decorative 12-card deck with a text alternative', () => {
    const { container } = render(<DeckShowcase startDelayMs={60_000} />);
    expect(screen.getByText(/deals a royal flush of Hearts/)).toHaveClass('sr-only');
    const stage = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(stage).toHaveStyle({ aspectRatio: '16 / 9' });
    expect(stage.querySelectorAll('[data-sc]')).toHaveLength(12);
    // Only the five dealt cards have faces (12 backs + 5 faces).
    expect(stage.querySelectorAll('svg')).toHaveLength(17);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('starts as a face-down stack and settles into a floating showcase', async () => {
    const { container } = render(<DeckShowcase startDelayMs={0} />);
    expect(flippers(container).every((f) => f.style.transform === 'rotateY(180deg)')).toBe(true);
    await waitFor(() => expect(container.querySelector('.animate-float')).not.toBeNull());
  });

  it('shows the finished fan straight away under reduced motion', async () => {
    useSettings.setState({ motion: 'reduce' });
    const { container } = render(<DeckShowcase startDelayMs={0} />);
    const faceUp = flippers(container).filter((f) => f.style.transform === 'rotateY(0deg)');
    expect(faceUp).toHaveLength(5);
    // The dealt cards sit above the rest of the deck.
    for (const f of faceUp) {
      expect(Number((f.parentElement as HTMLElement).style.zIndex)).toBeGreaterThanOrEqual(20);
    }
    // No looping float animation, and the sequence never starts.
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('.animate-float')).toBeNull();
  });
});
