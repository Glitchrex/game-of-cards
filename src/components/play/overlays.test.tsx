// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { roasts, titles } from '@content/titles';
import { useSettings } from '@/store/settings';
import { Celebration, CELEBRATION_FX_MS, celebrationPieces } from './Celebration';
import { PushOverlay } from './PushOverlay';
import { Roast } from './Roast';

vi.mock('@/lib/share-card', () => ({
  createShareImage: vi.fn(() => Promise.reject(new DOMException('Share cancelled', 'AbortError'))),
  shareOrDownload: vi.fn(),
}));

const title = titles[0]!;
const roast = roasts[0]!;

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  useSettings.setState({ motion: 'full' });
  sessionStorage.clear();
});

describe('Celebration', () => {
  it('is a labelled modal poster with confetti that clears itself after ~3s', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const onClose = vi.fn();
    render(
      <Celebration
        title={title}
        gameName="Blackjack"
        netJeet={250}
        onPlayAgain={() => {}}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: title.text });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription(title.blurb);
    expect(screen.getByTestId('win-title')).toHaveTextContent(title.text);
    expect(screen.getByText(`Inspired by ${title.film}`)).toBeInTheDocument();
    expect(screen.getByText('+250 Jeet')).toBeInTheDocument();
    expect(screen.queryByTestId('rating-prompt')).not.toBeInTheDocument();

    const fx = screen.getByTestId('celebration-fx');
    expect(fx.children.length).toBeLessThanOrEqual(40);
    act(() => {
      vi.advanceTimersByTime(CELEBRATION_FX_MS);
    });
    expect(screen.queryByTestId('celebration-fx')).not.toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('swaps the confetti for a static gold burst under reduced motion', () => {
    useSettings.setState({ motion: 'reduce' });
    render(
      <Celebration
        title={title}
        gameName="Blackjack"
        netJeet={100}
        onPlayAgain={() => {}}
        onClose={() => {}}
        gameSlug="blackjack"
        awardIndex={3}
      />,
    );
    expect(screen.getByTestId('celebration-burst')).toBeInTheDocument();
    expect(screen.queryByTestId('celebration-fx')).not.toBeInTheDocument();
    expect(screen.getByText('Award #3 added to your shelf')).toBeInTheDocument();
    expect(screen.getByTestId('rating-prompt')).toBeInTheDocument();
  });

  it('ignores a dismissed share sheet quietly', async () => {
    render(
      <Celebration
        title={title}
        gameName="Blackjack"
        netJeet={100}
        onPlayAgain={() => {}}
        onClose={() => {}}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('share-button'));
    });
    expect(screen.getByTestId('share-button')).not.toHaveAttribute('aria-busy');
  });

  it('lays out at most 40 deterministic pieces', () => {
    const a = celebrationPieces('t-1');
    expect(a.length).toBeLessThanOrEqual(40);
    expect(celebrationPieces('t-1')).toEqual(a);
    expect(a.filter((p) => p.kind === 'card').length).toBeGreaterThan(0);
  });
});

describe('Roast', () => {
  it('shows the roast, film, a gentle loss line, the tip card and Rematch', () => {
    const onRematch = vi.fn();
    render(
      <Roast
        roast={roast}
        tip="Tip: always split Aces and 8s."
        gameName="Blackjack"
        gameSlug="blackjack"
        netJeet={-50}
        onRematch={onRematch}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('dialog', { name: roast.text })).toBeInTheDocument();
    expect(screen.getByTestId('roast-text')).toHaveTextContent(roast.text);
    expect(screen.getByText(`Inspired by ${roast.film}`)).toBeInTheDocument();
    expect(screen.getByTestId('roast-jeet')).toHaveTextContent('This hand of Blackjack: −50 Jeet');
    expect(screen.getByTestId('roast-tip')).toHaveTextContent('TipAlways split Aces and 8s.');
    expect(screen.getByRole('link', { name: 'Review the rules' })).toHaveAttribute(
      'href',
      '/games/blackjack/learn',
    );
    expect(screen.getByTestId('rematch-button')).toHaveFocus();
    fireEvent.click(screen.getByTestId('rematch-button'));
    expect(onRematch).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('rating-prompt')).toBeInTheDocument();
  });

  it('skips the comic animation under reduced motion', () => {
    useSettings.setState({ motion: 'reduce' });
    render(
      <Roast
        roast={roast}
        tip="Watch the dealer's upcard."
        gameName="Blackjack"
        netJeet={-10}
        onRematch={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByTestId('roast-stage')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review the rules' })).not.toBeInTheDocument();
  });
});

describe('PushOverlay', () => {
  it('is calm and offers Play again', () => {
    const onPlayAgain = vi.fn();
    render(<PushOverlay gameName="Baccarat" onPlayAgain={onPlayAgain} onClose={() => {}} />);
    expect(
      screen.getByRole('dialog', { name: 'It’s a push — your Jeet is back' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Intermission · Baccarat')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('play-again'));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
  });
});
